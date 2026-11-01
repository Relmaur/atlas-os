// One note on its own screen (#note/<id>, design 11): read it (Preview) or write it (Write), with the formatting
// toolbar floating above the tab bar. It saves as the player writes, since the design has no Save button: a pause
// stores it, and so does leaving. Pin also shows it on Home, a Guide book or a ship's screen.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_NOTE_CHARS, MAX_NOTE_TAGS, PIN_PLACES, gearPin, systemPin, type Note } from '@atlas/core/notes';
import { applyMarkdown, type MarkdownFormat } from '@atlas/core/markdown-edit';
import { deleteNote, saveNote } from '../actions.ts';
import { useAppState } from '../useAppState.ts';
import { goBack, useSection, useSectionParam } from '../shell/section-store.ts';
import { Button, buttonClass } from '../parts/Button.tsx';
import { ArmButton } from '../parts/Gesture.tsx';
import { useMedia } from '../parts/useMedia.ts';
import { FIELD, Segments, TagEditor } from '../systems/editor-parts.tsx';
import { KINDS } from '../gear/kinds.ts';
import { renderNote } from './NoteCard.tsx';
import { freshNote } from './note-nav.ts';
import { PinPills, TOP_BUTTON, shortDate } from './note-bits.tsx';

const SAVE_DELAY_MS = 600;
const SYSTEMS_LISTED = 12;
const TOOLS: [MarkdownFormat, string, string][] = [
  ['heading', 'Heading', '#'],
  ['bold', 'Bold', 'B'],
  ['italic', 'Italic', 'I'],
  ['list', 'List', 'List'],
  ['table', 'Table', 'Table'],
  ['link', 'Link a Codex page', '']
];
const TOOL_LOOK: Partial<Record<MarkdownFormat, string>> = {
  heading: 'font-mono',
  bold: 'font-extrabold',
  italic: 'italic'
};

export function NoteScreen() {
  const section = useSection();
  const id = useSectionParam();
  const { notes } = useAppState();
  // Once open, the editor stays for this id even if the note disappears (deleted on another device): it says so
  // rather than vanishing mid-sentence.
  const [opened, setOpened] = useState('');
  const existing = notes.find(note => note.id === id);
  const fresh = freshNote(id);
  if ((existing || fresh) && opened !== id) setOpened(id);
  // Every screen stays mounted; leaving this one unmounts the editor, which stores what's left.
  if (section !== 'note') return null;
  if (!existing && !fresh && opened !== id)
    return (
      <div className="flex flex-col items-start gap-section pt-[env(safe-area-inset-top)]">
        <h1 className="font-display text-screen-title text-ink-bright">Not in your notes</h1>
        <p className="text-sub text-ink-muted">
          It may have been deleted, or it’s a note that was never saved. Blank notes aren’t kept.
        </p>
        <Button
          onClick={() => {
            location.hash = '#notes';
          }}
        >
          Your notes
        </Button>
      </div>
    );
  return <NoteEditor key={id} id={id} existing={existing} pins={fresh?.pins ?? []} body={fresh?.body ?? ''} />;
}

function NoteEditor({
  id,
  existing,
  pins,
  body
}: {
  id: string;
  existing: Note | undefined;
  pins: string[];
  body: string;
}) {
  const { gear, systems } = useAppState();
  const [draft, setDraft] = useState<Note>(() => {
    if (existing) return structuredClone(existing);
    const now = new Date().toISOString();
    return { id, title: '', body, pins, tags: [], createdAt: now, updatedAt: now };
  });
  const [chosenMode, setMode] = useState(existing ? 'preview' : 'write');
  // From xl there's room for both, so the text and its preview sit side by side, live.
  const sideBySide = useMedia('(min-width: 1280px)');
  const mode = sideBySide ? 'write' : chosenMode;
  const [typed, setTyped] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [findSystem, setFindSystem] = useState('');
  const [stored, setStored] = useState(Boolean(existing));
  const [kept, setKept] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [failed, setFailed] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const saved = useRef(JSON.stringify(draft)); // what was last stored (or the note as opened)
  const unsaved = useRef<Note | null>(null);
  // Deleted on another device (or tab) while open: nothing is written back unless the player says to keep it.
  const gone = stored && !existing && !kept && !removed;
  const empty = !draft.title.trim() && !draft.body.trim();

  const flush = useCallback((): void => {
    const note = unsaved.current;
    unsaved.current = null;
    if (!note || (!note.title.trim() && !note.body.trim())) return; // an empty note isn't kept
    const ok = saveNote({ ...note, title: note.title.trim() || 'Untitled note' });
    saved.current = JSON.stringify(note);
    setFailed(!ok);
    if (ok) setStored(true);
  }, []);
  useEffect(() => {
    if (gone || removed || JSON.stringify(draft) === saved.current) {
      unsaved.current = null;
      return;
    }
    unsaved.current = draft;
    const timer = setTimeout(flush, SAVE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, gone, removed, flush]);
  useEffect(() => flush, [flush]); // leaving keeps what's there

  const set = (changes: Partial<Note>) => {
    setDraft(current => ({ ...current, ...changes }));
  };
  const setTags = (tags: string[]) => {
    set({ tags });
  };
  const togglePin = (key: string) => {
    set({ pins: draft.pins.includes(key) ? draft.pins.filter(pin => pin !== key) : [...draft.pins, key] });
  };
  const format = (kind: MarkdownFormat) => {
    const writing = mode === 'write' ? area.current : null;
    const start = writing?.selectionStart ?? draft.body.length;
    const end = writing?.selectionEnd ?? draft.body.length;
    const edit = applyMarkdown(draft.body, start, end, kind);
    if (edit.text.length > MAX_NOTE_CHARS) return;
    set({ body: edit.text });
    setMode('write');
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(edit.start, edit.end);
    });
  };
  const html = useMemo(
    () => (mode === 'preview' || sideBySide ? renderNote(draft.body) : ''),
    [mode, sideBySide, draft.body]
  );
  const places = [
    ...PIN_PLACES,
    ...gear.map(item => ({ key: gearPin(item.id), label: item.name || KINDS[item.kind].label })),
    // A log can hold hundreds of systems, so only those it's pinned to show, plus what the search finds.
    ...systems
      .filter(item => {
        const wanted = findSystem.trim().toLowerCase();
        return draft.pins.includes(systemPin(item.id)) || (wanted !== '' && item.name.toLowerCase().includes(wanted));
      })
      .slice(0, SYSTEMS_LISTED)
      .map(item => ({ key: systemPin(item.id), label: item.name }))
  ];

  return (
    <div className="flex flex-col gap-4 max-w-2xl xl:max-w-none pt-[env(safe-area-inset-top)] pb-20 lg:pb-0">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <button
          type="button"
          onClick={() => {
            goBack('notes');
          }}
          aria-label="Back"
          className={TOP_BUTTON}
        >
          <i className="ph-bold ph-caret-left text-lg" aria-hidden="true" />
        </button>
        <div className="justify-self-center w-[180px] xl:invisible">
          <Segments
            label="Write or preview"
            hideLabel
            value={mode}
            onChange={value => {
              if (value) setMode(value);
            }}
            options={[
              ['write', 'Write'],
              ['preview', 'Preview']
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setShowPins(!showPins);
          }}
          aria-label="Pin"
          aria-expanded={showPins}
          aria-controls="notePins"
          className={`${TOP_BUTTON} ${draft.pins.length ? 'text-ready-emerald-text border-ready-emerald-edge bg-ready-emerald-tint' : ''}`}
        >
          <i className={`${draft.pins.length ? 'ph-fill' : 'ph-bold'} ph-push-pin text-lg`} aria-hidden="true" />
        </button>
      </div>

      {showPins && (
        <fieldset id="notePins" className="rounded-card border border-hairline bg-panel-glass px-4 py-2">
          <legend className="sr-only">Also show this note on</legend>
          <p className="pt-1 pb-1.5 text-caption text-ink-soft">Also show it on</p>
          {places.map(place => (
            <label key={place.key} className="flex items-center gap-3 py-2 text-sub text-ink">
              <input
                type="checkbox"
                checked={draft.pins.includes(place.key)}
                onChange={() => {
                  togglePin(place.key);
                }}
                className="w-4 h-4 accent-emerald-400"
              />
              <span className="truncate">{place.label}</span>
            </label>
          ))}
          {systems.length > 0 && (
            <input
              type="search"
              aria-label="Find a system to pin"
              placeholder="Find a system"
              value={findSystem}
              onChange={event => {
                setFindSystem(event.target.value);
              }}
              className={`${FIELD} mt-1 mb-2`}
            />
          )}
        </fieldset>
      )}

      {gone && (
        <div
          role="alert"
          className="rounded-card border border-danger-rose-edge bg-panel-glass p-4 flex flex-col gap-3"
        >
          <p className="text-sub text-danger-rose-text">
            This note was deleted on another device. Changes here aren’t saved unless you keep it.
          </p>
          <Button
            onClick={() => {
              setKept(true);
              unsaved.current = draft;
              flush();
            }}
            className="self-start"
          >
            Keep it
          </Button>
        </div>
      )}
      {failed && (
        <p role="alert" className="text-caption text-danger-rose-text">
          Couldn’t save on this device: its storage is full or blocked. Copy what you wrote before leaving.
        </p>
      )}

      {mode === 'preview' ? (
        <>
          <h1
            id="noteTitle"
            className="font-display font-extrabold text-[22px] leading-tight text-ink-bright break-words"
          >
            {draft.title.trim() || 'Untitled note'}
          </h1>
          <PinPills note={draft} gear={gear} systems={systems} />
          {draft.body.trim() ? (
            <div id="notePreview" className="md-body text-[15px] text-ink" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="text-sub text-ink-muted">Nothing written yet. Switch to Write to start.</p>
          )}
        </>
      ) : (
        <>
          <h1 className="sr-only">{stored ? 'Edit note' : 'New note'}</h1>
          <input
            id="noteTitle"
            aria-label="Title"
            maxLength={120}
            autoFocus={!existing}
            placeholder="Title"
            value={draft.title}
            onChange={event => {
              set({ title: event.target.value });
            }}
            className="w-full bg-transparent font-display font-extrabold text-[22px] leading-tight text-ink-bright placeholder:text-ink-disabled focus:outline-hidden"
          />
          <PinPills note={draft} gear={gear} systems={systems} />
          <div className="xl:grid xl:grid-cols-2 xl:gap-4 xl:items-start">
            <textarea
              id="noteBody"
              ref={area}
              aria-label="Note"
              rows={14}
              maxLength={MAX_NOTE_CHARS}
              value={draft.body}
              onChange={event => {
                set({ body: event.target.value });
              }}
              placeholder={
                'Markdown works: **bold**, - lists, | tables |.\nLink a Codex page with [[Infra-Knife Accelerator]].'
              }
              className={`${FIELD} h-auto min-h-[40dvh] py-3 font-mono leading-relaxed resize-y`}
            />
            {sideBySide && (
              <section
                aria-label="Preview"
                className="rounded-card border border-hairline bg-panel-glass p-4 min-h-[40dvh]"
              >
                {draft.body.trim() ? (
                  <div
                    id="notePreview"
                    className="md-body text-[15px] text-ink"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ) : (
                  <p className="text-sub text-ink-muted">Your note’s preview shows here as you write.</p>
                )}
              </section>
            )}
          </div>
          <TagEditor tags={draft.tags} onTags={setTags} typed={typed} onTyped={setTyped} max={MAX_NOTE_TAGS} />
          {stored && (
            <ArmButton
              label="Delete note"
              armedLabel="Tap again to delete"
              onConfirm={() => {
                setRemoved(true);
                unsaved.current = null;
                deleteNote(id);
                goBack('notes');
              }}
            />
          )}
        </>
      )}

      <p id="noteStatus" className="text-caption text-ink-muted">
        {empty
          ? 'Write a title or some text to keep this note.'
          : `Edited ${shortDate(existing?.updatedAt ?? draft.updatedAt)} · saved on this device`}
      </p>

      <div
        role="group"
        aria-label="Formatting"
        className="fixed z-40 inset-x-4 bottom-[calc(var(--spacing-tabbar-inset)+var(--spacing-tabbar)+16px)] lg:sticky lg:inset-x-auto lg:bottom-6 p-2 rounded-2xl bg-panel-glass border border-hairline backdrop-blur-[18px] flex gap-2 overflow-x-auto [scrollbar-width:none]"
      >
        {TOOLS.map(([kind, label, text]) => (
          <button
            key={kind}
            type="button"
            aria-label={label === text ? undefined : label}
            onMouseDown={event => {
              event.preventDefault(); // keeps the selection in the note
            }}
            onClick={() => {
              format(kind);
            }}
            className={`${buttonClass('secondary', 'M')} shrink-0 px-3.5 ${TOOL_LOOK[kind] ?? ''}`}
          >
            {kind === 'list' && <i className="ph-bold ph-list-bullets" aria-hidden="true" />}
            {kind === 'link' && <i className="ph-bold ph-link" aria-hidden="true" />}
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
