import { test, expect, storedState } from './fixtures.mjs';

test('adds a system with glyphs and a tag, logging the arrival', async ({ page }) => {
  await page.goto('./#systems');
  await page.locator('#sec-systems').getByRole('button', { name: 'Log system' }).click();
  await page.locator('#sysName').fill('Test Prime');
  await page.locator('#systemEditor input[name="glyphs"]').fill('1a2b3c4d5e6f');
  await page.locator('#tagInput').fill('mining');
  await page.locator('#tagInput').press('Enter');
  await page.locator('#systemEditor button[type="submit"]').click();

  await expect(page.locator('#systemList')).toContainText('Test Prime');
  const system = (await storedState(page)).systems.find(item => item.name === 'Test Prime');
  expect(system.glyphs).toBe('1A2B3C4D5E6F');
  expect(system.tags).toContain('mining');
  expect(system.visits).toHaveLength(1);
});

test('a system opens on its own screen; planets added there persist across a reload; Back returns', async ({
  page
}) => {
  await page.goto('./#systems');
  await page.locator('#systemList').getByText('Ekwa Nexus').click();
  await expect(page).toHaveURL(/#system\/sys-ekwa$/);
  await expect(page.locator('#systemTitle')).toHaveText('Ekwa Nexus');

  await page.getByRole('button', { name: /^Add body/ }).click();
  const sheet = page.locator('#planetSheet');
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Verdant IV');
  await sheet.getByRole('button', { name: 'Add body' }).click();
  await expect(sheet).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('heading', { name: 'Planets & moons · 1' })).toBeVisible();
  // From lg a row opens the planet panel beside System detail (37); on a phone, the planet's own view (36).
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await page.getByRole('link', { name: /^Verdant IV/ }).click();
    await expect(sheet).toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByRole('link', { name: /^Verdant IV/ })).toContainText('Editing');
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await page.goto(`./${await page.getByRole('link', { name: /^Verdant IV/ }).getAttribute('href')}`);
  } else await page.getByRole('link', { name: /^Verdant IV/ }).click();
  await expect(page).toHaveURL(/#planet\/sys-ekwa\/pl-/);
  await expect(page.locator('#planetTitle')).toHaveText('Verdant IV');
  await expect(page.locator('#sec-planet')).toContainText('Nothing scanned yet');
  await page.locator('#sec-planet').getByRole('button', { name: 'Back to Ekwa Nexus' }).click();
  await expect(page).toHaveURL(/#system\/sys-ekwa$/);

  await page.reload(); // the address opens the same system
  await expect(page.locator('#systemTitle')).toHaveText('Ekwa Nexus');
  const system = (await storedState(page)).systems.find(item => item.id === 'sys-ekwa');
  expect(system.planets.map(planet => planet.name)).toEqual(['Verdant IV']);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/#systems$/);
});

test('the Favourites filter shows only favourite systems', async ({ page }) => {
  await page.goto('./#systems');
  await page.locator('#systemList').getByText('Hesper Drift').click();
  const details = page.locator('#sec-system');
  await details.getByRole('button', { name: 'Favourite' }).click();
  await expect(details.getByRole('button', { name: 'Favourite' })).toHaveAttribute('aria-pressed', 'true');
  await details.getByRole('button', { name: 'Back' }).click();
  await page.locator('#systemFavFilter').click();
  await expect(page.locator('#systemFavFilter')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#systemList')).toContainText('Hesper Drift');
  await expect(page.locator('#systemList')).not.toContainText('Ekwa Nexus');
});

test('filters by tag', async ({ page }) => {
  await page.goto('./#systems');
  await page
    .locator('#systemTagFilters')
    .getByRole('button', { name: /trade-hub/ })
    .click();
  await expect(page.locator('#systemList')).toContainText('Ekwa Nexus');
  await expect(page.locator('#systemList')).not.toContainText('Hesper Drift');
});

test('on a phone, dragging the sheet’s bar down closes it', async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone' || browserName !== 'chromium', 'touch drag on the phone sheet');
  await page.goto('./#systems');
  await page.locator('#systemList').getByText('Ekwa Nexus').click();
  await page.getByRole('button', { name: 'Edit system' }).click();
  const handle = page.locator('#systemPanel [data-sheet-handle]');
  await expect(handle).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toHaveCount(1); // the bar, no ✕
  // Measure once the sheet has finished sliding in (no transition left running): under a loaded machine the slide
  // runs long, and a box taken mid-slide puts the touch beside the bar.
  await expect.poll(() => page.locator('#systemPanel').evaluate(panel => panel.getAnimations().length)).toBe(0);
  const box = await handle.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [{ x, y }]);
  for (let step = 1; step <= 10; step++) await touch('touchMove', [{ x, y: y + step * 25 }]);
  await touch('touchEnd', []);
  await expect(page.locator('#systemPanel')).toHaveAttribute('aria-hidden', 'true');
});

test('from lg a system opens beside its list, marked there; a phone keeps one screen at a time', async ({
  page
}, testInfo) => {
  await page.goto('./#systems');
  const list = page.locator('#sec-systems');
  const details = page.locator('#sec-system');
  await list.locator('#systemList').getByText('Hesper Drift').click();
  await expect(details).toContainText('Hesper Drift');
  if (testInfo.project.name === 'phone') {
    await expect(list).toBeHidden();
    return;
  }
  await expect(list).toBeVisible();
  expect((await list.boundingBox()).x + 380).toBeLessThanOrEqual((await details.boundingBox()).x);
  await expect(list.locator('[aria-current="true"]')).toHaveText('Hesper Drift');
  await expect(list.getByRole('link', { name: 'Systems' })).toHaveAttribute('aria-current', 'page');
  await list.locator('#systemList').getByText('Ekwa Nexus').click();
  await expect(details).toContainText('Ekwa Nexus');
  await page.goto('./#systems');
  await expect(page.locator('#panePlaceholder')).toBeVisible();
  await expect(details).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a moon tied to its planet circles it in the diorama and names it on its own view', async ({ page }) => {
  await page.goto('./#system/sys-hesper');
  await expect(page.locator('#sec-system svg[role="img"]').first()).toHaveAttribute(
    'aria-label',
    /Hesper Minor is a moon of Storm Rock/
  );
  await page.goto('./#planet/sys-hesper/pl-moon');
  await expect(page.locator('#planetTitle')).toHaveText('Hesper Minor');
  await page.locator('#sec-planet').getByRole('link', { name: 'Storm Rock' }).click();
  await expect(page).toHaveURL(/#planet\/sys-hesper\/pl-storm$/);
});
