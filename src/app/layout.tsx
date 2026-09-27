import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Dogfood 2026 | Hackathon Judging', description: 'A local-first platform for building, judging and sharing hackathon projects.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return <html lang="en"><body>{children}</body></html>;
}