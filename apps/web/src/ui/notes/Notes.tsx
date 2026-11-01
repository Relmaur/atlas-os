// Notes (design 10): everything the player wrote down, newest first, with search and chips for Pinned and each tag.
// A row opens the note on its own screen (11). Each note can be pinned to Home, a Guide book or a ship (ADR-0007);
// they're part of the log: on this device, in Export, and in sync.
import { useState } from 'react';
import { filterNotes, noteChips, noteExcerpt, type NoteFilter } from '@atlas/core/notes';
import { useSectionParam } from '../shell/section-store.ts';
import { useAppState } from '../useAppState.ts';
import { importNoteFiles } from '../actions.ts';
import { LogSegment } from '../parts/LogSegment.tsx';
import { FIELD } from '../systems/editor-parts.tsx';
import { newNote } from './note-nav.ts';
import { TAG, shortDate } from './note-bits.tsx';

export function Notes() {
  const openId = useSectionParam();
  const { notes } = useAppState();
  const [query, setQuery] = useState('');
  const [chosen, setFilter] = useState<NoteFilter>('all');
  const chips = noteChips(notes);
  // A tag whose last note lost it no longer has a chip: show everything rather than an empty list.
  const filter = chips.some(chip => chip.id === chosen) ? chosen : 'all';
  const shown = filterNotes(notes, query, filter);

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <header className="flex flex-col gap-1.5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-screen-title text-ink-bright">Notes</h1>
          <button
            type="button"
            onClick={() => {
              newNote();
            }}
            aria-label="New note"
            title="New note (n)"
            className="w-11 h-11 rounded-control border border-ready-emerald-edge bg-ready-emerald-tint grid place-items-center text-ready-emerald-text hover:bg-ready-emerald-tint-hover"
          >
            <i className="ph-bold ph-plus text-xl" aria-hidden="true" />
          </button>
        </div>
        <p className="text-sub text-ink-muted">Your own Markdown. Pin a note to Home, a system, a ship or a guide.</p>
      </header>
      <LogSegment />

      {notes.length > 0 && (
        <label className="relative block">
          <i
            className="ph-bold ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-label"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={event => {
              setQuery(event.target.value);
            }}
            placeholder={`Search ${String(notes.length)} note${notes.length === 1 ? '' : 's'}`}
            aria-label="Search your notes"
            className={`${FIELD} pl-10`}
          />
        </label>
      )}

      {chips.length > 1 && (
        <div
          role="group"
          aria-label="Filters"
          className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible lg:mx-0 lg:px-0"
        >
          {chips.map(chip => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={filter === chip.id}
              onClick={() => {
                setFilter(chip.id);
              }}
              className={`relative shrink-0 h-[34px] px-3.5 rounded-full border text-[13px] font-semibold whitespace-nowrap ${
                filter === chip.id
                  ? 'bg-scanner-cyan-tint border-scanner-cyan-edge text-scanner-cyan-text'
                  : 'bg-slate-ground border-control-edge text-ink-soft hover:text-ink-bright'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <ul
          id="notesList"
          className="rounded-card bg-panel-glass border border-hairline divide-y divide-hairline overflow-hidden"
        >
          {shown.map(note => (
            <li key={note.id} data-note={note.id}>
              <a
                href={`#note/${encodeURIComponent(note.id)}`}
                aria-current={openId === note.id ? 'true' : undefined}
                className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-ground"
              >
                <span
                  aria-hidden="true"
                  className="w-[34px] h-[34px] shrink-0 rounded-[10px] grid place-items-center bg-slate-ground border border-control-edge text-scanner-cyan-pale"
                >
                  <i className="ph-bold ph-file-text text-[17px]" />
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[14px] font-semibold text-ink-bright break-words">{note.title}</span>
                  {note.body.trim() && (
                    <span className="text-caption leading-snug text-ink-muted line-clamp-2">{noteExcerpt(note)}</span>
                  )}
                  <span className="flex flex-wrap items-center gap-1.5 mt-1">
                    {note.tags.map(tag => (
                      <span key={tag} className={TAG}>
                        {tag}
                      </span>
                    ))}
                    {note.pins.length > 0 && (
                      <i className="ph-fill ph-push-pin text-[12px] text-ready-emerald-text" aria-label="Pinned" />
                    )}
                    <span className="font-mono text-[11px] text-ink-label">{shortDate(note.updatedAt)}</span>
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {!notes.length && (
        <p className="text-sub text-ink-muted rounded-card border border-dashed border-control-edge px-4 py-3.5">
          No notes yet. Write one, or import Markdown files you already keep.
        </p>
      )}
      {notes.length > 0 && !shown.length && (
        <p className="text-sub text-ink-muted">
          {query.trim() ? `Nothing matches “${query.trim()}”.` : 'No notes match this filter.'}
        </p>
      )}

      <label className="self-start inline-flex items-center gap-2 text-caption font-semibold text-scanner-cyan-pale hover:text-quantity-cyan cursor-pointer focus-within:outline-2 focus-within:outline-scanner-cyan-glow rounded">
        <i className="ph-bold ph-upload-simple" aria-hidden="true" />
        Import Markdown files
        <input
          type="file"
          multiple
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          onChange={event => {
            void importNoteFiles([...(event.target.files ?? [])]);
            event.target.value = ''; // the same files can be picked again
          }}
          className="sr-only"
        />
      </label>
    </div>
  );
}
