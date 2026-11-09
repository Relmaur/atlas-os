// What the Systems screen shows (pure): the filtered, sorted list, the tag cloud and the summary lines, plus the
// Outlaw Run's "Paste a list" parser.
import {
  CONFLICT_LEVELS,
  OUTLAW_TAG,
  RACES,
  SORTS,
  STAR_CLASSES,
  SUGGESTED_TAGS,
  lastVisit,
  normalizeGlyphs,
  systemHaystack,
  systemMapped,
  systemTags,
  type ConflictLevel,
  type Race,
  type StarClass,
  type System
} from './systems-model.ts';

export type SystemSort = keyof typeof SORTS;
export interface SystemFilter {
  q: string;
  tags: string[];
  star: StarClass | '';
  race: Race | '';
  conflict: ConflictLevel | '';
  favorites: boolean;
  /** Only the systems with no portal address yet (round 7c). */
  unmapped: boolean;
  sort: SystemSort;
}
export const DEFAULT_FILTER: SystemFilter = {
  q: '',
  tags: [],
  star: '',
  race: '',
  conflict: '',
  favorites: false,
  unmapped: false,
  sort: 'recent'
};

const lastAt = (system: System) => Date.parse(lastVisit(system)?.at ?? system.createdAt);
const SORTERS: Record<SystemSort, (a: System, b: System) => number> = {
  recent: (a, b) => lastAt(b) - lastAt(a),
  discovered: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  name: (a, b) => a.name.localeCompare(b.name),
  rating: (a, b) => b.rating - a.rating || Number(b.favorite) - Number(a.favorite) || lastAt(b) - lastAt(a),
  region: (a, b) =>
    Number(!a.region) - Number(!b.region) || a.region.localeCompare(b.region) || a.name.localeCompare(b.name)
};

// Every search token must match somewhere (name, notes, planets, tags…); favourites come first except in the
// alphabetical sorts, where pinning them would hide the order the person asked for.
export function filterSystems(systems: System[], filter: SystemFilter): System[] {
  const tokens = filter.q.toLowerCase().split(/\s+/).filter(Boolean);
  const pinFavorites = filter.sort !== 'name' && filter.sort !== 'region';
  return systems
    .filter(system => {
      if (filter.favorites && !system.favorite) return false;
      if (filter.unmapped && systemMapped(system)) return false;
      if (filter.star && system.star !== filter.star) return false;
      if (filter.race && system.race !== filter.race) return false;
      if (filter.conflict && system.conflict !== filter.conflict) return false;
      const tags = systemTags(system);
      if (!filter.tags.every(tag => tags.has(tag))) return false;
      if (tokens.length) {
        const haystack = systemHaystack(system);
        if (!tokens.every(token => haystack.includes(token))) return false;
      }
      return true;
    })
    .sort((a, b) => (pinFavorites ? Number(b.favorite) - Number(a.favorite) : 0) || SORTERS[filter.sort](a, b));
}

export function filterActive(filter: SystemFilter): boolean {
  return Boolean(
    filter.q ||
    filter.tags.length ||
    filter.star ||
    filter.race ||
    filter.conflict ||
    filter.favorites ||
    filter.unmapped
  );
}

// Every tag on systems and their planets with how often it's used, most used first.
export function tagCounts(systems: System[]): [string, number][] {
  const counts = new Map<string, number>();
  systems.forEach(system => {
    [...system.tags, ...system.planets.flatMap(planet => planet.tags)].forEach(tag =>
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    );
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// Tag suggestions for the editor: tags already in use (in the order they first appear), then the built-in ones.
export function tagSuggestions(systems: System[], exclude: string[], query: string): string[] {
  const used = systems.flatMap(system => [...system.tags, ...system.planets.flatMap(planet => planet.tags)]);
  return [...new Set([...used, ...SUGGESTED_TAGS])].filter(tag => !exclude.includes(tag) && tag.includes(query));
}

export function systemsSummary(systems: System[]): {
  systems: number;
  planets: number;
  visits: number;
  galaxies: string[];
} {
  return {
    systems: systems.length,
    planets: systems.reduce((sum, system) => sum + system.planets.length, 0),
    visits: systems.reduce((sum, system) => sum + system.visits.length, 0),
    galaxies: [...new Set(systems.map(system => system.galaxy).filter(Boolean))]
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${String(n)} ${n === 1 ? one : many}`;

// The line under the Systems title: "2 systems · 5 planets · 1 visit · Euclid". One galaxy is named; more are counted.
export function systemsLine(systems: System[]): string {
  const { planets, visits, galaxies } = systemsSummary(systems);
  const where =
    galaxies.length === 1 ? galaxies[0] : galaxies.length ? plural(galaxies.length, 'galaxy', 'galaxies') : '';
  return [plural(systems.length, 'system'), plural(planets, 'planet'), plural(visits, 'visit'), where]
    .filter(Boolean)
    .join(' · ');
}

// The Systems screen's chip rail (design 02): All, then each star colour, Favourites, every tag, each race and
// conflict level, only those the log actually has. Star colours and Favourites carry counts. Star, race and conflict
// pick one at a time (a system has one of each); tags combine. All clears the chips but keeps the search and sort.
export interface FilterChip {
  id: string;
  label: string;
  count: number | null;
  /** Star chips draw the star's colour beside the label. */
  star?: StarClass;
  /** A Phosphor icon drawn before the label ("map-pin-plus" on Not mapped). */
  icon?: string;
  on: boolean;
  /** What tapping it sets on the filter. */
  next: Partial<SystemFilter>;
}

export function filterChips(systems: System[], filter: SystemFilter): FilterChip[] {
  const count = (keep: (system: System) => boolean) => systems.filter(keep).length;
  const chipped = Boolean(
    filter.tags.length || filter.star || filter.race || filter.conflict || filter.favorites || filter.unmapped
  );
  const chips: FilterChip[] = [
    {
      id: 'all',
      label: 'All',
      count: systems.length,
      on: !chipped,
      next: { tags: [], star: '', race: '', conflict: '', favorites: false, unmapped: false }
    }
  ];
  // Round 7c: the systems with no address yet, right after All, only while there are some (or it's on).
  const unmapped = count(system => !systemMapped(system));
  if (unmapped || filter.unmapped)
    chips.push({
      id: 'unmapped',
      label: 'Not mapped',
      count: unmapped,
      icon: 'map-pin-plus',
      on: filter.unmapped,
      next: { unmapped: !filter.unmapped }
    });
  (Object.keys(STAR_CLASSES) as StarClass[]).forEach(star => {
    const n = count(system => system.star === star);
    if (n)
      chips.push({
        id: `star-${star}`,
        label: STAR_CLASSES[star].label,
        count: n,
        star,
        on: filter.star === star,
        next: { star: filter.star === star ? '' : star }
      });
  });
  const favorites = count(system => system.favorite);
  if (favorites)
    chips.push({
      id: 'favorites',
      label: 'Favourites',
      count: favorites,
      on: filter.favorites,
      next: { favorites: !filter.favorites }
    });
  tagCounts(systems).forEach(([tag]) => {
    const on = filter.tags.includes(tag);
    chips.push({
      id: `tag-${tag}`,
      label: tag,
      count: null,
      on,
      next: { tags: on ? filter.tags.filter(item => item !== tag) : [...filter.tags, tag] }
    });
  });
  (Object.keys(RACES) as Race[]).forEach(race => {
    if (count(system => system.race === race))
      chips.push({
        id: `race-${race}`,
        label: RACES[race],
        count: null,
        on: filter.race === race,
        next: { race: filter.race === race ? '' : race }
      });
  });
  (Object.keys(CONFLICT_LEVELS) as ConflictLevel[]).forEach(conflict => {
    if (count(system => system.conflict === conflict))
      chips.push({
        id: `conflict-${conflict}`,
        label: conflict === 'pirate' ? CONFLICT_LEVELS.pirate : `${CONFLICT_LEVELS[conflict]} conflict`,
        count: null,
        on: filter.conflict === conflict,
        next: { conflict: filter.conflict === conflict ? '' : conflict }
      });
  });
  return chips;
}

// The one-line summary under a system's name, as parts; the economy part carries the wealth for its stars.
export interface MetaPart {
  text: string;
  wealth?: number;
}
export function systemMeta(system: System): MetaPart[] {
  const parts: MetaPart[] = [
    { text: system.region },
    { text: system.galaxy },
    { text: system.race ? RACES[system.race] : '' },
    { text: system.economy, wealth: system.wealth },
    {
      text: system.conflict
        ? `${CONFLICT_LEVELS[system.conflict]}${system.conflict === 'pirate' ? '' : ' conflict'}`
        : ''
    }
  ];
  return parts.filter(part => part.text || part.wealth);
}

export interface ParsedOutlawSystem {
  name: string;
  glyphs: string;
  region: string;
  notes: string;
  conflict: 'pirate';
  tags: string[];
}
// One system per line: `Name | Glyphs | Region | Notes…` (only the name is required).
export function parseOutlawList(text: string): { systems: ParsedOutlawSystem[] } | { error: string } {
  const parsed = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [name = '', glyphs = '', region = '', ...notes] = line.split('|').map(part => part.trim());
      return {
        name,
        glyphs: normalizeGlyphs(glyphs),
        region,
        notes: notes.join(' | '),
        conflict: 'pirate' as const,
        tags: [OUTLAW_TAG]
      };
    });
  if (!parsed.length) return { error: 'Paste at least one system, one per line.' };
  const bad = parsed.findIndex(item => !item.name || (item.glyphs && item.glyphs.length !== 12));
  if (bad !== -1) return { error: `Line ${bad + 1}: needs a name, and glyphs must be exactly 12 hex digits.` };
  return { systems: parsed };
}
