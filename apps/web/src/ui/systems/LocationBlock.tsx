// The editor's Location block (design 06): which galaxy, and where in it, from a portal address or the galactic
// coordinates a signal booster shows. Either format converts to the other as it's typed (the wiki's rule, in
// @atlas/core/location), and a valid address shows where it lands on the Map, in light years from the centre when
// the cited region size is available.
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
import { STAR_CLASSES, normalizeGlyphs, type StarClass } from '@atlas/core/systems-model';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { loadGalaxies, useGalaxies } from './galaxies-store.ts';
import { FIELD, LABEL_FIELD, Segments } from './editor-parts.tsx';
import { GlyphPlate } from './GlyphPlate.tsx';

export type AddressFormat = 'portal' | 'galactic';
export interface Location {
  galaxy: string;
  format: AddressFormat;
  /** What's in the address field, as typed. */
  address: string;
  /** The planet index kept from the stored address: galactic coordinates can't hold one. */
  planet: number;
}

/** The stored portal address for what's typed: '' when empty, null when it isn't a whole address yet. */
export function locationGlyphs(location: Location): string | null {
  if (!location.address.trim()) return '';
  if (location.format === 'portal') {
    const glyphs = normalizeGlyphs(location.address);
    return glyphs.length === 12 ? glyphs : null;
  }
  return galacticToPortal(location.address, location.planet);
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
  const headingId = useId();
  useEffect(() => {
    void loadGalaxies();
    void loadFacts();
  }, []);

  const glyphs = locationGlyphs(value);
  const voxel = glyphs ? parsePortal(glyphs) : null;
  const lyPerRegion = getFact(facts, 'region-light-years')?.value;
  const set = (changes: Partial<Location>) => {
    onChange({ ...value, ...changes });
  };
  // Switching format carries a whole address across, so nothing typed is lost.
  const switchFormat = (format: string) => {
    if (format !== 'portal' && format !== 'galactic') return;
    if (format === value.format) return;
    const address = glyphs ? (format === 'portal' ? groupGlyphs(glyphs) : (portalToGalactic(glyphs) ?? '')) : '';
    set({ format, address });
  };

  const known = galaxies?.find(galaxy => galaxy.name.toLowerCase() === value.galaxy.trim().toLowerCase());
  const portal = value.format === 'portal';

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 p-3.5 rounded-2xl border border-hairline bg-panel"
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

      <Segments
        label="Address format"
        hideLabel
        value={value.format}
        onChange={switchFormat}
        options={[
          ['portal', 'Portal address'],
          ['galactic', 'Galactic coordinates']
        ]}
      />

      <div className={LABEL_FIELD}>
        <label htmlFor="sysAddress">{portal ? 'Portal address' : 'Galactic coordinates'}</label>
        <span className="relative block">
          <input
            id="sysAddress"
            name={portal ? 'glyphs' : 'coords'}
            maxLength={portal ? 16 : 30}
            placeholder={portal ? '0123 4567 89AB' : '046A:0081:0D6D:0038'}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${headingId}-hint`}
            value={value.address}
            onChange={event => {
              set({ address: event.target.value });
            }}
            className={`${FIELD} pr-10 font-mono uppercase tracking-[0.2em] ${glyphs ? 'border-ready-emerald-edge' : ''}`}
          />
          {glyphs && (
            <i
              aria-hidden="true"
              className="ph-bold ph-check absolute right-3.5 top-1/2 -translate-y-1/2 text-ready-emerald-text"
            />
          )}
        </span>
        <span id={`${headingId}-hint`} className="text-[11px] leading-snug text-ink-muted">
          {portal
            ? '12 characters, 0–9 and A–F, typed from the portal glyphs on the Discoveries page. Or switch to the coordinates a signal booster shows.'
            : 'The four groups a signal booster shows, like 046A:0081:0D6D:0038. Its letters in front can stay.'}
        </span>
      </div>

      {/* As it's typed, so a slip ("Bird, Bird, Face…") is easy to spot before the address is whole. */}
      {(portal ? normalizeGlyphs(value.address) : glyphs) && (
        <GlyphPlate glyphs={portal ? normalizeGlyphs(value.address).slice(0, 12) : (glyphs ?? '')} credit="text" />
      )}

      {glyphs && voxel && (
        <>
          <p
            id="sysAddressConverted"
            className="flex items-center gap-2 px-2.5 py-2 rounded-[10px] border border-dashed border-control-edge bg-slate-ground text-caption"
          >
            <span className="text-ink-muted">
              {portal ? 'Same place in galactic coordinates' : 'Same place as a portal address'}
            </span>
            <b className="ml-auto font-mono font-medium tracking-[0.06em] text-scanner-cyan-text">
              {portal ? portalToGalactic(glyphs) : groupGlyphs(glyphs)}
            </b>
          </p>
          <MapPreview
            voxel={voxel}
            galaxy={known?.name ?? (value.galaxy.trim() || 'Euclid')}
            star={star}
            distance={lyPerRegion ? formatLightYears(regionsFromCentre(voxel), lyPerRegion) : null}
          />
        </>
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
