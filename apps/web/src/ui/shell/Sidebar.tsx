// The left rail from lg (design/desktop-direction): the search key, the same four tabs as the phone's pill, and
// Settings at the foot. Below lg the floating tab bar takes over. It also holds the keyboard shortcuts.
import { useEffect } from 'react';
import { newNote } from '../notes/note-nav.ts';
import { toggleSearch, useSearchOpen } from './Search.tsx';
import { showSection, useSection } from './section-store.ts';
import { PrimaryTabs, tabOf } from './TabBar.tsx';

const CHORD_MS = 1000;

// g then a letter jumps to a tab; n starts a note in Log. Never while typing or with a modifier held, so the browser's
// own shortcuts and every text field keep working.
function useShortcuts(section: string) {
  useEffect(() => {
    let chordAt = 0;
    const onKey = (event: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (chordAt && performance.now() - chordAt < CHORD_MS) {
        chordAt = 0;
        if (key === 'h') void showSection('home');
        else if (key === 'l') void showSection('systems');
        else if (key === 'r') void showSection('runs');
        else if (key === 'c') location.assign('wiki/');
      } else if (key === 'g') {
        chordAt = performance.now();
      } else if (key === 'n' && tabOf(section) === 'log') {
        newNote();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [section]);
}

export function Sidebar() {
  const section = useSection();
  const searching = useSearchOpen();
  useShortcuts(section);
  return (
    <nav aria-label="Primary" className="rail">
      <button
        type="button"
        onClick={toggleSearch}
        aria-label="Search and quick actions"
        aria-expanded={searching}
        className="search-key"
      >
        <i className="ph-bold ph-magnifying-glass" aria-hidden="true" />
      </button>
      <PrimaryTabs settingsApart />
      <a
        href="#more"
        aria-current={section === 'more' ? 'page' : undefined}
        title="Settings"
        className="tab-item rail-settings"
      >
        <span className="tab-icon">
          <i className="ph-bold ph-gear-six" aria-hidden="true" />
        </span>
        <span>Settings</span>
      </a>
    </nav>
  );
}
