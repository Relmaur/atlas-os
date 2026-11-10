// Small pieces of a system's look, shared by screens: star colour, glyphs, tags, wealth, outlaw status.
import type { ReactNode } from 'react';
import { OUTLAW_TAG, STAR_CLASSES, type OutlawStatus, type System } from '@atlas/core/systems-model';
import type { MetaPart } from '@atlas/core/systems-list';
import { showToast } from '../../app/ui.ts';
import { ConflictText } from './Conflict.tsx';

// Falls back to showing the glyphs when the clipboard is unavailable (no permission, or not a secure context).
export function copyGlyphs(glyphs: string): void {
  ('clipboard' in navigator ? navigator.clipboard.writeText(glyphs) : Promise.reject(new Error('no clipboard')))
    .then(() => {
      showToast(`Copied glyphs ${glyphs}.`);
    })
    .catch(() => {
      showToast(glyphs);
    });
}

export function StarDot({ system, size = 'w-3 h-3' }: { system: System; size?: string }) {
  const star = system.star ? STAR_CLASSES[system.star] : undefined;
  return (
    <span
      className={`${size} shrink-0 rounded-full ${star ? '' : 'border border-dashed border-slate-600'}`}
      style={star ? { background: star.color, boxShadow: `0 2px 8px -1px ${star.color}88` } : undefined}
      title={star?.label ?? 'Star colour unknown'}
    />
  );
}

export function GlyphChip({ glyphs }: { glyphs: string }) {
  if (!glyphs) return null;
  return (
    <button
      type="button"
      onClick={event => {
        event.stopPropagation();
        copyGlyphs(glyphs);
      }}
      title="Copy portal glyphs"
      className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md bg-slate-950 border border-slate-700 hover:border-slate-500 font-mono text-[11px] tracking-wider text-slate-200"
    >
      {glyphs}
      <i className="ph-bold ph-copy text-slate-400" />
    </button>
  );
}

// A plain label, or a button when `onClick` is given (the panel's tags filter the Systems list).
export function TagChip({ tag, onClick }: { tag: string; onClick?: () => void }) {
  const tone =
    tag === OUTLAW_TAG
      ? 'bg-red-500/10 border-red-500/30 text-red-200'
      : 'bg-slate-900 border-slate-700 text-slate-300';
  const className = `inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-medium ${tone}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} hover:border-slate-500`}>
      {tag}
    </button>
  ) : (
    <span className={className}>{tag}</span>
  );
}

export function WealthStars({ wealth }: { wealth: number }) {
  if (!wealth) return null;
  return (
    <span className="text-amber-300" title={`Wealth ${wealth}/3`}>
      {'★'.repeat(wealth)}
      <span className="text-slate-600">{'★'.repeat(3 - wealth)}</span>
    </span>
  );
}

// The summary line under a system's name: "Region · Galaxy · Gek · Trading ★★ · ★★ Rowdy" (the conflict as the game
// shows it, c22). Adjacent text is emitted as one string, so the browser shapes (kerns) it as a single run.
export function MetaLine({ parts }: { parts: MetaPart[] }) {
  const out: ReactNode[] = [];
  let text = '';
  parts.forEach((part, i) => {
    if (part.conflict) {
      out.push(`${text}${i ? ' · ' : ''}`, <ConflictText key={i} reading={part.conflict} />);
      text = '';
      return;
    }
    text += `${i ? ' · ' : ''}${part.text}${part.text && part.wealth ? ' ' : ''}`;
    if (part.wealth) {
      out.push(text, <WealthStars key={i} wealth={part.wealth} />);
      text = '';
    }
  });
  if (text) out.push(text);
  return out;
}

const PILL_TONES = {
  new: 'bg-cyan-500/10 text-cyan-200 border-cyan-500/30',
  ready: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30',
  wait: 'bg-amber-500/10 text-amber-200 border-amber-500/30'
};
const PILL_ICONS = { new: 'ph-sparkle', ready: 'ph-check-circle', wait: 'ph-hourglass-medium' };

export function OutlawPill({ status }: { status: OutlawStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[11px] font-medium whitespace-nowrap shrink-0 ${PILL_TONES[status.tone]}`}
    >
      <i className={`ph-bold ${PILL_ICONS[status.tone]}`} />
      {status.label}
    </span>
  );
}
