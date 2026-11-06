// Screen state that several screens share: the system editor's panel (Home, Systems, System detail and the header
// search open it) and the Systems filter (a tag tapped in the panel filters the list). It isn't saved:
// unlike the app state, it lasts only while the page is open.
import { useSyncExternalStore } from 'react';
import { DEFAULT_FILTER, type SystemFilter } from '@atlas/core/systems-list';
import type { System } from '@atlas/core/systems-model';
import { appState, onAdopt } from '../../app/store.ts';
import { showToast } from '../../app/ui.ts';
import { showSection } from '../shell/section-store.ts';

// `way` opens the editor at Location with that way picked (03d's buttons, 01b's "Add its address").
export type EditorPreset = Partial<Pick<System, 'tags' | 'conflict'>> & { way?: 'photo' | 'booster' | 'written' };
export interface PanelState {
  open: boolean;
  mode: 'view' | 'edit';
  systemId: string | null; // null in the editor means a new system
  preset: EditorPreset;
  session: number; // changes on every open, so drafts and scroll position start fresh
}

let panel: PanelState = { open: false, mode: 'view', systemId: null, preset: {}, session: 0 };
let filter: SystemFilter = DEFAULT_FILTER;

const listeners = new Set<() => void>();
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function setPanel(next: Partial<PanelState>): void {
  panel = { ...panel, ...next };
  listeners.forEach(listener => {
    listener();
  });
}

export const findSystem = (id: string | null): System | undefined =>
  id ? appState.systems.find(system => system.id === id) : undefined;

// What had focus when the panel opened (closed → open only: moving between view and editor keeps it), so closing
// hands focus back there instead of to the page's top.
let returnFocus: HTMLElement | null = null;
function rememberOpener(): void {
  if (!panel.open) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
}
export function takeReturnFocus(): HTMLElement | null {
  const element = returnFocus;
  returnFocus = null;
  return element;
}

// System detail is a screen of its own (design 03): opening a system navigates to #system/<id>, so Back returns to
// where the player was. The panel is only the editor now.
export function openSystem(id: string): void {
  if (!findSystem(id)) return;
  closeSystemPanel();
  location.hash = `#system/${encodeURIComponent(id)}`;
}

export function openSystemEditor(id: string | null = null, preset: EditorPreset = {}): void {
  const existing = findSystem(id);
  rememberOpener();
  setPanel({ open: true, mode: 'edit', systemId: existing?.id ?? null, preset, session: panel.session + 1 });
}

export function closeSystemPanel(): void {
  if (panel.open) setPanel({ open: false });
}

// A swipe or a tap on the sheet's bar asks first: the editor refuses while it has unsaved changes (and says so), so
// a stray swipe never loses a draft. Cancel and Esc are explicit, and don't ask.
let closeGuard: (() => boolean) | null = null;
export function setCloseGuard(guard: (() => boolean) | null): void {
  closeGuard = guard;
}
export function dismissSystemPanel(): boolean {
  if (closeGuard && !closeGuard()) return false;
  closeSystemPanel();
  return true;
}

export const getPanel = (): PanelState => panel;

export function usePanel(): PanelState {
  return useSyncExternalStore(subscribe, getPanel);
}

export function setSystemFilter(changes: Partial<SystemFilter>): void {
  filter = { ...filter, ...changes };
  listeners.forEach(listener => {
    listener();
  });
}

export function useSystemFilter(): SystemFilter {
  return useSyncExternalStore(subscribe, () => filter);
}

export function filterByTag(tag: string): void {
  closeSystemPanel();
  setSystemFilter({ tags: [tag] });
  void showSection('systems');
}

// Another tab deleted the system on show. Saving an open edit would bring it back, so the editor closes and says why.
onAdopt(() => {
  if (!panel.open || !panel.systemId || findSystem(panel.systemId)) return;
  if (panel.mode === 'edit') showToast('That system was deleted in another tab.');
  closeSystemPanel();
});
