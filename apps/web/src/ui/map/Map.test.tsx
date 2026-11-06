import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { setAppState } from '../../app/store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { setGalaxiesForTests } from '../systems/galaxies-store.ts';
import { setWide } from '../test-media.ts';
import { MapScreen } from './Map.tsx';

let param = '';
vi.mock('../shell/section-store.ts', () => ({ useSectionParam: () => param, useSection: () => 'map' }));

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  param = '';
  setFactsForTests({ schema: 1, facts: {} });
  setGalaxiesForTests([
    { n: 1, name: 'Euclid', type: 'Norm', path: 'wiki/galaxies/Euclid.md' },
    { n: 2, name: 'Hilbert Dimension', type: 'Norm', path: 'wiki/galaxies/Hilbert_Dimension.md' }
  ]);
  act(() => {
    setAppState(
      buildState({
        systems: [
          { id: 'sys-a', name: 'Ekwa Nexus', galaxy: 'Euclid', glyphs: '0123456789AB', tags: ['base'] },
          { id: 'sys-b', name: 'Hesper Drift', galaxy: 'Euclid', glyphs: '01234567A9AC' },
          { id: 'sys-c', name: 'Outlaw Den', galaxy: 'Euclid' }
        ]
      })
    );
  });
});

test('d04: on the Workbench the chain has its own pane, the galaxies in the order reached beside it', () => {
  setWide(true);
  render(<MapScreen />);
  expect(screen.getByRole('heading', { level: 1, name: 'Map' })).toBeTruthy();
  const views = screen.getByRole('navigation', { name: 'Map views' });
  expect(within(views).getByRole('link', { name: 'All galaxies' }).getAttribute('aria-current')).toBe('page');
  expect(within(views).getByRole('link', { name: 'One galaxy' }).getAttribute('href')).toBe('#map/Euclid');
  const side = screen.getByRole('complementary', { name: 'Galaxies' });
  expect(within(side).getByRole('link', { name: /^Euclid/ })).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: 'Log sections' })).toBeNull();
});

test('d05: one galaxy has the map, its tools at the top, and the selected system with the galaxy’s list beside it', async () => {
  setWide(true);
  param = 'Euclid';
  render(<MapScreen />);
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy();
  const side = screen.getByRole('complementary', { name: /^Euclid: the selected system/ });
  expect(within(side).getByText('Selected')).toBeTruthy();
  expect(within(side).getByRole('heading', { name: 'Ekwa Nexus' })).toBeTruthy(); // a base is picked first
  await userEvent.click(within(side).getByRole('button', { name: 'Hesper Drift' }));
  expect(within(side).getByRole('heading', { name: 'Hesper Drift' })).toBeTruthy();
  expect(within(side).getByRole('button', { name: 'Hesper Drift' }).getAttribute('aria-pressed')).toBe('true');
});

test('below lg the Map is one column, with Log’s segment (designs 30 and 31)', () => {
  setWide(false);
  render(<MapScreen />);
  expect(screen.queryByRole('complementary', { name: 'Galaxies' })).toBeNull();
  expect(screen.getByRole('region', { name: /in the order you reached them/ })).toBeTruthy();
});
