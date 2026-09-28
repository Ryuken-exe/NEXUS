'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { SiteHeader } from '@/components/site-header';
import { RoleNavigation } from '@/components/role-navigation';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, Input, Skeleton, Textarea, Toast } from '@/components/ui/primitives';
import { apiRequest, errorMessage } from '@/lib/api-client';

type Criterion = { id: string; name: string; description: string; maxScore: number; weight: number };
type Score = { values: Record<string, number>; feedback: string } | null;
type Assignment = {
    id: string;
    score: Score;
    submission: { id: string; title: string; tagline: string; description: string; repoUrl: string; demoUrl: string; submittedAt: string | null; team: { name: string }; track: { name: string } };
};

export default function JudgeScoresPage({ params }: { params: { slug: string } }) {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [criteria, setCriteria] = useState<Criterion[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [values, setValues] = useState<Record<string, number>>({});
    const [feedback, setFeedback] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const selected = assignments.find((item) => item.id === selectedId);

    async function load() {
        setLoading(true); setError('');
        try {
            const [assignmentRows, event] = await Promise.all([
                apiRequest<Assignment[]>(`/api/events/${params.slug}/assignments`),
                apiRequest<{ criteria: Criterion[] }>(`/api/events/${params.slug}`)
            ]);
            setAssignments(assignmentRows); setCriteria(event.criteria ?? []);
            setSelectedId((current) => current && assignmentRows.some((item) => item.id === current) ? current : assignmentRows[0]?.id ?? '');
        } catch (reason) { setError(errorMessage(reason)); }
        finally { setLoading(false); }
    }

    useEffect(() => { void load(); }, [params.slug]);
    useEffect(() => {
        if (!selected) return;
        setValues(selected.score?.values ?? {});
        setFeedback(selected.score?.feedback ?? '');
        setReason(''); setNotice('');
    }, [selectedId]);

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selected) return;
        setSaving(true); setError(''); setNotice('');
        try {
            const result = await apiRequest<{ calibration: string }>('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assignmentId: selected.id, values, feedback, changeReason: reason }) });
            setAssignments((rows) => rows.map((item) => item.id === selected.id ? { ...item, score: { values, feedback } } : item));
            setNotice(result.calibration === 'insufficient-data' ? 'Score saved.' : `Score saved. Your average is running ${result.calibration === 'in-line' ? 'in line' : result.calibration} compared with other judges.`);
        } catch (reason) { setError(errorMessage(reason)); }
        finally { setSaving(false); }
    }

    const total = criteria.reduce((sum, criterion) => sum + ((values[criterion.id] ?? 0) / criterion.maxScore) * criterion.weight, 0);
    return <><SiteHeader /><main className="wrap">
        <div className="page-title"><div className="eyebrow">Judge workspace</div><h1>Assigned reviews</h1><p className="muted">Score each project against the event rubric. Your ballot stays private.</p></div>
        <RoleNavigation role="JUDGE" slug={params.slug} />
        {loading ? <div className="form-stack score-loading"><Skeleton /><Skeleton className="h-48" /></div> : error ? <div><Toast message={error} kind="error" /><Button variant="outline" onClick={() => void load()}>Retry</Button></div> : assignments.length === 0 ? <EmptyState title="No projects assigned" description="When an organizer assigns projects to you, they will appear here." /> : <div className="judge-workspace">
            <aside className="judge-assignment-list" aria-label="Assigned projects">
                <h2>Projects <span className="muted">{assignments.filter((item) => item.score).length}/{assignments.length} scored</span></h2>
                {assignments.map((assignment) => <button type="button" key={assignment.id} className="assignment-option" aria-current={selectedId === assignment.id ? 'true' : undefined} onClick={() => setSelectedId(assignment.id)}>
                    <span>{assignment.submission.title}</span><small>{assignment.submission.team.name}</small><Badge status={assignment.score ? 'Scored' : 'Not scored'} tone={assignment.score ? 'success' : 'warning'} />
                </button>)}
            </aside>
            {selected && <div className="judge-score-layout">
                <article className="project-detail">
                    <div className="eyebrow">{selected.submission.team.name} · {selected.submission.track.name}</div>
                    <h2>{selected.submission.title}</h2><p><strong>{selected.submission.tagline}</strong></p><p>{selected.submission.description}</p>
                    {selected.submission.repoUrl && <p><a href={selected.submission.repoUrl} target="_blank" rel="noreferrer">Repository ↗</a></p>}
                    {selected.submission.demoUrl && <p><a href={selected.submission.demoUrl} target="_blank" rel="noreferrer">Demo ↗</a></p>}
                </article>
                <form className="form-panel form-stack" onSubmit={save}>
                    <h2>Rubric score</h2>
                    {criteria.map((criterion) => <Input key={criterion.id} label={`${criterion.name} (${criterion.weight}%)`} type="number" min="0" max={criterion.maxScore} step="any" value={values[criterion.id] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [criterion.id]: Number(event.target.value) }))} required />)}
                    <p className="score-total" aria-live="polite">Weighted total <strong>{total.toFixed(2)} / 100</strong></p>
                    <Textarea label="Feedback" value={feedback} maxLength={3000} onChange={(event) => setFeedback(event.target.value)} />
                    {selected.score && <Textarea label="Reason for score change" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />}
                    <Button disabled={saving}>{saving ? 'Saving…' : selected.score ? 'Update score' : 'Save score'}</Button>
                    <Toast message={error} kind="error" /><Toast message={notice} />
                </form>
            </div>}
        </div>}
    </main></>;
}