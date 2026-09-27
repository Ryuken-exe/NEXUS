import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeJudgeScores } from '@/lib/judging';
import { csv } from '@/lib/security';
import { requireEventManager, requireUser } from '@/lib/auth';
import { errorResponse, HttpError } from '@/lib/http';
export async function GET(request: Request, context: { params: { slug: string } }) {
    try {
        const manager = await requireUser(['ORGANIZER', 'ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        await requireEventManager(event.id, manager.id, manager.role);
        const type = new URL(request.url).searchParams.get('type') ?? 'submissions';
        const headers = { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${event.slug}-${type}.csv"` };
        if (type === 'submissions') {
            const rows = await db.submission.findMany({ where: { eventId: event.id }, include: { team: { select: { name: true } }, track: { select: { name: true } } } });
            return new NextResponse(csv(rows.map((row) => ({ id: row.id, title: row.title, team: row.team.name, track: row.track.name, status: row.status, submittedAt: row.submittedAt?.toISOString() ?? '', tagline: row.tagline })), ['id', 'title', 'team', 'track', 'status', 'submittedAt', 'tagline']), { headers });
        }
        if (type === 'assignments') {
            const rows = await db.judgeAssignment.findMany({ where: { eventId: event.id }, include: { judge: { select: { email: true } }, submission: { select: { title: true } }, score: true } });
            return new NextResponse(csv(rows.map((row) => ({ judge: row.judge.email, submission: row.submission.title, assignedAt: row.assignedAt.toISOString(), scored: Boolean(row.score) })), ['judge', 'submission', 'assignedAt', 'scored']), { headers });
        }
        if (['raw-scores', 'normalized-scores', 'results'].includes(type)) {
            const rows = await db.score.findMany({ where: { submission: { eventId: event.id } }, include: { submission: { select: { title: true } }, judge: { select: { email: true } } } });
            const normalized = normalizeJudgeScores(rows.map(({ judgeId, submissionId, total }) => ({ judgeId, submissionId, total })));
            const zById = new Map(normalized.map((item, index) => [rows[index].id, item.zScore]));
            const values = type === 'raw-scores' ? rows.map((row) => ({ submission: row.submission.title, judge: row.judge.email, score: row.total })) : type === 'normalized-scores' ? rows.map((row) => ({ submission: row.submission.title, judge: row.judge.email, zScore: zById.get(row.id) })) : [...new Map(rows.map((row) => [row.submissionId, row])).values()].map((row) => { const same = rows.filter((item) => item.submissionId === row.submissionId); return { submission: row.submission.title, meanRaw: same.reduce((sum, item) => sum + item.total, 0) / same.length, meanZ: same.reduce((sum, item) => sum + (zById.get(item.id) ?? 0), 0) / same.length }; });
            return new NextResponse(csv(values, Object.keys(values[0] ?? { submission: '', score: '' })), { headers });
        }
        throw new HttpError(400, 'Unsupported export type');
    } catch (error) { return errorResponse(error); }
}