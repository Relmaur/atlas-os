// Run · Outlaw stations (design 07), the first run: systems tagged "outlaw", which Contraband Agents have restocked,
// the run in progress or the next one, the player's own averages, and what one full run earns at them.
import { useMedia } from '../parts/useMedia.ts';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { formatAgo, formatCountdown, formatDuration } from '@atlas/core/format';
import { OUTLAW_LIMITS, fullRunEstimate, outlawSummary } from '@atlas/core/outlaw';
import { parseOutlawList } from '@atlas/core/systems-list';
import { packetsLogged } from '@atlas/core/systems-model';
import type { OutlawSettings } from '@atlas/core/state';
import {
  addOutlawSystems,
  endOutlawRun,
  logOutlawRun,
  logPacketRun,
  setOutlawSetting,
  startOutlawRun,
  undoPacketRun
} from '../actions.ts';
import { useAppState } from '../useAppState.ts';
import { useNow } from '../useNow.ts';
import { Button, IconButton, buttonClass } from '../parts/Button.tsx';
import { GlyphChip, OutlawPill } from '../parts/SystemBits.tsx';
import { FIELD, Segments } from '../systems/editor-parts.tsx';
import { openSystem, openSystemEditor } from '../systems/panel-store.ts';
import { RUN_CARD, useGameVersion } from '../runs/run-bits.tsx';

type StationFilter = 'all' | 'ready' | 'wait';
const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;
const where = (system: { region: string; galaxy: string }) =>
  [system.region, system.galaxy].filter(Boolean).join(' · ');
// The design's run sizes; a size set some other way (an import, an older version) joins them.
const RUN_SIZES = [3, 4, 5, 6, 8];
const CARD_TITLE = 'font-display font-bold text-[15px] text-ink-bright flex items-center gap-2 whitespace-nowrap';

export function Outlaw() {
  const state = useAppState();
  const now = useNow();
  const game = useGameVersion();
  const { outlaw } = state;
  const summary = outlawSummary(state, now);
  const { rows, ready, run, progress } = summary;
  const estimate = fullRunEstimate(outlaw);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [stationFilter, setStationFilter] = useState<StationFilter>('all');
  const filters: [StationFilter, string, number][] = [
    ['all', 'All', rows.length],
    ['ready', 'Ready', ready.length],
    ['wait', 'Restocking', rows.length - ready.length]
  ];
  const visible = rows.filter(row => stationFilter === 'all' || (stationFilter === 'ready') === row.status.ready);
  const sizes = [...new Set([...RUN_SIZES, outlaw.runSize])].sort((a, b) => a - b);
  const wide = useMedia('(min-width: 1024px)');

  const parts = {
    header: (
      <header className="flex flex-col gap-1.5">
        <p className="text-label uppercase text-ready-emerald-pale mt-4 lg:mt-0">
          Run{game ? ` · works in v${game.version}` : ''}
        </p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-screen-title text-ink-bright">Outlaw stations</h1>
          <IconButton
            icon="ph-timer"
            label="Timers"
            onClick={() => {
              location.hash = '#session';
            }}
          />
        </div>
        <p className="text-sub text-ink-muted">
          Sell Suspicious Packets at outlaw stations, one restock at a time. Method:{' '}
          <a href="#book2" className="text-scanner-cyan-pale hover:text-quantity-cyan underline underline-offset-2">
            Book II · Two-Vendor Loop
          </a>
          .
        </p>
        <p id="outlawSummary" className="text-caption text-ink-muted">
          {rows.length
            ? `${plural(rows.length, 'outlaw system')} · ${String(ready.length)} ready · ${plural(summary.runs, 'packet run')} · ~${summary.nanitesEarned.toLocaleString()} Nanites earned so far`
            : ''}
        </p>
      </header>
    ),
    empty: (
      <>
        {rows.length === 0 && (
          <div className={`${RUN_CARD} items-center text-center py-7`}>
            <span aria-hidden="true" className="relative w-24 h-24 grid place-items-center">
              <span className="absolute inset-0 rounded-full border border-dashed border-control-edge" />
              <span className="w-16 h-16 rounded-full grid place-items-center border border-control-edge bg-slate-ground">
                <span className="w-9 h-9 rounded-full grid place-items-center bg-danger-rose-tint border border-danger-rose-edge text-danger-rose-pale">
                  <i className="ph-bold ph-crosshair text-xl" />
                </span>
              </span>
            </span>
            <h2 className="font-display font-bold text-[16px] text-ink-bright">No outlaw stations yet</h2>
            <p className="text-sub text-ink-muted max-w-sm">
              Mark a system as outlaw in its editor and its station joins your run, with a restock timer.
            </p>
            <a href="#systems" className={buttonClass('secondary')}>
              <i className="ph-bold ph-planet text-base" aria-hidden="true" />
              Pick from your systems
            </a>
            <div className="flex flex-wrap justify-center gap-1">
              <Button
                variant="ghost"
                onClick={() => {
                  openSystemEditor(null, { tags: ['outlaw'], conflict: 'pirate' });
                }}
              >
                Add a new one
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setBulkOpen(true);
                }}
              >
                Paste a list
              </Button>
            </div>
          </div>
        )}
        <BulkForm
          open={bulkOpen}
          onClose={() => {
            setBulkOpen(false);
          }}
        />
      </>
    ),
    run: (
      <>
        {rows.length > 0 && (
          <section aria-labelledby="outlawRunTitle" className={RUN_CARD}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="outlawRunTitle" className={CARD_TITLE}>
                <i className="ph-bold ph-path text-scanner-cyan-pale" aria-hidden="true" />
                {progress ? `Station ${String(progress.done + 1)} of ${String(progress.total)}` : 'Next run'}
              </h2>
              {progress?.restockAt != null && (
                <span className="font-mono text-[13px] text-scanner-cyan-pale">
                  restock {formatCountdown(progress.restockAt - now)}
                </span>
              )}
            </div>
            {progress && (
              <span
                role="progressbar"
                aria-label="Stations done this run"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
                className="flex gap-1.5"
              >
                {Array.from({ length: progress.total }, (_, i) => (
                  <span
                    key={i}
                    className={`flex-1 h-1 rounded-full ${i < progress.done ? 'bg-scanner-cyan-glow' : 'bg-slate-800'}`}
                  />
                ))}
              </span>
            )}
            <ol id="outlawRunList" className="flex flex-col gap-2">
              {run.length ? (
                run.map(({ system }, i) => (
                  <li
                    key={system.id}
                    className="flex items-start gap-3 p-3 rounded-control bg-slate-ground border border-hairline"
                  >
                    <span className="w-7 h-7 shrink-0 rounded-full grid place-items-center border border-control-edge font-mono text-[12px] text-ink-soft">
                      {(progress?.done ?? 0) + i + 1}
                    </span>
                    <div className="min-w-0 flex-1 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          openSystem(system.id);
                        }}
                        className="block max-w-full text-left"
                      >
                        <span className="block text-[14px] font-semibold text-ink-bright truncate hover:underline underline-offset-2">
                          {system.name}
                        </span>
                        <span className="block text-caption text-ink-muted truncate">{where(system)}</span>
                      </button>
                      <GlyphChip glyphs={system.glyphs} />
                    </div>
                    <VisitedButton id={system.id} />
                  </li>
                ))
              ) : (
                <li className="p-4 rounded-control border border-dashed border-control-edge text-sub text-ink-muted">
                  {rows[0]
                    ? `Every station is restocking. Next one ready in ${formatDuration(rows[0].status.readyAt - now)} (${rows[0].system.name}).`
                    : 'Add outlaw systems to plan a run.'}
                </li>
              )}
            </ol>
            <div id="outlawRunFooter" className="flex flex-col gap-3">
              {run.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-caption text-ink-soft">
                    {`${plural(run.length, 'station')} · ${String(summary.runPackets)} packets · ~${(summary.runUnits / 1e6).toFixed(1)}M Units → `}
                    <strong className="text-units-amber-text font-semibold">
                      ~{summary.runNanites.toLocaleString()} Nanites
                    </strong>
                  </p>
                  {run.length > 1 && (
                    <Button
                      size="S"
                      onClick={() => {
                        logOutlawRun(run.map(row => row.system));
                      }}
                    >
                      Mark whole run visited
                    </Button>
                  )}
                </div>
              )}
              {progress ? (
                <Button wide onClick={endOutlawRun}>
                  End run
                </Button>
              ) : (
                <Button variant="primary" icon="ph-crosshair" wide disabled={!ready.length} onClick={startOutlawRun}>
                  {ready.length ? 'Start a run' : 'Start a run · no station ready'}
                </Button>
              )}
            </div>
          </section>
        )}
      </>
    ),
    stations: (
      <>
        {rows.length > 0 && (
          <section aria-labelledby="outlawStationsTitle" className={RUN_CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="outlawStationsTitle" className={CARD_TITLE}>
                Stations
              </h2>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="S"
                  onClick={() => {
                    setBulkOpen(true);
                  }}
                >
                  Paste a list
                </Button>
                <Button
                  variant="ghost"
                  size="S"
                  onClick={() => {
                    openSystemEditor(null, { tags: ['outlaw'], conflict: 'pirate' });
                  }}
                >
                  Add one
                </Button>
              </div>
            </div>
            <div id="outlawFilters" className="flex gap-1.5">
              {filters.map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setStationFilter(key);
                  }}
                  aria-pressed={stationFilter === key}
                  className={`h-[34px] px-3 rounded-full border text-[13px] font-semibold ${stationFilter === key ? 'bg-scanner-cyan-tint border-scanner-cyan-edge-strong text-scanner-cyan-text' : 'bg-slate-ground border-control-edge text-ink-soft hover:text-ink-bright'}`}
                >
                  {`${label} `}
                  <span className="font-mono opacity-70">{n}</span>
                </button>
              ))}
            </div>
            <ul id="outlawStationList" className="flex flex-col gap-2">
              {visible.length ? (
                visible.map(({ system, status }) => {
                  const runVisits = system.visits.filter(visit => visit.packets);
                  const last = runVisits.at(-1);
                  return (
                    <li
                      key={system.id}
                      className="p-3 rounded-control bg-slate-ground border border-hairline flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            openSystem(system.id);
                          }}
                          className="min-w-0 text-left"
                        >
                          <strong className="text-[14px] text-ink-bright hover:underline underline-offset-2">
                            {system.name}
                          </strong>{' '}
                          <span className="block text-caption text-ink-muted">{where(system)}</span>
                        </button>
                        <OutlawPill status={status} />
                      </div>
                      {system.glyphs || system.notes ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <GlyphChip glyphs={system.glyphs} />
                          {system.notes ? (
                            <span className="text-caption text-ink-soft line-clamp-1">
                              {system.notes.split('\n')[0]}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-caption text-ink-muted">
                          {last
                            ? `${plural(runVisits.length, 'run')} · last ${formatAgo(last.at, now)} · ~${(packetsLogged(system) * outlaw.nanitesPerPacket).toLocaleString()} Nanites`
                            : 'No packet runs yet'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <VisitedButton id={system.id} />
                          {last ? (
                            <button
                              type="button"
                              onClick={() => {
                                undoPacketRun(system.id);
                              }}
                              title="Undo last run"
                              aria-label={`Undo last run at ${system.name}`}
                              className="w-[34px] h-[34px] rounded-[10px] text-ink-muted hover:text-ink-bright hover:bg-panel grid place-items-center"
                            >
                              <i className="ph-bold ph-arrow-counter-clockwise" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="p-4 rounded-control border border-dashed border-control-edge text-sub text-ink-muted">
                  No stations in this view.
                </li>
              )}
            </ul>
          </section>
        )}
      </>
    ),
    settings: (
      <section aria-labelledby="outlawSettingsTitle" className={RUN_CARD}>
        <h2 id="outlawSettingsTitle" className={CARD_TITLE}>
          <i className="ph-bold ph-sun text-scanner-cyan-pale" aria-hidden="true" />
          Run settings
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Setting
            id="outlawRestockHours"
            setting="restockHours"
            value={outlaw.restockHours}
            step={1}
            label="Restock"
            unit="h"
          />
          <Setting
            id="outlawPacketsPerVisit"
            setting="packetsPerVisit"
            value={outlaw.packetsPerVisit}
            step={1}
            label="Packets per station"
          />
          <Setting
            id="outlawUnitsPerPacket"
            setting="unitsPerPacket"
            value={outlaw.unitsPerPacket}
            step={1000}
            label="Units per packet"
          />
          <Setting
            id="outlawNanitesPerPacket"
            setting="nanitesPerPacket"
            value={outlaw.nanitesPerPacket}
            step={10}
            label="Nanites per packet"
          />
        </div>
        <Segments
          label="Stations per run"
          value={String(outlaw.runSize)}
          options={sizes.map(n => [String(n), String(n)])}
          onChange={value => {
            setOutlawSetting('runSize', value);
          }}
        />
        <p className="text-caption text-ink-muted">
          Your own averages from the game. Packet prices and contents vary, so the wiki can’t give them.
        </p>
      </section>
    ),
    estimate: (
      <section
        aria-labelledby="outlawEstimateTitle"
        className="@container rounded-card bg-panel-glass border border-units-amber-edge p-4 flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2 id="outlawEstimateTitle" className={CARD_TITLE}>
            <i className="ph-bold ph-sparkle text-units-amber-text" aria-hidden="true" />
            One full run
          </h2>
          <span className="h-7 px-3 shrink-0 whitespace-nowrap rounded-full lg:rounded-tag inline-flex items-center border border-control-edge text-caption text-ink-soft">
            by your averages
          </span>
        </div>
        <dl id="outlawEstimate" className="grid grid-cols-2 gap-y-3">
          <div>
            <dt className="text-label uppercase text-ink-label">Packets</dt>
            <dd className="font-mono text-[22px] @[21rem]:text-[26px] text-quantity-cyan">
              {estimate.packets.toLocaleString()}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-label uppercase text-ink-label">Units</dt>
            <dd className="font-mono text-[22px] @[21rem]:text-[26px] text-units-amber-text">
              {estimate.units.toLocaleString()}
            </dd>
          </div>
          <div className="col-span-2 flex items-center justify-between">
            <dt className="text-sub text-ink-soft">Nanites</dt>
            <dd className="font-mono text-[18px] text-ink">{estimate.nanites.toLocaleString()}</dd>
          </div>
        </dl>
      </section>
    ),
    tail: (
      <>
        {rows.length === 0 && (
          <Button variant="primary" icon="ph-crosshair" wide disabled>
            Start a run · needs a station
          </Button>
        )}
      </>
    )
  };

  // The Workbench (round 6, d06): the run and its settings in the main column, the stations and the full run's
  // estimate in the inspector, which folds under the main column when the pane is narrow.
  if (wide)
    return (
      <div className="detail-pane">
        <div className="detail-split">
          <div className="min-w-0 flex flex-col gap-4 pb-1 pr-0 @container">
            {parts.header}
            {parts.empty}
            {parts.run}
            {parts.settings}
            {parts.tail}
          </div>
          <aside
            aria-label="Your outlaw stations"
            className="detail-side min-w-0 flex flex-col gap-4 pt-4 detail-side-pad"
          >
            {parts.stations}
            {parts.estimate}
          </aside>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4 max-w-2xl pt-[env(safe-area-inset-top)]">
      {parts.header}
      {parts.empty}
      {parts.run}
      {parts.stations}
      {parts.settings}
      {parts.estimate}
      {parts.tail}
    </div>
  );
}

function VisitedButton({ id }: { id: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        logPacketRun(id);
      }}
      className={`${buttonClass('primary', 'S')} shrink-0`}
    >
      <i className="ph-bold ph-check" aria-hidden="true" />
      Visited
    </button>
  );
}

// A number the player sets from what they see in-game. It's kept on the native change event (blur, Enter or a
// spinner step), not React's onChange, which fires per keystroke and would clamp a value halfway through typing it.
function Setting({
  id,
  setting,
  value,
  step,
  label,
  unit
}: {
  id: string;
  setting: keyof OutlawSettings;
  value: number;
  step: number;
  label: string;
  unit?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [min, max] = OUTLAW_LIMITS[setting];
  // Another tab (or an import) changed it: show the new value, unless the person is typing here.
  useEffect(() => {
    if (input.current && document.activeElement !== input.current) input.current.value = String(value);
  }, [value]);
  useEffect(() => {
    const field = input.current;
    if (!field) return;
    const commit = () => {
      field.value = String(setOutlawSetting(setting, field.value));
    };
    field.addEventListener('change', commit);
    return () => {
      field.removeEventListener('change', commit);
    };
  }, [setting]);
  return (
    <label className="flex flex-col gap-1.5 text-caption text-ink-soft">
      {label}
      <span className="relative">
        <input
          ref={input}
          id={id}
          type="number"
          min={min}
          max={setting === 'unitsPerPacket' || setting === 'nanitesPerPacket' ? undefined : max}
          step={step}
          defaultValue={value}
          className={`${FIELD} font-mono ${unit ? 'pr-9' : ''}`}
        />
        {unit && (
          <span aria-hidden="true" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
            {unit}
          </span>
        )}
      </span>
    </label>
  );
}

function BulkForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [error, setError] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (open) textarea.current?.focus();
  }, [open]);
  const close = () => {
    setError('');
    onClose();
  };
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = parseOutlawList(textarea.current?.value ?? '');
    if ('error' in result) {
      setError(result.error);
      return;
    }
    if (textarea.current) textarea.current.value = '';
    close();
    addOutlawSystems(result.systems);
  };
  // Stays mounted while closed, so it keeps what was typed.
  return (
    <form id="outlawBulkForm" className={`${open ? '' : 'hidden '}${RUN_CARD}`} onSubmit={submit}>
      <label className="flex flex-col gap-1.5 text-caption text-ink-soft">
        <span>
          One system per line: <code className="text-scanner-cyan-pale">System | Glyphs | Region | Notes</code> (only
          the name is required)
        </span>
        <textarea
          ref={textarea}
          id="outlawBulkInput"
          rows={6}
          placeholder={
            'Okyama XI | 0123456789AB | Ezdaranit Spur | 2 jumps from base\nIvorsk\nHesperus Prime | 1A2B3C4D5E6F'
          }
          className="w-full rounded-control border border-control-edge bg-slate-ground px-3.5 py-2.5 text-base md:text-sm font-mono text-ink-bright placeholder:text-ink-disabled focus:border-scanner-cyan-edge-strong focus:outline-hidden"
        />
      </label>
      <p id="outlawBulkError" role="alert" className={`${error ? '' : 'hidden '}text-caption text-danger-rose-pale`}>
        {error}
      </p>
      <div className="flex justify-end gap-2">
        <Button onClick={close}>Cancel</Button>
        <Button type="submit" variant="primary" size="M">
          Add systems
        </Button>
      </div>
    </form>
  );
}
