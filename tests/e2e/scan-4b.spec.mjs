// Rounds 4b and 7c: more of the wiki in the scan (Infested worlds, Vile Brood, the conflict pair, No storms) and the
// not-mapped tags, on a 375px phone and the Workbench at 1024, 1440 and 1920, against the real wiki copy.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, seedState, expectNoHorizontalOverflow } from './fixtures.mjs';

const at = n => new Date(Date.UTC(2026, 10, 1) + n * 3_600_000).toISOString();
const sys = (n, fields) => ({
  galaxy: 'Euclid',
  planets: [],
  tags: [],
  createdAt: at(n),
  visits: [{ at: at(n) }],
  ...fields
});

test.use({
  seed: {
    ...seedState(),
    systems: [
      sys(2, {
        id: 'sys-lg',
        name: 'Laeinen Gate',
        glyphs: '10010C4BAB22',
        star: 'yellow',
        race: 'gek',
        conflict: 'medium',
        conflictWord: 'Rowdy',
        planets: [
          {
            id: 'pl-y',
            name: 'Yastowma',
            descriptor: 'Icy Abhorrence',
            body: 'planet',
            biome: 'Frozen',
            weather: 'Howling Blizzards',
            flora: 'Screaming',
            sentinels: 'Require Obedience',
            resources: ['Frost Crystal', 'Dioxite'],
            detected: ['Vile Brood Detected'],
            tags: []
          },
          {
            id: 'pl-g',
            name: 'Golgi X19',
            descriptor: 'Metallic',
            body: 'planet',
            biome: 'Exotic',
            weather: 'Obsidian Heat',
            portalGlyph: '2',
            tags: []
          }
        ]
      }),
      sys(1, {
        id: 'sys-pc',
        name: 'Rumedho',
        glyphs: '20020C4BAB22',
        star: 'red',
        conflict: 'pirate',
        conflictWord: 'Pirate Controlled'
      }),
      sys(0, { id: 'sys-nm', name: 'Dissonant System #1', tags: ['harmonic-camp'] })
    ]
  }
});

const axe = async (page, include) => {
  const { violations } = await new AxeBuilder({ page }).include(include).analyze();
  expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

test('phone 375: not-mapped tags and filter, the Infested row and view, Vile Brood, No storms, the conflict pair', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'a phone');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./#systems');
  const list = page.locator('#sec-systems');
  await expect(list.getByText('No address')).toHaveCount(1);
  await expect(
    list.getByRole('button', { name: /^Dissonant System #1 ?, Not mapped: no portal address yet$/ })
  ).toBeVisible();
  await list.getByRole('button', { name: /^Not mapped/ }).click();
  await expect(list.getByRole('button', { name: /^Laeinen Gate/ })).toHaveCount(0);
  await list.getByRole('button', { name: /^Not mapped/ }).click();
  await expectNoHorizontalOverflow(page);
  await axe(page, '#sec-systems');

  await page.goto('./#system/sys-lg');
  const detail = page.locator('#sec-system');
  await expect(detail.getByText('Rowdy // Medium')).toBeVisible();
  await expect(detail.getByText('1 not mapped')).toBeVisible();
  const yastowma = detail.getByRole('link', { name: /^Yastowma ?, Not mapped: no planet glyph yet/ });
  await expect(yastowma).toContainText('Infested');
  await expect(yastowma).toContainText('Icy Abhorrence · Howling Blizzards'); // no "Planet": it stands alone
  await expectNoHorizontalOverflow(page);
  await axe(page, '#sec-system');

  await page.goto('./#planet/sys-lg/pl-y');
  const view = page.locator('#sec-planet');
  await expect(view.getByText('Infested · Frozen biome')).toBeVisible();
  await expect(view.getByText('Vile Brood Detected')).toBeVisible();
  await expect(view.getByText(/Juicy Grubs here; crushing one summons a Brood Mother\./)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await axe(page, '#sec-planet');

  await page.goto('./#planet/sys-lg/pl-g');
  await expect(page.locator('#sec-planet').getByText('No storms', { exact: true })).toBeVisible();

  await page.goto('./#system/sys-pc');
  await expect(page.locator('#sec-system').getByText('Pirate Controlled', { exact: true })).toBeVisible();
  await expect(page.locator('#sec-system').getByText('Pirate (outlaw)')).toHaveCount(0);
});

test('Workbench 1024 / 1440 / 1920: the tag above the name, the conflict pair under the race, the editor columns', async ({
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
    await page.goto('./#system/sys-lg');
    await page.reload();
    const pane = page.locator('#sec-systems, #sec-system').first();
    await expect(page.getByText('No address').first()).toBeVisible();
    const raceCell = page.getByTitle('Gek · Rowdy // Medium');
    await expect(raceCell).toContainText('Rowdy // Medium');
    const spills = await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter(el => el instanceof HTMLElement && el.offsetParent && el.scrollWidth > el.clientWidth + 1)
        .filter(el => !['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX))
        .map(el => el.outerHTML.slice(0, 120))
    );
    expect(spills).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await axe(page, 'main');
    await expect(pane).toBeVisible();
  }
});
