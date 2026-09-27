'use client';
import { useState } from 'react';
import { SiteHeader } from '@/components/site-header';
export default function JudgeInvitePage({ params }: { params: { token: string } }) {
    const [message, setMessage] = useState('');
    async function accept() { const response = await fetch(`/api/judge-invites/${params.token}`, { method: 'POST' }); const result = await response.json(); setMessage(response.ok ? 'Invitation accepted. Your account now has judge access.' : result.error); if (response.ok) setTimeout(() => { location.href = '/dashboard'; }, 700); }
    return <><SiteHeader /><main className="wrap" style={{ maxWidth: 620 }}><div className="page-title"><div className="eyebrow">Judge invitation</div><h1>Review with care.</h1><p className="muted">Accepting this invitation upgrades the signed-in account matching the invited email to judge access.</p></div><section className="form-panel"><button className="button" onClick={accept}>Accept invitation</button>{message && <p className="status" style={{ marginTop: 14 }}>{message}</p>}</section></main></>;
}