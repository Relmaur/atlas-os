import { test, expect } from './fixtures.mjs';

test('on a phone, the search opens full screen, finds a system and opens it', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'phone',
    'the phone opens search from the search key; desktop types in the header'
  );
  await page.goto('./');
  await page.getByRole('button', { name: 'Search and quick actions' }).click();
  const input = page.locator('#globalSearchInput');
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  // Empty, it offers the quick actions; the key stays lit above them, and a tab leaves the search.
  await expect(page.locator('#searchQuick')).toContainText('Start a timer');
  const key = page.getByRole('button', { name: 'Search and quick actions' });
  await expect(key).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#tabBar [data-tab="log"]').click();
  await expect(input).toBeHidden();
  await expect(key).toHaveAttribute('aria-expanded', 'false');
  await key.click();
  await input.fill('ekwa');
  await expect(page.getByRole('button', { name: 'Systems · 1' })).toBeVisible();
  await page
    .locator('#globalSearchResults')
    .getByRole('option', { name: /Ekwa Nexus/ })
    .click();
  await expect(page).toHaveURL(/#system\/sys-ekwa$/);
  await expect(page.locator('#systemTitle')).toHaveText('Ekwa Nexus');
  await expect(input).toBeHidden();
});

test('/ starts a search, and Escape leaves it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'no hardware keyboard on the phone run');
  await page.goto('./#outlaw');
  await page.keyboard.press('/');
  await expect(page.locator('#globalSearchInput')).toBeFocused();
  await page.keyboard.type('hesper');
  await expect(page.locator('#globalSearchResults')).toContainText('Hesper Drift');
  await page.keyboard.press('Escape');
  await expect(page.locator('#globalSearchResults')).toBeHidden();
});

test('the tab bar lights Runs for ready outlaw stations and marks where you are', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the tab bar shows below lg');
  await page.goto('./#guides');
  await expect(page.locator('#tabBar [data-tab="runs"]')).toContainText('1 station ready');
  await expect(page.locator('#tabBar [data-tab="runs"] .tab-live')).toBeVisible();
  await expect(page.locator('#tabBar [data-tab="codex"]')).toHaveAttribute('aria-current', 'page');
  // Fleet and Notes sit behind Log's segmented control; Settings behind the gear in Home's header.
  await page.locator('#tabBar [data-tab="log"]').click();
  await page.getByRole('navigation', { name: 'Log sections' }).getByRole('link', { name: 'Fleet' }).click();
  await expect(page).toHaveURL(/#gear$/);
  await expect(page.locator('#tabBar [data-tab="log"]')).toHaveAttribute('aria-current', 'page');
  await page.locator('#tabBar [data-tab="home"]').click(); // on a phone, Settings is in Home's header
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.locator('#sec-more')).toBeVisible();
  await expect(page.locator('#tabBar [data-tab="home"]')).toHaveAttribute('aria-current', 'page');
});

test('the tab bar sits inside the screen, with every label at the same height', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the tab bar shows below lg');
  await page.goto('./');
  const width = page.viewportSize()?.width ?? 0;
  const bar = await page.locator('#tabBar').boundingBox();
  const key = await page.getByRole('button', { name: 'Search and quick actions' }).boundingBox();
  expect(bar?.height).toBe(64);
  expect(bar?.x).toBe(16);
  expect(key?.width).toBe(64);
  expect(Math.round((key?.x ?? 0) + (key?.width ?? 0))).toBe(width - 16);
  const labelTops = await page
    .locator('#tabBar .tab-item > span:not(.tab-icon):not(.sr-only)')
    .evaluateAll(labels => labels.map(label => Math.round(label.getBoundingClientRect().top)));
  expect(new Set(labelTops).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the Codex page's search key opens the app's search", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the tab bar shows below lg');
  await page.goto('./wiki/');
  await page.getByRole('link', { name: 'Search and quick actions' }).click();
  await expect(page).toHaveURL(/#home$/);
  await expect(page.locator('#globalSearchInput')).toBeVisible();
});

test('old and shortcut addresses still land', async ({ page }) => {
  await page.goto('./#logbook');
  await expect(page.locator('#sec-systems')).toBeVisible();
  await expect(page).toHaveURL(/#systems$/);
  await page.goto('./#nowhere');
  await expect(page.locator('#sec-home')).toBeVisible();
});

test('the shell at each width: the pill below lg, centred from 768; the rail from 1024, with search beside it', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sets its own widths');
  const rail = page.getByRole('navigation', { name: 'Primary' });
  const key = page.getByRole('button', { name: 'Search and quick actions' });
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('./');
  await expect(page.locator('#tabBar')).toBeVisible();
  const pill = await page.locator('#tabBar').boundingBox();
  const keyBox = await key.boundingBox();
  expect(pill.x).toBeCloseTo(768 / 2 - 320, 0);
  expect(keyBox.x + keyBox.width).toBeCloseTo(768 / 2 + 320, 0);
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('#tabBar')).toBeHidden();
    await expect(rail.getByRole('link', { name: 'Settings' })).toBeVisible();
    expect((await page.locator('#sidebarNav').boundingBox()).width).toBe(88);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await key.click();
  const field = page.locator('#globalSearchInput');
  await expect(field).toBeFocused();
  expect((await field.boundingBox()).x).toBeGreaterThan(88);
  await page.locator('.app-main').click({ position: { x: 900, y: 500 }, force: true });
  await expect(field).toBeHidden();
});

test('keyboard shortcuts: g then a letter, and n in Log, and they are listed in Settings', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'no hardware keyboard on the phone run');
  await page.goto('./');
  await page.keyboard.press('g');
  await page.keyboard.press('l');
  await expect(page.locator('#sec-systems')).toBeVisible();
  await page.keyboard.press('n');
  await expect(page).toHaveURL(/#note\//);
  await page.goto('./#more');
  await expect(page.getByRole('region', { name: 'Keyboard' })).toContainText('Go to Runs');
});

test('a panel closes by a drag on its bar past the threshold, and springs back short of it', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'panels are from lg');
  await page.goto('./#session');
  await page
    .locator('#sec-session')
    .getByRole('button', { name: /Refiner/ })
    .first()
    .click();
  const sheet = page.locator('#timerSheet');
  await expect(sheet).toHaveAttribute('aria-hidden', 'false');
  await expect.poll(() => sheet.evaluate(panel => panel.getAnimations().length)).toBe(0);
  const bar = sheet.getByRole('button', { name: 'Close timer' }).locator('visible=true');
  const box = await bar.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, y);
  await page.mouse.up();
  await expect(sheet).toHaveAttribute('aria-hidden', 'false');
  await expect.poll(() => sheet.evaluate(panel => panel.getAnimations().length)).toBe(0); // it has sprung back
  await page.mouse.move(box.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, y);
  await page.mouse.up();
  await expect(sheet).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('link', { name: /^Runs/ })).toHaveAttribute('title', 'Runs (g then r)');
});
