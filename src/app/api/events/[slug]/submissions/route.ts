import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireEventManager, requireUser, requireTeamMember } from '@/lib/auth';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';
import { dispatchWebhook } from '@/lib/webhooks';
import { isBeforeDeadline } from '@/lib/judging';

const submissionSchema = z.object({ teamId: z.string(), trackId: z.string(), title: z.string().min(1).max(120), tagline: z.string().min(1).max(240), description: z.string().min(1).max(5000), repoUrl: z.string().url().or(z.literal('')).default(''), demoUrl: z.string().url().or(z.literal('')).default(''), submit: z.boolean().default(false) });

export async function POST(request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['PARTICIPANT']);
        const parsed = submissionSchema.safeParse(await jsonBody(request));
        if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid submission');
        const event = await db.event.findUnique({ where: { slug: context.params.slug }, include: { tracks: true } });
        if (!event) throw new HttpError(404, 'Event not found');
        const membership = await requireTeamMember(parsed.data.teamId, user.id);
        if (membership.team.eventId !== event.id) throw new HttpError(403, 'Team belongs to another event');
        const memberCount = await db.teamMember.count({ where: { teamId: parsed.data.teamId } });
        if (memberCount < event.teamMin || memberCount > event.teamMax) throw new HttpError(409, `Team must have between ${event.teamMin} and ${event.teamMax} members to submit`);
        if (!isBeforeDeadline(new Date(), event.submissionEnds)) throw new HttpError(409, 'Submission deadline has passed; drafts can no longer be edited');
        if (!event.tracks.some((track) => track.id === parsed.data.trackId)) throw new HttpError(400, 'Track does not belong to this event');
        const { submit, ...data } = parsed.data;
        const existing = await db.submission.findUnique({ where: { teamId: data.teamId } });
        if (existing?.status === 'SUBMITTED') throw new HttpError(409, 'Submitted projects cannot be edited');
        const submission = await db.submission.upsert({ where: { teamId: data.teamId }, create: { ...data, eventId: event.id, status: submit ? 'SUBMITTED' : 'DRAFT', submittedAt: submit ? new Date() : null }, update: { ...data, status: submit ? 'SUBMITTED' : 'DRAFT', submittedAt: submit ? new Date() : null } });
        if (submit) await db.auditLog.create({ data: { eventId: event.id, actorId: user.id, action: 'submission.created', targetId: submission.id, details: { teamId: data.teamId } } });
        if (submit) await dispatchWebhook(event.id, 'submission.created', { submissionId: submission.id, title: submission.title, event: event.slug });
        return NextResponse.json(submission, { status: existing ? 200 : 201 });
    } catch (error) { return errorResponse(error); }
}

export async function GET(_request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser();
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        if (user.role === 'ORGANIZER') await requireEventManager(event.id, user.id, user.role);
        let where: Record<string, unknown> = { eventId: event.id, status: 'SUBMITTED' };
        if (user.role === 'PARTICIPANT') where = { eventId: event.id, team: { members: { some: { userId: user.id } } } };
        if (user.role === 'JUDGE') where = { ...where, assignments: { some: { judgeId: user.id } } };
        const submissions = await db.submission.findMany({ where, include: { team: { select: { name: true } }, track: true, ...(user.role === 'JUDGE' ? { assignments: { where: { judgeId: user.id }, include: { score: true } } } : {}) }, orderBy: { submittedAt: 'desc' } });
        return NextResponse.json(submissions);
    } catch (error) { return errorResponse(error); }
}