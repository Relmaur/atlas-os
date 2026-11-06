import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildState } from '@atlas/core/state';
import { appState, setAppState } from '../../app/store.ts';
import { closeEditor } from '../parts/editor-store.ts';
import { PlayerEditors } from '../PlayerEditors.tsx';
import { Gear } from './Gear.tsx';
import { ShipDetail } from './ShipDetail.tsx';
import { setFactsForTests } from './facts-store.ts';
import { setWide } from '../test-media.ts';

let param = '';
vi.mock('../shell/section-store.ts', () => ({
  showSection: vi.fn(),
  goBack: vi.fn(),
  useSection: () => 'gear',
  useSectionParam: () => param
}));

const cite = (page: string, value: unknown) => ({
  page,
  path: `wiki/mechanics/${page.replace(/ /g, '_')}.md`,
  url: `https://example.invalid/${page}`,
  revId: 1,
  quote: '…',
  value
});
const FACTS = {
  schema: 1 as const,
  facts: {
    'supercharged-per-class': cite('Supercharged Slot', { C: 1, B: 2, A: 3, S: 4 }),
    'supercharged-fixed-count': cite('Supercharged Slot', 3),
    'exosuit-supercharged-slots': cite('Exosuit', ['R1C5', 'R2C9', 'R3C3']),
    'multitool-tech-max': cite('Inventory', { columns: 10, slots: { C: 30, B: 30, A: 45, S: 60 } }),
    'starship-tech-max': cite('Inventory', { columns: 10, slots: { S: 60 } }),
    'exosuit-tech-max': cite('Inventory', { columns: 10, slots: { any: 60 } })
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  setWide(false); // the phone's Fleet (designs 08, 09); the Workbench's (d09) is tested at the end
  localStorage.clear();
  setFactsForTests(FACTS);
  act(() => {
    closeEditor();
    setAppState(buildState());
  });
});

const fleet = () =>
  render(
    <>
      <Gear />
      <PlayerEditors />
    </>
  );
const cell = (row: number, col: number) =>
  screen.getByRole('button', { name: new RegExp(`^Row ${String(row)}, column ${String(col)}(:|$)`) });
const picker = () => screen.getByRole('group', { name: 'Technology grid · tap slots to mark supercharged' });

test('a new player adds their ship from Fleet: tap to mark and select, say what sits there, tap again to unmark', async () => {
  fleet();
  expect(screen.getByText(/No ships or Multi-Tools yet/)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Add gear' }));
  expect(screen.getByRole('heading', { name: 'Add to your fleet' })).toBeTruthy();
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Kestrel');
  await userEvent.type(screen.getByRole('combobox', { name: 'Role' }), 'Flagship');
  await userEvent.click(screen.getByRole('radio', { name: 'S-class' }));
  expect(within(picker()).getAllByRole('button')).toHaveLength(60); // an S-class ship: 10 × 6
  await userEvent.click(cell(2, 3));
  await userEvent.type(screen.getByRole('textbox', { name: 'Module in this slot' }), 'Infra-Knife Accelerator');
  await userEvent.click(cell(2, 2));
  await userEvent.click(cell(1, 9));
  await userEvent.click(cell(1, 9)); // selected and tapped again: unmarked
  expect(cell(2, 3).getAttribute('aria-pressed')).toBe('true');
  expect(cell(2, 3).textContent).toBe('Infra');
  expect(cell(1, 9).getAttribute('aria-pressed')).toBe('false');
  expect(document.getElementById('slotRules')?.textContent).toContain('The wiki: S-class has 4, grid up to 10 × 6');
  await userEvent.click(screen.getByRole('button', { name: 'Add to fleet' }));
  expect(appState.gear).toMatchObject([
    {
      name: 'Kestrel',
      class: 'S',
      role: 'Flagship',
      superchargedSlots: ['R2C2', 'R2C3'],
      slotLabels: { R2C3: 'Infra-Knife Accelerator' }
    }
  ]);
  const card = document.querySelector('[data-gear]')!;
  expect(card.textContent).toContain('Kestrel');
  expect(card.textContent).toContain('2 supercharged');
});

test('Fleet: flagships lead, chips narrow the list, Expand all opens every card', async () => {
  act(() => {
    setAppState(
      buildState({
        gear: [
          {
            id: 'tool',
            kind: 'multitool',
            name: 'Light Capacitor',
            class: 'A',
            type: 'Standard Rifle',
            superchargedSlots: ['R1C1', 'R1C2', 'R2C1']
          },
          { id: 'spare', kind: 'starship', name: 'Aeron', class: 'S', role: 'Scrap spare' },
          {
            id: 'flag',
            kind: 'starship',
            name: 'Ythgall',
            class: 'S',
            type: 'Sentinel Interceptor',
            role: 'Flagship',
            superchargedSlots: ['R2C2']
          }
        ]
      })
    );
  });
  fleet();
  const names = () => [...document.querySelectorAll('[data-gear] summary .font-display')].map(el => el.textContent);
  expect(names()).toEqual(['Ythgall', 'Aeron', 'Light Capacitor']);
  expect(document.querySelector('[data-gear="flag"]')?.hasAttribute('open')).toBe(true);
  expect(document.querySelector('[data-gear="tool"] summary')?.textContent).toContain('3 SC');
  const chip = (name: string) => within(screen.getByRole('group', { name: 'Filters' })).getByRole('button', { name });
  await userEvent.click(chip('Multi-Tools · 1'));
  expect(names()).toEqual(['Light Capacitor']);
  await userEvent.click(chip('All · 3'));
  await userEvent.click(chip('Supercharged'));
  expect(names()).toEqual(['Ythgall', 'Light Capacitor']);
  expect(screen.getByRole('status').textContent).toBe('2 of 3 in your fleet');
  await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));
  expect([...document.querySelectorAll('[data-gear]')].every(card => card.hasAttribute('open'))).toBe(true);
  expect(screen.getByRole('link', { name: 'Open Ythgall →' }).getAttribute('href')).toBe('#ship/flag');
});

test('the picker follows the wiki: a C-class tool has 3 rows and 1 supercharged slot, and a second mark is flagged', async () => {
  fleet();
  await userEvent.click(screen.getByRole('button', { name: 'Add gear' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Multi-Tool' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Pistol');
  await userEvent.click(screen.getByRole('radio', { name: 'C-class' }));
  expect(within(picker()).getAllByRole('button')).toHaveLength(30);
  expect(screen.queryByRole('radiogroup', { name: 'Rows' })).toBeNull(); // one size only
  const rules = document.getElementById('slotRules')!;
  expect(within(rules).getByRole('link', { name: 'Supercharged Slot' }).getAttribute('href')).toBe(
    'wiki/#/a/wiki%2Fmechanics%2FSupercharged_Slot.md'
  );
  await userEvent.click(cell(1, 2));
  expect(rules.textContent).toContain('Matches the wiki: C-class has 1');
  expect(document.getElementById('slotWarnings')).toBeNull();
  await userEvent.click(cell(3, 4));
  expect(document.getElementById('slotWarnings')?.textContent).toContain(
    'C-class has 1 supercharged slot; 2 are marked'
  );
  await userEvent.click(screen.getByRole('button', { name: 'Add to fleet' })); // a warning, not a block
  expect(appState.gear).toMatchObject([
    { name: 'Pistol', kind: 'multitool', class: 'C', superchargedSlots: ['R1C2', 'R3C4'] }
  ]);
});

test('arrow keys move between cells; Unmark clears the selected slot', async () => {
  act(() => {
    setAppState(
      buildState({
        gear: [{ id: 'flag', kind: 'starship', name: 'Old Flag', class: 'S', superchargedSlots: ['R2C2', 'R3C7'] }]
      })
    );
  });
  param = 'flag';
  render(
    <>
      <ShipDetail />
      <PlayerEditors />
    </>
  );
  await userEvent.click(screen.getByRole('button', { name: 'Edit Starship' }));
  expect(
    within(picker())
      .getAllByRole('button', { pressed: true })
      .map(button => button.dataset.slot)
  ).toEqual(['R2C2', 'R3C7']);
  cell(1, 1).focus();
  await userEvent.keyboard('{ArrowDown}{ArrowRight}');
  expect(document.activeElement?.getAttribute('data-slot')).toBe('R2C2');
  await userEvent.click(screen.getByRole('button', { name: 'Unmark supercharged' })); // R2C2 is selected on open
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(appState.gear[0]?.superchargedSlots).toEqual(['R3C7']);
});

test('an Exosuit has no class, and its three fixed slots are one tap away', async () => {
  fleet();
  await userEvent.click(screen.getByRole('button', { name: 'Add gear' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Exosuit' }));
  expect(screen.queryByRole('radiogroup', { name: 'Class' })).toBeNull();
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'My suit');
  await userEvent.click(screen.getByRole('button', { name: /Mark the Exosuit’s slots/ }));
  expect(screen.queryByRole('button', { name: /Mark the Exosuit’s slots/ })).toBeNull();
  await userEvent.click(cell(2, 9));
  await userEvent.type(screen.getByRole('textbox', { name: 'Module in this slot' }), 'Movement');
  await userEvent.click(cell(4, 1));
  const warnings = document.getElementById('slotWarnings')!.textContent;
  expect(warnings).not.toContain('4 are marked'); // said once, by the line naming the odd slot
  expect(warnings).toContain('R4C1 isn’t one of the Exosuit’s');
  await userEvent.click(screen.getByRole('button', { name: 'Add to fleet' }));
  expect(appState.gear).toMatchObject([
    {
      kind: 'exosuit',
      class: '',
      superchargedSlots: ['R1C5', 'R2C9', 'R3C3', 'R4C1'],
      slotLabels: { R2C9: 'Movement' }
    }
  ]);
});

test('Ship detail: the grid with what sits where, the wiki check with its sources, the note and linked notes', async () => {
  act(() => {
    setAppState(
      buildState({
        gear: [
          {
            id: 'flag',
            kind: 'starship',
            name: 'Ythgall',
            class: 'S',
            type: 'Sentinel Interceptor',
            role: 'Flagship',
            superchargedSlots: ['R2C2', 'R2C3', 'R2C4', 'R3C7'],
            slotLabels: { R2C3: 'Infra-Knife Accelerator' },
            notes: '3-in-a-row on Row 2.'
          }
        ],
        notes: [
          { id: 'n1', title: 'Ythgall: Infra-Knife grid', body: 'slot table', pins: [] },
          { id: 'n2', title: 'Unrelated', body: 'x', pins: [] }
        ]
      })
    );
  });
  param = 'flag';
  render(
    <>
      <ShipDetail />
      <PlayerEditors />
    </>
  );
  expect(screen.getByRole('heading', { level: 1, name: 'Ythgall' })).toBeTruthy();
  expect(screen.getByText('Sentinel Interceptor · Starship')).toBeTruthy();
  screen.getByRole('img', { name: 'Supercharged: R2C2, R2C3 (Infra-Knife Accelerator), R2C4 and R3C7' });
  const rules = screen.getByRole('region', { name: 'Matches the wiki' });
  expect(rules.textContent).toContain('4 of 4');
  expect(rules.textContent).toContain(
    'S-class starships have 4 supercharged slots, on a tech grid up to 10 columns by 6 rows.'
  );
  expect(within(rules).getByRole('link', { name: 'Inventory' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Your note' }).textContent).toContain('3-in-a-row on Row 2.');
  expect(screen.queryByRole('region', { name: 'Linked notes' })).toBeNull();

  // Link a note from the editor; it then lists on the ship's screen.
  await userEvent.click(screen.getByRole('button', { name: 'Edit Starship' }));
  await userEvent.click(screen.getByRole('button', { name: /Linked notes/ }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Ythgall: Infra-Knife grid' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(appState.notes.find(note => note.id === 'n1')?.pins).toEqual(['gear:flag']);
  const linked = screen.getByRole('region', { name: 'Linked notes' });
  expect(within(linked).getByRole('button', { name: /Ythgall: Infra-Knife grid/ })).toBeTruthy();
});

test('removing gear takes two taps and unlinks its notes', async () => {
  act(() => {
    setAppState(
      buildState({
        gear: [{ id: 'flag', kind: 'starship', name: 'Ythgall' }],
        notes: [{ id: 'n1', title: 'Grid', body: 'x', pins: ['home', 'gear:flag'] }]
      })
    );
  });
  param = 'flag';
  render(
    <>
      <ShipDetail />
      <PlayerEditors />
    </>
  );
  await userEvent.click(screen.getByRole('button', { name: 'Edit Starship' }));
  await userEvent.click(screen.getByRole('button', { name: 'Remove from fleet' }));
  expect(appState.gear).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to remove' }));
  expect(appState.gear).toEqual([]);
  expect(appState.notes[0]?.pins).toEqual(['home']);
  expect(screen.getByRole('heading', { name: 'Not in your fleet' })).toBeTruthy();
});

test('d09: on the Workbench the fleet is rows by kind, and a ship shows every slot’s code with what’s supercharged beside it', () => {
  setWide(true);
  act(() => {
    setAppState(
      buildState({
        gear: [
          {
            id: 'g1',
            kind: 'starship',
            name: 'Ythgall',
            class: 'S',
            type: 'Sentinel Interceptor',
            role: 'Flagship',
            superchargedSlots: ['R2C2', 'R2C3'],
            slotLabels: { R2C3: 'Infra-Knife Accelerator' }
          }
        ]
      })
    );
  });
  render(<Gear />);
  expect(screen.getByRole('heading', { name: 'Starships · 1' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /^Ythgall/ }).getAttribute('href')).toBe('#ship/g1');
  param = 'g1';
  render(<ShipDetail />);
  expect(screen.getByRole('heading', { level: 1, name: 'Ythgall' })).toBeTruthy();
  const side = screen.getByRole('complementary', { name: 'Supercharged and linked' });
  const slots = within(side).getByRole('list', { name: 'Supercharged slots' });
  expect(
    within(slots)
      .getAllByRole('listitem')
      .map(li => li.textContent)
  ).toEqual(['R2C2Not named', 'R2C3Infra-Knife Accelerator']);
  expect(screen.getByRole('img', { name: /R2C3 \(Infra-Knife Accelerator\)/ })).toBeTruthy();
});
