// The desktop nav from lg (round 6: WorkbenchNav), and the keyboard shortcuts. Below lg the floating tab bar takes
// over.
import { useEffect } from 'react';
import { newNote } from '../notes/note-nav.ts';
import { openSystemEditor } from '../systems/panel-store.ts';
import { openPlanetSheet } from '../systems/planet-sheet-store.ts';
import { openRunEditor } from '../runs/run-editor-store.ts';
import { startNav } from './nav-store.ts';
import { showSection, useSection, useSectionParam } from './section-store.ts';
import { tabOf } from './TabBar.tsx';
import { WorkbenchNav } from './WorkbenchNav.tsx';

const CHORD_MS = 1000;
const SYSTEMS = new Set(['systems', 'system', 'planet']);

// g then a letter jumps to a tab; n logs a system in Systems and starts a note elsewhere in Log. Never while typing or with a modifier held, so the browser's
// own shortcuts and every text field keep working.
function useShortcuts(section: string, param: string) {
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
      } else if (key === 'e' && section === 'system' && param) {
        openSystemEditor(param); // "Edit (E)" on System detail (d01)
      } else if (key === 'e' && section === 'planet' && param.includes('/')) {
        const [systemId = '', planetId = ''] = param.split('/');
        openPlanetSheet(systemId, planetId); // "Edit  E" on a planet (d16)
      } else if (key === 'r' && (section === 'runs' || section === 'outlaw')) {
        openRunEditor(); // "New run  R" in Runs (d06)
        if (section !== 'runs') void showSection('runs'); // the editor lives on the Runs list
      } else if (key === 'n' && SYSTEMS.has(section)) {
        openSystemEditor(); // "Log system  N" on the Systems pane (round 6, d01)
      } else if (key === 'n' && tabOf(section) === 'log') {
        newNote();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [section, param]);
}

export function Sidebar() {
  const section = useSection();
  useShortcuts(section, useSectionParam());
  useEffect(startNav, []);
  return <WorkbenchNav />;
}
