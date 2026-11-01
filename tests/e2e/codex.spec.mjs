import { test, expect } from './fixtures.mjs';

test('the Codex landing shows the verification result and all categories', async ({ page }) => {
  await page.goto('./wiki/');
  // verification.json only exists after a sync or verify, so either state is valid here.
  await expect(page.locator('#codexCheck')).toContainText(
    /Matches the wiki|Wiki copy from .* pages match it|Not verified on this copy|behind the wiki|couldn’t be reached/
  );
  await expect(page.locator('#browseBody a[data-group]')).toHaveCount(13);
  await expect(page.locator('#browseBody a[data-group]', { hasText: 'Mechanics' })).toBeVisible();
  await expect(page.locator('#browseBody a[data-group]', { hasText: 'Lore' })).toBeVisible();
  await expect(page.locator('#browseBody a[data-group]', { hasText: 'Life and worlds' })).toBeVisible();
});

test('search finds Oxygen and the article cites its wiki revision', async ({ page }) => {
  await page.goto('./wiki/#/?q=oxygen');
  await expect(page.locator('#browseBody .result').first()).toContainText('Oxygen');
  await page.goto('./wiki/#/a/' + encodeURIComponent('wiki/resources/Oxygen.md'));
  await expect(page.locator('#articleHeader h1')).toHaveText('Oxygen');
  await expect(page.locator('#articleSource')).toContainText(/revision \d+/);
  await expect(page.locator('#articleRail')).toContainText('Used in');
  // Rendered as HTML, not shown as raw Markdown.
  await expect(page.locator('#articleBody h2', { hasText: 'Quick Facts' })).toBeVisible();
  await expect(page.locator('#articleBody')).not.toContainText('**');
});

test('obsolete pages appear only when asked for', async ({ page }) => {
  const count = async () => Number((await page.locator('#resultsHeader strong').innerText()).replace(/,/g, ''));
  await page.goto('./wiki/#/?q=blaze%20javelin');
  await expect(page.locator('#resultsHeader strong')).toBeVisible();
  const current = await count();
  await page.goto('./wiki/#/?q=blaze%20javelin&old=1');
  await expect.poll(count).toBeGreaterThan(current);
});

test('the main app’s search reaches wiki articles', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Search and quick actions' }).click();
  await page.locator('#globalSearchInput').fill('oxygen');
  await expect(page.locator('#globalSearchResults')).toContainText('Oxygen');
});

test('on a phone, On this page opens from the header; mid-scroll a bar names the section and finds in the page', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'below lg the index is a sheet; desktop has the rail');
  await page.goto('./wiki/#/a/' + encodeURIComponent('wiki/resources/Oxygen.md'));
  await page.locator('#articleHeader').getByRole('button', { name: 'On this page' }).click();
  const sheet = page.getByRole('dialog', { name: 'On this page' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('link', { name: /Used in/ }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('#rel-usedIn')).toBeInViewport();
  // Partway down, the bar takes the header's place: its pill reopens the sheet, and Find marks matches.
  const bar = page.locator('#articleBar');
  await expect(bar.getByRole('button', { name: /^On this page: / })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to top' })).toBeVisible();
  await bar.getByRole('button', { name: 'Find in page' }).click();
  await sheet.getByRole('searchbox', { name: 'Find in this article' }).fill('oxygen');
  await expect(sheet.getByRole('status')).toContainText(/\d+ match/);
  await sheet.getByRole('button', { name: 'Show the first' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('#articleBody mark.is-current')).toBeInViewport();
  await page.getByRole('button', { name: 'Back to top' }).click();
  await expect(page.locator('#articleHeader h1')).toBeInViewport();
});

test('On this page marks the section it jumped to, even the last ones', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the rail is desktop’s; the sheet shares its tracking');
  await page.goto('./wiki/#/a/' + encodeURIComponent('wiki/resources/Oxygen.md'));
  const links = page.locator('#articleRail ol a');
  const middle = links.nth(2);
  await middle.click();
  await expect(middle).toHaveAttribute('aria-current', 'true');
  // Scrolling on from where the jump landed keeps it: the jump puts it on the reading line.
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 20);
  await expect(middle).toHaveAttribute('aria-current', 'true');
  const last = links.last();
  await last.click();
  await expect(last).toHaveAttribute('aria-current', 'true');
});

test('an article’s Pin to a note starts a note in the app that links it', async ({ page }) => {
  await page.goto('./wiki/#/a/' + encodeURIComponent('wiki/resources/Oxygen.md'));
  await page.getByRole('link', { name: 'Pin to a note' }).click();
  await expect(page).toHaveURL(/#note\/note-/);
  await expect(page.locator('#noteBody')).toHaveValue('[[Oxygen]]\n\n');
});

test('the quick look opens from results and closes with its bar on a phone', async ({ page }, testInfo) => {
  await page.goto('./wiki/#/?q=oxygen');
  await page.locator('#browseBody .result button').first().click();
  const panel = page.locator('#peekPanel');
  await expect(panel).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#peekTitle')).toHaveText('Oxygen');
  if (testInfo.project.name === 'phone') {
    await expect(page.getByRole('button', { name: 'Close quick look' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Close quick look' }).click();
  } else await page.keyboard.press('Escape');
  await expect(panel).toHaveAttribute('aria-hidden', 'true');
});

test('a new article saves as a draft and opens', async ({ page }) => {
  await page.goto('./wiki/');
  await page.getByRole('button', { name: /^(New article|Write an article)$/ }).click();
  await page.getByRole('textbox', { name: 'Article title' }).fill('Test Notes');
  await page.getByRole('textbox', { name: 'Article Markdown' }).fill('Links to [[Oxygen]].');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Save draft/ }).click();
  expect((await download).suggestedFilename()).toBe('Test_Notes.md');
  await expect(page.locator('#articleHeader h1')).toHaveText('Test Notes');
  await expect(page.locator('#articleBody [data-md] a', { hasText: 'Oxygen' })).toBeVisible();
});
