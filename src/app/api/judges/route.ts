import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { errorResponse } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET() {
    try { await requireUser(['ORGANIZER', 'ADMIN']); return NextResponse.json(await db.user.findMany({ where: { role: 'JUDGE' }, select: { id: true, email: true, name: true } })); }
    catch (error) { return errorResponse(error); }
}