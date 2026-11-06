# Changelog

All notable changes to ATLAS:OS (called ATLAS // MASTER OS up to 3.20.0). The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). For this app, a MAJOR bump means a saved or exported `nms_state.json`, a bookmarked URL, or a supported way of running the app stops working.

Versions up to 2.6.0 were reconstructed from git history when the changelog was introduced.

## [Unreleased]

## [3.29.0] - 2026-11-06
### Added
- Your game accounts, in Settings under "In the game": the names you play under. A planet's Discovered by offers each as **Me**, one tap to fill it in. Without any, it says where to add them.
- A planet's hazard reading can be Temperature, Radiation or Toxicity, each in its unit (°C, Rad, Tox), from the wiki's Heads-Up Display page. A ± button beside a temperature gives it a minus sign, which a phone's number pad lacks.
- In System detail, a moon tied to its planet sits inside that planet's row, indented.
- A system has its own Discovery too: who discovered it, on what day and at what time, with the same Me chips. System detail shows it once logged.

### Fixed
- On a phone, a sheet no longer slides down behind the keyboard when you tap a field near its top, and a field lower down no longer ends up above the screen. Bringing the field into view now scrolls the sheet alone, clear of its sticky header and footer, never the page under it.

### Changed
- Planets and moons are both "bodies" in the actions: Add body, Save body, Edit body, Delete body. The list in System detail is "Planets & moons", and so is the editor's count.

### Notes
- Additive: the log gains `accounts` (names, merged as a set in sync) a planet gains `hazard` (which reading its number is), and a system gains `discoveredBy`, `discoveredOn` and `discoveredTime`. Older logs read as no accounts, and their numbers stay temperatures.

## [3.28.0] - 2026-11-06
### Added
- A moon can say which planet it orbits: choose Moon in the planet sheet and an Orbits picker lists the system's other planets. In the system's diagram the moon leaves the star's orbits and circles its planet, small, on a faint ring of its own (still under reduced motion). The moon's own page says "orbits" with a link to the planet, the diagram's description for screen readers says it, and an AI assistant connected through the MCP server gets the planet's name.

### Notes
- Additive: a planet gains `orbits` (the id of the planet a moon circles, '' when not set). Older logs read it as not set; a link to a planet that was deleted, or that is now logged as a moon, is kept as it was and reads as not set.

## [3.27.1] - 2026-11-06
### Changed
- On a computer, a planet's row in System detail opens the planet panel beside it, and the row says "Editing", as design 37 draws it. On a phone a row still opens the planet's own page; a Ctrl- or ⌘-click opens that page in a new tab on a computer.

## [3.27.0] - 2026-11-06
Design round 4, "Planets & the scan".

On the Updates page this is **Survey**, covering 3.22 to 3.27, with a banner made from real screens of the invented log.

### Added
- A planet has its own screen: what you logged from its scan in the game's order (weather, resources level, fauna, flora, sentinels, temperature), the resources it lists with why each can be there and a Codex link, and its discovery. Only what's logged shows: a partly filled planet lists what's missing on one line, and an unscanned one offers to fill it in. A planet's row opens it; the pencil opens the sheet.
- The planet sheet follows the game's scan: Identity (description, planet or moon, biome), the scan's rows, what the ship's scan lists, and the discovery, now with its time. The resources are toggle chips grouped by why the wiki says they can be there: the biome's own, the star's metal and its activated form, deposits, and finds, plus "Another resource…" for anything else.
- Every word field is a new combobox with its list right under the field, above the keyboard on a phone: the planet's biome's words first, matching anywhere in the word, and a last row that keeps what you typed. It replaces the browser's own suggestion lists, which iOS shows as only three words.
- Barren, Dead, Marsh and Waterworld planets have their own colours, each from what its wiki page says the biome looks like. A Reliquary world takes its main biome's colour with a broken ring around it. A planet with nothing logged is a dashed outline.

### Changed
- The game's danger is crimson, always with the word and a warning mark: extreme weather, aggressive or corrupted sentinels, and outlaw systems. Normal weather and low sentinels are quiet pills; nothing else turns red.
- System detail shows the galaxy map's pairs as the map does: "Yellow F4", "On the map: Water", and "Prospecting // Opulent" with "Mining economy · ★★★ strength" (the Wealth cell is folded in). A planet's row is one scan line, with a red pill only for danger, naming what it's about.
- The system editor groups the star and the economy as the galaxy map pairs them. When your star colour disagrees with the wiki's reading of the spectral class, an amber note says so and offers it; your choice stays. An economy name that isn't one of the wiki's is kept as typed, and its strength still sets the stars.
- On a computer, a field no longer scrolls when it takes focus in a sheet; that's only for a phone's keyboard.

### Kept
- Every planet and system logged before this keeps what was typed. The new discovery time is empty until filled.

## [3.26.1] - 2026-11-05
### Fixed
- The planet sheet no longer scrolls sideways on iPhone: the "Discovered on" date field fits its column.
- A biome written as the game shows it, "Frostbound Planet" or "Icy Moon", reads as its biome: its colour, weather suggestions and resource chips. The text stays as typed.

## [3.26.0] - 2026-11-05
### Added
- Planets hold what a scan shows: the description ("Frostbound"), planet or moon, biome, weather, sentinels, flora, fauna, the resources level, the resources it lists, temperature, and who discovered it and when. Every field takes the words the game shows.
- The planet sheet suggests the wiki's words for each field. A prefix only one biome uses fills in the biome ("Frostbound" → Frozen). Weather reads as clear, normal or extreme, and sentinels as low, high, aggressive or corrupted, from the wiki's tables. A planet's row shows its scan in one line, with a red pill for extreme weather or aggressive sentinels.
- Mega Exotic planets draw in the exotic colour and Gas Giants in the hot one, as the wiki says they're like those biomes. A biome typed as a prefix ("Frostbound") gets its biome's colour.
- The planet sheet offers each biome's own resources, from its wiki page, as one-tap chips ("Frozen worlds have: Dioxite, Frost Crystal, Radon"); any other resource is typed, with the Codex's resources suggested.
- Systems hold the galaxy map's other words, each pair as two fields: the spectral class ("F4"), which sets the star colour from the wiki's table, with Water and Dissonant toggles; and the economy's name ("Prospecting", read as a Mining economy) and strength word ("Opulent"), which sets the wealth stars. A colour or stars already logged are never changed. System detail shows them as the map does: "Prospecting // Opulent".
- The MCP server's `get_system` returns each planet's scan and the system's galaxy-map words.

### Fixed
- On a phone, a field in a sheet (the system editor, a planet, gear, a run, a session, sync) stays in view when the keyboard opens, instead of ending up off the top of the screen.
- The wiki copy kept nothing of the wiki's column lists or its `{{Biome|…}}` links, so the biome pages lost their name prefixes and the planet discovery page its flora and fauna words. 89 pages are fuller now. The Spectral class page, the Economy page and the seven economy types' pages join the copy.
- A wiki sync never rolls a page back: a page the archive holds at a newer revision than the dump stays as it is, and one written after the dump was taken isn't marked removed.

### Kept
- Planets logged before this keep everything as typed, including a biome in the player's own words. New fields sit beside the old ones, empty until filled.

## [3.25.0] - 2026-11-04
### Added
- Portal addresses show each glyph's name, from the wiki: on a system's screen under the address, in dialling order, and in the system editor as the address is typed, so a slip is easy to spot. Screen readers hear the names. No glyph art, only the names.
- The MCP server's `get_system` returns the same names beside the address.

## [3.24.0] - 2026-11-01
### Changed
- On wide screens the Traveller Card shows its front and back side by side, a note is written beside its live preview, and sharing is a centred dialog with the picture beside the choices.
- A wide-screen panel also closes by dragging its bar to the right, and the rail shows its shortcuts on hover.

## [3.23.0] - 2026-10-31
### Changed
- On wide screens the app has a left rail: search, Home, Log, Runs, Codex and Settings. On tablets the phone layout sits centred. Search opens from the key everywhere, and from `/` or ⌘K.
- On wide screens a system, ship, note, run or book opens beside its list, and Home is a two-column dashboard.
- On wide screens editors and sheets open as a panel from the right, closed by the bar on its edge or Esc. Tablets keep bottom sheets.
- The Codex has the same rail on wide screens, and an article opens beside the search and results.

### Added
- Keyboard shortcuts: `g` then `h`, `l`, `r` or `c` to jump, and `n` for a new note in Log. They're listed in Settings on wide screens.

## [3.22.0] - 2026-10-31
### Added
- **Delete a system:** at the foot of the system editor, two taps. Its linked notes stay, unlinked.
- **Link notes to a system:** from a note's Pin picker, or New note on the system's screen, which lists its linked notes.
- **Start a refiner timer from the Codex:** an article's Source section opens the timer with that item chosen.
- **Pin it** in the recipe planner's Codex peek starts a note linking the item.
- The old GitHub Pages copy of the app says ATLAS has moved, and offers an Export first. Nobody is redirected.
- **The Updates page** at https://atlas-os.cloud/updates/: named updates in plain words, starting with First Light and Where it started, each with its own page and a share picture, and an RSS feed. This changelog stays the developer record.
- **What's new in the app:** after an update arrives, one card on Home says so and links to it. Once per update, never on a first install, and never in the way. Settings › About links to the Updates page too.
- **The product page** at https://atlas-os.cloud: what ATLAS is, with the app's own screens and cards, how to install it, and what it costs. The app stays at /app/. It's free of analytics and third-party requests, like the app.
- Settings › About has a contact address: hello@atlas-os.cloud.

### Changed
- **The repository is now `Relmaur/atlas-os`.** The old `relmaur.github.io/nms-os` address no longer works: that copy is at `relmaur.github.io/atlas-os`, and the app lives at https://atlas-os.cloud/app/. `nms-atlas-mcp` reads game data and sync from atlas-os.cloud.
- The product page's "Tilt your phone" shows on phones only, and the page's card now answers the phone's motion.
- The Traveller Card now tilts as a whole, with its art and class badge floating above it and a light sweeping across.
- Exports are named for the app and the moment: `atlas_os_2026-10-31_17-05-36.json`. Older `nms_state.json` files still import.

### Fixed
- Tilt on a phone was too faint to see and faded away while you held the phone still. A small turn of the wrist now moves the card, and it stays where you hold it. Tilt on the collection's cards is twice as strong too.
- A card's hidden side can no longer show through, mirrored, in browsers that don't hide a turned-away face.

## [3.21.0] - 2026-10-31
### Added
- **Your card collection** (Traveller Card › Collection): every system, ship and first becomes a generative card, seeded by the place itself. Swipe through them, tilt, flip, copy the address, or save one as a picture.
- **Frontier** (Traveller Card › Frontier): the star colours, biomes, races and ship types still out there for you, and the next first to chase.
- Settings › About says which build you're on: the version, the commit and the day it was built.
- The Traveller Card can be saved as a picture, and has a full screen: the card alone, with nothing around it.
- The Traveller Card tilts with an iPhone's motion. The first tap on the card asks for permission.

### Changed
- A new logo and app icon: the cyan diamond replaces the red planet.
- **ATLAS moves to https://atlas-os.cloud/app/**, served by Cloudflare (ADR-0010), with sync on the same address. The old address keeps working for now. Your log stays in the browser it was saved in, so move it with Export → Import, or pair the two with your sync code, and install the app again from the new address. Other sites can no longer frame ATLAS.
- The app is now called ATLAS:OS for No Man's Sky.
- `nms-atlas-mcp` uses the new addresses from its next published version.
- `pnpm build` indexes the committed wiki archive first, so a fresh clone builds a complete site.

### Added
- **Share a system or a ship as a picture.** A system's Share opens a postcard: square, story or wide, with your choice of planet names, rating and tags, notes and portal address (the last two start off). A ship, Multi-Tool or Exosuit gets a Fleet card with its technology grid. Pictures are made on your device and nothing is uploaded.
- **Your Traveller Card** (Settings › Traveller Card): one living card that grows with your log. Its art is a current drawn from every system you've placed, an island per galaxy in the colour of when you reached it; it shows your class (C to S), a rank that follows how you play, your stats, star colours, how deep you've gone toward a core, and your newest firsts. Tilt it, tap to flip: the back explains every part, including how close you are to the next class.
- **A Map of your travels** (Log › Map). Every galaxy you've reached, in order, as a chain with your systems dotted at their true places and the next galaxies waiting; then one galaxy close up, your systems magnified with the way to the centre, zoom and drag, and a card for each system with its distance from the centre in light years. Positions come from portal addresses; systems without one are counted, not guessed.
- **Make your own runs.** "+ New run" on Runs: name it, then add steps (go to a system from your log, farm, refine, craft or sell an item from the wiki, or anything in your own words), how long it takes and how often it repeats. Each step is checked against the wiki, and the estimate shows the Units per run and per hour from wiki prices, or from your own. Your runs are listed under Yours; if a game update changes a value one relied on, it moves to Retired until you check it again.
- **Runs has its own tab screen**, and the Outlaw Run becomes **Outlaw stations**, its first run. Start a run and Runs shows it in progress (which station is next, when the first one restocks) until you've hit your stations or a restock has passed. Each run says which game version it was checked against, from the wiki's newest update page. The run settings sit on the run's screen with what one full run earns at your averages.
- **A first run for a new atlas:** an empty Home welcomes you, offers to log your first system, add your ship or start a timer, and links to pairing if you already use ATLAS elsewhere.
- **Sync is redesigned, and lists your devices.** Each device writes its name and when it last synced into your encrypted log, so the sync server learns nothing new. Pair another device from one card, turn sync off here with a switch, and delete the cloud copy with tap to arm. To drop a device, start over with a new code.
- **Settings are redesigned** (from the gear on Home): your data, this device, support and about, as one short list. **Sync opens as a sheet over Settings**, where pairing links now land.
- **Search is redesigned.** The search key opens it with quick actions (log this system, start a timer, new note, resume your run) and what you opened last. Type, and chips narrow the results to gear, notes, systems, the Codex or the guides, with how many each holds.
- **Guides are redesigned.** Each book is a path of milestones you tick, now spread across the books they belong to (your ticks keep), with the next one to tick on the Guides screen. A book opens on its milestones, a rule quoted from the wiki where it leans on one, your pinned notes, then the chapter. A milestone that names a ship or tool says when your fleet has one.
- **The Codex is redesigned.** The landing has search, a tile per group and recently edited pages; filters wait behind a Filters chip. An article reads as cards: Quick Facts as pairs, recipes as a table, then the pages it's used in and links to. **On this page** opens from the header, and mid-scroll a bar names the section you're in, with find in the article, how much you've read, and back to top. **Pin to a note** starts a note in the app that links the page.
- **Best crafts has its own screen** (`#crafts`): rank by profit, multiplier or fewest steps, or leave out crafts that need a crop (No farming); the top pick leads, and every row opens the recipe planner. Calculators links it and the planner, and keeps Base value, Extractors and Registers.
- **The recipe planner is its own screen** (`#plan/<item>`): what the item is worth, then one path in play order, Gather → each crafting round → the final craft, with progress. Tap any item for a Codex peek that leads with the wiki's Source section, then where your own log says you found it, what the plan needs and a way into the Codex. Best crafts' "Plan it" opens it; Calculators keeps its other tools and a card for the plan in progress.
- **Notes are redesigned, and a note has its own screen** (`#note/<id>`): the list has search and chips for Pinned and each tag; a note opens to read, with Write beside it, a Pin menu (Home, a book or a ship) and a formatting toolbar (heading, bold, italic, list, table, Codex link). Notes save as you write: there's no Save button, and leaving keeps what's there. Notes can have tags.
- **The wiki mirror is refreshed from Fandom's database dumps** (ADR-0009): `pnpm sync:wiki --from-dump <file>` reads the dump's XML (plain or gzipped) with the same scope, exclusions and rendering, and `pnpm verify:wiki --from-dump <file>` compares the archive with it. The dump stays outside the repo.
- **Fleet, a ship's own screen and a new gear editor:** cards open to the technology grid with supercharged slots in purple; a ship's screen shows what sits in each slot and whether your marks match the wiki; in the editor a tap marks and selects a slot to name its module. Notes can be linked to a ship, Multi-Tool or Exosuit and show on its screen.
- **Timers and the session have their own screen** (from the session bar, Home's timers or the timer button): the live clock and what this session has logged, every countdown as a card with a ring, + Refiner, + Crop and + Custom, and the alerts switch. Finished timers wait at the end of the list.
- **The system editor has a Location block:** pick the galaxy from all 256, type the portal address or the galactic coordinates a signal booster shows (each converts to the other, by the wiki's rule), and see where the system lands and how many light years it is from the centre. The editor also takes the number of planets, and notes can be edited on any system again.
- **The Codex has 534 more game pages (3,705 in all)**, from the 29 Oct 2026 wiki dump: two new groups, **Lore** (the story, the races, guilds, NPCs and Sentinels) and **Life and worlds** (creature genera, flora and mineral types, biomes), plus more Mechanics (terminals, the Space Anomaly, game guides, ship and tool types). Players' discoveries and community pages stay out.
- `pnpm sync:wiki --discover <dump> --out <report.md>`: a scope report of every infobox and large category in the dump, with a proposed verdict (game, community, mixed, or review when there's nothing to judge by), for widening the mirror. It writes nothing in `wiki/`. Fandom's dumps give the site as `http://`, which the reader accepts.
- The Codex says which copy of the wiki it holds: "Wiki copy from 29 Oct 2026" beside each article's source and on its landing. "Fix this on the wiki" still opens the live page.
- **A new tab bar** on phones and tablets: a floating glass bar with four tabs, Home · Log · Runs · Codex, and a round search key beside it. Runs lights a dot when an outlaw station is ready. The Codex page has the same bar, and its search key opens the app's search.
- **Log's segmented control** (Systems · Fleet · Notes) at the top of each of the three.
- A Settings gear in the header below desktop width (More had a tab of its own).
- `#search` opens the app with the search up.
- **The redesign's shared components**, not on any screen yet:
  - tap buttons: primary, secondary, jump, ghost and danger in three sizes, with loading and disabled states;
  - gesture buttons: slide to activate, hold to activate (600ms), and tap to arm with a 3-second window. Each works from the keyboard and with a screen reader;
  - the star mark, the planet marker, and the orbit diagram in three sizes, with a sentence for screen readers. Planets sit at angles seeded from the galaxy and portal address, so a system draws the same on every device.
- The Codex mirrors the wiki's **Biome** page. Seven cited facts from it give planets their colour family (Scorched and Volcanic are hot; Frozen, Toxic, Irradiated, Exotic and Lush have their own), each with the sentence that says so. Biomes the page gives no family, such as Barren or Gas Giant, draw slate.
- The wiki sync picked up Update 7.10 and three changed pages.
- A dev-only component gallery (`apps/web/dev/components.html`, served by `pnpm dev`, never built).

### Changed
- **Home is redesigned.**
  - The current system leads, with its orbit diagram, where you are ("You are here · 26h ago"), its place and your first note line.
  - **Warped somewhere new** is a slide, so a stray thumb mid-game can't open it.
  - Your timers show as cards: the soonest running and the newest finished.
  - **Start session** is a hold (600ms), like the game's own hold to interact.
  - Warp back lists systems with their star.
  - On phones Home has its own header: the wordmark, sync's state when sync is on, timers and Settings.
  - The outlaw stations move to Runs, the fleet to Log › Fleet, and Keep screen on stays in Settings. Notes pinned to Home still show.
- **A system has its own screen** (`#system/<id>`, so a system can be linked and Back returns where you were). Its orbit diagram leads, with planets numbered and your base labelled; then "You are here", what the game shows (with "Not logged" where you haven't), the portal address (Add opens the editor; Copy once logged), the planets, the journal (your notes and every visit) and **Log a visit** with **Share**.
  - Planets are added and edited there: "+ Add planet" ends the list and a tap on a planet opens it in a sheet, with tap-to-arm Delete.
  - Your rating moves to the editor ("Your rating"); the screen shows it.
  - Following the new design (owner, 2026-10-28), the screen no longer edits notes inline (the editor does), shows tags, takes a note or packet run with a visit, deletes visits, or deletes the system. These wait for a later design round.
- **Systems is redesigned.**
  - A system with its star or planets logged draws its orbit strip; one without stays a compact card with its notes. The system you're in says "You are here".
  - Under the title: systems, planets, visits and the galaxy ("2 systems · 5 planets · 1 visit · Euclid").
  - The filters are one row of chips: All, each star colour and Favourites with counts, every tag, each race and conflict level the log has. Sort is the last chip.
  - **Add system** is now **Log system**; a dashed "Warped somewhere new? Log it here" closes the list.
  - On phones Systems has no app header, like Home.
- **The app is called ATLAS:OS** inside the app and as an installed app (the manifest's name and short name; installs update in place). The address and the npm package keep their names for now.
- The app is now called ATLAS:OS in the project docs. The development protocol is `docs/process/build-prompt.md` v2.0, with two new policy gates: public surface and firewall. `docs/process/applicability.md` now matches the code: what sync, push alerts and the MCP server send, how long the relay keeps it, and the relay's abuse controls. Docs only.
- **Design tokens for the redesign** (`apps/web/src/tokens.css`): the new look's colours, type, radii, rhythm, state glows and motion, each a CSS variable and a Tailwind utility. `apps/web/DESIGN.md` describes the new design (tint-and-edge buttons, a four-tab bar with a search key, gesture buttons in three places, glow only as state). Orbitron 800 is bundled for the new titles. No screen changes yet: each moves to the tokens as it is rebuilt.

### Fixed
- **Gentler waits, offline and online.** The app opens on its logo instead of a blank page, the Codex, planner and Best crafts show placeholders while they load, and data that isn't on the device yet says so and offers Try again, instead of a message meant for developers.
- The Codex, Timers and Fleet no longer sit under the phone's status bar.
- At an address without encryption, Sync explains that, instead of saying it couldn't reach the server.
- On a phone, the search covers the whole screen again; the page behind it showed through.

## [3.20.0] - 2026-10-28
### Added
- **About** in More: ATLAS is fan-made and not affiliated with Hello Games, doesn't connect to the game or read your save, and where its data and code licences come from. Feedback goes to the project's GitHub issues. The desktop sidebar carries the fan-made line too.
- **Fix this on the wiki** under every Codex article: corrections go to the wiki's edit page, where every reader gets them, and reach ATLAS with the next sync.
- The Codex has the new Cosmos resource Comet Dust.

### Fixed
- **The wiki's licence is CC BY-NC-SA 3.0** (Attribution-NonCommercial-ShareAlike), as the wiki's own copyright page states. ATLAS said CC BY-SA 3.0 in every article, the Codex footer, the MCP server's answers and the licence files. `wiki/LICENSE` now says the wiki folder is under the wiki's licence, separate from the MIT code.
- The wiki sync names itself and gives a contact address when it talks to the wiki.

## [3.19.0] - 2026-10-28
### Added
- The sync relay's public usage summary also counts the vaults and push devices used in the last 30 days (migration `0004`), and the daily usage check opens one issue when active vaults reach a milestone, with the MCP package's npm downloads alongside. Aggregate numbers only, as before.

## [3.18.1] - 2026-10-27
### Changed
- `nms-atlas-mcp` republished so the npm package lists the maintainer's current account details; no code changes. `docs/mcp.md` lists the `best_crafts` tool.

## [3.18.0] - 2026-10-27
### Added
- **ATLAS's MCP server on npm** as `nms-atlas-mcp`: add `npx -y nms-atlas-mcp` to Claude Desktop or Claude Code, with no need to clone the repo. It downloads the wiki data from ATLAS's site on first run, keeps it in your cache folder, and checks for a newer copy once a day.
- **Best crafts** in Calculators, the first recommendation: what to craft for money, ranked by the value an item gains over what its raw materials would sell for, at the wiki's base values. Sort by total gain or gain per crafting step, filter by category and length, and send any pick to the recipe planner. The MCP server answers the same question (`best_crafts`).
- The code is now MIT-licensed (`LICENSE`). The wiki text stays CC BY-SA 3.0, from the No Man's Sky Wiki contributors.

## [3.17.1] - 2026-10-27
### Changed
- The sync server moved to `atlas-sync.nms-os.workers.dev`. Your sync code, synced log and alerts carry over; each device syncs again once it has opened this version.

## [3.17.0] - 2026-10-27
### Added
- **ATLAS for AI assistants:** a small MCP server (`apps/mcp`, `pnpm mcp`) that an AI client such as Claude Desktop or Claude Code runs on your computer. It answers from the Codex (search, articles, the recipe planner, item values, the wiki's slot rules, each with its wiki link) and from your own log (systems, outlaw stations, ships, notes, timers). It connects with your sync code, opening the encrypted copy on your computer, or reads an exported file. It only reads. Setup and privacy notes: `docs/mcp.md`.
- More → Sync says, under the code, that an assistant can read your log through it.

## [3.16.0] - 2026-10-27
### Added
- **Mechanics in the Codex:** eight game-mechanics pages from the wiki (Inventory, Supercharged Slot, Starship, Multi-Tool, Exosuit, Exocraft, Freighter, Starship Outfitting Terminal), checked by revision like every other page.
- **Cited facts:** the rules those pages state in prose (supercharged slots per class, how big a technology grid gets, where the Exosuit's slots are) are now data, each kept with the wiki sentence it comes from. Every wiki check confirms the sentence is still there; if it's gone, the rule stops being applied.
- **The slot picker follows the wiki:** 10 columns, rows up to the largest grid for the kind and class, and a note when you mark more supercharged slots than the class has. Each rule links to its Codex page. A note never stops you saving: your inventory screen wins.
- **Exosuit** in Ships & Multi-Tools, with its three fixed supercharged slots one tap away. With sync on, open the app once on every device before adding one: a device still on an older version would turn it into a starship.

### Changed
- Book III's first two rules now follow the wiki's wording ("almost always in the first 3 or 4 rows", rather than "the first 40 coordinates") and link to the Supercharged Slot page.

### Fixed
- Wiki lists whose items end in bold no longer run together (135 Codex articles, among them cooking, ship parts and inventory tables).

## [3.15.0] - 2026-10-27
### Security
Fixes from the security audit, before ATLAS is shared:
- **Sync can't empty your log.**
  - A sync that would remove many records (from a damaged or tampered copy, or a device that lost its log) now waits for you: apply it (your log from before is kept, and More → Sync → Put it back restores it), or keep this device's log.
  - A device whose stored log was damaged now restores from the cloud instead of syncing its emptiness.
- **Safer pairing.**
  - You're told to pair only with your own codes, and replacing a sync takes a second tap.
  - A code no device uploaded is refused instead of starting a new sync copy.
  - Both devices show the same short copy ID.
  - The code stays hidden behind a "not on stream" warning until you ask for it.
- **Tamper-evident copies.** Each synced copy is sealed together with its version, so the server can't hand back an older copy as current without the app noticing. Oversized or deeply nested copies are refused, and a copy stamped in the future no longer wins every edit clash.
- **Import** shows what the file holds and asks first, keeps your current log for Undo (More → Your data), and refuses files over 5 MB. With sync on, it combines the file with your synced log instead of erasing anything from other devices.
- **Alerts off** removes the alert token from the service worker first, and the service worker only ever talks to ATLAS's own server.
- **Pages and wiki text.**
  - Both pages now have a Content Security Policy.
  - Wiki pages and notes can't inject markup (text such as "<Crew name>" now shows as written instead of vanishing).
  - Oversized or malformed wiki pages are skipped in linear time.
- **Build pipeline.** The step that runs dependency code can no longer write to the repository; actions are pinned to exact commits, with Dependabot updates.

## [3.14.3] - 2026-10-27
### Added
- Name what sits in each supercharged slot ("Infra-Knife Accelerator"); the ship or Multi-Tool's card lists each slot with its name.
- "Add a row" under the slot grid, for inventories bigger than the first four rows.

## [3.14.2] - 2026-10-27
### Changed
- Supercharged slots are marked by tapping the inventory grid in the ship and Multi-Tool editor: tap a cell to mark it, tap again to clear it. With a keyboard, the arrow keys move and Space toggles.

## [3.14.1] - 2026-10-27
### Fixed
- "Alerts when the app is asleep" flips on as soon as you tap it, showing "Turning on…" while the browser registers for push (a second or two on desktop), and flips back if that fails.

## [3.14.0] - 2026-10-27
### Added
- **Ships & Multi-Tools:** keep your own ships and Multi-Tools, with their class, role, supercharged slots (drawn on a grid) and layout notes. Home's fleet card shows them, flagships first. If your log had the old fleet notes, they become your first entries automatically.
- **Notes:** write your own findings in Markdown, search them, import `.md` files, and pin any note to Home or to a Guide book; it then shows under that book as "Your notes". `[[Name]]` links open the Codex. Notes sync like the rest of your log.
- The header search finds your gear and your notes too.
### Changed
- ATLAS no longer ships anyone's own playthrough. A new player starts with an empty log: no ships, systems, checklist ticks or phase. Books II, III and V give general guidance instead of one player's ships and layouts. Your own log keeps everything it had.
- Your device's own log always wins over the app's starter file.
### Security
- Markdown in notes and the Codex renders through a strict allowlist: no images, styles or script links, since notes can arrive from a paired device.
### Fixed
- In the Codex's "New article" sheet, starting to type in an empty summary or body no longer moves the cursor to the title.

## [3.13.0] - 2026-10-27
### Added
- If ATLAS's free sync server fills up for the day, the app now says so plainly instead of "couldn't reach the server":
  - your log is safe on this device and syncs again after midnight UTC (shown in your local time);
  - a coffee on Ko-fi helps upgrade the server.

  The notice shows at most once a day, and the app stops calling the server until it resets.
### Security
- The sync and alert server is protected against abuse that could have stopped it for everyone. Found in a security audit:
  - per-client rate limits that also cover IPv6 networks, with stricter ones for registering new things;
  - smaller size caps, enforced even when the request doesn't state its size;
  - push schedules that only write what changed;
  - a bounded, fair alert queue;
  - updates and deletes that check ownership in the database itself.
### Internal
- The relay meters its own daily use, turns away new players at 80% of a free limit and answers "full until midnight UTC" at 95%. It reports aggregate usage at `/v1/status`; a daily workflow opens an issue when it's time to upgrade to Workers Paid (`docs/deploy.md`).
- Browser tests can declare console errors they provoke on purpose.

## [3.12.0] - 2026-10-27
### Added
- Alerts when the app is asleep: turn on the switch in the Session sheet (or More → This device), and a finished timer notifies you within about a minute even if your phone put the app to sleep. Tapping the notification opens the app.
  - It's off until you turn it on. Only your device's push address and each running timer's end time go to the alert server; timer names stay on your device.
  - On iPhone and iPad it needs the app on the Home Screen (iOS 16.4 or later).
### Internal
- The relay gains `/v1/push/:device` and a minute cron that sends due pushes; `migrations/0002_push.sql`. The VAPID private key is a Worker secret (ADR-0006).
- `@atlas/core/timers`: `pendingPushes()` and `timerNotice()`, shared by the app's own alert and the pushed one.

## [3.11.0] - 2026-10-27
### Added
- More → Support: a link to ATLAS's Ko-fi page, for anyone who'd like to buy a coffee. Everything stays free; nothing is locked behind it.

## [3.10.0] - 2026-10-27
### Added
- Sync between your devices, in More → Sync. It's off until you turn it on, and needs no account.
  - Turn it on, then pair your phone by scanning the QR code or pasting the code. Both logs are merged: systems, visits, notes and checklists from either side are kept, and an edit made on both goes to the copy saved last.
  - After that, devices sync on their own when you save, open the app or come back online.
  - Your log is encrypted on your device before it's sent; the relay keeps a locked copy it can't open, and deletes it after a year without syncing.
  - **Delete cloud copy** removes it for every device; **Turn off on this device** stops syncing here only.
  - If something needs you (the cloud copy was deleted, or storage is full), More shows an amber dot.
- A Support row in More for the app's Ko-fi page (hidden until the page is set).
### Internal
- `apps/sync`: the relay, a Cloudflare Worker with D1. Compare-and-swap versions, a 1 MB cap, a rate limit, no logs, and a yearly purge (ADR-0005).
- `@atlas/core/sync` (three-way merge) and `@atlas/core/sync-crypto` (sync code, HKDF, AES-GCM sealing).
- Browser tests build in `e2e` mode with a test relay address; normal builds without `VITE_SYNC_URL` carry no sync code.

## [3.9.0] - 2026-10-27
### Added
- Session mode: tap Start session on Home (or the timer button in the header) when you sit down to play. A slim bar at the top of every screen keeps time, shows the next timer's countdown and tallies this session's visits and packet runs. End it for a recap you can copy (or Resume, if you ended it by mistake); More lists your last five sessions.
- Timers, in the Session sheet: a refiner run, timed by the wiki's refining time per unit for the batches you make; a crop, with the harvest time you set, remembered for next time; and any custom timer, with quick times. Outlaw stations still restocking count down beside them.
- A finished timer shows a banner, vibrates and, if you allow it, sends a notification; tapping it opens the app. Alerts come while the browser runs the app; a phone that put the app to sleep shows them when you return.
- Timers and sessions are saved in your log, so they survive reloads and travel with Export and Import. Older saves load unchanged.
### Internal
- The phone sheet drag test waits until the sheet has no animation left running before touching its bar; comparing two quick position reads (3.7.1) could pass mid-slide.

## [3.8.0] - 2026-10-27
### Changed
- The main page's frame is React: the header with its search, Export and Import, the sidebar, the tab bar and the storage banner (ADR-0004 step 3, now complete). It works as before, at the same addresses; it now shows at once instead of waiting for your log to load.
- The Codex landing and the system panel on desktop lose a stray gap above their titles, and small labels sit a pixel or two tighter: Tailwind's own base styles replace the v3 compatibility layer.
### Fixed
- A search typed in the header before the wiki index had loaded never showed wiki results; they now fill in when the index arrives.
- Picking a guide passage in the header search could open its book at the top instead of at the passage; it now scrolls there.
- ArrowUp in the header search with nothing highlighted now goes to the last result (it went to the second-to-last).
- Accessibility: Systems and Outlaw Run have a top-level heading, and the whole page (header, sidebar, tab bar) is axe-gated in `pnpm check`.
### Internal
- `main.js`, `nav.js` and `companion.js` are gone, with every inline `on…=""` handler and the `window` exports; a test keeps handlers from coming back. Section routing is `src/ui/shell/section-store.ts`; systems search is `searchSystems()` in `@atlas/core`.
- The Tailwind v3 shims are gone (`tailwind-v3-preflight.css`, `tailwind-v3-spacing.css`, the fixed line heights), checked with a before/after screenshot diff of every screen.

## [3.7.1] - 2026-10-27
### Fixed
- "Keep screen on" sometimes took two taps to turn on. When the system had let the screen sleep (battery saver, a moment away from the app), the first tap switched off a setting that still read as on. A tap now always flips what the switch shows.
### Internal
- The phone sheet drag test waits for the sheet to finish sliding in before touching its bar; under load it sometimes measured mid-slide and missed.

## [3.7.0] - 2026-10-27
### Changed
- Guides, the six books and More are React screens (ADR-0004 step 3). They read and work as before, at the same addresses (`#guides`, `#book1`–`#book6`, `#more`); the books' text is unchanged.
- The header search's "In the manual" results come from the six books only; headings elsewhere on the page no longer show up there.
### Fixed
- Checklist steps in the books are real checkboxes: they can be ticked from the keyboard, and screen readers announce them as checked or not.
- Accessibility: Guides, Book I, Book III and More are axe-gated in `pnpm check`. Book section headings follow the book's title in order, and a table wider than a phone scrolls in a box you can reach with the keyboard.
### Internal
- The books and their checklists, and checklist progress, live in `@atlas/core/guides` with unit tests. Export/Import is a typed module (`src/app/backup.ts`) shared by More and the header; keep-awake, install and storage protection are one store (`src/ui/more/device-store.ts`) shared by More and Home.

## [3.6.0] - 2026-10-27
### Changed
- Codex articles put their index first on phones: right under the title, a row shows Contents, Used in, Links to, Mentioned in and Nearby with their counts, each opening a drawer at that list. Once you scroll past it, a strip under the header shows the section you're in and keeps the index one tap away. On wide screens the index stays the right-hand column.
- Every drawer on a phone closes the same way: tap its bar, or swipe it down (or tap outside, or Esc). The ✕ buttons are gone on phones; wider screens keep them. The system editor can be swiped closed too, but not while it has unsaved changes, and neither can a new Codex article with text in it.
- The Codex is a React page (ADR-0004 step 3). It looks and works as before: the same addresses, search, filters, quick look, keyboard shortcuts and drafts.
### Fixed
- Accessibility: the Codex is axe-gated in `pnpm check` (landing, results, quick look, article and its index), fixing its earlier findings (invalid list roles and attributes, an unnamed dialog, an empty heading).
### Internal
- The Codex's routes, filters and article relations are pure functions in `@atlas/core/codex` with unit tests. `wiki/index.json`, `offline-bundle.js`, `verification.json` and drafts are parsed with Zod schemas (`@atlas/core/wiki-files`) before use.
- `codex.js` and its `window` functions are gone; one shared Sheet component drives every phone drawer.

## [3.5.0] - 2026-10-27
### Changed
- Calculators opens on the recipe planner, with a dock at the top to switch between the planner, Base value, Extractors and Registers in one tap, without scrolling past the plan. The planner leads the dock and shows the plan in progress ("×1 Stasis Device · 3/14 gathered"). Switching keeps what you typed in each tool, and the chosen tool stays while the app is open.
- A planner tick now stays when what you gathered or crafted still covers a smaller need after a change of amount or recipe (500 Radon gathered covers a need of 300). A larger need still starts that tick fresh.
### Fixed
- The planner said "1 crafts in 1 rounds"; it now says "1 craft in 1 round". A long item name in the picker ends in an ellipsis instead of being cut off.

## [3.4.0] - 2026-10-27
### Changed
- The recipe planner is a build order instead of an indented tree. The product sits at the top with its worth against the raw inputs; below it, crafts are grouped into rounds (round 1 needs only raw materials); at the bottom, the raw materials wait in a cargo hold. Each intermediate appears once with its total.
- Tick off what you've gathered and crafted: a round lights up once its inputs are ticked. Ticks are kept on this device and are not part of your saved file. Changing the amount or a recipe keeps every tick whose amount is still needed; a new item starts fresh.
- Each alternative-recipe switch shows what the next recipe uses and how it changes the raw inputs' value before you tap it. The product's worth is compared with its raw inputs ("Worth 148× its raw inputs"). Large values read in billions ("1.56B Units").
- Calculators is a React screen (ADR-0004 step 3); its accessibility is checked (axe) in `pnpm check`.
### Fixed
- An intermediate used in several places was batched separately in each, which could overstate raw materials for multi-output crafts; it is now batched once on its total.
- The Harmonic Camp registers no longer evaluate what you type as code; they parse arithmetic only.
### Internal
- `PRODUCT.md` (product truth for design work) and the planner's design brief in `apps/web/.impeccable/`.

## [3.3.0] - 2026-10-27
### Changed
- Systems, the system panel (view and editor) and Outlaw Run are React screens (ADR-0004 step 3). They look and work as before; relative times and restock countdowns refresh every minute and when you return to the app.
- Notes saved in another tab now show in an open panel straight away, not only after you leave the notes field. Typing in progress is still kept when another tab saves.
- Accessibility: the closed system panel can no longer be reached with the keyboard, focus returns to what opened it, and the editor's choice groups, the planet fields and the visit note have labels. Systems, Outlaw Run, the panel and the editor are now axe-gated in `pnpm check`.
### Fixed
- Sorting Systems by region put systems without a region first; they now come last, as intended.
- Opening another system while notes were still being typed could save those notes onto the wrong system.
### Internal
- The list filters, the outlaw run and the "Paste a list" parser are pure functions in `@atlas/core` with unit tests; Home and Outlaw Run share one outlaw calculation.
- `systems.js` and its 31 `window` functions are gone.

## [3.2.0] - 2026-10-27
### Changed
- Home is the first React screen (ADR-0004 step 3): it looks and works as before, and refreshes its relative times every minute and when you return to the app. The rest of the app is unchanged.
- The "I’m here" buttons on Home announce "I’m here: <system>" to screen readers, matching what's on screen.
### Added
- React tooling: component tests (Vitest + Testing Library), React lint rules, and a store subscription later screens reuse.
- Accessibility (axe) on Home now fails `pnpm check` on any violation (browser tests run locally, not in CI).
### Internal
- CI actions updated to their Node 24 releases.

## [3.1.0] - 2026-10-27
### Added
- ADR-0004: full-stack TypeScript (React + Vite, Zod, pnpm workspaces), with a stepwise migration plan. Steps 1 and 2 ship in this release.
- An offline browser test: after one online visit, Home, Systems, Calculators and the Codex (search and a previously read article) work with the network cut.
- `pnpm typecheck` (strict TypeScript) and Prettier; CI type-checks before every deploy.
- A report-only accessibility check (axe) on Home, Systems, Calculators and the Codex; its baseline is in `docs/STATE.md`.
### Changed
- The app is built with Vite (`apps/web`) and served from the build. Shared logic is strict TypeScript in `packages/core`, the wiki sync in `packages/wiki`; Node runs the sync's `.ts` files directly. pnpm replaces npm.
- Nothing loads from a CDN any more: Tailwind is compiled at build time, Phosphor icons, marked and DOMPurify are bundled, and Inter, Orbitron and JetBrains Mono are self-hosted (visitors' IP addresses are no longer sent to Google Fonts). Screens render as before.
- New service worker (Workbox) at the same `sw.js` address, so installed apps update in place: each deploy is one consistent precached version; the shared state file and the verification report stay network-first; wiki articles are cached as they are read. The old worker's caches are deleted.
- The state schema, game-data file, wiki API responses and article frontmatter are parsed with Zod; import errors read exactly as before. Outlaw settings saved as text ("5") are now stored as numbers.
- Unit tests run on Vitest; browser tests run against the built app.
### Fixed
- A Codex article could show raw Markdown if the CDN libraries failed to load; they are now bundled.
- A system field whose value was an inherited name such as `toString` (star class, race, conflict) was kept instead of cleared.

## [3.0.0] - 2026-10-27
### Added
- Development harness: lean `AGENTS.md`, `CLAUDE.md`, `docs/` (architecture, state schema, wiki mirror, deploy, calculators), ADRs 0001–0003, `docs/STATE.md`, and the prompt-graph protocol in `docs/process/`.
- Test tooling: ESLint, `node:test` unit tests, and a Playwright suite (41 checks on desktop and phone sizes) that pins current behaviour. `npm run check` runs all three locally; CI runs lint and unit tests on the synced wiki data before any commit-back or deploy.
- `scripts/serve.mjs`, a dependency-free local server (`npm start`).
- Unit tests for state merging and migration, the systems model and outlaw timer, the recipe planner, search, and the wiki parser (real page fixtures), plus guards that every inline handler is exposed and every module is precached offline.
- State schema guard: imports, the browser copy and the repo's `nms_state.json` are validated; invalid imports are rejected with the exact path and reason.
- An unreadable browser copy is preserved under `nms_master_os_state.corrupt-<time>` instead of being overwritten, with a banner explaining it.
- A persistent banner with Export when the browser refuses to save (storage full or private mode).
- Tabs stay in step: a save in one tab is picked up by the others, so a stale tab can't overwrite newer data.
- Timeouts on every fetch, and validation of the wiki API's responses before the sync writes anything.
### Changed
- **Breaking:** the app is now native ES modules (`assets/lib/` pure logic, `assets/app/` UI, `wiki/codex.js`). Opening `index.html` directly from disk (`file://`) no longer works; use `npm start`, the live site or the installed app.
- The wiki parser moved to `scripts/lib/wikitext.mjs`; mirror output is byte-identical.
### Fixed
- The Favourites filter on Systems (its button read a variable that is no longer global).
- Switching sections quickly no longer raises an uncaught "Transition was skipped" error.

## [2.6.0] - 2026-10-26
### Added
- Recipe planner: any craftable or cookable item, expanded to raw materials with totals, base values, alternative recipes and batch yields, from the wiki mirror.
- Base-value and mineral-extractor calculators on wiki values.
- Outlaw Run settings for your own packet price and nanite yield.
### Changed
- Calculators read `wiki/game-data.json` instead of hand-typed numbers. The Stasis Device totals now match the wiki (500 Radon/Sulphurine/Nitrogen per device) and the Anomalous Doughnut uses its real recipe.
### Removed
- Estimates with no game-data basis: doughnut scan payout, Units per salvaged ship, extractors-per-pipe rule.

## [2.5.0] - 2026-10-26
### Added
- Verified wiki mirror: 3,160 game-data pages rendered from wikitext at recorded revisions, structured recipes and fields, `npm run verify:wiki`, verification panel and per-article revision links in the Codex, "Used in" lists, redirect aliases.
- Weekly CI sync that commits changed wiki pages back to `main`.
### Changed
- Codex categories are now resources, products, cooking, fish, building, technology, places, missions, galaxies, updates. Article paths changed.
### Removed
- Mechanics prose pages and the hand-written starter articles from the Codex.

## [2.4.0] - 2026-10-26
### Added
- Home screen (current system, warp-back list, next outlaw run), Guides library, More page, bottom tab bar, edge-to-edge layout.
- Device integration: keep screen on, app-icon badge, haptics, share sheet, install prompt, persistent storage, swipe-to-close sheet, "Log a new system" shortcut.

## [2.3.0] - 2026-10-26
### Added
- Systems log: system details, tags, favourites, rating, notes, planets, visit journal, filters and sort, search integration.
- Outlaw Run rebuilt on systems tagged `outlaw`.
- The harvested wiki committed as a permanent archive.
### Changed
- The Logbook and outlaw stations migrate into `systems[]` automatically.

## [2.2.0] - 2026-10-26
### Added
- Installable PWA with offline support, deployed to GitHub Pages.

## [2.1.0] - 2026-10-26
### Added
- The Wiki Codex as its own page with faceted search, quick look and article view.

## [2.0.0] - 2026-10-26
### Added
- `nms_state.json` state protocol with Export/Import, the offline wiki Codex and harvester, and the UI overhaul.
