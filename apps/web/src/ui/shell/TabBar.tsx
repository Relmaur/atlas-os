// The floating tab bar below lg, and the rail's tabs from lg (the Codex page carries a static copy): four sections, Home · Log · Runs · Codex, and
// the round search key beside them. Every screen lights the tab of the section it belongs to.
import { useEffect } from 'react';
import { rankOutlaw } from '@atlas/core/systems-model';
import { appState, isLoaded, subscribe } from '../../app/store.ts';
import { useOutlawReady } from './counts.ts';
import { useSection } from './section-store.ts';
import { toggleSearch, useSearchOpen } from './Search.tsx';
import { useSyncAttention } from '../../app/sync.ts';

// Which tab each section of the main page belongs to. More is Settings, reached from Home; a run and the calculators
// belong to Runs; the Codex tab's books and Guides live on this page.
const TAB_OF: Record<string, string> = {
  home: 'home',
  session: 'home',
  more: 'home',
  card: 'home',
  cards: 'home',
  frontier: 'log',
  systems: 'log',
  map: 'log',
  system: 'log',
  gear: 'log',
  ship: 'log',
  notes: 'log',
  note: 'log',
  runs: 'runs',
  outlaw: 'runs',
  calculators: 'runs',
  plan: 'runs',
  crafts: 'runs',
  guides: 'codex'
};
export function tabOf(section: string): string {
  return TAB_OF[section] ?? (section.startsWith('book') ? 'codex' : 'home');
}

// The four tabs, in the pill and the rail. On the rail Settings has its own item, so it doesn't light Home there.
export function PrimaryTabs({ settingsApart = false }: { settingsApart?: boolean }) {
  const section = useSection();
  const { ready } = useOutlawReady();
  const at = settingsApart && section === 'more' ? '' : tabOf(section);
  const syncAttention = useSyncAttention();
  // `mark` is the dot on the icon: the live dot (the bar's only glow) when a run needs you, or a plain amber dot when
  // Settings needs you (sync can't continue on its own). Either way the tab's name says it to a screen reader.
  const tab = (key: string, href: string, icon: string, label: string, mark?: 'live' | 'alert', note?: string) => (
    <a
      href={href}
      data-tab={key}
      aria-current={at === key ? 'page' : undefined}
      title={settingsApart ? `${label} (g then ${label[0]?.toLowerCase() ?? ''})` : undefined}
      className="tab-item"
    >
      <span className="tab-icon">
        <i className={`ph-bold ${icon}`} aria-hidden="true" />
        {mark && <span className={mark === 'live' ? 'tab-live' : 'tab-alert'} aria-hidden="true" />}
      </span>
      <span>{label}</span>
      {note && <span className="sr-only"> ({note})</span>}
    </a>
  );
  return (
    <>
      {tab(
        'home',
        '#home',
        'ph-house',
        'Home',
        syncAttention ? 'alert' : undefined,
        syncAttention ? 'sync needs attention' : ''
      )}
      {tab('log', '#systems', 'ph-planet', 'Log')}
      {tab(
        'runs',
        '#runs',
        'ph-path',
        'Runs',
        ready ? 'live' : undefined,
        ready ? `${ready} ${ready === 1 ? 'station' : 'stations'} ready` : ''
      )}
      {tab('codex', 'wiki/', 'ph-book-open', 'Codex')}
    </>
  );
}

export function TabBar() {
  const searching = useSearchOpen();

  // Ready stations on the installed app's icon too (where the platform supports badges). It keeps counting while the
  // app sits minimised, which is when the icon matters: on its own minute timer, since the screens' clock pauses
  // while the page is hidden.
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const update = () => {
      if (!isLoaded()) return;
      const count = rankOutlaw(appState.systems, appState.outlaw.restockHours).filter(row => row.status.ready).length;
      (count ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => undefined);
    };
    update();
    const timer = setInterval(update, 60_000);
    const unsubscribe = subscribe(update);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  return (
    <div className="lg:hidden">
      <nav id="tabBar" aria-label="Primary" className="tab-bar">
        <PrimaryTabs />
      </nav>
      <button
        type="button"
        onClick={toggleSearch}
        aria-label="Search and quick actions"
        aria-expanded={searching}
        className="search-key"
      >
        <i className="ph-bold ph-magnifying-glass" aria-hidden="true" />
      </button>
    </div>
  );
}
