import { calibrationDirection, isBeforeDeadline, validateRubric, weightedScore } from '@/lib/judging';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/http';
import { dispatchWebhook } from '@/lib/webhooks';
import { countEventScoringProgress, findEventScoreTotals, findJudgeAssignment, persistJudgeScore } from '@/repositories/scoring-repository';

export async function saveJudgeScore(input: {
    judgeId: string;
    assignmentId: string;
    values: Record<string, number>;
    feedback: string;
    changeReason?: string;
}) {
    const assignment = await findJudgeAssignment(input.assignmentId, input.judgeId);
    if (!assignment) throw new NotFoundError('Assignment not found');
    if (!isBeforeDeadline(new Date(), assignment.event.judgingEnds)) throw new ConflictError('Judging is closed');
    if (!validateRubric(assignment.event.criteria)) throw new ConflictError('Event rubric is invalid');

    let total: number;
    try {
        total = weightedScore(input.values, assignment.event.criteria);
    } catch (error) {
        throw new ValidationError(error instanceof Error ? error.message : 'Invalid score');
    }

    const score = await persistJudgeScore({ ...input, assignment, total });
    const scores = await findEventScoreTotals(assignment.eventId);
    const calibration = calibrationDirection(scores, input.judgeId);
    const { assignedCount, completedCount } = await countEventScoringProgress(assignment.eventId);
    if (assignedCount > 0 && assignedCount === completedCount) {
        await dispatchWebhook(assignment.eventId, 'scores.finalized', { eventId: assignment.eventId, completedCount });
    }
    return { ...score, calibration };
}