import { test } from 'vitest';
import assert from 'node:assert/strict';
import { applyMarkdown } from '../src/markdown-edit.ts';

test('bold and italic wrap the selection, and a second press unwraps it', () => {
  const bold = applyMarkdown('Infra-Knife here', 0, 11, 'bold');
  assert.deepEqual(bold, { text: '**Infra-Knife** here', start: 2, end: 13 });
  assert.deepEqual(applyMarkdown(bold.text, bold.start, bold.end, 'bold'), {
    text: 'Infra-Knife here',
    start: 0,
    end: 11
  });
  assert.deepEqual(applyMarkdown('ab', 1, 1, 'italic'), { text: 'a__b', start: 2, end: 2 }); // caret between the marks
  assert.equal(applyMarkdown('Gold', 0, 4, 'link').text, '[[Gold]]');
});

test('heading and list act on every line the selection touches', () => {
  assert.deepEqual(applyMarkdown('one\ntwo\nthree', 5, 9, 'list'), {
    text: 'one\n- two\n- three',
    start: 4,
    end: 17
  });
  assert.equal(applyMarkdown('one\n- two\n- three', 6, 8, 'list').text, 'one\ntwo\n- three');
  assert.equal(applyMarkdown('Title\nbody', 2, 2, 'heading').text, '## Title\nbody');
  assert.equal(applyMarkdown('## Title', 4, 4, 'heading').text, 'Title');
});

test('a table goes on its own lines, with its first header selected', () => {
  const edit = applyMarkdown('Layout', 6, 6, 'table');
  assert.equal(edit.text, 'Layout\n\n| Column | Column |\n| --- | --- |\n|  |  |\n');
  assert.equal(edit.text.slice(edit.start, edit.end), 'Column');
  assert.equal(applyMarkdown('', 0, 0, 'table').text.startsWith('| Column'), true);
});

test('a numbered list counts the lines it touches, and a checklist turns a list into boxes', () => {
  assert.equal(applyMarkdown('one\ntwo', 0, 7, 'numbered').text, '1. one\n2. two');
  assert.equal(applyMarkdown('1. one\n2. two', 0, 13, 'numbered').text, 'one\ntwo');
  assert.equal(applyMarkdown('- one\ntwo', 0, 9, 'task').text, '- [ ] one\n- [ ] two');
  assert.equal(applyMarkdown('- [ ] one\n- [x] two', 0, 19, 'task').text, 'one\ntwo');
});
