// The word combobox (component c14, option B): a field whose value usually comes from a wiki list, with the list
// anchored right under it (between the field and the keyboard on a phone). It replaces <datalist>, which iOS shows
// only as three words on the keyboard bar. The current context's words come first (the planet's biome), typing
// filters by "contains", at most five rows show before the list scrolls, and the last row keeps what was typed.
// Free text always wins: nothing typed is ever replaced by a suggestion. ARIA combobox pattern: ↑ ↓ move, Enter
// picks, Esc closes and keeps the text.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface WordOption {
  value: string;
  /** Shown at the row's end: a severity pill, a star colour. */
  extra?: ReactNode;
}
export interface WordGroup {
  /** "Frozen weather · wiki"; omitted for a single unnamed list. */
  label?: string | undefined;
  options: WordOption[];
}

const contains = (value: string, typed: string) => value.toLowerCase().includes(typed.trim().toLowerCase());

/** The next field after `from` in its form, for focus to move on to once a word is picked. */
function nextField(from: HTMLElement): HTMLElement | null {
  const form = from.closest('form');
  if (!form) return null;
  const fields = [
    ...form.querySelectorAll<HTMLElement>(
      'input:not([type=hidden]), textarea, select, button[role=radio][aria-checked=true]'
    )
  ].filter(field => !field.hasAttribute('disabled'));
  const at = fields.indexOf(from);
  return at === -1 ? null : (fields[at + 1] ?? null);
}

export function WordCombobox({
  label,
  name,
  value,
  onChange,
  onPick,
  groups,
  placeholder,
  hint,
  lead,
  trail,
  inputMode,
  mono = false,
  maxLength = 80,
  hideLabel = false,
  className = ''
}: {
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  /** Called with a word picked from the list (or kept as typed), after onChange. */
  onPick?: (value: string) => void;
  groups: WordGroup[];
  placeholder?: string;
  hint?: ReactNode;
  /** Inside the field before the text: the biome's marker. */
  lead?: ReactNode;
  /** Inside the field before the chevron: the severity pill. */
  trail?: ReactNode;
  inputMode?: 'text' | 'decimal';
  mono?: boolean;
  maxLength?: number;
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Until the player types, the whole list shows (the context's words first); typing narrows it.
  const [typing, setTyping] = useState(false);

  const shown = groups
    .map(group => ({ ...group, options: group.options.filter(option => !typing || contains(option.value, value)) }))
    .filter(group => group.options.length);
  const flat = shown.flatMap(group => group.options);
  const typed = value.trim();
  const exact = flat.some(option => option.value.toLowerCase() === typed.toLowerCase());
  const keep = typed && !exact ? typed : '';
  const rows = flat.length + (keep ? 1 : 0);
  const optionId = (i: number) => `${id}-opt-${String(i)}`;

  // An opened list is brought fully into view: low in a sheet it would sit under the footer. (With a phone's
  // keyboard up, keyboard.ts has already moved the field to the top.)
  const list = useRef<HTMLUListElement>(null);
  const shownOpen = open && rows > 0;
  useEffect(() => {
    if (shownOpen) list.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [shownOpen]);

  const close = () => {
    setOpen(false);
    setActive(-1);
    setTyping(false);
  };
  const pick = (word: string, move: boolean) => {
    onChange(word);
    onPick?.(word);
    close();
    if (move && input.current) nextField(input.current)?.focus();
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      if (!rows) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      // From no row, ↓ goes to the first and ↑ to the last ("Keep … as typed" when there is one).
      setActive(current => (current < 0 ? (step > 0 ? 0 : rows - 1) : (current + step + rows) % rows));
    } else if (event.key === 'Enter' && open && (active >= 0 || typed)) {
      // Enter picks the highlighted row, or keeps what was typed: it never submits the form from inside a word.
      event.preventDefault();
      pick(active >= 0 && active < flat.length ? (flat[active]?.value ?? value) : typed, true);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation(); // the sheet stays open: Esc here only closes the list
      close();
    }
  };

  // Each group's first row number, for the options' ids and the active row.
  const starts = shown.map((_, g) => shown.slice(0, g).reduce((sum, group) => sum + group.options.length, 0));
  return (
    <div className={`flex flex-col gap-1.5 text-caption text-ink-soft min-w-0 ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </label>
      <div className="relative">
        <div className="flex items-center gap-2 h-11 rounded-control border border-control-edge bg-slate-ground px-3.5 focus-within:border-scanner-cyan-edge-strong">
          {lead}
          <input
            ref={input}
            id={id}
            name={name}
            role="combobox"
            aria-expanded={open && rows > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
            aria-describedby={hint ? hintId : undefined}
            data-combobox=""
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode={inputMode}
            maxLength={maxLength}
            value={value}
            placeholder={placeholder}
            onChange={event => {
              onChange(event.target.value);
              setTyping(true);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => {
              setOpen(true);
            }}
            onClick={() => {
              setOpen(true);
            }}
            onBlur={close}
            onKeyDown={onKey}
            className={`flex-1 min-w-0 h-full bg-transparent text-base md:text-sm text-ink-bright placeholder:text-ink-disabled focus:outline-hidden scroll-mt-24 ${mono ? 'font-mono' : ''}`}
          />
          {trail}
          <i aria-hidden="true" className="ph ph-caret-down text-ink-muted text-sm shrink-0" />
        </div>
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={!open || !rows}
          className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] scroll-mb-24 max-h-[232px] overflow-y-auto overscroll-contain rounded-control border border-control-edge bg-slate-deep py-1 shadow-none"
        >
          {shown.map((group, g) => (
            <li key={group.label ?? 'words'} role="presentation">
              {group.label && (
                <div aria-hidden="true" className="px-3.5 pt-2 pb-1 text-label uppercase text-ink-label">
                  {group.label}
                </div>
              )}
              <ul role="group" aria-label={group.label}>
                {group.options.map((option, n) => {
                  const i = (starts[g] ?? 0) + n;
                  return (
                    <li
                      key={option.value}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === active}
                      // Before the input's blur: a tap on a row picks it rather than closing the list first.
                      onMouseDown={event => {
                        event.preventDefault();
                      }}
                      onClick={() => {
                        pick(option.value, true);
                      }}
                      className={`flex items-center gap-2 min-h-11 px-3.5 text-sm cursor-pointer ${i === active ? 'bg-scanner-cyan-tint text-ink-bright' : 'text-ink hover:bg-slate-ground'}`}
                    >
                      <span className="flex-1 min-w-0 truncate">{option.value}</span>
                      {option.extra}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {keep && (
            <li
              id={optionId(flat.length)}
              role="option"
              aria-selected={active === flat.length}
              onMouseDown={event => {
                event.preventDefault();
              }}
              onClick={() => {
                pick(typed, true);
              }}
              className={`flex items-center min-h-11 px-3.5 text-sm cursor-pointer border-t border-hairline ${active === flat.length ? 'bg-scanner-cyan-tint text-ink-bright' : 'text-ink-soft hover:bg-slate-ground'}`}
            >
              {`Keep “${typed}” as typed`}
            </li>
          )}
        </ul>
      </div>
      {hint && (
        <span id={hintId} className="text-caption text-ink-muted">
          {hint}
        </span>
      )}
    </div>
  );
}
