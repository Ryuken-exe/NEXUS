export type Criterion = { id: string; weight: number; maxScore: number };
export type CandidateAssignment = { judgeId: string; submissionId: string; load: number };

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

export function normalizeJudgeScores(rows: { judgeId: string; submissionId: string; total: number }[]) {
    const grouped = new Map<string, typeof rows>();
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

export function autoAssign(judgeIds: string[], submissionIds: string[], perSubmission = 2, initialLoads: Record<string, number> = {}, existingAssignments: { judgeId: string; submissionId: string }[] = []) {
    if (!judgeIds.length || !submissionIds.length || perSubmission < 1) return [] as { judgeId: string; submissionId: string }[];
    const loads = new Map(judgeIds.map((judgeId) => [judgeId, initialLoads[judgeId] ?? 0]));
    const result: { judgeId: string; submissionId: string }[] = [];
    for (const submissionId of submissionIds) {
        const chosen = new Set(existingAssignments.filter((item) => item.submissionId === submissionId).map((item) => item.judgeId));
        const needed = Math.min(perSubmission - chosen.size, judgeIds.length - chosen.size);
        for (let index = 0; index < needed; index++) {
            const judgeId = judgeIds.filter((id) => !chosen.has(id)).sort((a, b) => loads.get(a)! - loads.get(b)! || a.localeCompare(b))[0];
            if (!judgeId) break;
            chosen.add(judgeId);
            loads.set(judgeId, loads.get(judgeId)! + 1);
            result.push({ judgeId, submissionId });
        }
    }
    return result;
}