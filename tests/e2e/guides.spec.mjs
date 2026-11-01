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
  await page.locator('#sec-book1').getByRole('button', { name: 'Back' }).click();
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
