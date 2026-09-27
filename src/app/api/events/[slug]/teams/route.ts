import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, requireTeamMember } from '@/lib/auth';
import { isBeforeDeadline } from '@/lib/judging';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';

export async function POST(request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['PARTICIPANT']);
        const input = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(await jsonBody(request));
        if (!input.success) throw new HttpError(400, 'A team name is required');
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        if (!isBeforeDeadline(new Date(), event.submissionEnds)) throw new HttpError(409, 'Team formation is closed');
        const team = await db.team.create({ data: { eventId: event.id, name: input.data.name, members: { create: { userId: user.id } } }, include: { members: { include: { user: { select: { id: true, name: true } } } } } });
        return NextResponse.json(team, { status: 201 });
    } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['PARTICIPANT']);
        const input = z.object({ inviteToken: z.string().min(8) }).safeParse(await jsonBody(request));
        if (!input.success) throw new HttpError(400, 'Invite token is required');
        const result = await db.$transaction(async (tx) => {
            const team = await tx.team.findUnique({ where: { inviteToken: input.data.inviteToken }, include: { event: true, _count: { select: { members: true } } } });
            if (!team || team.event.slug !== context.params.slug) throw new HttpError(404, 'Invite link is invalid');
            if (!isBeforeDeadline(new Date(), team.event.submissionEnds)) throw new HttpError(409, 'Team formation is closed');
            if (team._count.members >= team.event.teamMax) throw new HttpError(409, 'Team is at its member limit');
            await tx.teamMember.create({ data: { teamId: team.id, userId: user.id } });
            return { joined: true, teamId: team.id };
        }, { isolationLevel: 'Serializable' });
        return NextResponse.json(result);
    } catch (error) { return errorResponse(error); }
}