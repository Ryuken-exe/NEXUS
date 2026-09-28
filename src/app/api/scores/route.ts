import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { calibrationDirection, weightedScore, validateRubric } from '@/lib/judging';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';
import { dispatchWebhook } from '@/lib/webhooks';
import { isBeforeDeadline } from '@/lib/judging';

export async function POST(request: Request) {
    try {
        const judge = await requireUser(['JUDGE']);
        const input = z.object({ assignmentId: z.string(), values: z.record(z.number()), feedback: z.string().max(3000).default(''), changeReason: z.string().max(500).optional() }).safeParse(await jsonBody(request));
        if (!input.success) throw new HttpError(400, 'Invalid score payload');
        const assignment = await db.judgeAssignment.findUnique({ where: { id: input.data.assignmentId }, include: { event: { include: { criteria: true } }, submission: true } });
        if (!assignment || assignment.judgeId !== judge.id) throw new HttpError(404, 'Assignment not found');
        if (!isBeforeDeadline(new Date(), assignment.event.judgingEnds)) throw new HttpError(409, 'Judging is closed');
        if (!validateRubric(assignment.event.criteria)) throw new HttpError(409, 'Event rubric is invalid');
        let total: number;
        try { total = weightedScore(input.data.values, assignment.event.criteria); }
        catch (error) { throw new HttpError(400, error instanceof Error ? error.message : 'Invalid score'); }
        const score = await db.$transaction(async (tx) => {
            const previous = await tx.score.findUnique({ where: { assignmentId: assignment.id } });
            const saved = await tx.score.upsert({ where: { assignmentId: assignment.id }, create: { assignmentId: assignment.id, submissionId: assignment.submissionId, judgeId: judge.id, values: input.data.values, total, feedback: input.data.feedback }, update: { values: input.data.values, total, feedback: input.data.feedback } });
            if (previous) {
                const oldValues = previous.values as Record<string, number>;
                const changedCriteria = assignment.event.criteria.filter((criterion) => oldValues[criterion.id] !== input.data.values[criterion.id]).map((criterion) => ({ id: criterion.id, name: criterion.name, oldValue: oldValues[criterion.id] ?? null, newValue: input.data.values[criterion.id] ?? null }));
                await tx.auditLog.create({ data: { eventId: assignment.eventId, actorId: judge.id, action: 'score.edited', targetId: saved.id, details: { scoreId: saved.id, submissionId: assignment.submissionId, judgeId: judge.id, oldValue: { values: previous.values, total: previous.total, feedback: previous.feedback }, newValue: { values: input.data.values, total, feedback: input.data.feedback }, changedCriteria, changeReason: input.data.changeReason ?? '' } } });
            } else await tx.auditLog.create({ data: { eventId: assignment.eventId, actorId: judge.id, action: 'score.changed', targetId: saved.id, details: { total, values: input.data.values } } });
            return saved;
        });
        const scores = await db.score.findMany({ where: { assignment: { eventId: assignment.eventId } }, select: { judgeId: true, submissionId: true, total: true } });
        const calibration = calibrationDirection(scores, judge.id);
        const [assignedCount, completedCount] = await Promise.all([
            db.judgeAssignment.count({ where: { eventId: assignment.eventId } }),
            db.score.count({ where: { assignment: { eventId: assignment.eventId } } })
        ]);
        if (assignedCount > 0 && assignedCount === completedCount) await dispatchWebhook(assignment.eventId, 'scores.finalized', { eventId: assignment.eventId, completedCount });
        return NextResponse.json({ ...score, calibration });
    } catch (error) { return errorResponse(error); }
}