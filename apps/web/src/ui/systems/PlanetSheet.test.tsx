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
import { closePlanetSheet, getPlanetSheet, openPlanetSheet } from './planet-sheet-store.ts';
import { setWide } from '../test-media.ts';

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
  facts: {
    'biome-frozen': fact('Frozen', 'frozen'),
    'biome-scorched': fact('Scorched', 'hot'),
    'hazard-readings': {
      page: 'Heads-Up Display',
      path: 'h',
      url: 'u',
      revId: 1,
      quote: 'q',
      value: [
        { name: 'Temperature', unit: '°C' },
        { name: 'Radiation', unit: 'Rad' },
        { name: 'Toxicity', unit: 'Tox' }
      ]
    }
  },
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
  setWide(false); // the phone's screens; the Workbench's planet (d16) is tested on its own
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
  vi.restoreAllMocks();
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
  await userEvent.click(screen.getByRole('button', { name: /^Add body/ }));
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  expect(sheet.getByRole('heading', { name: 'Add a body' })).toBeTruthy();
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
  await userEvent.click(sheet.getByRole('button', { name: 'Add body' }));
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
  await userEvent.click(screen.getByRole('button', { name: 'Edit body' }));
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  const box = (name: string) => sheet.getByRole<HTMLInputElement>('combobox', { name });
  expect(box('Biome').value).toBe('Hot Moon');
  await userEvent.type(box('Description'), 'Frostbound');
  expect(box('Biome').value).toBe('Hot Moon'); // a typed word is never replaced
  await userEvent.clear(box('Description'));
  await userEvent.type(box('Description'), 'Abandoned');
  // A name several biomes use asks right under Description (35e), with the biome to pick as buttons.
  const which = sheet.getByRole('radiogroup', { name: 'Which biome is this Abandoned world?' });
  expect(within(which).getByText('Abandoned names two kinds of world on the wiki.')).toBeTruthy();
  expect(
    within(which)
      .getAllByRole('radio')
      .map(radio => radio.textContent)
  ).toEqual(['Barren', 'Dead']);
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
  await userEvent.click(screen.getByRole('button', { name: 'Edit body' }));
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
  await userEvent.click(screen.getByRole('button', { name: 'Edit body' }));
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  await userEvent.click(sheet.getByRole('button', { name: 'Delete body' }));
  expect(planet('pl-g')).toBeTruthy();
  await userEvent.click(sheet.getByRole('button', { name: 'Tap again to delete' }));
  expect(planet('pl-g')).toBeUndefined();
  expect(replace).toHaveBeenCalledWith('#system/sys-a');
  replace.mockRestore();
});

test('37: from lg a planet row opens the panel beside System detail, and the row says Editing', async () => {
  const wide = vi.spyOn(window, 'matchMedia').mockImplementation(
    query =>
      ({
        matches: query === '(min-width: 1024px)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {}
      }) as unknown as MediaQueryList // only `matches` is read on a click
  );
  render(
    <>
      <SystemDetails />
      <PlanetSheet />
    </>
  );
  const row = screen.getByRole('link', { name: /^Hogaw 24\/K5/ });
  await userEvent.click(row);
  expect(getPlanetSheet()).toMatchObject({ open: true, systemId: 'sys-a', planetId: 'pl-h' });
  expect(screen.getByRole('link', { name: /^Hogaw 24\/K5/ }).textContent).toContain('Editing');
  expect(location.hash).not.toContain('#planet/'); // the panel opened; the page stayed on System detail
  wide.mockRestore();
});

test('a moon can be tied to a planet of its system; its view names that planet; a planet again unties it', async () => {
  render(<PlanetSheet />);
  act(() => {
    openPlanetSheet('sys-a', 'pl-l');
  });
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  const orbits = sheet.getByRole<HTMLSelectElement>('combobox', { name: 'Orbits' });
  // The system's other planets, never a moon or the moon itself.
  expect([...orbits.options].map(option => option.textContent)).toEqual([
    'Not set',
    'Hogaw 24/K5',
    'Geor Beta',
    'Old one'
  ]);
  await userEvent.selectOptions(orbits, 'Hogaw 24/K5');
  await userEvent.click(sheet.getByRole('button', { name: 'Save body' }));
  expect(planet('pl-l')?.orbits).toBe('pl-h');
  expect(planet('pl-l')?.weather).toBe('Inferno Winds'); // the rest of the moon is as it was

  section = 'planet';
  param = 'sys-a/pl-l';
  const view = render(<PlanetDetails />);
  expect(screen.getByRole('link', { name: 'Hogaw 24/K5' }).getAttribute('href')).toBe('#planet/sys-a/pl-h');
  view.unmount();

  act(() => {
    openPlanetSheet('sys-a', 'pl-l');
  });
  await userEvent.click(sheet.getByRole('radio', { name: 'Planet' }));
  expect(sheet.queryByRole('combobox', { name: 'Orbits' })).toBeNull();
  await userEvent.click(sheet.getByRole('button', { name: 'Save body' }));
  expect(planet('pl-l')?.orbits).toBe('');
});

test('Discovered by: Me fills in your game account; without one, it says where to add it', async () => {
  render(<PlanetSheet />);
  act(() => {
    openPlanetSheet('sys-a', 'pl-g');
  });
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  expect(sheet.getByText(/Add the names you play under in Settings/)).toBeTruthy();
  act(() => {
    closePlanetSheet();
    appState.accounts = ['marck94'];
    openPlanetSheet('sys-a', 'pl-g');
  });
  await userEvent.click(sheet.getByRole('button', { name: 'Me (marck94)' }));
  expect(sheet.getByRole<HTMLInputElement>('textbox', { name: 'Discovered by' }).value).toBe('marck94');
  await userEvent.click(sheet.getByRole('button', { name: 'Save body' }));
  expect(planet('pl-g')?.discoveredBy).toBe('marck94');
  appState.accounts = [];
});

test('a moon tied to its planet sits inside that planet’s row in System detail', () => {
  const moon = planet('pl-l');
  if (moon) moon.orbits = 'pl-h';
  render(<SystemDetails />);
  const moons = screen.getByRole('list', { name: 'Moons of Hogaw 24/K5' });
  expect(within(moons).getByRole('link', { name: /^Leforntow/ })).toBeTruthy();
  expect(moons.closest('li')?.querySelector('a')?.textContent).toContain('Hogaw 24/K5');
  if (moon) moon.orbits = '';
});

test('the hazard reading: Temperature, Radiation or Toxicity from the wiki, each in its unit; ± for below zero', async () => {
  render(<PlanetSheet />);
  act(() => {
    openPlanetSheet('sys-a', 'pl-g');
  });
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  const hazard = sheet.getByRole('radiogroup', { name: 'Hazard' });
  expect(within(hazard).getByRole('radio', { name: 'Temperature' }).getAttribute('aria-checked')).toBe('true');
  await userEvent.type(sheet.getByRole('textbox', { name: 'Temperature, °C' }), '60.8');
  await userEvent.click(sheet.getByRole('button', { name: 'Below zero' }));
  expect(sheet.getByRole<HTMLInputElement>('textbox', { name: 'Temperature, °C' }).value).toBe('−60.8');
  await userEvent.click(sheet.getByRole('button', { name: 'Save body' }));
  expect(planet('pl-g')).toMatchObject({ temperature: -60.8, hazard: '' });

  act(() => {
    openPlanetSheet('sys-a', 'pl-g');
  });
  await userEvent.click(
    within(sheet.getByRole('radiogroup', { name: 'Hazard' })).getByRole('radio', { name: 'Radiation' })
  );
  expect(sheet.queryByRole('button', { name: 'Below zero' })).toBeNull(); // radiation is never below zero
  const rad = sheet.getByRole<HTMLInputElement>('textbox', { name: 'Radiation, Rad' });
  await userEvent.clear(rad);
  await userEvent.type(rad, '4,2');
  await userEvent.click(sheet.getByRole('button', { name: 'Save body' }));
  expect(planet('pl-g')).toMatchObject({ temperature: 4.2, hazard: 'radiation' });

  section = 'planet';
  param = 'sys-a/pl-g';
  render(<PlanetDetails />);
  const scan = screen.getByRole('region', { name: 'The scan' });
  expect(scan.textContent).toContain('Radiation4.2 Rad');
});

test('d16: on the Workbench a planet has a breadcrumb, the bodies either side, Edit, and three columns', async () => {
  setWide(true);
  section = 'planet';
  param = 'sys-a/pl-l';
  render(<PlanetDetails />);
  const nav = screen.getByRole('navigation', { name: 'Planet' });
  expect(within(nav).getByRole('link', { name: 'Masdalri Junction' }).getAttribute('href')).toMatch(/^#system\//);
  const prev = within(nav).queryByRole('link', { name: /^Previous body/ });
  const next = within(nav).queryByRole('link', { name: /^Next body/ });
  expect(prev?.getAttribute('href')).toBe('#planet/sys-a/pl-h');
  expect(next?.getAttribute('href')).toBe('#planet/sys-a/pl-g');
  expect(screen.getByRole('region', { name: 'The scan' })).toBeTruthy();
  await userEvent.click(within(nav).getByRole('button', { name: 'Edit body' }));
  expect(getPlanetSheet()).toMatchObject({ open: true, systemId: 'sys-a', planetId: 'pl-l' });
});

const INFESTED_FACTS: FactsFile = {
  ...FACTS,
  planets: {
    ...FACTS.planets!,
    infested: {
      page: 'Biome Subtype - Infested',
      path: 'wiki/world/Biome_Subtype_-_Infested.md',
      revId: 1,
      sets: [
        { biome: 'Frozen', names: ['Infested', 'Icy Abhorrence'] },
        { biome: 'Scorched', names: ['Infested', 'Fiery Dreadworld'] }
      ],
      alone: ['Icy Abhorrence', 'Fiery Dreadworld'],
      flora: ['Twisted', 'Screaming']
    },
    detected: [
      { page: 'They Who Returned', path: 'wiki/missions/They_Who_Returned.md', revId: 1, label: 'Dissonance Detected' },
      { page: 'Vile Brood', path: 'wiki/mechanics/Vile_Brood.md', revId: 1, label: 'Vile Brood Detected' }
    ]
  }
};

test('35d: an Infested name sets its biome, never Planet or Moon; Infested flora first; Vile Brood is a switch', async () => {
  setFactsForTests(INFESTED_FACTS);
  render(
    <>
      <SystemDetails />
      <PlanetSheet />
    </>
  );
  await userEvent.click(screen.getByRole('button', { name: /^Add body/ }));
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  await userEvent.type(sheet.getByRole('textbox', { name: 'Name' }), 'Veyl IV');
  const box = (name: string) => sheet.getByRole<HTMLInputElement>('combobox', { name });
  await userEvent.type(box('Description'), 'Icy Abhorrence');
  expect(box('Biome').value).toBe('Frozen');
  expect(sheet.getByText(/world’s name/).textContent).toBe(
    'Icy Abhorrence is an Infested Frozen world’s name, so Biome is set to Frozen. It takes no “Planet” or “Moon”, so that choice stays yours.'
  );
  expect(sheet.getByRole('link', { name: 'Infested' }).getAttribute('href')).toBe(
    'wiki/#/a/wiki%2Fworld%2FBiome_Subtype_-_Infested.md'
  );
  // The Planet/Moon choice stays the player's: nothing picked it.
  expect(sheet.getAllByRole('radio', { checked: true }).map(radio => radio.textContent)).not.toContain('Planet');
  // Flora offers the Infested page's words first.
  await userEvent.click(box('Flora'));
  expect(sheet.getByText('Infested flora · wiki')).toBeTruthy();
  // Vile Brood isn't a resource chip: it's a switch, as the discovery menu shows it.
  expect(sheet.queryByRole('button', { name: /Vile Brood/ })).toBeNull();
  const brood = sheet.getByRole('switch', { name: 'Vile Brood Detected' });
  expect(brood.getAttribute('aria-checked')).toBe('false');
  await userEvent.click(brood);
  await userEvent.click(sheet.getByRole('button', { name: 'Add body' }));
  const saved = appState.systems[0]?.planets.find(item => item.name === 'Veyl IV');
  expect(saved).toMatchObject({
    descriptor: 'Icy Abhorrence',
    biome: 'Frozen',
    body: '',
    detected: ['Vile Brood Detected']
  });
  expect(saved?.resources).not.toContain('Vile Brood Detected');
});

test('35e: "Infested" asks which biome right under Description, the biome already set pre-picked', async () => {
  setFactsForTests(INFESTED_FACTS);
  render(
    <>
      <SystemDetails />
      <PlanetSheet />
    </>
  );
  await userEvent.click(screen.getByRole('button', { name: /^Add body/ }));
  const sheet = within(document.getElementById('planetSheet') as HTMLElement);
  const box = (name: string) => sheet.getByRole<HTMLInputElement>('combobox', { name });
  await userEvent.type(box('Biome'), 'Frozen');
  await userEvent.type(box('Description'), 'Infested');
  const which = sheet.getByRole('radiogroup', { name: 'Which biome is this Infested world?' });
  expect(within(which).getByText('Infested on which biome? The wiki uses this name for two.')).toBeTruthy();
  expect(within(which).getByRole('radio', { name: 'Frozen' }).getAttribute('aria-checked')).toBe('true');
  expect(within(which).getByText('Frozen was already set, so it’s picked. Biome follows this choice.')).toBeTruthy();
  await userEvent.click(within(which).getByRole('radio', { name: 'Scorched' }));
  expect(box('Biome').value).toBe('Scorched');
});

test('36d: an Infested world’s view says so, and an older log’s "Vile Brood Detected" resource reads as its own line', () => {
  setFactsForTests(INFESTED_FACTS);
  section = 'planet';
  param = 'sys-a/pl-h';
  const hogaw = appState.systems[0]?.planets.find(item => item.id === 'pl-h');
  Object.assign(hogaw ?? {}, {
    descriptor: 'Icy Abhorrence',
    body: 'planet',
    flora: 'Twisted',
    resources: [...(hogaw?.resources ?? []), 'Vile Brood Detected']
  });
  render(<PlanetDetails />);
  expect(screen.getByRole('link', { name: 'Infested' }).parentElement?.textContent).toBe('Infested · Frozen biome');
  // A stand-alone name shows alone, as the game does: no "Planet" after it.
  expect(screen.getByText('Icy Abhorrence')).toBeTruthy();
  expect(screen.queryByText('Icy Abhorrence Planet')).toBeNull();
  // The discovery menu's line closes The scan; it's no longer counted among the resources.
  const scan = within(screen.getByRole('region', { name: 'The scan' }));
  expect(scan.getByText('Vile Brood Detected')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Resources · 4' })).toBeTruthy();
  // Typed as a resource by an earlier version: still there, as typed.
  expect(appState.systems[0]?.planets.find(item => item.id === 'pl-h')?.resources).toContain('Vile Brood Detected');
});

test('36d: a dissonant planet’s typed "Dissonance Detected" reads as its own line, as Vile Brood does, and stays typed', () => {
  setFactsForTests(INFESTED_FACTS);
  section = 'planet';
  param = 'sys-a/pl-h';
  const hogaw = appState.systems[0]?.planets.find(item => item.id === 'pl-h');
  const before = hogaw?.resources.length ?? 0;
  Object.assign(hogaw ?? {}, { resources: [...(hogaw?.resources ?? []), 'Dissonance Detected'] });
  render(<PlanetDetails />);
  const scan = within(screen.getByRole('region', { name: 'The scan' }));
  expect(scan.getByText('Dissonance Detected')).toBeTruthy();
  expect(scan.getByText(/Corrupted Sentinels here/)).toBeTruthy();
  expect(screen.getByRole('heading', { name: `Resources · ${String(before)}` })).toBeTruthy();
  expect(appState.systems[0]?.planets.find(item => item.id === 'pl-h')?.resources).toContain('Dissonance Detected');
});
