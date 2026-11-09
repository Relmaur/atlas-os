// Map options (round 7b, c18): the sheet on a phone, the popover on the Workbench, the chip and the gear's dot when
// anything differs from the default, the key following the colour choice, and a preference kept off the log.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { setAppState } from '../../app/store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { setGalaxiesForTests } from '../systems/galaxies-store.ts';
import { setWide } from '../test-media.ts';
import { MapScreen } from './Map.tsx';
import { DEFAULT_MAP_OPTIONS, MapOptionsSchema, resetMapOptionsForTests } from './map-options-store.ts';

vi.mock('../shell/section-store.ts', () => ({ useSectionParam: () => 'Euclid', useSection: () => 'map' }));

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  resetMapOptionsForTests();
  setFactsForTests({ schema: 1, facts: {} });
  setGalaxiesForTests([{ n: 1, name: 'Euclid', type: 'Norm', path: 'wiki/galaxies/Euclid.md' }]);
  act(() => {
    setAppState(
      buildState({
        systems: [
          {
            id: 'a',
            name: 'Masdalri Junction',
            galaxy: 'Euclid',
            glyphs: '10010C4BAB22',
            race: 'korvax',
            tags: ['base']
          },
          { id: 'b', name: 'Funjosm', galaxy: 'Euclid', glyphs: '20020C4BAB22', race: 'vykeen' }
        ]
      })
    );
  });
});

test('31j–31l: the gear opens the sheet; choices apply as you tap, the key follows, the chip and the dot say so', async () => {
  setWide(false);
  render(<MapScreen />);
  const gear = screen.getByRole('button', { name: 'Map options' });
  await userEvent.click(gear);
  const sheet = screen.getByRole('dialog', { name: 'Map options' });
  expect(within(sheet).getByRole('radio', { name: /Star class/ })).toHaveProperty('checked', true);
  expect(within(sheet).getByText('Star class colours')).toBeTruthy();
  expect(within(sheet).getByRole('button', { name: /Reset/ })).toHaveProperty('disabled', true);

  await userEvent.click(within(sheet).getByRole('radio', { name: /Race/ }));
  // The key is always the current choice's.
  expect(within(sheet).getByText('Gek')).toBeTruthy();
  expect(within(sheet).getByText('Race not logged')).toBeTruthy();
  expect(within(sheet).queryByText('Star class colours')).toBeNull();
  await userEvent.click(within(sheet).getByRole('switch', { name: 'Trail' }));
  expect(within(sheet).queryByText('Your trail, in log order')).toBeNull();

  expect(screen.getByRole('button', { name: 'Map options, 2 changed' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Map options: Race colours, Trail off' }).textContent).toBe(
    'Race colours · Trail off'
  );
  // Kept on this device under its own key, never in the log.
  expect(JSON.parse(localStorage.getItem('atlas_map_options') ?? '{}')).toEqual({ colour: 'race', trail: false });
  expect(localStorage.getItem('nms_master_os_state') ?? '').not.toContain('race');

  await userEvent.click(within(sheet).getByRole('button', { name: /Reset/ }));
  expect(screen.getByRole('button', { name: 'Map options' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Map options: / })).toBeNull();

  // The grab bar closes it.
  await userEvent.click(within(sheet).getByRole('button', { name: 'Close Map options' }));
  expect(sheet.getAttribute('aria-hidden')).toBe('true');
});

test('31m: bases only greys every system but the bases, in the list as on the map', async () => {
  setWide(false);
  render(<MapScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Map options' }));
  await userEvent.click(screen.getByRole('radio', { name: /Bases only/ }));
  expect(screen.getByRole('button', { name: 'Map options: Bases only' })).toBeTruthy();
  const grey = (row: string) => document.querySelector(`[data-row="${row}"] .map-dot-bg`)?.getAttribute('style') ?? '';
  expect(grey('0')).toMatch(/#475569|rgb\(71, 85, 105\)/); // Funjosm (logged at the same moment, so first by name), not a base
  expect(grey('1')).not.toMatch(/#475569|rgb\(71, 85, 105\)/); // Masdalri Junction, the base
});

test('d05d: the Workbench button opens a popover with the same options; Esc closes it', async () => {
  setWide(true);
  render(<MapScreen />);
  const button = screen.getByRole('button', { name: 'Map options' });
  expect(button.getAttribute('aria-expanded')).toBe('false');
  await userEvent.click(button);
  const popover = screen.getByRole('dialog', { name: 'Map options' });
  await userEvent.click(within(popover).getByRole('radio', { name: /Race/ }));
  expect(screen.getByRole('button', { name: 'Map options, 1 changed' }).getAttribute('aria-expanded')).toBe('true');
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog', { name: 'Map options' })).toBeNull();
});

test('a saved choice that doesn’t parse falls back to the default, field by field', () => {
  expect(MapOptionsSchema.parse({ colour: 'plaid', trail: 'maybe' })).toEqual(DEFAULT_MAP_OPTIONS);
  expect(MapOptionsSchema.parse({ colour: 'race' })).toEqual({ colour: 'race', trail: true });
});
