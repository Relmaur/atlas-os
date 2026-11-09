// The star chart (DESIGN.md): the star mark (component 02), the planet marker (01) and the orbit diagram (08) that
// composes them. They draw only what the player logged: a star's colour, a planet's biome family, a base. Where a
// value isn't logged the mark is dashed, never guessed. Layout comes from @atlas/core/orbit; this file only draws.
import { useId } from 'react';
import { orbitLayout, orbitSentence, type OrbitOptions, type OrbitPlanet } from '@atlas/core/orbit';
import { STAR_CLASSES, type StarClass } from '@atlas/core/systems-model';
import { BIOME_FAMILIES, type BiomeFamily } from '@atlas/core/facts';
import { sporeDots, sporeReach } from './spores.ts';

const isFamily = (family: string | null): family is BiomeFamily =>
  (BIOME_FAMILIES as readonly string[]).includes(family ?? '');

// SVG ids are referenced from url(#…): keep useId's output to plain characters.
function useSvgId(): string {
  return useId().replace(/[^a-zA-Z0-9_-]/g, '');
}

// A fine film grain over a disc, for an organic finish (components 01 and 02). One filter per drawing, by id.
export function Grain({ id }: { id: string }) {
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={7} stitchTiles="stitch" result="n" />
      <feColorMatrix in="n" type="saturate" values="0" result="g" />
      <feComposite in="g" in2="SourceGraphic" operator="in" />
    </filter>
  );
}

/** The star mark's parts: a flat disc with a pale core, grain, and three corona rings fading out, the last dashed. */
export function StarShape({
  cx,
  cy,
  r,
  colour,
  grain
}: {
  cx: number;
  cy: number;
  r: number;
  colour: StarClass | '';
  grain: string;
}) {
  if (!colour) {
    // Not logged: a dashed outline with a grey core. Never a guessed colour.
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-ink-muted)" strokeDasharray="3 3" />
        <circle cx={cx} cy={cy} r={r * 0.35} fill="var(--color-grab)" />
      </g>
    );
  }
  const main = `var(--color-star-${colour})`;
  return (
    <g>
      <g className="star-corona">
        <circle cx={cx} cy={cy} r={2.8 * r} fill="none" stroke={main} strokeOpacity={0.2} strokeDasharray="4 5" />
        <circle cx={cx} cy={cy} r={2.1 * r} fill="none" stroke={main} strokeOpacity={0.35} />
        <circle cx={cx} cy={cy} r={1.5 * r} fill="none" stroke={main} strokeOpacity={0.6} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill={main} />
      <circle cx={cx} cy={cy} r={0.6 * r} fill={`var(--color-star-${colour}-core)`} fillOpacity={0.9} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#000"
        filter={`url(#${grain})`}
        opacity={0.45}
        style={{ mixBlendMode: 'overlay' }}
      />
    </g>
  );
}

/** The planet marker's parts: a lit disc in its biome family's colour, one hard crescent of shadow, and grain. */
export function PlanetShape({
  cx,
  cy,
  r,
  family,
  grain
}: {
  cx: number;
  cy: number;
  r: number;
  family: string | null;
  grain: string;
}) {
  if (!isFamily(family)) {
    // Biome not logged (or not mapped to a family): a plain slate disc.
    return <circle cx={cx} cy={cy} r={r} fill="var(--color-control-edge-hover)" />;
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={`var(--color-biome-${family})`} />
      <path
        d={`M ${String(cx)} ${String(cy - r)} A ${String(r)} ${String(r)} 0 0 1 ${String(cx)} ${String(cy + r)} A ${String(0.45 * r)} ${String(r)} 0 0 0 ${String(cx)} ${String(cy - r)} Z`}
        fill={`var(--color-biome-${family}-shade)`}
        fillOpacity={0.85}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#000"
        filter={`url(#${grain})`}
        opacity={0.5}
        style={{ mixBlendMode: 'overlay' }}
      />
    </g>
  );
}

/** The star mark on its own, for small places (rows, search results, chips): `r` is the disc's radius. */
export function StarMark({ colour, r = 6, label }: { colour: StarClass | ''; r?: number; label?: string }) {
  const grain = useSvgId();
  const half = colour ? 2.8 * r + 1 : r + 1;
  return (
    <svg
      width={half * 2}
      height={half * 2}
      viewBox={`${String(-half)} ${String(-half)} ${String(half * 2)} ${String(half * 2)}`}
      className="shrink-0"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <defs>
        <Grain id={grain} />
      </defs>
      <StarShape cx={0} cy={0} r={r} colour={colour} grain={grain} />
    </svg>
  );
}

/** The planet marker on its own; `size` is its diameter in px. Optionally ringed as your base. */
/** The Infested spore ring round a disc, in the biome's own colour (slate when it isn't known). Never a status hue. */
export function SporeRing({ cx, cy, r, family }: { cx: number; cy: number; r: number; family: string | null }) {
  const fill = isFamily(family) ? `var(--color-biome-${family})` : 'var(--color-ink-muted)';
  return (
    <g fill={fill}>
      {sporeDots(cx, cy, r).map((dot, k) => (
        <circle key={k} cx={dot.x} cy={dot.y} r={dot.r} />
      ))}
    </g>
  );
}

export function PlanetMarker({
  family,
  size = 14,
  base = false,
  relic = false,
  infested = false,
  unlogged = false
}: {
  family: string | null;
  size?: number;
  base?: boolean;
  /** A Reliquary world: a broken ring around the disc says ruins (c01b). */
  relic?: boolean;
  /** An Infested world: the spore ring round the disc (round 4b, c20). */
  infested?: boolean;
  /** Nothing logged about the planet yet: a dashed outline instead of a disc (36c). */
  unlogged?: boolean;
}) {
  const grain = useSvgId();
  const r = size / 2;
  const half = Math.max(base || relic ? r + 6 : r, infested ? sporeReach(r) : 0);
  if (unlogged && !isFamily(family)) {
    const dash = Math.max(2, r * 0.32);
    return (
      <svg
        width={half * 2}
        height={half * 2}
        viewBox={`${String(-half)} ${String(-half)} ${String(half * 2)} ${String(half * 2)}`}
        className="shrink-0"
        aria-hidden="true"
      >
        <circle
          cx={0}
          cy={0}
          r={r - 1.5}
          fill="none"
          stroke="var(--color-ink-muted)"
          strokeWidth={Math.max(1.5, r * 0.09)}
          strokeDasharray={`${String(dash)} ${String(dash * 0.9)}`}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width={half * 2}
      height={half * 2}
      viewBox={`${String(-half)} ${String(-half)} ${String(half * 2)} ${String(half * 2)}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <defs>
        <Grain id={grain} />
      </defs>
      <PlanetShape cx={0} cy={0} r={r} family={family} grain={grain} />
      {infested && <SporeRing cx={0} cy={0} r={r} family={family} />}
      {base && <circle cx={0} cy={0} r={r + 5} fill="none" stroke="var(--color-scanner-cyan-glow)" strokeWidth={1.5} />}
      {relic && !base && (
        <circle
          cx={0}
          cy={0}
          r={r + 4}
          fill="none"
          stroke={isFamily(family) ? `var(--color-biome-${family})` : 'var(--color-ink-muted)'}
          strokeOpacity={0.75}
          strokeWidth={1.25}
          strokeDasharray={`${String((r + 4) * 1.1)} ${String((r + 4) * 0.45)}`}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

// Kepler-like drift (XL and L): each planet swings ±3° along its arc, slower the farther out (period ∝ r^1.5),
// between 20s and 60s. Under reduced motion everything stays at its seeded angle (theme.css).
function driftSeconds(r: number, innermost: number): number {
  return Math.min(60, 20 * (r / innermost) ** 1.5);
}

interface OrbitDiagramProps extends OrbitOptions {
  /** The system's name, for the sentence a screen reader hears. */
  name: string;
  /** The galaxy and portal address (or a stable stand-in), which seed the planets' angles. */
  seed: [string, string];
  star: StarClass | '';
  planets: OrbitPlanet[];
  /** A faint 22px grid behind the diagram (on by default). */
  grid?: boolean;
}

export function OrbitDiagram({ name, seed, star, planets, grid = true, ...options }: OrbitDiagramProps) {
  const id = useSvgId();
  const layout = orbitLayout(seed, planets, options);
  const { width: W, height: H, size } = options;
  const moving = size !== 'M';
  const { cx, cy } = layout.star;
  const innermost = layout.orbits[0]?.r ?? 1;
  const font = size === 'L' ? 9 : 10;
  return (
    <svg
      role="img"
      aria-label={orbitSentence(name, star ? STAR_CLASSES[star].label : '', planets, options.total)}
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      className="block w-full h-auto"
      style={{ maxWidth: `${String(W)}px` }}
    >
      <defs>
        <Grain id={`${id}g`} />
        {grid && (
          <pattern id={`${id}p`} width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0H0V22" fill="none" stroke="var(--color-orbit-grid)" />
          </pattern>
        )}
      </defs>
      {grid && <rect width={W} height={H} fill={`url(#${id}p)`} />}
      {layout.orbits.map(orbit => (
        <circle
          key={orbit.r}
          cx={cx}
          cy={cy}
          r={orbit.r}
          fill="none"
          stroke={orbit.logged ? 'var(--color-orbit-line)' : 'var(--color-orbit-line-unlogged)'}
          strokeDasharray={orbit.logged ? undefined : '3 5'}
        />
      ))}
      {layout.line && (
        <path
          d={`M${String(layout.line.x1)} ${String(layout.line.y)} H${String(layout.line.x2)}`}
          stroke="rgba(103,232,249,0.18)"
          strokeDasharray="2 4"
        />
      )}
      <StarShape cx={cx} cy={cy} r={layout.star.r} colour={star} grain={`${id}g`} />
      {layout.planets.map(planet => {
        const r = Math.hypot(planet.x - cx, planet.y - cy);
        const ring = layout.baseRings.find(base => base.cx === planet.x && base.cy === planet.y);
        const labels = layout.labels.filter(label => label.planet === planet.index);
        return (
          <g
            key={planet.index}
            className={moving ? 'orbit-drift' : undefined}
            style={
              moving
                ? {
                    transformOrigin: `${String(cx)}px ${String(cy)}px`,
                    animationDuration: `${String(driftSeconds(r, innermost))}s`
                  }
                : undefined
            }
          >
            {planet.logged ? (
              <>
                <PlanetShape cx={planet.x} cy={planet.y} r={planet.r} family={planet.family} grain={`${id}g`} />
                {planet.infested && <SporeRing cx={planet.x} cy={planet.y} r={planet.r} family={planet.family} />}
              </>
            ) : (
              <circle
                cx={planet.x}
                cy={planet.y}
                r={planet.r}
                fill="none"
                stroke="var(--color-grab)"
                strokeDasharray="2 3"
              />
            )}
            {ring && (
              <circle
                cx={ring.cx}
                cy={ring.cy}
                r={ring.r}
                fill="none"
                stroke="var(--color-scanner-cyan-glow)"
                strokeWidth={1.5}
              />
            )}
            {layout.moons
              .filter(moon => moon.parent === planet.index)
              .map((moon, k) => (
                <g key={k}>
                  <circle
                    cx={moon.ring.cx}
                    cy={moon.ring.cy}
                    r={moon.ring.r}
                    fill="none"
                    stroke="var(--color-orbit-line)"
                    strokeDasharray="1.5 3"
                  />
                  {/* A slow turn round its planet, whole moons at a time; stopped under reduced motion. */}
                  <g
                    className={moving ? 'moon-orbit' : undefined}
                    style={
                      moving ? { transformOrigin: `${String(moon.ring.cx)}px ${String(moon.ring.cy)}px` } : undefined
                    }
                  >
                    <PlanetShape cx={moon.x} cy={moon.y} r={moon.r} family={moon.family} grain={`${id}g`} />
                    {moon.infested && <SporeRing cx={moon.x} cy={moon.y} r={moon.r} family={moon.family} />}
                    {moon.base && (
                      <circle
                        cx={moon.x}
                        cy={moon.y}
                        r={moon.r + 3}
                        fill="none"
                        stroke="var(--color-scanner-cyan-glow)"
                        strokeWidth={1.25}
                      />
                    )}
                  </g>
                </g>
              ))}
            {labels.map(label => (
              <text
                key={label.text}
                x={label.x}
                y={label.y}
                textAnchor={label.kind === 'base' ? 'middle' : undefined}
                fill={label.kind === 'base' ? 'var(--color-scanner-cyan-pale)' : 'var(--color-ink-label)'}
                fontFamily="JetBrains Mono, monospace"
                fontSize={label.kind === 'base' ? font : 10}
                letterSpacing={label.kind === 'base' ? 1.5 : undefined}
                aria-hidden="true"
              >
                {label.text}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
