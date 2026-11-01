import { beforeEach, expect, test } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeIndex } from '@atlas/core/codex';
import { prepare } from '@atlas/core/search';
import { Codex } from './Codex.tsx';
import { setCodexForTests } from './codex-data.ts';

const entries = [
  {
    title: 'Oxygen',
    category: 'resources',
    path: 'wiki/resources/Oxygen.md',
    source: 'wiki',
    url: 'https://nomanssky.fandom.com/wiki/Oxygen',
    revId: 42,
    summary: 'A gas.',
    // Under happy-dom, DOMPurify drops the tags of a document's first element (browsers don't), so the fixture
    // opens with a paragraph to keep both headings.
    body: '# Oxygen\n\nAn element.\n\n## Quick Facts\n\nBreathe.\n\n## Uses\n\nMany.'
  },
  {
    title: 'Life Support Gel',
    category: 'products',
    path: 'wiki/products/Life_Support_Gel.md',
    source: 'wiki',
    summary: 'A gel.',
    body: '# Life Support Gel\n\nMade from [[Oxygen]] and [[Nowhere]].',
    recipes: [{ type: 'craft', inputs: [{ name: 'Oxygen' }] }]
  }
].map(prepare);

const at = (hash: string) => {
  act(() => {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};

beforeEach(() => {
  at('#/');
  act(() => {
    setCodexForTests({ status: 'ready', index: makeIndex(entries, {}), verification: null });
  });
});

test('an article reads as section cards, with On this page in a sheet and the pages it’s used in', async () => {
  render(<Codex />);
  at(`#/a/${encodeURIComponent('wiki/resources/Oxygen.md')}`);
  expect(screen.getByRole('heading', { level: 1, name: 'Oxygen' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Start a refiner timer' })).toBeNull();
  const body = document.getElementById('articleBody')!;
  expect(within(body).getByRole('region', { name: 'Quick Facts' }).textContent).toContain('Breathe.');
  expect(within(body).getByRole('region', { name: /Used in/ }).textContent).toContain('Life Support Gel');
  await userEvent.click(screen.getAllByRole('button', { name: 'On this page' })[0]!);
  const sheet = document.getElementById('articleIndexSheet')!;
  expect(sheet.getAttribute('aria-hidden')).toBe('false');
  const titles = within(sheet)
    .getAllByRole('link')
    .map(link => link.textContent);
  expect(titles[0]).toContain('Overview');
  expect(titles.some(title => title.includes('Uses'))).toBe(true);
  await userEvent.click(sheet.querySelector<HTMLButtonElement>('[data-sheet-handle]')!);
  expect(sheet.getAttribute('aria-hidden')).toBe('true');
  expect(screen.getByRole('link', { name: 'Pin to a note' }).getAttribute('href')).toBe('../#note-about/Oxygen');
});

test('find in this article marks every match in the text', async () => {
  render(<Codex />);
  at(`#/a/${encodeURIComponent('wiki/resources/Oxygen.md')}`);
  await userEvent.click(screen.getAllByRole('button', { name: 'On this page' })[0]!);
  const sheet = document.getElementById('articleIndexSheet')!;
  await userEvent.type(within(sheet).getByRole('searchbox', { name: 'Find in this article' }), 'many');
  expect(document.querySelectorAll('#articleBody mark[data-find]')).toHaveLength(1);
  expect(within(sheet).getByRole('status').textContent).toContain('1 match');
});

test('Quick Facts read as pairs and recipe lines as a table', () => {
  act(() => {
    setCodexForTests({
      status: 'ready',
      index: makeIndex(
        [
          ...entries,
          prepare({
            title: 'Chromatic Metal',
            category: 'resources',
            path: 'wiki/resources/Chromatic_Metal.md',
            source: 'wiki',
            body:
              '# Chromatic Metal\n\nIntro.\n\n## Quick Facts\n\n- **Symbol:** Ch\n- **Value:** 88\n\n## Source\n\n- Pirate ships\n\n' +
              '- **Refiner** · *Extract* · 0.36 s per unit: 2 × [[Oxygen]] → 1 × Chromatic Metal'
          })
        ],
        {}
      ),
      verification: null
    });
  });
  render(<Codex />);
  at(`#/a/${encodeURIComponent('wiki/resources/Chromatic_Metal.md')}`);
  expect(screen.getByRole('link', { name: 'Start a refiner timer' }).getAttribute('href')).toBe(
    `../#refine-timer/${encodeURIComponent('Chromatic Metal')}`
  );
  const facts = screen.getByRole('region', { name: 'Quick Facts' });
  expect(within(facts).getByText('Value').nextElementSibling?.textContent).toBe('88');
  const table = within(screen.getByRole('region', { name: 'Source' })).getByRole('table');
  expect(table.textContent).toContain('2 × Oxygen');
  expect(table.textContent).toContain('→ 1');
  expect(table.textContent).toContain('0.36 s');
});

test('wiki links resolve to Codex articles, or stay plain text when the page isn’t archived', () => {
  render(<Codex />);
  at(`#/a/${encodeURIComponent('wiki/products/Life_Support_Gel.md')}`);
  const body = document.querySelector<HTMLElement>('#articleBody [data-md]')!; // the text, not the Links to card
  expect(within(body).getByRole('link', { name: 'Oxygen' }).getAttribute('href')).toBe(
    `#/a/${encodeURIComponent('wiki/resources/Oxygen.md')}`
  );
  expect(within(body).queryByRole('link', { name: 'Nowhere' })).toBeNull();
  expect(body.textContent).toContain('Nowhere');
});

test('search results open a quick look; Escape closes it', async () => {
  render(<Codex />);
  at('#/?q=gel');
  await userEvent.click(screen.getByRole('button', { name: /Life Support Gel/ }));
  expect(document.getElementById('peekPanel')?.getAttribute('aria-hidden')).toBe('false');
  expect(document.getElementById('peekTitle')?.textContent).toBe('Life Support Gel');
  await userEvent.keyboard('{Escape}');
  expect(document.getElementById('peekPanel')?.getAttribute('aria-hidden')).toBe('true');
});

test('an unknown article says so', () => {
  render(<Codex />);
  at('#/a/wiki%2Fnope.md');
  expect(screen.getByRole('heading', { name: 'Article not found' })).toBeTruthy();
});

test('the Codex says which dump of the wiki it was copied from, on articles and the landing', () => {
  act(() => {
    setCodexForTests({
      status: 'ready',
      index: makeIndex(entries, {}),
      verification: {
        status: 'match',
        checkedAt: '2026-10-29T12:00:00Z',
        pages: 2,
        matched: 2,
        source: 'dump',
        dumpDate: '2026-10-29T08:00:00Z'
      }
    });
  });
  render(<Codex />);
  const day = new Date('2026-10-29T08:00:00Z').toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  expect(document.getElementById('codexCheck')?.textContent).toContain(`Wiki copy from ${day}: 2 of 2 pages match it`);
  at(`#/a/${encodeURIComponent('wiki/resources/Oxygen.md')}`);
  const source = screen.getByRole('link', { name: /revision 42/ });
  expect(source.parentElement?.textContent).toContain(`wiki copy from ${day}`);
  // Corrections still go to the live page.
  expect(screen.getByRole('link', { name: 'Fix this on the wiki' }).getAttribute('href')).toBe(
    'https://nomanssky.fandom.com/wiki/Oxygen?action=edit'
  );
});

test('a wiki article credits its revision and licence, and sends corrections to the wiki', () => {
  render(<Codex />);
  at(`#/a/${encodeURIComponent('wiki/resources/Oxygen.md')}`);
  const source = screen.getByRole('link', { name: /revision 42/ });
  expect(source.getAttribute('href')).toBe('https://nomanssky.fandom.com/wiki/Oxygen?oldid=42');
  expect(source.parentElement?.textContent).toContain('CC BY-NC-SA 3.0');
  const fix = screen.getByRole('link', { name: 'Fix this on the wiki' });
  expect(fix.getAttribute('href')).toBe('https://nomanssky.fandom.com/wiki/Oxygen?action=edit');
  expect(fix.getAttribute('target')).toBe('_blank');
});
