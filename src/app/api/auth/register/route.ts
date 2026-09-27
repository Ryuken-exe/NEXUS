import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';

const schema = z.object({ email: z.string().email().max(254), name: z.string().trim().min(1).max(80), password: z.string().min(10).max(128) });

export async function POST(request: Request) {
    try {
        const input = schema.safeParse(await jsonBody(request));
        if (!input.success) throw new HttpError(400, input.error.issues[0]?.message ?? 'Invalid registration');
        const { password, email, name } = input.data;
        const user = await db.user.create({ data: { email: email.toLowerCase(), name, passwordHash: await hash(password, 12) }, select: { id: true, email: true, name: true, role: true } });
        return NextResponse.json(user, { status: 201 });
    } catch (error) { return errorResponse(error); }
}