import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.mjs';

test('the Traveller Card from Settings: the front, then its back, both accessible', async ({ page }, testInfo) => {
  await page.goto('./#more');
  await page
    .locator('main')
    .getByRole('link', { name: /Traveller Card/ })
    .click();
  await expect(page).toHaveURL(/#card$/);
  const front = page.getByRole('region', { name: 'Traveller Card, front' });
  await expect(front.getByRole('img', { name: /Class [CBAS]/ })).toBeVisible();
  await expect(front).toContainText(/game v\d+\.\d+/);
  let { violations } = await new AxeBuilder({ page }).include('#sec-card').analyze();
  expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);

  // A tap on the card flips it; from xl both faces already show.
  if (testInfo.project.name === 'phone') await page.locator('#travellerCard').click({ position: { x: 60, y: 300 } });
  const back = page.getByRole('region', { name: 'Traveller Card, back' });
  await expect(back.getByRole('tab', { name: 'Reading this card' })).toHaveAttribute('aria-selected', 'true');
  await expect(back).toContainText('Vortices');
  ({ violations } = await new AxeBuilder({ page }).include('#sec-card').analyze());
  expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);
});

test('on an iPhone, after the prompt, tilt turns the whole card and holds', async ({ page }) => {
  await page.addInitScript(() => {
    class Orientation extends Event {
      constructor(beta, gamma) {
        super('deviceorientation');
        this.beta = beta;
        this.gamma = gamma;
      }
      static requestPermission() {
        window.motionAsked = true;
        return Promise.resolve('granted');
      }
    }
    window.DeviceOrientationEvent = Orientation;
  });
  await page.goto('./#card');
  const stage = page.locator('#travellerCard');
  await stage.click({ position: { x: 60, y: 300 } });
  await stage.click({ position: { x: 60, y: 300 } }); // and back to the front
  await expect.poll(() => page.evaluate(() => window.motionAsked)).toBe(true);
  await expect(page.getByRole('region', { name: 'Traveller Card, front' })).toBeVisible();

  const card = page.locator('.card-tilt').first();
  const turn = () => card.evaluate(el => Math.abs(new DOMMatrix(getComputedStyle(el).transform).m13));
  const orient = gamma =>
    page.evaluate(g => {
      window.dispatchEvent(new DeviceOrientationEvent(50, g));
    }, gamma);
  await orient(0); // how it's held is level
  await orient(10);
  await expect.poll(turn).toBeGreaterThan(Math.sin((6 * Math.PI) / 180));
  await page.waitForTimeout(1500);
  await orient(10);
  // A held tilt doesn't fade away: level follows slowly, so seconds later (more on a busy machine) most of it remains.
  await expect.poll(turn).toBeGreaterThan(Math.sin((4 * Math.PI) / 180));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).transform)).toBe('none');
});

test('full screen: the card alone, clear of the notch, flips on a tap and closes', async ({
  page,
  context
}, testInfo) => {
  if (testInfo.project.name === 'phone') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } });
  }
  await page.goto('./#card');
  await page.getByRole('button', { name: 'Full screen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Traveller Card, full screen' });
  await expect(dialog).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include('.card-full').analyze();
  expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);

  const viewport = page.viewportSize();
  const box = await page.locator('#travellerCard').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(-0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
  if (testInfo.project.name === 'phone') expect(box.y).toBeGreaterThanOrEqual(47);
  // Nothing else shows: not the tab bar, not the screen's buttons.
  const atBottom = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('.tab-bar, nav') === null,
    [viewport.width / 2, viewport.height - 20]
  );
  expect(atBottom).toBe(true);

  await page.locator('#travellerCard').click({ position: { x: 60, y: 300 } });
  await expect(page.locator('#travellerCard [aria-label="Traveller Card, back"]')).toHaveAttribute(
    'aria-hidden',
    'false'
  );
  await page.getByRole('button', { name: 'Close full screen' }).click();
  await expect(dialog).toBeHidden();
  // The screen is back: its Full screen button is on a phone's top bar and in the Workbench's inspector (d17).
  await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible();
});

test('from xl both faces show side by side, and full screen is still the one card that flips', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'wide screens');
  await page.goto('./#card');
  const front = await page.getByRole('region', { name: 'Traveller Card, front' }).boundingBox();
  const back = await page.getByRole('region', { name: 'Traveller Card, back' }).boundingBox();
  expect(back.x).toBeGreaterThanOrEqual(front.x + front.width);
  expect(back.y).toBeCloseTo(front.y, 0);
  await expect(page.getByRole('button', { name: 'Flip', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(page.getByRole('button', { name: 'Flip', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Full screen' }).click();
  await expect(page.locator('#travellerCard .card-flip')).toBeVisible();
});

test('d17: the Traveller Card on the Workbench at 1024, 1440 and 1920 keeps its size, has no text out of its box and passes axe', async ({
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
    await page.goto('./#card');
    await expect(page.locator('#cardTitle')).toBeVisible();
    // Never scaled up: each face is the card's own 380px at every width.
    for (const face of await page.locator('#travellerCard .card-stage, #travellerCard.card-stage').all())
      expect(Math.round((await face.boundingBox()).width)).toBeLessThanOrEqual(380);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const spills = await page.evaluate(() =>
      [...document.querySelectorAll('#sec-card aside *')]
        .filter(el => el instanceof HTMLElement && el.offsetParent && el.scrollWidth > el.clientWidth + 1)
        .filter(el => !['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX))
        .map(el => el.outerHTML.slice(0, 120))
    );
    expect(spills).toEqual([]);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});
