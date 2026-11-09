// The Infested spore ring (round 4b, c20 A): twelve small dots round a planet's disc in its biome's own colour, like
// spores, 3.6 units outside a 17-unit disc and every third a little larger. One geometry for the SVG marker, the orbit
// diagram, the cards and the saved pictures, so they always agree.
const GAP = 3.6 / 17;
const BIG = 2.1 / 17;
const SMALL = 1.5 / 17;
const START = 0.2; // radians: the board's first dot sits just below east

export function sporeDots(cx: number, cy: number, r: number): { x: number; y: number; r: number }[] {
  const at = r * (1 + GAP);
  return Array.from({ length: 12 }, (_, k) => {
    const angle = START + (k * Math.PI) / 6;
    return { x: cx + at * Math.cos(angle), y: cy + at * Math.sin(angle), r: r * (k % 3 === 0 ? BIG : SMALL) };
  });
}

/** How far the ring reaches past the disc's centre, for sizing a marker's box. */
export const sporeReach = (r: number): number => r * (1 + GAP + BIG);
