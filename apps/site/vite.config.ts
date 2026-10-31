// Builds the product page. Its two big numbers are counted here, from the same wiki files the app ships, and written
// into the HTML, so they can't drift and the page is complete without a script.
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { z } from 'zod';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { GameDataSchema } from '@atlas/core/game-data';
import { makeCatalog } from '@atlas/core/planner';
import { rankCrafts } from '@atlas/core/profit';
import { newestFirst, parseUpdate } from '@atlas/core/updates';
import { renderFeed, renderList, renderUpdate } from './src/updates-render.ts';

const wikiFile = (name: string) => new URL(`../../wiki/${name}`, import.meta.url);

function counts() {
  const index: unknown = JSON.parse(readFileSync(wikiFile('index.json'), 'utf8'));
  if (!Array.isArray(index)) throw new Error('wiki/index.json is not a list');
  const data = GameDataSchema.parse(JSON.parse(readFileSync(wikiFile('game-data.json'), 'utf8')));
  return { pages: index.length, crafts: rankCrafts(makeCatalog(data)).crafts.length };
}

const STATUS_BAR = `<div class="sb" aria-hidden="true"><span class="sb-t">9:41</span><span class="sb-i"><svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx=".8"/><rect x="5" y="5.5" width="3" height="6.5" rx=".8"/><rect x="10" y="3" width="3" height="9" rx=".8"/><rect x="15" y="0" width="3" height="12" rx=".8"/></svg><svg viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0zM3.3 6.8a6.6 6.6 0 0 1 9.4 0l-1.6 1.6a4.4 4.4 0 0 0-6.2 0zM1 4.5a9.9 9.9 0 0 1 14 0l-1.6 1.6a7.6 7.6 0 0 0-10.8 0z"/></svg><svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3.2" fill="none" stroke="currentColor" stroke-opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="2"/><rect x="24.6" y="4" width="1.8" height="4" rx=".8" fill-opacity=".45"/></svg></span></div><span class="island"></span>`;

// The phone screens: real app screenshots (scripts/site-screens.mjs), which say how tall they came out.
const screens = z
  .record(z.string(), z.number())
  .parse(JSON.parse(readFileSync(new URL('public/screens/sizes.json', import.meta.url), 'utf8')));
function screenHeight(name: string) {
  const height = screens[name];
  if (!height) throw new Error(`No screen called ${name}: run scripts/site-screens.mjs`);
  return height;
}
const screenImage = (name: string) =>
  `<img class="screen-img" src="./screens/${name}-2x.webp" srcset="./screens/${name}-2x.webp 780w, ./screens/${name}-3x.webp 1170w" sizes="340px" width="390" height="${String(screenHeight(name))}" loading="lazy" decoding="async" alt="">`;

function fillPage(): Plugin {
  return {
    name: 'atlas-site-page',
    transformIndexHtml: html => {
      const { pages, crafts } = counts();
      return html
        .replaceAll('{{pages}}', pages.toLocaleString('en-US'))
        .replaceAll('{{crafts}}', crafts.toLocaleString('en-US'))
        .replaceAll('{{statusBar}}', STATUS_BAR)
        .replace(/\{\{img:(\w+)\}\}/g, (_, name: string) => screenImage(name))
        .replace(/\{\{h:(\w+)\}\}/g, (_, name: string) => String(screenHeight(name)));
    }
  };
}

// The update files (updates/*.md), with their counts filled in. Read fresh for each page, so editing one shows in dev.
const updatesDir = new URL('../../updates/', import.meta.url);
function readUpdates() {
  const wikiPages = counts().pages.toLocaleString('en-US');
  return newestFirst(
    readdirSync(updatesDir)
      .filter(file => file.endsWith('.md') && file !== 'README.md')
      .map(file => parseUpdate(readFileSync(new URL(file, updatesDir), 'utf8'), { wikiPages }))
  );
}

// /updates/, a page per update and /updates.xml: no HTML files to keep, only what the update files say. They're emitted
// beside the page's own build, or served as they're asked for in dev.
function updatesPages(): Plugin {
  return {
    name: 'atlas-site-updates',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split(/[?#]/)[0] ?? '';
        const updates = () => readUpdates();
        if (path === '/updates.xml') {
          res.setHeader('Content-Type', 'application/atom+xml');
          res.end(renderFeed(updates()));
          return;
        }
        const match = /^\/updates\/(?:([a-z0-9-]+)\/)?$/.exec(path);
        if (!match) {
          next();
          return;
        }
        const assets = '<script type="module" src="/src/updates.ts"></script>';
        const all = updates();
        const update = all.find(item => item.slug === match[1]);
        if (match[1] && !update) {
          next();
          return;
        }
        const html = update ? renderUpdate(update, update === all[0], assets) : renderList(all, assets);
        void server.transformIndexHtml(path, html).then(page => {
          res.setHeader('Content-Type', 'text/html');
          res.end(page);
        });
      });
    },
    generateBundle(_, bundle) {
      const entry = Object.values(bundle).find(file => file.type === 'chunk' && file.name === 'updates');
      if (entry?.type !== 'chunk') throw new Error('The Updates script is missing from the build');
      const css = [...(entry.viteMetadata?.importedCss ?? [])].map(file => `<link rel="stylesheet" href="/${file}">`);
      const assets = [...css, `<script type="module" src="/${entry.fileName}"></script>`].join('\n');
      const all = readUpdates();
      this.emitFile({ type: 'asset', fileName: 'updates/index.html', source: renderList(all, assets) });
      this.emitFile({ type: 'asset', fileName: 'updates.xml', source: renderFeed(all) });
      for (const update of all)
        this.emitFile({
          type: 'asset',
          fileName: `updates/${update.slug}/index.html`,
          source: renderUpdate(update, update === all[0], assets)
        });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), fillPage(), updatesPages()],
  build: {
    rolldownOptions: {
      input: {
        main: new URL('index.html', import.meta.url).pathname,
        updates: new URL('src/updates.ts', import.meta.url).pathname
      }
    }
  }
});
