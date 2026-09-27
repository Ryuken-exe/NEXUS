import { NextResponse } from 'next/server';
import { currentSession, requireUser } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET() {
    try { if (!(await currentSession())) return NextResponse.json({ user: null }); return NextResponse.json({ user: await requireUser() }); }
    catch (error) { return errorResponse(error); }
}