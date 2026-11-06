// Component tests pick the layout they test: happy-dom's window is 1024px wide, which is already the Workbench (round
// 6), so a phone test says so. Only `matches` and the listeners are read (useMedia, a click's matchMedia check).
import { vi } from 'vitest';

export function setWide(wide: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    query =>
      ({
        matches: wide ? /min-width:\s*(768|1024)px/.test(query) : false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {}
      }) as unknown as MediaQueryList // see above: nothing else is read
  );
}
