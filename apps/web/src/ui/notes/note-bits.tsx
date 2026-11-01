// What the Notes screens share (designs 10, 11): where a note is pinned and its tags, as pills, and its date.
import { PIN_PLACES, noteExcerpt, systemPin, type Note } from '@atlas/core/notes';
import type { System } from '@atlas/core/systems-model';
import { openNote } from './note-nav.ts';
import type { GearItem } from '@atlas/core/gear';
import { KINDS } from '../gear/kinds.ts';

export const TOP_BUTTON =
  'w-11 h-11 rounded-control bg-slate-ground border border-control-edge grid place-items-center text-ink hover:border-control-edge-hover transition-colors duration-[var(--duration-micro)]';
const PILL =
  'inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[11px] font-semibold tracking-[0.04em]';
export const TAG =
  'inline-flex items-center h-6 px-2.5 rounded-full bg-scanner-cyan-tint border border-scanner-cyan-edge text-[12px] font-medium text-[#a5f3fc]';

/** "28 Oct": the list and the note's footnote. */
export const shortDate = (iso: string): string =>
  Date.parse(iso) ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';

// Home in emerald (it's on the player's first screen), books and ships in slate; a ship's pill opens it.
export function PinPills({ note, gear, systems }: { note: Note; gear: GearItem[]; systems: System[] }) {
  const places = PIN_PLACES.filter(place => note.pins.includes(place.key));
  const ships = gear.filter(item => note.pins.includes(`gear:${item.id}`));
  const pinnedSystems = systems.filter(item => note.pins.includes(systemPin(item.id)));
  if (!places.length && !ships.length && !pinnedSystems.length && !note.tags.length) return null;
  return (
    <ul aria-label="Pinned to and tags" className="flex flex-wrap gap-1.5">
      {places.map(place => (
        <li
          key={place.key}
          className={`${PILL} ${
            place.key === 'home'
              ? 'bg-ready-emerald-tint border-ready-emerald-edge text-ready-emerald-text'
              : 'bg-slate-ground border-control-edge text-ink-soft'
          }`}
        >
          <i
            className={`ph-bold ${place.key === 'home' ? 'ph-push-pin' : 'ph-book-bookmark'} text-[12px]`}
            aria-hidden="true"
          />
          {place.label}
        </li>
      ))}
      {ships.map(item => (
        <li key={item.id}>
          <a
            href={`#ship/${encodeURIComponent(item.id)}`}
            className={`${PILL} bg-slate-ground border-control-edge text-ink-soft hover:text-ink-bright`}
          >
            <i className={`ph-bold ${KINDS[item.kind].icon} text-[12px]`} aria-hidden="true" />
            {item.name}
          </a>
        </li>
      ))}
      {pinnedSystems.map(item => (
        <li key={item.id}>
          <a
            href={`#system/${encodeURIComponent(item.id)}`}
            className={`${PILL} bg-slate-ground border-control-edge text-ink-soft hover:text-ink-bright`}
          >
            <i className="ph-bold ph-planet text-[12px]" aria-hidden="true" />
            {item.name}
          </a>
        </li>
      ))}
      {note.tags.map(tag => (
        <li key={tag} className={TAG}>
          <span className="sr-only">Tag </span>
          {tag}
        </li>
      ))}
    </ul>
  );
}

// The notes linked to a ship or a system, on its own screen.
export function LinkedNoteRows({ notes }: { notes: Note[] }) {
  return (
    <ul className="rounded-card bg-panel-glass border border-hairline divide-y divide-hairline overflow-hidden">
      {notes.map(note => (
        <li key={note.id}>
          <button
            type="button"
            onClick={() => {
              openNote(note.id);
            }}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-ground"
          >
            <i className="ph-bold ph-file-text text-lg text-scanner-cyan-pale shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold text-ink-bright truncate">{note.title}</span>
              <span className="block text-caption text-ink-muted truncate">
                Linked note{noteExcerpt(note, 60) ? ` · ${noteExcerpt(note, 60)}` : ''}
              </span>
            </span>
            <i className="ph-bold ph-caret-right text-ink-label shrink-0" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
