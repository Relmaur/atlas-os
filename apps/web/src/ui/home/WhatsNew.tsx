// "What's new": after an update arrives, one card on Home, once. It never blocks anything, and someone new doesn't see
// it: they've nothing to be updated from. Remembered on this device only, so it isn't part of the log or sync.
import { useEffect, useState } from 'react';
import { LatestUpdateSchema, whatsNew, type LatestUpdate } from '@atlas/core/whats-new';

const SEEN_KEY = 'atlas_update_seen';
const UPDATES = 'https://atlas-os.cloud/updates/';

// What the build wrote in from the newest file in updates/.
function latestUpdate(): LatestUpdate | null {
  try {
    return LatestUpdateSchema.parse(JSON.parse(import.meta.env.VITE_LATEST_UPDATE ?? 'null'));
  } catch {
    return null;
  }
}
function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}
function markSeen(slug: string) {
  try {
    localStorage.setItem(SEEN_KEY, slug);
  } catch {}
}

export function WhatsNew({ emptyLog }: { emptyLog: boolean }) {
  const [update] = useState(latestUpdate);
  const [seen, setSeen] = useState(readSeen);
  const action = whatsNew(update?.slug ?? null, seen, emptyLog);
  useEffect(() => {
    if (action === 'mark-seen' && update) markSeen(update.slug);
  }, [action, update]);
  if (action !== 'show' || !update) return null;
  const dismiss = () => {
    markSeen(update.slug);
    setSeen(update.slug);
  };
  return (
    <section
      id="whatsNew"
      aria-labelledby="whatsNewTitle"
      className="rounded-card bg-panel-glass border border-hairline p-4 flex items-start gap-3"
    >
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <h2 id="whatsNewTitle" className="font-display font-bold text-[15px] text-ink-bright">
          Updated to {update.name}
        </h2>
        <p className="text-caption text-ink-muted">
          <span className="font-semibold text-ink">{update.title}.</span> {update.text}
        </p>
        <a
          href={`${UPDATES}${update.slug}/`}
          target="_blank"
          rel="noopener"
          onClick={dismiss}
          className="self-start inline-flex items-center gap-1.5 text-caption font-semibold text-scanner-cyan-pale hover:text-quantity-cyan"
        >
          See what's new
          <i className="ph-bold ph-arrow-square-out" aria-hidden="true" />
        </a>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={`Dismiss: updated to ${update.name}`}
        className="w-11 h-11 -m-2 shrink-0 grid place-items-center text-ink-label hover:text-ink"
      >
        <i className="ph-bold ph-x" aria-hidden="true" />
      </button>
    </section>
  );
}
