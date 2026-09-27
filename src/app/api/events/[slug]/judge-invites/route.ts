import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';
export async function POST(request: Request, context: { params: { slug: string } }) {
    try {
        const inviter = await requireUser(['ORGANIZER', 'ADMIN']); const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found'); await requireEventManager(event.id, inviter.id, inviter.role);
        const parsed = z.object({ email: z.string().email() }).safeParse(await jsonBody(request));
        if (!parsed.success) throw new HttpError(400, 'Valid judge email required');
        const email = parsed.data.email.toLowerCase();
        const invite = await db.judgeInvite.upsert({ where: { eventId_email: { eventId: event.id, email } }, create: { eventId: event.id, email, invitedById: inviter.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) }, update: { token: randomBytes(32).toString('base64url'), expiresAt: new Date(Date.now() + 7 * 86_400_000), usedAt: null } });
        return NextResponse.json({ token: invite.token, inviteUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/judge-invite/${invite.token}`, expiresAt: invite.expiresAt }, { status: 201 });
    } catch (error) { return errorResponse(error); }
}