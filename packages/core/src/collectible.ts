// Collectible cards (component c05; Card viewer, design 27): the art as plain shapes, so the screen's SVG and the saved
// picture's canvas draw the same thing, and which cards the log has earned. Ported from the design's newart.py and
// cards.py. Pure and seeded: the same inputs draw the same art on every device.
//   star colour → palette · race → rosette geometry · Manufacturing → a hex lattice · economy → layers
//   conflict → amplitude · wealth → line weight · planets → orbits and the biome ring · a first → where the worlds start
// The MVP awards Logged, Addressed, First and Fleet. Witnessed and Verified need the future Community Atlas.
import type { PlanetLike } from './systems-model.ts';
import { firsts as logFirsts, loggedAt, type First } from './frontier.ts';
import type { BiomeFamily } from './facts.ts';
import { classLetter, type GearItem } from './gear.ts';
import { Rng, seedOf, sha256Hex } from './seed.ts';
import { RACES, STAR_CLASSES, type StarClass, type System } from './systems-model.ts';

export interface Paint {
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeOpacity?: number;
  width?: number;
  dash?: number[];
}
export type ArtShape =
  | ({ kind: 'path'; d: string } & Paint)
  | ({ kind: 'circle'; cx: number; cy: number; r: number } & Paint)
  | { kind: 'star'; cx: number; cy: number; r: number; colour: StarClass | '' }
  | { kind: 'planet'; cx: number; cy: number; r: number; family: string | null; base: boolean; infested?: boolean }
  | { kind: 'text'; x: number; y: number; text: string };
export interface ArtGroup {
  shapes: ArtShape[];
  /** Turned about the art's centre: where it starts, and how long a turn takes. */
  start?: number;
  spin?: { seconds: number; reverse?: boolean };
}
export interface CardArt {
  width: number;
  height: number;
  cx: number;
  cy: number;
  base: string;
  // Three depths, so a tilt shows parallax.
  bg: ArtGroup[];
  mid: ArtGroup[];
  fg: ArtGroup[];
}

const f1 = (value: number) => value.toFixed(1);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const int = (rng: Rng, a: number, b: number) => Math.trunc(rng.range(a, b + 1));
const CYAN = '#67e8f9';
const UNLOGGED = '#94a3b8';

type Geometry = 'korvax' | 'gek' | 'vykeen';
/** A spirograph: Korvax angular, Gek smooth, Vy'keen jagged. */
export function rosette(
  cx: number,
  cy: number,
  scale: number,
  R: number,
  r: number,
  d: number,
  race: Geometry
): string {
  const turns = r / gcd(R, r);
  const n = race === 'korvax' ? 9 * R : 900;
  const points: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * turns * i) / n;
    let x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    let y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    if (race === 'vykeen') {
      const k = 1 + 0.045 * (Math.floor(i / 6) % 2 ? 1 : -1);
      x *= k;
      y *= k;
    }
    points.push(`${f1(cx + x * scale)} ${f1(cy + y * scale)}`);
  }
  return `M${points.join(' L')} Z`;
}

const hexagon = (x: number, y: number, s: number) => {
  const points = Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k;
    return `${f1(x + s * Math.cos(a))} ${f1(y + s * Math.sin(a))}`;
  });
  return `M${points.join(' L')} Z`;
};

function hexLattice(cx: number, cy: number, colour: string, rng: Rng, W: number, H: number, s: number): ArtShape[] {
  const shapes: ArtShape[] = [];
  const h = s * Math.sqrt(3);
  for (let row = -2; row < Math.trunc(H / h) + 3; row++)
    for (let col = -2; col < Math.trunc(W / (1.5 * s)) + 3; col++) {
      const x = col * 1.5 * s;
      const y = row * h + (col % 2 ? h / 2 : 0);
      const opacity = Math.max(0.03, 0.34 - Math.hypot(x - cx, y - cy) / 620);
      if (rng.next() < 0.84)
        shapes.push({ kind: 'path', d: hexagon(x, y, s), stroke: colour, strokeOpacity: opacity, width: 0.7 });
      if (rng.next() < 0.05)
        shapes.push({ kind: 'path', d: hexagon(x, y, s), fill: colour, fillOpacity: opacity * 0.35 });
    }
  return shapes;
}

export interface SystemArtInput {
  galaxy: string;
  address: string;
  star: StarClass | '';
  race: Geometry;
  layers: number;
  conflict: number;
  wealth: number;
  manufacturing: boolean;
  planets: { family: string | null; base: boolean; infested?: boolean }[];
  /** Another moment at the same place: the same system, its worlds elsewhere. */
  edition?: number;
}

const FAMILY_RING: Record<string, string> = {
  toxic: '#facc15',
  hot: '#fb923c',
  radioactive: '#a3e635',
  frozen: '#7dd3fc',
  exotic: '#e879f9',
  lush: '#4ade80',
  barren: '#d4b483',
  dead: '#a8a29e',
  marsh: '#5fb7a0',
  ocean: '#3b82f6'
};

export function systemArt(input: SystemArtInput, W = 300, H = 420): CardArt {
  const seed = seedOf(input.galaxy, input.address, '');
  const rng = new Rng(seed);
  const colour = input.star ? STAR_CLASSES[input.star].color : UNLOGGED;
  const cx = W / 2;
  const cy = H * 0.42;
  const bg: ArtGroup[] = [];
  const mid: ArtGroup[] = [];
  const fg: ArtGroup[] = [];
  if (input.manufacturing) bg.push({ shapes: hexLattice(cx, cy, colour, rng, W, H, 12 + 2 * input.wealth) });
  else {
    const R = int(rng, 5, 9);
    for (let L = 0; L < 1 + input.layers; L++) {
      let r = int(rng, 2, R - 1);
      while (gcd(R, r) === R) r = int(rng, 2, R - 1);
      const d = rng.range(1.5, 3.2) * (0.8 + 0.25 * input.conflict);
      const scale = ((W * 0.78) / (R - r + d)) * (0.78 + 0.1 * L);
      bg.push({
        spin: { seconds: 180 + 60 * L, reverse: L % 2 === 1 },
        shapes: [
          {
            kind: 'path',
            d: rosette(cx, cy, scale, R, r, d, input.race),
            stroke: L % 2 === 0 ? colour : CYAN,
            strokeOpacity: L % 2 === 0 ? 0.3 : 0.15,
            width: 0.5 + 0.25 * input.wealth
          }
        ]
      });
    }
  }
  const n = input.planets.length;
  const baseR = 46;
  const step = (W * 0.46 - baseR) / Math.max(n - 1, 1);
  const orbits = input.planets.map((_, i) => baseR + i * step);
  mid.push({
    shapes: orbits.map((r, i) => ({
      kind: 'circle' as const,
      cx,
      cy,
      r,
      stroke: CYAN,
      strokeOpacity: i < n - 1 ? 0.22 : 0.14,
      ...(i === n - 1 ? { dash: [3, 5] } : {})
    }))
  });
  if (n) {
    const ring = (orbits[n - 1] ?? baseR) + 12;
    const segment = (2 * Math.PI) / n;
    mid.push({
      spin: { seconds: 320 },
      shapes: input.planets.map((planet, i) => {
        const a0 = -Math.PI / 2 + i * segment + 0.06;
        const a1 = a0 + segment - 0.12;
        const large = segment - 0.12 > Math.PI ? 1 : 0;
        return {
          kind: 'path' as const,
          d: `M ${f1(cx + ring * Math.cos(a0))} ${f1(cy + ring * Math.sin(a0))} A ${f1(ring)} ${f1(ring)} 0 ${String(large)} 1 ${f1(cx + ring * Math.cos(a1))} ${f1(cy + ring * Math.sin(a1))}`,
          stroke: FAMILY_RING[planet.family ?? ''] ?? UNLOGGED,
          strokeOpacity: 0.7,
          width: 1.6
        };
      })
    });
  }
  fg.push({ shapes: [{ kind: 'star', cx, cy, r: 16, colour: input.star }] });
  const edition = new Rng(input.edition ?? (seed ^ 0x9e3779b9) >>> 0);
  input.planets.forEach((planet, i) => {
    const orbit = orbits[i] ?? baseR;
    const start = edition.range(0, 360);
    const r = 5 + edition.range(0, 4);
    fg.push({
      start,
      spin: { seconds: 26 * (orbit / baseR) ** 1.5 },
      shapes: [
        {
          kind: 'planet',
          cx: cx + orbit,
          cy,
          r,
          family: planet.family,
          base: planet.base,
          ...(planet.infested && { infested: true })
        }
      ]
    });
  });
  return { width: W, height: H, cx, cy, base: '#050a14', bg, mid, fg };
}

const key = (row: number, col: number) => `R${String(row)}C${String(col)}`;

// Fleet cards: the tech grid as a honeycomb, supercharged cells lit, the lattice continuing faintly beyond it.
function honeycomb(
  cx: number,
  cy: number,
  slots: Set<string>,
  rows: number,
  W: number,
  H: number,
  s: number,
  colour: string
) {
  const shapes: ArtShape[] = [];
  const h = s * Math.sqrt(3);
  const x0 = cx - (9 * 1.5 * s) / 2;
  const y0 = cy - ((rows - 1) * h) / 2;
  const LIT = '#c084fc';
  for (let c = -6; c < 16; c++)
    for (let r = -6; r < rows + 8; r++) {
      const x = x0 + c * 1.5 * s;
      const y = y0 + r * h + (c % 2 ? h / 2 : 0);
      if (x < -s || x > W + s || y < -s || y > H + s) continue;
      const d = hexagon(x, y, s * 0.92);
      if (c >= 0 && c < 10 && r >= 0 && r < rows) {
        if (slots.has(key(r + 1, c + 1)))
          shapes.push({ kind: 'path', d, fill: LIT, fillOpacity: 0.32, stroke: LIT, strokeOpacity: 0.95, width: 1.2 });
        else
          shapes.push({
            kind: 'path',
            d,
            fill: colour,
            fillOpacity: 0.04,
            stroke: colour,
            strokeOpacity: 0.38,
            width: 0.8
          });
      } else {
        const opacity = Math.max(0, 0.16 - Math.hypot(x - cx, y - cy) / 1400);
        if (opacity > 0.02) shapes.push({ kind: 'path', d, stroke: colour, strokeOpacity: opacity, width: 0.6 });
      }
    }
  return shapes;
}

const SHIP_SPANS: [RegExp, [number, number, number]][] = [
  [/interceptor|sentinel/i, [0.95, 1.6, 0.55]],
  [/hauler|freighter/i, [0.6, 0.9, 1.2]],
  [/explorer/i, [0.45, 2.0, 0.6]],
  [/exotic|squid/i, [1.1, 1.1, 1.0]],
  [/living|solar/i, [0.9, 1.4, 0.9]]
];
const FIGHTER: [number, number, number] = [0.8, 1.2, 0.8];

/** A starship: a symmetric flight sigil from seeded chevrons. Abstract, never the game's ship art. */
export function shipArt(
  item: Pick<GearItem, 'name' | 'class' | 'type' | 'superchargedSlots'>,
  W = 300,
  H = 420
): CardArt {
  const rng = new Rng(seedOf(item.name, item.class, item.type));
  const cx = W / 2;
  const cy = H * 0.42;
  const [wing, length, bulk] = SHIP_SPANS.find(([test]) => test.test(item.type))?.[1] ?? FIGHTER;
  const bg: ArtGroup[] = [
    { shapes: honeycomb(cx, cy + 6, new Set(item.superchargedSlots), 6, W, H, 13, '#7c3aed') },
    {
      shapes: Array.from({ length: 10 }, (_, k): ArtShape => {
        const y = cy - 150 + (H + 20 - (cy - 150)) * ((k + 1) / 10) ** 1.8;
        return { kind: 'path', d: `M -10 ${f1(y)} L ${String(W + 10)} ${f1(y)}`, stroke: CYAN, strokeOpacity: 0.08 };
      })
    }
  ];
  const letter = classLetter(item.class);
  const layers = 4 + (letter === 'S' ? 2 : letter === 'A' ? 1 : 0);
  const hull: ArtShape[] = [];
  for (let L = 0; L < layers; L++) {
    const w = (40 + L * 16) * wing * (0.6 + 0.8 * rng.next());
    const l = (70 + L * 14) * length * (0.7 + 0.6 * rng.next());
    const b = (16 + L * 7) * bulk * (0.6 + 0.8 * rng.next());
    const nose: [number, number] = [cx, cy - l * 0.62];
    const tail = cy + l * (0.25 + 0.25 * rng.next());
    const shoulder = rng.range(-0.3, 0.15);
    const fin = rng.next() > 0.5;
    const fx = w * rng.range(0.5, 0.9);
    const fy = tail - l * rng.range(0.15, 0.35);
    const right: [number, number][] = [
      [cx + b, cy + l * shoulder],
      ...(fin
        ? ([
            [cx + fx, fy],
            [cx + b * 1.1, fy + 8]
          ] as [number, number][])
        : []),
      [cx + w, tail],
      [cx + b * 0.6, tail - 12]
    ];
    const left = right.map(([x, y]): [number, number] => [2 * cx - x, y]).reverse();
    const points = [nose, ...right, [cx, tail + 10 * rng.next()] as [number, number], ...left];
    hull.push({
      kind: 'path',
      d: `M${points.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L')} Z`,
      stroke: L % 2 === 0 ? '#c084fc' : CYAN,
      strokeOpacity: 0.5 - 0.06 * L,
      width: L === 0 ? 1.2 : 0.8
    });
  }
  const fg: ArtShape[] = [];
  for (const side of [-1, 1]) {
    const x = cx + side * 22 * wing;
    fg.push({
      kind: 'path',
      d: `M ${f1(x)} ${f1(cy + 55 * length * 0.6)} L ${f1(x + side * 10)} ${String(H + 10)}`,
      stroke: CYAN,
      strokeOpacity: 0.55,
      width: 2,
      dash: [6, 10]
    });
  }
  const bottom = cy + 45 * length;
  fg.push({
    kind: 'path',
    d: `M ${f1(cx)} ${f1(cy - 50 * length)} L ${f1(cx)} ${f1(bottom)}`,
    stroke: '#e9d5ff',
    strokeOpacity: 0.35
  });
  if (!item.superchargedSlots.length)
    fg.push({ kind: 'text', x: cx, y: bottom + 26, text: 'NO SUPERCHARGED SLOTS MARKED' });
  return { width: W, height: H, cx, cy, base: '#06070f', bg, mid: [{ shapes: hull }], fg: [{ shapes: fg }] };
}

/** A Multi-Tool or Exosuit: a scanner reticle. A long rifle stretches it; the slots are lit in the honeycomb behind. */
export function toolArt(
  item: Pick<GearItem, 'name' | 'class' | 'type' | 'superchargedSlots'>,
  W = 300,
  H = 420
): CardArt {
  const rng = new Rng(seedOf(item.name, item.class, item.type));
  const cx = W / 2;
  const cy = H * 0.42;
  const [ax, ay] =
    /rifle/i.test(item.type) && !/standard/i.test(item.type)
      ? [1.45, 0.62]
      : /pistol/i.test(item.type)
        ? [0.8, 0.8]
        : [1, 1];
  const standard = ax === 1;
  const letter = classLetter(item.class);
  const rings = 5 + (letter === 'S' ? 2 : letter === 'A' ? 1 : 0);
  const arcs: ArtShape[] = [];
  for (let i = 0; i < rings; i++) {
    const rx = (34 + i * 17) * ax;
    const ry = (34 + i * 17) * ay;
    const gaps = int(rng, 2, 4);
    const segment = 360 / gaps;
    for (let g = 0; g < gaps; g++) {
      const a0 = ((g * segment + rng.range(4, 14)) * Math.PI) / 180;
      const a1 = (((g + 1) * segment - rng.range(4, 14)) * Math.PI) / 180;
      arcs.push({
        kind: 'path',
        d: `M ${f1(cx + rx * Math.cos(a0))} ${f1(cy + ry * Math.sin(a0))} A ${f1(rx)} ${f1(ry)} 0 ${segment > 180 ? '1' : '0'} 1 ${f1(cx + rx * Math.cos(a1))} ${f1(cy + ry * Math.sin(a1))}`,
        stroke: i % 2 === 0 ? CYAN : '#6ee7b7',
        strokeOpacity: 0.45 - 0.04 * i,
        width: 1
      });
    }
  }
  arcs.push({
    kind: 'path',
    d: `M ${f1(cx - 150 * ax)} ${f1(cy)} L ${f1(cx - 20)} ${f1(cy)} M ${f1(cx + 20)} ${f1(cy)} L ${f1(cx + 150 * ax)} ${f1(cy)} M ${f1(cx)} ${f1(cy - 140 * ay)} L ${f1(cx)} ${f1(cy - 20)} M ${f1(cx)} ${f1(cy + 20)} L ${f1(cx)} ${f1(cy + 140 * ay)}`,
    stroke: '#a5f3fc',
    strokeOpacity: 0.25
  });
  const beamEnd = cx + 150 * ax;
  const fg: ArtGroup[] = [
    {
      spin: { seconds: 6 },
      shapes: [
        {
          kind: 'path',
          d: `M ${f1(cx)} ${f1(cy)} L ${f1(beamEnd)} ${f1(cy - 12)} L ${f1(beamEnd)} ${f1(cy + 12)} Z`,
          fill: '#22d3ee',
          fillOpacity: 0.14
        },
        { kind: 'path', d: `M ${f1(cx)} ${f1(cy)} L ${f1(beamEnd)} ${f1(cy)}`, stroke: '#a5f3fc', strokeOpacity: 0.7 }
      ]
    },
    {
      shapes: [
        { kind: 'circle', cx, cy, r: 5, fill: '#a5f3fc' },
        ...(item.superchargedSlots.length
          ? []
          : [{ kind: 'text' as const, x: cx, y: cy + 150 * ay + 18, text: 'SUPERCHARGED: NOT MARKED' }])
      ]
    }
  ];
  return {
    width: W,
    height: H,
    cx,
    cy,
    base: '#03101a',
    bg: [{ shapes: honeycomb(cx, cy, new Set(item.superchargedSlots), standard ? 5 : 4, W, H, 12, '#0891b2') }],
    mid: [{ shapes: arcs }],
    fg
  };
}

// ——— The collection ———
export type CardKind = 'logged' | 'addressed' | 'first' | 'fleet';
export interface CollectionCard {
  id: string;
  kind: CardKind;
  title: string;
  sub: string;
  rarity: string;
  badge: string;
  at: number;
  address: string;
  /** What the back and the line under the card say. */
  place: string;
  pills: string[];
  note: string;
  trust: string;
  seal: string;
  /** Where the thing itself lives in the app. */
  href: string;
  art: () => CardArt;
}

export const groupAddress = (address: string) => address.replace(/(.{4})(?=.)/g, '$1 ');
const seal = (...parts: string[]) => {
  const hex = sha256Hex(parts.join('|')).toUpperCase();
  return `SEED ${hex.slice(0, 4)}·${hex.slice(4, 8)} · ART ${hex.slice(8, 12)}`;
};
const LEVEL: Record<string, number> = { low: 1, medium: 2, high: 3, pirate: 3 };
const ECONOMY_LAYERS: Record<string, number> = {
  Trading: 3,
  'High Tech': 2,
  Technology: 2,
  Scientific: 2,
  'Power Generation': 1,
  'Advanced Materials': 2,
  Mining: 1
};
const worlds = (system: System) => {
  const count = system.planetCount || system.planets.length;
  return count ? `${String(count)} world${count === 1 ? '' : 's'}` : '';
};

/** Whether a planet is an Infested world (round 4b): its disc gets the spore ring on the cards too. */
type InfestedOf = (planet: PlanetLike) => boolean;

/** The art's inputs from a logged system. A system with no address keys on its id, until an address settles it. */
export function systemArtInput(
  system: System,
  family: (planet: PlanetLike) => BiomeFamily | null,
  edition?: number,
  infestedOf: InfestedOf = () => false
): SystemArtInput {
  return {
    galaxy: system.galaxy || 'Euclid',
    address: system.glyphs || system.id,
    star: system.star,
    race: system.race === 'korvax' || system.race === 'vykeen' ? system.race : 'gek',
    layers: ECONOMY_LAYERS[system.economy] ?? 2,
    conflict: LEVEL[system.conflict] ?? 1,
    wealth: system.wealth || 1,
    manufacturing: system.economy === 'Manufacturing',
    planets: system.planets.map(planet => ({
      family: family(planet),
      base: planet.tags.includes('base'),
      ...(infestedOf(planet) && { infested: true })
    })),
    ...(edition === undefined ? {} : { edition })
  };
}

const facts = (system: System) =>
  [system.star ? STAR_CLASSES[system.star].label : '', worlds(system), system.race ? RACES[system.race] : ''].filter(
    Boolean
  );
const placeOf = (system: System) => [system.region, system.galaxy].filter(Boolean).join(' · ');

function systemCard(
  system: System,
  family: (planet: PlanetLike) => BiomeFamily | null,
  infestedOf: InfestedOf
): CollectionCard {
  const addressed = Boolean(system.glyphs);
  return {
    id: `system:${system.id}`,
    kind: addressed ? 'addressed' : 'logged',
    title: system.name,
    sub: system.region || system.galaxy,
    rarity: addressed ? 'ADDRESSED' : 'LOGGED',
    badge: '',
    at: loggedAt(system),
    address: system.glyphs,
    place: placeOf(system),
    pills: facts(system),
    note: addressed
      ? 'Anyone can go and check it with this address.'
      : 'No portal address yet. Add it in the editor and anyone can go and check it.',
    trust: addressed ? 'ADDRESSED' : 'LOGGED',
    seal: seal(system.galaxy, system.glyphs || system.id),
    href: `#system/${system.id}`,
    art: () => systemArt(systemArtInput(system, family, undefined, infestedOf))
  };
}

function gearArt(item: GearItem): CardArt {
  return item.kind === 'starship' ? shipArt(item) : toolArt(item);
}
const GEAR_NAME = { starship: 'FLEET', multitool: 'MULTI-TOOL', exosuit: 'EXOSUIT' };

function fleetCard(item: GearItem): CollectionCard {
  const letter = classLetter(item.class);
  const count = item.superchargedSlots.length;
  return {
    id: `gear:${item.id}`,
    kind: 'fleet',
    title: item.name,
    sub: item.type || GEAR_NAME[item.kind],
    rarity: [GEAR_NAME[item.kind], letter ?? ''].filter(Boolean).join(' · '),
    badge: letter ? `${letter}-class` : item.class,
    at: Date.parse(item.createdAt) || 0,
    address: '',
    place: [item.type, item.role].filter(Boolean).join(' · '),
    pills: [letter ? `${letter}-class` : item.class, count ? `${String(count)} supercharged` : ''].filter(Boolean),
    note: count ? `Supercharged: ${item.superchargedSlots.join(' · ')}` : 'No supercharged slots marked yet.',
    trust: 'FLEET',
    seal: seal(item.name, item.class),
    href: `#ship/${item.id}`,
    art: () => gearArt(item)
  };
}

function firstCard(
  first: First,
  log: { systems: System[]; gear: GearItem[] },
  family: (planet: PlanetLike) => BiomeFamily | null,
  infestedOf: InfestedOf
): CollectionCard | null {
  const [group = '', value = ''] = first.key.split(':');
  const earliest = [...log.systems]
    .sort((a, b) => loggedAt(a) - loggedAt(b))
    .find(system =>
      group === 'star'
        ? system.star === value
        : group === 'race'
          ? system.race === value
          : group === 'galaxy'
            ? system.galaxy.trim().toLowerCase() === value
            : group === 'biome'
              ? system.planets.some(planet => family(planet) === value)
              : false
    );
  const base = {
    id: `first:${first.key}`,
    kind: 'first' as const,
    title: first.label,
    rarity: 'FIRST',
    badge: 'First',
    at: first.at,
    trust: 'FIRST',
    note: 'Your first. There’s only ever one.'
  };
  if (earliest)
    return {
      ...base,
      sub: earliest.name,
      address: earliest.glyphs,
      place: [earliest.name, earliest.galaxy].filter(Boolean).join(' · '),
      pills: facts(earliest),
      seal: seal('first', first.key, earliest.glyphs || earliest.id),
      href: `#system/${earliest.id}`,
      art: () => systemArt(systemArtInput(earliest, family, seedOf('first', first.key), infestedOf))
    };
  const item = [...log.gear]
    .sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0))
    .find(gear =>
      group === 's-class'
        ? classLetter(gear.class) === 'S'
        : group === 'ship' && gear.kind === 'starship' && gear.type.trim().toLowerCase() === value
    );
  if (!item) return null;
  return {
    ...base,
    sub: item.name,
    address: '',
    place: [item.name, item.type].filter(Boolean).join(' · '),
    pills: [item.class ? `${classLetter(item.class) ?? item.class}-class` : ''].filter(Boolean),
    seal: seal('first', first.key, item.name),
    href: `#ship/${item.id}`,
    art: () => gearArt(item)
  };
}

/** Every card the log has earned, newest first. */
export function collection(
  log: { systems: System[]; gear: GearItem[] },
  family: (planet: PlanetLike) => BiomeFamily | null,
  infestedOf: InfestedOf = () => false
): CollectionCard[] {
  const firstCards = logFirsts(log, family).flatMap(first => firstCard(first, log, family, infestedOf) ?? []);
  return [
    ...log.systems.map(system => systemCard(system, family, infestedOf)),
    ...log.gear.map(fleetCard),
    ...firstCards
  ].sort((a, b) => b.at - a.at || a.title.localeCompare(b.title));
}
