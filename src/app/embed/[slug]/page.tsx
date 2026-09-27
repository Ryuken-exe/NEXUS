import { notFound } from 'next/navigation';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function EmbedPage({ params }: { params: { slug: string } }) {
    const event = await db.event.findUnique({ where: { slug: params.slug } });
    if (!event) notFound();
    const projects = await db.submission.findMany({ where: { eventId: event.id, status: 'SUBMITTED' }, select: { id: true, title: true, tagline: true, description: true, track: { select: { name: true } }, team: { select: { name: true } } }, orderBy: { title: 'asc' } });
    return <main style={{ padding: 16, color: '#15221e', fontFamily: 'Arial, sans-serif' }}><p style={{ color: '#49634f', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Dogfood 2026 · {event.name}</p>{projects.map((project) => <article key={project.id} style={{ padding: '18px 0', borderTop: '1px solid #d7d8cf' }}><p style={{ margin: '0 0 6px', fontSize: 11, color: '#49634f' }}>{project.team.name} · {project.track.name}</p><h2 style={{ margin: '0 0 6px', fontFamily: 'Georgia, serif', fontWeight: 500 }}>{project.title}</h2><strong>{project.tagline}</strong><p style={{ marginBottom: 0, lineHeight: 1.5 }}>{project.description}</p></article>)}</main>;
}