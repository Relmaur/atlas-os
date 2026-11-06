// The system editor's panel: a side panel from lg up, a bottom sheet below. (A system's own screen is SystemDetails.)
// It stays mounted so it can slide in and out; while closed it is inert and hidden from assistive tech.
import { useEffect, useRef } from 'react';
import { closeSystemPanel, dismissSystemPanel, findSystem, takeReturnFocus, usePanel } from './panel-store.ts';
import { useSheetDrag } from '../parts/Sheet.tsx';
import { useAppState } from '../useAppState.ts';
import { SystemEditor } from './SystemEditor.tsx';
import { PanelGrab } from '../parts/Sheet.tsx';

export function SystemPanel() {
  useAppState();
  const panel = usePanel();
  const sheet = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const system = findSystem(panel.systemId);

  // Each open (and each switch between view and editor) starts at the top.
  useEffect(() => {
    if (panel.open && scroller.current) scroller.current.scrollTop = 0;
  }, [panel.open, panel.session]);

  // While open the page behind doesn't scroll; on close, focus goes back to what opened the panel.
  useEffect(() => {
    if (!panel.open) return;
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
      const opener = takeReturnFocus();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [panel.open]);

  // Esc closes the editor (Cancel's shortcut: it doesn't ask).
  useEffect(() => {
    if (!panel.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSystemPanel();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [panel.open]);

  useSheetDrag(sheet, dismissSystemPanel);

  return (
    <>
      <div
        id="systemBackdrop"
        onClick={closeSystemPanel}
        className={`fixed inset-0 z-[55] bg-slate-950/60 backdrop-blur-[2px] transition-opacity duration-200 ${panel.open ? '' : 'opacity-0 pointer-events-none'}`}
      />
      <div
        ref={sheet}
        id="systemPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="systemPanelTitle"
        aria-hidden={!panel.open}
        inert={!panel.open}
        className={`kb-sheet fixed z-[56] flex flex-col bg-slate-950 border-slate-700 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] inset-x-0 bottom-0 h-[92dvh] rounded-t-3xl border-t ${panel.open ? '' : 'translate-y-full'} lg:inset-x-auto lg:right-0 lg:top-0 lg:h-full lg:w-[440px] xl:w-[620px] lg:rounded-none lg:border-t-0 lg:border-l lg:translate-y-0 ${panel.open ? '' : 'lg:translate-x-full'}`}
      >
        <PanelGrab onClose={dismissSystemPanel} label="Close" />
        <div
          ref={scroller}
          id="systemPanelScroll"
          className="flex-1 overflow-y-auto overscroll-contain rounded-t-3xl lg:rounded-none"
        >
          <div id="systemPanelBody" className="min-h-full flex flex-col">
            {panel.mode === 'edit' && <SystemEditor key={panel.session} existing={system} preset={panel.preset} />}
          </div>
        </div>
      </div>
    </>
  );
}
