import { promises as fs } from 'node:fs';
import { expect, test } from 'vitest';
import {
  biomeFor,
  biomePageName,
  parseBiomeDescriptors,
  parseBiomeWeather,
  parseLifeWords,
  parseSentinelWords,
  sentinelLevel,
  weatherClass,
  weatherWords,
  type PlanetFacts
} from '../src/planets.ts';

const page = (file: string) => fs.readFile(new URL(`../../../wiki/${file}`, import.meta.url), 'utf8');

test('a biome page is "Biome - <name>"; subtypes and the overview are not biomes', () => {
  expect(biomePageName('Biome - Frozen')).toBe('Frozen');
  expect(biomePageName('Biome - Gas Giant')).toBe('Gas Giant');
  expect(biomePageName('Biome Subtype - Infested')).toBeNull();
  expect(biomePageName('Biome')).toBeNull();
});

test('the archived pages give what a scan shows: Frostbound, Icy Blasts, Few, Abundant', async () => {
  const frozen = await page('world/Biome_-_Frozen.md');
  expect(parseBiomeDescriptors(frozen)).toContain('Frostbound');
  const weather = parseBiomeWeather(frozen);
  expect(weather.normal).toContain('Icy Blasts');
  expect(weather.extreme).toContain('Howling Blizzards');
  expect(weather.clear).toContain('Powder Snow');
  // The example planet under the table is not a weather.
  expect(weather.other).not.toContain('Deygeyskoi I');

  const sentinels = parseSentinelWords(await page('lore/Sentinel.md'));
  expect(sentinels?.low).toContain('Few');
  expect(sentinels?.aggressive).toContain('Frenzied');
  expect(sentinels?.corrupted).toContain('Sharded from the Atlas');

  const life = parseLifeWords(await page('mechanics/Planet_-_Discovery_Menu.md'));
  expect(life?.fauna).toContain('Abundant');
  expect(life?.flora).toContain('Uncommon');
  expect(new Set(life?.flora).size).toBe(life?.flora.length); // "Numerous" is listed twice on the wiki
});

test('every biome page has name prefixes, in whatever shape the page writes them', async () => {
  const dir = new URL('../../../wiki/world/', import.meta.url);
  const files = (await fs.readdir(dir)).filter(file => file.startsWith('Biome_-_'));
  expect(files.length).toBeGreaterThanOrEqual(13);
  for (const file of files) expect(parseBiomeDescriptors(await page(`world/${file}`)), file).not.toEqual([]);
  // Footnote marks go: "Waterworld1" is Waterworld; a sentence gives Gas Giant; the Reliquary lists ruined names.
  expect(parseBiomeDescriptors(await page('world/Biome_-_Waterworld.md'))).toContain('Waterworld');
  expect(parseBiomeDescriptors(await page('world/Biome_-_Gas_Giant.md'))).toEqual(['Gas Giant']);
  expect(parseBiomeDescriptors(await page('world/Biome_-_The_Reliquary.md'))).toContain('Frozen Relic');
  expect(parseBiomeDescriptors(await page('world/Biome_-_Exotic.md'))).toContain('Skeletal');
});

const weather = (clear: string[], normal: string[], extreme: string[]) => ({ clear, normal, extreme, other: [] });
const FACTS: PlanetFacts = {
  biomes: [
    {
      page: 'Biome - Barren',
      path: 'b',
      revId: 1,
      name: 'Barren',
      descriptors: ['Desert', 'Abandoned'],
      weather: weather(['Clear'], ['Parched Sands'], [])
    },
    {
      page: 'Biome - Dead',
      path: 'd',
      revId: 1,
      name: 'Dead',
      descriptors: ['Lifeless', 'Abandoned'],
      weather: weather([], [], [])
    },
    {
      page: 'Biome - Frozen',
      path: 'f',
      revId: 1,
      name: 'Frozen',
      descriptors: ['Frostbound'],
      weather: weather(['Icy'], ['Icy Blasts'], ['Deep Freeze'])
    },
    {
      page: 'Biome - Scorched',
      path: 's',
      revId: 1,
      name: 'Scorched',
      descriptors: ['Arid'],
      weather: weather(['Sweltering'], [], [])
    }
  ],
  sentinels: {
    page: 'Sentinel',
    path: 'x',
    revId: 1,
    low: ['Few'],
    high: ['Attentive'],
    aggressive: ['Frenzied'],
    corrupted: ['Corrupted']
  },
  life: { page: 'Planet - Discovery Menu', path: 'y', revId: 1, flora: ['Uncommon'], fauna: ['Abundant'] }
};

test('a prefix names its biome only when one biome uses it; the player picks otherwise', () => {
  expect(biomeFor(FACTS, ' frostbound ')?.name).toBe('Frozen');
  expect(biomeFor(FACTS, 'Frozen')?.name).toBe('Frozen');
  expect(biomeFor(FACTS, 'Abandoned')).toBeNull();
  expect(biomeFor(FACTS, 'Frosty')).toBeNull();
  expect(biomeFor(null, 'Frostbound')).toBeNull();
});

test('weather severity comes from the biome’s own table, then any biome’s; sentinel words map to a level', () => {
  expect(weatherClass(FACTS, 'Frozen', 'icy blasts')).toBe('normal');
  expect(weatherClass(FACTS, 'Frozen', 'Deep Freeze')).toBe('extreme');
  expect(weatherClass(FACTS, 'Barren', 'Sweltering')).toBe('clear'); // a Scorched word on a Barren world
  expect(weatherClass(FACTS, 'Frozen', 'Made-up Drizzle')).toBeNull();
  expect(weatherWords(FACTS, 'Frozen')).toEqual(['Icy', 'Icy Blasts', 'Deep Freeze']);
  expect(weatherWords(FACTS, 'My own words')).toEqual([]);
  expect(sentinelLevel(FACTS, 'few')).toBe('low');
  expect(sentinelLevel(FACTS, 'Frenzied')).toBe('aggressive');
  expect(sentinelLevel(FACTS, '')).toBeNull();
});
