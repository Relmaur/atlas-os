// The add-timer sheet the Session screen's + Refiner, + Crop and + Custom open: a bottom sheet on phones (the grab bar
// closes it), a side panel from lg up.
import { useEffect, useRef } from 'react';
import type { TimerKind } from '@atlas/core/timers';
import { loadGameData } from '../calculators/game-data.ts';
import { PanelGrab, SheetGrab, useSheetDrag, useSheetOpen } from '../parts/Sheet.tsx';
import { RefineForm, TimedForm } from './AddTimer.tsx';
import { closeAddTimer, useAddingTimer } from './sheet-store.ts';

const ALWAYS = '(min-width: 0px)';
const TITLE: Record<TimerKind, [title: string, sub: string]> = {
  refine: ['Refiner timer', 'Its time is the wiki’s refining time for what it makes.'],
  crop: ['Crop timer', 'Your harvest time; the next one for this crop starts from it.'],
  custom: ['Custom timer', 'Your time, for anything: a frigate mission, a settlement job, a storm.']
};

export function SessionSheet() {
  const kind = useAddingTimer();
  const open = kind !== null;
  const sheet = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useSheetDrag(sheet, closeAddTimer);
  useSheetOpen(open, closeAddTimer, { layout: ALWAYS, focus: title });

  // The refiner picker needs the wiki's recipes; fetch them as soon as its sheet opens.
  useEffect(() => {
    if (kind === 'refine') void loadGameData();
  }, [kind]);

  const [heading, sub] = TITLE[kind ?? 'custom'];
  return (
    <>
      <div
        onClick={closeAddTimer}
        className={`fixed inset-0 z-[55] bg-scrim backdrop-blur-[2px] transition-opacity duration-200 ${open ? '' : 'opacity-0 pointer-events-none'}`}
      />
      <div
        ref={sheet}
        id="timerSheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timerSheetTitle"
        aria-hidden={!open}
        inert={!open}
        className={`kb-sheet fixed z-[56] flex flex-col bg-slate-deep border-control-edge transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] inset-x-0 bottom-0 max-h-[92dvh] rounded-t-sheet border-t ${open ? '' : 'translate-y-full'} lg:inset-x-auto lg:right-0 lg:top-0 lg:bottom-0 lg:max-h-none lg:w-[440px] lg:rounded-none lg:border-t-0 lg:border-l lg:translate-y-0 ${open ? '' : 'lg:translate-x-full'}`}
      >
        <PanelGrab onClose={closeAddTimer} label="Close timer" />
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:pb-6 flex flex-col gap-4">
          <div data-sheet-grab className="sticky top-0 z-10 -mx-5 px-5 pt-3 lg:pt-5 pb-1 bg-slate-deep">
            <SheetGrab onClose={closeAddTimer} label="Close timer" />
            <h2
              ref={title}
              id="timerSheetTitle"
              tabIndex={-1}
              className="font-display text-lg font-bold text-ink-bright focus:outline-hidden"
            >
              {heading}
            </h2>
            <p className="text-sub text-ink-muted mt-1">{sub}</p>
          </div>
          {kind === 'refine' && <RefineForm onStarted={closeAddTimer} />}
          {(kind === 'crop' || kind === 'custom') && <TimedForm key={kind} kind={kind} onStarted={closeAddTimer} />}
        </div>
      </div>
    </>
  );
}
