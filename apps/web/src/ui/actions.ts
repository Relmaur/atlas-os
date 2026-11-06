// Store actions shared by React screens: mutate the live state, save, and confirm to the person.
import type { OutlawSettings } from '@atlas/core/state';
import { newId, normalizePlanetScan, normalizeSystem, tagSlug, type System } from '@atlas/core/systems-model';
import { clampOutlawSetting } from '@atlas/core/outlaw';
import { MAX_SESSIONS, type PastSession } from '@atlas/core/session';
import { MAX_TIMER_MS, type Timer, type TimerKind } from '@atlas/core/timers';
import type { ParsedOutlawSystem } from '@atlas/core/systems-list';
import { normalizeGear, type GearItem } from '@atlas/core/gear';
import { normalizeRuns, type PlayerRun } from '@atlas/core/runs';
import { MAX_NOTE_CHARS, linkNotes, noteFromMarkdown, normalizeNotes, systemPin, type Note } from '@atlas/core/notes';
import { appState, saveAppState } from '../app/store.ts';
import { showToast, haptic } from '../app/ui.ts';

const find = (id: string) => appState.systems.find(candidate => candidate.id === id);

export function logVisit(id: string, { note = '', packetRun = false } = {}): void {
  const system = find(id);
  if (!system) return;
  system.visits.push({
    at: new Date().toISOString(),
    ...(note ? { note } : {}),
    ...(packetRun ? { packets: appState.outlaw.packetsPerVisit } : {})
  });
  haptic();
  saveAppState();
  showToast(`Logged a visit to ${system.name}.`);
}

// Adds or replaces a system from the editor; a new one can log the arrival in the same step.
export function saveSystem(system: System, { arrived = false } = {}): void {
  const index = appState.systems.findIndex(item => item.id === system.id);
  if (index === -1) {
    if (arrived) system.visits.push({ at: new Date().toISOString() });
    appState.systems.push(system);
  } else {
    appState.systems[index] = system;
  }
  saveAppState();
  showToast(index === -1 ? `Added ${system.name}.` : `Saved ${system.name}.`);
}

export function deleteSystem(id: string): void {
  const system = find(id);
  appState.systems = appState.systems.filter(item => item.id !== id);
  // Its linked notes stay, unlinked: they're the player's writing, not part of the system.
  const pin = systemPin(id);
  appState.notes = appState.notes.map(note =>
    note.pins.includes(pin) ? { ...note, pins: note.pins.filter(item => item !== pin) } : note
  );
  saveAppState();
  showToast(`Deleted ${system?.name ?? 'system'}.`);
}

export function toggleFavorite(id: string): void {
  const system = find(id);
  if (!system) return;
  system.favorite = !system.favorite;
  saveAppState();
}

// Tapping the current rating again clears it.
export function setRating(id: string, rating: number): void {
  const system = find(id);
  if (!system) return;
  system.rating = system.rating === rating ? 0 : rating;
  saveAppState();
}

// Saves notes typed in the panel. Returns whether they reached storage, for the "Saved" / "Not saved" label.
export function saveNotes(id: string, notes: string): boolean {
  const system = find(id);
  if (!system || system.notes === notes) return true;
  system.notes = notes;
  return saveAppState();
}

export interface PlanetFields {
  name: string;
  biome: string;
  tags: string;
  notes: string;
  /** The scan, as the form's fields hold it: words, a comma-separated resource list, a temperature in °C. */
  scan?: Partial<
    Record<
      | 'descriptor'
      | 'body'
      | 'weather'
      | 'sentinels'
      | 'flora'
      | 'fauna'
      | 'abundance'
      | 'resources'
      | 'temperature'
      | 'discoveredBy'
      | 'discoveredOn'
      | 'discoveredTime',
      string
    >
  >;
}
export function savePlanet(systemId: string, planetId: string | null, fields: PlanetFields): void {
  const system = find(systemId);
  const name = fields.name.trim();
  if (!system || !name) return;
  const values = {
    name,
    biome: fields.biome.trim(),
    tags: [...new Set(fields.tags.split(',').map(tagSlug).filter(Boolean))],
    notes: fields.notes.trim(),
    // A save without the scan (an older caller) leaves the planet's scan as it was.
    ...(fields.scan &&
      normalizePlanetScan({
        ...fields.scan,
        resources: (fields.scan.resources ?? '').split(',').map(item => item.trim()),
        // "-60,8" is how half the world writes -60.8; an empty field is "not logged", never 0.
        temperature: fields.scan.temperature?.trim()
          ? Number(fields.scan.temperature.replace(',', '.').replace('−', '-'))
          : null
      }))
  };
  const planet = system.planets.find(item => item.id === planetId);
  if (planet) Object.assign(planet, values);
  else system.planets.push({ id: newId('pl'), ...normalizePlanetScan({}), ...values });
  saveAppState();
}

export function deletePlanet(systemId: string, planetId: string): void {
  const system = find(systemId);
  if (!system) return;
  system.planets = system.planets.filter(planet => planet.id !== planetId);
  saveAppState();
}

export function deleteVisit(systemId: string, index: number): void {
  find(systemId)?.visits.splice(index, 1);
  saveAppState();
}

export function logPacketRun(id: string): void {
  const system = find(id);
  if (!system) return;
  system.visits.push({ at: new Date().toISOString(), packets: appState.outlaw.packetsPerVisit });
  haptic();
  saveAppState();
  showToast(`Logged ${system.name}. Ready again in ${appState.outlaw.restockHours}h.`);
}

// One timestamp for the whole run, so the stations restock together.
export function logOutlawRun(systems: System[]): void {
  const at = new Date().toISOString();
  systems.forEach(system => system.visits.push({ at, packets: appState.outlaw.packetsPerVisit }));
  haptic([12, 60, 12]);
  saveAppState();
  showToast(`Logged a run of ${systems.length} stations.`);
}

// A run is its start time; the stations it covers are the packet runs logged from now on (@atlas/core/outlaw).
export function startOutlawRun(): void {
  appState.outlaw.runStartedAt = new Date().toISOString();
  haptic();
  saveAppState();
}

export function endOutlawRun(): void {
  delete appState.outlaw.runStartedAt;
  saveAppState();
  showToast('Run ended.');
}

export function undoPacketRun(id: string): void {
  const system = find(id);
  if (!system) return;
  const index = system.visits.findLastIndex(visit => visit.packets);
  if (index !== -1) system.visits.splice(index, 1);
  saveAppState();
  showToast(`Removed the last run at ${system.name}.`);
}

// Returns the value kept, after rounding and bounds, so the input can show it.
export function setOutlawSetting(key: keyof OutlawSettings, value: string): number {
  const next = clampOutlawSetting(key, value);
  if (appState.outlaw[key] !== next) {
    appState.outlaw[key] = next;
    saveAppState();
  }
  return next;
}

export function addOutlawSystems(parsed: ParsedOutlawSystem[]): void {
  parsed.forEach(item => appState.systems.push(normalizeSystem({ ...item, id: newId('sys') })));
  saveAppState();
  showToast(`Added ${parsed.length} outlaw system${parsed.length === 1 ? '' : 's'}.`);
}

// A guide checklist step: ticked or not, saved with the rest of the log.
export function toggleChecklist(id: string): void {
  appState.checklists[id] = !appState.checklists[id];
  saveAppState();
}

// A play session: started when you sit down to play; ending it files it with the past ones and returns it, and
// Resume (from the recap) undoes an End tapped by mistake.
export function startSession(): void {
  appState.session = { startedAt: new Date().toISOString(), timersDone: 0 };
  haptic();
  saveAppState();
}

export function endSession(): PastSession | null {
  const { session } = appState;
  if (!session) return null;
  const ended = { ...session, endedAt: new Date().toISOString() };
  appState.sessions = [...appState.sessions, ended].slice(-MAX_SESSIONS);
  appState.session = null;
  saveAppState();
  return ended;
}

export function resumeSession(ended: PastSession): void {
  appState.sessions = appState.sessions.filter(
    session => !(session.startedAt === ended.startedAt && session.endedAt === ended.endedAt)
  );
  appState.session = { startedAt: ended.startedAt, timersDone: ended.timersDone };
  saveAppState();
}

export function addTimer(kind: TimerKind, label: string, durationMs: number): void {
  if (!(durationMs > 0 && durationMs <= MAX_TIMER_MS)) {
    showToast('A timer can run up to 30 days.');
    return;
  }
  const now = Date.now();
  appState.timers.push({
    id: newId('timer'),
    kind,
    label,
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + durationMs).toISOString(),
    alerted: false
  });
  haptic();
  saveAppState();
  showToast(`Timer set: ${label}.`);
}

export function dismissTimer(id: string): void {
  appState.timers = appState.timers.filter(timer => timer.id !== id);
  saveAppState();
}

// Marks finished timers as announced (and counts them toward the session in progress). Returns those it marked, so
// a timer finishing while two tabs are open is announced by one of them.
export function markAlerted(ids: string[]): Timer[] {
  const marked = appState.timers.filter(timer => ids.includes(timer.id) && !timer.alerted);
  if (!marked.length) return [];
  for (const timer of marked) timer.alerted = true;
  // Only timers that finished during the session count toward it (an imported backup can carry older ones).
  const { session } = appState;
  if (session)
    session.timersDone += marked.filter(timer => Date.parse(timer.endsAt) >= Date.parse(session.startedAt)).length;
  saveAppState();
  return marked;
}

// The player's ships and Multi-Tools: added or replaced from the editor.
export function saveGear(item: GearItem): void {
  const [clean] = normalizeGear([item]);
  if (!clean) return;
  const index = appState.gear.findIndex(existing => existing.id === clean.id);
  if (index === -1) appState.gear.push(clean);
  else appState.gear[index] = clean;
  saveAppState();
  showToast(index === -1 ? `Added ${clean.name}.` : `Saved ${clean.name}.`);
}

export function deleteGear(id: string): void {
  const item = appState.gear.find(existing => existing.id === id);
  appState.gear = appState.gear.filter(existing => existing.id !== id);
  saveAppState();
  showToast(`Deleted ${item?.name ?? 'it'}.`);
}

export function saveRun(run: PlayerRun): void {
  const [clean] = normalizeRuns([run]);
  if (!clean) return;
  const index = appState.runs.findIndex(existing => existing.id === clean.id);
  if (index === -1) appState.runs.push(clean);
  else appState.runs[index] = clean;
  saveAppState();
  showToast(index === -1 ? `Added ${clean.name}.` : `Saved ${clean.name}.`);
}

export function deleteRun(id: string): void {
  const run = appState.runs.find(existing => existing.id === id);
  appState.runs = appState.runs.filter(existing => existing.id !== id);
  saveAppState();
  showToast(`Deleted ${run?.name ?? 'the run'}.`);
}

// The notes linked to a ship, Multi-Tool or Exosuit (its Linked notes): exactly `ids`, saved with the gear itself.
export function linkGearNotes(gearId: string, ids: string[]): void {
  const next = linkNotes(appState.notes, gearId, ids);
  if (next.every((note, i) => note === appState.notes[i])) return;
  appState.notes = next;
  saveAppState();
}

// The note screen saves as the player writes (design 11 has no Save button), so this is quiet; false means it wasn't
// stored (an empty note, or storage refused it) and the screen says so.
export function saveNote(note: Note): boolean {
  const [clean] = normalizeNotes([{ ...note, updatedAt: new Date().toISOString() }]);
  if (!clean) return false;
  const index = appState.notes.findIndex(existing => existing.id === clean.id);
  if (index === -1) appState.notes.push(clean);
  else appState.notes[index] = clean;
  return saveAppState();
}

export function deleteNote(id: string): void {
  const note = appState.notes.find(existing => existing.id === id);
  appState.notes = appState.notes.filter(existing => existing.id !== id);
  saveAppState();
  showToast(`Deleted “${note?.title ?? 'note'}”.`);
}

const MAX_IMPORT_BYTES = 1_000_000;

// Markdown files → notes (the first # heading is each title). A file too big or unreadable is skipped and named.
export async function importNoteFiles(files: File[]): Promise<void> {
  const now = new Date().toISOString();
  const added: Note[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('too big');
      const { title, body } = noteFromMarkdown(await file.text(), file.name);
      if (body.length >= MAX_NOTE_CHARS) throw new Error('too long');
      added.push({ id: newId('note'), title, body, pins: [], tags: [], createdAt: now, updatedAt: now });
    } catch {
      skipped.push(file.name);
    }
  }
  if (added.length) {
    appState.notes.push(...normalizeNotes(added));
    saveAppState();
  }
  showToast(
    [
      added.length ? `Imported ${String(added.length)} note${added.length === 1 ? '' : 's'}.` : '',
      skipped.length ? `Skipped ${skipped.join(', ')} (over 1 MB or unreadable).` : ''
    ]
      .filter(Boolean)
      .join(' ')
  );
}
