// Makes each update's 1600×800 banner from real app screens with the invented log (apps/site/public/banners), used on the
// page and as its share image. Run by hand when the screens change, then commit them:
//   pnpm --filter @atlas/web build --mode e2e && node scripts/site-banners.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { SEEN, withTravels } from './site-log.mjs';

const PORT = 4193;
const BASE = `http://localhost:${String(PORT)}/`;
const OUT = new URL('../apps/site/public/banners/', import.meta.url).pathname;
// A seasoned traveller: a card at class S, and a Map with ten galaxies on it.
const log = withTravels(160, 10);

// `middle` is shown flat and large; the other two lean in from the sides.
const BANNERS = {
  survey: { left: '#system/vintam', middle: '#planet/vintam/p4', right: '#planet/vintam/p2' },
  'first-light': { left: '#home', middle: '#card', right: '#map' },
  origins: { left: '#systems', middle: '#system/vintam', right: '#session' }
};

const server = spawn('pnpm', ['--filter', '@atlas/web', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true
});
const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
try {
  for (let tries = 0; tries < 40; tries++) {
    if (
      await fetch(BASE).then(
        r => r.ok,
        () => false
      )
    )
      break;
    await new Promise(done => setTimeout(done, 250));
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    serviceWorkers: 'block'
  });
  await context.addInitScript(
    ([saved, [seenKey, seen]]) => {
      if (!localStorage.getItem('nms_master_os_state')) localStorage.setItem('nms_master_os_state', saved);
      localStorage.setItem(seenKey, seen);
    },
    [JSON.stringify(log), SEEN]
  );
  const app = await context.newPage();
  const shot = async hash => {
    await app.goto('about:blank');
    await app.goto(`${BASE}${hash}`);
    await app.waitForLoadState('networkidle');
    await app.waitForTimeout(900);
    // The card alone, as it's held: not the screen around it, and with the address it prints for a real player.
    if (hash === '#card')
      await app.evaluate(() => {
        for (const bar of document.querySelectorAll('.tab-bar, .search-key')) bar.style.visibility = 'hidden';
        const walker = document.createTreeWalker(document.getElementById('travellerCard'), NodeFilter.SHOW_TEXT);
        while (walker.nextNode())
          walker.currentNode.textContent = walker.currentNode.textContent.replace(
            /localhost:\d+/,
            'atlas-os.cloud/app'
          );
      });
    const image = await (hash === '#card' ? app.locator('#travellerCard') : app).screenshot({
      type: 'jpeg',
      quality: 90
    });
    return `data:image/jpeg;base64,${image.toString('base64')}`;
  };
  const card = await browser.newContext({ viewport: { width: 1600, height: 800 }, deviceScaleFactor: 1 });
  const canvas = await card.newPage();
  for (const [name, { left, middle, right }] of Object.entries(BANNERS)) {
    const [l, m, r] = [await shot(left), await shot(middle), await shot(right)];
    await canvas.setContent(`<!doctype html><style>
      html,body{margin:0;width:1600px;height:800px;overflow:hidden;background:radial-gradient(circle at 50% 45%,#0b1a2e,#04070f 70%)}
      .p{position:absolute;width:300px;height:649px;border-radius:44px;padding:9px;background:linear-gradient(160deg,#1c2640,#0a0f1d 40%,#141c31);box-shadow:0 0 0 1px rgba(148,163,184,.22) inset,0 30px 80px rgba(0,0,0,.55)}
      .p img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:36px;display:block}
      .l{left:250px;top:178px;transform:rotate(-7deg)}.r{right:250px;top:178px;transform:rotate(7deg)}
      .m{left:620px;top:50px;width:360px;height:779px;border-radius:50px;box-shadow:0 0 0 1px rgba(148,163,184,.22) inset,0 40px 110px rgba(0,0,0,.7)}.m img{border-radius:42px}
      .card{top:80px;height:640px;border-radius:32px}.card img{border-radius:24px}
    </style><div class="p l"><img src="${l}"></div><div class="p r"><img src="${r}"></div><div class="p m${middle === '#card' ? ' card' : ''}"><img src="${m}"></div>`);
    await canvas.waitForLoadState('load');
    await canvas.waitForTimeout(200);
    await canvas.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 84 });
    console.log(`${name}.jpg`);
  }
} finally {
  await browser.close();
  process.kill(-server.pid);
}
