// The tools (ADR-0008). Every answer is computed by @atlas/core, the same functions the app's screens use, so the AI
// and the app never disagree. All tools are read-only. Game answers carry the Codex page and wiki revision they come
// from; the player's answers come from their own log, read through log.ts.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { glyphNames } from '@atlas/core/glyphs';
import { CATEGORIES, search } from '@atlas/core/search';
import { buildPlan, findItem } from '@atlas/core/planner';
import { haulValue } from '@atlas/core/calc';
import { rankCrafts, sortCrafts, type RankedCraft } from '@atlas/core/profit';
import { outlawSummary } from '@atlas/core/outlaw';
import { lastVisit, searchSystems, systemTags, tagSlug, type System } from '@atlas/core/systems-model';
import { searchNotes, noteExcerpt, byNewest, PIN_PLACES } from '@atlas/core/notes';
import { timerStatus } from '@atlas/core/timers';
import { slotRules, slotWarnings } from '@atlas/core/gear';
import type { AppState } from '@atlas/core/state';
import type { GameItem } from '@atlas/core/game-data';
import { findArticle, type Wiki } from './wiki.ts';
import { LogError } from './log.ts';
import pkg from '../package.json' with { type: 'json' };

export const SITE = 'https://atlas-os.cloud/app/';
const MAX_BODY = 30_000; // characters of an article; the longest patch notes run past 100k
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

type Reply = { content: { type: 'text'; text: string }[]; isError?: boolean };
const reply = (value: unknown): Reply => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const fail = (message: string): Reply => ({ content: [{ type: 'text', text: message }], isError: true });

const codexUrl = (path: string) => `${SITE}wiki/#/a/${encodeURIComponent(path)}`;
const source = (entry: { title: string; path?: string | undefined; url?: unknown; revId?: unknown }) => ({
  page: entry.title,
  codex: entry.path ? codexUrl(entry.path) : undefined,
  wiki: typeof entry.url === 'string' ? entry.url : undefined,
  revision: typeof entry.revId === 'number' ? entry.revId : undefined
});
const itemSource = (item: GameItem) => source(item);
const pinLabel = (key: string) =>
  PIN_PLACES.find(place => place.key === key)?.label ??
  (key.startsWith('gear:') ? 'Linked to a ship, Multi-Tool or Exosuit' : key);
const iso = (ms: number) => new Date(ms).toISOString();

export interface Deps {
  // The game data, loaded when a tool first needs it, so the server answers the client's handshake at once even
  // while a first download runs. A failed load is retried by the next call.
  loadWiki: () => Promise<Wiki>;
  loadLog: (() => Promise<AppState>) | null; // null: the player hasn't connected a log
  logSetupError?: string; // why the configured log can't be used
  now?: () => number;
}

const NO_LOG =
  'No ATLAS log is connected. Set ATLAS_SYNC_CODE (the code from More → Sync) or ATLAS_STATE_FILE (an exported ' +
  'log file) in this MCP server’s configuration. See docs/mcp.md in the ATLAS repo.';

function systemSummary(system: System) {
  const visit = lastVisit(system);
  return {
    name: system.name,
    galaxy: system.galaxy || undefined,
    region: system.region || undefined,
    glyphs: system.glyphs || undefined,
    tags: system.tags,
    favorite: system.favorite || undefined,
    planets: system.planets.length,
    lastVisit: visit?.at
  };
}

export function createServer({ loadWiki, loadLog, logSetupError, now = Date.now }: Deps): McpServer {
  let wikiError = 'The game data isn’t loaded.';
  let loading: Promise<Wiki> | null = null;
  const gameData = async (): Promise<Wiki | null> => {
    loading ??= loadWiki().catch((err: unknown) => {
      loading = null; // try again on the next call
      throw err;
    });
    try {
      return await loading;
    } catch (err) {
      wikiError = err instanceof Error ? err.message : String(err);
      return null;
    }
  };
  const noWiki = () => fail(wikiError);
  const server = new McpServer(
    { name: 'atlas', version: pkg.version },
    {
      instructions:
        "ATLAS is a No Man's Sky companion. Game answers come from its verified mirror of the No Man's Sky Wiki " +
        '(CC BY-NC-SA 3.0): cite the Codex or wiki link each tool returns, and say when the wiki has nothing. Player ' +
        'answers come from the player’s own ATLAS log (systems, outlaw stations, ships, notes, timers). Everything is ' +
        'read-only: to change the log, the player uses the app.'
    }
  );

  // A player tool: reads the log, or says plainly why it can't.
  const withLog =
    <A>(run: (state: AppState, args: A) => unknown) =>
    async (args: A): Promise<Reply> => {
      if (logSetupError) return fail(logSetupError);
      if (!loadLog) return fail(NO_LOG);
      try {
        return reply(await run(await loadLog(), args));
      } catch (err) {
        return fail(err instanceof LogError ? err.message : 'The ATLAS log couldn’t be read.');
      }
    };

  // ── Game data (the wiki mirror) ──
  server.registerTool(
    'search_codex',
    {
      title: 'Search the Codex',
      description:
        "Search ATLAS's mirror of the No Man's Sky Wiki (items, technology, places, missions, mechanics, life and worlds, lore, patch notes). " +
        'Returns titles, summaries and links; use read_article for a page’s full text.',
      inputSchema: {
        query: z.string().min(1).max(200),
        category: z.enum(Object.keys(CATEGORIES) as [string, ...string[]]).optional(),
        limit: z.int().min(1).max(25).default(10)
      },
      annotations: READ_ONLY
    },
    async ({ query, category, limit }) => {
      const wiki = await gameData();
      if (!wiki) return noWiki();
      const results = search(wiki.articles, query, { category: category ?? 'all' }).slice(0, limit);
      return reply({
        results: results.map(({ entry }) => ({
          title: entry.title,
          category: entry.category,
          summary: entry.summary,
          ...source(entry)
        })),
        wikiCheckedAt: wiki.checkedAt
      });
    }
  );

  server.registerTool(
    'read_article',
    {
      title: 'Read a Codex article',
      description:
        'The full text (Markdown) of one Codex article, by title or by the codex path search_codex returns, with its ' +
        'wiki revision. [[Links]] name other articles.',
      inputSchema: { title: z.string().min(1).max(300) },
      annotations: READ_ONLY
    },
    async ({ title }) => {
      const wiki = await gameData();
      if (!wiki) return noWiki();
      // A Codex link ("…#/a/wiki%2F…") names its path encoded; anything else is a title as typed ("100%" too).
      const link = /#\/a\/(.+)$/.exec(title)?.[1];
      let name = title;
      try {
        if (link) name = decodeURIComponent(link);
      } catch {
        name = link ?? title;
      }
      const entry = findArticle(wiki, name);
      if (!entry) return fail(`No Codex article is called “${title}”. Try search_codex.`);
      const body = entry.body ?? '';
      return reply({
        title: entry.title,
        category: entry.category,
        ...source(entry),
        version: entry.version,
        obsolete: entry.obsolete || undefined,
        removedFromWiki: entry.removed || undefined,
        license: entry.source === 'wiki' ? "CC BY-NC-SA 3.0, No Man's Sky Wiki contributors" : undefined,
        body: body.length > MAX_BODY ? `${body.slice(0, MAX_BODY)}\n\n[…cut: open the Codex link for the rest]` : body
      });
    }
  );

  server.registerTool(
    'plan_recipe',
    {
      title: 'Plan a craft',
      description:
        'The build order to craft or cook an item, as ATLAS’s recipe planner computes it from the wiki’s recipes: ' +
        'raw materials to gather, then crafting rounds (round 1 needs only raw materials).',
      inputSchema: { item: z.string().min(1).max(120), quantity: z.int().min(1).max(10_000).default(1) },
      annotations: READ_ONLY
    },
    async ({ item: name, quantity }) => {
      const wiki = await gameData();
      if (!wiki) return noWiki();
      const item = findItem(wiki.catalog, name);
      if (!item) return fail(`“${name}” isn’t an item in the wiki mirror. Try search_codex.`);
      const plan = buildPlan(wiki.catalog, item.title, quantity);
      if (!plan) return fail(`The wiki has no crafting or cooking recipe for ${item.title}.`);
      const step = (s: (typeof plan.rounds)[number][number]) => ({
        make: s.title,
        need: s.qty,
        batches: s.batches,
        makes: s.makes,
        recipe: s.recipe.type,
        inputsPerBatch: s.recipe.inputs.map(input => `${String(input.qty)} × ${input.name}`),
        ...(s.recipes.length > 1 ? { otherRecipes: s.recipes.length - 1 } : {})
      });
      return reply({
        item: item.title,
        quantity,
        gather: plan.raw.map(raw => ({ item: raw.title, quantity: raw.qty })),
        rounds: plan.rounds.map((round, i) => ({ round: i + 1, steps: round.map(step) })),
        final: step(plan.product),
        steps: plan.steps,
        source: itemSource(item),
        note: 'Recipes as the wiki gives them; the planner uses each item’s first recipe.'
      });
    }
  );

  server.registerTool(
    'item_value',
    {
      title: 'Value items',
      description:
        'The base value in units of items, from each wiki page’s infobox, and their total for given quantities.',
      inputSchema: {
        items: z
          .array(z.object({ name: z.string().min(1).max(120), quantity: z.int().min(1).max(1_000_000).default(1) }))
          .min(1)
          .max(50)
      },
      annotations: READ_ONLY
    },
    async ({ items }) => {
      const wiki = await gameData();
      if (!wiki) return noWiki();
      const rows = items.map(({ name, quantity }) => {
        const item = findItem(wiki.catalog, name);
        return { name, quantity, item, value: item?.value };
      });
      return reply({
        items: rows.map(row => ({
          name: row.item?.title ?? row.name,
          quantity: row.quantity,
          unitValue: row.value ?? null,
          total: row.value === undefined ? null : row.value * row.quantity,
          ...(row.item ? { source: itemSource(row.item) } : { problem: 'not in the wiki mirror' })
        })),
        total: haulValue(rows.map(row => ({ qty: row.quantity, value: row.value }))),
        note: 'Base values from the wiki; trade terminals pay more or less depending on the system’s economy.'
      });
    }
  );

  let ranked: ReturnType<typeof rankCrafts> | null = null; // ranked once, on first use
  server.registerTool(
    'best_crafts',
    {
      title: 'Best crafts for money',
      description:
        'What to craft or cook for money: items ranked by the value they gain over what their raw materials would ' +
        'sell for, at the wiki’s base values, through the recipe planner’s build order. Use plan_recipe for one ' +
        'item’s full build order.',
      inputSchema: {
        sort: z.enum(['gain', 'per-step']).default('gain'),
        category: z.enum(['products', 'cooking']).optional(),
        maxSteps: z.int().min(1).max(30).optional(),
        limit: z.int().min(1).max(50).default(10)
      },
      annotations: READ_ONLY
    },
    async ({ sort, category, maxSteps, limit }) => {
      const wiki = await gameData();
      if (!wiki) return noWiki();
      ranked ??= rankCrafts(wiki.catalog);
      const row = (craft: RankedCraft) => ({
        item: craft.item.title,
        makes: craft.makes,
        sellsFor: craft.value,
        rawMaterialsWorth: craft.rawValue,
        gain: craft.gain,
        multiplier: craft.multiplier === null ? null : Number(craft.multiplier.toFixed(1)),
        steps: craft.steps,
        needsBlueprints: craft.blueprint || undefined,
        source: itemSource(craft.item)
      });
      const crafts = sortCrafts(ranked.crafts, {
        sort,
        ...(category ? { category } : {}),
        ...(maxSteps ? { maxSteps } : {})
      });
      return reply({
        crafts: crafts.slice(0, limit).map(row),
        ranked: crafts.length,
        leftOut: ranked.skipped,
        note: 'Base values from the wiki; trade terminals pay more or less by the system’s economy. Gain is value over selling the raw materials instead.'
      });
    }
  );

  server.registerTool(
    'cited_facts',
    {
      title: 'Cited game rules',
      description:
        'Game rules ATLAS takes from the wiki’s prose, each with the exact sentence and page it comes from: ' +
        'supercharged slots per class, technology grid sizes, the Exosuit’s fixed slots.',
      annotations: READ_ONLY
    },
    async () => {
      const wiki = await gameData();
      if (!wiki) return noWiki();
      return reply({
        facts: Object.entries(wiki.facts?.facts ?? {}).map(([id, fact]) => ({
          id,
          value: fact.value,
          quote: fact.quote,
          page: fact.page,
          codex: codexUrl(fact.path),
          wiki: fact.url,
          revision: fact.revId
        }))
      });
    }
  );

  // ── The player's own log ──
  server.registerTool(
    'list_systems',
    {
      title: 'List my systems',
      description:
        'Star systems in the player’s ATLAS log, newest first, optionally filtered by words (name, region, tags, ' +
        'planets, notes) or one tag. Use get_system for one system’s planets, visits and notes.',
      inputSchema: {
        query: z.string().max(200).optional(),
        tag: z.string().max(40).optional(),
        limit: z.int().min(1).max(200).default(50)
      },
      annotations: READ_ONLY
    },
    withLog((state, { query, tag, limit }: { query?: string | undefined; tag?: string | undefined; limit: number }) => {
      let systems = [...(query?.trim() ? searchSystems(state.systems, query) : state.systems)].reverse();
      if (tag) systems = systems.filter(system => systemTags(system).has(tagSlug(tag))); // planets' tags count too
      return { total: systems.length, systems: systems.slice(0, limit).map(systemSummary) };
    })
  );

  server.registerTool(
    'get_system',
    {
      title: 'One of my systems',
      description:
        'Everything the player logged about one system: planets (with what their scan showed: description, biome, ' +
        'weather, sentinels, flora, fauna, resources, temperature in °C, discoverer), visits (with packets), tags and notes, and its ' +
        'portal address with each glyph’s name from the wiki, in dialling order.',
      inputSchema: { name: z.string().min(1).max(120) },
      annotations: READ_ONLY
    },
    withLog(async (state, { name }: { name: string }) => {
      const lower = name.trim().toLowerCase();
      const system = state.systems.find(s => s.name.toLowerCase() === lower) ?? searchSystems(state.systems, name)[0];
      if (!system) throw new LogError(`No system in the log matches “${name}”.`);
      // Without the game data the address is still there, just without names.
      const named = glyphNames(system.glyphs, (await gameData())?.facts?.glyphs ?? null);
      // Ids are the app's own bookkeeping; JSON leaves the undefined ones out.
      return {
        ...system,
        id: undefined,
        glyphNames: named?.map(glyph => glyph.name),
        planets: system.planets.map(planet => ({ ...planet, id: undefined }))
      };
    })
  );

  server.registerTool(
    'outlaw_status',
    {
      title: 'Outlaw Run status',
      description:
        'The player’s outlaw stations: which are ready to visit again, when the others restock, and the next ' +
        'run’s estimate, using the player’s own settings (restock time, packets per visit, prices).',
      annotations: READ_ONLY
    },
    withLog(state => {
      const summary = outlawSummary(state, now());
      const row = ({ system, status }: (typeof summary.rows)[number]) => ({
        name: system.name,
        glyphs: system.glyphs || undefined,
        ready: status.ready,
        status: status.label,
        readyAt: status.ready ? undefined : iso(status.readyAt)
      });
      return {
        now: iso(now()),
        ready: summary.ready.map(row),
        restocking: summary.rows.filter(r => !r.status.ready).map(row),
        nextRun: {
          stations: summary.run.map(r => r.system.name),
          packets: summary.runPackets,
          units: summary.runUnits,
          nanites: summary.runNanites
        },
        settings: state.outlaw,
        note: 'Restock time and prices are the player’s own settings, not wiki data.'
      };
    })
  );

  server.registerTool(
    'list_gear',
    {
      title: 'My ships, Multi-Tools and Exosuit',
      description:
        'The player’s gear: class, type, role, supercharged slots (R<row>C<col>) and what sits in each, notes, and ' +
        'the wiki’s rules for that kind and class, with anything the marks disagree with.',
      annotations: READ_ONLY
    },
    withLog(async state => {
      const facts = (await gameData())?.facts ?? null; // without the game data, the gear is listed without rules
      return {
        gear: state.gear.map(item => {
          const rules = slotRules(facts, item.kind, item.class);
          const warnings = slotWarnings(rules, item.superchargedSlots);
          return {
            name: item.name,
            kind: item.kind,
            class: item.class || undefined,
            type: item.type || undefined,
            role: item.role || undefined,
            superchargedSlots: item.superchargedSlots.map(slot => ({ slot, holds: item.slotLabels[slot] })),
            notes: item.notes || undefined,
            wikiRules: {
              superchargedSlots: rules.supercharged,
              fixedSlots: rules.fixed ?? undefined,
              techGrid: rules.sources.length ? { columns: rules.columns, maxRows: rules.maxRows } : undefined,
              sources: [...new Map(rules.sources.map(fact => [fact.path, fact])).values()].map(fact => ({
                page: fact.page,
                codex: codexUrl(fact.path)
              }))
            },
            ...(warnings.tooMany || warnings.outside.length || warnings.offPreset.length
              ? {
                  disagreesWithWiki: {
                    moreSuperchargedThanClassHas: warnings.tooMany || undefined,
                    outsideLargestGrid: warnings.outside.length ? warnings.outside : undefined,
                    notAFixedSlot: warnings.offPreset.length ? warnings.offPreset : undefined
                  }
                }
              : {})
          };
        })
      };
    })
  );

  server.registerTool(
    'search_notes',
    {
      title: 'Search my notes',
      description:
        'The player’s own Markdown notes (newest first), optionally matching words. Returns excerpts; use read_note ' +
        'for a full note.',
      inputSchema: { query: z.string().max(200).optional(), limit: z.int().min(1).max(50).default(20) },
      annotations: READ_ONLY
    },
    withLog((state, { query, limit }: { query?: string | undefined; limit: number }) => {
      const notes = query ? searchNotes(state.notes, query) : [...state.notes].sort(byNewest);
      return {
        total: notes.length,
        notes: notes.slice(0, limit).map(note => ({
          title: note.title,
          pinnedTo: note.pins.map(pinLabel),
          updatedAt: note.updatedAt,
          excerpt: noteExcerpt(note, 240)
        }))
      };
    })
  );

  server.registerTool(
    'read_note',
    {
      title: 'Read one of my notes',
      description: 'One of the player’s notes in full (Markdown), by title.',
      inputSchema: { title: z.string().min(1).max(200) },
      annotations: READ_ONLY
    },
    withLog((state, { title }: { title: string }) => {
      const lower = title.trim().toLowerCase();
      const note = state.notes.find(n => n.title.toLowerCase() === lower) ?? searchNotes(state.notes, title)[0];
      if (!note) throw new LogError(`No note matches “${title}”.`);
      return { title: note.title, pinnedTo: note.pins.map(pinLabel), updatedAt: note.updatedAt, body: note.body };
    })
  );

  server.registerTool(
    'list_timers',
    {
      title: 'My timers',
      description:
        'The player’s refiner, crop and custom timers: what’s still running and when it ends, and what’s done.',
      annotations: READ_ONLY
    },
    withLog(state => {
      const at = now();
      const timers = state.timers
        .map(timer => ({ timer, status: timerStatus(timer, at) }))
        .sort((a, b) => Date.parse(a.timer.endsAt) - Date.parse(b.timer.endsAt));
      return {
        now: iso(at),
        running: timers
          .filter(t => !t.status.done)
          .map(({ timer, status }) => ({
            label: timer.label,
            kind: timer.kind,
            endsAt: timer.endsAt,
            minutesLeft: Math.ceil(status.remaining / 60_000)
          })),
        done: timers
          .filter(t => t.status.done)
          .map(({ timer }) => ({ label: timer.label, kind: timer.kind, endedAt: timer.endsAt }))
      };
    })
  );

  return server;
}
