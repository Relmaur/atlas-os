// Round 8: the Systems filters (c21: a sheet on a phone, 640 wide at 768–1023, a popover on the Workbench), outlaw
// systems' crimson pill above the name, and conflict as the game shows it (c22), at 375, 768 and 1440.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, seedState, expectNoHorizontalOverflow } from './fixtures.mjs';

const at = n => new Date(Date.UTC(2026, 10, 1) + n * 3_600_000).toISOString();
const TAGS = [
  'base',
  'farming',
  'to-revisit',
  'outlaw',
  'harmonic-camp',
  'first-system',
  's-class-ship',
  'mining',
  'paradise',
  'gravitino-balls',
  'frost-crystal-farm',
  'ythgalls-home',
  'a-very-long-tag-the-player-typed-for-their-favourite-trading-post-near-the-core'
];
const systems = Array.from({ length: 14 }, (_, i) => ({
  id: `sys-${String(i)}`,
  name: `System ${String(i)}`,
  galaxy: 'Euclid',
  region: 'Oshaun Sector',
  glyphs: i % 4 === 3 ? '' : `${String(10 + i)}010C4BAB22`,
  star: ['yellow', 'red', 'green', 'blue'][i % 4],
  race: ['gek', 'korvax', 'vykeen'][i % 3],
  conflict: ['low', 'medium', 'high', ''][i % 4],
  conflictWord: ['Peaceful', 'Rowdy', '', ''][i % 4],
  favorite: i % 5 === 0,
  tags: [TAGS[i % TAGS.length], TAGS[(i + 3) % TAGS.length]],
  planets: [],
  createdAt: at(i),
  visits: [{ at: at(i) }]
}));
systems.push(
  {
    id: 'sys-kesh',
    name: 'Kesh Verge',
    galaxy: 'Euclid',
    region: 'Uthes Reach',
    glyphs: '',
    star: 'red',
    race: 'vykeen',
    conflict: 'pirate',
    conflictWord: 'Pirate Controlled',
    rating: 4,
    tags: ['outlaw', 'to-revisit'],
    planets: [],
    createdAt: at(20),
    visits: [{ at: at(20) }]
  },
  {
    id: 'sys-oddun',
    name: 'Oddun Shoal',
    galaxy: 'Euclid',
    glyphs: '30030C4BAB22',
    conflict: 'pirate',
    conflictWord: '',
    tags: [],
    planets: [],
    createdAt: at(21)
  }
);

test.use({ seed: { ...seedState(), systems } });

const axe = async (page, include) => {
  const { violations } = await new AxeBuilder({ page }).include(include).analyze();
  expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

// Every control a finger reaches: 44px, or a 36px chip whose hit area reaches 44 (c21).
const smallTargets = (page, selector) =>
  page.evaluate(sel => {
    const root = document.querySelector(sel);
    return [...(root?.querySelectorAll('button, input, [role="switch"], [role="radio"]') ?? [])]
      .filter(el => el instanceof HTMLElement && el.offsetParent)
      .map(el => {
        const box = el.getBoundingClientRect();
        const after = getComputedStyle(el, '::after');
        const reach =
          after.content !== 'none' && after.position === 'absolute'
            ? box.height - parseFloat(after.top || '0') - parseFloat(after.bottom || '0')
            : box.height;
        return { name: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30), reach };
      })
      .filter(({ reach }) => reach < 43.5);
  }, selector);

for (const width of [375, 768]) {
  test(`${String(width)}: Filters and Sort under search, the sheet with every group, chips that wrap`, async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'a phone and a small tablet');
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./#systems');
    const list = page.locator('#sec-systems');
    // 02h: the outlaw systems' pills above their names; never in the meta line.
    await expect(list.getByRole('button', { name: /^Kesh Verge ?, outlaw system/ })).toBeVisible();
    await expect(list.getByText('Pirate Controlled', { exact: true })).toBeVisible();
    await expect(list.getByText('Pirate (outlaw)', { exact: true })).toBeVisible();
    await expect(list.getByText('Medium conflict')).toHaveCount(0);
    expect(await smallTargets(page, '#systemFilterBar')).toEqual([]);

    await list.getByRole('button', { name: 'Filters' }).click();
    const sheet = page.getByRole('dialog', { name: 'Filters' });
    await expect(sheet).toBeInViewport();
    const box = await sheet.boundingBox();
    // 02i: 640 wide and centred from 768; the phone's full width below.
    expect(Math.round(box?.width ?? 0)).toBe(width >= 768 ? 640 : width);
    expect(Math.round((box?.x ?? 0) * 2 + (box?.width ?? 0))).toBe(width);
    for (const group of ['Star class', 'Race', 'Conflict'])
      await expect(sheet.getByRole('radiogroup', { name: group })).toBeVisible();
    await expect(sheet.getByRole('radio', { name: /^Pirate ?, outlaw, 2 systems$/ })).toBeVisible();
    // 13 tags: past 12 the field to find one and "Show all".
    await expect(sheet.getByRole('searchbox', { name: 'Find one of 13 tags' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Show all 13 tags' }).click();
    await expectNoHorizontalOverflow(page);
    expect(await smallTargets(page, '[role="dialog"][aria-modal="true"]')).toEqual([]);
    const sheetSpills = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      const right = dialog?.getBoundingClientRect().right ?? 0;
      return [...(dialog?.querySelectorAll('button') ?? [])]
        .filter(el => el.getBoundingClientRect().right > right + 0.5)
        .map(el => el.textContent);
    });
    expect(sheetSpills).toEqual([]); // a long tag ends in an ellipsis, never off the sheet
    await axe(page, '[role="dialog"][aria-modal="true"]');

    await sheet.getByRole('radio', { name: /^Yellow ?, / }).click();
    await sheet.getByRole('radio', { name: /^Medium ?, 2 of 3 stars/ }).click();
    await sheet.getByRole('button', { name: /^base ?, / }).click();
    await sheet.getByRole('switch', { name: /^Favourites/ }).click();
    await sheet.getByRole('button', { name: /^Show \d+ system/ }).click();
    await expect(sheet).not.toBeInViewport();
    await expect(list.getByRole('button', { name: /^Filters ?, 4 on$/ })).toBeFocused();
    await expect(list.getByRole('group', { name: 'Filters on' }).getByRole('button')).toHaveCount(4);
    await expectNoHorizontalOverflow(page);
    await axe(page, '#sec-systems');

    // 02d: Sort is a listbox; the keyboard reaches every option.
    await list.getByRole('button', { name: 'Sort: Last visited' }).click();
    await expect(page.getByRole('listbox', { name: 'Sort' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(list.getByRole('button', { name: 'Sort: Newest added' })).toBeFocused();
    await list.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect(list.getByRole('group', { name: 'Filters on' })).toHaveCount(0);
  });
}

test('1440: the funnel’s popover, chips under the field, the pirate pill in a row, conflict as stars', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the Workbench');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./#system/sys-1');
  const funnel = page.getByRole('button', { name: 'Filters', exact: true });
  await funnel.click();
  const popover = page.getByRole('dialog', { name: 'Filters' });
  await expect(popover).toBeVisible();
  expect(Math.round((await popover.boundingBox())?.width ?? 0)).toBe(420);
  await expect(popover).toBeInViewport({ ratio: 1 });
  await axe(page, '[role="dialog"]');
  await popover.getByRole('radio', { name: /^Pirate ?, outlaw/ }).click();
  await page.keyboard.press('Escape');
  await expect(funnel).toHaveCount(0); // its label now counts what's on
  await expect(page.getByRole('button', { name: 'Filters, 1 on' })).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: 'of 16 systems' })).toHaveText('2 of 16 systems');
  const rows = page.locator('#systemList');
  await expect(rows.getByRole('button', { name: /Kesh Verge ?, outlaw system/ })).toContainText('Pirate Controlled');
  await expect(rows.getByRole('button', { name: /Oddun Shoal ?, outlaw system/ })).toContainText('Pirate (outlaw)');
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();

  // The facts cell: race over the conflict, as the game shows it.
  await expect(page.getByTitle('Korvax · ★★ Rowdy', { exact: true })).toBeVisible();
  const spills = await page.evaluate(() =>
    [...document.querySelectorAll('main *')]
      .filter(el => el instanceof HTMLElement && el.offsetParent && el.scrollWidth > el.clientWidth + 1)
      .filter(el => !['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX))
      .map(el => el.outerHTML.slice(0, 120))
  );
  expect(spills).toEqual([]);
  await axe(page, 'main');

  // d14c: the level control in the editor, ★ · ★★ · ★★★ · skull, with Clear.
  await page.getByRole('button', { name: 'Edit system' }).click();
  const editor = page.locator('#systemEditor');
  await expect(editor.getByRole('radio', { name: 'Medium, 2 of 3' })).toHaveAttribute('aria-checked', 'true');
  await editor.getByRole('radio', { name: 'Pirate controlled, outlaw' }).click();
  await expect(editor.getByRole('radio', { name: 'Pirate controlled, outlaw' })).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await axe(page, '#systemEditor');
});
