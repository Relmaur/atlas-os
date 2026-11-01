import { beforeEach, expect, test, vi } from 'vitest';
import { freshNote } from '../notes/note-nav.ts';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCatalog } from '@atlas/core/planner';
import { buildState } from '@atlas/core/state';
import { setAppState } from '../../app/store.ts';
import { PlanScreen } from './Planner.tsx';
import { setGameDataForTests } from './game-data.ts';
import subset from '../../../../../tests/fixtures/game-data-subset.json';

let param = 'Stasis Device';
vi.mock('../shell/section-store.ts', () => ({
  showSection: vi.fn(),
  goBack: vi.fn(),
  useSection: () => 'plan',
  useSectionParam: () => param
}));

// The frozen wiki subset the core tests use, trimmed: it goes straight to makeCatalog (see Calculators.test.tsx).
const catalog = makeCatalog(subset as unknown as Parameters<typeof makeCatalog>[0]);
const cargo = (): Record<string, number> =>
  Object.fromEntries(
    [...document.querySelectorAll('#planCargo [data-raw]')].map(row => [
      row.getAttribute('data-raw') ?? '',
      Number(row.getAttribute('data-qty'))
    ])
  );
const step = (kind: string, n = 0) => document.querySelectorAll<HTMLElement>(`#planPath [data-step="${kind}"]`)[n]!;
const ARTICLE = `---
title: "Frost Crystal"
---

## Source

- Harvested from Frostwort on frozen planets.

- **Refiner** · *Encourage Growth* · 0.24 s per unit: 2 × [[Dioxite]] + 1 × [[Oxygen]] → 1 × Frost Crystal
`;

beforeEach(() => {
  localStorage.clear();
  param = 'Stasis Device';
  location.hash = '';
  // Only the article answers; the facts file isn't there, so no distance shows.
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(url.endsWith('.md') ? new Response(ARTICLE) : new Response('', { status: 404 }))
    )
  );
  act(() => {
    setGameDataForTests({ status: 'ready', catalog, verification: null });
    setAppState(buildState({ systems: [] }));
  });
});

test('a Stasis Device: worth, then one path in play order with the cargo’s raw totals', () => {
  render(<PlanScreen />);
  expect(screen.getByRole('heading', { level: 1, name: 'Stasis Device' })).toBeTruthy();
  expect(document.getElementById('planWorth')?.textContent).toBe('15,600,000');
  expect(cargo()).toMatchObject({ Radon: 500, 'Frost Crystal': 300, Dioxite: 50 });
  const kinds = [...document.querySelectorAll('#planPath [data-step]')].map(li => li.getAttribute('data-step'));
  expect(kinds[0]).toBe('gather');
  expect(kinds.at(-1)).toBe('final');
  expect(screen.getByText(`${String(kinds.length)} steps`)).toBeTruthy();
  expect(step('gather').getAttribute('aria-current')).toBe('step');
});

test('gathering everything moves the path on; a round is marked crafted whole, and unmarked', async () => {
  render(<PlanScreen />);
  for (const box of screen.getAllByRole('checkbox', { name: /^Gathered/ })) await userEvent.click(box);
  expect(screen.getByText(/^step 2 of/)).toBeTruthy();
  await userEvent.click(within(step('round')).getByRole('button', { name: 'Mark crafted' }));
  expect(screen.getByText(/^step 3 of/)).toBeTruthy();
  await userEvent.click(within(step('round')).getByRole('button', { name: 'Round 1 crafted' }));
  expect(screen.getByText(/^step 2 of/)).toBeTruthy();
});

test('ticks survive a remount; another quantity keeps what still covers it', async () => {
  const first = render(<PlanScreen />);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Gathered 500 Radon' }));
  first.unmount();
  render(<PlanScreen />);
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Gathered 500 Radon' }).checked).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'One more' }));
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Gathered 1,000 Radon' }).checked).toBe(false);
});

test('a typed amount applies on Enter, not on every keystroke', async () => {
  render(<PlanScreen />);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Gathered 500 Radon' }));
  const qty = screen.getByRole('spinbutton', { name: 'Quantity' });
  await userEvent.clear(qty);
  await userEvent.type(qty, '1');
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Gathered 500 Radon' }).checked).toBe(true);
  await userEvent.type(qty, '0{Enter}');
  expect(screen.getByRole('checkbox', { name: 'Gathered 5,000 Radon' })).toBeTruthy();
});

test('a corrupt or out-of-range saved plan is ignored', () => {
  localStorage.setItem('atlas_plan_progress', '{"item": 42');
  const first = render(<PlanScreen />);
  expect(screen.getByRole('heading', { level: 1, name: 'Stasis Device' })).toBeTruthy();
  first.unmount();
  localStorage.setItem(
    'atlas_plan_progress',
    JSON.stringify({ item: 'Stasis Device', qty: -3, choices: {}, ticked: ['raw:Radon@500'] })
  );
  render(<PlanScreen />);
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Gathered 500 Radon' }).checked).toBe(false);
});

test('a name opens the Codex peek: the wiki’s Source, closest for you, what the plan needs', async () => {
  act(() => {
    setAppState(
      buildState({
        systems: [
          {
            id: 'sys-1',
            name: 'Masdalri Junction',
            planets: [{ id: 'p1', name: 'Rime', tags: ['base'], notes: 'Frost Crystal farm' }],
            visits: [{ at: '2026-10-29T00:00:00Z' }]
          }
        ]
      })
    );
  });
  render(<PlanScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Frost Crystal: open in Codex' }));
  const peek = screen.getByRole('dialog', { name: 'Frost Crystal' });
  await waitFor(() => {
    expect(within(peek).getByText('Harvested from Frostwort on frozen planets.')).toBeTruthy();
  });
  expect(within(peek).getByText('2 × Dioxite + 1 × Oxygen → 1 × Frost Crystal')).toBeTruthy();
  expect(document.getElementById('peekClosest')?.textContent).toContain('Rime in Masdalri Junction, your base');
  expect(within(peek).getByText('300')).toBeTruthy();
  expect(within(peek).getByRole('link', { name: 'Open in Codex' }).getAttribute('href')).toMatch(/^wiki\/#\/a\//);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('Pin it in the peek starts a note linking the item', async () => {
  render(<PlanScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Frost Crystal: open in Codex' }));
  await userEvent.click(
    within(screen.getByRole('dialog', { name: 'Frost Crystal' })).getByRole('button', { name: 'Pin it' })
  );
  const id = decodeURIComponent(location.hash.replace('#note/', ''));
  expect(freshNote(id)?.body).toBe('[[Frost Crystal]]\n\n');
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('a recipe switch in the peek recomputes the plan and keeps ticks that still cover it', async () => {
  param = 'Anomalous Doughnut';
  render(<PlanScreen />);
  expect(cargo()).toMatchObject({ 'Fresh Milk': 2, Grahberry: 2 });
  await userEvent.click(screen.getByRole('checkbox', { name: 'Gathered 2 Fresh Milk' }));
  fireEvent.click(screen.getByRole('button', { name: /^Clarified Oil.*: open in Codex/ }));
  await userEvent.click(screen.getByRole('button', { name: /^Recipe 1 of 5/ }));
  expect(cargo()).toMatchObject({ 'Fresh Milk': 1, 'Warm Proto-Milk': 1 });
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Gathered 1 Fresh Milk' }).checked).toBe(true);
  expect(screen.getByText(/your recipe choices/)).toBeTruthy();
});

test('Change item plans another; an item without a recipe is refused', async () => {
  render(<PlanScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Change item' }));
  await userEvent.type(screen.getByRole('combobox', { name: 'Item to plan' }), 'Radon{Enter}');
  expect(location.hash).toBe('');
  await userEvent.clear(screen.getByRole('combobox', { name: 'Item to plan' }));
  await userEvent.type(screen.getByRole('combobox', { name: 'Item to plan' }), 'Circuit Board{Enter}');
  expect(decodeURIComponent(location.hash)).toBe('#plan/Circuit Board');
});

test('an unknown item says so', () => {
  param = 'Nope';
  render(<PlanScreen />);
  expect(screen.getByRole('heading', { name: 'Nothing to plan' })).toBeTruthy();
});
