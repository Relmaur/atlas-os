// Wikitext → Markdown + structured data for the wiki mirror (pure: no network, no file system).
// Used by packages/wiki/src/sync.ts and covered by packages/wiki/test/wikitext.test.ts.
import { z } from 'zod';
import { RecipeSchema, type Recipe, type RecipeItem, type RecipeType } from '@atlas/core/game-data';

export { slugify } from '@atlas/core/slug';

export interface Template {
  name: string;
  key: string;
  positional: string[];
  named: Record<string, string>;
}
export interface Context {
  title: string;
}
// One page as fetched from the wiki, with the infobox kind it was found through.
export interface Page {
  pageId: number;
  title: string;
  kind: string;
  revId: number;
  revTimestamp: string;
  content: string;
}

export const WIKI_BASE = 'https://nomanssky.fandom.com';
// The wiki's own copyright page (Project:Copyrights): CC BY-NC-SA 3.0 Unported. Every article carries it.
export const LICENSE = "CC BY-NC-SA 3.0 (No Man's Sky Wiki contributors)";

// Infobox template -> kind, in priority order (a page's kind is the first of these it embeds).
export const SCOPE: Record<string, string> = {
  'Resource infobox': 'resource',
  'Product infobox': 'product',
  'Technology infobox NEXT': 'technology',
  'Technology infobox': 'technology',
  'POI infobox': 'place',
  'Space Encounter infobox': 'encounter',
  'Mission infobox': 'mission',
  'Milestone infobox': 'milestone',
  'Galaxy infobox': 'galaxy',
  'Update infobox': 'update',
  // The wider game content (approved 2026-10-30). These infoboxes are shared with players' pages, so the rules in
  // gameKind() decide which pages of theirs are the game's own.
  'General infobox': 'general',
  'Flora infobox': 'flora',
  'Mineral infobox': 'mineral',
  'Starship infobox': 'starship',
  'Multitool infobox': 'multitool'
};
const WIDER = new Set(['general', 'flora', 'mineral', 'starship', 'multitool']);
export const SCOPE_KEYS = new Set(Object.keys(SCOPE).map(name => name.toLowerCase()));
// Game-mechanics pages have no game-data infobox: they are mirrored by title (kind "mechanic") for the rules they
// state in prose, which packages/wiki/src/facts.ts cites. A page already in scope through an infobox keeps its kind.
export const MECHANICS = [
  'Inventory',
  'Supercharged Slot',
  'Starship',
  'Multi-Tool',
  'Exosuit',
  'Exocraft',
  'Freighter',
  'Starship Outfitting Terminal',
  'Biome', // the biome families the planet marker colours (facts.ts)
  // What the galaxy map says about a system ("F4 // Water", "Prospecting // Opulent"), for the system editor's pickers.
  'Spectral class',
  'Economy',
  'Trading Economy',
  'Scientific Economy',
  'Advanced Materials Economy',
  'Mining Economy',
  'Power Generation Economy',
  'Technology Economy',
  'Manufacturing Economy'
];
export const FOLDERS = [
  'resources',
  'products',
  'cooking',
  'fish',
  'building',
  'technology',
  'places',
  'missions',
  'galaxies',
  'updates',
  'mechanics',
  'world',
  'lore'
];

// Pages without an infobox are the game's own when they sit in one of these categories (first match sets the kind).
// Categories that also gather players' pages (regions, Euclid, monoliths, derelict-freighter logs) are left out.
export const CATEGORY_KINDS: [category: string, kind: string][] = [
  ...['Lore', 'Autophage'].map(category => [category, 'lore'] as [string, string]),
  ['Biomes', 'biome'],
  ...[
    'Mechanics',
    'Starships',
    'Game Content',
    'Space Anomaly',
    'Technology',
    'Multi-Tool',
    'Journey milestones',
    'Point of Interest',
    'Exosuit',
    'Exocraft',
    'Freighter',
    'Interactions',
    'Terminal',
    'Specialist Terminal',
    'Secondary missions',
    'Blueprints',
    'Farming',
    'Artifact',
    'Resources',
    'Raw Materials',
    'Glyph',
    'Pre-Order',
    'AtlasPass',
    'Atlas Path',
    'Updates',
    'Community Research',
    'Daily Research',
    'Technology components',
    'Damaged Component',
    'Junk',
    'Trade commodities',
    'Raw Ingredient',
    'Edible Product',
    'Products - Base Building',
    'Animal Byproduct',
    'Harvested Agricultural Substance',
    'Compressed Atmospheric Gas',
    'Stabilised Reality Glitch',
    'Localised Earth Element',
    ...['Earth', 'Exotic', 'Fuel', 'Metal', 'Neutral', 'Oxide', 'Silicate', 'Special', 'Stellar'].map(e => `${e} elements`),
    'Exotic elements (Atlas)',
    ...['Health', 'Stamina', 'Utilities', 'Grenade', 'Laser', 'Projectile', 'Scan', 'Hyperdrive', 'Propulsion', 'Weapons'].map(
      t => `${t} technology`
    ),
    ...['Rail gun', 'Compact', 'Circle Blaze', 'Angle muzzle', 'Hose muzzle', 'Scrimshaw'].map(w => `Weapons - ${w}`)
  ].map(category => [category, 'mechanic'] as [string, string])
];
// A General-infobox page's kind follows its categories: story and people, rules, or else the living world.
const LORE_GROUPS = new Set(['Lore', 'Storyline', 'Storyline NPC', 'Travellers', 'NPC', 'Hirable NPC', 'Guilds', 'Sentinels', 'Korvax', 'Gek', "Vy'keen", 'Autophage']);
const MECHANIC_GROUPS = new Set(['Mechanics', 'Star systems', 'Galaxies', 'Anomalies', 'Planetary Settlement', 'Egg Sequencer', 'Terminal', 'Derelict Freighter', 'Pre-release', 'Resources']);
// The only Starship- and Multitool-infobox pages that are the game's own: the pre-order bonuses. Every other one is
// a ship or tool a player found.
export const GAME_SHIPS = ['Horizon Omega', 'Alpha Vector', 'Final Shadow XIV', 'Vertic-LX', 'Artios-VI'];

// Players' pages that the rules above would otherwise take: community catalogues and research, projects, hubs.
const COMMUNITY_TITLE =
  /^(Genus Catalog|GMEF)\b|Galactic Hub|EisHub|^HUB\d|^GHSH|\b(Starship|Multi-tool|Freighter) Catalogs?$|Starship Album$|Catalogs$|(Features|Horns|Documentation) Research$|Research Institute$/i;
const COMMUNITY_CATEGORIES = new Set([
  'Galactic Hub Exobiology Corps',
  'Fan Fiction',
  'Civilized Space',
  'Civilized Space - Support',
  'Community',
  'Album',
  'Unification Day 2022',
  'Rasamama Collectors Club',
  'Alliance of Galactic Travellers - Garden Worlds'
]);
const COMMUNITY_PAGES = new Set([
  'Nesdorinux Project',
  'Third-Party Tools',
  'Trouvaille',
  'Hertan Capital Portal',
  'League of Galactic Powers',
  'Galactic Authority Ascendancy',
  'Rezehnan Union',
  'Total Perspective Vortex',
  'The Economy of Activated Indium',
  'Companion Catalogue',
  'Egg Sequencer - Gene Splitter Results',
  'Handorch S99',
  'The Apostle of the Sun',
  'Sumoha Starfleet Starships Catalogue',
  'Damatagam Coalition Starship Catalogue',
  "No Man's Sky Unofficial Player Survey",
  'Property:Planet weather',
  'Strażnicy',
  'Strażnik/pl',
  'Project Elskyvin',
  'Eisvana Lore',
  'Community Farms',
  'Community Farms (Atlas)',
  'Woforssonsi Technology',
  'Ideal Tech Synergies',
  '2 Glyph Travellers'
]);
// Infobox fields only a player's page fills: who discovered it, the civilization that claims it.
const DISCOVERY_FIELD = /discover|civili[sz]/i;

const CATEGORY_LINK = /\[\[\s*category\s*:\s*([^\]|]+)/gi;
/** The categories a page's own wikitext puts it in (not those a template adds). */
export function pageCategories(content: string): string[] {
  return [...content.matchAll(CATEGORY_LINK)].map(match => {
    const name = (match[1] ?? '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
}

// Pages the wiki keeps for an older version of the game, e.g. "Blaze Javelin (Atlas)".
export const ARCHIVED_VARIANT =
  /\((Release|Foundation|Pathfinder|Atlas|Atlas Rises|NEXT|Abyss|Visions|Beyond|Synthesis|Living Ship|ExoMech|Desolation|Origins|Frontiers|Prisms|Expeditions|Waypoint|Interceptor|Fractal|Singularity|Echoes|Orbital|Worlds Part I+)\)$/i;

// ---------------------------------------------------------------------------
// Frontmatter (strings and objects are JSON, which is valid YAML)
// ---------------------------------------------------------------------------
export function toFrontmatter(fields: object): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(
      ([key, value]) =>
        `${key}: ${typeof value === 'number' || typeof value === 'boolean' ? value : JSON.stringify(typeof value === 'object' ? value : String(value))}`
    );
  return `---\n${lines.join('\n')}\n---\n\n`;
}

export function parseFrontmatter(text: string): { meta: Record<string, unknown>; body: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {}, body: text };
  const meta: Record<string, unknown> = {};
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    const raw = (kv[2] ?? '').trim();
    let value: unknown = raw;
    if (/^["{[]/.test(raw)) {
      try {
        value = JSON.parse(raw);
      } catch {
        value = raw.slice(1, -1);
      }
    } else if (raw.startsWith("'")) {
      value = raw.slice(1, -1).replace(/''/g, "'");
    } else if (raw === 'true' || raw === 'false') {
      value = raw === 'true';
    } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
      value = Number(raw);
    }
    meta[kv[1] ?? ''] = value;
  }
  return { meta, body: text.slice(match[0].length) };
}

// ---------------------------------------------------------------------------
// Wikitext parsing
// ---------------------------------------------------------------------------
// Index just past the "}}" that closes the "{{" at start, or -1.
export function closeBraces(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++;
      i++;
    } else if (text[i] === '}' && text[i + 1] === '}') {
      depth--;
      i++;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

// Split on a separator that is not inside {{templates}} or [[links]].
export function splitTop(text: string, sep = '|'): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{' || two === '[[') {
      depth++;
      current += two;
      i++;
      continue;
    }
    if ((two === '}}' || two === ']]') && depth > 0) {
      depth--;
      current += two;
      i++;
      continue;
    }
    if (text[i] === sep && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += text.charAt(i);
  }
  parts.push(current);
  return parts;
}

export function parseTemplate(inner: string): Template {
  const [rawName = '', ...rest] = splitTop(inner);
  const name = rawName
    .trim()
    .replace(/_/g, ' ')
    .replace(/^template:/i, '');
  const positional: (string | undefined)[] = [];
  const named: Record<string, string> = {};
  for (const part of rest) {
    const kv = part.match(/^\s*(\w[\w\s-]*?)\s*=([\s\S]*)$/);
    if (!kv) {
      positional.push(part.trim());
      continue;
    }
    const [, key = '', value = ''] = kv;
    if (/^\d+$/.test(key)) positional[Number(key) - 1] = value.trim();
    else named[key.toLowerCase()] = value.trim();
  }
  return { name, key: name.toLowerCase(), positional: Array.from(positional, p => p ?? ''), named };
}

// Replace each top-level {{template}} with render(template); nested ones are left to the renderer.
export function mapTemplates(text: string, render: (template: Template) => string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const start = text.indexOf('{{', i);
    if (start === -1) {
      out += text.slice(i);
      break;
    }
    const end = closeBraces(text, start);
    if (end === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, start) + render(parseTemplate(text.slice(start + 2, end - 2)));
    i = end;
  }
  return out;
}

export function topTemplates(text: string): Template[] {
  const found: Template[] = [];
  mapTemplates(text, template => {
    found.push(template);
    return '';
  });
  return found;
}

export const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  ndash: '–',
  mdash: '—',
  rarr: '→',
  larr: '←',
  times: '×',
  hellip: '…',
  deg: '°'
};
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

// Inline templates that stand for a word or a link; everything else (navboxes, queries, banners,
// layout helpers) renders as nothing.
export const INLINE: Record<string, (template: Template, ctx: Context) => string> = {
  units: () => ' Units',
  nanites: () => ' Nanites',
  quicksilver: () => ' Quicksilver',
  link: t => `[[${String(t.positional[0])}]]`,
  ilink: t => `[[${String(t.positional[0])}]]`,
  class: t => `${String(t.positional[0])}-class`,
  pagename: (t, ctx) => ctx.title,
  '!': () => '|',
  // {{Biome|Frozen}} is a link to "Biome - Frozen" that reads "Frozen".
  biome: t => `[[Biome - ${String(t.positional[0])}|${String(t.positional[0])}]]`,
  // {{cols|2|list}} only lays its list out in columns; the list is the content (the biome pages' name prefixes, the
  // discovery menu's flora and fauna words), so it stays, on lines of its own.
  cols: t => `\n${t.positional[1] ?? ''}\n`
};

// Recipe templates. Ingredient lists look like "Name,qty;Name,qty"; refiner and cooking
// recipes append ";outputQty;seconds%Label".
export function parseIngredients(spec: string): RecipeItem[] {
  return spec
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const at = item.lastIndexOf(',');
      const qty = Number(item.slice(at + 1).trim());
      return { name: plainText(item.slice(0, at)), qty: Number.isFinite(qty) ? qty : item.slice(at + 1).trim() };
    });
}

export function parseProcess(spec: string, type: RecipeType, title: string): Recipe {
  const pieces = spec
    .split(';')
    .map(piece => piece.trim())
    .filter(Boolean);
  const inputs = parseIngredients(pieces.filter(piece => piece.includes(',')).join(';'));
  const [outQty, timing = ''] = pieces.filter(piece => !piece.includes(','));
  const [time, ...rest] = timing.split('%');
  const label = rest.join('%').trim();
  return {
    type,
    inputs,
    outputs: [{ name: title, qty: Number(outQty) || 1 }],
    ...(time ? { seconds: Number(time) } : {}),
    ...(label ? { label } : {})
  };
}

export function parseRecipes(template: Template, title: string): Recipe[] {
  const specs = template.positional.filter(Boolean);
  switch (template.key) {
    case 'craft': // "Name,qty;Name,qty" with an optional ";outputQty"
      return specs.map(spec => {
        const pieces = spec
          .split(';')
          .map(piece => piece.trim())
          .filter(Boolean);
        const outQty = Number(pieces.find(piece => !piece.includes(','))) || 1;
        return {
          type: 'craft',
          inputs: parseIngredients(pieces.filter(piece => piece.includes(',')).join(';')),
          outputs: [{ name: title, qty: outQty }],
          ...(template.named.blueprint === 'yes' ? { blueprint: true as const } : {})
        };
      });
    case 'craftobsolete': {
      const inputs: RecipeItem[] = [];
      for (let i = 0; i + 1 < specs.length; i += 2) {
        const [name = '', qty = ''] = specs.slice(i, i + 2);
        inputs.push({ name: plainText(name), qty: Number(qty) || qty });
      }
      return inputs.length ? [{ type: 'craft', obsolete: true, inputs, outputs: [{ name: title, qty: 1 }] }] : [];
    }
    case 'poc-refine':
      return specs.map(spec => parseProcess(spec, 'refine', title));
    case 'cook':
      return specs.map(spec => parseProcess(spec, 'cook', title));
    case 'cookobsolete':
      return specs.map(spec => ({ ...parseProcess(spec, 'cook', title), obsolete: true }));
    case 'poc-repair':
      return specs.map(spec => ({ type: 'repair', inputs: parseIngredients(spec), outputs: [] }));
    case 'poc-dismantle':
      return specs.map(spec => ({
        type: 'dismantle',
        inputs: [{ name: title, qty: 1 }],
        outputs: parseIngredients(spec)
      }));
    default:
      return [];
  }
}

export const RECIPE_LABELS: Record<RecipeType, string> = {
  craft: 'Crafting',
  refine: 'Refiner',
  cook: 'Nutrient Processor',
  repair: 'Repair',
  dismantle: 'Dismantle'
};
export function recipeLine(recipe: Recipe): string {
  const list = (items: RecipeItem[]) => items.map(item => `${item.qty} × [[${item.name}]]`).join(' + ');
  const head = [
    `**${RECIPE_LABELS[recipe.type]}${recipe.obsolete ? ' (obsolete)' : ''}**`,
    recipe.label !== undefined && recipe.label !== '' && `*${recipe.label}*`,
    recipe.seconds !== undefined && `${recipe.seconds} s per unit`,
    recipe.blueprint && 'needs the blueprint'
  ]
    .filter(Boolean)
    .join(' · ');
  if (recipe.type === 'repair') return `- ${head}: ${list(recipe.inputs)}`;
  if (recipe.type === 'dismantle') return `- ${head} returns: ${list(recipe.outputs)}`;
  return `- ${head}: ${list(recipe.inputs)} → ${recipe.outputs.map(item => `${item.qty} × ${item.name}`).join(' + ')}`;
}

export function expandTemplates(text: string, ctx: Context): string {
  return mapTemplates(text, template => {
    if (SCOPE_KEYS.has(template.key)) return '';
    const recipes = parseRecipes(template, ctx.title);
    if (recipes.length) return `\n\n${recipes.map(recipeLine).join('\n')}\n\n`;
    const inline = INLINE[template.key];
    return inline ? expandTemplates(inline(template, ctx), ctx) : '';
  });
}

// [[File:…|caption with [[links]]]] needs bracket matching, not a regex.
export function removeBracketed(text: string, prefix: RegExp): string {
  let out = '';
  let i = 0;
  for (;;) {
    const found = text.slice(i).search(prefix);
    if (found === -1) {
      out += text.slice(i);
      break;
    }
    const at = i + found;
    let depth = 0;
    let j = at;
    for (; j < text.length - 1; j++) {
      if (text[j] === '[' && text[j + 1] === '[') {
        depth++;
        j++;
      } else if (text[j] === ']' && text[j + 1] === ']') {
        depth--;
        j++;
        if (depth === 0) break;
      }
    }
    out += text.slice(i, at);
    i = j + 1;
  }
  return out;
}

// Link patterns exclude "[" (and tag patterns "<") from their insides: real links never contain one, and allowing it
// makes every unclosed "[[" on a page rescan to its end (quadratic: seconds per page on a hostile one).
export function convertLinks(text: string): string {
  return removeBracketed(text, /\[\[\s*:?(File|Image|Media|Category|[a-z]{2}(-[a-z]+)?):/i)
    .replace(
      /\[\[([^\][|]+?)(?:#[^\][|]*)?(?:\|([^\][]*))?\]\]([a-z]*)/g,
      (_, rawTarget: string, label: string | undefined, suffix: string) => {
      const target = rawTarget.trim().replace(/_/g, ' ');
      const shown = `${label ?? target}${suffix}`.trim();
      return shown === target ? `[[${target}]]` : `[[${target}|${shown}]]`;
      }
    )
    .replace(/\[(https?:\/\/[^\s\][]+)\s+([^\][]+)\]/g, '[$2]($1)')
    .replace(/\[(https?:\/\/[^\s\][]+)\]/g, '[$1]($1)'); // not <url>: stray "<" is escaped later
}

export function convertInline(text: string): string {
  return text
    // Bold/italic opened at a line end continues on the next line. One closed there ("'''Glass''' ") ends its list
    // item: an odd number of quote runs on the line means the last one opens.
    .replace(/^([^\n]*?)('{2,5})[ \t]*\n/gm, (line: string, before: string, quotes: string) =>
      (before.match(/'{2,5}/g) ?? []).length % 2 === 0 ? `${before}${quotes}` : line
    )
    .replace(/'''''(.+?)'''''/g, '***$1***')
    .replace(/'''(.+?)'''/g, '**$1**')
    .replace(/''(.+?)''/g, '*$1*')
    .replace(/<br\s*\/?>/gi, '<br>')
    .replace(
      /<\/?(span|div|small|big|center|font|u|s|abbr|p|sub|sup|nowiki|onlyinclude|includeonly|noinclude|poem|mark|b|i)\b[^>]*>/gi,
      ''
    );
}

// MediaWiki tables -> Markdown tables; multi-line cells are joined with <br>.
// Innermost tables first, so a table nested in a cell doesn't leave its parent's "|}" behind.
export function convertTables(text: string): string {
  const innermost = /^[ \t]*\{\|[^\n]*\n((?:(?!^[ \t]*\{\|)[\s\S])*?)^[ \t]*\|\}[^\n]*$/m;
  while (innermost.test(text)) text = text.replace(innermost, (_, inner: string) => tableToMarkdown(inner));
  return text;
}

export function tableToMarkdown(inner: string): string {
  const rows: string[][][] = [];
  let row: string[][] | null = null;
  let headerRow = false;
  const cellText = (raw: string) => {
    const parts = splitTop(raw);
    return (parts.length > 1 && /=|^\s*$/.test(parts[0] ?? '') ? parts.slice(1).join('|') : raw).trim();
  };
  for (const line of inner.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|+')) continue;
    if (trimmed.startsWith('|-')) {
      row = null;
      continue;
    }
    if (trimmed.startsWith('!') || trimmed.startsWith('|')) {
      const isHeader = trimmed.startsWith('!');
      const current: string[][] = row ?? [];
      if (!row) {
        rows.push(current);
        if (rows.length === 1) headerRow = isHeader;
      }
      row = current;
      trimmed
        .slice(1)
        .split(isHeader ? /!!|\|\|/ : /\|\|/)
        .forEach(cell => current.push([cellText(cell)]));
    } else if (row?.length && trimmed) {
      row.at(-1)?.push(trimmed.replace(/^(?:[-*#]|1\.)\s+/, '• '));
    }
  }
  if (!rows.length) return '';
  const width = Math.max(...rows.map(r => r.length));
  const cell = (lines: string[]) =>
    lines
      .filter(Boolean)
      .join('<br>')
      .replace(/\[\[([^\][]*)\]\]/g, m => m.replace(/\|/g, '\\|'))
      .replace(/\n/g, ' ') || ' ';
  const md = rows.map(r => `| ${Array.from({ length: width }, (_, i) => cell(r[i] || [])).join(' | ')} |`);
  if (!headerRow) md.unshift(`| ${Array(width).fill(' ').join(' | ')} |`);
  md.splice(1, 0, `|${Array(width).fill(' --- ').join('|')}|`);
  return `\n${md.join('\n')}\n`;
}

export function convertBlocks(text: string): string {
  return text
    .split('\n')
    .map(line => {
      if (/^\s*[|!{]/.test(line)) return line; // table rows
      const heading = line.match(/^(={2,6})\s*(.+?)\s*\1\s*$/);
      if (heading) {
        const [, level = '', title = ''] = heading;
        return `\n${'#'.repeat(level.length)} ${title.replace(/\*\*/g, '')}\n`;
      }
      const list = line.match(/^([*#:;]+)\s*(.*)$/);
      if (!list) return line;
      const [, marks = '', item = ''] = list;
      const last = marks.at(-1);
      if (last === ';') return `**${item}**`;
      if (last === ':' && !/[*#]/.test(marks)) return item;
      return `${'  '.repeat(marks.length - 1)}${last === '#' ? '1.' : '-'} ${item}`;
    })
    .join('\n');
}

// A heading followed only by headings of the same or a higher level (or nothing) has no content.
export function dropEmptyHeadings(markdown: string): string {
  const lines = markdown.split('\n');
  const level = (line: string) => line.match(/^(#{1,6}) /)?.[1]?.length ?? 0;
  return lines
    .filter((line, i) => {
      const own = level(line);
      if (!own) return true;
      const next = lines.slice(i + 1).find(other => other.trim());
      return next !== undefined && (level(next) === 0 || level(next) > own);
    })
    .join('\n');
}

// Removes every `open … close` block in one pass (a lazy [\s\S]*? regex rescans to the end for each opening that
// is never closed, which is quadratic on a hostile page). An unclosed comment hides the rest, as MediaWiki does; an
// unclosed <ref> or <gallery> is left as it is.
export function removeBlocks(text: string, open: RegExp, close: string, unclosedHidesRest = false): string {
  const lower = text.toLowerCase();
  const pattern = new RegExp(open.source, 'gi');
  let out = '';
  let from = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index < from) continue;
    const end = lower.indexOf(close, match.index + match[0].length);
    if (end === -1) {
      if (unclosedHidesRest) return out + text.slice(from, match.index);
      break;
    }
    out += text.slice(from, match.index);
    from = end + close.length;
    pattern.lastIndex = from;
  }
  return out + text.slice(from);
}

export function cleanSource(text: string): string {
  return removeBlocks(
    removeBlocks(removeBlocks(text, /<!--/, '-->', true).replace(/<ref\b[^<>/]*\/>/gi, ''), /<ref\b[^<>]*>/, '</ref>'),
    /<gallery\b[^<>]*>/,
    '</gallery>'
  )
    .replace(/<references\s*\/?>/gi, '')
    .replace(/<\/?tabber[^<>]*>/gi, '')
    .replace(/__[A-Z]+__/g, '');
}

// After entities are decoded, any "<" that doesn't open one of the few tags articles keep becomes a literal "<":
// text like "<weapon name>" shows as written, and nothing in a wiki page can reach the page as markup.
const KEPT_TAGS = /<(?!\/?(?:br|code|pre|blockquote)\b)/gi;
export function escapeStrayHtml(markdown: string): string {
  return markdown.replace(KEPT_TAGS, '&lt;');
}

export function renderWikitext(text: string, ctx: Context): string {
  let md = cleanSource(text);
  md = expandTemplates(md, ctx);
  md = convertLinks(md);
  md = convertBlocks(md); // before bold/italic, whose "**" would read as a list marker
  md = convertInline(md);
  md = convertTables(md);
  md = escapeStrayHtml(decodeEntities(md))
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
  return dropEmptyHeadings(md)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Plain text for infobox values and ingredient names.
export function plainText(text: unknown): string {
  let out = cleanSource(String(text));
  out = mapTemplates(out, template => {
    const inline = INLINE[template.key];
    return inline ? plainText(inline(template, { title: '' })) : '';
  });
  out = convertLinks(out)
    .replace(/\[\[(?:[^\][|]*\|)?([^\][]*)\]\]/g, '$1')
    .replace(/\[([^\][]+)\]\([^()]+\)/g, '$1');
  out = out
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^<>]+>/g, '')
    .replace(/'{2,}/g, '');
  return decodeEntities(out).replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Page -> article
// ---------------------------------------------------------------------------
export const FACT_LABELS: Record<string, string> = {
  category: 'Category',
  subcategory: 'Subcategory',
  type: 'Type',
  rarity: 'Rarity',
  value: 'Value',
  symbol: 'Symbol',
  used: 'Used for',
  complexity: 'Base complexity',
  power: 'Power',
  level: 'Level',
  stats: 'Stats',
  recharge: 'Recharge',
  release: 'Added in',
  desc: 'Description',
  subtype: 'Subtype',
  order: 'Galaxy number',
  date: 'Release date',
  platform: 'Platforms',
  rewards: 'Rewards',
  frequency: 'Frequency',
  interaction: 'Interaction',
  system_types: 'System types',
  requires: 'Requires',
  series: 'Series',
  origin: 'Given by',
  implemented: 'Added in',
  prevmission: 'Previous mission',
  nextmission: 'Next mission',
  previous: 'Previous',
  next: 'Next'
};
export const HIDDEN_FIELDS = new Set([
  'image',
  'name',
  'color',
  'upgradeicon',
  'link',
  'alert_1',
  'alert_2',
  'ramifications',
  'notes',
  'datexbox',
  'dateps',
  'dateswitch',
  'datepc',
  'datemac',
  'steam',
  'gog',
  'platforms',
  'build'
]);

export function categoryFor(kind: string, fields: Record<string, string>): string {
  switch (kind) {
    case 'resource':
      return 'resources';
    case 'technology':
      return 'technology';
    case 'place':
    case 'encounter':
      return 'places';
    case 'mission':
    case 'milestone':
      return 'missions';
    case 'galaxy':
      return 'galaxies';
    case 'update':
      return 'updates';
    case 'mechanic':
    case 'starship':
    case 'multitool':
      return 'mechanics';
    case 'world':
    case 'flora':
    case 'mineral':
    case 'biome':
      return 'world';
    case 'lore':
      return 'lore';
  }
  const category = (fields.category || '').toLowerCase();
  const type = (fields.type || '').toLowerCase();
  if (category === 'fish' || type.endsWith('fish')) return 'fish';
  if (type === 'edible product' || type === 'raw ingredient') return 'cooking';
  if (/building|customisation|adornment|exhaust|container/.test(category) || /construction|decoration/.test(type))
    return 'building';
  return 'products';
}

export function summarize(markdown: string): string {
  const paragraph = markdown
    .split(/\n{2,}/)
    .map(block => block.trim())
    .find(block => block && !/^(#|\||-|>|\*\*[^*]+:\*\*)/.test(block) && block.length > 20);
  const text = (paragraph || '')
    .replace(/\[\[(?:[^\][|]*\|)?([^\][]*)\]\]/g, '$1')
    .replace(/<br>/g, ' ')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text;
}

// The in-game text, when the page quotes it, makes the best summary.
export function gameDescription(markdown: string): string {
  const match = markdown.match(/^##\s+(?:in-)?game description\s*\n([\s\S]*?)(?=^#{1,2}\s|(?![\s\S]))/im);
  return match?.[1] ?? '';
}

// The frontmatter of a mirrored article, as written by buildArticle() and read back by the sync and the indexer.
export const ArticleMetaSchema = z.looseObject({
  title: z.string().optional(),
  category: z.string().optional(),
  kind: z.string().optional(),
  summary: z.string().optional(),
  pageId: z.int().optional(),
  revId: z.int().optional(),
  revTimestamp: z.string().optional(),
  version: z.string().optional(),
  obsolete: z.boolean().optional(),
  status: z.enum(['current', 'removed']).optional(),
  source: z.string().optional(),
  license: z.string().optional(),
  data: z
    .looseObject({
      fields: z.record(z.string(), z.string()).optional(),
      value: z.number().optional(),
      recipes: z.array(RecipeSchema).optional()
    })
    .optional()
});
export type ArticleMeta = z.infer<typeof ArticleMetaSchema>;

export interface Article {
  excluded?: undefined;
  category: string;
  meta: {
    title: string;
    category: string;
    kind: string;
    summary: string;
    pageId: number;
    revId: number;
    revTimestamp: string;
    version: string;
    obsolete: boolean;
    status: 'current';
    source: string;
    license: string;
    data: { fields: Record<string, string>; value?: number; recipes: Recipe[] };
  };
  body: string;
}

const SCOPE_ORDER = Object.entries(SCOPE).map(([template, kind]) => [template.toLowerCase(), kind] as const);

/**
 * The kind of a main-namespace article when it's game content, else null. In order: one of the original game-data
 * infoboxes; a mechanics page named in MECHANICS; then the wider scope, where players' pages are told apart from the
 * game's by their discovery fields, titles and categories; last, a page with no infobox in a CATEGORY_KINDS category.
 */
export function gameKind(title: string, content: string): string | null {
  const templates = /infobox/i.test(content) ? topTemplates(cleanSource(content)) : [];
  const keys = new Set(templates.map(template => template.key));
  const match = SCOPE_ORDER.find(([key]) => keys.has(key));
  if (match && !WIDER.has(match[1])) return match[1];
  if (MECHANICS.includes(title)) return 'mechanic';
  const categories = pageCategories(content);
  if (COMMUNITY_PAGES.has(title) || COMMUNITY_TITLE.test(title) || categories.some(c => COMMUNITY_CATEGORIES.has(c)))
    return null;
  if (match) {
    const [key, kind] = match;
    if (kind === 'starship' || kind === 'multitool') return GAME_SHIPS.includes(title) ? kind : null;
    const box = templates.find(template => template.key === key);
    if (Object.entries(box?.named ?? {}).some(([field, value]) => value.trim() && DISCOVERY_FIELD.test(field))) return null;
    if (kind !== 'general') return kind;
    // An uncategorised General page is a player's draft or list, never one the wiki files under the game.
    if (!categories.length) return null;
    if (categories.some(c => LORE_GROUPS.has(c))) return 'lore';
    return categories.some(c => MECHANIC_GROUPS.has(c)) ? 'mechanic' : 'world';
  }
  // Any other infobox (planet, system, creature, base, civilization…) is a player's discovery or a community page.
  if (templates.some(template => template.key.includes('infobox'))) return null;
  return CATEGORY_KINDS.find(([category]) => categories.includes(category))?.[1] ?? null;
}

export const MAX_PAGE_CHARS = 256 * 1024; // the largest game-data page is ~60 KB; past this a page is broken or hostile

export function buildArticle(page: Page): Article | { excluded: string } {
  if (page.content.length > MAX_PAGE_CHARS) return { excluded: 'page too large' };
  const templates = topTemplates(cleanSource(page.content));
  const infobox = templates.find(template => SCOPE_KEYS.has(template.key));
  const fields: Record<string, string> = {};
  Object.entries(infobox?.named ?? {}).forEach(([key, value]) => {
    const text = plainText(value);
    if (text) fields[key] = text;
  });
  if (page.kind === 'technology' && /^provides \d+ slots/i.test(fields.type || ''))
    return { excluded: 'player-found multi-tool' };

  const version = templates.find(template => template.key === 'version')?.positional[0]?.trim() || '';
  const obsolete = templates.some(template => template.key === 'obsolete') || ARCHIVED_VARIANT.test(page.title);
  const recipes = templates.flatMap(template => parseRecipes(template, page.title));
  const value = Number((fields.value || '').replace(/,/g, ''));

  const facts = Object.entries(fields)
    .filter(([key]) => !HIDDEN_FIELDS.has(key))
    .map(
      ([key, text]) =>
        `- **${FACT_LABELS[key] || key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}:** ${text}`
    );
  const prose = renderWikitext(page.content, { title: page.title });
  const body = [`# ${page.title}`, facts.length ? `## Quick Facts\n\n${facts.join('\n')}` : '', prose]
    .filter(Boolean)
    .join('\n\n');
  const category = categoryFor(page.kind, fields);

  return {
    category,
    meta: {
      title: page.title,
      category,
      kind: page.kind,
      summary: summarize(gameDescription(prose)) || fields.desc || summarize(prose),
      pageId: page.pageId,
      revId: page.revId,
      revTimestamp: page.revTimestamp,
      version,
      obsolete,
      status: 'current',
      source: `${WIKI_BASE}/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      license: LICENSE,
      data: { fields, ...(fields.value && Number.isFinite(value) ? { value } : {}), recipes }
    },
    body: `${body}\n`
  };
}
