import { expect, test } from 'vitest';
import assert from 'node:assert/strict';
import {
  normalizeSystem,
  migrateToSystems,
  outlawStatus,
  rankOutlaw,
  systemHaystack,
  searchSystems,
  HOUR_MS,
  moonParent,
  type System
} from '../src/systems-model.ts';
import { formatDuration, formatAgo, formatCountdown } from '../src/format.ts';

test('normalizeSystem cleans user input into the stored shape', () => {
  const system = normalizeSystem({
    id: 1,
    name: '  ',
    glyphs: '01-23 ab',
    star: 'pink',
    wealth: 9,
    rating: -2,
    tags: ['Trade Hub', 'trade-hub', ''],
    visits: [{ at: 'bad' }, { at: '2026-01-02T00:00:00Z', packets: '15' }, { at: '2026-01-01T00:00:00Z' }]
  });
  assert.equal(system.id, '1');
  assert.equal(system.name, 'Unnamed system');
  assert.equal(system.glyphs, '0123AB');
  assert.equal(system.star, '');
  assert.equal(system.wealth, 3);
  assert.equal(system.rating, 0);
  assert.deepEqual(system.tags, ['trade-hub']);
  assert.deepEqual(
    system.visits.map(visit => visit.at),
    ['2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z']
  );
  assert.equal(system.visits[1]?.packets, 15);
});

test('migrating logbook and outlaw stations is idempotent and keeps ids', () => {
  const state = {
    systems: [{ id: 'keep', name: 'Existing' }],
    logbook: [{ id: 'log-1', system: 'Camp', type: 'Harmonic Camp', glyphSolution: [4, 10, 16] }],
    outlaw: {
      stations: [
        { id: 'st-1', name: 'Den', glyphs: 'abc' },
        { id: 'keep', name: 'Duplicate id' }
      ]
    }
  };
  migrateToSystems(state);
  const once = JSON.stringify(state.systems);
  migrateToSystems(state);
  assert.equal(JSON.stringify(state.systems), once, 'running it again changes nothing');
  const systems = (state as Record<string, unknown>).systems as System[];
  assert.deepEqual(
    systems.map(system => system.id),
    ['keep', 'log-1', 'st-1']
  );
  assert.deepEqual(systems[2]?.tags, ['outlaw']);
  assert.equal(systems[1]?.notes, 'Harmonic Camp solution: 4, 10, 16');
  assert.equal(state.logbook, undefined);
  assert.equal(state.outlaw.stations, undefined);
});

test('outlaw status: never run, restocking, then ready after restockHours', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  const visit = (hoursAgo: number) => ({ at: new Date(now - hoursAgo * HOUR_MS).toISOString(), packets: 15 });
  assert.deepEqual(outlawStatus({ visits: [] }, 24, now).label, 'Never run');
  const waiting = outlawStatus({ visits: [visit(20)] }, 24, now);
  assert.deepEqual([waiting.ready, waiting.label], [false, 'Ready in 4h']);
  assert.equal(outlawStatus({ visits: [visit(25)] }, 24, now).ready, true);
  assert.equal(
    outlawStatus({ visits: [visit(25), { at: new Date(now).toISOString() }] }, 24, now).ready,
    true,
    'visits without packets do not reset the timer'
  );
});

test('rankOutlaw puts ready stations first, then the soonest to restock', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  const station = (name: string, hoursAgo: number | null) =>
    normalizeSystem({
      name,
      tags: ['outlaw'],
      visits: hoursAgo === null ? [] : [{ at: new Date(now - hoursAgo * HOUR_MS).toISOString(), packets: 15 }]
    });
  const ranked = rankOutlaw(
    [
      station('Fresh', 1),
      station('Never', null),
      station('Soon', 23),
      station('Old', 30),
      normalizeSystem({ name: 'Not outlaw' })
    ],
    24,
    now
  );
  assert.deepEqual(
    ranked.map(row => row.system.name),
    ['Never', 'Old', 'Soon', 'Fresh']
  );
});

test('search haystack covers planets, tags and visit notes', () => {
  const haystack = systemHaystack(
    normalizeSystem({
      name: 'Alpha',
      race: 'gek',
      planets: [{ name: 'Verdant IV', biome: 'Lush' }],
      visits: [{ at: '2026-01-01T00:00:00Z', note: 'Found an S-class' }]
    })
  );
  for (const word of ['alpha', 'gek', 'verdant iv', 'lush', 's-class']) assert.ok(haystack.includes(word), word);
});

test('durations read naturally', () => {
  assert.equal(formatDuration(30 * 1000), '1m');
  assert.equal(formatDuration(90 * 60000), '1h 30m');
  assert.equal(formatDuration(72 * HOUR_MS), '3d');
  const now = Date.parse('2026-10-27T12:00:00Z');
  assert.equal(formatAgo('2026-10-27T11:59:30Z', now), 'just now');
  assert.equal(formatAgo('2026-10-27T10:00:00Z', now), '2h ago');
});

test('unsafe ids are made safe; generated and legacy ids are kept', () => {
  assert.equal(normalizeSystem({ id: "x');alert(1);('" }).id, 'x---alert-1----');
  assert.equal(normalizeSystem({ id: 1698000000000 }).id, '1698000000000');
  assert.equal(normalizeSystem({ id: 'camp-01' }).id, 'camp-01');
  assert.match(normalizeSystem({ id: "');('" }).id, /^sys-/, 'nothing usable left: a fresh id');
  assert.equal(normalizeSystem({ planets: [{ id: 'pl "x"', name: 'P' }] }).planets[0]?.id, 'pl--x-');
});

test('the header search matches systems holding every word typed, in any field', () => {
  const systems = [
    normalizeSystem({ name: 'Ekwa Nexus', region: 'Odyalutai', tags: ['trade-hub'] }),
    normalizeSystem({ name: 'Hesper Drift', notes: 'Nexus of storms' })
  ];
  assert.deepEqual(
    searchSystems(systems, 'nexus').map(system => system.name),
    ['Ekwa Nexus', 'Hesper Drift']
  );
  assert.deepEqual(
    searchSystems(systems, 'NEXUS odya').map(system => system.name),
    ['Ekwa Nexus']
  );
  assert.deepEqual(searchSystems(systems, '   '), []);
});

test('a countdown shows seconds under an hour and minutes above', () => {
  assert.equal(formatCountdown(245_000), '4:05');
  assert.equal(formatCountdown(999), '0:01');
  assert.equal(formatCountdown(0), '0:00');
  assert.equal(formatCountdown(3_900_000), '1h 05m');
});

test('an older log’s planets come through untouched, with an empty scan beside them', () => {
  const old = { id: 'pl-1', name: 'Hogaw 24/K5', biome: 'frostbound, very cold', tags: ['base'], notes: 'Icy' };
  const [planet] = normalizeSystem({ planets: [old] }).planets;
  // What the player typed stays exactly as typed: no rewriting the free-text biome into a wiki name.
  expect(planet).toMatchObject(old);
  expect(planet).toMatchObject({
    descriptor: '',
    body: '',
    weather: '',
    resources: [],
    temperature: null,
    discoveredOn: ''
  });
});

test('a scan round-trips, and damaged scan values read as not logged', () => {
  const scan = {
    descriptor: 'Frostbound',
    body: 'planet',
    weather: 'Icy Blasts',
    sentinels: 'Few',
    flora: 'Uncommon',
    fauna: 'Abundant',
    abundance: 'Uncommon',
    resources: ['Ancient Bones', 'Frost Crystal', 'Copper', 'Dioxite', 'Silver'],
    temperature: -60.8,
    discoveredBy: 'marck94zac1',
    discoveredOn: '2026-11-05'
  };
  const [planet] = normalizeSystem({
    planets: [{ id: 'pl-1', name: 'Hogaw 24/K5', biome: 'Frozen', ...scan }]
  }).planets;
  expect(planet).toMatchObject(scan);
  const [again] = normalizeSystem(JSON.parse(JSON.stringify({ planets: [planet] })) as Record<string, unknown>).planets;
  expect(again).toEqual(planet);
  const [bad] = normalizeSystem({
    planets: [{ name: 'X', body: 'asteroid', temperature: '-60', discoveredOn: '5/11/2026', resources: 'Copper' }]
  }).planets;
  expect(bad).toMatchObject({ body: '', temperature: null, discoveredOn: '', resources: [] });
});

test('an older log’s system keeps its economy and stars; the galaxy map’s other words start empty', () => {
  const system = normalizeSystem({ name: 'Ekwa', economy: 'High Tech', wealth: 2, star: 'yellow' });
  expect(system).toMatchObject({ economy: 'High Tech', wealth: 2, star: 'yellow' });
  expect(system).toMatchObject({ spectralClass: '', water: false, dissonant: false, economyStrength: '' });
  const logged = normalizeSystem({ name: 'Ekwa', spectralClass: 'F4', water: true, economyStrength: 'Opulent' });
  expect(logged).toMatchObject({ spectralClass: 'F4', water: true, dissonant: false, economyStrength: 'Opulent' });
  expect(normalizeSystem({ name: 'X', water: 'yes' }).water).toBe(false);
});

test('a moon’s planet: kept as stored, read only when it is a planet of the same system', () => {
  const { planets } = normalizeSystem({
    planets: [
      { id: 'pl-h', name: 'Hogaw', body: 'planet' },
      { id: 'pl-m', name: 'Little', body: 'moon', orbits: 'pl-h' },
      { id: 'pl-n', name: 'Lost', body: 'moon', orbits: 'pl-gone' },
      { id: 'pl-x', name: 'Odd', body: 'planet', orbits: 'pl-h' },
      { id: 'pl-y', name: 'Twin', body: 'moon', orbits: 'pl-m' }
    ]
  });
  // An older log has no link: it reads as not set.
  expect(normalizeSystem({ planets: [{ id: 'pl-1', name: 'A' }] }).planets[0]?.orbits).toBe('');
  const [hogaw, little, lost, odd, twin] = planets;
  expect(little && moonParent(planets, little)).toBe(hogaw);
  // A link to a deleted planet, from a planet, or to another moon reads as not set, and is kept as it was.
  expect(lost && moonParent(planets, lost)).toBeNull();
  expect(lost?.orbits).toBe('pl-gone');
  expect(odd && moonParent(planets, odd)).toBeNull();
  expect(twin && moonParent(planets, twin)).toBeNull();
  expect(normalizeSystem({ planets: [{ id: 'a', name: 'A', body: 'moon', orbits: '../x' }] }).planets[0]?.orbits).toBe(
    ''
  );
});

test('the hazard reading: an older log’s number is a temperature; a new one says which reading it is', async () => {
  const { hazardReading, readingText } = await import('../src/facts.ts');
  const [old] = normalizeSystem({ planets: [{ id: 'p', name: 'A', temperature: -60.8 }] }).planets;
  expect(old).toMatchObject({ temperature: -60.8, hazard: '' });
  expect(old && readingText(null, old)).toBe('−60.8 °C');
  const [rad] = normalizeSystem({ planets: [{ id: 'p', name: 'A', temperature: 4.2, hazard: 'Radiation' }] }).planets;
  expect(rad?.hazard).toBe('radiation');
  // Without the wiki's list a reading keeps its name but has no unit to show.
  expect(hazardReading(null, 'radiation')).toEqual({ key: 'radiation', name: 'Radiation', unit: '' });
  expect(rad && readingText(null, rad)).toBe('4.2');
});

test('a system’s discovery: an older log reads it as empty; damaged values read as not logged', () => {
  expect(normalizeSystem({ name: 'Old' })).toMatchObject({ discoveredBy: '', discoveredOn: '', discoveredTime: '' });
  expect(
    normalizeSystem({ name: 'A', discoveredBy: ' marck94 ', discoveredOn: '2026-11-06', discoveredTime: '12:12' })
  ).toMatchObject({ discoveredBy: 'marck94', discoveredOn: '2026-11-06', discoveredTime: '12:12' });
  expect(normalizeSystem({ name: 'A', discoveredOn: '6/11/2026', discoveredTime: '25:00' })).toMatchObject({
    discoveredOn: '',
    discoveredTime: ''
  });
});

test('3.39: a log from before the conflict word comes through as typed, word empty; a word round-trips', () => {
  // Shaped like a real early log (invented names): the game's whole line typed as the biome, the economy's pair
  // typed in one field, a conflict level picked.
  const old = {
    name: 'Testra Gate',
    economy: 'High Tech // Balanced',
    wealth: 2,
    conflict: 'medium',
    planets: [{ id: 'pl-1', name: 'Veyl IV', biome: 'Icy Abhorrence Planet', tags: ['base'] }]
  };
  const system = normalizeSystem(old);
  expect(system).toMatchObject({
    economy: 'High Tech // Balanced',
    economyStrength: '',
    wealth: 2,
    conflict: 'medium'
  });
  expect(system.conflictWord).toBe('');
  expect(system.planets[0]).toMatchObject(old.planets[0] ?? {});
  const worded = normalizeSystem({ ...old, conflictWord: 'Rowdy' });
  expect(normalizeSystem(JSON.parse(JSON.stringify(worded)) as Record<string, unknown>)).toEqual(worded);
});
