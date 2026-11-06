// Whether the desktop nav is open as a sidebar (round 6, d02) or closed to its rail (d01). It's a preference of this
// device, not part of the log, so it lives in its own localStorage key and never syncs. Ctrl+\ (⌘\ on a Mac) toggles
// it; body[data-nav] lets theme.css push the panes aside.
import { useSyncExternalStore } from 'react';

const KEY = 'atlas_nav_open';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false; // storage blocked: the rail, as on a first visit
  }
}
let open = read();

function apply(): void {
  document.body.dataset.nav = open ? 'open' : 'closed';
}

export function setNavOpen(next: boolean): void {
  open = next;
  try {
    localStorage.setItem(KEY, next ? '1' : '0');
  } catch {
    // Not remembered on this device; it still opens now.
  }
  apply();
  listeners.forEach(listener => {
    listener();
  });
}
export const toggleNav = (): void => {
  setNavOpen(!open);
};

export function useNavOpen(): boolean {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open
  );
}

/** Sets body[data-nav] and listens for Ctrl+\; returns the cleanup. */
export function startNav(): () => void {
  apply();
  const onKey = (event: KeyboardEvent) => {
    if (event.key === '\\' && (event.ctrlKey || event.metaKey) && !event.altKey) {
      event.preventDefault();
      toggleNav();
    }
  };
  document.addEventListener('keydown', onKey);
  return () => {
    document.removeEventListener('keydown', onKey);
  };
}
