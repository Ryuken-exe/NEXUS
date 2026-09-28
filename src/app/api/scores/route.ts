import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';
import { saveJudgeScore } from '@/services/scoring-service';

export async function POST(request: Request) {
    try {
        const judge = await requireRole('JUDGE');
        const input = z.object({ assignmentId: z.string(), values: z.record(z.number()), feedback: z.string().max(3000).default(''), changeReason: z.string().max(500).optional() }).safeParse(await jsonBody(request));
        if (!input.success) throw new HttpError(400, 'Invalid score payload');
        return NextResponse.json(await saveJudgeScore({ judgeId: judge.id, ...input.data }));
    } catch (error) { return errorResponse(error); }
}