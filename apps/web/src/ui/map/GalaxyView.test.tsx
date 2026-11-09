// One galaxy (round 7, c17): every system reachable without zooming, one selection shared by the map and the list,
// and the states the boards draw (31–31i, d05–d05c).
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { setAppState } from '../../app/store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { setGalaxiesForTests } from '../systems/galaxies-store.ts';
import { setWide } from '../test-media.ts';
import { MapScreen } from './Map.tsx';

vi.mock('../shell/section-store.ts', () => ({ useSectionParam: () => 'Euclid', useSection: () => 'map' }));

type Raw = { id: string; name: string; glyphs?: string; region?: string; tags?: string[]; createdAt?: string };
const day = (n: number) => new Date(Date.UTC(2026, 9, 1) + n * 86_400_000).toISOString();
function log(systems: Raw[]) {
  act(() => {
    setAppState(
      buildState({
        systems: systems.map((s, n) => ({ galaxy: 'Euclid', createdAt: day(n), ...s }))
      })
    );
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  setFactsForTests({ schema: 1, facts: {} });
  setGalaxiesForTests([{ n: 1, name: 'Euclid', type: 'Norm', path: 'wiki/galaxies/Euclid.md' }]);
});

// The owner's log: two systems logged in one region, and a third without an address.
const MARCO: Raw[] = [
  { id: 'sys-m', name: 'Masdalri Junction', glyphs: '10010C4BAB22', region: 'Aeushne Sector', tags: ['base'] },
  { id: 'sys-f', name: 'Funjosm', glyphs: '20020C4BAB22', region: 'Aeushne Sector' },
  { id: 'sys-d', name: 'Dissonant System #1' }
];

test('31: two systems in one region are both reachable on a phone without zooming', async () => {
  setWide(false);
  log(MARCO);
  render(<MapScreen />);
  const card = screen.getByRole('region', { name: 'Selected system' });
  // The base is selected first; the card says it shares its region and offers both.
  expect(within(card).getByRole('heading', { name: 'Masdalri Junction' })).toBeTruthy();
  const tabs = within(card).getByRole('group', { name: /Same region · 2 systems/i });
  await userEvent.click(within(tabs).getByRole('button', { name: /Funjosm/ }));
  expect(within(card).getByRole('heading', { name: 'Funjosm' })).toBeTruthy();
  expect(
    within(tabs)
      .getByRole('button', { name: /Funjosm/ })
      .getAttribute('aria-pressed')
  ).toBe('true');
  expect(within(card).getByText('4BA·B22')).toBeTruthy();
  // The list holds them as one stack in their cluster, named by the region the player typed.
  const group = screen.getByRole('group', { name: 'Aeushne Sector' });
  const stack = within(group).getByRole('list', { name: 'Same region, 4BA·B22' });
  expect(
    within(stack)
      .getAllByRole('button')
      .map(b => b.textContent)
  ).toEqual([expect.stringContaining('Masdalri Junction'), expect.stringContaining('Funjosm')]);
  // The one without an address is named, never placed.
  expect(screen.getByText(/1 more system has no portal address/)).toBeTruthy();
  expect(screen.getByText('Dissonant System #1')).toBeTruthy();
  // The map is one tab stop with its tools and breadcrumb.
  expect(screen.getByRole('application', { name: /Euclid: your 2 systems with an address/ })).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Zoom level' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Fit all my systems' })).toBeTruthy();
});

test('31b: one system opens on the whole galaxy with that system selected', () => {
  setWide(false);
  log(MARCO.slice(0, 1));
  render(<MapScreen />);
  expect(screen.getByRole('heading', { name: 'Masdalri Junction' })).toBeTruthy();
  expect(screen.queryByRole('group', { name: /Same region/ })).toBeNull();
  // At the galaxy level the breadcrumb is the galaxy alone, and there's no locator.
  const crumbs = screen.getByRole('navigation', { name: 'Zoom level' });
  expect(within(crumbs).getByRole('button', { name: 'Euclid' }).getAttribute('aria-current')).toBe('location');
  expect(screen.queryByRole('button', { name: 'Whole galaxy (zoom out)' })).toBeNull();
});

test('31i: nothing placed lists each system with a way to add its address', () => {
  setWide(false);
  log([
    { id: 'a', name: 'Masdalri Junction' },
    { id: 'b', name: 'Funjosm' }
  ]);
  render(<MapScreen />);
  expect(screen.getByRole('heading', { name: 'Nothing to place yet' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Add one from Photo Mode/ })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'In Euclid · 2' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add an address to Funjosm' })).toBeTruthy();
  expect(screen.getByText(/none placed/)).toBeTruthy();
});

test('31h: 300 systems get a search, capped clusters, and the selection is never hidden', async () => {
  setWide(false);
  // 300 systems in three clusters far apart; the latest (selected) is the last of the third.
  const hex = (n: number, digits: number) => n.toString(16).toUpperCase().padStart(digits, '0');
  const systems: Raw[] = Array.from({ length: 300 }, (_, n) => {
    const x = [0x100, 0x500, 0x900][Math.floor(n / 100)] ?? 0;
    return {
      id: `s${String(n)}`,
      name: `System ${String(n + 1)}`,
      glyphs: `100100${hex(0x200, 3)}${hex(x + (n % 100), 3)}`
    };
  });
  log(systems);
  render(<MapScreen />);
  expect(screen.getByRole('heading', { name: 'System 300' })).toBeTruthy();
  const search = screen.getByRole('searchbox', { name: 'Find a system on the map' });
  // Only the selection's cluster is open; it's capped, yet the selected row shows.
  const rows = screen.getAllByRole('button', { pressed: true });
  expect(rows.some(r => r.textContent.includes('System 300'))).toBe(true);
  expect(screen.getByRole('button', { name: /Show all 100 in/ })).toBeTruthy();
  await userEvent.type(search, 'System 150');
  expect(screen.getByText('System 150')).toBeTruthy();
  expect(screen.queryByText('System 2')).toBeNull();
});

test('d05: on the Workbench the map and the list share the selection; the keyboard moves through the log', async () => {
  setWide(true);
  log(MARCO.slice(0, 2).concat({ id: 'sys-v', name: 'Vintam Reach', glyphs: '10030C4BBB22' }));
  render(<MapScreen />);
  const side = screen.getByRole('complementary', { name: /^Euclid: the selected system/ });
  expect(within(side).getByText('Selected')).toBeTruthy();
  expect(within(side).getByRole('heading', { name: 'Masdalri Junction' })).toBeTruthy();
  // A row selects on the map too.
  await userEvent.click(within(side).getByRole('button', { name: /Vintam Reach/ }));
  expect(within(side).getByRole('heading', { name: 'Vintam Reach' })).toBeTruthy();
  expect(
    within(side)
      .getByRole('button', { name: /Vintam Reach/ })
      .getAttribute('aria-pressed')
  ).toBe('true');
  // The map: focus it, ← moves through the log, Enter selects.
  const map = screen.getByRole('application');
  act(() => {
    map.focus();
  });
  fireEvent.keyDown(map, { key: 'ArrowLeft' });
  fireEvent.keyDown(map, { key: 'Enter' });
  expect(within(side).getByRole('heading', { name: 'Funjosm' })).toBeTruthy();
  // ↑ within the stack, then Enter.
  fireEvent.keyDown(map, { key: 'ArrowUp' });
  fireEvent.keyDown(map, { key: 'Enter' });
  expect(within(side).getByRole('heading', { name: 'Masdalri Junction' })).toBeTruthy();
  expect(within(side).getByRole('button', { name: 'Open system' })).toBeTruthy();
});
