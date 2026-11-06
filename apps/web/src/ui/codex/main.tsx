// The Codex page's entry (wiki/index.html): the service worker, then the React page once the archive has loaded.
import '../../app/zod-config.ts'; // before anything that parses with Zod
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerServiceWorker } from '../../app/pwa.js';
import { Codex } from './Codex.tsx';
import { loadCodex } from './codex-data.ts';
import { endBoot } from '../parts/boot.ts';
import { readSavedState } from '../../app/store.ts';
import { startNav } from '../shell/nav-store.ts';
import { shellOnCodexPage } from '../shell/place.ts';
import { WorkbenchNav } from '../shell/WorkbenchNav.tsx';
import { CommandBar } from '../shell/CommandBar.tsx';
import { navigate } from './route.ts';

registerServiceWorker();
// From lg the app's nav and command bar frame this page too (round 6, d08), reading the log this device saved.
shellOnCodexPage(() => {
  const field = document.getElementById('codexSearch');
  if (field) field.focus();
  else {
    navigate('#/');
    requestAnimationFrame(() => document.getElementById('codexSearch')?.focus());
  }
});
startNav();
readSavedState();
for (const [id, node] of [
  ['codexNav', <WorkbenchNav key="nav" />],
  ['codexHeader', <CommandBar key="bar" />]
] as const) {
  const host = document.getElementById(id);
  if (host) createRoot(host).render(<StrictMode>{node}</StrictMode>);
}
const root = document.getElementById('codexRoot');
if (root)
  createRoot(root).render(
    <StrictMode>
      <Codex />
    </StrictMode>
  );
endBoot(); // the Codex draws its own placeholders from here
void loadCodex();
