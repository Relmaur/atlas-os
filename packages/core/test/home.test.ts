import { describe, expect, test } from 'vitest';
import assert from 'node:assert/strict';
import {
  heroPlace,
  heroStatus,
  homeSummary,
  homeTimers,
  isEmptyAtlas,
  warpBackLine,
  weekSummary
} from '../src/home.ts';
import { buildState } from '../src/state.ts';
import { formatClock } from '../src/format.ts';
import { systemOrbit } from '../src/orbit.ts';
import type { Timer } from '../src/timers.ts';
import { normalizeSystem, HOUR_MS } from '../src/systems-model.ts';
import type { OutlawSettings } from '../src/state.ts';

const now = Date.parse('2026-10-27T12:00:00Z');
const ago = (hours: number) => new Date(now - hours * HOUR_MS).toISOString();
const outlaw: OutlawSettings = {
  restockHours: 24,
  packetsPerVisit: 15,
  runSize: 2,
  unitsPerPacket: 75000,
  nanitesPerPacket: 350
};

test('the current system is the one visited or added most recently', () => {
  const systems = [
    normalizeSystem({ name: 'Old', visits: [{ at: ago(48) }], createdAt: ago(100) }),
    normalizeSystem({ name: 'Just added', createdAt: ago(1) }),
    normalizeSystem({ name: 'Visited', visits: [{ at: ago(5) }], createdAt: ago(200) })
  ];
  const summary = homeSummary({ systems, outlaw }, now);
  assert.equal(summary.current?.name, 'Just added');
  assert.deepEqual(
    summary.recent.map(system => system.name),
    ['Visited', 'Old']
  );
});

test('an empty log has no current system and no outlaw stations', () => {
  const summary = homeSummary({ systems: [], outlaw }, now);
  assert.equal(summary.current, undefined);
  assert.deepEqual(summary.recent, []);
  assert.deepEqual(summary.outlaw, { total: 0, ready: 0, next: [], soonest: undefined, runNanites: 0 });
});

test('outlaw: ready stations first, capped; the run estimate uses the run size and packet averages', () => {
  const station = (name: string, hoursAgo: number | null) =>
    normalizeSystem({ name, tags: ['outlaw'], visits: hoursAgo === null ? [] : [{ at: ago(hoursAgo), packets: 15 }] });
  const systems = [station('A', 30), station('B', null), station('C', 2), station('D', 25), station('E', 40)];
  const { outlaw: card } = homeSummary({ systems, outlaw }, now);
  assert.equal(card.total, 5);
  assert.equal(card.ready, 4);
  assert.deepEqual(
    card.next.map(row => row.system.name),
    ['B', 'E', 'A']
  );
  assert.equal(card.runNanites, 2 * 15 * 350); // run size 2, though 4 are ready
  assert.equal(card.soonest, undefined);
});

test('when every station is restocking, the soonest one is named with its countdown', () => {
  const systems = [
    normalizeSystem({ name: 'Later', tags: ['outlaw'], visits: [{ at: ago(1), packets: 15 }] }),
    normalizeSystem({ name: 'Sooner', tags: ['outlaw'], visits: [{ at: ago(10), packets: 15 }] })
  ];
  const { outlaw: card } = homeSummary({ systems, outlaw }, now);
  assert.equal(card.ready, 0);
  assert.ok(card.soonest);
  assert.equal(card.soonest.system.name, 'Sooner');
  assert.equal(card.soonest.status.label, 'Ready in 14h');
});

test("the hero's status line says you're here only for a visit, and its place line follows the game's order", () => {
  const visited = normalizeSystem({ name: 'A', visits: [{ at: ago(26) }], createdAt: ago(100) });
  assert.equal(heroStatus(visited, now), 'You are here · 26h ago');
  assert.equal(heroStatus(normalizeSystem({ name: 'B', createdAt: ago(2) }), now), 'Logged 2h ago');
  const full = normalizeSystem({
    name: 'C',
    region: 'Aeushne Sector',
    galaxy: 'Euclid',
    race: 'korvax',
    economy: 'Technology'
  });
  assert.equal(heroPlace(full), 'Aeushne Sector · Euclid · Korvax · Technology');
  assert.equal(heroPlace(normalizeSystem({ name: 'D' })), 'Euclid'); // the galaxy defaults to Euclid
  const camp = normalizeSystem({ name: 'E', galaxy: 'Euclid', tags: ['harmonic-camp', 'base'] });
  assert.equal(warpBackLine(camp, now), 'Euclid · harmonic-camp · never visited');
});

test('Home shows the soonest running timer and the newest finished one, then fills from either', () => {
  const timer = (id: string, startedHoursAgo: number, endsInHours: number): Timer => ({
    id,
    kind: 'custom',
    label: id,
    startedAt: ago(startedHoursAgo),
    endsAt: ago(-endsInHours),
    alerted: false
  });
  const rows = homeTimers(
    [timer('later', 1, 5), timer('soon', 1, 0.5), timer('old-done', 5, -3), timer('done', 2, -1)],
    now
  );
  assert.deepEqual(
    rows.map(row => row.timer.id),
    ['soon', 'done']
  );
  assert.deepEqual(
    homeTimers([timer('later', 1, 5), timer('soon', 1, 0.5)], now).map(row => row.timer.id),
    ['soon', 'later']
  );
  assert.deepEqual(
    homeTimers([timer('old-done', 5, -3), timer('done', 2, -1)], now).map(row => row.timer.id),
    ['done', 'old-done']
  );
  assert.deepEqual(
    homeTimers([timer('later', 1, 5), timer('old-done', 5, -3), timer('done', 2, -1)], now).map(row => [
      row.timer.id,
      row.status.done
    ]),
    [
      ['later', false],
      ['done', true]
    ]
  );
  assert.deepEqual(homeTimers([], now), []);
});

test('a running session reads as a clock', () => {
  assert.equal(formatClock(1000), '00:00:01');
  assert.equal(formatClock((1 * 3600 + 24 * 60 + 9) * 1000), '01:24:09');
  assert.equal(formatClock(-5), '00:00:00');
});

test("a system's orbit: seeded by galaxy and address (or its id), bases ringed, families from the wiki", () => {
  const system = normalizeSystem({
    id: 'sys-1',
    name: 'A',
    galaxy: 'Euclid',
    planets: [
      { id: 'p1', name: 'Hjalmar', biome: 'Frozen', tags: ['base'] },
      { id: 'p2', name: 'Dune', biome: 'Barren', tags: [] }
    ]
  });
  const orbit = systemOrbit(system, planet => (planet.biome === 'Frozen' ? 'frozen' : null));
  assert.deepEqual(orbit.seed, ['Euclid', 'sys-1']);
  assert.deepEqual(orbit.planets, [
    { name: 'Hjalmar', family: 'frozen', size: 1, base: true },
    { name: 'Dune', family: null, size: 1, base: false }
  ]);
  assert.deepEqual(systemOrbit({ ...system, glyphs: '0123456789AB' }, () => null).seed, ['Euclid', '0123456789AB']);
});

test('the atlas is empty until the player logs anything at all', () => {
  const state = buildState();
  assert.equal(isEmptyAtlas(state), true);
  assert.equal(isEmptyAtlas({ ...state, notes: [{}] }), false);
  assert.equal(isEmptyAtlas({ ...state, gear: [{}] }), false);
  assert.equal(isEmptyAtlas({ ...state, systems: [normalizeSystem({ name: 'Ekwa Nexus' })] }), false);
});

describe('weekSummary', () => {
  const at = Date.parse('2026-11-06T12:00:00Z');
  const daysAgo = (days: number) => new Date(at - days * 24 * 3600 * 1000).toISOString();
  test('counts the last seven days: systems logged, planets discovered, timers done and time played', () => {
    const state = {
      systems: [
        normalizeSystem({ name: 'New', createdAt: daysAgo(2), planets: [{ name: 'A', discoveredOn: '2026-11-05' }] }),
        normalizeSystem({ name: 'Old', createdAt: daysAgo(10), planets: [{ name: 'B', discoveredOn: '2026-10-01' }] })
      ],
      sessions: [
        { startedAt: daysAgo(1), endedAt: new Date(at - 24 * 3600 * 1000 + 3600 * 1000).toISOString(), timersDone: 2 },
        {
          startedAt: daysAgo(7.5),
          endedAt: new Date(Date.parse(daysAgo(7.5)) + 24 * 3600 * 1000).toISOString(),
          timersDone: 5
        },
        { startedAt: daysAgo(20), endedAt: daysAgo(19), timersDone: 9 }
      ],
      session: { startedAt: new Date(at - 30 * 60 * 1000).toISOString(), timersDone: 1 }
    };
    const week = weekSummary(state, at);
    expect(week.systems).toBe(1);
    expect(week.planets).toBe(1);
    // The 7.5-day-old session ended inside the window (counted), the 20-day-old one didn't.
    expect(week.timersDone).toBe(2 + 5 + 1);
    // 1h, plus the part of the long session inside the window (12h of it), plus the running half hour.
    expect(week.played).toBe(3600_000 + 12 * 3600_000 + 30 * 60_000);
  });
  test('an empty log is all zeros', () => {
    expect(weekSummary({ systems: [], sessions: [], session: null }, at)).toEqual({
      systems: 0,
      planets: 0,
      timersDone: 0,
      played: 0
    });
  });
});
