import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.mjs';

const axe = async page => {
  const { violations } = await new AxeBuilder({ page }).include('main').analyze();
  expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);
};

test('the collection: cards from the log, flip, next, copy and a 4:5 picture', async ({ page }) => {
  await page.goto('./#card');
  await page.getByRole('link', { name: 'Collection' }).click();
  await expect(page).toHaveURL(/#cards$/);
  await expect(page.locator('#collectionPosition')).toHaveText(/^1 of \d+$/);
  const total = Number((await page.locator('#collectionPosition').textContent()).split(' of ')[1]);
  expect(total).toBeGreaterThan(2);
  await expect(page.locator('body')).not.toContainText(/VERIFIED|WITNESSED/);
  await axe(page);

  await page.getByRole('button', { name: 'Flip', exact: true }).click();
  await expect(page.locator('#cardRail section[aria-label$="back"]:not([inert])')).toContainText(/SEED/);
  await axe(page);
  await page.getByRole('button', { name: 'Flip', exact: true }).click();

  await page.locator('#cardRail').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#collectionPosition')).toHaveText(`2 of ${String(total)}`);

  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Share this card' });
  await expect(sheet.locator('#shareSize')).toHaveText('1080 × 1350');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    sheet.getByRole('button', { name: 'Save picture' }).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/-card\.png$/);
  const bytes = await fs.readFile(await download.path());
  expect(bytes.length).toBeGreaterThan(20_000); // drawn, not blank: how much depends on the card

  await page.goto('./#frontier'); // going elsewhere closes the sheet
  await expect(sheet).toBeHidden();
});

test('a link opens one card', async ({ page }) => {
  await page.goto('./#cards/gear:gear-kestrel');
  await expect(page.locator('#cardRail section[aria-label="Kestrel IV, front"]:not([inert])')).toBeVisible();
  await expect(page.locator('#cardTrust')).toContainText('FLEET');
});

test('an empty log has an empty collection that says how to start', async ({ page }) => {
  await page.goto('./#cards');
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('nms_master_os_state'));
    state.systems = [];
    state.gear = [];
    localStorage.setItem('nms_master_os_state', JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator('body')).toContainText('Your collection starts here');
});

test('Frontier: what’s still out there, accessible, and shareable', async ({ page }) => {
  await page.goto('./#frontier');
  await expect(page.getByRole('heading', { name: 'Frontier', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Star colours' })).toContainText(/\d \/ 5/);
  await axe(page);
  await page.getByRole('button', { name: 'Share my Frontier' }).click();
  await expect(page.getByRole('dialog', { name: 'Share my Frontier' }).locator('#shareSize')).toHaveText('1080 × 1350');
});

test('on a computer the cards run the full width, and dragging with the mouse moves to the next', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'a mouse drag is the desktop swipe');
  await page.goto('./#cards');
  await expect(page.locator('#collectionPosition')).toHaveText(/^1 of \d+$/);
  const rail = await page.locator('#cardRail').boundingBox();
  const main = await page.locator('main').boundingBox();
  expect(rail.width).toBeGreaterThan(main.width - 10);
  // The cards beside the one in view draw their art too.
  await expect(page.locator('#cardRail .snap-center').nth(2).locator('svg.card-lay-0')).toHaveCount(1);

  const y = rail.y + rail.height / 2;
  const x = rail.x + rail.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120, y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#collectionPosition')).toHaveText(/^2 of \d+$/);
  // The drag didn't flip the card it ended on.
  await expect(page.locator('#cardRail section[aria-label$="front"]:not([inert])')).toHaveCount(1);
});
