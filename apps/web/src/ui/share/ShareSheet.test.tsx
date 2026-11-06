import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { normalizeSystem } from '@atlas/core/systems-model';
import { drawPostcard } from './draw.ts';
import { ShareSystemSheet } from './ShareSheet.tsx';
import { setWide } from '../test-media.ts';

vi.mock('./draw.ts', () => ({
  drawPostcard: vi.fn(),
  drawFleetCard: vi.fn(),
  loadShareFonts: () => Promise.resolve(),
  pictureBlob: () => Promise.resolve(new Blob())
}));
vi.mock('../gear/facts-store.ts', () => ({ useFacts: () => null, loadFacts: () => Promise.resolve() }));

const system = normalizeSystem({
  name: 'Masdalri Junction',
  galaxy: 'Euclid',
  notes: 'Main save planet',
  planets: [{ name: 'Buya', biome: 'Rotting' }]
});
const lastCard = () => vi.mocked(drawPostcard).mock.lastCall?.[1];

beforeEach(() => {
  setWide(false); // the phone's sheet; the Workbench's dialog (d18) is tested at the end
  vi.mocked(drawPostcard).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

test('notes start off the picture; a choice redraws it; a missing address can’t be chosen', async () => {
  render(<ShareSystemSheet system={system} open onClose={() => undefined} />);
  await vi.waitFor(() => {
    expect(lastCard()?.card.note).toBe('');
  });
  expect(lastCard()?.format).toBe('square');
  const notes = screen.getByRole('switch', { name: 'My notes' });
  expect(notes.getAttribute('aria-checked')).toBe('false');
  await userEvent.click(notes);
  await vi.waitFor(() => {
    expect(lastCard()?.card.note).toBe('Main save planet');
  });
  expect(screen.getByRole<HTMLButtonElement>('switch', { name: 'Portal address' }).disabled).toBe(true);
  await userEvent.click(screen.getByRole('radio', { name: 'Story' }));
  expect(screen.getByText('1080 × 1920')).toBeTruthy();
});

test('without a phone’s share sheet there’s Save and Copy, and no Share', () => {
  render(<ShareSystemSheet system={system} open onClose={() => undefined} />);
  expect(screen.getByRole('button', { name: 'Save picture' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Copy as text' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Share/ })).toBeNull();
});

test('d18: on a computer the choices sit left, the picture right, with Cancel, Copy image and Save PNG under it', async () => {
  setWide(true);
  const write = vi.fn(() => Promise.resolve());
  vi.stubGlobal(
    'ClipboardItem',
    class {
      items: Record<string, Promise<Blob>>;
      constructor(items: Record<string, Promise<Blob>>) {
        this.items = items;
      }
    }
  );
  Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
  const onClose = vi.fn();
  render(<ShareSystemSheet system={system} open onClose={onClose} />);
  expect(screen.getByRole('heading', { name: 'Share this system' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save PNG' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Copy as text' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Copy image' }));
  expect(write).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
});
