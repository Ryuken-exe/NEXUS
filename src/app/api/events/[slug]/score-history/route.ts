import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { errorResponse, HttpError } from '@/lib/http';

export async function GET(request: Request, context: { params: { slug: string } }) {
    try {
        const admin = await requireUser(['ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        await requireEventManager(event.id, admin.id, admin.role);
        const params = new URL(request.url).searchParams;
        const judgeId = params.get('judgeId') || undefined;
        const submissionId = params.get('submissionId') || undefined;
        const edits = await db.auditLog.findMany({ where: { eventId: event.id, action: 'score.edited', ...(judgeId ? { actorId: judgeId } : {}) }, include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } });
        const filtered = edits.filter((edit) => !submissionId || (edit.details as { submissionId?: string }).submissionId === submissionId);
        const submissionIds = filtered.map((edit) => (edit.details as { submissionId: string }).submissionId);
        const submissions = await db.submission.findMany({ where: { id: { in: submissionIds } }, select: { id: true, title: true, team: { select: { name: true } } } });
        const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));
        return NextResponse.json(filtered.map((edit) => ({ ...edit, submission: submissionById.get((edit.details as { submissionId: string }).submissionId) ?? null })));
    } catch (error) { return errorResponse(error); }
}