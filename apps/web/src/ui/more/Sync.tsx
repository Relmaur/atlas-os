// Settings → Sync (design 21), a sheet over Settings: turn sync on, pair another device (QR code or the code typed
// in), see how it's going and which devices share the log, and turn it off or delete the cloud copy (ADR-0005).
// Opt-in; nothing leaves the device before Turn on or Pair.
import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { encode } from 'uqr';
import { formatAgo } from '@atlas/core/format';
import { showToast } from '../../app/ui.ts';
import {
  answerPairing,
  answerReview,
  deleteCloudCopy,
  startOver,
  thisDeviceId,
  pairWith,
  restoreBeforeSync,
  SYNC_URL,
  syncCode,
  syncNow,
  turnOffSync,
  turnOnSync,
  useSyncStatus,
  type SyncStatus
} from '../../app/sync.ts';
import { useClock } from '../session/useClock.ts';
import { untilText, useRelayStatus } from '../../app/relay-status.ts';
import { KOFI_URL } from '../../app/support.ts';
import type { Removal } from '@atlas/core/sync';
import { useAppState } from '../useAppState.ts';
import { buttonClass } from '../parts/Button.tsx';
import { ArmButton } from '../parts/Gesture.tsx';

// When the free server is the limit: one quiet invitation to help upgrade it.
export function SupportLine() {
  return (
    <p className="text-caption text-ink-muted">
      ATLAS runs on donations.{' '}
      <a href={KOFI_URL} target="_blank" rel="noopener" className="text-scanner-cyan-pale underline underline-offset-2">
        A coffee on Ko-fi
      </a>{' '}
      helps upgrade the server.
    </p>
  );
}

const PROBLEM: Record<NonNullable<SyncStatus['problem']>, (until: string) => string> = {
  offline: () => 'Offline. Changes stay on this device and sync when you’re back online.',
  server: () => 'Couldn’t reach the sync server. Your log is safe on this device; it tries again soon.',
  gone: () => 'The cloud copy was deleted from another device. Start again to upload this log with a new code.',
  damaged: () => 'The cloud copy couldn’t be opened with this code. Nothing here was changed.',
  storage: () => 'This device’s storage is full, so sync is paused. Free some space, or export a backup.',
  capacity: until =>
    `ATLAS’s free sync server is full for today. Your log is safe on this device and syncs again after ${until}.`,
  busy: until =>
    `The sync server isn’t taking new players today, so sync starts after ${until}. Your log is safe on this device.`,
  unknown: () =>
    'No synced log uses that code, so nothing was paired. Check the code, or turn on sync on your other device first.',
  older: () =>
    'The cloud copy is older than one this device already synced, so it wasn’t used. Your log here is unchanged.',
  review: () => 'This sync would remove a lot from your log, so it’s waiting for you.'
};

// The sheet's body (design 21): this device's sync, the devices in the log, pairing, and the ways out. A prompt for a
// scanned pairing link, a big removal waiting for the person, or a log to put back come first.
export function Sync() {
  const status = useSyncStatus();
  if (!SYNC_URL) return null; // a build without a relay (e.g. a fork): Export/Import still move the log
  // Browsers only give pages encryption on HTTPS or localhost. Without it sync can't seal anything, so say that, rather
  // than let it fail and blame the server. Only a dev server on a LAN address gets here.
  if (!('subtle' in crypto))
    return (
      <p id="syncInsecure" role="status" className="text-sub text-ink-muted">
        Sync can’t run at this address, because browsers only allow encryption on a secure one. Open ATLAS:OS at{' '}
        <a href="https://atlas-os.cloud/app/" className="text-scanner-cyan-pale underline">
          atlas-os.cloud
        </a>{' '}
        to sync. Your log is safe on this device.
      </p>
    );
  return (
    <div id="syncPanel" className="flex flex-col gap-4">
      {status.pending && <PairPrompt replacing={status.enabled} />}
      {status.review && <Review removal={status.review} />}
      {status.restorable && <Restore />}
      {status.enabled ? <On status={status} /> : <Off problem={status.problem} />}
      <p className="text-caption text-ink-muted leading-relaxed">
        The relay deletes a copy after a year without syncing. Lose every device and the code, and it can’t be
        recovered.
      </p>
    </div>
  );
}

// Pairing gives whoever made the code your log, and theirs to you: only ever with your own devices. Replacing a sync
// already on here takes a second, explicit tap.
function PairPrompt({ replacing }: { replacing: boolean }) {
  const [sure, setSure] = useState(false);
  return (
    <div role="alert" className="rounded-card border border-scanner-cyan-edge bg-scanner-cyan-tint p-4 space-y-3">
      <p className="text-sm text-ink">
        Pair this device with the code you scanned? Its log and the synced log are merged.{' '}
        <strong className="text-ink-bright">Only pair with a code from your own device:</strong> whoever made it can
        read, change and erase your log.
      </p>
      {replacing && (
        <p className="text-sm text-units-amber-pale">
          This device already syncs with another code. Pairing replaces that sync here (the other copy stays in the
          cloud).
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (replacing && !sure) setSure(true);
            else void answerPairing(true);
          }}
          className={buttonClass('jump', 'M')}
        >
          {replacing && !sure ? 'Replace and pair' : replacing ? 'Yes, replace it' : 'Pair'}
        </button>
        <button type="button" onClick={() => void answerPairing(false)} className={buttonClass('secondary', 'M')}>
          Not now
        </button>
      </div>
    </div>
  );
}

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

function Review({ removal }: { removal: Removal }) {
  const parts = [
    removal.systems && plural(removal.systems, 'system'),
    removal.planets && plural(removal.planets, 'planet'),
    removal.visits && plural(removal.visits, 'visit'),
    removal.gear && plural(removal.gear, 'ship or Multi-Tool'),
    removal.notes && plural(removal.notes, 'note')
  ].filter(Boolean);
  return (
    <div
      id="syncReview"
      role="alert"
      className="rounded-card border border-units-amber-edge bg-units-amber-tint p-4 space-y-3"
    >
      <p className="text-sm text-ink">
        This sync would remove <strong className="text-ink-bright">{parts.join(', ')}</strong> ({removal.total} of{' '}
        {removal.before} records). If you deleted them on another device, apply it: your log from before is kept here,
        so you can put it back. If not, keep this device’s log: it replaces the cloud copy.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void answerReview('apply')} className={buttonClass('primary', 'M')}>
          Apply the removal
        </button>
        <button type="button" onClick={() => void answerReview('keep')} className={buttonClass('secondary', 'M')}>
          Keep this device’s log
        </button>
      </div>
    </div>
  );
}

function Restore() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-hairline bg-panel-glass p-3.5">
      <p className="text-caption text-ink-soft">Your log from before the last big removal is kept on this device.</p>
      <button
        type="button"
        onClick={() => {
          showToast(restoreBeforeSync() ? 'Put back. It syncs to your other devices next.' : 'Couldn’t put it back.');
        }}
        className={buttonClass('secondary', 'S')}
      >
        Put it back
      </button>
    </div>
  );
}

function Off({ problem }: { problem: SyncStatus['problem'] }) {
  const [entering, setEntering] = useState(problem === 'unknown');
  return (
    <>
      <Head icon="ph-arrows-clockwise" tone="off" title="Sync is off">
        {problem === 'unknown'
          ? PROBLEM.unknown('')
          : 'Your atlas on your PC and your phone, kept in step. No account needed.'}
      </Head>
      <p className="text-sub text-ink-soft">
        Your atlas is encrypted on this device before it leaves. The relay only ever holds a sealed box it can’t open.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void turnOnSync()} className={buttonClass('primary', 'M')}>
          Turn on sync
        </button>
        <button
          type="button"
          aria-expanded={entering}
          aria-controls="syncCodeForm"
          onClick={() => {
            setEntering(!entering);
          }}
          className={buttonClass('secondary', 'M')}
        >
          I have a code
        </button>
      </div>
      {entering && <CodeForm />}
    </>
  );
}

function CodeForm() {
  const [error, setError] = useState(false);
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get('code');
    void pairWith(typeof text === 'string' ? text : '').then(ok => {
      setError(!ok);
    });
  };
  return (
    <form id="syncCodeForm" onSubmit={submit} className="space-y-2">
      <label htmlFor="syncCodeInput" className="block text-caption text-ink-muted">
        The sync code from your other device (Settings → Sync → Pair another device). Only use a code from your own
        device: whoever made it can read and change your log. On an iPhone, paste it here: the installed app doesn’t
        share storage with Safari, so the QR code opens the wrong one.
      </label>
      <div className="flex gap-2">
        <input
          id="syncCodeInput"
          name="code"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error}
          aria-describedby={error ? 'syncCodeError' : undefined}
          className="min-w-0 flex-1 h-11 px-3 rounded-control bg-slate-ground border border-control-edge font-mono text-base md:text-sm text-ink-bright focus:border-scanner-cyan-edge-strong focus:outline-hidden"
        />
        <button type="submit" className={buttonClass('jump', 'M')}>
          Pair
        </button>
      </div>
      {error && (
        <p id="syncCodeError" className="text-caption text-units-amber-text">
          That isn’t a sync code. It’s 43 letters, digits, - and _.
        </p>
      )}
    </form>
  );
}

function On({ status }: { status: SyncStatus }) {
  const now = useClock(false);
  const relay = useRelayStatus();
  const healthy = !status.problem;
  const text = status.busy
    ? 'Syncing…'
    : status.problem
      ? PROBLEM[status.problem](untilText(relay.until))
      : status.at
        ? `Last synced ${formatAgo(new Date(status.at).toISOString(), now)}.`
        : 'On. The first sync runs when you’re online.';
  const id = status.fingerprint ? ` Copy ID ${status.fingerprint}: the same on all your devices.` : '';
  return (
    <>
      <Head
        icon={healthy ? 'ph-check' : 'ph-warning'}
        tone={healthy ? 'on' : 'warn'}
        title="Sync is on"
        action={
          status.problem !== 'gone' && (
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={status.busy}
              className={buttonClass('secondary', 'S')}
            >
              Sync now
            </button>
          )
        }
      >
        {text}
        {healthy && !status.busy && id}
      </Head>
      <p className="text-sub text-ink-soft">
        Your atlas is encrypted on this device before it leaves. The relay only ever holds a sealed box it can’t open.
      </p>
      {(status.problem === 'capacity' || status.problem === 'busy') && <SupportLine />}
      {status.problem === 'older' && (
        <button type="button" onClick={() => void answerReview('keep')} className={buttonClass('secondary', 'M')}>
          Keep this device’s log (replaces the cloud copy)
        </button>
      )}
      {status.problem === 'gone' && (
        <button type="button" onClick={() => void turnOnSync()} className={buttonClass('primary', 'M')}>
          Start sync again
        </button>
      )}
      <Devices now={now} />
      {/* Only once the copy is in the cloud: a code shared before that would pair with nothing. */}
      {status.at !== null && status.problem !== 'gone' && <PairCard />}
      <div className="flex items-center justify-between gap-3 px-0.5">
        <span id="syncHereLabel" className="text-[14px] text-ink-bright">
          Sync on this device
        </span>
        <button
          type="button"
          role="switch"
          aria-checked="true"
          aria-labelledby="syncHereLabel"
          onClick={turnOffSync}
          className="switch"
        />
      </div>
      <ArmButton
        label="Delete the cloud copy"
        armedLabel="Tap again to delete it for every device"
        onConfirm={() => {
          void deleteCloudCopy().then(ok => {
            showToast(
              ok
                ? 'Cloud copy deleted. Your log stays on this device.'
                : 'Couldn’t reach the sync server; the cloud copy is still there.'
            );
          });
        }}
      />
      <p className="-mt-2 text-caption text-ink-muted text-center">Your atlas stays on your devices either way.</p>
    </>
  );
}

// The devices this log knows, from the log itself (each one writes its own entry when it syncs, at most hourly).
function Devices({ now }: { now: number }) {
  const { devices } = useAppState();
  const me = thisDeviceId();
  if (!devices.length) return null;
  const list = [...devices].sort(
    (a, b) => Number(b.id === me) - Number(a.id === me) || Date.parse(b.lastSync) - Date.parse(a.lastSync)
  );
  return (
    <div className="flex flex-col gap-2">
      <ul
        aria-label="Devices"
        className="rounded-card bg-panel-glass border border-hairline divide-y divide-hairline overflow-hidden"
      >
        {list.map(device => (
          <li key={device.id} className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden="true"
              className="w-[34px] h-[34px] shrink-0 rounded-[10px] grid place-items-center bg-slate-ground border border-control-edge text-scanner-cyan-pale"
            >
              <i className={`ph-bold ${/iPhone|iPad|Android/.test(device.name) ? 'ph-device-mobile' : 'ph-desktop'}`} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold text-ink-bright truncate">
                {device.name || 'A device'}
              </span>
              <span className="block text-caption text-ink-muted">Synced {formatAgo(device.lastSync, now)}</span>
            </span>
            {device.id === me && (
              <span className="h-6 px-2.5 rounded-full grid place-items-center border border-ready-emerald-edge-soft bg-ready-emerald-tint text-[11px] font-semibold text-ready-emerald-text">
                This device
              </span>
            )}
          </li>
        ))}
      </ul>
      {list.length > 1 && <StartOver />}
    </div>
  );
}

// Every device shares one code, so dropping one means a new code for the ones kept.
function StartOver() {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-0.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="syncStartOver"
        onClick={() => {
          setOpen(!open);
        }}
        className="text-caption font-semibold text-scanner-cyan-pale hover:text-quantity-cyan"
      >
        Remove a device?
      </button>
      {open && (
        <div id="syncStartOver" className="mt-2 flex flex-col gap-2">
          <p className="text-caption text-ink-muted">
            Your devices share one code, so one can’t be removed on its own. Start over with a new code: the cloud copy
            is deleted, sync starts again here, and you pair the devices you keep.
          </p>
          <ArmButton
            label="Start over with a new code"
            armedLabel="Tap again to start over"
            icon="ph-arrow-counter-clockwise"
            onConfirm={() => {
              void startOver().then(ok => {
                showToast(
                  ok
                    ? 'Started over with a new code. Pair the devices you keep.'
                    : 'Couldn’t reach the sync server; nothing changed.'
                );
              });
            }}
          />
        </div>
      )}
    </div>
  );
}

// Pairing (design 21's amber card): the code behind a warning first, since screens get streamed and screenshotted.
function PairCard() {
  const [shown, setShown] = useState(false);
  return (
    <section
      id="syncCodeCard"
      aria-labelledby="syncPairTitle"
      className="rounded-card border border-[rgba(251,191,36,0.4)] bg-[rgba(245,158,11,0.06)] p-4 flex flex-col gap-3"
    >
      <h3 id="syncPairTitle" className="font-display font-bold text-[14px] text-ink-bright flex items-center gap-2">
        <i className="ph-bold ph-qr-code text-units-amber-text" aria-hidden="true" />
        Pair another device
      </h3>
      {shown ? (
        <CodeCard
          onHide={() => {
            setShown(false);
          }}
        />
      ) : (
        <>
          <p className="text-sub text-units-amber-pale">
            The pairing code opens your whole atlas. Don’t show it on stream or in a screenshot.
          </p>
          <button
            type="button"
            onClick={() => {
              setShown(true);
            }}
            className={buttonClass('primary', 'M')}
          >
            <i className="ph-bold ph-eye" aria-hidden="true" />
            Show pairing code
          </button>
        </>
      )}
    </section>
  );
}

// The code as a QR (a link that opens the app and offers to pair) and as text to paste.
function CodeCard({ onHide }: { onHide: () => void }) {
  const code = syncCode();
  if (!code) return null;
  const link = `${location.origin}${location.pathname}#pair=${code}`;
  const copy = () => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        showToast('Sync code copied.');
      })
      .catch(() => {
        showToast('Couldn’t copy here; select the code instead.');
      });
  };
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <QrCode text={link} />
        <p className="text-sub text-ink-soft">
          Scan it with the other device’s camera, or open Settings → Sync → I have a code there and paste the code.
        </p>
      </div>
      <p className="break-all select-all rounded-control bg-slate-deep px-3 py-2 font-mono text-sm text-quantity-cyan">
        {code}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={buttonClass('secondary', 'S')}>
          <i className="ph-bold ph-copy" aria-hidden="true" /> Copy code
        </button>
        <button type="button" onClick={onHide} className={buttonClass('ghost', 'S')}>
          Hide code
        </button>
      </div>
      <p className="text-caption text-ink-muted">
        AI assistants can read this log too, through{' '}
        <a
          href="https://github.com/Relmaur/atlas-os/blob/main/docs/mcp.md"
          target="_blank"
          rel="noopener"
          className="text-scanner-cyan-pale hover:text-quantity-cyan underline"
        >
          ATLAS’s MCP server
        </a>{' '}
        on your computer, with this code. It only reads, but what it reads goes to the assistant you connect it to.
      </p>
    </>
  );
}

function QrCode({ text }: { text: string }) {
  const { data, size } = encode(text, { ecc: 'M', border: 2 });
  const path = data
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${String(x)} ${String(y)}h1v1h-1z` : '')))
    .join('');
  return (
    <svg
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      role="img"
      aria-label="QR code that pairs another device"
      shapeRendering="crispEdges"
      className="w-44 h-44 shrink-0 rounded-lg bg-white"
    >
      <path d={path} fill="#020617" />
    </svg>
  );
}

// The sheet's head: the state as an icon and a title, and the live line under it (#syncStatus).
function Head({
  icon,
  tone,
  title,
  action,
  children
}: {
  icon: string;
  tone: 'on' | 'warn' | 'off';
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const tile = {
    on: 'bg-ready-emerald-tint border-ready-emerald-edge text-ready-emerald-pale shadow-[0_0_14px_rgba(16,185,129,0.3)]',
    warn: 'bg-units-amber-tint border-units-amber-edge text-units-amber-text',
    off: 'bg-slate-ground border-control-edge text-ink-soft'
  }[tone];
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`w-[46px] h-[46px] shrink-0 rounded-[12px] grid place-items-center border text-xl ${tile}`}
      >
        <i className={`ph-bold ${icon}`} />
      </span>
      <div className="flex-1 min-w-0">
        <h2 id="syncTitle" className="font-display font-bold text-[20px] text-ink-bright">
          {title}
        </h2>
        <p id="syncStatus" role="status" className="text-caption text-ink-muted">
          {children}
        </p>
      </div>
      {action}
    </div>
  );
}
