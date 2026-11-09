import { test, expect } from './fixtures.mjs';

test("after an update: one card on Home, with the newest update's name, until it's dismissed", async ({ page }) => {
  await page.goto('./#systems');
  await page.evaluate(() => {
    localStorage.setItem('atlas_update_seen', 'an-older-update');
  });
  await page.goto('./#home');
  await page.reload();
  const card = page.locator('#whatsNew');
  await expect(card.getByRole('heading', { name: 'Updated to Gateway' })).toBeVisible();
  await expect(card.getByRole('link', { name: "See what's new" })).toHaveAttribute(
    'href',
    'https://atlas-os.cloud/updates/gateway/'
  );
  await expect(page.locator('#homeNow')).toBeVisible(); // it never covers Home
  await card.getByRole('button', { name: /^Dismiss/ }).click();
  await expect(card).toBeHidden();
  await page.reload();
  await expect(page.locator('#homeNow')).toBeVisible();
  await expect(card).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('atlas_update_seen'))).toBe('gateway');
});

test('Settings links to the updates', async ({ page }) => {
  await page.goto('./#more');
  await expect(page.getByRole('link', { name: "What's new" })).toHaveAttribute(
    'href',
    'https://atlas-os.cloud/updates/'
  );
});
