// Portal addresses glyph by glyph (design round 5, "Portals"): the parts of an address, reading glyph names and digits
// typed or pasted, the places the wiki says no address can point to, and what the player's own glyphs let them dial.
// Every rule here is the wiki's Portal address page: P SSS YY ZZZ XXX, read left to right; Y=80, X=800 and Z=800 are
// "not used"; planet index 0, or one past the system's bodies, sends a traveller to planet 1. Names come from the
// Glyph pages (@atlas/core/glyphs); nothing here draws a glyph.
import type { Glyph, GlyphTable } from './glyphs.ts';

export const HEX = '0123456789ABCDEF';
export const ADDRESS_LENGTH = 12;

/** Where each of the 12 glyphs belongs: 1 the planet, 2–4 the star system, 5–12 the region. */
export type AddressPart = 'planet' | 'system' | 'region';
export const partOf = (index: number): AddressPart => (index === 0 ? 'planet' : index < 4 ? 'system' : 'region');

/** The wiki's own page for a glyph, to see the real one: digit 0 is "Glyph 1 / 16". */
export function glyphWikiUrl(digit: string): string {
  return `https://nomanssky.fandom.com/wiki/Glyph_${String(HEX.indexOf(digit.toUpperCase()) + 1)}_%2F_16`;
}

/** The glyph a digit stands for, from the wiki's table. */
export const glyphOf = (table: GlyphTable | null, digit: string): Glyph | undefined =>
  table?.glyphs.find(glyph => glyph.digit === digit.toUpperCase());

/** A digit's name for reading aloud or copying ("Face"); the digit itself only when the names aren't loaded. */
export const glyphName = (table: GlyphTable | null, digit: string): string => glyphOf(table, digit)?.name ?? digit;

/** "Face Bird Voxel…": an address as names, for copying where people write them out. */
export function addressAsNames(table: GlyphTable | null, address: string): string {
  return Array.from(address)
    .map(digit => glyphName(table, digit))
    .join(' ');
}

/**
 * Glyphs typed or pasted, in order: digits ("21A4", "2 1 A 4"), names or second names in any case ("face bird
 * voxel", "Star Over Water"), or a mix. `rest` is what couldn't be read, so the field can say so; nothing is guessed.
 */
export function readGlyphs(text: string, table: GlyphTable | null): { digits: string[]; rest: string } {
  const names = (table?.glyphs ?? [])
    .flatMap(glyph =>
      [glyph.name, glyph.alt]
        .filter(Boolean)
        .map(name => ({ words: (name ?? '').toLowerCase().split(/\s+/), digit: glyph.digit }))
    )
    .sort((a, b) => b.words.length - a.words.length); // "Star Over Water" before any one-word name
  const words = text
    .trim()
    .split(/[\s,·:;/|-]+/)
    .filter(Boolean);
  // "FACE 0E10" is four glyphs, "face bird" two names: text that's all hex and has a numeral or capitals reads as
  // digits (pasted addresses look like that); anything else tries names first.
  const pasted =
    words.every(word => /^[0-9a-f]+$/i.test(word)) &&
    words.some(word => /\d/.test(word) || word === word.toUpperCase());
  if (pasted) return { digits: Array.from(words.join('').toUpperCase()), rest: '' };
  const digits: string[] = [];
  const unread: string[] = [];
  for (let i = 0; i < words.length;) {
    const lower = words.slice(i).map(word => word.toLowerCase());
    const named = names.find(name => name.words.every((word, k) => lower[k] === word));
    if (named) {
      digits.push(named.digit);
      i += named.words.length;
      continue;
    }
    const word = words[i] ?? '';
    if (/^[0-9a-f]+$/i.test(word)) digits.push(...Array.from(word.toUpperCase()));
    else unread.push(word);
    i++;
  }
  return { digits, rest: unread.join(' ') };
}

/**
 * Glyph positions (0–11) the wiki says no address uses: the region's Y = 80 (glyphs 5–6), Z = 800 (7–9) or
 * X = 800 (10–12). Only whole groups are checked; anything else is just partial or full.
 */
export function impossibleGlyphs(slots: readonly string[]): number[] {
  const group = (from: number, to: number) => slots.slice(from, to).join('');
  const bad: number[] = [];
  const check = (from: number, to: number, unused: string) => {
    if (group(from, to) === unused) for (let i = from; i < to; i++) bad.push(i);
  };
  check(4, 6, '80');
  check(6, 9, '800');
  check(9, 12, '800');
  return bad;
}

/**
 * The planet glyph's quiet note: index 0, or past the bodies the player counted, "the portal sends you to planet 1"
 * (the wiki). `bodies` is the system's planet and moon count, 0 when not logged.
 */
export function sendsToFirstPlanet(planetDigit: string, bodies: number): boolean {
  if (!planetDigit) return false;
  const index = HEX.indexOf(planetDigit.toUpperCase());
  return index === 0 || (bodies > 0 && index > bodies);
}

/** The glyphs of an address the player hasn't marked as found, each once, in the order they're dialled. */
export function glyphsToFind(address: string, mine: readonly string[]): string[] {
  const have = new Set(mine);
  return [...new Set(address.toUpperCase())].filter(digit => HEX.includes(digit) && !have.has(digit));
}

/** My glyphs as stored: valid digits, each once, in glyph order. */
export function normalizeMyGlyphs(value: unknown): string[] {
  const digits = new Set(
    (Array.isArray(value) ? value : [])
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.toUpperCase())
  );
  return Array.from(HEX).filter(digit => digits.has(digit));
}

/** A planet's portal glyph as stored: one digit, or '' when not logged. */
export const normalizePortalGlyph = (value: unknown): string =>
  typeof value === 'string' && /^[0-9A-F]$/i.test(value) ? value.toUpperCase() : '';
