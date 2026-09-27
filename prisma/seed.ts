import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const db = new PrismaClient();

async function main() {
    const passwordHash = await hash('dogfood-demo-2026', 10);
    const accountRows: { email: string; name: string; role: Role }[] = [
        { email: 'admin@dogfood.local', name: 'Morgan Chen', role: 'ADMIN' },
        { email: 'organizer@dogfood.local', name: 'Avery Brooks', role: 'ORGANIZER' },
        { email: 'judge1@dogfood.local', name: 'Jordan Lee', role: 'JUDGE' },
        { email: 'judge2@dogfood.local', name: 'Sam Rivera', role: 'JUDGE' },
        { email: 'judge3@dogfood.local', name: 'Taylor Kim', role: 'JUDGE' },
        { email: 'participant1@dogfood.local', name: 'Casey Park', role: 'PARTICIPANT' },
        { email: 'participant2@dogfood.local', name: 'Riley James', role: 'PARTICIPANT' },
        { email: 'participant3@dogfood.local', name: 'Alex Morgan', role: 'PARTICIPANT' },
        { email: 'participant4@dogfood.local', name: 'Jamie Patel', role: 'PARTICIPANT' },
        { email: 'participant5@dogfood.local', name: 'Quinn Fox', role: 'PARTICIPANT' }
    ];
    const users = new Map<string, { id: string }>();
    for (const account of accountRows) {
        users.set(account.email, await db.user.upsert({ where: { email: account.email }, create: { ...account, passwordHash }, update: { ...account, passwordHash } }));
    }
    const organizer = users.get('organizer@dogfood.local')!;
    const now = Date.now();
    const event = await db.event.upsert({
        where: { slug: 'dogfood-build-day' },
        create: { slug: 'dogfood-build-day', name: 'Dogfood Build Day', description: 'A practical weekend for useful, humane software.', startsAt: new Date(now - 86_400_000), submissionEnds: new Date(now + 14 * 86_400_000), judgingEnds: new Date(now + 30 * 86_400_000), votingEnds: new Date(now + 20 * 86_400_000), teamMin: 1, teamMax: 4, votingEnabled: true, createdById: organizer.id },
        update: { name: 'Dogfood Build Day', description: 'A practical weekend for useful, humane software.', startsAt: new Date(now - 86_400_000), submissionEnds: new Date(now + 14 * 86_400_000), judgingEnds: new Date(now + 30 * 86_400_000), votingEnds: new Date(now + 20 * 86_400_000), votingEnabled: true, resultsPublished: false }
    });
    const tracksData = [{ name: 'Civic Tools', description: 'Make local public services easier to use.' }, { name: 'Climate', description: 'Useful software for adaptation and lower emissions.' }, { name: 'Open Source', description: 'Build sustainable shared infrastructure.' }];
    const tracks = new Map<string, { id: string }>();
    for (const item of tracksData) tracks.set(item.name, await db.track.upsert({ where: { eventId_name: { eventId: event.id, name: item.name } }, create: { ...item, eventId: event.id }, update: item }));
    for (const prize of [{ title: 'People’s Choice', value: '$500', description: 'Community-selected project' }, { title: 'Best in Show', value: '$1,000', description: 'Highest normalized judging result' }]) {
        const existing = await db.prize.findFirst({ where: { eventId: event.id, title: prize.title } });
        if (existing) await db.prize.update({ where: { id: existing.id }, data: prize }); else await db.prize.create({ data: { ...prize, eventId: event.id } });
    }
    const criteriaData = [{ name: 'Impact', weight: 35 }, { name: 'Craft', weight: 25 }, { name: 'Originality', weight: 20 }, { name: 'Feasibility', weight: 20 }];
    const criteria = [];
    for (const item of criteriaData) criteria.push(await db.rubricCriterion.upsert({ where: { eventId_name: { eventId: event.id, name: item.name } }, create: { ...item, eventId: event.id, maxScore: 10 }, update: { ...item, maxScore: 10 } }));
    const projects = [
        { name: 'Civic Signal', title: 'Civic Signal', tagline: 'Know when your city needs your voice.', description: 'A neighborhood issue tracker that turns public meeting agendas into clear, local action.', track: 'Civic Tools', members: ['participant1@dogfood.local'], scores: [[9, 8, 8, 9], [8, 9, 7, 8], [8, 7, 9, 8]] },
        { name: 'Canopy', title: 'Canopy', tagline: 'Shade maps made with the people who need them.', description: 'Community-collected street shade data helps residents find cooler walking routes.', track: 'Climate', members: ['participant2@dogfood.local', 'participant3@dogfood.local'], scores: [[8, 8, 9, 8], [7, 8, 9, 7], [9, 7, 8, 8]] },
        { name: 'Patchwork', title: 'Patchwork', tagline: 'Small open-source teams, healthier handoffs.', description: 'A lightweight contributor guide that keeps project knowledge from living in one person’s head.', track: 'Open Source', members: ['participant4@dogfood.local'], scores: [[7, 9, 7, 8], [8, 8, 8, 9], [7, 8, 7, 8]] },
        { name: 'Warmline', title: 'Warmline', tagline: 'Find trusted support close to home.', description: 'A private-first directory of local mutual-aid and crisis support resources.', track: 'Civic Tools', members: ['participant5@dogfood.local'], scores: [[9, 8, 8, 7], [8, 7, 8, 8], [8, 9, 7, 8]] }
    ];
    const judgeEmails = ['judge1@dogfood.local', 'judge2@dogfood.local', 'judge3@dogfood.local'];
    const judgeIds = judgeEmails.map((email) => users.get(email)!.id);
    const submissionIds: string[] = [];
    for (const [projectIndex, project] of projects.entries()) {
        const team = await db.team.upsert({ where: { eventId_name: { eventId: event.id, name: project.name } }, create: { eventId: event.id, name: project.name }, update: {} });
        for (const email of project.members) await db.teamMember.upsert({ where: { teamId_userId: { teamId: team.id, userId: users.get(email)!.id } }, create: { teamId: team.id, userId: users.get(email)!.id }, update: {} });
        const submission = await db.submission.upsert({ where: { teamId: team.id }, create: { eventId: event.id, teamId: team.id, trackId: tracks.get(project.track)!.id, title: project.title, tagline: project.tagline, description: project.description, repoUrl: '', demoUrl: '', status: 'SUBMITTED', submittedAt: new Date(now - 60_000 * (projectIndex + 1)) }, update: { eventId: event.id, trackId: tracks.get(project.track)!.id, title: project.title, tagline: project.tagline, description: project.description, status: 'SUBMITTED', submittedAt: new Date(now - 60_000 * (projectIndex + 1)) } });
        submissionIds.push(submission.id);
        for (const [judgeIndex, judgeId] of judgeIds.entries()) {
            const assignment = await db.judgeAssignment.upsert({ where: { submissionId_judgeId: { submissionId: submission.id, judgeId } }, create: { eventId: event.id, submissionId: submission.id, judgeId, assignedById: organizer.id }, update: {} });
            const rubricValues = Object.fromEntries(criteria.map((criterion, index) => [criterion.id, project.scores[judgeIndex][index]]));
            const total = criteria.reduce((sum, criterion, index) => sum + project.scores[judgeIndex][index] * criterion.weight / 10, 0);
            await db.score.upsert({ where: { assignmentId: assignment.id }, create: { assignmentId: assignment.id, submissionId: submission.id, judgeId, values: rubricValues, total, feedback: 'A thoughtful, clearly scoped build.' }, update: { values: rubricValues, total, feedback: 'A thoughtful, clearly scoped build.' } });
        }
    }
    for (const [index, email] of ['participant1@dogfood.local', 'participant3@dogfood.local', 'participant4@dogfood.local'].entries()) {
        const user = users.get(email)!;
        const submissionId = submissionIds[index];
        const ipHash = `fixture-ip-${index}-${event.id}`;
        await db.vote.upsert({ where: { eventId_userId: { eventId: event.id, userId: user.id } }, create: { eventId: event.id, userId: user.id, submissionId, ipHash }, update: { submissionId, ipHash } });
        await db.comment.upsert({ where: { id: `fixture-comment-${event.id}-${index}` }, create: { id: `fixture-comment-${event.id}-${index}`, eventId: event.id, userId: user.id, submissionId, body: ['Clear and immediately useful.', 'Love the community-first data collection.', 'A strong direction for onboarding.'][index], ipHash }, update: {} });
    }
    for (const [index, email] of ['judge1@dogfood.local', 'judge2@dogfood.local'].entries()) {
        const user = users.get(email)!;
        await db.auditLog.upsert({ where: { id: `fixture-audit-${event.id}-${index}` }, create: { id: `fixture-audit-${event.id}-${index}`, eventId: event.id, actorId: user.id, action: 'seed.fixture', targetId: submissionIds[index], details: { source: 'seed' } }, update: {} });
    }
    const past = await db.event.upsert({ where: { slug: 'dogfood-archive' }, create: { slug: 'dogfood-archive', name: 'Dogfood Archive', description: 'A completed previous showcase.', startsAt: new Date(now - 200 * 86_400_000), submissionEnds: new Date(now - 190 * 86_400_000), judgingEnds: new Date(now - 180 * 86_400_000), votingEnds: new Date(now - 179 * 86_400_000), resultsPublished: true, votingEnabled: false, createdById: organizer.id }, update: { resultsPublished: true, votingEnabled: false } });
    void past;
    console.log(`Seeded ${event.slug} with ${projects.length} teams, ${submissionIds.length} projects, 3 judges, scores and community activity.`);
    console.log('Demo accounts use password: dogfood-demo-2026');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); });