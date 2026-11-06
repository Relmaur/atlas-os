// The portal glyphs as names (design round 5, c16 A): the 12 named slots of an address (planet · star system ·
// region), the 4×4 keypad of glyph names, and the address editor that joins them. No glyph is ever drawn: a glyph is
// its name, its second name and its digit, with a link to its wiki page for the real one. Screen readers hear names,
// never digits. Names come from the wiki's Glyph pages (wiki/facts.json → glyphs).
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { GlyphTable } from '@atlas/core/glyphs';
import {
  ADDRESS_LENGTH,
  HEX,
  glyphName,
  glyphOf,
  glyphWikiUrl,
  impossibleGlyphs,
  readGlyphs
} from '@atlas/core/portal';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { showToast } from '../../app/ui.ts';

/** The wiki's glyph table, loading it on first use; null until it's there (or if it can't be). */
export function useGlyphTable(): GlyphTable | null {
  const facts = useFacts();
  useEffect(() => {
    void loadFacts();
  }, []);
  return facts?.glyphs ?? null;
}

/** 12 slots from a stored address: '' where a glyph isn't known. */
export const slotsOf = (address: string, planetUnknown = false): string[] =>
  Array.from({ length: ADDRESS_LENGTH }, (_, i) => (i === 0 && planetUnknown ? '' : (address[i] ?? '')));
export const filled = (slots: readonly string[]): number => slots.filter(Boolean).length;

export const TOOL =
  'h-11 px-3 rounded-control border border-control-edge bg-slate-ground text-[13px] font-semibold text-ink-bright inline-flex items-center justify-center gap-1.5 hover:border-control-edge-hover';

/** A cyan tip box with an info mark (06d, 06f, 35c): how to read the glyphs off the game. */
export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 p-3 rounded-xl border border-scanner-cyan-edge/60 bg-[rgba(34,211,238,0.06)] text-[12.5px] leading-normal text-ink-soft [&_b]:font-semibold [&_b]:text-ink-bright">
      <i className="ph-bold ph-info text-lg text-scanner-cyan-pale shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/** The wiki link a glyph carries: its own target, never inside a button. */
export function GlyphWikiLink({
  table,
  digit,
  className = ''
}: {
  table: GlyphTable | null;
  digit: string;
  className?: string;
}) {
  return (
    <a
      href={glyphWikiUrl(digit)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${glyphName(table, digit)} on the wiki (opens a new tab)`}
      className={`grid place-items-center text-ink-muted hover:text-scanner-cyan-pale ${className}`}
    >
      <i className="ph-bold ph-arrow-square-out" aria-hidden="true" />
    </a>
  );
}

const SLOT_BASE =
  'h-[52px] min-w-0 rounded-[10px] border px-2 flex flex-col justify-center text-left transition-colors duration-[var(--duration-micro)]';

/**
 * The 12 slots, labelled Planet (1) · Star system (2–4) · Region (5–12) as the wiki's Portal address page parts them.
 * With `onSelect` each slot is a button (a filled one is chosen for replacing); without, the address only reads.
 */
export function GlyphSlots({
  slots,
  table,
  current = -1,
  bad = [],
  onSelect,
  planetUnknown = false,
  label
}: {
  slots: readonly string[];
  table: GlyphTable | null;
  /** The slot the next glyph goes into, lit. */
  current?: number;
  /** Slots the wiki says can't be (amber). */
  bad?: readonly number[];
  onSelect?: (index: number) => void;
  /** A Signal Booster's address: glyph 1 reads "? planet", not empty. */
  planetUnknown?: boolean;
  label?: string;
}) {
  const count = filled(slots);
  const said = slots.map((digit, i) =>
    digit ? glyphName(table, digit) : i === 0 && planetUnknown ? 'planet not known' : 'empty'
  );
  const slot = (i: number): ReactNode => {
    const digit = slots[i] ?? '';
    const unknown = !digit && i === 0 && planetUnknown;
    const tone = bad.includes(i)
      ? 'border-units-amber-edge bg-units-amber-tint'
      : unknown
        ? 'border-dashed border-control-edge-hover'
        : digit
          ? 'border-control-edge bg-slate-ground'
          : 'border-dashed border-control-edge';
    const lit = i === current ? 'border-scanner-cyan-glow! shadow-[0_0_0_3px_rgba(34,211,238,0.18)]' : '';
    // A slot's name is its own text: "Glyph 2: Bird, tap to replace". The digit and the slot number are for the eye.
    const body = (
      <>
        <span className="sr-only">{`Glyph ${String(i + 1)}: `}</span>
        {digit ? (
          <span className="block truncate text-xs font-semibold text-ink-bright">{glyphName(table, digit)}</span>
        ) : (
          <>
            <span className="sr-only">{said[i]}</span>
            <span aria-hidden="true" className="block truncate text-xs font-medium text-ink-muted">
              {unknown ? '?' : String(i + 1)}
            </span>
          </>
        )}
        {digit && onSelect && <span className="sr-only">, tap to replace</span>}
        <span aria-hidden="true" className="block font-mono text-[11px] text-ink-muted">
          {digit || (unknown ? 'planet' : '\u200b')}
        </span>
      </>
    );
    return onSelect ? (
      <button
        key={i}
        type="button"
        aria-pressed={i === current}
        onClick={() => {
          onSelect(i);
        }}
        className={`${SLOT_BASE} ${tone} ${lit}`}
      >
        {body}
      </button>
    ) : (
      <div key={i} aria-hidden="true" className={`${SLOT_BASE} ${tone}`}>
        {body}
      </div>
    );
  };
  const heading = 'grid grid-cols-4 gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase text-ink-label';
  return (
    <div role="group" aria-label={label ?? `Portal address, ${String(count)} of 12`} className="flex flex-col gap-1.5">
      {/* Read-only slots are hidden from screen readers: this one line reads the address as names. */}
      {!onSelect && <p className="sr-only">{said.join(', ')}</p>}
      <div aria-hidden="true" className={heading}>
        <span className="border-t border-control-edge pt-1">Planet</span>
        <span className="col-span-3 border-t border-control-edge pt-1">Star system</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">{[0, 1, 2, 3].map(slot)}</div>
      <div aria-hidden="true" className={heading}>
        <span className="col-span-4 border-t border-control-edge pt-1">Region</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">{[4, 5, 6, 7, 8, 9, 10, 11].map(slot)}</div>
    </div>
  );
}

/** The 4×4 keypad in glyph order: name large, second name small, digit in the corner, a wiki link of its own. */
export function GlyphPad({
  table,
  onPick,
  dim = false,
  selected = '',
  verb = 'Add'
}: {
  table: GlyphTable | null;
  onPick: (digit: string) => void;
  /** At 12 of 12 the pad dims (it still replaces a chosen slot). */
  dim?: boolean;
  /** One glyph shown as chosen (the planet's portal glyph, 35c). */
  selected?: string;
  verb?: string;
}) {
  return (
    <div role="group" aria-label="Glyphs" className="grid grid-cols-4 gap-1.5">
      {Array.from(HEX).map(digit => {
        const glyph = glyphOf(table, digit);
        const name = glyph?.name ?? digit;
        const on = selected === digit;
        return (
          <div key={digit} className="relative h-[88px]">
            {/* Its name is its text: "Add Bird, Hunter"; the digit is for the eye. */}
            <button
              type="button"
              aria-pressed={selected ? on : undefined}
              onClick={() => {
                onPick(digit);
              }}
              className={`w-full h-full rounded-xl border px-2 pt-2 pb-[7px] flex flex-col justify-end items-start text-left gap-px transition-colors duration-[var(--duration-micro)] ${
                on
                  ? 'border-scanner-cyan-glow bg-scanner-cyan-tint shadow-[0_0_0_3px_rgba(34,211,238,0.18)]'
                  : dim
                    ? 'border-hairline bg-transparent'
                    : 'border-control-edge bg-slate-ground hover:border-scanner-cyan-edge'
              }`}
            >
              <span
                aria-hidden="true"
                className="absolute left-2 top-[7px] font-mono text-[11px] text-scanner-cyan-pale"
              >
                {digit}
              </span>
              {!on && <span className="sr-only">{`${verb} `}</span>}
              <span className="text-[13.5px] font-semibold leading-tight tracking-tight text-ink-bright">{name}</span>
              {glyph?.alt && <span className="sr-only">, </span>}
              <span className="min-h-6 max-w-full text-[10px] leading-tight text-ink-muted line-clamp-2">
                {glyph?.alt ?? '\u200b'}
              </span>
            </button>
            <GlyphWikiLink
              table={table}
              digit={digit}
              className="absolute right-0 top-0 w-9 h-9 rounded-[0_12px_0_10px]"
            />
          </div>
        );
      })}
    </div>
  );
}

/** "n of 12" with its bar, Backspace and Clear. */
function Progress({ count, onBack, onClear }: { count: number; onBack?: () => void; onClear?: () => void }) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-ink-soft">
      <span className="font-mono text-ink-bright">{`${String(count)} of 12`}</span>
      <span aria-hidden="true" className="flex-1 h-1 rounded-full bg-hairline overflow-hidden">
        <i className="block h-full bg-scanner-cyan-glow" style={{ width: `${String((count / 12) * 100)}%` }} />
      </span>
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Delete last glyph" className={`${TOOL} w-11 px-0`}>
          <i className="ph-bold ph-backspace text-base" aria-hidden="true" />
        </button>
      )}
      {onClear && (
        <button type="button" onClick={onClear} className={TOOL}>
          Clear
        </button>
      )}
    </div>
  );
}

/** What the address's checks say, under the slots: "can't exist" (amber, naming the glyphs) or whole. */
export function AddressNote({ slots, table }: { slots: readonly string[]; table: GlyphTable | null }) {
  const bad = impossibleGlyphs(slots);
  if (bad.length) {
    const first = bad[0] ?? 0;
    const numbers = bad.map(i => String(i + 1));
    const which =
      numbers.length > 1
        ? `Glyphs ${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1) ?? ''}`
        : `Glyph ${numbers[0] ?? ''}`;
    return (
      <p
        role="status"
        className="flex gap-2.5 items-start p-3 rounded-xl border border-units-amber-edge bg-units-amber-tint text-[12.5px] leading-normal text-units-amber-pale"
      >
        <i className="ph-bold ph-warning mt-0.5" aria-hidden="true" />
        <span>
          {`${which} read `}
          <span className="font-mono">{slots.slice(first, (bad.at(-1) ?? first) + 1).join('')}</span>
          {`: ${bad.map(i => glyphName(table, slots[i] ?? '')).join(', ')}. The wiki’s coordinate table has no region there, so check them.`}
        </span>
      </p>
    );
  }
  if (filled(slots) === 12) {
    return (
      <p
        role="status"
        className="flex gap-2.5 items-start p-3 rounded-xl border border-ready-emerald-edge bg-ready-emerald-wash text-[12.5px] leading-normal text-ready-emerald-text"
      >
        <i className="ph-bold ph-check-circle mt-0.5" aria-hidden="true" />
        <span>{`A full address. It reads as ${slots
          .slice(0, 3)
          .map(digit => glyphName(table, digit))
          .join(', ')}…`}</span>
      </p>
    );
  }
  return null;
}

/**
 * Slots, progress and keypad together (06d): a tap fills the lit slot (the first empty one), a filled slot can be
 * chosen to replace, Backspace removes the last, Clear asks nothing and offers Undo. From lg, typing works too:
 * 0–9 and A–F add a glyph, Backspace removes one (design 40).
 */
export function AddressEditor({
  slots,
  onChange,
  table,
  planetUnknown = false
}: {
  slots: string[];
  onChange: (slots: string[]) => void;
  table: GlyphTable | null;
  planetUnknown?: boolean;
}) {
  const [chosen, setChosen] = useState(-1);
  const [said, setSaid] = useState('');
  const liveId = useId();
  const count = filled(slots);
  const firstEmpty = slots.findIndex(digit => !digit);
  const current = chosen >= 0 ? chosen : firstEmpty;
  const put = (digit: string) => {
    if (current < 0) return;
    const next = [...slots];
    next[current] = digit;
    onChange(next);
    setChosen(-1);
    setSaid(`${glyphName(table, digit)} added, ${String(filled(next))} of 12`);
  };
  const back = () => {
    const last = slots.reduce((at, digit, i) => (digit ? i : at), -1);
    if (last < 0) return;
    const next = [...slots];
    next[last] = '';
    onChange(next);
    setChosen(-1);
    setSaid(`Removed, ${String(filled(next))} of 12`);
  };
  const clear = () => {
    if (!count) return;
    const before = [...slots];
    onChange(Array<string>(ADDRESS_LENGTH).fill(''));
    setChosen(-1);
    showToast('Address cleared', {
      action: {
        label: 'Undo',
        run: () => {
          onChange(before);
        }
      }
    });
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
    if (/^[0-9a-f]$/i.test(event.key)) {
      event.preventDefault();
      put(event.key.toUpperCase());
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      back();
    }
  };
  const slotsBlock = (
    <div className="flex flex-col gap-2.5">
      <GlyphSlots
        slots={slots}
        table={table}
        current={current}
        bad={impossibleGlyphs(slots)}
        planetUnknown={planetUnknown}
        onSelect={i => {
          setChosen(i === chosen ? -1 : i);
        }}
      />
      <Progress count={count} onBack={back} onClear={clear} />
      <AddressNote slots={slots} table={table} />
    </div>
  );
  return (
    // Keys typed anywhere in the editor add glyphs (a keyboard at a desk); the pad is there for the mouse and touch.
    // In a wide panel (the desktop editor, 40) the slots sit beside the pad.
    <div onKeyDown={onKey} className="@container">
      <div className="flex flex-col gap-3 @[34rem]:grid @[34rem]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] @[34rem]:gap-4 @[34rem]:items-start">
        {slotsBlock}
        <GlyphPad table={table} onPick={put} dim={current < 0} />
      </div>
      <p id={liveId} aria-live="polite" className="sr-only">
        {said}
      </p>
    </div>
  );
}

/** The text way in (06e, 06g): digits, names or a pasted address; what can't be read is said, never guessed. */
export function GlyphTextField({
  label,
  hint,
  value,
  onChange,
  table,
  id
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (text: string, digits: string[]) => void;
  table: GlyphTable | null;
  id: string;
}) {
  const { rest } = readGlyphs(value, table);
  return (
    <div className="flex flex-col gap-1.5 text-caption text-ink-soft">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        onChange={event => {
          onChange(event.target.value, readGlyphs(event.target.value, table).digits.slice(0, ADDRESS_LENGTH));
        }}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-describedby={`${id}-hint`}
        className="w-full h-11 rounded-control border border-control-edge bg-slate-ground px-3.5 text-base md:text-sm text-ink-bright font-mono tracking-[0.12em] focus:border-scanner-cyan-edge-strong focus:outline-hidden"
      />
      <span id={`${id}-hint`} className="text-[11px] leading-snug text-ink-muted">
        {rest ? `Not a glyph: “${rest}”. ${hint}` : hint}
      </span>
    </div>
  );
}
