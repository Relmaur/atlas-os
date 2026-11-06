import { beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { loadAppState, setAppState } from '../../app/store.ts';
import { CommandBar } from './CommandBar.tsx';
import { Sidebar } from './Sidebar.tsx';
import { setNavOpen } from './nav-store.ts';
import { showSection } from './section-store.ts';

beforeEach(async () => {
  localStorage.clear();
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
  await act(async () => {
    await loadAppState();
  });
  const now = Date.now();
  const state = buildState({
    systems: [
      { id: 'sys-a', name: 'Ekwa Nexus', visits: [{ at: new Date(now - 60_000).toISOString() }] },
      { id: 'sys-b', name: 'Hesper Drift', visits: [{ at: new Date(now - 3 * 86_400_000).toISOString() }] }
    ]
  });
  state.session = { startedAt: new Date(now - 72 * 60_000).toISOString(), timersDone: 0 };
  state.timers = [
    {
      id: 't1',
      kind: 'refine',
      label: '300 Chromatic Metal',
      startedAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 18 * 60_000).toISOString(),
      alerted: false
    }
  ];
  act(() => {
    setAppState(state);
  });
  document.body.innerHTML = '';
  for (const key of ['home', 'systems', 'more']) {
    const section = document.createElement('section');
    section.id = `sec-${key}`;
    section.className = 'book-section';
    document.body.append(section);
  }
  act(() => {
    setNavOpen(false);
  });
});

test('Ctrl+\\ opens the sidebar, which this device remembers, with section names and the latest systems', async () => {
  render(<Sidebar />);
  act(() => {
    void showSection('systems');
  });
  expect(document.body.dataset.nav).toBe('closed');
  await userEvent.keyboard('{Control>}\\{/Control}');
  expect(document.body.dataset.nav).toBe('open');
  expect(localStorage.getItem('atlas_nav_open')).toBe('1');
  const nav = screen.getByRole('navigation', { name: 'Primary' });
  expect(
    within(nav)
      .getByRole('link', { name: /^Systems/ })
      .getAttribute('aria-current')
  ).toBe('page');
  // Under Systems: where you are, then the one before.
  const recent = within(nav)
    .getAllByRole('link')
    .filter(link => link.getAttribute('href')?.startsWith('#system/'));
  expect(recent.map(link => link.textContent)).toEqual(['Ekwa Nexushere', 'Hesper Drift3d']);
  await userEvent.click(within(nav).getByRole('button', { name: /^Close the sidebar/ }));
  expect(document.body.dataset.nav).toBe('closed');
  expect(localStorage.getItem('atlas_nav_open')).toBe('0');
});

test('the closed rail names each link for screen readers, with its count and why a dot shows', () => {
  render(<Sidebar />);
  const nav = screen.getByRole('navigation', { name: 'Primary' });
  expect(within(nav).getByRole('link', { name: 'Session & timers, 1, a session is on' })).toBeTruthy();
  expect(within(nav).getByRole('link', { name: 'Systems, 2' })).toBeTruthy();
});

test('the command bar shows the session and each timer with its countdown, and opens the search', async () => {
  render(<CommandBar />);
  const bar = screen.getByRole('toolbar', { name: "Search and what's live" });
  expect(within(bar).getByRole('button', { name: /^Session, 1h 12m/ })).toBeTruthy();
  const timer = within(bar).getByRole('button', { name: /^Refiner 300 Chromatic Metal, 1[78]:\d\d left$/ });
  expect(timer.textContent).toContain('Refiner · 300 Chromatic Metal');
  const search = within(bar).getByRole('button', { name: /Search systems, planets, the Codex/ });
  await userEvent.click(search);
  expect(document.body.classList.contains('search-open')).toBe(true);
});
