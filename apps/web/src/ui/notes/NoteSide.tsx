// A note's inspector on the Workbench (round 6, d10): what it's linked to (the systems, ships and places it's pinned
// to, then each [[page]] it names: one of the player's systems or planets when the name matches, else the Codex), its
// tags, where it also shows, and a timer to start from it.
import type { ReactNode } from 'react';
import { PIN_PLACES, gearPin, noteLinks, systemPin, type Note } from '@atlas/core/notes';
import type { TimerKind } from '@atlas/core/timers';
import { useAppState } from '../useAppState.ts';
import { KINDS } from '../gear/kinds.ts';
import { StarDot } from '../parts/SystemBits.tsx';
import { TagEditor } from '../systems/editor-parts.tsx';
import { openAddTimer, openSession } from '../session/sheet-store.ts';
import { timerKindName } from '../session/TimerRow.tsx';

const TITLE = 'font-display text-sm font-bold tracking-[0.04em] text-ink-bright';
const ROW = 'flex items-center gap-2.5 min-h-9 px-2 rounded-control text-sub text-ink hover:bg-slate-ground';
const TIMERS: TimerKind[] = ['refine', 'crop', 'custom'];

interface Link {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
}

export function NoteSide({
  note,
  onTags,
  typed,
  onTyped,
  pins,
  remove
}: {
  note: Note;
  onTags: (tags: string[]) => void;
  typed: string;
  onTyped: (typed: string) => void;
  /** The checkboxes for Home, the books, ships and systems. */
  pins: ReactNode;
  remove: ReactNode;
}) {
  const { systems, gear } = useAppState();
  const links: Link[] = [];
  const add = (link: Link) => {
    if (!links.some(other => other.key === link.key)) links.push(link);
  };
  for (const system of systems)
    if (note.pins.includes(systemPin(system.id)))
      add({
        key: system.id,
        href: `#system/${encodeURIComponent(system.id)}`,
        label: system.name,
        icon: <StarDot system={system} />
      });
  for (const item of gear)
    if (note.pins.includes(gearPin(item.id)))
      add({
        key: item.id,
        href: `#ship/${encodeURIComponent(item.id)}`,
        label: item.name || KINDS[item.kind].label,
        icon: <i className={`ph-bold ${KINDS[item.kind].icon} text-ink-label`} aria-hidden="true" />
      });
  for (const target of noteLinks(note.body)) {
    const wanted = target.toLowerCase();
    const system = systems.find(item => item.name.toLowerCase() === wanted);
    const home = system ? null : systems.find(item => item.planets.some(p => p.name.toLowerCase() === wanted));
    const planet = home?.planets.find(p => p.name.toLowerCase() === wanted);
    if (system)
      add({
        key: system.id,
        href: `#system/${encodeURIComponent(system.id)}`,
        label: system.name,
        icon: <StarDot system={system} />
      });
    else if (home && planet)
      add({
        key: planet.id,
        href: `#planet/${encodeURIComponent(home.id)}/${encodeURIComponent(planet.id)}`,
        label: planet.name,
        icon: <i className="ph-bold ph-globe-hemisphere-west text-scanner-cyan-pale" aria-hidden="true" />
      });
    else
      add({
        key: `codex:${wanted}`,
        href: `wiki/#/?q=${encodeURIComponent(target)}`,
        label: `${target} (Codex)`,
        icon: <i className="ph-bold ph-books text-ink-label" aria-hidden="true" />
      });
  }
  const places = PIN_PLACES.filter(place => note.pins.includes(place.key));

  return (
    <aside aria-label="About this note" className="detail-side min-w-0 px-[22px] py-[18px] flex flex-col gap-6">
      <section aria-labelledby="noteLinksTitle" className="flex flex-col gap-2">
        <h2 id="noteLinksTitle" className={TITLE}>
          Linked to
        </h2>
        {links.length || places.length ? (
          <ul id="noteLinks" className="flex flex-col">
            {links.map(link => (
              <li key={link.key}>
                <a href={link.href} className={ROW}>
                  <span className="w-4 shrink-0 grid place-items-center">{link.icon}</span>
                  <span className="truncate" title={link.label}>
                    {link.label}
                  </span>
                </a>
              </li>
            ))}
            {places.map(place => (
              <li key={place.key} className="flex items-center gap-2.5 min-h-9 px-2 text-sub text-ink">
                <i
                  className={`ph-bold ${place.key === 'home' ? 'ph-push-pin text-ready-emerald-text' : 'ph-book-bookmark text-ink-label'} w-4 text-center`}
                  aria-hidden="true"
                />
                <span className="truncate">Shows on {place.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption text-ink-muted">
            Nothing yet. Write [[a name]] to link a system, a planet or a Codex page, or pin it below.
          </p>
        )}
      </section>

      <TagEditor tags={note.tags} onTags={onTags} typed={typed} onTyped={onTyped} labelClass={TITLE} />

      <fieldset className="flex flex-col min-w-0">
        <legend className={`${TITLE} pb-1`}>Also show it on</legend>
        {pins}
      </fieldset>

      <section aria-labelledby="noteTimerTitle" className="flex flex-col gap-2">
        <h2 id="noteTimerTitle" className={TITLE}>
          Start a timer
        </h2>
        <div className="flex flex-wrap gap-2">
          {TIMERS.map(kind => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                openSession();
                openAddTimer(kind);
              }}
              className="h-9 px-3 rounded-control border border-control-edge bg-slate-ground inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink hover:border-control-edge-hover"
            >
              <i className="ph-bold ph-timer" aria-hidden="true" />
              {timerKindName(kind) || 'Your own'}
            </button>
          ))}
        </div>
      </section>

      {remove && <div className="mt-auto pt-2">{remove}</div>}
    </aside>
  );
}
