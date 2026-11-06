import AxeBuilder from '@axe-core/playwright';
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

test('the shell at each width: the pill below lg, centred from 768; from 1024 the floating nav, command bar and panes', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sets its own widths');
  const nav = page.getByRole('navigation', { name: 'Primary' }).locator('visible=true');
  const key = page.getByRole('button', { name: /^Search and quick actions/ }).locator('visible=true');
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('./');
  await expect(page.locator('#tabBar')).toBeVisible();
  await expect(page.locator('#commandBar')).toBeHidden();
  const pill = await page.locator('#tabBar').boundingBox();
  const keyBox = await key.boundingBox();
  expect(pill.x).toBeCloseTo(768 / 2 - 320, 0);
  expect(keyBox.x + keyBox.width).toBeCloseTo(768 / 2 + 320, 0);
  for (const width of [1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('#tabBar')).toBeHidden();
    await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible();
    // Everything floats 20px from the edges, 16px apart: the 56px rail, then the bar and the content beside it.
    const rail = await nav.boundingBox();
    expect([rail.x, rail.y, rail.width]).toEqual([20, 20, 56]);
    const bar = await page.locator('#commandBar').boundingBox();
    expect([bar.x, bar.y, bar.height, bar.x + bar.width]).toEqual([92, 20, 56, width - 20]);
    const main = await page.locator('main').boundingBox();
    expect([main.x, main.y]).toEqual([92, 92]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  // The sidebar opens with Ctrl+\, pushes the content, and is still open after a reload.
  await page.keyboard.press('Control+\\');
  await expect.poll(async () => (await nav.boundingBox()).width).toBe(252);
  expect((await page.locator('main').boundingBox()).x).toBe(288);
  await page.reload();
  await expect.poll(async () => (await nav.boundingBox()).width).toBe(252);
  await nav.getByRole('button', { name: /^Close the sidebar/ }).click();
  await expect.poll(async () => (await nav.boundingBox()).width).toBe(56);
  // Ctrl K: the search as a 720px palette in the middle; a click outside closes it.
  await page.keyboard.press('Control+k');
  const field = page.locator('#globalSearchInput');
  await expect(field).toBeFocused();
  const palette = await page.locator('#globalSearch').boundingBox();
  expect(palette.width).toBe(720);
  expect(palette.x + palette.width / 2).toBeCloseTo(1920 / 2, 0);
  await page.mouse.click(1800, 850);
  await expect(field).toBeHidden();
});

test('axe on the shell at 1024, 1440 and 1920: the rail, the open sidebar and the palette', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sets its own widths');
  test.setTimeout(90_000); // nine axe runs
  const axe = async () => {
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  };
  for (const width of [1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width === 1024 ? 768 : 900 });
    await page.goto('./#systems');
    await expect(page.locator('#commandBar')).toBeVisible();
    await axe();
    await page.keyboard.press('Control+\\');
    await expect(page.getByRole('button', { name: /^Close the sidebar/ })).toBeVisible();
    await axe();
    await page.keyboard.press('Control+\\');
    await page.keyboard.press('Control+k');
    await expect(page.locator('#globalSearchInput')).toBeFocused();
    await axe();
    await page.keyboard.press('Escape');
  }
});

test('keyboard shortcuts: g then a letter, and n in Log, and they are listed in Settings', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'no hardware keyboard on the phone run');
  await page.goto('./');
  await page.keyboard.press('g');
  await page.keyboard.press('l');
  await expect(page.locator('#sec-systems')).toBeVisible();
  // n logs a system in Systems ("Log system  N", d01), and starts a note elsewhere in Log.
  await page.keyboard.press('n');
  await expect(page.locator('#systemPanel')).toHaveAttribute('aria-hidden', 'false');
  await page.keyboard.press('Escape');
  await page.goto('./#notes');
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
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /^Runs/ })).toBeVisible();
});
