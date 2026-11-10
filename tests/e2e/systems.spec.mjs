import AxeBuilder from '@axe-core/playwright';
import { test, expect, storedState, logLink } from './fixtures.mjs';

// Round 8 (c21): Filters opens the same groups everywhere, a sheet on a phone and a popover on the Workbench; they
// apply as you tap, and Esc closes either.
const openFilters = async page => {
  await page
    .locator('#sec-systems')
    .getByRole('button', { name: /^Filters/ })
    .click();
  return page.getByRole('dialog', { name: 'Filters' });
};

test('adds a system with glyphs and a tag, logging the arrival', async ({ page }) => {
  await page.goto('./#systems');
  await page.locator('#sec-systems').getByRole('button', { name: 'Log system' }).click();
  await page.locator('#sysName').fill('Test Prime');
  await page.locator('#systemEditor').getByRole('radio', { name: 'Written down' }).click();
  await page.locator('#sysAddress').fill('1a2b3c4d5e6f');
  await page.locator('#tagInput').fill('mining');
  await page.locator('#tagInput').press('Enter');
  await page.locator('#systemEditor button[type="submit"]').click();

  await expect(page.locator('#systemList')).toContainText('Test Prime');
  const system = (await storedState(page)).systems.find(item => item.name === 'Test Prime');
  expect(system.glyphs).toBe('1A2B3C4D5E6F');
  expect(system.tags).toContain('mining');
  expect(system.visits).toHaveLength(1);
});

test('a system opens on its own screen; planets added there persist across a reload; Back returns', async ({
  page
}) => {
  await page.goto('./#systems');
  await page.locator('#systemList').getByText('Ekwa Nexus').click();
  await expect(page).toHaveURL(/#system\/sys-ekwa$/);
  await expect(page.locator('#systemTitle')).toHaveText('Ekwa Nexus');

  await page.getByRole('button', { name: /^Add body/ }).click();
  const sheet = page.locator('#planetSheet');
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Verdant IV');
  await sheet.getByRole('button', { name: 'Add body' }).click();
  await expect(sheet).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('heading', { name: 'Planets & moons · 1' })).toBeVisible();
  // From lg a row opens the planet panel beside System detail (37); on a phone, the planet's own view (36).
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await page.getByRole('link', { name: /^Verdant IV/ }).click();
    await expect(sheet).toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByRole('link', { name: /^Verdant IV/ })).toContainText('Editing');
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await page.goto(`./${await page.getByRole('link', { name: /^Verdant IV/ }).getAttribute('href')}`);
  } else await page.getByRole('link', { name: /^Verdant IV/ }).click();
  await expect(page).toHaveURL(/#planet\/sys-ekwa\/pl-/);
  await expect(page.locator('#planetTitle')).toHaveText('Verdant IV');
  await expect(page.locator('#sec-planet')).toContainText('Nothing scanned yet');
  // Back to the system: the Back button below lg, the breadcrumb from lg (d16).
  if ((page.viewportSize()?.width ?? 0) >= 1024)
    await page.getByRole('navigation', { name: 'Planet' }).getByRole('link', { name: 'Ekwa Nexus' }).click();
  else await page.locator('#sec-planet').getByRole('button', { name: 'Back to Ekwa Nexus' }).click();
  await expect(page).toHaveURL(/#system\/sys-ekwa$/);

  await page.reload(); // the address opens the same system
  await expect(page.locator('#systemTitle')).toHaveText('Ekwa Nexus');
  const system = (await storedState(page)).systems.find(item => item.id === 'sys-ekwa');
  expect(system.planets.map(planet => planet.name)).toEqual(['Verdant IV']);
  if ((page.viewportSize()?.width ?? 0) >= 1024) return; // from lg the list is beside it: no Back (d01)
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/#systems$/);
});

test('the Favourites filter shows only favourite systems', async ({ page }) => {
  await page.goto('./#systems');
  await page.locator('#systemList').getByText('Hesper Drift').click();
  const details = page.locator('#sec-system');
  await details.getByRole('button', { name: 'Favourite' }).click();
  await expect(details.getByRole('button', { name: 'Favourite' })).toHaveAttribute('aria-pressed', 'true');
  // Below lg the detail is its own screen; from lg the list is beside it, its chips behind Filters (d01).
  if (await details.getByRole('button', { name: 'Back' }).isVisible())
    await details.getByRole('button', { name: 'Back' }).click();
  await openFilters(page);
  await page.locator('#systemFavFilter').click();
  await expect(page.locator('#systemFavFilter')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#systemList')).toContainText('Hesper Drift');
  await expect(page.locator('#systemList')).not.toContainText('Ekwa Nexus');
});

test('filters by tag', async ({ page }) => {
  await page.goto('./#systems');
  const filters = await openFilters(page);
  await filters.getByRole('button', { name: /^trade-hub/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Remove filter: tag trade-hub' })).toBeVisible();
  await expect(page.locator('#systemList')).toContainText('Ekwa Nexus');
  await expect(page.locator('#systemList')).not.toContainText('Hesper Drift');
});

test('on a phone, dragging the sheet’s bar down closes it', async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone' || browserName !== 'chromium', 'touch drag on the phone sheet');
  await page.goto('./#systems');
  await page.locator('#systemList').getByText('Ekwa Nexus').click();
  await page.getByRole('button', { name: 'Edit system' }).click();
  const handle = page.locator('#systemPanel [data-sheet-handle]');
  await expect(handle).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toHaveCount(1); // the bar, no ✕
  // Measure once the sheet has finished sliding in (no transition left running): under a loaded machine the slide
  // runs long, and a box taken mid-slide puts the touch beside the bar.
  await expect.poll(() => page.locator('#systemPanel').evaluate(panel => panel.getAnimations().length)).toBe(0);
  const box = await handle.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [{ x, y }]);
  for (let step = 1; step <= 10; step++) await touch('touchMove', [{ x, y: y + step * 25 }]);
  await touch('touchEnd', []);
  await expect(page.locator('#systemPanel')).toHaveAttribute('aria-hidden', 'true');
});

test('from lg a system opens beside its list, marked there; a phone keeps one screen at a time', async ({
  page
}, testInfo) => {
  await page.goto('./#systems');
  const list = page.locator('#sec-systems');
  const details = page.locator('#sec-system');
  await list.locator('#systemList').getByText('Hesper Drift').click();
  await expect(details).toContainText('Hesper Drift');
  if (testInfo.project.name === 'phone') {
    await expect(list).toBeHidden();
    return;
  }
  await expect(list).toBeVisible();
  const listBox = await list.boundingBox();
  expect(listBox.x + listBox.width + 16).toBeLessThanOrEqual((await details.boundingBox()).x);
  await expect(list.locator('[aria-current="true"]')).toContainText('Hesper Drift');
  await expect(logLink(page, 'Systems')).toHaveAttribute('aria-current', 'page');
  await list.locator('#systemList').getByText('Ekwa Nexus').click();
  await expect(details).toContainText('Ekwa Nexus');
  await page.goto('./#systems');
  await expect(page.locator('#panePlaceholder')).toBeVisible();
  await expect(details).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a moon tied to its planet circles it in the diorama and names it on its own view', async ({ page }) => {
  await page.goto('./#system/sys-hesper');
  await expect(page.locator('#sec-system svg[role="img"]').first()).toHaveAttribute(
    'aria-label',
    /Hesper Minor is a moon of Storm Rock/
  );
  await page.goto('./#planet/sys-hesper/pl-moon');
  await expect(page.locator('#planetTitle')).toHaveText('Hesper Minor');
  await page.locator('#sec-planet').getByRole('link', { name: 'Storm Rock' }).click();
  await expect(page).toHaveURL(/#planet\/sys-hesper\/pl-storm$/);
});

test('a portal address from Photo Mode, by name: tapped in, read on System detail, dialled one glyph at a time', async ({
  page
}) => {
  await page.goto('./#system/sys-hesper');
  await page.locator('#sec-system').getByRole('button', { name: 'Add from Photo Mode' }).click();
  const pad = page.locator('#systemPanel').getByRole('group', { name: 'Glyphs' });
  for (const name of [
    'Face',
    'Bird',
    'Voxel',
    'Eclipse',
    'Atlas',
    'Sunset',
    'Diplo',
    'Voxel',
    'Sunset',
    'Tree',
    'Bird',
    'Sunset'
  ])
    await pad.getByRole('button', { name: new RegExp(`^Add ${name}\\b`) }).click();
  await expect(page.locator('#systemPanel').getByText(/A full address/)).toBeVisible();
  await page.locator('#systemPanel').getByRole('button', { name: 'Save changes' }).click();
  const system = (await storedState(page)).systems.find(item => item.id === 'sys-hesper');
  expect(system.glyphs).toBe('21A4F03A0E10');
  await expect(
    page.locator('#sec-system').getByText('Face, Bird, Voxel, Eclipse', { exact: false }).first()
  ).toBeAttached();
  await page.locator('#sec-system').getByRole('link', { name: 'Dial at a portal' }).click();
  await expect(page).toHaveURL(/#dial\/sys-hesper$/);
  await page.locator('#sec-dial').getByRole('button', { name: 'Next: Bird' }).click();
  await expect(page.locator('#sec-dial').getByRole('img', { name: 'Glyph 2 of 12' })).toBeVisible();
  await expect(page.locator('#tabBarRoot')).toBeHidden();
});

test('d01, d19, d20: the Systems workbench at 1024, 1440 and 1920 has no text out of its box and passes axe', async ({
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
    await page.goto('./#system/sys-hesper');
    const side = page.getByRole('complementary', { name: 'Address and journal' });
    await expect(side).toBeVisible();
    // The inspector sits beside the main column when the pane is wide enough (~900px), under it otherwise.
    const main = await page.locator('#sec-system h1').boundingBox();
    const aside = await side.boundingBox();
    if (width === 1024) expect(aside.y).toBeGreaterThan(main.y);
    else expect(aside.x).toBeGreaterThan(main.x + main.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Nothing spills out of its box sideways in either pane.
    const spills = await page.evaluate(() =>
      [...document.querySelectorAll('#sec-systems *, #sec-system *')]
        .filter(el => el instanceof HTMLElement && el.offsetParent && el.scrollWidth > el.clientWidth + 1)
        .filter(el => !['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX))
        .map(el => el.outerHTML.slice(0, 120))
    );
    expect(spills).toEqual([]);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});

test('d14: the system editor panel at 1024, 1440 and 1920 pairs its fields, keeps text in its boxes and passes axe', async ({
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
    await page.goto('./#system/sys-ekwa');
    await page.reload(); // the same hash doesn't reload, and the last width's editor would still be open
    await page.getByRole('button', { name: 'Edit system' }).click();
    await expect(page.locator('#systemPanel')).toBeInViewport({ ratio: 1 });
    // Measured together, once the panel has slid in: Name | Region and Race | Conflict share a row.
    const rows = await page.evaluate(() => {
      const box = el => el.getBoundingClientRect();
      const field = name =>
        [...document.querySelectorAll('#systemEditor label')].find(l => l.firstChild?.textContent?.trim() === name);
      // d14b, d14c: the conflict column (the map's word over its stars) sits beside Dominant race.
      const label = text =>
        [...document.querySelectorAll('#systemEditor p, #systemEditor label')].find(
          el => el.firstChild?.textContent?.trim() === text
        );
      return [
        [field('Name'), field('Region')],
        [label('Dominant race'), label('Conflict · the map’s word')]
      ]
        .map(([a, b]) => [box(a), box(b)])
        .map(([a, b]) => ({ sameRow: Math.abs(a.y - b.y) < 2, apart: b.x >= a.right }));
    });
    expect(rows).toEqual([
      { sameRow: true, apart: true },
      { sameRow: true, apart: true }
    ]);
    const spills = await page.evaluate(() =>
      [...document.querySelectorAll('#systemEditor *')]
        .filter(el => el instanceof HTMLElement && el.offsetParent && el.scrollWidth > el.clientWidth + 1)
        .filter(el => !['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX))
        .map(el => el.outerHTML.slice(0, 120))
    );
    expect(spills).toEqual([]);
    const { violations } = await new AxeBuilder({ page }).include('#systemPanel').analyze();
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});

test('d19: the orbit band draws when a system opens after coming from another screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the band is the Workbench’s');
  await page.goto('./#home');
  await page
    .getByRole('link', { name: /^Systems/ })
    .first()
    .click();
  await page
    .locator('#systemList')
    .getByRole('button', { name: /Hesper Drift/ })
    .click();
  const band = page.getByRole('region', { name: 'Orbit diagram' });
  await expect(band.locator('svg').first()).toBeVisible();
});
