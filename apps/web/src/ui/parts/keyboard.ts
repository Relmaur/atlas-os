// The on-screen keyboard and bottom sheets. iOS lays the keyboard over the page without resizing it, so a sheet
// pinned to the bottom sits under the keyboard and Safari scrolls the whole page to show the field, which leaves the
// field off the top of the screen. This keeps two CSS variables on <html> from the visual viewport (the part of the
// page the keyboard leaves showing): --kb-inset, how much the keyboard covers (counting any page scroll Safari
// made), and --kb-height, what's left. Sheets
// with fields carry `kb-sheet` (theme.css), which lifts them above the keyboard and fits them in what's left; then
// the focused field is brought to the middle of its sheet, by scrolling the sheet alone. Browsers that resize the page for the keyboard
// (Chrome on Android) report no inset, so nothing moves there.

const SETTLE_MS = 320; // the keyboard's slide; scrolling before it ends aims at the wrong spot

export function startKeyboardWatch(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const root = document.documentElement;
  const update = () => {
    const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    root.style.setProperty('--kb-inset', `${String(Math.round(inset))}px`);
    root.style.setProperty('--kb-height', `${String(Math.round(viewport.height))}px`);
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  update();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const reveal = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      update(); // Safari may have panned the page after the last event; place the sheet from where it ended up
      const field = sheetField();
      // Only with a keyboard up: on a desktop, or with a hardware keyboard, the field is where the player put it.
      if (!field || window.innerHeight - viewport.height - viewport.offsetTop < 1) return;
      // A word combobox goes to the top of what's visible, so its list fits between it and the keyboard (c14).
      revealInSheet(field, field.hasAttribute('data-combobox') ? 'top' : 'center');
    }, SETTLE_MS);
  };
  document.addEventListener('focusin', reveal);
  viewport.addEventListener('resize', reveal);
}

/**
 * Scrolls the sheet's own scroller, and nothing else, so `field` shows between its sticky header and footer.
 * scrollIntoView() also scrolls every ancestor up to the page: for a field the sheet can't move far enough (one near
 * its top), Safari then pans the page under the keyboard, and the sheet slides down past it (owner, 2026-11-06).
 */
export function revealInSheet(field: HTMLElement, where: 'top' | 'center'): void {
  const sheet = field.closest('.kb-sheet');
  let scroller = field.parentElement;
  while (scroller && scroller !== sheet && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY))
    scroller = scroller.parentElement;
  if (!scroller || scroller === sheet) return;
  const box = scroller.getBoundingClientRect();
  // The sticky header and footer cover the scroller's edges: the field must clear them.
  let top = box.top;
  let bottom = box.bottom;
  for (const stuck of scroller.querySelectorAll<HTMLElement>('.sticky')) {
    if (stuck.contains(field)) continue;
    const edge = stuck.getBoundingClientRect();
    if (edge.top - box.top < box.height / 2) top = Math.max(top, edge.bottom);
    else bottom = Math.min(bottom, edge.top);
  }
  const at = field.getBoundingClientRect();
  const gap = 12;
  const delta = where === 'top' ? at.top - (top + gap) : (at.top + at.bottom) / 2 - (top + bottom) / 2;
  // Already in place (or the sheet can't scroll that way): leave it, rather than move anything else.
  if (Math.abs(delta) < 4) return;
  scroller.scrollBy({ top: delta, behavior: 'smooth' });
}

// The focused text field, when it's inside a sheet that follows the keyboard.
function sheetField(): HTMLElement | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return null;
  return active.closest('.kb-sheet') ? active : null;
}
