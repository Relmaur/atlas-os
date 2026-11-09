// Map (designs 30 and 31): `#map` is the galaxy chain, every galaxy the player has reached in the order they reached
// it, with the next ones waiting; `#map/<galaxy>` is one galaxy, the player's systems at true scale (round 7, c17).
// Distances are light years from the galaxy's centre, by the wiki's region size (a cited fact).
import { useEffect } from 'react';
import { getFact } from '@atlas/core/facts';
import { formatLightYears } from '@atlas/core/location';
import { journey, lightYearsLong, nextGalaxies, tide } from '@atlas/core/map';
import { useAppState } from '../useAppState.ts';
import { useSectionParam } from '../shell/section-store.ts';
import { LogSegment } from '../parts/LogSegment.tsx';
import { buttonClass } from '../parts/Button.tsx';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { loadGalaxies, useGalaxies } from '../systems/galaxies-store.ts';
import { openSystemEditor } from '../systems/panel-store.ts';
import { ChainChart } from './ChainChart.tsx';
import { FitSquare, GalaxyView } from './GalaxyView.tsx';
import { useMedia } from '../parts/useMedia.ts';
import { openSearch } from '../shell/Search.tsx';
import { GalaxyGlyph } from './GalaxyGlyph.tsx';

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

export function MapScreen() {
  const { systems } = useAppState();
  const param = useSectionParam();
  const galaxies = useGalaxies();
  const facts = useFacts();
  useEffect(() => {
    void loadGalaxies();
    void loadFacts();
  }, []);
  const lyPerRegion = getFact(facts, 'region-light-years')?.value ?? null;
  const trip = journey(systems, galaxies);
  const open = param ? trip.galaxies.findIndex(g => g.name.toLowerCase() === param.toLowerCase()) : -1;
  const galaxy = trip.galaxies[open];
  const wide = useMedia('(min-width: 1024px)');
  const summary = galaxy
    ? [
        galaxy.name,
        plural(galaxy.placed.length + galaxy.unplaced, 'system'),
        galaxy.deepest !== null && lyPerRegion
          ? `deepest ${formatLightYears(galaxy.deepest, lyPerRegion)}`
          : galaxy.placed.length
            ? ''
            : 'none placed'
      ]
        .filter(Boolean)
        .join(' · ')
    : [
        plural(trip.placed, 'system'),
        `${String(trip.galaxies.length)} ${trip.galaxies.length === 1 ? 'galaxy' : 'galaxies'}`,
        trip.unplaced ? `${String(trip.unplaced)} more without an address` : ''
      ]
        .filter(Boolean)
        .join(' · ');

  // The Workbench (round 6, d04/d05): the map in one pane, the list beside it in another.
  if (wide && systems.length) {
    const here = trip.galaxies[trip.here];
    const segment = (href: string, label: string, on: boolean) => (
      <a
        href={href}
        aria-current={on ? 'page' : undefined}
        className={`h-8 px-3 rounded-segment inline-flex items-center text-[13px] font-semibold ${
          on
            ? 'bg-scanner-cyan-tint text-scanner-cyan-text shadow-[inset_0_0_0_1px_var(--color-scanner-cyan-edge)]'
            : 'text-ink-muted hover:text-ink'
        }`}
      >
        {label}
      </a>
    );
    return (
      <div className="map-desk grid h-full grid-cols-[minmax(0,1fr)_minmax(0,clamp(320px,30%,420px))] gap-[var(--spacing-pane-gap)]">
        {galaxy ? (
          <GalaxyView key={galaxy.name} galaxy={galaxy} index={open} trip={trip} lyPerRegion={lyPerRegion} desk />
        ) : (
          <>
            <section aria-labelledby="mapTitle" className="workbench-panel min-w-0 min-h-0 flex flex-col">
              <header className="flex items-start justify-between gap-3 flex-wrap px-[22px] pt-4 pb-2">
                <div className="min-w-0 flex flex-col gap-1">
                  <h1 id="mapTitle" className="font-display font-extrabold text-[22px] text-ink-bright">
                    Map
                  </h1>
                  <p id="mapSummary" title={summary} className="font-mono text-[12px] text-ink-muted truncate">
                    {summary}
                  </p>
                </div>
                <span className="flex gap-2 shrink-0">
                  <nav
                    aria-label="Map views"
                    className="flex gap-1 p-[3px] rounded-control border border-hairline bg-slate-ground"
                  >
                    {segment('#map', 'All galaxies', true)}
                    {here && segment(`#map/${encodeURIComponent(here.name)}`, 'One galaxy', false)}
                  </nav>
                  <button
                    type="button"
                    onClick={openSearch}
                    className="h-[38px] px-3 rounded-control border border-control-edge bg-slate-ground text-[13px] font-semibold text-ink inline-flex items-center gap-1.5 hover:border-control-edge-hover"
                  >
                    <i className="ph-bold ph-magnifying-glass" aria-hidden="true" />
                    Find a system
                  </button>
                </span>
              </header>
              {/* The chain's names are drawn in the chart: past ~560px they'd grow larger than the page's text. */}
              <FitSquare max={560}>
                <ChainChart trip={trip} next={nextGalaxies(trip, galaxies)} bare />
              </FitSquare>
            </section>
            <aside
              aria-label="Galaxies"
              className="workbench-panel min-w-0 min-h-0 overflow-y-auto p-[18px] flex flex-col gap-3"
            >
              <GalaxyList trip={trip} next={nextGalaxies(trip, galaxies, 1)[0]} lyPerRegion={lyPerRegion} bare />
              <p className="m-0 text-caption text-ink-muted">
                You reach the next galaxy by travelling to the centre of the one you’re in, so the chain only grows one
                way. Pick a galaxy to open its map.
              </p>
              <a href="#frontier" className="text-sub text-scanner-cyan-pale underline self-start">
                What’s still out there: Frontier
              </a>
            </aside>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-[env(safe-area-inset-top)] max-w-2xl lg:max-w-none">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-screen-title text-ink-bright mt-4 lg:mt-0">Map</h1>
        <p id="mapSummary" className="font-mono text-[12px] text-ink-muted">
          {summary}
        </p>
      </header>
      <LogSegment />

      {!systems.length ? (
        <div className="rounded-card bg-panel-glass border border-hairline p-6 flex flex-col items-center gap-3 text-center">
          <h2 className="font-display font-bold text-[16px] text-ink-bright">Your map starts with your first system</h2>
          <p className="text-sub text-ink-muted max-w-sm">
            Log a system with its portal address and it appears at its true place in its galaxy.
          </p>
          <button
            type="button"
            onClick={() => {
              openSystemEditor();
            }}
            className={buttonClass('primary')}
          >
            Log a system
          </button>
        </div>
      ) : galaxy ? (
        <GalaxyView key={galaxy.name} galaxy={galaxy} index={open} trip={trip} lyPerRegion={lyPerRegion} />
      ) : (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
          <ChainChart trip={trip} next={nextGalaxies(trip, galaxies)} />
          <div className="flex flex-col gap-4">
            <GalaxyList trip={trip} next={nextGalaxies(trip, galaxies, 1)[0]} lyPerRegion={lyPerRegion} />
            <p className="text-caption text-ink-muted px-1">
              You reach the next galaxy by travelling to the centre of the one you’re in, so the chain only grows one
              way. Tap a galaxy to open its map.
            </p>
          </div>
        </div>
      )}
      <a href="#frontier" className="text-sub text-scanner-cyan-pale underline self-start">
        What’s still out there: Frontier
      </a>
    </div>
  );
}

function GalaxyList({
  trip,
  next,
  lyPerRegion,
  bare = false
}: {
  trip: ReturnType<typeof journey>;
  next: { name: string; type: string } | undefined;
  lyPerRegion: number | null;
  /** In a Workbench pane, which is its box. */
  bare?: boolean;
}) {
  const here = trip.galaxies[trip.here];
  return (
    <section
      aria-labelledby="mapGalaxiesTitle"
      className={bare ? '' : 'rounded-card bg-panel-glass border border-hairline px-4 pt-3 pb-1'}
    >
      <h2 id="mapGalaxiesTitle" className="text-label uppercase text-ink-label pb-1.5">
        Galaxies · in the order you reached them
      </h2>
      <ul id="mapGalaxies" className="divide-y divide-hairline">
        {trip.galaxies.map((galaxy, i) => (
          <li key={galaxy.name}>
            <a
              href={`#map/${encodeURIComponent(galaxy.name)}`}
              className={`flex items-center gap-3 py-2.5 hover:bg-slate-ground px-2 rounded-control ${bare ? '' : '-mx-2'}`}
            >
              <GalaxyGlyph galaxy={galaxy} colour={tide(i, trip.galaxies.length)} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-[14px] font-semibold text-ink-bright">{galaxy.name}</span>
                  {i === trip.here && <Tag>You are here</Tag>}
                </span>
                <span className="block mt-0.5 font-mono text-[11.5px] text-ink-label">
                  {[
                    plural(galaxy.placed.length + galaxy.unplaced, 'system'),
                    galaxy.deepest !== null && lyPerRegion
                      ? `deepest ${lightYearsLong(galaxy.deepest, lyPerRegion)}`
                      : galaxy.placed.length
                        ? ''
                        : 'no address yet'
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <i className="ph-bold ph-caret-right text-ink-disabled" aria-hidden="true" />
            </a>
          </li>
        ))}
        {next && here && (
          <li className="flex items-center gap-3 py-2.5">
            <span aria-hidden="true" className="w-10 h-10 shrink-0 grid place-items-center">
              <span className="w-[28px] h-[28px] rounded-full border border-dashed border-ink-disabled" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate text-[14px] font-semibold text-ink-muted">{next.name}</span>
                <Tag>Next</Tag>
              </span>
              <span className="block mt-0.5 font-mono text-[11.5px] text-ink-label">
                Reach the centre of {here.name} to cross
              </span>
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}

const Tag = ({ children }: { children: string }) => (
  <span className="shrink-0 h-5 px-2 rounded-full inline-flex items-center border border-scanner-cyan-edge text-[9px] font-semibold tracking-[0.14em] uppercase text-scanner-cyan-pale">
    {children}
  </span>
);
