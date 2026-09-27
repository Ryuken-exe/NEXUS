import { describe, expect, it } from 'vitest';
import { autoAssign, isBeforeDeadline, normalizeJudgeScores, validateRubric, weightedScore } from '../src/lib/judging';
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

    it('normalizes within judges and returns zero when variance is undefined', () => {
        const result = normalizeJudgeScores([{ judgeId: 'a', submissionId: 'p1', total: 10 }, { judgeId: 'a', submissionId: 'p2', total: 20 }, { judgeId: 'b', submissionId: 'p3', total: 7 }]);
        expect(result[0].zScore).toBeCloseTo(-Math.SQRT1_2);
        expect(result[1].zScore).toBeCloseTo(Math.SQRT1_2);
        expect(result[2].zScore).toBe(0);
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