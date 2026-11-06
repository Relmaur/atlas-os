import { test } from 'vitest';
import assert from 'node:assert/strict';
import { normalizeSystem } from '../src/systems-model.ts';
import { normalizeGear } from '../src/gear.ts';
import { firsts } from '../src/frontier.ts';
import { CLASS_FROM, DEPTH_POINTS, deepestReading, travellerCard } from '../src/traveller.ts';
import { currentArt } from '../src/current.ts';
import { journey } from '../src/map.ts';

const sys = (name: string, extra: Record<string, unknown>) =>
  normalizeSystem({ name, galaxy: 'Euclid', createdAt: '2026-10-01T00:00:00Z', ...extra });
const SYSTEMS = [
  sys('Home', {
    star: 'yellow',
    race: 'korvax',
    glyphs: '100000000100',
    planets: [{ name: 'Rime', biome: 'Frozen' }],
    createdAt: '2026-10-01T00:00:00Z'
  }),
  sys('Green', {
    star: 'green',
    race: 'gek',
    glyphs: '100000000200',
    planetCount: 4,
    createdAt: '2026-10-03T00:00:00Z'
  }),
  sys('Over', { star: 'yellow', galaxy: 'Calypso', glyphs: '100000100000', createdAt: '2026-10-05T00:00:00Z' }),
  sys('Nowhere', { race: 'none', createdAt: '2026-10-06T00:00:00Z' })
];
const GEAR = normalizeGear([
  { name: 'Ray', kind: 'starship', class: 'S', type: 'Interceptor', createdAt: '2026-10-02T00:00:00Z' },
  { name: 'Old', kind: 'multitool', class: 'B', createdAt: '2026-10-04T00:00:00Z' }
]);
const family = ({ biome }: { biome: string }) => (biome === 'Frozen' ? ('frozen' as const) : null);
const LOG = { systems: SYSTEMS, gear: GEAR, notes: [], runs: [], checklists: {} };

test('firsts are each kind’s earliest record, newest first; unknown races and the first galaxy earn none', () => {
  assert.deepEqual(
    firsts(LOG, family).map(f => [f.key, f.label]),
    [
      ['galaxy:calypso', 'Calypso'],
      ['star:green', 'First green star'],
      ['race:gek', 'Met the Gek'],
      ['ship:interceptor', 'First Interceptor'],
      ['s-class', 'First S-class'],
      ['biome:frozen', 'First frozen world'],
      ['star:yellow', 'First yellow star'], // the same record: alphabetical
      ['race:korvax', 'Met the Korvax']
    ]
  );
});

test('the card counts the log, adds up depth points, and takes its class and rank from them', () => {
  const earned = firsts(LOG, family);
  const card = travellerCard(LOG, earned, null);
  assert.deepEqual([card.systems, card.galaxies, card.planets, card.gear, card.sclass], [4, 2, 5, 2, 1]);
  assert.deepEqual(card.stars, { yellow: 2, red: 0, green: 1, blue: 0, purple: 0 });
  assert.deepEqual(card.route, ['Euclid', 'Calypso']);
  assert.deepEqual(card.deepest, { regions: 256, galaxy: 'Euclid' });
  assert.equal(
    card.points.total,
    4 * DEPTH_POINTS.system + 5 * DEPTH_POINTS.planet + DEPTH_POINTS.sclass + 8 * DEPTH_POINTS.first
  ); // 40 + 15 + 15 + 80 = 150
  assert.equal(card.cls, 'C');
  assert.deepEqual(card.next, CLASS_FROM[0]);
  assert.equal(card.rank.title, 'Pathfinder'); // 4 systems + 5 for a second galaxy beats 2 ships × 3
  assert.equal(card.rank.why, 'What you log most: 4 systems across 2 galaxies.');
  assert.equal(card.issuedAt, Date.parse('2026-10-01T00:00:00Z'));
  assert.match(card.id, /^[0-9A-F]{4}·[0-9A-F]{4}$/);
  assert.equal(travellerCard(LOG, earned, null).id, card.id); // the same log, the same card
});

test('the class ladder: B from 200 points, A from 600, S from 1,500', () => {
  const many = Array.from({ length: 150 }, (_, i) => sys(`S${String(i)}`, { createdAt: '2026-10-01T00:00:00Z' }));
  const card = travellerCard({ ...LOG, systems: many, gear: [] }, [], null);
  assert.equal(card.points.total, 1500);
  assert.equal(card.cls, 'S');
  assert.equal(card.next, null);
  const day = travellerCard({ systems: [], gear: [], notes: [], runs: [], checklists: {} }, [], null);
  assert.deepEqual([day.cls, day.rank.title, day.issuedAt, day.id], ['C', 'Traveller', null, '····']);
});

test('the deepest reading: light years and how far in from the rim', () => {
  assert.deepEqual(deepestReading(1000, 400), { ly: '400,000 ly', inward: (1 - 400000 / (0x7ff * 400)) * 100 });
  assert.equal(deepestReading(3000, 400).inward, 0); // past the rim along an axis (a diagonal or high address)
});

test('the art: one eye per placed system, islands from a second galaxy, and the same log draws the same art', () => {
  const one = currentArt(journey(SYSTEMS.slice(0, 2), null));
  assert.equal(one.vortices, 2);
  assert.equal(one.eyes.length, 2);
  assert.deepEqual(one.islands, []);
  const two = currentArt(journey(SYSTEMS, null));
  assert.deepEqual(
    two.islands.map(i => [i.name, i.colour]),
    [
      ['Euclid', '#67e8f9'],
      ['Calypso', '#fbbf24'] // with two galaxies the tide runs straight from cyan to amber
    ]
  );
  assert.deepEqual(currentArt(journey(SYSTEMS, null)), two);
  const empty = currentArt(journey([], null));
  assert.equal(empty.vortices, 0);
  assert.ok(empty.lines.length > 50); // day one still has a field, with no eye
});
