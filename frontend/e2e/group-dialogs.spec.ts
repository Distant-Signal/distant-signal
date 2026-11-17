import { test, expect } from '@playwright/test';
import { asUser, FRIEND_SESSION_COOKIE, logInAs, MISS_SESSION_COOKIE, PAIR_GROUP, SOLO_GROUP } from './missFixtures';

// The owner's leave and delete dialogs (DS-534): the sole owner can't leave
// a group, leaving is deleting it, and the dialog says so; an owner with
// other members hands ownership over. Against the seed's `fixture-miss`
// groups (seed.sql): Fixture Solo, the owner alone, and Fixture Pair, the
// owner and Friend Fixture. The seeded groups are only looked at and
// cancelled, so they stay as seeded; the deletion itself runs on a group
// the test makes.

test.describe('group dialogs', () => {
  test.beforeEach(async ({ context }) => {
    await logInAs(context, MISS_SESSION_COOKIE);
  });

  test('the sole owner leaving is asked "Delete this group?"', async ({ page }) => {
    await page.goto(`/groups/${SOLO_GROUP}`);
    await page.getByRole('button', { name: 'Leave group' }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete this group?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("You're the only member, so leaving would delete this group.")).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirm delete group' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirm leave group' })).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    // Nothing was deleted.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Fixture Solo' })).toBeVisible();
  });

  test('an owner leaving a group with another member names who takes over', async ({ page }) => {
    await page.goto(`/groups/${PAIR_GROUP}`);
    await page.getByRole('button', { name: 'Leave group' }).click();

    const dialog = page.getByRole('dialog', { name: 'Leave this group?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Friend Fixture.* will become the new owner\./)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirm leave group' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });

  test('the danger zone deletes for everyone, after asking', async ({ page }) => {
    await page.goto(`/groups/${PAIR_GROUP}`);
    await page.getByRole('button', { name: 'Delete group' }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete Fixture Pair?' });
    await expect(dialog.getByText('This deletes the group for everyone.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });

  test('when the other member has left since the page loaded, leaving turns into the delete prompt', async ({
    page,
    request,
  }) => {
    // A group of two, as the owner's page shows it...
    const created = await request.post('/api/groups', {
      headers: asUser(MISS_SESSION_COOKIE),
      data: { name: 'Fixture Stale' },
    });
    const { id } = (await created.json()) as { id: string };
    const invite = await request.post(`/api/groups/${id}/invite-link`, { headers: asUser(MISS_SESSION_COOKIE) });
    const { token } = (await invite.json()) as { token: string };
    const joined = await request.post(`/api/groups/join/${token}`, { headers: asUser(FRIEND_SESSION_COOKIE) });
    expect(joined.ok(), await joined.text()).toBe(true);
    await page.goto(`/groups/${id}`);
    await page.getByRole('button', { name: 'Leave group' }).click();
    await expect(page.getByRole('dialog', { name: 'Leave this group?' })).toBeVisible();

    // ...then the friend leaves while the dialog is open.
    const asFriend = await request.get(`/api/groups/${id}`, { headers: asUser(FRIEND_SESSION_COOKIE) });
    const { memberId } = (await asFriend.json()) as { memberId: string };
    const left = await request.delete(`/api/groups/${id}/members/${memberId}`, {
      headers: asUser(FRIEND_SESSION_COOKIE),
    });
    expect(left.ok(), await left.text()).toBe(true);

    // The api refuses the leave (the owner is now alone) and deletes nothing:
    // the dialog asks to delete instead, saying why.
    await page.getByRole('button', { name: 'Confirm leave group' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this group?' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("You're the only member, so you can't leave without deleting this group."),
    ).toBeVisible();
    const still = await request.get(`/api/groups/${id}`, { headers: asUser(MISS_SESSION_COOKIE) });
    expect(still.status()).toBe(200);

    await dialog.getByRole('button', { name: 'Confirm delete group' }).click();
    await expect(page).toHaveURL(/\/groups$/);
  });

  test('confirming the sole owner prompt deletes the group and goes back to the list', async ({ page, request }) => {
    const created = await request.post('/api/groups', {
      headers: asUser(MISS_SESSION_COOKIE),
      data: { name: 'Fixture Throwaway' },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { id } = (await created.json()) as { id: string };

    await page.goto(`/groups/${id}`);
    await page.getByRole('button', { name: 'Leave group' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this group?' });
    await dialog.getByRole('button', { name: 'Confirm delete group' }).click();

    await expect(page).toHaveURL(/\/groups$/);
    const gone = await request.get(`/api/groups/${id}`, { headers: asUser(MISS_SESSION_COOKIE) });
    expect(gone.status()).toBe(404);
  });
});
