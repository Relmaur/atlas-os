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
  expect(biomeFor(FACTS, 'Frostbound Planet')?.name).toBe('Frozen'); // as the game shows it
  expect(biomeFor(FACTS, 'frozen moon')?.name).toBe('Frozen');
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
  expect(weatherClass(FACTS, 'Frostbound Planet', 'Icy Blasts')).toBe('normal'); // an older log's biome text
  expect(sentinelLevel(FACTS, 'few')).toBe('low');
  expect(sentinelLevel(FACTS, 'Frenzied')).toBe('aggressive');
  expect(sentinelLevel(FACTS, '')).toBeNull();
});

test('round 4: what a scan can list comes from the wiki’s own sentences, page by page', async () => {
  const { isDeposit, isScanFind, parseRuinedSets, parseStarMetals } = await import('../src/planets.ts');
  expect(parseStarMetals(await page('mechanics/Star_system.md'))).toMatchObject({
    yellow: ['Copper', 'Activated Copper'],
    red: ['Cadmium', 'Activated Cadmium'],
    green: ['Emeril', 'Activated Emeril'],
    blue: ['Indium', 'Activated Indium'],
    purple: ['Quartzite', 'Activated Quartzite']
  });
  expect(isDeposit(await page('resources/Silver.md'))).toBe(true);
  expect(isDeposit(await page('resources/Copper.md'))).toBe(false);
  expect(isScanFind(await page('building/Ancient_Bones.md'))).toBe(true);
  expect(isScanFind(await page('places/Salvageable_Scrap.md'))).toBe(true);
  // The burial site's page names Ancient Bones as what the panel shows: the site itself isn't a find.
  expect(isScanFind(await page('places/Natural_Burial_Site.md'))).toBe(false);
  const sets = parseRuinedSets(await page('world/Biome_-_The_Reliquary.md'));
  expect(sets.find(set => set.set === 'Frozen')?.names).toEqual(['Abandoned', 'Icy Ruin', 'Frozen Relic']);
  expect(sets.map(set => set.set)).toContain('Radioactive');
});

test('round 4: resources grouped by why they can be there, and each one’s source', async () => {
  const { resourceChoices, resourceSource } = await import('../src/planets.ts');
  const facts: PlanetFacts = {
    ...FACTS,
    biomes: FACTS.biomes.map(biome =>
      biome.name === 'Frozen' ? { ...biome, resources: ['Dioxite', 'Frost Crystal'] } : biome
    ),
    starMetals: { page: 'Star system', path: 's', revId: 1, metals: { yellow: ['Copper', 'Activated Copper'] } },
    deposits: [{ page: 'Silver', path: 's', revId: 1 }],
    finds: [{ page: 'Ancient Bones', path: 'a', revId: 1 }]
  };
  expect(resourceChoices(facts, 'Frostbound', 'yellow').map(group => [group.label, group.names])).toEqual([
    ['Frozen biome', ['Dioxite', 'Frost Crystal']],
    ['Yellow star', ['Copper', 'Activated Copper']],
    ['Deposits', ['Silver']],
    ['Finds', ['Ancient Bones']]
  ]);
  // No star logged: no star metal group; nothing about the biome: no biome group.
  expect(resourceChoices(facts, 'My own words', '').map(group => group.group)).toEqual(['deposit', 'find']);
  expect(resourceSource(facts, 'frost crystal', 'Frozen', 'yellow')).toBe('Frozen biome');
  expect(resourceSource(facts, 'Copper', 'Frozen', 'yellow')).toBe('yellow star');
  expect(resourceSource(facts, 'Silver', 'Frozen', 'yellow')).toBe('deposit');
  expect(resourceSource(facts, 'Storm Crystal', 'Frozen', 'yellow')).toBeNull();
});

test('round 4: a Reliquary world takes its main biome’s colour from its name, with a relic ring', async () => {
  const { planetFamily } = await import('../src/facts.ts');
  const cite = (value: unknown) => ({ page: 'p', path: 'p', url: 'u', revId: 1, quote: 'q', value });
  const file = {
    schema: 1 as const,
    facts: {
      'biome-frozen': cite({ biome: 'Frozen', family: 'frozen' }),
      'biome-barren': cite({ biome: 'Barren', family: 'barren' }),
      'reliquary-main-biome': cite(true)
    },
    planets: {
      ...FACTS,
      biomes: [
        ...FACTS.biomes,
        {
          page: 'Biome - The Reliquary',
          path: 'r',
          revId: 1,
          name: 'The Reliquary',
          descriptors: ['Frozen Relic', 'Abandoned'],
          weather: weather([], [], []),
          ruined: [
            { biome: 'Frozen', names: ['Abandoned', 'Frozen Relic'] },
            { biome: 'Barren', names: ['Abandoned'] }
          ]
        }
      ]
    }
  };
  expect(planetFamily(file, { biome: '', descriptor: 'Frozen Relic' })).toEqual({ family: 'frozen', relic: true });
  // "Abandoned" fits several sets: slate, until the player picks the biome.
  expect(planetFamily(file, { biome: 'The Reliquary', descriptor: 'Abandoned' })).toEqual({
    family: null,
    relic: true
  });
  expect(planetFamily(file, { biome: 'Frozen', descriptor: 'Frostbound' })).toEqual({ family: 'frozen', relic: false });
  // Without the wiki's sentence, no Reliquary world borrows a colour.
  const rest = Object.fromEntries(Object.entries(file.facts).filter(([id]) => id !== 'reliquary-main-biome'));
  expect(planetFamily({ ...file, facts: rest }, { biome: '', descriptor: 'Frozen Relic' }).family).toBeNull();
});
