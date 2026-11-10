// What the Systems screen shows (pure): the filtered, sorted list, the tag cloud and the summary lines, plus the
// Outlaw Run's "Paste a list" parser.
import { conflictReading, type ConflictReading } from './galaxy-map.ts';
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

// The Systems filters (round 8, c21): a panel with the same groups on a phone (a sheet) and the Workbench (a
// popover), and the active filters as removable chips under the toolbar. Facet values come from the wiki's lists
// (star classes, races, conflict levels) and show only when the log has them; a group with one value left is
// hidden, unless that value is on. Tags are the player's own, exactly as typed, most used first. Counts are the
// whole log's, so they don't jump as filters change; the match count is the live one.
export interface FacetOption {
  value: string;
  label: string;
  count: number;
  on: boolean;
  /** Star class options draw the star's colour. */
  star?: StarClass;
  /** Conflict options draw 1–3 stars, or the skull for an outlaw system (0 with `pirate`). */
  stars?: number;
  pirate?: boolean;
  /** What a screen reader hears: "Medium, 2 of 3 stars, 16 systems". */
  spoken: string;
  /** What tapping it sets on the filter. */
  next: Partial<SystemFilter>;
}
export interface ShowOnly {
  key: 'favorites' | 'unmapped';
  label: string;
  hint: string;
  count: number;
  on: boolean;
  next: Partial<SystemFilter>;
}
export interface ActiveFilter {
  id: string;
  label: string;
  /** "Remove filter: Yellow star", "Remove filter: tag base". */
  spoken: string;
  star?: StarClass;
  stars?: number;
  pirate?: boolean;
  favourite?: boolean;
  /** What removing it sets on the filter. */
  next: Partial<SystemFilter>;
}
export interface FilterPanel {
  showOnly: ShowOnly[];
  star: FacetOption[];
  race: FacetOption[];
  conflict: FacetOption[];
  tags: FacetOption[];
  active: ActiveFilter[];
}

const systemsWord = (n: number) => plural(n, 'system');
export const CLEAR_FILTERS: Partial<SystemFilter> = {
  tags: [],
  star: '',
  race: '',
  conflict: '',
  favorites: false,
  unmapped: false
};
const CONFLICT_STAR_COUNT: Record<ConflictLevel, number> = { low: 1, medium: 2, high: 3, pirate: 0 };
const conflictName = (level: ConflictLevel) => (level === 'pirate' ? 'Pirate' : CONFLICT_LEVELS[level]);

export function filterPanel(systems: System[], filter: SystemFilter): FilterPanel {
  const count = (keep: (system: System) => boolean) => systems.filter(keep).length;
  // A one-at-a-time group: the values the log has; hidden when one is left and it isn't the one picked.
  const facet = <K extends 'star' | 'race' | 'conflict'>(
    key: K,
    values: Exclude<SystemFilter[K], ''>[],
    describe: (value: Exclude<SystemFilter[K], ''>, n: number) => Omit<FacetOption, 'count' | 'on' | 'next' | 'value'>
  ): FacetOption[] => {
    const options = values.flatMap(value => {
      const n = count(system => system[key] === value);
      const on = filter[key] === value;
      return n || on ? [{ value, count: n, on, next: { [key]: on ? '' : value }, ...describe(value, n) }] : [];
    });
    return options.length > 1 || options.some(option => option.on) ? options : [];
  };
  const star = facet('star', Object.keys(STAR_CLASSES) as StarClass[], (value, n) => ({
    label: STAR_CLASSES[value].label,
    star: value,
    spoken: `${STAR_CLASSES[value].label}, ${systemsWord(n)}`
  }));
  const race = facet('race', Object.keys(RACES) as Race[], (value, n) => ({
    label: RACES[value],
    spoken: `${RACES[value]}, ${systemsWord(n)}`
  }));
  const conflict = facet('conflict', Object.keys(CONFLICT_LEVELS) as ConflictLevel[], (value, n) => ({
    label: conflictName(value),
    stars: CONFLICT_STAR_COUNT[value],
    pirate: value === 'pirate',
    spoken:
      value === 'pirate'
        ? `Pirate, outlaw, ${systemsWord(n)}`
        : `${CONFLICT_LEVELS[value]}, ${String(CONFLICT_STAR_COUNT[value])} of 3 stars, ${systemsWord(n)}`
  }));
  const tagged = (tag: string) => count(system => systemTags(system).has(tag));
  const tags = tagCounts(systems)
    .map(([tag]) => [tag, tagged(tag)] as const)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, n]): FacetOption => {
      const on = filter.tags.includes(tag);
      return {
        value: tag,
        label: tag,
        count: n,
        on,
        spoken: `${tag}, ${systemsWord(n)}`,
        next: { tags: on ? filter.tags.filter(item => item !== tag) : [...filter.tags, tag] }
      };
    });
  const showOnly: ShowOnly[] = [];
  const favourites = count(system => system.favorite);
  if (favourites || filter.favorites)
    showOnly.push({
      key: 'favorites',
      label: 'Favourites',
      hint: 'Systems you starred',
      count: favourites,
      on: filter.favorites,
      next: { favorites: !filter.favorites }
    });
  const unmapped = count(system => !systemMapped(system));
  if (unmapped || filter.unmapped)
    showOnly.push({
      key: 'unmapped',
      label: 'Not mapped',
      hint: 'No portal address yet',
      count: unmapped,
      on: filter.unmapped,
      next: { unmapped: !filter.unmapped }
    });

  const active: ActiveFilter[] = [];
  if (filter.star)
    active.push({
      id: 'star',
      label: STAR_CLASSES[filter.star].label,
      spoken: `Remove filter: ${STAR_CLASSES[filter.star].label} star`,
      star: filter.star,
      next: { star: '' }
    });
  if (filter.race)
    active.push({
      id: 'race',
      label: RACES[filter.race],
      spoken: `Remove filter: ${RACES[filter.race]}`,
      next: { race: '' }
    });
  if (filter.conflict)
    active.push({
      id: 'conflict',
      label: conflictName(filter.conflict),
      spoken:
        filter.conflict === 'pirate'
          ? 'Remove filter: Pirate, outlaw'
          : `Remove filter: ${CONFLICT_LEVELS[filter.conflict]} conflict, ${String(CONFLICT_STAR_COUNT[filter.conflict])} of 3`,
      stars: CONFLICT_STAR_COUNT[filter.conflict],
      pirate: filter.conflict === 'pirate',
      next: { conflict: '' }
    });
  filter.tags.forEach(tag => {
    active.push({
      id: `tag-${tag}`,
      label: tag,
      spoken: `Remove filter: tag ${tag}`,
      next: { tags: filter.tags.filter(item => item !== tag) }
    });
  });
  if (filter.favorites)
    active.push({
      id: 'favorites',
      label: 'Favourites',
      spoken: 'Remove filter: Favourites',
      favourite: true,
      next: { favorites: false }
    });
  if (filter.unmapped)
    active.push({
      id: 'unmapped',
      label: 'Not mapped',
      spoken: 'Remove filter: Not mapped',
      next: { unmapped: false }
    });
  return { showOnly, star, race, conflict, tags, active };
}

const list = (items: string[]) =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;

/** 02g: what clashes when nothing matches, "Nothing is Purple, Pirate and tagged “home” at once." */
export function nothingMatches(filter: SystemFilter): string {
  const tags = filter.tags.map(tag => `“${tag}”`);
  const traits = [
    filter.star ? STAR_CLASSES[filter.star].label : '',
    filter.race ? RACES[filter.race] : '',
    filter.conflict ? (filter.conflict === 'pirate' ? 'Pirate' : `${CONFLICT_LEVELS[filter.conflict]} conflict`) : '',
    filter.favorites ? 'a favourite' : '',
    filter.unmapped ? 'not mapped' : '',
    tags.length ? `tagged ${list(tags)}` : ''
  ].filter(Boolean);
  const q = filter.q.trim();
  const is = traits.length ? `is ${list(traits)}${traits.length > 1 || tags.length > 1 ? ' at once' : ''}` : '';
  const what = [is, q ? `matches “${q}”` : ''].filter(Boolean).join(' and ');
  return `Nothing ${what || 'matches'}.`;
}

// The one-line summary under a system's name, as parts; the economy part carries the wealth for its stars.
export interface MetaPart {
  text: string;
  wealth?: number;
  /** The conflict, as the game shows it: "★★ Rowdy" (c22). An outlaw system isn't here: it's a pill above the name. */
  conflict?: ConflictReading;
}
export function systemMeta(system: System): MetaPart[] {
  const parts: MetaPart[] = [
    { text: system.region },
    { text: system.galaxy },
    { text: system.race ? RACES[system.race] : '' },
    { text: system.economy, wealth: system.wealth }
  ];
  const conflict = conflictReading(system, CONFLICT_LEVELS);
  if (conflict && !conflict.pirate) parts.push({ text: conflict.text, conflict });
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
