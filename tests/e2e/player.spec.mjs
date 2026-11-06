import AxeBuilder from '@axe-core/playwright';
// The player's own content: ships & Multi-Tools, and notes pinned to Home and the books. A new player starts with
// none of anyone else's.
import { test, expect, storedState } from './fixtures.mjs';

test.describe('a new player', () => {
  test.use({ seed: null });

  test('starts with an empty fleet and nothing personal in the guides', async ({ page }) => {
    await page.goto('./#gear');
    await expect(page.locator('#sec-gear')).not.toContainText('Kestrel IV');
    for (const book of ['book2', 'book3', 'book5']) {
      await page.goto(`./#${book}`);
      await expect(page.locator(`#sec-${book}`)).toBeVisible();
      await expect(page.locator(`#sec-${book}`)).not.toContainText(/Ythgall|Aeron|Defiance of Thought|Light Capacitor/);
    }
    expect((await storedState(page))?.systems ?? []).toEqual([]);
  });
});

test.describe('a note synced from a paired device', () => {
  const hostile = [
    '<img src="https://evil.example/x.png">',
    '<p style="position:fixed;inset:0" id="headerRoot" name="x" onclick="alert(1)">styled</p>',
    '<script>alert(1)</script>',
    '[click](javascript:alert(1)) [data](data:text/html,hi) [away](//evil.example) [wiki](https://nomanssky.fandom.com)',
    '| a |\n|---|\n| b |'
  ].join('\n\n');
  test.use({
    seed: {
      meta: { version: '2.0.0' },
      notes: [{ id: 'note-x', title: 'Hostile', body: hostile, pins: ['home'], createdAt: '2026-10-20T00:00:00Z' }]
    }
  });

  test('renders only safe Markdown: no images, styles, ids, scripts or script links', async ({ page }) => {
    await page.goto('./');
    const body = page.locator('#sec-home [data-note="note-x"] .md-body');
    await expect(body.locator('table')).toContainText('b');
    // Raw HTML shows as text; what is markup carries no images, scripts, styles, ids, names, handlers or odd links.
    await expect(body.locator('img, script, iframe, [style], [id], [name], [onclick], [onerror]')).toHaveCount(0);
    await expect(body).toContainText('<script>alert(1)</script>');
    const hrefs = await body.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')));
    expect(hrefs).toEqual(['https://nomanssky.fandom.com']);
    await expect(body.getByRole('link', { name: 'wiki' })).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

test('a ship added in Fleet shows its supercharged slots and is saved', async ({ page }) => {
  await page.goto('./#gear');
  await page.locator('#sec-gear').getByRole('button', { name: 'Add gear' }).click();
  await page.locator('#gearName').fill('Vela Run');
  await page.locator('#gearEditor').getByRole('radio', { name: 'A-class' }).click();
  await page.locator('#slotPicker [data-slot="R1C1"]').click();
  await page.locator('#slotPicker [data-slot="R1C2"]').click(); // marked and selected
  await page.locator('#gearEditor [data-slot-label="R1C2"]').fill('Pulse Drive upgrade');
  await page.locator('#gearEditor').getByRole('button', { name: 'Add to fleet' }).click();
  await expect(page.locator('#toastMessage')).toHaveText('Added Vela Run.');
  const card = page.locator('#sec-gear [data-gear]').filter({ hasText: 'Vela Run' });
  // Below lg a card added since the screen opened starts closed; from lg (d09) the row itself opens the ship.
  if (await card.locator('summary').count()) {
    await card.locator('summary').click();
    await card.getByRole('link', { name: 'Open Vela Run →' }).click();
  } else await card.click();
  await expect(page.locator('#shipTitle')).toHaveText('Vela Run');
  await expect(page.locator('#sec-ship').getByRole('list', { name: 'Supercharged slots' })).toHaveText(/R1C1.*R1C2/);
  await expect(page.locator('#sec-ship').getByRole('img', { name: /R1C2 \(Pulse Drive upgrade\)/ })).toBeVisible();
  const saved = (await storedState(page)).gear.find(item => item.name === 'Vela Run');
  expect(saved.superchargedSlots).toEqual(['R1C1', 'R1C2']);
});

test('a supercharged slot is selected with a tap and cleared with another', async ({ page }) => {
  await page.goto('./#ship/gear-kestrel');
  await page.locator('#sec-ship').getByRole('button', { name: 'Edit Starship' }).click();
  await expect(page.locator('#slotPicker [data-slot="R6C1"]')).toBeVisible(); // an S-class ship: 6 rows
  const cell = page.locator('#slotPicker [data-slot="R2C3"]');
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await cell.click(); // selects it
  await expect(page.locator('#gearEditor [data-slot-label="R2C3"]')).toHaveValue('Infra-Knife Accelerator');
  await cell.click(); // and clears it
  await expect(cell).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#gearEditor').getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#sec-ship').getByRole('list', { name: 'Supercharged slots' })).toHaveText(/R2C2.*R2C4/);
});

test('the slot picker states the wiki’s rule, from the cited facts, and links to its Codex page', async ({ page }) => {
  await page.goto('./#ship/gear-kestrel');
  await expect(page.locator('#shipRules')).toContainText(
    'S-class starships have 4 supercharged slots, on a tech grid up to 10 columns by 6 rows.'
  );
  await page.locator('#sec-ship').getByRole('button', { name: 'Edit Starship' }).click();
  const rules = page.locator('#slotRules');
  await expect(rules).toContainText('S-class has 4, grid up to 10 × 6');
  await expect(rules.getByRole('link', { name: 'Supercharged Slot' })).toHaveAttribute(
    'href',
    'wiki/#/a/wiki%2Fmechanics%2FSupercharged_Slot.md'
  );
  await page.locator('#gearEditor').getByRole('radio', { name: 'C-class' }).click();
  await expect(page.locator('#slotWarnings')).toContainText('C-class has 1 supercharged slot; 3 are marked');
  await page.locator('#gearEditor').getByRole('button', { name: 'Cancel' }).last().click(); // the footer's

  // Book III's rules cite the same page, mirrored in the Codex's new Mechanics category.
  await page.goto('./#book3');
  // The book quotes the rule, with the revision the sync checked it against.
  const rule = page.locator('#sec-book3').getByRole('region', { name: 'From the wiki' });
  await expect(rule).toContainText('4 in Class S');
  await expect(rule).toContainText(/revision \d+/);
  await page
    .locator('#sec-book3')
    .getByRole('region', { name: 'The chapter' })
    .getByRole('link', { name: 'Supercharged Slot' })
    .click();
  await expect(page.locator('#articleHeader h1')).toHaveText('Supercharged Slot');
  await expect(page.locator('#articleHeader')).toContainText('Mechanics');
  await expect(page.locator('#articleBody')).toContainText('1 supercharged slot in Class C, 2 in Class B');
});

test('a note pinned to Book III is listed under the book and shown on Home, rendered and safe', async ({ page }) => {
  await page.goto('./#book3');
  const pinned = page.locator('#sec-book3 [data-player]');
  await expect(pinned.locator('[data-note="note-grid"]')).toBeVisible();
  await page.goto('./');
  const home = page.locator('#sec-home [data-note="note-grid"]');
  await expect(home.locator('table')).toContainText('Best scanner');
  await expect(home.getByRole('link', { name: 'Oxygen' })).toHaveAttribute('href', 'wiki/#/?q=Oxygen');
});

test('a new note from a book starts pinned there; search finds it', async ({ page }) => {
  await page.goto('./#book2');
  await page.getByRole('button', { name: 'Add a note to Book II' }).click();
  await expect(page).toHaveURL(/#note\/note-/);
  await page.locator('#noteTitle').fill('Outlaw loop timing');
  await page.locator('#noteBody').fill('Go back after **24 h**. <img src=x onerror=alert(1)>');
  await page.locator('#sec-note').getByRole('button', { name: 'Back' }).click(); // leaving saves it
  const row = page.locator('#sec-book2 [data-player] [data-note]').filter({ hasText: 'Outlaw loop timing' });
  await expect(row).toContainText('Go back after 24 h');
  await expect(row.locator('img')).toHaveCount(0);
  expect((await storedState(page)).notes.find(note => note.title === 'Outlaw loop timing').pins).toEqual(['book2']);

  await page.getByRole('button', { name: 'Search and quick actions' }).click();
  await page.locator('#globalSearchInput').fill('loop timing');
  await page
    .locator('#globalSearchResults')
    .getByRole('option', { name: /Outlaw loop timing/ })
    .click();
  await expect(page).toHaveURL(/#note\/note-/);
  await expect(page.locator('#sec-note')).toContainText('Go back after 24 h');
});

test('Markdown files import as notes', async ({ page }) => {
  await page.goto('./#notes');
  await page.locator('#sec-notes input[type="file"]').setInputFiles([
    { name: 'routes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Trade routes\n\n- Ekwa → Hesper') },
    { name: 'plain.md', mimeType: 'text/markdown', buffer: Buffer.from('No heading here') }
  ]);
  await expect(page.locator('#toastMessage')).toHaveText('Imported 2 notes.');
  await expect(page.locator('#notesList')).toContainText('Trade routes');
  await expect(page.locator('#notesList')).toContainText('plain');
});

test('a note opens on its own screen and the toolbar formats what is selected', async ({ page }) => {
  await page.goto('./#notes');
  await page
    .locator('#notesList')
    .getByRole('link', { name: /My scanner layout/ })
    .click();
  await expect(page).toHaveURL(/#note\/note-grid$/);
  await expect(page.locator('#notePreview table')).toContainText('Best scanner');
  // From xl it's already beside the preview.
  if ((page.viewportSize()?.width ?? 0) < 1280)
    await page.locator('#sec-note').getByRole('radio', { name: 'Write' }).click();
  const body = page.locator('#noteBody');
  await body.evaluate(area => {
    area.setSelectionRange(area.value.indexOf('Best'), area.value.indexOf('Best') + 4);
  });
  // The toolbar floats above the tab bar on a phone, and its buttons don't take the selection away.
  await page.getByRole('group', { name: 'Formatting' }).getByRole('button', { name: 'Bold' }).click();
  await expect(body).toHaveValue(/\*\*Best\*\* scanner/);
  await expect
    .poll(async () => (await storedState(page)).notes.find(note => note.id === 'note-grid').body)
    .toContain('**Best** scanner');
});

test('from xl a note is written beside its live preview', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'wide screens');
  await page.goto('./#note/note-grid');
  await page.locator('#noteBody').fill('A **bold** claim');
  await expect(page.locator('#notePreview strong')).toHaveText('bold');
  const text = await page.locator('#noteBody').boundingBox();
  const preview = await page.getByRole('region', { name: 'Preview' }).boundingBox();
  expect(preview.x).toBeGreaterThanOrEqual(text.x + text.width);
});

test('d09: Fleet on the Workbench at 1024, 1440 and 1920 has no text out of its box and passes axe', async ({
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
    await page.goto('./#ship/gear-kestrel');
    await expect(page.locator('#shipTitle')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const spills = await page.evaluate(() =>
      [...document.querySelectorAll('#sec-gear *, #sec-ship *')]
        .filter(el => el instanceof HTMLElement && el.offsetParent && el.scrollWidth > el.clientWidth + 1)
        .filter(el => !['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX))
        .map(el => el.outerHTML.slice(0, 120))
    );
    expect(spills).toEqual([]);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});
