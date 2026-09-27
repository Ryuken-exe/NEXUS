import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { errorResponse, HttpError } from '@/lib/http';
export async function POST(_request: Request, context: { params: { token: string } }) {
    try {
        const user = await requireUser(['PARTICIPANT', 'JUDGE']);
        const invite = await db.judgeInvite.findUnique({ where: { token: context.params.token } });
        if (!invite || invite.usedAt || invite.expiresAt <= new Date()) throw new HttpError(410, 'Invitation is invalid, expired, or already used');
        if (invite.email !== user.email.toLowerCase()) throw new HttpError(403, 'Sign in with the email address that received this invitation');
        await db.$transaction(async (tx) => {
            const claimed = await tx.judgeInvite.updateMany({ where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
            if (claimed.count !== 1) throw new HttpError(410, 'Invitation was already redeemed or has expired');
            await tx.user.update({ where: { id: user.id }, data: { role: 'JUDGE' } });
        }, { isolationLevel: 'Serializable' });
        return NextResponse.json({ accepted: true, eventId: invite.eventId });
    } catch (error) { return errorResponse(error); }
}