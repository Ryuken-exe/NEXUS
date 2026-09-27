import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { hashIp } from '@/lib/security';
import { isBeforeDeadline } from '@/lib/judging';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';

export async function POST(request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['PARTICIPANT']);
        const input = z.object({ submissionId: z.string() }).safeParse(await jsonBody(request));
        if (!input.success) throw new HttpError(400, 'A submission is required');
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        const now = new Date();
        if (!event.votingEnabled || event.resultsPublished || now < event.startsAt || !isBeforeDeadline(now, event.votingEnds)) throw new HttpError(409, 'Voting is closed');
        const submission = await db.submission.findFirst({ where: { id: input.data.submissionId, eventId: event.id, status: 'SUBMITTED' } });
        if (!submission) throw new HttpError(404, 'Submission not found');
        const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
        const ip = forwarded || request.headers.get('x-real-ip') || 'local';
        const ipHash = hashIp(ip);
        const recent = await db.vote.count({ where: { eventId: event.id, userId: user.id, createdAt: { gte: new Date(Date.now() - 60_000) } } });
        if (recent >= 3) throw new HttpError(429, 'Vote rate limit exceeded');
        try {
            await db.$transaction(async (tx) => {
                const vote = await tx.vote.create({ data: { eventId: event.id, submissionId: submission.id, userId: user.id, ipHash } });
                await tx.auditLog.create({ data: { eventId: event.id, actorId: user.id, action: 'vote.created', targetId: vote.id, details: { submissionId: submission.id } } });
            });
        } catch (error) {
            if ((error as { code?: string }).code === 'P2002') throw new HttpError(409, 'An account or network address has already voted in this event');
            throw error;
        }
        return NextResponse.json({ accepted: true }, { status: 201 });
    } catch (error) { return errorResponse(error); }
}