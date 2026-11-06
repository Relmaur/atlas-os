// Accessibility (axe) on every screen and the page frame: any violation in the gated region fails. An entry without a
// region reports only (violations attached and summarised as an annotation); none is left.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, holdToStartSession, openLiveBar } from './fixtures.mjs';

const openEditor = async page => {
  await page.locator('#systemList').getByText('Ekwa Nexus').click();
  await page.getByRole('button', { name: 'Edit system' }).click();
};
// Location read from a Signal Booster (06f): the planet stays unknown.
const openBooster = async page => {
  await openEditor(page);
  await page.locator('#systemPanel').getByRole('radio', { name: 'Signal Booster' }).click();
  await page.locator('#sysAddress').fill('HUKYA:046A:0081:0D6D:0038');
};
const openPlanet = page => page.getByRole('button', { name: /^Add body/ }).click();
// The planet sheet from a planet's own view, with the weather's word list open (c14).
const openWeatherList = async page => {
  await page.locator('#sec-planet').getByRole('button', { name: 'Edit body' }).click();
  await page.locator('#planetSheet').getByRole('combobox', { name: 'Weather' }).click();
  await page.locator('#planetSheet').getByRole('listbox', { name: 'Weather' }).waitFor();
};

const tickHalf = async page => {
  const boxes = await page.locator('#planCargo input[type="checkbox"]').all();
  for (const box of boxes.slice(0, 7)) await box.check();
};
const openPlanPeek = page => page.getByRole('button', { name: 'Frost Crystal: open in Codex' }).click();

const OXYGEN = encodeURIComponent('wiki/resources/Oxygen.md');
const openPeek = page => page.locator('#browseBody .result button').first().click();
// The index bar is the phone and tablet layout; from lg the same index is the rail, already on screen.
const openIndex = async page => {
  const button = page.locator('#articleHeader').getByRole('button', { name: 'On this page' });
  if (await button.isVisible()) await button.click();
};
const openGearEditor = page => page.locator('#sec-ship').getByRole('button', { name: 'Edit Starship' }).click();
// From xl Write and Preview are side by side, so there's nothing to switch.
const writeNote = async page => {
  if ((page.viewportSize()?.width ?? 0) < 1280)
    await page.locator('#sec-note').getByRole('radio', { name: 'Write' }).click();
};
const openCamp = page => page.getByRole('tab', { name: 'Registers' }).click();
const liveSession = async page => {
  await holdToStartSession(page);
  await openLiveBar(page);
  await page.locator('#sessionClock').waitFor();
};
const openTimerSheet = async page => {
  await liveSession(page);
  await page.getByRole('button', { name: 'Custom timer' }).click();
};
const showRecap = async page => {
  await liveSession(page);
  await page.locator('#sec-session').getByRole('button', { name: 'End session' }).click();
};

const openSearch = async page => {
  await page.getByRole('button', { name: 'Search and quick actions' }).click();
  await page.locator('#searchQuick').waitFor();
};
const searchFor = async page => {
  await openSearch(page);
  await page.locator('#globalSearchInput').fill('e');
  await page.locator('#globalSearchResults [role="option"]').first().waitFor();
};

// [name, path, ready selector, gated region (or null to report only), setup]
for (const [name, path, ready, region, setup] of [
  ['Home', './', '#homeNow', '#sec-home'],
  ['Page frame (header, sidebar, tab bar)', './', '#homeNow', 'body'],
  ['Page frame on Systems', './#systems', '#systemList', 'body'],
  ['Page frame on Outlaw Run', './#outlaw', '#outlawStationList', 'body'],
  ['Search: quick actions', './', '#homeNow', '#globalSearch', openSearch],
  ['Search: results', './', '#homeNow', '#globalSearch', searchFor],
  ['Session', './#session', '#timersTitle', '#sec-session'],
  ['Session live', './', '#timersTitle', '#sec-session', liveSession],
  ['Timer sheet', './', '#timersTitle', '#timerSheet', openTimerSheet],
  ['Session recap', './', '#timersTitle', '#sec-session', showRecap],
  ['Systems', './#systems', '#systemList', '#sec-systems'],
  ['Runs', './#runs', '#runsOutlaw', '#sec-runs'],
  ['Map', './#map', '#mapChain', '#sec-map'],
  ['Map · one galaxy', './#map/Euclid', '#mapGalaxy', '#sec-map'],
  ['Outlaw stations', './#outlaw', '#outlawStationList', '#sec-outlaw'],
  ['System detail', './#system/sys-ekwa', '#sec-system #portalTitle', '#sec-system'],
  ['System detail, no address', './#system/sys-hesper', '#sec-system #portalTitle', '#sec-system'],
  ['Planet sheet', './#system/sys-ekwa', '#systemTitle', '#planetSheet', openPlanet],
  ['Planet sheet, word list open', './#planet/sys-hesper/pl-storm', '#planetTitle', '#planetSheet', openWeatherList],
  ['Planet view', './#planet/sys-hesper/pl-storm', '#planetTitle', '#sec-planet'],
  ['Planet view, nothing scanned', './#planet/sys-hesper/pl-blank', '#planetTitle', '#sec-planet'],
  ['System editor', './#systems', '#systemPanel [aria-label="Glyphs"]', '#systemPanel', openEditor],
  ['System editor, Signal Booster', './#systems', '#sysAddressConverted', '#systemPanel', openBooster],
  ['My glyphs', './#glyphs', '#sec-glyphs [aria-label="Glyphs found"]', '#sec-glyphs'],
  ['Dialling', './#dial/sys-ekwa', '#sec-dial [aria-label="Glyph 1 of 12"]', '#sec-dial'],
  ['Calculators', './#calculators', '#valueTotal', '#sec-calculators'],
  ['Recipe planner', './#plan/Stasis%20Device', '#planCargo', '#sec-plan'],
  ['Recipe planner, Codex peek', './#plan/Stasis%20Device', '#peekSource', '#codexPeek', openPlanPeek],
  ['Guides', './#guides', '#guidesList a >> nth=0', '#sec-guides'],
  ['Book I (checklists)', './#book1', '#checklist-milestones input >> nth=0', '#sec-book1'],
  ['Book III (tables)', './#book3', '#sec-book3 table >> nth=0', '#sec-book3'],
  ['Settings', './#more', '#installRow', '#sec-more'],
  ['Sync sheet', './#sync', '#syncPanel', '#syncSheet'],
  ['Fleet', './#gear', '#sec-gear [data-gear] >> nth=0', '#sec-gear'],
  ['Ship detail', './#ship/gear-kestrel', '#shipTitle', '#sec-ship'],
  ['Gear editor', './#ship/gear-kestrel', '#gearEditor', '#gearEditor', openGearEditor],
  ['Notes', './#notes', '#notesList [data-note] >> nth=0', '#sec-notes'],
  ['Note', './#note/note-grid', '#notePreview', '#sec-note'],
  ['Note, writing', './#note/note-grid', '#noteBody', '#sec-note', writeNote],
  ['Recipe planner, mid-plan', './#plan/Stasis%20Device', '#planCargo', '#sec-plan', tickHalf],
  ['Calculators, Registers', './#calculators', '#calcReg1', '#sec-calculators', openCamp],
  ['Best crafts', './#crafts', '#craftList [data-craft] >> nth=0', '#sec-crafts'],
  ['Codex', './wiki/', '#browseBody', '#codexRoot'],
  ['Codex results', './wiki/#/?q=oxygen', '#browseBody .result >> nth=0', '#codexRoot'],
  ['Codex quick look', './wiki/#/?q=oxygen', '#peekBody h2 >> nth=0', '#codexRoot', openPeek],
  ['Codex article', `./wiki/#/a/${OXYGEN}`, '#articleBody h2 >> nth=0', '#codexRoot'],
  ['Codex article index', `./wiki/#/a/${OXYGEN}`, '#articleBody h2 >> nth=0', '#codexRoot', openIndex]
]) {
  test(`axe: ${name}`, async ({ page }, testInfo) => {
    await page.goto(path);
    await setup?.(page);
    await expect(page.locator(ready)).toBeVisible();
    // Gated screens are checked on their own content: the vanilla header and navigation have their own findings.
    const builder = new AxeBuilder({ page });
    const { violations } = await (region ? builder.include(region) : builder).analyze();
    await testInfo.attach('axe-violations.json', {
      body: JSON.stringify(violations, null, 2),
      contentType: 'application/json'
    });
    testInfo.annotations.push({
      type: 'axe',
      description: violations.length
        ? violations.map(v => `${v.id} (${v.impact}, ${v.nodes.length})`).join('; ')
        : 'no violations'
    });
    if (region) expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test('the wide layouts pass at every width the direction names', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sets its own widths');
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const screen of [
      './#home',
      './#systems',
      './#system/sys-ekwa',
      './#gear',
      './#notes',
      './#runs',
      './#guides',
      './#more'
    ]) {
      await page.goto(screen);
      await page.locator('.book-section:not(.hidden)').first().waitFor();
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map(v => `${String(width)} ${screen} ${v.id}: ${v.help}`)).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${screen} at ${String(width)}`
      ).toBe(true);
    }
  }
});
