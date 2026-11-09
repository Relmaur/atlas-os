// Beside one galaxy's map (round 7, c17): the selected system's card, whose Same region tabs reach every system in
// its stack on a phone without zooming; a cluster's card; the list, grouped by cluster with its stacks, the map's
// full accessible equivalent; and the systems without an address, which are counted and named, never placed.
import { useEffect, useRef, useState } from 'react';
import { formatLightYears } from '@atlas/core/location';
import { clusterEntries, ordinal, regionCode, type Cluster } from '@atlas/core/map';
import { RACES, type System } from '@atlas/core/systems-model';
import { Button, buttonClass } from '../parts/Button.tsx';
import { openSystem, openSystemEditor } from '../systems/panel-store.ts';
import type { MapHover, MapModel, MapPick } from './GalaxyChart.tsx';
import { useMapOptions } from './map-options-store.ts';
import { isBase, paint } from './map-paint.ts';

const planetsOf = (system: System) => system.planetCount || system.planets.length;
const distance = (regions: number, lyPerRegion: number | null) =>
  lyPerRegion ? formatLightYears(regions, lyPerRegion) : `${String(Math.round(regions))} reg.`;
const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

/** Many systems: the list gets a search and caps each open cluster (31h). */
export const MANY = 40;
const CAPPED = 5;

// The card's mark and the list's dots take the colour Map options chose (round 7b), like the map's own dots.
function StarMark({ system, size = 40 }: { system: System; size?: number }) {
  const { fill, shrink } = paint(system, useMapOptions().colour);
  return (
    <svg width={size} height={size} viewBox="-20 -20 40 40" aria-hidden="true" className="shrink-0">
      {fill ? (
        <circle className="map-dot" r={9 - shrink} fill={fill} />
      ) : (
        <circle className="map-dot" r={8} fill="#050811" stroke="#94a3b8" strokeWidth={1.5} />
      )}
      {isBase(system) && <circle r={13} fill="none" stroke="#22d3ee" strokeWidth={2} />}
    </svg>
  );
}

function Dot({ system, ring = true }: { system: System; ring?: boolean }) {
  const { fill } = paint(system, useMapOptions().colour);
  return ring && isBase(system) ? (
    <span
      aria-hidden="true"
      className="w-[18px] h-[18px] rounded-full grid place-items-center shadow-[inset_0_0_0_2px_#22d3ee] justify-self-center"
    >
      <span
        className={`map-dot-bg w-2.5 h-2.5 rounded-full ${fill ? '' : 'border border-ink-muted'}`}
        style={fill ? { background: fill } : undefined}
      />
    </span>
  ) : (
    <span
      aria-hidden="true"
      className={`map-dot-bg w-2.5 h-2.5 rounded-full justify-self-center ${fill ? '' : 'border-[1.5px] border-ink-muted'}`}
      style={fill ? { background: fill } : undefined}
    />
  );
}

const Stat = ({ label, value, note }: { label: string; value: string; note?: string | undefined }) => (
  <div className="rounded-[12px] bg-slate-ground border border-hairline px-2.5 py-2 flex flex-col gap-0.5 min-w-0">
    <dt className="text-[9px] font-semibold tracking-[0.14em] uppercase text-ink-label">{label}</dt>
    <dd className="m-0 flex flex-col gap-0.5 min-w-0">
      <span className="font-mono text-[14px] font-semibold text-ink-bright truncate">{value}</span>
      {note && <span className="text-[10px] text-ink-muted truncate">{note}</span>}
    </dd>
  </div>
);

const shell = (desk: boolean) =>
  desk ? 'flex flex-col gap-3' : 'rounded-card bg-panel-glass border border-hairline p-4 flex flex-col gap-3';

export function SystemCard({
  model,
  i,
  lyPerRegion,
  desk,
  onPick
}: {
  model: MapModel;
  i: number;
  lyPerRegion: number | null;
  desk: boolean;
  onPick: (pick: MapPick) => void;
}) {
  const { galaxy, stacks, stackOf } = model;
  const placed = galaxy.placed[i];
  if (!placed) return null;
  const { system, voxel } = placed;
  const stack = stacks[stackOf[i] ?? -1];
  const planets = planetsOf(system);
  // Only when there's more than one region to compare (31g): two systems sharing one region tie.
  const deepest = stacks.length > 1 && placed.regions === galaxy.deepest;
  const height = `height ${voxel.y > 0 ? '+' : ''}${String(voxel.y)}`;
  return (
    <section id="mapSystem" aria-label="Selected system" className={shell(desk)}>
      {desk && <p className="m-0 text-label uppercase text-ink-label">Selected</p>}
      {stack && stack.members.length > 1 && (
        <div className="flex flex-col gap-2 pb-3 border-b border-hairline">
          <p
            id="mapSameRegion"
            className="m-0 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-ink-label"
          >
            <i className="ph-bold ph-stack text-scanner-cyan text-[13px]" aria-hidden="true" />
            {`Same region · ${String(stack.members.length)} systems`}
          </p>
          <div role="group" aria-labelledby="mapSameRegion" className="flex gap-1.5 flex-wrap">
            {stack.members.map(m => {
              const member = galaxy.placed[m]?.system;
              if (!member) return null;
              return (
                <button
                  key={member.id}
                  type="button"
                  aria-pressed={m === i}
                  onClick={() => {
                    onPick({ kind: 'system', i: m });
                  }}
                  className={`h-[34px] max-w-full min-w-0 px-2.5 rounded-[10px] border inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${
                    m === i
                      ? 'border-scanner-cyan-edge-strong bg-scanner-cyan-tint text-scanner-cyan-text'
                      : 'border-control-edge bg-slate-ground text-ink-soft'
                  }`}
                >
                  <Dot system={member} ring={false} />
                  <span className="truncate min-w-0">{member.name}</span>
                  <span className="font-mono text-[11px] font-medium text-ink-muted">{ordinal(m + 1)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <StarMark system={system} />
        <div className="flex-1 min-w-0">
          <h2
            id="mapSystemName"
            className={`font-display font-bold text-ink-bright truncate ${desk ? 'text-[22px]' : 'text-[15px]'}`}
          >
            {system.name}
          </h2>
          <p className="m-0 flex items-center gap-1.5 text-caption text-ink-muted min-w-0">
            {deepest && (
              <span className="shrink-0 h-5 px-2 rounded-full inline-flex items-center bg-[rgba(245,158,11,0.16)] text-units-amber-pale text-[9.5px] font-bold tracking-[0.12em]">
                DEEPEST
              </span>
            )}
            <span className="truncate">
              {[
                isBase(system) ? 'Base' : '',
                system.race ? RACES[system.race] : '',
                planets ? plural(planets, 'planet') : ''
              ]
                .filter(Boolean)
                .join(' · ') || 'Logged system'}
            </span>
          </p>
        </div>
        {!desk && (
          <Button
            size="S"
            onClick={() => {
              openSystem(system.id);
            }}
          >
            Open
          </Button>
        )}
      </div>
      <dl className="m-0 grid grid-cols-3 gap-2">
        <Stat label="From centre" value={distance(placed.regions, lyPerRegion)} />
        <Stat label="Region" value={regionCode(system.glyphs)} note={height} />
        <Stat label="Visited" value={ordinal(i + 1)} />
      </dl>
      {desk && (
        <button
          type="button"
          onClick={() => {
            openSystem(system.id);
          }}
          className={`${buttonClass('primary')} w-full`}
        >
          Open system
          <i className="ph-bold ph-arrow-right" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

export function ClusterCard({
  model,
  cluster,
  lyPerRegion,
  desk,
  onZoom
}: {
  model: MapModel;
  cluster: Cluster;
  lyPerRegion: number | null;
  desk: boolean;
  onZoom: () => void;
}) {
  const first = cluster.members[0] ?? 0;
  const last = cluster.members.at(-1) ?? 0;
  const base = cluster.base !== null ? model.galaxy.placed[cluster.base]?.system.name : undefined;
  return (
    <section id="mapCluster" aria-label="Selected cluster" className={shell(desk)}>
      {desk && <p className="m-0 text-label uppercase text-ink-label">Selected</p>}
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="w-10 h-10 shrink-0 rounded-full grid place-items-center bg-[rgba(14,116,144,0.38)] border-[1.5px] border-quantity-cyan text-[13px] font-bold text-[#ecfeff]"
        >
          {cluster.members.length}
        </span>
        <div className="flex-1 min-w-0">
          <h2 id="mapSystemName" className="font-display font-bold text-[15px] text-ink-bright truncate">
            {cluster.name}
          </h2>
          <p className="m-0 text-caption text-ink-muted">
            {[
              plural(cluster.members.length, 'system'),
              `visited ${ordinal(first + 1)}–${ordinal(last + 1)}`,
              base ? `base ${base}` : ''
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Button size="S" icon="ph-magnifying-glass-plus" onClick={onZoom}>
          Zoom in
        </Button>
      </div>
      <dl className="m-0 grid grid-cols-3 gap-2">
        <Stat label="Nearest core" value={distance(cluster.nearest, lyPerRegion)} />
        <Stat
          label="Across"
          value={`${String(cluster.across)} reg.`}
          note={lyPerRegion ? `${(cluster.across * lyPerRegion).toLocaleString('en')} ly` : undefined}
        />
        <Stat label="Last here" value={ordinal(last + 1)} />
      </dl>
    </section>
  );
}

export function MapList({
  model,
  pick,
  hover,
  focus,
  open,
  lyPerRegion,
  desk,
  onToggle,
  onPick,
  onHover
}: {
  model: MapModel;
  pick: MapPick | null;
  hover: MapHover;
  focus: number | null;
  open: Set<string>;
  lyPerRegion: number | null;
  desk: boolean;
  onToggle: (id: string) => void;
  onPick: (pick: MapPick) => void;
  onHover: (hover: MapHover) => void;
}) {
  const { galaxy, clusters } = model;
  const count = galaxy.placed.length;
  const many = count > MANY;
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(new Set<string>());
  const list = useRef<HTMLDivElement>(null);
  const selected = pick?.kind === 'system' ? pick.i : null;
  const needle = query.trim().toLowerCase();
  const matches = (i: number) => !needle || (galaxy.placed[i]?.system.name.toLowerCase().includes(needle) ?? false);

  // A selection made on the map comes into view in the list (never hidden in a closed or capped cluster: see below).
  useEffect(() => {
    if (selected === null) return;
    const row = list.current?.querySelector<HTMLElement>(`[data-row="${String(selected)}"]`);
    if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const row = (i: number, inStack: boolean) => {
    const p = galaxy.placed[i];
    if (!p) return null;
    const on = selected === i;
    return (
      <li key={p.system.id}>
        <button
          type="button"
          data-row={i}
          aria-pressed={on}
          onClick={() => {
            onPick({ kind: 'system', i });
          }}
          onPointerEnter={() => {
            onHover(`s${String(i)}`);
          }}
          onPointerLeave={() => {
            onHover(null);
          }}
          className={`w-full grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 text-left ${
            inStack ? 'min-h-11 pl-[30px]' : 'min-h-12 border-t border-[rgba(30,41,59,0.8)]'
          } ${
            on
              ? 'bg-[rgba(34,211,238,0.09)] shadow-[inset_3px_0_0_var(--color-scanner-cyan)]'
              : hover === `s${String(i)}`
                ? 'bg-[rgba(148,163,184,0.09)]'
                : 'hover:bg-[rgba(148,163,184,0.06)]'
          } ${focus === i ? 'outline-2 outline-scanner-cyan -outline-offset-3' : ''}`}
        >
          <Dot system={p.system} />
          <span title={p.system.name} className="truncate text-[14px] font-semibold text-ink-bright">
            {p.system.name}
          </span>
          <span className="text-[12px] text-ink-muted whitespace-nowrap">
            {[ordinal(i + 1), p.system.race ? RACES[p.system.race] : ''].filter(Boolean).join(' · ')}
          </span>
        </button>
      </li>
    );
  };

  const entry = (members: number[]) => {
    const shown = members.filter(matches);
    if (!shown.length) return null;
    if (members.length === 1) return row(shown[0] ?? 0, false);
    const code = regionCode(galaxy.placed[members[0] ?? 0]?.system.glyphs ?? '');
    return (
      <li key={`stack-${String(members[0])}`} className="relative border-t border-[rgba(30,41,59,0.8)]">
        <p className="m-0 h-[30px] px-3.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase text-ink-label">
          <i className="ph-bold ph-stack text-scanner-cyan text-[12px]" aria-hidden="true" />
          Same region ·
          <span className="font-mono text-[11px] font-medium tracking-normal normal-case text-ink-muted">{code}</span>
        </p>
        <span
          aria-hidden="true"
          className="absolute left-5 top-[30px] bottom-3.5 w-1.5 border border-r-0 border-[rgba(103,232,249,0.45)] rounded-l-[3px]"
        />
        <ul aria-label={`Same region, ${code}`} className="m-0 p-0 list-none">
          {shown.map(i => row(i, true))}
        </ul>
      </li>
    );
  };

  return (
    <section aria-labelledby="mapListTitle" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 mt-2">
        <h2 id="mapListTitle" className="font-display font-bold text-[15px] text-ink-bright">
          {`On the map · ${String(count)}`}
        </h2>
        <span className="text-[12px] text-ink-muted">by place, then order</span>
      </div>
      {many && (
        <label className="h-11 px-3 rounded-[12px] bg-slate-ground border border-hairline flex items-center gap-2 focus-within:border-scanner-cyan-edge-strong">
          <i className="ph-bold ph-magnifying-glass text-ink-muted" aria-hidden="true" />
          <span className="sr-only">Find a system on the map</span>
          <input
            type="search"
            value={query}
            placeholder={`Find one of ${String(count)} systems`}
            onChange={event => {
              setQuery(event.target.value);
            }}
            className="flex-1 min-w-0 bg-transparent text-[14px] text-ink-bright placeholder:text-ink-muted focus:outline-hidden"
          />
        </label>
      )}
      <div ref={list} className="flex flex-col gap-3">
        {clusters.map(cluster => {
          const entries = clusterEntries(cluster);
          if (needle && !cluster.members.some(matches)) return null;
          const expanded = Boolean(needle) || open.has(cluster.id);
          // Capped when there are many, but the selection is never hidden: its entry always shows.
          const capped = many && !needle && !all.has(cluster.id) && entries.length > CAPPED + 1;
          const visible = capped
            ? entries.filter((members, k) => k < CAPPED || (selected !== null && members.includes(selected)))
            : entries;
          const hovered = hover === `c${cluster.id}` || (pick?.kind === 'cluster' && pick.id === cluster.id);
          return (
            <div
              key={cluster.id}
              role="group"
              aria-label={cluster.name}
              className={
                desk
                  ? 'border-t border-hairline'
                  : 'rounded-[18px] bg-panel-glass border border-hairline overflow-hidden'
              }
            >
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => {
                  onToggle(cluster.id);
                }}
                onPointerEnter={() => {
                  onHover(`c${cluster.id}`);
                }}
                onPointerLeave={() => {
                  onHover(null);
                }}
                className={`w-full h-12 px-3.5 flex items-center gap-2 text-left text-[13.5px] font-semibold text-ink-bright ${
                  hovered ? 'bg-[rgba(148,163,184,0.09)]' : ''
                }`}
              >
                <i
                  className={`ph-bold ${expanded ? 'ph-caret-down' : 'ph-caret-right'} text-ink-muted text-[14px]`}
                  aria-hidden="true"
                />
                <span className="truncate min-w-0">{cluster.name}</span>
                <span className="font-mono text-[12px] font-medium text-quantity-cyan">{cluster.members.length}</span>
                <span className="ml-auto font-mono text-[11px] font-medium text-ink-disabled whitespace-nowrap">
                  {`${distance(cluster.nearest, lyPerRegion)} from core`}
                </span>
              </button>
              {expanded && (
                <ul aria-label={`Systems in ${cluster.name}`} className="m-0 p-0 list-none">
                  {visible.map(entry)}
                </ul>
              )}
              {expanded && capped && (
                <button
                  type="button"
                  onClick={() => {
                    setAll(prev => new Set(prev).add(cluster.id));
                  }}
                  className="w-full h-11 border-t border-[rgba(30,41,59,0.8)] text-[13px] font-semibold text-quantity-cyan"
                >
                  {`Show all ${String(cluster.members.length)} in ${cluster.name}`}
                </button>
              )}
            </div>
          );
        })}
        {needle && !galaxy.placed.some((_, i) => matches(i)) && (
          <p className="m-0 text-sub text-ink-muted px-1">{`No system on the map matches “${query.trim()}”.`}</p>
        )}
      </div>
    </section>
  );
}

/** "1 more system has no portal address, so it isn't on the map", with their names and a way to add one. */
export function UnplacedNote({ systems }: { systems: System[] }) {
  const [first] = systems;
  if (!first) return null;
  const n = systems.length;
  const names = systems.slice(0, 3).map(s => s.name);
  return (
    <div className="flex gap-2.5 items-start p-3.5 rounded-[18px] border border-dashed border-control-edge">
      <i className="ph-bold ph-map-pin text-ink-muted text-[18px] mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="m-0 text-sub text-ink">
          {`${String(n)} more ${n === 1 ? 'system has' : 'systems have'} no portal address, so ${n === 1 ? 'it isn’t' : 'they aren’t'} on the map.`}
        </p>
        <p className="m-0 text-caption text-ink-muted truncate">
          {names.join(', ')}
          {n > names.length ? ` +${String(n - names.length)} more` : ''}
        </p>
        <button
          type="button"
          onClick={() => {
            openSystemEditor(first.id, { way: 'photo' });
          }}
          className="self-start mt-1 text-[14px] font-semibold text-quantity-cyan"
        >
          {n === 1 ? 'Add an address' : `Add an address to ${first.name}`}
        </button>
      </div>
    </div>
  );
}

/** 31i: nothing in this galaxy has an address yet; each system is a row with a way to add one. */
export function UnaddressedList({ galaxy, systems }: { galaxy: string; systems: System[] }) {
  return (
    <section aria-labelledby="mapUnaddressedTitle" className="flex flex-col gap-3">
      <h2 id="mapUnaddressedTitle" className="font-display font-bold text-[15px] text-ink-bright mt-2">
        {`In ${galaxy} · ${String(systems.length)}`}
      </h2>
      <ul className="m-0 p-0 list-none flex flex-col gap-3">
        {systems.map(system => (
          <li
            key={system.id}
            className="min-h-12 px-4 py-2.5 rounded-[18px] bg-panel-glass border border-hairline flex items-center gap-3"
          >
            <span
              aria-hidden="true"
              className="w-3.5 h-3.5 rounded-full border border-dashed border-ink-muted shrink-0"
            />
            <span className="flex-1 min-w-0 truncate text-[15px] font-semibold text-ink-bright">{system.name}</span>
            <button
              type="button"
              aria-label={`Add an address to ${system.name}`}
              onClick={() => {
                openSystemEditor(system.id, { way: 'photo' });
              }}
              className="shrink-0 text-[14px] font-semibold text-quantity-cyan min-h-11"
            >
              Add address
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
