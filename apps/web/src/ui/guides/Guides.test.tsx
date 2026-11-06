import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { appState, setAppState } from '../../app/store.ts';
import { Guides } from './Guides.tsx';
import { Book } from './Book.tsx';
import { setFactsForTests } from '../gear/facts-store.ts';
import { setWide } from '../test-media.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  setWide(false); // the phone's screens; the Workbench's (d12) are tested at the end
  localStorage.clear();
  // Only the ticks given here.
  const state = buildState();
  state.checklists = { crossSaveLinked: true };
  setAppState(state);
});

test('a checklist step is a checkbox that ticks from the keyboard, and Guides counts it', async () => {
  render(
    <>
      <Guides />
      <Book book="book1" />
    </>
  );
  expect(document.getElementById('guidesProgressText')?.textContent).toBe('ticked 1 / 35');
  // The next milestone is the first not ticked, in book order.
  expect(document.getElementById('guidesNext')?.textContent).toContain('Space Anomaly Unlocked');
  const step = screen.getByRole('checkbox', { name: /Capital Freighter Claimed/ });
  expect((step as HTMLInputElement).checked).toBe(false);
  step.focus();
  await userEvent.keyboard(' ');
  expect(appState.checklists.capitalFreighterClaimed).toBe(true);
  expect((step as HTMLInputElement).checked).toBe(true);
  expect(document.getElementById('guidesProgressText')?.textContent).toBe('ticked 2 / 35');
  const row = within(document.getElementById('guidesList')!).getByRole('link', { name: /Cross-Save & First Hours/ });
  expect(row.textContent).toContain('2/16');
});

test('a book holds its own milestones, hints from the fleet, and quotes the wiki rule it leans on', () => {
  const state = buildState();
  state.gear = [
    {
      id: 'g1',
      kind: 'starship',
      name: 'Ythgall',
      class: 'S',
      type: 'Sentinel Interceptor',
      role: 'Flagship',
      superchargedSlots: [],
      slotLabels: {},
      notes: '',
      createdAt: '2026-10-01T00:00:00.000Z'
    }
  ];
  setAppState(state);
  setFactsForTests({
    schema: 1,
    facts: {
      'supercharged-per-class': {
        page: 'Supercharged Slot',
        path: 'wiki/mechanics/Supercharged_Slot.md',
        url: 'https://nomanssky.fandom.com/wiki/Supercharged_Slot',
        revId: 1336785,
        quote: '1 supercharged slot in Class C, 2 in Class B, 3 in Class A, and 4 in Class S',
        value: { C: 1, B: 2, A: 3, S: 4 }
      }
    }
  });
  render(<Book book="book3" />);
  const milestones = screen.getByRole('region', { name: 'Milestones' });
  expect(within(milestones).getAllByRole('checkbox')).toHaveLength(2);
  expect(within(milestones).getByText('Ythgall · logged in your fleet')).toBeTruthy();
  const wiki = screen.getByRole('region', { name: 'From the wiki' });
  expect(wiki.textContent).toContain('4 in Class S');
  expect(within(wiki).getByRole('link', { name: 'Supercharged Slot' }).getAttribute('href')).toBe(
    'wiki/#/a/wiki%2Fmechanics%2FSupercharged_Slot.md'
  );
  // Book II leans on no cited rule.
  render(<Book book="book2" />);
  expect(screen.getAllByRole('region', { name: 'From the wiki' })).toHaveLength(1);
});

test('a book has a way back and links to its neighbours', () => {
  render(<Book book="book3" />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ship & Multi-Tool Meta');
  expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  const pager = screen.getByRole('navigation', { name: 'More guides' });
  expect(
    within(pager)
      .getByRole('link', { name: /Book II/ })
      .getAttribute('href')
  ).toBe('#book2');
  expect(
    within(pager)
      .getByRole('link', { name: /Book IV/ })
      .getAttribute('href')
  ).toBe('#book4');
});

test('d12: on a computer the books are compact rows, and a book has its chapter beside its milestones', async () => {
  setWide(true);
  render(
    <>
      <Guides />
      <Book book="book1" />
    </>
  );
  expect(document.getElementById('guidesProgressText')?.textContent).toBe('1 / 35 milestones');
  const rows = within(document.getElementById('guidesList')!).getAllByRole('link');
  expect(rows).toHaveLength(6);
  expect(rows[0]?.textContent).toContain('1/16');
  const inspector = screen.getByRole('complementary', { name: 'Book I: milestones, the wiki and your notes' });
  const milestones = within(inspector).getByRole('region', { name: /^Milestones · 1 of 16/ });
  await userEvent.click(within(milestones).getByRole('checkbox', { name: /Capital Freighter Claimed/ }));
  expect(appState.checklists.capitalFreighterClaimed).toBe(true);
  expect(rows[0]?.textContent).toContain('2/16');
  expect(within(inspector).getByRole('button', { name: 'Add a note to Book I' })).toBeTruthy();
  const pager = screen.getByRole('navigation', { name: 'More guides' });
  expect(
    within(pager)
      .getAllByRole('link')
      .map(link => link.getAttribute('href'))
  ).toEqual(['#book2']);
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
});
