// The planner's Codex peek (design 34): a sheet that leads with the item's Source section from its mirrored article,
// then where the player's own log says they found it, what this plan needs of it, and the way into the Codex. A
// crafted step with more than one recipe can switch here too. The grab bar (or Esc, or the scrim) closes it.
import { useEffect, useRef, useState } from 'react';
import { formatQty } from '@atlas/core/calc';
import { findItem, type BuildPlan, type Catalog } from '@atlas/core/planner';
import { closestFor, planNeed } from '@atlas/core/plan-path';
import { articleBody, sourceLines, type SourceKind, type SourceLine } from '@atlas/core/item-source';
import { formatLightYears } from '@atlas/core/location';
import { getFact } from '@atlas/core/facts';
import { useAppState } from '../useAppState.ts';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { PanelGrab, SheetGrab, useSheetDrag, useSheetOpen } from '../parts/Sheet.tsx';
import { Button, buttonClass } from '../parts/Button.tsx';
import { newNoteAbout } from '../notes/note-nav.ts';
import type { RecipeSwitch } from './plan-bits.ts';

const KIND: Record<SourceKind, string> = {
  found: 'Found',
  refine: 'Refine',
  craft: 'Craft',
  cook: 'Cook',
  dismantle: 'Salvage',
  repair: 'Repair'
};
const SHOWN = 4; // past this the rest is a tap away in the Codex
const SHEET_LAYOUT = '(min-width: 0px)';

type Source = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; lines: SourceLine[] };

export function CodexPeek({
  catalog,
  plan,
  title,
  switcher,
  onClose
}: {
  catalog: Catalog;
  plan: BuildPlan;
  title: string;
  switcher: RecipeSwitch | null;
  /** Stable (useCallback): the sheet's open effect depends on it. */
  onClose: () => void;
}) {
  const item = findItem(catalog, title);
  const { systems } = useAppState();
  const [source, setSource] = useState<Source>({ status: 'loading' });
  const lyPerRegion = getFact(useFacts(), 'region-light-years')?.value; // cited: the wiki's Portal address page
  const sheet = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useSheetDrag(sheet, onClose);
  useSheetOpen(true, onClose, { layout: SHEET_LAYOUT, focus: heading });

  // The article file is fetched once read (the service worker keeps it for offline); unread offline, the Codex page
  // still has it in its bundle, so the fallback points there.
  const path = item?.path;
  useEffect(() => {
    void loadFacts();
  }, []);
  useEffect(() => {
    if (!path) return;
    const abort = new AbortController();
    fetch(encodeURI(path), { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]) })
      .then(res => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${String(res.status)}`))))
      .then(text => {
        setSource({ status: 'ready', lines: sourceLines(articleBody(text)) });
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) return;
        console.warn('[atlas]', { event: 'peek-article-failed', reason: String(error) });
        setSource({ status: 'failed' });
      });
    return () => {
      abort.abort();
    };
  }, [path]);

  const need = planNeed(plan, title);
  const closest = closestFor(systems, title);
  const symbol = item?.fields.symbol ?? title.slice(0, 2);
  const kind = item?.fields.category ?? item?.kind ?? '';
  const codex = item ? `wiki/#/a/${encodeURIComponent(item.path)}` : `wiki/#/?q=${encodeURIComponent(title)}`;
  const stepName = need
    ? need.kind === 'gather'
      ? 'Gather'
      : need.kind === 'final'
        ? 'Final craft'
        : `Round ${String(need.step - 1)}`
    : '';

  return (
    <>
      <div onClick={onClose} aria-hidden="true" className="fixed inset-0 z-[55] bg-scrim backdrop-blur-[2px]" />
      <div
        ref={sheet}
        id="codexPeek"
        role="dialog"
        aria-modal="true"
        aria-labelledby="codexPeekTitle"
        className="fixed z-[56] inset-x-0 bottom-0 max-h-[85dvh] flex flex-col rounded-t-sheet border-t border-control-edge bg-[#020617] transition-transform duration-300 lg:inset-x-auto lg:right-0 lg:top-0 lg:max-h-none lg:w-[440px] lg:rounded-none lg:border-t-0 lg:border-l"
      >
        <PanelGrab onClose={onClose} label={`Close ${title}`} />
        <div className="flex-1 overflow-y-auto overscroll-contain px-[18px] pb-[calc(1.75rem+env(safe-area-inset-bottom))] lg:pt-6 flex flex-col gap-3.5">
          <div data-sheet-grab className="pt-3 lg:hidden">
            <SheetGrab onClose={onClose} label={`Close ${title}`} />
          </div>
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="w-[52px] h-[52px] shrink-0 rounded-[14px] grid place-items-center font-mono text-[17px] font-semibold bg-[rgba(56,189,248,0.1)] border border-[rgba(125,211,252,0.45)] text-[#bae6fd]"
            >
              {symbol}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-label uppercase text-ink-label">{kind ? `${kind} · Codex` : 'Codex'}</p>
              <h2
                ref={heading}
                id="codexPeekTitle"
                tabIndex={-1}
                className="font-display font-extrabold text-[20px] leading-tight text-ink-bright break-words focus:outline-hidden"
              >
                {title}
              </h2>
            </div>
          </div>

          <section
            aria-labelledby="peekSourceTitle"
            className="rounded-card bg-panel-glass border border-hairline px-3.5 py-3 flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id="peekSourceTitle" className="text-label uppercase text-scanner-cyan-pale">
                Source
              </h3>
              <span className="font-mono text-[10.5px] text-ink-label">from the wiki</span>
            </div>
            {source.status === 'loading' ? (
              <p className="text-sub text-ink-muted">Reading the wiki’s entry…</p>
            ) : source.status === 'failed' ? (
              <p className="text-sub text-ink-muted">
                The entry isn’t on this device yet. Open it in the Codex, which has every page offline.
              </p>
            ) : source.lines.length ? (
              <ul id="peekSource" className="flex flex-col gap-2">
                {source.lines.slice(0, SHOWN).map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-[1.45] text-ink">
                    <span className="shrink-0 w-[58px] pt-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-label">
                      {KIND[line.kind]}
                    </span>
                    <span className="min-w-0">{line.text}</span>
                  </li>
                ))}
                {source.lines.length > SHOWN && (
                  <li className="text-caption text-ink-muted">{source.lines.length - SHOWN} more in the Codex.</li>
                )}
              </ul>
            ) : (
              <p className="text-sub text-ink-muted">The wiki’s entry has no Source section.</p>
            )}
            <p
              id="peekClosest"
              className="flex gap-2 items-start px-2.5 py-2 rounded-[10px] bg-[rgba(34,211,238,0.06)] border border-[rgba(34,211,238,0.25)] text-[12.5px] leading-[1.45] text-[#cffafe]"
            >
              <i className="ph-bold ph-map-pin mt-0.5" aria-hidden="true" />
              <span>
                <b className="text-ink-bright">Closest for you:</b>{' '}
                {closest
                  ? `${closest.planet ? `${closest.planet} in ` : ''}${closest.system.name}${closest.base ? ', your base' : ''}${
                      lyPerRegion && closest.regions !== null && closest.regions > 0
                        ? ` (${formatLightYears(closest.regions, lyPerRegion)} away)`
                        : ''
                    }.`
                  : `nowhere in your log yet. Write ${title} in a planet’s notes or tags where you find it, and it shows here.`}
              </span>
            </p>
          </section>

          {need && (
            <dl className="grid grid-cols-2 gap-2.5">
              <div className="rounded-control bg-slate-ground border border-hairline px-3 py-2">
                <dt className="text-caption text-ink-muted">This plan needs</dt>
                <dd className="font-mono text-[16px] font-semibold text-ink-bright">{formatQty(need.qty)}</dd>
              </div>
              <div className="rounded-control bg-slate-ground border border-hairline px-3 py-2">
                <dt className="text-caption text-ink-muted">Step</dt>
                <dd className="font-mono text-[16px] font-semibold text-ink-bright">
                  {need.step} · {stepName}
                </dd>
              </div>
            </dl>
          )}

          {switcher && (
            <button
              type="button"
              onClick={switcher.apply}
              className="text-left flex items-start gap-2 px-3 py-2.5 rounded-control border border-control-edge hover:border-scanner-cyan-edge text-caption text-ink-soft"
            >
              <i className="ph-bold ph-arrows-clockwise mt-0.5 text-scanner-cyan-pale" aria-hidden="true" />
              <span>
                <span className="block text-ink">
                  Recipe {switcher.at} of {switcher.of} · switch to the next
                </span>
                {switcher.inputs} · {switcher.delta}
              </span>
            </button>
          )}

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <a href={codex} className={`${buttonClass('jump', 'L')} w-full`}>
              <i className="ph-bold ph-book-open" aria-hidden="true" />
              Open in Codex
            </a>
            <Button
              size="L"
              icon="ph-push-pin"
              onClick={() => {
                onClose();
                newNoteAbout(title);
              }}
            >
              Pin it
            </Button>
          </div>
          <p className="font-mono text-[10.5px] text-ink-label">
            NMS wiki · CC BY-NC-SA 3.0 · the full entry is in the Codex
          </p>
        </div>
      </div>
    </>
  );
}
