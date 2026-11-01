import { afterEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MovedBanner } from './MovedBanner.tsx';

afterEach(() => {
  vi.unstubAllEnvs();
});

test('only the old address says it has moved, and it offers the export first', () => {
  vi.stubEnv('VITE_MOVED', '1');
  render(<MovedBanner />);
  expect(screen.getByRole('status').textContent).toContain('moved to atlas-os.cloud');
  expect(screen.getByRole('button', { name: 'Export your atlas' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open the new address' }).getAttribute('href')).toBe(
    'https://atlas-os.cloud/app/'
  );
});

test('the live app shows no banner', () => {
  vi.stubEnv('VITE_MOVED', '');
  const { container } = render(<MovedBanner />);
  expect(container.firstChild).toBeNull();
});
