import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  filterNotes,
  gearPin,
  linkNotes,
  notesForSystem,
  noteChips,
  noteExcerpt,
  noteFromMarkdown,
  normalizeNotes,
  notesForGear,
  notesPinnedTo,
  searchNotes
} from '../src/notes.ts';
import { buildState } from '../src/state.ts';
import { mergeStates } from '../src/sync.ts';

const note = (id: string, pins: string[], updatedAt: string, body = 'text') => ({
  id,
  title: id,
  body,
  pins,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt
});

test('notes keep only known pins, drop empty or damaged entries, and list newest first per place', () => {
  const notes = normalizeNotes([
    note('a', ['book3', 'nowhere', 'book3'], '2026-10-02T00:00:00.000Z'),
    note('b', ['book3', 'home'], '2026-10-05T00:00:00.000Z'),
    { id: 'c', title: '', body: '  ' },
    { id: 'd', body: 'no title' },
    'x'
  ]);
  assert.deepEqual(notes[0]?.pins, ['book3']);
  assert.equal(notes[2]?.title, 'Untitled note');
  assert.deepEqual(
    notesPinnedTo(notes, 'book3').map(n => n.id),
    ['b', 'a']
  );
  assert.deepEqual(
    notesPinnedTo(notes, 'home').map(n => n.id),
    ['b']
  );
});

test('a Markdown file becomes a note: its first heading is the title', () => {
  assert.deepEqual(noteFromMarkdown('﻿# Grid\r\n\r\n* R2C3: main\r\n', 'x.md'), {
    title: 'Grid',
    body: '* R2C3: main'
  });
  assert.deepEqual(noteFromMarkdown('Just text', 'My layout.md'), { title: 'My layout', body: 'Just text' });
});

test('search matches every word in title or body; excerpts drop Markdown marks', () => {
  const notes = normalizeNotes([note('a', [], '2026-10-02', 'Infra-Knife in **R2C3**'), note('b', [], '2026-10-03')]);
  assert.deepEqual(
    searchNotes(notes, 'knife r2c3').map(n => n.id),
    ['a']
  );
  assert.equal(noteExcerpt(notes[0]!), 'Infra Knife in R2C3');
  assert.equal(
    noteExcerpt({ ...notes[0]!, body: 'See [[Pugneum]] and [[Gold|the gold]]' }),
    'See Pugneum and the gold'
  );
});

test('notes from two devices merge by id, and pins merge as a set', () => {
  const base = buildState({ notes: [note('a', ['home'], '2026-10-01')] });
  const local = buildState({ notes: [note('a', ['home', 'book1'], '2026-10-02'), note('l', [], '2026-10-02')] });
  const remote = buildState({ notes: [note('a', ['home', 'book3'], '2026-10-03'), note('r', [], '2026-10-03')] });
  const merged = buildState(mergeStates(base, local, remote));
  assert.deepEqual(merged.notes.map(n => n.id).sort(), ['a', 'l', 'r']);
  assert.deepEqual(merged.notes.find(n => n.id === 'a')?.pins.sort(), ['book1', 'book3', 'home']);
});

test('a note links to a ship through a gear pin; linking sets exactly the chosen notes', () => {
  const notes = normalizeNotes([
    note('a', ['home', gearPin('ship-1')], '2026-10-02T00:00:00Z'),
    note('b', ['gear:bad id!'], '2026-10-01T00:00:00Z'), // not a safe id: dropped
    note('c', [], '2026-10-03T00:00:00Z')
  ]);
  assert.deepEqual(
    notes.map(item => item.pins),
    [['home', 'gear:ship-1'], [], []]
  );
  assert.deepEqual(
    notesForGear(notes, 'ship-1').map(item => item.id),
    ['a']
  );
  const linked = linkNotes(notes, 'ship-1', ['c']);
  assert.deepEqual(
    linked.map(item => item.pins),
    [['home'], [], ['gear:ship-1']]
  );
  assert.equal(linked[1], notes[1]); // untouched notes stay the same object
});

test('a note links to a system through a system pin, listed newest first on its screen', () => {
  const notes = normalizeNotes([
    note('a', ['system:sys-1', 'system:bad id!'], '2026-10-01T00:00:00Z'),
    note('b', ['system:sys-1'], '2026-10-02T00:00:00Z'),
    note('c', ['home'], '2026-10-03T00:00:00Z')
  ]);
  assert.deepEqual(notes[0]?.pins, ['system:sys-1']); // not a safe id: dropped
  assert.deepEqual(
    notesForSystem(notes, 'sys-1').map(item => item.id),
    ['b', 'a']
  );
});

test('tags are slugs, merge as a set, and drive the list’s chips and filter', () => {
  const notes = normalizeNotes([
    { ...note('a', ['home'], '2026-10-02T00:00:00Z'), tags: ['Ships', 'ships', 'Multi Tool', 7] },
    { ...note('b', [], '2026-10-03T00:00:00Z', 'Units plan'), tags: ['units', 'ships'] },
    note('c', [], '2026-10-01T00:00:00Z') // an older note without tags
  ]);
  assert.deepEqual(notes[0]?.tags, ['ships', 'multi-tool']);
  assert.deepEqual(notes[2]?.tags, []);
  assert.deepEqual(
    noteChips(notes).map(chip => chip.label),
    ['All', 'Pinned', 'ships', 'multi-tool', 'units']
  );
  assert.deepEqual(
    filterNotes(notes, '', 'tag:ships').map(n => n.id),
    ['b', 'a']
  );
  assert.deepEqual(
    filterNotes(notes, '', 'pinned').map(n => n.id),
    ['a']
  );
  assert.deepEqual(
    filterNotes(notes, 'units', 'all').map(n => n.id),
    ['b']
  );
  assert.deepEqual(
    filterNotes(notes, 'multi', 'all').map(n => n.id),
    ['a']
  ); // tags are searched too
});
