// App state: defaults, layered merge and migrations (pure, no DOM). Shape: docs/state-schema.md.
import { isPlainObject } from './util.ts';
import { migrateToSystems, type System } from './systems-model.ts';
import { normalizeTimers, type Timer } from './timers.ts';
import { normalizeSession, normalizeSessions, type PastSession, type Session } from './session.ts';
import { gearFromFleet, normalizeGear, type GearItem } from './gear.ts';
import { normalizeNotes, type Note } from './notes.ts';
import { normalizeDevices, type SyncDevice } from './devices.ts';
import { normalizeRuns, type PlayerRun } from './runs.ts';

export interface OutlawSettings {
  restockHours: number;
  packetsPerVisit: number;
  runSize: number;
  unitsPerPacket: number;
  nanitesPerPacket: number;
}
// The state after buildState(): the keys the app reads always exist with these types. Other keys (from newer
// exports, or the pre-3.14 fleet notes) are carried along untouched.
export interface AppState {
  [key: string]: unknown;
  meta: { version?: string; lastUpdated?: string; currentPhase?: string; [key: string]: unknown };
  fleet: Record<string, unknown>;
  checklists: Record<string, boolean>;
  outlaw: OutlawSettings & { runStartedAt?: string } & Record<string, unknown>; // runStartedAt: the run in progress
  systems: System[];
  timers: Timer[];
  session: Session | null; // the play session in progress
  sessions: PastSession[];
  gear: GearItem[]; // the player's ships and Multi-Tools
  notes: Note[]; // the player's own Markdown notes
  devices: SyncDevice[]; // the devices that sync this log, each written by itself
  runs: PlayerRun[]; // runs the player made (Outlaw stations is built in)
  accounts: string[]; // the names the player plays under (3.29): "Discovered by" offers them as Me
}
const OUTLAW_KEYS = ['restockHours', 'packetsPerVisit', 'runSize', 'unitsPerPacket', 'nanitesPerPacket'] as const;

// Mirrors the repo's nms_state.json; used when that file can't be fetched (offline on a first visit). A new player's
// starting point: nothing from anyone's own save (their ships, notes and progress are theirs to add).
export const DEFAULT_STATE = {
  meta: {
    version: '2.0.0',
    platforms: ['PC', 'Mac', 'Switch', 'iOS']
  },
  fleet: {},
  checklists: {},
  outlaw: {
    restockHours: 24,
    packetsPerVisit: 15,
    runSize: 5,
    unitsPerPacket: 75000, // your own in-game averages, not game data
    nanitesPerPacket: 350
  },
  systems: []
};

// Objects merge key-by-key; arrays and scalars from `patch` replace those in `base`.
export function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown>;
export function deepMerge(base: unknown, patch: unknown): unknown;
export function deepMerge(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return structuredClone(patch);
  const merged: Record<string, unknown> = { ...base };
  Object.keys(patch).forEach(key => {
    if (key === '__proto__') return; // JSON.parse makes it an own key; assigning it would swap the object's prototype
    merged[key] = deepMerge(base[key], patch[key]);
  });
  return merged;
}

// Named for the app and the moment, in the player's own time, so backups sort by date and none overwrites another.
export function exportFileName(at: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  const day = `${String(at.getFullYear())}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
  return `atlas_os_${day}_${two(at.getHours())}-${two(at.getMinutes())}-${two(at.getSeconds())}.json`;
}

// Pre-2.0 shape ({ checkedItems, logEntries }) → nms_state.json shape.
export function migrateLegacyState(legacy: Record<string, unknown>): Record<string, unknown> {
  if (!('checkedItems' in legacy) && !('logEntries' in legacy)) return legacy;
  return {
    meta: { lastUpdated: legacy.lastUpdated },
    checklists: legacy.checkedItems || {},
    logbook: (Array.isArray(legacy.logEntries) ? (legacy.logEntries as unknown[]) : [])
      .filter(isPlainObject)
      .map(entry => ({
        id: String(entry.id),
        system: entry.title,
        type: entry.category,
        glyphSolution: [],
        notes: entry.details
      }))
  };
}

export const MAX_ACCOUNTS = 8;
/** The player's game accounts as typed, trimmed, without repeats (any case counts as one), in their order. */
export function normalizeAccounts(value: unknown): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    const name = typeof item === 'string' ? item.trim().slice(0, 60) : '';
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names.slice(0, MAX_ACCOUNTS);
}

export function buildState(...layers: unknown[]): AppState {
  const state = layers
    .filter(isPlainObject)
    .reduce<Record<string, unknown>>((merged, layer) => deepMerge(merged, layer), structuredClone(DEFAULT_STATE));
  if (!isPlainObject(state.meta)) state.meta = structuredClone(DEFAULT_STATE.meta);
  if (!isPlainObject(state.fleet)) state.fleet = {};
  if (!isPlainObject(state.checklists)) state.checklists = {};
  if (!isPlainObject(state.outlaw)) state.outlaw = structuredClone(DEFAULT_STATE.outlaw);
  migrateToSystems(state); // folds old logbook[] / outlaw.stations[] into systems[]
  // Added in 3.9.0: older documents have none, and a damaged entry is dropped rather than the document.
  state.timers = normalizeTimers(state.timers);
  state.session = normalizeSession(state.session);
  state.sessions = normalizeSessions(state.sessions);
  // Added in 3.14.0: a log without gear gets its old fleet notes as records, once (an emptied list stays empty).
  state.gear = state.gear === undefined || state.gear === null ? gearFromFleet(state.fleet) : normalizeGear(state.gear);
  state.notes = normalizeNotes(state.notes);
  state.devices = normalizeDevices(state.devices); // added in the redesign: a log from before has none
  state.runs = normalizeRuns(state.runs); // added in the redesign; a damaged run is dropped, not the log
  state.accounts = normalizeAccounts(state.accounts); // added in 3.29: a log from before has none
  const outlaw = state.outlaw as Record<string, unknown>; // made an object two lines up; migrateToSystems keeps it one
  for (const key of OUTLAW_KEYS) {
    const value = Number(outlaw[key]);
    outlaw[key] = value > 0 ? value : DEFAULT_STATE.outlaw[key];
  }
  // Added in the redesign: the start of the outlaw run in progress. Anything but a time means no run.
  if (typeof outlaw.runStartedAt !== 'string' || Number.isNaN(Date.parse(outlaw.runStartedAt)))
    delete outlaw.runStartedAt;
  // Every key AppState promises was checked or filled in above; documents were validated before merging.
  return state as AppState;
}

export function stateTimestamp(state: unknown): number {
  const meta = isPlainObject(state) ? state.meta : undefined;
  return (isPlainObject(meta) && typeof meta.lastUpdated === 'string' && Date.parse(meta.lastUpdated)) || 0;
}
