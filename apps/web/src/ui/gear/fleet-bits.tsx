// What the Fleet screens share (designs 08, 09, 12): the class pill, the kind's tile and the technology grid with its
// supercharged slots in purple.
import type { ReactNode } from 'react';
import { classLetter, classPill, slotShort, type GearKind } from '@atlas/core/gear';
import { KINDS } from './kinds.ts';

/** Opens a ship, Multi-Tool or Exosuit on its own screen (09). */
export const openGear = (id: string): void => {
  location.hash = `#ship/${encodeURIComponent(id)}`;
};

// S in amber, the rest in slate: S is the one players chase.
export function ClassPill({ value, size = 'S' }: { value: string; size?: 'S' | 'L' }) {
  if (!value.trim()) return null;
  const s = classLetter(value) === 'S' && !value.includes('>');
  const colours = s
    ? 'border-[rgba(252,211,77,0.45)] bg-[rgba(252,211,77,0.1)] text-units-amber-text'
    : 'border-control-edge bg-slate-ground text-ink';
  return size === 'L' ? (
    <span
      className={`inline-flex items-center h-8 px-3.5 rounded-full border font-bold text-[13px] uppercase tracking-[0.12em] ${colours}`}
    >
      {value.trim().length === 1 ? `${value.trim()}-class` : classPill(value)}
    </span>
  ) : (
    <span
      className={`inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-full border font-mono font-bold text-[12px] ${colours}`}
    >
      <span className="sr-only">Class </span>
      {classPill(value)}
    </span>
  );
}

export function KindTile({ kind }: { kind: GearKind }) {
  return (
    <span
      aria-hidden="true"
      className="w-10 h-10 shrink-0 rounded-[12px] grid place-items-center bg-[rgba(34,211,238,0.1)] border border-scanner-cyan-edge text-scanner-cyan-pale"
    >
      <i className={`ph-bold ${KINDS[kind].icon} text-lg`} />
    </span>
  );
}

export const slotKey = (row: number, col: number): string => `R${String(row)}C${String(col)}`;

const CELL = 'aspect-square rounded-[5px] border min-w-0 grid place-items-center overflow-hidden';
export const CELL_OFF = 'bg-slate-ground border-hairline';
export const CELL_ON = 'bg-[rgba(168,85,247,0.32)] border-[#c084fc] shadow-[0_0_6px_rgba(192,132,252,0.55)]';

/** The technology grid as a picture: marked slots glow purple, with the first word of what sits in them. */
export function TechGrid({
  rows,
  cols,
  marked,
  labels = {},
  label,
  gap = 'gap-1',
  codes = false
}: {
  rows: number;
  cols: number;
  marked: string[];
  labels?: Record<string, string>;
  label: string;
  gap?: string;
  /** The Workbench (d09): every slot says its code (R2C3), and a marked one its whole label, over two lines. */
  codes?: boolean;
}) {
  const cells: ReactNode[] = [];
  for (let row = 1; row <= rows; row++)
    for (let col = 1; col <= cols; col++) {
      const key = slotKey(row, col);
      const on = marked.includes(key);
      if (codes) {
        cells.push(
          <span
            key={key}
            title={labels[key]}
            className={`min-w-0 min-h-[52px] rounded-slot border flex flex-col justify-between p-1.5 overflow-hidden ${
              on ? 'bg-[rgba(168,85,247,0.2)] border-[#c084fc]' : CELL_OFF
            }`}
          >
            <span className={`font-mono text-[10px] leading-none ${on ? 'text-[#e9d5ff]' : 'text-ink-label'}`}>
              {key}
            </span>
            {on && labels[key] && (
              <span className="text-[11px] leading-tight text-ink-bright line-clamp-2">{labels[key]}</span>
            )}
          </span>
        );
        continue;
      }
      cells.push(
        <span key={key} className={`${CELL} ${on ? CELL_ON : CELL_OFF}`}>
          {on && labels[key] && (
            <span className="text-[9px] font-semibold leading-none text-[#f3e8ff] truncate px-0.5">
              {slotShort(labels[key])}
            </span>
          )}
        </span>
      );
    }
  return (
    <div
      role="img"
      aria-label={label}
      className={`grid w-full ${gap}`}
      style={{ gridTemplateColumns: `repeat(${String(cols)}, minmax(0, 1fr))` }}
    >
      {cells}
    </div>
  );
}

/** "Supercharged: R2C2 (Infra-Knife), R2C3 and R3C7", or that none are marked. */
export function gridLabel(slots: string[], labels: Record<string, string>): string {
  if (!slots.length) return 'Technology grid: no supercharged slots marked';
  const named = slots.map(slot => (labels[slot] ? `${slot} (${labels[slot]})` : slot));
  return `Supercharged: ${named.length > 1 ? `${named.slice(0, -1).join(', ')} and ${named.at(-1) ?? ''}` : (named[0] ?? '')}`;
}
