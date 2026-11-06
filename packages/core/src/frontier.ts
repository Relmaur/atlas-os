// Firsts (design 26, Frontier; stamps on the Traveller Card, 05): the first time the log holds something new of a
// kind the game has a fixed set of. Each one is dated by the record that earned it, so the card can show the newest.
// Only logged facts count: a star colour, a biome family (by the wiki's cited rules), a race met, a galaxy beyond the
// first, an S-class ship or tool, a starship type.
import type { PlanetLike } from './systems-model.ts';
import type { BiomeFamily } from './facts.ts';
import { classLetter, type GearItem } from './gear.ts';
import { RACES, STAR_CLASSES, type StarClass, type System } from './systems-model.ts';

export interface First {
  key: string; // 'star:purple', 'biome:frozen', 'race:korvax', 'galaxy:calypso', 's-class', 'ship:interceptor'
  label: string; // as the stamp reads: "First purple star"
  at: number; // when the record that earned it was logged (ms)
}

// The races a system can be run by; Uncharted and Abandoned systems meet no one.
const PEOPLES = ['gek', 'korvax', 'vykeen'] as const;
export const FAMILY_LABEL: Record<BiomeFamily, string> = {
  lush: 'lush',
  hot: 'hot',
  frozen: 'frozen',
  toxic: 'toxic',
  radioactive: 'radioactive',
  exotic: 'exotic',
  barren: 'barren',
  dead: 'dead',
  marsh: 'marsh',
  ocean: 'ocean'
};

/** When a system entered the log: created, or first visited if a visit is older. */
export function loggedAt(system: Pick<System, 'createdAt' | 'visits'>): number {
  const times = [system.createdAt, ...system.visits.map(visit => visit.at)]
    .map(value => Date.parse(value))
    .filter(Number.isFinite);
  return times.length ? Math.min(...times) : 0;
}

/** Every first in the log, newest first. `family` maps a planet's biome to its family (from the cited facts). */
export function firsts(
  log: { systems: System[]; gear: GearItem[] },
  family: (planet: PlanetLike) => BiomeFamily | null
): First[] {
  const found = new Map<string, First>();
  const earn = (key: string, label: string, at: number) => {
    const held = found.get(key);
    if (!held || at < held.at) found.set(key, { key, label, at });
  };
  const systems = [...log.systems].sort((a, b) => loggedAt(a) - loggedAt(b));
  const firstGalaxy = (systems[0]?.galaxy.trim() || 'Euclid').toLowerCase();
  for (const system of systems) {
    const at = loggedAt(system);
    if (system.star) earn(`star:${system.star}`, `First ${STAR_CLASSES[system.star].label.toLowerCase()} star`, at);
    if ((PEOPLES as readonly string[]).includes(system.race) && system.race)
      earn(`race:${system.race}`, `Met the ${RACES[system.race]}`, at);
    const galaxy = system.galaxy.trim() || 'Euclid';
    if (galaxy.toLowerCase() !== firstGalaxy) earn(`galaxy:${galaxy.toLowerCase()}`, galaxy, at);
    for (const planet of system.planets) {
      const kind = family(planet);
      if (kind) earn(`biome:${kind}`, `First ${FAMILY_LABEL[kind]} world`, at);
    }
  }
  for (const item of log.gear) {
    const at = Date.parse(item.createdAt) || 0;
    if (classLetter(item.class) === 'S') earn('s-class', 'First S-class', at);
    const type = item.type.trim();
    if (item.kind === 'starship' && type) earn(`ship:${type.toLowerCase()}`, `First ${type}`, at);
  }
  return [...found.values()].sort((a, b) => b.at - a.at || a.label.localeCompare(b.label));
}

// ——— Frontier (design 26): what's still out there, from the same log. ———
const STAR_CHASE: StarClass[] = ['purple', 'blue', 'green', 'red', 'yellow'];
export const FRONTIER_RACES = PEOPLES;
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const SHIP_SLOTS = 6;
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}` : (items[0] ?? '');

export interface Frontier {
  firsts: number;
  next: { title: string; body: string; star: StarClass | null; search: string } | null;
  stars: { have: StarClass[]; total: number; note: string };
  biomes: { have: BiomeFamily[]; total: number; note: string };
  races: { have: (typeof PEOPLES)[number][]; total: number; note: string };
  ships: { have: string[]; slots: number; note: string };
}

export function frontier(
  log: { systems: System[]; gear: GearItem[] },
  family: (planet: PlanetLike) => BiomeFamily | null
): Frontier {
  const stars = STAR_CHASE.filter(star => log.systems.some(system => system.star === star)).reverse();
  const families = Object.keys(FAMILY_LABEL) as BiomeFamily[];
  const biomes = families.filter(kind =>
    log.systems.some(system => system.planets.some(planet => family(planet) === kind))
  );
  const races = PEOPLES.filter(race => log.systems.some(system => system.race === race));
  const shipGear = log.gear.filter(item => item.kind === 'starship' && item.type.trim());
  const types = [...new Set(shipGear.map(item => item.type.trim()))];
  const missingStar = STAR_CHASE.find(star => !stars.includes(star));
  const missingBiome = families.find(kind => !biomes.includes(kind));
  const missingRace = PEOPLES.find(race => !races.includes(race));
  const starLabel = (star: StarClass) => STAR_CLASSES[star].label.toLowerCase();
  const next: Frontier['next'] = missingStar
    ? {
        title: `A ${starLabel(missingStar)} star`,
        body: 'None of your systems has one yet. How to reach them is in the Codex.',
        star: missingStar,
        search: `${starLabel(missingStar)} star`
      }
    : missingBiome
      ? {
          title: `A ${FAMILY_LABEL[missingBiome]} world`,
          body: 'None of your planets is one yet. The Codex has the biomes.',
          star: null,
          search: 'biome'
        }
      : missingRace
        ? {
            title: `The ${RACES[missingRace]}`,
            body: 'You haven’t logged a system of theirs yet.',
            star: null,
            search: RACES[missingRace]
          }
        : null;
  const firstWith = (race: string) => log.systems.find(system => system.race === race)?.name ?? '';
  const missingBiomes = families.filter(kind => !biomes.includes(kind));
  const countOf = (type: string) => shipGear.filter(item => item.type.trim() === type).length;
  return {
    firsts: firsts(log, family).length,
    next,
    stars: {
      have: stars,
      total: STAR_CHASE.length,
      note: !stars.length
        ? 'No star colours logged yet.'
        : stars.length === 1
          ? `All ${starLabel(stars[0] ?? 'yellow')} so far.`
          : stars.length === STAR_CHASE.length
            ? 'Every colour there is.'
            : `${capital(list(stars.map(starLabel)))} so far.`
    },
    biomes: {
      have: biomes,
      total: families.length,
      note: !biomes.length
        ? 'No planets logged with a biome yet.'
        : missingBiomes.length === 1
          ? `${capital(FAMILY_LABEL[missingBiomes[0] ?? 'lush'])} is the one missing.`
          : missingBiomes.length
            ? `${capital(list(missingBiomes.map(kind => FAMILY_LABEL[kind])))} are still out there.`
            : 'Every family there is.'
    },
    races: {
      have: races,
      total: PEOPLES.length,
      note: races.length
        ? `${list(races.map(race => `${RACES[race]} in ${firstWith(race)}`))}.`
        : 'You haven’t logged who runs a system yet.'
    },
    ships: {
      have: types,
      slots: Math.max(SHIP_SLOTS, types.length + 1),
      note: types.length
        ? `${list(types.map(type => `${countOf(type) === 1 ? 'One' : (WORDS[countOf(type)] ?? String(countOf(type)))} ${type}${countOf(type) === 1 ? '' : 's'}`))} in your hangar. The full list comes with the game data.`
        : 'No starship types logged yet.'
    }
  };
}
