import AxeBuilder from '@axe-core/playwright';
import { test, expect, logLink, seedState, expectNoHorizontalOverflow } from './fixtures.mjs';

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

// Round 7 (c17): the owner's case, two systems logged in one region, plus one without an address.
const at = n => new Date(Date.UTC(2026, 9, 1) + n * 3_600_000).toISOString();
const sys = (n, fields) => ({ galaxy: 'Euclid', planets: [], visits: [], tags: [], createdAt: at(n), ...fields });
const hex = (n, d) => ((n + 0x4000) % 0x1000).toString(16).toUpperCase().padStart(d, '0');

test.describe('round 7: two systems in one region', () => {
  test.use({
    seed: {
      ...seedState(),
      systems: [
        sys(0, {
          id: 'm1',
          name: 'Masdalri Junction',
          glyphs: '10010C4BAB22',
          region: 'Aeushne Sector',
          star: 'yellow',
          tags: ['base']
        }),
        sys(1, { id: 'm2', name: 'Funjosm', glyphs: '20020C4BAB22', region: 'Aeushne Sector', star: 'yellow' }),
        sys(2, { id: 'm3', name: 'Dissonant System #1' })
      ]
    }
  });

  test('both are reachable on a 375px phone without zooming, and the region fans out when you go in', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'a phone');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('./#map/Euclid');
    const card = page.locator('#mapSystem');
    await expect(card.getByRole('heading', { name: 'Masdalri Junction' })).toBeVisible();
    await card.getByRole('button', { name: /Funjosm/ }).click();
    await expect(card.getByRole('heading', { name: 'Funjosm' })).toBeVisible();
    await expect(card).toContainText('4BA·B22');
    await expect(page.getByText(/1 more system has no portal address/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    // A tap on the stack's pin goes in: the breadcrumb ends at the region, and the core chip keeps the way home.
    await page.locator('#mapGalaxy [data-pin]').first().click();
    const crumbs = page.getByRole('navigation', { name: 'Zoom level' });
    await expect(crumbs.getByRole('button', { name: '4BA·B22' })).toHaveAttribute('aria-current', 'location');
    await expect(page.getByRole('button', { name: /^Centre the core/ })).toBeVisible();
    await page.getByRole('button', { name: 'Whole galaxy (zoom out)' }).click();
    await expect(crumbs.getByRole('button', { name: 'Euclid' })).toHaveAttribute('aria-current', 'location');
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });

  test('with reduced motion a zoom still lands, as a fade', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./#map/Euclid');
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
    await expect(page.locator('#mapGalaxy .map-fade')).toHaveCount(1);
  });
});

test.describe('round 7: nothing placed', () => {
  test.use({
    seed: {
      ...seedState(),
      systems: [sys(0, { id: 'a', name: 'Masdalri Junction' }), sys(1, { id: 'b', name: 'Funjosm' })]
    }
  });
  test('31i: every system is listed with a way to add its address', async ({ page }) => {
    await page.goto('./#map/Euclid');
    await expect(page.getByRole('heading', { name: 'Nothing to place yet' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'In Euclid · 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Add an address to Funjosm' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('round 7: 300 systems', () => {
  const centres = [0x100, 0x500, 0x900];
  test.use({
    seed: {
      ...seedState(),
      systems: Array.from({ length: 300 }, (_, n) =>
        sys(n, {
          id: `s${String(n)}`,
          name: `System ${String(n + 1)}`,
          glyphs: `1${hex(n + 1, 3)}00200${hex(centres[Math.floor(n / 100)] + (n % 100), 3)}`,
          region: ['Aeushne Sector', 'Oshaun Sector', 'Teleki Drift'][Math.floor(n / 100)]
        })
      )
    }
  });
  test('31h / d05c: pins per cluster, a capped list that keeps the selection, no sideways scroll, axe', async ({
    page
  }) => {
    await page.goto('./#map/Euclid');
    await expect(page.locator('#mapSystem').getByRole('heading', { name: 'System 300' })).toBeVisible();
    await expect(page.locator('#mapGalaxy [data-pin]')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /System 300/, pressed: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show all 100 in Teleki Drift' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
});
