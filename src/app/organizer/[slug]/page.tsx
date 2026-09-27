'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';

type Assignment = { id: string; score: unknown };
type Judge = { id: string; name: string };
type Submission = { id: string };
type Progress = { percent: number; assignments: number; judges: { id: string; name: string; completed: number; assigned: number; percent: number }[] };

export default function OrganizerPage({ params }: { params: { slug: string } }) {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [judges, setJudges] = useState<Judge[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [message, setMessage] = useState('');
    useEffect(() => {
        fetch(`/api/events/${params.slug}/assignments`).then((response) => response.json()).then(setAssignments);
        fetch(`/api/events/${params.slug}/progress`).then((response) => response.ok ? response.json() : null).then(setProgress);
        fetch(`/api/events/${params.slug}/submissions`).then((response) => response.ok ? response.json() : []).then(setSubmissions);
        fetch('/api/judges').then((response) => response.ok ? response.json() : []).then(setJudges);
    }, [params.slug]);
    async function assign(mode: 'manual' | 'auto') {
        const response = await fetch(`/api/events/${params.slug}/assignments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, judgeIds: judges.map((judge) => judge.id), submissionIds: submissions.map((submission) => submission.id), perSubmission: 2 }) });
        const result = await response.json(); setMessage(response.ok ? `${result.count} assignment records saved.` : result.error);
    }
    async function publish() {
        const response = await fetch(`/api/events/${params.slug}/results`, { method: 'POST' }); const result = await response.json();
        setMessage(response.ok ? 'Results published.' : result.error);
    }
    return <><SiteHeader /><main className="wrap"><div className="page-title"><div className="eyebrow">Organizer console</div><h1>Event controls</h1><p className="muted">Assignment, review progress, publication, and data exports.</p></div>{message && <p className="status">{message}</p>}<div className="toolbar"><button className="button" onClick={() => assign('auto')}>Auto-assign evenly</button><button className="button secondary" onClick={() => assign('manual')}>Manual batch assign</button><button className="button lime" onClick={publish}>Publish results</button></div><div className="toolbar"><Link className="button secondary" href={`/organizer/${params.slug}/judges`}>Judge invitations</Link><Link className="button secondary" href={`/organizer/${params.slug}/rubric`}>Edit rubric</Link><Link className="button secondary" href={`/organizer/${params.slug}/bulk`}>Bulk exchange</Link><Link className="button secondary" href="/organizer/new">Create event</Link></div><section><div className="section-head"><h2>Judge progress</h2><span className="muted">{progress?.percent ?? 0}% complete · {progress?.assignments ?? assignments.length} assignments</span></div>{progress?.judges.map((judge) => <p key={judge.id}>{judge.name} · {judge.completed}/{judge.assigned}<div className="bar"><span style={{ width: `${judge.percent}%` }} /></div></p>)}{progress?.judges.length === 0 && <p className="muted">No assigned judges yet.</p>}</section><section><div className="section-head"><h2>Reporting exports</h2></div><div className="toolbar">{['submissions', 'assignments', 'raw-scores', 'normalized-scores', 'results'].map((type) => <a key={type} className="button secondary" href={`/api/events/${params.slug}/export?type=${type}`}>{type}.csv ↓</a>)}</div></section><section><div className="section-head"><h2>Normalization</h2></div><p className="muted">Choose raw average or normalized z-score on the results page after publication.</p><Link className="button secondary" href={`/events/${params.slug}/results`}>Open results →</Link></section></main></>;
}