import { test } from 'vitest';
import assert from 'node:assert/strict';
import { normalizeSystem } from '../src/systems-model.ts';
import {
  arcInView,
  clusterEntries,
  clustersOf,
  coreChip,
  fanOf,
  fitCamera,
  frameCamera,
  galaxyCamera,
  journey,
  lightYearsLong,
  mergePins,
  nextGalaxies,
  ordinal,
  placeSystem,
  project,
  regionCode,
  ringStep,
  ringsInView,
  scaleBar,
  spiralArms,
  stacksOf,
  tide,
  zoomAt,
  zoomLevel,
  RIM_REGIONS
} from '../src/map.ts';

const GALAXIES = [
  { n: 1, name: 'Euclid', type: 'Norm', path: 'wiki/galaxies/Euclid.md' },
  { n: 2, name: 'Hilbert Dimension', type: 'Norm', path: 'wiki/galaxies/Hilbert_Dimension.md' },
  { n: 3, name: 'Calypso', type: 'Harsh', path: 'wiki/galaxies/Calypso.md' },
  { n: 4, name: 'Hesperius Dimension', type: 'Norm', path: 'wiki/galaxies/Hesperius_Dimension.md' },
  { n: 5, name: 'Hyades', type: 'Norm', path: 'wiki/galaxies/Hyades.md' }
];
const system = (name: string, galaxy: string, glyphs: string, createdAt: string, visits: string[] = []) =>
  normalizeSystem({ name, galaxy, glyphs, createdAt, visits: visits.map(at => ({ at })) });

test('a portal address places a system round its galaxy’s core; no address, no place', () => {
  // X 010 east, Z 000: on the axis to the east, 16 regions out.
  const east = placeSystem(system('East', 'Euclid', '100000000010', '2026-10-01T00:00:00Z'));
  assert.ok(east);
  assert.equal(east.angle, 0);
  assert.equal(east.regions, 16);
  assert.equal(east.reach, 16 / 0x7ff);
  // Z FFF is one region north (the upper half of the range is negative): straight up the screen.
  const north = placeSystem(system('North', 'Euclid', '100000FFF000', '2026-10-01T00:00:00Z'));
  assert.equal(north?.angle, -Math.PI / 2);
  assert.equal(placeSystem(system('Nowhere', 'Euclid', '', '2026-10-01T00:00:00Z')), null);
});

test('the journey lists galaxies in the order first reached, and where the player is now', () => {
  const trip = journey(
    [
      system('Late Euclid', 'Euclid', '', '2026-10-20T00:00:00Z', ['2026-10-28T00:00:00Z']),
      system('First', 'Euclid', '100000000010', '2026-10-01T00:00:00Z'),
      system('Over', 'hilbert dimension', '1000000A0000', '2026-10-10T00:00:00Z'),
      system('Deeper', 'Euclid', '100000000008', '2026-10-05T00:00:00Z'),
      system('Custom', 'My Own Galaxy', '', '2026-10-15T00:00:00Z')
    ],
    GALAXIES
  );
  assert.deepEqual(
    trip.galaxies.map(g => [g.name, g.n, g.placed.map(p => p.system.name), g.unplaced, g.deepest]),
    [
      ['Euclid', 1, ['First', 'Deeper'], 1, 8],
      ['Hilbert Dimension', 2, ['Over'], 0, 160], // Z 0A0: 160 regions south
      ['My Own Galaxy', null, [], 1, null]
    ]
  );
  assert.equal(trip.here, 0); // the latest visit was in Euclid
  assert.deepEqual([trip.placed, trip.unplaced], [3, 2]);
  assert.deepEqual(journey([], GALAXIES), { galaxies: [], here: -1, placed: 0, unplaced: 0 });
});

test('the next galaxies follow the wiki’s numbering from where the player is', () => {
  const trip = journey(
    [
      system('A', 'Euclid', '', '2026-10-01T00:00:00Z'),
      system('B', 'Calypso', '', '2026-10-02T00:00:00Z'),
      system('C', 'Hilbert Dimension', '', '2026-10-03T00:00:00Z')
    ],
    GALAXIES
  );
  assert.deepEqual(
    nextGalaxies(trip, GALAXIES).map(g => g.name),
    ['Hesperius Dimension', 'Hyades'] // after Hilbert (2), skipping Calypso, already reached
  );
  assert.deepEqual(nextGalaxies(trip, null), []);
});

test('tide colours run cyan → violet → rose → amber by order of arrival', () => {
  assert.equal(tide(0, 1), '#67e8f9');
  assert.equal(tide(0, 4), '#67e8f9');
  assert.equal(tide(1, 4), '#a78bfa');
  assert.equal(tide(2, 4), '#f472b6');
  assert.equal(tide(3, 4), '#fbbf24');
});

// The owner's case (round 7): two systems logged in one region, a third one region over, a fourth far away.
const placedOf = (...systems: { name: string; glyphs: string; region?: string; tags?: string[] }[]) =>
  systems
    .map(s =>
      placeSystem(normalizeSystem({ name: s.name, galaxy: 'Euclid', glyphs: s.glyphs, region: s.region, tags: s.tags }))
    )
    .filter(p => p !== null);
const MARCO = placedOf(
  { name: 'Masdalri Junction', glyphs: '10010C4BAB22', region: 'Aeushne Sector', tags: ['base'] },
  { name: 'Funjosm', glyphs: '20020C4BAB22', region: 'Aeushne Sector' },
  { name: 'Vintam Reach', glyphs: '10030C4BBB22', region: '' },
  { name: 'Ekarri Haven', glyphs: '1004EBEC017C', region: 'Uthes Reach' }
);

test('two systems in one region are one stack: one point, both members, log order kept', () => {
  assert.equal(regionCode('10010C4BAB22'), '4BA·B22');
  const stacks = stacksOf(MARCO);
  assert.deepEqual(
    stacks.map(s => s.members),
    [[0, 1], [2], [3]]
  );
  const [first] = stacks;
  assert.deepEqual([first?.x, first?.z], [0xb22 - 0x1000, 0x4ba]); // X wraps negative; Z positive
});

test('clusters chain stacks within 80 regions, are named by their commonest region, outermost first', () => {
  const clusters = clustersOf(MARCO);
  assert.deepEqual(
    clusters.map(c => [c.name, c.members, c.base]),
    [
      ['Aeushne Sector', [0, 1, 2], 0], // the third is one region over, with no name: it joins and doesn't vote
      ['Uthes Reach', [3], null]
    ]
  );
  assert.equal(clusters[0]?.across, 1);
  assert.deepEqual(clusterEntries(clusters[0]), [[0, 1], [2]]); // the stack is one entry in the list
  // Nothing named: the first region's code.
  assert.equal(clustersOf(placedOf({ name: 'A', glyphs: '100100000010' }))[0]?.name, '000·010');
  // 81 regions apart is two clusters; a chain of 80s is one.
  const far = placedOf({ name: 'A', glyphs: '100100000000' }, { name: 'B', glyphs: '100100000051' });
  assert.equal(clustersOf(far).length, 2);
  const chain = placedOf(
    { name: 'A', glyphs: '100100000000' },
    { name: 'B', glyphs: '100100000050' },
    { name: 'C', glyphs: '1001000000A0' }
  );
  assert.equal(clustersOf(chain).length, 1);
});

test('the three zoom levels, the galaxy camera and fit', () => {
  assert.deepEqual([0.08, 0.5, 39.9, 40].map(zoomLevel), ['galaxy', 'cluster', 'cluster', 'region']);
  const galaxy = galaxyCamera(358, 384);
  assert.equal(galaxy.ppr, (358 * 0.46) / RIM_REGIONS); // the rim at 46% of the shorter side
  assert.deepEqual(project(galaxy, 358, 384, 0, 0), { x: 179, y: 192 });
  // Two clusters far apart: fit is the galaxy. One cluster: framed, true shape kept.
  assert.deepEqual(fitCamera(clustersOf(MARCO), 358, 384), galaxy);
  const one = fitCamera(clustersOf(MARCO.slice(0, 3)), 358, 384);
  assert.equal(zoomLevel(one.ppr), 'region'); // one region across frames at region level
  // A lone point frames at region level too, never "zoomed to nothing".
  assert.equal(zoomLevel(frameCamera([{ x: 5, z: 5 }], 358, 384).ppr), 'region');
  // Zooming keeps the point under the pointer where it is, and never past the whole galaxy.
  const zoomed = zoomAt(galaxy, 4, 300, 100, 358, 384);
  const before = project(galaxy, 358, 384, (300 - 179) / galaxy.ppr, (100 - 192) / galaxy.ppr);
  const after = project(zoomed, 358, 384, (300 - 179) / galaxy.ppr, (100 - 192) / galaxy.ppr);
  assert.ok(Math.abs(after.x - before.x) < 1e-9 && Math.abs(after.y - before.y) < 1e-9);
  assert.equal(zoomAt(galaxy, 0.1, 0, 0, 358, 384).ppr, galaxy.ppr);
});

test('rings and the scale bar use round light years: 200k on the galaxy, 400 in a region', () => {
  const galaxy = galaxyCamera(358, 384);
  assert.equal(ringStep(galaxy.ppr, 400, 36) * 400, 200000);
  const bar = scaleBar(galaxy.ppr, 400);
  assert.equal(bar.length, 400000);
  assert.ok(bar.px >= 50 && bar.px <= 110, `bar ${String(bar.px)}px`);
  assert.equal(ringStep(60, 400, 80), 2.5); // 1,000 ly apart at 60px a region
  assert.equal(ringStep(160, 400, 80), 1); // never finer than a region
  assert.equal(scaleBar(60, 400).length, 400); // a region at region level
  assert.equal(scaleBar(60, null).length, 1); // without the wiki's figure, in regions
  assert.deepEqual(ringsInView(galaxy, 358, 384, 500), [500, 1000, 1500, 2000]);
});

test('the core is on the map or in the edge chip, in its true bearing', () => {
  const area = { left: 70, top: 100, right: 288, bottom: 354 };
  assert.equal(coreChip(galaxyCamera(358, 384), 358, 384, area), null);
  // Zoomed on a cluster to the south-east of the core: the chip sits up and to the left.
  const chip = coreChip({ x: 1000, z: 1000, ppr: 2 }, 358, 384, area);
  assert.ok(chip);
  assert.equal(Math.round(chip.bearing), -135);
  assert.equal(Math.round(chip.regions), Math.round(Math.hypot(1000, 1000)));
  assert.ok(chip.x >= 70 && chip.y >= 100 && (chip.x === 70 || chip.y === 100));
});

test('pins that would overlap merge into the biggest; apart they stay', () => {
  const merged = mergePins([
    { id: 'small', x: 100, y: 100, count: 3 },
    { id: 'big', x: 105, y: 100, count: 96 },
    { id: 'away', x: 300, y: 300, count: 10 }
  ]);
  assert.deepEqual(
    merged.map(p => [p.ids, p.count]),
    [
      [['big', 'small'], 99],
      [['away'], 10]
    ]
  );
});

test('a stack fans round its one point: two left and right, more evenly round', () => {
  assert.deepEqual(fanOf(2).angles, [180, 0]);
  assert.equal(fanOf(5).angles.length, 5);
  assert.ok(fanOf(12).radius > fanOf(2).radius);
});

test('the spiral glyph is arms by the galaxy’s type, the same for the same name, and has no dots', () => {
  assert.deepEqual(
    ['Norm', 'Lush', 'Harsh', 'Empty', ''].map(type => spiralArms('Euclid', type).length),
    [4, 5, 2, 3, 4]
  );
  assert.deepEqual(spiralArms('Euclid', 'Norm'), spiralArms('Euclid', 'Norm'));
  assert.notDeepEqual(spiralArms('Euclid', 'Norm'), spiralArms('Calypso', 'Norm'));
  for (const arm of spiralArms('Euclid', 'Norm')) {
    assert.equal(arm.lines.length, 2);
    // Inside the rim, reaching it.
    const radii = arm.band.map(([x, y]) => Math.hypot(x, y));
    assert.ok(Math.max(...radii) <= 1.01 && Math.max(...radii) > 0.95);
  }
});

test('light years and ordinals read as the design writes them', () => {
  assert.equal(lightYearsLong(492.5, 400), '197,000 ly');
  assert.equal(lightYearsLong(10, 400), '4,000 ly');
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal), [
    '1st',
    '2nd',
    '3rd',
    '4th',
    '11th',
    '12th',
    '13th',
    '21st',
    '22nd',
    '23rd',
    '101st'
  ]);
});

test('arcInView: a small circle is drawn whole, a huge one only where it crosses the view, one off screen not at all', () => {
  const galaxy = galaxyCamera(358, 384);
  assert.deepEqual(arcInView(galaxy, 358, 384, RIM_REGIONS), { full: true });
  // Zoomed into a region on the rim: ~330,000 px round, so just the arc on screen, less than half a turn.
  const deep = { x: RIM_REGIONS, z: 0, ppr: 160 };
  const arc = arcInView(deep, 358, 384, RIM_REGIONS);
  assert.ok(arc && 'from' in arc);
  assert.ok(arc.to - arc.from > 0 && arc.to - arc.from < Math.PI);
  assert.ok((arc.to - arc.from) * RIM_REGIONS * 160 < 2000); // a screen's worth of arc, not the whole circle
  // The same place, a ring 100 regions in: well off this view.
  assert.equal(arcInView(deep, 358, 384, RIM_REGIONS - 100), null);
  // In a region near the core, the rim is nowhere near.
  assert.equal(arcInView({ x: 10, z: 10, ppr: 160 }, 358, 384, RIM_REGIONS), null);
});
