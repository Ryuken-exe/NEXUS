'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { SiteHeader } from '@/components/site-header';

export default function LoginPage() {
    const [register, setRegister] = useState(false); const [message, setMessage] = useState('');
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); setMessage('');
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const response = await fetch(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
        const result = await response.json();
        if (!response.ok) { setMessage(result.error ?? 'Unable to sign in'); return; }
        if (register) {
            const login = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: data.email, password: data.password }) });
            if (!login.ok) { setMessage('Account created. Sign in to continue.'); setRegister(false); return; }
        }
        location.href = '/dashboard';
    }
    return <><SiteHeader /><main className="wrap" style={{ maxWidth: 570 }}><div className="page-title"><div className="eyebrow">Your workspace</div><h1>{register ? 'Join the build day.' : 'Welcome back.'}</h1><p className="muted">Sign in to manage a team, review projects, or help run an event.</p></div><form className="form-panel form-stack" onSubmit={submit}>{register && <label>Name<input className="field" name="name" required maxLength={80} /></label>}<label>Email<input className="field" name="email" type="email" required /></label><label>Password<input className="field" name="password" type="password" required minLength={register ? 10 : 1} /></label><button className="button" type="submit">{register ? 'Create participant account' : 'Sign in'}</button>{message && <div role="status" className="status">{message}</div>}<button className="button secondary" type="button" onClick={() => setRegister(!register)}>{register ? 'Already registered? Sign in' : 'New participant? Create an account'}</button><p className="muted">Local demo accounts are listed in the project README.</p></form><Link href="/" className="muted">← Back to events</Link></main></>;
}