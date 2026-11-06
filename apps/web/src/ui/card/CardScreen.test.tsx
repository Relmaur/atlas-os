import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { setAppState } from '../../app/store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { setGalaxiesForTests } from '../systems/galaxies-store.ts';
import { CardScreen } from './CardScreen.tsx';
import { setWide } from '../test-media.ts';

vi.mock('../shell/section-store.ts', () => ({ useSection: () => 'card', goBack: vi.fn() }));

beforeEach(() => {
  setWide(false); // the phone's screen; the Workbench's (d17) is tested at the end
  setFactsForTests({
    schema: 1,
    facts: {
      'region-light-years': { page: 'Portal address', path: '', url: '', revId: 1, quote: '', value: 400 }
    },
    game: { version: '7.10', page: 'Update 7.10', path: '', url: '', date: '28 October, 2026' }
  });
  setGalaxiesForTests([]);
  setAppState(
    buildState({
      systems: [
        { id: 'a', name: 'Home', star: 'yellow', glyphs: '100000000100', createdAt: '2026-10-01T00:00:00Z' },
        { id: 'b', name: 'Next', star: 'green', glyphs: '100000000200', createdAt: '2026-10-02T00:00:00Z' },
        { id: 'c', name: 'Third', createdAt: '2026-10-03T00:00:00Z' }
      ]
    })
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  setFactsForTests(null);
  setGalaxiesForTests(null);
});

test('the front reads the log; Flip shows the back, which explains the class and the rank', async () => {
  render(<CardScreen />);
  const front = within(screen.getByRole('region', { name: 'Traveller Card, front' }));
  expect(front.getByRole('heading', { name: 'Pathfinder' })).toBeTruthy();
  expect(front.getByRole('img', { name: 'Class C' })).toBeTruthy();
  expect(front.getByText('2 of 5 colours')).toBeTruthy();
  expect(front.getByText('102,000 ly')).toBeTruthy(); // 256 regions × 400 ly
  expect(front.getByText(/game v7\.10/)).toBeTruthy();
  expect(front.getByText('★ First green star')).toBeTruthy();

  await userEvent.click(screen.getByRole('button', { name: 'Flip' }));
  const back = screen.getByRole('region', { name: 'Traveller Card, back', hidden: true });
  expect(back.getAttribute('aria-hidden')).toBe('false');
  expect(within(back).getByText("2, one per system with an address; each eye is that system's star")).toBeTruthy();
  expect(back.textContent).toContain('Systems 3×10');
  expect(back.textContent).toContain('Not placed yet: 1 system without a portal address');
  await userEvent.click(within(back).getByRole('tab', { name: 'Details' }));
  expect(back.textContent).toContain('★ First yellow star');
  expect(document.querySelector('[aria-label="Traveller Card, front"]')?.getAttribute('aria-hidden')).toBe('true');
});

test('full screen shows the card alone, and closes with the × or Escape', async () => {
  render(<CardScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Full screen' }));
  expect(screen.getByRole('dialog', { name: 'Traveller Card, full screen' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Back' }).closest('[inert]')).toBeTruthy(); // the rest of the screen
  await userEvent.click(screen.getByRole('button', { name: 'Close full screen' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Full screen' }));
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('on iOS the first tap asks for motion, once, and then the phone tilts the card', async () => {
  const requestPermission = vi.fn(() => Promise.resolve('granted'));
  class Orientation extends Event {
    static requestPermission = requestPermission;
    beta: number | null;
    gamma: number | null;
    constructor(beta: number, gamma: number) {
      super('deviceorientation');
      this.beta = beta;
      this.gamma = gamma;
    }
  }
  vi.stubGlobal('DeviceOrientationEvent', Orientation);
  render(<CardScreen />);
  expect(requestPermission).not.toHaveBeenCalled(); // never on load: iOS would refuse
  const card = document.getElementById('travellerCard');
  expect(card).toBeTruthy();
  await userEvent.click(card as HTMLElement);
  await userEvent.click(card as HTMLElement);
  expect(requestPermission).toHaveBeenCalledOnce();
  await vi.waitFor(() => {
    window.dispatchEvent(new Orientation(50, 0)); // how it's held is level
    window.dispatchEvent(new Orientation(50, 12));
    expect(Number(card?.style.getPropertyValue('--tilt-x'))).toBeGreaterThan(0.1);
  });
  vi.unstubAllGlobals();
});

test('d17: on a computer the card keeps its size beside an inspector of its class, depth, colours and firsts', async () => {
  setWide(true);
  render(<CardScreen />);
  expect(screen.getByRole('heading', { level: 1, name: 'Traveller Card' })).toBeTruthy();
  const side = screen.getByRole('complementary', { name: 'Traveller Card' });
  expect(within(side).getByText('Deepest').nextElementSibling?.textContent).toBe('102,000 ly');
  expect(within(side).getByText('Star colours').nextElementSibling?.textContent).toBe('2 of 5');
  expect(within(side).getByRole('list').textContent).toContain('First green star');
  expect(within(side).getByRole('link', { name: 'Collection' }).getAttribute('href')).toBe('#cards');
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  // The card never scales: its stage is the phone's 380px card.
  expect(document.querySelector('#travellerCard')?.className).toContain('max-w-[380px]');
  await userEvent.click(within(side).getByRole('button', { name: 'Full screen' }));
  expect(screen.getByRole('dialog', { name: 'Traveller Card, full screen' })).toBeTruthy();
});
