import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { DEFAULT_FILTER } from '@atlas/core/systems-list';
import { HOUR_MS } from '@atlas/core/systems-model';
import { setAppState } from '../../app/store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { Systems } from './Systems.tsx';
import { getPanel, setSystemFilter } from './panel-store.ts';
import { setWide } from '../test-media.ts';
import { setNavOpen } from '../shell/nav-store.ts';

const ago = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  setWide(false); // the phone's list; the Workbench's rows are tested at the end
  setFactsForTests({ schema: 1, facts: {} });
  act(() => {
    setSystemFilter(DEFAULT_FILTER);
  });
  setAppState(
    buildState({
      systems: [
        {
          id: 'sys-a',
          name: 'Ekwa Nexus',
          glyphs: '10010C4BAB22',
          region: 'Odyalutai',
          star: 'yellow',
          rating: 5,
          tags: ['trade-hub'],
          planets: [{ id: 'p1', name: 'Hjalmar', biome: 'Frozen', tags: ['base'] }],
          visits: [{ at: ago(26) }]
        },
        {
          id: 'sys-b',
          name: 'Hesper Drift',
          glyphs: '20020C4BAB22',
          race: 'korvax',
          favorite: true,
          tags: ['mining', 'trade-hub'],
          notes: 'S-class hauler',
          createdAt: ago(100)
        },
        { id: 'sys-c', name: 'Outlaw Den', glyphs: '30030C4BAB22', tags: ['outlaw'], createdAt: ago(200) }
      ]
    })
  );
});

const names = () =>
  within(document.getElementById('systemList')!)
    .queryAllByRole('heading')
    .map(heading => heading.textContent);

test('the header sums the log; every system lists, favourites first', () => {
  render(<Systems />);
  expect(document.getElementById('systemsSummary')?.textContent).toBe('3 systems · 1 planet · 1 visit · Euclid');
  expect(names()).toEqual(['Hesper Drift', 'Ekwa Nexus', 'Outlaw Den']);
  expect(screen.getByText('Never run')).toBeTruthy(); // the outlaw station shows its restock status
});

test('a system with a star or planets draws its orbit and says where you are; one without stays compact', () => {
  render(<Systems />);
  const ekwa = screen.getByRole('heading', { name: 'Ekwa Nexus' }).closest('article')!;
  within(ekwa).getByRole('img', { name: 'Ekwa Nexus: a yellow star with 1 planet; your base is on Hjalmar.' });
  expect(ekwa.textContent).toContain('Last visit 26h ago · 1 planet');
  expect(within(ekwa).getByText('You are here')).toBeTruthy();
  expect(within(ekwa).getByText('Rated 5 of 5')).toBeTruthy();
  const hesper = screen.getByRole('heading', { name: 'Hesper Drift' }).closest('article')!;
  expect(within(hesper).queryByRole('img')).toBeNull();
  expect(hesper.textContent).toContain('Euclid · Korvax · star and planets not logged yet');
  expect(hesper.textContent).toContain('S-class hauler');
  expect(hesper.textContent).toContain('Never visited');
});

test('search and chips narrow the list; All clears the chips; Clear filters clears everything', async () => {
  render(<Systems />);
  const chip = (name: RegExp | string) =>
    within(screen.getByRole('group', { name: 'Filters' })).getByRole('button', { name });
  expect(chip('All 3').getAttribute('aria-pressed')).toBe('true');
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search systems' }), 'hauler');
  expect(names()).toEqual(['Hesper Drift']);
  expect(screen.getByRole('status').textContent).toBe('1 of 3 systems');

  await userEvent.click(chip('mining'));
  expect(chip('mining').getAttribute('aria-pressed')).toBe('true');
  expect(chip('All 3').getAttribute('aria-pressed')).toBe('false');
  await userEvent.click(chip('All 3'));
  expect(chip('mining').getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('hauler'); // All keeps the search

  await userEvent.click(chip('Yellow 1'));
  expect(screen.getByText('No systems match these filters.')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(names()).toHaveLength(3);
  expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('');

  await userEvent.click(chip(/Favourites 1/));
  expect(names()).toEqual(['Hesper Drift']);
  await userEvent.click(chip('Korvax'));
  expect(names()).toEqual(['Hesper Drift']);
});

test('the sort is kept when filters are cleared', async () => {
  render(<Systems />);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'name');
  expect(names()).toEqual(['Ekwa Nexus', 'Hesper Drift', 'Outlaw Den']);
  await userEvent.click(screen.getByRole('button', { name: /Favourites/ }));
  await userEvent.type(screen.getByRole('searchbox'), 'zzz');
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Sort' }).value).toBe('name');
});

test('a card opens the system; Log system and the dashed button open the editor', async () => {
  render(<Systems />);
  await userEvent.click(screen.getByRole('button', { name: 'Ekwa Nexus' }));
  expect(location.hash).toBe('#system/sys-a');
  await userEvent.click(screen.getByRole('button', { name: 'Log system' }));
  expect(getPanel()).toMatchObject({ open: true, mode: 'edit', systemId: null });
  await userEvent.click(screen.getByRole('button', { name: 'Warped somewhere new? Log it here' }));
  expect(getPanel()).toMatchObject({ open: true, mode: 'edit', systemId: null });
});

test('an empty log explains what to do', () => {
  setAppState(buildState({ systems: [] }));
  render(<Systems />);
  expect(
    screen.getByText('Your log is empty. Log a system after your next warp; only its name is needed.')
  ).toBeTruthy();
  expect(document.getElementById('systemsSummary')?.textContent).toBe('0 systems · 0 planets · 0 visits');
});

test('d01: on the Workbench each system is one row: star, name (★ for a favourite) over where it is, and Here or when', async () => {
  setWide(true);
  render(<Systems />);
  const rows = within(document.getElementById('systemList')!).getAllByRole('button');
  expect(rows.map(row => row.textContent)).toEqual([
    expect.stringMatching(/^Hesper Drift ★, a favouriteEuclid · Korvax/),
    expect.stringMatching(/^Ekwa NexusOdyalutai.*Here$/),
    expect.stringMatching(/^Outlaw Den.*Never visited$/)
  ]);
  // The filter chips wait behind their toggle; the sort says it in a word.
  expect(document.getElementById('systemTagFilters')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
  expect(document.getElementById('systemTagFilters')).not.toBeNull();
  expect(screen.getByRole('combobox', { name: 'Sort' }).textContent).toContain('Recent');
  expect(screen.getByPlaceholderText('Filter 3 systems')).toBeTruthy();
  // With the sidebar open the column is tighter: the field and the button say it in a word.
  act(() => {
    setNavOpen(true);
  });
  expect(screen.getByPlaceholderText('Filter')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Log N$/ })).toBeTruthy();
  act(() => {
    setNavOpen(false);
  });
  await userEvent.click(screen.getByRole('button', { name: /^Log system/ }));
  expect(getPanel()).toMatchObject({ open: true, mode: 'edit', systemId: null });
});

test('d01: from ten systems the filter field drops the word, so its placeholder is never cut off', () => {
  setWide(true);
  setAppState(
    buildState({ systems: Array.from({ length: 12 }, (_, i) => ({ id: `s${String(i)}`, name: `S${String(i)}` })) })
  );
  render(<Systems />);
  expect(screen.getByPlaceholderText('Filter 12')).toBeTruthy();
});

test('7c (02b, d01b): a system with no address says so above its name, inside its one link; Not mapped filters them', async () => {
  setAppState(
    buildState({
      systems: [
        { id: 'sys-a', name: 'Ekwa Nexus', glyphs: '10010C4BAB22', star: 'yellow' },
        { id: 'sys-n', name: 'Dissonant System #1', tags: ['harmonic-camp'] }
      ]
    })
  );
  render(<Systems />);
  // A label, not a button: the card's name is the one way in, and a screen reader hears the tag after the name.
  expect(
    screen.getByRole('button', { name: /^Dissonant System #1 ?, Not mapped: no portal address yet$/ })
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^No address/ })).toBeNull();
  expect(screen.getAllByText('No address')).toHaveLength(1);
  const chips = within(screen.getByRole('group', { name: 'Filters' }));
  const chip = chips.getByRole('button', { name: /Not mapped/ });
  expect(chip.textContent).toBe('Not mapped1');
  await userEvent.click(chip);
  expect(screen.queryByRole('button', { name: /^Ekwa Nexus/ })).toBeNull();
  expect(screen.getByRole('button', { name: /^Dissonant System #1/ })).toBeTruthy();

  // On the Workbench the row grows to fit the tag above the name (d01b).
  act(() => {
    setSystemFilter(DEFAULT_FILTER);
  });
  setWide(true);
  render(<Systems />);
  expect(screen.getAllByText('No address').length).toBeGreaterThan(0);
});
