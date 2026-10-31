# ADR-0010: One home on Cloudflare, at atlas-os.cloud

- **Status:** Accepted (2026-10-31). The owner bought the domain and asked for the move, before launch, because a PWA's data belongs to its origin and only the owner has a log today. GitHub Pages keeps serving the old address until the owner approves its last "moved" build.

## Context
The site has been on GitHub Pages at `https://relmaur.github.io/nms-os/`. That origin is shared with everything else on `relmaur.github.io`, so another page there could read the app's `localStorage` (the 3.15.0 audit's open item). GitHub Pages can't send response headers, so framing couldn't be refused. The relay already runs on the owner's Cloudflare account (ADR-0005), on another origin, so the app needs CORS and a CSP exception to reach it.

## Decision
| Address | What | Runs on |
|---|---|---|
| `atlas-os.cloud/` | The product page (`apps/site`) | Worker `atlas-os`, static assets only |
| `atlas-os.cloud/app/` | The app; manifest and service worker scope follow its folder | Same |
| `atlas-os.cloud/api/sync/*` | The relay | Worker `atlas-sync` + D1, on a route |

- **Build:** `pnpm build` makes `apps/web/dist-site/`: the app in `app/` (`--mode site`), the product page at the root, `_headers` and `_redirects` from `apps/site/` at the root. Cloudflare's Git integration runs it on every push to `main`, then `npx wrangler deploy` (the pinned root Wrangler, root `wrangler.toml`). Node comes from `.node-version`, pnpm from `packageManager`. GitHub Actions still runs the gate and still deploys the old site from a plain `vite build`.
- **Paths stay relative,** so nothing in the app names `/app/`. The manifest's `id`, `start_url` and `scope` and the service worker's scope all resolve to the app's folder.
- **The relay is same-origin:** the site build's `VITE_SYNC_URL` is `/api/sync`, so the CSP is `'self'` only and the app calls no other origin. The relay strips that prefix, and still answers on workers.dev for the old site and published MCP servers.
- **Headers** (`apps/site/_headers`): the CSP plus `frame-ancestors 'none'`, HSTS at one day, `no-referrer`, `nosniff`, a tight `Permissions-Policy`. Hashed assets are cached for a year as immutable; pages, manifest and `sw.js` are `no-cache`.
- **No logs, no analytics:** Workers observability is off on the site and the relay, and Cloudflare's Web Analytics and Browser Insights stay off.

## Consequences
- **A new origin is a new app on each device.** The log saved under `relmaur.github.io` stays there, and `atlas-os.cloud` opens empty. Move it with Export → Import, or by pairing with the sync code. Installed apps must be installed again. Push subscriptions don't carry over; the app subscribes again on the new origin.
- **Privacy:** user data leaves the device only as before (ADR-0002, 0005, 0006, 0008). Cloudflare now sees page requests (IP address, user agent, path), as GitHub did. Hash routes, so what a player opens inside the app, reach no server. Sealed sync copies go to the same relay and database at a new address.
- **Retiring the old address needs three things first:**
  - the owner's log has made the trip;
  - a new `nms-atlas-mcp` is published, since published versions download game data from `relmaur.github.io/nms-os/wiki/` and use the workers.dev relay, so the last Pages build must keep serving those files;
  - the "moved" build: a banner with Export, and no redirect before the player has had the chance to export. Then `github.io` leaves `ALLOWED_ORIGINS`.
- **Still to come:** the Codex bundles on R2 at `dl.atlas-os.cloud` arrive with the full Codex, `/api/wiki` after it, and `hello@atlas-os.cloud` through Email Routing.
