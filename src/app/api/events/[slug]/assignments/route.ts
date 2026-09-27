import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { autoAssign } from '@/lib/judging';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';

export async function GET(_request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['JUDGE', 'ORGANIZER', 'ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        if (user.role !== 'JUDGE') await requireEventManager(event.id, user.id, user.role);
        const assignments = await db.judgeAssignment.findMany({ where: user.role === 'JUDGE' ? { eventId: event.id, judgeId: user.id } : { eventId: event.id }, include: { judge: { select: { id: true, name: true, email: true } }, submission: { select: { id: true, title: true, team: { select: { name: true } } } }, score: true }, orderBy: [{ judge: { name: 'asc' } }, { assignedAt: 'asc' }] });
        return NextResponse.json(assignments);
    } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: { params: { slug: string } }) {
    try {
        const manager = await requireUser(['ORGANIZER', 'ADMIN']);
        const input = z.object({ mode: z.enum(['manual', 'auto']), judgeIds: z.array(z.string()).min(1), submissionIds: z.array(z.string()).min(1), perSubmission: z.number().int().min(1).max(10).default(2) }).safeParse(await jsonBody(request));
        if (!input.success) throw new HttpError(400, 'Invalid assignment request');
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        await requireEventManager(event.id, manager.id, manager.role);
        const [judges, submissions] = await Promise.all([
            db.user.findMany({ where: { id: { in: input.data.judgeIds }, role: 'JUDGE' }, select: { id: true } }),
            db.submission.findMany({ where: { id: { in: input.data.submissionIds }, eventId: event.id, status: 'SUBMITTED' }, select: { id: true } })
        ]);
        if (judges.length !== input.data.judgeIds.length || submissions.length !== input.data.submissionIds.length) throw new HttpError(400, 'Some judges or submissions are invalid for this event');
        let pairs;
        if (input.data.mode === 'auto') {
            const existing = await db.judgeAssignment.findMany({ where: { eventId: event.id }, select: { judgeId: true, submissionId: true } });
            const loads = Object.fromEntries(judges.map((judge) => [judge.id, existing.filter((item) => item.judgeId === judge.id).length]));
            pairs = autoAssign(judges.map((j) => j.id), submissions.map((s) => s.id), input.data.perSubmission, loads, existing);
        } else pairs = input.data.submissionIds.flatMap((submissionId) => input.data.judgeIds.map((judgeId) => ({ submissionId, judgeId })));
        const created = await db.$transaction(async (tx) => {
            const inserted = [];
            for (const pair of pairs) {
                const assignment = await tx.judgeAssignment.upsert({ where: { submissionId_judgeId: pair }, create: { ...pair, eventId: event.id, assignedById: manager.id }, update: {} });
                inserted.push(assignment);
                await tx.auditLog.create({ data: { eventId: event.id, actorId: manager.id, action: 'assignment.changed', targetId: assignment.id, details: pair } });
            }
            return inserted;
        });
        return NextResponse.json({ assignments: created, count: created.length }, { status: 201 });
    } catch (error) { return errorResponse(error); }
}