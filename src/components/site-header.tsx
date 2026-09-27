import Link from 'next/link';
export function SiteHeader() {
    return <header className="topbar wrap"><Link href="/" className="brand"><span className="brand-mark">D</span><span>DOGFOOD <span style={{ color: '#6b756d' }}>2026</span></span></Link><nav className="navlinks"><Link href="/normalization-proof">Proof</Link><Link href="/login" className="button secondary">Sign in</Link></nav></header>;
}