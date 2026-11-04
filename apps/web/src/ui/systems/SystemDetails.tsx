// System detail (design 03): a system's own screen at #system/<id>. Its orbit diagram (XL, the side view) leads,
// then what the game shows, the portal address, the planets, the journal (your notes and visits), and Log a visit.
// The rest is edited in the editor sheet (06). Planets are added and edited here, in a sheet of their own: the
// design has no other place for them, and the orbit diagram draws from them.
import { useCallback, useEffect, useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import { biomeFamily } from '@atlas/core/facts';
import { homeSummary } from '@atlas/core/home';
import { notesForSystem, systemPin } from '@atlas/core/notes';
import { systemOrbit } from '@atlas/core/orbit';
import { CONFLICT_LEVELS, RACES, STAR_CLASSES, lastVisit, type Planet, type System } from '@atlas/core/systems-model';
import { deletePlanet, logVisit, savePlanet, toggleFavorite } from '../actions.ts';
import { useAppState } from '../useAppState.ts';
import { useNow } from '../useNow.ts';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { goBack, useSectionParam } from '../shell/section-store.ts';
import { Button } from '../parts/Button.tsx';
import { ArmButton } from '../parts/Gesture.tsx';
import { PanelGrab, SheetGrab, useSheetDrag, useSheetOpen } from '../parts/Sheet.tsx';
import { OrbitDiagram, PlanetMarker } from '../parts/StarChart.tsx';
import { copyText, ShareSystemSheet } from '../share/ShareSheet.tsx';
import { LinkedNoteRows } from '../notes/note-bits.tsx';
import { newNote } from '../notes/note-nav.ts';
import { openSystemEditor } from './panel-store.ts';
import { GlyphPlate } from './GlyphPlate.tsx';

const HERO_BUTTON =
  'w-10 h-10 rounded-control bg-[rgba(5,8,17,0.7)] border border-hairline grid place-items-center text-ink hover:border-control-edge transition-colors duration-[var(--duration-micro)]';
const LABEL = 'text-label uppercase text-ink-label';
const SECTION_TITLE = 'font-display text-sm font-bold tracking-[0.04em] text-ink-bright';

export function SystemDetails() {
  const state = useAppState();
  const now = useNow();
  const id = useSectionParam();
  const facts = useFacts();
  // The planet stays set while the sheet slides closed, so its title doesn't flip mid-animation.
  const [planetSheet, setPlanetSheet] = useState({ open: false, planetId: null as string | null, session: 0 });
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => {
    setSharing(false);
  }, []);
  const closePlanet = useCallback(() => {
    setPlanetSheet(sheet => ({ ...sheet, open: false }));
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
  const orbit = systemOrbit(system, biome => biomeFamily(facts, biome));
  const place = [system.region, system.galaxy].filter(Boolean).join(' · ');
  const linked = notesForSystem(state.notes, system.id);
  const openPlanet = (planetId: string | null) => {
    setPlanetSheet(sheet => ({ open: true, planetId, session: sheet.session + 1 }));
  };

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

      <Facts system={system} />
      <PortalAddress system={system} />

      <section aria-labelledby="planetsTitle" className="flex flex-col gap-2">
        <h2 id="planetsTitle" className={SECTION_TITLE}>
          Planets · {system.planets.length}
        </h2>
        <ul className="rounded-card bg-panel border border-hairline divide-y divide-hairline overflow-hidden">
          {system.planets.map(planet => (
            <li key={planet.id}>
              <PlanetRow
                planet={planet}
                family={biomeFamily(facts, planet.biome)}
                onOpen={() => {
                  openPlanet(planet.id);
                }}
              />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                openPlanet(null);
              }}
              className="w-full min-h-14 px-3.5 flex items-center gap-3 text-left text-sub text-ink-muted hover:text-ink hover:bg-slate-ground transition-colors duration-[var(--duration-micro)]"
            >
              <span className="w-10 h-10 rounded-full border border-dashed border-grab grid place-items-center shrink-0">
                <i className="ph-bold ph-plus" aria-hidden="true" />
              </span>
              {system.planets.length ? 'Add planet' : 'Add planet: the ones with bases, hotspots or crash sites'}
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
      <PlanetSheet
        system={system}
        open={planetSheet.open}
        planet={system.planets.find(planet => planet.id === planetSheet.planetId)}
        session={planetSheet.session}
        onClose={closePlanet}
      />
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

// What the game shows, two to a row; anything not logged says so instead of being left out.
function Facts({ system }: { system: System }) {
  const cells: [string, ReactNode, string?][] = [
    [
      'Star',
      system.star ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: `var(--color-star-${system.star})` }}
            aria-hidden="true"
          />
          {STAR_CLASSES[system.star].label}
        </span>
      ) : (
        missing
      )
    ],
    ['Race', system.race ? RACES[system.race] : missing],
    ['Economy', system.economy || missing],
    ['Wealth', system.wealth ? stars(system.wealth, 3) : missing, system.wealth ? 'text-units-amber-text' : ''],
    ['Conflict', system.conflict ? CONFLICT_LEVELS[system.conflict] : missing],
    ['Your rating', system.rating ? stars(system.rating, 5) : missing, system.rating ? 'text-units-amber-text' : '']
  ];
  return (
    <dl className="grid grid-cols-2 gap-px rounded-card overflow-hidden bg-hairline border border-hairline">
      {cells.map(([label, value, tone]) => (
        <div key={label} className="bg-panel px-3 py-2.5 min-w-0">
          <dt className={LABEL}>{label}</dt>
          <dd className={`mt-[3px] text-row break-words ${tone || 'text-ink-bright'}`}>{value}</dd>
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

function PlanetRow({ planet, family, onOpen }: { planet: Planet; family: string | null; onOpen: () => void }) {
  const base = planet.tags.includes('base');
  const note = planet.notes.split('\n').find(line => line.trim());
  const sub = [planet.biome, note ? `“${note.trim()}”` : ''].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full px-3.5 py-3 flex items-center gap-3 text-left hover:bg-slate-ground transition-colors duration-[var(--duration-micro)]"
    >
      <span className="w-10 h-10 grid place-items-center shrink-0">
        <PlanetMarker family={family} size={base ? 26 : 20} base={base} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-row font-semibold text-ink-bright break-words">{planet.name}</span>
        {sub && <span className="block text-caption text-ink-muted line-clamp-2">{sub}</span>}
      </span>
      {base && (
        <span className="h-[22px] px-2 rounded-full bg-scanner-cyan-tint text-quantity-cyan text-pill uppercase inline-flex items-center shrink-0">
          Base
        </span>
      )}
    </button>
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

const SHEET_LAYOUT = '(min-width: 0px)';
const FIELD =
  'w-full h-12 rounded-control border border-control-edge bg-slate-ground px-3.5 text-base md:text-sm text-ink-bright placeholder:text-ink-disabled focus:border-scanner-cyan-edge-strong focus:outline-hidden';

// Adds or edits one planet: a bottom sheet below lg, a side panel from lg up, like the editor.
function PlanetSheet({
  system,
  planet,
  open,
  session,
  onClose
}: {
  system: System;
  planet: Planet | undefined;
  open: boolean;
  session: number;
  /** Stable (useCallback): the sheet's open effect depends on it. */
  onClose: () => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useSheetDrag(sheet, onClose);
  useSheetOpen(open, onClose, { layout: SHEET_LAYOUT, focus: title });

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string) => {
      const value = data.get(name);
      return typeof value === 'string' ? value : '';
    };
    if (!field('name').trim()) return;
    savePlanet(system.id, planet?.id ?? null, {
      name: field('name'),
      biome: field('biome'),
      tags: field('tags'),
      notes: field('notes')
    });
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[55] bg-scrim backdrop-blur-[2px] transition-opacity duration-200 ${open ? '' : 'opacity-0 pointer-events-none'}`}
      />
      <div
        ref={sheet}
        id="planetSheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planetSheetTitle"
        aria-hidden={!open}
        inert={!open}
        className={`fixed z-[56] flex flex-col bg-slate-deep border-control-edge transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] inset-x-0 bottom-0 max-h-[92dvh] rounded-t-sheet border-t ${open ? '' : 'translate-y-full'} lg:inset-x-auto lg:right-0 lg:top-0 lg:bottom-0 lg:max-h-none lg:w-[440px] lg:rounded-none lg:border-t-0 lg:border-l lg:translate-y-0 ${open ? '' : 'lg:translate-x-full'}`}
      >
        <PanelGrab onClose={onClose} label="Close planet" />
        <form
          key={session}
          onSubmit={submit}
          className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:pb-6 flex flex-col gap-4"
        >
          <div data-sheet-grab className="sticky top-0 z-10 -mx-5 px-5 pt-3 lg:pt-5 pb-1 bg-slate-deep">
            <SheetGrab onClose={onClose} label="Close planet" />
            <h2
              ref={title}
              id="planetSheetTitle"
              tabIndex={-1}
              className="font-display text-lg font-bold text-ink-bright focus:outline-hidden"
            >
              {planet ? 'Edit planet' : 'Add planet'}
            </h2>
            <p className="text-sub text-ink-muted mt-1">{system.name}</p>
          </div>
          <label className="flex flex-col gap-1.5 text-caption text-ink-muted">
            Name
            <input name="name" required maxLength={80} defaultValue={planet?.name ?? ''} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1.5 text-caption text-ink-muted">
            Biome
            <input
              name="biome"
              list="biomeOptions"
              maxLength={40}
              defaultValue={planet?.biome ?? ''}
              placeholder="e.g. Frozen"
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-caption text-ink-muted">
            Tags
            <input
              name="tags"
              maxLength={200}
              defaultValue={planet?.tags.join(', ') ?? ''}
              placeholder="base, oxygen-hotspot"
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-caption text-ink-muted">
            Notes
            <textarea
              name="notes"
              rows={3}
              maxLength={1000}
              defaultValue={planet?.notes ?? ''}
              className={`${FIELD} h-auto py-3 leading-relaxed resize-y`}
            />
          </label>
          <div className="grid grid-cols-[1fr_2fr] gap-2 mt-1">
            <Button size="L" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {planet ? 'Save planet' : 'Add planet'}
            </Button>
          </div>
          {planet && (
            <ArmButton
              label="Delete planet"
              armedLabel="Tap again to delete"
              onConfirm={() => {
                deletePlanet(system.id, planet.id);
                onClose();
              }}
            />
          )}
        </form>
      </div>
    </>
  );
}
