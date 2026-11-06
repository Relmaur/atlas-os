// The example traveller the product page shows: invented logs, at three stages of play, run through the same code as a
// real player's. Galaxy names come from the wiki's list; a seed keeps the cards the same on every visit.
import { firsts } from '@atlas/core/frontier';
import { currentArt } from '@atlas/core/current';
import { planetFamily, type FactsFile } from '@atlas/core/facts';
import { normalizeGear } from '@atlas/core/gear';
import type { Galaxy } from '@atlas/core/location';
import { Rng, seedOf } from '@atlas/core/seed';
import { normalizeSystem } from '@atlas/core/systems-model';
import { STAR_ORDER, travellerCard } from '@atlas/core/traveller';

export const STAGES = {
  C: { systems: 3, galaxies: 1, sclass: 0 }, // Day three
  B: { systems: 30, galaxies: 3, sclass: 1 }, // A few weeks
  S: { systems: 168, galaxies: 10, sclass: 8 } // Seasoned
} as const;
export type Stage = keyof typeof STAGES;

const STARTED = Date.UTC(2026, 0, 3);
const DAY = 86_400_000;
const hex = (rng: Rng, digits: number) =>
  Math.floor(rng.next() * 16 ** digits)
    .toString(16)
    .toUpperCase()
    .padStart(digits, '0');

export function exampleTraveller(stage: Stage, galaxies: Galaxy[], facts: FactsFile) {
  const { systems: count, galaxies: reached, sclass } = STAGES[stage];
  const rng = new Rng(seedOf('atlas-example', stage));
  // A little more than a day apart, so day three is day three and a seasoned log spans months.
  const at = (i: number) => new Date(STARTED + i * (stage === 'C' ? DAY : DAY * 1.3)).toISOString();
  const systems = Array.from({ length: count }, (_, i) =>
    normalizeSystem({
      id: `example-${String(i)}`,
      name: `Example ${String(i + 1)}`,
      galaxy: galaxies[Math.floor((i * reached) / count)]?.name ?? 'Euclid',
      glyphs: `0${hex(rng, 3)}${hex(rng, 2)}${hex(rng, 3)}${hex(rng, 3)}`,
      star: STAR_ORDER[Math.floor(rng.next() ** 2 * STAR_ORDER.length)],
      planetCount: 1 + Math.floor(rng.next() * 3),
      createdAt: at(i)
    })
  );
  const gear = normalizeGear(
    Array.from({ length: sclass }, (_, i) => ({
      id: `gear-${String(i)}`,
      kind: 'starship',
      name: `Example ${String(i + 1)}`,
      class: 'S',
      createdAt: at(i)
    }))
  );
  const earned = firsts({ systems, gear }, planet => planetFamily(facts, planet).family);
  const card = travellerCard({ systems, gear, notes: [], runs: [], checklists: {} }, earned, galaxies);
  return { card, art: currentArt(card.trip) };
}
