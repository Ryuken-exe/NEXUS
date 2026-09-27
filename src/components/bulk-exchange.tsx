'use client';
import { useState } from 'react';
export function BulkExchange({ slug }: { slug: string }) {
    const [kind, setKind] = useState<'teams' | 'submissions' | 'scores'>('submissions'); const [message, setMessage] = useState('');
    async function importFile(file?: File) {
        if (!file) return;
        const isCsv = file.name.toLowerCase().endsWith('.csv');
        const response = await fetch(`/api/events/${slug}/bulk${isCsv ? `?format=csv&type=${kind}` : ''}`, { method: 'POST', headers: { 'content-type': isCsv ? 'text/csv' : 'application/json' }, body: await file.text() });
        const result = await response.json(); setMessage(response.ok ? 'Import completed.' : result.error ?? 'Import failed.');
    }
    return <section className="form-panel"><div className="eyebrow">Bulk exchange</div><h2>Portable event data</h2><div className="toolbar"><select className="field" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="teams">Teams</option><option value="submissions">Submissions</option><option value="scores">Scores</option></select><input className="field" type="file" accept=".csv,.json,application/json,text/csv" aria-label="Choose a CSV or JSON import file" onChange={(event) => importFile(event.target.files?.[0])} /></div><div className="toolbar">{(['teams', 'submissions', 'scores'] as const).map((type) => <a className="button secondary" key={type} href={`/api/events/${slug}/bulk?format=csv&type=${type}`}>{type}.csv ↓</a>)}<a className="button secondary" href={`/api/events/${slug}/bulk`}>snapshot.json ↓</a></div>{message && <p role="status" className="status">{message}</p>}</section>;
}