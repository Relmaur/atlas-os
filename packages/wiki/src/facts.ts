// Cited facts (ADR-0003): game rules the wiki states in prose, as data, each with the sentence that states it.
// The value is typed by @atlas/core/facts; the quote must appear, word for word, in the page's archived text (bold,
// links and line breaks aside). The sync checks it at every run: a quote the wiki no longer has makes the fact stale,
// `verify:wiki` fails, and the fact is left out of wiki/facts.json until someone rereads the page and updates it here.
import type { CitedFact, FactId, FactValue, GameVersion } from '@atlas/core/facts';
import { plainText } from '@atlas/core/search';

interface FactSource<Id extends FactId> {
  page: string; // the wiki page's title
  quote: string;
  value: FactValue<Id>;
}

export const FACTS = {
  'supercharged-per-class': {
    page: 'Supercharged Slot',
    quote: '1 supercharged slot in Class C, 2 in Class B, 3 in Class A, and 4 in Class S',
    value: { C: 1, B: 2, A: 3, S: 4 }
  },
  'supercharged-fixed-count': {
    page: 'Supercharged Slot',
    quote:
      'For the Exosuit and Exocraft, there are always three supercharged slots, which are in the same positions for all players',
    value: 3
  },
  'exosuit-supercharged-slots': {
    page: 'Exosuit',
    quote:
      'Exosuit technology inventory has 3 supercharged slots: 1st row 5th column, 2nd row 9th column and 3rd row 3rd column',
    value: ['R1C5', 'R2C9', 'R3C3']
  },
  'multitool-tech-max': {
    page: 'Inventory',
    quote:
      'The maximum number of inventory slots for a multi-tool is 30 (10x3) for a C or B-class multi-tool, 45 (10x4 + 5) for an A-class multi-tool, and 60 (10x6) for an S-class multi-tool',
    value: { columns: 10, slots: { C: 30, B: 30, A: 45, S: 60 } }
  },
  'starship-tech-max': {
    page: 'Inventory',
    quote: 'Any S-class ship can be upgraded to have 60 technology slots (10x6)',
    value: { columns: 10, slots: { S: 60 } }
  },
  'exosuit-tech-max': {
    page: 'Inventory',
    // The page writes the Exosuit's grids as "rows x columns" ("120 (12x10)"); its supercharged slots reach column 9.
    quote: 'This inventory begins with 10 Technology slots installed. The maximum number of inventory slots for this category is 60 (6x10)',
    value: { columns: 10, slots: { any: 60 } }
  },
  // Biome families for the planet marker: each quote is from its biome's own section of the Biome page.
  'biome-lush': {
    page: 'Biome',
    quote: 'These are essentially the Earth-like planets',
    value: { biome: 'Lush', family: 'lush' }
  },
  'biome-scorched': {
    page: 'Biome',
    quote: 'high temperatures has caused the flora to adapt in bizarre ways',
    value: { biome: 'Scorched', family: 'hot' }
  },
  'biome-volcanic': {
    page: 'Biome',
    quote: 'Temperatures are high just like on scorched worlds',
    value: { biome: 'Volcanic', family: 'hot' }
  },
  'biome-frozen': {
    page: 'Biome',
    quote: 'Hazard protection is always on due to frigid temperatures',
    value: { biome: 'Frozen', family: 'frozen' }
  },
  'biome-toxic': {
    page: 'Biome',
    quote: 'Hazard protection is always on due to high amounts of toxic substances',
    value: { biome: 'Toxic', family: 'toxic' }
  },
  'biome-irradiated': {
    page: 'Biome',
    quote: 'Hazard protection is always on due to high amounts of radiation',
    value: { biome: 'Irradiated', family: 'radioactive' }
  },
  'biome-exotic': {
    page: 'Biome',
    quote: 'Exotic worlds are characterized by having various mysterious objects not found in any other biomes',
    value: { biome: 'Exotic', family: 'exotic' }
  },
  'biome-mega-exotic': {
    page: 'Biome',
    quote: 'Though they are classified similarly to exotic biomes, they are clearly a class of their own',
    value: { biome: 'Mega Exotic', family: 'exotic' }
  },
  'biome-gas-giant': {
    page: 'Biome - Gas Giant',
    quote: 'the temperature is always similar to the non-storm temperature on an extreme scorched or volcanic world',
    value: { biome: 'Gas Giant', family: 'hot' }
  },
  'biome-barren': {
    page: 'Biome - Barren',
    quote: 'have a surface that is rocky and sometimes sandy',
    value: { biome: 'Barren', family: 'barren' }
  },
  'biome-dead': {
    page: 'Biome - Dead',
    quote: 'When viewed from space, their surfaces are brown, with cracks',
    value: { biome: 'Dead', family: 'dead' }
  },
  'biome-marsh': {
    page: 'Biome - Marsh',
    quote: 'characterized by stump-like, mangrove-inspired non-scannable trees and toxic-like fungi',
    value: { biome: 'Marsh', family: 'marsh' }
  },
  'biome-waterworld': {
    page: 'Biome - Waterworld',
    quote: 'the planet is covered entirely by a vast ocean',
    value: { biome: 'Waterworld', family: 'ocean' }
  },
  // A Reliquary world looks like its main biome: its marker takes that family, with a relic ring.
  'reliquary-main-biome': {
    page: 'Biome - The Reliquary',
    quote: 'however they depends on the main biome of the planet',
    value: true
  },
  'region-light-years': {
    page: 'Portal address',
    quote: 'the proportions of each region are roughly 400ly x 400 ly x 400 ly',
    value: 400
  }
} satisfies { [Id in FactId]: FactSource<Id> };

export interface FactPage {
  path: string; // wiki/<category>/<slug>.md
  url: string;
  revId: number;
  body: string; // the archived Markdown
}

// Bold, links, table bars and line breaks differ between the wiki's text and the archive; the words must not.
const normalize = (text: string) => plainText(text);

// Splits the facts into those whose quote is in its page and those that aren't (page gone, or the sentence changed).
export function checkFacts(pages: Map<string, FactPage>): {
  found: Record<string, CitedFact>;
  stale: { id: string; page: string; reason: string }[];
} {
  const found: Record<string, CitedFact> = {};
  const stale: { id: string; page: string; reason: string }[] = [];
  for (const [id, source] of Object.entries(FACTS)) {
    const page = pages.get(source.page);
    if (!page) stale.push({ id, page: source.page, reason: 'page not in the mirror' });
    else if (!normalize(page.body).includes(normalize(source.quote)))
      stale.push({ id, page: source.page, reason: 'quote no longer on the page' });
    else
      found[id] = {
        page: source.page,
        path: page.path,
        url: page.url,
        revId: page.revId,
        quote: source.quote,
        value: source.value
      };
  }
  return { found, stale };
}

export interface UpdatePage {
  title: string; // "Update 7.10"
  category: string;
  path: string;
  url?: unknown; // the page's wiki address, a string on every mirrored page
  fields: Record<string, unknown>; // the infobox: date, previous, next
  obsolete?: boolean;
  removed?: boolean;
}

/**
 * The current game version: the Update page with no next update (the wiki adds `next` once a newer one is out), the
 * latest-dated if more than one. Version numbers aren't compared, since the wiki writes them both "7.1" and "7.10".
 */
export function currentGameVersion(items: UpdatePage[]): GameVersion | null {
  const latest = items
    .filter(item => item.category === 'updates' && !item.obsolete && !item.removed && !item.fields.next)
    .map(item => ({ item, version: /^Update (\d+(?:\.\d+)+)$/.exec(item.title)?.[1], date: typeof item.fields.date === 'string' ? item.fields.date : '' }))
    .filter(entry => entry.version && !Number.isNaN(Date.parse(entry.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  if (!latest?.version) return null;
  return {
    version: latest.version,
    page: latest.item.title,
    path: latest.item.path,
    url: typeof latest.item.url === 'string' ? latest.item.url : '',
    date: latest.date
  };
}
