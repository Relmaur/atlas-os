import { beforeEach, expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { appState, setAppState } from '../../app/store.ts';
import { More } from './More.tsx';
import { ImportDialog } from '../shell/ImportDialog.tsx';

beforeEach(() => {
  localStorage.clear();
  setAppState(buildState({ systems: [] }));
});

test('Import shows a valid file before replacing the log, and leaves it alone for an invalid one', async () => {
  render(
    <>
      <More />
      <ImportDialog />
    </>
  );
  const input = screen.getByLabelText(/Import an atlas/);
  await userEvent.upload(input, new File(['not json'], 'nms_state.json', { type: 'application/json' }));
  expect(appState.systems).toHaveLength(0);
  const file = new File([JSON.stringify({ systems: [{ name: 'Ekwa Nexus' }] })], 'nms_state.json', {
    type: 'application/json'
  });
  await userEvent.upload(input, file);
  const dialog = await screen.findByRole('dialog', { name: 'Import this log?' });
  expect(dialog.textContent).toContain('1 system');
  expect(appState.systems).toHaveLength(0); // nothing replaced before the person confirms
  await userEvent.click(screen.getByRole('button', { name: 'Replace this device’s log' }));
  expect(appState.systems.map(system => system.name)).toEqual(['Ekwa Nexus']);
  await userEvent.click(screen.getByRole('button', { name: /Undo import/ }));
  expect(appState.systems).toHaveLength(1); // asks first: what was logged since would be lost
  await userEvent.click(screen.getByRole('button', { name: /Tap again to undo/ }));
  expect(appState.systems).toHaveLength(0);
});

test('Settings lists your data and this device, and Sync opens as a sheet', async () => {
  render(<More />);
  expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
  const data = screen.getByRole('region', { name: 'Your data' });
  const row = within(data).getByRole('button', { name: /^Sync/ });
  expect(row.textContent).toContain('Off');
  await userEvent.click(row); // the Sync sheet, over Settings
  expect(screen.getByRole('dialog', { name: 'Sync' }).getAttribute('aria-hidden')).toBe('false');
  expect(within(data).getByRole('button', { name: /Export your atlas/ })).toBeTruthy();
  expect(
    within(screen.getByRole('region', { name: 'This device' })).getByRole('link', { name: /Offline Codex/ })
  ).toBeTruthy();
});

test('past play sessions are listed, newest first', () => {
  const state = buildState({ systems: [] });
  state.sessions = [
    { startedAt: '2026-10-25T18:00:00.000Z', endedAt: '2026-10-25T19:00:00.000Z', timersDone: 0 },
    { startedAt: '2026-10-26T18:00:00.000Z', endedAt: '2026-10-26T20:30:00.000Z', timersDone: 3 }
  ];
  setAppState(state);
  render(<More />);
  const rows = screen.getByRole('region', { name: 'Play sessions' }).textContent;
  expect(rows.indexOf('2h 30m · 0 visits · 3 timers')).toBeLessThan(rows.indexOf('1h · 0 visits'));
});

test('Support opens the Ko-fi page in a new tab', () => {
  render(<More />);
  const link = screen.getByRole('link', { name: /Buy me a coffee/ });
  expect(link.getAttribute('href')).toBe('https://ko-fi.com/mlizardo');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toContain('noopener');
});

test('About says ATLAS is fan-made and links to the issues for feedback', () => {
  render(<More />);
  const link = screen.getByRole('link', { name: /Feedback and source code/ });
  expect(link.getAttribute('href')).toBe('https://github.com/Relmaur/atlas-os/issues');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(screen.getByRole('link', { name: 'hello@atlas-os.cloud' }).getAttribute('href')).toBe(
    'mailto:hello@atlas-os.cloud'
  );
  expect(screen.getByRole('link', { name: "What's new" }).getAttribute('href')).toBe('https://atlas-os.cloud/updates/');
  expect(document.body.textContent).toContain('Not affiliated with Hello Games');
  expect(document.body.textContent).toContain('CC BY-NC-SA 3.0');
});

test('your game accounts: added from Settings, once each, and removed with their own button', async () => {
  render(<More />);
  const input = screen.getByRole('textbox', { name: 'Add a game account' });
  await userEvent.type(input, ' marck94{Enter}');
  await userEvent.type(input, 'MARCK94{Enter}'); // the same name in another case is kept once
  expect((input as HTMLInputElement).value).toBe('MARCK94'); // not added, so it stays to be fixed
  await userEvent.clear(input);
  await userEvent.type(input, 'Marco-PSN{Enter}');
  expect(appState.accounts).toEqual(['marck94', 'Marco-PSN']);
  await userEvent.click(screen.getByRole('button', { name: 'Remove marck94' }));
  expect(appState.accounts).toEqual(['Marco-PSN']);
});
