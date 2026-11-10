// The Systems filters (round 8, c21): one component, two presentations, so a filter means the same everywhere. On a
// phone the Filters and Sort buttons sit under search and open a bottom sheet and a listbox (02c–02g; 640 wide and
// centred at 768–1023, 02i); on the Workbench the list pane's funnel opens the same groups as a 420px popover (d01d).
// What's on is always visible as wrapping chips that remove themselves, with "n of N systems · Clear all". Filters
// apply as you tap. Nothing scrolls sideways; every target is 44px on a phone.
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type Ref
} from 'react';
import {
  CLEAR_FILTERS,
  filterPanel,
  type ActiveFilter,
  type FacetOption,
  type FilterPanel,
  type SystemFilter
} from '@atlas/core/systems-list';
import { SORTS, STAR_CLASSES, type StarClass, type System } from '@atlas/core/systems-model';
import { ConflictStars } from '../parts/Conflict.tsx';
import { SheetGrab, useSheetDrag, useSheetOpen } from '../parts/Sheet.tsx';
import { setSystemFilter } from './panel-store.ts';

const TAG_LIMIT = 12;
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
export const filtersLabel = (on: number) => (on ? `Filters, ${String(on)} on` : 'Filters');
const clearAll = () => {
  setSystemFilter(CLEAR_FILTERS);
};

const Dot = ({ star }: { star: StarClass }) => (
  <span
    aria-hidden="true"
    className="w-2.5 h-2.5 rounded-full shrink-0"
    style={{ background: STAR_CLASSES[star].color }}
  />
);
const Skull = () => <i aria-hidden="true" className="ph-bold ph-skull text-[1.05em]" />;

/** What a chip or option draws before its label: the star's colour, the conflict's stars or skull, a favourite's ★. */
function Mark({ item }: { item: Pick<ActiveFilter, 'star' | 'stars' | 'pirate' | 'favourite'> }) {
  if (item.star) return <Dot star={item.star} />;
  if (item.pirate) return <Skull />;
  if (item.stars) return <ConflictStars n={item.stars} />;
  if (item.favourite)
    return (
      <span aria-hidden="true" className="text-units-amber-text">
        ★
      </span>
    );
  return null;
}

// ── The toolbar: Filters (phone) ─────────────────────────────────────────────────────────────────────────────────

export function FiltersButton({
  on,
  open,
  onOpen,
  wide = false,
  ref
}: {
  on: number;
  open: boolean;
  onOpen: () => void;
  wide?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  const lit = on > 0 || open;
  const tone = lit
    ? 'border-ready-emerald-edge bg-[rgba(16,185,129,0.1)] text-ready-emerald-text'
    : 'border-control-edge bg-slate-ground text-ink hover:border-control-edge-hover';
  const badge = on > 0 && (
    <span
      aria-hidden="true"
      className={`rounded-full bg-ready-emerald text-ready-emerald-ink font-bold grid place-items-center ${
        wide
          ? 'absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 text-[11px]'
          : 'min-w-[22px] h-[22px] px-1.5 text-[12px]'
      }`}
    >
      {on}
    </span>
  );
  return (
    <button
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      // The funnel is an icon, so it carries its name; the phone's button says it in its text ("Filters", ", 3 on").
      aria-label={wide ? filtersLabel(on) : undefined}
      onClick={onOpen}
      className={
        wide
          ? `relative w-[38px] h-[38px] shrink-0 rounded-control border grid place-items-center ${tone}`
          : `min-w-0 h-11 px-3 rounded-control border inline-flex items-center gap-2 text-[14px] font-semibold whitespace-nowrap ${tone}`
      }
    >
      <i aria-hidden="true" className={`ph-bold ${wide ? 'ph-funnel' : 'ph-funnel-simple'} text-[18px]`} />
      {!wide && <span>Filters</span>}
      {badge}
      {!wide && on > 0 && <span className="sr-only">{`, ${String(on)} on`}</span>}
    </button>
  );
}

// ── Sort (phone): a button and a listbox of the five sorts (02d) ─────────────────────────────────────────────────

export function SortMenu({ sort }: { sort: SystemFilter['sort'] }) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(SORTS) as SystemFilter['sort'][];
  const [active, setActive] = useState(keys.indexOf(sort));
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !box.current?.contains(event.target)) close(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, close]);
  const pick = (key: SystemFilter['sort']) => {
    setSystemFilter({ sort: key });
    close(true);
  };
  const onKey = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step) {
      event.preventDefault();
      setActive((active + step + keys.length) % keys.length);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : keys.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const key = keys[active];
      if (key) pick(key);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      close(event.key === 'Escape');
    }
  };
  return (
    <div ref={box} className="relative min-w-0">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sort: ${SORTS[sort]}`}
        onClick={() => {
          setActive(keys.indexOf(sort));
          setOpen(!open);
        }}
        className="w-full h-11 px-3 rounded-control border border-control-edge bg-slate-ground text-ink hover:border-control-edge-hover inline-flex items-center gap-2 text-[14px] font-semibold whitespace-nowrap"
      >
        <i aria-hidden="true" className="ph-bold ph-arrows-down-up text-[18px]" />
        <span className="flex-1 min-w-0 truncate text-left font-medium text-ink-muted">{SORTS[sort]}</span>
        <i aria-hidden="true" className="ph-bold ph-caret-down text-[14px] text-ink-muted" />
      </button>
      {open && (
        <ul
          ref={list}
          role="listbox"
          aria-label="Sort"
          tabIndex={-1}
          aria-activedescendant={`${id}-${String(active)}`}
          onKeyDown={onKey}
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-full min-w-[180px] m-0 p-0 list-none rounded-control border border-control-edge bg-[#0b1325] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)] overflow-hidden focus:outline-hidden"
        >
          {keys.map((key, i) => {
            const selected = key === sort;
            return (
              <li
                key={key}
                id={`${id}-${String(i)}`}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  pick(key);
                }}
                onPointerMove={() => {
                  setActive(i);
                }}
                className={`h-12 px-4 flex items-center gap-3 border-t border-hairline first:border-t-0 cursor-pointer text-[16px] ${
                  selected ? 'bg-scanner-cyan-tint text-ink-bright' : 'text-ink'
                } ${i === active ? 'outline-2 -outline-offset-2 outline-scanner-cyan-glow' : ''}`}
              >
                <i
                  aria-hidden="true"
                  className={`ph-bold ph-check w-5 text-scanner-cyan-glow ${selected ? '' : 'invisible'}`}
                />
                {SORTS[key]}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── What's on: wrapping chips and "n of N systems · Clear all" ───────────────────────────────────────────────────

export function ActiveFilters({
  active,
  matching,
  total,
  q,
  focusFilters,
  wide = false
}: {
  active: ActiveFilter[];
  matching: number;
  total: number;
  q: string;
  /** Where focus goes when the last chip is removed. */
  focusFilters: () => void;
  wide?: boolean;
}) {
  const chips = useRef<HTMLDivElement>(null);
  // After a chip removes itself, focus moves to the chip now in its place, else back to Filters (c21).
  const focusAt = useRef<number | null>(null);
  useEffect(() => {
    if (focusAt.current === null) return;
    const next = chips.current?.querySelectorAll('button')[focusAt.current];
    focusAt.current = null;
    if (next) next.focus();
    else focusFilters();
  });
  const line = `${matching.toLocaleString()} of ${plural(total, 'system')}`;
  return (
    <>
      {active.length > 0 && (
        <div ref={chips} role="group" aria-label="Filters on" className="flex flex-wrap gap-2">
          {active.map((chip, i) => (
            <button
              key={chip.id}
              type="button"
              aria-label={chip.spoken}
              onClick={() => {
                focusAt.current = i;
                setSystemFilter(chip.next);
              }}
              className={`relative max-w-full rounded-full border border-[rgba(52,211,153,0.45)] bg-ready-emerald-tint text-ready-emerald-bright font-semibold inline-flex items-center gap-1.5 hover:border-ready-emerald-edge-hover after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] ${
                wide ? 'h-8 pl-2.5 pr-2 text-[12.5px]' : 'h-9 pl-3 pr-2 text-[13px]'
              }`}
            >
              <Mark item={chip} />
              <span className="truncate">{chip.label}</span>
              <i aria-hidden="true" className="ph-bold ph-x text-[0.9em] shrink-0" />
            </button>
          ))}
        </div>
      )}
      {/* Always in the page, so the count is announced as it changes; shown only while chips are on. */}
      <div className={active.length ? 'flex items-center justify-between gap-3' : 'contents'}>
        <p
          id="systemResultCount"
          role="status"
          className={active.length ? 'm-0 text-[12.5px] text-ink-muted' : 'sr-only'}
        >
          {active.length || q.trim() ? line : ''}
        </p>
        {active.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearAll();
              focusFilters();
            }}
            className={`shrink-0 px-1 text-[13px] font-semibold text-scanner-cyan-pale hover:text-quantity-cyan ${wide ? 'h-8' : 'h-11'}`}
          >
            Clear all
          </button>
        )}
      </div>
    </>
  );
}

// ── The groups ───────────────────────────────────────────────────────────────────────────────────────────────────

const optionClass = (on: boolean, compact: boolean) =>
  `group max-w-full px-3 rounded-control border inline-flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-[var(--duration-micro)] ${
    compact ? 'h-10' : 'h-11'
  } ${
    on
      ? 'is-on border-[rgba(52,211,153,0.55)] bg-[rgba(16,185,129,0.14)] text-ready-emerald-bright'
      : 'border-control-edge bg-slate-ground text-ink-soft hover:border-control-edge-hover'
  }`;
const Count = ({ n }: { n: number }) => (
  <span
    aria-hidden="true"
    className="font-mono text-[11.5px] font-medium text-ink-disabled group-[.is-on]:text-ready-emerald-pale"
  >
    {n}
  </span>
);

function GroupHead({ id, title, hint }: { id: string; title: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 id={id} className="m-0 text-[11px] font-semibold tracking-[0.16em] uppercase text-ink-label">
        {title}
      </h3>
      <span className="text-[12px] text-ink-muted">{hint}</span>
    </div>
  );
}

/** Star class, race or conflict: one at a time, Any first. Arrows move between options, Space or Enter picks. */
function RadioGroup({
  title,
  field,
  options,
  compact
}: {
  title: string;
  field: 'star' | 'race' | 'conflict';
  options: FacetOption[];
  compact: boolean;
}) {
  const id = useId();
  const group = useRef<HTMLDivElement>(null);
  if (!options.length) return null;
  const all: (FacetOption | null)[] = [null, ...options]; // null is Any
  const picked = Math.max(
    0,
    all.findIndex(option => option?.on)
  );
  const onKey = (event: KeyboardEvent) => {
    const step = ['ArrowRight', 'ArrowDown'].includes(event.key)
      ? 1
      : ['ArrowLeft', 'ArrowUp'].includes(event.key)
        ? -1
        : 0;
    if (!step) return;
    event.preventDefault();
    const radios = [...(group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])];
    const at = radios.findIndex(radio => radio === document.activeElement);
    radios[(at + step + radios.length) % radios.length]?.focus();
  };
  return (
    <section className="flex flex-col gap-2.5">
      <GroupHead id={id} title={title} hint="one at a time" />
      <div ref={group} role="radiogroup" aria-labelledby={id} onKeyDown={onKey} className="flex flex-wrap gap-2">
        {all.map((option, i) => {
          const on = i === picked;
          return (
            <button
              key={option?.value ?? 'any'}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => {
                setSystemFilter(option ? { [field]: option.value } : { [field]: '' });
              }}
              className={optionClass(on, compact)}
            >
              {option ? (
                <>
                  <Mark item={option} />
                  <span className="truncate">{option.label}</span>
                  <Count n={option.count} />
                  <span className="sr-only">{option.spoken.slice(option.label.length)}</span>
                </>
              ) : (
                'Any'
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ShowOnlyGroup({ rows }: { rows: FilterPanel['showOnly'] }) {
  const id = useId();
  if (!rows.length) return null;
  return (
    <section className="flex flex-col gap-2.5" aria-labelledby={id}>
      <GroupHead id={id} title="Show only" hint="" />
      <div className="rounded-[18px] border border-hairline bg-panel-glass overflow-hidden">
        {rows.map(row => (
          <div
            key={row.key}
            className="flex items-center gap-3 px-3.5 py-1 min-h-[52px] border-t border-hairline first:border-t-0"
          >
            <span className="flex-1 min-w-0">
              <span id={`${id}-${row.key}`} className="flex items-center gap-2 text-[14px] text-ink-bright">
                {row.key === 'favorites' ? (
                  <span aria-hidden="true" className="text-units-amber-text">
                    ★
                  </span>
                ) : (
                  <i aria-hidden="true" className="ph-bold ph-map-pin-plus text-[#67e8f9]" />
                )}
                {row.label}
              </span>
              <span className="block text-[11.5px] text-ink-muted">{row.hint}</span>
            </span>
            <Count n={row.count} />
            <button
              type="button"
              role="switch"
              aria-checked={row.on}
              aria-label={`${row.label}, ${row.count.toLocaleString()}`}
              id={row.key === 'favorites' ? 'systemFavFilter' : undefined}
              onClick={() => {
                setSystemFilter(row.next);
              }}
              className="switch"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function TagsGroup({ tags, compact }: { tags: FacetOption[]; compact: boolean }) {
  const id = useId();
  const [find, setFind] = useState('');
  const [showAll, setShowAll] = useState(false);
  if (!tags.length) return null;
  const query = find.trim().toLowerCase();
  const many = tags.length > TAG_LIMIT;
  const found = query ? tags.filter(tag => tag.value.toLowerCase().includes(query)) : tags;
  // Past 12, the most used show first; a tag that's on always shows, so it can be turned off here too.
  const shown = query || showAll || !many ? found : found.filter((tag, i) => i < TAG_LIMIT || tag.on);
  return (
    <section className="flex flex-col gap-2.5">
      <GroupHead id={id} title="Tags" hint="systems with all you pick" />
      {many && (
        <label className="relative block">
          <i
            aria-hidden="true"
            className="ph ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          />
          <input
            type="search"
            autoComplete="off"
            value={find}
            onChange={event => {
              setFind(event.target.value);
            }}
            placeholder={`Find one of ${String(tags.length)} tags`}
            aria-label={`Find one of ${String(tags.length)} tags`}
            className="w-full h-11 rounded-control border border-control-edge focus:border-scanner-cyan-edge-strong bg-slate-ground pl-10 pr-3 text-base text-ink-bright placeholder:text-ink-disabled focus:outline-hidden"
          />
        </label>
      )}
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {shown.map(tag => (
          <button
            key={tag.value}
            type="button"
            aria-pressed={tag.on}
            onClick={() => {
              setSystemFilter(tag.next);
            }}
            className={optionClass(tag.on, compact)}
          >
            <span className="truncate">{tag.label}</span>
            <Count n={tag.count} />
            <span className="sr-only">{tag.spoken.slice(tag.label.length)}</span>
          </button>
        ))}
        {query && !found.length && <p className="m-0 text-sub text-ink-muted">{`No tag has “${find.trim()}”.`}</p>}
      </div>
      {many && !query && !showAll && (
        <button
          type="button"
          onClick={() => {
            setShowAll(true);
          }}
          className="self-start h-11 px-1 text-[15px] font-semibold text-quantity-cyan hover:text-scanner-cyan-glow"
        >
          {`Show all ${String(tags.length)} tags`}
        </button>
      )}
    </section>
  );
}

function FiltersBody({
  systems,
  filter,
  matching,
  titleId,
  title,
  compact,
  footer
}: {
  systems: System[];
  filter: SystemFilter;
  matching: number;
  titleId: string;
  title: RefObject<HTMLHeadingElement | null>;
  compact: boolean;
  footer: ReactNode;
}) {
  const panel = filterPanel(systems, filter);
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 pb-4">
        <h2
          ref={title}
          id={titleId}
          tabIndex={-1}
          className={`m-0 font-display font-bold text-ink-bright focus:outline-hidden ${compact ? 'text-[17px]' : 'text-[22px]'}`}
        >
          Filters
        </h2>
        <span className={`text-ink-muted ${compact ? 'text-[13px] mr-12' : 'text-[14px]'}`}>
          {`${matching.toLocaleString()} of ${systems.length.toLocaleString()} match`}
        </span>
      </div>
      <div className="flex flex-col gap-6">
        <ShowOnlyGroup rows={panel.showOnly} />
        <RadioGroup title="Star class" field="star" options={panel.star} compact={compact} />
        <RadioGroup title="Race" field="race" options={panel.race} compact={compact} />
        <RadioGroup title="Conflict" field="conflict" options={panel.conflict} compact={compact} />
        <TagsGroup tags={panel.tags} compact={compact} />
      </div>
      {footer}
    </>
  );
}

// ── Phone: the sheet ─────────────────────────────────────────────────────────────────────────────────────────────

export function FiltersSheet({
  open,
  onClose,
  systems,
  filter,
  matching
}: {
  open: boolean;
  onClose: () => void;
  systems: System[];
  filter: SystemFilter;
  matching: number;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const on = filterPanel(systems, filter).active.length;
  useSheetDrag(sheet, onClose);
  useSheetOpen(open, onClose, { layout: '(max-width: 1023px)', focus: title });
  return (
    <div className="lg:hidden">
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] transition-opacity duration-200 ${open ? '' : 'opacity-0 pointer-events-none'}`}
      />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
        inert={!open}
        className={`fixed z-50 inset-x-0 bottom-0 mx-auto w-full max-w-[640px] max-h-[92dvh] flex flex-col rounded-t-sheet border-t border-x border-control-edge bg-[#020617] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? '' : 'translate-y-full'}`}
      >
        <div data-sheet-grab className="px-5 pt-3">
          <SheetGrab onClose={onClose} label="Close Filters" />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-6">
          {open && (
            <FiltersBody
              systems={systems}
              filter={filter}
              matching={matching}
              titleId={titleId}
              title={title}
              compact={false}
              footer={null}
            />
          )}
        </div>
        <div className="flex items-center gap-3 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-hairline">
          <button
            type="button"
            disabled={!on}
            onClick={clearAll}
            className="h-12 px-4 text-[16px] font-semibold text-quantity-cyan disabled:text-ink-disabled"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-control border border-ready-emerald-edge bg-ready-emerald-tint text-ready-emerald-text text-[16px] font-semibold hover:bg-ready-emerald-tint-hover"
          >
            {`Show ${plural(matching, 'system')}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Workbench: the funnel and its popover (d01d) ─────────────────────────────────────────────────────────────────

export function FiltersPopover({
  systems,
  filter,
  matching,
  buttonRef
}: {
  systems: System[];
  filter: SystemFilter;
  matching: number;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const on = filterPanel(systems, filter).active.length;
  const dismiss = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, [buttonRef]);
  // The list pane clips what overflows it, and the popover is wider than the pane (d01d): it's fixed under the
  // funnel, kept on screen, and stays next to the funnel in the page so Tab order is unchanged.
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) setAt({ left: Math.max(16, Math.min(rect.left, innerWidth - 420 - 16)), top: rect.bottom + 8 });
    };
    place();
    addEventListener('resize', place);
    return () => {
      removeEventListener('resize', place);
    };
  }, [open, buttonRef]);
  useEffect(() => {
    if (!open) return;
    title.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !box.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, dismiss]);
  return (
    <div ref={box} className="relative shrink-0">
      <FiltersButton
        ref={buttonRef}
        wide
        on={on}
        open={open}
        onOpen={() => {
          setOpen(!open);
        }}
      />
      {open && (
        <div
          role="dialog"
          aria-labelledby={titleId}
          style={at ? { left: at.left, top: at.top, maxHeight: `calc(100dvh - ${String(at.top + 20)}px)` } : undefined}
          className="fixed z-40 w-[420px] flex flex-col rounded-panel border border-control-edge bg-[#060b17] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
        >
          <span
            aria-hidden="true"
            className="absolute right-5 top-5 h-6 px-1.5 rounded-[6px] border border-control-edge font-mono text-[11px] text-ink-muted grid place-items-center"
          >
            Esc
          </span>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-5">
            <FiltersBody
              systems={systems}
              filter={filter}
              matching={matching}
              titleId={titleId}
              title={title}
              compact
              footer={null}
            />
          </div>
          <div className="flex justify-end px-5 py-3 border-t border-hairline">
            <button
              type="button"
              disabled={!on}
              onClick={clearAll}
              className="h-10 px-4 rounded-control border border-control-edge bg-slate-ground text-[14px] font-semibold text-ink-bright hover:border-control-edge-hover disabled:text-ink-disabled"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
