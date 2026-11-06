// What the galaxy map says about a system, as the wiki words it: the spectral class ("F4", whose first letter gives
// the star's colour), and the economy, a name ("Prospecting", one of the Mining economy's four) and a strength word
// ("Opulent", a strong ★★★ economy). The wiki index reads them from the archived pages into wiki/facts.json; nothing
// here hard-codes a game word.
import { z } from 'zod';
import { STAR_CLASSES, type StarClass } from './systems-model.ts';

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
  })
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
