import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { errorResponse, HttpError } from '@/lib/http';
export async function GET(_request: Request, context: { params: { slug: string } }) {
    try {
        const manager = await requireUser(['ORGANIZER', 'ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        await requireEventManager(event.id, manager.id, manager.role);
        const [judges, assignments, scored] = await Promise.all([
            db.user.findMany({ where: { role: 'JUDGE', assignments: { some: { eventId: event.id } } }, select: { id: true, name: true, assignments: { where: { eventId: event.id }, select: { score: { select: { id: true } } } } } }),
            db.judgeAssignment.count({ where: { eventId: event.id } }), db.score.count({ where: { assignment: { eventId: event.id } } })
        ]);
        return NextResponse.json({ judges: judges.map((judge) => { const assigned = judge.assignments.length; const completed = judge.assignments.filter((assignment) => assignment.score).length; return { id: judge.id, name: judge.name, assigned, completed, percent: assigned ? Math.round(completed / assigned * 100) : 0 }; }), assignments, scored, percent: assignments ? Math.round(scored / assignments * 100) : 0 });
    } catch (error) { return errorResponse(error); }
}