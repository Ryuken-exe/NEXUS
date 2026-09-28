'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { RoleNavigation } from '@/components/role-navigation';
import { autoAssign } from '@/lib/judging';
import { apiRequest, errorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, Skeleton, Toast } from '@/components/ui/primitives';

type Assignment = { id: string; judgeId: string; submissionId: string; score: unknown };
type Judge = { id: string; name: string };
type Submission = { id: string; title: string; team: { name: string } };
type Progress = { percent: number; assignments: number; judges: { id: string; name: string; completed: number; assigned: number; percent: number }[] };

export default function OrganizerPage({ params }: { params: { slug: string } }) {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [judges, setJudges] = useState<Judge[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [selectedJudges, setSelectedJudges] = useState<string[]>([]);
    const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
    const [mode, setMode] = useState<'manual' | 'auto'>('auto');
    const [previewOpen, setPreviewOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        Promise.all([
            apiRequest<Assignment[]>(`/api/events/${params.slug}/assignments`),
            apiRequest<Progress>(`/api/events/${params.slug}/progress`),
            apiRequest<Submission[]>(`/api/events/${params.slug}/submissions`),
            apiRequest<Judge[]>('/api/judges')
        ]).then(([assignmentRows, nextProgress, submissionRows, judgeRows]) => {
            if (!active) return;
            setAssignments(assignmentRows); setProgress(nextProgress); setSubmissions(submissionRows); setJudges(judgeRows);
            setSelectedJudges((current) => current.length ? current.filter((id) => judgeRows.some((judge) => judge.id === id)) : judgeRows.map((judge) => judge.id));
            setSelectedSubmissions((current) => current.length ? current.filter((id) => submissionRows.some((submission) => submission.id === id)) : submissionRows.map((submission) => submission.id));
        }).catch((reason) => { if (active) setError(errorMessage(reason)); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [params.slug]);

    const currentLoads = Object.fromEntries(judges.map((judge) => [judge.id, assignments.filter((assignment) => assignment.judgeId === judge.id).length]));
    const existingPairs = assignments.map(({ judgeId, submissionId }) => ({ judgeId, submissionId }));
    const projectedPairs = mode === 'auto'
        ? autoAssign(selectedJudges, selectedSubmissions, 2, currentLoads, existingPairs)
        : selectedSubmissions.flatMap((submissionId) => selectedJudges.filter((judgeId) => !existingPairs.some((pair) => pair.judgeId === judgeId && pair.submissionId === submissionId)).map((judgeId) => ({ judgeId, submissionId })));
    const projectedLoads = judges.map((judge) => ({ ...judge, current: currentLoads[judge.id] ?? 0, projected: (currentLoads[judge.id] ?? 0) + projectedPairs.filter((pair) => pair.judgeId === judge.id).length }));

    async function assign() {
        setSaving(true); setError(''); setMessage('');
        try {
            const result = await apiRequest<{ count: number; blocked: number; warnings: { message: string }[] }>(`/api/events/${params.slug}/assignments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, judgeIds: selectedJudges, submissionIds: selectedSubmissions, perSubmission: 2 }) });
            setMessage(`${result.count} assignment records saved; ${result.blocked ?? 0} blocked by conflicts.${result.warnings?.length ? ` ${result.warnings.map((warning) => warning.message).join(' ')}` : ''}`);
            setPreviewOpen(false);
        } catch (reason) { setError(errorMessage(reason)); }
        finally { setSaving(false); }
    }
    async function publish() {
        setPublishing(true); setError(''); setMessage('');
        try { await apiRequest(`/api/events/${params.slug}/results`, { method: 'POST' }); setMessage('Results published.'); }
        catch (reason) { setError(errorMessage(reason)); }
        finally { setPublishing(false); }
    }
    return <><SiteHeader /><main className="wrap"><div className="page-title"><div className="eyebrow">Organizer console</div><h1>Event controls</h1><p className="muted">Assignment, review progress, publication, and data exports.</p></div><RoleNavigation role="ORGANIZER" slug={params.slug} />
        <div className="toolbar ui-actions"><Button variant="lime" disabled={publishing} onClick={publish}>{publishing ? 'Publishing…' : 'Publish results'}</Button><Link className="button secondary" href={`/organizer/${params.slug}/bulk`}>Bulk exchange</Link><Link className="button secondary" href={`/events/${params.slug}/results`}>Results</Link></div>
        <Toast message={error} kind="error" /><Toast message={message} />
        {loading ? <div className="form-stack"><Skeleton /><Skeleton className="h-48" /></div> : error && !judges.length ? <Button variant="outline" onClick={() => location.reload()}>Retry</Button> : <>
            <section className="assignment-builder"><div className="section-head"><h2>Assignments</h2><span className="muted">Select judges and submitted projects</span></div>
                {submissions.length === 0 ? <EmptyState title="No submitted projects" description="Assignments can be created after participants submit projects." /> : <>
                    <div className="assignment-mode" role="group" aria-label="Assignment mode"><Button variant={mode === 'auto' ? 'default' : 'outline'} onClick={() => setMode('auto')}>Auto-balance</Button><Button variant={mode === 'manual' ? 'default' : 'outline'} onClick={() => setMode('manual')}>Manual batch</Button></div>
                    <div className="selection-columns"><fieldset><legend>Judges ({selectedJudges.length} selected)</legend>{judges.map((judge) => <label className="selection-option" key={judge.id}><input type="checkbox" checked={selectedJudges.includes(judge.id)} onChange={(event) => setSelectedJudges((items) => event.target.checked ? [...items, judge.id] : items.filter((id) => id !== judge.id))} />{judge.name}</label>)}</fieldset><fieldset><legend>Projects ({selectedSubmissions.length} selected)</legend>{submissions.map((submission) => <label className="selection-option" key={submission.id}><input type="checkbox" checked={selectedSubmissions.includes(submission.id)} onChange={(event) => setSelectedSubmissions((items) => event.target.checked ? [...items, submission.id] : items.filter((id) => id !== submission.id))} /><span>{submission.title}<small>{submission.team.name}</small></span></label>)}</fieldset></div>
                    <div className="load-preview"><h3>Judge load after assignment</h3>{projectedLoads.map((judge) => <div className="load-row" key={judge.id}><span>{judge.name}</span><span>{judge.current} → {judge.projected} projects</span></div>)}</div>
                    <p className="muted">Preview uses current assignments; active conflict declarations are applied by the server when you confirm and may reduce coverage.</p>
                    <Button disabled={!selectedJudges.length || !selectedSubmissions.length || !projectedPairs.length} onClick={() => setPreviewOpen(true)}>Review assignment</Button>
                </>}
            </section>
            <section><div className="section-head"><h2>Judge progress</h2><span className="muted">{progress?.percent ?? 0}% complete · {progress?.assignments ?? assignments.length} assignments</span></div>{progress?.judges.map((judge) => <div className="progress-row" key={judge.id}><p>{judge.name} · {judge.completed}/{judge.assigned}</p><div className="bar" role="progressbar" aria-label={`${judge.name} completion`} aria-valuenow={judge.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${judge.percent}%` }} /></div></div>)}{progress?.judges.length === 0 && <p className="muted">No assigned judges yet.</p>}</section>
            <section><div className="section-head"><h2>Reporting exports</h2></div><div className="toolbar">{['submissions', 'assignments', 'raw-scores', 'normalized-scores', 'results'].map((type) => <a key={type} className="button secondary" href={`/api/events/${params.slug}/export?type=${type}`}>{type}.csv ↓</a>)}</div></section>
        </>}
        <ConfirmDialog open={previewOpen} title="Confirm assignments" message={`${projectedPairs.length} assignment records will be requested across ${selectedSubmissions.length} projects and ${selectedJudges.length} judges. Conflict restrictions may lower the saved total.`} confirmLabel={saving ? 'Saving…' : 'Confirm assignments'} onCancel={() => setPreviewOpen(false)} onConfirm={() => void assign()} />
    </main></>;
}