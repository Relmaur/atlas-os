// The orbit diagram's layout (DESIGN.md, the star chart; the design's component 08, decided B): where the star,
// orbits, planets and labels go, in fixed sizes. Pure geometry; the web app draws it as SVG. A port of the design's
// reference `edge()`, tested against vectors taken from it.
//
// The side view: the star sits at the left (cut by the edge on XL and M; whole, 28px in, on Home's L), orbits are arcs
// centred on it, and each planet sits on its arc at an angle seeded from the system's galaxy and portal address, so
// the same system draws the same picture on every device. Order is the planet's position in the system, never
// sorted. Logged, not imagined: planets the game counts but the player hasn't logged are dashed rings.
import type { PlanetLike } from './systems-model.ts';
import { Rng, seedOf } from './seed.ts';
import type { System } from './systems-model.ts';

export type OrbitSize = 'XL' | 'L' | 'M';

export interface OrbitPlanet {
  name: string;
  /** Biome family for the planet marker's colour; null when it isn't known. */
  family: string | null;
  /** Relative disc size, 1 when not logged. */
  size: number;
  base: boolean;
}

export interface OrbitOptions {
  width: number;
  height: number;
  size: OrbitSize;
  /** The game's planet count, when it's more than the logged planets: the rest draw as dashed rings. */
  total?: number;
  /** The star's centre from the left edge. By default it sits just outside, about 45% of its disc hidden. */
  starX?: number;
  /** Base labels (XL above the planet, L below it with the planet's name). M never has them. */
  labels?: boolean;
  /** Roman numerals beside each planet (XL only). */
  numerals?: boolean;
  /** Height at the top that controls sit over (System detail's back and edit buttons): planets swing up less. */
  insetTop?: number;
}

export interface OrbitLayout {
  star: { cx: number; cy: number; r: number };
  /** Arcs centred on the star; dashed where no planet is logged on them. M has none. */
  orbits: { r: number; logged: boolean }[];
  /** M's single dashed line the planets sit on. */
  line: { x1: number; x2: number; y: number } | null;
  planets: (
    | ({ logged: true; x: number; y: number; r: number; index: number } & OrbitPlanet)
    | { logged: false; x: number; y: number; r: number; index: number }
  )[];
  /** A ring 5px outside each disc the player has a base on. */
  baseRings: { cx: number; cy: number; r: number }[];
  /** Each with the index of the planet it belongs to, so it moves with it. */
  labels: { x: number; y: number; text: string; kind: 'base' | 'numeral'; planet: number }[];
}

// Star radius and planet radius per size, and how many star radii out the first orbit sits.
const SCALE: Record<OrbitSize, { star: number; planet: number; firstOrbit: number }> = {
  XL: { star: 22, planet: 15, firstOrbit: 4.6 },
  L: { star: 15, planet: 10, firstOrbit: 4.4 },
  M: { star: 12, planet: 6.5, firstOrbit: 3.4 }
};
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const HIDDEN = 0.45; // of the star's radius, times 1.2, sits past the left edge by default

/**
 * Lays out a system's star and planets. `seedParts` are what the angles are seeded from: the galaxy and the portal
 * address (or a stable stand-in when there's no address).
 */
export function orbitLayout(seedParts: [string, string], planets: OrbitPlanet[], options: OrbitOptions): OrbitLayout {
  const { width: W, height: H, size } = options;
  const { star: R, planet: pr, firstOrbit } = SCALE[size];
  const cy = H / 2;
  const cx = options.starX ?? -R * HIDDEN * 1.2;
  const total = Math.max(options.total ?? 0, planets.length); // a smaller game count never hides a logged planet
  let r0 = R * firstOrbit;
  // The rest of the orbits split the width that's left evenly, so the arcs never touch the right edge.
  const step = total > 1 ? (W - 18 - (cx + r0)) / Math.max(total - 1, 1) : 0;
  if (total === 1) r0 = Math.max(r0, W * 0.38 - cx); // one orbit sits a third of the way across, not crowded left

  // Seeded per size too, as in the design: each size is its own composition.
  const rng = new Rng(seedOf(seedParts[0], seedParts[1], size));
  const angles = Array.from({ length: total }, () => rng.range(-1, 1));

  const layout: OrbitLayout = {
    star: { cx, cy, r: R },
    orbits: [],
    line: size === 'M' ? { x1: cx + R + 2, x2: W - 8, y: cy } : null,
    planets: [],
    baseRings: [],
    labels: []
  };
  for (let i = 0; i < total; i++) {
    const r = r0 + i * step;
    if (size !== 'M') layout.orbits.push({ r, logged: i < planets.length });
    let x = cx + r;
    let y = cy;
    if (size !== 'M') {
      // Keep every planet inside the frame: the usable angle shrinks as the orbit grows.
      const limit = Math.asin(Math.min(1, (H / 2 - pr * 1.8 - 8) / r));
      const up = Math.asin(Math.min(1, Math.max(0, H / 2 - (options.insetTop ?? 0) - pr * 1.8 - 8) / r));
      const swing = angles[i] ?? 0;
      const angle = swing * (swing < 0 ? Math.min(limit, up) : limit) * 0.85;
      x = cx + r * Math.cos(angle);
      y = cy + r * Math.sin(angle);
    }
    const planet = planets[i];
    if (!planet) {
      layout.planets.push({ logged: false, x, y, r: pr * 0.8, index: i });
      continue;
    }
    const rr = pr * planet.size;
    layout.planets.push({ ...planet, logged: true, x, y, r: rr, index: i });
    if (planet.base) {
      layout.baseRings.push({ cx: x, cy: y, r: rr + 5 });
      if (options.labels !== false && size !== 'M') {
        const text = size === 'L' ? `BASE · ${planet.name.toUpperCase()}` : 'BASE';
        const half = (text.length * (size === 'L' ? 7.1 : 8)) / 2; // the label's width, estimated from mono glyphs
        layout.labels.push({
          x: Math.min(Math.max(x, half + 8), W - half - 8),
          y: size === 'L' ? y + rr + 19 : y - rr - 11,
          text,
          kind: 'base',
          planet: i
        });
      }
    }
    if (options.numerals && size === 'XL') {
      layout.labels.push({
        x: x + rr + 22 < W ? x + rr + 8 : x - rr - 18,
        y: y + rr + 12,
        text: NUMERALS[i] ?? String(i + 1),
        kind: 'numeral',
        planet: i
      });
    }
  }
  return layout;
}

/**
 * The diagram's sentence for screen readers: "Masdalri Junction: a yellow star with 5 planets; your base is on
 * Buya 90/K4." What isn't logged is said, never guessed.
 */
export function orbitSentence(system: string, starColour: string, planets: OrbitPlanet[], total = 0): string {
  const star = starColour ? `a ${starColour.toLowerCase()} star` : 'a star (colour not logged)';
  const count = Math.max(total, planets.length);
  const logged =
    count === 0
      ? 'no planets logged'
      : `${String(count)} ${count === 1 ? 'planet' : 'planets'}${planets.length < count ? ` (${String(planets.length)} logged)` : ''}`;
  const base = planets.find(planet => planet.base);
  return `${system}: ${star} with ${logged}${base ? `; your base is on ${base.name}` : ''}.`;
}

/**
 * A logged system as the diagram draws it. The angles are seeded from its galaxy and portal address; a system with no
 * address uses its id, so systems without one don't all draw alike (the picture settles once an address is logged).
 * A planet tagged `base` is ringed; `familyOf` gives a biome's colour family from the wiki (null draws slate).
 */
export function systemOrbit(
  system: Pick<System, 'id' | 'galaxy' | 'glyphs' | 'planets'>,
  familyOf: (planet: PlanetLike) => string | null
): { seed: [string, string]; planets: OrbitPlanet[] } {
  return {
    seed: [system.galaxy, system.glyphs || system.id],
    planets: system.planets.map(planet => ({
      name: planet.name,
      family: familyOf(planet),
      size: 1, // the log doesn't hold planet sizes
      base: planet.tags.includes('base')
    }))
  };
}
