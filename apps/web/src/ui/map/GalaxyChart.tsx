// One galaxy's map (round 7, c17, A "Zoom lens"): the player's systems at true scale; only the zoom changes. Three
// levels: the galaxy (the whole disc, a pin per cluster), a cluster (each region a dot) and a region (a stack fans
// out round its one point). The breadcrumb is the zoom level and the way up, the locator the way out, and the core
// is always on the map or in the edge chip. The map is one tab stop; the list beside it is the full equivalent.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { formatLightYears } from '@atlas/core/location';
import {
  coreChip,
  fanOf,
  fitCamera,
  frameCamera,
  galaxyCamera,
  mergePins,
  ordinal,
  project,
  regionCode,
  ringLabelAt,
  ringStep,
  ringsInView,
  scaleBar,
  zoomAt,
  zoomLevel,
  CLUSTER_PPR,
  MAX_PPR,
  RIM_REGIONS,
  type Camera,
  type Cluster,
  type GalaxyJourney,
  type Stack
} from '@atlas/core/map';
import { STAR_CLASSES, type System } from '@atlas/core/systems-model';
import { GalaxySpiral } from './GalaxySpiral.tsx';
import type { MapCamera } from './useMapCamera.ts';

export type MapPick = { kind: 'system'; i: number } | { kind: 'cluster'; id: string };
/** What's hovered, shared by the map and the list: "s3" (system 3) or "c<cluster id>". */
export type MapHover = string | null;

export interface MapModel {
  galaxy: GalaxyJourney;
  clusters: Cluster[];
  stacks: Stack[];
  stackOf: number[]; // system index → stack index
  clusterOf: number[]; // system index → cluster index
}

export const isBase = (system: System) =>
  system.tags.includes('base') || system.planets.some(planet => planet.tags.includes('base'));
export const starColour = (system: System) => (system.star ? STAR_CLASSES[system.star].color : null);

const MONO = "'JetBrains Mono', monospace";
const halo = { paintOrder: 'stroke', stroke: '#050811', strokeWidth: 3.2, strokeLinejoin: 'round' } as const;
const textWidth = (text: string, size: number) => text.length * size * 0.58;

export function GalaxyChart({
  model,
  camera,
  pick,
  hover,
  focus,
  lyPerRegion,
  desk,
  onPick,
  onHover,
  onFocus
}: {
  model: MapModel;
  camera: MapCamera;
  pick: MapPick | null;
  hover: MapHover;
  focus: number | null;
  lyPerRegion: number | null;
  desk: boolean;
  onPick: (pick: MapPick) => void;
  onHover: (hover: MapHover) => void;
  onFocus: (i: number | null) => void;
}) {
  const { galaxy, clusters, stacks, stackOf, clusterOf } = model;
  const box = useRef<HTMLDivElement>(null);
  const { size, setSize, goTo, jump, fade } = camera;
  // Until the box is measured (and in tests, where nothing is) the map is drawn at the board's 358 × 384.
  const w = size.w || 358;
  const h = size.h || 384;
  const cam = camera.cam ?? galaxyCamera(w, h);
  const latest = camera.now;
  const now = useCallback(() => latest() ?? cam, [latest, cam]);
  const [keyed, setKeyed] = useState(false); // the map has keyboard focus: show the cursor and the key hints
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: boolean; pinch: number }>({ moved: false, pinch: 0 });

  // The phone card is 358 × 384 (31); on the Workbench the pane is the map's box (d05).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const width = Math.round(el.clientWidth);
      setSize({ w: width, h: desk ? Math.round(el.clientHeight) : Math.round((width * 384) / 358) });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => {
      watch.disconnect();
    };
  }, [desk, setSize]);

  // A wheel zooms on the point under it; the listener isn't passive so the page doesn't scroll as well.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const c = now();
      if (!w) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      jump(zoomAt(c, Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top, w, h));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [now, jump, w, h]);

  const selectedSystem = pick?.kind === 'system' ? pick.i : null;
  const selectedCluster = pick?.kind === 'cluster' ? pick.id : null;
  const at = (i: number) => {
    const p = galaxy.placed[i];
    return p ? project(cam, w, h, p.voxel.x, p.voxel.z) : { x: 0, y: 0 };
  };

  // Where the selection is, for zooming on it.
  const anchor = (c: Camera) => {
    const i = selectedSystem ?? focus;
    if (i === null) return { x: w / 2, y: h / 2 };
    const p = galaxy.placed[i];
    if (!p) return { x: w / 2, y: h / 2 };
    const q = project(c, w, h, p.voxel.x, p.voxel.z);
    return q.x > 0 && q.x < w && q.y > 0 && q.y < h ? q : { x: w / 2, y: h / 2 };
  };
  const zoomBy = (factor: number) => {
    const c = camera.aim() ?? cam;
    const a = anchor(c);
    goTo(zoomAt(c, factor, a.x, a.y, w, h));
  };
  const toGalaxy = () => {
    goTo(galaxyCamera(w, h));
  };
  const toFit = () => {
    goTo(fitCamera(clusters, w, h));
  };
  const toCluster = (cluster: Cluster) => {
    goTo(frameCamera(cluster.stacks, w, h));
  };
  const toStack = (stack: Stack) => {
    goTo(frameCamera([stack], w, h));
  };

  // Taps. A tap selects; a second tap on what's already selected goes in (31e).
  const tapPin = (ids: string[]) => {
    const group = ids.map(id => clusters.find(c => c.id === id)).filter(c => c !== undefined);
    const [main] = group;
    if (!main) return;
    // A cluster that is one region is a stack: a tap selects its first system, the card's tabs reach the rest.
    const only = group.length === 1 && main.stacks.length === 1 ? main.stacks[0] : undefined;
    if (only) {
      tapStack(only);
      return;
    }
    if (selectedCluster === main.id)
      goTo(
        frameCamera(
          group.flatMap(c => c.stacks),
          w,
          h
        )
      );
    else onPick({ kind: 'cluster', id: main.id });
  };
  const tapStack = (stack: Stack) => {
    const inside = selectedSystem !== null && stack.members.includes(selectedSystem);
    if (inside) toStack(stack);
    else onPick({ kind: 'system', i: stack.members[0] ?? 0 });
  };
  const tapped = (run: () => void) => () => {
    if (!drag.current.moved) run();
  };

  // Drag to pan; two fingers pinch.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('button, a')) return; // the overlays' own controls
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    drag.current = { moved: false, pinch: 0 };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(event.pointerId);
    const c = now();
    if (!last) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    if (!drag.current.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.current.moved) box.current?.setPointerCapture(event.pointerId);
    drag.current.moved = true;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const all = [...pointers.current.values()];
    if (all.length >= 2) {
      const [a, b] = all as [{ x: number; y: number }, { x: number; y: number }];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = box.current?.getBoundingClientRect();
      if (drag.current.pinch && rect) {
        const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
        jump(zoomAt(c, distance / drag.current.pinch, mid.x, mid.y, w, h));
      }
      drag.current.pinch = distance;
      return;
    }
    jump({ ...c, x: c.x - dx / c.ppr, z: c.z - dy / c.ppr });
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    drag.current.pinch = 0;
    // The click that ends a drag isn't a tap; it's swallowed in tapped() before this clears.
    setTimeout(() => {
      if (!pointers.current.size) drag.current.moved = false;
    });
  };

  // The keyboard (d05b): ←/→ log order, ↑/↓ within a stack, Enter selects, + / − zoom, 0 fits, G the galaxy.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = galaxy.placed.length;
    const cursor = focus ?? selectedSystem ?? count - 1;
    const move = (i: number) => {
      onFocus(i);
      const c = now();
      const p = galaxy.placed[i];
      if (!p) return;
      const q = project(c, w, h, p.voxel.x, p.voxel.z);
      if (q.x < 24 || q.x > w - 24 || q.y < 24 || q.y > h - 24) goTo({ ...c, x: p.voxel.x, z: p.voxel.z });
    };
    const stack = stacks[stackOf[cursor] ?? -1];
    const within = stack?.members.indexOf(cursor) ?? -1;
    const keys: Record<string, () => void> = {
      ArrowRight: () => {
        move(Math.min(count - 1, cursor + 1));
      },
      ArrowLeft: () => {
        move(Math.max(0, cursor - 1));
      },
      ArrowDown: () => {
        if (stack && within < stack.members.length - 1) move(stack.members[within + 1] ?? cursor);
      },
      ArrowUp: () => {
        if (stack && within > 0) move(stack.members[within - 1] ?? cursor);
      },
      Enter: () => {
        onPick({ kind: 'system', i: cursor });
      },
      '+': () => {
        zoomBy(2);
      },
      '=': () => {
        zoomBy(2);
      },
      '-': () => {
        zoomBy(0.5);
      },
      _: () => {
        zoomBy(0.5);
      },
      '0': toFit,
      g: toGalaxy,
      G: toGalaxy
    };
    const run = keys[event.key];
    if (!run || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    run();
  };

  const level = zoomLevel(cam.ppr);
  const core = project(cam, w, h, 0, 0);
  const rim = RIM_REGIONS * cam.ppr;
  const coreShown = core.x > -10 && core.x < w + 10 && core.y > -10 && core.y < h + 10;
  const spiral = cam.ppr <= CLUSTER_PPR ? 1 : Math.max(0, 1 - Math.log(cam.ppr / CLUSTER_PPR) / Math.log(4));
  const ly = (regions: number) =>
    lyPerRegion ? formatLightYears(regions, lyPerRegion) : `${String(Math.round(regions))} reg.`;
  const visible = (x: number, y: number, m = 40) => x > -m && x < w + m && y > -m && y < h + m;

  // Rings round the core: 200k ly on the galaxy (labelled down and to the left), round steps when zoomed in
  // (labelled where they leave the view).
  const step = ringStep(cam.ppr, lyPerRegion, level === 'galaxy' ? 36 : 80);
  const rings = ringsInView(cam, w, h, step).filter(r => r < RIM_REGIONS - step / 2);
  const ringLabels = rings.map(r =>
    level === 'galaxy'
      ? { x: core.x - 0.669 * (r * cam.ppr + 2), y: core.y + 0.743 * (r * cam.ppr + 2) + 3, anchor: 'middle' as const }
      : ringLabelAt(cam, w, h, r)
  );

  // The way the player travelled, in log order.
  const trail = galaxy.placed.map((_, i) => at(i));

  // Galaxy level: a pin per cluster; pins that would overlap merge. A cluster of one is its system's dot.
  const pins =
    level === 'galaxy'
      ? mergePins(
          clusters.map(c => ({ id: c.id, ...project(cam, w, h, c.x, c.z), count: c.members.length })),
          2
        )
      : [];
  const clusterById = new Map(clusters.map(c => [c.id, c]));
  const holds = (ids: string[], i: number | null) =>
    i !== null && ids.some(id => clusterById.get(id)?.members.includes(i));

  // Labels never sit on top of each other: placed greedily, the selection first, then the biggest pins.
  const taken: { x: number; y: number; w: number; h: number }[] = [];
  // `first`: the selection's label, placed before any other, only has to fit in the view.
  const place = (x: number, y: number, text: string, size: number, anchorEnd: boolean, first = false) => {
    const width = textWidth(text, size);
    const left = anchorEnd ? x - width : x;
    const rect = { x: left - 2, y: y - size, w: width + 4, h: size + 4 };
    if (left < 4 || left + width > w - 4) return false;
    if (
      !first &&
      taken.some(t => t.x < rect.x + rect.w && rect.x < t.x + t.w && t.y < rect.y + rect.h && rect.y < t.y + t.h)
    )
      return false;
    taken.push(rect);
    return true;
  };
  // A mark's own area, so no label lands on a pin or a dot.
  const occupy = (x: number, y: number, r: number) => {
    taken.push({ x: x - r, y: y - r, w: 2 * r, h: 2 * r });
  };

  const labels: ReactNode[] = [];
  const pinLabel = (x: number, y: number, r: number, text: string, key: string, bright: boolean) => {
    const away = x >= core.x;
    const sides = away ? [true, false] : [false, true];
    // The selection's label tries both sides like any other, and only then goes over a neighbour.
    for (const [right, force] of [
      ...sides.map(r => [r, false] as const),
      ...(bright ? sides.map(r => [r, true] as const) : [])
    ]) {
      const tx = right ? x + r + 6 : x - r - 6;
      if (place(tx, y + 4, text, 11, !right, force)) {
        labels.push(
          <text
            key={key}
            x={tx}
            y={y + 4}
            textAnchor={right ? 'start' : 'end'}
            fontFamily="Inter, sans-serif"
            fontSize={11}
            fontWeight={600}
            fill={bright ? '#fff' : '#e2e8f0'}
            {...halo}
          >
            {text}
          </text>
        );
        return;
      }
    }
  };

  const ring = (x: number, y: number, r: number, colour: string, width = 2, dash?: string) => (
    <circle
      cx={x}
      cy={y}
      r={r}
      fill="none"
      stroke={colour}
      strokeWidth={width}
      strokeDasharray={dash}
      strokeOpacity={dash ? 0.7 : 1}
    />
  );
  const dot = (system: System, x: number, y: number, r: number) => {
    const fill = starColour(system);
    return fill ? (
      <circle cx={x} cy={y} r={r} fill={fill} />
    ) : (
      <circle cx={x} cy={y} r={r * 0.85} fill="#050811" stroke="#94a3b8" strokeWidth={1.5} />
    );
  };

  // A system's marks: the cyan base ring, the white selection ring, the dashed hover ring.
  const marks = (i: number, x: number, y: number, r: number) => {
    const p = galaxy.placed[i];
    if (!p) return null;
    return (
      <>
        {isBase(p.system) && ring(x, y, r + 4, '#22d3ee')}
        {selectedSystem === i && ring(x, y, r + 8, '#fff', 1.8)}
        {(hover === `s${String(i)}` || (keyed && focus === i)) && ring(x, y, r + 12, '#94a3b8', 1.2, '2 3')}
      </>
    );
  };

  const drawn: ReactNode[] = [];
  if (level === 'galaxy') {
    const ranked = [...pins].sort((a, b) => b.count - a.count);
    const labelled = new Set(ranked.slice(0, 4));
    const first = pins.find(p => holds(p.ids, selectedSystem) || (selectedCluster && p.ids.includes(selectedCluster)));
    const order = first ? [first, ...ranked.filter(p => p !== first)] : ranked;
    for (const pin of pins) occupy(pin.x, pin.y, pin.count === 1 ? 10 : pin.r + 4);
    for (const pin of order) {
      const main = clusterById.get(pin.ids[0] ?? '');
      if (!main) continue;
      const lone = pin.count === 1 ? (main.members[0] ?? null) : null;
      const chosen = holds(pin.ids, selectedSystem) || (selectedCluster !== null && pin.ids.includes(selectedCluster));
      const key = `p${pin.ids.join('|')}`;
      if (lone !== null) {
        const p = galaxy.placed[lone];
        if (!p) continue;
        drawn.push(
          <g
            key={key}
            data-pin={main.id}
            onClick={tapped(() => {
              tapPin(pin.ids);
            })}
            {...hoverProps(`s${String(lone)}`)}
          >
            <circle cx={pin.x} cy={pin.y} r={22} fill="transparent" />
            {dot(p.system, pin.x, pin.y, 6)}
            {marks(lone, pin.x, pin.y, 6)}
          </g>
        );
        if (chosen || labelled.has(pin)) pinLabel(pin.x, pin.y, 14, p.system.name, `l${key}`, chosen);
        continue;
      }
      const base = pin.ids.some(id => clusterById.get(id)?.base !== null);
      const hovered = pin.ids.some(id => hover === `c${id}`) || (keyed && holds(pin.ids, focus));
      drawn.push(
        <g
          key={key}
          data-pin={main.id}
          onClick={tapped(() => {
            tapPin(pin.ids);
          })}
          {...hoverProps(`c${main.id}`)}
        >
          <circle cx={pin.x} cy={pin.y} r={Math.max(22, pin.r + 6)} fill="transparent" />
          <circle
            cx={pin.x}
            cy={pin.y}
            r={pin.r}
            fill="#0e7490"
            fillOpacity={0.38}
            stroke="#67e8f9"
            strokeWidth={1.5}
          />
          {base && ring(pin.x, pin.y, pin.r + 3.5, '#22d3ee')}
          {chosen && ring(pin.x, pin.y, pin.r + 7.5, '#fff', 1.8)}
          {hovered && ring(pin.x, pin.y, pin.r + 11, '#94a3b8', 1.2, '2 3')}
          <text
            x={pin.x}
            y={pin.y + 3.6}
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontSize={10.5}
            fontWeight={700}
            fill="#ecfeff"
          >
            {pin.count}
          </text>
        </g>
      );
      if (chosen || labelled.has(pin)) {
        const more = pin.ids.length > 1 ? ` +${String(pin.ids.length - 1)}` : '';
        pinLabel(pin.x, pin.y, pin.r + 4, `${main.name}${more} · ${String(pin.count)}`, `l${key}`, chosen);
      }
    }
  } else {
    // Cluster and region levels: each region is one point. The selection's stack is drawn last, on top.
    const order = [...stacks.keys()].sort(
      (a, b) =>
        Number(selectedSystem !== null && stackOf[selectedSystem] === a) -
        Number(selectedSystem !== null && stackOf[selectedSystem] === b)
    );
    for (const k of order.reverse()) {
      const stack = stacks[k];
      if (!stack) continue;
      const c = project(cam, w, h, stack.x, stack.z);
      if (!visible(c.x, c.y, 60)) continue;
      occupy(c.x, c.y, 10);
      const many = stack.members.length > 1;
      const shown =
        selectedSystem !== null && stack.members.includes(selectedSystem) ? selectedSystem : (stack.members[0] ?? 0);
      if (level === 'region' && many) {
        // The fan: a drawing round the one true point, never positions of their own.
        const fan = fanOf(stack.members.length);
        drawn.push(
          <g key={stack.key}>
            <circle
              cx={c.x}
              cy={c.y}
              r={fan.radius}
              fill="#0b1325"
              fillOpacity={0.7}
              stroke="#94a3b8"
              strokeOpacity={0.28}
              strokeDasharray="2 3"
            />
            <path
              d={`M${String(c.x - 4)},${String(c.y)}h8M${String(c.x)},${String(c.y - 4)}v8`}
              stroke="#cbd5e1"
              strokeWidth={1.4}
            />
            {stack.members.map((i, n) => {
              const angle = ((fan.angles[n] ?? 0) * Math.PI) / 180;
              const x = c.x + Math.cos(angle) * fan.radius;
              const y = c.y + Math.sin(angle) * fan.radius;
              const p = galaxy.placed[i];
              if (!p) return null;
              return (
                <g
                  key={p.system.id}
                  onClick={tapped(() => {
                    onPick({ kind: 'system', i });
                  })}
                  {...hoverProps(`s${String(i)}`)}
                >
                  <line x1={c.x} y1={c.y} x2={x} y2={y} stroke="#94a3b8" strokeOpacity={0.45} />
                  <circle cx={x} cy={y} r={20} fill="transparent" />
                  {dot(p.system, x, y, 6)}
                  {marks(i, x, y, 6)}
                </g>
              );
            })}
          </g>
        );
        stack.members.forEach((i, n) => {
          const p = galaxy.placed[i];
          const deg = fan.angles[n] ?? 0;
          if (!p) return;
          const angle = (deg * Math.PI) / 180;
          const x = c.x + Math.cos(angle) * fan.radius;
          const y = c.y + Math.sin(angle) * fan.radius;
          const right = Math.cos(angle) >= -0.01;
          const tx = right ? x + 13 : x - 20;
          if (place(tx, y + 4, p.system.name, 11.5, !right))
            labels.push(
              <text
                key={`l${p.system.id}`}
                x={tx}
                y={y + 4}
                textAnchor={right ? 'start' : 'end'}
                fontFamily="Inter, sans-serif"
                fontSize={11.5}
                fontWeight={600}
                fill={selectedSystem === i ? '#fff' : '#e2e8f0'}
                {...halo}
              >
                {p.system.name}
              </text>
            );
        });
        const caption = `Region ${regionCode(galaxy.placed[stack.members[0] ?? 0]?.system.glyphs ?? '')} · ${String(stack.members.length)} systems`;
        if (place(c.x - textWidth(caption, 9.5) / 2, c.y + fan.radius + 18, caption, 9.5, false))
          labels.push(
            <text
              key={`c${stack.key}`}
              x={c.x}
              y={c.y + fan.radius + 18}
              textAnchor="middle"
              fontFamily={MONO}
              fontSize={9.5}
              fill="#94a3b8"
              {...halo}
            >
              {caption}
            </text>
          );
        continue;
      }
      const p = galaxy.placed[shown];
      if (!p) continue;
      const r = level === 'region' ? 6 : 5;
      drawn.push(
        <g
          key={stack.key}
          onClick={tapped(() => {
            tapStack(stack);
          })}
          {...hoverProps(`s${String(shown)}`)}
        >
          <circle cx={c.x} cy={c.y} r={22} fill="transparent" />
          {dot(p.system, c.x, c.y, r)}
          {marks(shown, c.x, c.y, r)}
          {many && (
            <>
              <circle cx={c.x + 9} cy={c.y - 9} r={7.5} fill="#0b1325" stroke="#67e8f9" strokeWidth={1.2} />
              <text
                x={c.x + 9}
                y={c.y - 5.7}
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
                fontSize={9.5}
                fontWeight={700}
                fill="#cffafe"
              >
                {stack.members.length}
              </text>
            </>
          )}
        </g>
      );
      if (shown === selectedSystem || level === 'region') {
        const tx = c.x + (many ? 22 : 16);
        if (place(tx, c.y + 4, p.system.name, 11.5, false))
          labels.push(
            <text
              key={`l${stack.key}`}
              x={tx}
              y={c.y + 4}
              fontFamily="Inter, sans-serif"
              fontSize={11.5}
              fontWeight={600}
              fill="#fff"
              {...halo}
            >
              {p.system.name}
            </text>
          );
      }
    }
  }

  function hoverProps(key: string) {
    return {
      className: 'cursor-pointer',
      onPointerEnter: () => {
        onHover(key);
      },
      onPointerLeave: () => {
        onHover(null);
      }
    };
  }

  // The breadcrumb: the galaxy, the cluster nearest the view's centre, and at region level the region.
  const nearest = stacks.reduce<{ k: number; d: number }>(
    (best, s, k) => {
      const d = Math.hypot(s.x - cam.x, s.z - cam.z);
      return d < best.d ? { k, d } : best;
    },
    { k: -1, d: Infinity }
  );
  const nearStack = stacks[nearest.k];
  const nearCluster = nearStack ? clusters.find(c => c.stacks.includes(nearStack)) : undefined;
  const crumbs: { label: string; go: () => void }[] = [{ label: galaxy.name, go: toGalaxy }];
  if (level !== 'galaxy' && nearCluster)
    crumbs.push({
      label: nearCluster.name,
      go: () => {
        toCluster(nearCluster);
      }
    });
  if (level === 'region' && nearStack && nearest.d * cam.ppr < Math.max(w, h) / 2) {
    const code = regionCode(galaxy.placed[nearStack.members[0] ?? 0]?.system.glyphs ?? '');
    crumbs.push({
      label: desk ? `Region ${code}` : code,
      go: () => {
        toStack(nearStack);
      }
    });
  }

  // The core chip: clear of the breadcrumb and locator above and the tools below.
  const chip = coreChip(cam, w, h, { left: 74, top: 100, right: w - 74, bottom: h - 34 });
  if (chip && chip.x < 130 && chip.y > h - 150) chip.y = h - 150;
  const bar = scaleBar(cam.ppr, lyPerRegion);
  const focused = keyed && focus !== null ? galaxy.placed[focus] : undefined;
  const focusAt = focus !== null ? at(focus) : null;
  const viewSide = Math.max(w, h) / cam.ppr / RIM_REGIONS; // the view's extent in rim units, for the locator

  return (
    <div
      ref={box}
      id="mapGalaxy"
      role="application"
      tabIndex={0}
      aria-roledescription="map"
      aria-label={`${galaxy.name}: your ${String(galaxy.placed.length)} system${galaxy.placed.length === 1 ? '' : 's'} with an address, at true scale. Arrow keys move through them, Enter selects, plus and minus zoom, 0 fits, G shows the galaxy. The list has every one.`}
      onKeyDown={onKeyDown}
      onFocus={event => {
        // The cursor and its hints are for the keyboard; a tap that focuses the map shows neither.
        if (event.target !== event.currentTarget || !event.currentTarget.matches(':focus-visible')) return;
        setKeyed(true);
        if (focus === null) onFocus(selectedSystem ?? galaxy.placed.length - 1);
      }}
      onBlur={event => {
        if (event.target === event.currentTarget) setKeyed(false);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`${desk ? 'absolute inset-0' : 'relative w-full'} overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-scanner-cyan focus-visible:-outline-offset-2`}
      style={desk ? undefined : { height: h }}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${String(w)} ${String(h)}`}
        aria-hidden="true"
        className="absolute inset-0 block"
      >
        <g key={fade} className={fade ? 'map-fade' : undefined}>
          <defs>
            <radialGradient id="gmGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#1e3a5f" stopOpacity={0.55} />
              <stop offset=".35" stopColor="#0f2440" stopOpacity={0.35} />
              <stop offset="1" stopColor="#0b1325" stopOpacity={0} />
            </radialGradient>
          </defs>
          {rim < 4e5 && <circle cx={core.x} cy={core.y} r={rim} fill="url(#gmGlow)" />}
          {spiral > 0 && (
            <g opacity={spiral}>
              <GalaxySpiral name={galaxy.name} type={galaxy.type} cx={core.x} cy={core.y} r={rim} />
            </g>
          )}
          {rings.map(r => (
            <circle
              key={r}
              cx={core.x}
              cy={core.y}
              r={r * cam.ppr}
              fill="none"
              stroke="#94a3b8"
              strokeOpacity={level === 'galaxy' ? 0.16 : 0.13}
            />
          ))}
          {rings.map((r, k) => {
            const label = ringLabels[k];
            const fits =
              label &&
              place(
                label.anchor === 'end' ? label.x : label.x - textWidth(ly(r), 9) / 2,
                label.y,
                ly(r),
                9,
                label.anchor === 'end'
              );
            return fits ? (
              <text
                key={`r${String(r)}`}
                x={label.x}
                y={label.y}
                textAnchor={label.anchor}
                fontFamily={MONO}
                fontSize={9}
                fontWeight={500}
                fill="#64748b"
                {...halo}
              >
                {ly(r)}
              </text>
            ) : null;
          })}
          <circle
            cx={core.x}
            cy={core.y}
            r={rim}
            fill="none"
            stroke="#94a3b8"
            strokeOpacity={0.38}
            strokeWidth={1.2}
            strokeDasharray="3 5"
          />
          {level === 'galaxy' && (
            <text
              x={core.x}
              y={core.y - rim - 8}
              textAnchor="middle"
              fontFamily={MONO}
              fontSize={9}
              fontWeight={600}
              fill="#64748b"
              {...halo}
            >
              {`RIM · ${ly(RIM_REGIONS)}`}
            </text>
          )}
          {coreShown && (
            <>
              <circle cx={core.x} cy={core.y} r={9} fill="#fff" fillOpacity={0.07} />
              <circle cx={core.x} cy={core.y} r={6.5} fill="none" stroke="#f8fafc" strokeOpacity={0.45} />
              <circle cx={core.x} cy={core.y} r={3.5} fill="#f8fafc" />
              <text
                x={core.x}
                y={core.y + 19}
                textAnchor="middle"
                fontFamily={MONO}
                fontSize={9.5}
                fontWeight={700}
                fill="#e2e8f0"
                {...halo}
              >
                CORE
              </text>
            </>
          )}
          {trail.length > 1 && (
            <path
              d={`M${trail.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`}
              fill="none"
              stroke="#fbbf24"
              strokeOpacity={level === 'galaxy' ? 0.28 : 0.34}
              strokeDasharray={level === 'galaxy' ? '3 4' : undefined}
              strokeLinejoin="round"
            />
          )}
          {drawn}
          {labels}
        </g>
      </svg>

      <nav
        aria-label="Zoom level"
        className={`absolute left-2.5 top-2.5 ${level === 'galaxy' ? 'right-2.5' : 'right-[84px]'}`}
      >
        <ol className="m-0 p-0 list-none flex items-center gap-1 min-w-0">
          {crumbs.map((crumb, k) => {
            const current = k === crumbs.length - 1;
            return (
              <li key={crumb.label} className="flex items-center gap-1 min-w-0 shrink">
                {k > 0 && (
                  <span aria-hidden="true" className="text-[12px] text-ink-disabled shrink-0">
                    ›
                  </span>
                )}
                <button
                  type="button"
                  aria-current={current ? 'location' : undefined}
                  onClick={crumb.go}
                  className={`h-[26px] min-w-0 max-w-[170px] px-2 rounded-[8px] bg-[rgba(5,8,17,0.82)] border text-[11.5px] font-semibold truncate ${
                    current
                      ? 'border-scanner-cyan-edge-strong text-scanner-cyan-text'
                      : 'border-control-edge text-ink-muted'
                  }`}
                >
                  {crumb.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {level !== 'galaxy' && (
        <button
          type="button"
          aria-label="Whole galaxy (zoom out)"
          onClick={toGalaxy}
          className="absolute right-2.5 top-2.5 w-[70px] h-[70px] rounded-[12px] border border-control-edge bg-[rgba(5,8,17,0.86)] grid place-items-center"
        >
          <svg width="66" height="66" viewBox="0 0 66 66" aria-hidden="true">
            <GalaxySpiral name={galaxy.name} type={galaxy.type} cx={33} cy={33} r={29} detail={false} />
            <circle cx={33} cy={33} r={29} fill="none" stroke="#94a3b8" strokeOpacity={0.4} strokeDasharray="2 3" />
            <circle cx={33} cy={33} r={2} fill="#fff" />
            <rect
              x={33 + (cam.x / RIM_REGIONS) * 29 - Math.max(5, viewSide * 29) / 2}
              y={33 + (cam.z / RIM_REGIONS) * 29 - Math.max(5, viewSide * 29) / 2}
              width={Math.max(5, viewSide * 29)}
              height={Math.max(5, viewSide * 29)}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={1.4}
            />
          </svg>
        </button>
      )}

      {chip && (
        <button
          type="button"
          onClick={() => {
            const c = now();
            goTo({ ...c, x: 0, z: 0 });
          }}
          aria-label={`Centre the core, ${ly(chip.regions)} away`}
          className="absolute -translate-x-1/2 -translate-y-1/2 h-[26px] pl-1.5 pr-2.5 rounded-full inline-flex items-center gap-1.5 bg-[rgba(5,8,17,0.88)] border border-scanner-cyan-edge-strong text-scanner-cyan-text font-mono text-[11.5px] font-semibold whitespace-nowrap"
          style={{ left: chip.x, top: chip.y }}
        >
          <i
            className="ph-bold ph-arrow-up inline-block text-[13px]"
            aria-hidden="true"
            style={{ transform: `rotate(${(chip.bearing + 90).toFixed(0)}deg)` }}
          />
          {`Core · ${ly(chip.regions)}`}
        </button>
      )}

      <div role="toolbar" aria-label="Zoom" className="absolute left-2.5 bottom-2.5 flex flex-col gap-1.5">
        <MapTool
          icon="ph-plus"
          label="Zoom in"
          disabled={cam.ppr >= MAX_PPR}
          onClick={() => {
            zoomBy(2);
          }}
        />
        <MapTool
          icon="ph-minus"
          label="Zoom out"
          disabled={cam.ppr <= galaxyCamera(w, h).ppr * 1.001}
          onClick={() => {
            zoomBy(0.5);
          }}
        />
        <MapTool icon="ph-corners-out" label="Fit all my systems" onClick={toFit} />
      </div>

      <div
        aria-hidden="true"
        className="absolute right-3 bottom-2.5 flex flex-col items-end gap-[3px] font-mono text-[10px] text-ink-muted"
      >
        <span>{lyPerRegion ? `${bar.length.toLocaleString('en')} ly` : `${String(bar.length)} reg.`}</span>
        <i className="block h-1.5 border-[1.2px] border-t-0 border-ink-muted" style={{ width: bar.px }} />
      </div>

      {focused && focusAt && (
        <p
          aria-hidden="true"
          className="absolute m-0 -translate-x-1/2 h-7 px-2.5 rounded-[8px] inline-flex items-center gap-1.5 bg-[rgba(5,8,17,0.92)] border border-control-edge text-[12px] text-ink whitespace-nowrap pointer-events-none"
          style={{ left: Math.min(w - 120, Math.max(120, focusAt.x)), top: Math.max(4, focusAt.y - 46) }}
        >
          {`${focused.system.name} · ${ordinal((focus ?? 0) + 1)} · ${focused.system.star ? `${STAR_CLASSES[focused.system.star].label} star` : 'no star class'}`}
          <kbd className="font-mono text-[10px] px-1 rounded border border-control-edge">↵</kbd>
        </p>
      )}
      {keyed && desk && (
        <p
          aria-hidden="true"
          className="absolute left-14 bottom-2.5 m-0 h-9 px-2 rounded-[8px] inline-flex items-center gap-1.5 bg-[rgba(5,8,17,0.9)] border border-control-edge text-[12px] text-ink-muted whitespace-nowrap"
        >
          <Keys k={['←', '→']} /> log order <Keys k={['↑', '↓']} /> same region <Keys k={['↵']} /> select{' '}
          <Keys k={['+', '−']} /> zoom <Keys k={['0']} /> fit <Keys k={['G']} /> galaxy
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {focused
          ? `${focused.system.name}, ${ordinal((focus ?? 0) + 1)}, region ${regionCode(focused.system.glyphs)}${
              (stacks[stackOf[focus ?? 0] ?? -1]?.members.length ?? 1) > 1
                ? `, ${String(stacks[stackOf[focus ?? 0] ?? -1]?.members.length)} systems in this region`
                : ''
            }, in ${clusters[clusterOf[focus ?? 0] ?? -1]?.name ?? galaxy.name}`
          : ''}
      </p>
    </div>
  );
}

const Keys = ({ k }: { k: string[] }) => (
  <span className="inline-flex gap-0.5">
    {k.map(key => (
      <kbd
        key={key}
        className="min-w-5 h-5 px-1 rounded border border-control-edge font-mono text-[10px] text-ink grid place-items-center"
      >
        {key}
      </kbd>
    ))}
  </span>
);

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
