// What a planet scan shows, as the wiki words it: the biomes and the prefixes the game puts before "Planet" or "Moon"
// ("Frostbound Planet" is Frozen), each biome's weather by severity, the sentinel words by activity level, and the
// words the discovery page uses for flora and fauna. The wiki index reads them from the archived pages into
// wiki/facts.json; nothing here hard-codes a game word. Temperature, the resources level and who discovered a planet
// are the player's own entries (ADR-0003).
import { z } from 'zod';

const SourceSchema = z.object({ page: z.string(), path: z.string(), revId: z.int() });

export const WEATHER_CLASSES = ['clear', 'normal', 'extreme', 'other'] as const;
export type WeatherClass = (typeof WEATHER_CLASSES)[number];
const WeatherSchema = z.object({
  clear: z.array(z.string()),
  normal: z.array(z.string()),
  extreme: z.array(z.string()),
  other: z.array(z.string()) // listed on the page without a severity (exotic weather, examples, colour tables)
});

export const BiomeSchema = SourceSchema.extend({
  name: z.string().min(1), // "Frozen", from the page title "Biome - Frozen"
  descriptors: z.array(z.string()),
  weather: WeatherSchema,
  // The resource pages the biome's article links to ("Dioxite", "Frost Crystal", "Radon"); an older file has none.
  resources: z.array(z.string()).optional(),
  // The Reliquary only: its names come in sets by the planet's main biome ("Frozen Relic" is a Frozen world's).
  ruined: z.array(z.object({ biome: z.string(), names: z.array(z.string()) })).optional(),
  // Exotic's sub-biomes, each with its names ("Glitch": Corrupted, …), so a choice can say "Exotic (Glitch)".
  subBiomes: z.array(z.object({ name: z.string(), names: z.array(z.string()) })).optional()
});
export type Biome = z.infer<typeof BiomeSchema>;

export const SENTINEL_LEVELS = {
  low: 'Low activity',
  high: 'High activity',
  aggressive: 'Aggressive',
  corrupted: 'Corrupted'
};
export type SentinelLevel = keyof typeof SENTINEL_LEVELS;

export const PlanetFactsSchema = z.object({
  biomes: z.array(BiomeSchema).min(1),
  sentinels: SourceSchema.extend({
    low: z.array(z.string()),
    high: z.array(z.string()),
    aggressive: z.array(z.string()),
    corrupted: z.array(z.string())
  }),
  life: SourceSchema.extend({ flora: z.array(z.string()), fauna: z.array(z.string()) }),
  // What else a scan can list, each by the wiki's own words (an older file has none of these):
  // the star's metal and its activated form ("Planets in these systems will have Copper or Activated Copper"),
  starMetals: SourceSchema.extend({
    metals: z.partialRecord(z.enum(['yellow', 'red', 'green', 'blue', 'purple']), z.array(z.string()))
  }).optional(),
  // the resources whose page says they're "found in underground planetary deposits" (Silver, Gold, Platinum),
  deposits: z.array(SourceSchema).optional(),
  // and the finds whose page says a planet's information panel shows them after a scan (Ancient Bones).
  finds: z.array(SourceSchema).optional(),
  // A property of the planet, not a resource: a line its discovery menu displays, as the game words it ("Vile Brood
  // Detected", from the Vile Brood page).
  detected: z.array(SourceSchema.extend({ label: z.string() })).optional(),
  // Infested worlds (the "Biome Subtype - Infested" page): their names by the main biome they overlay ("Icy Abhorrence"
  // is a Frozen world's; their weather is the main biome's), the names the page marks as taking no "Planet" or "Moon",
  // and the flora words it lists for them.
  infested: SourceSchema.extend({
    sets: z.array(z.object({ biome: z.string(), names: z.array(z.string()) })),
    alone: z.array(z.string()).optional(),
    flora: z.array(z.string()).optional()
  }).optional()
});
export type PlanetFacts = z.infer<typeof PlanetFactsSchema>;

/** "Biome - Frozen" → "Frozen"; null for any other page (and for "Biome Subtype - …"). */
export function biomePageName(title: string): string | null {
  return /^Biome - (.+)$/.exec(title.trim())?.[1]?.trim() ?? null;
}

// "[[Biome - Dead|Dead]]" reads "Dead"; "[[Tent]]" reads "Tent".
const unlink = (text: string) => text.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1');
const clean = (text: string) =>
  unlink(text)
    .replace(/\*\*|\*|`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

// The lines from a "## Heading" (case-insensitive) up to the next "## ", subsections included.
function section(body: string, heading: RegExp): string[] {
  const lines = body.split('\n');
  const start = lines.findIndex(line => /^## /.test(line) && heading.test(line.slice(3).trim()));
  if (start === -1) return [];
  const end = lines.findIndex((line, i) => i > start && /^## /.test(line));
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

const listItem = (line: string) => /^\s*(?:\d+\.|[-*])\s+(.+)$/.exec(line)?.[1];
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(cell => clean(cell));
const isTableRow = (line: string) => line.trim().startsWith('|');
const isRule = (line: string) => /^\|?\s*-{3}/.test(line.trim());

// The game file's footnote mark: "Waterworld1", "Planetary Anomaly 1" (no extra "Planet" text).
const unmark = (name: string) => name.replace(/(?<=[A-Za-z\]])\s?1$/, '');

function namesFromLines(lines: string[]): string[] {
  const names: string[] = [];
  const table: string[][] = [];
  for (const line of lines) {
    if (isTableRow(line)) {
      if (!isRule(line)) table.push(cells(line));
      continue;
    }
    const item = listItem(line);
    if (!item) continue;
    // The Reliquary: "LUSH RUINED - Abandoned Paradise, Overgrown, …".
    const ruined = /^[A-Z ]+?\s+-\s+(.+)$/.exec(item.replace(/\t+/g, ' '));
    if (ruined?.[1]) names.push(...ruined[1].split(',').map(clean));
    else if (!/:$/.test(item)) names.push(clean(item));
  }
  // Tables: a "Sequence" column holds numbers, the header row the sub-biomes' colours.
  const [header, ...rows] = table;
  const skip = header?.[0]?.toLowerCase() === 'sequence' ? 1 : 0;
  for (const row of rows) names.push(...row.slice(skip));
  return names.map(unmark).filter(name => name && !/^\d+\.?$/.test(name));
}

/**
 * The prefixes a biome's page lists under "Name generation": numbered lists, tables (Mega Exotic) and the Exotic
 * sub-biomes' own "Name generation" lists. Gas Giant's page says it in a sentence ("always **Gas Giant**").
 */
export function parseBiomeDescriptors(body: string): string[] {
  const names = section(body, /^name generation$/i);
  const own = namesFromLines(names);
  const always = /always \*\*([^*]+)\*\*/.exec(names.join('\n'))?.[1];
  if (always) own.push(clean(always));
  // Exotic: each sub-biome under "### …" starts with a plain "Name generation" line, then its list.
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.trim() !== 'Name generation') continue;
    const block: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j] ?? '';
      if (!line.trim() && !block.length) continue;
      if (!listItem(line)) break;
      block.push(line);
    }
    own.push(...namesFromLines(block));
  }
  return unique(own);
}

const severity = (header: string): WeatherClass | null => {
  const text = header.toLowerCase();
  if (text.startsWith('clear') || text.startsWith('calm')) return 'clear';
  if (text.startsWith('normal')) return 'normal';
  if (text.startsWith('extreme')) return 'extreme';
  return null;
};

/** A biome page's weather words by severity, from its "## Weather" tables and lists. */
export function parseBiomeWeather(body: string): Biome['weather'] {
  const out: Biome['weather'] = { clear: [], normal: [], extreme: [], other: [] };
  const lines = section(body, /^weather$/i);
  const add = (cls: WeatherClass, word: string) => {
    // "Wandering Hot Spots ([[Glasebach]])": the planet it was seen on isn't part of the word.
    const name = clean(word.replace(/\s*\(\[\[[^)]*\]\]\)\s*$/, ''));
    if (name && !/^\d+\.?$/.test(name) && !out[cls].includes(name)) out[cls].push(name);
  };
  let header: string[] | null = null;
  for (const line of lines) {
    if (!isTableRow(line)) {
      header = null;
      const item = listItem(line);
      // A line that is only a link names an example planet, not a weather.
      if (item && !/^\[\[[^\]]+\]\]$/.test(item.trim())) add('other', item);
      continue;
    }
    if (isRule(line)) continue;
    const row = cells(line);
    if (!header) {
      header = row;
      // A one-column table (Gas Giant) has no header: its first row is a weather too.
      if (!header.some(cell => severity(cell)) && header.length === 1) add('other', row[0] ?? '');
      continue;
    }
    row.forEach((cell, i) => {
      const head = header?.[i] ?? '';
      if (head.toLowerCase() === 'sequence') return;
      add(severity(head) ?? 'other', cell);
    });
  }
  return out;
}

/** The Sentinel page's adjectives by activity level, from the table headed "Low Sentinel Activity | …". */
export function parseSentinelWords(body: string): Omit<PlanetFacts['sentinels'], 'page' | 'path' | 'revId'> | null {
  const out = { low: [] as string[], high: [] as string[], aggressive: [] as string[], corrupted: [] as string[] };
  const lines = body.split('\n');
  const start = lines.findIndex(line => isTableRow(line) && /Low Sentinel Activity/.test(line));
  if (start === -1) return null;
  const levelOf = (head: string): SentinelLevel | null =>
    /^low/i.test(head)
      ? 'low'
      : /^high/i.test(head)
        ? 'high'
        : /^aggressive/i.test(head)
          ? 'aggressive'
          : /^corrupted/i.test(head)
            ? 'corrupted'
            : null;
  const levels = cells(lines[start] ?? '').map(levelOf);
  for (const line of lines.slice(start + 1)) {
    if (!isTableRow(line)) break;
    cells(line).forEach((cell, i) => {
      const level = levels[i];
      if (level && cell) out[level].push(cell);
    });
  }
  return out.low.length && out.high.length && out.aggressive.length ? out : null;
}

/** The words the discovery page lists for flora and for fauna ("### Flora", "### Fauna" under "Planet Data"). */
export function parseLifeWords(body: string): { flora: string[]; fauna: string[] } | null {
  const words = (heading: string) => {
    const lines = body.split('\n');
    const start = lines.findIndex(line => line.trim() === `### ${heading}`);
    if (start === -1) return [];
    const out: string[] = [];
    for (const line of lines.slice(start + 1)) {
      if (/^#{2,3} /.test(line)) break;
      const item = listItem(line);
      if (item) out.push(clean(item));
    }
    return unique(out);
  };
  const flora = words('Flora');
  const fauna = words('Fauna');
  return flora.length && fauna.length ? { flora, fauna } : null;
}

// Lookups. Words are matched without regard to case or surrounding spaces, as a player types them.
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The biome a name stands for: its own name ("Frozen") or a prefix only one biome uses ("Frostbound"). */
export function biomeFor(facts: PlanetFacts | null, typed: string): Biome | null {
  // The game shows "Frostbound Planet" or "Icy Moon": the body's word isn't part of the prefix.
  const word = typed.trim().replace(/\s+(?:planet|moon)$/i, '');
  if (!facts || !word) return null;
  const byName = facts.biomes.find(biome => same(biome.name, word));
  if (byName) return byName;
  const matches = biomesNamed(facts, word);
  // "Abandoned" is Barren, Dead and the Reliquary: the player picks, the app doesn't guess.
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

/**
 * The biomes that use a name: as one of their own prefixes, or as an Infested world's name over that biome ("Icy
 * Abhorrence" is Frozen; plain "Infested" is five biomes', so the player picks).
 */
export function biomesNamed(facts: PlanetFacts | null, typed: string): Biome[] {
  const word = typed.trim().replace(/\s+(?:planet|moon)$/i, '');
  if (!facts || !word) return [];
  const infested = (facts.infested?.sets ?? [])
    .filter(set => set.names.some(name => same(name, word)))
    .map(set => set.biome);
  return facts.biomes.filter(
    biome => biome.descriptors.some(name => same(name, word)) || infested.some(name => same(name, biome.name))
  );
}

/** Whether a planet's name is one of the Infested page's ("Icy Abhorrence", "Infested"). */
export function isInfested(facts: PlanetFacts | null, typed: string): boolean {
  const word = typed.trim().replace(/\s+(?:planet|moon)$/i, '');
  return Boolean(word) && (facts?.infested?.sets ?? []).some(set => set.names.some(name => same(name, word)));
}

/** The Infested page's names, for the descriptor list: those over `biome` first when one is given. */
export function infestedNames(facts: PlanetFacts | null, biome = ''): { own: string[]; other: string[] } {
  const sets = facts?.infested?.sets ?? [];
  const own = unique(sets.filter(set => biome && same(set.biome, biome)).flatMap(set => set.names));
  const other = unique(sets.flatMap(set => set.names)).filter(name => !own.includes(name));
  return { own, other };
}

/** Whether the wiki marks an Infested name as standing alone: the game shows no "Planet" or "Moon" after it. */
export function standsAlone(facts: PlanetFacts | null, typed: string): boolean {
  const word = typed.trim();
  return Boolean(word) && (facts?.infested?.alone ?? []).some(name => same(name, word));
}

/** The Infested page's flora words ("Twisted", "Screaming"…). */
export const infestedFlora = (facts: PlanetFacts | null): string[] => facts?.infested?.flora ?? [];

/**
 * The worlds a name can stand for when several do: each biome that uses it, worded as the wiki groups it ("Infested
 * Scorched" from the Infested page, "Exotic (Glitch)" from Exotic's sub-biome). Empty when it fits one or none, so
 * only an ambiguous name asks.
 */
export function namedWorlds(facts: PlanetFacts | null, typed: string): { biome: string; label: string }[] {
  const word = typed.trim().replace(/\s+(?:planet|moon)$/i, '');
  const biomes = biomesNamed(facts, word);
  if (!facts || biomes.length < 2) return [];
  const over = new Set(
    (facts.infested?.sets ?? []).filter(set => set.names.some(name => same(name, word))).map(set => set.biome)
  );
  // In the wiki's own order: the Infested table's columns first (Toxic, Scorched, … as the page lists them).
  const column = (name: string) => {
    const at = (facts.infested?.sets ?? []).findIndex(set => same(set.biome, name));
    return at === -1 ? Number.MAX_SAFE_INTEGER : at;
  };
  return [...biomes]
    .sort((a, b) => column(a.name) - column(b.name))
    .map(biome => {
      const own = biome.descriptors.some(name => same(name, word));
      const sub = own ? biome.subBiomes?.find(entry => entry.names.some(name => same(name, word)))?.name : undefined;
      const label =
        !own && over.has(biome.name) ? `Infested ${biome.name}` : sub ? `${biome.name} (${sub})` : biome.name;
      return { biome: biome.name, label };
    });
}

/** The lines a planet's discovery menu can display, as the game words them ("Vile Brood Detected"). */
export const detectedLines = (facts: PlanetFacts | null): NonNullable<PlanetFacts['detected']> => facts?.detected ?? [];

/** The line a word stands for ("Vile Brood Detected", or its page's name), if it is one rather than a resource. */
export const detectedLine = (facts: PlanetFacts | null, name: string): string | null =>
  detectedLines(facts).find(line => same(line.label, name) || same(line.page, name))?.label ?? null;

/** How severe a weather word is: from its biome's table first, then from any biome's (Barren borrows Scorched's). */
export function weatherClass(facts: PlanetFacts | null, biome: string, weather: string): WeatherClass | null {
  if (!facts || !weather.trim()) return null;
  const find = (entry: Biome) =>
    (['clear', 'normal', 'extreme'] as const).find(cls => entry.weather[cls].some(word => same(word, weather)));
  const own = biomeFor(facts, biome);
  const fromOwn = own && find(own);
  if (fromOwn) return fromOwn;
  for (const entry of facts.biomes) {
    const cls = find(entry);
    if (cls) return cls;
  }
  return null;
}

/** The weather words to offer for a biome: its own first, by severity. */
export function weatherWords(facts: PlanetFacts | null, biome: string): string[] {
  const own = biomeFor(facts, biome);
  if (!own) return [];
  return unique([...own.weather.clear, ...own.weather.normal, ...own.weather.extreme, ...own.weather.other]);
}

/** The activity level a sentinel word means ("Few" → low). */
export function sentinelLevel(facts: PlanetFacts | null, word: string): SentinelLevel | null {
  if (!facts || !word.trim()) return null;
  for (const level of Object.keys(SENTINEL_LEVELS) as SentinelLevel[]) {
    if (facts.sentinels[level].some(name => same(name, word))) return level;
  }
  return null;
}

/**
 * The pages a biome article links to in its sentences about resources ("The resources [[Dioxite]], [[Frost Crystal]],
 * and [[Radon]] can be found here."), by title. Other links (a tip to bring Oxygen) aren't the biome's resources.
 */
export function resourceLinks(body: string): string[] {
  const sentences = body
    .split(/(?<=\.)\s+|\n+/)
    .filter(sentence => /resource|can (?:always )?be found|extracted/i.test(sentence));
  return unique(
    sentences.flatMap(sentence =>
      [...sentence.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)].map(match => (match[1] ?? '').trim())
    )
  );
}

export const sentinelWords = (facts: PlanetFacts | null): string[] =>
  facts
    ? unique([
        ...facts.sentinels.low,
        ...facts.sentinels.high,
        ...facts.sentinels.aggressive,
        ...facts.sentinels.corrupted
      ])
    : [];

/** The Reliquary's name sets: "LUSH RUINED - Abandoned Paradise, Overgrown, …" → { set: "Lush", names }. */
export function parseRuinedSets(body: string): { set: string; names: string[] }[] {
  const out: { set: string; names: string[] }[] = [];
  for (const line of section(body, /^name generation$/i)) {
    const match = /^\s*[-*]\s+([A-Z][A-Z ]*?)\s+RUINED\s+-\s+(.+)$/.exec(line.replace(/\t+/g, ' '));
    if (!match?.[1] || !match[2]) continue;
    const set = match[1].charAt(0) + match[1].slice(1).toLowerCase();
    out.push({ set, names: unique(match[2].split(',').map(clean)) });
  }
  return out;
}

/**
 * The Infested page: its "Name generation" table has a column per main biome ("Lush | Toxic | …"), each cell a name;
 * a name marked "1" is one of the "exceptions … which do not receive additional text indicating the type of the
 * astronomical body" (no "Planet" or "Moon"). Its flora words are the list under "Floral Abundance Name Generation".
 */
export function parseInfested(body: string): {
  sets: { set: string; names: string[] }[];
  alone: string[];
  flora: string[];
} {
  const rows = section(body, /^name generation$/i)
    .filter(line => isTableRow(line) && !isRule(line))
    .map(cells);
  const [header, ...rest] = rows;
  const sets = (header ?? [])
    .map((set, column) => ({ set, names: unique(rest.map(row => unmark(row[column] ?? ''))) }))
    .filter(entry => entry.set && entry.names.length);
  const marked = (cell: string) => cell !== unmark(cell);
  const alone = unique(rest.flatMap(row => row.filter(marked).map(unmark)));
  const flora: string[] = [];
  const lines = section(body, /^flora$/i);
  const start = lines.findIndex(line => /^#+\s*Floral Abundance Name Generation/i.test(line.trim()));
  for (const line of start === -1 ? [] : lines.slice(start + 1)) {
    if (/^#/.test(line.trim())) break;
    const item = listItem(line);
    if (item) flora.push(clean(item));
  }
  return { sets, alone, flora: unique(flora) };
}

/** Exotic's sub-biomes: each "### Name" whose text starts with a plain "Name generation" line, and that list. */
export function parseSubBiomes(body: string): { name: string; names: string[] }[] {
  const lines = body.split('\n');
  const out: { name: string; names: string[] }[] = [];
  let heading = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const title = /^###\s+(.+)$/.exec(line)?.[1];
    if (title) heading = clean(title);
    if (/^## /.test(line)) heading = '';
    if (line.trim() !== 'Name generation' || !heading) continue;
    const block: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j] ?? '';
      if (!next.trim() && !block.length) continue;
      if (!listItem(next)) break;
      block.push(next);
    }
    const names = unique(namesFromLines(block));
    if (names.length) out.push({ name: heading, names });
  }
  return out;
}

/** A page saying planets with it display a line in their discovery menu: `display "Vile Brood Detected" in …`. */
export function discoveryLine(body: string): string | null {
  return /display "([^"]+ Detected)" in (?:their|the|its) discovery menu/i.exec(body)?.[1]?.trim() ?? null;
}

/** The Star system page's metals by star colour: "Yellow star systems … will have [[Copper]] or [[Activated Copper]]". */
export function parseStarMetals(
  body: string
): Partial<Record<'yellow' | 'red' | 'green' | 'blue' | 'purple', string[]>> {
  const out: Partial<Record<'yellow' | 'red' | 'green' | 'blue' | 'purple', string[]>> = {};
  for (const line of body.split('\n')) {
    const colour = /^\s*[-*]\s+(Yellow|Red|Green|Blue|Purple)\b[^.]*star systems/.exec(line)?.[1];
    const metals = /will have \[\[([^\]|]+)\]\] or \[\[([^\]|]+)\]\]/.exec(line);
    if (colour && metals?.[1] && metals[2]) {
      out[colour.toLowerCase() as keyof typeof out] = [metals[1].trim(), metals[2].trim()];
    }
  }
  return out;
}

/** A resource page that says it's found in underground planetary deposits (Silver, Gold, Platinum). */
export const isDeposit = (body: string): boolean => /found in underground planetary deposits/i.test(body);

/**
 * A page about something a planet's scan lists: it says the planet's information panel shows *it* ("It is indicated
 * on the information panel of a planet…", "the information panel indicates it"). A page naming something else
 * ("Ancient Bones will be indicated…" on the burial site's page) doesn't count.
 */
export const isScanFind = (body: string): boolean =>
  /\bIt is indicated on the information panel of a (?:\[\[)?planet|information panel indicates it\b/i.test(body);

export type ResourceGroup = 'biome' | 'star' | 'deposit' | 'find';
export interface ResourceChoices {
  group: ResourceGroup;
  /** "Frozen biome", "Yellow star", "Deposits", "Finds". */
  label: string;
  names: string[];
}

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * What a planet's scan can list, grouped by why the wiki says it can be there: the biome's own resources, the star's
 * metal and its activated form, the deposits and the finds. Groups the wiki says nothing about for this planet are
 * left out (no biome or no star colour logged).
 */
export function resourceChoices(facts: PlanetFacts | null, biome: string, star: string): ResourceChoices[] {
  if (!facts) return [];
  const own = biomeFor(facts, biome);
  const metals = star ? facts.starMetals?.metals[star as 'yellow'] : undefined;
  const groups: ResourceChoices[] = [
    { group: 'biome', label: own ? `${own.name} biome` : '', names: own?.resources ?? [] },
    { group: 'star', label: `${capital(star)} star`, names: metals ?? [] },
    { group: 'deposit', label: 'Deposits', names: (facts.deposits ?? []).map(page => page.page) },
    { group: 'find', label: 'Finds', names: (facts.finds ?? []).map(page => page.page) }
  ];
  return groups.filter(group => group.names.length);
}

/** Why a resource can be on this planet, as a short label for its row: "Frozen biome", "yellow star", "deposit", "find". */
export function resourceSource(facts: PlanetFacts | null, name: string, biome: string, star: string): string | null {
  const group = resourceChoices(facts, biome, star).find(choice => choice.names.some(other => same(other, name)));
  if (!group) return null;
  if (group.group === 'biome') return group.label;
  if (group.group === 'star') return `${star} star`;
  return group.group;
}

/**
 * A Reliquary world's main biome, from the set its name belongs to ("Frozen Relic" → Frozen); null when its name
 * fits several sets ("Abandoned", "Ruined") or none. The player's own biome pick comes first, elsewhere.
 */
export function reliquaryMainBiome(facts: PlanetFacts | null, descriptor: string): Biome | null {
  const reliquary = facts?.biomes.find(entry => entry.ruined?.length);
  if (!facts || !reliquary || !descriptor.trim()) return null;
  const sets = (reliquary.ruined ?? []).filter(set => set.names.some(name => same(name, descriptor)));
  const biomes = unique(sets.map(set => set.biome));
  return biomes.length === 1 ? (facts.biomes.find(entry => entry.name === biomes[0]) ?? null) : null;
}

/** Whether a planet is a Reliquary world: its biome says so, or its name belongs only to the Reliquary's sets. */
export function isReliquary(facts: PlanetFacts | null, planet: { biome: string; descriptor?: string }): boolean {
  const reliquary = facts?.biomes.find(entry => entry.ruined?.length);
  if (!reliquary) return false;
  if (same(planet.biome, reliquary.name)) return true;
  return biomeFor(facts, planet.descriptor ?? '')?.name === reliquary.name;
}

/** The pill's word for a sentinel level: "Low", "High", "Aggressive", "Corrupted". */
export const SENTINEL_SHORT: Record<SentinelLevel, string> = {
  low: 'Low',
  high: 'High',
  aggressive: 'Aggressive',
  corrupted: 'Corrupted'
};
export const WEATHER_SHORT: Record<Exclude<WeatherClass, 'other'>, string> = {
  clear: 'Clear',
  normal: 'Normal',
  extreme: 'Extreme'
};
/** The game's danger, the only levels drawn in crimson (c15): extreme weather, aggressive or corrupted sentinels. */
export const isDangerWeather = (cls: WeatherClass | null): boolean => cls === 'extreme';
export const isDangerSentinels = (level: SentinelLevel | null): boolean =>
  level === 'aggressive' || level === 'corrupted';

/** A weather word's severity and the biome table that says so ("Icy Blasts" → Normal, from Frozen's). */
export function weatherSource(
  facts: PlanetFacts | null,
  biome: string,
  weather: string
): { cls: Exclude<WeatherClass, 'other'>; biome: string } | null {
  if (!facts || !weather.trim()) return null;
  const find = (entry: Biome) =>
    (['clear', 'normal', 'extreme'] as const).find(cls => entry.weather[cls].some(word => same(word, weather)));
  const own = biomeFor(facts, biome);
  const fromOwn = own && find(own);
  if (own && fromOwn) return { cls: fromOwn, biome: own.name };
  for (const entry of facts.biomes) {
    const cls = find(entry);
    if (cls) return { cls, biome: entry.name };
  }
  return null;
}

/** What of a planet's scan is logged: the rows of the game's scan, what it lists, and the discovery. */
export function scanLogged(planet: {
  weather: string;
  abundance: string;
  fauna: string;
  flora: string;
  sentinels: string;
  temperature: number | null;
  resources: string[];
  discoveredBy: string;
  discoveredOn: string;
}): { rows: boolean; any: boolean } {
  const rows = Boolean(
    planet.weather ||
    planet.abundance ||
    planet.fauna ||
    planet.flora ||
    planet.sentinels ||
    planet.temperature !== null
  );
  return { rows, any: rows || planet.resources.length > 0 || Boolean(planet.discoveredBy || planet.discoveredOn) };
}
