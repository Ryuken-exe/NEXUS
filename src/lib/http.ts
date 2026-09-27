import { NextResponse } from 'next/server';

export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export function errorResponse(error: unknown) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = String((error as { code: unknown }).code);
        if (code === 'P2002') return NextResponse.json({ error: 'A conflicting record already exists' }, { status: 409 });
        if (code === 'P2034') return NextResponse.json({ error: 'Concurrent update conflict; retry the request' }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function jsonBody<T>(request: Request): Promise<T> {
    try { return await request.json() as T; }
    catch { throw new HttpError(400, 'Request body must be valid JSON'); }
}