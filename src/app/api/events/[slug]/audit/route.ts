import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { errorResponse, HttpError } from '@/lib/http';
export async function GET(_request: Request, context: { params: { slug: string } }) {
    try {
        const admin = await requireUser(['ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        await requireEventManager(event.id, admin.id, admin.role);
        return NextResponse.json(await db.auditLog.findMany({ where: { eventId: event.id }, include: { actor: { select: { email: true, name: true } } }, orderBy: { createdAt: 'asc' } }));
    } catch (error) { return errorResponse(error); }
}