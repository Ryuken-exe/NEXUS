import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';
import { z } from 'zod';
export async function GET(_request: Request, context: { params: { slug: string } }) {
    try {
        const event = await db.event.findUnique({ where: { slug: context.params.slug }, include: { tracks: true, prizes: true, criteria: true, _count: { select: { teams: true, submissions: true } } } });
        if (!event) throw new HttpError(404, 'Event not found');
        return NextResponse.json(event);
    } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['ORGANIZER', 'ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        await requireEventManager(event.id, user.id, user.role);
        const schema = z.object({ name: z.string().min(1).max(100).optional(), description: z.string().max(5000).optional(), startsAt: z.string().datetime().optional(), submissionEnds: z.string().datetime().optional(), judgingEnds: z.string().datetime().optional(), votingEnds: z.string().datetime().optional(), teamMin: z.number().int().min(1).max(10).optional(), teamMax: z.number().int().min(1).max(10).optional(), votingEnabled: z.boolean().optional() });
        const parsed = schema.safeParse(await jsonBody(request));
        if (!parsed.success) throw new HttpError(400, 'Invalid event configuration');
        const { startsAt, submissionEnds, judgingEnds, votingEnds, ...rest } = parsed.data;
        const update = { ...rest, ...(startsAt ? { startsAt: new Date(startsAt) } : {}), ...(submissionEnds ? { submissionEnds: new Date(submissionEnds) } : {}), ...(judgingEnds ? { judgingEnds: new Date(judgingEnds) } : {}), ...(votingEnds ? { votingEnds: new Date(votingEnds) } : {}) };
        const dates = { startsAt: update.startsAt ?? event.startsAt, submissionEnds: update.submissionEnds ?? event.submissionEnds, judgingEnds: update.judgingEnds ?? event.judgingEnds, votingEnds: update.votingEnds ?? event.votingEnds };
        if (dates.submissionEnds < dates.startsAt || dates.judgingEnds < dates.submissionEnds || dates.votingEnds < dates.startsAt) throw new HttpError(400, 'Event dates are not in a valid order');
        const teamMin = update.teamMin ?? event.teamMin; const teamMax = update.teamMax ?? event.teamMax;
        if (teamMin > teamMax) throw new HttpError(400, 'Minimum team size cannot exceed maximum');
        const updated = await db.event.update({ where: { id: event.id }, data: update });
        return NextResponse.json(updated);
    } catch (error) { return errorResponse(error); }
}