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
  resources: z.array(z.string()).optional()
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
  life: SourceSchema.extend({ flora: z.array(z.string()), fauna: z.array(z.string()) })
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
export function biomeFor(facts: PlanetFacts | null, word: string): Biome | null {
  if (!facts || !word.trim()) return null;
  const byName = facts.biomes.find(biome => same(biome.name, word));
  if (byName) return byName;
  const matches = facts.biomes.filter(biome => biome.descriptors.some(name => same(name, word)));
  // "Abandoned" is Barren, Dead and the Reliquary: the player picks, the app doesn't guess.
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

/** How severe a weather word is: from its biome's table first, then from any biome's (Barren borrows Scorched's). */
export function weatherClass(facts: PlanetFacts | null, biome: string, weather: string): WeatherClass | null {
  if (!facts || !weather.trim()) return null;
  const find = (entry: Biome) =>
    (['clear', 'normal', 'extreme'] as const).find(cls => entry.weather[cls].some(word => same(word, weather)));
  const own = facts.biomes.find(entry => same(entry.name, biome));
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
  const own = facts?.biomes.find(entry => same(entry.name, biome));
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
