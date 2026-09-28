export type Criterion = { id: string; weight: number; maxScore: number };
export type CandidateAssignment = { judgeId: string; submissionId: string; load: number };
export type AssignmentPair = { judgeId: string; submissionId: string };
export type CalibrationDirection = 'higher' | 'lower' | 'in-line' | 'insufficient-data';

export function isBeforeDeadline(now: Date, deadline: Date) {
    return now.getTime() < deadline.getTime();
}

export function validateRubric(criteria: Criterion[]) {
    if (!criteria.length || criteria.some((criterion) => criterion.weight < 0 || criterion.maxScore <= 0)) return false;
    return Math.abs(criteria.reduce((sum, criterion) => sum + criterion.weight, 0) - 100) < 0.0001;
}

export function weightedScore(values: Record<string, number>, criteria: Criterion[]) {
    if (!validateRubric(criteria)) throw new Error('Rubric weights must sum to 100 and have valid score ranges');
    for (const criterion of criteria) {
        const value = values[criterion.id];
        if (!Number.isFinite(value) || value < 0 || value > criterion.maxScore) throw new Error(`Score for criterion ${criterion.id} is invalid`);
    }
    return criteria.reduce((total, criterion) => total + values[criterion.id] / criterion.maxScore * criterion.weight, 0);
}

export function normalizeJudgeScores<T extends { judgeId: string; submissionId: string; total: number }>(rows: T[]) {
    const grouped = new Map<string, T[]>();
    for (const row of rows) grouped.set(row.judgeId, [...(grouped.get(row.judgeId) ?? []), row]);
    return rows.map((row) => {
        const own = grouped.get(row.judgeId)!;
        const mean = own.reduce((sum, item) => sum + item.total, 0) / own.length;
        const variance = own.length > 1 ? own.reduce((sum, item) => sum + (item.total - mean) ** 2, 0) / (own.length - 1) : 0;
        const deviation = Math.sqrt(variance);
        // Standardize within each judge; a judge with one score or no variance contributes that score's own mean (z = 0).
        return { ...row, zScore: deviation === 0 ? 0 : (row.total - mean) / deviation };
    });
}

export function autoAssign(judgeIds: string[], submissionIds: string[], perSubmission = 2, initialLoads: Record<string, number> = {}, existingAssignments: AssignmentPair[] = [], conflictedAssignments: AssignmentPair[] = []) {
    if (!judgeIds.length || !submissionIds.length || perSubmission < 1) return [] as { judgeId: string; submissionId: string }[];
    const loads = new Map(judgeIds.map((judgeId) => [judgeId, initialLoads[judgeId] ?? 0]));
    const conflicts = new Set(conflictedAssignments.map((item) => `${item.judgeId}:${item.submissionId}`));
    const result: { judgeId: string; submissionId: string }[] = [];
    for (const submissionId of submissionIds) {
        const chosen = new Set(existingAssignments.filter((item) => item.submissionId === submissionId).map((item) => item.judgeId));
        const needed = Math.max(0, perSubmission - chosen.size);
        for (let index = 0; index < needed; index++) {
            const judgeId = judgeIds.filter((id) => !chosen.has(id) && !conflicts.has(`${id}:${submissionId}`)).sort((a, b) => loads.get(a)! - loads.get(b)! || a.localeCompare(b))[0];
            if (!judgeId) break;
            chosen.add(judgeId);
            loads.set(judgeId, loads.get(judgeId)! + 1);
            result.push({ judgeId, submissionId });
        }
    }
    return result;
}

export function calibrationDirection(rows: { judgeId: string; submissionId: string; total: number }[], judgeId: string, inLineThreshold = 1): CalibrationDirection {
    const own = rows.filter((row) => row.judgeId === judgeId);
    const eligibleJudges = new Set(rows.filter((row) => row.judgeId !== judgeId).map((row) => row.judgeId).filter((otherId) => rows.filter((row) => row.judgeId === otherId).length >= 2));
    const peers = rows.filter((row) => eligibleJudges.has(row.judgeId));
    if (own.length < 2 || peers.length === 0) return 'insufficient-data';
    const ownAverage = own.reduce((sum, row) => sum + row.total, 0) / own.length;
    const peerAverage = peers.reduce((sum, row) => sum + row.total, 0) / peers.length;
    const difference = ownAverage - peerAverage;
    if (Math.abs(difference) <= inLineThreshold) return 'in-line';
    return difference > 0 ? 'higher' : 'lower';
}

export type RankedResult = {
    id: string;
    normalizedScore: number | null;
    criterionScores: Record<string, number>;
    judgeCount: number;
    submittedAt: Date | string;
};

export function rankResults<T extends RankedResult>(rows: T[], criteria: { id: string; name: string; weight: number }[]) {
    const orderedCriteria = [...criteria].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const compare = (left: T, right: T) => {
        if (left.normalizedScore !== right.normalizedScore) {
            if (left.normalizedScore === null) return 1;
            if (right.normalizedScore === null) return -1;
            return right.normalizedScore - left.normalizedScore;
        }
        for (const criterion of orderedCriteria) {
            const difference = (right.criterionScores[criterion.id] ?? 0) - (left.criterionScores[criterion.id] ?? 0);
            if (difference !== 0) return difference;
        }
        if (left.judgeCount !== right.judgeCount) return right.judgeCount - left.judgeCount;
        const timeDifference = new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime();
        if (timeDifference !== 0) return timeDifference;
        return left.id.localeCompare(right.id);
    };
    const reason = (left: T, right: T) => {
        for (const criterion of orderedCriteria) {
            if ((left.criterionScores[criterion.id] ?? 0) !== (right.criterionScores[criterion.id] ?? 0)) return 'highest weighted criterion';
        }
        if (left.judgeCount !== right.judgeCount) return 'number of distinct judges';
        if (new Date(left.submittedAt).getTime() !== new Date(right.submittedAt).getTime()) return 'earlier submission';
        return 'stable project identifier';
    };
    const sorted = [...rows].sort(compare);
    return sorted.map((row, index) => {
        const previous = sorted[index - 1];
        return { ...row, rank: index + 1, tieBreakReason: previous && previous.normalizedScore === row.normalizedScore ? reason(previous, row) : null };
    });
}