// The galaxy chain (design 30): galaxies clockwise round the chart in the order the player reached them, each a small
// spiral in its tide colour with their systems dotted at their true places; pulses run along the arcs between them,
// a turning ring marks where they are, and the next galaxies wait as dashed outlines. The centre counts how far into
// the 256 they are. Motion stops for reduced motion (theme.css, .chain-pulse and .chain-here).
import type { Galaxy } from '@atlas/core/location';
import { tide, type Journey } from '@atlas/core/map';
import { GalaxySpiral } from './GalaxySpiral.tsx';
import { STAR_CLASSES } from '@atlas/core/systems-model';

const S = 358;
const C = S / 2;
const RING = S * 0.33;

export function ChainChart({ trip, next, bare = false }: { trip: Journey; next: Galaxy[]; bare?: boolean }) {
  const n = trip.galaxies.length;
  const slots = Math.max(n + next.length, 6);
  const radiusMax = Math.max(6, Math.min(30, RING * Math.sin(Math.PI / slots) - 9));
  const labels = slots <= 12; // past a dozen the names would collide; the list below names them all
  const angleAt = (k: number) => ((-90 + (k * 360) / slots) * Math.PI) / 180;
  const pos = (k: number) => ({
    x: C + RING * Math.cos(angleAt(k)),
    y: C + RING * Math.sin(angleAt(k)),
    a: angleAt(k)
  });
  const arc = (k: number) => {
    const from = pos(k);
    const to = pos(k + 1);
    return `M${from.x.toFixed(1)} ${from.y.toFixed(1)} A${RING.toFixed(1)} ${RING.toFixed(1)} 0 0 1 ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  };
  const most = Math.max(1, ...trip.galaxies.map(g => g.placed.length + g.unplaced));

  return (
    <section
      aria-label="Your galaxies"
      className={
        bare
          ? 'w-full h-full' // inside a Workbench pane, which is its box (d04)
          : 'rounded-[20px] overflow-hidden border border-[rgba(56,189,248,0.18)] bg-[linear-gradient(170deg,rgba(14,24,46,0.96),rgba(8,14,28,0.96))]'
      }
    >
      <svg
        id="mapChain"
        role="group"
        aria-label={`Galaxy chain: ${trip.galaxies.map(g => g.name).join(', ')}${next.length ? `; next: ${next.map(g => g.name).join(', ')}` : ''}`}
        viewBox={`0 0 ${String(S)} ${String(S)}`}
        className={bare ? 'block w-full h-full' : 'block w-full h-auto max-h-[70vh]'}
      >
        <defs>
          <pattern id="chainGrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke="rgba(103,232,249,.05)" />
          </pattern>
        </defs>
        <rect width={S} height={S} fill="url(#chainGrid)" />
        <circle cx={C} cy={C} r={RING} fill="none" stroke="rgba(148,163,184,.08)" />
        {Array.from({ length: n + next.length - 1 }, (_, k) =>
          k < n - 1 ? (
            <g key={k}>
              <path d={arc(k)} fill="none" stroke={tide(k, n)} strokeOpacity={0.4} strokeWidth={1.4} />
              <path
                d={arc(k)}
                fill="none"
                stroke={tide(k, n)}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeDasharray="6 70"
                className="chain-pulse"
                style={{ animationDuration: `${(2.6 + k * 0.3).toFixed(1)}s` }}
              />
            </g>
          ) : (
            <path key={k} d={arc(k)} fill="none" stroke="rgba(148,163,184,.45)" strokeDasharray="2 4" />
          )
        )}
        {trip.galaxies.map((galaxy, g) => {
          const { x, y, a } = pos(g);
          const colour = tide(g, n);
          const r = radiusMax * (0.6 + 0.4 * Math.sqrt((galaxy.placed.length + galaxy.unplaced) / most));
          const here = g === trip.here;
          return (
            <a key={galaxy.name} href={`#map/${encodeURIComponent(galaxy.name)}`} aria-label={`Open ${galaxy.name}`}>
              <circle cx={x} cy={y} r={r + 3} fill="#070c18" stroke={colour} strokeOpacity={0.55} />
              <GalaxySpiral name={galaxy.name} type={galaxy.type} cx={x} cy={y} r={r} colour={colour} />
              <circle cx={x} cy={y} r={r * 0.06 + 0.5} fill="#fff7d6" fillOpacity={0.8} />
              {galaxy.placed.map(p => (
                <circle
                  key={p.system.id}
                  cx={x + r * p.reach * Math.cos(p.angle)}
                  cy={y + r * p.reach * Math.sin(p.angle)}
                  r={1.3}
                  fill={p.system.star ? STAR_CLASSES[p.system.star].color : '#94a3b8'}
                />
              ))}
              {here && (
                <circle
                  cx={x}
                  cy={y}
                  r={r + 8}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth={1.2}
                  strokeDasharray="3 3"
                  className="chain-here"
                  style={{ transformOrigin: `${x.toFixed(1)}px ${y.toFixed(1)}px` }}
                />
              )}
              {labels && <Label x={x} y={y} a={a} off={r + (here ? 11 : 6)} text={galaxy.name.split(' ')[0] ?? ''} />}
            </a>
          );
        })}
        {next.map((galaxy, i) => {
          const { x, y, a } = pos(n + i);
          return (
            <g key={galaxy.n}>
              <circle cx={x} cy={y} r={radiusMax * 0.55} fill="#070c18" stroke="#64748b" strokeDasharray="2 3" />
              {labels && (
                <Label x={x} y={y} a={a} off={radiusMax * 0.55 + 6} text={galaxy.name.split(' ')[0] ?? ''} muted />
              )}
            </g>
          );
        })}
        <text
          x={C}
          y={C - 4}
          textAnchor="middle"
          fill="#fff"
          fontFamily="Orbitron, sans-serif"
          fontSize={30}
          fontWeight={800}
        >
          {n}
        </text>
        <text
          x={C}
          y={C + 16}
          textAnchor="middle"
          fill="#8b9ab0"
          fontFamily="JetBrains Mono, monospace"
          fontSize={9.5}
          letterSpacing={1.5}
        >
          OF 256 GALAXIES
        </text>
      </svg>
    </section>
  );
}

// A name outside its circle, pushed out from the chart's centre, tucked inside when there's no room at the edge.
function Label({
  x,
  y,
  a,
  off,
  text,
  muted = false
}: {
  x: number;
  y: number;
  a: number;
  off: number;
  text: string;
  muted?: boolean;
}) {
  let lx = x + Math.cos(a) * off;
  let ly = y + Math.sin(a) * off;
  const cos = Math.cos(a);
  let anchor: 'middle' | 'start' | 'end' = Math.abs(cos) < 0.35 ? 'middle' : cos > 0 ? 'start' : 'end';
  const width = text.length * 6.4;
  if ((anchor === 'end' && lx - width < 8) || (anchor === 'start' && lx + width > S - 8)) {
    lx = x - Math.cos(a) * off;
    ly = y - Math.sin(a) * off;
    anchor = anchor === 'end' ? 'start' : 'end';
  }
  const dy = Math.sin(a) > 0.35 ? 11 : Math.sin(a) < -0.35 ? -3 : 4;
  return (
    <text
      x={lx}
      y={ly + dy}
      textAnchor={anchor}
      fill={muted ? '#94a3b8' : '#e2e8f0'}
      fontFamily="Inter, sans-serif"
      fontSize={11}
      fontWeight={600}
    >
      {text}
    </text>
  );
}
