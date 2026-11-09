// Map options (round 7b, c18): how the galaxy map colours its dots and whether it draws the trail. A preference of
// this device, like the sidebar's open state: its own localStorage key, one setting for every galaxy, never in the
// log, sync or an export. Also whether the options are open, since the gear (phone header), the button (desktop
// pane header) and the chip on the map all open the same thing.
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

const KEY = 'atlas_map_options';

export const MapOptionsSchema = z.object({
  colour: z.enum(['star', 'race', 'bases']).catch('star'),
  trail: z.boolean().catch(true)
});
export type MapOptions = z.infer<typeof MapOptionsSchema>;
export const DEFAULT_MAP_OPTIONS: MapOptions = { colour: 'star', trail: true };

function read(): MapOptions {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_MAP_OPTIONS;
    const parsed = MapOptionsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_MAP_OPTIONS;
  } catch {
    return DEFAULT_MAP_OPTIONS; // storage blocked or unreadable: the default look
  }
}

let options = read();
let open = false;
const listeners = new Set<() => void>();
const emit = () => {
  listeners.forEach(listener => {
    listener();
  });
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setMapOptions(changes: Partial<MapOptions>): void {
  options = { ...options, ...changes };
  try {
    localStorage.setItem(KEY, JSON.stringify(options));
  } catch {
    // Not remembered on this device; the map still changes now.
  }
  emit();
}
export const resetMapOptions = (): void => {
  setMapOptions(DEFAULT_MAP_OPTIONS);
};

export const useMapOptions = (): MapOptions => useSyncExternalStore(subscribe, () => options);

export function setMapOptionsOpen(next: boolean): void {
  open = next;
  emit();
}
export const useMapOptionsOpen = (): boolean => useSyncExternalStore(subscribe, () => open);

/** What differs from the default, in the chip's words: "Race colours", "Bases only", "Trail off". */
export function changedOptions(o: MapOptions): string[] {
  return [
    o.colour === 'race' ? 'Race colours' : o.colour === 'bases' ? 'Bases only' : '',
    o.trail ? '' : 'Trail off'
  ].filter(Boolean);
}

/** The gear's and the button's name: "Map options", or "Map options, 2 changed". */
export const optionsLabel = (o: MapOptions): string => {
  const n = changedOptions(o).length;
  return n ? `Map options, ${String(n)} changed` : 'Map options';
};

/** Tests start from the default. */
export function resetMapOptionsForTests(): void {
  options = DEFAULT_MAP_OPTIONS;
  open = false;
}
