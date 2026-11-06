import AxeBuilder from '@axe-core/playwright';
import { test, expect, storedState, expectNoHorizontalOverflow, holdToStartSession } from './fixtures.mjs';

test('Home shows the current system, its orbits and the warp-back list', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#homeNow')).toContainText('Ekwa Nexus');
  await expect(page.locator('#homeNow')).toContainText('S-class hauler spawns here');
  await expect(page.locator('#homeNow').getByRole('img', { name: /^Ekwa Nexus: a .* star/ })).toBeVisible();
  await expect(page.locator('#homeRecent')).toContainText('Hesper Drift');
});

test('a tap on Start session does nothing; holding it starts one', async ({ page }) => {
  await page.goto('./');
  await page.locator('#startSession').click();
  await expect(page.locator('#sessionBar')).toBeHidden();
  await holdToStartSession(page);
  await expect(page.getByRole('button', { name: /^Session live/ })).toBeVisible();
  expect((await storedState(page)).session).not.toBeNull();
});

test('on a phone, Home has its own header with Settings, and the app header steps aside there and in Settings', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'from lg the sidebar and app header carry them');
  await page.goto('./');
  await expect(page.locator('#headerRoot')).toBeHidden();
  await page.locator('#sec-home').getByRole('link', { name: 'Settings' }).click();
  await expect(page.locator('#sec-more h1')).toHaveText('Settings');
  await expect(page.locator('#headerRoot')).toBeHidden(); // Settings has its own back bar
  await page.locator('#sec-more').getByRole('button', { name: 'Back to Home' }).click();
  await expect(page.locator('#sec-home')).toBeVisible();
});

test('Log visit records a visit on the current system', async ({ page }) => {
  await page.goto('./');
  await page.locator('#homeNow').getByRole('button', { name: 'Log visit' }).click();
  await expect(page.locator('#toastMessage')).toHaveText('Logged a visit to Ekwa Nexus.');
  const state = await storedState(page);
  expect(state.systems.find(system => system.id === 'sys-ekwa').visits).toHaveLength(2);
});

test('"I’m here" makes a recent system the current one', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'I’m here: Hesper Drift' }).click();
  await expect(page.locator('#homeNow')).toContainText('Hesper Drift');
});

test('the #new-system shortcut opens the Add system editor', async ({ page }) => {
  await page.goto('./#new-system');
  await expect(page.locator('#systemPanel')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#systemPanelTitle')).toHaveText('Add system');
  await expect(page).toHaveURL(/#home$/);
});

test('no section scrolls sideways', async ({ page }) => {
  for (const section of [
    'home',
    'systems',
    'map',
    'runs',
    'outlaw',
    'calculators',
    'guides',
    'more',
    'gear',
    'notes',
    'book1',
    'book2',
    'book3',
    'book4',
    'book5',
    'book6',
    'system/sys-ekwa',
    'ship/gear-kestrel',
    'session'
  ]) {
    await page.goto(`./#${section}`);
    await expect(page.locator(`#sec-${section.split('/')[0]}`)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test.describe('a new visitor', () => {
  test.use({ seed: null }); // nothing in this browser: the starter log, which is empty

  test('meets the first run: the empty atlas, the ways in, and pairing', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#sec-home h1')).toHaveText('Your atlas is empty');
    const { violations } = await new AxeBuilder({ page }).include('#sec-home').analyze();
    expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);
    await page.getByRole('button', { name: /Add your ship/ }).click();
    await expect(page.locator('#gearEditor')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: /Pair it/ }).click();
    await expect(page.locator('#sec-more')).toBeVisible(); // Settings, with the Sync sheet up
    await expect(page.getByRole('dialog', { name: 'Sync' })).toBeVisible();
  });
});

test('d03: Home on the Workbench at 1024, 1440 and 1920 has no text out of its box and passes axe', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sets its own widths');
  test.setTimeout(90_000);
  for (const [width, height] of [
    [1024, 768],
    [1440, 900],
    [1920, 1080]
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('./#home');
    await expect(page.getByRole('region', { name: /^Timers/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Last 7 days' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const spills = await page.evaluate(() =>
      [...document.querySelectorAll('#sec-home *')]
        .filter(el => el instanceof HTMLElement && el.offsetParent && el.scrollWidth > el.clientWidth + 1)
        .filter(el => !['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX))
        .map(el => el.outerHTML.slice(0, 120))
    );
    expect(spills).toEqual([]);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});
