// A planet's own view (design 36, 36b, 36c) at #planet/<system>/<planet>: what the player logged from its scan, in
// the game's order, read-only. A planet row in System detail opens it; the pencil opens the planet sheet (35). Only
// what's logged shows: a partly filled planet lists what's missing on one dashed line, an unscanned one offers to
// fill it in from the scan. From lg (round 6, d16) it fills the detail pane: a breadcrumb with the previous and next
// body, then three columns (the scan; resources and notes; discovery and the portal glyph) that fold as it narrows.
import { useEffect, type ReactNode } from 'react';
import { hazardReading, planetFamily, readingText } from '@atlas/core/facts';
import { biomeFor, resourceSource, scanLogged } from '@atlas/core/planets';
import { moonParent } from '@atlas/core/systems-model';
import { glyphName } from '@atlas/core/portal';
import { useAppState } from '../useAppState.ts';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { goBack, useSectionParam } from '../shell/section-store.ts';
import { wikiEntries } from '../shell/wiki-index.ts';
import { Button } from '../parts/Button.tsx';
import { PlanetMarker } from '../parts/StarChart.tsx';
import { SentinelPill, WeatherPill, codexHref, nothingLogged, planetKind } from './PlanetScan.tsx';
import { openPlanetSheet, planetHref } from './planet-sheet-store.ts';
import { discoveryWhen } from './DiscoveryFields.tsx';
import { useMedia } from '../parts/useMedia.ts';
import { useGlyphTable } from '../portal/glyph-parts.tsx';

const HEAD_BUTTON =
  'w-10 h-10 rounded-control bg-[rgba(5,8,17,0.7)] border border-hairline grid place-items-center text-ink hover:border-control-edge transition-colors duration-[var(--duration-micro)]';
const SECTION_TITLE = 'font-display text-sm font-bold tracking-[0.04em] text-ink-bright';
const DESK_BUTTON =
  'h-10 px-3 rounded-control border border-control-edge bg-slate-ground text-[13px] font-semibold text-ink-bright inline-flex items-center gap-1.5 hover:border-control-edge-hover';
const CARD = 'rounded-card bg-panel border border-hairline divide-y divide-hairline overflow-hidden';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,38%)_1fr] items-center gap-3 px-4 min-h-[52px] py-2.5">
      <dt className="text-sub text-ink-muted">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2 text-row text-ink-bright min-w-0 break-words">{children}</dd>
    </div>
  );
}

// "5 Nov 2026", as the player's locale writes a day, from the stored YYYY-MM-DD (read as a calendar day, not UTC).

export function PlanetDetails() {
  const state = useAppState();
  const facts = useFacts();
  const param = useSectionParam();
  const wide = useMedia('(min-width: 1024px)');
  const table = useGlyphTable();
  useEffect(() => {
    void loadFacts(); // the biome's colour and the scan's severity
  }, []);
  const [systemId = '', planetId = ''] = param.split('/');
  const system = state.systems.find(item => item.id === systemId);
  const planet = system?.planets.find(item => item.id === planetId);
  if (!system || !planet) {
    return (
      <div className="flex flex-col items-start gap-section pt-[env(safe-area-inset-top)]">
        <h1 className="font-display text-screen-title text-ink-bright">Planet or moon not found</h1>
        <p className="text-sub text-ink-muted">It may have been deleted, or the link is from another device’s log.</p>
        <Button
          onClick={() => {
            location.hash = system ? `#system/${encodeURIComponent(system.id)}` : '#systems';
          }}
        >
          {system ? system.name : 'All systems'}
        </Button>
      </div>
    );
  }

  const wiki = facts?.planets ?? null;
  const edit = () => {
    openPlanetSheet(system.id, planet.id);
  };
  const { family, relic } = planetFamily(facts, planet);
  const logged = scanLogged(planet);
  const biomeName = biomeFor(wiki, planet.biome)?.name ?? planet.biome;
  const kind = planetKind(planet);
  const parent = moonParent(system.planets, planet);
  const temperature = readingText(facts, planet);
  const reading = hazardReading(facts, planet.hazard);
  const missing = [
    !planet.weather && 'weather',
    !planet.abundance && 'resources level',
    !planet.fauna && 'fauna',
    !planet.flora && 'flora',
    !planet.sentinels && 'sentinels',
    planet.temperature === null && reading.name.toLowerCase(),
    !planet.resources.length && 'what it lists',
    !planet.discoveredBy && !planet.discoveredOn && 'discovery'
  ].filter((item): item is string => Boolean(item));
  const codexPage = (name: string) =>
    wikiEntries().find(entry => entry.title.toLowerCase() === name.toLowerCase() && !entry.removed)?.path;

  const siblings = system.planets;
  const at = siblings.indexOf(planet);
  const prev = at > 0 ? siblings[at - 1] : undefined;
  const next = at >= 0 ? siblings[at + 1] : undefined;
  // The planet's own portal glyph (35c), and what follows it in the system's address.
  const glyph = planet.portalGlyph;
  const rest =
    system.glyphs.length === 12 ? Array.from(system.glyphs.slice(1, 4)).map(digit => glyphName(table, digit)) : [];

  const parts = {
    header: (
      <header className="flex items-center gap-5">
        <span className="w-24 h-24 grid place-items-center shrink-0">
          <PlanetMarker family={family} relic={relic} size={72} unlogged={nothingLogged(planet)} />
        </span>
        <div className="flex flex-col gap-title-sub min-w-0">
          <p className="text-label uppercase text-ink-label">{biomeName ? `${biomeName} biome` : 'Not scanned yet'}</p>
          <h1
            id="planetTitle"
            className="font-display text-[28px] font-extrabold leading-[1.1] text-ink-bright break-words"
          >
            {planet.name}
          </h1>
          {(kind || planet.body) && (
            <p className="text-sub text-ink-soft">
              {kind || (planet.body === 'moon' ? 'Moon' : 'Planet')}
              {parent && (
                <>
                  {' · orbits '}
                  <a href={planetHref(system.id, parent.id)} className="text-scanner-cyan-pale hover:underline">
                    {parent.name}
                  </a>
                </>
              )}
            </p>
          )}
          {planet.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 mt-1" aria-label="Tags">
              {planet.tags.map(tag => (
                <li
                  key={tag}
                  className="h-8 px-3 rounded-full bg-scanner-cyan-tint border border-scanner-cyan-edge text-[13px] text-[#a5f3fc] inline-flex items-center"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>
    ),
    nothing: !logged.any ? (
      <section
        aria-labelledby="nothingScanned"
        className="rounded-card border border-dashed border-control-edge bg-panel p-4 flex flex-col gap-3"
      >
        <h2 id="nothingScanned" className={SECTION_TITLE}>
          Nothing scanned yet
        </h2>
        <p className="text-row text-ink-soft">
          Land, or open the planet in Discoveries, and copy what the scan shows: the description, weather, sentinels,
          life and resources. The marker takes the biome’s colour.
        </p>
        <Button variant="primary" icon="ph-plus" onClick={edit}>
          Fill in from the scan
        </Button>
      </section>
    ) : null,
    scan: logged.any ? (
      <>
        {logged.rows && (
          <section aria-labelledby="scanTitle" className="flex flex-col gap-2">
            <h2 id="scanTitle" className={SECTION_TITLE}>
              The scan
            </h2>
            <dl className={CARD}>
              {planet.weather && (
                <Row label="Weather">
                  {planet.weather}
                  <WeatherPill facts={wiki} biome={planet.biome || planet.descriptor} weather={planet.weather} />
                </Row>
              )}
              {planet.abundance && <Row label="Resources">{planet.abundance}</Row>}
              {planet.fauna && <Row label="Fauna">{planet.fauna}</Row>}
              {planet.flora && <Row label="Flora">{planet.flora}</Row>}
              {planet.sentinels && (
                <Row label="Sentinels">
                  {planet.sentinels}
                  <SentinelPill facts={wiki} sentinels={planet.sentinels} />
                </Row>
              )}
              {temperature && (
                <Row label={reading.name}>
                  <span className="font-mono">{temperature}</span>
                </Row>
              )}
            </dl>
          </section>
        )}
      </>
    ) : null,
    missing: logged.any ? (
      <>
        {missing.length > 0 && (
          <div className="rounded-card border border-dashed border-control-edge px-4 py-3.5 flex items-center gap-3">
            <p className="flex-1 text-row text-ink-soft">{`Not logged yet: ${missing.join(', ')}.`}</p>
            <Button icon="ph-plus" onClick={edit}>
              Add
            </Button>
          </div>
        )}
      </>
    ) : null,
    resources: logged.any ? (
      <>
        {planet.resources.length > 0 && (
          <section aria-labelledby="resourcesTitle" className="flex flex-col gap-2">
            <h2 id="resourcesTitle" className={SECTION_TITLE}>
              Resources · {planet.resources.length}
            </h2>
            <ul className={CARD}>
              {planet.resources.map(name => {
                const source = resourceSource(wiki, name, planet.biome || planet.descriptor, system.star);
                const page = codexPage(name);
                return (
                  <li key={name} className="flex items-center gap-3 px-4 min-h-[52px] py-2">
                    <span className="flex-1 min-w-0 text-row text-ink-bright break-words">{name}</span>
                    {source && <span className="text-caption text-ink-muted shrink-0">{source}</span>}
                    {page && (
                      <a
                        href={codexHref(page)}
                        aria-label={`${name} in the Codex`}
                        className="inline-flex items-center gap-1.5 text-sub text-scanner-cyan-pale hover:text-quantity-cyan shrink-0"
                      >
                        <i className="ph ph-book-open" aria-hidden="true" />
                        Codex
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </>
    ) : null,
    discovery: logged.any ? (
      <>
        {(planet.discoveredBy || planet.discoveredOn) && (
          <section aria-labelledby="discoveryTitle" className="flex flex-col gap-2">
            <h2 id="discoveryTitle" className={SECTION_TITLE}>
              Discovery
            </h2>
            <dl className={CARD}>
              {planet.discoveredBy && <Row label="Discovered by">{planet.discoveredBy}</Row>}
              {planet.discoveredOn && (
                <Row label="On">
                  <span className="font-mono">{discoveryWhen(planet.discoveredOn, planet.discoveredTime)}</span>
                </Row>
              )}
            </dl>
          </section>
        )}
      </>
    ) : null,
    notes: (
      <>
        {(planet.notes || !logged.any) && (
          <section aria-labelledby="planetNotesTitle" className="flex flex-col gap-2">
            <h2 id="planetNotesTitle" className={SECTION_TITLE}>
              Notes
            </h2>
            <div className="rounded-card bg-panel border border-hairline px-4 py-3.5">
              {planet.notes ? (
                <p className="text-row text-ink whitespace-pre-line break-words">{planet.notes}</p>
              ) : (
                <p className="text-row text-ink-muted">
                  No notes.{' '}
                  <button
                    type="button"
                    onClick={edit}
                    className="text-scanner-cyan-pale underline hover:text-quantity-cyan"
                  >
                    Add one
                  </button>
                </p>
              )}
            </div>
          </section>
        )}
      </>
    ),
    credit: (
      <>
        {logged.any && (
          <p className="text-caption text-ink-muted">
            As you logged it from the scan. Biome, weather and sentinel levels from the No Man’s Sky wiki, CC BY-NC-SA
            3.0.
          </p>
        )}
      </>
    )
  };

  if (wide)
    return (
      <div className="detail-pane flex flex-col min-h-full">
        <nav
          aria-label="Planet"
          className="flex items-center justify-between gap-3 flex-wrap px-[22px] py-4 border-b border-hairline"
        >
          <ol className="m-0 p-0 list-none flex items-center gap-2 min-w-0 text-sm">
            <li className="min-w-0">
              <a
                href={`#system/${encodeURIComponent(system.id)}`}
                title={system.name}
                className="block truncate text-scanner-cyan-pale underline hover:text-quantity-cyan"
              >
                {system.name}
              </a>
            </li>
            <li aria-hidden="true" className="text-ink-muted">
              <i className="ph-bold ph-caret-right text-xs" />
            </li>
            <li aria-current="page" title={planet.name} className="min-w-0 truncate text-ink">
              {planet.name}
            </li>
          </ol>
          <span className="flex gap-2 shrink-0">
            {prev && (
              <a href={planetHref(system.id, prev.id)} title={prev.name} className={DESK_BUTTON}>
                <i className="ph-bold ph-caret-left" aria-hidden="true" />
                <span className="sr-only">Previous body, </span>
                <span className="max-w-[9rem] truncate">{prev.name}</span>
              </a>
            )}
            {next && (
              <a href={planetHref(system.id, next.id)} title={next.name} className={DESK_BUTTON}>
                <span className="sr-only">Next body, </span>
                <span className="max-w-[9rem] truncate">{next.name}</span>
                <i className="ph-bold ph-caret-right" aria-hidden="true" />
              </a>
            )}
            <button type="button" onClick={edit} aria-keyshortcuts="e" className={DESK_BUTTON}>
              <i className="ph-bold ph-pencil-simple" aria-hidden="true" />
              Edit<span className="sr-only"> body</span>
              <kbd aria-hidden="true" className="nav-kbd">
                E
              </kbd>
            </button>
          </span>
        </nav>
        <div className="@container flex-1 flex flex-col">
          <div className="grid grid-cols-1 @[44rem]:grid-cols-2 @[56rem]:grid-cols-3 flex-1">
            <div className="min-w-0 px-[22px] py-[18px] flex flex-col gap-section">
              {parts.header}
              {parts.nothing}
              {parts.scan}
              {parts.missing}
            </div>
            <div className="min-w-0 px-[22px] py-[18px] flex flex-col gap-section border-t @[44rem]:border-t-0 @[44rem]:border-l border-hairline">
              {parts.resources}
              {parts.notes}
            </div>
            <div className="min-w-0 px-[22px] py-[18px] flex flex-col gap-section border-t @[56rem]:border-t-0 @[56rem]:border-l border-hairline @[44rem]:col-span-2 @[56rem]:col-span-1">
              {parts.discovery}
              {glyph && (
                <section aria-labelledby="planetGlyphTitle" className="flex flex-col gap-2">
                  <h2 id="planetGlyphTitle" className={SECTION_TITLE}>
                    Portal glyph
                  </h2>
                  <div className="rounded-card bg-panel border border-hairline p-3.5 flex items-center gap-3.5">
                    <span className="w-[72px] h-[72px] shrink-0 rounded-slot border border-scanner-cyan-edge bg-slate-ground flex flex-col justify-center px-3">
                      <span className="text-sm font-semibold text-ink-bright truncate">{glyphName(table, glyph)}</span>
                      <span aria-hidden="true" className="font-mono text-[11px] text-ink-muted">
                        {glyph}
                      </span>
                    </span>
                    {rest.length > 0 && (
                      <p className="m-0 text-sub text-ink-soft">
                        {`then ${rest.join(', ')} and the region from ${system.name}`}
                      </p>
                    )}
                  </div>
                </section>
              )}
              <div className="mt-auto">{parts.credit}</div>
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-section max-w-2xl">
      <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3 pt-header-top lg:pt-0">
        <button
          type="button"
          onClick={() => {
            goBack(`system/${encodeURIComponent(system.id)}`);
          }}
          aria-label={`Back to ${system.name}`}
          className={HEAD_BUTTON}
        >
          <i className="ph-bold ph-caret-left text-lg" aria-hidden="true" />
        </button>
        <p className="text-sub text-ink-muted text-center truncate">{system.name}</p>
        <button type="button" onClick={edit} aria-label="Edit body" className={HEAD_BUTTON}>
          <i className="ph-bold ph-pencil-simple text-lg" aria-hidden="true" />
        </button>
      </div>

      {parts.header}
      {!logged.any ? (
        parts.nothing
      ) : (
        <>
          {parts.scan}
          {parts.missing}
          {parts.resources}
          {parts.discovery}
        </>
      )}
      {parts.notes}
      {parts.credit}
    </div>
  );
}
