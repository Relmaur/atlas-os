// Browsing the Codex (design 15): the landing (title, how fresh the copy is, search, a tile per group, recently edited
// pages) or the results, whose filters (group, source, sort, older items, first letter) wait behind a Filters chip
// (owner, 2026-10-30: the design's leaner page, keeping these).
import { LoadFailed } from '../parts/Loading.tsx';
import { useState, type ReactNode } from 'react';
import { DEFAULTS, LETTERS, browseHref, type Browse as BrowseView, type BrowseParams } from '@atlas/core/codex';
import { CATEGORIES, isOld, snippet, tokenize, type PreparedEntry } from '@atlas/core/search';
import type { Verification } from '@atlas/core/wiki-files';
import { setParams } from './route.ts';
import { Highlight, SourceBadge, StatusBadge, categoryIcon, categoryLabel } from './bits.tsx';

export interface Listed {
  entry: PreparedEntry;
  field: string;
}

const SOURCE_OPTIONS = [
  ['all', 'All sources'],
  ['wiki', 'Wiki pages'],
  ['custom', 'Your articles']
] as const;
const SORTS = [
  ['relevance', 'Best match'],
  ['az', 'A–Z']
] as const;
const CHIP = (on: boolean) =>
  `relative shrink-0 inline-flex items-center gap-1.5 h-[34px] px-3.5 rounded-full border text-[13px] font-semibold whitespace-nowrap disabled:opacity-40 ${
    on
      ? 'bg-scanner-cyan-tint border-scanner-cyan-edge text-scanner-cyan-text'
      : 'bg-slate-ground border-control-edge text-ink-soft hover:text-ink-bright'
  }`;
const ROW = 'flex items-center gap-3 min-h-[52px] px-4 py-2.5 hover:bg-slate-ground';
const TILE =
  'w-[34px] h-[34px] shrink-0 rounded-[10px] grid place-items-center bg-slate-ground border border-control-edge text-scanner-cyan-pale';

const go = (changes: Partial<BrowseParams>) => {
  setParams({ ...changes, page: 1 });
};

type Props = {
  search: ReactNode;
  onNew: () => void;
  params: BrowseParams;
  view: BrowseView;
  entries: PreparedEntry[];
  verification: Verification | null;
  listed: Listed[];
  landing: boolean;
  selected: number;
  onPeek: (i: number) => void;
  articleHref: (path: string) => string;
};

export function Browse(props: Props) {
  if (!props.entries.length) return <Empty />;
  return props.landing ? <Landing {...props} /> : <Results {...props} />;
}

function Empty() {
  return (
    <div id="browseBody" className="flex flex-col gap-3">
      <h1 className="font-display text-screen-title text-ink-bright">Codex</h1>
      <LoadFailed
        what="The Codex"
        onRetry={() => {
          location.reload();
        }}
      />
      {import.meta.env.DEV && (
        <p className="text-caption text-ink-muted">
          Building locally? Run <code>pnpm index:wiki</code>, then reload.
        </p>
      )}
    </div>
  );
}

// What the last sync or verify established about the archive, in a line. Since ADR-0009 it's checked against a
// database dump of the wiki, so the dump's date is how fresh the copy is.
function verificationLine(v: Verification | null): { text: string; ok: boolean } {
  const copy = v?.dumpDate
    ? new Date(v.dumpDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const pages = (v?.pages ?? 0).toLocaleString();
  if (v?.status === 'match')
    return {
      ok: true,
      text: copy
        ? `Wiki copy from ${copy}: ${(v.matched ?? 0).toLocaleString()} of ${pages} pages match it.`
        : `Matches the wiki: ${(v.matched ?? 0).toLocaleString()} of ${pages} pages at their latest revision.`
    };
  if (v?.status === 'differs')
    return {
      ok: false,
      text: `${((v.pages ?? 0) - (v.matched ?? 0)).toLocaleString()} pages behind the wiki${copy ? ` copy from ${copy}` : ''}.`
    };
  if (v?.status === 'unreachable') return { ok: false, text: 'The wiki couldn’t be reached at the last check.' };
  if (v?.status === 'invalid-response') return { ok: false, text: 'The last check stopped on unexpected data.' };
  return { ok: false, text: 'Not verified on this copy.' };
}

function Landing(props: Props) {
  const current = props.entries.filter(entry => entry.source === 'wiki' && !isOld(entry));
  const check = verificationLine(props.verification);
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-screen-title text-ink-bright">Codex</h1>
          <button
            type="button"
            onClick={props.onNew}
            aria-label="Write an article"
            className="w-11 h-11 rounded-control border border-control-edge bg-slate-ground grid place-items-center text-ink hover:border-control-edge-hover"
          >
            <i className="ph-bold ph-note-pencil text-lg" aria-hidden="true" />
          </button>
        </div>
        <p className="text-sub text-ink-muted">
          The NMS wiki, offline on your phone.{' '}
          <span className="font-mono text-scanner-cyan-pale">{current.length.toLocaleString()}</span> articles.
        </p>
        <p id="codexCheck" className="flex items-start gap-1.5 text-caption text-ink-label">
          <i
            className={`ph-bold mt-0.5 ${check.ok ? 'ph-seal-check text-ready-emerald-lit' : 'ph-warning text-units-amber-text'}`}
            aria-hidden="true"
          />
          {check.text}
        </p>
      </header>
      {props.search}
      <div id="browseBody" className="flex flex-col gap-4">
        <nav aria-label="Groups" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(CATEGORIES).map(([key, meta]) => (
            <a
              key={key}
              href={browseHref({ ...DEFAULTS, cat: key })}
              data-group={key}
              className="rounded-card bg-panel-glass border border-hairline hover:border-control-edge-hover p-3 flex items-center gap-2.5 text-[13px] font-semibold text-ink"
            >
              <i className={`ph-bold ${meta.icon} text-lg text-scanner-cyan-pale`} aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate">{meta.label}</span>
              <span className="font-mono text-[11px] font-normal text-ink-label">
                {current.filter(entry => entry.category === key).length}
              </span>
            </a>
          ))}
        </nav>
        <h2 className="text-label uppercase text-ink-label mt-2">Recently edited on the wiki</h2>
        <ul className="rounded-card bg-panel-glass border border-hairline divide-y divide-hairline overflow-hidden lg:rounded-none lg:bg-transparent lg:border-0">
          {props.listed.map((item, i) => (
            <li key={String(item.entry.path)}>
              <a
                href={props.articleHref(String(item.entry.path))}
                data-selected={props.selected === i}
                aria-current={props.selected === i ? 'true' : undefined}
                className={`${ROW} data-[selected=true]:bg-slate-ground`}
              >
                <span className={TILE} aria-hidden="true">
                  <i className={`ph-bold ${categoryIcon(item.entry.category)} text-[17px]`} />
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[14px] font-semibold text-ink-bright truncate">{item.entry.title}</span>
                  <span className="text-caption text-ink-muted">{categoryLabel(item.entry.category)}</span>
                </span>
                <i className="ph-bold ph-caret-right text-ink-label shrink-0" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = { title: '', summary: 'in summary', text: 'in article text' };

function Results(props: Props) {
  const { params, view } = props;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const tokens = tokenize(params.q);
  const total = view.results.length;
  const srcCount = (key: string) => (key === 'all' ? view.srcTotal : (view.srcCounts[key] ?? 0));
  const oldOn = params.old === '1';
  const chips: [keyof BrowseParams, string][] = [];
  if (params.q) chips.push(['q', `“${params.q}”`]);
  if (params.cat !== 'all') chips.push(['cat', categoryLabel(params.cat)]);
  if (params.src !== 'all') chips.push(['src', params.src === 'custom' ? 'Your articles' : 'Wiki pages']);
  if (params.sort !== 'relevance') chips.push(['sort', 'A–Z']);
  if (params.letter) chips.push(['letter', `Starts with ${params.letter}`]);
  if (oldOn) chips.push(['old', 'Incl. no longer in game']);
  const from = (view.page - 1) * 20 + 1;
  const to = Math.min(total, view.page * 20);
  const turn = (page: number) => {
    setParams({ page });
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="font-display text-screen-title text-ink-bright">
        {params.cat !== 'all' && !params.q ? categoryLabel(params.cat) : 'Codex'}
      </h1>
      {props.search}
      <div id="resultsHeader" className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sub text-ink-soft">
          <strong className="text-ink-bright font-semibold tabular-nums">{total.toLocaleString()}</strong>{' '}
          {total === 1 ? 'article' : 'articles'}
        </p>
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="codexFilters"
          onClick={() => {
            setFiltersOpen(!filtersOpen);
          }}
          className={CHIP(filtersOpen)}
        >
          <i className="ph-bold ph-sliders-horizontal" aria-hidden="true" />
          Filters
        </button>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                go({ [key]: DEFAULTS[key] });
              }}
              aria-label={`Remove filter: ${label}`}
              className="h-7 pl-2.5 pr-2 rounded-full bg-slate-ground border border-control-edge hover:border-control-edge-hover text-caption text-ink flex items-center gap-1.5"
            >
              {label}
              <i className="ph-bold ph-x text-[10px] text-ink-label" aria-hidden="true" />
            </button>
          ))}
          {chips.length > 1 ? (
            <a href="#/" className="h-7 px-2 inline-flex items-center text-caption text-scanner-cyan-pale">
              Clear all
            </a>
          ) : null}
        </div>
      )}

      {filtersOpen && (
        <div
          id="codexFilters"
          className="rounded-card bg-panel-glass border border-hairline p-4 flex flex-col gap-4 lg:rounded-control lg:bg-slate-ground lg:border-0"
        >
          <Filter label="Group">
            <button
              type="button"
              aria-pressed={params.cat === 'all'}
              onClick={() => {
                go({ cat: 'all' });
              }}
              className={CHIP(params.cat === 'all')}
            >
              All <span className="font-mono text-[11px] text-ink-label">{view.catTotal}</span>
            </button>
            {Object.entries(CATEGORIES).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                aria-pressed={params.cat === key}
                disabled={(view.catCounts[key] ?? 0) === 0}
                onClick={() => {
                  go({ cat: key });
                }}
                className={CHIP(params.cat === key)}
              >
                <i className={`ph-bold ${meta.icon}`} aria-hidden="true" />
                {meta.label} <span className="font-mono text-[11px] text-ink-label">{view.catCounts[key] ?? 0}</span>
              </button>
            ))}
          </Filter>
          <Filter label="Source">
            {SOURCE_OPTIONS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={params.src === key}
                onClick={() => {
                  go({ src: key });
                }}
                className={CHIP(params.src === key)}
              >
                {label} <span className="font-mono text-[11px] text-ink-label">{srcCount(key)}</span>
              </button>
            ))}
          </Filter>
          <Filter label="Sort">
            {SORTS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={params.sort === key}
                onClick={() => {
                  go({ sort: key });
                }}
                className={CHIP(params.sort === key)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={oldOn}
              onClick={() => {
                go({ old: oldOn ? '0' : '1' });
              }}
              title="Items the wiki marks obsolete, and pages since removed from the wiki"
              className={CHIP(oldOn)}
            >
              <i className="ph-bold ph-clock-counter-clockwise" aria-hidden="true" />
              Include no longer in game <span className="font-mono text-[11px] text-ink-label">{view.oldCount}</span>
            </button>
          </Filter>
          <nav aria-label="Browse by letter" className="flex flex-wrap gap-1">
            <button
              type="button"
              className="letter px-2.5"
              aria-pressed={!params.letter}
              onClick={() => {
                go({ letter: '' });
              }}
            >
              All
            </button>
            {LETTERS.map(letter => (
              <button
                key={letter}
                type="button"
                className="letter"
                aria-pressed={params.letter === letter}
                disabled={!view.letters.has(letter)}
                onClick={() => {
                  go({ letter });
                }}
                aria-label={`Titles starting with ${letter === '#' ? 'a number or symbol' : letter}`}
              >
                {letter}
              </button>
            ))}
          </nav>
        </div>
      )}

      <div id="browseBody">
        <p id="quickLookHint" hidden>
          Opens a quick look
        </p>
        {props.listed.length ? (
          <ul
            aria-label="Articles"
            className="rounded-card bg-panel-glass border border-hairline divide-y divide-hairline overflow-hidden lg:rounded-none lg:bg-transparent lg:border-0"
          >
            {props.listed.map((item, i) => {
              const entry = item.entry;
              const text = tokens.length && item.field !== 'title' ? snippet(entry, tokens) : (entry.summary ?? '');
              return (
                <li
                  key={String(entry.path)}
                  className="result flex items-start gap-1 pr-2 data-[selected=true]:bg-slate-ground"
                  data-selected={props.selected === i}
                  aria-current={props.selected === i ? 'true' : undefined}
                >
                  <button
                    type="button"
                    onClick={() => {
                      props.onPeek(i);
                    }}
                    className="min-w-0 flex-1 flex gap-3 items-start text-left px-4 py-3"
                    aria-describedby="quickLookHint"
                  >
                    <span
                      className={`${TILE} ${entry.source === 'wiki' ? '' : 'text-units-amber-text'}`}
                      aria-hidden="true"
                    >
                      <i className={`ph-bold ${categoryIcon(entry.category)} text-[17px]`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <strong className="text-[14px] font-semibold text-ink-bright">
                          <Highlight text={entry.title} tokens={tokens} />
                        </strong>
                        <SourceBadge source={entry.source} />
                        <StatusBadge entry={entry} />
                        <span className="text-caption text-ink-muted">
                          {categoryLabel(entry.category)}
                          {tokens.length && FIELD_LABEL[item.field] ? ` · ${FIELD_LABEL[item.field] ?? ''}` : ''}
                        </span>
                      </span>
                      <span className="block text-caption leading-relaxed text-ink-soft mt-1 line-clamp-2">
                        <Highlight text={text} tokens={tokens} />
                      </span>
                    </span>
                  </button>
                  <a
                    href={props.articleHref(String(entry.path))}
                    className="shrink-0 mt-3 w-9 h-9 rounded-control grid place-items-center text-ink-label hover:text-ink-bright hover:bg-slate-ground"
                    aria-label={`Open ${entry.title}`}
                    title="Open article"
                  >
                    <i className="ph-bold ph-caret-right" aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-card border border-dashed border-control-edge p-8 text-center space-y-2">
            <p className="text-ink-bright font-semibold">No articles match.</p>
            <p className="text-sub text-ink-muted">Try fewer words, another spelling, or clear a filter.</p>
          </div>
        )}
      </div>
      {view.pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={view.page === 1}
            onClick={() => {
              turn(view.page - 1);
            }}
            aria-label="Previous page"
            className="h-10 px-4 rounded-control bg-slate-ground border border-control-edge text-sub text-ink hover:border-control-edge-hover disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
          >
            <i className="ph-bold ph-arrow-left" aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
          </button>
          <span className="text-caption text-ink-muted tabular-nums">
            {`${String(from)}–${String(to)} of ${total.toLocaleString()} · page ${String(view.page)}/${String(view.pages)}`}
          </span>
          <button
            type="button"
            disabled={view.page === view.pages}
            onClick={() => {
              turn(view.page + 1);
            }}
            aria-label="Next page"
            className="h-10 px-4 rounded-control bg-slate-ground border border-control-edge text-sub text-ink hover:border-control-edge-hover disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
          >
            <span className="hidden sm:inline">Next</span>
            <i className="ph-bold ph-arrow-right" aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <p className="text-label uppercase text-ink-label">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
