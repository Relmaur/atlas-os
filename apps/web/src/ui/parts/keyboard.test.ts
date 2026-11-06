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
  document.body.innerHTML =
    '<div class="kb-sheet"><div id="s" style="overflow-y:auto"><div class="sticky"></div><input id="f"></div></div><input id="outside">';
  const field = document.querySelector<HTMLInputElement>('#f');
  const scroller = document.querySelector<HTMLElement>('#s');
  if (!field || !scroller) throw new Error('fixture');
  const rect = (top: number, height: number) => ({ top, bottom: top + height, height }) as DOMRect;
  // The scroller spans what the keyboard leaves; its sticky header is 60 px; the field sits low in it.
  scroller.getBoundingClientRect = () => rect(40, 380);
  (scroller.firstElementChild as HTMLElement).getBoundingClientRect = () => rect(40, 60);
  field.getBoundingClientRect = () => rect(360, 44);
  const scroll = vi.fn();
  scroller.scrollBy = scroll;
  const pageScroll = vi.fn();
  field.scrollIntoView = pageScroll;
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
  // To the middle of what the header leaves (100 to 420): only the sheet scrolls, never the page under it.
  expect(scroll).toHaveBeenCalledWith({ top: 382 - 260, behavior: 'smooth' });
  expect(pageScroll).not.toHaveBeenCalled();

  // A word combobox goes just under the header.
  scroll.mockClear();
  field.setAttribute('data-combobox', '');
  field.blur();
  field.focus();
  vi.advanceTimersByTime(400);
  expect(scroll).toHaveBeenCalledWith({ top: 360 - 112, behavior: 'smooth' });
  field.removeAttribute('data-combobox');

  // A field outside a sheet is the page's own business.
  scroll.mockClear();
  document.querySelector<HTMLInputElement>('#outside')?.focus();
  vi.advanceTimersByTime(400);
  expect(scroll).not.toHaveBeenCalled();

  // With no keyboard up (a desktop, a hardware keyboard), a field stays where the player put it.
  Object.assign(viewport, { height: 800, offsetTop: 0 });
  viewport.dispatchEvent(new Event('resize'));
  field.focus();
  vi.advanceTimersByTime(400);
  expect(scroll).not.toHaveBeenCalled();
});
