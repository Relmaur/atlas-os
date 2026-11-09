import { promises as fs } from 'node:fs';
import { expect, test } from 'vitest';
import {
  economyType,
  parseEconomyNames,
  parseEconomyStrength,
  parseSpectralClasses,
  starFromSpectral,
  strengthStars,
  type GalaxyMapFacts
} from '../src/galaxy-map.ts';

const page = (file: string) => fs.readFile(new URL(`../../../wiki/mechanics/${file}`, import.meta.url), 'utf8');

test('the archived pages give the galaxy map’s words: F is yellow, Prospecting is Mining, Opulent is strong', async () => {
  const classes = parseSpectralClasses(await page('Spectral_class.md'));
  expect(classes).toMatchObject({
    F: 'yellow',
    G: 'yellow',
    K: 'red',
    M: 'red',
    E: 'green',
    B: 'blue',
    O: 'blue',
    X: 'purple',
    Y: 'purple'
  });
  expect(classes).not.toHaveProperty('A'); // a real-world class the game doesn't use
  const strength = parseEconomyStrength(await page('Economy.md'));
  expect(strength?.[3]).toContain('Opulent');
  expect(strength?.[1]).toContain('Struggling');
  expect(parseEconomyNames(await page('Mining_Economy.md'))).toEqual(
    expect.arrayContaining(['Prospecting', 'Ore Extraction', 'Minerals', 'Mining'])
  );
});

const FACTS: GalaxyMapFacts = {
  spectral: { page: 'Spectral class', path: 's', revId: 1, classes: { F: 'yellow', E: 'green' } },
  economy: {
    page: 'Economy',
    path: 'e',
    revId: 1,
    strength: { 1: ['Struggling'], 2: ['Balanced'], 3: ['Opulent'] },
    types: [{ page: 'Mining Economy', path: 'm', revId: 1, name: 'Mining', names: ['Prospecting', 'Mining'] }]
  }
};

test('lookups read as a player types', () => {
  expect(starFromSpectral(FACTS, 'f4')).toBe('yellow');
  expect(starFromSpectral(FACTS, 'E1pf')).toBe('green');
  expect(starFromSpectral(FACTS, 'A2')).toBeNull();
  expect(starFromSpectral(FACTS, '')).toBeNull();
  expect(economyType(FACTS, ' prospecting')).toBe('Mining');
  expect(economyType(FACTS, 'Black Market')).toBeNull();
  expect(strengthStars(FACTS, 'opulent')).toBe(3);
  expect(strengthStars(null, 'Opulent')).toBeNull();
});

test('3.39: the Conflict Level page’s words by level, and an economy pair typed in one field', async () => {
  const { conflictLevelOf, economyParts, parseConflictWords } = await import('../src/galaxy-map.ts');
  const levels = parseConflictWords(await page('Conflict_Level.md'));
  expect(levels?.low).toContain('Peaceful');
  expect(levels?.medium).toContain('Rowdy');
  expect(levels?.high).toContain('Lawless');
  expect(levels?.pirate).toEqual(['Pirate Controlled']);
  const facts = { conflict: { page: 'Conflict Level', path: 'c', revId: 1, levels } } as unknown as GalaxyMapFacts; // only `conflict` is read
  expect(conflictLevelOf(facts, ' peaceful ')).toBe('low');
  expect(conflictLevelOf(facts, 'Pirate Controlled')).toBe('pirate');
  expect(conflictLevelOf(facts, 'Grumpy')).toBeNull();
  expect(conflictLevelOf(null, 'Peaceful')).toBeNull();

  // Logged before the name and strength were apart: read as the two, never rewritten.
  expect(economyParts({ economy: 'High Tech // Balanced', economyStrength: '' })).toEqual({
    name: 'High Tech',
    strength: 'Balanced'
  });
  expect(economyParts({ economy: 'Prospecting', economyStrength: 'Opulent' })).toEqual({
    name: 'Prospecting',
    strength: 'Opulent'
  });
  // Both fields filled: the player's fields win, whatever the first one says.
  expect(economyParts({ economy: 'A // B', economyStrength: 'Opulent' })).toEqual({
    name: 'A // B',
    strength: 'Opulent'
  });
});
