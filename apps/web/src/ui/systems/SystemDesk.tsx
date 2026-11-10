// System detail on the Workbench (round 6, d01, d19, d20), from lg: the detail pane beside the Systems list. A wide
// orbit band leads; under it the main column (name, Log a visit and Share, six facts, the planets as cards, linked
// notes) and the inspector (portal address, journal), which folds under the main column when the pane is narrower
// than ~900px. Below lg, System detail is its own screen (SystemDetails.tsx, design 03); `SystemScreen` picks.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { planetFamily, type FactsFile } from '@atlas/core/facts';
import { formatAgo } from '@atlas/core/format';
import { conflictReading, economyParts, economyType, strengthStars } from '@atlas/core/galaxy-map';
import { homeSummary } from '@atlas/core/home';
import { notesForSystem, systemPin } from '@atlas/core/notes';
import { systemOrbit } from '@atlas/core/orbit';
import {
  CONFLICT_LEVELS,
  RACES,
  STAR_CLASSES,
  lastVisit,
  moonParent,
  planetMapped,
  unmappedPlanets,
  type Planet,
  type System
} from '@atlas/core/systems-model';
import { InfestedTag, NotMappedTag, NotMappedText } from '../parts/RowTags.tsx';
import { logVisit, toggleFavorite } from '../actions.ts';
import { useAppState } from '../useAppState.ts';
import { useNow } from '../useNow.ts';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { useSectionParam } from '../shell/section-store.ts';
import { Button } from '../parts/Button.tsx';
import { ConflictText } from '../parts/Conflict.tsx';
import { OrbitDiagram, PlanetMarker } from '../parts/StarChart.tsx';
import { useMedia } from '../parts/useMedia.ts';
import { useWidth } from '../parts/useWidth.ts';
import { ShareSystemSheet } from '../share/ShareSheet.tsx';
import { LinkedNoteRows } from '../notes/note-bits.tsx';
import { newNote } from '../notes/note-nav.ts';
import { openSystemEditor } from './panel-store.ts';
import { DangerPills, nothingLogged, planetScanLine } from './PlanetScan.tsx';
import { discoveryWhen } from './DiscoveryFields.tsx';
import { PortalAddress, SystemDetails } from './SystemDetails.tsx';
import { openPlanetSheet, planetHref, usePlanetSheet } from './planet-sheet-store.ts';

const WIDE = '(min-width: 1024px)';
const BAND = 230; // the orbit band's height (d01)
const ICON_BUTTON =
  'w-10 h-10 rounded-control bg-[rgba(5,8,17,0.7)] border border-hairline grid place-items-center text-ink hover:border-control-edge transition-colors duration-[var(--duration-micro)]';
const SECTION_TITLE = 'font-display text-sm font-bold tracking-[0.04em] text-ink-bright';
const LABEL = 'text-label uppercase text-ink-label';

/** System detail as the screen size calls for: the Workbench pane from lg, the phone's screen below. */
export function SystemScreen() {
  return useMedia(WIDE) ? <SystemDesk /> : <SystemDetails />;
}

export function SystemDesk() {
  const state = useAppState();
  const now = useNow();
  const id = useSectionParam();
  const facts = useFacts();
  const planetSheet = usePlanetSheet();
  const [band, width] = useWidth<HTMLElement>();
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => {
    setSharing(false);
  }, []);
  useEffect(() => {
    void loadFacts();
  }, []);
  const system = state.systems.find(item => item.id === id);
  if (!system) return <SystemDetails />; // its "System not found"
  const current = homeSummary(state, now).current;
  const here = current?.id === system.id && lastVisit(system) !== undefined;
  const orbit = systemOrbit(
    system,
    planet => planetFamily(facts, planet).family,
    planet => planetFamily(facts, planet).infested
  );
  const first = system.visits[0];
  const sub = [
    system.region,
    system.galaxy,
    first ? `first visited ${formatAgo(first.at, now)}` : '',
    system.visits.length ? `${String(system.visits.length)} visit${system.visits.length === 1 ? '' : 's'}` : ''
  ]
    .filter(Boolean)
    .join(' · ');
  const linked = notesForSystem(state.notes, system.id);
  const tops = system.planets.filter(planet => !moonParent(system.planets, planet));
  const ordered = tops.flatMap(planet => [
    planet,
    ...system.planets.filter(other => moonParent(system.planets, other) === planet)
  ]);

  return (
    <div className="detail-pane flex flex-col min-h-full">
      <section
        ref={band}
        aria-label="Orbit diagram"
        className="relative shrink-0 overflow-hidden border-b border-hairline bg-[linear-gradient(180deg,var(--color-panel)_0%,var(--color-void)_100%)]"
        style={{ height: BAND }}
      >
        <div className="absolute inset-0 hero-grid" aria-hidden="true" />
        {width > 0 && (
          <div className="absolute inset-0">
            <OrbitDiagram
              name={system.name}
              seed={orbit.seed}
              star={system.star}
              planets={orbit.planets}
              width={width}
              height={BAND}
              size="XL"
              labels
              grid={false}
            />
          </div>
        )}
        <div className="absolute right-3.5 top-3.5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              toggleFavorite(system.id);
            }}
            aria-pressed={system.favorite}
            aria-label="Favourite"
            className={`${ICON_BUTTON} ${system.favorite ? 'text-units-amber-text' : 'text-ink-muted'}`}
          >
            <i className={`${system.favorite ? 'ph-fill' : 'ph-bold'} ph-star text-lg`} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              openSystemEditor(system.id);
            }}
            aria-label="Edit system"
            className={ICON_BUTTON}
          >
            <i className="ph-bold ph-pencil-simple text-lg" aria-hidden="true" />
          </button>
        </div>
        {here && (
          <span className="absolute left-6 bottom-4 h-[22px] px-2 rounded-tag bg-units-amber-tint text-units-amber-text text-[11px] font-bold tracking-[0.12em] uppercase inline-flex items-center">
            You are here
          </span>
        )}
      </section>

      <div className="detail-split flex-1">
        <div className="@container min-w-0 px-[22px] py-[18px] flex flex-col gap-4">
          <header className="flex items-end justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1 basis-64 flex flex-col gap-1">
              <h1
                id="systemTitle"
                title={system.name}
                className="font-display text-[30px] font-extrabold leading-[1.1] text-ink-bright line-clamp-2 [overflow-wrap:anywhere]"
              >
                {system.name}
              </h1>
              {sub && (
                <p title={sub} className="text-[13px] text-ink-muted line-clamp-2">
                  {sub}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="primary"
                icon="ph-check"
                onClick={() => {
                  logVisit(system.id);
                }}
              >
                Log a visit
              </Button>
              <Button
                icon="ph-share-network"
                onClick={() => {
                  setSharing(true);
                }}
              >
                Share
              </Button>
            </div>
          </header>

          <Facts system={system} facts={facts} />

          <section aria-labelledby="planetsTitle" className="flex flex-col gap-2.5">
            <div className="flex justify-between items-baseline gap-3">
              <h2 id="planetsTitle" className={SECTION_TITLE}>
                Planets & moons · {system.planets.length}
              </h2>
              {/* Round 7c: only once the system has its address, and only when some planet lacks its glyph. */}
              {unmappedPlanets(system) > 0 && (
                <span className="text-caption text-[#a5f3fc] ml-auto">{`${String(unmappedPlanets(system))} not mapped`}</span>
              )}
              <button
                type="button"
                onClick={() => {
                  openPlanetSheet(system.id, null);
                }}
                className="text-xs text-scanner-cyan-pale inline-flex items-center gap-1 hover:text-quantity-cyan"
              >
                <i className="ph-bold ph-plus" aria-hidden="true" />
                <span className="underline">Add body</span>
              </button>
            </div>
            {ordered.length ? (
              <ul className="grid grid-cols-1 @[34rem]:grid-cols-2 @[56rem]:grid-cols-3 gap-2.5">
                {ordered.map(planet => (
                  <li key={planet.id} className="min-w-0">
                    <PlanetCard
                      system={system}
                      planet={planet}
                      facts={facts}
                      editing={
                        planetSheet.open && planetSheet.systemId === system.id && planetSheet.planetId === planet.id
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 min-h-14 px-4 py-4 rounded-card border border-dashed border-control-edge text-sub text-ink-muted">
                No bodies yet. Add the planets and moons with bases, hotspots or crash sites.
              </p>
            )}
          </section>

          <section aria-labelledby="linkedNotesTitle" className="flex flex-col gap-2 max-w-[720px]">
            <h2 id="linkedNotesTitle" className={SECTION_TITLE}>
              Linked notes
            </h2>
            {linked.length > 0 && <LinkedNoteRows notes={linked} />}
            <span>
              <Button
                icon="ph-note-pencil"
                onClick={() => {
                  newNote([systemPin(system.id)]);
                }}
              >
                New note
              </Button>
            </span>
          </section>
        </div>

        <aside aria-label="Address and journal" className="detail-side min-w-0 px-[22px] py-[18px] flex flex-col gap-6">
          <PortalAddress system={system} desk />
          <Journal system={system} now={now} />
        </aside>
      </div>

      <ShareSystemSheet system={system} open={sharing} onClose={closeShare} />
    </div>
  );
}

const missing = <span className="text-ink-muted">Not logged</span>;
const stars = (n: number, of: number) => (
  <>
    <span aria-hidden="true">
      <span className="text-units-amber-text">{'★'.repeat(n)}</span>
      <span className="text-control-edge">{'★'.repeat(of - n)}</span>
    </span>
    <span className="sr-only">
      {n} of {of}
    </span>
  </>
);

// The six facts the game shows (d01): three to a row, six in a row when the pane is wide (d20). Who discovered it
// follows on its own row once logged. A value that doesn't fit ends after two lines, with the rest as a tooltip.
function Facts({ system, facts }: { system: System; facts: FactsFile | null }) {
  const map = facts?.galaxyMap ?? null;
  // A pair typed in one field before 3.26 ("High Tech // Balanced") reads as its two parts; the text stays as typed.
  const parts = economyParts(system);
  const type = economyType(map, parts.name);
  const strength = strengthStars(map, parts.strength) ?? (system.wealth || null);
  const economy = [system.economy, system.economyStrength].filter(Boolean);
  // The race leads; the conflict as the game shows it ("★★ Rowdy") sits under it, so the row keeps six facts (c22).
  const race = system.race ? RACES[system.race] : '';
  const conflict = conflictReading(system, CONFLICT_LEVELS);
  const cells: { label: string; value: ReactNode; title?: string }[] = [
    {
      label: 'Star',
      value:
        system.star || system.spectralClass ? (
          <>
            {system.star && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: `var(--color-star-${system.star})` }}
                aria-hidden="true"
              />
            )}
            {system.star && STAR_CLASSES[system.star].label}
            {system.spectralClass && <span className="font-mono text-ink-muted">{system.spectralClass}</span>}
          </>
        ) : (
          missing
        )
    },
    {
      label: 'On the map',
      value:
        system.water || system.dissonant ? (
          <>
            {system.water && (
              <span className="inline-flex items-center gap-1.5">
                <i className="ph-fill ph-drop text-[#60a5fa]" aria-hidden="true" />
                Water
              </span>
            )}
            {system.dissonant && (
              <span className="inline-flex items-center gap-1.5">
                <i className="ph-bold ph-wave-sine text-ink-soft" aria-hidden="true" />
                Dissonant
              </span>
            )}
          </>
        ) : (
          missing
        )
    },
    {
      label: 'Economy',
      title: [economy.join(' // '), type ? `${type} economy` : ''].filter(Boolean).join(' · '),
      value: economy.length ? (
        <span className="line-clamp-2">
          {system.economy}
          {economy.length === 2 && <span className="text-ink-disabled"> // </span>}
          {system.economyStrength}
        </span>
      ) : type ? (
        <span className="line-clamp-2">{`${type} economy`}</span>
      ) : (
        missing
      )
    },
    { label: 'Wealth', value: strength ? stars(strength, 3) : missing },
    {
      label: 'Race · conflict',
      title: [race, conflict ? `${'★'.repeat(conflict.stars)} ${conflict.text}`.trim() : '']
        .filter(Boolean)
        .join(' · '),
      value:
        race || conflict ? (
          <span className="flex flex-col min-w-0">
            {race && <span className="truncate">{race}</span>}
            {conflict?.pirate ? (
              <span className="mt-0.5">
                <ConflictText reading={conflict} size="M" />
              </span>
            ) : conflict ? (
              <span className="truncate text-ink-soft">
                <ConflictText reading={conflict} />
              </span>
            ) : null}
          </span>
        ) : (
          missing
        )
    },
    { label: 'Your rating', value: system.rating ? stars(system.rating, 5) : missing }
  ];
  const discovered = system.discoveredBy || system.discoveredOn;
  return (
    <dl className="m-0 grid grid-cols-2 @[30rem]:grid-cols-3 @[56rem]:grid-cols-6 gap-2.5">
      {cells.map(({ label, value, title }) => (
        <div key={label} title={title} className="min-w-0 px-3.5 py-3 rounded-card bg-panel border border-hairline">
          <dt className={LABEL}>{label}</dt>
          <dd className="m-0 mt-1 text-[15px] text-ink-bright flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            {value}
          </dd>
        </div>
      ))}
      {discovered && (
        <div className="col-span-full min-w-0 px-3.5 py-3 rounded-card bg-panel border border-hairline">
          <dt className={LABEL}>Discovered</dt>
          <dd className="m-0 mt-1 text-[15px] text-ink-bright flex flex-wrap gap-x-3">
            {system.discoveredBy && (
              <span title={system.discoveredBy} className="truncate">
                {system.discoveredBy}
              </span>
            )}
            {system.discoveredOn && (
              <span className="font-mono text-sub text-ink-muted">
                {discoveryWhen(system.discoveredOn, system.discoveredTime)}
              </span>
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}

// A planet as a card (d01): its marker, name and Base, one scan line and the game's danger as crimson pills. A moon
// tied to its planet says which. It opens in the panel beside the detail (37); a modified click opens its own view.
function PlanetCard({
  system,
  planet,
  facts,
  editing
}: {
  system: System;
  planet: Planet;
  facts: FactsFile | null;
  editing: boolean;
}) {
  const base = planet.tags.includes('base');
  const parent = moonParent(system.planets, planet);
  const { family, relic, infested } = planetFamily(facts, planet);
  const unmapped = planetMapped(system, planet) === false;
  const line = planetScanLine(planet, facts);
  const scan = [line.text, line.temperature].filter(Boolean).join(' · ');
  return (
    <a
      href={planetHref(system.id, planet.id)}
      onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        openPlanetSheet(system.id, planet.id);
      }}
      className={`h-full min-w-0 p-3.5 rounded-card bg-panel border flex gap-3 items-start hover:border-control-edge transition-colors duration-[var(--duration-micro)] ${
        editing ? 'border-scanner-cyan-edge' : 'border-hairline'
      }`}
    >
      <span className="w-12 h-12 grid place-items-center shrink-0">
        <PlanetMarker
          family={family}
          relic={relic}
          infested={infested}
          size={parent ? 18 : base ? 28 : 26}
          base={base}
          unlogged={nothingLogged(planet)}
        />
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-1">
        {unmapped && <NotMappedTag what="planet" />}
        <span className="flex items-center gap-2 min-w-0">
          <span title={planet.name} className="truncate text-[15px] font-semibold text-ink-bright">
            {planet.name}
            {unmapped && <NotMappedText what="planet" />}
          </span>
          {infested && <InfestedTag />}
          {base && (
            <span className="shrink-0 h-[22px] px-2 rounded-tag bg-scanner-cyan-tint border border-scanner-cyan-edge text-quantity-cyan text-pill uppercase inline-flex items-center">
              Base
            </span>
          )}
          {editing && (
            <span className="shrink-0 h-[22px] px-2 rounded-tag bg-scanner-cyan-tint border border-scanner-cyan-edge text-quantity-cyan text-[11px] font-semibold inline-flex items-center">
              Editing
            </span>
          )}
        </span>
        {parent && (
          <span title={`Orbits ${parent.name}`} className="truncate text-caption text-ink-label">
            Orbits {parent.name}
          </span>
        )}
        {scan && (
          <span title={scan} className="text-caption text-ink-muted line-clamp-2">
            {line.text}
            {line.temperature && (
              <>
                {line.text && ' · '}
                <span className="font-mono">{line.temperature}</span>
              </>
            )}
          </span>
        )}
        <DangerPills planet={planet} facts={facts} />
      </span>
    </a>
  );
}

// The journal (d01): your notes on the system, then each visit, newest first, with how long ago and its note.
function Journal({ system, now }: { system: System; now: number }) {
  const visits = [...system.visits].reverse();
  const notes = system.notes.trim();
  return (
    <section aria-labelledby="journalTitle" className="flex flex-col gap-2.5">
      <h2 id="journalTitle" className={SECTION_TITLE}>
        Journal
      </h2>
      {notes && <p className="m-0 text-row text-ink whitespace-pre-line break-words">{notes}</p>}
      <ol className="m-0 p-0 list-none flex flex-col">
        {visits.length ? (
          visits.map((visit, i) => {
            const what = [visit.note || 'Visited', visit.packets ? `${String(visit.packets)} packets` : '']
              .filter(Boolean)
              .join(' · ');
            return (
              <li
                key={`${visit.at}-${String(i)}`}
                className="grid grid-cols-[8px_minmax(0,1fr)] gap-x-3 py-2.5 border-t border-hairline first:border-t-0"
              >
                <span
                  className={`w-2 h-2 mt-1.5 rounded-full ${i ? 'bg-control-edge' : 'bg-scanner-cyan-glow'}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex flex-col gap-0.5">
                  <time
                    dateTime={visit.at}
                    title={new Date(visit.at).toLocaleString()}
                    className="font-mono text-caption text-ink-muted"
                  >
                    {formatAgo(visit.at, now)}
                  </time>
                  <span title={what} className="text-row text-ink line-clamp-2">
                    {what}
                  </span>
                </span>
              </li>
            );
          })
        ) : (
          <li className="text-caption text-ink-muted">No visits yet. Log a visit when you’re here.</li>
        )}
      </ol>
      {!notes && (
        <button
          type="button"
          onClick={() => {
            openSystemEditor(system.id);
          }}
          className="self-start text-caption text-scanner-cyan-pale underline"
        >
          Add notes
        </button>
      )}
    </section>
  );
}
