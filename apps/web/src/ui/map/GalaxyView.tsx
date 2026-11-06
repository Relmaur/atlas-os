// One galaxy (design 31; c10, magnified clusters): the player's systems at their true places, magnified to fill the
// chart with their shape kept, joined in the order they were logged. Faint arcs round the (usually off-screen) core
// and an arrow show which way is in; a locator shows where the cluster sits in the whole galaxy. Zoom and drag to
// look closer; tap a system for its card. Directions follow the portal address: X east to the right, Z south down.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { formatLightYears } from '@atlas/core/location';
import { clusterView, ordinal, spiralDots, tide, type GalaxyJourney, type Journey } from '@atlas/core/map';
import { RACES, STAR_CLASSES, type System } from '@atlas/core/systems-model';
import { openSystem } from '../systems/panel-store.ts';
import { Button } from '../parts/Button.tsx';
import { GalaxyGlyph } from './GalaxyGlyph.tsx';

const S = 358;
const MAX_ZOOM = 8;
const LOCATOR = 74;
const isBase = (system: System) =>
  system.tags.includes('base') || system.planets.some(planet => planet.tags.includes('base'));
const planetsOf = (system: System) => system.planetCount || system.planets.length;
const starColour = (system: System) => (system.star ? STAR_CLASSES[system.star].color : null);

export function GalaxyView({
  galaxy,
  index,
  trip,
  lyPerRegion,
  desk = false
}: {
  galaxy: GalaxyJourney;
  index: number;
  trip: Journey;
  lyPerRegion: number | null;
  /** The Workbench (round 6, d05): the map pane and the side pane, as two children of the Map's grid. */
  desk?: boolean;
}) {
  const colour = tide(index, trip.galaxies.length);
  const view = clusterView(galaxy.placed, S);
  const [selected, setSelected] = useState(
    () => (galaxy.placed.find(p => isBase(p.system)) ?? galaxy.placed.at(-1))?.system.id ?? ''
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const width = S / zoom;
  const box = { x: S / 2 - width / 2 - pan.x, y: S / 2 - width / 2 - pan.y };
  const centre = { x: box.x + width / 2, y: box.y + width / 2 };
  const coreInView =
    view.core.x > box.x + 12 &&
    view.core.x < box.x + width - 12 &&
    view.core.y > box.y + 12 &&
    view.core.y < box.y + width - 12;
  const toCore = Math.atan2(view.core.y - centre.y, view.core.x - centre.x);
  const coreDistance = Math.hypot(view.core.x - S / 2, view.core.y - S / 2);
  const zoomBy = (factor: number) => {
    setZoom(z => Math.min(MAX_ZOOM, Math.max(1, z * factor)));
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    const rect = svg.current?.getBoundingClientRect();
    if (!start || !rect?.width) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 4) return;
    if (!start.moved) svg.current?.setPointerCapture(event.pointerId);
    start.moved = true;
    const unit = width / rect.width; // view units per screen pixel
    setPan(p => ({ x: p.x + dx * unit, y: p.y + dy * unit }));
    start.x = event.clientX;
    start.y = event.clientY;
  };
  const onPointerUp = () => {
    // A drag that moved isn't a tap: the click that follows is swallowed in pick().
    setTimeout(() => {
      drag.current = null;
    });
  };
  const pick = (id: string) => {
    if (drag.current?.moved) return;
    setSelected(id);
  };

  const chosen = galaxy.placed.find(p => p.system.id === selected) ?? null;
  const dot = (system: System) => (2.6 + Math.min(planetsOf(system), 8) * 0.45) / Math.sqrt(zoom);

  const back = (
    <a
      href="#map"
      className="h-[34px] shrink-0 whitespace-nowrap pl-2 pr-3 rounded-full inline-flex items-center gap-1.5 border border-scanner-cyan-edge bg-scanner-cyan-tint text-[13px] font-semibold text-scanner-cyan-pale hover:border-scanner-cyan-edge-strong"
    >
      <i className="ph-bold ph-caret-left" aria-hidden="true" />
      All galaxies
    </a>
  );
  const picker = (
    <label className="relative min-w-0 h-[34px] pl-2 pr-7 rounded-full inline-flex items-center gap-2 border border-control-edge bg-slate-ground text-[13px] font-semibold text-ink focus-within:border-scanner-cyan-edge-strong">
      <GalaxyGlyph galaxy={galaxy} colour={colour} size={22} />
      <span className="sr-only">Galaxy</span>
      <select
        id="mapGalaxyPicker"
        value={galaxy.name}
        onChange={event => {
          location.hash = `#map/${encodeURIComponent(event.target.value)}`;
        }}
        className="appearance-none field-sizing-content bg-transparent min-w-0 max-w-full truncate focus:outline-hidden"
      >
        {trip.galaxies.map((g, i) => (
          <option key={g.name} value={g.name}>
            {`${g.name} · ${String(i + 1)} of ${String(trip.galaxies.length)}`}
          </option>
        ))}
      </select>
      <i
        className="ph-bold ph-caret-down absolute right-2.5 text-ink-disabled pointer-events-none"
        aria-hidden="true"
      />
    </label>
  );
  const tools = (
    <>
      <MapTool
        icon="ph-plus"
        label="Zoom in"
        disabled={zoom >= MAX_ZOOM}
        onClick={() => {
          zoomBy(1.6);
        }}
      />
      <MapTool
        icon="ph-minus"
        label="Zoom out"
        disabled={zoom <= 1}
        onClick={() => {
          zoomBy(1 / 1.6);
        }}
      />
      <MapTool
        icon="ph-eye"
        label="Fit my systems"
        onClick={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
      />
    </>
  );
  const chart = (
    <section
      aria-label={`${galaxy.name}: your systems`}
      className={
        desk
          ? 'relative w-full h-full overflow-hidden' // the pane is its box (no border inside a border)
          : 'relative rounded-[20px] overflow-hidden border border-[rgba(56,189,248,0.18)] bg-[linear-gradient(170deg,rgba(14,24,46,0.96),rgba(8,14,28,0.96))]'
      }
    >
      {galaxy.placed.length ? (
        <>
          <svg
            ref={svg}
            id="mapGalaxy"
            role="group"
            aria-label={`${galaxy.name}: your ${String(galaxy.placed.length)} systems with an address, magnified; the arrow points to the centre`}
            viewBox={`${box.x.toFixed(2)} ${box.y.toFixed(2)} ${width.toFixed(2)} ${width.toFixed(2)}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="block w-full h-auto touch-none select-none cursor-grab active:cursor-grabbing"
          >
            {Array.from({ length: 8 }, (_, k) => coreDistance - S * 0.5 + (k + 1) * S * 0.14)
              .filter(r => r > 0)
              .map(r => (
                <circle
                  key={r}
                  cx={view.core.x}
                  cy={view.core.y}
                  r={r}
                  fill="none"
                  stroke={colour}
                  strokeOpacity={0.09}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            {coreInView && <circle cx={view.core.x} cy={view.core.y} r={4 / zoom} fill="#fff7d6" fillOpacity={0.8} />}
            {galaxy.placed.length > 1 && (
              <path
                d={`M${view.points.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')}`}
                fill="none"
                stroke="#fcd34d"
                strokeOpacity={0.35}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {galaxy.placed.map((p, i) => {
              const at = view.points[i] ?? { x: 0, y: 0 };
              const r = dot(p.system);
              const fill = starColour(p.system);
              return (
                <g
                  key={p.system.id}
                  role="button"
                  tabIndex={0}
                  aria-label={p.system.name}
                  aria-pressed={p.system.id === selected}
                  onClick={() => {
                    pick(p.system.id);
                  }}
                  onKeyDown={(event: KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(p.system.id);
                    }
                  }}
                  className="cursor-pointer focus:outline-hidden [&:focus-visible>.map-focus]:opacity-100"
                >
                  <circle cx={at.x} cy={at.y} r={Math.max(r + 6 / zoom, 12 / zoom)} fill="transparent" />
                  {fill ? (
                    <circle cx={at.x} cy={at.y} r={r} fill={fill} />
                  ) : (
                    <circle cx={at.x} cy={at.y} r={r} fill="none" stroke="#94a3b8" vectorEffect="non-scaling-stroke" />
                  )}
                  {isBase(p.system) && (
                    <circle
                      cx={at.x}
                      cy={at.y}
                      r={r + 5 / zoom}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {p.system.id === selected && (
                    <circle
                      cx={at.x}
                      cy={at.y}
                      r={13 / zoom}
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth={1.2}
                      strokeDasharray="3 3"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <circle
                    className="map-focus opacity-0"
                    cx={at.x}
                    cy={at.y}
                    r={16 / zoom}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </svg>

          {/* The overlay doesn't zoom: the way to the core and the locator stay put. */}
          <svg
            viewBox={`0 0 ${String(S)} ${String(S)}`}
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {!coreInView && (
              <>
                <g
                  transform={`translate(${(S / 2 + Math.cos(toCore) * S * 0.42).toFixed(1)} ${(S / 2 + Math.sin(toCore) * S * 0.42).toFixed(1)}) rotate(${((toCore * 180) / Math.PI).toFixed(1)})`}
                >
                  <path d="M-8 -6 L4 0 L-8 6" fill="none" stroke={colour} strokeWidth={1.6} strokeOpacity={0.8} />
                </g>
                <text
                  x={S / 2 + Math.cos(toCore) * S * 0.33}
                  y={S / 2 + Math.sin(toCore) * S * 0.33 + 3}
                  textAnchor="middle"
                  fill={colour}
                  fillOpacity={0.8}
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={9}
                  letterSpacing={1.5}
                >
                  CORE
                </text>
              </>
            )}
            <Locator galaxy={galaxy} colour={colour} view={view} />
          </svg>

          {!desk && (
            <div className="absolute left-2.5 bottom-2.5 flex flex-col gap-1.5">
              <MapTool
                icon="ph-plus"
                label="Zoom in"
                disabled={zoom >= MAX_ZOOM}
                onClick={() => {
                  zoomBy(1.6);
                }}
              />
              <MapTool
                icon="ph-minus"
                label="Zoom out"
                disabled={zoom <= 1}
                onClick={() => {
                  zoomBy(1 / 1.6);
                }}
              />
              <MapTool
                icon="ph-eye"
                label="Fit my systems"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
              />
            </div>
          )}
        </>
      ) : (
        <p className="p-6 text-sub text-ink-muted text-center">
          None of your systems in {galaxy.name} has a portal address yet. Add one in a system’s editor and it appears
          here at its true place.
        </p>
      )}
    </section>
  );
  const unplaced = (
    <>
      {galaxy.unplaced > 0 && galaxy.placed.length > 0 && (
        <p className="text-caption text-ink-muted px-1">
          {galaxy.unplaced} more {galaxy.unplaced === 1 ? 'system has' : 'systems have'} no portal address, so{' '}
          {galaxy.unplaced === 1 ? 'it isn’t' : 'they aren’t'} on the map.
        </p>
      )}
    </>
  );

  if (desk) {
    const count = galaxy.placed.length + galaxy.unplaced;
    return (
      <>
        <section aria-label={`Map of ${galaxy.name}`} className="workbench-panel min-w-0 min-h-0 flex flex-col">
          {/* d05 draws no title: the galaxy's name is in its picker. Screen readers still get the page's heading. */}
          <h1 className="sr-only">{`Map: ${galaxy.name}`}</h1>
          <div className="flex items-center justify-between gap-2 px-[18px] py-3.5">
            <span className="flex items-center gap-2 min-w-0">
              {back}
              {picker}
            </span>
            <span className="flex gap-1.5 shrink-0">{tools}</span>
          </div>
          <FitSquare>{chart}</FitSquare>
          <div className="px-[18px] pb-3">{unplaced}</div>
        </section>
        <aside
          aria-label={`${galaxy.name}: the selected system and the list`}
          className="workbench-panel min-w-0 min-h-0 overflow-y-auto p-[18px] flex flex-col gap-4"
        >
          {chosen && (
            <SystemCard placed={chosen} order={galaxy.placed.indexOf(chosen) + 1} lyPerRegion={lyPerRegion} desk />
          )}
          <section aria-labelledby="mapGalaxySystems" className="flex flex-col gap-2">
            <h2 id="mapGalaxySystems" className="font-display font-bold text-[15px] text-ink-bright">
              {`${galaxy.name} · ${String(count)} system${count === 1 ? '' : 's'}`}
            </h2>
            <ul className="m-0 p-0 list-none">
              {[...galaxy.placed].reverse().map(p => {
                const fill = starColour(p.system);
                return (
                  <li key={p.system.id}>
                    <button
                      type="button"
                      aria-pressed={p.system.id === selected}
                      onClick={() => {
                        setSelected(p.system.id);
                      }}
                      className={`w-full grid grid-cols-[10px_minmax(0,1fr)] items-center gap-3 px-3 h-[52px] border-t border-hairline text-left ${
                        p.system.id === selected
                          ? 'bg-scanner-cyan-tint shadow-[inset_3px_0_0_var(--color-scanner-cyan-glow)]'
                          : 'hover:bg-[rgba(148,163,184,0.06)]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-2.5 h-2.5 rounded-full ${fill ? '' : 'border border-ink-muted'}`}
                        style={fill ? { background: fill } : undefined}
                      />
                      <span title={p.system.name} className="truncate text-sm font-semibold text-ink-bright">
                        {p.system.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          {back}
          {picker}
        </div>
        {chart}
        {unplaced}
      </div>
      {chosen && <SystemCard placed={chosen} order={galaxy.placed.indexOf(chosen) + 1} lyPerRegion={lyPerRegion} />}
    </div>
  );
}

// The largest square the pane has room for, so a chart is as big as it can be without stretching (d04, d05).
export function FitSquare({ children, max = Infinity }: { children: ReactNode; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setSide(Math.floor(Math.min(el.clientWidth - 36, el.clientHeight, max)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => {
      watch.disconnect();
    };
  }, [max]);
  return (
    <div ref={ref} className="flex-1 min-h-0 grid place-items-center px-[18px]">
      <div style={side ? { width: side, height: side } : undefined} className="w-full">
        {children}
      </div>
    </div>
  );
}

function MapTool({
  icon,
  label,
  disabled = false,
  onClick
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="w-9 h-9 rounded-[10px] border border-control-edge bg-[rgba(5,8,17,0.85)] text-ink grid place-items-center hover:border-control-edge-hover disabled:text-ink-disabled"
    >
      <i className={`ph-bold ${icon}`} aria-hidden="true" />
    </button>
  );
}

// The whole galaxy as its spiral glyph, with the stretch the cluster covers boxed and the centre marked.
function Locator({
  galaxy,
  colour,
  view
}: {
  galaxy: GalaxyJourney;
  colour: string;
  view: ReturnType<typeof clusterView>;
}) {
  const half = LOCATOR / 2;
  const reach = LOCATOR * 0.42;
  const side = Math.max(4, view.span * reach);
  return (
    <g transform={`translate(${String(S - LOCATOR - 10)} 10)`}>
      <rect width={LOCATOR} height={LOCATOR} rx={12} fill="rgba(5,8,17,.85)" stroke="rgba(148,163,184,.25)" />
      {spiralDots(galaxy.name, galaxy.type, 160).map((d, k) => (
        <circle key={k} cx={half + d.x * reach} cy={half + d.y * reach} r={0.5} fill={colour} fillOpacity={0.5 * d.o} />
      ))}
      <rect
        x={half + view.centre.x * reach - side / 2}
        y={half + view.centre.y * reach - side / 2}
        width={side}
        height={side}
        fill="none"
        stroke="#fcd34d"
      />
      <circle cx={half} cy={half} r={2} fill="#fff7d6" />
    </g>
  );
}

function SystemCard({
  placed,
  order,
  lyPerRegion,
  desk = false
}: {
  placed: GalaxyJourney['placed'][number];
  order: number;
  lyPerRegion: number | null;
  desk?: boolean;
}) {
  const { system } = placed;
  const fill = starColour(system);
  const planets = planetsOf(system);
  return (
    <section
      id="mapSystem"
      aria-labelledby="mapSystemName"
      className={
        desk ? 'flex flex-col gap-3' : 'rounded-card bg-panel-glass border border-hairline p-4 flex flex-col gap-3'
      }
    >
      {desk && <p className="m-0 text-label uppercase text-ink-label">Selected</p>}
      <div className="flex items-center gap-3">
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" className="shrink-0">
          {fill ? (
            <circle cx="17" cy="17" r="10" fill={fill} />
          ) : (
            <circle cx="17" cy="17" r="10" fill="none" stroke="#94a3b8" />
          )}
          {isBase(system) && <circle cx="17" cy="17" r="15" fill="none" stroke="#22d3ee" strokeWidth="1.5" />}
        </svg>
        <div className="flex-1 min-w-0">
          <h2 id="mapSystemName" className="font-display font-bold text-[15px] text-ink-bright truncate">
            {system.name}
          </h2>
          <p className="text-caption text-ink-muted truncate">
            {[
              isBase(system) ? 'Base' : '',
              system.race ? RACES[system.race] : '',
              planets ? `${String(planets)} planet${planets === 1 ? '' : 's'}` : ''
            ]
              .filter(Boolean)
              .join(' · ') || 'Logged system'}
          </p>
        </div>
        <Button
          size="S"
          onClick={() => {
            openSystem(system.id);
          }}
        >
          Open
        </Button>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <Stat label="From centre" value={lyPerRegion ? formatLightYears(placed.regions, lyPerRegion) : '—'} />
        <Stat label="Region" value={`${system.glyphs.slice(6, 9)}·${system.glyphs.slice(9, 12)}`} />
        <Stat label="Visited" value={ordinal(order)} />
      </dl>
    </section>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[12px] bg-slate-ground border border-hairline px-2.5 py-2 flex flex-col gap-0.5 min-w-0">
    <dt className="text-[9px] font-semibold tracking-[0.14em] uppercase text-ink-label">{label}</dt>
    <dd className="font-mono text-[14px] text-ink-bright truncate">{value}</dd>
  </div>
);
