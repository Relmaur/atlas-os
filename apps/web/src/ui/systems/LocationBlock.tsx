// The editor's Location block (design 06d–06g, 40; round 5, "Portals"): which galaxy, and the portal address, read
// one of three ways. Photo Mode (the default, for a player who can't use a portal yet): the glyphs in the corner of a
// screenshot, tapped in by name on the keypad, or typed. Signal Booster: its galactic coordinates, converted with the
// wiki's table; they give the system but not the planet, so glyph 1 stays unknown until Photo Mode gives it, never
// guessed. Written down: digits or names, typed or pasted. A whole address shows where it lands on the Map.
import { useEffect, useId } from 'react';
import { getFact } from '@atlas/core/facts';
import {
  formatLightYears,
  galacticToPortal,
  groupGlyphs,
  parsePortal,
  portalToGalactic,
  regionsFromCentre,
  type Voxel
} from '@atlas/core/location';
import { ADDRESS_LENGTH } from '@atlas/core/portal';
import { STAR_CLASSES, type StarClass } from '@atlas/core/systems-model';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { loadGalaxies, useGalaxies } from './galaxies-store.ts';
import { FIELD, LABEL_FIELD } from './editor-parts.tsx';
import {
  AddressEditor,
  GlyphSlots,
  GlyphTextField,
  TOOL,
  Tip,
  filled,
  slotsOf,
  useGlyphTable
} from '../portal/glyph-parts.tsx';

export type LocationWay = 'photo' | 'booster' | 'written';
export const WAYS: [LocationWay, string, string][] = [
  ['photo', 'Photo Mode', 'ph-camera'],
  ['booster', 'Signal Booster', 'ph-broadcast'],
  ['written', 'Written down', 'ph-hash']
];
export interface Location {
  galaxy: string;
  way: LocationWay;
  /** The address glyph by glyph, '' where not known yet (Photo Mode and Written down build it). */
  slots: string[];
  /** What's typed: the booster's coordinates, or digits and names. */
  coords: string;
  text: string;
  /** Photo Mode's "Type or paste instead" (06e). */
  typing: boolean;
}

/** The editor's starting point for a system: its address in slots, read from where it came. */
export function locationOf(
  system: { galaxy: string; glyphs: string; planetGlyphUnknown: boolean },
  way?: LocationWay
): Location {
  const slots = slotsOf(system.glyphs, system.planetGlyphUnknown);
  const booster = way === 'booster' || (!way && system.planetGlyphUnknown);
  return {
    galaxy: system.galaxy,
    way: way ?? (booster ? 'booster' : 'photo'),
    slots,
    coords: booster && system.glyphs ? (portalToGalactic(system.glyphs) ?? '') : '',
    text: system.glyphs && !system.planetGlyphUnknown ? groupGlyphs(system.glyphs) : '',
    typing: false
  };
}

/**
 * The address to store: '' when none is given, null when it isn't whole yet. A booster's address, or one missing
 * only its planet glyph, is stored with glyph 1 as a stand-in (the wiki: the portal sends you to planet 1) and
 * `planetGlyphUnknown`, so it's never shown as a planet.
 */
export function locationGlyphs(location: Location): { glyphs: string; planetGlyphUnknown: boolean } | null {
  if (location.way === 'booster') {
    if (!location.coords.trim()) return { glyphs: '', planetGlyphUnknown: false };
    const planet = location.slots[0] ?? '';
    const glyphs = galacticToPortal(location.coords, planet ? parseInt(planet, 16) : 0);
    return glyphs ? { glyphs, planetGlyphUnknown: !planet } : null;
  }
  const count = filled(location.slots);
  if (!count) return { glyphs: '', planetGlyphUnknown: false };
  if (count === ADDRESS_LENGTH) return { glyphs: location.slots.join(''), planetGlyphUnknown: false };
  if (count === ADDRESS_LENGTH - 1 && !location.slots[0])
    return { glyphs: `0${location.slots.slice(1).join('')}`, planetGlyphUnknown: true };
  return null;
}

/** What a Signal Booster's coordinates give, as slots: the planet stays as it was (unknown unless already read). */
function boosterSlots(location: Location): string[] {
  const glyphs = galacticToPortal(location.coords, 0);
  if (!glyphs) return location.slots;
  return [location.slots[0] ?? '', ...Array.from(glyphs.slice(1))];
}

export function LocationBlock({
  value,
  star,
  onChange
}: {
  value: Location;
  star: StarClass | '';
  onChange: (value: Location) => void;
}) {
  const galaxies = useGalaxies();
  const facts = useFacts();
  const table = useGlyphTable();
  const headingId = useId();
  useEffect(() => {
    void loadGalaxies();
    void loadFacts();
  }, []);

  const stored = locationGlyphs(value);
  const glyphs = stored?.glyphs ?? '';
  const voxel = glyphs ? parsePortal(glyphs) : null;
  const lyPerRegion = getFact(facts, 'region-light-years')?.value;
  const set = (changes: Partial<Location>) => {
    onChange({ ...value, ...changes });
  };
  // Switching way carries the address across, so nothing read is lost.
  const switchWay = (way: LocationWay) => {
    if (way === value.way) return;
    if (way === 'booster') {
      set({ way, coords: value.coords || (glyphs ? (portalToGalactic(glyphs) ?? '') : '') });
      return;
    }
    const slots = value.way === 'booster' && value.coords.trim() ? boosterSlots(value) : value.slots;
    // The text field reads glyphs in order, so it can only show an address that starts at glyph 1.
    set({ way, slots, text: slots[0] ? groupGlyphs(slots.join('')) : '', typing: false });
  };

  const known = galaxies?.find(galaxy => galaxy.name.toLowerCase() === value.galaxy.trim().toLowerCase());
  const booster = value.way === 'booster';
  const boosterGlyphs = booster ? galacticToPortal(value.coords, 0) : null;

  return (
    <section
      id="sysLocation"
      aria-labelledby={headingId}
      className="flex flex-col gap-3 p-3.5 rounded-2xl border border-hairline bg-panel scroll-mt-20"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="font-display font-bold text-[13px] text-ink-bright">
          Location
        </h3>
        <span className="text-[11px] text-ink-muted text-right">Optional · puts this system on your Map</span>
      </div>

      {galaxies ? (
        <label className={LABEL_FIELD}>
          Galaxy
          <span className="relative block">
            <select
              id="sysGalaxy"
              value={known?.name ?? value.galaxy}
              onChange={event => {
                set({ galaxy: event.target.value });
              }}
              className={`${FIELD} appearance-none text-transparent cursor-pointer`}
            >
              {!known && value.galaxy.trim() && <option value={value.galaxy}>{value.galaxy}</option>}
              {galaxies.map(galaxy => (
                <option key={galaxy.n} value={galaxy.name}>
                  {`${galaxy.name} (${String(galaxy.n)})`}
                </option>
              ))}
            </select>
            {/* The select shows what the design's picker button shows; the native list opens on tap. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-between px-3.5 text-base md:text-sm text-ink-bright"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-scanner-cyan-pale shrink-0" />
                <span className="truncate">{known?.name ?? value.galaxy}</span>
              </span>
              <span className="text-caption text-ink-muted shrink-0">
                {known ? `${String(known.n)} of 256 ` : ''}
                <i className="ph-bold ph-caret-down" />
              </span>
            </span>
          </span>
        </label>
      ) : (
        <label className={LABEL_FIELD}>
          Galaxy
          <input
            id="sysGalaxy"
            maxLength={40}
            placeholder="Euclid"
            value={value.galaxy}
            onChange={event => {
              set({ galaxy: event.target.value });
            }}
            className={FIELD}
          />
        </label>
      )}

      <div className="flex flex-col gap-1.5">
        <p id={`${headingId}-way`} className="text-caption text-ink-soft">
          Where did you read it?
        </p>
        <div role="radiogroup" aria-labelledby={`${headingId}-way`} className="grid grid-cols-3 gap-1.5">
          {WAYS.map(([way, label, icon]) => {
            const on = value.way === way;
            return (
              <button
                key={way}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  switchWay(way);
                }}
                className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-semibold ${
                  on
                    ? 'border-ready-emerald-edge bg-ready-emerald-tint text-ready-emerald-bright'
                    : 'border-control-edge bg-slate-ground text-ink-soft hover:text-ink-bright'
                }`}
              >
                <i className={`ph-bold ${icon} text-xl`} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {value.way === 'photo' && (
        <>
          <Tip>
            Open <b>Photo Mode</b> on the planet. The glyphs sit in the <b>bottom-left corner</b>. They only show in a
            screenshot from your console or PC, not the in-game camera. <b>Read them left to right</b> and tap each one
            below.
          </Tip>
          {value.typing ? (
            <>
              <GlyphSlots slots={value.slots} table={table} current={value.slots.findIndex(digit => !digit)} />
              <GlyphTextField
                id="sysAddress"
                label="Type glyph names or digits"
                hint="Digits, names (“face bird voxel…”) or a pasted address all work. Spaces are optional."
                value={value.text}
                table={table}
                onChange={(text, digits) => {
                  set({ text, slots: slotsOf(digits.join('')) });
                }}
              />
              <button
                type="button"
                onClick={() => {
                  set({ typing: false });
                }}
                className={`${TOOL} self-start`}
              >
                <i className="ph-bold ph-squares-four" aria-hidden="true" />
                Back to the glyph pad
              </button>
            </>
          ) : (
            <>
              <AddressEditor
                slots={value.slots}
                table={table}
                onChange={slots => {
                  set({ slots });
                }}
              />
              <button
                type="button"
                onClick={() => {
                  set({ typing: true, text: value.slots.join('') });
                }}
                className={`${TOOL} self-start`}
              >
                <i className="ph-bold ph-keyboard" aria-hidden="true" />
                Type or paste instead
              </button>
            </>
          )}
        </>
      )}

      {booster && (
        <>
          <Tip>
            <b>Signal Booster</b> shows the system’s galactic coordinates. Type them as they appear. They give the
            system, not the planet: the planet’s glyph comes from Photo Mode.
          </Tip>
          <label className={LABEL_FIELD}>
            Galactic coordinates
            <input
              id="sysAddress"
              name="coords"
              maxLength={30}
              placeholder="HUKYA:046A:0081:0D6D:0038"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={value.coords}
              onChange={event => {
                set({ coords: event.target.value });
              }}
              className={`${FIELD} font-mono uppercase tracking-[0.04em] ${boosterGlyphs ? 'border-ready-emerald-edge' : ''}`}
            />
          </label>
          {boosterGlyphs && (
            <>
              <p
                id="sysAddressConverted"
                className="flex items-center gap-2 px-2.5 py-2 rounded-[10px] border border-dashed border-control-edge bg-slate-ground text-caption"
              >
                <span className="text-ink-muted">As a portal address</span>
                <b className="ml-auto font-mono font-medium tracking-[0.06em] text-scanner-cyan-text">
                  {groupGlyphs(`${value.slots[0] || '?'}${boosterGlyphs.slice(1)}`)}
                </b>
              </p>
              <GlyphSlots slots={boosterSlots(value)} table={table} planetUnknown />
              {!value.slots[0] && (
                <div className="flex gap-2.5 items-start p-3 rounded-xl border border-hairline bg-panel text-[12.5px] leading-normal text-ink-soft">
                  <i className="ph-bold ph-info mt-0.5 text-ink-muted" aria-hidden="true" />
                  <div className="flex-1">
                    <b className="text-ink-bright">Planet not known.</b> The system is enough for your Map. Add the
                    planet’s glyph from Photo Mode when you can.
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          switchWay('photo');
                        }}
                        className="h-10 px-3.5 rounded-control border border-scanner-cyan-edge bg-scanner-cyan-tint text-[13px] font-semibold text-scanner-cyan-text inline-flex items-center gap-1.5"
                      >
                        <i className="ph-bold ph-camera" aria-hidden="true" />
                        Add from Photo Mode
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <p className="m-0 text-[11px] text-ink-muted">
            Conversion: the wiki’s Portal address table (Galactic Coordinates System).
          </p>
        </>
      )}

      {value.way === 'written' && (
        <>
          <GlyphTextField
            id="sysAddress"
            label="Portal address"
            hint="12 characters, 0–9 and A–F, or the glyph names. Paste works too."
            value={value.text}
            table={table}
            onChange={(text, digits) => {
              set({ text, slots: slotsOf(digits.join('')) });
            }}
          />
          <GlyphSlots slots={value.slots} table={table} current={value.slots.findIndex(digit => !digit)} />
        </>
      )}

      {glyphs && voxel && (
        <MapPreview
          voxel={voxel}
          galaxy={known?.name ?? (value.galaxy.trim() || 'Euclid')}
          star={star}
          distance={lyPerRegion ? formatLightYears(regionsFromCentre(voxel), lyPerRegion) : null}
        />
      )}
    </section>
  );
}

// A fixed field of faint stars in two spiral arms, seeded so it never changes between renders or devices.
const W = 326;
const H = 110;
const CX = W / 2;
const CY = H / 2;
const RX = 100; // the galaxy's radius across, in the preview's units
const RY = 48; // and up and down: the disc is seen at a tilt
const FIELD_STARS = (() => {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 320 }, (_, i) => {
    const r = Math.pow(random(), 0.75) * 0.96;
    const angle = (i % 2) * Math.PI + r * 3 + (random() + random() - 1) * 0.8;
    return {
      x: CX + Math.cos(angle) * r * RX,
      y: CY + Math.sin(angle) * r * RY,
      opacity: 0.22 + (1 - r) * 0.24
    };
  });
})();

function MapPreview({
  voxel,
  galaxy,
  star,
  distance
}: {
  voxel: Voxel;
  galaxy: string;
  star: StarClass | '';
  distance: string | null;
}) {
  // A galaxy's portal network reaches 2,048 regions from the centre (the wiki's Portal address page); seen from
  // above, east is right and south is down.
  const x = CX + (voxel.x / 2048) * RX;
  const y = CY + (voxel.z / 2048) * RY;
  const colour = star ? STAR_CLASSES[star].color : '#fcd34d';
  const where = distance ? `${distance} from the centre of ${galaxy}` : `in ${galaxy}`;
  return (
    <figure id="sysMapPreview" className="m-0 rounded-xl overflow-hidden border border-hairline bg-[#050811]">
      <svg
        width="100%"
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        role="img"
        aria-label={`Preview: this system sits ${where}`}
        className="block"
      >
        {FIELD_STARS.map((dot, i) => (
          <circle key={i} cx={dot.x} cy={dot.y} r={0.6} fill="#67e8f9" fillOpacity={dot.opacity} />
        ))}
        <circle cx={CX} cy={CY} r={2.4} fill="#fff7d6" />
        <circle cx={x} cy={y} r={4} fill={colour} />
        <circle cx={x} cy={y} r={9} fill="none" stroke={colour} strokeOpacity={0.6} />
      </svg>
      <figcaption className="flex justify-between gap-3 px-2.5 py-1.5 border-t border-hairline text-[11px] text-ink-soft">
        <span>Lands here on your Map</span>
        {distance && <span className="font-mono text-units-amber-text">{distance} from the centre</span>}
      </figcaption>
    </figure>
  );
}
