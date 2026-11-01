// The Codex page (wiki/index.html): browsing (design 15) or an article (16), with the quick look and the New article
// sheet. The search field sits at the top of browsing; from lg a slim header sits beside the rail. Keyboard: / or ⌘K searches; on results ↑/↓ (or j/k) select, Space peeks, Enter opens.
import { CodexLoading } from '../parts/Loading.tsx';
import { useMedia } from '../parts/useMedia.ts';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { DEFAULTS, articleHref, browse, browseHref, isLanding, pageOf } from '@atlas/core/codex';
import { isOld } from '@atlas/core/search';
import { Article } from './Article.tsx';
import { Browse, type Listed } from './Browse.tsx';
import { useCodex } from './codex-data.ts';
import { NewArticle } from './NewArticle.tsx';
import { QuickLook } from './QuickLook.tsx';
import { currentRoute, navigate, setParams, useRoute } from './route.ts';

export function Codex() {
  // From lg an article sits beside the search and results (design/desktop-direction).
  const wide = useMedia('(min-width: 1024px)');
  const data = useCodex();
  const route = useRoute();
  const { params } = route;
  const [selected, setSelected] = useState(-1);
  const [peek, setPeek] = useState(-1);
  const [creating, setCreating] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const selectFirst = useRef(false); // Enter in the search box: select the first result once they're in

  const entries = useMemo(() => (data.status === 'ready' ? data.index.entries : []), [data]);
  const view = useMemo(() => browse(entries, params), [entries, params]);
  const landing = isLanding(params);
  // What ↑/↓ and the quick look move through: the page of results, or the landing's recently edited pages.
  const listed: Listed[] = useMemo(
    () =>
      landing
        ? entries
            .filter(entry => entry.source === 'wiki' && !isOld(entry))
            .sort((a, b) => String(b.revTimestamp).localeCompare(String(a.revTimestamp)))
            .slice(0, 10)
            .map(entry => ({ entry, field: 'title' }))
        : pageOf(view),
    [landing, entries, view]
  );
  const href = (path: string) => articleHref(path, params.q);

  // Any move (another filter, page or article) starts without a selection or a quick look.
  useEffect(() => {
    setSelected(selectFirst.current ? 0 : -1);
    selectFirst.current = false;
    setPeek(-1);
    if (route.view === 'browse') document.title = 'Wiki Codex · ATLAS:OS';
  }, [route]);

  const select = useCallback(
    (i: number) => {
      if (!listed.length) return;
      const next = Math.max(0, Math.min(listed.length - 1, i));
      setSelected(next);
      setPeek(open => (open === -1 ? -1 : next));
    },
    [listed]
  );
  const closePeek = useCallback(() => {
    setPeek(-1);
  }, []);
  const closeCreate = useCallback(() => {
    setCreating(false);
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (creating) return; // the sheet handles its own keys
      if (event.key === 'Escape' && peek !== -1) {
        setPeek(-1);
        return;
      }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '')) return;
      if (event.key === '/' || (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey))) {
        event.preventDefault();
        if (search.current) search.current.focus();
        else {
          navigate('#/'); // an article has no search field: browse, then search
          requestAnimationFrame(() => document.getElementById('codexSearch')?.focus());
        }
        return;
      }
      if (currentRoute().view !== 'browse' || !listed.length) return;
      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault();
        select(selected + 1);
      } else if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault();
        select(selected - 1);
      } else if (event.key === ' ' && selected !== -1) {
        event.preventDefault();
        setPeek(peek === -1 ? selected : -1);
      } else if (event.key === 'Enter' && selected !== -1) {
        event.preventDefault();
        const path = listed[selected]?.entry.path;
        if (path) navigate(href(path));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  });

  useEffect(() => {
    if (selected !== -1)
      document.querySelector(`#browseBody [data-selected="true"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const peeked = listed[peek]?.entry ?? null;
  const article =
    data.status === 'ready' && route.view === 'article' ? (
      <Article
        key={route.path}
        index={data.index}
        path={route.path}
        q={params.q}
        copyDate={data.verification?.dumpDate}
      />
    ) : null;
  const browsePane =
    data.status === 'ready' ? (
      <Browse
        search={
          <SearchField
            q={params.q}
            ref={search}
            onDown={() => {
              if (!listed.length) return false;
              select(0);
              return true;
            }}
            onEnter={() => {
              selectFirst.current = true;
            }}
          />
        }
        onNew={() => {
          setCreating(true);
        }}
        params={params}
        view={view}
        entries={entries}
        verification={data.verification}
        listed={listed}
        landing={landing}
        selected={selected}
        onPeek={i => {
          setSelected(i);
          setPeek(i);
        }}
        articleHref={href}
      />
    ) : null;
  return (
    <>
      <Header
        onNew={() => {
          setCreating(true);
        }}
      />
      <main
        id="codexMain"
        className="app-main max-w-[1400px] mx-auto px-4 sm:px-6 pt-[calc(1.25rem+env(safe-area-inset-top))] lg:pt-5 pb-28 lg:py-8"
      >
        {data.status !== 'ready' ? (
          <CodexLoading />
        ) : route.view === 'article' ? (
          wide ? (
            <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-8 items-start">
              <div className="codex-list">{browsePane}</div>
              {article}
            </div>
          ) : (
            article
          )
        ) : (
          browsePane
        )}
      </main>
      {data.status === 'ready' ? (
        <>
          <QuickLook
            entry={peeked}
            index={data.index}
            q={params.q}
            href={peeked?.path ? href(peeked.path) : '#/'}
            onClose={closePeek}
          />
          {creating ? <NewArticle category={params.cat} index={data.index} onClose={closeCreate} /> : null}
        </>
      ) : null}
    </>
  );
}

// The search box keeps what's typed while focused; otherwise it shows the route's query (Back, a cleared chip).
export function SearchField({
  ref,
  ...props
}: {
  q: string;
  ref: RefObject<HTMLInputElement | null>;
  onDown: () => boolean;
  onEnter: () => void;
}) {
  const [value, setValue] = useState(props.q);
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const shown = focused ? value : props.q;
  const apply = (text: string) => {
    clearTimeout(timer.current);
    if (currentRoute().view === 'article') navigate(browseHref({ ...DEFAULTS, q: text }));
    else setParams({ q: text, page: 1 }, { replace: true });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (props.onDown()) event.currentTarget.blur();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const text = event.currentTarget.value;
      event.currentTarget.blur();
      if (text === props.q && currentRoute().view === 'browse') props.onDown();
      else {
        props.onEnter();
        apply(text);
      }
    } else if (event.key === 'Escape') event.currentTarget.blur();
  };
  return (
    <label className="relative block">
      <i
        className="ph-bold ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-label pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        id="codexSearch"
        autoComplete="off"
        spellCheck={false}
        aria-label="Search the Codex"
        placeholder="Search items, tech, mechanics"
        value={shown}
        onFocus={() => {
          setValue(props.q);
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        onChange={event => {
          const text = event.target.value;
          setValue(text);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            apply(text);
          }, 80);
        }}
        onKeyDown={onKeyDown}
        className="w-full h-11 rounded-control border border-control-edge bg-slate-ground pl-10 pr-10 text-base md:text-sm text-ink-bright placeholder:text-ink-disabled focus:border-scanner-cyan-edge-strong focus:outline-hidden"
      />
      <kbd className="hidden md:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-ink-label border border-control-edge rounded px-1.5 py-0.5 pointer-events-none">
        /
      </kbd>
    </label>
  );
}

// From lg, beside the rail: the Codex's own name and New article. Below lg the tab bar and the screens do this.
function Header({ onNew }: { onNew: () => void }) {
  return (
    <header className="app-header hidden lg:block sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-[1400px] mx-auto h-16 px-6 flex items-center gap-4">
        <a href="#/" className="font-display font-bold tracking-wider text-emerald-300 shrink-0 rounded-lg">
          CODEX
        </a>
        <button
          type="button"
          onClick={onNew}
          aria-label="New article"
          className="ml-auto shrink-0 h-10 px-3 rounded-xl border border-ready-emerald-edge bg-ready-emerald-tint text-ready-emerald-text text-sm font-semibold flex items-center gap-2"
        >
          <i className="ph-bold ph-note-pencil text-base" aria-hidden="true" />
          New article
        </button>
      </div>
    </header>
  );
}
