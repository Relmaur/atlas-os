import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

test('the product page: named right, accessible, nothing from anyone else, no sideways scroll', async ({ page }) => {
  const offsite = [];
  page.on('request', request => {
    if (!request.url().startsWith('http://localhost')) offsite.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' }); // the scan reads text at rest, not mid-arrival
  await page.goto('./');
  await expect(page).toHaveTitle("ATLAS:OS for No Man's Sky");
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A logbook for your travels in');
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => {
    scrollTo(0, document.body.scrollHeight);
  });
  await expect(page.locator('footer').getByText('Not affiliated with Hello Games')).toBeVisible();
  expect(offsite).toEqual([]);
});

test('its numbers are counted at build time, and it is complete with no script', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('./');
  await expect(page.locator('.stat b').nth(0)).toHaveText(/^\d{1,3}(,\d{3})+$/);
  await expect(page.locator('.stat b').nth(1)).toHaveText(/^\d+$|^\d{1,3}(,\d{3})+$/);
  expect(await page.locator('body').innerText()).not.toContain('{{');
  await expect(page.getByRole('heading', { name: 'Nothing.' })).toHaveCount(0); // the word is display type, not a heading
  await expect(page.getByText('Nothing.', { exact: true })).toBeVisible();
  await context.close();
});

test('every Open ATLAS goes straight into the app, and the other links are real', async ({ page }) => {
  await page.goto('./');
  const open = page.getByRole('link', { name: 'Open ATLAS' });
  expect(await open.count()).toBeGreaterThanOrEqual(3);
  for (const link of await open.all()) expect(await link.getAttribute('href')).toBe('./app/');
  await expect(page.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', 'mailto:hello@atlas-os.cloud');
  await expect(page.getByRole('link', { name: 'Leave a tip' })).toHaveAttribute('href', 'https://ko-fi.com/mlizardo');
  expect(await page.locator('a[href="#"]').count()).toBe(0);
});

test('with reduced motion everything is in place and still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  expect(await page.locator('.pre, .split-pending, .w').count()).toBe(0);
  await expect(page.locator('.hero .phone')).toHaveCSS('transform', 'none');
  await expect(page.locator('#sky')).toBeAttached();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#sun .breathe')).animationName)).toBe(
    'none'
  );
});

test('scrolling: the hero phone turns flat, what is below arrives, and no words stay hidden', async ({ page }) => {
  await page.goto('./');
  const turn = () =>
    page.locator('.hero .phone').evaluate(el => Math.abs(new DOMMatrix(getComputedStyle(el).transform).m13));
  await expect.poll(turn).toBeGreaterThan(0.1);
  await page.evaluate(() => {
    scrollTo({ top: innerHeight, behavior: 'instant' });
  });
  await expect.poll(turn).toBeLessThan(0.01);
  expect(await page.locator('#yours h2 .wi').count()).toBeGreaterThan(0);
  await page.locator('#yours h2').scrollIntoViewIfNeeded();
  await expect(page.locator('#yours h2')).not.toHaveClass(/\bpre\b/);
  await expect(page.locator('#yours h2')).not.toHaveClass(/\brising\b/, { timeout: 8000 }); // the sunlight comes back
  await expect(page.locator('.stat b').first()).toHaveText(/^\d{1,3}(,\d{3})+$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('on a desktop the phone stays pinned and its screen changes with the chapter', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'site-desktop', 'phones give each chapter its own phone');
  await page.goto('./');
  await page.locator('.chapter').nth(3).scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const chapter = document.querySelectorAll('.chapter')[3];
    scrollTo({ top: scrollY + chapter.getBoundingClientRect().top - innerHeight * 0.3, behavior: 'instant' });
  });
  await expect(page.locator('.chapter').nth(3)).toHaveClass(/\bon\b/);
  await expect(page.locator('.stack .layer').nth(3)).toHaveClass(/\bon\b/);
  await expect(page.locator('#banner')).toHaveClass(/\bon\b/); // Refiner done
  await expect(page.locator('.dots i').nth(3)).toHaveClass(/\bon\b/);
});

test("the live cards are the app's own, at each stage, and the page never touches a visitor's log", async ({
  page
}) => {
  const log = JSON.stringify({ systems: [{ name: 'My own system', galaxy: 'Euclid', glyphs: '0123456789AB' }] });
  await page.addInitScript(saved => {
    localStorage.setItem('nms_master_os_state', saved);
  }, log);
  await page.goto('./');
  await page.locator('#card').scrollIntoViewIfNeeded();
  for (const [stage, cls] of [
    ['C', 'C'],
    ['B', 'B'],
    ['S', 'S']
  ]) {
    const card = page.locator(`.rung [data-live-card="${stage}"]`);
    await expect(card.locator(`[aria-label="Class ${cls}"]`)).toBeAttached();
  }
  // Laid out as in the app: the page's own rules mustn't reach inside the card. The art fills the card's width.
  const big = await page.locator('#cardframe').boundingBox();
  await expect
    .poll(async () => (await page.locator('#cardframe .card-tilt-art svg').boundingBox())?.width)
    .toBeGreaterThan(big.width * 0.7);
  await expect(page.locator('.rung [data-live-card="S"]')).toContainText('168');
  await expect(page.locator('.rung [data-live-card="B"]')).toContainText('30');
  await expect(page.locator('[data-live-card]').first()).not.toContainText('My own system');
  expect(await page.evaluate(() => localStorage.getItem('nms_master_os_state'))).toBe(log);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['nms_master_os_state']);
});

test('"Tilt your phone" shows on phones only, where the card really answers it', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.DeviceOrientationEvent = class extends Event {}; // a browser that gives motion without asking
  });
  await page.goto('./');
  const line = page.locator('#tilt-line');
  if (testInfo.project.name !== 'site-phone') {
    await expect(line).toBeHidden();
    return;
  }
  await expect(line).toHaveText('Tilt your phone and it catches the light.');
  await page.locator('#card').scrollIntoViewIfNeeded();
  const frame = page.locator('#cardframe');
  await expect.poll(() => frame.evaluate(el => el.style.transform)).not.toBe('');
  const orient = gamma =>
    page.evaluate(g => {
      const event = new Event('deviceorientation');
      event.beta = 50;
      event.gamma = g;
      window.dispatchEvent(event);
    }, gamma);
  await orient(0); // how it's held is level
  await orient(15);
  await expect.poll(() => frame.evaluate(el => el.style.getPropertyValue('--tilt-x'))).toMatch(/^0\.[45]/);
});

test('on an iPhone the line says to tap first, and the tap asks for motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'site-phone', 'phones only');
  await page.addInitScript(() => {
    window.DeviceOrientationEvent = class extends Event {
      static requestPermission() {
        window.motionAsked = true;
        return Promise.resolve('granted');
      }
    };
  });
  await page.goto('./');
  await expect(page.locator('#tilt-line')).toHaveText('Tap the card and tilt your phone: it catches the light.');
  expect(await page.evaluate(() => window.motionAsked)).toBeUndefined(); // never on load: iOS would refuse
  await page.locator('#cardframe').click();
  await expect.poll(() => page.evaluate(() => window.motionAsked)).toBe(true);
});

test('the phones show real screens, sized by the screenshots', async ({ page }) => {
  await page.goto('./');
  const visible = page.locator('.screen-img:visible').first();
  await visible.scrollIntoViewIfNeeded();
  await expect.poll(() => visible.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.locator('.chapter').nth(2).scrollIntoViewIfNeeded(); // the Map's phones are live: they fill as they near
  await expect.poll(() => page.locator('.phone .screen-pending').count()).toBe(0);
  expect(await page.content()).not.toContain('{{');
});

test('the hero video is muted, inline and labelled, and holds still with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const video = page.getByRole('img', { name: /ATLAS in use/ }).or(page.locator('#heroVideo'));
  await expect(video).toHaveAttribute('aria-label', /ATLAS in use/);
  await expect(video).toHaveAttribute('poster', './poster.jpg');
  expect(await video.evaluate(el => el.muted && el.playsInline && el.paused)).toBe(true);
  const poster = await page.request.get('./poster.jpg');
  expect(poster.ok()).toBe(true);
});

test('the page is listed under its real address', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://atlas-os.cloud/');
  expect(await page.locator('meta[name="robots"]').count()).toBe(0);
});

test('the Updates list: both updates, newest first, gold on the latest, and a link back from the product page', async ({
  page
}) => {
  const offsite = [];
  page.on('request', request => {
    if (!request.url().startsWith('http://localhost')) offsite.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.locator('footer').getByRole('link', { name: 'Updates' })).toHaveAttribute('href', '/updates/');
  await page.goto('./updates/');
  await expect(page).toHaveTitle(/What's new in ATLAS:OS/);
  await expect(page.locator('.update-name')).toHaveText(['First Light', 'Where it started']);
  await expect(page.locator('.rel').first().locator('.latest')).toHaveText('Latest');
  await expect(page.locator('.rel').nth(1).locator('.latest')).toHaveCount(0);
  await expect(page.locator('.rel').first().locator('.ver')).toHaveText('3.21');
  await expect(page.locator('.rel').first().locator('.h')).toHaveCount(4);
  await expect(page.locator('.rel').first().locator('.lede')).toContainText(/\d,\d{3} pages/);
  expect(await page.locator('body').innerText()).not.toContain('{{');
  await expect(page.locator('.rel').first().locator('details')).toHaveCount(2);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const banner = page.locator('.banner-fig img');
  await banner.scrollIntoViewIfNeeded();
  await expect.poll(() => banner.evaluate(img => img.naturalWidth)).toBe(1600);
  expect(offsite).toEqual([]);
});

test('an update has its own page, with the tags a shared link needs', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./updates/first-light/');
  await expect(page).toHaveTitle('ATLAS:OS · First Light');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('First Light');
  const meta = name => page.locator(`meta[property="${name}"], meta[name="${name}"]`);
  await expect(meta('og:title')).toHaveAttribute('content', 'ATLAS:OS · First Light');
  await expect(meta('og:description')).toHaveAttribute('content', /new home at atlas-os\.cloud/);
  await expect(meta('og:image')).toHaveAttribute('content', 'https://atlas-os.cloud/banners/first-light.jpg');
  await expect(meta('twitter:card')).toHaveAttribute('content', 'summary_large_image');
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);

  await page.goto('./updates/origins/');
  await expect(page.locator('.banner-fig')).toHaveCount(0); // its picture is for sharing only
  await expect(meta('og:image')).toHaveAttribute('content', 'https://atlas-os.cloud/banners/origins.jpg');
  expect((await request.get('./banners/origins.jpg')).ok()).toBe(true);
  expect((await request.get('./banners/first-light.jpg')).ok()).toBe(true);
});

test('Copy link gives the update its own address, or shows it if the clipboard refuses', async ({ page }) => {
  await page.goto('./updates/');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: text => {
          window.copied = text;
          return Promise.resolve();
        }
      }
    });
  });
  const button = page.locator('.rel').first().locator('[data-copy]'); // its name changes when clicked
  await button.click();
  await expect(button).toHaveText('Link copied');
  expect(await page.evaluate(() => window.copied)).toBe('https://atlas-os.cloud/updates/first-light/');

  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('refused'));
  });
  const second = page.locator('.rel').nth(1).locator('[data-copy]');
  await second.click();
  await expect(page.locator('.rel').nth(1).locator('.copy-url')).toHaveText('https://atlas-os.cloud/updates/origins/');
});

test('the feed lists every update, and later updates rise in on scroll', async ({ page, request }) => {
  const feed = await (await request.get('./updates.xml')).text();
  expect(feed).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
  expect(feed).toContain('<id>https://atlas-os.cloud/updates/first-light/</id>');
  expect(feed).toContain('<id>https://atlas-os.cloud/updates/origins/</id>');
  expect(feed.indexOf('first-light')).toBeLessThan(feed.indexOf('origins'));
  expect(feed).not.toContain('{{');

  await page.goto('./updates/');
  await expect(page.locator('.rel').first()).not.toHaveClass(/\bpre\b/); // there at rest
  const last = page.locator('.rel').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).not.toHaveClass(/\bpre\b/);
});
