import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { buildState } from '@atlas/core/state';
import type { GlyphTable } from '@atlas/core/glyphs';
import { appState, setAppState } from '../../app/store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { SystemDetails } from '../systems/SystemDetails.tsx';
import { SystemPanel } from '../systems/SystemPanel.tsx';
import { PlanetSheet } from '../systems/PlanetSheet.tsx';
import { setGalaxiesForTests } from '../systems/galaxies-store.ts';
import { closeSystemPanel, getPanel, openSystemEditor } from '../systems/panel-store.ts';
import { closePlanetSheet, openPlanetSheet } from '../systems/planet-sheet-store.ts';
import { AddressEditor } from './glyph-parts.tsx';
import { MyGlyphs } from './MyGlyphs.tsx';
import { Dialling } from './Dialling.tsx';

let param = 'sys-a';
vi.mock('../shell/section-store.ts', () => ({
  showSection: vi.fn(),
  goBack: vi.fn(),
  useSectionParam: () => param,
  useSection: () => 'system'
}));

const NAMES: [string, string?][] = [
  ['Sunset', 'Star Over Water'],
  ['Bird', 'Hunter'],
  ['Face', 'Reflection'],
  ['Diplo', 'Ancient Giant'],
  ['Eclipse', 'Obscured Companion'],
  ['Balloon', 'Ascending Orb'],
  ['Boat', 'Sailor'],
  ['Bug', 'Lowly Insect'],
  ['Dragonfly'],
  ['Galaxy', 'Spiral of Reality'],
  ['Voxel', 'Anomaly'],
  ['Fish', 'Ocean King'],
  ['Tent'],
  ['Rocket', 'Vessel to Beyond'],
  ['Tree'],
  ['Atlas']
];
const GLYPHS: GlyphTable = {
  page: 'Glyph',
  path: 'wiki/mechanics/Glyph.md',
  glyphs: NAMES.map(([name, alt], i) => ({
    digit: i.toString(16).toUpperCase(),
    name,
    ...(alt ? { alt } : {}),
    path: `wiki/technology/Glyph_${String(i + 1)}_16.md`,
    revId: 1
  }))
};

beforeEach(() => {
  localStorage.clear();
  param = 'sys-a';
  setGalaxiesForTests([{ n: 1, name: 'Euclid', type: 'Norm', path: 'wiki/galaxies/Euclid.md' }]);
  setFactsForTests({ schema: 1, facts: {}, glyphs: GLYPHS });
  setAppState(
    buildState({
      systems: [
        {
          id: 'sys-a',
          name: 'Masdalri Junction',
          glyphs: '21A4F03A0E10',
          planetCount: 5,
          planets: [
            { id: 'pl-h', name: 'Hogaw 24/K5', portalGlyph: '2' },
            { id: 'pl-g', name: 'Geor Beta' }
          ]
        },
        {
          id: 'sys-b',
          name: 'Booster Only',
          glyphs: '00380256EC6B',
          planetGlyphUnknown: true,
          planets: [{ id: 'pl-x', name: 'Ixa' }]
        },
        { id: 'sys-c', name: 'No Address', planets: [{ id: 'pl-n', name: 'Nub' }] }
      ]
    })
  );
});

afterEach(() => {
  act(() => {
    closeSystemPanel();
    closePlanetSheet();
  });
  document.body.innerHTML = '';
});

function Editor({ start = '' }: { start?: string }) {
  const [slots, setSlots] = useState(() => Array.from({ length: 12 }, (_, i) => start[i] ?? ''));
  return (
    <>
      <AddressEditor slots={slots} onChange={setSlots} table={GLYPHS} />
      <output data-testid="address">{slots.map(digit => digit || '_').join('')}</output>
    </>
  );
}
const address = () => screen.getByTestId('address').textContent;

test('c16: a tap fills the lit slot, a filled slot is chosen to replace, Backspace removes the last; names, never digits', async () => {
  render(<Editor />);
  const pad = screen.getByRole('group', { name: 'Glyphs' });
  // Each tile reads its names; its wiki link is its own target, never inside the button.
  const face = within(pad).getByRole('button', { name: /^Add Face\b/ });
  const link = within(pad).getByRole('link', { name: 'Face on the wiki (opens a new tab)' });
  expect(link.getAttribute('href')).toBe('https://nomanssky.fandom.com/wiki/Glyph_3_%2F_16');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(face.contains(link)).toBe(false);
  expect(within(pad).getAllByRole('button')).toHaveLength(16);

  await userEvent.click(face);
  await userEvent.click(within(pad).getByRole('button', { name: /^Add Bird\b/ }));
  expect(address()).toBe('21__________');
  expect(screen.getByRole('group', { name: 'Portal address, 2 of 12' })).toBeTruthy();
  expect(screen.getByText('Bird added, 2 of 12')).toBeTruthy(); // the live region
  // Slot 1 chosen, the next tap replaces it.
  await userEvent.click(screen.getByRole('button', { name: /^Glyph 1: Face\b/ }));
  await userEvent.click(within(pad).getByRole('button', { name: /^Add Tent\b/ }));
  expect(address()).toBe('C1__________');
  await userEvent.click(screen.getByRole('button', { name: 'Delete last glyph' }));
  expect(address()).toBe('C___________');
  // At a desk: 0–9 and A–F add glyphs.
  fireEvent.keyDown(face, { key: 'a' });
  expect(address()).toBe('CA__________');
});

test('c16: a full address says so; one the wiki says can’t exist names the glyphs to check', () => {
  const { unmount } = render(<Editor start="21A4F03A0E10" />);
  expect(screen.getByText(/A full address\. It reads as Face, Bird, Voxel/)).toBeTruthy();
  unmount();
  render(<Editor start="11A4803A0E10" />);
  expect(screen.getByText(/Glyphs 5 and 6 read/).textContent).toContain('80');
  expect(screen.getByText(/Glyphs 5 and 6 read/).textContent).toContain('Dragonfly, Sunset');
});

test('06e and 06g: names, second names or digits typed in any mix fill the slots', async () => {
  param = 'sys-c';
  render(<SystemPanel />);
  act(() => {
    openSystemEditor('sys-c');
  });
  await userEvent.click(screen.getByRole('button', { name: 'Type or paste instead' }));
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Type glyph names or digits' }),
    'face hunter voxel 4 pigeon'
  );
  expect(screen.getByText(/Not a glyph: “pigeon”/)).toBeTruthy();
  expect(screen.getByRole('group', { name: 'Portal address, 4 of 12' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Back to the glyph pad' }));
  expect(screen.getByRole('button', { name: /^Glyph 1: Face\b/ })).toBeTruthy();
});

test('03c: the address as names in its parts; glyph 1 names its planet; copy as hex and as names; Dial', async () => {
  const writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  render(<SystemDetails />);
  const section = within(screen.getByRole('region', { name: 'Portal address' }));
  // Screen readers hear the names in dialling order.
  expect(
    section.getByText('Face, Bird, Voxel, Eclipse, Atlas, Sunset, Diplo, Voxel, Sunset, Tree, Bird, Sunset')
  ).toBeTruthy();
  const goes = section.getByRole('link', { name: /takes you to planet 2/ });
  expect(goes.textContent).toBe('Glyph 1, Face, takes you to planet 2: Hogaw 24/K5');
  expect(goes.getAttribute('href')).toBe('#planet/sys-a/pl-h');
  // Nothing about glyphs to find until the player uses My glyphs.
  expect(section.queryByText(/You need/)).toBeNull();
  await userEvent.click(section.getByRole('button', { name: 'Copy as names' }));
  expect(writeText).toHaveBeenLastCalledWith(
    'Face Bird Voxel Eclipse Atlas Sunset Diplo Voxel Sunset Tree Bird Sunset'
  );
  await userEvent.click(section.getByRole('button', { name: 'Copy as hex' }));
  expect(writeText).toHaveBeenLastCalledWith('21A4F03A0E10');
  expect(section.getByRole('link', { name: 'Dial at a portal' }).getAttribute('href')).toBe('#dial/sys-a');
});

test('03c: My glyphs says what an address still needs, and only says it', () => {
  appState.myGlyphs = ['0', '2', '3', '4', 'E', 'F'];
  render(<SystemDetails />);
  expect(screen.getByText(/You need/).textContent).toBe('You need Bird and Voxel to dial this. My glyphs');
  appState.myGlyphs = [];
});

test('a Signal Booster’s address: planet not known, never guessed', () => {
  param = 'sys-b';
  render(<SystemDetails />);
  const section = within(screen.getByRole('region', { name: 'Portal address' }));
  expect(section.getByText(/^planet not known, Sunset, Diplo/)).toBeTruthy();
  expect(section.getByText('Planet not known.')).toBeTruthy();
  expect(section.queryByText(/takes you to planet/)).toBeNull();
});

test('35c: a planet’s portal glyph; on a Signal Booster’s system the “?” fills itself', async () => {
  render(<PlanetSheet />);
  act(() => {
    openPlanetSheet('sys-b', 'pl-x');
  });
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  await userEvent.click(sheet.getByRole('button', { name: /^Use Face\b/ }));
  expect(sheet.getByRole('button', { name: /^Face\b/ }).getAttribute('aria-pressed')).toBe('true');
  await userEvent.click(sheet.getByRole('button', { name: 'Save body' }));
  const system = appState.systems.find(item => item.id === 'sys-b');
  expect(system?.planets[0]?.portalGlyph).toBe('2');
  expect(system).toMatchObject({ glyphs: '20380256EC6B', planetGlyphUnknown: false });
});

test('35c: a system without an address takes all 12 read on its planet', async () => {
  render(<PlanetSheet />);
  act(() => {
    openPlanetSheet('sys-c', 'pl-n');
  });
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  const pad = within(sheet.getByRole('group', { name: 'Glyphs' }));
  for (const digit of '21A4F03A0E10') {
    const name = NAMES[parseInt(digit, 16)] ?? ['?'];
    await userEvent.click(pad.getByRole('button', { name: new RegExp(`^Add ${name[0]}\\b`) }));
  }
  await userEvent.click(sheet.getByRole('button', { name: 'Save body' }));
  const system = appState.systems.find(item => item.id === 'sys-c');
  expect(system?.glyphs).toBe('21A4F03A0E10');
  expect(system?.planets[0]?.portalGlyph).toBe('2');
});

test('38 and 38b: none yet says where glyphs come from; each switch marks one; I have all 16', async () => {
  render(<MyGlyphs />);
  expect(screen.getByText('None yet.')).toBeTruthy();
  await userEvent.click(screen.getByRole('switch', { name: 'Bird found' }));
  expect(appState.myGlyphs).toEqual(['1']);
  expect(screen.getByRole('switch', { name: 'Bird found' }).getAttribute('aria-checked')).toBe('true');
  await userEvent.click(screen.getByRole('button', { name: 'I have all 16' }));
  expect(appState.myGlyphs).toHaveLength(16);
  expect(screen.queryByRole('button', { name: 'I have all 16' })).toBeNull();
});

test('39 and 39b: one glyph at a time, by name; a glyph not marked found gets a note, never a block', async () => {
  appState.myGlyphs = ['2'];
  render(<Dialling />);
  expect(screen.getByText('Dialling Masdalri Junction · planet 2')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Glyph 1 of 12' })).toBeTruthy();
  expect(screen.getByText('Face')).toBeTruthy();
  expect(screen.queryByText(/You haven’t marked/)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Next: Bird' }));
  expect(screen.getByRole('img', { name: 'Glyph 2 of 12' })).toBeTruthy();
  expect(screen.getByText(/You haven’t marked/).textContent).toContain('Bird');
  expect(screen.getByRole('link', { name: 'See Bird on the wiki' }).getAttribute('href')).toBe(
    'https://nomanssky.fandom.com/wiki/Glyph_2_%2F_16'
  );
  await userEvent.click(screen.getByRole('button', { name: 'Back to Face' }));
  expect(screen.getByRole('img', { name: 'Glyph 1 of 12' })).toBeTruthy();
  appState.myGlyphs = [];
});

test('01b: a new system logged without its address offers to add it', async () => {
  document.body.insertAdjacentHTML(
    'beforeend',
    '<div id="toastBanner" class="hidden"><span id="toastMessage"></span><span id="toastDetail"></span><button id="toastAction"></button></div>'
  );
  render(<SystemPanel />);
  act(() => {
    openSystemEditor(null);
  });
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Fresh Find');
  await userEvent.click(screen.getByRole('button', { name: /^Add system\b/ }));
  expect(document.getElementById('toastMessage')?.textContent).toBe('System logged');
  expect(document.getElementById('toastDetail')?.textContent).toBe('Fresh Find');
  await userEvent.click(screen.getByRole('button', { name: 'Add its address' }));
  const added = appState.systems.find(item => item.name === 'Fresh Find');
  expect(getPanel()).toMatchObject({ open: true, mode: 'edit', systemId: added?.id, preset: { way: 'photo' } });
});
