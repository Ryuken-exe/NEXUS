import { db } from '@/lib/db';

export function findJudgeAssignment(assignmentId: string, judgeId: string) {
    return db.judgeAssignment.findFirst({
        where: { id: assignmentId, judgeId },
        include: { event: { include: { criteria: true } }, submission: true }
    });
}

export type ScoringAssignment = NonNullable<Awaited<ReturnType<typeof findJudgeAssignment>>>;

export async function persistJudgeScore(input: {
    assignment: ScoringAssignment;
    judgeId: string;
    values: Record<string, number>;
    total: number;
    feedback: string;
    changeReason?: string;
}) {
    const { assignment, judgeId, values, total, feedback, changeReason } = input;
    return db.$transaction(async (tx) => {
        const previous = await tx.score.findUnique({ where: { assignmentId: assignment.id } });
        const saved = await tx.score.upsert({
            where: { assignmentId: assignment.id },
            create: { assignmentId: assignment.id, submissionId: assignment.submissionId, judgeId, values, total, feedback },
            update: { values, total, feedback }
        });
        if (previous) {
            const oldValues = previous.values as Record<string, number>;
            const changedCriteria = assignment.event.criteria
                .filter((criterion) => oldValues[criterion.id] !== values[criterion.id])
                .map((criterion) => ({ id: criterion.id, name: criterion.name, oldValue: oldValues[criterion.id] ?? null, newValue: values[criterion.id] ?? null }));
            await tx.auditLog.create({
                data: {
                    eventId: assignment.eventId,
                    actorId: judgeId,
                    action: 'score.edited',
                    targetId: saved.id,
                    details: {
                        scoreId: saved.id,
                        submissionId: assignment.submissionId,
                        judgeId,
                        oldValue: { values: previous.values, total: previous.total, feedback: previous.feedback },
                        newValue: { values, total, feedback },
                        changedCriteria,
                        changeReason: changeReason ?? ''
                    }
                }
            });
        } else {
            await tx.auditLog.create({ data: { eventId: assignment.eventId, actorId: judgeId, action: 'score.changed', targetId: saved.id, details: { total, values } } });
        }
        return saved;
    });
}

export function findEventScoreTotals(eventId: string) {
    return db.score.findMany({ where: { assignment: { eventId } }, select: { judgeId: true, submissionId: true, total: true } });
}

export async function countEventScoringProgress(eventId: string) {
    const [assignedCount, completedCount] = await Promise.all([
        db.judgeAssignment.count({ where: { eventId } }),
        db.score.count({ where: { assignment: { eventId } } })
    ]);
    return { assignedCount, completedCount };
}