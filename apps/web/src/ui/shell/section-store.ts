// Which section of the main page is open, kept in the URL hash (#home, #systems, #book3, …). The sections are shells
// in index.html, one per screen, and only the open one is shown; every screen stays mounted (the header search reads
// the hidden books). Features react to a section opening through onSection().
import { useSyncExternalStore } from 'react';

const hooks = new Map<string, () => void>();
export function onSection(key: string, run: () => void): void {
  hooks.set(key, run);
}

// From lg a detail screen sits beside its list (design/desktop-direction): which list each belongs to. theme.css lays
// out the panes from body[data-pane].
const LIST_OF: Record<string, string> = {
  systems: 'systems',
  system: 'systems',
  planet: 'systems',
  gear: 'gear',
  ship: 'gear',
  notes: 'notes',
  note: 'notes',
  runs: 'runs',
  outlaw: 'runs',
  guides: 'guides'
};
const listOf = (section: string): string => LIST_OF[section] ?? (section.startsWith('book') ? 'guides' : '');

let current = '';
let param = ''; // what follows the section in the hash: #system/<id> opens System detail for <id>
const listeners = new Set<() => void>();
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useSection(): string {
  return useSyncExternalStore(subscribe, () => current);
}
export function useSectionParam(): string {
  return useSyncExternalStore(subscribe, () => param);
}

// Back from a screen opened inside the app goes where the player came from; opened from a link or a reload (nothing of
// ours to go back to), it goes to `fallback`.
let navigated = false;
export function goBack(fallback: string): void {
  if (navigated) history.back();
  else location.hash = `#${fallback}`;
}

// Old and shortcut addresses: the Logbook was folded into Systems; #new-system (a home-screen shortcut) opens Home
// with the editor, #search (the Codex page's search key) opens Home with the search, and #sync (where a pairing link
// lands) opens Settings with the Sync sheet; anything unknown opens Home.
// A screen for one thing carries its id after a slash (#system/<id>, #ship/<id>, #note/<id>, #plan/<item>); without one it falls
// back to its list.
const SHORTCUTS = new Set(['new-system', 'search']);
// The section a parameter belongs to, and where the address goes without one (#map is the chain, #map/<galaxy> one).
const PARAM_SECTIONS: Record<string, string> = {
  system: 'systems',
  planet: 'systems', // #planet/<system>/<planet>: a planet's own view (36)
  ship: 'gear',
  note: 'notes',
  plan: 'calculators',
  map: 'map',
  cards: 'cards'
};
function resolve(key: string): { section: string; shortcut: string; param: string } {
  const [head = '', ...rest] = key.split('/');
  if (head in PARAM_SECTIONS) {
    const id = decodeURIComponent(rest.join('/'));
    return id
      ? { section: head, shortcut: '', param: id }
      : { section: PARAM_SECTIONS[head] ?? 'home', shortcut: '', param: '' };
  }
  if (key === 'logbook') return { section: 'systems', shortcut: '', param: '' };
  if (SHORTCUTS.has(key)) return { section: 'home', shortcut: key, param: '' };
  if (key === 'sync') return { section: 'more', shortcut: key, param: '' }; // Settings, with the Sync sheet open
  return { section: document.getElementById(`sec-${key}`) ? key : 'home', shortcut: '', param: '' };
}

// Resolves once the section is on screen (after the view transition's swap), so a caller can scroll within it.
export function showSection(key: string): Promise<void> {
  if (key === 'wiki') {
    location.href = 'wiki/'; // the Codex is its own page
    return Promise.resolve();
  }
  const { section, shortcut, param: next } = resolve(key);
  const swap = () => {
    document.body.dataset.pane = listOf(section);
    document.body.dataset.section = section; // for styles that differ by screen (theme.css: Home's header)
    document.querySelectorAll('.book-section').forEach(element => {
      element.classList.toggle('hidden', element.id !== `sec-${section}`);
    });
    window.scrollTo({ top: 0 });
  };
  const animate =
    current !== '' &&
    (current !== section || param !== next) &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Switching again mid-animation skips the transition, which rejects its promises; the DOM still updates, so the
  // rejection is expected and must not surface as an uncaught error.
  let shown = Promise.resolve();
  if (animate && 'startViewTransition' in document) {
    const transition = document.startViewTransition(swap);
    transition.ready.catch(() => undefined);
    shown = transition.updateCallbackDone.catch(() => undefined);
  } else swap();
  current = section;
  param = next;
  listeners.forEach(listener => {
    listener();
  });
  // Each part of a parameter is encoded on its own, so #planet/<system>/<planet> keeps its slash.
  const hash = `#${section}${next ? `/${next.split('/').map(encodeURIComponent).join('/')}` : ''}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
  if (shortcut) hooks.get(shortcut)?.();
  hooks.get(section)?.();
  return shown;
}

// Back/forward and home-screen shortcuts (./#calculators) change only the hash.
export function startSections(): void {
  window.addEventListener('hashchange', () => {
    navigated = true;
    void showSection(location.hash.slice(1) || 'home');
  });
  void showSection(location.hash.slice(1) || 'home');
}
