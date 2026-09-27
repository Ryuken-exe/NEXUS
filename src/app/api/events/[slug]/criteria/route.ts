import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireEventManager, requireUser } from '@/lib/auth';
import { validateRubric } from '@/lib/judging';
import { errorResponse, HttpError, jsonBody } from '@/lib/http';
export async function PUT(request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['ORGANIZER', 'ADMIN']); const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found'); await requireEventManager(event.id, user.id, user.role);
        const parsed = z.object({ criteria: z.array(z.object({ name: z.string().min(1).max(80), description: z.string().max(500).default(''), weight: z.number().min(0), maxScore: z.number().int().min(1).max(100) })).min(1) }).safeParse(await jsonBody(request));
        if (!parsed.success) throw new HttpError(400, 'Invalid rubric');
        if (!validateRubric(parsed.data.criteria.map((criterion) => ({ id: criterion.name, weight: criterion.weight, maxScore: criterion.maxScore })))) throw new HttpError(400, 'Rubric weights must sum to exactly 100');
        const criteria = await db.$transaction(async (tx) => {
            await tx.rubricCriterion.deleteMany({ where: { eventId: event.id } });
            return tx.rubricCriterion.createManyAndReturn({ data: parsed.data.criteria.map((criterion) => ({ ...criterion, eventId: event.id })) });
        });
        return NextResponse.json(criteria);
    } catch (error) { return errorResponse(error); }
}