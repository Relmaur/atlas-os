import { beforeEach, expect, test } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { makeCatalog } from '@atlas/core/planner';
import { appState, setAppState } from '../../app/store.ts';
import { setGameDataForTests } from '../calculators/game-data.ts';
import { markAlerted, resumeSession } from '../actions.ts';
import { Session } from './Session.tsx';
import { SessionBar } from './SessionBar.tsx';
import { SessionSheet } from './SessionSheet.tsx';
import { clearRecap, closeAddTimer, takeRefineTimer } from './sheet-store.ts';
import subset from '../../../../../tests/fixtures/game-data-subset.json';

// The trimmed wiki subset goes straight to makeCatalog (see Calculators.test.tsx).
const catalog = makeCatalog(subset as unknown as Parameters<typeof makeCatalog>[0]);
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

beforeEach(() => {
  localStorage.clear();
  act(() => {
    setAppState(buildState({ systems: [] }));
    setGameDataForTests({ status: 'ready', catalog, verification: null });
    closeAddTimer();
    clearRecap();
  });
});

const sheet = () => document.getElementById('timerSheet')!;
const screenWithSheet = () =>
  render(
    <>
      <SessionBar />
      <Session />
      <SessionSheet />
    </>
  );
const add = async (kind: 'Refiner' | 'Crop' | 'Custom') => {
  await userEvent.click(screen.getByRole('button', { name: `${kind} timer` }));
};

test('a session starts on the screen with a hold, shows its clock and tallies, and ending it shows the recap', async () => {
  screenWithSheet();
  expect(document.getElementById('sessionBar')).toBeNull(); // nothing on: no bar
  fireEvent.click(screen.getByRole('button', { name: /^Hold to start session.*, press and hold$/ }), { detail: 0 });
  expect(appState.session).not.toBeNull();
  expect(document.getElementById('sessionBar')?.textContent).toContain('Session');
  expect(screen.getByText('Session live')).toBeTruthy();
  expect(document.getElementById('sessionClock')?.textContent).toMatch(/^0:00:0\d$/);
  expect(
    within(screen.getByRole('list', { name: 'This session' }))
      .getAllByRole('listitem')
      .map(item => item.textContent)
  ).toEqual(['0new systems', '0visits', '0timers done']);
  await userEvent.click(screen.getByRole('button', { name: 'End session' }));
  expect(appState.session).toBeNull();
  expect(appState.sessions).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'Session recap' })).toBeTruthy();
  expect(document.getElementById('sessionRecap')?.textContent).toContain('Visits0 · 0 systems');
  await userEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(screen.queryByRole('heading', { name: 'Session recap' })).toBeNull();
});

test('Start a refiner timer from a Codex article opens the sheet with that item chosen', () => {
  location.hash = `#refine-timer/${encodeURIComponent('Enriched Carbon')}`;
  takeRefineTimer();
  expect(location.hash).toBe('#session');
  screenWithSheet();
  expect(sheet().getAttribute('aria-hidden')).toBe('false');
  expect(within(sheet()).getByLabelText<HTMLInputElement>('What it makes').value).toBe('Enriched Carbon');
  act(closeAddTimer);
});

test('a refiner timer takes the wiki’s time for whole batches', async () => {
  screenWithSheet();
  await add('Refiner');
  expect(sheet().getAttribute('aria-hidden')).toBe('false');
  const form = within(sheet());
  await userEvent.type(form.getByLabelText('What it makes'), 'Enriched Carbon');
  await userEvent.clear(form.getByLabelText('Amount made'));
  await userEvent.type(form.getByLabelText('Amount made'), '4');
  expect(sheet().textContent).toContain('3:00'); // 4 batches × 45 s
  await userEvent.click(form.getByRole('button', { name: /Start refiner timer/ }));
  const [timer] = appState.timers;
  expect(timer?.label).toBe('4 Enriched Carbon');
  expect(Date.parse(timer?.endsAt ?? '') - Date.parse(timer?.startedAt ?? '')).toBe(180_000);
  expect(sheet().getAttribute('aria-hidden')).toBe('true'); // started: the sheet closes
  const card = within(document.getElementById('timerList')!).getByText('4 Enriched Carbon').closest('li')!;
  expect(card.textContent).toContain('Refiner');
  expect(card.textContent).toContain('From the wiki’s refining time');
});

test('a crop starts from the time last set for it; a custom timer takes a quick time', async () => {
  const state = buildState({ systems: [] });
  state.timers = [
    { id: 'old', kind: 'crop', label: 'Frostwort', startedAt: minutesAgo(200), endsAt: minutesAgo(125), alerted: true }
  ];
  act(() => {
    setAppState(state);
  });
  screenWithSheet();
  await add('Crop');
  const form = within(sheet());
  await userEvent.type(form.getByLabelText('Crop'), 'Frostwort');
  expect(form.getByLabelText<HTMLInputElement>('Minutes').value).toBe('75');
  await userEvent.click(form.getByRole('button', { name: /Start crop timer/ }));
  await add('Custom');
  await userEvent.type(form.getByLabelText('Name'), 'Frigate');
  await userEvent.click(form.getByRole('button', { name: '15m' }));
  await userEvent.click(form.getByRole('button', { name: /^Start timer/ }));
  expect(appState.timers.map(timer => [timer.kind, timer.label])).toEqual([
    ['crop', 'Frostwort'],
    ['crop', 'Frostwort'],
    ['custom', 'Frigate']
  ]);
});

test('a finished timer is announced once and counts toward the session; Dismiss clears it', async () => {
  const state = buildState({ systems: [] });
  state.session = { startedAt: minutesAgo(30), timersDone: 0 };
  state.timers = [
    { id: 'done', kind: 'custom', label: 'Storm', startedAt: minutesAgo(10), endsAt: minutesAgo(1), alerted: false }
  ];
  act(() => {
    setAppState(state);
  });
  expect(markAlerted(['done']).map(timer => timer.id)).toEqual(['done']);
  expect(markAlerted(['done'])).toEqual([]); // another tab or a reload: not again
  expect(appState.session?.timersDone).toBe(1);
  screenWithSheet();
  expect(document.getElementById('sessionBar')?.textContent).toContain('Storm done');
  const card = screen.getByRole('button', { name: 'Dismiss Storm' }).closest('li')!;
  expect(card.textContent).toContain('Custom · done');
  expect(card.textContent).toMatch(/Finished at \d/);
  expect(within(screen.getByRole('list', { name: 'This session' })).getByText('timer done')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss Storm' }));
  expect(appState.timers).toEqual([]);
});

test('Resume undoes an End; a timer that finished before the session doesn’t count toward it', () => {
  const state = buildState({ systems: [] });
  state.session = { startedAt: minutesAgo(30), timersDone: 0 };
  state.timers = [
    {
      id: 'old',
      kind: 'custom',
      label: 'From a backup',
      startedAt: minutesAgo(600),
      endsAt: minutesAgo(500),
      alerted: false
    }
  ];
  act(() => {
    setAppState(state);
  });
  markAlerted(['old']);
  expect(appState.session?.timersDone).toBe(0);
  const ended = { startedAt: minutesAgo(30), endedAt: minutesAgo(1), timersDone: 2 };
  appState.session = null;
  appState.sessions = [ended];
  resumeSession(ended);
  expect(appState.session).toEqual({ startedAt: ended.startedAt, timersDone: 2 });
  expect(appState.sessions).toEqual([]);
});
