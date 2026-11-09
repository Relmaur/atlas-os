// A system's dot as Map options colour it (round 7b): by star class (the game's colours), by race, or bases only
// (bases keep their star's colour; every other system goes slate and a little smaller). One rule for the map's dots,
// the list's dots and the card's mark, so they always agree. Galaxy-zoom pins aren't dots and stay cyan.
import { STAR_CLASSES, type System } from '@atlas/core/systems-model';
import type { MapOptions } from './map-options-store.ts';

/** The design's race colours (c18): Gek pink, Korvax violet, Vy'keen orange. */
export const RACE_COLOURS = { gek: '#f472b6', korvax: '#a78bfa', vykeen: '#fb923c' } as const;
export const OTHER_SYSTEM = '#475569';

export const isBase = (system: System) =>
  system.tags.includes('base') || system.planets.some(planet => planet.tags.includes('base'));

/** The fill (null: a hollow ring, nothing logged to colour it by) and how much smaller than usual it's drawn. */
export function paint(system: System, colour: MapOptions['colour']): { fill: string | null; shrink: number } {
  const star = system.star ? STAR_CLASSES[system.star].color : null;
  if (colour === 'race') {
    const race = system.race;
    return { fill: race === 'gek' || race === 'korvax' || race === 'vykeen' ? RACE_COLOURS[race] : null, shrink: 0 };
  }
  if (colour === 'bases' && !isBase(system)) return { fill: OTHER_SYSTEM, shrink: 1.5 };
  return { fill: star, shrink: 0 };
}
