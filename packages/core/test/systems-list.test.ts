import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  DEFAULT_FILTER,
  filterActive,
  filterPanel,
  nothingMatches,
  filterSystems,
  parseOutlawList,
  systemMeta,
  systemsLine,
  systemsSummary,
  tagCounts,
  tagSuggestions,
  type SystemFilter
} from '../src/systems-list.ts';
import { normalizeSystem, HOUR_MS } from '../src/systems-model.ts';

const now = Date.parse('2026-10-27T12:00:00Z');
const ago = (hours: number) => new Date(now - hours * HOUR_MS).toISOString();

const systems = [
  normalizeSystem({
    id: 'a',
    name: 'Ekwa Nexus',
    region: 'Odyalutai',
    star: 'yellow',
    race: 'gek',
    conflict: 'low',
    tags: ['trade-hub'],
    rating: 3,
    createdAt: ago(300),
    visits: [{ at: ago(2) }],
    planets: [{ name: 'Verdant IV', tags: ['base'] }]
  }),
  normalizeSystem({
    id: 'b',
    name: 'Hesper Drift',
    region: 'Baltar',
    star: 'red',
    race: 'korvax',
    tags: ['trade-hub', 'mining'],
    favorite: true,
    rating: 1,
    createdAt: ago(100),
    visits: [{ at: ago(48), note: 'storm shelter' }]
  }),
  normalizeSystem({ id: 'c', name: 'Aldor', createdAt: ago(1), rating: 3 })
];
const ids = (filter: Partial<SystemFilter>) =>
  filterSystems(systems, { ...DEFAULT_FILTER, ...filter }).map(system => system.id);

test('favourites come first, then the chosen sort', () => {
  assert.deepEqual(ids({}), ['b', 'c', 'a']); // recent: c added 1h ago, a visited 2h ago
  assert.deepEqual(ids({ sort: 'discovered' }), ['b', 'c', 'a']);
  assert.deepEqual(ids({ sort: 'rating' }), ['b', 'c', 'a']); // equal ratings: the more recent first
});

test('alphabetical sorts ignore favourites; systems without a region go last', () => {
  assert.deepEqual(ids({ sort: 'name' }), ['c', 'a', 'b']);
  assert.deepEqual(ids({ sort: 'region' }), ['b', 'a', 'c']);
});

test('filters combine: favourites, star, race, conflict and every chosen tag', () => {
  assert.deepEqual(ids({ favorites: true }), ['b']);
  assert.deepEqual(ids({ star: 'yellow' }), ['a']);
  assert.deepEqual(ids({ race: 'korvax' }), ['b']);
  assert.deepEqual(ids({ conflict: 'low' }), ['a']);
  assert.deepEqual(ids({ tags: ['trade-hub'] }), ['b', 'a']);
  assert.deepEqual(ids({ tags: ['trade-hub', 'mining'] }), ['b']);
  assert.deepEqual(ids({ tags: ['base'] }), ['a']); // planet tags count
});

test('search needs every word, anywhere in the system', () => {
  assert.deepEqual(ids({ q: 'verdant' }), ['a']);
  assert.deepEqual(ids({ q: 'STORM baltar' }), ['b']);
  assert.deepEqual(ids({ q: 'storm odyalutai' }), []);
});

test('a filter is active when anything but the sort is set', () => {
  assert.equal(filterActive(DEFAULT_FILTER), false);
  assert.equal(filterActive({ ...DEFAULT_FILTER, sort: 'name' }), false);
  assert.equal(filterActive({ ...DEFAULT_FILTER, tags: ['x'] }), true);
  assert.equal(filterActive({ ...DEFAULT_FILTER, favorites: true }), true);
});

test('tag counts include planet tags, most used first', () => {
  assert.deepEqual(tagCounts(systems), [
    ['trade-hub', 2],
    ['base', 1],
    ['mining', 1]
  ]);
});

test('summary counts systems, planets and visits', () => {
  assert.deepEqual(systemsSummary(systems), { systems: 3, planets: 1, visits: 2, galaxies: ['Euclid'] });
});

test('the Systems line names one galaxy and counts several', () => {
  assert.equal(systemsLine(systems), '3 systems · 1 planet · 2 visits · Euclid');
  assert.equal(
    systemsLine([...systems, normalizeSystem({ name: 'Far', galaxy: 'Hilbert Dimension' })]),
    '4 systems · 1 planet · 2 visits · 2 galaxies'
  );
  assert.equal(systemsLine([]), '0 systems · 0 planets · 0 visits');
});

test('c21: the filter panel shows what the log has, counts the whole log, and lists what’s on as chips', () => {
  const log = [
    normalizeSystem({
      name: 'A',
      star: 'yellow',
      favorite: true,
      race: 'korvax',
      conflict: 'medium',
      tags: ['base', 'frost-crystal-farm'],
      glyphs: '10010C4BAB22'
    }),
    normalizeSystem({
      name: 'B',
      star: 'yellow',
      race: 'gek',
      conflict: 'pirate',
      tags: ['outlaw', 'base'],
      glyphs: '20020C4BAB22'
    }),
    normalizeSystem({ name: 'C', star: 'red', race: 'gek' })
  ];
  const panel = filterPanel(log, DEFAULT_FILTER);
  assert.deepEqual(
    panel.showOnly.map(row => [row.label, row.count, row.on]),
    [
      ['Favourites', 1, false],
      ['Not mapped', 1, false]
    ]
  );
  assert.deepEqual(
    panel.star.map(option => [option.label, option.count]),
    [
      ['Yellow', 2],
      ['Red', 1]
    ]
  );
  assert.deepEqual(
    panel.race.map(option => option.spoken),
    ['Gek, 2 systems', 'Korvax, 1 system']
  );
  assert.deepEqual(
    panel.conflict.map(option => option.spoken),
    ['Medium, 2 of 3 stars, 1 system', 'Pirate, outlaw, 1 system']
  );
  // Tags exactly as stored, most used first, counted by systems.
  assert.deepEqual(
    panel.tags.map(option => [option.label, option.count]),
    [
      ['base', 2],
      ['frost-crystal-farm', 1],
      ['outlaw', 1]
    ]
  );
  assert.deepEqual(panel.active, []);

  const on: SystemFilter = {
    ...DEFAULT_FILTER,
    q: 'x',
    sort: 'name',
    star: 'yellow',
    conflict: 'medium',
    tags: ['base']
  };
  const picked = filterPanel(log, on);
  assert.deepEqual(picked.star.find(option => option.value === 'yellow')?.next, { star: '' }); // tapping it again clears it
  assert.deepEqual(picked.tags.find(option => option.value === 'outlaw')?.next, { tags: ['base', 'outlaw'] });
  assert.deepEqual(
    picked.active.map(chip => [chip.label, chip.spoken]),
    [
      ['Yellow', 'Remove filter: Yellow star'],
      ['Medium', 'Remove filter: Medium conflict, 2 of 3'],
      ['base', 'Remove filter: tag base']
    ]
  );
  assert.deepEqual(picked.active[2]?.next, { tags: [] });

  // A group with one value left is hidden, unless it's the one picked.
  const korvax = [normalizeSystem({ name: 'K', race: 'korvax' }), normalizeSystem({ name: 'L', race: 'korvax' })];
  assert.deepEqual(filterPanel(korvax, DEFAULT_FILTER).race, []);
  assert.equal(filterPanel(korvax, { ...DEFAULT_FILTER, race: 'korvax' }).race.length, 1);
});

test('02g: when nothing matches, it says what clashes', () => {
  assert.equal(
    nothingMatches({ ...DEFAULT_FILTER, star: 'purple', conflict: 'pirate', tags: ['home'] }),
    'Nothing is Purple, Pirate and tagged “home” at once.'
  );
  assert.equal(nothingMatches({ ...DEFAULT_FILTER, tags: ['a', 'b'] }), 'Nothing is tagged “a” and “b” at once.');
  assert.equal(nothingMatches({ ...DEFAULT_FILTER, star: 'red', q: 'kesh' }), 'Nothing is Red and matches “kesh”.');
  assert.equal(nothingMatches({ ...DEFAULT_FILTER, q: 'kesh' }), 'Nothing matches “kesh”.');
});

test('7c: Not mapped lists the systems with no address; mapped planets are only asked once their system is', async () => {
  const { planetMapped, systemMapped, unmappedPlanets } = await import('../src/systems-model.ts');
  const placed = normalizeSystem({
    name: 'Placed',
    glyphs: '10010C4BAB22',
    planets: [
      { id: 'pl-a', name: 'Has glyph', portalGlyph: '1' },
      { id: 'pl-b', name: 'No glyph' }
    ]
  });
  const loose = normalizeSystem({ name: 'Loose', planets: [{ id: 'pl-c', name: 'Waits' }] });
  assert.equal(systemMapped(placed), true);
  assert.equal(systemMapped(loose), false);
  assert.deepEqual(
    placed.planets.map(planet => planetMapped(placed, planet)),
    [true, false]
  );
  assert.equal(planetMapped(loose, loose.planets[0] ?? { portalGlyph: '' }), null); // its system asks first
  assert.equal(unmappedPlanets(placed), 1);
  assert.equal(unmappedPlanets(loose), 0);
  const filter: SystemFilter = { ...DEFAULT_FILTER, unmapped: true };
  assert.deepEqual(
    filterSystems([placed, loose], filter).map(system => system.name),
    ['Loose']
  );
  assert.equal(
    filterPanel([placed], DEFAULT_FILTER).showOnly.some(row => row.key === 'unmapped'),
    false
  ); // only when n > 0
});

test('meta parts: race, economy with its wealth, and conflict as the game shows it; pirates aren’t in the line', () => {
  const system = normalizeSystem({ name: 'X', region: 'R', race: 'vykeen', economy: 'Mining', wealth: 2 });
  assert.deepEqual(systemMeta(system), [
    { text: 'R' },
    { text: 'Euclid' },
    { text: "Vy'keen" },
    { text: 'Mining', wealth: 2 }
  ]);
  // An outlaw system is a pill above the name (c22), never in the meta line.
  assert.deepEqual(systemMeta(normalizeSystem({ name: 'Y', galaxy: '', conflict: 'pirate' })), [{ text: 'Euclid' }]);
  assert.deepEqual(
    systemMeta(normalizeSystem({ name: 'Z', conflict: 'medium', conflictWord: 'Rowdy' }))
      .slice(1)
      .map(part => [part.text, part.conflict?.stars]),
    [['Rowdy', 2]]
  );
});

test('a pasted outlaw list: one per line, glyphs normalised, notes may contain bars', () => {
  const result = parseOutlawList('Den Two | 01234 56789ab | Far Reach | 2 jumps | from base\n\n  Den Three  ');
  assert.ok('systems' in result);
  assert.deepEqual(result.systems, [
    {
      name: 'Den Two',
      glyphs: '0123456789AB',
      region: 'Far Reach',
      notes: '2 jumps | from base',
      conflict: 'pirate',
      tags: ['outlaw']
    },
    { name: 'Den Three', glyphs: '', region: '', notes: '', conflict: 'pirate', tags: ['outlaw'] }
  ]);
});

test('a pasted outlaw list names the first bad line', () => {
  assert.deepEqual(parseOutlawList(' \n '), { error: 'Paste at least one system, one per line.' });
  assert.deepEqual(parseOutlawList('Good\n| 0123456789AB'), {
    error: 'Line 2: needs a name, and glyphs must be exactly 12 hex digits.'
  });
  assert.deepEqual(parseOutlawList('Short | 123'), {
    error: 'Line 1: needs a name, and glyphs must be exactly 12 hex digits.'
  });
});

test('tag suggestions: tags in use first (as they appear), then built-ins; minus chosen ones, matching the query', () => {
  const suggestions = tagSuggestions(systems, ['mining'], '');
  assert.deepEqual(suggestions.slice(0, 2), ['trade-hub', 'base']);
  assert.ok(!suggestions.includes('mining'));
  assert.deepEqual(tagSuggestions(systems, [], 'min'), ['mining', 'farming']); // "farming" contains "min" too
});
