import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.mjs';

// The planner's Gather step: one row per raw material, with its total.
const rawMaterials = page =>
  page
    .locator('#planCargo [data-raw]')
    .evaluateAll(tiles => Object.fromEntries(tiles.map(tile => [tile.dataset.raw, Number(tile.dataset.qty)])));

test('the Stasis Device plan matches the wiki’s totals', async ({ page }) => {
  await page.goto('./#plan/Stasis%20Device');
  await expect(page.locator('#planCargo [data-raw]').first()).toBeVisible();
  expect(await rawMaterials(page)).toEqual({
    Radon: 500,
    Sulphurine: 500,
    Nitrogen: 500,
    'Gamma Root': 400,
    'Frost Crystal': 300,
    'Condensed Carbon': 300,
    Solanium: 200,
    'Star Bulb': 200,
    'Ionised Cobalt': 150,
    'Cactus Flesh': 100,
    Faecium: 50,
    Paraffinium: 50,
    Phosphorus: 50,
    Dioxite: 50
  });
  await expect(page.locator('#planWorth')).toHaveText('15,600,000');
});

test('switching an alternative recipe in the Codex peek changes the plan', async ({ page }) => {
  await page.goto('./#plan/Anomalous%20Doughnut');
  await expect(page.locator('#planCargo [data-raw="Grahberry"]')).toBeVisible();
  expect(await rawMaterials(page)).toMatchObject({ 'Fresh Milk': 2, Grahberry: 2 });
  await page.getByRole('button', { name: /^Clarified Oil.*: open in Codex/ }).click();
  await page
    .locator('#codexPeek')
    .getByRole('button', { name: /^Recipe 1 of/ })
    .click();
  expect(await rawMaterials(page)).toMatchObject({ 'Fresh Milk': 1, 'Warm Proto-Milk': 1 });
});

test('the peek leads with the wiki’s Source section and opens the Codex', async ({ page }) => {
  await page.goto('./#plan/Stasis%20Device');
  await page.getByRole('button', { name: 'Frost Crystal: open in Codex' }).click();
  const peek = page.locator('#codexPeek');
  await expect(peek.locator('#peekSource')).toContainText('Refine');
  await expect(peek.locator('#peekSource')).toContainText('Dioxite');
  await expect(peek).toContainText('This plan needs');
  await peek.getByRole('link', { name: 'Open in Codex' }).click();
  await expect(page.locator('#articleHeader h1')).toHaveText('Frost Crystal');
});

test('ticks move the path on and survive a reload', async ({ page }) => {
  await page.goto('./#plan/Stasis%20Device');
  await expect(page.locator('#planPath [data-step="gather"]')).toHaveAttribute('aria-current', 'step');
  for (const box of await page.locator('#planCargo input[type="checkbox"]').all()) await box.check();
  await expect(page.locator('#planPath [data-step="gather"]')).toContainText('14 / 14');
  await expect(page.locator('#planPath [data-step="round"]').first()).toHaveAttribute('aria-current', 'step');
  await page.reload();
  await expect(page.locator('#planPath [data-step="gather"]')).toContainText('14 / 14');
  await page.getByRole('button', { name: 'One more' }).click();
  await expect(page.locator('#planPath [data-step="gather"]')).toContainText('0 / 14'); // double the need: not gathered
});

test('base value and extractor yield use wiki values', async ({ page }) => {
  await page.goto('./#calculators');
  await page.getByRole('tab', { name: 'Base value' }).click();
  await expect(page.locator('#valueTotal')).toHaveText('Total: 53,900 Units');
  await page.getByRole('tab', { name: 'Extractors' }).click();
  await page.locator('#mineCount').fill('4');
  await page.locator('#mineRate').fill('250');
  await expect(page.locator('#mineResult')).toContainText('1,000 Gold per hour, worth 353,000 Units');
});

test('Best crafts ranks the real mirror and opens a pick in the planner', async ({ page }) => {
  await page.goto('./#calculators');
  await page
    .locator('main')
    .getByRole('link', { name: /Best crafts/ })
    .click();
  await expect(page).toHaveURL(/#crafts$/);
  const rows = page.locator('#craftList [data-craft]');
  await expect(rows.first()).toHaveAttribute('data-craft', /^(Stasis Device|Fusion Ignitor)$/);
  await expect(page.locator('#craftTop')).toContainText(/Stasis Device|Fusion Ignitor/);
  await expect(rows).toHaveCount(15);
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(rows).toHaveCount(30);
  await page.getByRole('button', { name: 'No farming' }).click();
  await expect(rows.first()).not.toHaveAttribute('data-craft', 'Stasis Device');
  await page.getByRole('button', { name: 'No farming' }).click();
  await page.locator('#craftList [data-craft="Quantum Processor"] a').click();
  await expect(page).toHaveURL(/#plan\/Quantum%20Processor$/);
  await expect(page.locator('#planTitle')).toHaveText('Quantum Processor');
  // Back: the planner's own on a phone; the Workbench's board has none, so the browser's.
  const back = page.locator('#sec-plan').getByRole('button', { name: 'Back' });
  if (await back.isVisible()) await back.click();
  else await page.goBack();
  await expect(page).toHaveURL(/#crafts$/);
  await page.locator('#sec-crafts').getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('#calcPlanSummary')).toContainText('Quantum Processor');
});

test('Harmonic Camp registers evaluate the expressions', async ({ page }) => {
  await page.goto('./#calculators');
  await page.getByRole('tab', { name: 'Registers' }).click();
  await expect(page.locator('#calcAns3')).toHaveText('16');
  await page.locator('#calcReg1').fill('3 * 3');
  await expect(page.locator('#calcAns1')).toHaveText('9');
});

test('the dock keeps the chosen tool while the app is open', async ({ page }) => {
  await page.goto('./#calculators');
  await expect(page.getByRole('tab', { name: 'Base value' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#calcPlanSummary')).toContainText('Stasis Device');
  await page.getByRole('tab', { name: 'Registers' }).click();
  await page.locator('#calcReg1').fill('3 * 3');
  await page.evaluate(() => {
    location.hash = '#systems';
  });
  await expect(page.locator('#sec-systems')).toBeVisible();
  await page.evaluate(() => {
    location.hash = '#calculators';
  });
  await expect(page.locator('#calcAns1')).toHaveText('9');
  await expect(page.locator('#valueTotal')).toBeHidden();
});

test('d11: the Recipe planner on the Workbench at 1024, 1440 and 1920 has no text out of its box and passes axe', async ({
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
    await page.goto('./#plan/Stasis%20Device');
    await expect(page.locator('#planCargo [data-raw]').first()).toBeVisible();
    await expect(page.locator('#codexPeek #peekSource')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const spills = await page.evaluate(() =>
      [...document.querySelectorAll('#sec-plan *')]
        .filter(el => el instanceof HTMLElement && el.offsetParent && el.scrollWidth > el.clientWidth + 1)
        .filter(el => !['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX))
        .map(el => el.outerHTML.slice(0, 120))
    );
    expect(spills).toEqual([]);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});
