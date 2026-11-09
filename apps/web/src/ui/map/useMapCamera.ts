// The galaxy map's camera (round 7, c17): one camera for every zoom move, 280 ms ease-out, so a tap on a pin, a
// breadcrumb or the core chip reads as one move; with reduced motion it jumps and the map fades in over 120 ms.
// Drags and pinches set it directly.
import { useCallback, useEffect, useRef, useState } from 'react';
import { clampPpr, galaxyCamera, tweenCamera, type Camera } from '@atlas/core/map';

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface MapCamera {
  size: { w: number; h: number };
  setSize: (size: { w: number; h: number }) => void;
  cam: Camera | null;
  /** The camera's latest value, for handlers that run between renders. */
  now: () => Camera | null;
  /** Where the camera is going (a move in flight), else where it is: repeated zooms build on it. */
  aim: () => Camera | null;
  goTo: (target: Camera) => void;
  jump: (target: Camera) => void;
  /** Changes on every reduced-motion move, so the drawing remounts and fades in. */
  fade: number;
}

export function useMapCamera(): MapCamera {
  const [size, setSizeState] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Camera | null>(null);
  const [fade, setFade] = useState(0);
  const latest = useRef<Camera | null>(null);
  const frame = useRef(0);
  const aimed = useRef<Camera | null>(null);

  const setSize = useCallback((next: { w: number; h: number }) => {
    setSizeState(prev => (prev.w === next.w && prev.h === next.h ? prev : next));
  }, []);

  // The map opens on the whole galaxy once it has a size; a resize keeps the place and clamps the zoom.
  useEffect(() => {
    if (!size.w || !size.h) return;
    const c = latest.current;
    const next = c ? { ...c, ppr: clampPpr(c.ppr, size.w, size.h) } : galaxyCamera(size.w, size.h);
    latest.current = next;
    setCam(next);
  }, [size.w, size.h]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
    },
    []
  );

  const jump = useCallback((to: Camera) => {
    cancelAnimationFrame(frame.current);
    latest.current = to;
    aimed.current = null;
    setCam(to);
  }, []);

  const goTo = useCallback(
    (target: Camera) => {
      const from = latest.current;
      if (!from || still() || typeof requestAnimationFrame !== 'function') {
        jump(target);
        if (from) setFade(f => f + 1);
        return;
      }
      cancelAnimationFrame(frame.current);
      aimed.current = target;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 280);
        const next = tweenCamera(from, target, 1 - (1 - t) ** 3);
        latest.current = next;
        setCam(next);
        if (t < 1) frame.current = requestAnimationFrame(step);
        else aimed.current = null;
      };
      frame.current = requestAnimationFrame(step);
    },
    [jump]
  );

  const now = useCallback(() => latest.current, []);
  const aim = useCallback(() => aimed.current ?? latest.current, []);
  return {
    size,
    setSize,
    cam,
    now,
    aim,
    goTo,
    jump,
    fade
  };
}
