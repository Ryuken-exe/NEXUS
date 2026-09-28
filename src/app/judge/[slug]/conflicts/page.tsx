'use client';
import { FormEvent, useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';

type Team = { id: string; name: string; submission: { title: string } | null };
type Participant = { id: string; name: string; email: string };
type Conflict = { id: string; reason: string; active: boolean; team: { id: string; name: string } | null; participant: { name: string; email: string } | null };

export default function JudgeConflictsPage({ params }: { params: { slug: string } }) {
    const [teams, setTeams] = useState<Team[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [conflicts, setConflicts] = useState<Conflict[]>([]);
    const [targetType, setTargetType] = useState<'team' | 'participant'>('team');
    const [targetId, setTargetId] = useState('');
    const [reason, setReason] = useState('');
    const [message, setMessage] = useState('');

    async function load() {
        const response = await fetch(`/api/events/${params.slug}/conflicts`);
        const data = await response.json();
        if (response.ok) { setTeams(data.teams); setParticipants(data.participants); setConflicts(data.conflicts); }
        else setMessage(data.error);
    }

    useEffect(() => { void load(); }, [params.slug]);

    async function declare(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const target = targetType === 'team' ? { teamId: targetId } : { participantId: targetId };
        const response = await fetch(`/api/events/${params.slug}/conflicts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...target, reason }) });
        const data = await response.json();
        setMessage(response.ok ? 'Conflict declared. The target will be excluded from your assignments.' : data.error);
        if (response.ok) { setReason(''); setTargetId(''); await load(); }
    }

    return <><SiteHeader /><main className="wrap" style={{ maxWidth: 760 }}>
        <div className="page-title"><div className="eyebrow">Judge · Event integrity</div><h1>Declare a conflict.</h1><p className="muted">Declare conflicts before scoring begins. Active conflicts exclude you from matching team assignments.</p></div>
        {message && <p role="status" className="status">{message}</p>}
        <form className="form-panel form-stack" onSubmit={declare}>
            <label>Target type<select className="field" value={targetType} onChange={(event) => { setTargetType(event.target.value as 'team' | 'participant'); setTargetId(''); }}><option value="team">Team</option><option value="participant">Participant</option></select></label>
            {targetType === 'team' ? <label>Team<select className="field" value={targetId} onChange={(event) => setTargetId(event.target.value)} required><option value="">Select a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.submission ? ` · ${team.submission.title}` : ''}</option>)}</select></label> : <label>Participant<select className="field" value={targetId} onChange={(event) => setTargetId(event.target.value)} required><option value="">Select a participant</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name} · {participant.email}</option>)}</select></label>}
            <label>Reason<input className="field" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Organization, relationship, prior collaboration" /></label>
            <button className="button">Declare conflict</button>
        </form>
        <section><h2>My declarations</h2>{conflicts.map((conflict) => <p key={conflict.id}>{conflict.team?.name ?? conflict.participant?.name} · {conflict.active ? 'Active' : 'Overridden'}{conflict.reason ? ` · ${conflict.reason}` : ''}</p>)}{conflicts.length === 0 && <p className="muted">No conflicts declared.</p>}</section>
    </main></>;
}