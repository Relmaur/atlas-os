// The Run editor (design 32): a bottom sheet below lg, a side panel from lg up. A run is a name, a line about it,
// what it earns, ordered steps (a verb and a system from the log, a wiki item, or free text), timing, and a live
// estimate checked against the game data. Runs stay the player's own: sharing between players isn't built.
import { useCallback, useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react';
import { newId } from '@atlas/core/systems-model';
import {
  MAX_STEPS,
  RUN_EARNS,
  RUN_VERBS,
  checkStep,
  runEstimate,
  runStatus,
  snapshotRun,
  stepRanges,
  type PlayerRun,
  type RunStep,
  type RunVerb
} from '@atlas/core/runs';
import type { Catalog } from '@atlas/core/planner';
import { deleteRun, saveRun } from '../actions.ts';
import { showToast } from '../../app/ui.ts';
import { useAppState } from '../useAppState.ts';
import { PanelGrab, SheetGrab, useSheetDrag } from '../parts/Sheet.tsx';
import { Button } from '../parts/Button.tsx';
import { ArmButton } from '../parts/Gesture.tsx';
import { FIELD, LABEL_FIELD, Segments } from '../systems/editor-parts.tsx';
import { closeRunEditor } from './run-editor-store.ts';
import { useGameVersion } from './run-bits.tsx';

// What a step's number counts, by verb; Go and Do have none.
const QTY_LABEL: Partial<Record<RunVerb, string>> = {
  farm: 'Plants',
  refine: 'Refiners',
  craft: 'Made',
  sell: 'Sold'
};
const VERB_TONE: Record<RunVerb, string> = {
  go: 'border-scanner-cyan-edge bg-scanner-cyan-tint text-quantity-cyan',
  farm: 'border-ready-emerald-edge bg-ready-emerald-tint text-ready-emerald-text',
  refine: 'border-[rgba(192,132,252,0.5)] bg-[rgba(168,85,247,0.12)] text-[#e9d5ff]',
  craft: 'border-scanner-cyan-edge bg-scanner-cyan-tint text-quantity-cyan',
  sell: 'border-units-amber-edge bg-units-amber-tint text-units-amber-pale',
  do: 'border-control-edge bg-slate-ground text-ink-soft'
};
// The kinds of wiki page a step's item can be.
const ITEM_CATEGORIES = new Set(['resources', 'products', 'cooking', 'fish', 'technology', 'building']);
const SUGGESTIONS = 8;
const formatUnits = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toLocaleString());

function blankRun(): PlayerRun {
  const now = new Date().toISOString();
  return {
    id: newId('run'),
    name: '',
    line: '',
    earns: 'units',
    steps: [],
    runMinutes: null,
    repeatMinutes: null,
    timer: false,
    checked: { version: '', values: {} },
    createdAt: now,
    updatedAt: now
  };
}
const blankStep = (verb: RunVerb): RunStep => ({
  id: newId('step'),
  verb,
  target: '',
  systemId: '',
  qty: null,
  price: null
});
const number = (value: string): number | null => (value.trim() === '' ? null : Math.max(0, Number(value)) || null);

export function RunEditor({ existing, catalog }: { existing: PlayerRun | undefined; catalog: Catalog | null }) {
  const state = useAppState();
  const game = useGameVersion();
  const [draft, setDraft] = useState<PlayerRun>(() => existing ?? blankRun());
  const [original] = useState(() => JSON.stringify(draft));
  const [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== original;
  const set = (changes: Partial<PlayerRun>) => {
    setDraft(current => ({ ...current, ...changes }));
  };
  const setStep = (id: string, changes: Partial<RunStep>) => {
    setDraft(current => ({
      ...current,
      steps: current.steps.map(step => (step.id === id ? { ...step, ...changes } : step))
    }));
  };
  const moveStep = (index: number, by: number) => {
    setDraft(current => {
      const steps = [...current.steps];
      const [step] = steps.splice(index, 1);
      if (step) steps.splice(index + by, 0, step);
      return { ...current, steps };
    });
  };
  const estimate = runEstimate(draft, catalog, state.systems);
  const retired = existing && runStatus(existing, catalog) === 'changed';
  const items = useMemo(
    () =>
      catalog
        ? [...catalog.byTitle.values()]
            .filter(item => !item.obsolete && ITEM_CATEGORIES.has(item.category))
            .map(item => item.title)
            .sort((a, b) => a.localeCompare(b))
        : [],
    [catalog]
  );

  // Esc, the bar, a swipe and a tap outside leave only when nothing would be lost; Cancel discards.
  const dismiss = useCallback(() => {
    if (dirty) showToast('Unsaved changes: save, or Cancel to discard.');
    else closeRunEditor();
  }, [dirty]);
  const sheet = useRef<HTMLDivElement>(null);
  useSheetDrag(sheet, dismiss);
  const latest = useRef(dismiss);
  useEffect(() => {
    latest.current = dismiss;
  }, [dismiss]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('overflow-hidden');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('overflow-hidden');
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const steps = draft.steps.filter(step => step.target.trim());
    if (!draft.name.trim()) {
      setError('Give it a name.');
      return;
    }
    if (!steps.length) {
      setError('Add a step.');
      return;
    }
    // Checked against the game data now, if it's in; otherwise saved unchecked, and Runs says so.
    const checked = catalog && game ? snapshotRun({ steps }, catalog, game.version) : { version: '', values: {} };
    saveRun({ ...draft, steps, checked, updatedAt: new Date().toISOString() });
    closeRunEditor();
  };

  return (
    <>
      <div onClick={dismiss} className="fixed inset-0 z-[60] bg-scrim backdrop-blur-[2px]" />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="runEditorTitle"
        className="kb-sheet fixed z-[61] flex flex-col bg-slate-deep border-control-edge inset-x-0 bottom-0 h-[92dvh] rounded-t-sheet border-t lg:inset-x-auto lg:right-5 lg:top-5 lg:bottom-5 lg:h-auto lg:w-[620px] lg:rounded-panel lg:overflow-hidden lg:border"
      >
        <PanelGrab onClose={dismiss} label="Close run editor" />
        <form id="runEditor" onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div data-sheet-grab className="sticky top-0 z-10 bg-slate-deep/95 backdrop-blur px-5 pt-3 lg:pt-5 pb-3">
              <SheetGrab onClose={dismiss} label="Close run editor" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h2
                    id="runEditorTitle"
                    className="font-display font-extrabold text-[22px] leading-tight text-ink-bright"
                  >
                    {existing ? 'Edit run' : 'New run'}
                  </h2>
                  <p className="text-sub text-ink-muted">
                    Your own route to Units, Nanites or items. Each step is checked against the game data, so you’ll
                    know when an update changes it.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 pt-3.5 pb-6 flex flex-col gap-4">
              <label className={LABEL_FIELD}>
                Name
                <input
                  id="runName"
                  required
                  maxLength={80}
                  autoFocus
                  placeholder="e.g. Cryo-Pump loop"
                  value={draft.name}
                  onChange={event => {
                    set({ name: event.target.value });
                  }}
                  className={FIELD}
                />
              </label>
              <label className={LABEL_FIELD}>
                One line about it
                <input
                  maxLength={140}
                  placeholder="What it does, in a few words"
                  value={draft.line}
                  onChange={event => {
                    set({ line: event.target.value });
                  }}
                  className={FIELD}
                />
              </label>
              <Segments
                label="It earns"
                value={draft.earns}
                options={Object.entries(RUN_EARNS)}
                onChange={value => {
                  if (value in RUN_EARNS) set({ earns: value as PlayerRun['earns'] }); // checked just before
                }}
              />

              <section
                aria-labelledby="runStepsTitle"
                className="rounded-card border border-hairline bg-panel-glass p-4 flex flex-col gap-2.5"
              >
                <h3 id="runStepsTitle" className="font-display font-bold text-[15px] text-ink-bright">
                  Steps
                </h3>
                <ol id="runSteps" className="flex flex-col gap-2.5">
                  {draft.steps.map((step, index) => (
                    <Step
                      key={step.id}
                      step={step}
                      index={index}
                      last={index === draft.steps.length - 1}
                      catalog={catalog}
                      items={items}
                      onChange={changes => {
                        setStep(step.id, changes);
                      }}
                      onMove={by => {
                        moveStep(index, by);
                      }}
                      onRemove={() => {
                        set({ steps: draft.steps.filter(other => other.id !== step.id) });
                      }}
                    />
                  ))}
                </ol>
                {draft.steps.length < MAX_STEPS && (
                  <button
                    type="button"
                    onClick={() => {
                      set({ steps: [...draft.steps, blankStep(draft.steps.length ? 'do' : 'go')] });
                    }}
                    className="h-12 rounded-control border border-dashed border-control-edge-hover text-ink flex items-center justify-center gap-2 text-[14px] font-semibold hover:border-scanner-cyan-edge-strong"
                  >
                    <i className="ph-bold ph-plus" aria-hidden="true" />
                    Add a step
                  </button>
                )}
                <p className="text-caption text-ink-muted">
                  Pick a verb, then a system from your log or an item from the wiki. Free text works too; it just can’t
                  be checked.
                </p>
              </section>

              <section
                aria-labelledby="runTimingTitle"
                className="rounded-card border border-hairline bg-panel-glass p-4 flex flex-col gap-3"
              >
                <h3 id="runTimingTitle" className="font-display font-bold text-[15px] text-ink-bright">
                  Timing
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Minutes
                    label="One run takes"
                    value={draft.runMinutes}
                    onChange={runMinutes => {
                      set({ runMinutes });
                    }}
                  />
                  <Minutes
                    label="Can repeat every"
                    value={draft.repeatMinutes}
                    onChange={repeatMinutes => {
                      set({ repeatMinutes });
                    }}
                  />
                </div>
                <label className="flex items-center gap-3 text-sub text-ink">
                  <input
                    type="checkbox"
                    checked={draft.timer}
                    onChange={event => {
                      set({ timer: event.target.checked });
                    }}
                    className="w-5 h-5 accent-emerald-400"
                  />
                  Start a timer when I finish a run
                </label>
              </section>

              <section
                id="runEstimate"
                aria-labelledby="runEstimateTitle"
                className="rounded-card border border-units-amber-edge bg-panel-glass p-4 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 id="runEstimateTitle" className="font-display font-bold text-[15px] text-ink-bright">
                    One full run
                  </h3>
                  {estimate.byYourNumbers ? (
                    <span className="h-6 px-2.5 rounded-full inline-flex items-center border border-control-edge text-[11px] font-semibold text-ink-soft">
                      by your numbers
                    </span>
                  ) : (
                    catalog &&
                    game && (
                      <span className="h-6 px-2.5 rounded-full inline-flex items-center border border-ready-emerald-edge bg-ready-emerald-tint text-[11px] font-semibold text-ready-emerald-text">
                        checked · v{game.version}
                      </span>
                    )
                  )}
                </div>
                {estimate.units ? (
                  <dl className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-sub text-ink-soft">
                        Units, {estimate.byYourNumbers ? 'by your numbers' : 'from wiki prices'}
                      </dt>
                      <dd className="font-mono text-[22px] text-units-amber-text">
                        ≈ {estimate.units.toLocaleString()}
                      </dd>
                    </div>
                    {estimate.perHour !== null && (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-sub text-ink-soft">Per hour of play</dt>
                        <dd className="font-mono text-[15px] text-ink">≈ {formatUnits(estimate.perHour)}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-sub text-ink-muted">
                    Add a Sell step with an item from the wiki to estimate Units.
                  </p>
                )}
                <p className="text-caption text-ink-muted">
                  {catalog
                    ? estimate.wikiSteps.length
                      ? `${stepRanges(estimate.wikiSteps)} ${estimate.wikiSteps.length === 1 ? 'uses' : 'use'} wiki values. Set your own price on a Sell step and it says “by your numbers”.`
                      : 'No step uses wiki values yet.'
                    : 'The game data isn’t loaded, so steps can’t be checked yet.'}
                  {retired &&
                    ` Checked in v${existing.checked.version}; an update changed a value it relied on. Saving checks it again.`}
                </p>
              </section>

              {existing && (
                <ArmButton
                  label="Delete run"
                  armedLabel="Tap again to delete"
                  onConfirm={() => {
                    deleteRun(existing.id);
                    closeRunEditor();
                  }}
                />
              )}
            </div>
          </div>

          <div className="bg-slate-deep/95 backdrop-blur border-t border-hairline px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex flex-col gap-2">
            {error && (
              <p role="alert" className="text-caption text-danger-rose-text">
                {error}
              </p>
            )}
            <div className="grid grid-cols-[1fr_2fr] gap-2.5">
              <Button size="L" onClick={closeRunEditor}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save run
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

function Step({
  step,
  index,
  last,
  catalog,
  items,
  onChange,
  onMove,
  onRemove
}: {
  step: RunStep;
  index: number;
  last: boolean;
  catalog: Catalog | null;
  items: string[];
  onChange: (changes: Partial<RunStep>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const state = useAppState();
  const [menu, setMenu] = useState(false);
  const n = index + 1;
  const check = step.target.trim() ? checkStep(step, catalog, state.systems) : null;
  const listId = `runStepOptions-${step.id}`;
  const typed = step.target.trim().toLowerCase();
  const options =
    step.verb === 'go'
      ? state.systems.map(system => system.name)
      : step.verb === 'do' || !typed
        ? []
        : items
            .filter(title => title.toLowerCase().includes(typed))
            .sort((a, b) => Number(!a.toLowerCase().startsWith(typed)) - Number(!b.toLowerCase().startsWith(typed)))
            .slice(0, SUGGESTIONS);
  const qtyLabel = QTY_LABEL[step.verb];
  return (
    <li className="rounded-control border border-hairline bg-slate-ground p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="w-7 h-7 shrink-0 rounded-full grid place-items-center border border-control-edge font-mono text-[12px] text-ink-soft"
        >
          {n}
        </span>
        {/* A chip with a caret, not the platform's wide select box, so the item's name keeps the room. */}
        <span className="relative shrink-0">
          <select
            aria-label={`Step ${String(n)} verb`}
            value={step.verb}
            onChange={event => {
              if (event.target.value in RUN_VERBS) onChange({ verb: event.target.value as RunVerb, systemId: '' }); // checked just before
            }}
            className={`appearance-none field-sizing-content h-8 pl-2.5 pr-6 rounded-[9px] border text-[13px] font-semibold ${VERB_TONE[step.verb]}`}
          >
            {Object.entries(RUN_VERBS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <i
            className="ph-bold ph-caret-down pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] opacity-80"
            aria-hidden="true"
          />
        </span>
        <input
          aria-label={`Step ${String(n)}: ${step.verb === 'go' ? 'system' : step.verb === 'do' ? 'what to do' : 'item'}`}
          list={listId}
          maxLength={120}
          placeholder={step.verb === 'go' ? 'A system from your log' : step.verb === 'do' ? 'Anything' : 'An item'}
          value={step.target}
          onChange={event => {
            const target = event.target.value;
            onChange({
              target,
              systemId: step.verb === 'go' ? (state.systems.find(system => system.name === target)?.id ?? '') : ''
            });
          }}
          className="flex-1 min-w-0 h-9 rounded-[9px] border border-transparent bg-transparent px-1.5 text-[15px] font-semibold text-ink-bright placeholder:text-ink-disabled placeholder:font-normal focus:border-scanner-cyan-edge-strong focus:outline-hidden"
        />
        <datalist id={listId}>
          {options.map(option => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <button
          type="button"
          aria-label={`Step ${String(n)} options`}
          aria-expanded={menu}
          onClick={() => {
            setMenu(!menu);
          }}
          className="w-9 h-9 shrink-0 rounded-[9px] grid place-items-center text-ink-muted hover:text-ink-bright hover:bg-panel"
        >
          <i className="ph-bold ph-dots-three text-lg" aria-hidden="true" />
        </button>
      </div>
      {menu && (
        <div className="flex flex-wrap gap-1.5 pl-9">
          <Button
            size="S"
            disabled={index === 0}
            onClick={() => {
              onMove(-1);
            }}
          >
            Move up
          </Button>
          <Button
            size="S"
            disabled={last}
            onClick={() => {
              onMove(1);
            }}
          >
            Move down
          </Button>
          <Button size="S" variant="danger" onClick={onRemove}>
            Remove
          </Button>
        </div>
      )}
      {(qtyLabel ?? check) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-9">
          {qtyLabel && (
            <label className="flex items-center gap-1.5 text-caption text-ink-soft">
              {qtyLabel}
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={step.qty ?? ''}
                onChange={event => {
                  onChange({ qty: number(event.target.value) });
                }}
                className="w-20 h-8 rounded-[9px] border border-control-edge bg-slate-deep px-2 font-mono text-[14px] text-ink-bright focus:border-scanner-cyan-edge-strong focus:outline-hidden"
              />
            </label>
          )}
          {step.verb === 'sell' && (
            <label className="flex items-center gap-1.5 text-caption text-ink-soft">
              Your price
              <input
                type="number"
                min={1}
                inputMode="numeric"
                placeholder={check?.value ? String(check.value) : 'Units'}
                value={step.price ?? ''}
                onChange={event => {
                  onChange({ price: number(event.target.value) });
                }}
                className="w-28 h-8 rounded-[9px] border border-control-edge bg-slate-deep px-2 font-mono text-[14px] text-ink-bright placeholder:text-ink-disabled focus:border-scanner-cyan-edge-strong focus:outline-hidden"
              />
            </label>
          )}
        </div>
      )}
      {check && (
        <p className="pl-9 text-caption text-ink-muted">
          {check.detail}
          {check.kind === 'wiki' && (
            <span className="text-ready-emerald-pale">
              {' · '}
              <i className="ph-bold ph-check" aria-hidden="true" /> in the wiki
            </span>
          )}
        </p>
      )}
    </li>
  );
}

function Minutes({
  label,
  value,
  onChange
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className={LABEL_FIELD}>
      <span>
        {label}
        <span className="sr-only"> (minutes)</span>
      </span>
      <span className="relative">
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={value ?? ''}
          onChange={event => {
            onChange(number(event.target.value));
          }}
          className={`${FIELD} font-mono pr-12`}
        />
        <span aria-hidden="true" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
          min
        </span>
      </span>
    </label>
  );
}
