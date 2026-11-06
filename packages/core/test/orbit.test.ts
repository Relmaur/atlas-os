import { expect, test } from 'vitest';
import { orbitLayout, orbitSentence, type OrbitLayout, type OrbitPlanet } from '../src/orbit.ts';

// The design's example system (orbit.py), and vectors taken from the reference `edge()`'s output, which prints one
// decimal: every position here must match it to that precision.
const MAS: [string, string] = ['Euclid', '0123456789AB'];
const p = (name: string, family: string, size: number, base = false): OrbitPlanet => ({ name, family, size, base });
const FIVE = [
  p('Buya 90/K4', 'toxic', 1, true),
  p('II', 'hot', 0.6),
  p('III', 'radioactive', 1.1),
  p('IV', 'frozen', 0.95),
  p('V', 'exotic', 0.85)
];

function discs(layout: OrbitLayout) {
  return layout.planets.filter(planet => planet.logged).map(({ x, y, r }) => [x, y, r]);
}
function expectClose(actual: number[][], expected: number[][]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((row, i) => {
    row.forEach((value, j) => {
      expect(Math.abs(value - (expected[i]?.[j] ?? NaN))).toBeLessThan(0.051);
    });
  });
}

test("Home's hero (L, whole star 28px in) matches the reference", () => {
  const layout = orbitLayout(MAS, FIVE, { width: 356, height: 150, size: 'L', starX: 28 });
  expect(layout.star).toEqual({ cx: 28, cy: 75, r: 15 });
  expectClose(discs(layout), [
    [94.0, 74.6, 10.0],
    [151.4, 45.0, 6.0],
    [211.4, 116.2, 11.0],
    [276.3, 93.8, 9.5],
    [335.2, 116.5, 8.5]
  ]);
  expectClose(
    layout.orbits.map(orbit => [orbit.r]),
    [[66.0], [127.0], [188.0], [249.0], [310.0]]
  );
  expectClose(
    layout.baseRings.map(ring => [ring.cx, ring.cy, ring.r]),
    [[94.0, 74.6, 15.0]]
  );
  expect(layout.labels.map(label => label.text)).toEqual(['BASE · BUYA 90/K4']);
  expectClose(
    layout.labels.map(label => [label.x, label.y]),
    [[94.0, 103.6]]
  );
});

test("System detail's hero (XL, cut by the edge, numerals) matches the reference", () => {
  const layout = orbitLayout(MAS, FIVE, { width: 390, height: 300, size: 'XL', numerals: true });
  expectClose(discs(layout), [
    [87.1, 171.2, 15.0],
    [143.4, 223.7, 9.0],
    [230.1, 134.0, 16.5],
    [294.3, 216.0, 14.25],
    [366.8, 212.8, 12.75]
  ]);
  expectClose(
    layout.orbits.map(orbit => [orbit.r]),
    [[101.2], [171.9], [242.5], [313.2], [383.9]]
  );
  expect(layout.labels.map(label => label.text)).toEqual(['BASE', 'I', 'II', 'III', 'IV', 'V']);
  expectClose(
    layout.labels.map(label => [label.x, label.y]),
    [
      [87.1, 145.2],
      [110.1, 198.2],
      [160.4, 244.7],
      [254.6, 162.5],
      [316.6, 242.2],
      [336.1, 237.6]
    ]
  );
});

test("the Systems list's strip (M) puts planets on one line, with the base ring and no labels", () => {
  const layout = orbitLayout(MAS, FIVE, { width: 356, height: 74, size: 'M' });
  expect(layout.orbits).toEqual([]);
  expect(layout.line?.y).toBe(37);
  expectClose(discs(layout), [
    [34.3, 37.0, 6.5],
    [110.2, 37.0, 3.9],
    [186.2, 37.0, 7.15],
    [262.1, 37.0, 6.175],
    [338.0, 37.0, 5.525]
  ]);
  expectClose(
    layout.baseRings.map(ring => [ring.cx, ring.r]),
    [[34.3, 11.5]]
  );
  expect(layout.labels).toEqual([]);
});

test('one planet sits a third of the way across, not crowded by the star', () => {
  const layout = orbitLayout(MAS, [p('Hjalmar', 'frozen', 1, true)], { width: 356, height: 110, size: 'L' });
  expectClose(discs(layout), [[135.3, 54.8, 10.0]]);
  expectClose(
    layout.orbits.map(orbit => [orbit.r]),
    [[143.4]]
  );
  expect(layout.labels[0]?.text).toBe('BASE · HJALMAR');
});

test('planets the game counts but the player has not logged are dashed rings on dashed orbits', () => {
  const layout = orbitLayout(MAS, FIVE.slice(0, 3), { width: 356, height: 110, size: 'L', total: 5, labels: false });
  expect(layout.orbits.map(orbit => orbit.logged)).toEqual([true, true, true, false, false]);
  expectClose(discs(layout), [
    [57.9, 54.8, 10.0],
    [126.8, 37.5, 6.0],
    [196.5, 79.4, 11.0]
  ]);
  const ghosts = layout.planets.filter(planet => !planet.logged).map(({ x, y, r }) => [x, y, r]);
  expectClose(ghosts, [
    [267.8, 66.1, 8.0],
    [337.1, 79.6, 8.0]
  ]);
  expect(layout.labels).toEqual([]);
  // A game count below the logged count never hides a logged planet.
  expect(orbitLayout(MAS, FIVE, { width: 356, height: 110, size: 'L', total: 2 }).planets).toHaveLength(5);
});

test('every planet stays inside its frame, and the same system always draws the same picture', () => {
  for (const size of ['XL', 'L'] as const) {
    const [width, height] = size === 'XL' ? [390, 300] : [356, 150];
    const layout = orbitLayout(['Hilbert Dimension', '21A4F03A0E10'], [...FIVE, p('VI', 'lush', 1)], {
      width,
      height,
      size
    });
    for (const planet of layout.planets) {
      expect(planet.y - planet.r).toBeGreaterThan(0);
      expect(planet.y + planet.r).toBeLessThan(height);
    }
    expect(orbitLayout(['Hilbert Dimension', '21A4F03A0E10'], FIVE, { width, height, size })).toEqual(
      orbitLayout(['Hilbert Dimension', '21A4F03A0E10'], FIVE, { width, height, size })
    );
  }
  expect(orbitLayout(MAS, [], { width: 356, height: 110, size: 'L' }).planets).toEqual([]);
});

test('the diagram says what is logged, and says what is not', () => {
  expect(orbitSentence('Masdalri Junction', 'Yellow', FIVE)).toBe(
    'Masdalri Junction: a yellow star with 5 planets; your base is on Buya 90/K4.'
  );
  expect(orbitSentence('Dissonant System #1', '', [], 3)).toBe(
    'Dissonant System #1: a star (colour not logged) with 3 planets (0 logged).'
  );
  expect(orbitSentence('Quiet', 'Red', [])).toBe('Quiet: a red star with no planets logged.');
  expect(orbitSentence('Lone', 'Blue', [p('Hjalmar', 'frozen', 1)])).toBe('Lone: a blue star with 1 planet.');
});

test('an inset at the top keeps every planet below the controls drawn over the frame', () => {
  const planets = Array.from({ length: 6 }, (_, i) => ({ name: `P${String(i)}`, family: null, size: 1, base: false }));
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    const free = orbitLayout(['Euclid', seed], planets, { width: 390, height: 300, size: 'XL' });
    const inset = orbitLayout(['Euclid', seed], planets, { width: 390, height: 300, size: 'XL', insetTop: 72 });
    inset.planets.forEach((planet, i) => {
      expect(planet.y - planet.r).toBeGreaterThanOrEqual(72);
      if ((free.planets[i]?.y ?? 0) >= 150) expect(planet.y).toBe(free.planets[i]?.y); // downward swings are unchanged
    });
  }
});

test('a moon tied to its planet leaves the star’s orbits and circles that planet, inside the frame', () => {
  const moon = { ...p('Little', 'frozen', 1), moonOf: 0 };
  for (const size of ['XL', 'L'] as const) {
    const [width, height] = size === 'XL' ? [390, 300] : [356, 150];
    const layout = orbitLayout(MAS, [...FIVE, moon], { width, height, size, total: 6 });
    // The game's count of 6 includes the moon: five orbits, no dashed one for it.
    expect(layout.orbits).toHaveLength(5);
    expect(layout.planets).toHaveLength(5);
    const [circling] = layout.moons;
    const host = layout.planets[0];
    expect(circling?.parent).toBe(0);
    expect(circling && host && Math.hypot(circling.x - host.x, circling.y - host.y)).toBeCloseTo(circling?.ring.r ?? 0);
    expect((circling?.r ?? 0) < (host?.r ?? 0)).toBe(true);
    // Wherever it is on its turn, it stays inside the frame.
    for (const planet of layout.moons) {
      expect(planet.ring.cy - planet.ring.r - planet.r).toBeGreaterThan(0);
      expect(planet.ring.cy + planet.ring.r + planet.r).toBeLessThan(height);
      expect(planet.ring.cx + planet.ring.r + planet.r).toBeLessThan(width);
    }
  }
  // A moon tied to another moon (or to itself) keeps an orbit of its own.
  const loose = orbitLayout(MAS, [{ ...moon, moonOf: 5 }, p('II', 'hot', 1), { ...moon, name: 'M', moonOf: 0 }], {
    width: 390,
    height: 300,
    size: 'XL'
  });
  expect(loose.planets).toHaveLength(2);
  expect(orbitSentence('Masdalri Junction', 'Yellow', [...FIVE, moon])).toBe(
    'Masdalri Junction: a yellow star with 6 planets; Little is a moon of Buya 90/K4; your base is on Buya 90/K4.'
  );
});
