// Settings (design 20, the section is still #more): reached from the gear in Home's header. Your data (sync, Export,
// Import), this device (keep-awake, timer alerts, the offline Codex, install, storage protection), past play sessions,
// a way to support the app, and what it is.
import { Fragment, useState, type ReactNode, type SubmitEvent } from 'react';
import { MAX_ACCOUNTS } from '@atlas/core/state';
import { formatAgo, formatDuration } from '@atlas/core/format';
import { sessionRecap } from '@atlas/core/session';
import { exportState, importState, undoImport, useImportUndo } from '../../app/backup.ts';
import { useAppState } from '../useAppState.ts';
import { promptInstall, toggleKeepAwake, useDevice, type Device } from './device-store.ts';
import { useWikiCount } from '../shell/wiki-index.ts';
import { SYNC_URL, useSyncAttention, useSyncStatus } from '../../app/sync.ts';
import { FEEDBACK_URL, UPDATES_URL, KOFI_URL } from '../../app/support.ts';
import { AlertsSwitch } from '../session/AlertsSwitch.tsx';
import { usePushStatus } from '../../app/push.ts';
import { goBack } from '../shell/section-store.ts';
import { SyncSheet, openSyncSheet } from './SyncSheet.tsx';
import { addAccount, removeAccount } from '../actions.ts';
import { FIELD } from '../systems/editor-parts.tsx';

const TOP_BUTTON =
  'w-11 h-11 rounded-control bg-slate-ground border border-control-edge grid place-items-center text-ink hover:border-control-edge-hover';
// Handled in shell/Sidebar.tsx and shell/Search.tsx. Shown from lg, where there's usually a keyboard.
const SHORTCUTS: [keys: string, what: string][] = [
  ['/ or Ctrl K', 'Search'],
  ['Ctrl \\', 'Open or close the sidebar'],
  ['g then h', 'Go to Home'],
  ['g then l', 'Go to Log'],
  ['g then r', 'Go to Runs'],
  ['g then c', 'Go to the Codex'],
  ['n', 'Log a system, in Systems; a new note elsewhere in Log'],
  ['Esc', 'Close the top panel']
];
const ROW = 'w-full flex items-center gap-3 min-h-[60px] px-4 py-3 text-left';
const LINK_ROW = `${ROW} hover:bg-slate-ground`;

export function More() {
  const state = useAppState();
  const device = useDevice();
  const wikiCount = useWikiCount();
  const sync = useSyncStatus();
  const syncAttention = useSyncAttention();
  const canUndoImport = useImportUndo();
  const [confirmUndo, setConfirmUndo] = useState(false);
  return (
    <div className="flex flex-col gap-4 pt-[env(safe-area-inset-top)] lg:max-w-[640px] lg:mx-auto">
      <header className="flex flex-col gap-1.5">
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => {
              goBack('home');
            }}
            aria-label="Back to Home"
            className={TOP_BUTTON}
          >
            <i className="ph-bold ph-caret-left text-lg" aria-hidden="true" />
          </button>
        </div>
        <h1 className="font-display text-screen-title text-ink-bright mt-4 lg:mt-0">Settings</h1>
      </header>

      <Group title="Your data">
        {SYNC_URL && (
          <li>
            <button type="button" aria-haspopup="dialog" onClick={openSyncSheet} className={LINK_ROW}>
              <Tile icon="ph-arrows-clockwise" lit />
              <Text title="Sync">
                {!sync.enabled
                  ? 'Your log on your own devices, encrypted'
                  : syncAttention
                    ? 'Needs you: open to see why'
                    : sync.at
                      ? `On · synced ${formatAgo(new Date(sync.at).toISOString())}`
                      : 'On'}
              </Text>
              <span
                className={`h-6 px-2.5 rounded-full grid place-items-center border text-[11px] font-semibold ${
                  syncAttention
                    ? 'border-units-amber-edge bg-units-amber-tint text-units-amber-text'
                    : sync.enabled
                      ? 'border-ready-emerald-edge-soft bg-ready-emerald-tint text-ready-emerald-text'
                      : 'border-control-edge bg-slate-ground text-ink-muted'
                }`}
              >
                {syncAttention ? 'Check' : sync.enabled ? 'On' : 'Off'}
              </span>
            </button>
          </li>
        )}
        <li>
          <a href="#card" className={LINK_ROW}>
            <Tile icon="ph-identification-card" lit />
            <Text title="Traveller Card">Your travels as a living card</Text>
            <Chevron />
          </a>
        </li>
        <li>
          <button type="button" onClick={exportState} className={LINK_ROW}>
            <Tile icon="ph-download-simple" />
            <Text title="Export your atlas">One JSON file, yours to keep</Text>
            <Chevron />
          </button>
        </li>
        <li>
          <label className={`${LINK_ROW} cursor-pointer focus-within:outline-2 focus-within:outline-scanner-cyan-glow`}>
            <Tile icon="ph-upload-simple" />
            <Text title="Import an atlas">Shows what the file holds, then replaces this device’s log</Text>
            <input
              type="file"
              accept=".json,application/json"
              onChange={event => {
                void importState(event.target.files?.[0]);
                event.target.value = ''; // allow re-importing the same file
              }}
              className="sr-only"
            />
          </label>
        </li>
        {canUndoImport && (
          <li>
            <button
              type="button"
              onClick={() => {
                if (confirmUndo) undoImport();
                setConfirmUndo(!confirmUndo);
              }}
              className={LINK_ROW}
            >
              <Tile icon="ph-arrow-counter-clockwise" />
              <Text title={confirmUndo ? 'Tap again to undo the import' : 'Undo import'}>
                {confirmUndo
                  ? 'Anything logged since the import is lost, on every synced device.'
                  : 'Puts back the log this device had before the last import (for a day)'}
              </Text>
            </button>
          </li>
        )}
      </Group>
      <p className="-mt-2 px-1 text-caption text-ink-muted">
        {sync.enabled
          ? 'Everything you log stays on this device, plus the encrypted copy sync keeps for your devices.'
          : 'Everything you log stays on this device until you export it or turn on sync.'}
      </p>

      <Accounts accounts={state.accounts} myGlyphs={state.myGlyphs} />

      <section aria-labelledby="keysTitle" className="hidden lg:block">
        <h2 id="keysTitle" className="text-label uppercase text-ink-label px-1 pb-2">
          Keyboard
        </h2>
        <dl className="rounded-card bg-panel-glass border border-hairline px-4 py-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sub text-ink">
          {SHORTCUTS.map(([keys, what]) => (
            <Fragment key={keys}>
              <dt className="font-mono text-caption text-ink-soft">{keys}</dt>
              <dd>{what}</dd>
            </Fragment>
          ))}
        </dl>
      </section>

      <Group title="This device">
        {device.wakeSupported && (
          <li className={ROW}>
            <Tile icon="ph-sun-dim" />
            <Text title="Keep screen on" id="wakeLabel">
              While the app is open, so it’s ready next to your screen
            </Text>
            <button
              type="button"
              role="switch"
              aria-checked={device.awake}
              aria-labelledby="wakeLabel"
              onClick={toggleKeepAwake}
              className="switch"
            />
          </li>
        )}
        <Alerts />
        <li>
          <a href="wiki/" className={LINK_ROW}>
            <Tile icon="ph-books" />
            <Text title="Offline Codex">
              {wikiCount === null ? 'The wiki’s game pages' : `${wikiCount.toLocaleString()} articles`} · on this device
            </Text>
            <Chevron />
          </a>
        </li>
        <li id="installRow" className={ROW}>
          <Tile icon="ph-device-mobile" />
          <Text title="App">{installText(device)}</Text>
          {device.installable && (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="h-9 px-3 rounded-control border border-ready-emerald-edge bg-ready-emerald-tint text-caption font-semibold text-ready-emerald-text hover:bg-ready-emerald-tint-hover"
            >
              Install
            </button>
          )}
        </li>
        <li className={ROW}>
          <Tile icon="ph-hard-drives" />
          <Text title="Storage">
            {device.persisted === null
              ? 'Checking…'
              : device.persisted
                ? 'Protected: the browser won’t clear your log to free up space.'
                : 'The browser may clear site data when space runs low. Install the app, and export a backup now and then.'}
          </Text>
        </li>
      </Group>

      {state.sessions.length > 0 && (
        <Group title="Play sessions">
          {state.sessions
            .slice(-5)
            .reverse()
            .map(session => {
              const recap = sessionRecap(state, session, Date.parse(session.endedAt));
              return (
                <li key={session.startedAt} className={ROW}>
                  <Tile icon="ph-hourglass-medium" />
                  <Text
                    title={new Date(session.startedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  >
                    {formatDuration(recap.elapsed)} · {recap.visits} visit{recap.visits === 1 ? '' : 's'}
                    {recap.packetRuns
                      ? ` · ${String(recap.packetRuns)} packet run${recap.packetRuns === 1 ? '' : 's'}`
                      : ''}
                    {recap.timersDone ? ` · ${String(recap.timersDone)} timer${recap.timersDone === 1 ? '' : 's'}` : ''}
                  </Text>
                </li>
              );
            })}
        </Group>
      )}

      {KOFI_URL && (
        <section aria-labelledby="supportTitle" className="flex flex-col">
          <h2 id="supportTitle" className="text-label uppercase text-ink-label px-1 pb-2">
            Support
          </h2>
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener"
            className="rounded-card bg-panel-glass border border-[rgba(251,191,36,0.3)] p-4 flex items-center gap-3 hover:border-units-amber-edge"
          >
            <span
              aria-hidden="true"
              className="w-11 h-11 shrink-0 rounded-[12px] grid place-items-center bg-units-amber-tint border border-units-amber-edge text-units-amber-text"
            >
              <i className="ph-bold ph-coffee text-xl" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold text-ink-bright">Buy me a coffee</span>
              <span className="block text-caption text-ink-muted">
                Free, with nothing locked. A coffee helps keep sync running.
              </span>
            </span>
            <i className="ph-bold ph-arrow-square-out text-ink-label" aria-hidden="true" />
            <span className="sr-only"> (Ko-fi, opens in a new tab)</span>
          </a>
        </section>
      )}

      <section aria-labelledby="aboutTitle" className="flex flex-col">
        <h2 id="aboutTitle" className="text-label uppercase text-ink-label px-1 pb-2">
          About
        </h2>
        <div className="rounded-card bg-panel-glass border border-hairline p-4 flex flex-col gap-1.5">
          <p className="font-display font-bold text-[14px] text-ink-bright">ATLAS:OS</p>
          <p className="font-mono text-caption text-ink-muted">local-first · open source</p>
          <p id="appVersion" className="font-mono text-caption text-ink-muted">
            {[
              `v${import.meta.env.VITE_APP_VERSION ?? 'dev'}`,
              import.meta.env.VITE_APP_COMMIT,
              import.meta.env.VITE_APP_BUILT
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="text-caption text-ink-muted">
            Fan-made. Not affiliated with Hello Games. It doesn’t connect to the game or read your save. Codex text from
            the No Man’s Sky Wiki and its contributors, CC BY-NC-SA 3.0; the code is MIT-licensed.
          </p>
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener"
            className="self-start mt-1 inline-flex items-center gap-1.5 text-caption font-semibold text-scanner-cyan-pale hover:text-quantity-cyan"
          >
            Feedback and source code
            <i className="ph-bold ph-arrow-square-out" aria-hidden="true" />
          </a>
          <a
            href={UPDATES_URL}
            target="_blank"
            rel="noopener"
            className="self-start inline-flex items-center gap-1.5 text-caption font-semibold text-scanner-cyan-pale hover:text-quantity-cyan"
          >
            What's new
            <i className="ph-bold ph-arrow-square-out" aria-hidden="true" />
          </a>
          <a
            href="mailto:hello@atlas-os.cloud"
            className="self-start inline-flex items-center gap-1.5 text-caption font-semibold text-scanner-cyan-pale hover:text-quantity-cyan"
          >
            hello@atlas-os.cloud
            <i className="ph-bold ph-envelope-simple" aria-hidden="true" />
          </a>
        </div>
      </section>
      <SyncSheet />
    </div>
  );
}

// Timer alerts while the app is asleep (ADR-0006), with their own label and privacy line.
function Alerts() {
  if (usePushStatus().support === 'no') return null;
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <Tile icon="ph-bell-ringing" />
      <div className="flex-1 min-w-0">
        <AlertsSwitch id="morePushSwitch" />
      </div>
    </li>
  );
}

// The names the player plays under, on any platform: a planet's "Discovered by" offers them as Me.
function Accounts({ accounts, myGlyphs }: { accounts: string[]; myGlyphs: string[] }) {
  const [name, setName] = useState('');
  const add = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (addAccount(name)) setName('');
  };
  return (
    <Group title="In the game">
      <li className={ROW}>
        <Tile icon="ph-user-circle" lit />
        <Text title="Your game accounts">
          The names you play under. A planet’s Discovered by fills them in with one tap, as Me.
        </Text>
      </li>
      {accounts.map(account => (
        <li key={account} className={`${ROW} min-h-[52px]`}>
          <span className="flex-1 min-w-0 pl-[46px] text-row text-ink-bright break-words">{account}</span>
          <button
            type="button"
            onClick={() => {
              removeAccount(account);
            }}
            aria-label={`Remove ${account}`}
            className="w-9 h-9 rounded-control grid place-items-center text-ink-muted hover:text-ink-bright hover:bg-slate-ground"
          >
            <i className="ph-bold ph-x" aria-hidden="true" />
          </button>
        </li>
      ))}
      <li>
        <a href="#glyphs" className={LINK_ROW}>
          <Tile icon="ph-circles-three-plus" />
          <Text title="My glyphs">
            {myGlyphs.length ? `${String(myGlyphs.length)} of 16 found` : 'The portal glyphs you’ve found'}
          </Text>
          <Chevron />
        </a>
      </li>
      {accounts.length < MAX_ACCOUNTS && (
        <li className="px-4 py-3">
          <form onSubmit={add} className="flex gap-2 pl-[46px]">
            <input
              aria-label="Add a game account"
              value={name}
              onChange={event => {
                setName(event.target.value);
              }}
              maxLength={60}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={accounts.length ? 'Another account' : 'e.g. your PSN, Steam or Xbox name'}
              className={`${FIELD} flex-1 min-w-0`}
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="h-11 px-4 rounded-control border border-control-edge bg-slate-ground text-caption font-semibold text-ink-bright hover:border-control-edge-hover disabled:text-ink-disabled disabled:hover:border-control-edge"
            >
              Add
            </button>
          </form>
        </li>
      )}
    </Group>
  );
}

function installText(device: Device): string {
  if (device.standalone) return 'Installed: full screen, works offline.';
  if (device.installable) return 'Install it for a full-screen app that works offline.';
  if (device.ios) return 'To install: tap Share, then “Add to Home Screen”.';
  return 'To install: use “Install app” or “Add to Home Screen” in the browser menu.';
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = `settings-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <h2 id={id} className="text-label uppercase text-ink-label px-1 pb-2">
        {title}
      </h2>
      <ul className="rounded-card bg-panel-glass border border-hairline divide-y divide-hairline overflow-hidden">
        {children}
      </ul>
    </section>
  );
}

function Tile({ icon, lit = false }: { icon: string; lit?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`w-[34px] h-[34px] shrink-0 rounded-[10px] grid place-items-center border text-[17px] ${
        lit
          ? 'bg-scanner-cyan-tint border-scanner-cyan-edge text-scanner-cyan-pale'
          : 'bg-slate-ground border-control-edge text-ink-soft'
      }`}
    >
      <i className={`ph-bold ${icon}`} />
    </span>
  );
}

function Text({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <span className="flex-1 min-w-0">
      <span id={id} className="block text-[14px] font-semibold text-ink-bright">
        {title}
      </span>
      <span className="block text-caption text-ink-muted">{children}</span>
    </span>
  );
}

const Chevron = () => <i className="ph-bold ph-caret-right text-ink-label" aria-hidden="true" />;
