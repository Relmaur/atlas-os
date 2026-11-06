// A planet's own view (design 36, 36b, 36c) at #planet/<system>/<planet>: what the player logged from its scan, in
// the game's order, read-only. A planet row in System detail opens it; the pencil opens the planet sheet (35). Only
// what's logged shows: a partly filled planet lists what's missing on one dashed line, an unscanned one offers to
// fill it in from the scan.
import { useEffect, type ReactNode } from 'react';
import { hazardReading, planetFamily, readingText } from '@atlas/core/facts';
import { biomeFor, resourceSource, scanLogged } from '@atlas/core/planets';
import { moonParent } from '@atlas/core/systems-model';
import { useAppState } from '../useAppState.ts';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { goBack, useSectionParam } from '../shell/section-store.ts';
import { wikiEntries } from '../shell/wiki-index.ts';
import { Button } from '../parts/Button.tsx';
import { PlanetMarker } from '../parts/StarChart.tsx';
import { SentinelPill, WeatherPill, codexHref, nothingLogged, planetKind } from './PlanetScan.tsx';
import { openPlanetSheet, planetHref } from './planet-sheet-store.ts';
import { discoveryWhen } from './DiscoveryFields.tsx';

const HEAD_BUTTON =
  'w-10 h-10 rounded-control bg-[rgba(5,8,17,0.7)] border border-hairline grid place-items-center text-ink hover:border-control-edge transition-colors duration-[var(--duration-micro)]';
const SECTION_TITLE = 'font-display text-sm font-bold tracking-[0.04em] text-ink-bright';
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

      {!logged.any ? (
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
      ) : (
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
          {missing.length > 0 && (
            <div className="rounded-card border border-dashed border-control-edge px-4 py-3.5 flex items-center gap-3">
              <p className="flex-1 text-row text-ink-soft">{`Not logged yet: ${missing.join(', ')}.`}</p>
              <Button icon="ph-plus" onClick={edit}>
                Add
              </Button>
            </div>
          )}
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
      )}

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

      {logged.any && (
        <p className="text-caption text-ink-muted">
          As you logged it from the scan. Biome, weather and sentinel levels from the No Man’s Sky wiki, CC BY-NC-SA
          3.0.
        </p>
      )}
    </div>
  );
}
