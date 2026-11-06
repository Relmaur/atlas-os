import { test, expect, logLink } from './fixtures.mjs';

test('the Map: the galaxy chain, then one galaxy with a system at its true place', async ({ page }) => {
  await page.goto('./#systems');
  await logLink(page, 'Map').click();
  await expect(page).toHaveURL(/#map$/);
  await expect(page.locator('#mapSummary')).toContainText('1 system · 1 galaxy · 2 more without an address');
  await expect(
    page.getByRole('group', { name: /Galaxy chain: Euclid; next: Hilbert Dimension, Calypso/ })
  ).toBeVisible();
  await expect(page.locator('#mapChain').getByRole('link', { name: 'Open Euclid' })).toBeVisible();
  const list = page.locator('#mapGalaxies');
  await expect(list).toContainText('You are here');
  await expect(list).toContainText('Reach the centre of Euclid to cross');

  await list.getByRole('link', { name: /Euclid/ }).click();
  await expect(page).toHaveURL(/#map\/Euclid$/);
  // Ekwa Nexus is the base: selected first, with its distance from the centre by the wiki's 400 ly per region.
  const card = page.locator('#mapSystem');
  await expect(card).toContainText('Ekwa Nexus');
  await expect(card).toContainText('927k ly');
  await expect(card).toContainText('678·9AB');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  await card.getByRole('button', { name: 'Open' }).click();
  await expect(page).toHaveURL(/#system\/sys-ekwa$/);
});
