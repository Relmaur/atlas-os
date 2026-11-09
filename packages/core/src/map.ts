// The Map (designs 30 and 31; component c10): where the player's systems really are. A portal address is a position
// (P SSS YY ZZZ XXX, the galaxy's centre at 0,0,0), so every system logged with one is drawn at its true place round
// its galaxy's core; one without an address is counted, never placed. In the game the next galaxy is reached by
// travelling to the centre of the one you're in, so galaxies come in the wiki's order and the chain grows one way.
// Pure: the log and the wiki's galaxy list in, positions out; the same log draws the same map on every device.
// Round 7 (c17) draws one galaxy at true scale with three zoom levels; the view model below is what it draws from.
import { parsePortal, regionsFromCentre, type Galaxy, type Voxel } from './location.ts';
import { Rng, seedOf } from './seed.ts';
import type { System } from './systems-model.ts';

/** A portal coordinate runs ±0x7FF regions from the centre on X and Z: the disc's edge along an axis. */
export const RIM_REGIONS = 0x7ff;

export interface PlacedSystem {
  system: System;
  voxel: Voxel;
  angle: number; // round the core in the galaxy's plane: atan2(Z, X)
  reach: number; // 0 at the centre, 1 at the rim
  regions: number; // straight-line regions from the centre (height included)
}

export interface GalaxyJourney {
  name: string;
  n: number | null; // the wiki's number for it (Euclid 1 … 256), when the name is one of the 256
  type: string; // Norm, Lush, Harsh, Empty, or '' when the wiki doesn't say
  path: string; // its Codex page, or ''
  placed: PlacedSystem[]; // in the order they were logged
  unplaced: number; // systems here without a portal address
  unaddressed: System[]; // those systems, in log order (named in the map's note, 31i's list)
  deepest: number | null; // the fewest regions from the centre any of its systems is
}

export interface Journey {
  galaxies: GalaxyJourney[]; // in the order first reached
  here: number; // index of the galaxy of the player's latest activity, or -1 with nothing logged
  placed: number;
  unplaced: number;
}

// When a system entered the player's story: logged, or first visited if a visit is older.
const firstSeen = (system: System) =>
  Math.min(Date.parse(system.createdAt) || Infinity, ...system.visits.map(visit => Date.parse(visit.at) || Infinity));
const lastSeen = (system: System) =>
  Math.max(Date.parse(system.createdAt) || 0, ...system.visits.map(visit => Date.parse(visit.at) || 0));

export function placeSystem(system: System): PlacedSystem | null {
  const voxel = parsePortal(system.glyphs);
  if (!voxel) return null;
  return {
    system,
    voxel,
    angle: Math.atan2(voxel.z, voxel.x),
    reach: Math.min(1, Math.hypot(voxel.x, voxel.z) / RIM_REGIONS),
    regions: regionsFromCentre(voxel)
  };
}

export function journey(systems: System[], galaxies: Galaxy[] | null): Journey {
  const order = [...systems].sort((a, b) => firstSeen(a) - firstSeen(b) || a.name.localeCompare(b.name));
  const byName = new Map<string, GalaxyJourney>();
  for (const system of order) {
    const name = system.galaxy.trim() || 'Euclid';
    const key = name.toLowerCase();
    let entry = byName.get(key);
    if (!entry) {
      const wiki = galaxies?.find(galaxy => galaxy.name.toLowerCase() === key);
      entry = {
        name: wiki?.name ?? name,
        n: wiki?.n ?? null,
        type: wiki?.type ?? '',
        path: wiki?.path ?? '',
        placed: [],
        unplaced: 0,
        unaddressed: [],
        deepest: null
      };
      byName.set(key, entry);
    }
    const placed = placeSystem(system);
    if (placed) {
      entry.placed.push(placed);
      entry.deepest = Math.min(entry.deepest ?? Infinity, placed.regions);
    } else {
      entry.unplaced += 1;
      entry.unaddressed.push(system);
    }
  }
  const list = [...byName.values()];
  const latest = [...systems].sort((a, b) => lastSeen(b) - lastSeen(a))[0];
  const here = latest
    ? list.findIndex(g => g.name.toLowerCase() === (latest.galaxy.trim() || 'Euclid').toLowerCase())
    : -1;
  return {
    galaxies: list,
    here,
    placed: list.reduce((sum, g) => sum + g.placed.length, 0),
    unplaced: list.reduce((sum, g) => sum + g.unplaced, 0)
  };
}

/** The galaxies after the one the player is in, by the wiki's numbering, that they haven't reached yet. */
export function nextGalaxies(trip: Journey, galaxies: Galaxy[] | null, count = 2): Galaxy[] {
  const n = trip.galaxies[trip.here]?.n;
  if (!galaxies || !n) return [];
  const reached = new Set(trip.galaxies.map(g => g.n));
  return galaxies
    .filter(galaxy => galaxy.n > n && !reached.has(galaxy.n))
    .sort((a, b) => a.n - b.n)
    .slice(0, count);
}

// The Traveller Card's palette (c11): a galaxy's colour by order of arrival, cyan → violet → rose → amber, so time
// reads as colour. One galaxy is cyan.
const TIDE = ['#67e8f9', '#a78bfa', '#f472b6', '#fbbf24'];
export function tide(index: number, count: number): string {
  if (count <= 1) return TIDE[0] ?? '#67e8f9';
  const t = (index / (count - 1)) * (TIDE.length - 1);
  const i = Math.min(Math.floor(t), TIDE.length - 2);
  const f = t - i;
  const rgb = (hex: string) => [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16));
  const a = rgb(TIDE[i] ?? '#000000');
  const b = rgb(TIDE[i + 1] ?? '#000000');
  return `#${a
    .map((v, k) =>
      Math.round(v + ((b[k] ?? 0) - v) * f)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

// ---- The galaxy map (design round 7, c17): true scale always; only the zoom changes. -------------------------------

/** "4BA·B22": the region part of an address as the map and the card write it (Z then X, as the glyphs run). */
export const regionCode = (glyphs: string): string => `${glyphs.slice(6, 9)}·${glyphs.slice(9, 12)}`.toUpperCase();

/**
 * Systems in one region. A portal address is a position to the region only, so a stack is one point: the map draws
 * it with a count and, zoomed in, as a fan round that point, never spread as if the systems had positions.
 */
export interface Stack {
  key: string; // "x,z": the region in the galaxy's plane
  x: number;
  z: number;
  members: number[]; // indexes into the galaxy's `placed`, in log order
}

/** The galaxy's systems grouped by region, in the order each region was first logged. */
export function stacksOf(placed: PlacedSystem[]): Stack[] {
  const byKey = new Map<string, Stack>();
  placed.forEach((p, i) => {
    const key = `${String(p.voxel.x)},${String(p.voxel.z)}`;
    const stack = byKey.get(key);
    if (stack) stack.members.push(i);
    else byKey.set(key, { key, x: p.voxel.x, z: p.voxel.z, members: [i] });
  });
  return [...byKey.values()];
}

/** Regions apart that still count as one cluster (single linkage, in the galaxy's plane). */
export const CLUSTER_LINK = 80;

export interface Cluster {
  id: string; // its first stack's key
  /** The commonest region name its systems were logged with; else its first region's code. */
  name: string;
  stacks: Stack[];
  members: number[]; // indexes into `placed`, in log order
  x: number; // the middle of its extent, in regions
  z: number;
  nearest: number; // the fewest regions from the core any of its systems is
  across: number; // its extent along the wider axis, in regions
  base: number | null; // its first base, if any
}

const isBaseSystem = (p: PlacedSystem) =>
  p.system.tags.includes('base') || p.system.planets.some(planet => planet.tags.includes('base'));

/** Stacks within `link` regions of each other, chained (single linkage); listed outermost first. */
export function clustersOf(placed: PlacedSystem[], link = CLUSTER_LINK): Cluster[] {
  const stacks = stacksOf(placed);
  const parent = stacks.map((_, i) => i);
  const root = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] ?? r;
    parent[i] = r;
    return r;
  };
  for (let a = 0; a < stacks.length; a++) {
    for (let b = a + 1; b < stacks.length; b++) {
      const sa = stacks[a];
      const sb = stacks[b];
      if (sa && sb && Math.hypot(sa.x - sb.x, sa.z - sb.z) <= link) parent[root(b)] = root(a);
    }
  }
  const groups = new Map<number, Stack[]>();
  stacks.forEach((stack, i) => {
    const r = root(i);
    groups.set(r, [...(groups.get(r) ?? []), stack]);
  });
  return [...groups.values()]
    .map(group => {
      const members = group.flatMap(s => s.members).sort((a, b) => a - b);
      const systems = members.map(i => placed[i]).filter(p => p !== undefined);
      const xs = group.map(s => s.x);
      const zs = group.map(s => s.z);
      const first = group[0] ?? { key: '', x: 0, z: 0, members: [] };
      return {
        id: first.key,
        name: commonestRegion(systems) || regionCode(placed[first.members[0] ?? 0]?.system.glyphs ?? ''),
        stacks: group,
        members,
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        z: (Math.min(...zs) + Math.max(...zs)) / 2,
        nearest: Math.min(...systems.map(p => p.regions)),
        across: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)),
        base: members.find(i => placed[i] && isBaseSystem(placed[i])) ?? null
      };
    })
    .sort((a, b) => b.nearest - a.nearest || (a.members[0] ?? 0) - (b.members[0] ?? 0));
}

// The region name most of a cluster's systems carry, ignoring case; a tie goes to the one logged first.
function commonestRegion(systems: PlacedSystem[]): string {
  const counts = new Map<string, { name: string; n: number }>();
  for (const p of systems) {
    const name = p.system.region.trim();
    if (!name) continue;
    const entry = counts.get(name.toLowerCase());
    if (entry) entry.n += 1;
    else counts.set(name.toLowerCase(), { name, n: 1 });
  }
  let best = { name: '', n: 0 };
  for (const entry of counts.values()) if (entry.n > best.n) best = entry;
  return best.name;
}

/** A cluster's list: its stacks of one as single entries, a stack of several as one group, in log order. */
export function clusterEntries(cluster: Cluster): number[][] {
  return [...cluster.stacks].sort((a, b) => (a.members[0] ?? 0) - (b.members[0] ?? 0)).map(s => s.members);
}

// The camera: the point at the view's centre, in regions, and the zoom in pixels per region. The geometry is the
// galaxy's own; nothing is magnified or bent.
export interface Camera {
  x: number;
  z: number;
  ppr: number;
}
export type ZoomLevel = 'galaxy' | 'cluster' | 'region';
/** Cluster level from half a pixel a region; region level (stacks fan out) from 40. */
export const CLUSTER_PPR = 0.5;
export const REGION_PPR = 40;
export const MAX_PPR = 160;

export const zoomLevel = (ppr: number): ZoomLevel =>
  ppr >= REGION_PPR ? 'region' : ppr >= CLUSTER_PPR ? 'cluster' : 'galaxy';

/** The whole disc: the rim fills 46% of the shorter side, as the boards draw it. */
export const galaxyCamera = (w: number, h: number): Camera => ({
  x: 0,
  z: 0,
  ppr: (Math.min(w, h) * 0.46) / RIM_REGIONS
});

export const clampPpr = (ppr: number, w: number, h: number): number =>
  Math.min(MAX_PPR, Math.max(galaxyCamera(w, h).ppr, ppr));

/** Frames points so their extent fills 70% of the view; one point (or one region) frames at region level. */
export function frameCamera(points: { x: number; z: number }[], w: number, h: number): Camera {
  if (!points.length) return galaxyCamera(w, h);
  const xs = points.map(p => p.x);
  const zs = points.map(p => p.z);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanZ = Math.max(...zs) - Math.min(...zs);
  const fit = Math.min(spanX ? (w * 0.7) / spanX : Infinity, spanZ ? (h * 0.7) / spanZ : Infinity);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    z: (Math.min(...zs) + Math.max(...zs)) / 2,
    ppr: clampPpr(Number.isFinite(fit) ? fit : REGION_PPR * 1.5, w, h)
  };
}

/** Fit: all the player's systems; the galaxy itself when they're in clusters far apart (or nowhere). */
export function fitCamera(clusters: Cluster[], w: number, h: number): Camera {
  const only = clusters.length === 1 ? clusters[0] : undefined;
  return only ? frameCamera(only.stacks, w, h) : galaxyCamera(w, h);
}

export const project = (cam: Camera, w: number, h: number, x: number, z: number) => ({
  x: w / 2 + (x - cam.x) * cam.ppr,
  y: h / 2 + (z - cam.z) * cam.ppr
});
export const unproject = (cam: Camera, w: number, h: number, px: number, py: number) => ({
  x: cam.x + (px - w / 2) / cam.ppr,
  z: cam.z + (py - h / 2) / cam.ppr
});

/** Zoom by `factor`, keeping the galaxy point under (px, py) where it is. */
export function zoomAt(cam: Camera, factor: number, px: number, py: number, w: number, h: number): Camera {
  const ppr = clampPpr(cam.ppr * factor, w, h);
  const at = unproject(cam, w, h, px, py);
  return { x: at.x - (px - w / 2) / ppr, z: at.z - (py - h / 2) / ppr, ppr };
}

/** Between two cameras at `t` (0–1): the zoom moves in log space so it reads as one steady move. */
export function tweenCamera(a: Camera, b: Camera, t: number): Camera {
  const ppr = Math.exp(Math.log(a.ppr) + (Math.log(b.ppr) - Math.log(a.ppr)) * t);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, ppr };
}

// 1, 2, 4, 5 × 10ⁿ: round lengths, with 4 so a scale reads "400,000 ly" and "400 ly" (a region) as the boards do.
function niceAtLeast(value: number): number {
  const p = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 2, 4, 5, 10]) if (m * p >= value) return m * p;
  return 10 * p;
}

/**
 * The rings round the core: a round number of light years (or regions, without the wiki's figure) at least `gap`
 * pixels apart on screen: 200k ly on the whole galaxy, a few thousand in a cluster, 400 ly in a region.
 */
export function ringStep(ppr: number, lyPerRegion: number | null, gap: number): number {
  const unit = lyPerRegion ?? 1;
  // A region is the finest an address can say, so rings never come closer than one.
  return Math.max(1, niceAtLeast((gap / ppr) * unit) / unit); // in regions
}

/** The ring radii (regions) that cross the view, at most `max` of them. */
export function ringsInView(cam: Camera, w: number, h: number, step: number, max = 40): number[] {
  const halfW = w / 2 / cam.ppr;
  const halfH = h / 2 / cam.ppr;
  const dx = Math.max(0, Math.abs(cam.x) - halfW);
  const dz = Math.max(0, Math.abs(cam.z) - halfH);
  const near = Math.hypot(dx, dz);
  const far = Math.hypot(Math.abs(cam.x) + halfW, Math.abs(cam.z) + halfH);
  const radii: number[] = [];
  for (let k = Math.max(1, Math.ceil(near / step)); k * step <= Math.min(far, RIM_REGIONS); k++) {
    radii.push(k * step);
    if (radii.length >= max) break;
  }
  return radii;
}

/** Where a ring's label goes when zoomed in: where it leaves the view's right edge, else its bottom edge. */
export function ringLabelAt(
  cam: Camera,
  w: number,
  h: number,
  radius: number,
  inset = 10
): { x: number; y: number; anchor: 'end' | 'middle' } | null {
  const core = project(cam, w, h, 0, 0);
  const r = radius * cam.ppr;
  const right = w - inset;
  const dx = right - core.x;
  if (Math.abs(dx) <= r) {
    for (const sign of [1, -1]) {
      const y = core.y + sign * Math.sqrt(r * r - dx * dx);
      if (y > 96 && y < h - 40) return { x: right, y: y + 3, anchor: 'end' };
    }
  }
  const bottom = h - inset - 5;
  const dy = bottom - core.y;
  if (Math.abs(dy) <= r) {
    for (const sign of [1, -1]) {
      const x = core.x + sign * Math.sqrt(r * r - dy * dy);
      if (x > 80 && x < w - 130) return { x, y: bottom + 3, anchor: 'middle' };
    }
  }
  return null;
}

/**
 * A scale bar of a round length from 50 pixels: its length in ly (or regions) and its width. At region level it is
 * one region, the finest an address can say.
 */
export function scaleBar(ppr: number, lyPerRegion: number | null): { length: number; px: number } {
  const unit = lyPerRegion ?? 1;
  const length = ppr >= REGION_PPR ? unit : niceAtLeast((50 / ppr) * unit);
  return { length, px: (length / unit) * ppr };
}

/**
 * The core chip: null while the core is on the map; otherwise where it sits on the edge of `area` (a rectangle in
 * view pixels), along the true bearing from the view's centre to the core, with that bearing (degrees, 0 = east,
 * clockwise as the screen runs) and the regions from the view's centre to the core.
 */
export function coreChip(
  cam: Camera,
  w: number,
  h: number,
  area: { left: number; top: number; right: number; bottom: number }
): { x: number; y: number; bearing: number; regions: number } | null {
  const core = project(cam, w, h, 0, 0);
  if (core.x > 12 && core.x < w - 12 && core.y > 12 && core.y < h - 12) return null;
  const cx = w / 2;
  const cy = h / 2;
  const dx = core.x - cx;
  const dy = core.y - cy;
  const tx = dx > 0 ? (area.right - cx) / dx : dx < 0 ? (area.left - cx) / dx : Infinity;
  const ty = dy > 0 ? (area.bottom - cy) / dy : dy < 0 ? (area.top - cy) / dy : Infinity;
  const t = Math.min(tx, ty);
  return {
    x: cx + dx * t,
    y: cy + dy * t,
    bearing: (Math.atan2(dy, dx) * 180) / Math.PI,
    regions: Math.hypot(cam.x, cam.z)
  };
}

/** A cluster pin's radius by how many systems it holds. */
export const pinRadius = (count: number): number => 9 + 5 * Math.log10(Math.max(1, count));

export interface Pin {
  ids: string[]; // the clusters it stands for, the biggest first
  x: number;
  y: number;
  count: number;
  r: number;
}

/** Pins that would overlap on screen become one, at the biggest one's place: "Qolva Shallows +3 · 96". */
export function mergePins(pins: { id: string; x: number; y: number; count: number }[], gap = 2): Pin[] {
  const out: Pin[] = [];
  for (const pin of [...pins].sort((a, b) => b.count - a.count)) {
    const r = pinRadius(pin.count);
    const into = out.find(o => Math.hypot(o.x - pin.x, o.y - pin.y) < o.r + r + gap);
    if (into) {
      into.ids.push(pin.id);
      into.count += pin.count;
      into.r = pinRadius(into.count);
    } else out.push({ ids: [pin.id], x: pin.x, y: pin.y, count: pin.count, r });
  }
  return out;
}

/**
 * A stack's fan at region level: the angles (degrees, screen-clockwise from east) its members are drawn at round
 * their one point, and the fan's radius. Two sit left and right; three add one above; more go evenly round.
 */
export function fanOf(n: number): { angles: number[]; radius: number } {
  const presets: Record<number, number[]> = { 1: [0], 2: [180, 0], 3: [270, 0, 180], 4: [180, 270, 0, 90] };
  const angles = presets[n] ?? Array.from({ length: n }, (_, k) => 180 + (k * 360) / n);
  return { angles, radius: Math.max(28, n * 6) };
}

// Spiral arms by the wiki's galaxy type.
const ARMS: Record<string, number> = { Norm: 4, Lush: 5, Harsh: 2, Empty: 3 };

export interface SpiralArm {
  band: [number, number][]; // the tapered arm, a closed outline
  lines: [number, number][][]; // two fine engraved lines along it
}

/**
 * A galaxy's spiral glyph in a unit disc (rim radius 1): tapered arms, by the wiki's type, turned by a seed from the
 * galaxy's name. It is a drawing, never star positions, so it has no dots.
 */
export function spiralArms(name: string, type: string, steps = 48): SpiralArm[] {
  const arms = ARMS[type] ?? 4;
  const rng = new Rng(seedOf(name, 'spiral'));
  const turn = rng.range(0, 2 * Math.PI);
  const sweep = 3.0;
  const at = (theta0: number, t: number, offset: number): [number, number] => {
    const r = 0.05 + 0.95 * t;
    const th = theta0 + t * sweep + offset / Math.max(r, 0.05);
    return [round4(r * Math.cos(th)), round4(r * Math.sin(th))];
  };
  return Array.from({ length: arms }, (_, k) => {
    const theta0 = turn + (k * 2 * Math.PI) / arms;
    const ts = Array.from({ length: steps + 1 }, (_, i) => i / steps);
    const width = (t: number) => 0.075 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.7;
    const outer = ts.map(t => at(theta0, t, width(t)));
    const inner = ts.map(t => at(theta0, t, -width(t))).reverse();
    return {
      band: [...outer, ...inner],
      lines: [ts.map(t => at(theta0, t, width(t) * 0.25)), ts.slice(4).map(t => at(theta0, t, -width(t) * 0.35))]
    };
  });
}
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;
/** "197,000 ly" for the galaxy list; under 10,000 to the light year. */
export function lightYearsLong(regions: number, lyPerRegion: number): string {
  const ly = regions * lyPerRegion;
  return ly >= 10000
    ? `${Math.round(ly / 1000).toLocaleString('en')},000 ly`
    : `${Math.round(ly).toLocaleString('en')} ly`;
}

/** "1st", "2nd", "23rd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${String(n)}${suffix}`;
}
