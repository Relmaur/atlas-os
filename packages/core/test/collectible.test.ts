import { test } from 'vitest';
import assert from 'node:assert/strict';
import { collection, groupAddress, rosette, shipArt, systemArt, systemArtInput, toolArt } from '../src/collectible.ts';
import { frontier } from '../src/frontier.ts';
import { normalizeGear } from '../src/gear.ts';
import { Rng, seedOf } from '../src/seed.ts';
import { normalizeSystem } from '../src/systems-model.ts';

const family = ({ biome }: { biome: string }) =>
  (({ Lush: 'lush', Scorched: 'hot', Frozen: 'frozen' }) as const)[biome] ?? null;
const home = normalizeSystem({
  name: 'Masdalri Junction',
  region: 'Aeushne Sector',
  galaxy: 'Euclid',
  star: 'yellow',
  race: 'korvax',
  rating: 5,
  createdAt: '2026-10-01T00:00:00Z',
  planets: [
    { name: 'Buya', biome: 'Scorched', tags: ['base'] },
    { name: 'Geor', biome: 'Frozen' }
  ]
});
const far = normalizeSystem({
  name: 'Thessalin Gate',
  galaxy: 'Euclid',
  glyphs: '0C11A9E2D5F4',
  star: 'purple',
  race: 'gek',
  createdAt: '2026-10-20T00:00:00Z',
  planets: [{ name: 'Ora', biome: 'Lush' }]
});
const gear = normalizeGear([
  {
    name: 'Ythgall',
    kind: 'starship',
    class: 'S',
    type: 'Sentinel Interceptor',
    superchargedSlots: ['R2C3'],
    createdAt: '2026-10-05T00:00:00Z'
  },
  { name: 'Aeron', kind: 'starship', class: 'S', type: 'Sentinel Interceptor', createdAt: '2026-10-06T00:00:00Z' },
  { name: 'Defiance', kind: 'multitool', class: 'A', type: 'Sentinel Long-Rifle', createdAt: '2026-10-07T00:00:00Z' }
]);

test('the art’s seed and rosettes match the design’s reference code', () => {
  // From cards.py: seed_of, RNG and rosette(150, 176, 20, 7, 3, 2.0, race).
  const seed = seedOf('Euclid', '0C11A9E2D5F4', '');
  assert.equal(seed, 1774285668);
  const rng = new Rng(seed);
  assert.deepEqual(
    [rng.next(), rng.next(), rng.next()].map(v => Math.round(v * 1e6) / 1e6),
    [0.013491, 0.093139, 0.207082]
  );
  const korvax = rosette(150, 176, 20, 7, 3, 2, 'korvax');
  assert.equal(korvax.length, 812);
  assert.ok(korvax.startsWith('M270.0 176.0 L263.3 184.0 L244.0 192.4'));
  assert.equal(rosette(150, 176, 20, 7, 3, 2, 'gek').length, 11394);
  const vykeen = rosette(150, 176, 20, 7, 3, 2, 'vykeen');
  assert.equal(vykeen.length, 11402);
  assert.ok(vykeen.startsWith('M264.6 176.0 L264.6 176.5'));
});

test('the same inputs draw the same art; a first moves only the worlds', () => {
  const input = systemArtInput(far, family);
  assert.deepEqual(systemArt(input), systemArt(input));
  const first = systemArt(systemArtInput(far, family, 7));
  const plain = systemArt(input);
  assert.deepEqual(first.bg, plain.bg);
  assert.notDeepEqual(first.fg, plain.fg);
});

test('a ship and a tool draw by their own algorithms, and say when no slot is marked', () => {
  const [ship, spare, tool] = gear;
  assert.ok(ship && spare && tool);
  const lit = shipArt(ship)
    .bg.flatMap(group => group.shapes)
    .filter(shape => shape.kind === 'path' && shape.fillOpacity === 0.32);
  assert.equal(lit.length, 1);
  assert.ok(shipArt(spare).fg[0]?.shapes.some(shape => shape.kind === 'text'));
  assert.notDeepEqual(shipArt(ship).mid, shipArt(spare).mid);
  assert.equal(toolArt(tool).base, '#03101a');
});

test('the collection holds what the log earned, newest first, and nothing it can’t yet earn', () => {
  const cards = collection({ systems: [home, far], gear }, family);
  assert.equal(cards[0]?.at, Date.parse('2026-10-20T00:00:00Z'));
  const kinds = new Set(cards.map(card => card.kind));
  assert.deepEqual([...kinds].sort(), ['addressed', 'first', 'fleet', 'logged']);
  assert.equal(cards.find(card => card.id === `system:${far.id}`)?.rarity, 'ADDRESSED');
  assert.equal(cards.find(card => card.id === `system:${home.id}`)?.rarity, 'LOGGED');
  assert.ok(cards.find(card => card.title === 'First purple star')?.address);
  assert.equal(cards.find(card => card.id === `gear:${gear[0]?.id ?? ''}`)?.rarity, 'FLEET · S');
  assert.ok(!cards.some(card => /WITNESS|VERIFIED/.test(card.rarity)));
  assert.equal(groupAddress('0C11A9E2D5F4'), '0C11 A9E2 D5F4');
  assert.deepEqual(collection({ systems: [], gear: [] }, family), []);
});

test('Frontier says what’s still out there, in the design’s words', () => {
  const view = frontier({ systems: [home], gear }, family);
  assert.equal(view.next?.title, 'A purple star');
  assert.deepEqual(view.stars.have, ['yellow']);
  assert.equal(view.stars.note, 'All yellow so far.');
  assert.deepEqual([view.biomes.have.length, view.biomes.total], [2, 10]);
  assert.equal(view.races.note, 'Korvax in Masdalri Junction.');
  assert.deepEqual(view.ships.have, ['Sentinel Interceptor']);
  assert.match(view.ships.note, /^Two Sentinel Interceptors in your hangar/);
  const full = frontier(
    {
      systems: (['yellow', 'red', 'green', 'blue', 'purple'] as const).map(star =>
        normalizeSystem({ name: star, star })
      ),
      gear: []
    },
    family
  );
  assert.equal(full.stars.note, 'Every colour there is.');
  assert.equal(full.next?.title, 'A lush world');
  assert.equal(frontier({ systems: [], gear: [] }, family).firsts, 0);
});
