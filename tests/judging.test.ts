import { describe, expect, it } from 'vitest';
import { autoAssign, calibrationDirection, isBeforeDeadline, normalizeJudgeScores, rankResults, validateRubric, weightedScore } from '../src/lib/judging';
import { csv, signRecord, verifyRecord } from '../src/lib/security';
import { createRateLimiter } from '../src/lib/rate-limit';

describe('judging primitives', () => {
    it('requires rubric weights to total 100 and applies weights against each maximum', () => {
        const rubric = [{ id: 'impact', weight: 60, maxScore: 10 }, { id: 'craft', weight: 40, maxScore: 5 }];
        expect(validateRubric(rubric)).toBe(true);
        expect(weightedScore({ impact: 8, craft: 4 }, rubric)).toBe(80);
        expect(validateRubric([...rubric, { id: 'extra', weight: 1, maxScore: 10 }])).toBe(false);
    });

    it('keeps the deadline open at T-1 and closes it at T and T+1', () => {
        const deadline = new Date('2026-09-27T12:00:00.000Z');
        expect(isBeforeDeadline(new Date(deadline.getTime() - 1000), deadline)).toBe(true);
        expect(isBeforeDeadline(deadline, deadline)).toBe(false);
        expect(isBeforeDeadline(new Date(deadline.getTime() + 1000), deadline)).toBe(false);
    });

    it('rejects scores outside their criterion range', () => {
        expect(() => weightedScore({ impact: 11, craft: 3 }, [{ id: 'impact', weight: 50, maxScore: 10 }, { id: 'craft', weight: 50, maxScore: 10 }])).toThrow(/invalid/);
    });

    it('balances assignments and avoids assigning a judge twice to one submission', () => {
        const pairs = autoAssign(['a', 'b', 'c'], ['p1', 'p2', 'p3', 'p4'], 2);
        expect(pairs).toHaveLength(8);
        expect(pairs.filter((pair) => pair.submissionId === 'p1').map((pair) => pair.judgeId)).toEqual(['a', 'b']);
        const loads = pairs.reduce<Record<string, number>>((counts, pair) => ({ ...counts, [pair.judgeId]: (counts[pair.judgeId] ?? 0) + 1 }), {});
        expect(Object.values(loads)).toEqual([3, 3, 2]);
        const nextBatch = autoAssign(['a', 'b', 'c'], ['p5'], 2, loads);
        expect(nextBatch.map((pair) => pair.judgeId)).toEqual(['c', 'a']);
        expect(autoAssign(['a', 'b', 'c'], ['p1'], 2, loads, pairs)).toEqual([]);
    });

    it('excludes conflicted judge and submission pairs during auto-assignment', () => {
        const pairs = autoAssign(['a', 'b', 'c'], ['p1'], 2, {}, [], [{ judgeId: 'a', submissionId: 'p1' }]);
        expect(pairs).toEqual([{ judgeId: 'b', submissionId: 'p1' }, { judgeId: 'c', submissionId: 'p1' }]);
        expect(autoAssign(['a'], ['p1'], 2, {}, [{ judgeId: 'outside-pool', submissionId: 'p1' }])).toEqual([{ judgeId: 'a', submissionId: 'p1' }]);
    });

    it('compares a judge with qualified peers and returns the correct calibration direction', () => {
        const rows = [
            { judgeId: 'target', submissionId: 'p1', total: 80 }, { judgeId: 'target', submissionId: 'p2', total: 82 },
            { judgeId: 'peer-a', submissionId: 'p1', total: 70 }, { judgeId: 'peer-a', submissionId: 'p2', total: 72 },
            { judgeId: 'peer-b', submissionId: 'p3', total: 70 }
        ];
        expect(calibrationDirection(rows, 'target')).toBe('higher');
        expect(calibrationDirection(rows.map((row) => ({ ...row, total: row.judgeId === 'target' ? 69 : row.total })), 'target')).toBe('lower');
        expect(calibrationDirection(rows.map((row) => ({ ...row, total: row.judgeId === 'target' ? 71 : row.total })), 'target')).toBe('in-line');
        expect(calibrationDirection(rows.slice(0, 1), 'target')).toBe('insufficient-data');
    });

    it('applies deterministic tie-break order after normalized scores', () => {
        const tied = [
            { id: 'consensus', normalizedScore: 1, criterionScores: { impact: 7, craft: 9 }, judgeCount: 4, submittedAt: '2026-09-28T12:00:00Z' },
            { id: 'earlier', normalizedScore: 1, criterionScores: { impact: 7, craft: 9 }, judgeCount: 3, submittedAt: '2026-09-27T12:00:00Z' },
            { id: 'criterion', normalizedScore: 1, criterionScores: { impact: 8, craft: 1 }, judgeCount: 2, submittedAt: '2026-09-28T12:00:00Z' },
            { id: 'later', normalizedScore: 1, criterionScores: { impact: 7, craft: 9 }, judgeCount: 3, submittedAt: '2026-09-28T12:00:00Z' }
        ];
        const criteria = [{ id: 'impact', name: 'Impact', weight: 60 }, { id: 'craft', name: 'Craft', weight: 40 }];
        const firstRun = rankResults(tied, criteria);
        expect(rankResults([...tied].reverse(), criteria)).toEqual(firstRun);
        expect(firstRun.map((row) => row.id)).toEqual(['criterion', 'consensus', 'earlier', 'later']);
        expect(firstRun[0].tieBreakReason).toBeNull();
        expect(firstRun[1].tieBreakReason).toBe('highest weighted criterion');
        expect(firstRun[2].tieBreakReason).toBe('number of distinct judges');
        expect(firstRun[3].tieBreakReason).toBe('earlier submission');
    });

    it('normalizes within judges and returns zero when variance is undefined', () => {
        const result = normalizeJudgeScores([{ judgeId: 'a', submissionId: 'p1', total: 10 }, { judgeId: 'a', submissionId: 'p2', total: 20 }, { judgeId: 'b', submissionId: 'p3', total: 7 }]);
        expect(result[0].zScore).toBeCloseTo(-Math.SQRT1_2);
        expect(result[1].zScore).toBeCloseTo(Math.SQRT1_2);
        expect(result[2].zScore).toBe(0);
        expect(normalizeJudgeScores([{ judgeId: 'same', submissionId: 'p1', total: 12 }, { judgeId: 'same', submissionId: 'p2', total: 12 }]).map((row) => row.zScore)).toEqual([0, 0]);
    });

    it('quotes CSV and neutralizes spreadsheet formulas in string fields', () => {
        expect(csv([{ name: '=1+1', note: 'a,"b"' }], ['name', 'note'])).toBe('"name","note"\r\n"\'=1+1","a,""b"""');
    });

    it('verifies HMAC judge records and detects payload tampering', () => {
        const payload = JSON.stringify({ event: 'showcase', judgeId: 'judge-1' });
        const signed = signRecord(payload);
        expect(verifyRecord(payload, signed.hash, signed.signature, process.env.JUDGE_SIGNING_SECRET!)).toBe(true);
        expect(verifyRecord(`${payload} `, signed.hash, signed.signature, process.env.JUDGE_SIGNING_SECRET!)).toBe(false);
    });

    it('limits public reads per key and resets after the window', () => {
        const allow = createRateLimiter(2, 1000);
        expect(allow('viewer-a', 0)).toBe(true);
        expect(allow('viewer-a', 1)).toBe(true);
        expect(allow('viewer-a', 2)).toBe(false);
        expect(allow('viewer-b', 2)).toBe(true);
        expect(allow('viewer-a', 1000)).toBe(true);
    });
});