// One countdown on the Session screen (design 04): your timers, as cards with a ring (Dismiss once done), and outlaw
// stations still restocking (read-only).
import { formatCountdown } from '@atlas/core/format';
import type { TimerKind, TimerRow as Row } from '@atlas/core/timers';
import { dismissTimer } from '../actions.ts';
import { TimerRing, type RingTone } from '../parts/TimerRing.tsx';

export const TIMER_ICON: Record<TimerKind, string> = { refine: 'ph-flask', crop: 'ph-plant', custom: 'ph-timer' };
const KIND: Record<TimerKind, { label: string; tone: RingTone; text: string }> = {
  refine: { label: 'Refiner', tone: 'cyan', text: 'text-scanner-cyan-pale' },
  crop: { label: 'Crops', tone: 'amber', text: 'text-units-amber-text' },
  custom: { label: 'Custom', tone: 'cyan', text: 'text-ink-label' }
};
/** "Refiner", "Crops": a timer's kind before its label in the command bar; a custom timer has only its label. */
export const timerKindName = (kind: TimerKind): string => (kind === 'custom' ? '' : KIND[kind].label);
const HOUR = 3_600_000;

const minutes = (ms: number) => Math.round(ms / 60_000);
// Where the time came from: the wiki for a refiner run, the player for the rest.
function source(kind: TimerKind, span: number): string {
  if (kind === 'refine') return 'From the wiki’s refining time';
  const total = minutes(span);
  return `Your timing · ${total < 120 ? `${String(total)} min` : `${String(Math.round(total / 6) / 10)} h`}`;
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const percent = (progress: number) => `${String(Math.floor(Math.min(1, Math.max(0, progress)) * 100))}%`;

const CARD = 'rounded-card p-3.5 border flex items-center gap-3.5';
const KICKER = 'text-[10px] font-bold uppercase tracking-[0.14em]';

export function TimerRow({ row, now, restockHours }: { row: Row; now: number; restockHours: number }) {
  if (row.type === 'outlaw') {
    const progress = 1 - (row.endsAt - now) / (restockHours * HOUR);
    return (
      <li className={`${CARD} bg-panel-glass border-hairline`}>
        <TimerRing progress={progress} done={false} size={64} tone="rose" label={percent(progress)} />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className={`${KICKER} text-[#fda4af]`}>Outlaw station</span>
          <span className="text-[15px] font-semibold text-ink-bright truncate">{row.system.name}</span>
          <span className="text-caption text-ink-muted">Restocking · your Outlaw Run setting</span>
        </div>
        <span className="font-mono text-lg text-ink-bright tabular-nums">{formatCountdown(row.endsAt - now)}</span>
      </li>
    );
  }
  const { timer, status } = row;
  const kind = KIND[timer.kind];
  if (status.done)
    return (
      <li className={`${CARD} bg-ready-emerald-wash border-ready-emerald-edge-soft`}>
        <TimerRing progress={1} done size={64} />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className={`${KICKER} text-ready-emerald-pale`}>{kind.label} · done</span>
          <span className="text-[15px] font-semibold text-ink-bright truncate">{timer.label}</span>
          <span className="text-caption text-ready-emerald-text">Finished at {clock(timer.endsAt)}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            dismissTimer(timer.id);
          }}
          className="shrink-0 h-9 px-3 rounded-[10px] border border-ready-emerald-edge bg-transparent text-[13px] font-semibold text-ready-emerald-text hover:bg-ready-emerald-tint"
        >
          Dismiss<span className="sr-only"> {timer.label}</span>
        </button>
      </li>
    );
  return (
    <li
      className={`${CARD} bg-panel-glass ${timer.kind === 'refine' ? 'border-[rgba(34,211,238,0.3)]' : 'border-hairline'}`}
    >
      <TimerRing progress={status.progress} done={false} size={64} tone={kind.tone} label={percent(status.progress)} />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className={`${KICKER} ${kind.text}`}>{kind.label}</span>
        <span className="text-[15px] font-semibold text-ink-bright truncate">{timer.label}</span>
        <span className="text-caption text-ink-muted">
          {source(timer.kind, Date.parse(timer.endsAt) - Date.parse(timer.startedAt))}
        </span>
      </div>
      <span className="font-mono text-lg text-ink-bright tabular-nums">{formatCountdown(status.remaining)}</span>
    </li>
  );
}
