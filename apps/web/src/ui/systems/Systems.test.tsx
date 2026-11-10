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

test('c21 (02c–02g): Filters opens a sheet of groups that apply as you tap; chips show what’s on and remove themselves', async () => {
  render(<Systems />);
  const filters = screen.getByRole('button', { name: 'Filters' });
  expect(filters.getAttribute('aria-haspopup')).toBe('dialog');
  expect(screen.queryByRole('group', { name: 'Filters on' })).toBeNull(); // nothing on: no chips, no line
  await userEvent.click(filters);
  const sheet = within(screen.getByRole('dialog', { name: 'Filters' }));
  expect(document.activeElement?.textContent).toBe('Filters'); // focus starts on the title
  // One star class and one race in this log: those groups have nothing to choose between, so they're hidden.
  expect(sheet.queryByRole('radiogroup', { name: 'Star class' })).toBeNull();
  expect(sheet.queryByRole('radiogroup', { name: 'Race' })).toBeNull();
  // Tags exactly as stored, most used first, each "n systems".
  expect(
    within(sheet.getByRole('group', { name: 'Tags' }))
      .getAllByRole('button')
      .map(tag => tag.textContent)
  ).toEqual(['trade-hub2, 2 systems', 'base1, 1 system', 'mining1, 1 system', 'outlaw1, 1 system']); // the count is drawn, then said
  await userEvent.click(sheet.getByRole('button', { name: /^mining ?, 1 system$/ }));
  expect(sheet.getByRole('button', { name: /^mining ?, 1 system$/ }).getAttribute('aria-pressed')).toBe('true');
  expect(sheet.getByText('1 of 3 match')).toBeTruthy();
  const favourites = sheet.getByRole('switch', { name: 'Favourites, 1' });
  await userEvent.click(favourites);
  expect(favourites.getAttribute('aria-checked')).toBe('true');
  await userEvent.click(sheet.getByRole('button', { name: 'Show 1 system' }));

  expect(screen.getByRole('button', { name: /^Filters ?, 2 on$/ })).toBeTruthy();
  expect(names()).toEqual(['Hesper Drift']);
  expect(screen.getByRole('status').textContent).toBe('1 of 3 systems');
  const on = within(screen.getByRole('group', { name: 'Filters on' }));
  // Removing a chip moves focus to the chip now in its place, then back to Filters.
  await userEvent.click(on.getByRole('button', { name: 'Remove filter: tag mining' }));
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove filter: Favourites');
  await userEvent.click(on.getByRole('button', { name: 'Remove filter: Favourites' }));
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Filters' }));
  expect(names()).toHaveLength(3);
});

test('02g: when nothing matches, the chips stay and a card says what clashes, with one way out', async () => {
  act(() => {
    setSystemFilter({ tags: ['mining'], q: 'zzz' });
  });
  render(<Systems />);
  expect(screen.getByRole('status').textContent).toBe('0 of 3 systems');
  expect(
    screen.getByText('Nothing is tagged “mining” and matches “zzz”. Remove a filter above, or clear them all.')
  ).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
  // The search is its own: clearing the filters keeps it, and the card now offers to clear it.
  expect(screen.getByText('Nothing matches “zzz”. Try another search.')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(names()).toHaveLength(3);
});

test('02d: Sort is a button and a listbox of five; the sort is kept when filters are cleared', async () => {
  act(() => {
    setSystemFilter({ favorites: true });
  });
  render(<Systems />);
  const sort = screen.getByRole('button', { name: 'Sort: Last visited' });
  expect(sort.getAttribute('aria-haspopup')).toBe('listbox');
  await userEvent.click(sort);
  const list = screen.getByRole('listbox', { name: 'Sort' });
  expect(
    within(list)
      .getAllByRole('option')
      .map(option => option.textContent)
  ).toEqual(['Last visited', 'Newest added', 'Name', 'Rating', 'Region']);
  expect(within(list).getByRole('option', { name: 'Last visited' }).getAttribute('aria-selected')).toBe('true');
  await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}'); // to Name
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Sort: Name');
  await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(names()).toEqual(['Ekwa Nexus', 'Hesper Drift', 'Outlaw Den']);
  expect(screen.getByRole('button', { name: 'Sort: Name' })).toBeTruthy();
});

test('02h, c22: an outlaw system wears a crimson pill above its name, never in the meta line; conflict reads as stars and a word', () => {
  setAppState(
    buildState({
      systems: [
        {
          id: 'sys-p',
          name: 'Kesh Verge',
          glyphs: '10010C4BAB22',
          conflict: 'pirate',
          conflictWord: 'Pirate Controlled'
        },
        { id: 'sys-q', name: 'Oddun Shoal', conflict: 'pirate' },
        {
          id: 'sys-r',
          name: 'Vintam Reach',
          glyphs: '20020C4BAB22',
          race: 'korvax',
          conflict: 'medium',
          conflictWord: 'Rowdy'
        }
      ]
    })
  );
  render(<Systems />);
  const kesh = screen.getByRole('button', { name: /^Kesh Verge ?, outlaw system$/ }).closest('article')!;
  expect(within(kesh).getByText('Pirate Controlled')).toBeTruthy();
  expect(kesh.textContent).not.toContain('Pirate (outlaw)');
  // No word logged: the pill says "Pirate (outlaw)"; it sits beside No address.
  const oddun = screen.getByRole('button', { name: /^Oddun Shoal ?, outlaw system/ }).closest('article')!;
  expect(within(oddun).getByText('Pirate (outlaw)')).toBeTruthy();
  expect(within(oddun).getByText('No address')).toBeTruthy();
  const vintam = screen.getByRole('heading', { name: 'Vintam Reach' }).closest('article')!;
  expect(within(vintam).getByText('Conflict: Rowdy, medium, 2 of 3')).toBeTruthy();
  expect(vintam.textContent).toContain('Korvax · ★★ Rowdy');
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
  // The funnel opens the filters as a popover (d01d); the sort says it in a word.
  const funnel = screen.getByRole('button', { name: 'Filters' });
  await userEvent.click(funnel);
  const popover = within(screen.getByRole('dialog', { name: 'Filters' }));
  await userEvent.click(popover.getByRole('switch', { name: 'Favourites, 1' }));
  expect(screen.getByRole('button', { name: 'Filters, 1 on' })).toBeTruthy();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull();
  expect(document.activeElement).toBe(funnel);
  // What's on sits under the field: the chips, "1 of 3 systems" and Clear all.
  expect(screen.getByRole('button', { name: 'Remove filter: Favourites' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('1 of 3 systems');
  await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
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
  await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
  await userEvent.click(screen.getByRole('switch', { name: 'Not mapped, 1' }));
  await userEvent.click(screen.getByRole('button', { name: 'Show 1 system' }));
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
