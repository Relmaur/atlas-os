import { afterEach, expect, test, vi } from 'vitest';
import { startKeyboardWatch } from './keyboard.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

test('the keyboard’s cover and what it leaves become CSS variables, and the focused field comes into view', () => {
  vi.useFakeTimers();
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 800);
  document.body.innerHTML = '<div class="kb-sheet"><input id="f"></div><input id="outside">';
  const field = document.querySelector<HTMLInputElement>('#f');
  if (!field) throw new Error('fixture');
  const scroll = vi.fn();
  field.scrollIntoView = scroll;
  startKeyboardWatch();
  const root = document.documentElement.style;
  expect(root.getPropertyValue('--kb-inset')).toBe('0px');

  field.focus();
  // The keyboard slides up over 340 px, and Safari has scrolled the page 40 px to reach the field.
  Object.assign(viewport, { height: 420, offsetTop: 40 });
  viewport.dispatchEvent(new Event('resize'));
  expect(root.getPropertyValue('--kb-inset')).toBe('340px');
  expect(root.getPropertyValue('--kb-height')).toBe('420px');
  vi.advanceTimersByTime(400);
  expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });

  // A field outside a sheet is the page's own business.
  scroll.mockClear();
  document.querySelector<HTMLInputElement>('#outside')?.focus();
  vi.advanceTimersByTime(400);
  expect(scroll).not.toHaveBeenCalled();
});
