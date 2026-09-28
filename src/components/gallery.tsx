'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton, Toast } from '@/components/ui/primitives';
import { apiRequest, errorMessage } from '@/lib/api-client';

type Project = { id: string; title: string; tagline: string; description: string; repoUrl: string; demoUrl: string; track: { id: string; name: string }; team: { name: string }; _count: { votes: number; comments: number } };
type GalleryData = { event: { name: string; votingEnabled: boolean; votingEnds: string; resultsPublished: boolean }; tracks: { id: string; name: string }[]; submissions: Project[] };

export function Gallery({ slug, embedded = false }: { slug: string; embedded?: boolean }) {
    const [data, setData] = useState<GalleryData | null>(null);
    const [query, setQuery] = useState('');
    const [track, setTrack] = useState('');
    const [seed, setSeed] = useState('');
    const [page, setPage] = useState(1);
    const [retry, setRetry] = useState(0);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [commentsFor, setCommentsFor] = useState<string | null>(null);
    const [comments, setComments] = useState<{ id: string; body: string; user: { name: string } }[]>([]);

    useEffect(() => { let viewerSeed = localStorage.getItem('dogfood-view-seed'); if (!viewerSeed) { viewerSeed = crypto.randomUUID(); localStorage.setItem('dogfood-view-seed', viewerSeed); } setSeed(viewerSeed); }, []);

    useEffect(() => {
        if (!seed) return;
        let active = true;
        const params = new URLSearchParams({ seed });
        if (query) params.set('q', query);
        if (track) params.set('track', track);
        setLoading(true);
        setError('');
        apiRequest<GalleryData>(`/api/events/${slug}/gallery?${params}`)
            .then((result) => { if (active) setData(result); })
            .catch((reason) => { if (active) setError(errorMessage(reason)); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [slug, query, track, seed, retry]);

    async function vote(submissionId: string) {
        const response = await fetch(`/api/events/${slug}/votes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ submissionId }) });
        const result = await response.json(); setMessage(response.ok ? 'Vote recorded.' : result.error ?? 'Sign in to vote.');
        if (response.ok) setData((current) => current && ({ ...current, submissions: current.submissions.map((project) => project.id === submissionId ? { ...project, _count: { ...project._count, votes: project._count.votes + 1 } } : project) }));
    }
    async function openComments(submissionId: string) {
        setCommentsFor(submissionId); const response = await fetch(`/api/events/${slug}/comments?submissionId=${submissionId}`); setComments(await response.json());
    }
    async function postComment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch(`/api/events/${slug}/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ submissionId: commentsFor, body: form.get('body') }) }); const result = await response.json();
        if (!response.ok) { setMessage(result.error ?? 'Sign in to comment.'); return; }
        event.currentTarget.reset(); await openComments(commentsFor!);
    }
    const pageSize = 9;
    const projects = data?.submissions ?? [];
    const pageCount = Math.ceil(projects.length / pageSize);
    const visibleProjects = projects.slice((page - 1) * pageSize, page * pageSize);

    return <main className={embedded ? '' : 'wrap'}>
        {!embedded && <div className="page-title"><Link href="/" className="eyebrow">← All events</Link><h1>{data?.event.name ?? 'Project gallery'}</h1><p className="muted">Projects built by participating teams.</p>{data?.event.resultsPublished && <Link className="button secondary" href={`/events/${slug}/results`}>View published results →</Link>}</div>}
        <div className="toolbar"><label className="gallery-filter">Search projects<input className="field" placeholder="Search projects or teams" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label><label className="gallery-filter">Track<select className="field" value={track} onChange={(event) => { setTrack(event.target.value); setPage(1); }}><option value="">All tracks</option>{data?.tracks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><span className="muted">{projects.length} projects</span></div>
        {message && <Toast message={message} kind="info" />}
        {error ? <div className="gallery-state"><Toast message={error} kind="error" /><Button variant="outline" onClick={() => setRetry((value) => value + 1)}>Retry</Button></div> : loading ? <div className="project-grid gallery-loading" aria-label="Loading projects"><Skeleton className="h-64" /><Skeleton className="h-64" /></div> : projects.length === 0 ? <EmptyState title="No projects match" description={query || track ? 'Try changing your search or track filter.' : 'Submitted projects will appear here.'} /> : <>
            <div className="project-grid">{visibleProjects.map((project) => <article className="project" key={project.id}><div className="eyebrow">{project.team.name} · {project.track.name}</div><h2>{project.title}</h2><strong className="project-tagline">{project.tagline}</strong><p>{project.description}</p><div className="project-actions"><button className="button lime" disabled={embedded || !data?.event.votingEnabled} onClick={() => vote(project.id)}>↑ Vote · {project._count.votes}</button><button className="button secondary" onClick={() => openComments(project.id)}>Comments · {project._count.comments}</button>{project.demoUrl && <a className="muted" href={project.demoUrl} target="_blank" rel="noreferrer">Demo ↗</a>}</div>{commentsFor === project.id && <section className="form-panel"><h3>Community notes</h3>{comments.map((comment) => <p key={comment.id}><strong>{comment.user.name}:</strong> {comment.body}</p>)}{!embedded && <form onSubmit={postComment} className="form-stack"><textarea className="field" name="body" aria-label="Leave a constructive note" required maxLength={1000} placeholder="Leave a constructive note" /><button className="button secondary">Post comment</button></form>}</section>}</article>)}</div>
            {pageCount > 1 && <nav className="gallery-pagination" aria-label="Gallery pages"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><span aria-live="polite">Page {page} of {pageCount}</span><Button variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button></nav>}
        </>}
    </main>;
}