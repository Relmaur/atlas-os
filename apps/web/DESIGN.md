---
name: ATLAS:OS
description: A companion for No Man's Sky, read at a glance on a phone beside the game. Fan-made; not affiliated with Hello Games.
colors:
  void: "#050811"
  panel: "#0b1325"
  panel-glass: "rgba(11, 19, 37, 0.88)"
  nav-glass: "rgba(11, 19, 37, 0.78)"
  slate-ground: "#0f172a"
  slate-deep: "#020617"
  scrim: "rgba(2, 6, 23, 0.62)"
  chart-grid: "rgba(148, 163, 184, 0.05)"
  hairline: "#1e293b"
  control-edge: "#334155"
  control-edge-hover: "#64748b"
  nav-edge: "rgba(148, 163, 184, 0.18)"
  grab: "#475569"
  ink-bright: "#ffffff"
  ink: "#e2e8f0"
  ink-soft: "#cbd5e1"
  ink-muted: "#94a3b8"
  ink-label: "#8b9ab0"
  ink-disabled: "#64748b"
  scanner-cyan: "#06b6d4"
  scanner-cyan-glow: "#22d3ee"
  scanner-cyan-pale: "#67e8f9"
  scanner-cyan-text: "#cffafe"
  scanner-cyan-ink: "#042f3a"
  scanner-cyan-tint: "rgba(34, 211, 238, 0.12)"
  scanner-cyan-edge: "rgba(34, 211, 238, 0.35)"
  scanner-cyan-edge-strong: "rgba(34, 211, 238, 0.55)"
  quantity-cyan: "#a5f3fc"
  ready-emerald: "#10b981"
  ready-emerald-lit: "#34d399"
  ready-emerald-pale: "#6ee7b7"
  ready-emerald-text: "#a7f3d0"
  ready-emerald-bright: "#d1fae5"
  ready-emerald-ink: "#022c22"
  ready-emerald-tint: "rgba(16, 185, 129, 0.12)"
  ready-emerald-tint-hover: "rgba(16, 185, 129, 0.18)"
  ready-emerald-tint-pressed: "rgba(16, 185, 129, 0.22)"
  ready-emerald-edge: "rgba(52, 211, 153, 0.5)"
  ready-emerald-edge-hover: "rgba(52, 211, 153, 0.7)"
  units-amber: "#f59e0b"
  units-amber-pale: "#fde68a"
  units-amber-text: "#fcd34d"
  units-amber-tint: "rgba(245, 158, 11, 0.12)"
  units-amber-edge: "rgba(251, 191, 36, 0.45)"
  exotic-purple: "#a855f7"
  exotic-purple-pale: "#c084fc"
  exotic-purple-text: "#e9d5ff"
  exotic-purple-tint: "rgba(168, 85, 247, 0.12)"
  exotic-purple-edge: "rgba(192, 132, 252, 0.5)"
  danger-rose: "#f43f5e"
  danger-rose-pale: "#fda4af"
  danger-rose-text: "#fecdd3"
  danger-rose-bright: "#fff1f2"
  danger-rose-tint: "rgba(244, 63, 94, 0.12)"
  danger-rose-edge: "rgba(251, 113, 133, 0.5)"
  danger-rose-edge-armed: "rgba(251, 113, 133, 0.8)"
  outlaw-crimson: "#ef4444"
typography:
  hero:
    fontFamily: "Orbitron, sans-serif"
    fontSize: "27px"
    fontWeight: 800
    lineHeight: 1.1
  screen-title:
    fontFamily: "Orbitron, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.15
  card-title:
    fontFamily: "Orbitron, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.25
  wordmark:
    fontFamily: "Orbitron, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.18em"
  sub:
    fontFamily: "Inter, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  row:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "Inter, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.16em"
  button:
    fontFamily: "Inter, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.01em"
  control:
    fontFamily: "Inter, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1
  pill:
    fontFamily: "Inter, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.04em"
  tab:
    fontFamily: "Inter, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: "10px"
    letterSpacing: "0.04em"
  numeric:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "14px"
    fontWeight: 600
    fontFeature: "tnum"
rounded:
  chip: "6px"
  slot: "8px"
  segment: "9px"
  control: "12px"
  button: "14px"
  card: "18px"
  sheet: "24px"
  full: "9999px"
spacing:
  gutter: "16px"
  header-top: "max(20px, env(safe-area-inset-top))"
  title-sub: "6px"
  back-title: "16px"
  header-content: "24px"
  section: "16px"
  card: "16px"
  card-row: "12px"
  tabbar: "64px"
  tabbar-inset: "max(16px, env(safe-area-inset-bottom))"
  tabbar-clear: "104px"
components:
  card:
    backgroundColor: "{colors.panel-glass}"
    rounded: "{rounded.card}"
    padding: "16px"
  list-row:
    textColor: "{colors.ink}"
    padding: "10px 16px"
    height: "52px"
  button-primary:
    backgroundColor: "{colors.ready-emerald-tint}"
    textColor: "{colors.ready-emerald-text}"
    rounded: "{rounded.button}"
    padding: "0 18px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.ready-emerald-tint-hover}"
  button-primary-pressed:
    backgroundColor: "{colors.ready-emerald-tint-pressed}"
  button-primary-disabled:
    backgroundColor: "{colors.slate-ground}"
    textColor: "{colors.ink-disabled}"
  button-secondary:
    backgroundColor: "{colors.slate-ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "42px"
  button-icon:
    backgroundColor: "{colors.slate-ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    size: "42px"
  button-arm:
    backgroundColor: "{colors.slate-ground}"
    textColor: "{colors.danger-rose-text}"
    rounded: "{rounded.button}"
    height: "48px"
  button-arm-armed:
    backgroundColor: "{colors.danger-rose-tint}"
    textColor: "{colors.danger-rose-bright}"
  slide-to-activate:
    backgroundColor: "rgba(16, 185, 129, 0.1)"
    textColor: "{colors.ready-emerald-text}"
    rounded: "{rounded.full}"
    height: "60px"
  hold-to-activate:
    backgroundColor: "rgba(34, 211, 238, 0.08)"
    textColor: "{colors.scanner-cyan-text}"
    rounded: "{rounded.full}"
    height: "60px"
  field-input:
    backgroundColor: "{colors.slate-ground}"
    textColor: "{colors.ink-bright}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  segment-track:
    backgroundColor: "{colors.slate-ground}"
    rounded: "{rounded.control}"
    padding: "4px"
  segment:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.segment}"
    height: "34px"
  segment-on:
    backgroundColor: "rgba(16, 185, 129, 0.18)"
    textColor: "{colors.ready-emerald-bright}"
  chip:
    backgroundColor: "{colors.slate-ground}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "0 13px"
    height: "34px"
  chip-on:
    backgroundColor: "{colors.scanner-cyan-tint}"
    textColor: "{colors.scanner-cyan-text}"
  status-pill:
    rounded: "{rounded.full}"
    padding: "0 9px"
    height: "24px"
  tab-bar:
    backgroundColor: "{colors.nav-glass}"
    rounded: "{rounded.full}"
    padding: "6px"
    height: "64px"
  tab-active:
    backgroundColor: "{colors.scanner-cyan-tint}"
    textColor: "{colors.quantity-cyan}"
  search-key:
    backgroundColor: "{colors.nav-glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "64px"
  log-segment-on:
    backgroundColor: "{colors.scanner-cyan-tint}"
    textColor: "{colors.scanner-cyan-text}"
  sheet:
    backgroundColor: "{colors.slate-deep}"
    rounded: "{rounded.sheet}"
---

# Design System: ATLAS:OS

## Status

The app is being rebuilt to this design, in order: tokens, the shell (navigation, rhythm, sheets), shared components, the core-loop screens, then the rest. The tokens ship in `src/tokens.css`, the one source for every value here: Tailwind v4 turns each into a CSS variable and a utility (`bg-void`, `text-ink-muted`, `rounded-card`, `text-screen-title`, `pt-header-top`). Never hand-copy a hex into a component.

Screens that haven't been rebuilt yet still use Tailwind's default palette and the older look. Their signature parts are recorded under "Today's screens" below until each is rebuilt.

## Overview

**Creative North Star: "The Ship's Console"**

ATLAS:OS is a starship's instrument panel on a phone propped beside the game. A near-black void ground under a faint 32px chart grid carries glass cards with a hairline edge. Orbitron sets names and titles of a few words; everything you read is quiet Inter; every number is JetBrains Mono with tabular figures, so values read like instrument readouts and line up column to column.

The bar is a tool a player wants to thank: answer an in-game question in a glance and a tap, without losing their place in the game.

**Key characteristics:**
- Void ground with a 32px chart grid at 5% slate.
- Glass cards and grouped lists: 88% panel, 1px hairline edge, 18px corners, 16px padding. No drop shadows.
- Tint and edge everywhere: states and buttons are a 12% fill with a 1px border of the same hue. There are no filled buttons.
- A floating glass tab bar (four tabs) with a round search key beside it.
- Glow means state, and only state.
- Phosphor bold icons; no emoji, no text glyphs as icons, no game art.

## Colors

A cold void palette lit by a few signal hues, each with one meaning.

### Named Rules
**The One Meaning Rule.** Cyan is an amount, focus or where you are (the active tab, a selected chip). Emerald is done, ready or the primary action. Amber is Units or caution. Purple is exotic. Rose is a destructive action. Crimson is the game's danger (an outlaw system, extreme weather, aggressive or corrupted sentinels), always with a word and the warning mark, never an error colour (round 4, component c15). A new screen reuses the meaning, never the hue for decoration.

**The Tint-and-Edge Rule.** A state or a button is a 12% fill (`*-tint`) with a 1px border at 35–55% (`*-edge`) of the same hue, and pale text in that hue (`*-text`). Hover deepens the tint to 18%, pressed to 22%. Solid colour appears only as state: the slide knob, the hold key, a switch that's on, a ticked milestone or done tick.

**Data colours are a separate family.** A star's logged colour and a planet's biome family paint star and planet marks only, never controls or text. They join the tokens with the StarMark and PlanetMarker components. Since round 4 there are ten biome families: toxic, hot, radioactive, frozen, exotic and lush, plus barren (#d4b483), dead (#a8a29e), marsh (#5fb7a0) and ocean (Waterworld, #3b82f6), each with a shade and each citing its biome's wiki page. A Reliquary world takes its main biome's family and a broken relic ring; slate means not scanned, and a dashed outline means nothing logged (component c01b).

**Word combobox (c14, round 4).** Every field whose value comes from a wiki list is an ARIA combobox with its list anchored under the field (between it and the keyboard on a phone), the current context's words first, "contains" matching, five rows then scroll, and a last row that keeps what was typed. No native `<datalist>`: iOS shows it as three words on the keyboard bar.

**Severity pill (c15, round 4).** Quiet (an edge, soft ink) for Clear, Normal, Low and High; crimson tint with the warning mark for Extreme, Aggressive and Corrupted. In a planet row the pill names its subject ("Extreme weather").

### Grounds and edges
- **Void** (`void`): the page.
- **Chart grid** (`chart-grid`): 1px lines every 32px behind each screen.
- **Panel** (`panel`, `panel-glass`): cards, grouped lists, key–value tiles.
- **Nav glass** (`nav-glass`, `nav-edge`): the tab bar and search key, over an 18px blur at 140% saturation.
- **Slate ground** (`slate-ground`): fields, segment tracks, chips, secondary and icon buttons.
- **Slate deep** (`slate-deep`): sheets and wells; **scrim** behind a sheet.
- **Hairline** (`hairline`): card and list borders, row dividers. **Control edge** (`control-edge`, `-hover`): the border of every control.

### Ink
`ink-bright` for names and titles, `ink` for body, `ink-soft` for field labels and chips at rest, `ink-muted` for subtitles and second lines, `ink-label` for uppercase group labels and inactive tabs, `ink-disabled` for disabled controls. All pass 4.5:1 on `panel`.

## Typography

**Display:** Orbitron 700 and 800. **Body:** Inter 400–700. **Numbers:** JetBrains Mono 400–600. All self-hosted from npm; nothing loads from a font CDN.

### Hierarchy
- **Hero** (Orbitron 800, 27px / 1.1): the current system's name on Home, once per screen.
- **Screen title** (Orbitron 800, 26px / 1.15): the title of every screen.
- **Card title** (Orbitron 700, 15px / 1.25): card titles, with one bold Phosphor icon in the card's hue, 8px apart.
- **Wordmark** (Orbitron 800, 15px, tracking 0.18em): ATLAS in `ink-bright`, `:OS` in `scanner-cyan-pale`.
- **Sub** (Inter, 13px / 1.45, `ink-muted`): a screen's subtitle, 6px under the title.
- **Row** (Inter, 14px): a list row; its title is 600 `ink-bright`, its second line **caption** (12px / 1.4, `ink-muted`).
- **Label** (Inter 600, 10px, tracking 0.16em, uppercase, `ink-label`): names the group under it. Never a decorative kicker. One exception: a live status line above a hero name when it states something true and current ("YOU ARE HERE · 26H AGO"), in the status's hue.
- **Button** (Inter 600, 15px, tracking 0.01em) for primary and gesture buttons; **control** (Inter 600, 13px) for secondary buttons, chips and segments; **pill** (Inter 600, 11px, tracking 0.04em); **tab** (Inter 600, 10px on a 10px line box).
- **Numeric** (JetBrains Mono, tabular figures): every count, amount, time, Units value and portal address.

### Named Rules
**The Readout Rule.** Every number a player compares is JetBrains Mono with `tabular-nums`. Inter never sets a quantity.

**The Short Burst Rule.** Orbitron sets names and titles of a few words, never a sentence.

**Sentence case** everywhere except the label style and proper names. British spelling, as the game uses it.

## Layout

Phone first, at 390px; every screen still works at 1280px. A screen never scrolls sideways: only deliberate rails (filter chips) scroll, inside themselves, bleeding to the screen edge with 16px inner padding. Layouts are fluid; fixed-width roots are a bug.

### Vertical rhythm (every screen)
- Header top: 20px, or the safe area if larger (`header-top`). Sides: 16px (`gutter`).
- Title → subtitle: 6px (`title-sub`). Back bar → title: 16px (`back-title`).
- Header → content: 24px (`header-content`). Section → section: 16px (`section`).
- Section label → its group: 6px, with 24px above the label.
- Card padding: 16px (`card`); rows inside a card: 12px apart (`card-row`).
- Bottom padding: 104px (`tabbar-clear`), so the last content clears the tab bar by 24px.

`box-sizing: border-box` applies to everything (Tailwind's base sets it).

## Elevation & Depth

Depth is simple 1px borders and glass. No drop shadows without a reason.

### Named Rules
**The Glow Means State Rule.** A glow appears only as state, and nothing else gets a shadow:
- **Live** (`shadow-glow-live`): the live-run dot on the Runs tab, and a live session.
- **Done** (`shadow-glow-done`): a done tick.
- **Supercharged** (`shadow-glow-supercharged`): a supercharged tech slot.
- **Focus** is a 2px `scanner-cyan-glow` outline offset 2px, on every focusable element, never hidden under the tab bar or a sticky header.

## Shapes

Radius by role: 6px chips (`chip`), 8px slots (`slot`), 9px segments inside a 12px track (`segment`), 12px fields, secondary and icon buttons and segment tracks (`control`), 14px primary and tap-to-arm buttons (`button`), 18px cards and grouped lists (`card`), 24px a sheet's top corners (`sheet`), full pills for chips, status pills, gesture buttons, the tab bar and the search key.

## Components

### Tap buttons
Classic tap UI everywhere except the three gesture places below.
- **Primary:** tint and edge in emerald (`ready-emerald-tint`, `ready-emerald-edge`), `ready-emerald-text` label, button type, 48px, 14px corners, 18px sides, an optional leading icon 8px from the label. Hover and pressed deepen the tint (`-tint-hover`, `-tint-pressed`) and edge (`-edge-hover`, then `ready-emerald-lit`). Disabled is slate (`slate-ground`, `control-edge`, `ink-disabled`), not faded. Sizes: L 48px, M 42px, S 34px.
- **Secondary:** `slate-ground`, `control-edge` border, `ink` label in the control type, 42px, 12px corners, 14px sides.
- **Icon button:** 42×42, the secondary's surface, with an `aria-label`.
- Transitions: background and border over 120ms.

### Gesture buttons
Only where they earn it. They use the standard tint and edge: an 8–10% fill and a plain 1px border of the same hue, no gradient border, no grain.
- **Slide to activate** ("Warped somewhere new", emerald): a 60px pill; a 48px solid emerald knob (`ready-emerald-ink` icon) travels right over a trail that deepens behind it; the label and chevrons sit to its right. Keyboard: Enter or Space activates.
- **Hold to activate** ("Start session", cyan): a 60px pill with the label and a hint on the left and a 46px key on the right whose solid `scanner-cyan-glow` core fills a ring over 600ms; a fill sweeps behind the label. Letting go early resets it. No glow until the session is live.
- **Tap to arm** (destructive actions, rose): a 48px button on `slate-ground` with a rose edge and `danger-rose-text`. The first tap arms it (`danger-rose-tint`, `danger-rose-edge-armed`, `danger-rose-bright` label) and a rose wash drains over 3s; a second tap within that window confirms; otherwise it disarms.

### Chips, pills and segments
- **Chip:** 34px full pill, `slate-ground`, `control-edge`, `ink-soft`, control type, 13px sides; selected is cyan tint and strong edge with `scanner-cyan-text`. Chips sit in a rail 6px apart.
- **Tag:** 24px pill, cyan tint at 10% with a 30% edge, `quantity-cyan`, 12px Inter 500.
- **Status pill:** 24px, pill type, tint and edge in the meaning's hue (emerald, purple, amber, rose) or slate, with an optional bold icon 5px from the label.
- **Segmented control:** a 4px-padded `slate-ground` track with a hairline edge and 12px corners; 34px segments with 9px corners and a 4px gap. The selected segment is an 18% emerald fill with a 1px inset emerald ring (`inset-shadow-segment-on`) and `ready-emerald-bright` text. The Log segment (Systems · Fleet · Notes) is navigation, so its selected segment is cyan (`scanner-cyan-tint`, `scanner-cyan-edge`, `scanner-cyan-text`) and carries `aria-current`.

### Cards and lists
- **Card:** `panel-glass`, 1px `hairline`, 18px corners, 16px padding, children 12px apart. A card title is the card-title type with one icon.
- **Grouped list:** the card's surface with no padding; 52px rows (10px × 16px padding, 12px gap) divided by hairlines; title and caption stacked 2px apart, a trailing `control-edge-hover` caret. Leading icons sit in a 34px tile with 10px corners.
- **Key–value tiles:** a two-column grid, 8px apart; each tile `panel`, hairline, 12px corners, 10×12px padding; the value in mono 600 14px `ink-bright`.

### Fields
A label above (caption, `ink-soft`, 6px gap), then a 44px `slate-ground` control with a `control-edge` border and 12px corners, 12px sides, white text at 16px so iOS doesn't zoom.

### Navigation
- **Tab bar:** a floating, fully rounded glass pill (`nav-glass`, `nav-edge`, 18px blur), 64px tall with 6px padding, inset 16px from the screen's sides and bottom (or the safe area), leaving 88px on the right for the search key. Four equal tabs, 2px apart: **Home · Log · Runs · Codex**. Each tab is a 20×20 icon box (line height 0) 4px over the tab label, centred by measurement. The active tab is a cyan-tinted capsule (`scanner-cyan-tint`, `scanner-cyan-edge`) with a `quantity-cyan` label and a `scanner-cyan-glow` icon; inactive tabs are `ink-label`. The only glow in the bar is the live-run dot on Runs (8px, `shadow-glow-live`).
- **Search key:** a 64px round key of the same glass beside the bar. It opens search with quick actions (Log this system, Start a timer, New note, Resume run). On Search it's lit: cyan tint, a 45% cyan edge, `scanner-cyan-pale` icon.
- **Every full screen shows the bar,** with the tab of its section lit: Home (Home, first run, Settings, Timers & Session, Card viewer), Log (Systems, Fleet, Ship detail, Notes, Note editor, System detail, Frontier), Runs (Runs, a run, Recipe planner, Best crafts), Codex (Codex, article, Guides, a book).
- **Settings** sit behind a gear in the Home header and open with a back bar.
- **Wide screens:** the design is drawn at 390px. Until the shell is rebuilt, 1024px and up keep today's sidebar.

### Sheets
A sheet rises from the bottom over a `scrim`: `slate-deep`, 24px top corners, a `control-edge` top border. Its close control is the grab bar: a 40×4 `grab` pill centred in a full-width 30px button. It enters over 300ms on `ease-entrance` (`cubic-bezier(0.16, 1, 0.3, 1)`) and leaves faster, over 200ms. Sheets cover the tab bar with their own Save/Cancel footer. A sheet holding unsaved typing refuses to close by bar or swipe and says why.

### Motion
120–200ms for micro-interactions, 250–350ms for sheets and panels, `ease-entrance` for entrances; exits are faster than entrances. Under reduced motion every animation (orbits, breathing stars, shimmer, the hold fill) settles at its end state, and nothing moves for more than 5 seconds unasked.

## Today's screens (until rebuilt)

These describe screens as they ship before their redesign. Each section goes when its screen is rebuilt.

### Session Bar
While a session is on, or any timer is listed, a slim 48px bar leads every screen and sticks just under the header: quiet glass (88% void with a 12px blur), a hairline cyan edge that brightens on hover, 12px corners. Left to right: a status dot (emerald with a slow 2.4s pulse ring during a session, plain cyan for timers alone), the "Session" label over the elapsed time in mono, a hairline divider, then the soonest countdown (kind icon in cyan, the label, the time in 16px semibold mono quantity-cyan), an emerald "✓ N done" pill when finished timers wait (the bar's edge then turns emerald and it takes the capstone's glow, blooming once), this session's tallies from 640px, and a caret. The whole bar is one button opening the Session screen (#session), and it isn't shown on that screen. Home offers "Hold to start session"; starting shows the bar, which opens the screen. The header's timer button carries a dot: cyan while timers run, emerald once one is done.

### Timer Rows
The Session screen (design 04) leads, during a session, with "SESSION LIVE" in emerald over the clock in 30px mono (`1:12:08`) and End session at the right, then three tally tiles (new systems, visits, timers done in emerald; Orbitron 20px numbers). Without one it offers Hold to start session; once ended, the recap takes that place. Each countdown is an 18px-radius card: a 64px timer ring with its percentage (cyan for a refiner, amber for a crop, rose for an outlaw restock), a kicker in the kind's colour (REFINER, CROPS, CUSTOM, OUTLAW STATION), the label in 15px semibold, where its time came from ("From the wiki's refining time", "Your timing · 60 min"), and the countdown in 18px mono at the right. A refiner's card has a cyan edge. A finished timer turns to the emerald wash with a full ring and a check, says when it finished, and offers Dismiss. Under the cards, + Refiner (cyan), + Crop (amber) and + Custom (slate) open the add form for that kind in a sheet, and the alerts card closes the screen.

### Article Index (Codex)
An article's connections lead the page. Below 1024px, directly under the article header, an index bar of chips (36px pills, slate-ground with a control-edge border, a bold cyan Phosphor icon, the label, then the count in mono quantity-cyan at 80%): Contents, Used in, Links to, Mentioned in, Nearby, each shown only when it has entries, scrolling sideways when they overflow. Each opens the index sheet at its list. Once the bar scrolls out of view, a reading strip appears under the header: 40px, 90% void with blur and a hairline bottom edge, the list icon in cyan, the current section's name, and "Index" in pale cyan; it fades in over 200ms. From 1024px the index is the sticky right rail (16rem): "On this page" as a hairline-ruled list with the active section in emerald, then the relation lists, each capped at 12 with a "Show all N" text action.

### Recipe Planner Capstone (signature)
The product crowns the plan. A 16px-cornered card lit from above by a cyan radial gradient over the panel colour, with a 30% cyan edge: the amount in mono quantity-cyan above the Orbitron product name, the norm line ("All crafted from blueprints"), the capstone tick at the right, a status line with the jump button, the one-line recipe, then a two-column readout of product worth (amber) against raw inputs worth (white), with the worth ratio below. When every tick is in, it turns to a 40% deep-emerald fill with a 60% emerald edge and blooms once (1.1s, `cubic-bezier(0.16, 1, 0.3, 1)`); with reduced motion it simply settles with the glow.

### Round Spine and Ready Band (signature)
Rounds stack on a 1px hairline spine 15px from the left. An emerald overlay grows up the spine (scale from the bottom, 700ms ease-out) once a round can be crafted. Each round has a diamond node: hollow slate when waiting, hollow emerald with a ready glow when ready, solid emerald when crafted. A ready round's step list becomes a band: a 6% emerald wash with a 25% inset emerald ring, 12px corners, and its status becomes an emerald tint pill ("Ready to craft"). Crafted rounds can fold away behind a quiet caret action.

### Step Row and Tick Target (signature)
Each step is a row: a 44px tick target, then the mono amount with `×`, the item name (a Codex link underlined in slate, cyan on hover), a muted meta line only where it differs from the plan norm, and the recipe as one line ("10,000 Frost Crystal + 20,000 Solanium") with amounts in mono (emerald for raw, cyan for crafted) and a check after each ticked input. The tick target is a real checkbox drawn as a slot: slate-deep with a hammer icon at rest, emerald tint with glow when ready, solid emerald with a check when done.

### Recipe Switch Preview (signature)
Only where a step has alternatives: a full-width (auto from 640px) 8px-cornered outline button with a cyan cycle icon, "Recipe 1 of 2 · switch to the next", and below it the next recipe's inputs in this plan's amounts plus the signed change in raw inputs' value, emerald when cheaper, amber when dearer. After a switch, the row shows the outcome in the same hues.

### Cargo Hold Inventory Slots (signature)
Raw stock sits at the foot of the column in a slate-deep well with a 16px corner and an up-arrow node where the spine lands. Each material is a square inventory-slot tile: 8px corners, a hairline control-edge frame over a dim slate diagonal gradient, the name top-left (11px, 0.75rem from 640px, two lines max), a 20px check box bottom-left and the amount in mono quantity-cyan bottom-right. Gathered slots take the emerald tint and edge, the name dims, the amount turns emerald.

## Do's and Don'ts

### Do:
- **Do** take every value from `src/tokens.css` through its utility or variable; add a token before adding a value.
- **Do** set every quantity, time and address in JetBrains Mono with tabular figures, in `quantity-cyan` for amounts and `units-amber-pale` for Units.
- **Do** express states and buttons as tint and edge in the hue that carries the meaning.
- **Do** keep anything tapped mid-session at 44px (40px minimum otherwise) and inputs at 16px on phones.
- **Do** pair each card title with one bold Phosphor icon in the card's hue.
- **Do** give every animation a still end state under reduced motion.
- **Do** show the cyan focus outline (2px, offset 2px) on every focusable element, including inputs drawn as something else.
- **Do** say "Fan-made. Not affiliated with Hello Games." wherever ATLAS:OS meets people (About, share images, cards).
- **Do** draw only what the player logged or the wiki states.

### Don't:
- **Don't** fill a button with solid colour; solid colour is state only.
- **Don't** add drop shadows; a glow is state (live, done, supercharged), and focus is an outline.
- **Don't** use an accent hue for decoration or outside its meaning (cyan for a Units value, amber for done, crimson for an error).
- **Don't** set sentences in Orbitron, or put an uppercase label above a heading as a kicker.
- **Don't** use emoji or text glyphs as icons, or any game art: no portal glyph drawings, game icons, logos, game fonts or screenshots. A portal address is 12 hex characters in mono.
- **Don't** use gesture buttons outside Home's two (slide, hold) and destructive actions (tap to arm); the shell and settings stay classic tap UI.
- **Don't** let a screen scroll sideways; only deliberate rails do.
- **Don't** load fonts, icons, scripts or styles from a CDN; everything is bundled.
