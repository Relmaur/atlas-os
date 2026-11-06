import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { HOUR_MS } from '@atlas/core/systems-model';
import { makeCatalog } from '@atlas/core/planner';
import type { GameItem } from '@atlas/core/game-data';
import { appState, setAppState } from '../../app/store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { setGameDataForTests } from '../calculators/game-data.ts';
import { Runs } from './Runs.tsx';
import { setWide } from '../test-media.ts';

vi.mock('../shell/section-store.ts', () => ({ useSection: () => 'runs' }));

const ago = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();
const station = (id: string, runs: number[]) => ({
  id,
  name: id,
  tags: ['outlaw'],
  visits: runs.map(hours => ({ at: ago(hours), packets: 15 }))
});
const GAME = {
  version: '7.10',
  page: 'Update 7.10',
  path: 'wiki/updates/Update_710.md',
  url: 'https://nomanssky.fandom.com/wiki/Update_7.10',
  date: '28 October, 2026'
};

beforeEach(() => {
  setWide(false); // the phone's list (design 28); the Workbench's rows (d06) are tested at the end
  setAppState(buildState({ outlaw: { runSize: 2 }, systems: [station('Fresh', []), station('Waiting', [5])] }));
  setFactsForTests({ schema: 1, facts: {}, game: GAME });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setFactsForTests(null);
  setGameDataForTests({ status: 'idle' });
});

const item = (title: string, value: number, recipes: GameItem['recipes'] = []): GameItem => ({
  title,
  slug: title,
  category: 'products',
  path: `wiki/products/${title}.md`,
  summary: '',
  source: 'wiki',
  revId: 1,
  fields: {},
  value,
  recipes
});
const PUMP = item('Cryo-Pump', 1_500_000, [
  {
    type: 'craft',
    inputs: [
      { name: 'Hot Ice', qty: 1 },
      { name: 'Thermic Condensate', qty: 1 }
    ],
    outputs: [{ name: 'Cryo-Pump', qty: 1 }]
  }
]);
const useCatalog = (items: GameItem[]) => {
  setGameDataForTests({ status: 'ready', catalog: makeCatalog({ items }), verification: null });
};

test('Outlaw stations is built in, checked against the wiki’s game version', () => {
  render(<Runs />);
  expect(screen.getByText(/checked against the game data for v7\.10/)).toBeTruthy();
  const card = screen.getByRole('link', { name: /Outlaw stations/ });
  expect(card.getAttribute('href')).toBe('#outlaw');
  expect(card.textContent).toContain('Works in v7.10');
  expect(card.textContent).toContain('1 of 2 stations ready');
  expect(screen.getByRole('heading', { name: 'Built in' })).toBeTruthy();
});

test('a run in progress shows which station is next and when the first one restocks', () => {
  setAppState(
    buildState({
      outlaw: { runSize: 3, runStartedAt: ago(6) },
      systems: [station('Fresh', []), station('Waiting', [5])]
    })
  );
  render(<Runs />);
  expect(screen.getByRole('heading', { name: 'In progress' })).toBeTruthy();
  const card = screen.getByRole('link', { name: /Outlaw stations/ });
  expect(card.textContent).toContain('Station 2 of 3 · Fresh');
  expect(card.textContent).toMatch(/restock (18h 59m|19h 00m)/);
});

test('without the facts file, nothing claims a version', () => {
  setFactsForTests({ schema: 1, facts: {} });
  render(<Runs />);
  expect(screen.queryByText(/Works in/)).toBeNull();
  expect(screen.getByText('Routes that turn time into Units.')).toBeTruthy();
});

test('a new run: steps checked against the wiki, a live estimate, saved under Yours', async () => {
  useCatalog([PUMP]);
  render(<Runs />);
  await userEvent.click(screen.getByRole('button', { name: 'New run' }));
  const editor = within(screen.getByRole('dialog', { name: 'New run' }));
  await userEvent.type(editor.getByRole('textbox', { name: 'Name' }), 'Cryo-Pump loop');
  await userEvent.click(editor.getByRole('button', { name: 'Add a step' }));
  await userEvent.type(editor.getByRole('combobox', { name: 'Step 1: system' }), 'Somewhere');
  expect(editor.getByText('not in your log')).toBeTruthy();
  await userEvent.click(editor.getByRole('button', { name: 'Add a step' }));
  await userEvent.selectOptions(editor.getByRole('combobox', { name: 'Step 2 verb' }), 'craft');
  await userEvent.type(editor.getByRole('combobox', { name: 'Step 2: item' }), 'cryo-pump');
  expect(editor.getByText(/Hot Ice \+ Thermic Condensate/).textContent).toContain('in the wiki');
  await userEvent.click(editor.getByRole('button', { name: 'Add a step' }));
  await userEvent.selectOptions(editor.getByRole('combobox', { name: 'Step 3 verb' }), 'sell');
  await userEvent.type(editor.getByRole('combobox', { name: 'Step 3: item' }), 'Cryo-Pump');
  await userEvent.type(editor.getByRole('spinbutton', { name: 'Sold' }), '2');
  await userEvent.type(editor.getByRole('spinbutton', { name: 'One run takes (minutes)' }), '30');
  const estimate = document.getElementById('runEstimate')!;
  expect(estimate.textContent).toContain('checked · v7.10');
  expect(estimate.textContent).toContain('≈ 3,000,000');
  expect(estimate.textContent).toContain('≈ 6.0M'); // per hour
  expect(estimate.textContent).toContain('Steps 2–3 use wiki values.');

  // A price of the player's own replaces the wiki's, and the estimate says so.
  await userEvent.type(editor.getByRole('spinbutton', { name: 'Your price' }), '1000000');
  expect(estimate.textContent).toContain('Units, by your numbers');
  await userEvent.click(editor.getByRole('button', { name: 'Save run' }));

  expect(screen.queryByRole('dialog')).toBeNull();
  const [saved] = appState.runs;
  expect(saved?.checked).toEqual({
    version: '7.10',
    values: { 'craft:Cryo-Pump': 'Hot Ice×1+Thermic Condensate×1>1', 'sell:Cryo-Pump': '1500000' }
  });
  const yours = within(document.getElementById('runsYours')!);
  expect(yours.getByText('Cryo-Pump loop')).toBeTruthy();
  expect(yours.getByText('Works in v7.10')).toBeTruthy();
  expect(yours.getByText('≈ 2.0M per run')).toBeTruthy();
});

test('an update that changes a value it relied on moves the run to Retired; saving checks it again', async () => {
  useCatalog([PUMP]);
  setAppState(
    buildState({
      runs: [
        {
          id: 'run-1',
          name: 'Cryo-Pump loop',
          steps: [{ id: 's1', verb: 'sell', target: 'Cryo-Pump', qty: 1 }],
          checked: { version: '7.06', values: { 'sell:Cryo-Pump': '1200000' } }
        }
      ]
    })
  );
  render(<Runs />);
  const retired = within(document.getElementById('runsRetired')!);
  expect(retired.getByText('Values changed')).toBeTruthy();
  expect(document.getElementById('runsYours')).toBeNull();
  await userEvent.click(retired.getByRole('button', { name: /Cryo-Pump loop/ }));
  expect(document.getElementById('runEstimate')?.textContent).toContain('Checked in v7.06');
  await userEvent.click(screen.getByRole('button', { name: 'Save run' }));
  expect(within(document.getElementById('runsYours')!).getByText('Works in v7.10')).toBeTruthy();
});

test('a run with a repeat timer starts it when the player finishes one; a run can be deleted', async () => {
  useCatalog([PUMP]);
  setAppState(
    buildState({
      runs: [{ id: 'run-1', name: 'Loop', steps: [{ verb: 'do', target: 'Fly' }], repeatMinutes: 40, timer: true }]
    })
  );
  render(<Runs />);
  expect(screen.getByText('Not checked')).toBeTruthy(); // saved before the game data could load
  await userEvent.click(screen.getByRole('button', { name: /Finished a run · start the 40 min timer/ }));
  expect(appState.timers.map(timer => [timer.kind, timer.label])).toEqual([['custom', 'Loop']]);

  await userEvent.click(screen.getByRole('button', { name: 'Loop' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete run' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to delete' }));
  expect(appState.runs).toEqual([]);
});

test('d06: on the Workbench each run is a row, Outlaw stations under Built in, and New run (R) at the foot', async () => {
  setWide(true);
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))); // the editor's game data: not under test
  render(<Runs />);
  const outlaw = screen.getByRole('link', { name: /^Outlaw stations/ });
  expect(outlaw.getAttribute('href')).toBe('#outlaw');
  expect(outlaw.textContent).toContain('1 of 2 stations ready');
  const add = screen.getByRole('button', { name: 'New run' });
  expect(add.getAttribute('aria-keyshortcuts')).toBe('r');
  await userEvent.click(add);
  expect(screen.getByRole('dialog')).toBeTruthy();
});

test('d07: on the Workbench the editor says how to leave, and Ctrl+Enter saves the run', async () => {
  setWide(true);
  useCatalog([PUMP]);
  render(<Runs />);
  await userEvent.click(screen.getByRole('button', { name: 'New run' }));
  const editor = within(screen.getByRole('dialog', { name: 'New run' }));
  expect(editor.getByText('Steps from your log or the wiki · Esc or the grab bar closes')).toBeTruthy();
  await userEvent.type(editor.getByRole('textbox', { name: 'Name' }), 'Quick loop');
  await userEvent.click(editor.getByRole('button', { name: 'Add a step' }));
  await userEvent.type(editor.getByRole('combobox', { name: 'Step 1: system' }), 'Somewhere');
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(appState.runs.map(run => run.name)).toEqual(['Quick loop']);
});
