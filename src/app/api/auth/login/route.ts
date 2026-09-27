import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { signSession } from '@/lib/auth';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';

export async function POST(request: Request) {
    try {
        const parsed = z.object({ email: z.string().email(), password: z.string() }).safeParse(await jsonBody(request));
        if (!parsed.success) throw new HttpError(400, 'Email and password are required');
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user || !(await compare(parsed.data.password, user.passwordHash))) throw new HttpError(401, 'Invalid email or password');
        const response = NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role });
        response.cookies.set('dogfood_session', signSession(user), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && process.env.APP_URL?.startsWith('https://') === true, path: '/', maxAge: 60 * 60 * 24 * 7 });
        return response;
    } catch (error) { return errorResponse(error); }
}