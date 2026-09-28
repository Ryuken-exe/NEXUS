'use client';
import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';

type Calibration = { id: string; name: string; direction: 'higher' | 'lower' | 'in-line' | 'insufficient-data'; scoredCount: number };
const labels = { higher: 'Running higher', lower: 'Running lower', 'in-line': 'In line', 'insufficient-data': 'Not enough data' };

export default function OrganizerCalibrationPage({ params }: { params: { slug: string } }) {
    const [judges, setJudges] = useState<Calibration[]>([]); const [message, setMessage] = useState('');
    useEffect(() => { fetch(`/api/events/${params.slug}/calibration`).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setJudges(data.judges); }).catch((error) => setMessage(error.message)); }, [params.slug]);
    return <><SiteHeader /><main className="wrap"><div className="page-title"><div className="eyebrow">Organizer · Judging integrity</div><h1>Calibration patterns</h1><p className="muted">Directional comparisons are recalculated after every score. No exact averages are shown.</p></div>{message && <p role="status" className="status">{message}</p>}<table className="table"><thead><tr><th>Judge</th><th>Pattern</th><th>Scores submitted</th></tr></thead><tbody>{judges.map((judge) => <tr key={judge.id}><td>{judge.name}</td><td>{labels[judge.direction]}</td><td>{judge.scoredCount}</td></tr>)}</tbody></table></main></>;
}