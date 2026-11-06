// An element's width as it changes, for things drawn for the room they have (System detail's band, a note's
// Markdown beside its preview) rather than stretched.
import { useEffect, useRef, useState, type RefObject } from 'react';

export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
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
