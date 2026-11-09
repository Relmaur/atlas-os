// One galaxy (round 7: 31–31i on a phone, d05–d05c on the Workbench; component c17): the map at true scale, the
// selected system or cluster, and the list grouped by cluster. The map and the list share one selection, one hover
// and one keyboard focus, so they never disagree about what's selected. Opens on the whole galaxy.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatLightYears } from '@atlas/core/location';
import { clustersOf, frameCamera, project, tide, type GalaxyJourney, type Journey } from '@atlas/core/map';
import { openSystemEditor } from '../systems/panel-store.ts';
import { GalaxyChart, type MapHover, type MapModel, type MapPick } from './GalaxyChart.tsx';
import { isBase } from './map-paint.ts';
import { GalaxyGlyph } from './GalaxyGlyph.tsx';
import { ClusterCard, MapList, SystemCard, UnaddressedList, UnplacedNote } from './GalaxyPanel.tsx';
import { MapOptionsButton, MapOptionsSheet } from './MapOptions.tsx';
import { setMapOptionsOpen } from './map-options-store.ts';
import { useMapCamera } from './useMapCamera.ts';

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

// The map opens with the latest base selected, else the latest system (31, 31b, 31f, 31h).
function firstPick(galaxy: GalaxyJourney): MapPick | null {
  const placed = galaxy.placed;
  for (let i = placed.length - 1; i >= 0; i--) {
    const p = placed[i];
    if (p && isBase(p.system)) return { kind: 'system', i };
  }
  return placed.length ? { kind: 'system', i: placed.length - 1 } : null;
}

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
  /** The Workbench (d05): the map pane and the side pane, as two children of the Map's grid. */
  desk?: boolean;
}) {
  const colour = tide(index, trip.galaxies.length);
  const model = useMemo<MapModel>(() => {
    const clusters = clustersOf(galaxy.placed);
    const stacks = clusters.flatMap(c => c.stacks);
    const stackOf: number[] = [];
    const clusterOf: number[] = [];
    stacks.forEach((s, k) => {
      for (const i of s.members) stackOf[i] = k;
    });
    clusters.forEach((c, k) => {
      for (const i of c.members) clusterOf[i] = k;
    });
    return { galaxy, clusters, stacks, stackOf, clusterOf };
  }, [galaxy]);
  const camera = useMapCamera();
  const [pick, setPick] = useState<MapPick | null>(() => firstPick(galaxy));
  const [hover, setHover] = useState<MapHover>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const clusterIdOf = (p: MapPick | null) =>
    p === null ? null : p.kind === 'cluster' ? p.id : (model.clusters[model.clusterOf[p.i] ?? -1]?.id ?? null);
  const [open, setOpen] = useState(() => new Set([clusterIdOf(pick)].filter(id => id !== null)));

  // A selection from the list or the card comes into view on the map when it's off screen; the zoom stays.
  const reveal = (i: number) => {
    const c = camera.now();
    const p = galaxy.placed[i];
    const { w, h } = camera.size;
    if (!c || !p || !w) return;
    const q = project(c, w, h, p.voxel.x, p.voxel.z);
    if (q.x < 30 || q.x > w - 30 || q.y < 30 || q.y > h - 30) camera.goTo({ ...c, x: p.voxel.x, z: p.voxel.z });
  };
  const select = (next: MapPick) => {
    setPick(next);
    if (next.kind === 'system') {
      setFocus(f => (f === null ? f : next.i));
      reveal(next.i);
    }
    const id = clusterIdOf(next);
    if (id) setOpen(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
  };
  const toggle = (id: string) => {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Map options close with the galaxy (another galaxy, or another screen).
  useEffect(
    () => () => {
      setMapOptionsOpen(false);
    },
    []
  );

  const nothing = galaxy.placed.length === 0;
  const chosenCluster = pick?.kind === 'cluster' ? model.clusters.find(c => c.id === pick.id) : undefined;
  const card =
    pick?.kind === 'system' ? (
      <SystemCard model={model} i={pick.i} lyPerRegion={lyPerRegion} desk={desk} onPick={select} />
    ) : chosenCluster ? (
      <ClusterCard
        model={model}
        cluster={chosenCluster}
        lyPerRegion={lyPerRegion}
        desk={desk}
        onZoom={() => {
          const { w, h } = camera.size;
          if (w) camera.goTo(frameCamera(chosenCluster.stacks, w, h));
        }}
      />
    ) : null;
  const list = (
    <MapList
      model={model}
      pick={pick}
      hover={hover}
      focus={focus}
      open={open}
      lyPerRegion={lyPerRegion}
      desk={desk}
      onToggle={toggle}
      onPick={select}
      onHover={setHover}
    />
  );
  const chart = (
    <GalaxyChart
      model={model}
      camera={camera}
      pick={pick}
      hover={hover}
      focus={focus}
      lyPerRegion={lyPerRegion}
      desk={desk}
      onPick={select}
      onHover={setHover}
      onFocus={setFocus}
    />
  );
  const empty = nothing && (
    <div className="absolute inset-0 grid place-items-center p-4 bg-[rgba(5,8,17,0.35)]">
      <div className="max-w-[310px] rounded-[16px] border border-control-edge bg-[rgba(5,8,17,0.92)] px-5 py-4 flex flex-col items-center gap-2 text-center">
        <h2 className="font-display font-bold text-[15px] text-ink-bright">Nothing to place yet</h2>
        <p className="m-0 text-sub text-ink-muted">
          A system lands here once it has a portal address. Photo Mode shows it in the bottom-left corner.
        </p>
        {galaxy.unaddressed[0] && (
          <button
            type="button"
            onClick={() => {
              openSystemEditor(galaxy.unaddressed[0]?.id ?? null, { way: 'photo' });
            }}
            className="mt-1 h-11 px-4 rounded-[12px] border border-control-edge bg-slate-ground text-[14px] font-semibold text-ink inline-flex items-center gap-2 hover:border-control-edge-hover"
          >
            <i className="ph-bold ph-camera" aria-hidden="true" />
            Add one from Photo Mode
          </button>
        )}
      </div>
    </div>
  );

  const picker = (
    <label
      className={`relative min-w-0 pl-2 pr-7 rounded-full inline-flex items-center gap-2 border border-control-edge bg-slate-ground text-[13px] font-semibold text-ink focus-within:border-scanner-cyan-edge-strong ${desk ? 'h-[38px] rounded-control' : 'h-[34px]'}`}
    >
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
  const note = !nothing && <UnplacedNote systems={galaxy.unaddressed} />;
  const rest: ReactNode = nothing ? (
    <UnaddressedList galaxy={galaxy.name} systems={galaxy.unaddressed} />
  ) : (
    <>
      {card}
      {list}
      {note}
    </>
  );

  if (desk) {
    const summary = [
      plural(galaxy.placed.length + galaxy.unplaced, 'system'),
      nothing ? 'none placed' : plural(model.clusters.length, 'cluster'),
      galaxy.deepest !== null && lyPerRegion ? `deepest ${formatLightYears(galaxy.deepest, lyPerRegion)}` : ''
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <>
        <section
          aria-label={`Map of ${galaxy.name}`}
          className="workbench-panel min-w-0 min-h-0 flex flex-col overflow-hidden"
        >
          {/* d05 draws no title: the galaxy's name is in its picker. Screen readers still get the page's heading. */}
          <h1 className="sr-only">{`Map: ${galaxy.name}`}</h1>
          <div className="flex items-center justify-between gap-3 px-[18px] py-3 border-b border-hairline">
            <span className="flex items-center gap-3 min-w-0">
              <a
                href="#map"
                className="shrink-0 inline-flex items-center gap-1 text-[14px] text-quantity-cyan underline underline-offset-2"
              >
                <i className="ph-bold ph-caret-left text-[12px]" aria-hidden="true" />
                All galaxies
              </a>
              {picker}
            </span>
            <span className="flex items-center gap-3 min-w-0">
              <span title={summary} className="min-w-0 truncate font-mono text-[12px] text-ink-muted">
                {summary}
              </span>
              <MapOptionsButton />
            </span>
          </div>
          <div className="relative flex-1 min-h-0">
            {chart}
            {empty}
          </div>
        </section>
        <aside
          aria-label={`${galaxy.name}: the selected system and the list`}
          className="workbench-panel min-w-0 min-h-0 overflow-y-auto p-[18px] flex flex-col gap-4"
        >
          {rest}
        </aside>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <a
          href="#map"
          className="h-[34px] shrink-0 whitespace-nowrap pl-2 pr-3 rounded-full inline-flex items-center gap-1.5 border border-scanner-cyan-edge bg-scanner-cyan-tint text-[13px] font-semibold text-scanner-cyan-pale hover:border-scanner-cyan-edge-strong"
        >
          <i className="ph-bold ph-caret-left" aria-hidden="true" />
          All galaxies
        </a>
        {picker}
      </div>
      <section
        aria-label={`Map of ${galaxy.name}`}
        className="relative rounded-[20px] overflow-hidden border border-[rgba(56,189,248,0.18)] bg-[linear-gradient(170deg,rgba(14,24,46,0.96),rgba(8,14,28,0.96))]"
      >
        {chart}
        {empty}
      </section>
      {rest}
      <MapOptionsSheet />
    </div>
  );
}

// The largest square the pane has room for, so a chart is as big as it can be without stretching (d04).
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
