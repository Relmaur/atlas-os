import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { HOUR_MS } from '@atlas/core/systems-model';
import { appState, setAppState } from '../../app/store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { setWide } from '../test-media.ts';
import { SystemScreen } from './SystemDesk.tsx';
import { getPanel, closeSystemPanel } from './panel-store.ts';
import { getPlanetSheet } from './planet-sheet-store.ts';

vi.mock('../shell/section-store.ts', () => ({
  showSection: vi.fn(),
  goBack: vi.fn(),
  useSectionParam: () => 'sys-a'
}));

const ago = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  act(closeSystemPanel);
  setFactsForTests({ schema: 1, facts: {} });
  setAppState(
    buildState({
      systems: [
        {
          id: 'sys-a',
          name: 'Vintam Reach',
          region: 'Oshaun Sector',
          star: 'yellow',
          spectralClass: 'G2',
          water: true,
          race: 'korvax',
          economy: 'High Tech',
          economyStrength: 'Comfortable',
          wealth: 2,
          conflict: 'medium',
          rating: 5,
          glyphs: '0A2F01C93B7E',
          planets: [
            { id: 'pl-1', name: 'Ekora Prime', tags: ['base'] },
            { id: 'pl-2', name: 'Tessa Minor', body: 'moon', orbits: 'pl-1' }
          ],
          visits: [{ at: ago(8 * 24) }, { at: ago(26), note: 'Found a Sentinel pillar on Oran IX.' }]
        }
      ]
    })
  );
});

test('d01: the Workbench detail has the band, the name with Log a visit, six facts, planet cards and the inspector', async () => {
  setWide(true);
  render(<SystemScreen />);
  expect(screen.getByRole('region', { name: 'Orbit diagram' })).toBeTruthy();
  expect(screen.getByRole('heading', { level: 1, name: 'Vintam Reach' })).toBeTruthy();
  expect(screen.getByText(/Oshaun Sector · Euclid · first visited .* · 2 visits/)).toBeTruthy();
  const terms = screen.getAllByRole('term').map(term => term.textContent);
  expect(terms).toEqual(['Star', 'On the map', 'Economy', 'Wealth', 'Race · conflict', 'Your rating']);
  // The race leads; the conflict sits under it, so the row keeps six facts (d19b, d20b).
  const raceCell = screen.getByTitle('Korvax · ★★ Medium');
  expect([...raceCell.querySelectorAll('dd > span > span')].map(line => line.textContent)).toEqual([
    'Korvax',
    '★★ MediumConflict: medium, 2 of 3'
  ]);
  // A moon tied to its planet says which; a card opens the planet in the panel.
  const cards = within(screen.getByRole('region', { name: /Planets & moons/ })).getAllByRole('link');
  expect(screen.getByText('2 not mapped')).toBeTruthy();
  expect(cards.map(card => card.textContent)).toEqual([
    // 7c: the system has its address, so a planet with no glyph yet says so above its name (03e, d16).
    expect.stringMatching(/^No glyphEkora Prime, Not mapped: no planet glyph yetBase/),
    expect.stringMatching(/^No glyphTessa Minor, Not mapped: no planet glyph yetOrbits Ekora Prime/)
  ]);
  await userEvent.click(cards[0]!);
  expect(getPlanetSheet()).toMatchObject({ open: true, systemId: 'sys-a', planetId: 'pl-1' });
  // The inspector: the address with Hex, Names and Dial, and the journal newest first.
  const side = screen.getByRole('complementary', { name: 'Address and journal' });
  expect(within(side).getByRole('button', { name: 'Copy as hex' }).textContent).toBe('Hex');
  expect(within(side).getByRole('link', { name: 'Dial at a portal' }).getAttribute('href')).toBe('#dial/sys-a');
  const journal = within(side).getByRole('region', { name: 'Journal' });
  expect(within(journal).getAllByRole('listitem')[0]?.textContent).toContain('Found a Sentinel pillar');
  await userEvent.click(screen.getByRole('button', { name: 'Log a visit' }));
  expect(appState.systems[0]?.visits).toHaveLength(3);
  await userEvent.click(screen.getByRole('button', { name: 'Edit system' }));
  expect(getPanel()).toMatchObject({ open: true, systemId: 'sys-a' });
});

test('below lg the same address is the phone screen (design 03)', () => {
  setWide(false);
  render(<SystemScreen />);
  expect(screen.queryByRole('complementary', { name: 'Address and journal' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
});
