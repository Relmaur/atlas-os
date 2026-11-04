import { promises as fs } from 'node:fs';
import { expect, test } from 'vitest';
import { glyphNames, glyphPageDigit, parseGlyphNames, type GlyphTable } from '../src/glyphs.ts';

test('a glyph page stands for one hex digit, in the wiki’s order', () => {
  expect(glyphPageDigit('Glyph 1 / 16')).toBe('0');
  expect(glyphPageDigit('Glyph 10 / 16')).toBe('9');
  expect(glyphPageDigit('Glyph 16 / 16')).toBe('F');
  expect(glyphPageDigit('Glyph 17 / 16')).toBeNull();
  expect(glyphPageDigit('Glyph')).toBeNull();
});

test('the names a page gives, with wiki links read as their text', () => {
  expect(parseGlyphNames('Intro.\n\nThis glyph can be referred to as either Sunset or Star Over Water.\n')).toEqual({
    name: 'Sunset',
    alt: 'Star Over Water'
  });
  expect(parseGlyphNames('This glyph is referred to as Tent.')).toEqual({ name: 'Tent' });
  expect(parseGlyphNames('This glyph is referred to as [[The Atlas|Atlas]]\n\nMore.')).toEqual({ name: 'Atlas' });
  expect(
    parseGlyphNames('This glyph can be referred to as either Fish or [[Grave of the Ocean King|Ocean King]].')
  ).toEqual({ name: 'Fish', alt: 'Ocean King' });
  expect(parseGlyphNames('A page that says nothing about names.')).toBeNull();
});

test('every archived glyph page still names its glyph', async () => {
  const names: string[] = [];
  for (let n = 1; n <= 16; n++) {
    const text = await fs.readFile(
      new URL(`../../../wiki/technology/Glyph_${String(n)}_16.md`, import.meta.url),
      'utf8'
    );
    const parsed = parseGlyphNames(text);
    expect(parsed, `Glyph ${String(n)} / 16`).not.toBeNull();
    names.push(parsed?.name ?? '');
  }
  // The names as the mirror has them today; the app itself only ever reads the pages.
  expect(names.join(' ')).toBe(
    'Sunset Bird Face Diplo Eclipse Balloon Boat Bug Dragonfly Galaxy Voxel Fish Tent Rocket Tree Atlas'
  );
});

const TABLE: GlyphTable = {
  page: 'Glyph',
  path: 'wiki/mechanics/Glyph.md',
  glyphs: Array.from({ length: 16 }, (_, i) => {
    const digit = i.toString(16).toUpperCase();
    return { digit, name: `G${String(i)}`, path: `p${digit}`, revId: 1 };
  })
};

test('an address reads as its glyphs, in dialling order', () => {
  expect(glyphNames('21a4', TABLE)?.map(glyph => glyph.name)).toEqual(['G2', 'G1', 'G10', 'G4']);
  expect(glyphNames('21G4', TABLE)).toBeNull();
  expect(glyphNames('21A4', null)).toBeNull();
  expect(glyphNames('', TABLE)).toBeNull();
});
