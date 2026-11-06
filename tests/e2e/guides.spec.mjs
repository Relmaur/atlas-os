import AxeBuilder from '@axe-core/playwright';
import { test, expect, storedState } from './fixtures.mjs';

test('a checklist step ticks from the keyboard, counts in Guides and survives a reload', async ({ page }) => {
  await page.goto('./#book1');
  const step = page.getByRole('checkbox', { name: /Capital Freighter Claimed/ });
  await step.focus();
  await page.keyboard.press('Space');
  await expect(step).toBeChecked();
  expect((await storedState(page)).checklists.capitalFreighterClaimed).toBe(true);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Capital Freighter Claimed/ })).toBeChecked();
  // Back to Guides: the book's own button on a phone; from lg the list is beside the book, and the nav opens Guides.
  const back = page.locator('#sec-book1').getByRole('button', { name: 'Back' });
  if (await back.isVisible()) await back.click();
  else await page.locator('.workbench-nav a[href="#guides"]').click();
  await expect(page).toHaveURL(/#guides$/);
  await expect(page.locator('#guidesList')).toContainText('Cross-Save & First Hours');
  await expect(page.locator('#guidesProgressText')).toContainText('1 / 35');
  // The next milestone opens its book.
  await expect(page.locator('#guidesNext')).toContainText('Cross-Save Linked');
  await page.locator('#guidesNext').click();
  await expect(page.locator('#sec-book1')).toBeVisible();
});

test('the book pager walks to the next book', async ({ page }) => {
  await page.goto('./#book3');
  await page
    .locator('#sec-book3')
    .getByRole('navigation', { name: 'More guides' })
    .getByRole('link', { name: /Book IV/ })
    .click();
  await expect(page.locator('#sec-book4')).toBeVisible();
  await expect(page.locator('#sec-book4 h1')).toContainText('Self-Sufficient');
});

test('search finds text in a book and scrolls to it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Search and quick actions' }).click();
  await page.locator('#globalSearchInput').fill('Golden Triangle');
  const hit = page.locator('#globalSearchResults .search-hit').filter({ hasText: 'Self-Sufficient' }).first();
  await hit.click();
  await expect(page.locator('#sec-book4')).toBeVisible();
  const flashed = page.locator('#sec-book4 .search-flash');
  await expect(flashed).toContainText('Golden Triangle');
  await expect(flashed).toBeInViewport(); // scrolled to, not left at the top of the book
});

test('d12: Guides on the Workbench at 1024, 1440 and 1920 has no text out of its box and passes axe', async ({
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
    await page.goto('./#book3');
    await expect(page.locator('#sec-book3 h1')).toBeVisible();
    await expect(page.locator('#guidesList [aria-current="page"]')).toContainText('Ship & Multi-Tool Meta');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const spills = await page.evaluate(() =>
      [...document.querySelectorAll('#sec-guides *, #sec-book3 *')]
        .filter(el => el instanceof HTMLElement && el.offsetParent && el.scrollWidth > el.clientWidth + 1)
        .filter(el => !['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX))
        .map(el => el.outerHTML.slice(0, 120))
    );
    expect(spills).toEqual([]);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});
