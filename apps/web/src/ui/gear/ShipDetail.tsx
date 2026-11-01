// One ship, Multi-Tool or Exosuit on its own screen (#ship/<id>, design 09): its class, role and type, the technology
// grid with what sits in each supercharged slot, how that compares with the wiki's cited rules, the player's note, and
// the notes linked to it.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { rulesSummary, slotGrid, slotRules, type GearItem } from '@atlas/core/gear';
import { notesForGear, type Note } from '@atlas/core/notes';
import { useAppState } from '../useAppState.ts';
import { openGearEditor } from '../parts/editor-store.ts';
import { LinkedNoteRows } from '../notes/note-bits.tsx';
import { Button } from '../parts/Button.tsx';
import { renderNote } from '../notes/NoteCard.tsx';
import { ShareShipSheet } from '../share/ShareSheet.tsx';
import { goBack, useSectionParam } from '../shell/section-store.ts';
import { loadFacts, useFacts } from './facts-store.ts';
import { ClassPill, TechGrid, gridLabel } from './fleet-bits.tsx';
import { KINDS } from './kinds.ts';

const TOP_BUTTON =
  'w-11 h-11 rounded-control bg-slate-ground border border-control-edge grid place-items-center text-ink hover:border-control-edge-hover transition-colors duration-[var(--duration-micro)]';
const CARD = 'rounded-card bg-panel-glass border border-hairline p-4 flex flex-col gap-3';
const codexHref = (path: string) => `wiki/#/a/${encodeURIComponent(path)}`;

export function ShipDetail() {
  const id = useSectionParam();
  const state = useAppState();
  const item = state.gear.find(entry => entry.id === id);
  useEffect(() => {
    void loadFacts();
  }, []);
  if (!item)
    return (
      <div className="flex flex-col items-start gap-section pt-[env(safe-area-inset-top)]">
        <h1 className="font-display text-screen-title text-ink-bright">Not in your fleet</h1>
        <p className="text-sub text-ink-muted">It may have been removed, or the link is from another device’s log.</p>
        <Button
          onClick={() => {
            location.hash = '#gear';
          }}
        >
          Your fleet
        </Button>
      </div>
    );
  return <Ship item={item} linked={notesForGear(state.notes, item.id)} />;
}

function Ship({ item, linked }: { item: GearItem; linked: Note[] }) {
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => {
    setSharing(false);
  }, []);
  const facts = useFacts();
  const rules = slotRules(facts, item.kind, item.class);
  const grid = slotGrid(item.superchargedSlots, { rows: Math.min(rules.maxRows, 6), cols: rules.columns });
  const summary = rulesSummary(rules, item.kind, item.class, item.superchargedSlots);
  const html = useMemo(() => renderNote(item.notes), [item.notes]);
  const kind = KINDS[item.kind].label;
  return (
    <div className="flex flex-col gap-section max-w-2xl pt-[env(safe-area-inset-top)]">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <button
          type="button"
          onClick={() => {
            goBack('gear');
          }}
          aria-label="Back"
          className={TOP_BUTTON}
        >
          <i className="ph-bold ph-caret-left text-lg" aria-hidden="true" />
        </button>
        <span className="justify-self-center">
          <ClassPill value={item.class} size="L" />
        </span>
        <button
          type="button"
          onClick={() => {
            openGearEditor(item.id);
          }}
          aria-label={`Edit ${kind}`}
          className={TOP_BUTTON}
        >
          <i className="ph-bold ph-pencil-simple text-lg" aria-hidden="true" />
        </button>
      </div>

      <header className="flex flex-col gap-1">
        {item.role && (
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ready-emerald-lit">{item.role}</span>
        )}
        <h1
          id="shipTitle"
          className="font-display text-[28px] font-extrabold leading-[1.1] text-ink-bright break-words"
        >
          {item.name}
        </h1>
        <p className="text-sub text-ink-muted">{[item.type, kind].filter(Boolean).join(' · ')}</p>
      </header>

      <section aria-labelledby="techGridTitle" className={CARD}>
        <div className="flex items-center justify-between gap-3">
          <h2
            id="techGridTitle"
            className="flex items-center gap-2.5 font-display font-bold text-[15px] text-ink-bright"
          >
            <i className="ph-bold ph-cube text-[#c084fc]" aria-hidden="true" />
            Technology grid
          </h2>
          <span className="font-mono text-caption text-ink-muted">
            {grid.cols} × {grid.rows}
          </span>
        </div>
        <TechGrid
          rows={grid.rows}
          cols={grid.cols}
          marked={item.superchargedSlots}
          labels={item.slotLabels}
          gap="gap-1.5"
          label={gridLabel(item.superchargedSlots, item.slotLabels)}
        />
        {item.superchargedSlots.length > 0 ? (
          <ul aria-label="Supercharged slots" className="flex flex-wrap gap-2">
            {item.superchargedSlots.map(slot => (
              <li
                key={slot}
                title={item.slotLabels[slot]}
                className="inline-flex items-center h-7 px-3 rounded-full border border-[rgba(192,132,252,0.5)] bg-[rgba(168,85,247,0.12)] font-semibold text-[12px] text-[#e9d5ff]"
              >
                {slot}
                {item.slotLabels[slot] && <span className="sr-only">: {item.slotLabels[slot]}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption text-ink-muted">No supercharged slots marked yet. Edit to tap them on the grid.</p>
        )}
      </section>

      {summary && (
        <section
          id="shipRules"
          aria-labelledby="shipRulesTitle"
          className={`rounded-card p-4 flex flex-col gap-2.5 border ${
            summary.status === 'match'
              ? 'bg-panel-glass border-ready-emerald-edge-soft'
              : summary.status === 'off'
                ? 'bg-panel-glass border-[rgba(252,211,77,0.4)]'
                : 'bg-panel-glass border-hairline'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="shipRulesTitle"
              className="flex items-center gap-2.5 font-display font-bold text-[15px] text-ink-bright"
            >
              <i
                className={`ph-bold ${summary.status === 'match' ? 'ph-check text-ready-emerald-lit' : summary.status === 'off' ? 'ph-warning text-units-amber-text' : 'ph-info text-scanner-cyan-pale'}`}
                aria-hidden="true"
              />
              {summary.status === 'match'
                ? 'Matches the wiki'
                : summary.status === 'off'
                  ? 'Check against the wiki'
                  : 'Some slots not marked yet'}
            </h2>
            <span
              className={`shrink-0 inline-flex items-center h-7 px-3 rounded-full border font-semibold text-[12px] ${
                summary.status === 'match'
                  ? 'border-ready-emerald-edge text-ready-emerald-text bg-ready-emerald-tint'
                  : 'border-control-edge text-ink bg-slate-ground'
              }`}
            >
              {summary.count}
            </span>
          </div>
          <p className="text-sub text-ink-soft">{summary.sentence}</p>
          <p className="font-mono text-[11px] text-ink-muted">
            Sources:{' '}
            {[...new Map(rules.sources.map(fact => [fact.path, fact.page])).entries()].map(([path, page]) => (
              <span key={path}>
                <a href={codexHref(path)} className="text-scanner-cyan-pale hover:text-quantity-cyan underline">
                  {page}
                </a>
                {' · '}
              </span>
            ))}
            NMS wiki
          </p>
        </section>
      )}

      {item.notes.trim() && (
        <section aria-labelledby="shipNoteTitle" className={CARD}>
          <h2
            id="shipNoteTitle"
            className="flex items-center gap-2.5 font-display font-bold text-[15px] text-ink-bright"
          >
            <i className="ph-bold ph-file-text text-scanner-cyan-pale" aria-hidden="true" />
            Your note
          </h2>
          <div className="md-body text-[15px] text-ink" dangerouslySetInnerHTML={{ __html: html }} />
        </section>
      )}

      {linked.length > 0 && (
        <section aria-label="Linked notes">
          <LinkedNoteRows notes={linked} />
        </section>
      )}

      <Button
        icon="ph-link-simple"
        onClick={() => {
          setSharing(true);
        }}
      >
        Share
      </Button>
      <ShareShipSheet item={item} open={sharing} onClose={closeShare} />
    </div>
  );
}
