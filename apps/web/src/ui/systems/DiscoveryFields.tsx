// "Discovered by", on and at: what the top of a planet's scan and a system's discovery page show. Shared by the planet
// sheet (35) and the system editor (06). Each of the player's game accounts (Settings) is a Me chip that fills it in.
import { FIELD, LABEL_FIELD } from './editor-parts.tsx';

export interface Discovery {
  discoveredBy: string;
  discoveredOn: string;
  discoveredTime: string;
}

export function DiscoveryFields({
  value,
  onChange,
  accounts
}: {
  value: Discovery;
  onChange: (changes: Partial<Discovery>) => void;
  accounts: string[];
}) {
  const field = (key: keyof Discovery) => ({
    name: key,
    value: value[key],
    onChange: (event: { target: { value: string } }) => {
      onChange({ [key]: event.target.value });
    }
  });
  return (
    <>
      <label className={LABEL_FIELD}>
        Discovered by
        <input
          maxLength={80}
          autoComplete="off"
          placeholder="A Traveller’s name"
          className={FIELD}
          {...field('discoveredBy')}
        />
      </label>
      {accounts.length ? (
        <div className="flex flex-wrap gap-2 -mt-1" role="group" aria-label="Discovered by you">
          {accounts.map(account => {
            const on = value.discoveredBy === account;
            return (
              <button
                key={account}
                type="button"
                aria-pressed={on}
                aria-label={accounts.length === 1 ? `Me (${account})` : `Me as ${account}`}
                onClick={() => {
                  onChange({ discoveredBy: account });
                }}
                className={`h-9 max-w-full px-3 rounded-full border inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors duration-[var(--duration-micro)] ${
                  on
                    ? 'bg-scanner-cyan-tint border-scanner-cyan-edge text-[#a5f3fc]'
                    : 'border-control-edge text-ink-soft hover:text-ink-bright hover:border-scanner-cyan-edge'
                }`}
              >
                <i className={`ph-bold ${on ? 'ph-check' : 'ph-user'}`} aria-hidden="true" />
                {accounts.length === 1 ? 'Me' : <span className="truncate">{`Me · ${account}`}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-caption text-ink-muted -mt-1">
          Add the names you play under in Settings, and Me fills this in with one tap.
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
        <label className={LABEL_FIELD}>
          On
          {/* iOS draws date and time fields at their own minimum width, centred: without appearance they fit. */}
          <input
            type="date"
            aria-label="Discovered on"
            className={`${FIELD} min-w-0 block appearance-none text-left`}
            {...field('discoveredOn')}
          />
        </label>
        <label className={LABEL_FIELD}>
          At
          <input
            type="time"
            aria-label="Discovered at"
            className={`${FIELD} min-w-0 block appearance-none text-left font-mono`}
            {...field('discoveredTime')}
          />
        </label>
      </div>
    </>
  );
}

/** "6 Nov 2026 · 19:49": a logged day (YYYY-MM-DD) and time, in the player's own date format. */
export function discoveryWhen(day: string, time: string): string {
  if (!day) return time;
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  return time ? `${date} · ${time}` : date;
}
