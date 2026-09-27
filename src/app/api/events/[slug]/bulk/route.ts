import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';
import { csv } from '@/lib/security';
import { weightedScore } from '@/lib/judging';

export async function GET(request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['ORGANIZER', 'ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug }, include: { criteria: true } });
        if (!event) throw new HttpError(404, 'Event not found');
        await requireEventManager(event.id, user.id, user.role);
        const [teams, submissions, scores] = await Promise.all([
            db.team.findMany({
                where: { eventId: event.id },
                include: { members: { include: { user: { select: { email: true } } } } }
            }),
            db.submission.findMany({ where: { eventId: event.id }, include: { track: { select: { name: true } }, team: { select: { name: true } } } }),
            db.score.findMany({ where: { submission: { eventId: event.id } }, include: { judge: { select: { email: true } }, submission: { select: { title: true, team: { select: { name: true } } } } } })
        ]);
        const snapshot = {
            version: 1,
            event: event.slug,
            teams: teams.map((team) => ({ name: team.name, members: team.members.map((member) => member.user.email) })),
            submissions: submissions.map(({ team, track, title, tagline, description, repoUrl, demoUrl, status }) => ({ teamName: team.name, track: track.name, title, tagline, description, repoUrl, demoUrl, status })),
            scores: scores.map(({ judge, submission, values, feedback }) => {
                const stored = values as Record<string, number>;
                return { judgeEmail: judge.email, teamName: submission.team.name, submissionTitle: submission.title, values: Object.fromEntries(event.criteria.map((criterion) => [criterion.name, stored[criterion.id]])), feedback };
            })
        };
        const params = new URL(request.url).searchParams;
        if (params.get('format') === 'csv') {
            const type = params.get('type');
            if (type === 'teams') return new NextResponse(csv(snapshot.teams.map((team) => ({ name: team.name, members: JSON.stringify(team.members) })), ['name', 'members']), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${event.slug}-teams.csv"` } });
            if (type === 'submissions') return new NextResponse(csv(snapshot.submissions, ['teamName', 'track', 'title', 'tagline', 'description', 'repoUrl', 'demoUrl', 'status']), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${event.slug}-submissions.csv"` } });
            if (type === 'scores') return new NextResponse(csv(snapshot.scores.map((score) => ({ ...score, values: JSON.stringify(score.values) })), ['judgeEmail', 'teamName', 'submissionTitle', 'values', 'feedback']), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${event.slug}-scores.csv"` } });
            throw new HttpError(400, 'CSV type must be teams, submissions, or scores');
        }
        return NextResponse.json(snapshot);
    } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['ORGANIZER', 'ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug }, include: { tracks: true, criteria: true } });
        if (!event) throw new HttpError(404, 'Event not found');
        await requireEventManager(event.id, user.id, user.role);
        const query = new URL(request.url).searchParams;
        let body: unknown;
        if (request.headers.get('content-type')?.includes('text/csv')) {
            const type = query.get('type');
            if (!['teams', 'submissions', 'scores'].includes(type ?? '')) throw new HttpError(400, 'CSV type must be teams, submissions, or scores');
            let rows: Record<string, string>[];
            try { rows = parse(await request.text(), { columns: true, bom: true, trim: true, skip_empty_lines: true }) as Record<string, string>[]; }
            catch { throw new HttpError(400, 'Malformed CSV: check quoting and column headers'); }
            try {
                if (type === 'teams') body = { version: 1, teams: rows.map((row) => ({ name: row.name, members: JSON.parse(row.members || '[]') })) };
                else if (type === 'submissions') body = { version: 1, submissions: rows };
                else body = { version: 1, scores: rows.map((row) => ({ ...row, values: JSON.parse(row.values || '{}') })) };
            } catch { throw new HttpError(400, 'Malformed CSV data: members and values cells must contain valid JSON'); }
        } else body = await jsonBody(request);
        const input = z.object({ version: z.literal(1), teams: z.array(z.object({ name: z.string().min(1), members: z.array(z.string().email()) })).default([]), submissions: z.array(z.object({ teamName: z.string(), track: z.string(), title: z.string().min(1), tagline: z.string(), description: z.string(), repoUrl: z.string().url().or(z.literal('')).default(''), demoUrl: z.string().url().or(z.literal('')).default(''), status: z.enum(['DRAFT', 'SUBMITTED']).default('DRAFT') })).default([]), scores: z.array(z.object({ judgeEmail: z.string().email(), teamName: z.string(), submissionTitle: z.string(), values: z.record(z.number()), feedback: z.string().max(3000).default('') })).default([]) }).safeParse(body);
        if (!input.success) throw new HttpError(400, `Malformed import: ${input.error.issues[0]?.message ?? 'invalid data'}`);
        const imported = await db.$transaction(async (tx) => {
            const emails = [...input.data.teams.flatMap((team) => team.members), ...input.data.scores.map((score) => score.judgeEmail)].map((email) => email.toLowerCase());
            const users = new Map((await tx.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true, role: true } })).map((item) => [item.email, item]));
            const teamIds = new Map<string, string>();
            for (const item of input.data.teams) {
                const team = await tx.team.upsert({ where: { eventId_name: { eventId: event.id, name: item.name } }, create: { eventId: event.id, name: item.name }, update: {} });
                teamIds.set(item.name, team.id);
                for (const email of item.members) { const member = users.get(email.toLowerCase()); if (!member) throw new Error(`Unknown team member ${email}`); await tx.teamMember.upsert({ where: { teamId_userId: { teamId: team.id, userId: member.id } }, create: { teamId: team.id, userId: member.id }, update: {} }); }
            }
            for (const item of input.data.submissions) {
                const teamId = teamIds.get(item.teamName) ?? (await tx.team.findUnique({ where: { eventId_name: { eventId: event.id, name: item.teamName } } }))?.id;
                const track = event.tracks.find((candidate) => candidate.name === item.track);
                if (!teamId || !track) throw new Error(`Unknown team or track for submission ${item.title}`);
                await tx.submission.upsert({ where: { teamId }, create: { eventId: event.id, teamId, trackId: track.id, title: item.title, tagline: item.tagline, description: item.description, repoUrl: item.repoUrl, demoUrl: item.demoUrl, status: item.status, submittedAt: item.status === 'SUBMITTED' ? new Date() : null }, update: { trackId: track.id, title: item.title, tagline: item.tagline, description: item.description, repoUrl: item.repoUrl, demoUrl: item.demoUrl, status: item.status, submittedAt: item.status === 'SUBMITTED' ? new Date() : null } });
            }
            for (const item of input.data.scores) {
                const judge = users.get(item.judgeEmail.toLowerCase());
                if (!judge || judge.role !== 'JUDGE') throw new Error(`Unknown judge ${item.judgeEmail}`);
                const submission = await tx.submission.findFirst({ where: { eventId: event.id, title: item.submissionTitle, team: { name: item.teamName } } });
                if (!submission || submission.status !== 'SUBMITTED') throw new Error(`Unknown submitted project ${item.teamName}/${item.submissionTitle}`);
                const values = Object.fromEntries(event.criteria.map((criterion) => [criterion.id, item.values[criterion.name]]));
                let total: number;
                try { total = weightedScore(values, event.criteria); }
                catch (error) { throw new Error(`Invalid imported score for ${item.teamName}/${item.submissionTitle}: ${error instanceof Error ? error.message : 'invalid values'}`); }
                const assignment = await tx.judgeAssignment.upsert({ where: { submissionId_judgeId: { submissionId: submission.id, judgeId: judge.id } }, create: { eventId: event.id, submissionId: submission.id, judgeId: judge.id, assignedById: user.id }, update: {} });
                const score = await tx.score.upsert({ where: { assignmentId: assignment.id }, create: { assignmentId: assignment.id, submissionId: submission.id, judgeId: judge.id, values, total, feedback: item.feedback }, update: { values, total, feedback: item.feedback } });
                await tx.auditLog.create({ data: { eventId: event.id, actorId: user.id, action: 'score.changed', targetId: score.id, details: { imported: true, total } } });
            }
            return { teamCount: input.data.teams.length, submissionCount: input.data.submissions.length, scoreCount: input.data.scores.length };
        });
        return NextResponse.json({ imported }, { status: 201 });
    } catch (error) { if (error instanceof Error && (error.message.startsWith('Unknown ') || error.message.startsWith('Invalid imported score'))) return NextResponse.json({ error: error.message }, { status: 400 }); return errorResponse(error); }
}