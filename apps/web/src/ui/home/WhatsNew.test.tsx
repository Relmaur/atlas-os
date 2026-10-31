import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WhatsNew } from './WhatsNew.tsx';

const LATEST = { slug: 'first-light', name: 'First Light', title: 'The Map', text: 'Every galaxy you have reached.' };

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('VITE_LATEST_UPDATE', JSON.stringify(LATEST));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

test('after an update: the card, its first highlight and a link, until it is dismissed', async () => {
  const { unmount } = render(<WhatsNew emptyLog={false} />);
  expect(screen.getByRole('heading', { name: 'Updated to First Light' })).toBeTruthy();
  expect(document.body.textContent).toContain('Every galaxy you have reached.');
  expect(screen.getByRole('link', { name: "See what's new" }).getAttribute('href')).toBe(
    'https://atlas-os.cloud/updates/first-light/'
  );
  await userEvent.click(screen.getByRole('button', { name: /^Dismiss/ }));
  expect(screen.queryByRole('heading')).toBeNull();
  unmount();
  render(<WhatsNew emptyLog={false} />);
  expect(screen.queryByRole('heading')).toBeNull(); // once per update
});

test('never on a first install, and that first visit counts as seen', () => {
  const { unmount } = render(<WhatsNew emptyLog />);
  expect(screen.queryByRole('heading')).toBeNull();
  unmount();
  render(<WhatsNew emptyLog={false} />);
  expect(screen.queryByRole('heading')).toBeNull();
});

test('a new update file brings a new card', () => {
  localStorage.setItem('atlas_update_seen', 'an-older-one');
  render(<WhatsNew emptyLog={false} />);
  expect(screen.getByRole('heading', { name: 'Updated to First Light' })).toBeTruthy();
});
