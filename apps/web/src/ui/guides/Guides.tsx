// Guides (design 17): the six books, each a path of milestones, with how far the player has ticked each one. The top
// card names the next milestone to tick (ticks keep no time, so there's no "latest").
import { BOOKS, guideProgress, nextMilestone } from '@atlas/core/guides';
import { useAppState } from '../useAppState.ts';
import { goBack, useSection } from '../shell/section-store.ts';
import { useMedia } from '../parts/useMedia.ts';
import { BOOK_TILE, TOP_BUTTON } from './guide-bits.ts';

export function Guides() {
  const { checklists } = useAppState();
  const progress = guideProgress(checklists);
  const next = nextMilestone(checklists);
  const section = useSection();
  const wide = useMedia('(min-width: 1024px)');

  // The Workbench (round 6, d12): the six books as compact rows beside the open one.
  if (wide)
    return (
      <div className="flex flex-col h-full min-h-0">
        <header className="flex items-baseline justify-between gap-2.5 px-[18px] pt-4 pb-3">
          <h1 className="font-display font-extrabold text-[22px] leading-none text-ink-bright">Guides</h1>
          <span id="guidesProgressText" className="font-mono text-[12px] text-ink-muted whitespace-nowrap">
            {progress.done} / {progress.total} milestones
          </span>
        </header>
        <ol id="guidesList" className="flex-1 min-h-0 overflow-y-auto">
          {BOOKS.map(book => {
            const { done, total } = progress.perBook[book.key];
            const open = section === book.key;
            return (
              <li key={book.key}>
                <a
                  href={`#${book.key}`}
                  aria-current={open ? 'page' : undefined}
                  className={`grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-[18px] py-3 border-t border-hairline ${
                    open
                      ? 'bg-scanner-cyan-tint shadow-[inset_3px_0_0_var(--color-scanner-cyan-glow)]'
                      : 'hover:bg-[rgba(148,163,184,0.06)]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`font-display font-extrabold text-[17px] ${done ? 'text-scanner-cyan-text' : 'text-[#c4b5fd]'}`}
                  >
                    {book.numeral}
                  </span>
                  <span className="min-w-0 flex flex-col gap-0.5">
                    <span title={book.title} className="truncate text-sm font-semibold text-ink-bright">
                      <span className="sr-only">Book {book.numeral}: </span>
                      {book.title}
                    </span>
                    <span title={book.blurb} className="truncate text-xs text-ink-muted">
                      {book.blurb}
                    </span>
                  </span>
                  <span className="font-mono text-[12px] text-ink-muted whitespace-nowrap">
                    <span className="sr-only">ticked </span>
                    {done}/{total}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
        {next && (
          <a
            id="guidesNext"
            href={`#${next.book.key}`}
            className="px-[18px] py-3 border-t border-hairline flex flex-col gap-0.5 hover:bg-[rgba(148,163,184,0.06)]"
          >
            <span className="text-label uppercase text-ink-label">Next milestone · Book {next.book.numeral}</span>
            <span title={next.item.title} className="truncate text-[13px] font-semibold text-ready-emerald-text">
              {next.item.title}
            </span>
          </a>
        )}
      </div>
    );

  return (
    <div className="flex flex-col gap-4 max-w-2xl pt-[env(safe-area-inset-top)]">
      <header className="flex flex-col gap-1.5">
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => {
              goBack('more');
            }}
            aria-label="Back"
            className={TOP_BUTTON}
          >
            <i className="ph-bold ph-caret-left text-lg" aria-hidden="true" />
          </button>
        </div>
        <h1 className="font-display text-screen-title text-ink-bright mt-4 lg:mt-0">Guides</h1>
        <p className="text-sub text-ink-muted">Six books, each a path of milestones. Tick them as you go.</p>
      </header>

      <a
        id="guidesNext"
        href={next ? `#${next.book.key}` : '#guides'}
        className="rounded-card bg-panel-glass border border-ready-emerald-edge-soft p-4 flex items-center gap-3 hover:border-ready-emerald-edge"
      >
        <span
          aria-hidden="true"
          className="w-11 h-11 shrink-0 rounded-[12px] grid place-items-center bg-ready-emerald-tint border border-ready-emerald-edge text-ready-emerald-pale"
        >
          <i className={`ph-bold ${next ? 'ph-flag-banner' : 'ph-check'} text-xl`} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-label uppercase text-ink-label">
            {next ? `Next milestone · Book ${next.book.numeral}` : 'Every milestone ticked'}
          </span>
          <span className="block mt-0.5 text-[14px] font-semibold text-ink-bright truncate">
            {next ? next.item.title : 'All six books, done.'}
          </span>
        </span>
        <span id="guidesProgressText" className="font-mono text-[13px] text-ready-emerald-pale shrink-0">
          <span className="sr-only">ticked </span>
          {progress.done} / {progress.total}
        </span>
      </a>

      <ol id="guidesList" className="flex flex-col gap-3">
        {BOOKS.map(book => {
          const { done, total } = progress.perBook[book.key];
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <li key={book.key}>
              <a
                href={`#${book.key}`}
                className="rounded-card bg-panel-glass border border-hairline p-4 flex items-start gap-3.5 hover:border-control-edge-hover"
              >
                <span aria-hidden="true" className={BOOK_TILE(done > 0)}>
                  {book.numeral}
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="font-display font-bold text-[14px] text-ink-bright">
                    <span className="sr-only">Book {book.numeral}: </span>
                    {book.title}
                  </span>
                  <span className="text-caption text-ink-muted">{book.blurb}</span>
                  <span className="flex items-center gap-2 mt-1">
                    <span
                      role="progressbar"
                      aria-label={`Book ${book.numeral} milestones`}
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-valuenow={done}
                      className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden"
                    >
                      <span className="block h-full bg-ready-emerald-lit" style={{ width: `${String(pct)}%` }} />
                    </span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      <span className="sr-only">ticked </span>
                      {done}/{total}
                    </span>
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
