import AxeBuilder from '@axe-core/playwright';
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

test('d04, d05: the Map on the Workbench at 1024, 1440 and 1920 has no text out of its box and passes axe', async ({
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
    for (const hash of ['./#map', './#map/Euclid']) {
      await page.goto(hash);
      await expect(page.locator('#mapChain, #mapGalaxy').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const spills = await page.evaluate(() =>
        [...document.querySelectorAll('#sec-map *')]
          .filter(el => el instanceof HTMLElement && el.offsetParent && el.scrollWidth > el.clientWidth + 1)
          .filter(el => !['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX))
          .map(el => el.outerHTML.slice(0, 120))
      );
      expect(spills).toEqual([]);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
  }
});
