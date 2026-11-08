// The Systems log (design 02): every system warped to, searchable and filterable the way the in-game Discoveries
// page isn't. A system with its star or planets logged draws its orbit strip; one without stays a compact card.
// From lg it's the Workbench's list pane (round 6, d01): one dense row per system beside the open one.
import { useEffect, useState } from 'react';
import { planetFamily } from '@atlas/core/facts';
import { formatAgo } from '@atlas/core/format';
import { homeSummary } from '@atlas/core/home';
import { systemOrbit } from '@atlas/core/orbit';
import {
  DEFAULT_FILTER,
  filterActive,
  filterChips,
  filterSystems,
  systemMeta,
  systemsLine,
  type FilterChip,
  type SystemFilter
} from '@atlas/core/systems-list';
import { OUTLAW_TAG, SORTS, lastVisit, outlawStatus, type PlanetLike, type System } from '@atlas/core/systems-model';
import { useAppState } from '../useAppState.ts';
import { useNow } from '../useNow.ts';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { Button } from '../parts/Button.tsx';
import { LogSegment } from '../parts/LogSegment.tsx';
import { OrbitDiagram } from '../parts/StarChart.tsx';
import { MetaLine, OutlawPill, StarDot } from '../parts/SystemBits.tsx';
import { useMedia } from '../parts/useMedia.ts';
import { useNavOpen } from '../shell/nav-store.ts';
import { useSectionParam } from '../shell/section-store.ts';
import { openSystem, openSystemEditor, setSystemFilter, useSystemFilter } from './panel-store.ts';

const WIDE = '(min-width: 1024px)';
// The list pane's sort says it in a word (d01: "Recent"), so the filter field keeps its room.
const SHORT_SORTS: Record<keyof typeof SORTS, string> = {
  recent: 'Recent',
  discovered: 'Newest',
  name: 'Name',
  rating: 'Rating',
  region: 'Region'
};
const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

// The list column is 300px at every width, so the field's room is fixed: ~104px of text with the rail, ~64px with
// the sidebar open. "Filter 3 systems" fits the first, "Filter 12 systems" no longer does, and with the sidebar open
// the count is already on its Systems badge. Measured at 13px; a placeholder must never be cut off.
function filterPlaceholder(count: number, navOpen: boolean): string {
  if (navOpen) return 'Filter';
  return count < 10 ? `Filter ${plural(count, 'system')}` : `Filter ${count.toLocaleString()}`;
}

const TAG_LIMIT = 6;

export function Systems() {
  const state = useAppState();
  const now = useNow();
  const filter = useSystemFilter();
  const facts = useFacts();
  const wide = useMedia(WIDE);
  useEffect(() => {
    void loadFacts(); // biome families, for the planets' colours
  }, []);
  const systems = state.systems;
  const visible = filterSystems(systems, filter);
  const current = homeSummary(state, now).current;
  // "You are here" only for a system actually visited, as on Home.
  const hereId = current && lastVisit(current) ? current.id : null;
  const familyOf = (planet: PlanetLike) => planetFamily(facts, planet).family;
  const logNew = () => {
    openSystemEditor();
  };

  if (wide)
    return <SystemRows systems={systems} visible={visible} filter={filter} hereId={hereId} now={now} onLog={logNew} />;

  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-col gap-3 pt-[env(safe-area-inset-top)] lg:pt-0 mb-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-screen-title text-ink-bright">Systems</h1>
          <Button variant="primary" size="M" icon="ph-plus" onClick={logNew}>
            Log system
          </Button>
        </div>
        <p id="systemsSummary" className="font-mono text-caption text-ink-muted">
          {systemsLine(systems)}
        </p>
      </header>
      <LogSegment />
      <label className="relative block max-w-xl">
        <i
          className="ph ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          id="systemSearch"
          autoComplete="off"
          value={filter.q}
          onChange={event => {
            setSystemFilter({ q: event.target.value });
          }}
          placeholder="Search systems, planets, moons, notes, tags"
          aria-label="Search systems"
          className="w-full h-[42px] rounded-control border border-control-edge focus:border-scanner-cyan-edge-strong bg-slate-ground pl-10 pr-3 text-base md:text-sm text-ink-bright placeholder:text-ink-disabled focus:outline-hidden"
        />
      </label>
      <ChipRail chips={filterChips(systems, filter)} sort={filter.sort} />
      <p id="systemResultCount" role="status" className="sr-only">
        {filterActive(filter) ? `${String(visible.length)} of ${plural(systems.length, 'system')}` : ''}
      </p>
      <ul id="systemList" className="grid grid-cols-1 gap-section">
        {visible.map(system => (
          <li key={system.id}>
            <SystemCard
              system={system}
              here={system.id === hereId}
              now={now}
              restockHours={state.outlaw.restockHours}
              familyOf={familyOf}
            />
          </li>
        ))}
        {systems.length > 0 && visible.length === 0 && (
          <li className="p-card rounded-card border border-dashed border-control-edge flex flex-col items-center gap-2 text-center text-sub text-ink-muted">
            No systems match these filters.
            <Button
              variant="ghost"
              onClick={() => {
                setSystemFilter({ ...DEFAULT_FILTER, sort: filter.sort });
              }}
            >
              Clear filters
            </Button>
          </li>
        )}
        {systems.length === 0 && (
          <li className="text-sub text-ink-muted">
            Your log is empty. Log a system after your next warp; only its name is needed.
          </li>
        )}
      </ul>
      <button
        type="button"
        onClick={logNew}
        className="min-h-16 rounded-card border border-dashed border-control-edge text-[13px] text-ink-muted flex items-center justify-center gap-2 hover:border-control-edge-hover hover:text-ink transition-colors duration-[var(--duration-micro)]"
      >
        <i className="ph-bold ph-plus" aria-hidden="true" />
        Warped somewhere new? Log it here
      </button>
    </div>
  );
}

// A deliberate rail on phones (it scrolls sideways inside itself, never the page); from lg the chips wrap. Each chip
// is 32px tall with a 40px hit area. Sort sits at the end: the design has no place for it, and it's a feature people
// use.
function ChipRail({ chips, sort }: { chips: FilterChip[]; sort: SystemFilter['sort'] | null }) {
  const chip =
    "relative flex-none h-8 px-3 rounded-full border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors duration-[var(--duration-micro)] after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']";
  const off = 'border-control-edge bg-slate-ground text-ink-soft hover:border-control-edge-hover';
  return (
    <div
      id="systemTagFilters"
      role="group"
      aria-label="Filters"
      className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-4 px-4 py-1 -my-1 lg:mx-0 lg:px-0 lg:flex-wrap lg:overflow-visible"
    >
      {chips.map(item => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.on}
          id={item.id === 'favorites' ? 'systemFavFilter' : undefined}
          onClick={() => {
            setSystemFilter(item.next);
          }}
          className={`${chip} ${item.on ? 'border-ready-emerald-edge bg-ready-emerald-tint text-ready-emerald-text' : off}`}
        >
          {item.star && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: `var(--color-star-${item.star})` }}
              aria-hidden="true"
            />
          )}
          {item.id === 'favorites' && <span aria-hidden="true">★</span>}
          {item.label}
          {item.count !== null && <span className="font-mono">{item.count}</span>}
        </button>
      ))}
      {sort !== null && (
        <span className="relative flex-none">
          <select
            id="systemSort"
            value={sort}
            onChange={event => {
              setSystemFilter({ sort: event.target.value as SystemFilter['sort'] });
            }}
            aria-label="Sort"
            className={`${chip} ${off} appearance-none pr-7`}
          >
            {Object.entries(SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <i
            className="ph-bold ph-caret-down absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted pointer-events-none"
            aria-hidden="true"
          />
        </span>
      )}
    </div>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {tags.slice(0, TAG_LIMIT).map(tag => (
        <span
          key={tag}
          className={`h-[22px] px-2 rounded-full text-[11px] inline-flex items-center ${
            tag === OUTLAW_TAG ? 'bg-danger-rose-tint text-danger-rose-text' : 'bg-scanner-cyan-tint text-quantity-cyan'
          }`}
        >
          {tag}
        </span>
      ))}
      {tags.length > TAG_LIMIT && (
        <span className="text-[11px] text-ink-muted self-center">+{tags.length - TAG_LIMIT}</span>
      )}
    </span>
  );
}

const footerText = 'font-mono text-[11px] uppercase text-ink-muted';
const hereText = 'text-[11px] font-bold tracking-[0.1em] uppercase text-units-amber-text shrink-0';

function SystemCard({
  system,
  here,
  now,
  restockHours,
  familyOf
}: {
  system: System;
  here: boolean;
  now: number;
  restockHours: number;
  familyOf: (planet: PlanetLike) => string | null;
}) {
  const open = useSectionParam() === system.id;
  const last = lastVisit(system);
  const visited = last ? `Last visit ${formatAgo(last.at, now)}` : 'Never visited';
  const meta = systemMeta(system);
  const status = system.tags.includes(OUTLAW_TAG) ? outlawStatus(system, restockHours, now) : null;
  // The whole card opens the system: the name's button stretches over it, so the heading stays a heading.
  const name = (
    <button
      type="button"
      onClick={() => {
        openSystem(system.id);
      }}
      aria-current={open ? 'true' : undefined}
      className="text-left break-words focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
    >
      {system.name}
    </button>
  );
  const badge = status ? (
    <OutlawPill status={status} />
  ) : system.rating ? (
    <span className="text-[13px] tracking-[1px] text-units-amber-text shrink-0">
      <span aria-hidden="true">{'★'.repeat(system.rating)}</span>
      <span className="sr-only">Rated {system.rating} of 5</span>
    </span>
  ) : null;
  const card =
    'relative rounded-card bg-panel-glass border transition-colors duration-[var(--duration-micro)] hover:border-control-edge has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 has-[button:focus-visible]:outline-scanner-cyan-glow';

  if (system.star || system.planets.length) {
    const orbit = systemOrbit(system, familyOf);
    return (
      <article className={`${card} overflow-hidden border-hero-edge`}>
        <div className="h-[74px] hero-grid">
          <OrbitDiagram
            name={system.name}
            seed={orbit.seed}
            star={system.star}
            planets={orbit.planets}
            width={356}
            height={74}
            size="M"
            grid={false}
          />
        </div>
        <div className="px-card pt-3 pb-3.5 flex flex-col gap-2">
          <div className="flex justify-between items-center gap-2">
            <h2 className="font-display text-[17px] font-bold text-ink-bright min-w-0">{name}</h2>
            {badge}
          </div>
          {meta.length > 0 && (
            <p className="text-caption text-ink-muted">
              <MetaLine parts={meta} />
            </p>
          )}
          <Tags tags={system.tags} />
          <div className="flex justify-between items-center gap-2 pt-2 border-t border-hairline">
            <span className={footerText}>
              {visited}
              {system.planets.length > 0 && ` · ${plural(system.planets.length, 'planet')}`}
            </span>
            {here && <span className={hereText}>You are here</span>}
          </div>
        </div>
      </article>
    );
  }
  return (
    <article className={`${card} border-hairline px-card py-3.5 flex flex-col gap-2`}>
      <div className="flex items-center gap-3">
        <span
          className="w-[34px] h-[34px] rounded-full border border-dashed border-grab grid place-items-center flex-none"
          aria-hidden="true"
        >
          <span className="w-2 h-2 rounded-full bg-ink-disabled" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-ink-bright">{name}</h2>
          <p className="mt-0.5 text-caption text-ink-muted">
            {meta.length > 0 && <MetaLine parts={meta} />}
            {meta.length > 0 ? ' · star and planets not logged yet' : 'Star and planets not logged yet'}
          </p>
        </div>
        {badge}
      </div>
      {system.notes.trim() && (
        <p className="text-[13px] leading-[1.45] text-ink-soft line-clamp-3 whitespace-pre-line">
          {system.notes.trim()}
        </p>
      )}
      <div className="flex justify-between items-center gap-2 pt-2 border-t border-hairline">
        <Tags tags={system.tags} />
        <span className={`ml-auto ${here ? hereText : footerText}`}>{here ? 'You are here' : visited}</span>
      </div>
    </article>
  );
}

// The list pane (d01): the title with Log system (N), a filter field, the filter chips behind a toggle, the sort, and a
// row per system: its star, its name (★ if a favourite) over where it is, and "Here" or when you were last there.
// Names and places that don't fit end in an ellipsis, with the whole text as a tooltip.
function SystemRows({
  systems,
  visible,
  filter,
  hereId,
  now,
  onLog
}: {
  systems: System[];
  visible: System[];
  filter: SystemFilter;
  hereId: string | null;
  now: number;
  onLog: () => void;
}) {
  const navOpen = useNavOpen();
  const at = useSectionParam();
  const chips = filterChips(systems, filter);
  const filtering = chips.some(chip => chip.on && chip.id !== 'all');
  const [showFilters, setShowFilters] = useState(filtering);
  const control =
    'h-[38px] rounded-control border border-control-edge bg-slate-ground text-ink inline-flex items-center gap-1.5 px-3 text-[13px] font-semibold hover:border-control-edge-hover';
  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center justify-between gap-2.5 px-[18px] pt-4 pb-3">
        <h1 className="font-display font-extrabold text-[22px] leading-none text-ink-bright">Systems</h1>
        <button
          type="button"
          onClick={onLog}
          aria-keyshortcuts="n"
          className="h-10 shrink-0 rounded-control border border-scanner-cyan-edge bg-scanner-cyan-tint text-scanner-cyan-text inline-flex items-center gap-1.5 px-3.5 text-[13px] font-semibold whitespace-nowrap hover:border-scanner-cyan-edge-strong"
        >
          <i className="ph-bold ph-plus" aria-hidden="true" />
          {navOpen ? 'Log' : 'Log system'}
          <kbd className="nav-kbd ml-1">N</kbd>
        </button>
      </header>
      <p id="systemsSummary" className="sr-only">
        {systemsLine(systems)}
      </p>
      <div className="px-[18px] pb-3 flex flex-col gap-2.5">
        <div className="flex gap-2">
          <label className="relative flex-1 min-w-0">
            <i
              className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              id="systemSearch"
              autoComplete="off"
              value={filter.q}
              onChange={event => {
                setSystemFilter({ q: event.target.value });
              }}
              placeholder={filterPlaceholder(systems.length, navOpen)}
              aria-label="Search systems"
              className="w-full h-[38px] rounded-control border border-control-edge focus:border-scanner-cyan-edge-strong bg-slate-ground pl-9 pr-3 text-[13px] text-ink-bright placeholder:text-ink-disabled focus:outline-hidden"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setShowFilters(!showFilters);
            }}
            aria-expanded={showFilters}
            aria-controls="systemTagFilters"
            aria-label={filtering ? 'Filters (some on)' : 'Filters'}
            className={`${control} relative w-[38px] justify-center px-0`}
          >
            <i className="ph-bold ph-funnel" aria-hidden="true" />
            {filtering && (
              <span
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-scanner-cyan-glow"
                aria-hidden="true"
              />
            )}
          </button>
          <span className="relative shrink-0">
            <i
              className="ph-bold ph-sort-descending absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
              aria-hidden="true"
            />
            <select
              id="systemSort"
              value={filter.sort}
              onChange={event => {
                setSystemFilter({ sort: event.target.value as SystemFilter['sort'] });
              }}
              aria-label="Sort"
              className={`${control} appearance-none pl-8 pr-3`}
            >
              {Object.entries(SHORT_SORTS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </span>
        </div>
        {showFilters && <ChipRail chips={chips} sort={null} />}
      </div>
      <p id="systemResultCount" role="status" className="sr-only">
        {filterActive(filter) ? `${String(visible.length)} of ${plural(systems.length, 'system')}` : ''}
      </p>
      <ul id="systemList" className="flex-1 min-h-0 overflow-y-auto">
        {visible.map(system => {
          const last = lastVisit(system);
          const place = systemMeta(system)
            .map(part => part.text)
            .filter(Boolean)
            .join(' · ');
          const open = at === system.id;
          const here = system.id === hereId;
          return (
            <li key={system.id}>
              <button
                type="button"
                onClick={() => {
                  openSystem(system.id);
                }}
                aria-current={open ? 'true' : undefined}
                className={`system-row w-full grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-3 px-[18px] h-[58px] border-t border-hairline text-left ${
                  open
                    ? 'bg-scanner-cyan-tint shadow-[inset_3px_0_0_var(--color-scanner-cyan-glow)]'
                    : 'hover:bg-[rgba(148,163,184,0.06)]'
                }`}
              >
                <StarDot system={system} size="w-2.5 h-2.5" />
                <span className="min-w-0 flex flex-col gap-0.5">
                  <span title={system.name} className="truncate text-sm font-semibold text-ink-bright">
                    {system.name}
                    {system.favorite && (
                      <>
                        <span className="text-units-amber-text" aria-hidden="true">
                          {' ★'}
                        </span>
                        <span className="sr-only">, a favourite</span>
                      </>
                    )}
                  </span>
                  {place && (
                    <span title={place} className="truncate text-xs text-ink-muted">
                      {place}
                    </span>
                  )}
                </span>
                <span
                  className={`text-xs text-right whitespace-nowrap ${here ? 'text-units-amber-text' : 'text-ink-muted'}`}
                >
                  {here ? 'Here' : last ? formatAgo(last.at, now) : 'Never visited'}
                </span>
              </button>
            </li>
          );
        })}
        {systems.length > 0 && visible.length === 0 && (
          <li className="px-[18px] py-6 flex flex-col items-center gap-2 text-center text-sub text-ink-muted border-t border-hairline">
            No systems match these filters.
            <Button
              variant="ghost"
              onClick={() => {
                setSystemFilter({ ...DEFAULT_FILTER, sort: filter.sort });
              }}
            >
              Clear filters
            </Button>
          </li>
        )}
        {systems.length === 0 && (
          <li className="px-[18px] py-6 text-sub text-ink-muted border-t border-hairline">
            Your log is empty. Log a system after your next warp; only its name is needed.
          </li>
        )}
      </ul>
    </div>
  );
}
