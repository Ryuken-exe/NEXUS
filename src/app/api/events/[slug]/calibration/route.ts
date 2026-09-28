import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { calibrationDirection } from '@/lib/judging';
import { errorResponse, HttpError } from '@/lib/http';

export async function GET(_request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['JUDGE', 'ORGANIZER', 'ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        const manager = user.role !== 'JUDGE';
        if (manager) await requireEventManager(event.id, user.id, user.role);
        const scores = await db.score.findMany({ where: { assignment: { eventId: event.id } }, select: { judgeId: true, submissionId: true, total: true } });
        if (!manager) return NextResponse.json({ direction: calibrationDirection(scores, user.id) });
        const judges = await db.user.findMany({ where: { role: 'JUDGE', assignments: { some: { eventId: event.id } } }, select: { id: true, name: true } });
        return NextResponse.json({ judges: judges.map((judge) => ({ id: judge.id, name: judge.name, direction: calibrationDirection(scores, judge.id), scoredCount: scores.filter((score) => score.judgeId === judge.id).length })) });
    } catch (error) { return errorResponse(error); }
}