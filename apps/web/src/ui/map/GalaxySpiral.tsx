// A galaxy's spiral glyph (round 7, c17): tapered arms with a radial light, two fine engraved lines per arm and a
// soft bulge, arms by the wiki's type and turned by the galaxy's name. A drawing, never star positions: no dots.
// One part for the map, its locator, the galaxy picker and the chain (30).
import { useId, useMemo } from 'react';
import { spiralArms } from '@atlas/core/map';

const path = (points: [number, number][], cx: number, cy: number, r: number, close = false) =>
  `M${points.map(([x, y]) => `${(cx + x * r).toFixed(1)},${(cy + y * r).toFixed(1)}`).join(' L')}${close ? 'Z' : ''}`;

export function GalaxySpiral({
  name,
  type,
  cx,
  cy,
  r,
  colour,
  detail = true
}: {
  name: string;
  type: string;
  cx: number;
  cy: number;
  /** The rim's radius. */
  r: number;
  /** A galaxy's tide colour (30, the picker); the map's own light is cyan. */
  colour?: string;
  /** The engraved lines; left out where the glyph is too small to hold them. */
  detail?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const arms = useMemo(() => spiralArms(name, type), [name, type]);
  const light = colour ?? '#22d3ee';
  return (
    <g aria-hidden="true">
      <defs>
        <radialGradient id={`${id}a`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={r}>
          <stop offset="0" stopColor="#cffafe" stopOpacity={0.28} />
          <stop offset=".3" stopColor={light} stopOpacity={0.14} />
          <stop offset=".7" stopColor={colour ?? '#38bdf8'} stopOpacity={0.07} />
          <stop offset="1" stopColor={colour ?? '#818cf8'} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}l`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={r}>
          <stop offset="0" stopColor="#ecfeff" stopOpacity={0.7} />
          <stop offset=".55" stopColor={colour ?? '#67e8f9'} stopOpacity={0.32} />
          <stop offset="1" stopColor={colour ?? '#a5b4fc'} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}b`}>
          <stop offset="0" stopColor="#f0fdff" stopOpacity={0.5} />
          <stop offset=".35" stopColor="#a5f3fc" stopOpacity={0.18} />
          <stop offset="1" stopColor={light} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r * 0.62} fill={`url(#${id}a)`} opacity={0.35} />
      {arms.map((arm, k) => (
        <path key={`b${String(k)}`} d={path(arm.band, cx, cy, r, true)} fill={`url(#${id}a)`} />
      ))}
      {detail &&
        arms.flatMap((arm, k) =>
          arm.lines.map((line, j) => (
            <path
              key={`l${String(k)}-${String(j)}`}
              d={path(line, cx, cy, r)}
              fill="none"
              stroke={`url(#${id}l)`}
              strokeOpacity={j ? 0.55 : 1}
              strokeWidth={j ? 0.41 : 0.74}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))
        )}
      <circle cx={cx} cy={cy} r={r * 0.2} fill={`url(#${id}b)`} />
    </g>
  );
}
