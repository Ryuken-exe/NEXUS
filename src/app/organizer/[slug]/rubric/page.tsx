'use client';
import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input, Skeleton, Toast } from '@/components/ui/primitives';
import { apiRequest, errorMessage } from '@/lib/api-client';
type Criterion = { id?: string; name: string; description: string; weight: number; maxScore: number };
export default function RubricPage({ params }: { params: { slug: string } }) {
    const [criteria, setCriteria] = useState<Criterion[]>([]); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
    async function load() {
        setLoading(true); setError('');
        try { const event = await apiRequest<{ criteria?: Criterion[] }>(`/api/events/${params.slug}`); setCriteria(event.criteria ?? []); }
        catch (reason) { setError(errorMessage(reason)); }
        finally { setLoading(false); }
    }
    useEffect(() => { void load(); }, [params.slug]);
    function update(index: number, key: keyof Criterion, value: string) { setCriteria((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: key === 'weight' || key === 'maxScore' ? Number(value) : value } : item)); }
    async function save() {
        setSaving(true); setMessage(''); setError('');
        try { setCriteria(await apiRequest<Criterion[]>(`/api/events/${params.slug}/criteria`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ criteria }) })); setMessage('Rubric saved.'); }
        catch (reason) { setError(errorMessage(reason)); }
        finally { setSaving(false); }
    }
    const total = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    const valid = total === 100 && criteria.length > 0 && criteria.every((item) => item.name.trim() && item.maxScore >= 1 && item.weight >= 0);
    return <><SiteHeader /><main className="wrap"><div className="page-title"><div className="eyebrow">Organizer · Judging rubric</div><h1>Decide what matters.</h1><p className="muted">Every criterion is scored from zero to its maximum. Weights must add to exactly 100%.</p></div>
        <div className="toolbar"><span className={total === 100 ? 'pill' : 'status'} aria-live="polite">Weight total: {total}%</span><Button variant="outline" onClick={() => setCriteria([...criteria, { name: '', description: '', weight: 0, maxScore: 10 }])}>Add criterion</Button><Button disabled={!valid || saving} onClick={save}>{saving ? 'Saving…' : 'Save rubric'}</Button></div>
        {!valid && !loading && <p className="ui-error" role="alert">Add a name and valid score range for each criterion, and make the total exactly 100%.</p>}
        {loading ? <div className="form-stack"><Skeleton className="h-32" /><Skeleton className="h-32" /></div> : error ? <div><Toast message={error} kind="error" /><Button variant="outline" onClick={() => void load()}>Retry</Button></div> : criteria.map((criterion, index) => <div className="form-grid form-panel" key={criterion.id ?? index}><Input label="Name" value={criterion.name} onChange={(event) => update(index, 'name', event.target.value)} required /><Input label="Description" value={criterion.description ?? ''} onChange={(event) => update(index, 'description', event.target.value)} /><Input label="Weight (%)" type="number" min="0" max="100" value={criterion.weight} onChange={(event) => update(index, 'weight', event.target.value)} /><Input label="Maximum score" type="number" min="1" max="100" value={criterion.maxScore} onChange={(event) => update(index, 'maxScore', event.target.value)} /> </div>)}
        <Toast message={message} />
    </main></>;
}