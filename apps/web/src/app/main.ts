// The main page's entry: the frame mounts at once, the state loads, then the screens mount and the section in the
// address opens. Every part of the page is React (src/ui); this only wires them together.
import './zod-config.ts'; // before anything that parses with Zod
import { WikiSearch } from './wiki-data.js';
import { loadAppState, onStorageStatus } from './store.ts';
import { registerServiceWorker } from './pwa.js';
import { mountFrame, mountScreens } from '../ui/mount.tsx';
import { loadGameData } from '../ui/calculators/game-data.ts';
import { startDevice } from '../ui/more/device-store.ts';
import { openSystemEditor } from '../ui/systems/panel-store.ts';
import { onSection, startSections } from '../ui/shell/section-store.ts';
import { reportStorage } from '../ui/shell/StorageBanner.tsx';
import { openSearch } from '../ui/shell/Search.tsx';
import { openSyncSheet } from '../ui/more/SyncSheet.tsx';
import { setWikiEntries } from '../ui/shell/wiki-index.ts';
import { startTimerRunner } from '../ui/session/timer-runner.ts';
import { startSync, takePairingLink } from './sync.ts';
import { startPush } from './push.ts';
import { takeNoteAbout } from '../ui/notes/note-nav.ts';
import { takeRefineTimer } from '../ui/session/sheet-store.ts';
import { endBoot } from '../ui/parts/boot.ts';
import { startKeyboardWatch } from '../ui/parts/keyboard.ts';

// First of all: a #pair=<code> link (from the QR code) leaves the address before anything else runs, so nothing that
// starts below (the service worker, a fetch, an error report) ever sees the code. More then asks before pairing.
takePairingLink();
window.addEventListener('hashchange', takePairingLink); // registered before the sections' own listener
registerServiceWorker();
startDevice();
startKeyboardWatch(); // keeps sheets and their focused field above the iOS keyboard
onStorageStatus(reportStorage);
onSection('calculators', () => void loadGameData());
onSection('plan', () => void loadGameData());
onSection('crafts', () => void loadGameData());
onSection('new-system', () => {
  openSystemEditor();
});
onSection('search', openSearch);
onSection('sync', openSyncSheet);
mountFrame();
void WikiSearch.load('wiki/').then(setWikiEntries);

await loadAppState();
startTimerRunner(); // a timer that finished while the app was closed is announced now
mountScreens();
startSync(); // after the state loads, so the first sync merges with the saved log
startPush(); // resends this device's timer schedule if its alerts are on
takeNoteAbout(); // a note begun from a Codex article
takeRefineTimer(); // a refiner timer begun from a Codex article
startSections(); // after the state loads, so #new-system can open the editor
endBoot();
