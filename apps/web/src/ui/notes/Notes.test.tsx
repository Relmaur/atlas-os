import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { appState, setAppState } from '../../app/store.ts';
import { Book } from '../guides/Book.tsx';
import { goBack } from '../shell/section-store.ts';
import { Notes } from './Notes.tsx';
import { NoteScreen } from './NoteEditor.tsx';
import { renderNote } from './NoteCard.tsx';
import { setWide } from '../test-media.ts';

let param = '';
vi.mock('../shell/section-store.ts', () => ({
  showSection: vi.fn(),
  onSection: vi.fn(),
  goBack: vi.fn(),
  useSection: () => 'note',
  useSectionParam: () => param
}));

const note = {
  title: 'Grid',
  body: 'Main **weapon** in [[Infra-Knife Accelerator]]',
  createdAt: '2026-10-01T00:00:00Z'
};

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  setWide(false); // the phone's screens; the Workbench's (d10) are tested at the end
  localStorage.clear();
  param = 'n1';
  location.hash = '';
  act(() => {
    setAppState(
      buildState({
        notes: [
          { ...note, id: 'n1', pins: ['book3'], tags: ['ships'], updatedAt: '2026-10-01T00:00:00Z' },
          {
            ...note,
            id: 'n2',
            title: 'Units plan',
            body: 'Scrap it',
            pins: [],
            tags: ['units'],
            updatedAt: '2026-10-02T00:00:00Z'
          }
        ]
      })
    );
  });
});

// The sanitiser itself is checked in a real browser (tests/e2e/player.spec.mjs): DOMPurify does nothing under happy-dom.
test('[[Name]] links become Codex searches', () => {
  expect(renderNote('[[Gold|the gold]] and [[Infra-Knife Accelerator]]')).toContain(
    'href="wiki/#/?q=Infra-Knife%20Accelerator"'
  );
});

test('the list searches, filters by Pinned and by tag, and each row opens its note', async () => {
  render(<Notes />);
  const list = () => screen.getByRole('list', { name: '' });
  expect(screen.getByPlaceholderText('Search 2 notes')).toBeTruthy();
  expect(
    within(screen.getByRole('group', { name: 'Filters' }))
      .getAllByRole('button')
      .map(b => b.textContent)
  ).toEqual(['All', 'Pinned', 'ships', 'units']);
  await userEvent.click(screen.getByRole('button', { name: 'units' }));
  expect(
    within(list())
      .getAllByRole('link')
      .map(link => link.getAttribute('href'))
  ).toEqual(['#note/n2']);
  await userEvent.click(screen.getByRole('button', { name: 'Pinned' }));
  expect(within(list()).getByRole('link').textContent).toContain('Grid');
  await userEvent.click(screen.getByRole('button', { name: 'All' }));
  await userEvent.type(screen.getByLabelText('Search your notes'), 'scrap');
  expect(within(list()).getAllByRole('link')).toHaveLength(1);
});

test('a new note from Book III starts pinned there and saves as it’s written', async () => {
  const { rerender } = render(<Book book="book3" />);
  const pinned = screen.getByRole('region', { name: 'Pinned notes' });
  expect(within(pinned).getByRole('button', { name: /^Grid/ })).toBeTruthy();

  await userEvent.click(within(pinned).getByRole('button', { name: 'Add a note to Book III' }));
  param = decodeURIComponent(location.hash.replace('#note/', ''));
  rerender(<NoteScreen />);
  expect(screen.getByRole('list', { name: 'Pinned to and tags' }).textContent).toContain('Book III');
  await userEvent.type(screen.getByLabelText('Title'), 'Second');
  await waitFor(() => {
    expect(appState.notes.find(item => item.title === 'Second')?.pins).toEqual(['book3']);
  });
  rerender(<Book book="book3" />);
  expect(
    within(screen.getByRole('region', { name: 'Pinned notes' })).getByRole('button', { name: /^Second/ })
  ).toBeTruthy();
});

test('a saved note opens in Preview; the toolbar formats the selection; leaving stores what’s left', async () => {
  const { unmount } = render(<NoteScreen />);
  expect(screen.getByRole('heading', { level: 1, name: 'Grid' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Preview' }).getAttribute('aria-checked')).toBe('true');
  await userEvent.click(screen.getByRole('radio', { name: 'Write' }));
  const body = screen.getByLabelText<HTMLTextAreaElement>('Note');
  body.setSelectionRange(0, 4); // "Main"
  await userEvent.click(screen.getByRole('button', { name: 'Italic' }));
  expect(body.value.startsWith('_Main_ **weapon**')).toBe(true);
  unmount(); // before the pause: leaving saves it at once
  expect(appState.notes.find(item => item.id === 'n1')?.body.startsWith('_Main_')).toBe(true);
});

test('Pin adds places, a ship among them; tags are added in Write', async () => {
  act(() => {
    setAppState(
      buildState({
        ...appState,
        gear: [{ id: 'ship-1', kind: 'starship', name: 'Ythgall', createdAt: '2026-10-01T00:00:00Z' }]
      })
    );
  });
  render(<NoteScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Pin' }));
  const places = screen.getByRole('group', { name: 'Also show this note on' });
  await userEvent.click(within(places).getByRole('checkbox', { name: 'Home' }));
  await userEvent.click(within(places).getByRole('checkbox', { name: 'Ythgall' }));
  expect(screen.getByRole('link', { name: 'Ythgall' }).getAttribute('href')).toBe('#ship/ship-1');
  await userEvent.click(screen.getByRole('radio', { name: 'Write' }));
  await userEvent.type(screen.getByLabelText('Tags'), 'Infra Knife{Enter}');
  await waitFor(() => {
    const saved = appState.notes.find(item => item.id === 'n1');
    expect(saved?.pins).toEqual(['book3', 'home', 'gear:ship-1']);
    expect(saved?.tags).toEqual(['ships', 'infra-knife']);
  });
});

test('a note deleted elsewhere while open isn’t brought back unless kept', async () => {
  render(<NoteScreen />);
  await userEvent.click(screen.getByRole('radio', { name: 'Write' }));
  act(() => {
    setAppState(buildState({ notes: [] })); // another device's copy, adopted mid-edit
  });
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Grid 2' } });
  expect(screen.getByRole('alert').textContent).toContain('deleted on another device');
  await new Promise(resolve => setTimeout(resolve, 700));
  expect(appState.notes).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
  expect(appState.notes.map(item => item.title)).toEqual(['Grid 2']);
});

test('Delete asks before it removes, then goes back', async () => {
  render(<NoteScreen />);
  await userEvent.click(screen.getByRole('radio', { name: 'Write' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete note' }));
  expect(appState.notes).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to delete' }));
  expect(appState.notes.map(item => item.id)).toEqual(['n2']);
  expect(goBack).toHaveBeenCalledWith('notes');
});

test('an unknown id says so instead of opening a blank note', () => {
  param = 'gone';
  render(<NoteScreen />);
  expect(screen.getByRole('heading', { name: 'Not in your notes' })).toBeTruthy();
});

test('a checklist’s boxes render as text', () => {
  expect(renderNote('- [ ] water\n- [x] seeds')).toMatch(/☐ water[\s\S]*☑ seeds/);
});

test('d10: on a computer the list is compact rows, the open one marked, with New and the filters behind a button', async () => {
  setWide(true);
  param = 'n1';
  render(<Notes />);
  const rows = within(document.getElementById('notesList') as HTMLElement).getAllByRole('link');
  expect(rows.map(row => row.textContent)).toEqual([
    expect.stringContaining('Units plan'),
    expect.stringContaining('Grid')
  ]);
  expect(rows[1]?.getAttribute('aria-current')).toBe('true');
  expect(rows[1]?.textContent).toContain('Pinned');
  expect(screen.getByRole('button', { name: 'New note' }).getAttribute('aria-keyshortcuts')).toBe('n');
  expect(screen.queryByRole('group', { name: 'Filters' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
  await userEvent.click(within(screen.getByRole('group', { name: 'Filters' })).getByRole('button', { name: /units/ }));
  expect(within(document.getElementById('notesList') as HTMLElement).getAllByRole('link')).toHaveLength(1);
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search your notes' }), 'zzz');
  expect(screen.getByText('Nothing matches “zzz”.')).toBeTruthy();
});

test('d10: a note has its toolbar on top, the inspector says what it links, and a timer starts from it', async () => {
  setWide(true);
  act(() => {
    setAppState({
      ...appState,
      systems: buildState({ systems: [{ id: 's1', name: 'Hale 24' }] }).systems
    });
  });
  param = 'n1';
  render(<NoteScreen />);
  const tools = within(screen.getByRole('group', { name: 'Formatting' })).getAllByRole('button');
  expect(tools.map(tool => tool.getAttribute('aria-label'))).toEqual([
    'Bold',
    'Italic',
    'Heading',
    'List',
    'Numbered list',
    'Checklist',
    'Table',
    'Link a Codex page'
  ]);
  // The column isn't measured here, so it's one at a time: Preview first, as on a phone.
  await userEvent.click(screen.getByRole('radio', { name: 'Write' }));
  const body = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Note' });
  fireEvent.change(body, { target: { value: 'Farm at [[Hale 24]], see [[Frost Crystal]]' } });
  const linked = within(document.getElementById('noteLinks') as HTMLElement);
  expect(linked.getByRole('link', { name: 'Hale 24' }).getAttribute('href')).toBe('#system/s1');
  expect(linked.getByRole('link', { name: 'Frost Crystal (Codex)' }).getAttribute('href')).toBe(
    'wiki/#/?q=Frost%20Crystal'
  );
  expect(linked.getByText('Shows on Book III')).toBeTruthy();
  body.setSelectionRange(0, 4);
  fireEvent.keyDown(body, { key: 'b', ctrlKey: true });
  expect(body.value.startsWith('**Farm**')).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Crops' }));
  expect(location.hash).toBe('#session');
  await userEvent.click(screen.getByRole('button', { name: 'Delete note' }));
  await userEvent.click(screen.getByRole('button', { name: 'Click again to delete' }));
  expect(appState.notes.map(item => item.id)).toEqual(['n2']);
});
