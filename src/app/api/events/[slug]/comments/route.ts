import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { hashIp } from '@/lib/security';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';

export async function GET(request: Request, context: { params: { slug: string } }) {
    try {
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        const submissionId = new URL(request.url).searchParams.get('submissionId');
        if (!submissionId) throw new HttpError(400, 'submissionId is required');
        return NextResponse.json(await db.comment.findMany({ where: { eventId: event.id, submissionId }, select: { id: true, body: true, createdAt: true, user: { select: { name: true } } }, orderBy: { createdAt: 'asc' } }));
    } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['PARTICIPANT']);
        const input = z.object({ submissionId: z.string(), body: z.string().trim().min(1).max(1000) }).safeParse(await jsonBody(request));
        if (!input.success) throw new HttpError(400, 'A submission and comment of up to 1000 characters are required');
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        const submission = await db.submission.findFirst({ where: { id: input.data.submissionId, eventId: event.id, status: 'SUBMITTED' } });
        if (!submission) throw new HttpError(404, 'Submission not found');
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'local';
        const comment = await db.$transaction(async (tx) => {
            const ipHash = hashIp(ip);
            const lockKeys = [`comment:${event.id}:user:${user.id}`, `comment:${event.id}:ip:${ipHash}`].sort();
            for (const key of lockKeys) await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
            const since = new Date(Date.now() - 60_000);
            const [userCount, ipCount] = await Promise.all([tx.comment.count({ where: { eventId: event.id, userId: user.id, createdAt: { gte: since } } }), tx.comment.count({ where: { eventId: event.id, ipHash, createdAt: { gte: since } } })]);
            if (userCount >= 5 || ipCount >= 15) throw new HttpError(429, 'Comment rate limit exceeded');
            const created = await tx.comment.create({ data: { eventId: event.id, submissionId: submission.id, userId: user.id, body: input.data.body, ipHash }, select: { id: true, body: true, createdAt: true, user: { select: { name: true } } } });
            await tx.auditLog.create({ data: { eventId: event.id, actorId: user.id, action: 'comment.created', targetId: created.id, details: { submissionId: submission.id } } });
            return created;
        });
        return NextResponse.json(comment, { status: 201 });
    } catch (error) { return errorResponse(error); }
}