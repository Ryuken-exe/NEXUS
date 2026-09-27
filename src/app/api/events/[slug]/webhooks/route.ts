import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';
export async function GET(_request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['ORGANIZER', 'ADMIN']); const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found'); await requireEventManager(event.id, user.id, user.role);
        return NextResponse.json(await db.webhook.findMany({ where: { eventId: event.id }, include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 10 } } }));
    } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['ORGANIZER', 'ADMIN']); const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found'); await requireEventManager(event.id, user.id, user.role);
        const input = z.object({ url: z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol)), enabled: z.boolean().default(true) }).safeParse(await jsonBody(request));
        if (!input.success) throw new HttpError(400, 'A valid HTTP(S) webhook URL is required');
        const hook = await db.webhook.create({ data: { eventId: event.id, url: input.data.url, enabled: input.data.enabled, secret: randomBytes(32).toString('hex') } });
        return NextResponse.json(hook, { status: 201 });
    } catch (error) { return errorResponse(error); }
}