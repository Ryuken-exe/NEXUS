import Link from 'next/link';
import { db } from '@/lib/db';
import { SiteHeader } from '@/components/site-header';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
    const events = await db.event.findMany({ include: { _count: { select: { submissions: true, teams: true } } }, orderBy: { startsAt: 'desc' } });
    return <><SiteHeader /><main className="wrap"><section className="hero"><div><div className="eyebrow">Build day · September 2026</div><h1>Good ideas<br />should ship.</h1><p>A home for practical experiments, generous feedback, and the people making useful things together.</p></div><div className="hero-note">“The best demo is something a real person can use on Monday.”</div></section><section><div className="section-head"><div><div className="eyebrow">The program</div><h2>Open events</h2></div><span className="muted">{events.length} events</span></div><div className="event-list">{events.map((event) => <article className="event-row" key={event.id}><div><h3>{event.name}</h3><p className="muted">{event.description}</p><div className="event-meta"><span>{event._count.submissions} projects</span><span>{event._count.teams} teams</span><span>{event.votingEnabled ? 'Community voting' : 'Voting closed'}</span></div></div><Link className="button" href={`/events/${event.slug}`}>Explore event →</Link></article>)}</div></section><section className="section-head" style={{ marginTop: 42 }}><div><div className="eyebrow">For teams and judges</div><h2>Pick up where you left off</h2></div><Link className="button secondary" href="/dashboard">Open workspace →</Link></section></main><footer className="footer wrap"><span>Dogfood 2026 · Local-first judging platform</span><span>Open source · MIT</span></footer></>;
}