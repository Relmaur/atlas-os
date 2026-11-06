import { expect, test } from 'vitest';
import {
  addressAsNames,
  glyphWikiUrl,
  glyphsToFind,
  impossibleGlyphs,
  normalizeMyGlyphs,
  partOf,
  readGlyphs,
  sendsToFirstPlanet
} from '../src/portal.ts';
import { galacticToPortal } from '../src/location.ts';
import { normalizeSystem } from '../src/systems-model.ts';
import { buildState } from '../src/state.ts';
import { mergeStates } from '../src/sync.ts';
import type { GlyphTable } from '../src/glyphs.ts';

// The wiki's names (Glyph 1–16 pages), as the indexer writes them.
const NAMES: [string, string | undefined][] = [
  ['Sunset', 'Star Over Water'],
  ['Bird', 'Hunter'],
  ['Face', 'Reflection'],
  ['Diplo', 'Ancient Giant'],
  ['Eclipse', 'Obscured Companion'],
  ['Balloon', 'Ascending Orb'],
  ['Boat', 'Sailor'],
  ['Bug', 'Lowly Insect'],
  ['Dragonfly', undefined],
  ['Galaxy', 'Spiral of Reality'],
  ['Voxel', 'Anomaly'],
  ['Fish', 'Ocean King'],
  ['Tent', undefined],
  ['Rocket', 'Vessel to Beyond'],
  ['Tree', undefined],
  ['Atlas', undefined]
];
const TABLE: GlyphTable = {
  page: 'Glyph',
  path: 'g',
  glyphs: NAMES.map(([name, alt], i) => ({
    digit: i.toString(16).toUpperCase(),
    name,
    ...(alt ? { alt } : {}),
    path: `p${String(i)}`,
    revId: 1
  }))
};

test('an address in parts: planet, star system, region; each glyph has its wiki page', () => {
  expect(Array.from({ length: 12 }, (_, i) => partOf(i))).toEqual([
    'planet',
    ...Array<string>(3).fill('system'),
    ...Array<string>(8).fill('region')
  ]);
  expect(glyphWikiUrl('0')).toBe('https://nomanssky.fandom.com/wiki/Glyph_1_%2F_16');
  expect(glyphWikiUrl('f')).toBe('https://nomanssky.fandom.com/wiki/Glyph_16_%2F_16');
  expect(addressAsNames(TABLE, '21A4F03A0E10')).toBe(
    'Face Bird Voxel Eclipse Atlas Sunset Diplo Voxel Sunset Tree Bird Sunset'
  );
});

test('glyphs read from digits, names or second names, in any case and mix; nothing unreadable is guessed', () => {
  expect(readGlyphs('2 1 A 4 F 0 3', TABLE).digits.join('')).toBe('21A4F03');
  expect(readGlyphs('21A4 F03A 0E', TABLE).digits.join('')).toBe('21A4F03A0E');
  expect(readGlyphs('face bird voxel', TABLE).digits.join('')).toBe('21A');
  expect(readGlyphs('Star Over Water, hunter · Ancient Giant', TABLE).digits.join('')).toBe('013');
  expect(readGlyphs('face 1 boat', TABLE).digits.join('')).toBe('216');
  // A pasted address in capitals is digits, even where a run spells a name.
  expect(readGlyphs('FACE 0E10', TABLE).digits.join('')).toBe('FACE0E10');
  expect(readGlyphs('bird pigeon tree', TABLE)).toEqual({ digits: ['1', 'E'], rest: 'pigeon' });
});

test('can’t exist only where the wiki says: Y = 80, Z = 800, X = 800, whole groups only', () => {
  const slots = (address: string) =>
    address
      .padEnd(12, ' ')
      .split('')
      .map(char => char.trim());
  expect(impossibleGlyphs(slots('1 1A4 80 3A0 E10'.replace(/ /g, '')))).toEqual([4, 5]);
  expect(impossibleGlyphs(slots('11A4038000E10'.slice(0, 12)))).toEqual([6, 7, 8]);
  expect(impossibleGlyphs(slots('11A40300A800'))).toEqual([9, 10, 11]);
  expect(impossibleGlyphs(slots('21A4F03A0E10'))).toEqual([]);
  expect(impossibleGlyphs(slots('21A48'))).toEqual([]); // Y not whole yet
});

test('planet 0, or past the bodies counted, sends you to planet 1 (the wiki)', () => {
  expect(sendsToFirstPlanet('0', 5)).toBe(true);
  expect(sendsToFirstPlanet('6', 5)).toBe(true);
  expect(sendsToFirstPlanet('2', 5)).toBe(false);
  expect(sendsToFirstPlanet('9', 0)).toBe(false); // count not logged: no note
  expect(sendsToFirstPlanet('', 5)).toBe(false);
});

test('a Signal Booster converts with the wiki’s table, and its planet stays unknown', () => {
  // The wiki's worked example: HUKYA:046A:0081:0D6D:0038 is portal address ?038 0256 EC6B.
  expect(galacticToPortal('HUKYA:046A:0081:0D6D:0038')?.slice(1)).toBe('0380256EC6B');
  const system = normalizeSystem({ name: 'A', glyphs: '00380256EC6B', planetGlyphUnknown: true });
  expect(system.planetGlyphUnknown).toBe(true);
  // An older log, or no address, never reads as unknown.
  expect(normalizeSystem({ name: 'A', glyphs: '00380256EC6B' }).planetGlyphUnknown).toBe(false);
  expect(normalizeSystem({ name: 'A', planetGlyphUnknown: true }).planetGlyphUnknown).toBe(false);
});

test('a planet’s portal glyph: one digit or not logged', () => {
  const [planet, other] = normalizeSystem({
    name: 'A',
    planets: [
      { id: 'p', name: 'Hogaw', portalGlyph: '2' },
      { id: 'q', name: 'Old', portalGlyph: 'face' }
    ]
  }).planets;
  expect(planet?.portalGlyph).toBe('2');
  expect(other?.portalGlyph).toBe('');
  expect(normalizeSystem({ name: 'A', planets: [{ id: 'p', name: 'Old' }] }).planets[0]?.portalGlyph).toBe('');
});

test('My glyphs: digits in glyph order, none for an older log, merged as a set in sync, and what an address needs', () => {
  expect(buildState({ systems: [] }).myGlyphs).toEqual([]);
  expect(normalizeMyGlyphs(['f', 'A', '1', 'A', 'x', 3])).toEqual(['1', 'A', 'F']);
  const merged = mergeStates({ myGlyphs: ['0'] }, { myGlyphs: ['0', '1'] }, { myGlyphs: ['0', 'A'] });
  expect(merged.myGlyphs).toEqual(['0', '1', 'A']);
  expect(glyphsToFind('21A4F03A0E10', ['0', '2', '3', '4', 'E', 'F'])).toEqual(['1', 'A']);
});
