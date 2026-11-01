# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
No Man's Sky players, on a phone propped beside the PC, glancing at the app mid-session between in-game actions. It began as the owner's own companion and is being shared with the NMS community (3.14.0): the app itself is general, and each player's own ships, notes and progress live in their log. Installed as a PWA; must work offline.

## Product Purpose
ATLAS:OS (formerly ATLAS // MASTER OS) is a local-first No Man's Sky companion: a log of visited systems, an Outlaw Run planner for Suspicious Packet loops, calculators over a verified wiki mirror, a Codex of wiki articles, a six-book guide, and the player's own ships, Multi-Tools and notes (pinnable to Home or a book). Success is answering an in-game question in a glance and a tap, without alt-tabbing or losing place in the game.

## Positioning
Every game fact comes from a verified mirror of the No Man's Sky wiki (`wiki/game-data.json`), never hand-typed and never community-crafted data; anything the wiki can't know is a labelled player input. User data never leaves the device except by explicit Export, or the opt-in sync copy, which is encrypted on the device and unreadable to the relay (ADR-0005).

## Operating Context
- Mid-session use: one hand, short glances, the game's own crafting/refiner menus open on the PC.
- The recipe planner serves four jobs, all confirmed: a shopping list of raw materials to farm or buy before starting; crafting along, following the steps in order and ticking off what's done; comparing alternative recipes before committing; checking whether a craft is worth it (value versus inputs).
- Offline after one online visit (service worker precache).

## Capabilities and Constraints
- Static PWA on Cloudflare under `/app/`; React + TypeScript + Vite; Tailwind compiled at build time; no CDNs at run time (docs/architecture.md, ADR-0004).
- Calculators may only show wiki data, arithmetic on it, or player inputs (docs/calculators.md). The planner expands crafting and cooking recipes to items with no such recipe, rounds up multi-output crafts to whole batches, and lets the player switch alternative recipes per item.
- Saved state shape is a compatibility contract (docs/state-schema.md); changes are additive.
- Session mode (3.9.0): a session bar with a recap, and timers saved in the log. A refiner's time is the wiki's refining time; a crop's or a custom timer's is the player's input. Alerts are local (toast, vibration, a service-worker notification) while the browser runs the app. With "Alerts when the app is asleep" on (3.12.0, ADR-0006), the relay pushes them too; it sees timer ids and end times, never names.
- Sync (3.10.0): opt-in, no account. Turn it on, then pair another device with a QR code or the code. Both logs are merged three-way, so nothing typed on either side is lost. Delete cloud copy removes it for every device. More's Support row opens the owner's Ko-fi page (3.11.0); nothing is ever locked behind it.
- Planner ticks persist on this device only (owner's decision, 2026-10-27): not in `nms_state.json` or exports.

## Brand Commitments
Name "ATLAS:OS": ATLAS in white, ":OS" in cyan. The in-app title, the URL, the npm package and the PWA identity keep the old name until the owner approves the public rename. The look is the dark console in `DESIGN.md`: Orbitron titles, Inter body, JetBrains Mono numbers, tint-and-edge accents in emerald and cyan, glow only as state. Fan-made and unofficial: "Fan-made. Not affiliated with Hello Games." wherever the app meets people, and no game art.

## Evidence on Hand
- Wiki mirror: `wiki/` (about 3,160 verified articles) and `wiki/game-data.json` (recipes, values).
- The starter state file: `apps/web/public/nms_state.json` (defaults only since 3.14.0; nobody's save, ADR-0007).
- No testimonials, users or metrics beyond the owner; none may be invented.

## Product Principles
1. Glanceable mid-session: the answer comes first, detail on demand.
2. Truth from the wiki only; label every player-supplied number.
3. Local-first and offline: nothing leaves the device unasked.
4. Never lose the player's data or place.

## Accessibility & Inclusion
Phone-first touch targets and readable sizes at arm's length; screens moved to React are axe-gated (no violations) in `pnpm check`.
