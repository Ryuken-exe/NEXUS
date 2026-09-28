import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';

export async function GET(_request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['JUDGE', 'ORGANIZER', 'ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        const manager = user.role !== 'JUDGE';
        if (manager) await requireEventManager(event.id, user.id, user.role);
        const [conflicts, teams] = await Promise.all([
            db.conflictOfInterest.findMany({ where: { eventId: event.id, ...(manager ? {} : { judgeId: user.id }) }, include: { judge: { select: { id: true, name: true, email: true } }, team: { select: { id: true, name: true } }, participant: { select: { id: true, name: true, email: true } }, declaredBy: { select: { id: true, name: true } }, overriddenBy: { select: { id: true, name: true } } }, orderBy: [{ createdAt: 'desc' }] }),
            db.team.findMany({ where: { eventId: event.id, submission: { is: { status: 'SUBMITTED' } } }, select: { id: true, name: true, submission: { select: { title: true } }, members: { select: { user: { select: { id: true, name: true, email: true } } } } }, orderBy: { name: 'asc' } })
        ]);
        const participants = [...new Map(teams.flatMap((team) => team.members.map(({ user: participant }) => [participant.id, participant] as const))).values()];
        return NextResponse.json({ conflicts, teams: teams.map(({ members: _members, ...team }) => team), participants });
    } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['JUDGE', 'ORGANIZER', 'ADMIN']);
        const input = z.object({ judgeId: z.string().optional(), teamId: z.string().optional(), participantId: z.string().optional(), reason: z.string().max(500).default('') }).refine((data) => Boolean(data.teamId) !== Boolean(data.participantId)).safeParse(await jsonBody(request));
        if (!input.success) throw new HttpError(400, 'Invalid conflict declaration');
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        const manager = user.role !== 'JUDGE';
        if (manager) await requireEventManager(event.id, user.id, user.role);
        else if (input.data.judgeId && input.data.judgeId !== user.id) throw new HttpError(403, 'Judges can only declare their own conflicts');
        const judgeId = manager ? input.data.judgeId : user.id;
        if (!judgeId) throw new HttpError(400, 'A judge is required');
        const [team, participant, judge, scoreCount] = await Promise.all([
            input.data.teamId ? db.team.findFirst({ where: { id: input.data.teamId, eventId: event.id }, select: { id: true } }) : null,
            input.data.participantId ? db.user.findFirst({ where: { id: input.data.participantId, role: 'PARTICIPANT', memberships: { some: { team: { eventId: event.id } } } }, select: { id: true } }) : null,
            db.user.findFirst({ where: { id: judgeId, role: 'JUDGE' }, select: { id: true } }),
            db.score.count({ where: { assignment: { eventId: event.id } } })
        ]);
        if ((!team && !participant) || !judge) throw new HttpError(400, 'The team, participant, or judge is invalid for this event');
        if (scoreCount > 0) throw new HttpError(409, 'Conflicts must be declared before scoring starts');
        const target = { teamId: team?.id ?? null, participantId: participant?.id ?? null };
        const conflict = await db.$transaction(async (tx) => {
            const saved = await tx.conflictOfInterest.upsert({
                where: team ? { eventId_judgeId_teamId: { eventId: event.id, judgeId, teamId: team.id } } : { eventId_judgeId_participantId: { eventId: event.id, judgeId, participantId: participant!.id } },
                create: { eventId: event.id, judgeId, ...target, reason: input.data.reason, declaredById: user.id },
                update: { eventId: event.id, reason: input.data.reason, active: true, declaredById: user.id, overriddenById: null, overriddenAt: null }
            });
            await tx.auditLog.create({ data: { eventId: event.id, actorId: user.id, action: 'conflict.declared', targetId: saved.id, details: { judgeId, ...target, reason: input.data.reason } } });
            return saved;
        });
        return NextResponse.json(conflict, { status: 201 });
    } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: { params: { slug: string } }) {
    try {
        const manager = await requireUser(['ORGANIZER', 'ADMIN']);
        const input = z.object({ conflictId: z.string(), active: z.boolean(), reason: z.string().max(500).optional() }).safeParse(await jsonBody(request));
        if (!input.success) throw new HttpError(400, 'Invalid conflict override');
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        await requireEventManager(event.id, manager.id, manager.role);
        const existing = await db.conflictOfInterest.findFirst({ where: { id: input.data.conflictId, eventId: event.id } });
        if (!existing) throw new HttpError(404, 'Conflict not found');
        const updated = await db.$transaction(async (tx) => {
            const saved = await tx.conflictOfInterest.update({ where: { id: existing.id }, data: { active: input.data.active, ...(input.data.reason === undefined ? {} : { reason: input.data.reason }), overriddenById: manager.id, overriddenAt: new Date() } });
            await tx.auditLog.create({ data: { eventId: event.id, actorId: manager.id, action: 'conflict.overridden', targetId: saved.id, details: { judgeId: saved.judgeId, teamId: saved.teamId, participantId: saved.participantId, wasActive: existing.active, active: saved.active, reason: saved.reason } } });
            return saved;
        });
        return NextResponse.json(updated);
    } catch (error) { return errorResponse(error); }
}