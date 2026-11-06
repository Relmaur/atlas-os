import { expect, test } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WordCombobox, type WordGroup } from './WordCombobox.tsx';
import { SeverityPill } from './SeverityPill.tsx';

const GROUPS: WordGroup[] = [
  { label: 'Frozen weather · wiki', options: [{ value: 'Icy Blasts' }, { value: 'Icy Tempests' }, { value: 'Crisp' }] },
  { label: 'Other biomes', options: [{ value: 'Toxic Damp' }] }
];

function Form({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <form>
      <WordCombobox label="Weather" name="weather" value={value} onChange={setValue} groups={GROUPS} />
      <input aria-label="Next field" />
      <output data-testid="value">{value}</output>
    </form>
  );
}

test('opens on focus with the context’s words first; typing narrows by contains; a pick moves on', async () => {
  render(<Form />);
  const box = screen.getByRole('combobox', { name: 'Weather' });
  expect(box.getAttribute('aria-expanded')).toBe('false');
  await userEvent.click(box);
  expect(box.getAttribute('aria-expanded')).toBe('true');
  const list = screen.getByRole('listbox', { name: 'Weather' });
  expect(
    within(list)
      .getAllByRole('option')
      .map(option => option.textContent)
  ).toEqual(['Icy Blasts', 'Icy Tempests', 'Crisp', 'Toxic Damp']);
  await userEvent.type(box, 'blast');
  // "contains", not "starts with"; and the typed text can always be kept.
  expect(
    within(list)
      .getAllByRole('option')
      .map(option => option.textContent)
  ).toEqual(['Icy Blasts', 'Keep “blast” as typed']);
  await userEvent.click(within(list).getByRole('option', { name: 'Icy Blasts' }));
  expect(screen.getByTestId('value').textContent).toBe('Icy Blasts');
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Next field' }));
});

test('keyboard: ↓ and Enter pick; Esc closes and keeps the typed text; free text is never replaced', async () => {
  render(<Form />);
  const box = screen.getByRole('combobox', { name: 'Weather' });
  await userEvent.type(box, 'Icy');
  await userEvent.keyboard('{ArrowDown}{ArrowDown}');
  expect(box.getAttribute('aria-activedescendant')).toBeTruthy();
  await userEvent.keyboard('{Enter}');
  expect(screen.getByTestId('value').textContent).toBe('Icy Tempests');

  await userEvent.clear(box);
  await userEvent.type(box, 'Gentle Snow');
  await userEvent.keyboard('{Escape}');
  expect(box.getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByTestId('value').textContent).toBe('Gentle Snow');
  // The last row keeps it too.
  await userEvent.click(box);
  await userEvent.keyboard('{ArrowUp}{Enter}');
  expect(screen.getByTestId('value').textContent).toBe('Gentle Snow');
});

test('the severity pill: quiet for ordinary levels, crimson with a warning mark for danger, the word always there', () => {
  const { container } = render(
    <p>
      <SeverityPill danger={false}>Normal</SeverityPill>
      <SeverityPill danger>Extreme</SeverityPill>
    </p>
  );
  const [quiet, danger] = [...container.querySelectorAll('span')].filter(span => span.textContent);
  expect(quiet?.textContent).toBe('Normal');
  expect(quiet?.querySelector('.ph-warning')).toBeNull();
  expect(danger?.textContent).toBe('Extreme');
  expect(danger?.querySelector('.ph-warning')?.getAttribute('aria-hidden')).toBe('true');
  expect(danger?.className).toContain('danger-crimson');
});
