# App shell, PWA & deployment (Cloudflare, and GitHub Pages)
- Navigation is companion-first. Sections are hash routes: `#home` (default), `#systems`, `#outlaw`, `#calculators`, `#guides`, `#book1`…`#book6`, `#more`; `#new-system` opens the Add-system editor (home-screen shortcut). Below `lg` a bottom tab bar (Home · Systems · Outlaw · Codex · More) replaces the sidebar; `apps/web/wiki/index.html` carries the same bar.
- Edge-to-edge: `viewport-fit=cover` + `black-translucent` status bar, so fixed/sticky chrome pads with `env(safe-area-inset-*)` (see the App shell block in `apps/web/src/theme.css`).
- Device features (`apps/web/src/app/companion.js`) are feature-detected and degrade silently: Screen Wake Lock ("Keep screen on", stored per device in `localStorage` key `atlas_keep_awake`, not in `nms_state.json`), app-icon badge = ready outlaw stations, `navigator.vibrate` haptics (Android), Web Share for a system, the install prompt, and `navigator.storage.persist()` when installed.
- Old address's build: `.github/workflows/pages.yml` runs on every push to `main` and on demand. It installs with pnpm on Node 24, runs `pnpm index:wiki` on the committed archive (CI never contacts the wiki: the mirror is refreshed by hand from database dumps, ADR-0009), then `pnpm typecheck`, `pnpm lint` and `pnpm test`, runs `pnpm --filter @atlas/web build`, and publishes `apps/web/dist` (the two pages, bundled assets, `sw.js`, icons, manifest, `nms_state.json` and the wiki mirror). Browser tests aren't run in CI (owner's decision): `pnpm check` runs them locally before a push. One-time setup: Settings → Pages → Source: **GitHub Actions**.
- CI hardening (3.15.0):
  - **Permissions per job.** `build` (which runs pnpm and every dependency's code) has `contents: read` and checks out without keeping credentials. No job can push to the repo. `deploy` alone has `pages: write` and `id-token: write`.
  - **The wiki sync step** has a 15-minute timeout and `continue-on-error`. A slow or odd wiki ships the committed archive rather than blocking a deploy.
  - **Every action is pinned by commit.** `.github/dependabot.yml` proposes updates weekly, a week after each release.
  - **npm packages** install only once a day old (`minimumReleaseAge` in `pnpm-workspace.yaml`). Direct dependencies are picked at least a week old by hand.
- Content Security Policy (3.15.0): both built pages carry a meta CSP, added by `contentSecurityPolicy()` in `apps/web/vite.config.ts` at build time only (the dev server injects inline styles).
  - Everything loads from the site itself; `connect-src` adds the sync relay's origin from `VITE_SYNC_URL`; fonts and images also allow `data:`.
  - No inline scripts, styles, eval, frames, plugins or form posts. Zod runs jitless (`src/app/zod-config.ts`, imported first) so its eval probe isn't blocked and logged.
  - A new runtime origin (another API, a CDN) needs a line in that policy. GitHub Pages can't send headers, so `frame-ancestors` comes from `apps/site/_headers` on Cloudflare.
- Sync relay (`apps/sync`, ADR-0005): a Cloudflare Worker with a D1 database, deployed from a developer machine, not CI, so no Cloudflare token is stored in GitHub. One-time setup, from `apps/sync`:
  1. `pnpm exec wrangler login` (a free Cloudflare account).
  2. `pnpm exec wrangler d1 create atlas-sync`, then put the printed `database_id` in `wrangler.toml`.
  3. `pnpm exec wrangler d1 migrations apply atlas-sync --remote`.
  4. `pnpm exec wrangler deploy`. It prints the `https://atlas-sync.<account>.workers.dev` address.

  5. Push alerts (ADR-0006): generate a P-256 VAPID key pair once. Store the private JWK with `pnpm exec wrangler secret put VAPID_PRIVATE_JWK` (never in the repo); put the public key (raw, base64url) in `apps/web/.env` as `VITE_VAPID_PUBLIC_KEY`. `VAPID_SUBJECT` and the minute cron are in `wrangler.toml`. After a new migration, run `wrangler d1 migrations apply atlas-sync --remote` before deploying.

  Put that address in `apps/web/.env` as `VITE_SYNC_URL`. The app shows the Sync group only when it's set; browser tests build with `--mode e2e` (`apps/web/.env.e2e`) and answer a test address themselves. Redeploy with `pnpm exec wrangler deploy` after changing `apps/sync`. Local runs: `wrangler d1 migrations apply atlas-sync --local`, then `pnpm --filter @atlas/sync dev` (port 8787; `http://localhost:4173` and `:5173` are allowed origins). The relay is cross-origin, so the service worker never caches it.
- Relay guardrails and upgrading (`apps/sync/src/capacity.ts`):
  - The relay meters its own use of the plan's daily limits (requests, D1 rows read and written) in its `usage` table, with `PLAN = "free"` in `wrangler.toml`.
  - At 80% of any free daily limit it stops taking new vaults and push devices for the day. At 95% it answers everything but deletes with `503 { capacity: "full" }` and `Retry-After` (midnight UTC). The app then explains, links to Ko-fi, and stops calling until then. At 90% of the 500 MB database it stops taking new vaults.
  - Rate limits per client (IPv4, or IPv6 /64): 60 requests a minute; 3 new vaults or devices a minute; 4 push schedules a minute.
  - `GET /v1/status` gives the last 7 days' usage as aggregate numbers (no ids, no IPs), including how many vaults and push devices were used in the last 30 days. `.github/workflows/relay-usage.yml` reads it daily and opens the issue "Sync relay: time to upgrade?" once any day reaches 60% of a free limit. It also opens "Sync: active-player milestone", once, when 50 vaults were used in the last 30 days (`MILESTONE_VAULTS`), and lists `nms-atlas-mcp`'s monthly npm downloads in the run summary.
  - **Upgrading the relay:**
    1. In Cloudflare, Workers & Pages → Plans → Workers Paid ($5/month).
    2. Set `PLAN = "paid"` in `apps/sync/wrangler.toml` and run `pnpm exec wrangler deploy`. Daily caps no longer apply; only the 10 GB database size does, and a run sends up to 40 pushes.
    3. In Cloudflare → Notifications, add a usage-based billing alert (for example at $10), since paid usage beyond the monthly allowance is billed.
- Site URL: `https://atlas-os.cloud/app/` (ADR-0010). GitHub Pages still serves `https://relmaur.github.io/nms-os/` until the owner approves its "moved" build. Every path in the app is relative, so one codebase works in either folder.
- Cloudflare (ADR-0010): the Worker `atlas-os` serves `apps/web/dist-site` as static assets, no code (root `wrangler.toml`), on the custom domain `atlas-os.cloud`.
  - **Builds:** Cloudflare's Git integration builds each push to `main`. Its settings (Workers & Pages → atlas-os → Settings → Build) are build command `pnpm run build`, deploy command `npx wrangler deploy`, root directory `/`. No build variables are needed: `apps/web/.env` and `.env.site` are committed and hold nothing secret.
  - **`pnpm build`** indexes the wiki archive, builds the app into `dist-site/app` with `--mode site`, builds the product page (`apps/site`) into the root of `dist-site`, and copies `apps/site/_headers` and `_redirects` to the root. A plain `pnpm --filter @atlas/web build` still makes `dist/` for GitHub Pages and for `pnpm preview`.
  - **Try the real layout locally:** `pnpm build`, then `pnpm exec wrangler dev --port 8799`, and open `http://localhost:8799/app/`. (Sync won't answer there: the relay's route exists only on the domain.)
  - **Relay:** deployed from a developer machine, as before. Its route `atlas-os.cloud/api/sync/*` runs ahead of the site's custom domain.
  - **No beacon:** Cloudflare injected its analytics script into the first live pages even with Web Analytics unset. Pages carry `no-transform` so it can't, and the CSP would block it anyway. After changing `_headers`, fetch a page with a browser's `Accept: text/html` and look for `cloudflareinsights`.
  - **On the zone, by hand:** SSL/TLS → Edge Certificates → Always Use HTTPS on, Minimum TLS 1.2. Network Error Logging (the `nel` header) off. Web Analytics and Browser Insights stay off. Raising HSTS past its one day in `_headers`, or preloading, is the owner's call.
  - **What would trip Workers Paid** (free daily limits, reset at midnight UTC): 100,000 Worker requests across the account (static asset requests are free and uncounted; relay requests count), and D1's 100,000 rows written and 5 million rows read. The relay rations itself (below), and `relay-usage.yml` opens an issue at 60%. Static assets are capped at 20,000 files and 25 MiB each; a build is about 3,300 files, the largest 7 MB.
  - **Moving a log:** a new origin is a new app on each device. Export on the old address and Import on the new one, or pair both with the sync code. The relay allows both origins until the old site retires.
- Service worker (`apps/web/src/sw/sw.ts`, Workbox via vite-plugin-pwa, served as `sw.js` so installed apps update in place):
  - **Precached** under content-hash revisions: the pages, bundled JS/CSS, icons, manifest, Latin and Greek font files, and `wiki/*.json` + `offline-bundle.js`. A deploy that changes any of them installs a new worker, which takes over at once (`skipWaiting` + `clientsClaim`); the next open shows the new version.
  - **Network-first** (5 s): `nms_state.json` and `wiki/verification.json`, also fetched while the worker installs, since the first visit loads them before the worker controls the page.
  - **Stale-while-revalidate:** wiki articles (`wiki/**/*.md`), cached as they are read. **Cache-first:** other font subsets.
  - The pre-3.1 worker's caches (`atlas-os-*`) are deleted on activate.
  - The worker registers only in production builds (`pnpm build` / `pnpm preview`), not under `pnpm dev`.
- Service workers only run on HTTPS or `localhost`. Over a plain-http LAN address the app works online-only.
- `nms_state.json` is published with the site. Edits made on a phone stay in that phone's browser storage; use Export/Import to move them, and commit the exported file as `apps/web/public/nms_state.json` to update the shared copy.
- Icons: edit `apps/web/public/assets/icons/icon.svg` / `icon-maskable.svg` (Phosphor "planet" fill), then re-render the PNGs at 192, 512, 512 (maskable) and 180 (apple-touch).
