import { normalizeJudgeScores } from '@/lib/judging';
import { SiteHeader } from '@/components/site-header';

const fixture = [
    { judgeId: 'Morgan', submissionId: 'Civic Signal', total: 85.5 }, { judgeId: 'Morgan', submissionId: 'Canopy', total: 82 }, { judgeId: 'Morgan', submissionId: 'Patchwork', total: 77 }, { judgeId: 'Morgan', submissionId: 'Warmline', total: 81.5 },
    { judgeId: 'Rene', submissionId: 'Civic Signal', total: 80.5 }, { judgeId: 'Rene', submissionId: 'Canopy', total: 76.5 }, { judgeId: 'Rene', submissionId: 'Patchwork', total: 82 }, { judgeId: 'Rene', submissionId: 'Warmline', total: 77.5 },
    { judgeId: 'Kai', submissionId: 'Civic Signal', total: 79.5 }, { judgeId: 'Kai', submissionId: 'Canopy', total: 81 }, { judgeId: 'Kai', submissionId: 'Patchwork', total: 74.5 }, { judgeId: 'Kai', submissionId: 'Warmline', total: 80.5 }
];

export default function NormalizationProofPage() {
    const normalized = normalizeJudgeScores(fixture);
    const projects = [...new Set(fixture.map((row) => row.submissionId))].map((submissionId) => {
        const raw = fixture.filter((row) => row.submissionId === submissionId).map((row) => row.total);
        const z = normalized.filter((row) => row.submissionId === submissionId).map((row) => row.zScore);
        return { submissionId, raw: raw.reduce((sum, value) => sum + value, 0) / raw.length, normalized: z.reduce((sum, value) => sum + value, 0) / z.length };
    });
    return <><SiteHeader /><main className="wrap"><div className="page-title"><div className="eyebrow">Bonus · Normalization proof</div><h1>Same work. Fairer scale.</h1><p className="muted">Fixture scores from the Dogfood Build Day seed, calculated with the production z-score function.</p></div><section className="dashboard-grid"><div><h2>Raw score distribution</h2>{['Morgan', 'Rene', 'Kai'].map((judge) => { const values = fixture.filter((row) => row.judgeId === judge).map((row) => row.total); const mean = values.reduce((sum, value) => sum + value, 0) / values.length; return <p key={judge}>{judge} · mean {mean.toFixed(1)}<div className="bar"><span style={{ width: `${mean}%` }} /></div></p>; })}</div><div><h2>After within-judge z-score</h2><p className="muted">Each judge is centered around zero and scaled by that judge’s sample standard deviation. Aggregated z-scores are shown on a comparable scale.</p>{projects.map((project) => <p key={project.submissionId}>{project.submissionId} · {project.normalized.toFixed(3)} z<div className="bar"><span style={{ width: `${Math.max(5, Math.min(100, (project.normalized + 1) * 45))}%` }} /></div></p>)}</div></section><section><h2>Before and after by project</h2><table className="table"><thead><tr><th>Project</th><th>Mean raw (0–100)</th><th>Mean normalized z</th></tr></thead><tbody>{projects.map((project) => <tr key={project.submissionId}><td>{project.submissionId}</td><td>{project.raw.toFixed(2)}</td><td>{project.normalized.toFixed(4)}</td></tr>)}</tbody></table><p className="muted" style={{ marginTop: 18 }}>Normalization reduces persistent judge severity/leniency differences. It does not prove judge consistency, remove bias, or make very small samples statistically strong. A judge with one score or zero variance contributes z = 0.</p></section></main></>;
}