// wikitext.ts against real page sources (tests/fixtures/wikitext/, CC BY-NC-SA 3.0).
import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildArticle, categoryFor, cleanSource, gameKind, pageCategories, escapeStrayHtml, parseFrontmatter, parseTemplate, plainText, renderWikitext, slugify, toFrontmatter, type Article, type Page } from '../src/wikitext.ts';

const FIXTURES = new URL('../../../tests/fixtures/wikitext/', import.meta.url);
const pages = JSON.parse(fs.readFileSync(new URL('pages.json', FIXTURES), 'utf8')) as Record<
  string,
  Omit<Page, 'content'>
>;
const build = (slug: string) =>
  buildArticle({ ...pages[slug]!, content: fs.readFileSync(new URL(`${slug}.wiki`, FIXTURES), 'utf8') });
const article = (slug: string): Article => {
  const result = build(slug);
  if (result.excluded !== undefined) throw new Error(`${slug} was excluded: ${result.excluded}`);
  return result;
};

test('Oxygen: infobox facts, refiner recipes and the in-game description', () => {
  const { category, meta, body } = article('oxygen');
  assert.equal(category, 'resources');
  assert.equal(meta.revId, 1335140);
  assert.equal(meta.version, 'Waypoint');
  assert.equal(meta.data.value, 34);
  assert.equal(meta.data.fields.symbol, 'O2');
  assert.equal(
    meta.summary,
    'Integral to the atmospheric filtering technology at the heart of the exosuit life support system.'
  );
  const refine = meta.data.recipes.filter(recipe => recipe.type === 'refine');
  assert.equal(refine.length, 9);
  assert.deepEqual(refine[1], {
    type: 'refine',
    inputs: [
      { name: 'Kelp Sac', qty: 1 },
      { name: 'Carbon', qty: 1 }
    ],
    outputs: [{ name: 'Oxygen', qty: 2 }],
    seconds: 0.36,
    label: 'Release Captured Oxygen'
  });
  assert.match(body, /^\*\*Oxygen\*\* is a resource\.$/m, 'bold at the start of a line is not a list item');
  assert.match(body, /\[\[Life Support\|life support\]\]/);
});

test('Stasis Device: blueprint craft recipe, value and a multi-line table', () => {
  const { meta, body } = article('stasis-device');
  assert.equal(meta.data.value, 15600000);
  assert.deepEqual(meta.data.recipes, [
    {
      type: 'craft',
      inputs: [
        { name: 'Quantum Processor', qty: 1 },
        { name: 'Cryogenic Chamber', qty: 1 },
        { name: 'Iridesite', qty: 1 }
      ],
      outputs: [{ name: 'Stasis Device', qty: 1 }],
      blueprint: true
    }
  ]);
  assert.match(body, /^\| Cryogenic Chamber \| Quantum Processor \| Iridesite \|$/m);
  assert.match(body, /• 250 \[\[Radon\]\]/);
});

test('Craft output quantity: a Bionic Lure craft yields 20', () => {
  const [craft] = article('bionic-lure').meta.data.recipes.filter(recipe => recipe.type === 'craft');
  assert.deepEqual(craft?.outputs, [{ name: 'Bionic Lure', qty: 20 }]);
  assert.deepEqual(
    craft.inputs.map(input => input.name),
    ['Amino Chamber', 'Ion Battery', 'Lubricant']
  );
});

test('cooking recipes keep self-multiplying entries as data (the planner skips them)', () => {
  const recipes = article('wild-yeast').meta.data.recipes;
  assert.deepEqual(
    recipes.map(recipe => recipe.inputs[0]?.name),
    ['Wild Yeast', 'Faecium']
  );
  assert.ok(recipes.every(recipe => recipe.type === 'cook' && recipe.seconds === 2.5));
});

test('repair and dismantle recipes, and nested tables leave no raw markup', () => {
  const { meta, body } = article('analysis-visor-upgrade');
  assert.deepEqual(
    meta.data.recipes.map(recipe => recipe.type),
    ['repair', 'dismantle']
  );
  assert.doesNotMatch(body, /^\s*(\{\||\|\})/m);
  assert.doesNotMatch(body, /\[\[:?File:/);
});

test('archived variants are obsolete; player-found multi-tools are excluded', () => {
  const atlas = article('blaze-javelin-atlas');
  assert.equal(atlas.meta.obsolete, true);
  assert.equal(atlas.meta.data.recipes[0]?.obsolete, true);
  assert.deepEqual(build('player-found-multitool'), { excluded: 'player-found multi-tool' });
});

test('templates parse positional, numbered and named parameters with nesting', () => {
  const template = parseTemplate('Craft|1=Oxygen,150;Silver,60|blueprint=yes|{{Units}}|[[A|B]]');
  assert.equal(template.key, 'craft');
  assert.deepEqual(template.positional, ['Oxygen,150;Silver,60', '{{Units}}', '[[A|B]]']);
  assert.deepEqual(template.named, { blueprint: 'yes' });
});

test('inline markup renders to Markdown and plain text', () => {
  const md = renderWikitext("==Heading==\n* '''Bold''' and ''italic'' [[Target|label]]\n{{Units}}", { title: 'X' });
  assert.equal(md, '## Heading\n\n- **Bold** and *italic* [[Target|label]]\n Units');
  assert.equal(plainText('[[Sodium Nitrate|Sodium]]<br>{{link|Gold}} &amp; more'), 'Sodium, Gold & more');
});

test('column lists keep their items, and a biome reads as a link to its page', () => {
  const md = renderWikitext('Prefixes:\n{{cols|2|\n# Frozen\n# Frostbound\n}}\n\nOn {{Biome|Dead}} worlds.', { title: 'X' });
  assert.match(md, /1\. Frozen\n.*Frostbound/);
  assert.match(md, /On \[\[Biome - Dead\|Dead\]\] worlds\./);
});

test('frontmatter round-trips strings, numbers, booleans and data objects', () => {
  const meta = { title: 'A "quoted" title', revId: 5, obsolete: false, data: { recipes: [{ type: 'craft' }] } };
  assert.deepEqual(parseFrontmatter(toFrontmatter(meta) + 'body').meta, meta);
});

test('category folders and slugs follow the infobox', () => {
  assert.equal(categoryFor('product', { category: 'Fish' }), 'fish');
  assert.equal(categoryFor('product', { type: 'Edible Product' }), 'cooking');
  assert.equal(categoryFor('product', { category: 'Base Building' }), 'building');
  assert.equal(categoryFor('product', { category: 'Tradeable' }), 'products');
  assert.equal(categoryFor('encounter', {}), 'places');
  assert.equal(categoryFor('mechanic', {}), 'mechanics');
  assert.equal(slugify("'Apple' Cake of Lost Souls"), 'Apple_Cake_of_Lost_Souls');
});

test('tag blocks are removed in one pass: unclosed ones on a hostile page cost no more than a closed one', () => {
  assert.equal(cleanSource('a<!-- x -->b<ref name="r">c</ref>d<gallery>e</gallery>f'), 'abdf');
  assert.equal(cleanSource('a<!-- never closed'), 'a'); // as MediaWiki: the rest is hidden
  assert.equal(cleanSource('a<ref>open'), 'a<ref>open');
  const hostile = '<ref>'.repeat(40_000) + 'x';
  const started = performance.now();
  cleanSource(hostile);
  assert.ok(performance.now() - started < 500, 'linear');
});

test('markup left in a page reaches the article as text, except the few tags articles keep', () => {
  assert.equal(
    escapeStrayHtml('<script>x</script> <img src=x onerror=y> a<br>b <code>c</code> <weapon name>'),
    '&lt;script>x&lt;/script> &lt;img src=x onerror=y> a<br>b <code>c</code> &lt;weapon name>'
  );
});

test('a list item ending in bold stays its own item; bold opened at a line end continues', () => {
  const md = renderWikitext("* holds '''Ion Batteries''' \n* up to 100 '''food''' items\nBefore '''\nbold''' text", {
    title: 'X'
  });
  assert.equal(md, '- holds **Ion Batteries**\n- up to 100 **food** items\nBefore **bold** text');
});

test('the wider scope: game pages from the shared infoboxes land in Lore, Life and worlds, or Mechanics', () => {
  const source = (slug: string) => fs.readFileSync(new URL(`${slug}.wiki`, FIXTURES), 'utf8');
  const cases: [slug: string, kind: string, folder: string][] = [
    ['sentinel', 'lore', 'lore'],
    ['rangifae', 'world', 'world'],
    ['perpetuus-thesaurophilus', 'flora', 'world'],
    ['stratofossilite', 'mineral', 'world'],
    ['horizon-omega', 'starship', 'mechanics'],
    ['final-shadow-xiv', 'multitool', 'mechanics']
  ];
  for (const [slug, kind, folder] of cases) {
    assert.equal(gameKind(pages[slug]!.title, source(slug)), kind, slug);
    const { category, meta, body } = article(slug);
    assert.equal(category, folder, slug);
    assert.ok(meta.summary.length > 20, `${slug} has a summary`);
    assert.ok(!body.includes('{{'), `${slug} renders without template braces`);
  }
});

test('the wider scope leaves players’ pages out', () => {
  const general = (fields: string, categories = '[[Category:Sentinels]]') =>
    `{{General infobox\n|name=X\n${fields}}}\nText.\n${categories}`;
  assert.equal(gameKind('Sentinel', general('')), 'lore');
  assert.equal(gameKind('Some Hub', general('|civilized=Galactic Hub')), null); // a civilization claims it
  assert.equal(gameKind('X', general('', '')), null); // uncategorised
  assert.equal(gameKind('Genus Catalog - Bos-Spider-Crab', general('', '[[Category:Bos]]')), null);
  assert.equal(gameKind('Rezehnan Union', general('', '[[Category:Rezehnan Union]]')), null);
  assert.equal(gameKind('Umigusuku S33', '{{Starship infobox\n|name=Umigusuku S33}}\n[[Category:Starships]]'), null);
  assert.equal(gameKind('Daiman IX', '{{System infobox\n|name=Daiman IX}}\n[[Category:Mechanics]]'), null);
  assert.equal(gameKind('Cave', 'Prose.\n[[Category:Biomes]]'), 'biome');
  assert.equal(gameKind('Hu - Starship Catalog', 'Prose.\n[[Category:Starships]]'), null);
  assert.equal(gameKind('Josirolle Terminus', 'Prose.\n[[Category:Euclid]]'), null);
  // The original scope wins over the wider one, and the mechanics pages keep their kind.
  assert.equal(gameKind('Freighter', '{{General infobox\n|name=Freighter}}\n[[Category:Mechanics]]'), 'mechanic');
  assert.equal(gameKind('Y', '{{General infobox}}{{Product infobox}}'), 'product');
  assert.deepEqual(pageCategories('[[Category:Space_Anomaly]] [[category: lore|sort]]'), ['Space Anomaly', 'Lore']);
});
