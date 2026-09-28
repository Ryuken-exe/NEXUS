'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Role = 'PARTICIPANT' | 'JUDGE' | 'ORGANIZER' | 'ADMIN';

export function RoleNavigation({ role, slug }: { role: Role; slug?: string }) {
    const pathname = usePathname();
    const eventPath = slug ? `/events/${slug}` : '/dashboard';
    const links = role === 'PARTICIPANT'
        ? [{ href: '/dashboard', label: 'Workspace' }, ...(slug ? [{ href: eventPath, label: 'Gallery' }] : [])]
        : role === 'JUDGE'
            ? [{ href: '/dashboard', label: 'My reviews' }, ...(slug ? [{ href: `/judge/${slug}/conflicts`, label: 'Conflicts' }] : [])]
            : [{ href: '/dashboard', label: 'Workspace' }, ...(slug ? [
                { href: `/organizer/${slug}`, label: 'Event controls' },
                { href: `/organizer/${slug}/rubric`, label: 'Rubric' },
                { href: `/organizer/${slug}/judges`, label: 'Judges' }
            ] : []), { href: '/organizer/new', label: 'New event' }, ...(role === 'ADMIN' && slug ? [{ href: `/organizer/${slug}/score-history`, label: 'Score history' }] : [])];
    return <nav className="role-nav" aria-label={`${role.toLowerCase()} navigation`}>
        {links.map((link) => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>)}
    </nav>;
}