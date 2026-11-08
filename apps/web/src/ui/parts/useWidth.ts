// An element's width as it changes, for things drawn for the room they have (System detail's band, a note's
// Markdown beside its preview) rather than stretched.
import { useCallback, useState, type RefCallback } from 'react';

// A callback ref, not a mount-time effect: the element can arrive after the component mounts (System detail is
// mounted before any system is open, so its band only appears when one opens), and a one-shot effect would never
// measure it, leaving the width at 0 and the diagram undrawn until a reload.
export function useWidth<T extends HTMLElement>(): [RefCallback<T>, number] {
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    const measure = () => {
      setWidth(Math.round(el.clientWidth));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => {
      watch.disconnect();
    };
  }, []);
  return [ref, width];
}
