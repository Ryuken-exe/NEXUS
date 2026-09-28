'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { Input, Toast } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { apiRequest, errorMessage } from '@/lib/api-client';

export default function LoginPage() {
    const [register, setRegister] = useState(false); const [message, setMessage] = useState(''); const [pending, setPending] = useState(false);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); setMessage(''); setPending(true);
        const data = Object.fromEntries(new FormData(event.currentTarget));
        try {
            await apiRequest(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
            location.href = '/dashboard';
        } catch (error) {
            setMessage(errorMessage(error));
        } finally {
            setPending(false);
        }
    }
    return <><SiteHeader /><main className="wrap auth-main"><div className="page-title"><div className="eyebrow">Your workspace</div><h1>{register ? 'Join the build day.' : 'Welcome back.'}</h1><p className="muted">Sign in to manage a team, review projects, or help run an event.</p></div><form className="form-panel form-stack" onSubmit={submit} noValidate>
        {register && <Input label="Name" name="name" autoComplete="name" required maxLength={80} />}
        <Input label="Email" name="email" type="email" autoComplete="email" required maxLength={254} />
        <Input label="Password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 10 : 1} maxLength={128} />
        <Button type="submit" disabled={pending}>{pending ? 'Working…' : register ? 'Create participant account' : 'Sign in'}</Button>
        <Toast message={message} kind="error" />
        <Button variant="outline" type="button" onClick={() => { setRegister(!register); setMessage(''); }}>{register ? 'Already registered? Sign in' : 'New participant? Create an account'}</Button>
        <p className="muted">Local demo accounts are listed in the project README.</p>
    </form><Link href="/" className="muted">← Back to events</Link></main></>;
}