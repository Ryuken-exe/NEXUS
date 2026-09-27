import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { errorResponse, HttpError } from '@/lib/http';
import { hashIp } from '@/lib/security';
import { createRateLimiter } from '@/lib/rate-limit';

const allowGalleryRead = createRateLimiter(30, 60_000);

export async function GET(request: Request, context: { params: { slug: string } }) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'local';
        if (!allowGalleryRead(hashIp(ip))) throw new HttpError(429, 'Gallery request rate limit exceeded');
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        const params = new URL(request.url).searchParams;
        const search = params.get('q')?.trim().slice(0, 100);
        const track = params.get('track');
        const seed = (params.get('seed') ?? 'public').slice(0, 128);
        const submissions = await db.submission.findMany({ where: { eventId: event.id, status: 'SUBMITTED', ...(track ? { trackId: track } : {}), ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { tagline: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }, { team: { name: { contains: search, mode: 'insensitive' } } }] } : {}) }, select: { id: true, title: true, tagline: true, description: true, repoUrl: true, demoUrl: true, track: { select: { id: true, name: true } }, team: { select: { name: true } }, _count: { select: { votes: true, comments: true } } } });
        // The same viewer seed yields stable order; distinct seeds produce independent deterministic shuffles.
        submissions.sort((a, b) => createHash('sha256').update(`${seed}:${a.id}`).digest('hex').localeCompare(createHash('sha256').update(`${seed}:${b.id}`).digest('hex')));
        return NextResponse.json({ event: { id: event.id, name: event.name, votingEnabled: event.votingEnabled, votingEnds: event.votingEnds, resultsPublished: event.resultsPublished }, tracks: await db.track.findMany({ where: { eventId: event.id }, select: { id: true, name: true } }), submissions });
    } catch (error) { return errorResponse(error); }
}