// A galaxy's small spiral glyph in its tide colour: the galaxy list (30) and the galaxy picker (31).
import type { GalaxyJourney } from '@atlas/core/map';
import { GalaxySpiral } from './GalaxySpiral.tsx';

/** A galaxy's small spiral in its tide colour. */
export function GalaxyGlyph({
  galaxy,
  colour,
  size = 40
}: {
  galaxy: Pick<GalaxyJourney, 'name' | 'type'>;
  colour: string;
  size?: number;
}) {
  const c = size / 2;
  const r = c - 4;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx={c} cy={c} r={c - 1} fill="#070c18" stroke={colour} strokeOpacity={0.5} />
      <GalaxySpiral name={galaxy.name} type={galaxy.type} cx={c} cy={c} r={r} colour={colour} />
      <circle cx={c} cy={c} r={r * 0.06 + 0.4} fill="#fff7d6" fillOpacity={0.8} />
    </svg>
  );
}
