// Notes open on their own screen (#note/<id>, design 11). A new one gets its id here, starting pinned to where it was
// begun (a book, Home) or linking the Codex page it was begun from, and is stored only once the player writes a title
// or some text: leaving it untouched leaves nothing.
import { newId } from '@atlas/core/systems-model';

let fresh: { id: string; pins: string[]; body: string } | null = null;

export function openNote(id: string): void {
  location.hash = `#note/${encodeURIComponent(id)}`;
}
export function newNote(pins: string[] = [], body = ''): void {
  fresh = { id: newId('note'), pins, body };
  openNote(fresh.id);
}
/** What a just-begun note starts with, or null when `id` isn't one (a reload forgets it: it was never stored). */
export const freshNote = (id: string): { pins: string[]; body: string } | null => (fresh?.id === id ? fresh : null);

const linkTo = (title: string): string => {
  const clean = title.replace(/[[\]|]/g, '').trim();
  return clean ? `[[${clean}]]\n\n` : '';
};
/** The planner peek's Pin it: a new note whose text links that item, as Pin to a note does from an article. */
export function newNoteAbout(title: string): void {
  newNote([], linkTo(title));
}

// "Pin to a note" on a Codex article (../#note-about/<title>): a new note whose text links that page. The address is
// swapped for the note's own, so Back doesn't make another.
export function takeNoteAbout(): void {
  const match = /^#note-about\/(.+)$/.exec(location.hash);
  if (!match?.[1]) return;
  let title = '';
  try {
    title = decodeURIComponent(match[1]);
  } catch {
    // a mangled address: start the note blank
  }
  fresh = { id: newId('note'), pins: [], body: linkTo(title) };
  history.replaceState(null, '', `#note/${encodeURIComponent(fresh.id)}`);
}
