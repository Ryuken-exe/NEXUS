import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { HttpError } from './http';

export type Session = { sub: string; role: 'PARTICIPANT' | 'JUDGE' | 'ORGANIZER' | 'ADMIN' };
const secret = () => {
    const value = process.env.JWT_SECRET;
    if (!value) throw new Error('JWT_SECRET must be configured');
    return value;
};

export function signSession(user: { id: string; role: Session['role'] }) {
    return jwt.sign({ role: user.role }, secret(), { subject: user.id, expiresIn: '7d' });
}

export async function currentSession(): Promise<Session | null> {
    const token = cookies().get('dogfood_session')?.value;
    if (!token) return null;
    try { return jwt.verify(token, secret()) as Session; }
    catch { return null; }
}

export async function requireUser(roles?: Session['role'][]) {
    const session = await currentSession();
    if (!session) throw new HttpError(401, 'Authentication required');
    const user = await db.user.findUnique({ where: { id: session.sub }, select: { id: true, email: true, name: true, role: true } });
    if (!user) throw new HttpError(401, 'Session user no longer exists');
    if (roles && !roles.includes(user.role)) throw new HttpError(403, 'Insufficient permissions');
    return user;
}

export async function requireTeamMember(teamId: string, userId: string) {
    const membership = await db.teamMember.findFirst({ where: { teamId, userId }, include: { team: true } });
    if (!membership) throw new HttpError(403, 'You are not a member of this team');
    return membership;
}

export async function requireEventManager(eventId: string, userId: string, role: string) {
    if (role === 'ADMIN') return;
    const event = await db.event.findUnique({ where: { id: eventId }, select: { createdById: true } });
    if (!event || event.createdById !== userId) throw new HttpError(403, 'Event organizer access required');
}