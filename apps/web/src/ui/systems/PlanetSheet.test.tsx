import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import type { FactsFile } from '@atlas/core/facts';
import { appState, setAppState } from '../../app/store.ts';
import { setFactsForTests } from '../gear/facts-store.ts';
import { SystemDetails } from './SystemDetails.tsx';
import { PlanetDetails } from './PlanetDetails.tsx';
import { PlanetSheet } from './PlanetSheet.tsx';
import { closePlanetSheet, getPlanetSheet } from './planet-sheet-store.ts';

let param = 'sys-a';
let section = 'system';
vi.mock('../shell/section-store.ts', () => ({
  showSection: vi.fn(),
  goBack: vi.fn(),
  useSectionParam: () => param,
  useSection: () => section
}));

const weather = (clear: string[], normal: string[], extreme: string[]) => ({ clear, normal, extreme, other: [] });
const fact = (biome: string, family: string) => ({
  page: `Biome - ${biome}`,
  path: 'p',
  url: 'u',
  revId: 1,
  quote: '…',
  value: { biome, family }
});
const FACTS: FactsFile = {
  schema: 1,
  facts: { 'biome-frozen': fact('Frozen', 'frozen'), 'biome-scorched': fact('Scorched', 'hot') },
  planets: {
    biomes: [
      {
        page: 'Biome - Barren',
        path: 'b',
        revId: 1,
        name: 'Barren',
        descriptors: ['Abandoned'],
        weather: weather([], [], [])
      },
      {
        page: 'Biome - Dead',
        path: 'd',
        revId: 1,
        name: 'Dead',
        descriptors: ['Abandoned'],
        weather: weather([], [], [])
      },
      {
        page: 'Biome - Frozen',
        path: 'wiki/world/Biome_-_Frozen.md',
        revId: 1,
        name: 'Frozen',
        descriptors: ['Frostbound'],
        weather: weather(['Icy'], ['Icy Blasts'], ['Deep Freeze']),
        resources: ['Dioxite', 'Frost Crystal', 'Radon']
      },
      {
        page: 'Biome - Scorched',
        path: 's',
        revId: 1,
        name: 'Scorched',
        descriptors: ['Scorched'],
        weather: weather([], [], ['Inferno Winds'])
      }
    ],
    sentinels: {
      page: 'Sentinel',
      path: 's',
      revId: 1,
      low: ['Few'],
      high: ['Attentive'],
      aggressive: ['Frenzied'],
      corrupted: ['Corrupted']
    },
    life: { page: 'Planet - Discovery Menu', path: 'p', revId: 1, flora: ['Uncommon'], fauna: ['Abundant'] },
    starMetals: { page: 'Star system', path: 's', revId: 1, metals: { yellow: ['Copper', 'Activated Copper'] } },
    deposits: [{ page: 'Silver', path: 's', revId: 1 }],
    finds: [{ page: 'Ancient Bones', path: 'a', revId: 1 }]
  },
  galaxyMap: {
    spectral: { page: 'Spectral class', path: 's', revId: 1, classes: { F: 'yellow' } },
    economy: {
      page: 'Economy',
      path: 'e',
      revId: 1,
      strength: { 1: ['Struggling'], 2: ['Balanced'], 3: ['Opulent'] },
      types: [{ page: 'Mining Economy', path: 'm', revId: 1, name: 'Mining', names: ['Prospecting', 'Mining'] }]
    }
  }
};

const HOGAW = {
  id: 'pl-h',
  name: 'Hogaw 24/K5',
  biome: 'Frozen',
  descriptor: 'Frostbound',
  body: 'planet',
  weather: 'Icy Blasts',
  abundance: 'Uncommon',
  fauna: 'Abundant',
  flora: 'Uncommon',
  sentinels: 'Few',
  temperature: -60.8,
  resources: ['Frost Crystal', 'Copper', 'Silver', 'Ancient Bones'],
  discoveredBy: 'Marco',
  discoveredOn: '2026-11-05',
  discoveredTime: '19:49',
  tags: ['farm'],
  notes: 'Frost Crystal fields north of the base.'
};

beforeEach(() => {
  localStorage.clear();
  param = 'sys-a';
  section = 'system';
  setFactsForTests(FACTS);
  setAppState(
    buildState({
      systems: [
        {
          id: 'sys-a',
          name: 'Masdalri Junction',
          star: 'yellow',
          spectralClass: 'F4',
          water: true,
          economy: 'Prospecting',
          economyStrength: 'Opulent',
          wealth: 3,
          planets: [
            HOGAW,
            {
              id: 'pl-l',
              name: 'Leforntow',
              biome: 'Scorched',
              descriptor: 'Scorched',
              body: 'moon',
              weather: 'Inferno Winds',
              sentinels: 'Frenzied'
            },
            { id: 'pl-g', name: 'Geor Beta', body: 'planet' },
            { id: 'pl-o', name: 'Old one', biome: 'Hot Moon', notes: 'typed in 3.25' }
          ]
        }
      ]
    })
  );
});

afterEach(() => {
  act(closePlanetSheet);
});

const planet = (id: string) => appState.systems[0]?.planets.find(item => item.id === id);

test('03b: the galaxy map’s pairs, and planet rows with one scan line and red only for the game’s danger', () => {
  render(<SystemDetails />);
  const cell = (label: string) =>
    [...document.querySelectorAll('dl > div')]
      .find(div => div.querySelector('dt')?.textContent === label)
      ?.querySelector('dd')?.textContent;
  expect(cell('Star')).toBe('YellowF4');
  expect(cell('On the map')).toBe('Water');
  expect(cell('Economy')).toBe('Prospecting // OpulentMining economy · ★★★3 of 3 strength');
  const hogaw = screen.getByRole('link', { name: /^Hogaw 24\/K5/ });
  expect(hogaw.textContent).toContain('Frostbound Planet · Icy Blasts · −60.8 °C');
  expect(hogaw.querySelector('.ph-warning')).toBeNull(); // Normal weather, Low sentinels: no pill
  const leforntow = screen.getByRole('link', { name: /^Leforntow/ });
  expect(leforntow.textContent).toContain('Extreme weather');
  expect(leforntow.textContent).toContain('Aggressive sentinels');
  expect(leforntow.querySelectorAll('.ph-warning')).toHaveLength(2);
  expect(screen.getByRole('link', { name: /^Geor Beta/ }).textContent).toContain('Planet · nothing logged yet');
});

test('35: a new planet in the scan’s order; the description sets the biome; resources are the wiki’s groups', async () => {
  render(
    <>
      <SystemDetails />
      <PlanetSheet />
    </>
  );
  await userEvent.click(screen.getByRole('button', { name: /^Add planet/ }));
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  expect(sheet.getByRole('heading', { name: 'Add a planet' })).toBeTruthy();
  expect(sheet.getByText('Nothing from the scan yet')).toBeTruthy();
  await userEvent.type(sheet.getByRole('textbox', { name: 'Name' }), 'Hogaw 24/K5');
  const box = (name: string) => sheet.getByRole('combobox', { name });
  await userEvent.type(box('Description'), 'Frostbound');
  expect((box('Biome') as HTMLInputElement).value).toBe('Frozen');
  expect(sheet.getByText(/is one of the/).textContent).toBe(
    'Frostbound is one of the Frozen biome’s names, so Biome is set to Frozen.'
  );
  expect(sheet.getByRole('link', { name: 'Frozen' }).getAttribute('href')).toBe(
    'wiki/#/a/wiki%2Fworld%2FBiome_-_Frozen.md'
  );
  await userEvent.click(sheet.getByRole('radio', { name: 'Planet' }));
  // The weather list opens on Frozen's words, each with its severity.
  await userEvent.click(box('Weather'));
  const list = sheet.getByRole('listbox', { name: 'Weather' });
  expect(within(list).getAllByRole('option')[1]?.textContent).toBe('Icy BlastsNormal');
  await userEvent.click(within(list).getByRole('option', { name: /Icy Blasts/ }));
  expect(sheet.getByText('Normal on the wiki’s Frozen weather table.')).toBeTruthy();
  await userEvent.type(box('Sentinels'), 'Few');
  expect(sheet.getByText('Few is a Low level on the wiki’s Sentinel page.')).toBeTruthy();
  // "Resources" in the scan is a level, not the list.
  await userEvent.type(box('Resources'), 'Uncommon');
  await userEvent.type(sheet.getByRole('textbox', { name: 'Temperature, °C' }), '−60.8');
  // What it lists: the biome's, the star's metal, deposits, finds, all from the wiki.
  expect(sheet.getByRole('group', { name: 'Frozen biome' })).toBeTruthy();
  expect(sheet.getByRole('group', { name: 'Yellow star' })).toBeTruthy();
  for (const name of ['Frost Crystal', 'Copper', 'Silver', 'Ancient Bones'])
    await userEvent.click(sheet.getByRole('button', { name }));
  expect(sheet.getByRole('button', { name: 'Copper' }).getAttribute('aria-pressed')).toBe('true');
  expect(sheet.getByText('4 picked')).toBeTruthy();
  await userEvent.click(sheet.getByRole('button', { name: 'Silver' })); // and off again
  await userEvent.type(box('Another resource'), 'Storm Crystal{Enter}');
  expect(sheet.getByRole('button', { name: 'Storm Crystal' }).getAttribute('aria-pressed')).toBe('true');
  await userEvent.type(sheet.getByRole('textbox', { name: 'Discovered by' }), 'Marco');
  await userEvent.type(sheet.getByLabelText('Discovered on'), '2026-11-05');
  await userEvent.type(sheet.getByLabelText('Discovered at'), '19:49');
  await userEvent.click(sheet.getByRole('button', { name: 'Add planet' }));
  expect(appState.systems[0]?.planets.at(-1)).toMatchObject({
    name: 'Hogaw 24/K5',
    descriptor: 'Frostbound',
    body: 'planet',
    biome: 'Frozen',
    weather: 'Icy Blasts',
    sentinels: 'Few',
    abundance: 'Uncommon',
    temperature: -60.8,
    resources: ['Frost Crystal', 'Copper', 'Ancient Bones', 'Storm Crystal'],
    discoveredBy: 'Marco',
    discoveredOn: '2026-11-05',
    discoveredTime: '19:49'
  });
  expect(getPlanetSheet().open).toBe(false);
});

test('35: an older planet keeps its words; a shared prefix leaves the biome to the player', async () => {
  section = 'planet';
  param = 'sys-a/pl-o';
  render(
    <>
      <PlanetDetails />
      <PlanetSheet />
    </>
  );
  await userEvent.click(screen.getByRole('button', { name: 'Edit planet' }));
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  const box = (name: string) => sheet.getByRole<HTMLInputElement>('combobox', { name });
  expect(box('Biome').value).toBe('Hot Moon');
  await userEvent.type(box('Description'), 'Frostbound');
  expect(box('Biome').value).toBe('Hot Moon'); // a typed word is never replaced
  await userEvent.clear(box('Description'));
  await userEvent.type(box('Description'), 'Abandoned');
  expect(sheet.getByText('Used by Barren, Dead: pick the biome below.')).toBeTruthy();
  await userEvent.click(sheet.getByRole('button', { name: 'Cancel' }));
  expect(planet('pl-o')).toMatchObject({ biome: 'Hot Moon', descriptor: '', notes: 'typed in 3.25' });
});

test('36: a planet’s own view, in the game’s order, each resource with why it can be there', async () => {
  section = 'planet';
  param = 'sys-a/pl-h';
  render(
    <>
      <PlanetDetails />
      <PlanetSheet />
    </>
  );
  expect(screen.getByRole('heading', { level: 1, name: 'Hogaw 24/K5' })).toBeTruthy();
  expect(document.querySelector('header')?.textContent).toContain('Frozen biome');
  expect(screen.getByText('Frostbound Planet')).toBeTruthy();
  const scan = screen.getByRole('region', { name: 'The scan' });
  expect([...scan.querySelectorAll('dt')].map(dt => dt.textContent)).toEqual([
    'Weather',
    'Resources',
    'Fauna',
    'Flora',
    'Sentinels',
    'Temperature'
  ]);
  expect(scan.textContent).toContain('Icy BlastsNormal');
  expect(scan.textContent).toContain('−60.8 °C');
  const resources = screen.getByRole('region', { name: 'Resources · 4' });
  expect([...resources.querySelectorAll('li')].map(li => li.textContent)).toEqual([
    'Frost CrystalFrozen biome',
    'Copperyellow star',
    'Silverdeposit',
    'Ancient Bonesfind'
  ]);
  expect(screen.getByRole('region', { name: 'Discovery' }).textContent).toMatch(/Marco.*2026 · 19:49/);
  expect(screen.queryByText(/Not logged yet/)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Edit planet' }));
  expect(getPlanetSheet()).toMatchObject({ open: true, systemId: 'sys-a', planetId: 'pl-h' });
});

test('36b and 36c: only what’s logged shows; a planet with nothing scanned offers to fill it in', async () => {
  section = 'planet';
  param = 'sys-a/pl-l';
  const { unmount } = render(<PlanetDetails />);
  const scan = screen.getByRole('region', { name: 'The scan' });
  expect([...scan.querySelectorAll('dt')].map(dt => dt.textContent)).toEqual(['Weather', 'Sentinels']);
  expect(scan.textContent).toContain('Extreme');
  expect(
    screen.getByText('Not logged yet: resources level, fauna, flora, temperature, what it lists, discovery.')
  ).toBeTruthy();
  unmount();

  param = 'sys-a/pl-g';
  render(<PlanetDetails />);
  expect(screen.getByText('Not scanned yet')).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Nothing scanned yet' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Fill in from the scan' }));
  expect(getPlanetSheet()).toMatchObject({ open: true, planetId: 'pl-g' });
});

test('deleting a planet from its own view takes two taps and leaves for its system', async () => {
  section = 'planet';
  param = 'sys-a/pl-g';
  const replace = vi.spyOn(location, 'replace').mockImplementation(() => {});
  render(
    <>
      <PlanetDetails />
      <PlanetSheet />
    </>
  );
  await userEvent.click(screen.getByRole('button', { name: 'Edit planet' }));
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  await userEvent.click(sheet.getByRole('button', { name: 'Delete planet' }));
  expect(planet('pl-g')).toBeTruthy();
  await userEvent.click(sheet.getByRole('button', { name: 'Tap again to delete' }));
  expect(planet('pl-g')).toBeUndefined();
  expect(replace).toHaveBeenCalledWith('#system/sys-a');
  replace.mockRestore();
});
