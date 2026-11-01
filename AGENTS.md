# AGENTS.md — ATLAS:OS

Local-first No Man's Sky companion (TypeScript, pnpm workspace, Vite): Systems log, Outlaw Run, calculators on a verified wiki mirror, the Codex, a six-book guide, opt-in encrypted sync through a small Cloudflare Worker (`apps/sync`), and a local, read-only MCP server for AI assistants (`apps/mcp`). Installable PWA at https://atlas-os.cloud/app/ (Cloudflare, ADR-0010; https://relmaur.github.io/atlas-os/ is the old copy, kept so a log saved there can be exported)

## Read first
- `docs/STATE.md`: current work, blockers, open decisions, next steps. Update it before ending any non-trivial task.
- `docs/process/build-prompt.md`: the development protocol (gates, graph, standards, building from design, policy gates, done criteria). `docs/process/applicability.md` says which parts bind this project today.
- Load the scoped doc for the area you touch:
  - `docs/architecture.md`: layout, data flow, boundaries.
  - `docs/state-schema.md`: `nms_state.json` shape and merge rules.
  - `docs/wiki-mirror.md`: mirror scope, sync/verify, frontmatter.
  - `docs/calculators.md`: what calculators may compute.
  - `docs/deploy.md`: navigation, PWA, service worker, CI/CD.
  - `docs/mcp.md`: the MCP server for AI assistants.
  - `docs/adr/`: decisions and their trade-offs.

## Invariants
- **Stack (ADR-0004):** strict TypeScript in `packages/`; Vite builds `apps/web`; the whole UI is React (`apps/web/src/ui/`); no inline handlers. Every dependency is bundled and pinned by `pnpm-lock.yaml`; nothing loads from a CDN at run time.
- **`packages/core` stays pure:** no DOM, no Node APIs. The web app, the wiki scripts and a future API all import it.
- **Parse, don't cast:** data from outside the code (files, storage, network) goes through a Zod schema before use.
- **Relative paths everywhere**, since the app lives in a subfolder (`/app/`).
- **User data stays on the device** (`localStorage` key `nms_master_os_state`). Nothing is sent anywhere except by an explicit Export (ADR-0002), the opt-in sync copy, encrypted on the device with a key the relay never sees (ADR-0005), with "Alerts when the app is asleep" on, a push address plus running timers' ids and end times (ADR-0006), and, when the player sets up the MCP server on their computer, tool answers from their log to the AI client they chose (ADR-0008; it only reads). Any other change is a Data Privacy gate.
- **State compatibility:** every saved or exported `nms_state.json` must keep loading. Shape changes are additive, with a migration in the state module, or a MAJOR release.
- **Game facts come only from the wiki mirror** (`wiki/game-data.json`), never hand-typed. Anything the wiki can't know is a labelled user input (ADR-0003).
- **Never hand-edit mirrored files** in `wiki/<category>/`: the sync overwrites them. Never delete them; the sync flags removals. Your own articles go in `wiki/custom/`.
- **Offline:** the service worker precaches the build automatically. A new runtime fetch (outside the build) needs a route in `apps/web/src/sw/sw.ts` and a check in the `offline` Playwright project.

## Commands
| Command | What it does |
|---|---|
| `pnpm install` | Install (Node ≥ 24; pnpm via corepack, version pinned in `package.json`) |
| `pnpm dev` | Vite dev server for the app (`pnpm start` is an alias) |
| `pnpm build` / `pnpm preview` | Build `apps/web/dist` / serve the build |
| `pnpm mcp` | Start the MCP server over stdio (normally the AI client starts it; `docs/mcp.md`) |
| `pnpm index:wiki` | Rebuild derived wiki files from the committed archive (run after a fresh clone) |
| `pnpm sync:wiki --from-dump <file>` | Sync the mirror from a wiki database dump (kept outside the repo; ADR-0009), record verification, reindex |
| `pnpm verify:wiki --from-dump <file>` | Dry run: does the archive match the dump? Exit 1 if not |
| `pnpm typecheck` | `tsc` for packages, scripts, tests, the web app and the service worker |
| `pnpm lint` / `pnpm format` | ESLint (typescript-eslint strict, type-checked) / Prettier |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | Build, then Playwright on desktop, phone and offline |
| `pnpm check` | typecheck + lint + unit + e2e: must pass locally before pushing code changes (CI runs all but e2e) |

## Coding standards
- Match the surrounding code: naming, comment density, Tailwind utility style, `escapeHtml` for every interpolated string in HTML templates.
- Comments explain *why* (domain rules, trade-offs, fallbacks), not what.
- YAGNI: the smallest reversible change; no new abstraction without a second use.
- Pure logic goes in `packages/core` with unit tests; DOM code stays in `apps/web`.
- New or moved screens are React: `apps/web/src/ui/<screen>/*.tsx`, logic in `@atlas/core`, state via `useAppState()` + actions, no inline handlers, a component test, and an axe gate (`docs/architecture.md`, React screens).
- TypeScript: no `any`; types for external data come from Zod schemas (`z.infer`); a cast needs a comment saying what proved it safe.
- External I/O gets a timeout and a visible fallback. Never fail silently on user data.
- Diagnostics: one structured `console.warn('[atlas]', { event, ... })` line, never user content.

## Policy gates (halt and ask)
- **Destructive:** deleting committed files (outside the wiki sync), dropping state keys, rewriting git history.
- **Major release:** breaking saved or exported state, bookmarked URLs, or a supported way of running the app.
- **Data privacy:** any change to where user data is stored or sent.
- **Public surface:** renaming the product, the npm package, the URL or the PWA identity; publishing a package.
- **Firewall:** nothing from the owner's private notes enters the repo, commits, issues, PRs or ADRs.

## Definition of done
`pnpm check` passes. `docs/STATE.md` is updated. `CHANGELOG.md` has an entry under `[Unreleased]` (SemVer). Any ADR needed is written. No gate is left open.
