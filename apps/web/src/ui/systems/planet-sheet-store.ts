// The planet sheet (design 35, a right panel from lg: 37) is one sheet for the whole app: System detail opens it to
// add a planet, the planet's own view (36) opens it with the pencil. It isn't saved: it lasts while the page is open.
import { useSyncExternalStore } from 'react';

export interface PlanetSheetState {
  open: boolean;
  systemId: string | null;
  planetId: string | null; // null: a new planet
  session: number; // changes on every open, so the form starts fresh
}

let sheet: PlanetSheetState = { open: false, systemId: null, planetId: null, session: 0 };
const listeners = new Set<() => void>();
function set(next: Partial<PlanetSheetState>): void {
  sheet = { ...sheet, ...next };
  listeners.forEach(listener => {
    listener();
  });
}

export function openPlanetSheet(systemId: string, planetId: string | null): void {
  set({ open: true, systemId, planetId, session: sheet.session + 1 });
}
/** Closes the sheet; the planet stays set while it slides away, so its title doesn't flip mid-animation. */
export function closePlanetSheet(): void {
  set({ open: false });
}
export const getPlanetSheet = (): PlanetSheetState => sheet;
export function usePlanetSheet(): PlanetSheetState {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => sheet
  );
}

/** The planet's own view (36): #planet/<system>/<planet>. */
export const planetHref = (systemId: string, planetId: string): string =>
  `#planet/${encodeURIComponent(systemId)}/${encodeURIComponent(planetId)}`;
