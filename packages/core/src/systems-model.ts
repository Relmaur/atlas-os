// Systems log model: constants, normalisation, legacy migration and Outlaw Run status (pure, no DOM).
// State lives in nms_state.json → systems[] + outlaw{} (docs/state-schema.md).
import { asString, isPlainObject, SAFE_ID, toText } from './util.ts';
import { formatDuration } from './format.ts';

export interface Visit {
  at: string;
  note?: string;
  packets?: number;
}
export interface Planet {
  id: string;
  name: string;
  /** The biome as the player gave it: one of the wiki's ("Frozen") or their own words, which are kept as typed. */
  biome: string;
  tags: string[];
  notes: string;
  // What a scan shows (added 2026-11; an older log reads them as empty). Words as the game shows them.
  /** The prefix before "Planet" or "Moon": "Frostbound". */
  descriptor: string;
  body: PlanetBody | '';
  weather: string;
  sentinels: string;
  flora: string;
  fauna: string;
  /** The scan's "Resources" line: "Uncommon". */
  abundance: string;
  /** The resources the scan lists, in its order: "Copper", "Dioxite". */
  resources: string[];
  /** °C as the player read it (it changes with day and night); null when not logged. */
  temperature: number | null;
  discoveredBy: string;
  /** The day the game says it was discovered (YYYY-MM-DD), or ''. */
  discoveredOn: string;
}
export const PLANET_BODIES = { planet: 'Planet', moon: 'Moon' };
export type PlanetBody = keyof typeof PLANET_BODIES;
// A system as normalizeSystem() stores it: every field present, with a known type.
export interface System {
  id: string;
  name: string;
  galaxy: string;
  region: string;
  glyphs: string;
  star: StarClass | '';
  race: Race | '';
  economy: string;
  wealth: number;
  // The galaxy map's other words (added 2026-11; an older log reads them as empty): "F4 // Water", "… // Opulent".
  /** The spectral class as the map shows it: "F4", "G2m". */
  spectralClass: string;
  /** The map says "Water": a planet here has seas or oceans. */
  water: boolean;
  /** The map says "Dissonant": a planet here is dissonant. */
  dissonant: boolean;
  /** The economy's strength word: "Opulent". `wealth` holds its stars. */
  economyStrength: string;
  /** How many planets and moons the game lists for the system (0: not logged); the logged ones are in `planets`. */
  planetCount: number;
  conflict: ConflictLevel | '';
  tags: string[];
  favorite: boolean;
  rating: number;
  notes: string;
  planets: Planet[];
  visits: Visit[];
  createdAt: string;
}
export interface OutlawStatus {
  ready: boolean;
  tone: 'new' | 'ready' | 'wait';
  label: string;
  readyAt: number;
}

export const OUTLAW_TAG = 'outlaw';
export const HOUR_MS = 3600 * 1000;

export const STAR_CLASSES = {
  yellow: { label: 'Yellow', color: '#facc15' },
  red: { label: 'Red', color: '#f87171' },
  green: { label: 'Green', color: '#4ade80' },
  blue: { label: 'Blue', color: '#60a5fa' },
  purple: { label: 'Purple', color: '#c084fc' }
};
export const RACES = { gek: 'Gek', korvax: 'Korvax', vykeen: "Vy'keen", none: 'Uncharted', abandoned: 'Abandoned' };
export const CONFLICT_LEVELS = { low: 'Low', medium: 'Medium', high: 'High', pirate: 'Pirate (outlaw)' };
export type StarClass = keyof typeof STAR_CLASSES;
export type Race = keyof typeof RACES;
export type ConflictLevel = keyof typeof CONFLICT_LEVELS;
export const ECONOMIES = [
  'Trading',
  'Mining',
  'Manufacturing',
  'Technology',
  'Scientific',
  'Power Generation',
  'Advanced Materials'
];
export const BIOMES = [
  'Lush',
  'Paradise',
  'Barren',
  'Frozen',
  'Scorched',
  'Toxic',
  'Irradiated',
  'Exotic',
  'Dead',
  'Marsh',
  'Volcanic',
  'Waterworld',
  'Gas Giant',
  'Infested'
];
export const SUGGESTED_TAGS = [
  OUTLAW_TAG,
  'trade-hub',
  'base',
  'harmonic-camp',
  's-class-ship',
  'crash-site',
  'portal',
  'settlement',
  'farming',
  'mining',
  'paradise',
  'exotic',
  'to-revisit',
  'home'
];
export const SORTS = {
  recent: 'Last visited',
  discovered: 'Newest added',
  name: 'Name',
  rating: 'Rating',
  region: 'Region'
};
export const LOGBOOK_TYPE_TAGS: Record<string, string> = {
  'S-Class Crash Site': 's-class-ship',
  'Harmonic Camp': 'harmonic-camp',
  'Outlaw Station': OUTLAW_TAG,
  'Hotspot / Base': 'base',
  'Custom Guide Note': 'note'
};

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function tagSlug(value: unknown): string {
  return asString(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeGlyphs(value: unknown): string {
  return toText(value, '')
    .replace(/[^0-9a-f]/gi, '')
    .toUpperCase();
}

// Every id the app generates already matches SAFE_ID; anything else (hand-edited files) is made safe here.
export function safeId(value: unknown, prefix: string): string {
  const id = asString(value)
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .slice(0, 80);
  return SAFE_ID.test(id) && /[A-Za-z0-9]/.test(id) ? id : newId(prefix);
}

export function clampInt(value: unknown, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(Number(value)) || 0));
}

// Keys of `map` only (`in` would also accept inherited names such as "toString").
function oneOf<K extends string>(map: Record<K, unknown>, value: unknown): K | '' {
  return typeof value === 'string' && Object.hasOwn(map, value) ? (value as K) : '';
}

const tagList = (value: unknown): string[] => [
  ...new Set((Array.isArray(value) ? value : []).map(tagSlug).filter(Boolean))
];
const isDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// The scan fields: each missing or damaged one reads as empty, never as a guess.
export function normalizePlanetScan(
  planet: Record<string, unknown>
): Omit<Planet, 'id' | 'name' | 'biome' | 'tags' | 'notes'> {
  const word = (value: unknown) => toText(value, '').trim().slice(0, 80);
  const temperature = typeof planet.temperature === 'number' ? planet.temperature : Number.NaN;
  return {
    descriptor: word(planet.descriptor),
    body: oneOf(PLANET_BODIES, planet.body),
    weather: word(planet.weather),
    sentinels: word(planet.sentinels),
    flora: word(planet.flora),
    fauna: word(planet.fauna),
    abundance: word(planet.abundance),
    resources: [...new Set((Array.isArray(planet.resources) ? planet.resources : []).map(word).filter(Boolean))].slice(
      0,
      12
    ),
    // The game's coldest and hottest worlds stay within a few hundred degrees; anything else is a typing slip.
    temperature:
      Number.isFinite(temperature) && Math.abs(temperature) < 1000 ? Math.round(temperature * 10) / 10 : null,
    discoveredBy: word(planet.discoveredBy),
    discoveredOn: typeof planet.discoveredOn === 'string' && DAY.test(planet.discoveredOn) ? planet.discoveredOn : ''
  };
}

export function normalizeSystem(raw: Record<string, unknown>): System {
  const rawVisits: unknown[] = Array.isArray(raw.visits) ? raw.visits : [];
  const firstVisit = rawVisits[0];
  const system: System = {
    id: safeId(raw.id, 'sys'),
    name: toText(raw.name, 'Unnamed system').trim() || 'Unnamed system',
    galaxy: toText(raw.galaxy, 'Euclid'),
    region: toText(raw.region, ''),
    glyphs: normalizeGlyphs(raw.glyphs),
    star: oneOf(STAR_CLASSES, raw.star),
    race: oneOf(RACES, raw.race),
    economy: toText(raw.economy, ''),
    wealth: clampInt(raw.wealth, 0, 3),
    spectralClass: toText(raw.spectralClass, '').trim().slice(0, 8),
    water: raw.water === true,
    dissonant: raw.dissonant === true,
    economyStrength: toText(raw.economyStrength, '').trim().slice(0, 40),
    planetCount: clampInt(raw.planetCount, 0, 15), // a portal's planet index is one hex digit
    conflict: oneOf(CONFLICT_LEVELS, raw.conflict),
    tags: tagList(raw.tags),
    favorite: !!raw.favorite,
    rating: clampInt(raw.rating, 0, 5),
    notes: toText(raw.notes, ''),
    planets: (Array.isArray(raw.planets) ? (raw.planets as unknown[]) : []).filter(isPlainObject).map(planet => ({
      id: safeId(planet.id, 'pl'),
      name: toText(planet.name, 'Unnamed planet'),
      biome: toText(planet.biome, ''),
      tags: tagList(planet.tags),
      notes: toText(planet.notes, ''),
      ...normalizePlanetScan(planet)
    })),
    visits: rawVisits
      .filter(isPlainObject)
      .flatMap(visit =>
        isDate(visit.at)
          ? [
              {
                at: visit.at,
                ...(visit.note ? { note: toText(visit.note) } : {}),
                ...(Number(visit.packets) > 0 ? { packets: Number(visit.packets) } : {})
              }
            ]
          : []
      )
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    createdAt: isDate(raw.createdAt)
      ? raw.createdAt
      : (isPlainObject(firstVisit) && typeof firstVisit.at === 'string' && firstVisit.at) || new Date().toISOString()
  };
  return system;
}

// Folds the pre-Systems `logbook[]` and `outlaw.stations[]` into `systems[]`. Ids are kept, so running it
// on an already-migrated state (or merging an old export into a new one) never duplicates entries.
export function migrateToSystems(state: Record<string, unknown>): void {
  const systems = Array.isArray(state.systems) ? (state.systems as unknown[]).filter(isPlainObject) : [];
  const ids = new Set(systems.map(system => String(system.id)));
  const add = (system: Record<string, unknown> & { id: string }) => {
    if (!ids.has(system.id)) {
      ids.add(system.id);
      systems.push(system);
    }
  };
  const list = (value: unknown) => (Array.isArray(value) ? (value as unknown[]) : []).filter(isPlainObject);

  list(state.logbook).forEach(entry => {
    const solution =
      Array.isArray(entry.glyphSolution) && entry.glyphSolution.length
        ? `Harmonic Camp solution: ${entry.glyphSolution.join(', ')}`
        : '';
    add({
      id: String(entry.id),
      name: entry.system || entry.title,
      tags: [LOGBOOK_TYPE_TAGS[String(entry.type)] || tagSlug(entry.type || 'note')],
      notes: [entry.notes || entry.details, solution].filter(Boolean).join('\n')
    });
  });
  list(isPlainObject(state.outlaw) ? state.outlaw.stations : undefined).forEach(station => {
    add({
      id: String(station.id),
      name: station.system || station.name,
      galaxy: station.galaxy,
      glyphs: station.glyphs,
      conflict: 'pirate',
      tags: [OUTLAW_TAG],
      notes: [
        station.system && station.name !== station.system ? `Station: ${String(station.name)}` : '',
        station.notes
      ]
        .filter(Boolean)
        .join('\n'),
      visits: station.visits
    });
  });

  delete state.logbook;
  if (isPlainObject(state.outlaw)) delete state.outlaw.stations;
  state.systems = systems.map(normalizeSystem);
}

export function lastVisit(system: System): Visit | undefined {
  return system.visits[system.visits.length - 1];
}

export function systemHaystack(system: System): string {
  return [
    system.name,
    system.region,
    system.galaxy,
    system.economy,
    system.notes,
    system.glyphs,
    system.race ? RACES[system.race] : undefined,
    system.star ? STAR_CLASSES[system.star].label : undefined,
    ...system.tags,
    ...system.planets.flatMap(planet => [
      planet.name,
      planet.biome,
      planet.descriptor,
      planet.weather,
      planet.notes,
      ...planet.tags,
      ...planet.resources
    ]),
    ...system.visits.map(visit => visit.note)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

// The header search's "Your systems": every word typed must appear somewhere in the system.
export function searchSystems(systems: System[], query: string): System[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return systems.filter(system => {
    const haystack = systemHaystack(system);
    return tokens.every(token => haystack.includes(token));
  });
}

export function systemTags(system: System): Set<string> {
  return new Set([...system.tags, ...system.planets.flatMap(planet => planet.tags)]);
}

export function packetsLogged(system: System): number {
  return system.visits.reduce((sum, visit) => sum + (Number(visit.packets) || 0), 0);
}

// An outlaw station is ready once `restockHours` have passed since its last visit with packets.
export function outlawStatus(system: Pick<System, 'visits'>, restockHours: number, now = Date.now()): OutlawStatus {
  const last = [...system.visits].reverse().find(visit => visit.packets);
  if (!last) return { ready: true, tone: 'new', label: 'Never run', readyAt: 0 };
  const readyAt = Date.parse(last.at) + restockHours * HOUR_MS;
  const wait = readyAt - now;
  return wait <= 0
    ? { ready: true, tone: 'ready', label: 'Ready', readyAt }
    : { ready: false, tone: 'wait', label: `Ready in ${formatDuration(wait)}`, readyAt };
}

// Ready first (never run, then longest since the last run); restocking by soonest ready.
export function rankOutlaw(
  systems: System[],
  restockHours: number,
  now = Date.now()
): { system: System; status: OutlawStatus }[] {
  return systems
    .filter(system => system.tags.includes(OUTLAW_TAG))
    .map(system => ({ system, status: outlawStatus(system, restockHours, now) }))
    .sort(
      (a, b) =>
        Number(b.status.ready) - Number(a.status.ready) ||
        a.status.readyAt - b.status.readyAt ||
        a.system.name.localeCompare(b.system.name)
    );
}
