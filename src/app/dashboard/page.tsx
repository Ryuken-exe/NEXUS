'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { RoleNavigation } from '@/components/role-navigation';
import { apiRequest, errorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, Input, Select, Skeleton, Textarea, Toast } from '@/components/ui/primitives';

type Event = { id: string; slug: string; name: string; teamMin: number; teamMax: number; submissionEnds: string; tracks: { id: string; name: string }[]; criteria: { id: string; name: string; maxScore: number; weight: number }[] };
type User = { id: string; name: string; role: 'PARTICIPANT' | 'JUDGE' | 'ORGANIZER' | 'ADMIN' };
type Team = { id: string; name: string; inviteToken: string; members: { userId: string; user: { name: string } }[] };
type Submission = { id: string; title: string; tagline: string; description: string; repoUrl: string; demoUrl: string; trackId: string; status: 'DRAFT' | 'SUBMITTED' };
type TeamSummary = { team: Team | null; event: { teamMin: number; teamMax: number; submissionEnds: string } };

export default function DashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [events, setEvents] = useState<Event[]>([]);
    const [slug, setSlug] = useState('');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [pending, setPending] = useState(false);
    const [team, setTeam] = useState<Team | null>(null);
    const [submission, setSubmission] = useState<Submission | null>(null);
    const [submissionDraft, setSubmissionDraft] = useState({ title: '', tagline: '', description: '', repoUrl: '', demoUrl: '', trackId: '' });
    const [inviteToken, setInviteToken] = useState('');
    const [teamName, setTeamName] = useState('');
    const [assignments, setAssignments] = useState<{ score: unknown }[]>([]);
    const [progress, setProgress] = useState<{ percent: number; assignments: number; scored: number; judges: { id: string; name: string; completed: number; assigned: number; percent: number }[] } | null>(null);
    const [unsaved, setUnsaved] = useState(false);
    const [now, setNow] = useState(Date.now());
    const event = events.find((item) => item.slug === slug);
    useEffect(() => {
        let active = true;
        Promise.all([apiRequest<{ user: User | null }>('/api/auth/me'), apiRequest<Event[]>('/api/events')])
            .then(([session, eventRows]) => {
                if (!active) return;
                if (!session.user) { location.href = '/login'; return; }
                setUser(session.user); setEvents(eventRows);
                const available = session.user.role === 'ORGANIZER' ? eventRows.filter((item) => (item as Event & { createdById?: string }).createdById === session.user?.id) : eventRows;
                setEvents(available); if (available[0]) setSlug(available[0].slug);
            })
            .catch((reason) => { if (active) setError(errorMessage(reason)); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!user || !event) return;
        let active = true;
        setDetailLoading(true); setError('');
        const requests: Promise<void>[] = [];
        if (user.role === 'PARTICIPANT') {
            requests.push(apiRequest<TeamSummary>(`/api/events/${event.slug}/teams`).then((summary) => { if (active) setTeam(summary.team); }));
            requests.push(apiRequest<Submission[]>(`/api/events/${event.slug}/submissions`).then((rows) => {
                if (!active) return;
                const current = rows[0] ?? null; setSubmission(current);
                if (current) setSubmissionDraft({ title: current.title, tagline: current.tagline, description: current.description, repoUrl: current.repoUrl, demoUrl: current.demoUrl, trackId: current.trackId });
            }));
        }
        if (user.role === 'JUDGE') {
            requests.push(apiRequest<{ score: unknown }[]>(`/api/events/${event.slug}/assignments`).then((rows) => { if (active) setAssignments(rows); }));
            requests.push(apiRequest<{ direction?: string }>(`/api/events/${event.slug}/calibration`).then((data) => { if (active && data.direction && data.direction !== 'insufficient-data') setNotice(`Your average score is running ${data.direction === 'in-line' ? 'in line' : data.direction} compared with other judges.`); }).catch(() => undefined));
        }
        if (user.role === 'ORGANIZER' || user.role === 'ADMIN') {
            requests.push(apiRequest<typeof progress>(`/api/events/${event.slug}/progress`).then((data) => { if (active) setProgress(data); }).catch(() => { if (active) setProgress(null); }));
        }
        Promise.all(requests).catch((reason) => { if (active) setError(errorMessage(reason)); }).finally(() => { if (active) setDetailLoading(false); });
        return () => { active = false; };
    }, [user, event]);

    useEffect(() => {
        if (!unsaved) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [unsaved]);
    useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

    async function refreshTeam() {
        const result = await apiRequest<TeamSummary>(`/api/events/${slug}/teams`);
        setTeam(result.team);
    }
    async function createTeam(formEvent: FormEvent<HTMLFormElement>) {
        formEvent.preventDefault(); setPending(true); setNotice(''); setError('');
        try { const created = await apiRequest<Team>(`/api/events/${slug}/teams`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: teamName }) }); setTeam(created); setNotice('Team created. Share the invite link with members.'); }
        catch (reason) { setError(errorMessage(reason)); }
        finally { setPending(false); }
    }
    async function joinTeam(formEvent: FormEvent<HTMLFormElement>) {
        formEvent.preventDefault(); setPending(true); setNotice(''); setError('');
        try { await apiRequest(`/api/events/${slug}/teams`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inviteToken }) }); await refreshTeam(); setNotice('You joined the team.'); setInviteToken(''); }
        catch (reason) { setError(errorMessage(reason)); }
        finally { setPending(false); }
    }
    async function saveSubmission(formEvent: FormEvent<HTMLFormElement>) {
        formEvent.preventDefault();
        const submitter = (formEvent.nativeEvent as SubmitEvent).submitter;
        const submit = submitter instanceof HTMLButtonElement && submitter.value === 'true';
        setPending(true); setNotice(''); setError('');
        try {
            const saved = await apiRequest<Submission>(`/api/events/${slug}/submissions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...submissionDraft, teamId: team?.id, submit }) });
            setSubmission(saved); setUnsaved(false); setNotice(submit ? 'Project submitted.' : 'Draft saved.');
        } catch (reason) { setError(errorMessage(reason)); }
        finally { setPending(false); }
    }
    async function copyInvite() {
        if (!team || !event) return;
        try { await navigator.clipboard.writeText(`${location.origin}/join/${event.slug}/${team.inviteToken}`); setNotice('Invite link copied.'); }
        catch { setError('Could not copy the invite link. Select and copy it from the link below.'); }
    }
    const completeFields = [submissionDraft.title, submissionDraft.tagline, submissionDraft.description, submissionDraft.trackId].filter(Boolean).length;
    const remaining = event ? Math.max(0, new Date(event.submissionEnds).getTime() - now) : 0;
    const countdown = `${Math.floor(remaining / 86_400_000)}d ${Math.floor(remaining / 3_600_000) % 24}h ${Math.floor(remaining / 60_000) % 60}m`;
    return <>
        <SiteHeader />
        <main className="wrap">
            {user && <RoleNavigation role={user.role} slug={event?.slug} />}
            <div className="page-title"><div className="eyebrow">Workspace</div><h1>{user ? `Good to see you, ${user.name}.` : 'Loading workspace…'}</h1><p className="muted">{user?.role ?? ''} · Select an event to continue.</p></div>
            {loading ? <div className="form-stack"><Skeleton /><Skeleton className="h-48" /></div> : error && !user ? <div><Toast message={error} kind="error" /><Button variant="outline" onClick={() => location.reload()}>Retry</Button></div> : <>
                <div className="toolbar"><Select label="Event" value={slug} onChange={(event) => setSlug(event.target.value)}>{events.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</Select><Button variant="outline" onClick={async () => { await apiRequest('/api/auth/logout', { method: 'POST' }); location.href = '/'; }}>Sign out</Button></div>
                <Toast message={error} kind="error" /><Toast message={notice} />
                {events.length === 0 && <EmptyState title="No events available" description="There are no events available for this account yet." action={user && ['ORGANIZER', 'ADMIN'].includes(user.role) ? <Link className="button" href="/organizer/new">Create event</Link> : undefined} />}
                {event && user?.role === 'JUDGE' && <div className="toolbar"><Link className="button secondary" href={`/judge/${event.slug}/conflicts`}>Declare conflicts</Link></div>}
                {event && user && ['ADMIN', 'ORGANIZER'].includes(user.role) && <div className="toolbar"><Link className="button secondary" href={`/organizer/${event.slug}/conflicts`}>Conflicts</Link><Link className="button secondary" href={`/organizer/${event.slug}/calibration`}>Calibration</Link>{user.role === 'ADMIN' && <Link className="button secondary" href={`/organizer/${event.slug}/score-history`}>Score edit history</Link>}</div>}
                {user?.role === 'PARTICIPANT' && event && <div className="dashboard-grid">
                    <section><h2>{team ? team.name : 'Your team'}</h2>{detailLoading ? <Skeleton /> : team ? <><p className="muted">{team.members.length}/{event.teamMax} members · {team.members.length >= event.teamMin ? 'Ready to submit' : `Needs ${event.teamMin - team.members.length} more member(s) to submit`}</p><div className="bar" role="progressbar" aria-label="Team size" aria-valuenow={team.members.length} aria-valuemin={0} aria-valuemax={event.teamMax}><span style={{ width: `${Math.min(100, team.members.length / event.teamMax * 100)}%` }} /></div><ul className="member-list">{team.members.map((member) => <li key={member.userId}>{member.user.name}</li>)}</ul><div className="ui-actions"><Button variant="outline" onClick={copyInvite}>Copy invite link</Button><Link className="muted" href={`/join/${event.slug}/${team.inviteToken}`}>Open invite</Link></div></> : <><form className="form-stack form-panel" onSubmit={createTeam}><Input label="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} required maxLength={80} /><Button disabled={pending}>{pending ? 'Creating…' : 'Create team'}</Button></form><form className="form-stack form-panel" onSubmit={joinTeam}><Input label="Invite token" value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} required minLength={8} /><Button variant="outline" disabled={pending}>Join team</Button></form></>}</section>
                    <section><h2>Project submission</h2>{!team ? <p className="muted">Create or join a team before starting a submission.</p> : <>
                        <div className="ui-actions"><Badge status={submission?.status === 'SUBMITTED' ? 'Submitted' : 'Draft'} tone={submission?.status === 'SUBMITTED' ? 'success' : 'neutral'} /><span className="muted">{unsaved ? 'Unsaved changes' : 'All changes saved'}</span></div>
                        <p className="deadline-copy">Deadline: {countdown} remaining<br /><time dateTime={event.submissionEnds}>Local: {new Date(event.submissionEnds).toLocaleString()} · UTC: {new Date(event.submissionEnds).toISOString()}</time></p>
                        <p className="muted">Completeness {completeFields}/4</p><div className="bar" role="progressbar" aria-label="Submission completeness" aria-valuenow={completeFields} aria-valuemin={0} aria-valuemax={4}><span style={{ width: `${completeFields * 25}%` }} /></div>
                        <form className="form-stack form-panel" onSubmit={saveSubmission} onChange={() => setUnsaved(true)}>
                            <Select label="Track" value={submissionDraft.trackId || event.tracks[0]?.id || ''} onChange={(change) => setSubmissionDraft((current) => ({ ...current, trackId: change.target.value }))}>{event.tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</Select>
                            <Input label="Project title" value={submissionDraft.title} onChange={(change) => setSubmissionDraft((current) => ({ ...current, title: change.target.value }))} required maxLength={120} />
                            <Input label="Tagline" value={submissionDraft.tagline} onChange={(change) => setSubmissionDraft((current) => ({ ...current, tagline: change.target.value }))} required maxLength={240} />
                            <Textarea label="Description" value={submissionDraft.description} onChange={(change) => setSubmissionDraft((current) => ({ ...current, description: change.target.value }))} required maxLength={5000} />
                            <Input label="Repository URL" value={submissionDraft.repoUrl} onChange={(change) => setSubmissionDraft((current) => ({ ...current, repoUrl: change.target.value }))} type="url" />
                            <Input label="Demo URL" value={submissionDraft.demoUrl} onChange={(change) => setSubmissionDraft((current) => ({ ...current, demoUrl: change.target.value }))} type="url" />
                            <div className="ui-actions"><Button variant="outline" disabled={pending || submission?.status === 'SUBMITTED'}>{pending ? 'Saving…' : 'Save draft'}</Button><Button disabled={pending || submission?.status === 'SUBMITTED' || completeFields < 4} name="submitProject" value="true">Submit project</Button><Link className="muted" href={`/api/events/${event.slug}/certificate`}>Team certificate</Link></div>
                        </form>
                    </>}</section>
                    <section><h2>Public gallery</h2><p className="muted">Find projects and leave constructive feedback.</p><div className="ui-actions"><Link className="button" href={`/events/${event.slug}`}>Explore projects</Link><Link className="button secondary" href={`/events/${event.slug}/results`}>Published results</Link></div></section>
                </div>}
                {user?.role === 'JUDGE' && event && <section><div className="section-head"><h2>My assigned reviews</h2><span className="muted">{assignments.filter((item) => item.score).length} / {assignments.length} complete</span></div><Link className="button" href={`/judge/${event.slug}/scores`}>Open scoring workspace</Link></section>}
                {user && ['ADMIN', 'ORGANIZER'].includes(user.role) && event && <section><div className="section-head"><h2>Judge completion</h2><Link className="button secondary" href={`/organizer/${event.slug}`}>Open event controls</Link></div>{progress ? <><p>{progress.scored} of {progress.assignments} reviews complete ({progress.percent}%).</p>{progress.judges.map((judge) => <div className="progress-row" key={judge.id}><p>{judge.name} · {judge.completed}/{judge.assigned}</p><div className="bar" role="progressbar" aria-label={`${judge.name} completion`} aria-valuenow={judge.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${judge.percent}%` }} /></div></div>)}</> : <p className="muted">Progress is available to the event owner or an admin.</p>}</section>}
            </>}
        </main>
    </>;
}