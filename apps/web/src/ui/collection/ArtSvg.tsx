// A collectible card's art (@atlas/core/collectible) as SVG, in three depths, so a tilt shows parallax. Only the card
// in view moves; the shapes come from the same data the saved picture draws.
import { useId, type ReactNode } from 'react';
import type { ArtGroup, ArtShape, CardArt, Paint } from '@atlas/core/collectible';
import { Grain, PlanetShape, SporeRing, StarShape } from '../parts/StarChart.tsx';

const paint = ({ fill, fillOpacity, stroke, strokeOpacity, width, dash }: Paint) => ({
  fill: fill ?? 'none',
  fillOpacity,
  stroke,
  strokeOpacity,
  strokeWidth: width,
  strokeDasharray: dash?.join(' ')
});

function Shape({ shape, grain }: { shape: ArtShape; grain: string }): ReactNode {
  switch (shape.kind) {
    case 'path':
      return <path d={shape.d} strokeLinejoin="round" {...paint(shape)} />;
    case 'circle':
      return <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...paint(shape)} />;
    case 'star':
      return <StarShape cx={shape.cx} cy={shape.cy} r={shape.r} colour={shape.colour} grain={grain} />;
    case 'planet':
      return (
        <>
          <PlanetShape cx={shape.cx} cy={shape.cy} r={shape.r} family={shape.family} grain={grain} />
          {shape.infested && <SporeRing cx={shape.cx} cy={shape.cy} r={shape.r} family={shape.family} />}
          {shape.base && (
            <circle cx={shape.cx} cy={shape.cy} r={shape.r + 5} fill="none" stroke="#22d3ee" strokeWidth={1.4} />
          )}
        </>
      );
    case 'text':
      return (
        <text
          x={shape.x}
          y={shape.y}
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize={9}
          letterSpacing={2}
          fill="#64748b"
        >
          {shape.text}
        </text>
      );
  }
}

function Group({ group, art, animate, grain }: { group: ArtGroup; art: CardArt; animate: boolean; grain: string }) {
  const shapes = group.shapes.map((shape, i) => <Shape key={i} shape={shape} grain={grain} />);
  const inner =
    animate && group.spin ? (
      <g
        className="art-spin"
        style={{
          transformOrigin: `${String(art.cx)}px ${String(art.cy)}px`,
          animationDuration: `${String(group.spin.seconds)}s`,
          animationDirection: group.spin.reverse ? 'reverse' : undefined
        }}
      >
        {shapes}
      </g>
    ) : (
      shapes
    );
  return group.start ? (
    <g transform={`rotate(${group.start.toFixed(1)} ${String(art.cx)} ${String(art.cy)})`}>{inner}</g>
  ) : (
    <g>{inner}</g>
  );
}

export function ArtSvg({ art, animate }: { art: CardArt; animate: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const layer = (groups: ArtGroup[], depth: number, base?: string) => (
    <svg
      viewBox={`0 0 ${String(art.width)} ${String(art.height)}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={`card-lay-${String(depth)} w-full h-full`}
    >
      <defs>
        <Grain id={`${id}${String(depth)}`} />
      </defs>
      {base && <rect width={art.width} height={art.height} fill={base} />}
      {groups.map((group, i) => (
        <Group key={i} group={group} art={art} animate={animate} grain={`${id}${String(depth)}`} />
      ))}
    </svg>
  );
  return (
    <>
      {layer(art.bg, 0, art.base)}
      {layer(art.mid, 1)}
      {layer(art.fg, 2)}
    </>
  );
}
