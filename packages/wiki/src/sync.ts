// Mirrors the game-data pages of the No Man's Sky wiki into wiki/<category>/<slug>.md and rebuilds the Codex indexes.
// The source is always a database dump of the wiki, never the API: Fandom asked that tools wait for a new dump
// (Special:Statistics) instead of calling it (ADR-0009). The dump lives outside the repo; it holds the whole wiki.
//
//   pnpm sync:wiki --from-dump <file>          sync every in-scope page from the dump, record the verification, reindex
//   pnpm verify:wiki --from-dump <file>        dry run: report how the archive differs from the dump (exit 1 if it does)
//   pnpm index:wiki                            reindex the committed archive only
//   pnpm sync:wiki --discover <file> --out <report.md>
//                                              the scope report for widening the mirror (writes nothing in wiki/)
//
// Scope (gameKind() in wikitext.ts): the game's own pages, found by infobox, by title (MECHANICS, for the rules
// facts.ts cites) and by category. Player discoveries (planets, creatures, bases, player-found ships and multi-tools)
// and community pages are out of scope.
// Every article is rendered from the page's wikitext at a recorded revision id. MediaWiki revisions are immutable,
// so an archived revId equal to the dump's revId means the copy matches the wiki's source at the dump's date.
//
// Node 24+ runs this file as-is (type stripping); its only dependency is Zod.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  WIKI_BASE,
  LICENSE,
  FOLDERS,
  slugify,
  toFrontmatter,
  parseFrontmatter,
  summarize,
  buildArticle,
  ArticleMetaSchema,
  type ArticleMeta,
  type Page
} from './wikitext.ts';
import { InvalidDump, followRedirect, scanDump } from './dump.ts';
import { discover, reportMarkdown } from './discover.ts';
import { GlyphTableSchema, glyphPageDigit, parseGlyphNames, type Glyph, type GlyphTable } from '@atlas/core/glyphs';
import { GalaxyMapFactsSchema, parseEconomyNames, parseEconomyStrength, parseSpectralClasses, type GalaxyMapFacts } from '@atlas/core/galaxy-map';
import { PlanetFactsSchema, biomePageName, isDeposit, isScanFind, parseRuinedSets, parseStarMetals, resourceLinks, parseBiomeDescriptors, parseBiomeWeather, parseLifeWords, parseSentinelWords, type PlanetFacts } from '@atlas/core/planets';
import { FACTS, checkFacts, currentGameVersion, type FactPage, type UpdatePage } from './facts.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WIKI_DIR = path.join(ROOT, 'wiki');
const describe = (err: unknown) => (err instanceof Error ? err.message : String(err));

interface ArchiveEntry {
  file: string;
  text: string;
  meta: ArticleMeta;
}
interface FileWrite {
  file: string;
  text: string;
}

const Aliases = z.record(z.string(), z.string());
const CustomMeta = z.looseObject({
  title: z.coerce.string().optional().catch(undefined),
  summary: z.coerce.string().optional().catch(undefined),
  data: ArticleMetaSchema.shape.data.catch(undefined)
});

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------
// Frontmatter is validated, but the original object is kept: Zod rebuilds objects in schema key order, and the
// derived JSON must keep the archive's order byte-for-byte.
function readMeta(file: string, meta: Record<string, unknown>): ArticleMeta {
  const parsed = ArticleMetaSchema.safeParse(meta);
  if (!parsed.success) throw new Error(`wiki/${file}: invalid frontmatter (${parsed.error.issues[0]?.path.join('.') ?? '?'})`);
  return meta;
}

async function readArchive(): Promise<Map<number, ArchiveEntry>> {
  const byPageId = new Map<number, ArchiveEntry>();
  for (const folder of FOLDERS) {
    const dir = path.join(WIKI_DIR, folder);
    for (const file of (await fs.readdir(dir).catch(() => [])).filter(name => name.endsWith('.md'))) {
      const text = await fs.readFile(path.join(dir, file), 'utf8');
      const meta = readMeta(`${folder}/${file}`, parseFrontmatter(text).meta);
      if (meta.pageId) byPageId.set(meta.pageId, { file: `${folder}/${file}`, text, meta });
    }
  }
  return byPageId;
}

// Compares the dump with the archive and returns what a sync would change.
function plan(livePages: Page[], archive: Map<number, ArchiveEntry>, dumpDate: string) {
  const writes: FileWrite[] = [];
  const deletes: string[] = [];
  const excluded: { title: string; reason: string }[] = [];
  const outdated: { title: string; archived: number | undefined; live: number }[] = [];
  const newer: { title: string; archived: number; live: number }[] = [];
  const missing: string[] = [];
  const taken = new Set<string>();
  const kept = new Set<number>();
  const titles = new Set<string>();
  const recipeNames = new Set<string>();
  const factTitles = new Set(Object.values(FACTS).map(fact => fact.page));
  const factPages = new Map<string, FactPage>();
  for (const page of [...livePages].sort((a, b) => a.pageId - b.pageId)) {
    const article = buildArticle(page);
    if (article.excluded !== undefined) {
      excluded.push({ title: page.title, reason: article.excluded });
      continue;
    }
    kept.add(page.pageId);
    titles.add(page.title.toLowerCase());
    for (const recipe of article.meta.data.recipes) {
      for (const item of [...recipe.inputs, ...recipe.outputs]) recipeNames.add(item.name);
    }
    let slug = slugify(page.title) || String(page.pageId);
    if (taken.has(`${article.category}/${slug.toLowerCase()}`)) slug = `${slug}_${page.pageId}`;
    taken.add(`${article.category}/${slug.toLowerCase()}`);
    const file = `${article.category}/${slug}.md`;
    const text = toFrontmatter(article.meta) + article.body;
    if (factTitles.has(page.title))
      factPages.set(page.title, { path: `wiki/${file}`, url: article.meta.source, revId: page.revId, body: article.body });
    const existing = archive.get(page.pageId);
    // Revision ids only grow, so an archived copy newer than the dump's (taken from the API before the mirror moved
    // to dumps) stays as it is: an older dump never rolls a page back. Its facts still come from the archived copy.
    if (existing?.meta.revId !== undefined && existing.meta.revId > page.revId) {
      newer.push({ title: page.title, archived: existing.meta.revId, live: page.revId });
      if (factTitles.has(page.title))
        factPages.set(page.title, { path: `wiki/${existing.file}`, url: article.meta.source, revId: existing.meta.revId, body: parseFrontmatter(existing.text).body });
      continue;
    }
    if (!existing) missing.push(page.title);
    else if (existing.meta.revId !== page.revId)
      outdated.push({ title: page.title, archived: existing.meta.revId, live: page.revId });
    if (existing && existing.file !== file) deletes.push(existing.file);
    if (!existing || existing.file !== file || existing.text !== text) writes.push({ file, text });
  }
  const removed: string[] = [];
  for (const [pageId, entry] of archive) {
    if (kept.has(pageId) || entry.meta.status === 'removed') continue;
    // A page written after the dump was taken can't be in it: absent isn't removed, so it stays current.
    if (dumpDate && entry.meta.revTimestamp && entry.meta.revTimestamp > dumpDate) {
      newer.push({ title: entry.meta.title ?? '', archived: entry.meta.revId ?? 0, live: 0 });
      continue;
    }
    removed.push(entry.meta.title ?? '');
    writes.push({ file: entry.file, text: entry.text.replace(/^status: "current"$/m, 'status: "removed"') });
  }
  const unknownNames = [...recipeNames].filter(name => name && !titles.has(name.toLowerCase())).sort();
  return { writes, deletes, excluded, outdated, newer, missing, removed, titles, unknownNames, factPages };
}

// Recipe ingredients named by an old title (e.g. "Rigogen") reach their page through a wiki redirect in the dump.
function resolveAliases(
  names: string[],
  titles: Set<string>,
  redirects: Map<string, string>
): { aliases: Record<string, string>; unlinked: string[] } {
  const aliases: Record<string, string> = {};
  for (const name of names) {
    const target = followRedirect(redirects, name);
    if (target && titles.has(target.toLowerCase())) aliases[name] = target;
  }
  const sorted = Object.fromEntries(Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b)));
  return { aliases: sorted, unlinked: names.filter(name => !(name in sorted)) };
}

async function writeVerification(report: object): Promise<void> {
  await fs.writeFile(path.join(WIKI_DIR, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function sync({ dump, dryRun }: { dump: string; dryRun: boolean }): Promise<boolean> {
  const checkedAt = new Date().toISOString();
  const dumpName = path.basename(dump);
  let scan: Awaited<ReturnType<typeof scanDump>>;
  try {
    scan = await scanDump(dump);
  } catch (err) {
    // Nothing has been written: the committed archive and its verification stay as they were.
    console.error(
      err instanceof InvalidDump
        ? `❌ The dump can't be used: ${err.message}. Nothing was written.`
        : `❌ Couldn't read the dump (${describe(err)}). Nothing was written.`
    );
    return false;
  }
  const livePages = scan.pages;
  console.log(`🔎 ${livePages.length} pages in scope in ${dumpName} (the game's own pages: infoboxes, mechanics and game categories).`);
  // A renamed or deleted mechanics page: its archived copy is marked removed, and the facts citing it go stale.
  if (scan.mechanicsMissing.length) console.warn(`⚠️  Mechanics pages not in the dump: ${scan.mechanicsMissing.join(', ')}`);

  const changes = plan(livePages, await readArchive(), scan.latest);
  const { stale: staleFacts } = checkFacts(changes.factPages);
  for (const fact of staleFacts) console.warn(`⚠️  Cited fact ${fact.id} (${fact.page}): ${fact.reason}. Update packages/wiki/src/facts.ts.`);
  const committedAliases = await fs.readFile(path.join(WIKI_DIR, 'aliases.json'), 'utf8').catch(() => '');
  const { aliases, unlinked } = resolveAliases(changes.unknownNames, changes.titles, scan.redirects);
  const aliasesText = `${JSON.stringify(aliases, null, 2)}\n`;
  const aliasesChanged = committedAliases !== aliasesText;
  const differences = changes.writes.length + changes.deletes.length + (aliasesChanged ? 1 : 0);
  if (!dryRun) {
    // Writes first, then deletes: if the disk fails partway, a renamed page exists twice rather than not at all.
    for (const { file, text } of changes.writes) {
      await fs.mkdir(path.dirname(path.join(WIKI_DIR, file)), { recursive: true });
      await fs.writeFile(path.join(WIKI_DIR, file), text, 'utf8');
    }
    // A rename that only changes letter case writes into the same file on case-insensitive disks (macOS), so the old
    // name must not be deleted there; on case-sensitive disks (Linux, CI) it is a separate file and must go.
    const writtenByLowerCase = new Map(changes.writes.map(write => [write.file.toLowerCase(), write.file]));
    for (const file of changes.deletes) {
      const twin = writtenByLowerCase.get(file.toLowerCase());
      if (twin) {
        const [old, current] = await Promise.all(
          [file, twin].map(name => fs.stat(path.join(WIKI_DIR, name)).catch(() => null))
        );
        if (!old || (current && old.ino === current.ino && old.dev === current.dev)) continue;
      }
      await fs.rm(path.join(WIKI_DIR, file), { force: true });
    }
    if (aliasesChanged) await fs.writeFile(path.join(WIKI_DIR, 'aliases.json'), aliasesText, 'utf8');
  }

  const archived = [...(await readArchive()).values()];
  const pages = livePages.length - changes.excluded.length;
  const report = {
    checkedAt,
    wiki: WIKI_BASE,
    source: 'dump',
    dump: dumpName,
    dumpDate: scan.latest,
    status: dryRun && differences ? 'differs' : 'match',
    pages,
    matched: dryRun ? pages - changes.outdated.length - changes.missing.length - changes.newer.length : pages,
    // Pages the archive holds at a later revision than the dump: kept, never rolled back.
    newerThanDump: changes.newer,
    obsolete: archived.filter(entry => entry.meta.status === 'current' && entry.meta.obsolete).length,
    excluded: changes.excluded.length,
    removed: archived
      .filter(entry => entry.meta.status === 'removed')
      .map(entry => entry.meta.title)
      .sort(),
    aliases: Object.keys(aliases).length,
    unlinkedIngredients: unlinked,
    facts: Object.keys(FACTS).length,
    staleFacts,
    ...(dryRun
      ? {
          outdated: changes.outdated,
          missing: changes.missing,
          removedUpstream: changes.removed,
          filesToRewrite: differences
        }
      : {})
  };
  await writeVerification(report);

  if (dryRun) {
    if (staleFacts.length) console.log(`❌ ${staleFacts.length} cited fact(s) no longer match the dump.`);
    console.log(
      differences
        ? `❌ The archive differs from the dump: ${changes.outdated.length} outdated, ${changes.missing.length} missing, ${changes.removed.length} removed upstream, ${differences} file(s) to rewrite. Run pnpm sync:wiki --from-dump ${dump}.`
        : `✅ The archive matches the dump: ${report.matched}/${pages} pages at their revision in ${dumpName}.`
    );
    return !differences && !staleFacts.length;
  }
  console.log(
    `✅ Synced ${pages} pages: ${changes.writes.length} written, ${changes.deletes.length} renamed, ${changes.removed.length} marked removed, ${changes.newer.length} kept at a newer revision than the dump, ${changes.excluded.length} player-found pages skipped.`
  );
  return true;
}

// ---------------------------------------------------------------------------
// Indexes (derived, git-ignored): index.json, offline-bundle.js, game-data.json, facts.json
// Committed inputs: the .md archive and aliases.json.
// ---------------------------------------------------------------------------
async function buildIndexes(): Promise<void> {
  const articles: (Record<string, unknown> & { category: string; title: string })[] = [];
  const items: object[] = [];
  for (const base of ['', 'custom/']) {
    for (const folder of FOLDERS) {
      const dir = path.join(WIKI_DIR, base, folder);
      const files = (await fs.readdir(dir).catch(() => [])).filter(file => file.endsWith('.md')).sort();
      for (const file of files) {
        const parsed = parseFrontmatter(await fs.readFile(path.join(dir, file), 'utf8'));
        const { body } = parsed;
        // Hand-written articles in custom/ only need a title and summary; unquoted numbers ("title: 1984") are text.
        const meta = base
          ? CustomMeta.parse(parsed.meta)
          : readMeta(`${base}${folder}/${file}`, parsed.meta);
        const slug = file.slice(0, -3);
        const isWiki = !base && Boolean(meta.revId);
        const entry = {
          title: meta.title || slug.replace(/_/g, ' '),
          slug,
          category: folder,
          path: `wiki/${base}${folder}/${file}`,
          summary: meta.summary || summarize(body),
          source: isWiki ? 'wiki' : 'custom',
          ...(isWiki
            ? {
                url: meta.source,
                kind: meta.kind,
                revId: meta.revId,
                revTimestamp: meta.revTimestamp,
                version: meta.version,
                ...(meta.obsolete ? { obsolete: true } : {}),
                ...(meta.status === 'removed' ? { removed: true } : {})
              }
            : {})
        };
        articles.push({ ...entry, body, ...(meta.data?.recipes?.length ? { recipes: meta.data.recipes } : {}) });
        if (isWiki)
          items.push({
            ...entry,
            fields: meta.data?.fields || {},
            value: meta.data?.value,
            recipes: meta.data?.recipes || []
          });
      }
    }
  }
  articles.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));

  const aliases = Aliases.parse(
    JSON.parse(await fs.readFile(path.join(WIKI_DIR, 'aliases.json'), 'utf8').catch(() => '{}'))
  );
  // The light index only carries what the main app's header search shows.
  const index = articles.map(({ title, category, path, summary, source, obsolete, removed }) => ({
    title,
    category,
    path,
    summary,
    source,
    ...(obsolete ? { obsolete } : {}),
    ...(removed ? { removed } : {})
  }));
  await fs.writeFile(path.join(WIKI_DIR, 'index.json'), `${JSON.stringify(index)}\n`, 'utf8');
  // Loaded via <script>: the Codex's full-text search, and the fallback when fetch() is unavailable (file://).
  await fs.writeFile(
    path.join(WIKI_DIR, 'offline-bundle.js'),
    `window.WIKI_OFFLINE_BUNDLE = ${JSON.stringify({ aliases, articles })};\n`,
    'utf8'
  );
  // The structured dataset for deterministic tools: one record per wiki page, recipes included.
  await fs.writeFile(
    path.join(WIKI_DIR, 'game-data.json'),
    `${JSON.stringify({ schema: 1, source: WIKI_BASE, license: LICENSE, aliases, items })}\n`,
    'utf8'
  );
  // The galaxy picker's list: the current Galaxy pages numbered 1–256 (variants like "Euclid (NEXT)" are obsolete).
  const galaxies = new Map<number, { n: number; name: string; type: string; path: string }>();
  for (const item of items as { category: string; title: string; path: string; fields: Record<string, string>; obsolete?: boolean; removed?: boolean }[]) {
    const n = Number(item.fields.order);
    if (item.category !== 'galaxies' || item.obsolete || item.removed || !Number.isInteger(n) || n < 1 || n > 256) continue;
    if (!galaxies.has(n)) galaxies.set(n, { n, name: item.title, type: item.fields.type ?? '', path: item.path });
  }
  if (galaxies.size !== 256) console.warn(`⚠️  ${galaxies.size} of 256 galaxies have a numbered page; the picker lists those.`);
  await fs.writeFile(
    path.join(WIKI_DIR, 'galaxies.json'),
    `${JSON.stringify({ schema: 1, galaxies: [...galaxies.values()].sort((a, b) => a.n - b.n) })}\n`,
    'utf8'
  );
  // The cited facts whose quote is in the archived page; the app applies none other.
  const factPages = new Map<string, FactPage>();
  for (const article of articles) {
    if (article.source !== 'wiki' || article.removed || typeof article.body !== 'string') continue;
    factPages.set(article.title, {
      path: String(article.path),
      url: String(article.url),
      revId: Number(article.revId),
      body: article.body
    });
  }
  const { found, stale } = checkFacts(factPages);
  const glyphs = glyphTable(articles);
  const planets = planetFacts(articles);
  const galaxyMap = galaxyMapFacts(articles);
  for (const fact of stale) console.warn(`⚠️  Cited fact ${fact.id} (${fact.page}) left out: ${fact.reason}.`);
  // The game version the runs are checked against: the newest Update page.
  // Every item above was built with a title, category, path, url and fields, which is all an UpdatePage reads.
  const game = currentGameVersion(items as UpdatePage[]);
  if (!game) console.warn('⚠️  No current Update page: runs can\'t say which game version they were checked against.');
  await fs.writeFile(
    path.join(WIKI_DIR, 'facts.json'),
    `${JSON.stringify({ schema: 1, facts: found, ...(game ? { game } : {}), glyphs, ...(planets ? { planets } : {}), ...(galaxyMap ? { galaxyMap } : {}) }, null, 2)}\n`,
    'utf8'
  );
  console.log(
    `🎉 Indexed ${articles.length} articles (${items.length} wiki pages) into wiki/index.json, offline-bundle.js and game-data.json`
  );
}

// The value after a flag (`--from-dump file`), or null.
// The portal glyphs' names, read from their 16 pages. The app shows them beside every portal address, so a page that
// goes missing or stops naming its glyph fails the index (and the build) rather than shipping a gap.
function glyphTable(articles: { title: string; path?: unknown; source?: unknown; removed?: unknown; revId?: unknown; body?: unknown }[]): GlyphTable {
  const glyphs: Glyph[] = [];
  const problems: string[] = [];
  for (const article of articles) {
    const digit = glyphPageDigit(article.title);
    if (!digit || article.source !== 'wiki' || article.removed || typeof article.body !== 'string') continue;
    const names = parseGlyphNames(article.body);
    if (names) glyphs.push({ digit, ...names, path: String(article.path), revId: Number(article.revId) });
    else problems.push(`${article.title} no longer says what the glyph is called`);
  }
  const overview = articles.find(article => article.title === 'Glyph' && article.source === 'wiki' && !article.removed);
  for (const digit of '0123456789ABCDEF') if (!glyphs.some(glyph => glyph.digit === digit)) problems.push(`no page for glyph ${digit}`);
  if (!overview) problems.push('no Glyph page');
  if (problems.length || !overview) throw new Error(`Glyph names: ${problems.join('; ')}.`);
  return GlyphTableSchema.parse({
    page: overview.title,
    path: String(overview.path),
    glyphs: glyphs.sort((a, b) => parseInt(a.digit, 16) - parseInt(b.digit, 16))
  });
}

// What the planet editor offers: the biomes with their name prefixes and weather, the sentinel words by level, and the
// discovery page's flora and fauna words. Unlike the glyphs, a gap only costs suggestions (the fields stay typed), so
// a missing page warns and leaves the planets out rather than failing the build.
type IndexedArticle = { title: string; path?: unknown; source?: unknown; removed?: unknown; revId?: unknown; body?: unknown };
function planetFacts(articles: IndexedArticle[]): PlanetFacts | null {
  const live = (article: IndexedArticle): article is IndexedArticle & { body: string } =>
    article.source === 'wiki' && !article.removed && typeof article.body === 'string';
  const source = (article: IndexedArticle) => ({ page: article.title, path: String(article.path), revId: Number(article.revId) });
  const resourcePages = new Map(
    articles
      .filter(article => live(article) && (article as { category?: unknown }).category === 'resources')
      .map(article => [article.title.toLowerCase(), article.title])
  );
  const biomes = articles.flatMap(article => {
    const name = biomePageName(article.title);
    if (!name || !live(article)) return [];
    const resources = resourceLinks(article.body).flatMap(title => resourcePages.get(title.toLowerCase()) ?? []);
    return [
      {
        ...source(article),
        name,
        descriptors: parseBiomeDescriptors(article.body),
        weather: parseBiomeWeather(article.body),
        resources: [...new Set(resources)]
      }
    ];
  });
  // The Reliquary's name sets, each resolved to the biome it names ("Radioactive" is an Irradiated prefix).
  const setBiome = (set: string) => {
    const word = set.toLowerCase();
    const byName = biomes.find(biome => biome.name.toLowerCase() === word);
    const byPrefix = biomes.filter(biome => biome.descriptors.some(name => name.toLowerCase() === word));
    return byName?.name ?? (byPrefix.length === 1 ? byPrefix[0]?.name : undefined);
  };
  for (const biome of biomes) {
    const article = articles.find(item => item.title === biome.page && live(item));
    const sets = article && live(article) ? parseRuinedSets(article.body) : [];
    const ruined = sets.flatMap(set => {
      const name = setBiome(set.set);
      return name ? [{ biome: name, names: set.names }] : [];
    });
    if (ruined.length) Object.assign(biome, { ruined });
  }
  const starPage = articles.find(article => article.title === 'Star system' && live(article));
  const metals = starPage && live(starPage) ? parseStarMetals(starPage.body) : {};
  const deposits = articles
    .filter(article => live(article) && (article as { category?: unknown }).category === 'resources' && isDeposit(article.body))
    .map(source);
  const finds = articles.filter(article => live(article) && isScanFind(article.body)).map(source);
  if (!Object.keys(metals).length) console.warn('⚠️  Planets: the Star system page no longer says which metal each star colour gives.');
  const sentinelPage = articles.find(article => article.title === 'Sentinel' && live(article));
  const lifePage = articles.find(article => article.title === 'Planet - Discovery Menu' && live(article));
  const sentinels = sentinelPage && live(sentinelPage) ? parseSentinelWords(sentinelPage.body) : null;
  const life = lifePage && live(lifePage) ? parseLifeWords(lifePage.body) : null;
  const problems = [
    !biomes.length && 'no Biome pages',
    ...biomes.filter(biome => !biome.descriptors.length).map(biome => `Biome - ${biome.name} lists no name prefixes`),
    !sentinels && 'the Sentinel page no longer has its activity table',
    !life && 'the Planet - Discovery Menu page no longer lists flora and fauna words'
  ].filter(Boolean);
  for (const problem of problems) console.warn(`⚠️  Planets: ${String(problem)}.`);
  if (!sentinelPage || !lifePage || !sentinels || !life || !biomes.length) return null;
  return PlanetFactsSchema.parse({
    biomes: biomes.sort((a, b) => a.name.localeCompare(b.name)),
    sentinels: { ...source(sentinelPage), ...sentinels },
    life: { ...source(lifePage), ...life },
    ...(starPage && Object.keys(metals).length ? { starMetals: { ...source(starPage), metals } } : {}),
    deposits: deposits.sort((a, b) => a.page.localeCompare(b.page)),
    finds: finds.sort((a, b) => a.page.localeCompare(b.page))
  });
}

// What the system editor offers for the galaxy map's "F4 // Water" and "Prospecting // Opulent": the colour each
// spectral class letter gives, the economy strength words, and each economy type's names. A gap costs suggestions
// only, so it warns and leaves the block out.
function galaxyMapFacts(articles: IndexedArticle[]): GalaxyMapFacts | null {
  const page = (title: string) =>
    articles.find(
      (article): article is IndexedArticle & { body: string } =>
        article.title === title && article.source === 'wiki' && !article.removed && typeof article.body === 'string'
    );
  const source = (article: IndexedArticle) => ({ page: article.title, path: String(article.path), revId: Number(article.revId) });
  const spectralPage = page('Spectral class');
  const economyPage = page('Economy');
  const classes = spectralPage && parseSpectralClasses(spectralPage.body);
  const strength = economyPage && parseEconomyStrength(economyPage.body);
  const types = articles.flatMap(article => {
    const name = /^(.+) Economy$/.exec(article.title)?.[1];
    const found = name ? page(article.title) : undefined;
    const names = found ? parseEconomyNames(found.body) : [];
    return found && name && names.length ? [{ ...source(found), name, names }] : [];
  });
  const problems = [
    !classes && 'the Spectral class page no longer has its class table',
    !strength && 'the Economy page no longer has its strength words',
    types.length < 7 && `only ${String(types.length)} economy types list their names`
  ].filter(Boolean);
  for (const problem of problems) console.warn(`⚠️  Galaxy map: ${String(problem)}.`);
  if (!spectralPage || !economyPage || !classes || !strength || !types.length) return null;
  return GalaxyMapFactsSchema.parse({
    spectral: { ...source(spectralPage), classes },
    economy: { ...source(economyPage), strength, types: types.sort((a, b) => a.name.localeCompare(b.name)) }
  });
}

function option(args: string[], flag: string): string | null {
  const at = args.indexOf(flag);
  const value = at === -1 ? undefined : args[at + 1];
  return value && !value.startsWith('--') ? value : null;
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  await fs.mkdir(WIKI_DIR, { recursive: true });
  const discoverFrom = option(args, '--discover');
  if (discoverFrom) {
    const out = option(args, '--out');
    if (!out) throw new Error('--discover needs --out <report.md>: the report is planning, kept outside wiki/');
    const report = await discover(discoverFrom);
    await fs.writeFile(out, reportMarkdown(report, path.basename(discoverFrom)), 'utf8');
    console.log(
      `🧭 ${report.articles} articles: ${report.infoboxes.length} infoboxes and ${report.categories.length} large categories without one. Report: ${out}`
    );
    return;
  }
  if (args.includes('--index-only')) {
    await buildIndexes();
    return;
  }
  const dump = option(args, '--from-dump');
  if (!dump) {
    console.error(
      '❌ The wiki is refreshed from a database dump only (ADR-0009): pnpm sync:wiki --from-dump <file>. Download the dump from the wiki\'s Special:Statistics and keep it outside the repo.'
    );
    process.exitCode = 1;
    return;
  }
  if (args.includes('--verify')) {
    process.exitCode = (await sync({ dump, dryRun: true })) ? 0 : 1;
    return;
  }
  if (!(await sync({ dump, dryRun: false }))) process.exitCode = 1;
  await buildIndexes();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((err: unknown) => {
    console.error('❌ sync-wiki failed:', err);
    process.exitCode = 1;
  });
}
