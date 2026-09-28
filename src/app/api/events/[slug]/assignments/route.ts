import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { autoAssign } from '@/lib/judging';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';

export async function GET(_request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['JUDGE', 'ORGANIZER', 'ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        if (user.role !== 'JUDGE') await requireEventManager(event.id, user.id, user.role);
        const assignments = await db.judgeAssignment.findMany({ where: user.role === 'JUDGE' ? { eventId: event.id, judgeId: user.id } : { eventId: event.id }, include: { judge: { select: { id: true, name: true, email: true } }, submission: { select: { id: true, title: true, tagline: true, description: true, repoUrl: true, demoUrl: true, submittedAt: true, team: { select: { name: true } }, track: { select: { name: true } } } }, score: true }, orderBy: [{ judge: { name: 'asc' } }, { assignedAt: 'asc' }] });
        return NextResponse.json(assignments);
    } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: { params: { slug: string } }) {
    try {
        const manager = await requireUser(['ORGANIZER', 'ADMIN']);
        const input = z.object({ mode: z.enum(['manual', 'auto']), judgeIds: z.array(z.string()).min(1), submissionIds: z.array(z.string()).min(1), perSubmission: z.number().int().min(1).max(10).default(2) }).safeParse(await jsonBody(request));
        if (!input.success) throw new HttpError(400, 'Invalid assignment request');
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        await requireEventManager(event.id, manager.id, manager.role);
        const [judges, submissions] = await Promise.all([
            db.user.findMany({ where: { id: { in: input.data.judgeIds }, role: 'JUDGE' }, select: { id: true } }),
            db.submission.findMany({ where: { id: { in: input.data.submissionIds }, eventId: event.id, status: 'SUBMITTED' }, select: { id: true, teamId: true, title: true, team: { select: { name: true, members: { select: { userId: true } } } } } })
        ]);
        if (judges.length !== input.data.judgeIds.length || submissions.length !== input.data.submissionIds.length) throw new HttpError(400, 'Some judges or submissions are invalid for this event');
        const [conflicts, existing] = await Promise.all([
            db.conflictOfInterest.findMany({ where: { eventId: event.id, active: true, OR: [{ teamId: { in: submissions.map((submission) => submission.teamId) } }, { participantId: { in: submissions.flatMap((submission) => submission.team.members.map((member) => member.userId)) } }] }, select: { judgeId: true, teamId: true, participantId: true, reason: true } }),
            db.judgeAssignment.findMany({ where: { eventId: event.id, submissionId: { in: submissions.map((submission) => submission.id) } }, select: { id: true, judgeId: true, submissionId: true, score: { select: { id: true } } } })
        ]);
        const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));
        const activeConflictPairs: { judgeId: string; submissionId: string }[] = [];
        const conflictByPair = new Map<string, typeof conflicts>();
        for (const conflict of conflicts) {
            for (const submission of submissions) {
                if (conflict.teamId !== submission.teamId && (!conflict.participantId || !submission.team.members.some((member) => member.userId === conflict.participantId))) continue;
                const key = `${conflict.judgeId}:${submission.id}`;
                activeConflictPairs.push({ judgeId: conflict.judgeId, submissionId: submission.id });
                conflictByPair.set(key, [...(conflictByPair.get(key) ?? []), conflict]);
            }
        }
        const conflictPairs = submissions.flatMap((submission) => judges.filter((judge) => conflictByPair.has(`${judge.id}:${submission.id}`)).map((judge) => ({ judgeId: judge.id, submissionId: submission.id })));
        const conflictKeys = new Set(activeConflictPairs.map((pair) => `${pair.judgeId}:${pair.submissionId}`));
        const existingConflicts = existing.filter((pair) => conflictKeys.has(`${pair.judgeId}:${pair.submissionId}`));
        if (existingConflicts.some((pair) => pair.score)) throw new HttpError(409, 'A scored assignment has a declared conflict; contact the organizer before continuing');
        let pairs;
        if (input.data.mode === 'auto') {
            const allExisting = await db.judgeAssignment.findMany({ where: { eventId: event.id }, select: { judgeId: true, submissionId: true } });
            const loads = Object.fromEntries(judges.map((judge) => [judge.id, allExisting.filter((item) => item.judgeId === judge.id && !conflictKeys.has(`${item.judgeId}:${item.submissionId}`)).length]));
            const validExisting = existing.filter((pair) => !conflictKeys.has(`${pair.judgeId}:${pair.submissionId}`));
            pairs = autoAssign(judges.map((j) => j.id), submissions.map((s) => s.id), input.data.perSubmission, loads, validExisting, activeConflictPairs);
        } else pairs = input.data.submissionIds.flatMap((submissionId) => input.data.judgeIds.map((judgeId) => ({ submissionId, judgeId }))).filter((pair) => !conflictKeys.has(`${pair.judgeId}:${pair.submissionId}`));
        const created = await db.$transaction(async (tx) => {
            for (const conflict of existingConflicts) {
                await tx.judgeAssignment.delete({ where: { id: conflict.id } });
            }
            const blockedPairs = new Map<string, { judgeId: string; submissionId: string }>();
            for (const pair of [...conflictPairs, ...existingConflicts]) blockedPairs.set(`${pair.judgeId}:${pair.submissionId}`, pair);
            for (const pair of blockedPairs.values()) {
                const submission = submissionById.get(pair.submissionId)!;
                const pairConflicts = conflictByPair.get(`${pair.judgeId}:${pair.submissionId}`) ?? [];
                await tx.auditLog.create({ data: { eventId: event.id, actorId: manager.id, action: 'assignment.blocked_by_conflict', targetId: pair.submissionId, details: { judgeId: pair.judgeId, submissionId: pair.submissionId, teamId: submission.teamId, reasons: pairConflicts.map((conflict) => ({ reason: conflict.reason, participantId: conflict.participantId })), removedExistingAssignment: existingConflicts.some((item) => item.judgeId === pair.judgeId && item.submissionId === pair.submissionId) } } });
            }
            const inserted = [];
            for (const pair of pairs) {
                const assignment = await tx.judgeAssignment.upsert({ where: { submissionId_judgeId: pair }, create: { ...pair, eventId: event.id, assignedById: manager.id }, update: {} });
                inserted.push(assignment);
                await tx.auditLog.create({ data: { eventId: event.id, actorId: manager.id, action: 'assignment.changed', targetId: assignment.id, details: pair } });
                const reassignedFrom = [...blockedPairs.values()].filter((blocked) => blocked.submissionId === pair.submissionId).map((blocked) => blocked.judgeId);
                if (reassignedFrom.length) await tx.auditLog.create({ data: { eventId: event.id, actorId: manager.id, action: 'assignment.reassigned_by_conflict', targetId: assignment.id, details: { ...pair, submissionId: pair.submissionId, reassignedFrom } } });
            }
            return inserted;
        });
        const coverage = submissions.map((submission) => {
            const assignedIds = new Set(existing.filter((pair) => pair.submissionId === submission.id && !conflictKeys.has(`${pair.judgeId}:${pair.submissionId}`)).map((pair) => pair.judgeId));
            pairs.filter((pair) => pair.submissionId === submission.id).forEach((pair) => assignedIds.add(pair.judgeId));
            return { submissionId: submission.id, title: submission.title, team: submission.team.name, assigned: assignedIds.size, required: input.data.perSubmission, eligibleJudges: judges.filter((judge) => !conflictKeys.has(`${judge.id}:${submission.id}`)).length };
        });
        const warnings = input.data.mode === 'auto' ? coverage.filter((item) => item.assigned < item.required).map((item) => ({ ...item, message: `COI restrictions or judge availability left ${item.team} below its requested judging panel.` })) : [];
        return NextResponse.json({ assignments: created, count: created.length, blocked: conflictPairs.length, warnings }, { status: 201 });
    } catch (error) { return errorResponse(error); }
}