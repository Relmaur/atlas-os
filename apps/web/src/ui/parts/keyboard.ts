// The on-screen keyboard and bottom sheets. iOS lays the keyboard over the page without resizing it, so a sheet
// pinned to the bottom sits under the keyboard and Safari scrolls the whole page to show the field, which leaves the
// field off the top of the screen. This keeps two CSS variables on <html> from the visual viewport (the part of the
// page the keyboard leaves showing): --kb-inset, how much the keyboard covers (counting any page scroll Safari
// made), and --kb-height, what's left. Sheets
// with fields carry `kb-sheet` (theme.css), which lifts them above the keyboard and fits them in what's left; then
// the focused field is brought to the middle of its sheet. Browsers that resize the page for the keyboard
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
      sheetField()?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, SETTLE_MS);
  };
  document.addEventListener('focusin', reveal);
  viewport.addEventListener('resize', reveal);
}

// The focused text field, when it's inside a sheet that follows the keyboard.
function sheetField(): HTMLElement | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return null;
  return active.closest('.kb-sheet') ? active : null;
}
