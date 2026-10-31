import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { latestOf, newestFirst, parseUpdate } from '../src/updates.ts';
import { whatsNew } from '../src/whats-new.ts';

const dir = new URL('../../../updates/', import.meta.url);
const seeded = readdirSync(dir)
  .filter(file => file.endsWith('.md') && file !== 'README.md')
  .map(file => ({ file, text: readFileSync(new URL(file, dir), 'utf8') }));
const vars = { wikiPages: '3,708' };

test('every update file is valid, and named for its date and slug', () => {
  assert.ok(seeded.length >= 2);
  for (const { file, text } of seeded) {
    const update = parseUpdate(text, vars);
    assert.equal(file, `${update.date}-${update.slug}.md`);
    assert.ok(!JSON.stringify(update).includes('{{'));
  }
});

test("updates sort newest first, and the app carries the newest one's first highlight", () => {
  const updates = seeded.map(({ text }) => parseUpdate(text, vars));
  assert.equal(newestFirst(updates)[0]?.slug, 'first-light');
  assert.deepEqual(latestOf(updates)?.title, 'The Map');
  assert.equal(latestOf([]), null);
});

test('counts in the copy are filled in, and an unknown placeholder is refused', () => {
  const light = seeded.find(({ file }) => file.includes('first-light'))?.text ?? '';
  assert.match(parseUpdate(light, vars).lede, /3,708 pages/);
  assert.throws(() => parseUpdate(light, {}), /Unknown placeholder/);
  assert.throws(() => parseUpdate('no frontmatter'), /frontmatter/);
});

test("What's new: once per update, never on a first install", () => {
  assert.equal(whatsNew('first-light', null, true), 'mark-seen'); // new here
  assert.equal(whatsNew('first-light', null, false), 'show'); // here from before the card
  assert.equal(whatsNew('first-light', 'first-light', false), 'nothing'); // seen
  assert.equal(whatsNew('next', 'first-light', false), 'show'); // a new file
  assert.equal(whatsNew('next', 'first-light', true), 'mark-seen');
  assert.equal(whatsNew(null, null, false), 'nothing');
});
