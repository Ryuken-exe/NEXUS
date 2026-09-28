'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { DataTable, EmptyState, Skeleton, Tabs, Toast } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { apiRequest, errorMessage } from '@/lib/api-client';
type Result = { id: string; title: string; team: string; track: string; score: number | null; votes: number; rank: number; tieBreakReason: string | null };
type SortKey = 'rank' | 'title' | 'team' | 'track' | 'score' | 'votes';

export default function ResultsPage({ params }: { params: { slug: string } }) {
    const [view, setView] = useState<'raw' | 'normalized'>('raw');
    const [rows, setRows] = useState<Result[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [reload, setReload] = useState(0);
    const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: 'rank', descending: false });
    useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        apiRequest<Result[]>(`/api/events/${params.slug}/results`, { headers: { 'x-score-view': view } })
            .then((result) => { if (active) setRows(result); })
            .catch((reason) => { if (active) setError(errorMessage(reason)); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [params.slug, view, reload]);

    const sortedRows = [...rows].sort((left, right) => {
        const a = left[sort.key]; const b = right[sort.key];
        const comparison = typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : Number(a ?? -Infinity) - Number(b ?? -Infinity);
        return sort.descending ? -comparison : comparison;
    });
    function toggleSort(key: SortKey) {
        setSort((current) => ({ key, descending: current.key === key ? !current.descending : false }));
    }
    function exportCsv() {
        const headers = ['Rank', 'Project', 'Team', 'Track', view === 'raw' ? 'Raw average' : 'Normalized z', 'Votes'];
        const quote = (value: string | number) => {
            const text = String(value);
            const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
            return `"${safe.replaceAll('"', '""')}"`;
        };
        const content = [headers, ...sortedRows.map((row) => [row.rank, row.title, row.team, row.track, row.score ?? '', row.votes])].map((line) => line.map(quote).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${params.slug}-results-${view}.csv`; anchor.click(); URL.revokeObjectURL(url);
    }
    const columns: { key: SortKey; label: string }[] = [{ key: 'rank', label: 'Rank' }, { key: 'title', label: 'Project' }, { key: 'team', label: 'Team' }, { key: 'track', label: 'Track' }, { key: 'score', label: view === 'raw' ? 'Raw average' : 'Normalized z' }, { key: 'votes', label: 'Votes' }];
    return <><SiteHeader /><main className="wrap"><div className="page-title"><Link href={`/events/${params.slug}`} className="eyebrow">← Project gallery</Link><h1>Results</h1><p className="muted">Cross-judge scores are aggregated per project. Individual judge ballots stay private.</p></div>
        <div className="toolbar ui-actions"><Tabs label="Score scale" value={view} onChange={(value) => setView(value as 'raw' | 'normalized')} items={[{ value: 'raw', label: 'Raw average', content: null }, { value: 'normalized', label: 'Normalized z', content: null }]} /><Button variant="outline" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button></div>
        {error ? <div><Toast message={error} kind="error" /><Button variant="outline" onClick={() => setReload((value) => value + 1)}>Retry</Button></div> : loading ? <div className="form-stack" aria-label="Loading results"><Skeleton /><Skeleton className="h-48" /></div> : rows.length === 0 ? <EmptyState title="No published results yet" description="Results will appear here once judging and voting close and an organizer publishes them." /> : <DataTable><thead><tr>{columns.map((column) => <th key={column.key} aria-sort={sort.key === column.key ? sort.descending ? 'descending' : 'ascending' : 'none'}><button type="button" className="table-sort" onClick={() => toggleSort(column.key)}>{column.label}</button></th>)}</tr></thead><tbody>{sortedRows.map((row) => <tr key={row.id}><td>{row.rank}</td><td>{row.title}{row.tieBreakReason && <small className="muted tie-break">Tie broken by: {row.tieBreakReason}</small>}</td><td>{row.team}</td><td>{row.track}</td><td>{row.score === null ? '—' : row.score.toFixed(3)}</td><td>{row.votes}</td></tr>)}</tbody></DataTable>}
    </main></>;
}