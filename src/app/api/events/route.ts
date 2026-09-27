import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';

const eventSchema = z.object({ slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/), name: z.string().min(1).max(100), description: z.string().max(5000), startsAt: z.string().datetime(), submissionEnds: z.string().datetime(), judgingEnds: z.string().datetime(), votingEnds: z.string().datetime(), teamMin: z.number().int().min(1).max(10).default(1), teamMax: z.number().int().min(1).max(10).default(4), votingEnabled: z.boolean().default(true), tracks: z.array(z.object({ name: z.string().min(1), description: z.string().optional() })).min(1), prizes: z.array(z.object({ title: z.string().min(1), description: z.string().optional(), value: z.string().optional() })).default([]), criteria: z.array(z.object({ name: z.string().min(1), description: z.string().optional(), weight: z.number().min(0), maxScore: z.number().int().positive().default(10) })).min(1) });

export async function GET() {
    try { const events = await db.event.findMany({ include: { tracks: true, prizes: true, criteria: true }, orderBy: { startsAt: 'desc' } }); return NextResponse.json(events); }
    catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
    try {
        const user = await requireUser(['ORGANIZER', 'ADMIN']);
        const parsed = eventSchema.safeParse(await jsonBody(request));
        if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid event');
        if (parsed.data.teamMin > parsed.data.teamMax) throw new HttpError(400, 'Minimum team size cannot exceed maximum');
        if (new Date(parsed.data.submissionEnds) < new Date(parsed.data.startsAt) || new Date(parsed.data.judgingEnds) < new Date(parsed.data.submissionEnds) || new Date(parsed.data.votingEnds) < new Date(parsed.data.startsAt)) throw new HttpError(400, 'Event dates are not in a valid order');
        if (Math.abs(parsed.data.criteria.reduce((sum, criterion) => sum + criterion.weight, 0) - 100) > 0.0001) throw new HttpError(400, 'Rubric weights must sum to 100');
        const event = await db.event.create({ data: { ...parsed.data, startsAt: new Date(parsed.data.startsAt), submissionEnds: new Date(parsed.data.submissionEnds), judgingEnds: new Date(parsed.data.judgingEnds), votingEnds: new Date(parsed.data.votingEnds), createdById: user.id, tracks: { create: parsed.data.tracks }, prizes: { create: parsed.data.prizes }, criteria: { create: parsed.data.criteria } }, include: { tracks: true, prizes: true, criteria: true } });
        return NextResponse.json(event, { status: 201 });
    } catch (error) { return errorResponse(error); }
}