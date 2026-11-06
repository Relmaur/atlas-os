import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.mjs';

const painted = (page, x, y) =>
  page.evaluate(
    ([px, py]) => {
      const canvas = document.querySelector('#sharePreview');
      return Array.from(canvas.getContext('2d').getImageData(px, py, 1, 1).data);
    },
    [x, y]
  );

test('the Share sheet makes a postcard on the device, in three shapes, with the private parts off', async ({
  page
}) => {
  const offsite = [];
  page.on('request', request => {
    if (!request.url().startsWith('http://localhost') && !/^(data|blob):/.test(request.url()))
      offsite.push(request.url());
  });
  await page.goto('./#systems');
  await page.locator('#systemList').getByText('Ekwa Nexus').first().click();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Share this system' });
  await expect(sheet.locator('#shareSize')).toHaveText('1080 × 1080');
  await expect(sheet.getByRole('switch', { name: 'My notes' })).toHaveAttribute('aria-checked', 'false');
  await expect(sheet.getByRole('switch', { name: 'Portal address' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('#sharePreview')).toHaveJSProperty('width', 1080);
  await expect.poll(async () => (await painted(page, 540, 40))[3]).toBe(255); // drawn, not blank

  await sheet.getByRole('radio', { name: 'Story' }).click();
  await expect(sheet.locator('#shareSize')).toHaveText('1080 × 1920');
  await expect(page.locator('#sharePreview')).toHaveJSProperty('height', 1920);
  await sheet.getByRole('radio', { name: 'Wide' }).click();
  await expect(page.locator('#sharePreview')).toHaveJSProperty('width', 1920);

  const { violations } = await new AxeBuilder({ page }).include('#shareSheet').analyze();
  expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    sheet.getByRole('button', { name: 'Save picture' }).click()
  ]);
  expect(download.suggestedFilename()).toBe('ekwa-nexus-wide.png');
  const bytes = await fs.readFile(await download.path());
  expect([...bytes.subarray(1, 4)].map(b => String.fromCharCode(b)).join('')).toBe('PNG');
  expect(offsite).toEqual([]);
});

test('a ship has a Fleet card', async ({ page }) => {
  await page.goto('./#ship/gear-kestrel');
  await page.getByRole('button', { name: /^(Share|Fleet card)$/ }).click(); // "Fleet card" from lg (d09)
  const sheet = page.locator('#shareSheet');
  await expect(sheet.locator('#shareSize')).toHaveText('810 × 1440');
  await expect.poll(async () => (await painted(page, 405, 40))[3]).toBe(255);
  const { violations } = await new AxeBuilder({ page }).include('#shareSheet').analyze();
  expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);
});

test('from lg sharing is a centred dialog, with the preview beside the choices', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'wide screens');
  await page.goto('./#card');
  await page.getByRole('button', { name: 'Share' }).click();
  const dialog = page.locator('#shareSheet');
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(panel => panel.getAnimations().length)).toBe(0);
  const box = await dialog.boundingBox();
  expect(box.x + box.width / 2).toBeCloseTo(1440 / 2, 0);
  const preview = await page.locator('#sharePreview').boundingBox();
  const save = await dialog.getByRole('button', { name: 'Save picture' }).boundingBox();
  expect(save.x).toBeGreaterThanOrEqual(preview.x + preview.width);
  await page.keyboard.press('Escape');
  await expect(page.locator('#shareSheet')).toHaveCount(0);
});
