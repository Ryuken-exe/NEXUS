import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signRecord } from '@/lib/security';
import { requireEventManager, requireUser } from '@/lib/auth';
import { errorResponse, HttpError } from '@/lib/http';
export async function POST(_request: Request, context: { params: { slug: string } }) {
    try {
        const manager = await requireUser(['ORGANIZER', 'ADMIN']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        await requireEventManager(event.id, manager.id, manager.role);
        const judges = await db.user.findMany({ where: { role: 'JUDGE', assignments: { some: { eventId: event.id, score: { isNot: null } } } } });
        const records = await Promise.all(judges.map(async (judge) => {
            const completed = await db.score.count({ where: { judgeId: judge.id, assignment: { eventId: event.id } } });
            const payload = JSON.stringify({ eventId: event.id, event: event.name, judgeId: judge.id, completed, issuedAt: new Date().toISOString() });
            const signed = signRecord(payload);
            const recordData = { payload, recordHash: signed.hash, signature: signed.signature };
            const record = await db.judgeRecord.upsert({ where: { eventId_judgeId: { eventId: event.id, judgeId: judge.id } }, create: { eventId: event.id, judgeId: judge.id, ...recordData }, update: recordData });
            await db.auditLog.create({ data: { eventId: event.id, actorId: manager.id, action: 'judge-record.issued', targetId: record.id, details: { judgeId: judge.id } } });
            return record;
        }));
        return NextResponse.json(records, { status: 201 });
    } catch (error) { return errorResponse(error); }
}
export async function GET(_request: Request, context: { params: { slug: string } }) {
    try {
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        return NextResponse.json(await db.judgeRecord.findMany({ where: { eventId: event.id }, select: { id: true, eventId: true, judgeId: true, payload: true, recordHash: true, signature: true, issuedAt: true } }));
    } catch (error) { return errorResponse(error); }
}