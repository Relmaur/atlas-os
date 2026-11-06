// Runs (design 28): routes that turn time into Units, each checked against the game version the wiki describes.
// Outlaw stations is the first run; it sits under In progress while the player is flying one. Yours are the runs the
// player made (Run editor, 32); one an update has changed a value for moves to Retired. Suggestions are a later phase.
import { useEffect } from 'react';
import { formatCountdown } from '@atlas/core/format';
import { outlawSummary } from '@atlas/core/outlaw';
import { runEstimate, runStatus, type PlayerRun } from '@atlas/core/runs';
import type { Catalog } from '@atlas/core/planner';
import type { GameVersion } from '@atlas/core/facts';
import { addTimer } from '../actions.ts';
import { useAppState } from '../useAppState.ts';
import { useNow } from '../useNow.ts';
import { Button } from '../parts/Button.tsx';
import { loadGameData, useGameData } from '../calculators/game-data.ts';
import { useSection } from '../shell/section-store.ts';
import { RUN_CARD, SECTION_LABEL, WorksPill, useGameVersion } from './run-bits.tsx';
import { RunEditor } from './RunEditor.tsx';
import { closeRunEditor, openRunEditor, useRunEditing } from './run-editor-store.ts';
import { useMedia } from '../parts/useMedia.ts';

const formatUnits = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toLocaleString());

export function Runs() {
  const state = useAppState();
  const now = useNow();
  const game = useGameVersion();
  const summary = outlawSummary(state, now);
  const { progress, rows, ready } = summary;
  const editing = useRunEditing();
  const section = useSection();
  const data = useGameData();
  const catalog = data.status === 'ready' ? data.catalog : null;
  // The game data (~2.5 MB, precached) checks the player's runs; it isn't needed until there's one to check.
  const needsData = state.runs.length > 0 || editing !== null;
  useEffect(() => {
    if (needsData) void loadGameData();
  }, [needsData]);
  // Leaving Runs (a tab, Back) closes the editor, or the page behind would stay locked.
  useEffect(() => {
    if (section !== 'runs') closeRunEditor();
  }, [section]);
  const retired = state.runs.filter(run => runStatus(run, catalog) === 'changed');
  const yours = state.runs.filter(run => !retired.includes(run));
  const wide = useMedia('(min-width: 1024px)');
  const editor = editing && section === 'runs' && (
    <RunEditor key={editing.session} existing={state.runs.find(run => run.id === editing.id)} catalog={catalog} />
  );

  // The Workbench's list pane (round 6, d06): one row per run, Built in then Yours, and New run (R) at the foot.
  if (wide) {
    const row = (open: boolean) =>
      `w-full grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3 px-[18px] min-h-[60px] py-2.5 border-t border-hairline text-left ${
        open
          ? 'bg-scanner-cyan-tint shadow-[inset_3px_0_0_var(--color-scanner-cyan-glow)]'
          : 'hover:bg-[rgba(148,163,184,0.06)]'
      }`;
    const outlawLine = progress
      ? `Station ${String(progress.done + 1)} of ${String(progress.total)}${progress.next ? ` · ${progress.next.system.name}` : ' · all restocking'}`
      : rows.length
        ? `${String(ready.length)} of ${String(rows.length)} station${rows.length === 1 ? '' : 's'} ready`
        : 'No outlaw stations yet';
    const label = 'px-[18px] pt-4 pb-2 text-label uppercase text-ink-label';
    return (
      <div className="flex flex-col">
        <header className="px-[18px] pt-4 pb-1">
          <h1 className="font-display font-extrabold text-[22px] text-ink-bright">Runs</h1>
        </header>
        <section aria-labelledby="runsOutlawLabel">
          <h2 id="runsOutlawLabel" className={label}>
            {progress ? 'In progress' : 'Built in'}
          </h2>
          <a
            id="runsOutlaw"
            href="#outlaw"
            aria-current={section === 'outlaw' ? 'page' : undefined}
            className={row(section === 'outlaw')}
          >
            <i className="ph-bold ph-path text-xl text-scanner-cyan-pale" aria-hidden="true" />
            <span className="min-w-0 flex flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-ink-bright">Outlaw stations</span>
              <span title={outlawLine} className="truncate text-xs text-ink-muted">
                {outlawLine}
              </span>
            </span>
            <WorksPill game={game} />
          </a>
        </section>
        {yours.length > 0 && (
          <section aria-labelledby="runsYoursLabel">
            <h2 id="runsYoursLabel" className={label}>
              Yours
            </h2>
            <ul id="runsYours" className="m-0 p-0 list-none">
              {yours.map(run => {
                const units = runEstimate(run, catalog, state.systems).units;
                const line = [
                  run.line,
                  `${String(run.steps.length)} step${run.steps.length === 1 ? '' : 's'}`,
                  units > 0 ? `≈ ${formatUnits(units)} per run` : ''
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={run.id}>
                    <button
                      type="button"
                      onClick={() => {
                        openRunEditor(run.id);
                      }}
                      className={row(editing?.id === run.id)}
                    >
                      <i className="ph-bold ph-path text-xl text-ink-muted" aria-hidden="true" />
                      <span className="min-w-0 flex flex-col gap-0.5">
                        <span title={run.name} className="truncate text-sm font-semibold text-ink-bright">
                          {run.name}
                        </span>
                        <span title={line} className="truncate text-xs text-ink-muted">
                          {line}
                        </span>
                      </span>
                      {runStatus(run, catalog) === 'works' ? <WorksPill game={game} /> : <span />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {retired.length > 0 && (
          <section aria-labelledby="runsRetiredLabel">
            <h2 id="runsRetiredLabel" className={label}>
              Retired
            </h2>
            <ul id="runsRetired" className="m-0 p-0 list-none">
              {retired.map(run => (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => {
                      openRunEditor(run.id);
                    }}
                    className={row(false)}
                  >
                    <i className="ph-bold ph-path text-xl text-ink-disabled" aria-hidden="true" />
                    <span title={run.name} className="truncate text-sm font-semibold text-ink-soft">
                      {run.name}
                    </span>
                    <span className="h-6 px-2 shrink-0 rounded-tag inline-flex items-center border border-units-amber-edge bg-units-amber-tint text-[11px] font-semibold text-units-amber-pale">
                      Values changed
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <button
          type="button"
          onClick={() => {
            openRunEditor();
          }}
          aria-keyshortcuts="r"
          className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3 px-[18px] h-[56px] border-t border-hairline text-left text-[15px] font-semibold text-scanner-cyan-pale hover:bg-[rgba(148,163,184,0.06)]"
        >
          <i className="ph-bold ph-plus text-lg" aria-hidden="true" />
          New run
          <kbd aria-hidden="true" className="nav-kbd">
            R
          </kbd>
        </button>
        {editor}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl pt-[env(safe-area-inset-top)]">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3 mt-4 lg:mt-0">
          <h1 className="font-display text-screen-title text-ink-bright">Runs</h1>
          <Button
            icon="ph-plus"
            onClick={() => {
              openRunEditor();
            }}
          >
            New run
          </Button>
        </div>
        <p className="text-sub text-ink-muted">
          Routes that turn time into Units{game ? `, checked against the game data for v${game.version}` : ''}.
        </p>
      </header>

      <section aria-labelledby="runsOutlawLabel" className="flex flex-col mt-2">
        <h2 id="runsOutlawLabel" className={SECTION_LABEL}>
          {progress ? 'In progress' : 'Built in'}
        </h2>
        <a
          id="runsOutlaw"
          href="#outlaw"
          className={`${RUN_CARD} ${progress ? 'border-scanner-cyan-edge hover:border-scanner-cyan-edge-strong' : 'hover:border-control-edge-hover'}`}
        >
          <span className="flex items-center gap-2.5">
            <i className="ph-bold ph-path text-xl text-scanner-cyan-pale" aria-hidden="true" />
            <span className="flex-1 min-w-0 font-display font-bold text-[15px] text-ink-bright truncate">
              Outlaw stations
            </span>
            <WorksPill game={game} />
          </span>
          <span className="text-sub text-ink-muted">
            Sell Suspicious Packets at outlaw stations, one restock at a time.
          </span>
          {progress ? (
            <>
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
              <span className="flex items-center justify-between gap-3 text-[14px] text-ink">
                <span className="min-w-0 truncate">
                  Station {progress.done + 1} of {progress.total}
                  {progress.next ? ` · ${progress.next.system.name}` : ' · all restocking'}
                </span>
                {progress.restockAt !== null && (
                  <span className="font-mono text-[13px] text-scanner-cyan-pale shrink-0">
                    restock {formatCountdown(progress.restockAt - now)}
                  </span>
                )}
              </span>
            </>
          ) : (
            <span className="text-[14px] text-ink">
              {rows.length
                ? `${String(ready.length)} of ${String(rows.length)} station${rows.length === 1 ? '' : 's'} ready`
                : 'No outlaw stations yet'}
            </span>
          )}
        </a>
      </section>

      {yours.length > 0 && (
        <section aria-labelledby="runsYoursLabel" className="flex flex-col">
          <h2 id="runsYoursLabel" className={SECTION_LABEL}>
            Yours
          </h2>
          <ul id="runsYours" className="flex flex-col gap-3">
            {yours.map(run => (
              <YourRun key={run.id} run={run} catalog={catalog} game={game} />
            ))}
          </ul>
        </section>
      )}

      {retired.length > 0 && (
        <section aria-labelledby="runsRetiredLabel" className="flex flex-col">
          <h2 id="runsRetiredLabel" className={SECTION_LABEL}>
            Retired
          </h2>
          <ul id="runsRetired" className="flex flex-col gap-3">
            {retired.map(run => (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => {
                    openRunEditor(run.id);
                  }}
                  className={`${RUN_CARD} w-full text-left opacity-80 hover:opacity-100 hover:border-control-edge-hover`}
                >
                  <span className="flex items-center gap-2.5">
                    <i className="ph-bold ph-path text-xl text-ink-muted" aria-hidden="true" />
                    <span className="flex-1 min-w-0 font-display font-bold text-[15px] text-ink-soft truncate">
                      {run.name}
                    </span>
                    <span className="h-6 px-2.5 shrink-0 rounded-full inline-flex items-center border border-units-amber-edge bg-units-amber-tint text-[11px] font-semibold text-units-amber-pale">
                      Values changed
                    </span>
                  </span>
                  <span className="text-sub text-ink-muted">
                    An update changed the numbers this run relied on. Kept in your history.
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editor}
    </div>
  );
}

function YourRun({ run, catalog, game }: { run: PlayerRun; catalog: Catalog | null; game: GameVersion | null }) {
  const { systems } = useAppState();
  const estimate = runEstimate(run, catalog, systems);
  const status = runStatus(run, catalog);
  return (
    <li className={`${RUN_CARD} relative hover:border-control-edge-hover`}>
      <span className="flex items-center gap-2.5">
        {/* The whole card opens the editor; the timer button sits above that layer. */}
        <button
          type="button"
          onClick={() => {
            openRunEditor(run.id);
          }}
          className="flex-1 min-w-0 text-left font-display font-bold text-[15px] text-ink-bright truncate after:absolute after:inset-0 after:content-['']"
        >
          {run.name}
        </button>
        {status === 'works' ? (
          <WorksPill game={game} />
        ) : (
          run.checked.version === '' && (
            <span className="h-6 px-2.5 shrink-0 rounded-full inline-flex items-center border border-control-edge text-[11px] font-semibold text-ink-soft">
              Not checked
            </span>
          )
        )}
      </span>
      <span className="text-sub text-ink-muted">
        {[run.line, `${String(run.steps.length)} step${run.steps.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
      </span>
      {(estimate.units > 0 || run.repeatMinutes) && (
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[15px] text-units-amber-text">
            {estimate.units > 0 ? `≈ ${formatUnits(estimate.units)} per run` : ''}
          </span>
          {run.repeatMinutes && (
            <span className="font-mono text-[13px] text-ink-muted">repeat every {run.repeatMinutes} min</span>
          )}
        </span>
      )}
      {run.timer && run.repeatMinutes && (
        <Button
          size="S"
          icon="ph-timer"
          className="relative self-start"
          onClick={() => {
            addTimer('custom', run.name, (run.repeatMinutes ?? 0) * 60_000);
          }}
        >
          Finished a run · start the {run.repeatMinutes} min timer
        </Button>
      )}
    </li>
  );
}
