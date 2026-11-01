// Bottom sheets below lg: the grab bar is the only close control (no ✕). Dragging the sheet's header down past a
// threshold, or a quick flick, dismisses it; tapping the bar does too, so keyboard and screen-reader users keep a close
// button. From lg the same panels are right-hand panels, and PanelGrab takes the bar's place.
import { useEffect, type RefObject } from 'react';

const PHONE = '(max-width: 1023px)';

// `close` decides for itself whether it may close (an editor with unsaved changes refuses and says why); if it
// doesn't, the sheet springs back.
export type SheetClose = () => unknown;

export function useSheetDrag(sheet: RefObject<HTMLElement | null>, close: SheetClose) {
  useEffect(() => {
    const panel = sheet.current;
    if (!panel) return;
    let startY: number | null = null;
    let startAt = 0;
    let dy = 0;
    const start = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const touch = event.touches[0];
      if (!matchMedia(PHONE).matches || event.touches.length !== 1 || !touch) return;
      // The header drags (anywhere but its own controls); the grab bar itself is one of those controls but drags.
      if (!target?.closest('[data-sheet-grab]')) return;
      if (target.closest('button:not([data-sheet-handle]), a, input, textarea, select, label')) return;
      startY = touch.clientY;
      startAt = performance.now();
      dy = 0;
      panel.style.transition = 'none';
    };
    const move = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (startY === null || !touch) return;
      dy = Math.max(0, touch.clientY - startY);
      panel.style.transform = `translateY(${String(dy)}px)`;
    };
    const end = () => {
      if (startY === null) return;
      const flicked = dy / (performance.now() - startAt) > 0.6 && dy > 40;
      startY = null;
      panel.style.transition = '';
      panel.style.transform = ''; // the class transform takes over: it animates closed, or springs back
      if (dy > 120 || flicked) close();
    };
    panel.addEventListener('touchstart', start, { passive: true });
    panel.addEventListener('touchmove', move, { passive: true });
    panel.addEventListener('touchend', end);
    panel.addEventListener('touchcancel', end);
    return () => {
      panel.removeEventListener('touchstart', start);
      panel.removeEventListener('touchmove', move);
      panel.removeEventListener('touchend', end);
      panel.removeEventListener('touchcancel', end);
    };
  }, [sheet, close]);
}

// The bar at the top of a sheet: drawn 40×4, tappable across the sheet's width.
export function SheetGrab({ onClose, label = 'Close' }: { onClose: SheetClose; label?: string }) {
  return (
    <button
      type="button"
      data-sheet-grab
      data-sheet-handle
      onClick={() => {
        onClose();
      }}
      aria-label={label}
      className="lg:hidden -mt-3 mb-1 flex h-9 w-full items-center justify-center rounded-t-3xl"
    >
      <span className="w-10 h-1 rounded-full bg-slate-600" />
    </button>
  );
}

// From lg a sheet is a right-hand panel, and the same rule holds: no ✕, a slim bar down its left edge (with Esc).
export function PanelGrab({ onClose, label = 'Close' }: { onClose: SheetClose; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose();
      }}
      aria-label={label}
      className="hidden lg:flex absolute z-20 left-0 inset-y-0 w-4 items-center justify-center hover:bg-slate-ground"
    >
      <span className="w-1 h-10 rounded-full bg-slate-600" />
    </button>
  );
}

// While a sheet is open: the page behind it doesn't scroll (only while `layout` matches, so rotating to a wider
// layout releases it), Esc closes it, focus moves to `focus` on the sheet layout, and on close focus goes back to
// what opened it. `close` must be stable (useCallback), or the effect reruns on every render.
export function useSheetOpen(
  open: boolean,
  close: () => void,
  {
    layout,
    focus,
    fallback
  }: {
    layout: string;
    focus?: RefObject<HTMLElement | null>;
    fallback?: () => HTMLElement | null; // where focus goes on close when what opened the sheet has gone
  }
) {
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const media = matchMedia(layout);
    const lock = () => {
      document.body.classList.toggle('overflow-hidden', media.matches);
    };
    lock();
    media.addEventListener('change', lock);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    if (media.matches) focus?.current?.focus({ preventScroll: true });
    return () => {
      media.removeEventListener('change', lock);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('overflow-hidden');
      if (!media.matches) return;
      (opener?.isConnected ? opener : fallback?.())?.focus({ preventScroll: true });
    };
  }, [open, close, layout, focus, fallback]);
}
