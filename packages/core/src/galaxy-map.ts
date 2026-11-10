// What the galaxy map says about a system, as the wiki words it: the spectral class ("F4", whose first letter gives
// the star's colour), the economy, a name ("Prospecting", one of the Mining economy's four) and a strength word
// ("Opulent", a strong ★★★ economy), and the conflict word ("Peaceful", a Low conflict). The wiki index reads them from the archived pages into wiki/facts.json; nothing
// here hard-codes a game word.
import { z } from 'zod';
import { STAR_CLASSES, type ConflictLevel, type StarClass } from './systems-model.ts';

const SourceSchema = z.object({ page: z.string(), path: z.string(), revId: z.int() });
const STAR_KEYS = Object.keys(STAR_CLASSES) as [StarClass, ...StarClass[]];

export const GalaxyMapFactsSchema = z.object({
  spectral: SourceSchema.extend({
    // The first letter of a spectral class → the star's colour in the game ("F" → yellow). Letters the game doesn't
    // use (A, L, T) aren't listed.
    classes: z.record(z.string().regex(/^[A-Z]$/), z.enum(STAR_KEYS))
  }),
  economy: SourceSchema.extend({
    // The galaxy map's strength words, by stars: 1 weak, 2 average, 3 strong.
    strength: z.object({ 1: z.array(z.string()), 2: z.array(z.string()), 3: z.array(z.string()) }),
    types: z.array(SourceSchema.extend({ name: z.string(), names: z.array(z.string()).min(1) })).min(1)
  }),
  // The Conflict Level page's words by level (an older file has none): "Peaceful" is Low, "Pirate Controlled" an
  // outlaw system.
  conflict: SourceSchema.extend({
    levels: z.object({
      low: z.array(z.string()),
      medium: z.array(z.string()),
      high: z.array(z.string()),
      pirate: z.array(z.string())
    })
  }).optional()
});
export type GalaxyMapFacts = z.infer<typeof GalaxyMapFactsSchema>;

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(cell => cell.trim());

/** The Spectral class page's table: each class letter and the colour the game gives it. */
export function parseSpectralClasses(body: string): Record<string, StarClass> | null {
  const lines = body.split('\n');
  const start = lines.findIndex(line => /^\|\s*Class\s*\|\s*Temperature\s*\|/.test(line));
  if (start === -1) return null;
  const out: Record<string, StarClass> = {};
  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith('|')) break;
    const row = cells(line);
    const letter = row[0] ?? '';
    const colour = (row[row.length - 1] ?? '').toLowerCase();
    if (/^[A-Z]$/.test(letter) && colour in STAR_CLASSES) out[letter] = colour as StarClass;
  }
  return Object.keys(out).length ? out : null;
}

/** The Economy page's strength words, from the table headed "Weak Economy (★) | Average … | Strong …". */
export function parseEconomyStrength(body: string): GalaxyMapFacts['economy']['strength'] | null {
  const lines = body.split('\n');
  const start = lines.findIndex(line => line.trim().startsWith('|') && /Weak Economy/.test(line));
  const header = cells(lines[start] ?? '');
  const row = cells(lines[start + 2] ?? '');
  if (start === -1 || header.length !== 3 || row.length !== 3) return null;
  const words = (cell: string) =>
    cell
      .split(/<br\s*\/?>/)
      .map(word => word.replace(/^[•*\s-]+/, '').trim())
      .filter(Boolean);
  const out = { 1: words(row[0] ?? ''), 2: words(row[1] ?? ''), 3: words(row[2] ?? '') };
  return out[1].length && out[2].length && out[3].length ? out : null;
}

/** The names an economy type's page lists under "## Names". */
export function parseEconomyNames(body: string): string[] {
  const lines = body.split('\n');
  const start = lines.findIndex(line => line.trim() === '## Names');
  if (start === -1) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    const item = /^\s*[-*]\s+(.+)$/.exec(line)?.[1]?.trim();
    if (item) out.push(item);
  }
  return [...new Set(out)];
}

/** The Conflict Level page's words, from its "### Low (Level - 1 ★)" … "### Outlaw systems (Skull)" lists. */
export function parseConflictWords(body: string): NonNullable<GalaxyMapFacts['conflict']>['levels'] | null {
  const out = { low: [] as string[], medium: [] as string[], high: [] as string[], pirate: [] as string[] };
  let level: keyof typeof out | null = null;
  for (const line of body.split('\n')) {
    const heading = /^###\s+(.+)$/.exec(line)?.[1]?.toLowerCase();
    if (heading !== undefined) {
      level = heading.startsWith('low')
        ? 'low'
        : heading.startsWith('medium')
          ? 'medium'
          : heading.startsWith('high')
            ? 'high'
            : heading.startsWith('outlaw')
              ? 'pirate'
              : null;
      continue;
    }
    if (line.startsWith('## ')) level = null;
    const item = /^\s*[-*]\s+(.+)$/.exec(line)?.[1]?.trim();
    if (level && item) out[level].push(item);
  }
  return out.low.length && out.medium.length && out.high.length ? out : null;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The star colour a spectral class gives: "F4" → yellow; null when its letter isn't one the game uses. */
export function starFromSpectral(facts: GalaxyMapFacts | null, code: string): StarClass | null {
  const letter = code.trim().charAt(0).toUpperCase();
  return (letter && facts?.spectral.classes[letter]) || null;
}

/** The economy type a galaxy-map name stands for: "Prospecting" → "Mining". */
export function economyType(facts: GalaxyMapFacts | null, name: string): string | null {
  if (!facts || !name.trim()) return null;
  return (
    facts.economy.types.find(type => same(type.name, name) || type.names.some(other => same(other, name)))?.name ?? null
  );
}

/** How strong an economy word is, in stars: "Opulent" → 3. */
export function strengthStars(facts: GalaxyMapFacts | null, word: string): 1 | 2 | 3 | null {
  if (!facts || !word.trim()) return null;
  for (const stars of [1, 2, 3] as const)
    if (facts.economy.strength[stars].some(other => same(other, word))) return stars;
  return null;
}

export const economyNames = (facts: GalaxyMapFacts | null): string[] =>
  facts ? [...new Set(facts.economy.types.flatMap(type => type.names))].sort() : [];

export const strengthWords = (facts: GalaxyMapFacts | null): string[] =>
  facts ? [...facts.economy.strength[1], ...facts.economy.strength[2], ...facts.economy.strength[3]] : [];

/** The conflict level a galaxy-map word stands for: "Peaceful" → low, "Pirate Controlled" → pirate. */
export function conflictLevelOf(facts: GalaxyMapFacts | null, word: string): ConflictLevel | null {
  const levels = facts?.conflict?.levels;
  if (!levels || !word.trim()) return null;
  return (
    (['low', 'medium', 'high', 'pirate'] as const).find(level => levels[level].some(other => same(other, word))) ?? null
  );
}

export const conflictWords = (facts: GalaxyMapFacts | null): Record<ConflictLevel, string[]> | null =>
  facts?.conflict?.levels ?? null;

/**
 * The economy as the player logged it: the name and strength fields, or, in a log from before they were apart, both
 * typed in the name field as the map shows them ("High Tech // Balanced"). Read only; what was typed stays as typed.
 */
export function economyParts(system: { economy: string; economyStrength: string }): { name: string; strength: string } {
  const pair = /^(.+?)\s*\/\/\s*(.+)$/.exec(system.economy.trim());
  if (pair?.[1] && pair[2] && !system.economyStrength.trim()) return { name: pair[1].trim(), strength: pair[2].trim() };
  return { name: system.economy.trim(), strength: system.economyStrength.trim() };
}

/** A conflict level's stars, as the Galactic Map and the discovery menu number it (the wiki's Conflict Level page). */
export const CONFLICT_STARS = { low: 1, medium: 2, high: 3 } as const;

export interface ConflictReading {
  /** 1–3 for Low, Medium, High; 0 for an outlaw system or a word with no level set. */
  stars: 0 | 1 | 2 | 3;
  pirate: boolean;
  /** What reads beside the stars: the map's word, or the level's name when there's no word (or the word is it). */
  text: string;
  /** A word with no level chosen: "Calm · level not set". */
  levelNotSet: boolean;
  /** What a screen reader hears: "Conflict: Rowdy, medium, 2 of 3". */
  spoken: string;
}

/**
 * A system's conflict as the game shows it (round 8, c22): the level's stars and the map's word, "★★ Rowdy"; a word
 * that is its own level once ("★★ Medium"); the level alone ("★★★ High"); a word with no level ("Calm", level not
 * set). An outlaw system is the map's word ("Pirate Controlled"), or "Pirate (outlaw)" without one, drawn as a pill.
 */
export function conflictReading(
  system: { conflict: ConflictLevel | ''; conflictWord: string },
  labels: Record<ConflictLevel, string>
): ConflictReading | null {
  const word = system.conflictWord.trim();
  if (system.conflict === 'pirate') {
    const text = word || labels.pirate;
    return { stars: 0, pirate: true, text, levelNotSet: false, spoken: `Conflict: ${text}, outlaw system` };
  }
  if (!system.conflict) {
    if (!word) return null;
    return { stars: 0, pirate: false, text: word, levelNotSet: true, spoken: `Conflict: ${word}, level not set` };
  }
  const stars = CONFLICT_STARS[system.conflict];
  const level = labels[system.conflict];
  const own = !word || same(word, level);
  const said = `${level.toLowerCase()}, ${String(stars)} of 3`;
  return {
    stars,
    pirate: false,
    text: own ? level : word,
    levelNotSet: false,
    spoken: `Conflict: ${own ? said : `${word}, ${said}`}`
  };
}
