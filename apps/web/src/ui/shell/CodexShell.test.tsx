// The desktop shell on the Codex page (round 6, d08): the same nav and command bar, reading the log this device saved,
// with the app's addresses a folder up and search going to the Codex's own field.
import { beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { STORAGE_KEY, appState, readSavedState } from '../../app/store.ts';
import { CommandBar } from './CommandBar.tsx';
import { WorkbenchNav } from './WorkbenchNav.tsx';
import { appHref, shellOnCodexPage } from './place.ts';

const search = vi.fn();
shellOnCodexPage(search);

beforeEach(() => {
  localStorage.clear();
  const saved = buildState({ systems: [{ id: 'sys-a', name: 'Ekwa Nexus' }] });
  saved.session = { startedAt: new Date(Date.now() - 60 * 60_000).toISOString(), timersDone: 0 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  act(() => {
    readSavedState();
  });
});

test('the app’s addresses are a folder up, and the Codex is this page', () => {
  expect(appHref('#systems')).toBe('../#systems');
  expect(appHref('wiki/')).toBe('#/');
  expect(appState.systems.map(system => system.name)).toEqual(['Ekwa Nexus']);
  render(<WorkbenchNav />);
  const nav = screen.getByRole('navigation', { name: 'Primary' });
  expect(
    within(nav)
      .getByRole('link', { name: /^Systems/ })
      .getAttribute('href')
  ).toBe('../#systems');
  const codex = within(nav).getByRole('link', { name: /^Codex/ });
  expect(codex.getAttribute('href')).toBe('#/');
  expect(codex.getAttribute('aria-current')).toBe('page');
});

test('search goes to the Codex’s field, and what’s live leads back to the app', async () => {
  render(<CommandBar />);
  await userEvent.click(screen.getByRole('button', { name: /Search the Codex/ }));
  expect(search).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: /^Session, / })).toBeTruthy();
});
