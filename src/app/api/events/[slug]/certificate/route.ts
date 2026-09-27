import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTeamMember, requireUser } from '@/lib/auth';
import { errorResponse, HttpError } from '@/lib/http';
export async function GET(_request: Request, context: { params: { slug: string } }) {
    try {
        const user = await requireUser(['PARTICIPANT']);
        const event = await db.event.findUnique({ where: { slug: context.params.slug } });
        if (!event) throw new HttpError(404, 'Event not found');
        if (!event.resultsPublished) throw new HttpError(409, 'Certificates are available after results are published');
        const membership = await db.teamMember.findFirst({ where: { userId: user.id, team: { eventId: event.id } }, include: { team: { include: { members: { include: { user: { select: { name: true } } } } } } } });
        if (!membership) throw new HttpError(404, 'No team certificate found');
        await requireTeamMember(membership.teamId, user.id);
        const pdf = await PDFDocument.create();
        const page = pdf.addPage([792, 612]);
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
        page.drawRectangle({ x: 28, y: 28, width: 736, height: 556, borderColor: rgb(0.29, 0.39, 0.31), borderWidth: 2 });
        page.drawText('CERTIFICATE OF PARTICIPATION', { x: 112, y: 450, size: 28, font: bold, color: rgb(0.08, 0.13, 0.11) });
        page.drawText(event.name, { x: 140, y: 390, size: 22, font, color: rgb(0.29, 0.39, 0.31) });
        page.drawText(membership.team.name, { x: 120, y: 325, size: 32, font: bold, color: rgb(0.08, 0.13, 0.11) });
        page.drawText(`Team members: ${membership.team.members.map((member) => member.user.name).join(', ')}`, { x: 80, y: 270, size: 12, font, color: rgb(0.2, 0.24, 0.22), maxWidth: 630 });
        page.drawText(`Issued ${new Date().toISOString().slice(0, 10)}`, { x: 310, y: 120, size: 12, font, color: rgb(0.2, 0.24, 0.22) });
        const bytes = await pdf.save();
        return new NextResponse(Buffer.from(bytes), { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${event.slug}-${membership.teamId}-certificate.pdf"` } });
    } catch (error) { return errorResponse(error); }
}