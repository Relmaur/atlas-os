// Failure modes, triggered deliberately: none of them may lose data silently (ADR-0002).
import { test, expect, storedState, STORAGE_KEY } from './fixtures.mjs';

test('a failed save shows a persistent banner offering an export', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => {
    window.__setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    };
  });
  await page.locator('#homeNow').getByRole('button', { name: 'Log visit' }).click();
  await expect(page.locator('#storageBanner')).toBeVisible();
  await expect(page.locator('#storageBannerText')).toContainText('Not saved on this device');
  await expect(page.locator('#storageBannerExport')).toBeVisible();

  // Once saving works again, the next save clears the banner.
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__setItem;
  });
  await page.locator('#homeNow').getByRole('button', { name: 'Log visit' }).click();
  await expect(page.locator('#storageBanner')).toBeHidden();
  const ekwa = (await storedState(page)).systems.find(system => system.id === 'sys-ekwa');
  expect(ekwa.visits).toHaveLength(3); // the visit logged while saving failed was kept in memory
});

for (const [label, raw] of [
  ['not JSON', '{"systems": [ broken'],
  ['the wrong shape', JSON.stringify({ systems: { not: 'a list' } })]
]) {
  test(`a stored copy that is ${label} is kept aside, not deleted`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        if (sessionStorage.getItem('atlas-test-corrupt')) return;
        localStorage.setItem(key, value);
        sessionStorage.setItem('atlas-test-corrupt', '1');
      },
      [STORAGE_KEY, raw]
    );
    await page.goto('./');
    await expect(page.locator('#storageBannerText')).toContainText('couldn’t be read');
    const kept = await page.evaluate(
      key =>
        Object.keys(localStorage)
          .filter(name => name.startsWith(`${key}.corrupt-`))
          .map(name => localStorage.getItem(name)),
      STORAGE_KEY
    );
    expect(kept).toEqual([raw]);
    await expect(page.locator('#homeNow')).toBeVisible(); // the app still starts, from the defaults
  });
}

test('a malformed import is rejected with the reason and changes nothing', async ({ page }) => {
  await page.goto('./#more');
  const input = page.locator('#sec-more input[type="file"]');
  await input.setInputFiles({
    name: 'nms_state.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ systems: [{ name: 42 }] }))
  });
  await expect(page.locator('#toastMessage')).toHaveText('Not imported: systems[0].name must be text.');
  await input.setInputFiles({ name: 'nms_state.json', mimeType: 'application/json', buffer: Buffer.from('{ nope') });
  await expect(page.locator('#toastMessage')).toHaveText('That file isn’t valid JSON, so nothing was imported.');
  expect((await storedState(page)).systems.map(system => system.id)).toEqual(['sys-ekwa', 'sys-hesper', 'sys-den']);
});

test('a second tab picks up the first tab’s save instead of overwriting it', async ({ page }) => {
  await page.goto('./');
  const other = await page.context().newPage();
  await other.goto('./');
  await expect(other.locator('#homeNow')).toContainText('Ekwa Nexus');

  await page.locator('#homeNow').getByRole('button', { name: 'Log visit' }).click();
  await expect(other.locator('#toastMessage')).toHaveText('Updated with changes from another tab.');
  await other.locator('#homeNow').getByRole('button', { name: 'Log visit' }).click();

  const ekwa = (await storedState(page)).systems.find(system => system.id === 'sys-ekwa');
  expect(ekwa.visits).toHaveLength(3); // seeded + one per tab: neither tab wrote over the other
  await other.close();
});

test('a failed planet save raises the banner and keeps the planet on screen', async ({ page }) => {
  await page.goto('./#systems');
  await page.locator('#systemList').getByText('Ekwa Nexus').click();
  await expect(page.locator('#systemTitle')).toHaveText('Ekwa Nexus');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage) throw new DOMException('Storage is full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: /^Add body/ }).click();
  const sheet = page.locator('#planetSheet');
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Verdant IV');
  await sheet.getByRole('button', { name: 'Add body' }).click();
  await expect(page.locator('#storageBannerText')).toContainText('Not saved on this device');
  await expect(page.locator('#sec-system')).toContainText('Verdant IV'); // kept in memory, offered for export
});

test('an unreadable copy is never overwritten when there is no room to keep it aside', async ({ page }) => {
  const raw = '{"systems": [ broken';
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('atlas-test-full')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('atlas-test-full', '1');
      }
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, item) {
        if (this === localStorage) throw new DOMException('Storage is full', 'QuotaExceededError');
        return original.call(this, name, item);
      };
    },
    [STORAGE_KEY, raw]
  );
  await page.goto('./');
  await expect(page.locator('#storageBannerText')).toContainText('no room to keep a copy aside');
  // The defaults it fell back to are an empty atlas (the first run): log a system, which tries to save.
  await page.getByRole('button', { name: /Log your first system/ }).click();
  await page.locator('#sysName').fill('Test Prime');
  await page.locator('#systemEditor button[type="submit"]').click();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(raw);
});

test('a stored id crafted to inject script is refused, not run', async ({ page }) => {
  await page.addInitScript(key => {
    if (sessionStorage.getItem('atlas-test-xss')) return;
    localStorage.setItem(
      key,
      JSON.stringify({
        meta: { lastUpdated: '2099-01-01T00:00:00.000Z' },
        systems: [{ id: "x');window.__pwned=1;('", name: 'Evil' }]
      })
    );
    sessionStorage.setItem('atlas-test-xss', '1');
  }, STORAGE_KEY);
  await page.goto('./#systems');
  await expect(page.locator('#storageBannerText')).toContainText('couldn’t be read');
  await expect(page.locator('#systemList')).not.toContainText('Evil');
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('an open system follows another tab’s save', async ({ page }) => {
  await page.goto('./#systems');
  await page.locator('#systemList').getByText('Ekwa Nexus').click();
  const visits = (await storedState(page)).systems.find(system => system.id === 'sys-ekwa').visits.length;
  const other = await page.context().newPage();
  await other.goto('./');
  await other.locator('#homeNow').getByRole('button', { name: 'Log visit' }).click();
  await expect(page.locator('#toastMessage')).toHaveText('Updated with changes from another tab.');
  await expect(page.getByRole('region', { name: 'Journal' }).locator('li')).toHaveCount(visits + 1);
  await other.close();
});
