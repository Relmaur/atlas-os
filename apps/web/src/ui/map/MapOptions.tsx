// Map options (round 7b, c18): colour the dots by star class, race or bases only; the trail on or off; and the map's
// key, which always matches the colour choice. A sheet over the tab bar on a phone (31j, 31k), a 380px popover
// under the Map options button on the Workbench (d05d). Changes apply as you tap; Reset puts the default back.
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { STAR_CLASSES } from '@atlas/core/systems-model';
import { SheetGrab, useSheetDrag, useSheetOpen } from '../parts/Sheet.tsx';
import {
  changedOptions,
  optionsLabel,
  resetMapOptions,
  setMapOptions,
  setMapOptionsOpen,
  useMapOptions,
  useMapOptionsOpen,
  type MapOptions
} from './map-options-store.ts';
import { OTHER_SYSTEM, RACE_COLOURS } from './map-paint.ts';

const STARS = Object.values(STAR_CLASSES).map(s => s.color);
const close = () => {
  setMapOptionsOpen(false);
};

// Small drawings for the choices and the key (16–40px): dots, never game art.
const Dots = ({ colours, r = 4.5 }: { colours: readonly string[]; r?: number }) => (
  <svg width={colours.length * (r * 2 + 2)} height={r * 2 + 2} aria-hidden="true" className="shrink-0">
    {colours.map((c, k) => (
      <circle key={c} cx={r + 1 + k * (r * 2 + 2)} cy={r + 1} r={r} fill={c} />
    ))}
  </svg>
);
const Hollow = () => (
  <svg width="16" height="16" aria-hidden="true" className="shrink-0">
    <circle cx="8" cy="8" r="5" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
  </svg>
);
const BaseMark = ({ fill = '#facc15' }: { fill?: string }) => (
  <svg width="20" height="20" aria-hidden="true" className="shrink-0">
    <circle cx="10" cy="10" r="5" fill={fill} />
    <circle cx="10" cy="10" r="8.5" fill="none" stroke="#22d3ee" strokeWidth="1.6" />
  </svg>
);
const StackMark = () => (
  <svg width="24" height="20" aria-hidden="true" className="shrink-0">
    <circle cx="8" cy="12" r="5" fill="#facc15" />
    <circle cx="16" cy="7" r="5.5" fill="#0b1325" stroke="#67e8f9" strokeWidth="1" />
    <text
      x="16"
      y="9.6"
      textAnchor="middle"
      fontSize="7.5"
      fontWeight="700"
      fill="#cffafe"
      fontFamily="Inter, sans-serif"
    >
      2
    </text>
  </svg>
);
const PinMark = () => (
  <svg width="20" height="20" aria-hidden="true" className="shrink-0">
    <circle cx="10" cy="10" r="8" fill="#0e7490" fillOpacity=".38" stroke="#67e8f9" strokeWidth="1.3" />
    <text
      x="10"
      y="13"
      textAnchor="middle"
      fontSize="8.5"
      fontWeight="700"
      fill="#ecfeff"
      fontFamily="Inter, sans-serif"
    >
      9
    </text>
  </svg>
);
const TrailMark = () => (
  <svg width="24" height="16" aria-hidden="true" className="shrink-0">
    <path d="M2 12 L9 5 L15 10 L22 4" fill="none" stroke="#fbbf24" strokeOpacity=".8" strokeWidth="1.4" />
  </svg>
);
const RingMark = () => (
  <svg width="22" height="16" aria-hidden="true" className="shrink-0">
    <path d="M2 15 A 18 18 0 0 1 20 3" fill="none" stroke="#94a3b8" strokeOpacity=".6" />
  </svg>
);

const CHOICES: { value: MapOptions['colour']; name: string; about: string; mark: ReactNode }[] = [
  {
    value: 'star',
    name: 'Star class',
    about: 'The star’s colour, as the game shows it.',
    mark: <Dots colours={STARS.slice(0, 4)} />
  },
  {
    value: 'race',
    name: 'Race',
    about: 'Who runs the system: Gek, Korvax or Vy’keen.',
    mark: <Dots colours={Object.values(RACE_COLOURS)} />
  },
  {
    value: 'bases',
    name: 'Bases only',
    about: 'Your bases stand out; everything else goes grey.',
    mark: (
      <span className="inline-flex items-center gap-1">
        <Dots colours={[OTHER_SYSTEM]} r={3} />
        <BaseMark />
        <Dots colours={[OTHER_SYSTEM]} r={3} />
      </span>
    )
  }
];

/** The key: what each mark on the map means, for the colour choice in force (and the trail when it's drawn). */
function Key({ options }: { options: MapOptions }) {
  const rows: [ReactNode, string][] =
    options.colour === 'race'
      ? [
          [<Dots key="g" colours={[RACE_COLOURS.gek]} />, 'Gek'],
          [<Dots key="k" colours={[RACE_COLOURS.korvax]} />, 'Korvax'],
          [<Dots key="v" colours={[RACE_COLOURS.vykeen]} />, 'Vy’keen'],
          [<Hollow key="h" />, 'Race not logged']
        ]
      : options.colour === 'bases'
        ? [[<Dots key="o" colours={[OTHER_SYSTEM]} />, 'Other systems']]
        : [
            [<Dots key="s" colours={STARS} r={3.5} />, 'Star class colours'],
            [<Hollow key="h" />, 'No star class logged']
          ];
  rows.push(
    [<BaseMark key="b" />, 'A base'],
    [<StackMark key="st" />, 'Systems in one region'],
    [<PinMark key="p" />, 'A cluster, at galaxy zoom']
  );
  if (options.trail) rows.push([<TrailMark key="t" />, 'Your trail, in log order']);
  rows.push([<RingMark key="r" />, 'Distance from the core']);
  return (
    <ul className="m-0 p-4 list-none grid grid-cols-2 gap-x-4 gap-y-3 rounded-[18px] bg-panel-glass border border-hairline">
      {rows.map(([mark, label]) => (
        <li key={label} className="flex items-center gap-2.5 min-w-0 text-[14px] text-ink">
          <span className="min-w-7 shrink-0 flex justify-center">{mark}</span>
          <span className="min-w-0">{label}</span>
        </li>
      ))}
    </ul>
  );
}

const Label = ({ id, children }: { id?: string; children: string }) => (
  <h3 id={id} className="m-0 text-[10.5px] font-semibold tracking-[0.16em] uppercase text-ink-label">
    {children}
  </h3>
);

/** `compact`: the desktop popover's smaller title, without the sub (d05d). */
export function MapOptionsBody({ titleId, compact = false }: { titleId: string; compact?: boolean }) {
  const options = useMapOptions();
  const colourId = useId();
  const trailId = useId();
  const changed = changedOptions(options).length > 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2
          id={titleId}
          className={`font-display font-bold text-ink-bright ${compact ? 'text-[17px]' : 'text-[22px]'}`}
        >
          Map options
        </h2>
        {!compact && (
          <p className="m-0 text-sub text-ink-muted">How the map looks on this device. Changes show as you tap.</p>
        )}
      </div>
      <section className="flex flex-col gap-2" aria-labelledby={colourId}>
        <Label id={colourId}>Colour the dots by</Label>
        <div
          role="radiogroup"
          aria-labelledby={colourId}
          className="rounded-[18px] border border-hairline bg-panel-glass overflow-hidden"
        >
          {CHOICES.map(choice => {
            const on = options.colour === choice.value;
            return (
              <label
                key={choice.value}
                className={`flex items-center gap-3 px-4 py-3 border-t border-hairline first:border-t-0 cursor-pointer ${on ? 'bg-[rgba(34,211,238,0.07)]' : ''}`}
              >
                <span className="w-12 shrink-0 grid place-items-center">{choice.mark}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold text-ink-bright">{choice.name}</span>
                  <span className="block text-[13px] text-ink-muted">{choice.about}</span>
                </span>
                <input
                  type="radio"
                  name="mapColour"
                  value={choice.value}
                  checked={on}
                  onChange={() => {
                    setMapOptions({ colour: choice.value });
                  }}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`w-6 h-6 shrink-0 rounded-full border-2 grid place-items-center peer-focus-visible:outline-2 peer-focus-visible:outline-scanner-cyan peer-focus-visible:outline-offset-2 ${on ? 'border-scanner-cyan' : 'border-ink-disabled'}`}
                >
                  {on && <span className="w-3 h-3 rounded-full bg-scanner-cyan" />}
                </span>
              </label>
            );
          })}
        </div>
      </section>
      <section className="flex flex-col gap-2" aria-label="Show">
        <Label>Show</Label>
        <div className="flex items-center gap-3 px-4 py-3 rounded-[18px] border border-hairline bg-panel-glass">
          <span className="w-12 shrink-0 grid place-items-center text-units-amber-pale text-[22px]">
            <i className="ph-bold ph-path" aria-hidden="true" />
          </span>
          <span className="flex-1 min-w-0">
            <span id={trailId} className="block text-[15px] font-semibold text-ink-bright">
              Trail
            </span>
            <span className="block text-[13px] text-ink-muted">
              A line through your systems, in the order you logged them.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={options.trail}
            aria-labelledby={trailId}
            onClick={() => {
              setMapOptions({ trail: !options.trail });
            }}
            className="switch"
          />
        </div>
      </section>
      <section className="flex flex-col gap-2" aria-label="Key">
        <Label>Key</Label>
        <Key options={options} />
      </section>
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 flex items-start gap-1.5 text-[13px] text-ink-muted">
          <i className="ph-bold ph-device-mobile mt-0.5" aria-hidden="true" />
          Saved on this device only, never in your log.
        </p>
        <button
          type="button"
          disabled={!changed}
          onClick={resetMapOptions}
          className="shrink-0 h-11 px-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-quantity-cyan disabled:text-ink-disabled"
        >
          <i className="ph-bold ph-arrow-counter-clockwise" aria-hidden="true" />
          Reset
        </button>
      </div>
    </div>
  );
}

/** 31j/31k: the sheet over the tab bar; the grab bar (tap or drag) and Esc close it. */
export function MapOptionsSheet() {
  const open = useMapOptionsOpen();
  const sheet = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useSheetDrag(sheet, close);
  useSheetOpen(open, close, { layout: '(max-width: 1023px)', focus: sheet });
  return (
    <div className="lg:hidden">
      <div
        onClick={close}
        className={`fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] transition-opacity duration-200 ${open ? '' : 'opacity-0 pointer-events-none'}`}
      />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        className={`fixed z-50 inset-x-0 bottom-0 max-h-[90dvh] flex flex-col rounded-t-sheet border-t border-control-edge bg-[#020617] focus:outline-hidden transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? '' : 'translate-y-full'}`}
      >
        <div data-sheet-grab className="px-5 pt-3">
          <SheetGrab onClose={close} label="Close Map options" />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {open && <MapOptionsBody titleId={titleId} />}
        </div>
      </div>
    </div>
  );
}

/** The phone header's gear (31–31m): a cyan dot when anything differs from the default. */
export function MapOptionsGear() {
  const options = useMapOptions();
  const changed = changedOptions(options).length > 0;
  return (
    <button
      type="button"
      aria-label={optionsLabel(options)}
      aria-haspopup="dialog"
      onClick={() => {
        setMapOptionsOpen(true);
      }}
      className="relative w-[42px] h-[42px] shrink-0 rounded-[12px] border border-control-edge bg-slate-ground text-ink grid place-items-center hover:border-control-edge-hover"
    >
      <i className="ph-bold ph-gear-six text-[18px]" aria-hidden="true" />
      {changed && <OnDot />}
    </button>
  );
}

const OnDot = () => (
  <span
    aria-hidden="true"
    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-scanner-cyan shadow-[0_0_0_2px_#0b1325]"
  />
);

/** d05d: the Map options button in the map pane's header and its 380px popover; Esc and a click outside close it. */
export function MapOptionsButton() {
  const options = useMapOptions();
  const open = useMapOptionsOpen();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const changed = changedOptions(options).length > 0;
  const dismiss = useCallback(() => {
    close();
    button.current?.focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !box.current?.contains(event.target)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, dismiss]);
  return (
    <div ref={box} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        aria-label={optionsLabel(options)}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMapOptionsOpen(!open);
        }}
        className={`relative h-[38px] px-3 rounded-control border inline-flex items-center gap-2 text-[13px] font-semibold ${
          open || changed
            ? 'border-scanner-cyan-edge-strong bg-scanner-cyan-tint text-scanner-cyan-text'
            : 'border-control-edge bg-slate-ground text-ink hover:border-control-edge-hover'
        }`}
      >
        <i className="ph-bold ph-sliders-horizontal" aria-hidden="true" />
        Map options
        {changed && <OnDot />}
      </button>
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="absolute right-0 top-[calc(100%+10px)] z-40 w-[380px] max-h-[calc(100dvh-230px)] overflow-y-auto rounded-panel border border-control-edge bg-[#060b17] p-5 focus:outline-hidden"
        >
          <span
            className="absolute right-5 top-5 h-6 px-1.5 rounded-[6px] border border-control-edge font-mono text-[11px] text-ink-muted grid place-items-center"
            aria-hidden="true"
          >
            Esc
          </span>
          <MapOptionsBody titleId={titleId} compact />
        </div>
      )}
    </div>
  );
}
