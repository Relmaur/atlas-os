// A planet's scan (design round 4): the planet sheet's form (35, 35b; a right panel from lg, 37), and the pieces the
// planet's row (03b) and its own view (36) share. The sheet follows the game's scan: Identity (the line under the
// name), the scan's rows in the game's order, what the ship's scan lists, and the discovery. Every word field is a
// word combobox fed by the wiki's lists (wiki/facts.json → planets); what the player types is kept as typed.
// Temperature, the resources level and the discoverer are the player's own entries (ADR-0003).
import { useState, type ReactNode, type RefObject, type SubmitEvent } from 'react';
import { planetFamily, type FactsFile } from '@atlas/core/facts';
import {
  SENTINEL_LEVELS,
  SENTINEL_SHORT,
  WEATHER_SHORT,
  biomeFor,
  isDangerSentinels,
  isDangerWeather,
  resourceChoices,
  scanLogged,
  sentinelLevel,
  weatherSource,
  type PlanetFacts,
  type SentinelLevel
} from '@atlas/core/planets';
import { BIOMES, PLANET_BODIES, type Planet, type System } from '@atlas/core/systems-model';
import { deletePlanet, savePlanet } from '../actions.ts';
import { wikiEntries } from '../shell/wiki-index.ts';
import { Button } from '../parts/Button.tsx';
import { ArmButton } from '../parts/Gesture.tsx';
import { SeverityPill } from '../parts/SeverityPill.tsx';
import { PlanetMarker } from '../parts/StarChart.tsx';
import { WordCombobox, type WordGroup } from '../parts/WordCombobox.tsx';
import { FIELD, LABEL_FIELD, Segments } from './editor-parts.tsx';

export const codexHref = (path: string): string => `wiki/#/a/${encodeURIComponent(path)}`;
const unique = (items: string[]) => [...new Set(items.filter(Boolean))];
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** "Frostbound Planet": the description and planet or moon, as the game writes the line under the name. */
export function planetKind(planet: Pick<Planet, 'descriptor' | 'body'>): string {
  return [planet.descriptor, planet.body ? PLANET_BODIES[planet.body] : ''].filter(Boolean).join(' ');
}

/** The row's one scan line (03b): "Frostbound Planet · Icy Blasts" and "−60.8 °C", or what's still missing. */
export function planetScanLine(planet: Planet): { text: string; temperature: string } {
  const kind = planetKind(planet) || planet.biome;
  if (!scanLogged(planet).rows) {
    // A description or biome is a start; "Planet" alone is nothing logged yet (03b).
    const missing = planet.descriptor || planet.biome ? 'not scanned yet' : 'nothing logged yet';
    return {
      text: [kind || (planet.body ? PLANET_BODIES[planet.body] : ''), missing].filter(Boolean).join(' · '),
      temperature: ''
    };
  }
  const temperature = planet.temperature === null ? '' : `${String(planet.temperature).replace('-', '−')} °C`;
  return { text: [kind, planet.weather].filter(Boolean).join(' · '), temperature };
}

/** Whether nothing at all is logged about a planet beyond its name: its marker is dashed (36c, 03b). */
export const nothingLogged = (planet: Planet): boolean =>
  !planet.descriptor && !planet.biome && !scanLogged(planet).any;

/** The danger pills a planet's row carries (03b): crimson, with the mark, naming what they're about. */
export function DangerPills({ planet, facts }: { planet: Planet; facts: PlanetFacts | null }) {
  const weather = weatherSource(facts, planet.biome || planet.descriptor, planet.weather);
  const level = sentinelLevel(facts, planet.sentinels);
  const pills = [
    weather && isDangerWeather(weather.cls) ? `${WEATHER_SHORT[weather.cls]} weather` : '',
    level && isDangerSentinels(level) ? `${SENTINEL_SHORT[level]} sentinels` : ''
  ].filter(Boolean);
  if (!pills.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5 mt-1.5">
      {pills.map(pill => (
        <SeverityPill key={pill} danger>
          {pill}
        </SeverityPill>
      ))}
    </span>
  );
}

/** The weather's pill, quiet or crimson by the wiki's table; nothing for a word the wiki doesn't rate. */
export function WeatherPill({ facts, biome, weather }: { facts: PlanetFacts | null; biome: string; weather: string }) {
  const source = weatherSource(facts, biome, weather);
  return source ? <SeverityPill danger={isDangerWeather(source.cls)}>{WEATHER_SHORT[source.cls]}</SeverityPill> : null;
}
export function SentinelPill({ facts, sentinels }: { facts: PlanetFacts | null; sentinels: string }) {
  const level = sentinelLevel(facts, sentinels);
  return level ? <SeverityPill danger={isDangerSentinels(level)}>{SENTINEL_SHORT[level]}</SeverityPill> : null;
}

const CARD = 'rounded-card bg-panel border border-hairline p-4 flex flex-col gap-3 min-w-0';
function Group({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return (
    <fieldset className={CARD}>
      <legend className="sr-only">{title}</legend>
      <div aria-hidden="true" className="flex items-baseline justify-between gap-3">
        <span className="font-display text-sm font-bold text-ink-bright">{title}</span>
        <span className="text-caption text-ink-muted text-right">{caption}</span>
      </div>
      {children}
    </fieldset>
  );
}

function ResourceChip({ name, on, onToggle }: { name: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[13px] font-medium transition-colors duration-[var(--duration-micro)] ${
        on
          ? 'bg-scanner-cyan-tint border-scanner-cyan-edge text-[#a5f3fc]'
          : 'border-control-edge text-ink-soft hover:text-ink-bright hover:border-scanner-cyan-edge'
      }`}
    >
      <i aria-hidden="true" className={`ph-bold ${on ? 'ph-check' : 'ph-plus'} text-[11px]`} />
      {name}
    </button>
  );
}

interface Draft {
  name: string;
  tags: string;
  notes: string;
  descriptor: string;
  body: string;
  biome: string;
  weather: string;
  abundance: string;
  fauna: string;
  flora: string;
  sentinels: string;
  temperature: string;
  resources: string[];
  discoveredBy: string;
  discoveredOn: string;
  discoveredTime: string;
  orbits: string;
}

const draftOf = (planet: Planet | undefined): Draft => ({
  name: planet?.name ?? '',
  tags: planet?.tags.join(', ') ?? '',
  notes: planet?.notes ?? '',
  descriptor: planet?.descriptor ?? '',
  body: planet?.body ?? '',
  biome: planet?.biome ?? '',
  weather: planet?.weather ?? '',
  abundance: planet?.abundance ?? '',
  fauna: planet?.fauna ?? '',
  flora: planet?.flora ?? '',
  sentinels: planet?.sentinels ?? '',
  temperature: planet?.temperature == null ? '' : String(planet.temperature),
  resources: planet?.resources ?? [],
  discoveredBy: planet?.discoveredBy ?? '',
  discoveredOn: planet?.discoveredOn ?? '',
  discoveredTime: planet?.discoveredTime ?? '',
  // Kept as stored, even when it no longer points at a planet: the picker then reads "Not set", and saving
  // without touching it leaves the link as it was.
  orbits: planet?.orbits ?? ''
});

/**
 * The planet sheet's form, header to footer. `levels` are the resources levels already in the player's log: the
 * wiki has no list of them, so that combobox offers the player's own words.
 */
export function PlanetForm({
  system,
  planet,
  facts,
  levels,
  titleId,
  titleRef,
  onDone
}: {
  system: System;
  planet: Planet | undefined;
  facts: FactsFile | null;
  levels: string[];
  titleId: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  onDone: (deleted: boolean) => void;
}) {
  const wiki = facts?.planets ?? null;
  const [draft, setDraft] = useState(() => draftOf(planet));
  // The biome follows the description only while the player hasn't chosen one (a biome already logged counts).
  const [biomeChosen, setBiomeChosen] = useState(Boolean(planet?.biome));
  const [another, setAnother] = useState('');
  const set = (changes: Partial<Draft>) => {
    setDraft(current => ({ ...current, ...changes }));
  };

  const own = biomeFor(wiki, draft.biome);
  const fromPrefix = biomeFor(wiki, draft.descriptor);
  const sharedBy = wiki?.biomes.filter(entry => entry.descriptors.some(name => same(name, draft.descriptor))) ?? [];
  const { family, relic } = planetFamily(facts, { biome: draft.biome, descriptor: draft.descriptor });
  const weather = weatherSource(wiki, draft.biome || draft.descriptor, draft.weather);
  const level = sentinelLevel(wiki, draft.sentinels);
  // The draft's body is one of PLANET_BODIES' keys or '': the segments offer nothing else.
  const kind = planetKind({ descriptor: draft.descriptor, body: draft.body as Planet['body'] });
  // What a moon can orbit: the system's other planets that aren't moons themselves, in the log's order.
  const hosts = system.planets.filter(other => other.id !== planet?.id && other.body !== 'moon');
  const subtitle = [kind, own?.name ?? draft.biome].filter(Boolean).join(' · ') || 'Nothing from the scan yet';
  const unlogged = !draft.biome && !draft.descriptor;

  // Word lists, the current biome's first (c14).
  const descriptorGroups: WordGroup[] = wiki
    ? [
        ...(own ? [{ label: `${own.name} names · wiki`, options: own.descriptors.map(value => ({ value })) }] : []),
        {
          label: own ? 'Other biomes · wiki' : 'Names · wiki',
          options: unique(wiki.biomes.filter(entry => entry !== own).flatMap(entry => entry.descriptors))
            .filter(value => !own?.descriptors.includes(value))
            .sort()
            .map(value => ({ value }))
        }
      ]
    : [];
  const biomeGroups: WordGroup[] = [
    {
      label: wiki ? 'Biomes · wiki' : undefined,
      options: (wiki ? wiki.biomes.map(entry => entry.name) : BIOMES).map(value => ({
        value,
        extra: <PlanetMarker family={planetFamily(facts, { biome: value }).family} size={14} />
      }))
    }
  ];
  const weatherPill = (cls: 'clear' | 'normal' | 'extreme') => (
    <SeverityPill danger={isDangerWeather(cls)}>{WEATHER_SHORT[cls]}</SeverityPill>
  );
  const ownWeather = own ? Object.values(own.weather).flat() : [];
  const weatherGroups: WordGroup[] = wiki
    ? [
        ...(own
          ? [
              {
                label: `${own.name} weather · wiki`,
                options: [
                  ...(['clear', 'normal', 'extreme'] as const).flatMap(cls =>
                    own.weather[cls].map(value => ({ value, extra: weatherPill(cls) }))
                  ),
                  ...own.weather.other.map(value => ({ value }))
                ]
              }
            ]
          : []),
        {
          label: own ? 'Other biomes · wiki' : 'Weather · wiki',
          options: unique(wiki.biomes.flatMap(entry => Object.values(entry.weather).flat()))
            .filter(value => !ownWeather.includes(value))
            .sort()
            .map(value => ({ value }))
        }
      ]
    : [];
  const sentinelGroups: WordGroup[] = wiki
    ? (Object.keys(SENTINEL_LEVELS) as SentinelLevel[]).map(key => ({
        label: `${SENTINEL_LEVELS[key]} · wiki`,
        options: wiki.sentinels[key].map(value => ({
          value,
          extra: <SeverityPill danger={isDangerSentinels(key)}>{SENTINEL_SHORT[key]}</SeverityPill>
        }))
      }))
    : [];
  const lifeGroup = (words: string[] | undefined): WordGroup[] =>
    words?.length ? [{ label: 'Discovery menu · wiki', options: words.map(value => ({ value })) }] : [];
  const levelGroups: WordGroup[] = levels.length
    ? [{ label: 'From your log', options: levels.map(value => ({ value })) }]
    : [];

  // What the ship's scan can list, from the wiki: the biome's own, the star's metal, deposits, finds.
  const choices = resourceChoices(wiki, draft.biome || draft.descriptor, system.star);
  const grouped = choices.flatMap(choice => choice.names);
  const others = draft.resources.filter(name => !grouped.some(other => same(other, name)));
  const has = (name: string) => draft.resources.some(item => same(item, name));
  const toggle = (name: string) => {
    set({
      resources: has(name)
        ? draft.resources.filter(item => !same(item, name))
        : [...draft.resources, name.trim()].slice(0, 12)
    });
  };
  const codexResources = wikiEntries()
    .filter(entry => entry.category === 'resources' && !grouped.some(name => same(name, entry.title)))
    .map(entry => entry.title)
    .sort();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const pending = another.trim(); // a resource typed but not yet added still counts
    savePlanet(system.id, planet?.id ?? null, {
      name: draft.name,
      biome: draft.biome,
      tags: draft.tags,
      notes: draft.notes,
      scan: {
        descriptor: draft.descriptor,
        body: draft.body,
        weather: draft.weather,
        sentinels: draft.sentinels,
        flora: draft.flora,
        fauna: draft.fauna,
        abundance: draft.abundance,
        resources: [...draft.resources, ...(pending && !has(pending) ? [pending] : [])].join(','),
        temperature: draft.temperature,
        discoveredBy: draft.discoveredBy,
        discoveredOn: draft.discoveredOn,
        discoveredTime: draft.discoveredTime,
        // Only a moon orbits a planet; switching back to Planet unties it.
        orbits: draft.body === 'moon' ? draft.orbits : ''
      }
    });
    onDone(false);
  };

  const descriptorHint = fromPrefix ? (
    <>
      {draft.descriptor.trim()} is one of the{' '}
      <a href={codexHref(fromPrefix.path)} className="text-scanner-cyan-pale underline hover:text-quantity-cyan">
        {fromPrefix.name}
      </a>{' '}
      biome’s names{same(fromPrefix.name, draft.biome) ? `, so Biome is set to ${fromPrefix.name}.` : '.'}
    </>
  ) : sharedBy.length > 1 ? (
    `Used by ${sharedBy.map(entry => entry.name).join(', ')}: pick the biome below.`
  ) : !draft.descriptor ? (
    'The word before “Planet” or “Moon”. It usually tells the biome.'
  ) : undefined;
  const weatherHint = weather
    ? `${WEATHER_SHORT[weather.cls]} on the wiki’s ${weather.biome} weather table.`
    : !draft.weather
      ? 'Severity comes from the wiki’s weather tables: Clear, Normal or Extreme.'
      : undefined;
  const sentinelHint = level
    ? `${draft.sentinels.trim()} is a ${SENTINEL_SHORT[level]} level on the wiki’s Sentinel page.`
    : !draft.sentinels
      ? 'Sentinel levels from the wiki: Low, High, Aggressive or Corrupted.'
      : undefined;
  const text = (
    field: 'name' | 'tags' | 'notes' | 'temperature' | 'discoveredBy' | 'discoveredOn' | 'discoveredTime'
  ) => ({
    name: field,
    value: draft[field],
    onChange: (event: { target: { value: string } }) => {
      set({ [field]: event.target.value });
    }
  });

  return (
    <form onSubmit={submit} className="flex flex-col min-h-full">
      <div className="flex-1 px-5 pb-6 flex flex-col gap-4">
        <div
          data-sheet-grab
          className="sticky top-0 z-20 -mx-5 px-5 pt-3 lg:pt-5 pb-2 bg-slate-deep flex items-center gap-3.5"
        >
          <span className="w-12 h-12 grid place-items-center shrink-0">
            <PlanetMarker family={family} relic={relic} size={36} unlogged={unlogged} />
          </span>
          <div className="min-w-0">
            <h2
              ref={titleRef}
              id={titleId}
              tabIndex={-1}
              className="font-display text-lg font-bold text-ink-bright focus:outline-hidden"
            >
              {planet ? 'Edit planet' : 'Add a planet'}
            </h2>
            <p className="text-sub text-ink-muted truncate">
              {planet && <span className="hidden lg:inline">{`${draft.name || planet.name} · `}</span>}
              {subtitle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <label className={LABEL_FIELD}>
            Name
            <input
              required
              maxLength={80}
              autoComplete="off"
              placeholder="As the game names it"
              className={`${FIELD} min-w-0`}
              {...text('name')}
            />
          </label>
          <label className={LABEL_FIELD}>
            Tags
            <input
              maxLength={200}
              autoComplete="off"
              placeholder="e.g. farm"
              className={`${FIELD} min-w-0`}
              {...text('tags')}
            />
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-label uppercase text-ink-label">From the scan</p>
          <p className="text-caption text-ink-muted">
            Copy what the game shows. Every word field suggests the wiki’s words; anything you type is kept as typed.
          </p>
        </div>

        <Group title="Identity" caption="the line under the name">
          <WordCombobox
            label="Description"
            name="descriptor"
            value={draft.descriptor}
            onChange={descriptor => {
              const match = biomeFor(wiki, descriptor);
              set({ descriptor, ...(match && !biomeChosen ? { biome: match.name } : {}) });
            }}
            groups={descriptorGroups}
            placeholder="e.g. Frostbound, Verdant, Toxic"
            hint={descriptorHint}
          />
          <Segments
            label="Planet or moon"
            hideLabel
            value={draft.body}
            options={Object.entries(PLANET_BODIES)}
            onChange={body => {
              set({ body });
            }}
            clearable
          />
          {draft.body === 'moon' &&
            (hosts.length ? (
              <label className={LABEL_FIELD}>
                Orbits
                <span className="relative block">
                  <select
                    name="orbits"
                    value={draft.orbits}
                    onChange={event => {
                      set({ orbits: event.target.value });
                    }}
                    className={`${FIELD} appearance-none pr-9 cursor-pointer`}
                  >
                    <option value="">Not set</option>
                    {hosts.map(host => (
                      <option key={host.id} value={host.id}>
                        {host.name}
                      </option>
                    ))}
                  </select>
                  <i
                    aria-hidden="true"
                    className="ph-bold ph-caret-down pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                </span>
              </label>
            ) : (
              <p className="text-caption text-ink-muted">
                Log the planet this moon orbits in this system, and you can tie the moon to it here.
              </p>
            ))}
          <WordCombobox
            label="Biome"
            name="biome"
            value={draft.biome}
            onChange={biome => {
              set({ biome });
              setBiomeChosen(Boolean(biome.trim()));
            }}
            groups={biomeGroups}
            lead={<PlanetMarker family={family} relic={relic} size={18} unlogged={unlogged} />}
            placeholder="Pick, or let the description set it"
          />
        </Group>

        <Group title="The scan" caption="in the game’s order">
          <WordCombobox
            label="Weather"
            name="weather"
            value={draft.weather}
            onChange={value => {
              set({ weather: value });
            }}
            groups={weatherGroups}
            trail={weather ? weatherPill(weather.cls) : undefined}
            placeholder="e.g. Icy Blasts"
            hint={weatherHint}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <WordCombobox
              label="Resources"
              name="abundance"
              value={draft.abundance}
              onChange={value => {
                set({ abundance: value });
              }}
              groups={levelGroups}
              placeholder="e.g. Uncommon"
            />
            <WordCombobox
              label="Fauna"
              name="fauna"
              value={draft.fauna}
              onChange={value => {
                set({ fauna: value });
              }}
              groups={lifeGroup(wiki?.life.fauna)}
              placeholder="e.g. Abundant"
            />
            <WordCombobox
              label="Flora"
              name="flora"
              value={draft.flora}
              onChange={value => {
                set({ flora: value });
              }}
              groups={lifeGroup(wiki?.life.flora)}
              placeholder="e.g. Rich"
            />
            <WordCombobox
              label="Sentinels"
              name="sentinels"
              value={draft.sentinels}
              onChange={value => {
                set({ sentinels: value });
              }}
              groups={sentinelGroups}
              trail={<SentinelPill facts={wiki} sentinels={draft.sentinels} />}
              placeholder="e.g. Few"
            />
          </div>
          {sentinelHint && <p className="text-caption text-ink-muted -mt-1">{sentinelHint}</p>}
          <label className={LABEL_FIELD}>
            Temperature
            <span className="relative block">
              <input
                inputMode="decimal"
                maxLength={8}
                pattern="[\-−]?[0-9]+([.,][0-9]+)?"
                autoComplete="off"
                aria-label="Temperature, °C"
                placeholder="−60.8"
                className={`${FIELD} pr-12`}
                {...text('temperature')}
              />
              <span
                aria-hidden="true"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-ink-muted"
              >
                °C
              </span>
            </span>
          </label>
        </Group>

        <Group
          title="Resources it lists"
          caption={draft.resources.length ? `${String(draft.resources.length)} picked` : 'from the ship’s scan'}
        >
          <p className="text-caption text-ink-muted">
            What a scan from your ship lists for this planet. These are the ones the wiki says can be here: this
            biome’s, this star’s metal, deposits and finds. Tap to add or remove.
          </p>
          {choices.map(choice => (
            <div key={choice.group} role="group" aria-label={choice.label} className="flex flex-col gap-1.5">
              <span aria-hidden="true" className="text-label uppercase text-ink-label">
                {choice.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {choice.names.map(name => (
                  <ResourceChip
                    key={name}
                    name={name}
                    on={has(name)}
                    onToggle={() => {
                      toggle(name);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          {others.length > 0 && (
            <div role="group" aria-label="Your other resources" className="flex flex-wrap gap-1.5">
              {others.map(name => (
                <ResourceChip
                  key={name}
                  name={name}
                  on
                  onToggle={() => {
                    toggle(name);
                  }}
                />
              ))}
            </div>
          )}
          <WordCombobox
            label="Another resource"
            hideLabel
            value={another}
            onChange={setAnother}
            onPick={word => {
              if (word.trim() && !has(word)) toggle(word);
              setAnother('');
            }}
            groups={
              codexResources.length
                ? [{ label: 'Codex resources', options: codexResources.map(value => ({ value })) }]
                : []
            }
            placeholder="Another resource…"
          />
        </Group>

        <Group title="Discovery" caption="the top of the scan">
          <label className={LABEL_FIELD}>
            Discovered by
            <input
              maxLength={80}
              autoComplete="off"
              placeholder="A Traveller’s name"
              className={FIELD}
              {...text('discoveredBy')}
            />
          </label>
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
            <label className={LABEL_FIELD}>
              On
              {/* iOS draws date and time fields at their own minimum width, centred: without appearance they fit. */}
              <input
                type="date"
                aria-label="Discovered on"
                className={`${FIELD} min-w-0 block appearance-none text-left`}
                {...text('discoveredOn')}
              />
            </label>
            <label className={LABEL_FIELD}>
              At
              <input
                type="time"
                aria-label="Discovered at"
                className={`${FIELD} min-w-0 block appearance-none text-left font-mono`}
                {...text('discoveredTime')}
              />
            </label>
          </div>
        </Group>

        <label className={LABEL_FIELD}>
          Notes
          <textarea
            rows={3}
            maxLength={1000}
            placeholder="Anything worth coming back for"
            className={`${FIELD} h-auto py-3 leading-relaxed resize-y`}
            {...text('notes')}
          />
        </label>
        {planet && (
          <ArmButton
            label="Delete planet"
            armedLabel="Tap again to delete"
            onConfirm={() => {
              deletePlanet(system.id, planet.id);
              onDone(true);
            }}
          />
        )}
      </div>
      <div className="sticky bottom-0 z-20 border-t border-hairline bg-slate-deep px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] grid grid-cols-[1fr_2fr] gap-2">
        <Button
          size="L"
          onClick={() => {
            onDone(false);
          }}
        >
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          {planet ? 'Save planet' : 'Add planet'}
        </Button>
      </div>
    </form>
  );
}
