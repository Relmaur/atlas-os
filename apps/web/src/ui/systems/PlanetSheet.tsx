// The planet sheet (design 35): a bottom sheet below lg and a 460px right panel from lg (37), one for the whole app.
// System detail opens it to add a planet; a planet's own view (36) opens it with the pencil. The form is PlanetForm.
import { useCallback, useRef } from 'react';
import { useAppState } from '../useAppState.ts';
import { useFacts } from '../gear/facts-store.ts';
import { PanelGrab, SheetGrab, useSheetDrag, useSheetOpen } from '../parts/Sheet.tsx';
import { useSection } from '../shell/section-store.ts';
import { PlanetForm } from './PlanetScan.tsx';
import { closePlanetSheet, usePlanetSheet } from './planet-sheet-store.ts';

const SHEET_LAYOUT = '(min-width: 0px)';

export function PlanetSheet() {
  const state = useAppState();
  const facts = useFacts();
  const sheet = usePlanetSheet();
  const section = useSection();
  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const close = useCallback(() => {
    closePlanetSheet();
  }, []);
  useSheetDrag(box, close);
  useSheetOpen(sheet.open, close, { layout: SHEET_LAYOUT, focus: title });

  const system = state.systems.find(item => item.id === sheet.systemId);
  const planet = system?.planets.find(item => item.id === sheet.planetId);
  // The resources levels already in the log: the wiki lists none, so the combobox offers the player's own words.
  const levels = [
    ...new Set(state.systems.flatMap(item => item.planets.map(other => other.abundance)).filter(Boolean))
  ].sort();

  return (
    <>
      <div
        onClick={close}
        className={`fixed inset-0 z-[55] bg-scrim backdrop-blur-[2px] transition-opacity duration-200 ${sheet.open ? '' : 'opacity-0 pointer-events-none'}`}
      />
      <div
        ref={box}
        id="planetSheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planetSheetTitle"
        aria-hidden={!sheet.open}
        inert={!sheet.open}
        className={`kb-sheet fixed z-[56] flex flex-col bg-slate-deep border-control-edge transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] inset-x-0 bottom-0 max-h-[92dvh] rounded-t-sheet border-t ${sheet.open ? '' : 'translate-y-full'} lg:inset-x-auto lg:right-5 lg:top-5 lg:bottom-5 lg:max-h-none lg:w-[540px] lg:rounded-panel lg:overflow-hidden lg:border lg:translate-y-0 ${sheet.open ? '' : 'lg:translate-x-[calc(100%+20px)]'}`}
      >
        <PanelGrab onClose={close} label="Close body" />
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="px-5 pt-3 lg:hidden">
            <SheetGrab onClose={close} label="Close body" />
          </div>
          {system && (
            <PlanetForm
              key={sheet.session}
              system={system}
              planet={planet}
              facts={facts}
              levels={levels}
              accounts={state.accounts}
              titleId="planetSheetTitle"
              titleRef={title}
              onDone={deleted => {
                closePlanetSheet();
                // A planet deleted from its own view leaves for its system.
                if (deleted && section === 'planet') location.replace(`#system/${encodeURIComponent(system.id)}`);
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
