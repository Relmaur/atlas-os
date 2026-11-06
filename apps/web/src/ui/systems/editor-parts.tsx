// Form parts of the system editor (design 06): fields, labels, segmented tracks and tags. The note editor (11) uses
// them too.
import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { tagSlug } from '@atlas/core/systems-model';

export const FIELD =
  'w-full h-11 rounded-control border border-control-edge bg-slate-ground px-3.5 text-base md:text-sm text-ink-bright placeholder:text-ink-disabled focus:border-scanner-cyan-edge-strong focus:outline-hidden';
export const LABEL_FIELD = 'flex flex-col gap-1.5 text-caption text-ink-soft';

export type Option = [value: string, label: string, extra?: ReactNode, name?: string];

/**
 * One choice of a few, as segments in a track. With `clearable`, tapping the chosen segment again clears it: the
 * design has no "Unknown" segment for these, and an unknown value must stay possible.
 */
export function Segments({
  label,
  hideLabel = false,
  value,
  options,
  onChange,
  clearable = false,
  rows = 1
}: {
  label: string;
  hideLabel?: boolean;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  clearable?: boolean;
  rows?: number;
}) {
  const labelId = useId();
  const perRow = Math.ceil(options.length / rows);
  const tracks = Array.from({ length: rows }, (_, row) => options.slice(row * perRow, (row + 1) * perRow));
  return (
    <div className="flex flex-col gap-1.5">
      <p id={labelId} className={hideLabel ? 'sr-only' : 'text-caption text-ink-soft'}>
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-2">
        {tracks.map((track, row) => (
          <div key={row} className="flex gap-1 p-1 rounded-control bg-slate-ground border border-hairline">
            {track.map(([key, text, extra, name]) => {
              const on = value === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={name}
                  onClick={() => {
                    onChange(on && clearable ? '' : key);
                  }}
                  className={`flex-1 min-w-0 h-9 px-1 rounded-segment flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-colors ${
                    on
                      ? 'bg-[rgba(16,185,129,0.18)] text-[#d1fae5] shadow-[inset_0_0_0_1px_rgba(52,211,153,0.45)]'
                      : 'text-ink-soft hover:text-ink-bright'
                  }`}
                >
                  {extra}
                  <span className="truncate tracking-tight">{text}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Tags as removable chips with a field to type the next one (Enter or a comma adds it, Backspace on an empty field
 * removes the last). `typed` is the caller's, so a tag typed but not yet added can still count on Save.
 */
export function TagEditor({
  tags,
  onTags,
  typed,
  onTyped,
  max = Infinity,
  labelClass
}: {
  tags: string[];
  onTags: (tags: string[]) => void;
  typed: string;
  onTyped: (typed: string) => void;
  max?: number;
  /** A note's inspector (d10) titles it like its other sections. */
  labelClass?: string;
}) {
  const add = (value: string) => {
    const tag = tagSlug(value);
    if (tag && !tags.includes(tag) && tags.length < max) onTags([...tags, tag]);
    onTyped('');
    document.getElementById('tagInput')?.focus();
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (typed.trim()) add(typed);
    } else if (event.key === 'Backspace' && !typed && tags.length) {
      onTags(tags.slice(0, -1));
    }
  };
  return (
    <div className={LABEL_FIELD}>
      <label htmlFor="tagInput" className={labelClass}>
        Tags
      </label>
      <div
        id="tagEditor"
        className="flex flex-wrap items-center gap-1.5 min-h-11 p-1.5 rounded-control bg-slate-ground border border-control-edge focus-within:border-scanner-cyan-edge-strong"
        onClick={() => document.getElementById('tagInput')?.focus()}
      >
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 h-[30px] pl-2.5 pr-1.5 rounded-full bg-scanner-cyan-tint border border-scanner-cyan-edge text-[13px] font-medium text-[#a5f3fc] lg:border-0 lg:rounded-[calc(var(--radius-control)-6px)]"
          >
            {tag}
            <button
              type="button"
              onClick={() => {
                onTags(tags.filter(item => item !== tag));
              }}
              aria-label={`Remove tag ${tag}`}
              className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-scanner-cyan-edge"
            >
              <i className="ph-bold ph-x text-[10px]" />
            </button>
          </span>
        ))}
        <input
          id="tagInput"
          type="text"
          maxLength={40}
          value={typed}
          onChange={event => {
            onTyped(event.target.value);
          }}
          onKeyDown={onKey}
          placeholder="Type a tag and press Enter"
          className="flex-1 min-w-[8rem] h-[30px] bg-transparent px-1.5 text-base md:text-sm text-ink-bright placeholder:text-ink-disabled focus:outline-hidden"
        />
      </div>
    </div>
  );
}
