// The desktop command bar (round 6), from 1024: one floating bar along the top with the search (Ctrl K) on the left and,
// on the right, what's live: the session, the timers counting down with their rings, and sync. Plain items between
// 1px dividers; nothing inside it has a border of its own. Below 1280 the items drop their names to their numbers.
import { Fragment, type ReactNode } from 'react';
import { formatCountdown, formatDuration } from '@atlas/core/format';
import { timerStatus, type Timer } from '@atlas/core/timers';
import { useSyncStatus } from '../../app/sync.ts';
import { useAppState } from '../useAppState.ts';
import { openSession } from '../session/sheet-store.ts';
import { useClock } from '../session/useClock.ts';
import { timerKindName } from '../session/TimerRow.tsx';
import { toggleSearch, useSearchOpen } from './Search.tsx';
import { appHref, goToSession, onCodexPage, shellSearch } from './place.ts';

const toSession = (): void => {
  goToSession(openSession);
};

const SHOWN = 2; // timers in the bar; the rest are a count

// How far along a timer is, as a ring: the arc grows as it nears the end.
function Ring({ progress }: { progress: number }) {
  const r = 8;
  const length = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 22 22" className="w-[22px] h-[22px] shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="11" cy="11" r={r} fill="none" stroke="var(--color-hairline)" strokeWidth="2.5" />
      <circle
        cx="11"
        cy="11"
        r={r}
        fill="none"
        stroke="var(--color-scanner-cyan-glow)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${String(length * progress)} ${String(length)}`}
      />
    </svg>
  );
}

function Item({
  onClick,
  href,
  label,
  live,
  children
}: {
  onClick?: () => void;
  href?: string;
  label: string;
  live?: string; // what the item shows, for tests that look for the live session or timers
  children: ReactNode;
}) {
  const className = 'command-item';
  return href ? (
    <a href={href} aria-label={label} className={className}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} data-live={live} className={className}>
      {children}
    </button>
  );
}

function TimerItem({ timer, now }: { timer: Timer; now: number }) {
  const status = timerStatus(timer, now);
  const time = status.done ? 'done' : formatCountdown(status.remaining);
  return (
    <Item
      onClick={toSession}
      live="timer"
      label={`${[timerKindName(timer.kind), timer.label].filter(Boolean).join(' ')}, ${status.done ? 'done' : `${time} left`}`}
    >
      {status.done ? (
        <i className="ph-fill ph-check-circle text-[20px] text-ready-emerald-lit" aria-hidden="true" />
      ) : (
        <Ring progress={status.progress} />
      )}
      <span className="command-name truncate">
        {[timerKindName(timer.kind), timer.label].filter(Boolean).join(' · ')}
      </span>
      <b className={`font-mono font-medium ${status.done ? 'text-ready-emerald-text' : 'text-quantity-cyan'}`}>
        {time}
      </b>
    </Item>
  );
}

function SyncItem() {
  const sync = useSyncStatus();
  if (!sync.enabled) return null;
  const [icon, text, tone] = sync.problem
    ? ['ph-warning-circle', sync.problem === 'offline' ? 'Offline' : 'Sync needs you', 'text-units-amber-text']
    : sync.busy
      ? ['ph-arrows-clockwise', 'Syncing', 'text-ink-muted']
      : ['ph-cloud-check', 'Synced', 'text-ready-emerald-pale'];
  return (
    <Item href={appHref('#more')} label={`${text}, open Settings`}>
      <i className={`ph-bold ${icon} text-[18px] ${tone}`} aria-hidden="true" />
      <span className={tone}>{text}</span>
    </Item>
  );
}

export function CommandBar() {
  const { session, timers } = useAppState();
  const sync = useSyncStatus();
  const searching = useSearchOpen();
  const minute = useClock(false);
  const shown = [...timers].sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt)).slice(0, SHOWN);
  const ticking = shown.some(timer => !timerStatus(timer, minute).done);
  const now = useClock(ticking);
  const items: ReactNode[] = [];
  if (session)
    items.push(
      <Item
        key="session"
        onClick={toSession}
        live="session"
        label={`Session, ${formatDuration(now - Date.parse(session.startedAt))}`}
      >
        <span className="session-dot is-live" aria-hidden="true" />
        <span className="command-name">Session</span>
        <b className="font-mono font-medium text-ink-bright">{formatDuration(now - Date.parse(session.startedAt))}</b>
      </Item>
    );
  for (const timer of shown) items.push(<TimerItem key={timer.id} timer={timer} now={now} />);
  if (timers.length > SHOWN)
    items.push(
      <Item key="more" onClick={toSession} label={`${String(timers.length - SHOWN)} more timers`}>
        <span className="font-mono text-ink-muted">{`+${String(timers.length - SHOWN)}`}</span>
      </Item>
    );
  if (sync.enabled) items.push(<SyncItem key="sync" />);
  return (
    <div id="commandBar" role="toolbar" aria-label="Search and what's live" className="command-bar">
      <button
        type="button"
        onClick={() => {
          shellSearch(toggleSearch);
        }}
        aria-expanded={onCodexPage() ? undefined : searching}
        className="command-search"
      >
        <i className="ph-bold ph-magnifying-glass text-[18px]" aria-hidden="true" />
        <span className="flex-1 min-w-0 truncate text-left">
          <span className="command-name">
            {onCodexPage() ? 'Search the Codex…' : 'Search systems, planets, the Codex…'}
          </span>
          <span className="command-short">Search…</span>
        </span>
        <kbd className="nav-kbd">Ctrl K</kbd>
      </button>
      <span className="flex-1" />
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="command-divider" aria-hidden="true" />}
          {item}
        </Fragment>
      ))}
    </div>
  );
}
