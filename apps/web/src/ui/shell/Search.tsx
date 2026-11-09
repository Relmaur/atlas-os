// Search (design 19, with c07's sheet): your gear, notes and systems, Codex articles and the books, in one list driven
// from the keyboard (arrows, Enter, Esc; / or ⌘K to start). Chips scope it to one kind, with how many each holds. An
// empty field offers the quick actions and what was opened last. Below lg it fills the screen above the tab bar; from lg
// it floats beside the rail. Either way the search key opens it.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { search } from '@atlas/core/search';
import { searchSystems, systemMapped, type System } from '@atlas/core/systems-model';
import { gearOrder, type GearItem } from '@atlas/core/gear';
import { noteExcerpt, searchNotes, type Note } from '@atlas/core/notes';
import type { PreparedEntry } from '@atlas/core/search';
import { appState } from '../../app/store.ts';
import { Highlight, SourceBadge, categoryIcon } from '../codex/bits.tsx';
import { NotMappedTag, NotMappedText } from '../parts/RowTags.tsx';
import { StarDot } from '../parts/SystemBits.tsx';
import { openSystem, openSystemEditor } from '../systems/panel-store.ts';
import { findBookHits, flash, snippetAround, type BookHit } from './book-search.ts';
import { showSection } from './section-store.ts';
import { onWikiEntries, wikiEntries } from './wiki-index.ts';
import { readRecent, rememberRecent, type Recent } from './search-recent.ts';
import { KINDS } from '../gear/kinds.ts';
import { ClassPill, openGear } from '../gear/fleet-bits.tsx';
import { newNote, openNote } from '../notes/note-nav.ts';
import { useMedia } from '../parts/useMedia.ts';

// How many of each kind "All" shows; a chip scoped to one kind shows up to SCOPED.
const LIMIT = { gear: 3, notes: 4, systems: 5, codex: 6, guides: 6 } as const;
const SCOPED = 30;
const PHONE = '(max-width: 1023px)';

type Scope = 'all' | 'gear' | 'notes' | 'systems' | 'codex' | 'guides';
const SCOPES: [Scope, string][] = [
  ['all', 'All'],
  ['gear', 'Gear'],
  ['notes', 'Notes'],
  ['systems', 'Systems'],
  ['codex', 'Codex'],
  ['guides', 'Guides']
];
type Hit =
  | { type: 'gear'; item: GearItem }
  | { type: 'note'; note: Note }
  | { type: 'system'; system: System }
  | { type: 'wiki'; entry: PreparedEntry }
  | { type: 'book'; book: BookHit }
  | { type: 'action'; action: (typeof ACTIONS)[number] };
interface Results {
  query: string;
  tokens: string[];
  gear: GearItem[];
  notes: Note[];
  systems: System[];
  wiki: PreparedEntry[];
  books: BookHit[];
}
const EMPTY: Results = { query: '', tokens: [], gear: [], notes: [], systems: [], wiki: [], books: [] };

// The phone's full-screen search, opened from the tab bar's search key. Its look lives in theme.css on body.search-open
// (the header's backdrop-filter must go there, or it would become the fixed overlay's containing block). The class
// is set and the field focused within the tap itself, so iOS raises the keyboard.
let overlay = false;
const overlayListeners = new Set<() => void>();
function setOverlay(next: boolean): void {
  overlay = next;
  document.body.classList.toggle('search-open', next);
  document.body.classList.toggle('overflow-hidden', next);
  overlayListeners.forEach(listener => {
    listener();
  });
}
function subscribeOverlay(listener: () => void): () => void {
  overlayListeners.add(listener);
  return () => overlayListeners.delete(listener);
}
export const useSearchOpen = (): boolean => useSyncExternalStore(subscribeOverlay, () => overlay);
export function openSearch(): void {
  setOverlay(true);
  document.getElementById('globalSearchInput')?.focus();
}
/** The search key: opens the search, or closes it when it's open. */
export function toggleSearch(): void {
  if (overlay) setOverlay(false);
  else openSearch();
}

function find(query: string): Results {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { ...EMPTY, query };
  return {
    query,
    tokens,
    gear: gearOrder(appState.gear).filter(item => {
      const hay = [item.name, item.type, item.role, item.class, item.notes].join(' ').toLowerCase();
      return tokens.every(token => hay.includes(token));
    }),
    notes: searchNotes(appState.notes, query),
    systems: searchSystems(appState.systems, query),
    wiki: search(wikiEntries(), query).map(result => result.entry),
    books: findBookHits(tokens, SCOPED)
  };
}

// The hits shown for a scope, in the design's order: gear, notes, systems, the Codex, then the books.
function shown(results: Results, scope: Scope): Hit[] {
  const take = <T,>(list: T[], key: Exclude<Scope, 'all'>) =>
    scope === key ? list.slice(0, SCOPED) : scope === 'all' ? list.slice(0, LIMIT[key]) : [];
  return [
    ...take(results.gear, 'gear').map(item => ({ type: 'gear' as const, item })),
    ...take(results.notes, 'notes').map(note => ({ type: 'note' as const, note })),
    ...take(results.systems, 'systems').map(system => ({ type: 'system' as const, system })),
    ...take(results.wiki, 'codex').map(entry => ({ type: 'wiki' as const, entry })),
    ...take(results.books, 'guides').map(book => ({ type: 'book' as const, book }))
  ];
}
const count = (results: Results, scope: Scope): number =>
  scope === 'all'
    ? SCOPES.slice(1).reduce((sum, [key]) => sum + count(results, key), 0)
    : {
        gear: results.gear,
        notes: results.notes,
        systems: results.systems,
        codex: results.wiki,
        guides: results.books
      }[scope].length;

const recentOf = (hit: Exclude<Hit, { type: 'action' }>): Recent =>
  hit.type === 'gear'
    ? { type: 'gear', id: hit.item.id, title: hit.item.name }
    : hit.type === 'note'
      ? { type: 'note', id: hit.note.id, title: hit.note.title }
      : hit.type === 'system'
        ? { type: 'system', id: hit.system.id, title: hit.system.name }
        : hit.type === 'wiki'
          ? { type: 'wiki', id: hit.entry.path ?? '', title: hit.entry.title }
          : { type: 'book', id: hit.book.section, title: hit.book.title };
const RECENT_PLACE: Record<Recent['type'], string> = {
  gear: 'Fleet',
  note: 'Notes',
  system: 'Systems',
  wiki: 'Codex',
  book: 'Guides'
};
const RECENT_ICON: Record<Recent['type'], string> = {
  gear: 'ph-rocket',
  note: 'ph-file-text',
  system: 'ph-planet',
  wiki: 'ph-book-open',
  book: 'ph-book-open-text'
};
// A recent whose system, ship or note has since been deleted isn't offered.
const stillThere = (recent: Recent): boolean =>
  recent.type === 'gear'
    ? appState.gear.some(item => item.id === recent.id)
    : recent.type === 'note'
      ? appState.notes.some(note => note.id === recent.id)
      : recent.type === 'system'
        ? appState.systems.some(system => system.id === recent.id)
        : true;

function openRecent(recent: Recent): void {
  if (recent.type === 'gear') openGear(recent.id);
  else if (recent.type === 'note') openNote(recent.id);
  else if (recent.type === 'system') openSystem(recent.id);
  else if (recent.type === 'wiki') location.assign(`wiki/#/a/${encodeURIComponent(recent.id)}`);
  else void showSection(recent.id);
}

// What a player does most mid-session, one tap from the search key (c07).
const ACTIONS: { label: string; icon: string; tile: string; run: () => void }[] = [
  {
    label: 'Log this system',
    icon: 'ph-planet',
    tile: 'bg-[rgba(16,185,129,0.14)] text-ready-emerald-text',
    run: () => {
      openSystemEditor();
    }
  },
  {
    label: 'Start a timer',
    icon: 'ph-timer',
    tile: 'bg-scanner-cyan-tint text-scanner-cyan-text',
    run: () => {
      location.hash = '#session';
    }
  },
  {
    label: 'New note',
    icon: 'ph-note-pencil',
    tile: 'bg-[rgba(192,132,252,0.12)] text-[#e9d5ff]',
    run: () => {
      newNote();
    }
  },
  {
    label: 'Resume run',
    icon: 'ph-path',
    tile: 'bg-[rgba(251,191,36,0.1)] text-units-amber-pale',
    run: () => {
      location.hash = '#outlaw';
    }
  }
];

// The palette's groups from lg (d15): what you logged together, then the Codex, the books, and what you can do.
const DESK_GROUP: Record<Hit['type'], [key: string, label: string]> = {
  gear: ['log', 'Your log'],
  note: ['log', 'Your log'],
  system: ['log', 'Your log'],
  wiki: ['codex', 'Codex'],
  book: ['guides', 'Guides'],
  action: ['actions', 'Actions']
};
// The actions a typed search offers too, on the Workbench (d15), with what each starts.
const DESK_ACTIONS: [label: string, sub: string][] = [
  ['Log this system', 'Warped somewhere new'],
  ['Start a timer', 'Refiner, crops or your own'],
  ['New note', 'Markdown, linked to what you name']
];

export function Search() {
  const [results, setResults] = useState(EMPTY);
  const [scope, setScope] = useState<Scope>('all');
  const [focused, setFocused] = useState(false); // the panel, from md
  const phoneOverlay = useSearchOpen();
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const open = focused || phoneOverlay;
  const wide = useMedia('(min-width: 1024px)');

  const run = (query: string) => {
    setResults(find(query));
    setActive(-1);
    setFocused(true);
  };
  const close = () => {
    setOverlay(false);
    setFocused(false);
    input.current?.blur();
  };

  // The wiki index loads after the page does: a search typed before it arrives fills in its wiki results then.
  useEffect(
    () =>
      onWikiEntries(() => {
        setResults(current => (current.query.trim() ? find(current.query) : current));
        setActive(-1); // the Codex group lands ahead of the books, so the old position would point elsewhere
      }),
    []
  );

  // Widening the window past the phone layout leaves the overlay, and so does going anywhere (a tab, Back).
  useEffect(() => {
    if (!phoneOverlay) return;
    const phone = matchMedia(PHONE);
    const leave = () => {
      if (!phone.matches) setOverlay(false);
    };
    const away = () => {
      setOverlay(false);
    };
    phone.addEventListener('change', leave);
    window.addEventListener('hashchange', away);
    return () => {
      phone.removeEventListener('change', leave);
      window.removeEventListener('hashchange', away);
    };
  }, [phoneOverlay]);

  // / or ⌘K starts a search from anywhere; a tap outside closes the panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
      if ((event.key === '/' && !typing) || (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey))) {
        event.preventDefault();
        openSearch();
      }
    };
    const onDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || root.current?.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest('.search-key')) return; // the key toggles it itself
      setFocused(false);
      if (!matchMedia(PHONE).matches) setOverlay(false); // below lg the search fills the screen, so a tap can't be outside
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  });

  const { tokens } = results;
  // From lg there are no scope chips: everything, grouped, and the actions after (d15).
  const hits: Hit[] = wide
    ? [
        ...shown(results, 'all'),
        ...(tokens.length
          ? DESK_ACTIONS.flatMap(([label]) => {
              const action = ACTIONS.find(item => item.label === label);
              return action ? [{ type: 'action' as const, action }] : [];
            })
          : [])
      ]
    : shown(results, scope);
  const activate = (hit: Hit | undefined) => {
    if (!hit) return;
    const query = results.query;
    close();
    if (hit.type !== 'action') rememberRecent(recentOf(hit));
    if (hit.type === 'action') {
      hit.action.run();
      return;
    }
    if (hit.type === 'system') openSystem(hit.system.id);
    else if (hit.type === 'gear') openGear(hit.item.id);
    else if (hit.type === 'note') openNote(hit.note.id);
    else if (hit.type === 'wiki')
      location.assign(`wiki/#/a/${encodeURIComponent(hit.entry.path ?? '')}?q=${encodeURIComponent(query)}`);
    else {
      const { el } = hit.book;
      void showSection(hit.book.section).then(() => {
        flash(el);
      });
    }
  };

  const move = (step: number) => {
    if (!hits.length) return;
    const total = hits.length;
    const next = active < 0 && step < 0 ? total - 1 : (active + step + total) % total; // ArrowUp from none: the last
    setActive(next);
    document.getElementById(`search-hit-${String(next)}`)?.scrollIntoView({ block: 'nearest' });
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Tab' && wide && hits.length && !event.shiftKey) {
      // Tab: the first of the next group (d15), round to the first group after the last.
      event.preventDefault();
      const groupOf = (hit: Hit | undefined) => (hit ? DESK_GROUP[hit.type][0] : '');
      const from = groupOf(hits[Math.max(active, 0)]);
      let next = hits.findIndex((hit, i) => i > Math.max(active, 0) && groupOf(hit) !== from);
      if (next === -1) next = 0;
      setActive(next);
      document.getElementById(`search-hit-${String(next)}`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && hits.length) {
      event.preventDefault();
      activate(hits[Math.max(active, 0)]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  const option = (i: number, tile: ReactNode, title: ReactNode, sub: ReactNode, end?: ReactNode) => (
    <button
      key={i}
      type="button"
      id={`search-hit-${String(i)}`}
      role="option"
      aria-selected={i === active}
      onClick={() => {
        activate(hits[i]);
      }}
      className="search-hit"
    >
      {tile}
      <span className="min-w-0 flex-1 flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:gap-3">
        <span className="text-[14px] font-semibold text-ink-bright truncate lg:shrink-0 lg:max-w-[55%]">{title}</span>
        <span className="search-snippet text-caption text-ink-muted line-clamp-2 lg:line-clamp-1 lg:min-w-0">
          {sub}
        </span>
      </span>
      {end}
      {wide && i === active && (
        <kbd className="nav-kbd shrink-0" aria-hidden="true">
          ↵
        </kbd>
      )}
    </button>
  );
  const tile = (icon: string, lit = false) => (
    <span
      aria-hidden="true"
      className={`w-[34px] h-[34px] shrink-0 rounded-[10px] grid place-items-center text-[17px] border ${
        lit
          ? 'bg-scanner-cyan-tint border-scanner-cyan-edge text-scanner-cyan-pale'
          : 'bg-slate-ground border-control-edge text-scanner-cyan-pale'
      }`}
    >
      <i className={`ph-bold ${icon}`} />
    </span>
  );

  // One group per kind, each a labelled run of options; the Codex says so when it has nothing for a game term.
  const groups: ReactNode[] = [];
  let group: { key: string; label: string; rows: ReactNode[] } | null = null;
  const flush = () => {
    if (group)
      groups.push(
        <div key={group.key} role="group" aria-labelledby={`search-group-${group.key}`}>
          <p id={`search-group-${group.key}`} className="search-label">
            {group.label}
          </p>
          <div className="search-list">{group.rows}</div>
        </div>
      );
  };
  const into = (key: string, label: string) => {
    if (group?.key === key) return group.rows;
    flush();
    group = { key, label, rows: [] };
    return group.rows;
  };
  const intoFor = (hit: Hit, key: string, label: string) =>
    wide ? into(DESK_GROUP[hit.type][0], DESK_GROUP[hit.type][1]) : into(key, label);
  hits.forEach((hit, i) => {
    if (hit.type === 'action') {
      const sub = DESK_ACTIONS.find(([label]) => label === hit.action.label)?.[1] ?? '';
      intoFor(hit, 'actions', 'Actions').push(
        option(
          i,
          <span
            aria-hidden="true"
            className={`w-[34px] h-[34px] shrink-0 rounded-[10px] grid place-items-center ${hit.action.tile}`}
          >
            <i className={`ph-bold ${hit.action.icon} text-[17px]`} />
          </span>,
          hit.action.label,
          sub
        )
      );
    } else if (hit.type === 'gear') {
      const { item } = hit;
      intoFor(hit, 'gear', 'Ships & Multi-Tools').push(
        option(
          i,
          tile(KINDS[item.kind].icon, true),
          <Highlight text={item.name} tokens={tokens} />,
          [item.type, item.role].filter(Boolean).join(' · ') || KINDS[item.kind].label,
          <ClassPill value={item.class} />
        )
      );
    } else if (hit.type === 'note') {
      const { note } = hit;
      intoFor(hit, 'notes', 'Notes').push(
        option(
          i,
          tile('ph-file-text'),
          <Highlight text={note.title} tokens={tokens} />,
          <Highlight text={snippetAround(noteExcerpt(note, 2000), tokens[0] ?? '')} tokens={tokens} />
        )
      );
    } else if (hit.type === 'system') {
      const { system } = hit;
      intoFor(hit, 'systems', 'Systems').push(
        option(
          i,
          <span
            aria-hidden="true"
            className="w-[34px] h-[34px] shrink-0 rounded-[10px] grid place-items-center bg-slate-ground border border-control-edge"
          >
            <StarDot system={system} />
          </span>,
          <>
            <Highlight text={system.name} tokens={tokens} />
            {!systemMapped(system) && <NotMappedText what="system" />}
          </>,
          [system.region, ...system.tags].filter(Boolean).join(' · ') || system.galaxy,
          // Round 7c: on a one-line row the tag sits at the trailing end (19, Ctrl K).
          systemMapped(system) ? undefined : <NotMappedTag what="system" />
        )
      );
    } else if (hit.type === 'wiki') {
      const { entry } = hit;
      intoFor(hit, 'codex', 'Codex').push(
        option(
          i,
          tile(categoryIcon(entry.category)),
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate">
              <Highlight text={entry.title} tokens={tokens} />
            </span>
            <SourceBadge source={entry.source} />
          </span>,
          `${entry.category} · ${entry.summary ?? ''}`
        )
      );
    } else {
      const { book } = hit;
      intoFor(hit, 'guides', 'Guides').push(
        option(
          i,
          tile('ph-book-open-text'),
          book.title,
          <Highlight text={snippetAround(book.text, tokens[0] ?? '')} tokens={tokens} />
        )
      );
    }
  });
  flush();

  const typed = tokens.length > 0;
  // The Codex shows a few; the rest wait in the Codex's own search (a button, so outside the listbox).
  const moreCodex = hits.some(hit => hit.type === 'wiki') && results.wiki.length > LIMIT.codex && scope === 'all';
  const noCodex = typed && scope === 'all' && hits.length > 0 && !results.wiki.length;
  const recent = typed ? [] : readRecent().filter(stillThere);

  return (
    <div ref={root} id="globalSearch" className="hidden relative flex-1 max-w-xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <i
            className="ph-bold ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-scanner-cyan-pale pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={input}
            type="search"
            id="globalSearchInput"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={open && typed}
            aria-controls="globalSearchResults"
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `search-hit-${String(active)}` : undefined}
            aria-label="Search everything"
            placeholder="Search everything"
            onChange={event => {
              run(event.target.value);
            }}
            onFocus={event => {
              run(event.target.value);
            }}
            onKeyDown={onKeyDown}
            className="w-full h-11 bg-slate-ground border border-control-edge hover:border-control-edge-hover focus:border-scanner-cyan-edge-strong focus:shadow-[0_0_0_3px_rgba(34,211,238,0.12)] rounded-control pl-10 pr-10 text-base md:text-sm text-ink-bright placeholder:text-ink-disabled focus:outline-hidden transition"
          />
          <kbd className="hidden lg:block absolute right-4 top-1/2 -translate-y-1/2 nav-kbd pointer-events-none">
            Esc
          </kbd>
        </div>
        <button type="button" onClick={close} className="lg:hidden h-11 px-1 text-[15px] font-medium text-ink-soft">
          Cancel
        </button>
      </div>
      <div id="globalSearchPanel" className={open ? 'search-panel' : 'hidden'}>
        {typed ? (
          <>
            {!wide && (
              <div role="group" aria-label="Search in" className="search-chips">
                {SCOPES.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={scope === key}
                    onClick={() => {
                      setScope(key);
                      setActive(-1);
                      input.current?.focus();
                    }}
                    className="search-chip"
                  >
                    {label} · {count(results, key)}
                  </button>
                ))}
              </div>
            )}
            <div id="globalSearchResults" role="listbox" aria-label="Search results" className="flex flex-col gap-1">
              {hits.length ? (
                groups
              ) : (
                <p className="px-1 py-6 text-center text-sub text-ink-muted">
                  {scope === 'all'
                    ? `Nothing matches “${results.query.trim()}”. Try fewer words.`
                    : `No ${SCOPES.find(([key]) => key === scope)?.[1] ?? ''} matches. Try All.`}
                </p>
              )}
            </div>
            {moreCodex && (
              <button
                type="button"
                onClick={() => {
                  close();
                  location.assign(`wiki/#/?q=${encodeURIComponent(results.query)}`);
                }}
                className="self-start px-1 py-1 text-caption font-semibold text-scanner-cyan-pale hover:text-quantity-cyan"
              >
                Show all {results.wiki.length} in the Codex →
              </button>
            )}
            {noCodex && (
              <div className="mt-1 opacity-80">
                <p className="search-label">Codex</p>
                <div className="search-list flex items-center gap-3 px-4 py-3">
                  {tile('ph-book-open')}
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-semibold text-ink-bright">No Codex matches</span>
                    <span className="text-caption text-ink-muted">Try a game term, like Infra-Knife</span>
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div id="searchQuick" className="shrink-0">
            <p className="search-label">Quick actions</p>
            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map(action => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => {
                    close();
                    action.run();
                  }}
                  className="flex items-center gap-2.5 min-h-[52px] px-3 rounded-control bg-panel-glass border border-hairline text-left text-[14px] font-semibold text-ink-bright hover:border-control-edge-hover"
                >
                  <span
                    aria-hidden="true"
                    className={`w-8 h-8 shrink-0 rounded-[9px] grid place-items-center ${action.tile}`}
                  >
                    <i className={`ph-bold ${action.icon} text-[16px]`} />
                  </span>
                  {action.label}
                </button>
              ))}
            </div>
            {recent.length > 0 && (
              <>
                <p className="search-label mt-2">Recent</p>
                <ul className="search-list">
                  {recent.map(item => (
                    <li key={`${item.type}:${item.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          rememberRecent(item);
                          openRecent(item);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-ground"
                      >
                        <i className={`ph-bold ${RECENT_ICON[item.type]} text-ink-label`} aria-hidden="true" />
                        <span className="flex-1 min-w-0 truncate text-[14px] text-ink-bright">{item.title}</span>
                        <span className="text-caption text-ink-label">{RECENT_PLACE[item.type]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
      {/* The palette's key hints, from lg (d15). */}
      <p className="search-foot" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <kbd className="nav-kbd">↑</kbd>
          <kbd className="nav-kbd">↓</kbd>
          move
          <kbd className="nav-kbd ml-3">↵</kbd>
          open
          <kbd className="nav-kbd ml-3">Tab</kbd>
          next group
          <kbd className="nav-kbd ml-3">Esc</kbd>
          close
        </span>
        <span>Searches your log and the Codex, offline</span>
      </p>
    </div>
  );
}
