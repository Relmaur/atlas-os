// A planet's scan: the fields of the planet sheet that copy what the game shows (the discovery panel and the scan
// tooltip), and the short read-out in the planet's row. The words to offer come from the wiki (wiki/facts.json →
// planets); every field still takes the player's own words, which are kept exactly as typed. Temperature, the
// resources level and the discoverer are the player's entries: the wiki can't know them (ADR-0003).
import { useId, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import {
  SENTINEL_LEVELS,
  biomeFor,
  sentinelLevel,
  sentinelWords,
  weatherClass,
  weatherWords,
  type PlanetFacts,
  type SentinelLevel,
  type WeatherClass
} from '@atlas/core/planets';
import { BIOMES, PLANET_BODIES, type Planet } from '@atlas/core/systems-model';
import { wikiEntries } from '../shell/wiki-index.ts';
import { FIELD, LABEL_FIELD, Segments } from './editor-parts.tsx';

const WEATHER_LABELS: Record<WeatherClass, string> = {
  clear: 'Clear, no storms',
  normal: 'Normal',
  extreme: 'Extreme',
  other: ''
};
// Severity reads from the wiki's own words: extreme weather and aggressive sentinels in the alert colour.
const toneOf = (tone: 'calm' | 'warn' | 'alert') =>
  tone === 'alert'
    ? 'text-[#fca5a5] bg-[rgba(239,68,68,0.12)] border-[rgba(248,113,113,0.4)]'
    : tone === 'warn'
      ? 'text-[#fcd34d] bg-[rgba(245,158,11,0.12)] border-[rgba(251,191,36,0.4)]'
      : 'text-ink-soft bg-slate-ground border-hairline';
const weatherTone = (cls: WeatherClass): 'calm' | 'warn' | 'alert' =>
  cls === 'extreme' ? 'alert' : cls === 'normal' ? 'warn' : 'calm';
const sentinelTone = (level: SentinelLevel): 'calm' | 'warn' | 'alert' =>
  level === 'aggressive' || level === 'corrupted' ? 'alert' : level === 'high' ? 'warn' : 'calm';

function Pill({ tone, children }: { tone: 'calm' | 'warn' | 'alert'; children: string }) {
  return (
    <span
      className={`inline-flex items-center h-[22px] px-2 rounded-full border text-[11px] font-semibold ${toneOf(tone)}`}
    >
      {children}
    </span>
  );
}

function WordField({
  label,
  name,
  value,
  initial,
  onChange,
  options,
  placeholder,
  hint
}: {
  label: string;
  name: string;
  /** Controlled when given; otherwise the field starts at `initial` and is read from the form. */
  value?: string;
  initial?: string;
  onChange?: (value: string) => void;
  options: string[];
  placeholder?: string;
  hint?: ReactNode;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  // The hint sits outside the label: it describes the field, it isn't part of its name.
  return (
    <div className={LABEL_FIELD}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-describedby={hint ? hintId : undefined}
        name={name}
        list={options.length ? listId : undefined}
        maxLength={80}
        autoComplete="off"
        {...(value === undefined
          ? { defaultValue: initial }
          : {
              value,
              onChange: (event: ChangeEvent<HTMLInputElement>) => {
                onChange?.(event.target.value);
              }
            })}
        placeholder={placeholder}
        className={FIELD}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map(option => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
      {hint && (
        <span id={hintId} className="flex flex-wrap items-center gap-1.5">
          {hint}
        </span>
      )}
    </div>
  );
}

/** The resources the scan lists, as chips; Enter or a comma adds one. */
function ResourceList({
  items,
  onItems,
  biome
}: {
  items: string[];
  onItems: (items: string[]) => void;
  /** The biome's own resources, from its wiki page: offered first, and as one-tap chips. */
  biome: { name: string; resources: string[] } | null;
}) {
  const [typed, setTyped] = useState('');
  const inputId = useId();
  const listId = useId();
  const own = biome?.resources ?? [];
  const names = [
    ...own,
    ...wikiEntries()
      .filter(entry => entry.category === 'resources' && !own.includes(entry.title))
      .map(entry => entry.title)
      .sort()
  ];
  const missing = own.filter(name => !items.some(item => item.toLowerCase() === name.toLowerCase()));
  const add = (value: string) => {
    const name = value.trim();
    if (name && !items.some(item => item.toLowerCase() === name.toLowerCase()) && items.length < 12)
      onItems([...items, name]);
    setTyped('');
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (typed.trim()) add(typed);
    } else if (event.key === 'Backspace' && !typed && items.length) onItems(items.slice(0, -1));
  };
  return (
    <div className={LABEL_FIELD}>
      <label htmlFor={inputId}>Resources the scan lists</label>
      {/* A resource typed but not yet added still counts on Save. */}
      <input type="hidden" name="resources" value={[...items, typed.trim()].filter(Boolean).join(',')} />
      {biome && missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-caption text-ink-muted">{`${biome.name} worlds have:`}</span>
          {missing.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => {
                // Not add(): a word half-typed in the field stays there.
                if (items.length < 12) onItems([...items, name]);
              }}
              aria-label={`Add ${name}`}
              className="inline-flex items-center gap-1 h-[30px] px-2.5 rounded-full border border-dashed border-control-edge text-[13px] text-ink-soft hover:text-ink-bright hover:border-scanner-cyan-edge"
            >
              <i className="ph-bold ph-plus text-[10px]" aria-hidden="true" />
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 min-h-11 p-1.5 rounded-control bg-slate-ground border border-control-edge focus-within:border-scanner-cyan-edge-strong">
        {items.map(item => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 h-[30px] pl-2.5 pr-1.5 rounded-full bg-scanner-cyan-tint border border-scanner-cyan-edge text-[13px] font-medium text-[#a5f3fc]"
          >
            {item}
            <button
              type="button"
              onClick={() => {
                onItems(items.filter(other => other !== item));
              }}
              aria-label={`Remove ${item}`}
              className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-scanner-cyan-edge"
            >
              <i className="ph-bold ph-x text-[10px]" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          type="text"
          list={listId}
          maxLength={80}
          autoComplete="off"
          value={typed}
          onChange={event => {
            setTyped(event.target.value);
          }}
          onKeyDown={onKey}
          onBlur={() => {
            if (typed.trim()) add(typed);
          }}
          placeholder={items.length ? 'Add another' : 'Copper, then Enter'}
          className="flex-1 min-w-[8rem] h-8 bg-transparent px-1.5 text-base md:text-sm text-ink-bright placeholder:text-ink-disabled focus:outline-hidden"
        />
        <datalist id={listId}>
          {names.map(name => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

/** The scan's fields in the planet sheet. Uncontrolled by the sheet: they're read from the form on Save. */
export function PlanetScanFields({ planet, facts }: { planet: Planet | undefined; facts: PlanetFacts | null }) {
  const [descriptor, setDescriptor] = useState(planet?.descriptor ?? '');
  const [biome, setBiome] = useState(planet?.biome ?? '');
  // The biome follows the prefix only while the player hasn't chosen one themselves.
  const [biomeChosen, setBiomeChosen] = useState(Boolean(planet?.biome));
  const [body, setBody] = useState<string>(planet?.body ?? '');
  const [weather, setWeather] = useState(planet?.weather ?? '');
  const [sentinels, setSentinels] = useState(planet?.sentinels ?? '');
  const [resources, setResources] = useState(planet?.resources ?? []);

  const biomes = facts ? facts.biomes.map(entry => entry.name) : BIOMES;
  const descriptors = facts ? [...new Set(facts.biomes.flatMap(entry => entry.descriptors))].sort() : [];
  const fromPrefix = biomeFor(facts, descriptor);
  const prefixBiomes = facts?.biomes.filter(entry =>
    entry.descriptors.some(name => name.toLowerCase() === descriptor.trim().toLowerCase())
  );
  const cls = weatherClass(facts, biome, weather);
  const level = sentinelLevel(facts, sentinels);
  const life = facts?.life;

  return (
    <fieldset className="flex flex-col gap-4 border-t border-hairline pt-4">
      <legend className="sr-only">From the scan</legend>
      <p aria-hidden="true" className="text-label uppercase text-ink-label -mb-1">
        From the scan
      </p>
      <WordField
        label="Description"
        name="descriptor"
        value={descriptor}
        onChange={value => {
          setDescriptor(value);
          const match = biomeFor(facts, value);
          if (match && !biomeChosen) setBiome(match.name);
        }}
        options={descriptors}
        placeholder="e.g. Frostbound"
        hint={
          fromPrefix ? (
            <span className="text-caption text-ink-muted">A {fromPrefix.name} world, by the wiki’s list.</span>
          ) : prefixBiomes && prefixBiomes.length > 1 ? (
            <span className="text-caption text-ink-muted">
              Used by {prefixBiomes.map(entry => entry.name).join(', ')}: pick the biome below.
            </span>
          ) : undefined
        }
      />
      <Segments
        label="Planet or moon"
        value={body}
        options={Object.entries(PLANET_BODIES)}
        onChange={setBody}
        clearable
      />
      <input type="hidden" name="body" value={body} />
      <WordField
        label="Biome"
        name="biome"
        value={biome}
        onChange={value => {
          setBiome(value);
          setBiomeChosen(Boolean(value.trim()));
        }}
        options={biomes}
        placeholder="e.g. Frozen"
      />
      <WordField
        label="Weather"
        name="weather"
        value={weather}
        onChange={setWeather}
        options={weatherWords(facts, biome)}
        placeholder="e.g. Icy Blasts"
        hint={
          cls && cls !== 'other' ? <Pill tone={weatherTone(cls)}>{`${WEATHER_LABELS[cls]} weather`}</Pill> : undefined
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <WordField
          label="Resources"
          name="abundance"
          initial={planet?.abundance ?? ''}
          options={[]}
          placeholder="e.g. Uncommon"
        />
        <WordField
          label="Sentinels"
          name="sentinels"
          value={sentinels}
          onChange={setSentinels}
          options={sentinelWords(facts)}
          placeholder="e.g. Few"
          hint={level ? <Pill tone={sentinelTone(level)}>{SENTINEL_LEVELS[level]}</Pill> : undefined}
        />
        <WordField
          label="Fauna"
          name="fauna"
          initial={planet?.fauna ?? ''}
          options={life?.fauna ?? []}
          placeholder="e.g. Abundant"
        />
        <WordField
          label="Flora"
          name="flora"
          initial={planet?.flora ?? ''}
          options={life?.flora ?? []}
          placeholder="e.g. Uncommon"
        />
      </div>
      <ResourceList
        items={resources}
        onItems={setResources}
        biome={(() => {
          const entry = biomeFor(facts, biome);
          return entry ? { name: entry.name, resources: entry.resources ?? [] } : null;
        })()}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <label className={LABEL_FIELD}>
          Temperature, °C
          <input
            name="temperature"
            inputMode="decimal"
            maxLength={8}
            pattern="-?[0-9]+([.,][0-9]+)?"
            defaultValue={planet?.temperature ?? ''}
            placeholder="-60.8"
            className={FIELD}
          />
        </label>
        <label className={LABEL_FIELD}>
          Discovered on
          {/* iOS draws a date field at its own minimum width and centred: without appearance it fits its column. */}
          <input
            name="discoveredOn"
            type="date"
            defaultValue={planet?.discoveredOn ?? ''}
            className={`${FIELD} min-w-0 block appearance-none text-left`}
          />
        </label>
      </div>
      <label className={LABEL_FIELD}>
        Discovered by
        <input
          name="discoveredBy"
          maxLength={80}
          autoComplete="off"
          defaultValue={planet?.discoveredBy ?? ''}
          className={FIELD}
        />
      </label>
    </fieldset>
  );
}

/** One line of what the scan said, for the planet's row: "Frostbound Planet · Icy Blasts · Few · −60.8 °C". */
export function planetScanLine(planet: Planet): string {
  const kind = [planet.descriptor, planet.body ? PLANET_BODIES[planet.body] : ''].filter(Boolean).join(' ');
  const temperature = planet.temperature === null ? '' : `${String(planet.temperature).replace('-', '−')} °C`;
  return [kind || planet.biome, planet.weather, temperature].filter(Boolean).join(' · ');
}

/** The pills a planet earns from the wiki's words: its weather's severity and its sentinels' level. */
export function PlanetScanPills({ planet, facts }: { planet: Planet; facts: PlanetFacts | null }) {
  const cls = weatherClass(facts, planet.biome, planet.weather);
  const level = sentinelLevel(facts, planet.sentinels);
  const showWeather = cls === 'extreme';
  const showSentinels = level === 'aggressive' || level === 'corrupted';
  if (!showWeather && !showSentinels) return null;
  return (
    <span className="flex flex-wrap gap-1 mt-1">
      {showWeather && <Pill tone="alert">Extreme weather</Pill>}
      {showSentinels && <Pill tone="alert">{`${SENTINEL_LEVELS[level]} sentinels`}</Pill>}
    </span>
  );
}
