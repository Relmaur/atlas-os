// System detail (design 03): a system's own screen at #system/<id>. Its orbit diagram (XL, the side view) leads,
// then what the game shows, the portal address, the planets, the journal (your notes and visits), and Log a visit.
// The rest is edited in the editor sheet (06). A planet row opens the planet's own view (36); Add body opens the
// planet sheet (35), and the orbit diagram draws from the planets.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { planetFamily } from '@atlas/core/facts';
import { economyType, strengthStars } from '@atlas/core/galaxy-map';
import { homeSummary } from '@atlas/core/home';
import { notesForSystem, systemPin } from '@atlas/core/notes';
import { systemOrbit } from '@atlas/core/orbit';
import {
  CONFLICT_LEVELS,
  RACES,
  STAR_CLASSES,
  lastVisit,
  moonParent,
  type Planet,
  type System
} from '@atlas/core/systems-model';
import { logVisit, toggleFavorite } from '../actions.ts';
import { useAppState } from '../useAppState.ts';
import { useNow } from '../useNow.ts';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { goBack, useSectionParam } from '../shell/section-store.ts';
import { Button } from '../parts/Button.tsx';
import { SeverityPill } from '../parts/SeverityPill.tsx';
import { OrbitDiagram, PlanetMarker } from '../parts/StarChart.tsx';
import { copyText, ShareSystemSheet } from '../share/ShareSheet.tsx';
import { LinkedNoteRows } from '../notes/note-bits.tsx';
import { newNote } from '../notes/note-nav.ts';
import { openSystemEditor } from './panel-store.ts';
import { GlyphPlate } from './GlyphPlate.tsx';
import { DangerPills, nothingLogged, planetScanLine } from './PlanetScan.tsx';
import { discoveryWhen } from './DiscoveryFields.tsx';
import { openPlanetSheet, planetHref, usePlanetSheet } from './planet-sheet-store.ts';
import type { FactsFile } from '@atlas/core/facts';

const HERO_BUTTON =
  'w-10 h-10 rounded-control bg-[rgba(5,8,17,0.7)] border border-hairline grid place-items-center text-ink hover:border-control-edge transition-colors duration-[var(--duration-micro)]';
const LABEL = 'text-label uppercase text-ink-label';
const WIDE = '(min-width: 1024px)'; // lg: sheets are right-hand panels (design/desktop-direction)
const SECTION_TITLE = 'font-display text-sm font-bold tracking-[0.04em] text-ink-bright';

export function SystemDetails() {
  const state = useAppState();
  const now = useNow();
  const id = useSectionParam();
  const facts = useFacts();
  const planetSheet = usePlanetSheet();
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => {
    setSharing(false);
  }, []);
  useEffect(() => {
    void loadFacts(); // biome families, for the planets' colours
  }, []);
  const system = state.systems.find(item => item.id === id);
  if (!system) {
    return (
      <div className="flex flex-col items-start gap-section pt-[env(safe-area-inset-top)]">
        <h1 className="font-display text-screen-title text-ink-bright">System not found</h1>
        <p className="text-sub text-ink-muted">It may have been deleted, or the link is from another device’s log.</p>
        <Button
          onClick={() => {
            location.hash = '#systems';
          }}
        >
          All systems
        </Button>
      </div>
    );
  }
  const current = homeSummary(state, now).current;
  const here = current?.id === system.id && lastVisit(system) !== undefined;
  const orbit = systemOrbit(system, planet => planetFamily(facts, planet).family);
  const place = [system.region, system.galaxy].filter(Boolean).join(' · ');
  const linked = notesForSystem(state.notes, system.id);

  return (
    <div className="flex flex-col gap-section max-w-2xl">
      <section
        aria-label="Orbit diagram"
        className="relative h-[300px] -mx-4 -mt-5 sm:-mx-6 sm:-mt-6 lg:mx-0 lg:mt-0 lg:rounded-hero overflow-hidden bg-[linear-gradient(180deg,var(--color-panel)_0%,var(--color-void)_100%)]"
      >
        <div className="absolute inset-0 hero-grid" aria-hidden="true" />
        <div className="absolute inset-0">
          <OrbitDiagram
            name={system.name}
            seed={orbit.seed}
            star={system.star}
            planets={orbit.planets}
            width={390}
            height={300}
            size="XL"
            labels
            numerals
            insetTop={72} // the back, favourite and edit buttons sit over the top of the frame
            grid={false}
          />
        </div>
        <div className="absolute inset-x-0 top-0 px-4 pt-header-top lg:pt-4 flex justify-between">
          <button
            type="button"
            onClick={() => {
              goBack('systems');
            }}
            aria-label="Back"
            className={HERO_BUTTON}
          >
            <i className="ph-bold ph-caret-left text-lg" aria-hidden="true" />
          </button>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                toggleFavorite(system.id);
              }}
              aria-pressed={system.favorite}
              aria-label="Favourite"
              className={`${HERO_BUTTON} ${system.favorite ? 'text-units-amber-text' : 'text-ink-muted'}`}
            >
              <i className={`${system.favorite ? 'ph-fill' : 'ph-bold'} ph-star text-lg`} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                openSystemEditor(system.id);
              }}
              aria-label="Edit system"
              className={HERO_BUTTON}
            >
              <i className="ph-bold ph-pencil-simple text-lg" aria-hidden="true" />
            </button>
          </span>
        </div>
      </section>

      <header className="relative -mt-[42px] flex flex-col gap-title-sub">
        {here && (
          <span className="self-start h-6 px-2.5 rounded-full bg-units-amber-tint text-units-amber-text text-[11px] font-bold tracking-[0.12em] uppercase inline-flex items-center">
            You are here
          </span>
        )}
        <h1
          id="systemTitle"
          className="font-display text-[28px] font-extrabold leading-[1.1] text-ink-bright break-words"
        >
          {system.name}
        </h1>
        {place && <p className="text-sub text-ink-muted">{place}</p>}
      </header>

      <Facts system={system} facts={facts} />
      <PortalAddress system={system} />

      <section aria-labelledby="planetsTitle" className="flex flex-col gap-2">
        <h2 id="planetsTitle" className={SECTION_TITLE}>
          Planets & moons · {system.planets.length}
        </h2>
        <ul className="rounded-card bg-panel border border-hairline divide-y divide-hairline overflow-hidden">
          {/* A moon tied to its planet sits inside that planet's row, indented; the rest keep the log's order. */}
          {system.planets
            .filter(planet => !moonParent(system.planets, planet))
            .map(planet => {
              const row = (body: Planet, moon: boolean) => (
                <PlanetRow
                  planet={body}
                  href={planetHref(system.id, body.id)}
                  facts={facts}
                  moon={moon}
                  editing={planetSheet.open && planetSheet.systemId === system.id && planetSheet.planetId === body.id}
                  onEdit={() => {
                    openPlanetSheet(system.id, body.id);
                  }}
                />
              );
              const moons = system.planets.filter(other => moonParent(system.planets, other) === planet);
              return (
                <li key={planet.id}>
                  {row(planet, false)}
                  {moons.length > 0 && (
                    <ul
                      aria-label={`Moons of ${planet.name}`}
                      className="border-t border-hairline divide-y divide-hairline"
                    >
                      {moons.map(moon => (
                        <li key={moon.id}>{row(moon, true)}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          <li>
            <button
              type="button"
              onClick={() => {
                openPlanetSheet(system.id, null);
              }}
              className="w-full min-h-14 px-3.5 flex items-center gap-3 text-left text-sub text-ink-muted hover:text-ink hover:bg-slate-ground transition-colors duration-[var(--duration-micro)]"
            >
              <span className="w-10 h-10 rounded-full border border-dashed border-grab grid place-items-center shrink-0">
                <i className="ph-bold ph-plus" aria-hidden="true" />
              </span>
              {system.planets.length
                ? 'Add body'
                : 'Add body: the planets and moons with bases, hotspots or crash sites'}
            </button>
          </li>
        </ul>
      </section>

      <Journal system={system} />

      <div className="grid grid-cols-[2fr_1fr] gap-2">
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
          size="L"
          onClick={() => {
            setSharing(true);
          }}
        >
          Share
        </Button>
      </div>

      <section aria-labelledby="linkedNotesTitle" className="flex flex-col gap-2">
        <h2 id="linkedNotesTitle" className={SECTION_TITLE}>
          Linked notes
        </h2>
        {linked.length > 0 && <LinkedNoteRows notes={linked} />}
        <Button
          icon="ph-note-pencil"
          onClick={() => {
            newNote([systemPin(system.id)]);
          }}
        >
          New note
        </Button>
      </section>

      <ShareSystemSheet system={system} open={sharing} onClose={closeShare} />
    </div>
  );
}

const missing = <span className="text-ink-muted">Not logged</span>;
const stars = (n: number, of: number) => (
  <>
    <span aria-hidden="true">
      {'★'.repeat(n)}
      <span className="text-control-edge">{'★'.repeat(of - n)}</span>
    </span>
    <span className="sr-only">
      {n} of {of}
    </span>
  </>
);

// What the game shows, two to a row; anything not logged says so instead of being left out (03b). The galaxy map's
// pairs read as it shows them: "Yellow F4", "Prospecting // Opulent" with the economy's type and stars beneath.
function Facts({ system, facts }: { system: System; facts: FactsFile | null }) {
  const map = facts?.galaxyMap ?? null;
  const type = economyType(map, system.economy);
  const strength = strengthStars(map, system.economyStrength) ?? (system.wealth || null);
  const economy = system.economy || system.economyStrength;
  const cells: [string, ReactNode, { wide?: boolean; tone?: string }?][] = [
    [
      'Star',
      system.star || system.spectralClass ? (
        <span className="inline-flex items-center gap-2">
          {system.star && (
            <>
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: `var(--color-star-${system.star})` }}
                aria-hidden="true"
              />
              {STAR_CLASSES[system.star].label}
            </>
          )}
          {system.spectralClass && <span className="font-mono text-ink-soft">{system.spectralClass}</span>}
        </span>
      ) : (
        missing
      )
    ],
    [
      'Economy',
      economy || strength ? (
        <span className="flex flex-col gap-1">
          {economy && (
            <span>
              {system.economy}
              {system.economy && system.economyStrength && <span className="text-ink-muted"> // </span>}
              {system.economyStrength}
            </span>
          )}
          {(type || strength) && (
            <span className={`text-sub text-ink-muted ${economy ? '' : 'text-row'}`}>
              {type && `${type} economy`}
              {type && strength ? ' · ' : ''}
              {strength && (
                <>
                  <span className="text-units-amber-text">{stars(strength, 3)}</span> strength
                </>
              )}
            </span>
          )}
        </span>
      ) : (
        missing
      ),
      { wide: true }
    ],
    ['Race', system.race ? RACES[system.race] : missing],
    [
      'Conflict',
      system.conflict === 'pirate' ? (
        <SeverityPill danger size="M">
          Pirate (outlaw)
        </SeverityPill>
      ) : system.conflict ? (
        CONFLICT_LEVELS[system.conflict]
      ) : (
        missing
      )
    ],
    [
      'Your rating',
      system.rating ? stars(system.rating, 5) : missing,
      { tone: system.rating ? 'text-units-amber-text' : '' }
    ]
  ];
  // Who discovered it shows once logged: an older system has no such line, and no gap where it would be.
  if (system.discoveredBy || system.discoveredOn) {
    cells.push([
      'Discovered',
      <span key="d" className="flex flex-col gap-1">
        {system.discoveredBy && <span className="break-words">{system.discoveredBy}</span>}
        {system.discoveredOn && (
          <span className="text-sub text-ink-muted font-mono">
            {discoveryWhen(system.discoveredOn, system.discoveredTime)}
          </span>
        )}
      </span>,
      { wide: true }
    ]);
  }
  // "Water" and "Dissonant" show only when the map says so: their absence isn't something the player logged.
  if (system.water || system.dissonant) {
    cells.splice(1, 0, [
      'On the map',
      <span className="flex flex-col gap-0.5">
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
      </span>
    ]);
  }
  // A cell left alone on its row (after Economy's full row, say) takes the whole row rather than leave a gap.
  let used = 0;
  const laid = cells.map(([label, value, opts], i) => {
    const wide = Boolean(opts?.wide) || (i === cells.length - 1 && used % 2 === 0);
    used += opts?.wide ? 2 : 1;
    return { label, value, tone: opts?.tone, wide };
  });
  return (
    <dl className="grid grid-cols-2 gap-px rounded-card overflow-hidden bg-hairline border border-hairline">
      {laid.map(({ label, value, tone, wide }) => (
        <div key={label} className={`bg-panel px-4 py-3 min-w-0 ${wide ? 'col-span-2' : ''}`}>
          <dt className={LABEL}>{label}</dt>
          <dd className={`mt-1 text-row break-words ${tone || 'text-ink-bright'}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Twelve slots for the address the portal dials; empty until logged, with Add opening the editor.
function PortalAddress({ system }: { system: System }) {
  const glyphs = system.glyphs;
  return (
    <section
      aria-labelledby="portalTitle"
      className={`rounded-card px-3.5 py-3 flex flex-col gap-3 border ${glyphs ? 'border-hairline bg-panel' : 'border-dashed border-control-edge'}`}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex flex-col gap-[7px] min-w-0">
          <h2 id="portalTitle" className={LABEL}>
            Portal address
          </h2>
          <div className="flex gap-[3px]" aria-hidden={!glyphs}>
            {Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                className="w-[14px] h-5 rounded-[4px] bg-slate-ground border border-hairline grid place-items-center font-mono text-[11px] text-quantity-cyan"
              >
                {glyphs[i] ?? ''}
              </span>
            ))}
          </div>
          {!glyphs && <span className="sr-only">Not logged</span>}
        </div>
        {glyphs ? (
          <Button
            variant="jump"
            size="S"
            onClick={() => {
              copyText(glyphs, `Copied the portal address ${glyphs}.`);
            }}
          >
            Copy
          </Button>
        ) : (
          <Button
            variant="jump"
            size="S"
            onClick={() => {
              openSystemEditor(system.id);
            }}
          >
            Add
          </Button>
        )}
      </div>
      {glyphs && <GlyphPlate glyphs={glyphs} />}
    </section>
  );
}

// A planet's row (03b): its marker, name, one scan line and, for the game's danger only, a crimson pill naming what
// it's about. It opens the planet's own view (36).
function PlanetRow({
  planet,
  href,
  facts,
  editing,
  moon = false,
  onEdit
}: {
  planet: Planet;
  href: string;
  facts: FactsFile | null;
  editing: boolean;
  /** A moon inside its planet's row: indented, with a smaller marker. */
  moon?: boolean;
  onEdit: () => void;
}) {
  const base = planet.tags.includes('base');
  const { family, relic } = planetFamily(facts, planet);
  const line = planetScanLine(planet, facts);
  return (
    <a
      href={href}
      onClick={event => {
        // From lg the planet opens in the panel beside System detail (37; owner, 2026-11-06); below lg, its own view.
        // A modified click still opens the view in a new tab, as a link does.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        if (!matchMedia(WIDE).matches) return;
        event.preventDefault();
        onEdit();
      }}
      className={`w-full ${moon ? 'pl-10 pr-4 py-3' : 'px-4 py-3.5'} flex items-center gap-3.5 text-left hover:bg-slate-ground transition-colors duration-[var(--duration-micro)]`}
    >
      {moon && <i className="ph ph-arrow-elbow-down-right -mr-2 text-ink-label shrink-0" aria-hidden="true" />}
      <span className={`${moon ? 'w-9 h-9' : 'w-12 h-12'} grid place-items-center shrink-0`}>
        <PlanetMarker
          family={family}
          relic={relic}
          size={moon ? (base ? 18 : 16) : base ? 28 : 26}
          base={base}
          unlogged={nothingLogged(planet)}
        />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-row font-semibold text-ink-bright break-words">{planet.name}</span>
          {base && (
            <span className="h-[22px] px-2 rounded-full bg-scanner-cyan-tint border border-scanner-cyan-edge text-quantity-cyan text-pill uppercase inline-flex items-center">
              Base
            </span>
          )}
          {editing && (
            <span className="h-[22px] px-2 rounded-full bg-scanner-cyan-tint border border-scanner-cyan-edge text-quantity-cyan text-[11px] font-semibold inline-flex items-center">
              Editing
            </span>
          )}
        </span>
        <span className="block text-caption text-ink-muted">
          {line.text}
          {line.temperature && (
            <>
              {line.text && ' · '}
              <span className="font-mono">{line.temperature}</span>
            </>
          )}
        </span>
        <DangerPills planet={planet} facts={facts?.planets ?? null} />
      </span>
      <i className="ph ph-caret-right text-ink-muted shrink-0" aria-hidden="true" />
    </a>
  );
}

const visitDay = (iso: string) => {
  const at = new Date(iso);
  return `${at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};

// Your notes, then every visit, newest first.
function Journal({ system }: { system: System }) {
  const visits = [...system.visits].reverse();
  const notes = system.notes.trim();
  return (
    <section aria-labelledby="journalTitle" className="flex flex-col gap-2">
      <h2 id="journalTitle" className={SECTION_TITLE}>
        Journal
      </h2>
      <div className="rounded-card bg-panel border border-hairline p-3.5 flex flex-col gap-2.5">
        {notes ? (
          <p className="text-row text-ink whitespace-pre-line break-words">{notes}</p>
        ) : (
          <p className="text-sub text-ink-muted">No notes yet. Edit the system to add some.</p>
        )}
        <ol className="flex flex-col gap-2 pt-2.5 border-t border-hairline">
          {visits.length ? (
            visits.map((visit, i) => (
              <li key={`${visit.at}-${String(i)}`} className="flex items-baseline gap-2.5 flex-wrap">
                <span
                  className={`w-2 h-2 rounded-full self-center ${i ? 'bg-control-edge' : 'bg-scanner-cyan-glow'}`}
                  aria-hidden="true"
                />
                <time dateTime={visit.at} className="font-mono text-caption text-ink-soft">
                  {visitDay(visit.at)}
                </time>
                <span className="text-caption text-ink-muted">
                  Visited{visit.packets ? ` · ${String(visit.packets)} packets` : ''}
                </span>
                {visit.note && <span className="basis-full pl-[18px] text-caption text-ink-soft">{visit.note}</span>}
              </li>
            ))
          ) : (
            <li className="text-caption text-ink-muted">No visits yet. Log a visit when you’re here.</li>
          )}
        </ol>
      </div>
    </section>
  );
}
