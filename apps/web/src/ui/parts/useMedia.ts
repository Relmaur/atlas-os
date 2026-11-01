// A media query as React state, for layouts that change what's rendered rather than only how it looks.
import { useCallback, useSyncExternalStore } from 'react';

export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      const media = matchMedia(query);
      media.addEventListener('change', listener);
      return () => {
        media.removeEventListener('change', listener);
      };
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches);
}
