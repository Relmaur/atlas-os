// Home (design 01): what you need mid-session. The current system as a hero with its orbit diagram, logging a new
// system with a slide, your timers, starting a session with a hold, and the systems to warp back to. The outlaw
// stations moved to Runs, the fleet to Log › Fleet, and Keep screen on to Settings.
import { WhatsNew } from './WhatsNew.tsx';
import { useEffect } from 'react';
import { biomeFamily } from '@atlas/core/facts';
import { formatClock, formatCountdown } from '@atlas/core/format';
import { heroPlace, heroStatus, homeSummary, homeTimers, isEmptyAtlas, warpBackLine } from '@atlas/core/home';
import { systemOrbit } from '@atlas/core/orbit';
import { notesPinnedTo } from '@atlas/core/notes';
import type { System } from '@atlas/core/systems-model';
import type { Timer, TimerKind, TimerStatus } from '@atlas/core/timers';
import { openSystem, openSystemEditor } from '../systems/panel-store.ts';
import { logVisit, startSession } from '../actions.ts';
import { useAppState } from '../useAppState.ts';
import { useNow } from '../useNow.ts';
import { useClock } from '../session/useClock.ts';
import { openSession } from '../session/sheet-store.ts';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { useSyncAttention, useSyncStatus } from '../../app/sync.ts';
import { Button } from '../parts/Button.tsx';
import { HoldToActivate, SlideToActivate } from '../parts/Gesture.tsx';
import { OrbitDiagram, StarMark } from '../parts/StarChart.tsx';
import { TimerRing } from '../parts/TimerRing.tsx';
import { PinnedNotes } from '../notes/PinnedNotes.tsx';
import { SessionButton } from '../shell/Header.tsx';
import { openGearEditor } from '../parts/editor-store.ts';

const KIND_LABEL: Record<TimerKind, string> = { refine: 'Refiner', crop: 'Crops', custom: 'Timer' };
const HOUR = 3_600_000;

export function Home() {
  const state = useAppState();
  const minute = useNow();
  const timers = homeTimers(state.timers, minute);
  // Seconds matter under an hour (a refiner nearly done reads 0:12), and for a live session's clock.
  const now = useClock(state.session !== null || timers.some(({ status }) => !status.done && status.remaining < HOUR));
  const summary = homeSummary(state, now);
  useEffect(() => {
    void loadFacts(); // biome families, for the planets' colours
  }, []);
  if (isEmptyAtlas(state))
    return (
      <div className="flex flex-col gap-section max-w-2xl">
        <HomeHeader />
        <WhatsNew emptyLog />
        <FirstRun />
      </div>
    );
  return (
    <div className="flex flex-col gap-section max-w-2xl">
      <HomeHeader />
      <WhatsNew emptyLog={false} />
      <Hero system={summary.current} now={now} />
      {timers.length > 0 && <Timers timers={homeTimers(state.timers, now)} />}
      <HoldToActivate
        id="startSession"
        label="Hold to start session"
        hint="Counts systems, visits and timers until you stop"
        onActivate={startSession}
        done={
          state.session
            ? {
                label: 'Session live',
                hint: (
                  <>
                    <span className="font-mono tabular-nums">
                      {formatClock(now - Date.parse(state.session.startedAt))}
                    </span>{' '}
                    · tap the bar to stop
                  </>
                )
              }
            : undefined
        }
      />
      <WarpBack systems={summary.recent} now={now} />
      {notesPinnedTo(state.notes, 'home').length > 0 && <PinnedNotes place="home" label="Home" hint="" />}
    </div>
  );
}

// First run (design 22): an empty atlas says so, offers the first system, and three other ways in.
const FIRST_STEPS: { title: string; sub: string; icon: string; run: () => void }[] = [
  {
    title: 'Log the system you’re in',
    sub: 'Name, star colour, planets. A minute, in the pause menu.',
    icon: 'ph-planet',
    run: () => {
      openSystemEditor();
    }
  },
  {
    title: 'Add your ship',
    sub: 'Mark its supercharged slots once, never forget them.',
    icon: 'ph-rocket',
    run: () => {
      openGearEditor();
    }
  },
  {
    title: 'Start a timer',
    sub: 'Refiners, farms, run restocks. We’ll ping you.',
    icon: 'ph-timer',
    run: openSession
  }
];

function FirstRun() {
  return (
    <section id="homeNow" aria-labelledby="firstRunTitle" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-label uppercase text-scanner-cyan-pale">Welcome, Traveller</p>
        <h1 id="firstRunTitle" className="font-display text-[28px] leading-tight font-bold text-ink-bright">
          Your atlas is empty
        </h1>
        <p className="text-sub text-ink-muted">Everything you log stays on this device. No account needed.</p>
      </div>
      <EmptyOrbit />
      <Button
        variant="primary"
        icon="ph-plus"
        wide
        onClick={() => {
          openSystemEditor();
        }}
      >
        Log your first system
      </Button>
      <h2 className="text-label uppercase text-ink-label mt-2">Or start with</h2>
      <ul className="rounded-card bg-panel-glass border border-hairline divide-y divide-hairline overflow-hidden">
        {FIRST_STEPS.map(step => (
          <li key={step.title}>
            <button
              type="button"
              onClick={step.run}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-ground"
            >
              <span
                aria-hidden="true"
                className="w-[34px] h-[34px] shrink-0 rounded-[10px] grid place-items-center bg-scanner-cyan-tint border border-scanner-cyan-edge text-scanner-cyan-pale"
              >
                <i className={`ph-bold ${step.icon} text-[17px]`} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-ink-bright">{step.title}</span>
                <span className="block text-caption text-ink-muted">{step.sub}</span>
              </span>
              <i className="ph-bold ph-caret-right text-ink-label" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <a href="#sync" className="self-center text-[13px] text-scanner-cyan-pale hover:text-quantity-cyan text-center">
        Already use ATLAS on another device? Pair it
      </a>
    </section>
  );
}

// A system not logged yet: a star at the edge, empty orbits, and planets still dashed outlines.
function EmptyOrbit() {
  return (
    <svg viewBox="0 0 390 210" aria-hidden="true" className="-mx-4 w-[calc(100%+2rem)] max-w-none h-auto">
      <g fill="none">
        <circle cx="16" cy="105" r="96" stroke="#1e3a5f" />
        <circle cx="16" cy="105" r="60" stroke="rgba(202,138,4,0.35)" strokeDasharray="4 5" />
        <circle cx="16" cy="105" r="46" stroke="rgba(202,138,4,0.45)" />
        <path d="M105 0 A190 190 0 0 1 105 210" stroke="#1e3a5f" />
        <path d="M168 0 A240 240 0 0 1 168 210" stroke="#1e3a5f" />
        <path d="M232 2 A300 300 0 0 1 232 208" stroke="#1e3a5f" strokeDasharray="4 6" />
        <path d="M292 2 A340 340 0 0 1 292 208" stroke="#1e3a5f" strokeDasharray="4 6" />
        <circle cx="144" cy="72" r="8" stroke="#334155" strokeDasharray="3 3" />
        <circle cx="192" cy="122" r="11" stroke="#334155" strokeDasharray="3 3" />
        <circle cx="248" cy="88" r="7" stroke="#334155" strokeDasharray="3 3" />
        <circle cx="304" cy="110" r="9" stroke="#334155" strokeDasharray="3 3" />
      </g>
      <circle cx="16" cy="105" r="22" fill="#ca8a04" opacity="0.9" />
      <circle cx="16" cy="105" r="15" fill="#d6cfb8" opacity="0.85" />
    </svg>
  );
}

// Below lg, Home has its own header (the app's is hidden here): the wordmark, sync's state, the timers (until Search's
// quick actions can start one) and Settings. From lg the sidebar and the app header carry them.
function HomeHeader() {
  return (
    <header className="lg:hidden flex items-center justify-between gap-3 pt-[env(safe-area-inset-top)] mb-2">
      <span className="flex items-center gap-2.5">
        <i className="ph-bold ph-diamond text-[22px] text-scanner-cyan-glow" aria-hidden="true" />
        <span className="font-display text-wordmark text-ink-bright">
          ATLAS<span className="text-scanner-cyan-pale">:OS</span>
        </span>
      </span>
      <span className="flex items-center gap-2">
        <SyncPill />
        <SessionButton
          id="homeSessionButton"
          className="w-10 h-10 rounded-[10px] border border-hairline bg-panel text-ink-soft hover:border-control-edge"
        />
        <a
          href="#more"
          aria-label="Settings"
          title="Settings"
          className="w-10 h-10 rounded-[10px] border border-hairline bg-panel text-ink-soft grid place-items-center hover:border-control-edge transition-colors duration-[var(--duration-micro)]"
        >
          <i className="ph-bold ph-gear-six text-lg" aria-hidden="true" />
        </a>
      </span>
    </header>
  );
}

// Sync's state at a glance, only once sync is on (it's opt-in; nothing to say otherwise). A problem only the player
// can fix links to Settings, where sync explains it.
function SyncPill() {
  const status = useSyncStatus();
  const attention = useSyncAttention();
  if (!status.enabled) return null;
  const [label, tone, dot] = attention
    ? ['Sync needs you', 'bg-units-amber-tint text-units-amber-text', 'bg-units-amber-text']
    : status.busy
      ? ['Syncing', 'bg-scanner-cyan-tint text-quantity-cyan', 'bg-scanner-cyan-glow']
      : status.problem === 'offline'
        ? ['Offline', 'bg-slate-ground text-ink-muted', 'bg-ink-muted']
        : ['Synced', 'bg-ready-emerald-tint text-ready-emerald-pale', 'bg-ready-emerald-lit'];
  const pill = `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold tracking-[0.08em] uppercase ${tone}`;
  const content = (
    <>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </>
  );
  return attention ? (
    <a href="#more" className={pill}>
      {content}
    </a>
  ) : (
    <span role="status" className={pill}>
      {content}
    </span>
  );
}

function Hero({ system, now }: { system: System | undefined; now: number }) {
  const facts = useFacts();
  const slide = (
    <SlideToActivate
      label="Warped somewhere new"
      action="log a new system"
      onActivate={() => {
        openSystemEditor();
      }}
    />
  );
  if (!system) {
    return (
      <section id="homeNow" className="hero-card flex flex-col gap-card-row p-card">
        <h1 className="font-display text-hero text-ink-bright">Log your first system</h1>
        <p className="text-sub text-ink-soft max-w-prose">
          Warp somewhere, then slide to add it with its glyphs and what’s worth coming back for. It becomes your current
          system, one tap to log again.
        </p>
        <div className="mt-1">{slide}</div>
      </section>
    );
  }
  const orbit = systemOrbit(system, biome => biomeFamily(facts, biome));
  const note = system.notes.split('\n').find(line => line.trim());
  return (
    <section id="homeNow" aria-labelledby="homeSystemName" className="hero-card overflow-hidden">
      <div className="h-[150px] hero-grid">
        <OrbitDiagram
          name={system.name}
          seed={orbit.seed}
          star={system.star}
          planets={orbit.planets}
          width={356}
          height={150}
          size="L"
          starX={28}
          grid={false}
        />
      </div>
      <div className="px-card pt-1 pb-card flex flex-col gap-card-row">
        <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-units-amber-text">
          {heroStatus(system, now)}
        </p>
        <h1 id="homeSystemName" className="font-display text-hero text-ink-bright break-words">
          {system.name}
        </h1>
        {(heroPlace(system) || system.wealth > 0) && (
          <p className="text-sub text-ink-muted">
            {heroPlace(system)}
            {system.wealth > 0 && (
              <>
                <span aria-hidden="true"> {'★'.repeat(system.wealth)}</span>
                <span className="sr-only">, wealth {system.wealth} of 3</span>
              </>
            )}
          </p>
        )}
        {note && <p className="text-sub text-ink-soft italic line-clamp-2">“{note.trim()}”</p>}
        <div className="mt-1">{slide}</div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => {
              logVisit(system.id);
            }}
          >
            Log visit
          </Button>
          <Button
            onClick={() => {
              openSystem(system.id);
            }}
          >
            Open system
          </Button>
        </div>
      </div>
    </section>
  );
}

// Up to two timers, the soonest running first; either opens the Session screen, where timers are added and dismissed.
function Timers({ timers }: { timers: { timer: Timer; status: TimerStatus }[] }) {
  return (
    <section aria-label="Timers" className="grid grid-cols-2 gap-2.5">
      {timers.map(({ timer, status }) => (
        <button
          key={timer.id}
          type="button"
          onClick={openSession}
          className={`rounded-card p-3.5 border flex items-center gap-3 text-left min-w-0 ${
            status.done
              ? 'bg-ready-emerald-wash border-ready-emerald-edge-soft'
              : 'bg-panel-glass border-hairline hover:border-control-edge'
          }`}
        >
          <TimerRing progress={status.progress} done={status.done} />
          <span className="min-w-0 flex flex-col gap-0.5">
            {status.done ? (
              <span className="font-display font-bold text-sm text-ready-emerald-pale">Ready</span>
            ) : (
              <span className="font-mono tabular-nums text-[17px] font-medium text-ink-bright">
                {formatCountdown(status.remaining)}
              </span>
            )}
            <span
              className={`text-[11px] leading-[1.3] line-clamp-2 ${status.done ? 'text-ready-emerald-text' : 'text-ink-muted'}`}
            >
              {KIND_LABEL[timer.kind]} · {timer.label}
            </span>
          </span>
        </button>
      ))}
    </section>
  );
}

function WarpBack({ systems, now }: { systems: System[]; now: number }) {
  return (
    <section
      aria-labelledby="warpBackTitle"
      className="rounded-card bg-panel-glass border border-hairline px-4 py-3.5 flex flex-col gap-2.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="warpBackTitle" className="font-display font-bold text-[13px] tracking-[0.04em] text-ink-bright">
          Warp back
        </h2>
        <a href="#systems" className="text-caption text-scanner-cyan-pale hover:text-quantity-cyan">
          All systems
        </a>
      </div>
      <ul id="homeRecent" className="flex flex-col gap-2.5">
        {systems.length ? (
          systems.map(system => (
            <li key={system.id} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  openSystem(system.id);
                }}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                <span className="w-[30px] h-[30px] grid place-items-center shrink-0">
                  <StarMark colour={system.star} r={system.star ? 4 : 13} />
                </span>
                <span className="min-w-0">
                  <span className="block text-row font-semibold text-ink-bright truncate">{system.name}</span>
                  <span className="block text-caption text-ink-muted truncate">{warpBackLine(system, now)}</span>
                </span>
              </button>
              <Button
                size="S"
                onClick={() => {
                  logVisit(system.id);
                }}
                className="shrink-0"
              >
                <span aria-hidden="true">I’m here</span>
                <span className="sr-only">I’m here: {system.name}</span>
              </Button>
            </li>
          ))
        ) : (
          <li className="text-caption text-ink-muted">Systems you log land here, so warping back is one tap.</li>
        )}
      </ul>
    </section>
  );
}
