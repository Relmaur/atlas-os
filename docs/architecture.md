# Architecture

ATLAS:OS is a static web app built by Vite: two HTML pages plus bundled modules, served from GitHub Pages and installable as a PWA. Nothing runs on a server but the opt-in sync relay, which stores only copies sealed on the device; user data lives in the browser (ADR-0002, ADR-0005). The stack and its migration plan are ADR-0004.

## Layout
```text
atlas-os/                        pnpm workspace
├── packages/
│   ├── core/                    @atlas/core: pure TypeScript (no DOM, no Node APIs), imported as @atlas/core/<module>
│   │   ├── src/util.ts / format.ts   escapeHtml, isPlainObject, text coercion; durations and dates
│   │   ├── src/state.ts         DEFAULT_STATE, layered merge, legacy migration, AppState type
│   │   ├── src/schema.ts        Zod schema for the state document; validateState() / describeErrors()
│   │   ├── src/systems-model.ts System type, normalisation, logbook migration, outlaw status
│   │   ├── src/home.ts / systems-list.ts / outlaw.ts   What Home, Systems and Outlaw Run show (pure, unit-tested)
│   │   ├── src/planner.ts / calc.ts   Recipe planner and build order over wiki/game-data.json; small calculators
│   │   ├── src/search.ts        Codex search engine and labels
│   │   ├── src/game-data.ts     Zod schemas for game-data.json and recipes (shared with the wiki sync)
│   │   ├── src/facts.ts         Cited facts: value shapes and the facts.json schema (ADR-0003)
│   │   ├── src/glyphs.ts        Portal glyph names, read from the wiki's glyph pages, per address digit
│   │   ├── src/planets.ts       A planet scan's words from the wiki: biome prefixes, weather severity, sentinel levels
│   │   ├── src/galaxy-map.ts    The galaxy map's words from the wiki: spectral class colours, economy names and strengths
│   │   ├── src/gear.ts / notes.ts   Ships, Multi-Tools and Exosuit (slot rules from cited facts); notes and pins
│   │   ├── src/slug.ts          Article file names (shared with the wiki sync)
│   │   ├── src/sync.ts / sync-crypto.ts   Three-way merge of two copies; the sync code, key derivation and sealing (Web Crypto)
│   │   └── test/                Vitest
│   └── wiki/                    @atlas/wiki: the mirror's sync, parser and API schema; Node runs the .ts directly
│       ├── src/sync.ts          Orchestration: sync, verify, index, discover (pnpm sync:wiki | verify:wiki | index:wiki)
│       ├── src/dump.ts          Streams a MediaWiki XML dump: pages, revisions, redirects, the scope rule
│       ├── src/discover.ts      The scope report for widening the mirror (read-only)
│       ├── src/wikitext.ts      Wikitext → Markdown + structured data; article frontmatter schema
│       └── test/                Vitest, on real page fixtures (tests/fixtures/wikitext/)
├── apps/web/                    @atlas/web: the PWA
│   ├── index.html               Main app: Home, Systems, Outlaw Run, Calculators, Guides (6 books), More
│   ├── wiki/index.html          The Codex page, served at /wiki/ (hash routes #/?q=… and #/a/<path>)
│   ├── src/ui/                  The whole UI in React (ADR-0004), mounted by mount.tsx
│   │   ├── session/             The Session screen (#session: the session, timers, recap), the add-timer sheet, the session bar and timer-runner.ts (alerts)
│   │   ├── shell/               The main page's frame: header + search, sidebar, tab bar, storage banner; section-store.ts (hash routing), wiki-index.ts
│   │   ├── home/ systems/ outlaw/ calculators/ guides/ more/   One folder per screen; systems/ also holds the system panel and editor; guides/books/ holds the six books; more/device-store.ts is keep-awake, install and storage protection
│   │   ├── systems/panel-store.ts   Which system the panel shows + the Systems filter (shared by several screens)
│   │   ├── codex/               The Codex page (wiki/index.html): main.tsx entry, hash route store, browse, article + index, sheets
│   │   └── parts/, actions.ts, useAppState.ts, useNow.ts   Shared pieces (incl. Sheet.tsx, every phone bottom sheet), store actions, state and clock hooks
│   ├── src/app/                 Non-UI modules the screens share
│   │   ├── main.ts              Main page entry: mounts the frame, loads the state, mounts the screens, opens the section
│   │   ├── backup.ts            Export/Import of nms_state.json (More and the header)
│   │   ├── sync.ts              Opt-in sync: pairing, the pull-merge-push cycle and its triggers, the status More shows
│   │   ├── push.ts              Opt-in push alerts for timers: the switch's state, the schedule sent to the relay, the notification words kept for the service worker
│   │   ├── store.ts             appState: load, validate, save, tab sync, storage status; subscribe() for React
│   │   ├── ui.ts                Toast and haptics
│   │   ├── wiki-data.js         Wiki index/bundle loading (parsed with @atlas/core/wiki-files) + drafts; exports WikiSearch
│   │   └── pwa.js               Registers the service worker (production builds only)
│   ├── src/sw/sw.ts             Service worker (Workbox), built to dist/sw.js
│   ├── src/styles.css / codex.css   Each page's stylesheet: fonts.css, theme.css (+ codex-page.css), tailwind.css (+ tokens.css)
│   ├── public/                  Copied into the build as-is: icons, manifest, nms_state.json, wiki → ../../../wiki
│   └── vite.config.ts           Two pages, relative base (the app lives under /app/), PWA plugin
├── apps/sync/                   @atlas/sync: the relay, a Cloudflare Worker + D1: sync vaults (handler.ts) and timer pushes with a minute cron (push.ts); tested without Cloudflare; wrangler.toml; migrations/
├── apps/mcp/                    @atlas/mcp: the local, read-only MCP server for AI assistants (ADR-0008, docs/mcp.md): wiki.ts (the mirror's indexes), wiki-remote.ts (the published package's cached download from the live site), log.ts (sync code or exported file), tools.ts; vite.config.ts bundles it for npm (nms-atlas-mcp)
├── wiki/<category>/*.md         Mirrored wiki pages (committed) + aliases.json; derived indexes are git-ignored
├── tests/e2e/                   Playwright on the built app: desktop, phone, offline
├── docs/                        This documentation, ADRs, STATE.md, process
└── .github/workflows/pages.yml  Sync → typecheck, lint, unit → commit wiki back → build → deploy (docs/deploy.md)
```

## Runtime data flow
1. **State:** the app builds its state from built-in defaults ← `nms_state.json` (fetched) ← `localStorage` (`nms_master_os_state`), after validating each document (`validateState`), then renders every section from that single object. Every change goes through `saveAppState()`, which stamps `meta.lastUpdated`, writes `localStorage`, and re-renders.
2. **Wiki data:** the main page's header search loads the light `wiki/index.json`. The Codex page loads `wiki/offline-bundle.js` (bodies, recipes, aliases). Calculators load `wiki/game-data.json` on first open and parse it with `GameDataSchema`. The system editor loads the small `wiki/galaxies.json` (`GalaxiesFileSchema`, `packages/core/src/location.ts`) for its galaxy picker. The gear editor and the system editor load the small `wiki/facts.json` (cited facts, ADR-0003) on first open and parses it with `FactsFileSchema` (`packages/core/src/facts.ts`). The index, the bundle, `verification.json` and drafts are parsed with the schemas in `packages/core/src/wiki-files.ts`. All three are derived from the committed `.md` archive by `pnpm index:wiki`.
3. **Sync (opt-in, ADR-0005):** after load, 3 s after a save, when the app comes back into view or online, and every 2 minutes while visible, `app/sync.ts` pulls the sealed cloud copy, merges it three-way with this device's copy, adopts the result through the store, and pushes it back with the version it was based on (a 409 means another device wrote first: merge again).
4. **Push alerts (opt-in, ADR-0006):** with the switch on, `app/push.ts` sends the relay this device's push subscription and the ids and end times of pending timers whenever they change, and writes each timer's notification words to the `atlas-timer-notes` cache. The relay's minute cron pushes `{ t: id }` when one is due, and the service worker's `push` handler shows the saved words.
5. **Offline:** the service worker precaches the build (pages, modules, styles, icons, Latin and Greek fonts) and the wiki indexes under content-hash revisions. `nms_state.json` and `wiki/verification.json` are network-first; wiki articles are cached as they are read (docs/deploy.md).

## Module model
- `@atlas/core` is the only home for logic that doesn't touch the DOM. Its types come from its Zod schemas where data crosses a boundary (state documents, game data) and from interfaces for the normalised in-memory shapes (`AppState`, `System`).
- **Parse, don't cast:** anything read from outside the code is parsed before use: imports, `localStorage`, `nms_state.json`, `game-data.json`, wiki API responses and article frontmatter. Remaining unparsed inputs are listed in `docs/STATE.md`.
- Only `store.ts` reassigns `appState`; actions read the live binding, mutate it, and call `saveAppState()`. `src/ui/shell/section-store.ts` lets features react to a section opening through `onSection()` (Calculators loads its data there), which avoids import cycles.
- Neither page has inline `on…=""` handlers; `tests/unit/no-inline-handlers.test.mjs` keeps it that way.

## React screens (ADR-0004 step 3)
- Each screen lives in `apps/web/src/ui/<screen>/` and is mounted once into its container in `index.html` (`#homeRoot`, `#systemsRoot`, `#outlawRoot`, `#calculatorsRoot`, `#systemPanelRoot`, `#guidesRoot`, `#book1Root`…`#book6Root`, `#moreRoot`, `#gearRoot`, `#notesRoot`, and `#playerEditorRoot` for the gear and note editors) by `src/ui/mount.tsx`, after the state loads, so none flashes the built-in defaults. The frame (`#headerRoot`, `#sidebarNav`, `#tabBarRoot`, `#storageBannerRoot`) mounts first, so it never blinks in; its counts read 0 until the state is loaded (`isLoaded()`).
- **Sections:** `index.html` keeps one `<section id="sec-…">` shell per screen; `section-store.ts` shows the one named in the hash (`#logbook` opens Systems, `#new-system` opens Home with the editor, anything unknown opens Home) and tells the sidebar and tab bar where you are. All six books stay mounted (hidden) so the header search can find and scroll to their text. The Codex is its own page: `wiki/index.html` mounts `#codexRoot` from `src/ui/codex/main.tsx`, and its place lives in the URL hash (`src/ui/codex/route.ts`).
- **Phone sheets** (bottom drawers below 768px) share `src/ui/parts/Sheet.tsx`: the grab bar is the only close control on a phone (a button: tap or drag down; plus backdrop and Esc), the ✕ shows from md up, and a sheet holding unsaved typing refuses a swipe and says why.
- **State:** `useAppState()` returns the live `appState` and re-renders on every change. The store mutates one object in place, so React subscribes to `getVersion()` through `useSyncExternalStore`; the version moves after every load, save and adopted tab copy. Components change state only through actions (`src/ui/actions.ts`) that mutate, `saveAppState()` and confirm.
- **What a screen shows** is computed by a pure function in `@atlas/core` (e.g. `homeSummary()`), unit-tested; components only render it. `useNow()` supplies the clock (every minute and on returning to the app).
- **The player's own content** (3.14.0, ADR-0007): Ships & Multi-Tools (`src/ui/gear/`) and Notes (`src/ui/notes/`). Their editors open from anywhere (Home, a book's "Your notes" block, the screens) through `src/ui/parts/editor-store.ts` and render once in `src/ui/PlayerEditors.tsx`, as dialogs from `src/ui/parts/Modal.tsx`. Notes and gear notes render Markdown through `src/ui/parts/safe-html.ts`, the strict allowlist the Codex shares; a book's pinned notes carry `data-player`, so the header search's book index skips them.
- **Screen state shared across screens** that isn't saved (which system the panel shows, the Systems filter) lives in a small store next to its screen (`src/ui/systems/panel-store.ts`), read with `useSyncExternalStore`. Other screens call it through direct imports (`openSystem` from the header search), never `window`.
- **Session and timers:** `timer-runner.ts` (started by `main.ts` after the state loads) arms one timeout for the next unannounced finish and re-arms after every change and on returning to the app. It marks the timer `alerted` before announcing (toast, vibration, and a notification through the service worker, whose `notificationclick` opens the app), so a finish is announced once across reloads and tabs. A web app can't wake itself without a push server: a timer that finishes while the browser has suspended the page is announced on return. Notification permission is asked only from the tap that adds a timer.
- **Notes and other typing** keep their draft in the component and save through the store; the two-tab rules (unsaved typing is carried into another tab's copy; stored text shows whenever nothing is being typed) live with the notes in `SystemDetails.tsx`.
- Tests: component tests next to the screen (`*.test.tsx`, Vitest + Testing Library in happy-dom); axe gates every screen and the whole page frame (`tests/e2e/a11y.spec.mjs`). Under happy-dom, DOMPurify doesn't sanitise reliably (it keeps `javascript:` links and images, and drops the tags of a document's first element), so sanitising is tested in the browser (`tests/e2e/player.spec.mjs`), and Markdown fixtures start with a paragraph.

## Styling
- Tailwind v4 is compiled at build time, with its own base styles in their cascade layer. The app's CSS (`theme.css`, `codex-page.css`) and Tailwind's utilities are unlayered, utilities last, so they resolve by specificity: a utility wins a tie with a component class, and a more specific app rule (`main.app-main`'s tab-bar padding over `py-5`) still wins.
- Design tokens live in `apps/web/src/tokens.css` (`@theme static`, imported by `tailwind.css`): each one is a CSS variable on `:root` and a utility (`bg-void`, `rounded-card`, `text-screen-title`). `static` keeps unused tokens as variables, for hand-written CSS and SVG. `apps/web/DESIGN.md` documents them; redesigned screens use only these names.
- `space-y-*` in v4 spaces every child but the last, hidden ones included: a container whose last child can be hidden (a closed form, inactive panels) uses explicit margins or wraps them instead.
- Fonts (Inter, Orbitron, JetBrains Mono) and Phosphor icons are bundled from npm; nothing loads from a CDN.

## External boundaries
- **Wiki content** comes only from Fandom's database dumps of the wiki, read by the sync on the owner's machine (ADR-0009). Nothing calls the wiki's API: not CI, not the browser.
- **No CDNs at run time.** Every library is bundled and pinned by `pnpm-lock.yaml`.
- **No backend, no telemetry, no third-party data sharing.** Export/Import is the only way user data leaves a device (ADR-0002).
