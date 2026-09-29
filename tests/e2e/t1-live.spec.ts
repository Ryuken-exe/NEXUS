import { test, expect, type Page } from '@playwright/test';

const password = 'dogfood-demo-2026';

async function signIn(page: Page, email: string) {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
}

test('T1 event, team invite cap, and gallery work in the browser', async ({ page, browser }) => {
    const slug = `t1-live-check-${Date.now()}`;
    const start = new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 16);
    const submissionEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    const judgingEnd = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16);
    const votingEnd = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().slice(0, 16);

    await signIn(page, 'organizer@dogfood.local');
    await page.goto('/organizer/new');
    await page.getByLabel('Event name').fill('T1 Browser Verification');
    await page.getByLabel('URL slug').fill(slug);
    await page.getByLabel('Description').fill('Created and edited through the live browser check.');
    await page.getByLabel('Starts').fill(start);
    await page.getByLabel('Submission deadline').fill(submissionEnd);
    await page.getByLabel('Judging deadline').fill(judgingEnd);
    await page.getByLabel('Voting deadline').fill(votingEnd);
    await page.getByRole('button', { name: 'Create event' }).click();
    await expect(page).toHaveURL(new RegExp(`/organizer/${slug}$`));
    await page.getByLabel('Event name').fill('T1 Browser Verification Edited');
    await page.getByLabel('Maximum team size').fill('2');
    await page.getByRole('button', { name: 'Save event settings' }).click();
    await expect(page.getByText('Event settings saved.')).toBeVisible();

    const firstParticipant = await browser.newPage();
    await signIn(firstParticipant, 'participant1@dogfood.local');
    await firstParticipant.getByLabel('Event').selectOption(slug);
    await firstParticipant.getByLabel('Team name').fill('Live Invite Team');
    await firstParticipant.getByRole('button', { name: 'Create team' }).click();
    await expect(firstParticipant.getByText('Team created. Share the invite link with members.')).toBeVisible();
    const invitePath = await firstParticipant.getByRole('link', { name: 'Open invite' }).getAttribute('href');
    expect(invitePath).toBeTruthy();

    const secondParticipant = await browser.newPage();
    await signIn(secondParticipant, 'participant2@dogfood.local');
    await secondParticipant.goto(invitePath!);
    await secondParticipant.getByRole('button', { name: 'Join team' }).click();
    await expect(secondParticipant.getByText('You joined the team.')).toBeVisible();

    const thirdParticipant = await browser.newPage();
    await signIn(thirdParticipant, 'participant3@dogfood.local');
    await thirdParticipant.goto(invitePath!);
    await thirdParticipant.getByRole('button', { name: 'Join team' }).click();
    await expect(thirdParticipant.getByText('Team is at its member limit')).toBeVisible();

    await page.goto('/events/dogfood-build-day');
    const search = page.getByLabel('Search projects');
    await search.fill('Civic Signal');
    await expect(page.locator('.project h2')).toHaveText(['Civic Signal']);
    await search.fill('');
    await page.getByLabel('Track').selectOption({ label: 'Climate' });
    await expect(page.locator('.project h2')).toHaveText(['Canopy']);
    await page.getByLabel('Track').selectOption({ label: 'All tracks' });
    await expect(page.locator('.project h2')).toHaveCount(4);
    const originalOrder = await page.locator('.project h2').allTextContents();
    await page.reload();
    await expect(page.locator('.project h2')).toHaveCount(4);
    expect(await page.locator('.project h2').allTextContents()).toEqual(originalOrder);

    console.log(`T1_EVENT_SLUG=${slug}`);
    console.log('T1_BROWSER=event create/edit; invite join and cap rejection; gallery search, track filter, stable sort: PASS');
    await firstParticipant.close();
    await secondParticipant.close();
    await thirdParticipant.close();
});