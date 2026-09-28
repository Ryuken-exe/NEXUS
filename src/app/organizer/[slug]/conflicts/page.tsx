'use client';
import { FormEvent, useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';

type Team = { id: string; name: string; submission: { title: string } | null };
type Judge = { id: string; name: string; email: string };
type Participant = { id: string; name: string; email: string };
type Conflict = { id: string; judge: Judge; team: { name: string } | null; participant: { name: string; email: string } | null; reason: string; active: boolean; declaredBy: { name: string }; overriddenBy: { name: string } | null };

export default function OrganizerConflictsPage({ params }: { params: { slug: string } }) {
    const [teams, setTeams] = useState<Team[]>([]); const [participants, setParticipants] = useState<Participant[]>([]); const [conflicts, setConflicts] = useState<Conflict[]>([]); const [judges, setJudges] = useState<Judge[]>([]);
    const [judgeId, setJudgeId] = useState(''); const [targetType, setTargetType] = useState<'team' | 'participant'>('team'); const [targetId, setTargetId] = useState(''); const [reason, setReason] = useState(''); const [message, setMessage] = useState('');
    async function load() {
        const [conflictResponse, judgeResponse] = await Promise.all([fetch(`/api/events/${params.slug}/conflicts`), fetch('/api/judges')]);
        const data = await conflictResponse.json();
        if (conflictResponse.ok) { setTeams(data.teams); setParticipants(data.participants); setConflicts(data.conflicts); } else setMessage(data.error);
        if (judgeResponse.ok) setJudges(await judgeResponse.json());
    }
    useEffect(() => { void load(); }, [params.slug]);
    async function preset(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const response = await fetch(`/api/events/${params.slug}/conflicts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ judgeId, ...(targetType === 'team' ? { teamId: targetId } : { participantId: targetId }), reason }) });
        const data = await response.json(); setMessage(response.ok ? 'Conflict recorded.' : data.error);
        if (response.ok) { setReason(''); setTargetId(''); await load(); }
    }
    async function override(conflict: Conflict) {
        const response = await fetch(`/api/events/${params.slug}/conflicts`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conflictId: conflict.id, active: !conflict.active }) });
        const data = await response.json(); setMessage(response.ok ? `Conflict ${data.active ? 're-enabled' : 'overridden'}.` : data.error);
        if (response.ok) await load();
    }
    return <><SiteHeader /><main className="wrap"><div className="page-title"><div className="eyebrow">Organizer · Judging integrity</div><h1>Conflicts of interest</h1><p className="muted">Review declarations, pre-set conflicts, or override them with an audit record.</p></div>{message && <p role="status" className="status">{message}</p>}<form className="form-panel form-stack" onSubmit={preset}><h2>Pre-set a conflict</h2><label>Judge<select className="field" value={judgeId} onChange={(event) => setJudgeId(event.target.value)} required><option value="">Select a judge</option>{judges.map((judge) => <option key={judge.id} value={judge.id}>{judge.name} · {judge.email}</option>)}</select></label><label>Target type<select className="field" value={targetType} onChange={(event) => { setTargetType(event.target.value as 'team' | 'participant'); setTargetId(''); }}><option value="team">Team</option><option value="participant">Participant</option></select></label>{targetType === 'team' ? <label>Team<select className="field" value={targetId} onChange={(event) => setTargetId(event.target.value)} required><option value="">Select a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.submission ? ` · ${team.submission.title}` : ''}</option>)}</select></label> : <label>Participant<select className="field" value={targetId} onChange={(event) => setTargetId(event.target.value)} required><option value="">Select a participant</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name} · {participant.email}</option>)}</select></label>}<label>Reason<input className="field" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></label><button className="button">Record conflict</button></form><section><h2>Declared conflicts</h2>{conflicts.map((conflict) => <article className="project" key={conflict.id}><h3>{conflict.judge.name} · {conflict.team?.name ?? conflict.participant?.name}</h3><p>{conflict.reason || 'No reason supplied'} · {conflict.active ? 'Active' : `Overridden by ${conflict.overriddenBy?.name ?? 'manager'}`}</p><p className="muted">Declared by {conflict.declaredBy.name}</p><button className="button secondary" onClick={() => override(conflict)}>{conflict.active ? 'Override conflict' : 'Re-enable conflict'}</button></article>)}{conflicts.length === 0 && <p className="muted">No conflicts have been declared.</p>}</section></main></>;
}