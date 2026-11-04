import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import type { GlyphTable } from '@atlas/core/glyphs';
import { setAppState } from '../../app/store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { SystemDetails } from './SystemDetails.tsx';
import { SystemPanel } from './SystemPanel.tsx';
import { setGalaxiesForTests } from './galaxies-store.ts';
import { closeSystemPanel, openSystemEditor } from './panel-store.ts';

vi.mock('../shell/section-store.ts', () => ({
  showSection: vi.fn(),
  goBack: vi.fn(),
  useSectionParam: () => 'sys-a'
}));

const NAMES =
  'Sunset Bird Face Diplo Eclipse Balloon Boat Bug Dragonfly Galaxy Voxel Fish Tent Rocket Tree Atlas'.split(' ');
const GLYPHS: GlyphTable = {
  page: 'Glyph',
  path: 'wiki/mechanics/Glyph.md',
  glyphs: NAMES.map((name, i) => ({
    digit: i.toString(16).toUpperCase(),
    name,
    ...(i === 0 ? { alt: 'Star Over Water' } : {}),
    path: `wiki/technology/Glyph_${String(i + 1)}_16.md`,
    revId: 1
  }))
};

beforeEach(() => {
  localStorage.clear();
  setGalaxiesForTests([{ n: 1, name: 'Euclid', type: 'Norm', path: 'wiki/galaxies/Euclid.md' }]);
  setFactsForTests({ schema: 1, facts: {}, glyphs: GLYPHS });
  setAppState(buildState({ systems: [{ id: 'sys-a', name: 'Ekwa Nexus', glyphs: '21A4F03A0E10' }] }));
});

afterEach(() => {
  act(closeSystemPanel);
});

test('System detail: each digit of the address with its glyph’s name, read out as names, credited to the wiki', () => {
  render(<SystemDetails />);
  const section = screen.getByRole('region', { name: 'Portal address' });
  expect(section.textContent).toContain('Portal order');
  // Screen readers hear the names in dialling order, not the digits.
  expect(screen.getByText(/^Portal order: Face, Bird, Voxel, Eclipse, Atlas, Sunset, /).textContent).toBe(
    'Portal order: Face, Bird, Voxel, Eclipse, Atlas, Sunset, Diplo, Voxel, Sunset, Tree, Bird, Sunset.'
  );
  const tiles = section.querySelectorAll('ol > li');
  expect(tiles).toHaveLength(12);
  expect(tiles[0]?.textContent).toBe('2Face');
  expect(tiles[5]?.getAttribute('title')).toBe('Sunset, also called Star Over Water');
  expect(screen.getByRole('link', { name: 'Glyph names from the No Man’s Sky wiki' }).getAttribute('href')).toBe(
    'wiki/#/a/wiki%2Fmechanics%2FGlyph.md'
  );
  // The copy button is still there.
  expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
});

test('System detail: no names until the wiki’s list loads, and none for a system without an address', () => {
  setFactsForTests({ schema: 1, facts: {} });
  const { unmount } = render(<SystemDetails />);
  expect(screen.queryByText('Portal order')).toBeNull();
  unmount();
  setFactsForTests({ schema: 1, facts: {}, glyphs: GLYPHS });
  setAppState(buildState({ systems: [{ id: 'sys-a', name: 'Ekwa Nexus' }] }));
  render(<SystemDetails />);
  expect(screen.queryByText('Portal order')).toBeNull();
});

test('System editor: names appear as the address is typed, so a slip shows before it’s whole', async () => {
  setAppState(buildState({ systems: [{ id: 'sys-a', name: 'Ekwa Nexus' }] }));
  render(<SystemPanel />);
  act(() => {
    openSystemEditor('sys-a');
  });
  expect(screen.queryByText('Portal order')).toBeNull();
  const field = screen.getByRole('textbox', { name: 'Portal address' });
  await userEvent.type(field, '112');
  expect(screen.getByText(/^Portal order:/).textContent).toBe('Portal order: Bird, Bird, Face.');
  await userEvent.type(field, '4 F03A 0E10');
  expect(screen.getByText(/^Portal order:/).textContent).toContain('Portal order: Bird, Bird, Face, Eclipse, Atlas,');
  expect(document.querySelectorAll('#systemPanel ol > li')).toHaveLength(12);
  // In the editor the credit is text: a link would leave the form.
  expect(screen.getByText('Glyph names from the No Man’s Sky wiki').tagName).toBe('SPAN');
});
