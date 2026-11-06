// Where the desktop shell (the nav and the command bar) is drawn: the app's page, or the Codex's (wiki/index.html,
// round 6, d08). On the Codex page the app's addresses are a folder up, the Codex is this page, and search is the
// Codex's own field (the app's palette isn't on this page).
let codex: { onSearch: () => void } | null = null;

/** Called once by the Codex page's entry. */
export function shellOnCodexPage(onSearch: () => void): void {
  codex = { onSearch };
}
export const onCodexPage = (): boolean => codex !== null;

/** An app address as this page reaches it: `#systems` from the app, `../#systems` from the Codex. */
export function appHref(href: string): string {
  if (!codex) return href;
  if (href === 'wiki/') return '#/';
  return href.startsWith('#') ? `../${href}` : href;
}

/** Search: the app's palette, or the Codex's own field. */
export function shellSearch(appSearch: () => void): void {
  if (codex) codex.onSearch();
  else appSearch();
}

/** The Session screen, which on the Codex page is back in the app. */
export function goToSession(open: () => void): void {
  if (codex) location.href = '../#session';
  else open();
}
