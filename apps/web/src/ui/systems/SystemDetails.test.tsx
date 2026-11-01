import { beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { HOUR_MS } from '@atlas/core/systems-model';
import { appState, setAppState } from '../../app/store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { goBack } from '../shell/section-store.ts';
import { freshNote } from '../notes/note-nav.ts';
import { SystemDetails } from './SystemDetails.tsx';
import { getPanel, closeSystemPanel } from './panel-store.ts';

let param = 'sys-a';
vi.mock('../shell/section-store.ts', () => ({
  showSection: vi.fn(),
  goBack: vi.fn(),
  useSectionParam: () => param
}));

const ago = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();
const system = (id: string) => appState.systems.find(item => item.id === id);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  param = 'sys-a';
  act(closeSystemPanel);
  setFactsForTests({
    schema: 1,
    facts: {
      'biome-frozen': {
        page: 'Biome',
        path: 'wiki/mechanics/Biome.md',
        url: 'https://nomanssky.fandom.com/wiki/Biome',
        revId: 1,
        quote: '…',
        value: { biome: 'Frozen', family: 'frozen' }
      }
    }
  });
  setAppState(
    buildState({
      systems: [
        {
          id: 'sys-a',
          name: 'Masdalri Junction',
          region: 'Aeushne Sector',
          star: 'yellow',
          race: 'korvax',
          economy: 'High Tech',
          wealth: 2,
          conflict: 'medium',
          rating: 5,
          notes: 'Main save planet spawn!',
          planets: [
            { id: 'pl-1', name: 'Buya 90/K4', biome: 'Frozen', tags: ['base'], notes: 'Main save first appearance!' },
            { id: 'pl-2', name: 'Leforntow', biome: 'Hot Moon' }
          ],
          visits: [{ at: ago(26) }]
        },
        { id: 'sys-b', name: 'Dissonant System #1', visits: [], createdAt: ago(100) }
      ]
    })
  );
});

test('the system leads with its orbit, where you are, its place and what the game shows', () => {
  render(<SystemDetails />);
  expect(screen.getByRole('heading', { level: 1, name: 'Masdalri Junction' })).toBeTruthy();
  expect(screen.getByText('You are here')).toBeTruthy();
  expect(screen.getByText('Aeushne Sector · Euclid')).toBeTruthy();
  screen.getByRole('img', { name: 'Masdalri Junction: a yellow star with 2 planets; your base is on Buya 90/K4.' });
  const facts: Record<string, string> = Object.fromEntries(
    [...document.querySelectorAll('dl > div')].map(cell => [
      cell.querySelector('dt')?.textContent ?? '',
      cell.querySelector('dd')?.textContent ?? ''
    ])
  );
  expect(facts).toMatchObject({
    Star: 'Yellow',
    Race: 'Korvax',
    Economy: 'High Tech',
    Wealth: '★★★2 of 3',
    Conflict: 'Medium',
    'Your rating': '★★★★★5 of 5'
  });
  expect(screen.getByRole('heading', { name: 'Planets · 2' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Buya 90\/K4 Frozen · “Main save first appearance!” Base/ })).toBeTruthy();
  const journal = screen.getByRole('region', { name: 'Journal' });
  expect(journal.textContent).toContain('Main save planet spawn!');
  expect(journal.textContent).toContain('Visited');
});

test('a system with nothing logged says so, and Add opens the editor for its portal address', async () => {
  param = 'sys-b';
  render(<SystemDetails />);
  expect(screen.queryByText('You are here')).toBeNull();
  expect(screen.getAllByText('Not logged').length).toBeGreaterThan(4);
  expect(screen.getByText('No visits yet. Log a visit when you’re here.')).toBeTruthy();
  await userEvent.click(
    within(screen.getByRole('region', { name: 'Portal address' })).getByRole('button', { name: 'Add' })
  );
  expect(getPanel()).toMatchObject({ open: true, mode: 'edit', systemId: 'sys-b' });
});

test('back, favourite, edit and Log a visit', async () => {
  render(<SystemDetails />);
  await userEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(goBack).toHaveBeenCalledWith('systems');
  await userEvent.click(screen.getByRole('button', { name: 'Favourite' }));
  expect(system('sys-a')?.favorite).toBe(true);
  expect(screen.getByRole('button', { name: 'Favourite' }).getAttribute('aria-pressed')).toBe('true');
  await userEvent.click(screen.getByRole('button', { name: 'Log a visit' }));
  expect(system('sys-a')?.visits).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: 'Edit system' }));
  expect(getPanel()).toMatchObject({ open: true, mode: 'edit', systemId: 'sys-a' });
});

test('planets: add one, edit it, and delete it with a second tap', async () => {
  render(<SystemDetails />);
  const sheet = document.getElementById('planetSheet')!;
  expect(sheet.getAttribute('aria-hidden')).toBe('true');
  await userEvent.click(screen.getByRole('button', { name: 'Add planet' }));
  expect(sheet.getAttribute('aria-hidden')).toBe('false');
  await userEvent.type(within(sheet).getByRole('textbox', { name: 'Name' }), 'Hogaw 24/K5');
  await userEvent.type(within(sheet).getByRole('combobox', { name: 'Biome' }), 'Frozen');
  await userEvent.click(within(sheet).getByRole('button', { name: 'Add planet' }));
  expect(system('sys-a')?.planets.map(planet => planet.name)).toEqual(['Buya 90/K4', 'Leforntow', 'Hogaw 24/K5']);
  expect(sheet.getAttribute('aria-hidden')).toBe('true');

  await userEvent.click(screen.getByRole('button', { name: /^Hogaw 24\/K5/ }));
  expect(within(sheet).getByRole('heading', { name: 'Edit planet' })).toBeTruthy();
  const name = within(sheet).getByRole('textbox', { name: 'Name' });
  await userEvent.clear(name);
  await userEvent.type(name, 'Hogaw Prime');
  await userEvent.click(within(sheet).getByRole('button', { name: 'Save planet' }));
  expect(system('sys-a')?.planets[2]?.name).toBe('Hogaw Prime');

  await userEvent.click(screen.getByRole('button', { name: /^Hogaw Prime/ }));
  await userEvent.click(within(sheet).getByRole('button', { name: 'Delete planet' }));
  expect(system('sys-a')?.planets).toHaveLength(3); // armed, not yet deleted
  await userEvent.click(within(sheet).getByRole('button', { name: 'Tap again to delete' }));
  expect(system('sys-a')?.planets).toHaveLength(2);
});

test('a system that isn’t in the log says so', () => {
  param = 'sys-gone';
  render(<SystemDetails />);
  expect(screen.getByRole('heading', { name: 'System not found' })).toBeTruthy();
});

test('its linked notes list on its screen, and New note starts one pinned to it', async () => {
  act(() => {
    appState.notes = [
      {
        id: 'n1',
        title: 'Trade route',
        body: 'Buy low',
        pins: ['system:sys-a'],
        tags: [],
        createdAt: '',
        updatedAt: ''
      },
      { id: 'n2', title: 'Elsewhere', body: 'x', pins: ['home'], tags: [], createdAt: '', updatedAt: '' }
    ];
  });
  render(<SystemDetails />);
  const linked = screen.getByRole('region', { name: 'Linked notes' });
  expect(within(linked).getByRole('button', { name: /Trade route/ })).toBeTruthy();
  expect(within(linked).queryByRole('button', { name: /Elsewhere/ })).toBeNull();
  await userEvent.click(within(linked).getByRole('button', { name: 'New note' }));
  const id = decodeURIComponent(location.hash.replace('#note/', ''));
  expect(freshNote(id)?.pins).toEqual(['system:sys-a']);
});
