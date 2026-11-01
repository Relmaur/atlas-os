// Fleet (design 08): the player's ships, Multi-Tools and Exosuit (state key `gear`, ADR-0007), each a card that opens
// to its technology grid with the supercharged slots marked. Flagships lead; the chips narrow by kind, S-class and
// whether any slot is marked.
import { useEffect, useState } from 'react';
import {
  ALL_GEAR,
  filterGear,
  fleetChips,
  gearLine,
  gearOrder,
  slotGrid,
  slotRules,
  type FleetFilter,
  type GearItem
} from '@atlas/core/gear';
import type { FactsFile } from '@atlas/core/facts';
import { useAppState } from '../useAppState.ts';
import { openGearEditor } from '../parts/editor-store.ts';
import { useSectionParam } from '../shell/section-store.ts';
import { LogSegment } from '../parts/LogSegment.tsx';
import { loadFacts, useFacts } from './facts-store.ts';
import { ClassPill, KindTile, TechGrid, gridLabel } from './fleet-bits.tsx';

const LABEL = 'text-label uppercase text-ink-label';

export function Gear() {
  const gear = gearOrder(useAppState().gear);
  const facts = useFacts();
  const [filter, setFilter] = useState<FleetFilter>(ALL_GEAR);
  // The flagship (or the first) starts open, as on the design; the rest open on tap.
  const [open, setOpen] = useState<Set<string>>(() => new Set(gear.slice(0, 1).map(item => item.id)));
  useEffect(() => {
    void loadFacts(); // each grid is drawn at the size the wiki gives for its kind and class
  }, []);
  const shown = filterGear(gear, filter);
  const allOpen = shown.length > 0 && shown.every(item => open.has(item.id));
  const toggle = (id: string, now: boolean) => {
    setOpen(current => {
      const next = new Set(current);
      if (now) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <header className="flex flex-col gap-1.5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-screen-title text-ink-bright">Fleet</h1>
          <button
            type="button"
            onClick={() => {
              openGearEditor(null, filter.kind ?? 'starship');
            }}
            aria-label="Add gear"
            className="w-11 h-11 rounded-control border border-control-edge bg-slate-ground grid place-items-center text-ink hover:border-control-edge-hover"
          >
            <i className="ph-bold ph-plus text-xl" aria-hidden="true" />
          </button>
        </div>
        <p className="text-sub text-ink-muted">Ships & Multi-Tools, with their supercharged slots.</p>
      </header>
      <LogSegment />

      {gear.length > 0 && (
        <div
          role="group"
          aria-label="Filters"
          className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible lg:mx-0 lg:px-0"
        >
          {fleetChips(gear, filter).map(chip => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={chip.on}
              onClick={() => {
                setFilter(chip.next);
              }}
              className={`relative shrink-0 h-8 px-3.5 rounded-full border text-[13px] font-semibold whitespace-nowrap after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] ${
                chip.on
                  ? 'bg-scanner-cyan-tint border-scanner-cyan-edge text-scanner-cyan-text'
                  : 'bg-slate-ground border-control-edge text-ink-soft hover:text-ink-bright'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {gear.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p id="fleetCount" className={LABEL} role="status">
            {shown.length === gear.length
              ? `${String(gear.length)} in your fleet`
              : `${String(shown.length)} of ${String(gear.length)} in your fleet`}
          </p>
          {shown.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setOpen(allOpen ? new Set() : new Set(shown.map(item => item.id)));
              }}
              className="text-caption font-semibold text-scanner-cyan-pale hover:text-quantity-cyan"
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
      )}

      {gear.length === 0 ? (
        <p className="text-sub text-ink-muted rounded-card border border-dashed border-control-edge px-4 py-3.5">
          No ships or Multi-Tools yet. Add the one you fly: its supercharged slots stay with it.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sub text-ink-muted">Nothing in your fleet matches these filters.</p>
      ) : (
        <ul id="fleetList" className="flex flex-col gap-3">
          {shown.map(item => (
            <li key={item.id}>
              <FleetCard
                item={item}
                facts={facts}
                open={open.has(item.id)}
                onToggle={now => {
                  toggle(item.id, now);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FleetCard({
  item,
  facts,
  open,
  onToggle
}: {
  item: GearItem;
  facts: FactsFile | null;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const openOnScreen = useSectionParam() === item.id;
  const rules = slotRules(facts, item.kind, item.class);
  // The grid the wiki gives for this kind and class (6 rows for an S-class ship), never smaller than the marks need.
  const grid = slotGrid(item.superchargedSlots, { rows: Math.min(rules.maxRows, 6), cols: rules.columns });
  const count = item.superchargedSlots.length;
  return (
    <details
      data-gear={item.id}
      open={open}
      onToggle={event => {
        onToggle(event.currentTarget.open);
      }}
      className="group rounded-card bg-panel-glass border border-hairline p-3.5 flex flex-col"
    >
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center gap-3 min-h-11">
        <KindTile kind={item.kind} />
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="font-display font-bold text-[14px] text-ink-bright truncate">{item.name}</span>
          <span className="text-caption text-ink-muted truncate">{gearLine(item) || ' '}</span>
        </span>
        {!open && (
          <span className={`font-mono text-[11px] shrink-0 ${count ? 'text-[#e9d5ff]' : 'text-ink-disabled'}`}>
            {count ? `${String(count)} SC` : '— SC'}
            <span className="sr-only"> (supercharged slots)</span>
          </span>
        )}
        <ClassPill value={item.class} />
        <i
          className="ph-bold ph-caret-down text-ink-label shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="flex flex-col gap-3 pt-3">
        <TechGrid
          rows={grid.rows}
          cols={grid.cols}
          marked={item.superchargedSlots}
          label={gridLabel(item.superchargedSlots, item.slotLabels)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {count ? (
            <span className="inline-flex items-center h-7 px-3 rounded-full border border-[rgba(192,132,252,0.5)] bg-[rgba(168,85,247,0.15)] text-[12px] font-semibold text-[#e9d5ff]">
              {count} supercharged
            </span>
          ) : (
            <span className="text-caption text-ink-muted">No supercharged slots marked yet.</span>
          )}
          <a
            href={`#ship/${encodeURIComponent(item.id)}`}
            aria-current={openOnScreen ? 'true' : undefined}
            className="text-caption font-semibold text-scanner-cyan-pale hover:text-quantity-cyan"
          >
            Open {item.name} →
          </a>
        </div>
      </div>
    </details>
  );
}
