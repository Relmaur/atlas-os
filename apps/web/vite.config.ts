// Builds the two pages (the app and the Codex) with relative URLs, since the app lives in a subfolder: /app/ on
// atlas-os.cloud (`pnpm build`, into dist-site/app) and /nms-os/ on GitHub Pages (plain `vite build`, into dist). public/wiki is a symlink to the repo's wiki mirror, copied into the build as-is.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { latestOf, parseUpdate } from '@atlas/core/updates';

// A Content Security Policy for both built pages: everything comes from the site itself, except the sync relay it
// talks to, when that's on another origin; no inline or injected scripts, styles, frames or plugins. Build only: the
// dev server injects inline styles. (frame-ancestors can't be set from a meta tag: apps/site/_headers sets it.)
function contentSecurityPolicy(relay: string): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src 'self'${relay.startsWith('http') ? ` ${new URL(relay).origin}` : ''}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'"
  ].join('; ');
  return {
    name: 'atlas-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }
    ]
  };
}

// The newest update (updates/*.md), for Home's "What's new" card. A new file there is what makes a new card appear.
function latestUpdate() {
  const dir = new URL('../../updates/', import.meta.url);
  const index: unknown = JSON.parse(readFileSync(new URL('../../wiki/index.json', import.meta.url), 'utf8'));
  const wikiPages = Array.isArray(index) ? index.length.toLocaleString('en-US') : '';
  return latestOf(
    readdirSync(dir)
      .filter(file => file.endsWith('.md') && file !== 'README.md')
      .map(file => parseUpdate(readFileSync(new URL(file, dir), 'utf8'), { wikiPages }))
  );
}

// What Settings says this build is: the release, the commit and the day it was built. Cloudflare and GitHub name the
// commit in their build environment; a local build asks git.
function commit(): string {
  const named = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (named) return named.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'local';
  }
}
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig(({ mode }) => ({
  base: './',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
    'import.meta.env.VITE_APP_COMMIT': JSON.stringify(commit()),
    'import.meta.env.VITE_APP_BUILT': JSON.stringify(new Date().toISOString().slice(0, 10)),
    'import.meta.env.VITE_LATEST_UPDATE': JSON.stringify(JSON.stringify(latestUpdate()))
  },
  plugins: [
    contentSecurityPolicy(loadEnv(mode, import.meta.dirname, 'VITE_').VITE_SYNC_URL ?? ''),
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: [
          '**/*.{html,js,css,webmanifest}',
          'assets/icons/*',
          '**/*-{latin,greek}-*.woff2', // with -ext; Greek too, for names like "Aeron-ημ"
          'assets/Phosphor*.woff2',
          'wiki/*.json'
        ],
        globIgnores: ['wiki/verification.json', 'wiki/custom/**'], // woff2 is enough: skip Phosphor's SVG/TTF fallbacks
        // The Codex's full-text bundle is ~7 MB and the dataset ~2.5 MB; both are needed offline.
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024
      }
    })
  ],
  build: {
    rolldownOptions: { input: { main: 'index.html', codex: 'wiki/index.html' } }
  }
}));
