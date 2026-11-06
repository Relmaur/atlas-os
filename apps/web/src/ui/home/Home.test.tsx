import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { HOUR_MS } from '@atlas/core/systems-model';
import { appState, setAppState } from '../../app/store.ts';
import { openSystem, openSystemEditor } from '../systems/panel-store.ts';
import { openSession } from '../session/sheet-store.ts';
import { openGearEditor } from '../parts/editor-store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { Home } from './Home.tsx';
import { setWide } from '../test-media.ts';

// The system panel and the session sheet (their own screens) aren't part of what's under test.
vi.mock('../systems/panel-store.ts', () => ({
  openSystem: vi.fn(),
  openSystemEditor: vi.fn()
}));
vi.mock('../session/sheet-store.ts', () => ({ openSession: vi.fn(), openAddTimer: vi.fn() }));
vi.mock('../parts/editor-store.ts', () => ({ openGearEditor: vi.fn() }));
// Anything logged, so Home shows the log rather than the first run.
const SHIP = { id: 'g1', kind: 'starship', name: 'Kestrel IV' };

const ago = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();
const inHours = (hours: number) => new Date(Date.now() + hours * HOUR_MS).toISOString();

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  setWide(false); // the phone's Home (design 01); the Workbench's (d03) is tested at the end
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))); // the card's galaxy list: not under test
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
});

test('an empty atlas is the first run: the first system, three other ways in, and pairing', async () => {
  setAppState(buildState({ systems: [] }));
  render(<Home />);
  expect(screen.getByRole('heading', { level: 1, name: 'Your atlas is empty' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /Log your first system/ }));
  expect(openSystemEditor).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: /Add your ship/ }));
  expect(openGearEditor).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: /Start a timer/ }));
  expect(openSession).toHaveBeenCalled();
  expect(screen.getByRole('link', { name: /Pair it/ }).getAttribute('href')).toBe('#sync');
  expect(screen.queryByRole('button', { name: /Hold to start session/ })).toBeNull();
});

test('with something logged but no system yet, Home asks for the first system, and the slide opens the editor', () => {
  setAppState(buildState({ systems: [], gear: [SHIP] }));
  render(<Home />);
  expect(screen.getByRole('heading', { name: 'Log your first system' })).toBeTruthy();
  fireEvent.keyDown(
    screen.getByRole('button', { name: 'Warped somewhere new: slide or activate to log a new system' }),
    { key: 'Enter' }
  );
  expect(openSystemEditor).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Systems you log land here, so warping back is one tap.')).toBeTruthy();
});

test('the current system is the hero: where you are, its place, its first note line and its orbits', async () => {
  setAppState(
    buildState({
      systems: [
        {
          id: 'sys-a',
          name: 'Ekwa Nexus',
          region: 'Odyalutai',
          galaxy: 'Euclid',
          race: 'korvax',
          economy: 'Technology',
          wealth: 2,
          star: 'yellow',
          glyphs: '0123456789AB',
          notes: '\nS-class hauler\nsecond line',
          planets: [{ id: 'p1', name: 'Hjalmar', biome: 'Frozen', tags: ['base'] }],
          visits: [{ at: ago(0.2) }]
        },
        { id: 'sys-b', name: 'Hesper Drift', visits: [{ at: ago(48) }] }
      ]
    })
  );
  const { container } = render(<Home />);
  const hero = within(container.querySelector<HTMLElement>('#homeNow')!);
  expect(hero.getByRole('heading', { name: 'Ekwa Nexus' })).toBeTruthy();
  expect(hero.getByText('You are here · 12m ago')).toBeTruthy();
  expect(container.querySelector('#homeNow')?.textContent).toContain('Odyalutai · Euclid · Korvax · Technology ★★');
  expect(hero.getByText('“S-class hauler”')).toBeTruthy();
  hero.getByRole('img', { name: 'Ekwa Nexus: a yellow star with 1 planet; your base is on Hjalmar.' });
  // The planet's colour family comes from the wiki's cited facts.
  expect(container.querySelector('#homeNow [fill="var(--color-biome-frozen)"]')).not.toBeNull();
  await userEvent.click(hero.getByRole('button', { name: 'Open system' }));
  expect(openSystem).toHaveBeenCalledWith('sys-a');
});

test('Log visit saves a visit and the screen follows; "I’m here" makes a recent system current', async () => {
  setAppState(
    buildState({
      systems: [
        { id: 'sys-a', name: 'Ekwa Nexus', visits: [{ at: ago(2) }] },
        {
          id: 'sys-b',
          name: 'Hesper Drift',
          galaxy: 'Euclid',
          tags: ['harmonic-camp'],
          visits: [],
          createdAt: ago(100)
        }
      ]
    })
  );
  const { container } = render(<Home />);
  expect(container.querySelector('#homeRecent')?.textContent).toContain('Euclid · harmonic-camp · never visited');
  await userEvent.click(screen.getByRole('button', { name: 'Log visit' }));
  expect(appState.systems.find(system => system.id === 'sys-a')?.visits).toHaveLength(2);
  expect(container.querySelector('#homeNow')?.textContent).toContain('You are here · just now');
  const saved = JSON.parse(localStorage.getItem('nms_master_os_state') ?? '{}') as { systems: unknown[] };
  expect(saved.systems).toHaveLength(2);

  await userEvent.click(screen.getByRole('button', { name: 'I’m here: Hesper Drift' }));
  expect(container.querySelector('#homeNow')?.textContent).toContain('Hesper Drift');
});

test('timers show the soonest running first, then the finished, and open the Session screen', async () => {
  const timer = (id: string, label: string, kind: string, startedAt: string, endsAt: string) => ({
    id,
    label,
    kind,
    startedAt,
    endsAt,
    alerted: false
  });
  setAppState(
    buildState({
      systems: [],
      timers: [
        timer('t1', 'Frigate mission', 'custom', ago(1), inHours(5)),
        timer('t2', '300 Chromatic Metal', 'refine', ago(0.1), inHours(0.25)),
        timer('t3', 'Frost Crystal', 'crop', ago(2), ago(0.5))
      ]
    })
  );
  render(<Home />);
  const cards = within(screen.getByRole('region', { name: 'Timers' })).getAllByRole('button');
  expect(cards.map(card => card.textContent)).toEqual([
    '15:00Refiner · 300 Chromatic Metal',
    'ReadyCrops · Frost Crystal'
  ]);
  await userEvent.click(cards[0]!);
  expect(openSession).toHaveBeenCalledTimes(1);
});

test('no timers, no timer cards; holding starts a session, which then shows as live', () => {
  setAppState(buildState({ systems: [], gear: [SHIP] }));
  render(<Home />);
  expect(screen.queryByRole('region', { name: 'Timers' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^Hold to start session.*, press and hold$/ }), { detail: 0 });
  expect(appState.session).not.toBeNull();
  const live = screen.getByRole('button', { name: /^Session live/ });
  expect(live.textContent).toMatch(/00:00:0\d · tap the bar to stop/);
});

test('the sync pill stays away while sync is off', () => {
  setAppState(buildState({ systems: [] }));
  render(<Home />);
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('#more');
});

test('d03: on the Workbench Home is four panels: where you are, timers with presets, warp back and the week, your card', async () => {
  setWide(true);
  setAppState(
    buildState({
      systems: [
        { id: 'sys-a', name: 'Vintam Reach', region: 'Oshaun Sector', visits: [{ at: ago(1) }], createdAt: ago(30) },
        { id: 'sys-b', name: 'Asoru Drift', visits: [{ at: ago(40) }], createdAt: ago(400) }
      ],
      timers: [
        {
          id: 't1',
          kind: 'refine',
          label: '300 Chromatic Metal',
          startedAt: ago(0.2),
          endsAt: inHours(0.3),
          alerted: false
        }
      ]
    })
  );
  render(<Home />);
  expect(screen.getByRole('heading', { level: 1, name: 'Vintam Reach' })).toBeTruthy();
  const timers = screen.getByRole('region', { name: 'Timers · 1 running' });
  expect(within(timers).getByRole('button', { name: /Refiner · 300 Chromatic Metal/ })).toBeTruthy();
  await userEvent.click(
    within(within(timers).getByRole('group', { name: 'Start a timer' })).getByRole('button', { name: 'Crops' })
  );
  expect(openSession).toHaveBeenCalled();
  const week = screen.getByRole('region', { name: 'Last 7 days' });
  expect(
    within(week)
      .getAllByRole('term')
      .map(term => term.textContent)
  ).toEqual(['Systems', 'Planets discovered', 'Timers done', 'Played']);
  expect(within(screen.getByRole('region', { name: 'Warp back' })).getByText('Asoru Drift')).toBeTruthy();
  expect(screen.getByRole('link', { name: /^Traveller Card class/ }).getAttribute('href')).toBe('#card');
});
