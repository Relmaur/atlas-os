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
