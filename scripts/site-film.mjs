// Records the product page's hero video from the real app: a scripted phone session with the invented log, as an H.264
// MP4 and a poster (apps/site/public). Run by hand when the screens change, then commit them:
//   pnpm --filter @atlas/web build --mode e2e && node scripts/site-film.mjs
// The one thing that isn't the app is the "Refiner done" banner, standing in for the phone's own notification.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { SEEN, withTravels } from './site-log.mjs';

const PORT = 4192;
const BASE = `http://localhost:${String(PORT)}/`;
const OUT = new URL('../apps/site/public/', import.meta.url).pathname;
const MAX_BYTES = 5 * 1024 * 1024;

const log = withTravels(48, 4);

const pause = ms => new Promise(done => setTimeout(done, ms));

const server = spawn('pnpm', ['--filter', '@atlas/web', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true
});
const browser = await chromium.launch();
const work = mkdtempSync(join(tmpdir(), 'atlas-film-'));
try {
  for (let tries = 0; tries < 40; tries++) {
    if (
      await fetch(BASE).then(
        r => r.ok,
        () => false
      )
    )
      break;
    await pause(250);
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block'
  });
  await context.addInitScript(
    ([saved, [seenKey, seen]]) => {
      if (!localStorage.getItem('nms_master_os_state')) localStorage.setItem('nms_master_os_state', saved);
      localStorage.setItem(seenKey, seen);
    },
    [JSON.stringify(log), SEEN]
  );
  const page = await context.newPage();
  await page.goto(`${BASE}#home`);
  await page.waitForLoadState('networkidle');
  await pause(1200);

  // The touch dot and the phone's notification: on top of the app, made with no inline styles for its CSP to refuse.
  await page.evaluate(() => {
    const dot = document.createElement('div');
    dot.id = 'filmTouch';
    Object.assign(dot.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '38px',
      height: '38px',
      margin: '-19px 0 0 -19px',
      borderRadius: '50%',
      background: 'rgba(255,255,255,.28)',
      border: '2px solid rgba(255,255,255,.75)',
      zIndex: '9999',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity .15s'
    });
    const banner = document.createElement('div');
    banner.id = 'filmBanner';
    Object.assign(banner.style, {
      position: 'fixed',
      left: '10px',
      right: '10px',
      top: '12px',
      zIndex: '9998',
      borderRadius: '20px',
      background: 'rgba(30,41,59,.94)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(148,163,184,.25)',
      padding: '12px 14px',
      color: '#fff',
      font: '400 13px/1.35 Inter, sans-serif',
      pointerEvents: 'none',
      transform: 'translateY(-140px)',
      transition: 'transform .5s cubic-bezier(.16,1,.3,1)'
    });
    const title = document.createElement('b');
    title.textContent = 'Refiner done';
    title.style.display = 'block';
    banner.append(title, '300 Chromatic Metal is ready to collect.');
    document.body.append(dot, banner);
  });
  const dot = (x, y, on = true) =>
    page.evaluate(
      ([x, y, on]) => {
        const el = document.getElementById('filmTouch');
        el.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
        el.style.opacity = on ? '1' : '0';
      },
      [x, y, on]
    );
  const tap = async locator => {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    await dot(x, y);
    await pause(300);
    await page.mouse.click(x, y);
    await pause(150);
    await dot(x, y, false);
  };
  const glide = (distance, ms) =>
    page.evaluate(
      ([distance, ms]) =>
        new Promise(done => {
          const from = scrollY;
          const start = performance.now();
          const step = now => {
            const t = Math.min(1, (now - start) / ms);
            scrollTo({ top: from + distance * (1 - (1 - t) ** 3), behavior: 'instant' });
            if (t < 1) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        }),
      [distance, ms]
    );
  const go = async hash => {
    await page.evaluate(next => {
      scrollTo({ top: 0, behavior: 'instant' });
      location.hash = next;
    }, hash);
  };

  const cdp = await context.newCDPSession(page);
  const frames = [];
  const writes = [];
  cdp.on('Page.screencastFrame', frame => {
    const file = join(work, `${String(frames.length).padStart(5, '0')}.jpg`);
    frames.push({ file, at: frame.metadata.timestamp });
    writeFileSync(file, Buffer.from(frame.data, 'base64'));
    writes.push(cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => undefined));
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 80,
    maxWidth: 780,
    maxHeight: 1688,
    everyNthFrame: 1
  });
  await pause(1500);

  // Warped somewhere new: the slide, then a name and Add system.
  const slide = page.getByLabel(/^Warped somewhere new/);
  const box = await slide.boundingBox();
  const [startX, y] = [box.x + 30, box.y + box.height / 2];
  await dot(startX, y);
  await pause(350);
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let i = 1; i <= 24; i++) {
    const x = startX + (box.width - 60) * (i / 24);
    await page.mouse.move(x, y);
    await dot(x, y);
    await pause(16);
  }
  await page.mouse.up();
  await dot(startX, y, false);
  await pause(900);
  await page.getByPlaceholder('As the Discoveries page shows it').pressSequentially('Karvos Deep', { delay: 75 });
  await pause(400);
  await tap(page.getByRole('button', { name: 'Add system' }));
  await pause(1500);

  await go('#system/vintam');
  await pause(1000);
  await glide(420, 1500);
  await pause(800);

  await go('#session');
  await pause(1400);
  await page.evaluate(() => {
    document.getElementById('filmBanner').style.transform = 'none';
  });
  await pause(2200);
  await page.evaluate(() => {
    document.getElementById('filmBanner').style.transform = 'translateY(-140px)';
  });
  await pause(600);

  await go('#plan/Stasis%20Device');
  await pause(1000);
  await glide(330, 1200);
  await pause(300);
  await tap(page.getByRole('button', { name: 'Radon' }).first());
  await pause(2000);
  await page.keyboard.press('Escape');
  await pause(500);

  await go('#map');
  await pause(2600);

  await go('#card');
  await pause(1000);
  const card = await page.locator('#travellerCard').boundingBox();
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    await page.mouse.move(
      card.x + card.width * (0.5 + 0.4 * Math.sin(t * Math.PI * 2)),
      card.y + card.height * (0.5 + 0.3 * Math.cos(t * Math.PI * 2))
    );
    await pause(24);
  }
  await pause(200);
  await go('#home');
  await pause(1300);

  await cdp.send('Page.stopScreencast');
  await Promise.all(writes);
  await context.close();

  // Each frame lasts until the next one came: the screencast sends frames only when something changes.
  const lines = frames.flatMap((frame, i) => [
    `file '${frame.file}'`,
    `duration ${Math.max(0.001, (frames[i + 1]?.at ?? frame.at + 0.1) - frame.at).toFixed(4)}`
  ]);
  writeFileSync(join(work, 'list.txt'), `${lines.join('\n')}\nfile '${frames.at(-1).file}'\n`);
  const encode = crf =>
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      join(work, 'list.txt'),
      '-vf',
      'fps=30,format=yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'veryslow',
      '-crf',
      String(crf),
      '-movflags',
      '+faststart',
      '-an',
      join(OUT, 'hero.mp4')
    ]);
  let crf = 25;
  encode(crf);
  while (statSync(join(OUT, 'hero.mp4')).size > MAX_BYTES && crf < 34) encode(++crf);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', frames[0].file, '-q:v', '4', join(OUT, 'poster.jpg')]);
  console.log({ frames: frames.length, crf, bytes: statSync(join(OUT, 'hero.mp4')).size });
} finally {
  await browser.close();
  process.kill(-server.pid);
  rmSync(work, { recursive: true, force: true });
}
