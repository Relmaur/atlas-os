// Takes the product page's phone screens from the real app, with an invented log: tall WebP screenshots at 2× and 3×,
// and their heights for the page (apps/site/public/screens). Run by hand when the screens change, then commit them:
//   pnpm --filter @atlas/web build --mode e2e && node scripts/site-screens.mjs
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { SEEN, state } from './site-log.mjs';

const PORT = 4191;
const OUT = new URL('../apps/site/public/screens/', import.meta.url).pathname;
const SCREENS = { home: '#home', system: '#system/vintam', timers: '#session', planner: '#plan/Stasis%20Device' };

const server = spawn('pnpm', ['--filter', '@atlas/web', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true
});
const browser = await chromium.launch();
const sizes = {};
const work = mkdtempSync(join(tmpdir(), 'atlas-screens-'));
mkdirSync(OUT, { recursive: true });
try {
  for (let tries = 0; tries < 40; tries++) {
    if (
      await fetch(`http://localhost:${String(PORT)}/`).then(
        r => r.ok,
        () => false
      )
    )
      break;
    await new Promise(done => setTimeout(done, 250));
  }
  for (const scale of [2, 3]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: scale,
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce', // a settled picture, not a frame of an animation
      serviceWorkers: 'block'
    });
    await context.addInitScript(
      ([saved, [seenKey, seen]]) => {
        if (!localStorage.getItem('nms_master_os_state')) localStorage.setItem('nms_master_os_state', saved);
        localStorage.setItem(seenKey, seen);
      },
      [JSON.stringify(state), SEEN]
    );
    const page = await context.newPage();
    for (const [name, hash] of Object.entries(SCREENS)) {
      await page.goto('about:blank'); // a real load: a change of hash alone would keep the last shot's changes
      await page.goto(`http://localhost:${String(PORT)}/${hash}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);
      // A tall picture of a phone's screen: what's fixed below the fold stays hidden, and the tab bar sits at the end.
      await page.evaluate(() => {
        const tall = document.documentElement.scrollHeight;
        for (const el of document.querySelectorAll('body *')) {
          if (getComputedStyle(el).position !== 'fixed') continue;
          const box = el.getBoundingClientRect();
          if (box.top >= innerHeight) el.style.visibility = 'hidden';
          else if (box.top > innerHeight * 0.7) el.style.transform = `translateY(${String(tall - innerHeight)}px)`;
        }
      });
      const shot = join(work, `${name}-${String(scale)}x.png`);
      await page.screenshot({ path: shot, fullPage: true });
      sizes[name] = await page.evaluate(() => document.documentElement.scrollHeight);
      execFileSync('ffmpeg', [
        '-y',
        '-loglevel',
        'error',
        '-i',
        shot,
        '-c:v',
        'libwebp',
        '-quality',
        '82',
        join(OUT, `${name}-${String(scale)}x.webp`)
      ]);
    }
    await context.close();
  }
  writeFileSync(join(OUT, 'sizes.json'), `${JSON.stringify(sizes, null, 2)}\n`);
  console.log(sizes);
} finally {
  await browser.close();
  process.kill(-server.pid);
  rmSync(work, { recursive: true, force: true });
}
