import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { DEFAULT_FILTER } from '@atlas/core/systems-list';
import { appState, setAppState } from '../../app/store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { SystemPanel } from './SystemPanel.tsx';
import { setGalaxiesForTests } from './galaxies-store.ts';
import { closeSystemPanel, getPanel, openSystemEditor, setSystemFilter } from './panel-store.ts';

vi.mock('../shell/section-store.ts', () => ({ showSection: vi.fn(), goBack: vi.fn() }));

const system = (id: string) => appState.systems.find(item => item.id === id);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  setGalaxiesForTests([{ n: 1, name: 'Euclid', type: 'Norm', path: 'wiki/galaxies/Euclid.md' }]);
  setFactsForTests({ schema: 1, facts: {} });
  setAppState(
    buildState({
      systems: [
        {
          id: 'sys-a',
          name: 'Ekwa Nexus',
          region: 'Odyalutai',
          tags: ['trade-hub'],
          notes: 'Old notes',
          planets: [{ id: 'pl-1', name: 'Verdant IV', biome: 'Lush' }],
          visits: [{ at: '2026-10-20T10:00:00.000Z', note: 'First arrival' }]
        },
        { id: 'sys-den', name: 'Outlaw Den', tags: ['outlaw'] }
      ]
    })
  );
  act(() => {
    setSystemFilter(DEFAULT_FILTER);
  });
});

afterEach(() => {
  act(closeSystemPanel);
  vi.useRealTimers();
});

const edit = (id: string | null) => {
  render(<SystemPanel />);
  act(() => {
    openSystemEditor(id);
  });
};

test('closed, the editor panel is hidden and inert; opening shows the editor', () => {
  render(<SystemPanel />);
  const dialog = document.getElementById('systemPanel')!;
  expect(dialog.getAttribute('aria-hidden')).toBe('true');
  expect(dialog.hasAttribute('inert')).toBe(true);
  act(() => {
    openSystemEditor('sys-a');
  });
  expect(dialog.getAttribute('aria-hidden')).toBe('false');
  expect(screen.getByRole('heading', { name: 'Edit system' })).toBeTruthy();
});

test('Esc closes the editor', async () => {
  edit('sys-a');
  await userEvent.keyboard('{Escape}');
  expect(getPanel().open).toBe(false);
});

test('editor: validates the name and glyphs, normalises glyphs, adds tags, logs the arrival, opens the new system', async () => {
  edit(null);
  act(() => {
    openSystemEditor(null, { tags: ['outlaw'], conflict: 'pirate' });
  });
  const form = document.getElementById('systemEditor') as HTMLFormElement;
  fireEvent.submit(form); // the browser's `required` check is bypassed here, so the app's own check shows
  expect(screen.getByRole('alert').textContent).toBe('The system needs a name.');

  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Test Prime');
  await userEvent.type(screen.getByRole('textbox', { name: 'Portal address' }), '1a2b');
  await userEvent.click(screen.getByRole('button', { name: 'Add system' }));
  expect(screen.getByRole('alert').textContent).toBe(
    'A portal address is 12 characters, 0–9 and A–F, or leave it empty.'
  );

  await userEvent.type(screen.getByRole('textbox', { name: 'Portal address' }), '3c4d5e6f');
  const tags = screen.getByRole('textbox', { name: 'Tags' });
  await userEvent.type(tags, 'Mining Base{Enter}scrap,temp');
  await userEvent.type(tags, '{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
  await userEvent.click(screen.getByRole('button', { name: 'Add system' }));

  const added = appState.systems.find(item => item.name === 'Test Prime');
  expect(added?.glyphs).toBe('1A2B3C4D5E6F');
  expect(added?.tags).toEqual(['outlaw', 'mining-base']);
  expect(added?.conflict).toBe('pirate');
  expect(added?.visits).toHaveLength(1);
  expect(getPanel().open).toBe(false);
  expect(location.hash).toBe(`#system/${added?.id ?? ''}`);
});

test('editor: sets your rating; Cancel discards changes', async () => {
  edit('sys-a');
  await userEvent.click(screen.getByRole('radio', { name: '4 stars' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(system('sys-a')?.rating).toBe(4);

  act(() => {
    openSystemEditor('sys-a');
  });
  await userEvent.type(screen.getByRole('textbox', { name: 'Region' }), ' changed');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(system('sys-a')?.region).toBe('Odyalutai');
  expect(getPanel().open).toBe(false);
});

test('focus: the editor takes it, and closing returns it to what opened the panel', async () => {
  render(
    <>
      <button
        type="button"
        onClick={() => {
          openSystemEditor();
        }}
      >
        New system
      </button>
      <SystemPanel />
    </>
  );
  await userEvent.click(screen.getByRole('button', { name: 'New system' }));
  expect(document.activeElement?.id).toBe('sysName');
  await userEvent.keyboard('{Escape}');
  expect(document.activeElement?.textContent).toBe('New system');
});

test('on a phone the grab bar closes the editor, but refuses while there are unsaved changes', async () => {
  const handle = () => document.querySelector<HTMLButtonElement>('#systemPanel [data-sheet-handle]')!;
  edit('sys-a');
  await userEvent.click(handle()); // nothing changed yet: it closes
  expect(getPanel().open).toBe(false);

  act(() => {
    openSystemEditor('sys-a');
  });
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' Prime');
  await userEvent.click(handle());
  expect(getPanel()).toMatchObject({ open: true, mode: 'edit' });
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' })); // Cancel still discards
  expect(getPanel().open).toBe(false);
});

test('location: pick a galaxy, type galactic coordinates, see the portal address and the distance; planets and notes save', async () => {
  setGalaxiesForTests([
    { n: 1, name: 'Euclid', type: 'Norm', path: 'wiki/galaxies/Euclid.md' },
    { n: 2, name: 'Hilbert Dimension', type: 'Norm', path: 'wiki/galaxies/Hilbert_Dimension.md' }
  ]);
  setFactsForTests({
    schema: 1,
    facts: {
      'region-light-years': {
        page: 'Portal address',
        path: 'wiki/mechanics/Portal_address.md',
        url: 'https://nomanssky.fandom.com/wiki/Portal_address',
        revId: 1,
        quote: '…',
        value: 400
      }
    }
  });
  edit('sys-a');
  const galaxy = screen.getByRole('combobox', { name: 'Galaxy' });
  expect(screen.getByText('1 of 256')).toBeTruthy();
  await userEvent.selectOptions(galaxy, 'Hilbert Dimension');
  expect(screen.getByText('2 of 256')).toBeTruthy();

  await userEvent.click(screen.getByRole('radio', { name: 'Galactic coordinates' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Galactic coordinates' }), 'HUKYA:046A:0081:0D6D:0038');
  // The wiki's worked example: this booster string is portal address 0038 0256 EC6B.
  expect(document.getElementById('sysAddressConverted')?.textContent).toContain('0038 0256 EC6B');
  screen.getByRole('img', { name: /^Preview: this system sits 6\d\dk ly from the centre of Hilbert Dimension$/ });

  await userEvent.type(screen.getByRole('textbox', { name: 'Planets' }), '5');
  const notes = screen.getByRole('textbox', { name: 'Notes' });
  await userEvent.clear(notes);
  await userEvent.type(notes, 'New notes');
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(system('sys-a')).toMatchObject({
    galaxy: 'Hilbert Dimension',
    glyphs: '00380256EC6B',
    planetCount: 5,
    notes: 'New notes'
  });

  // Back in the editor the address shows as a portal address, and switching keeps it.
  act(() => {
    openSystemEditor('sys-a');
  });
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Portal address' }).value).toBe('0038 0256 EC6B');
  await userEvent.click(screen.getByRole('radio', { name: 'Galactic coordinates' }));
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Galactic coordinates' }).value).toBe(
    '046A:0081:0D6D:0038'
  );
});

test('race, wealth and conflict clear when their segment is tapped again', async () => {
  edit('sys-den');
  await userEvent.click(screen.getByRole('radio', { name: 'Korvax' }));
  await userEvent.click(screen.getByRole('radio', { name: '2 of 3' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Low' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Low' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(system('sys-den')).toMatchObject({ race: 'korvax', wealth: 2, conflict: '' });
});

test('Delete system takes two taps at the foot of the editor, and its notes stay, unlinked', async () => {
  act(() => {
    appState.notes = [
      {
        id: 'n1',
        title: 'Trade route',
        body: 'x',
        pins: ['home', 'system:sys-a'],
        tags: [],
        createdAt: '',
        updatedAt: ''
      }
    ];
    openSystemEditor('sys-a');
  });
  render(<SystemPanel />);
  const remove = screen.getByRole('button', { name: 'Delete system' });
  await userEvent.click(remove);
  expect(system('sys-a')).toBeTruthy(); // one tap only arms it
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to delete' }));
  expect(system('sys-a')).toBeUndefined();
  expect(getPanel().open).toBe(false);
  expect(appState.notes[0]?.pins).toEqual(['home']);
});

test('a new system has nothing to delete', () => {
  act(() => {
    openSystemEditor();
  });
  render(<SystemPanel />);
  expect(screen.queryByRole('button', { name: 'Delete system' })).toBeNull();
});
