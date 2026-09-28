import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { currentSession } from '@/lib/auth';
import { normalizeJudgeScores, rankResults } from '@/lib/judging';
import { isBeforeDeadline } from '@/lib/judging';
import { errorResponse, HttpError } from '@/lib/http';
import { dispatchWebhook } from '@/lib/webhooks';

export async function GET(request: Request, context: { params: { slug: string } }) {
    try {
        const session = await currentSession();
        const user = session ? await db.user.findUnique({ where: { id: session.sub }, select: { id: true, role: true } }) : null;
        const event = await db.event.findUnique({ where: { slug: context.params.slug }, include: { criteria: true } });
        if (!event) throw new HttpError(404, 'Event not found');
        const manager = user?.role === 'ADMIN' || (user?.role === 'ORGANIZER' && event.createdById === user.id);
        if (!event.resultsPublished && !manager) throw new HttpError(403, 'Results are hidden until an organizer publishes them');
        const scores = await db.score.findMany({ where: { submission: { eventId: event.id } }, select: { judgeId: true, submissionId: true, total: true, values: true } });
        const normalized = normalizeJudgeScores(scores);
        const bySubmission = new Map<string, { raw: number[]; z: number[]; criterionScores: Record<string, number[]>; judges: Set<string> }>();
        for (const score of normalized) {
            const item = bySubmission.get(score.submissionId) ?? { raw: [], z: [], criterionScores: {}, judges: new Set<string>() };
            item.raw.push(score.total);
            item.z.push(score.zScore);
            item.judges.add(score.judgeId);
            const values = score.values as Record<string, number>;
            for (const criterion of event.criteria) (item.criterionScores[criterion.id] ??= []).push(values[criterion.id] / criterion.maxScore * criterion.weight);
            bySubmission.set(score.submissionId, item);
        }
        const submissions = await db.submission.findMany({ where: { eventId: event.id, status: 'SUBMITTED' }, include: { team: { select: { name: true } }, track: { select: { name: true } }, _count: { select: { votes: true } } } });
        const view = request.headers.get('x-score-view') === 'normalized' ? 'normalized' : 'raw';
        const ranked = rankResults(submissions.map((submission) => {
            const data = bySubmission.get(submission.id) ?? { raw: [], z: [], criterionScores: {}, judges: new Set<string>() };
            const values = view === 'normalized' ? data.z : data.raw;
            return {
                id: submission.id,
                title: submission.title,
                team: submission.team.name,
                track: submission.track.name,
                score: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
                votes: submission._count.votes,
                normalizedScore: data.z.length ? data.z.reduce((sum, value) => sum + value, 0) / data.z.length : null,
                criterionScores: Object.fromEntries(event.criteria.map((criterion) => { const criterionValues = data.criterionScores[criterion.id] ?? []; return [criterion.id, criterionValues.length ? criterionValues.reduce((sum, value) => sum + value, 0) / criterionValues.length : 0]; })),
                judgeCount: data.judges.size,
                submittedAt: submission.submittedAt ?? submission.createdAt
            };
        }), event.criteria);
        return NextResponse.json(ranked.map(({ normalizedScore: _normalizedScore, criterionScores: _criterionScores, judgeCount: _judgeCount, submittedAt: _submittedAt, ...result }) => result));
    } catch (error) { return errorResponse(error); }
}

export async function POST(_request: Request, context: { params: { slug: string } }) {
    try {
        const manager = await requireUser(['ORGANIZER', 'ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        await requireEventManager(event.id, manager.id, manager.role);
        const now = new Date();
        if (isBeforeDeadline(now, event.judgingEnds) || isBeforeDeadline(now, event.votingEnds)) throw new HttpError(409, 'Judging and voting periods must both close before publication');
        await db.event.update({ where: { id: event.id }, data: { resultsPublished: true } });
        await db.auditLog.create({ data: { eventId: event.id, actorId: manager.id, action: 'results.published', targetId: event.id, details: {} } });
        await dispatchWebhook(event.id, 'results.published', { eventId: event.id, slug: event.slug });
        return NextResponse.json({ published: true });
    } catch (error) { return errorResponse(error); }
}