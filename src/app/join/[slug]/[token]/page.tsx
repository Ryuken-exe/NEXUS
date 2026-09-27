'use client';
import Link from 'next/link';
import { useState } from 'react';
import { SiteHeader } from '@/components/site-header';
export default function TeamInvitePage({ params }: { params: { slug: string; token: string } }) {
    const [message, setMessage] = useState('');
    async function join() { const response = await fetch(`/api/events/${params.slug}/teams`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inviteToken: params.token }) }); const result = await response.json(); setMessage(response.ok ? 'You joined the team.' : result.error); }
    return <><SiteHeader /><main className="wrap" style={{ maxWidth: 620 }}><div className="page-title"><div className="eyebrow">Team invitation</div><h1>Build together.</h1><p className="muted">Sign in with a participant account, then accept the event invite.</p></div><section className="form-panel"><button className="button" onClick={join}>Join team</button><Link className="button secondary" href="/login" style={{ marginLeft: 10 }}>Sign in first</Link>{message && <p className="status" style={{ marginTop: 14 }}>{message}</p>}</section></main></>;
}