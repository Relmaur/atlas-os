// Add or edit a system (design 06). The draft lives here until Save; the stored system changes only through
// saveSystem().
import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { groupGlyphs } from '@atlas/core/location';
import { CONFLICT_LEVELS, STAR_CLASSES, newId, normalizeSystem, tagSlug, type System } from '@atlas/core/systems-model';
import { deleteSystem, saveSystem } from '../actions.ts';
import { showToast } from '../../app/ui.ts';
import { closeSystemPanel, dismissSystemPanel, openSystem, setCloseGuard, type EditorPreset } from './panel-store.ts';
import { SheetGrab } from '../parts/Sheet.tsx';
import { Button } from '../parts/Button.tsx';
import { ArmButton } from '../parts/Gesture.tsx';
import { goBack } from '../shell/section-store.ts';
import { LocationBlock, locationGlyphs, type Location } from './LocationBlock.tsx';
import { FIELD, LABEL_FIELD, Segments, TagEditor, type Option } from './editor-parts.tsx';

type Draft = Omit<System, 'wealth' | 'planetCount'> & { wealth: string; planetCount: string };
type TextField = 'name' | 'region' | 'economy' | 'notes';

// The design's race segments; "Abandoned" joins them only for a system already logged as abandoned.
const RACE_OPTIONS: Option[] = [
  ['gek', 'Gek'],
  ['korvax', 'Korvax'],
  ['vykeen', "Vy'keen"],
  ['none', 'None']
];

export function SystemEditor({ existing, preset }: { existing: System | undefined; preset: EditorPreset }) {
  const isNew = !existing;
  const [draft, setDraft] = useState<Draft>(() => {
    const base = existing ? structuredClone(existing) : normalizeSystem({ ...preset, id: newId('sys') });
    return {
      ...base,
      name: isNew && base.name === 'Unnamed system' ? '' : base.name,
      wealth: String(base.wealth),
      planetCount: base.planetCount ? String(base.planetCount) : ''
    };
  });
  const [location, setLocation] = useState<Location>(() => ({
    galaxy: draft.galaxy,
    format: 'portal',
    address: draft.glyphs ? groupGlyphs(draft.glyphs) : '',
    planet: draft.glyphs ? parseInt(draft.glyphs[0] ?? '0', 16) : 0
  }));
  const [tags, setTags] = useState(draft.tags);
  const [typed, setTyped] = useState('');
  const [arrived, setArrived] = useState(true);
  const [error, setError] = useState('');
  const set = (changes: Partial<Draft>) => {
    setDraft(current => ({ ...current, ...changes }));
  };
  const cancel = closeSystemPanel;
  const subtitleId = useId();

  // A swipe or a tap on the bar leaves only when nothing would be lost; Cancel stays the way to discard.
  const [original] = useState(() => JSON.stringify({ draft, tags, location }));
  const dirty = typed.trim() !== '' || JSON.stringify({ draft, tags, location }) !== original;
  useEffect(() => {
    setCloseGuard(() => {
      if (dirty) showToast('Unsaved changes: save, or Cancel to discard.');
      return !dirty;
    });
    return () => {
      setCloseGuard(null);
    };
  }, [dirty]);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pendingTag = tagSlug(typed); // a tag typed but not yet added still counts
    const allTags = pendingTag && !tags.includes(pendingTag) ? [...tags, pendingTag] : tags;
    const glyphs = locationGlyphs(location);
    if (!draft.name.trim()) {
      setError('The system needs a name.');
      return;
    }
    if (glyphs === null) {
      setError(
        location.format === 'portal'
          ? 'A portal address is 12 characters, 0–9 and A–F, or leave it empty.'
          : 'Galactic coordinates are four groups like 046A:0081:0D6D:0038, or leave them empty.'
      );
      document.getElementById('sysAddress')?.focus();
      return;
    }
    const system = normalizeSystem({
      ...draft,
      glyphs,
      tags: allTags,
      galaxy: location.galaxy.trim() || 'Euclid',
      planetCount: Number(draft.planetCount) || 0
    });
    saveSystem(system, { arrived: isNew && arrived });
    // A new system opens on its own screen; an edited one is already showing under the sheet.
    if (isNew) openSystem(system.id);
    else closeSystemPanel();
  };

  const text = (field: TextField) => ({
    name: field,
    value: draft[field],
    onChange: (event: { target: { value: string } }) => {
      set({ [field]: event.target.value });
    }
  });

  return (
    <form id="systemEditor" onSubmit={submit} aria-describedby={subtitleId} className="flex flex-col min-h-full">
      <div data-sheet-grab className="sticky top-0 z-10 bg-slate-deep/95 backdrop-blur px-5 pt-3 md:pt-5 pb-1">
        <SheetGrab onClose={dismissSystemPanel} />
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="systemPanelTitle" className="font-display font-extrabold text-[22px] leading-tight text-ink-bright">
              {isNew ? 'Add system' : 'Edit system'}
            </h2>
            <p id={subtitleId} className="text-sub text-ink-muted">
              What the game shows, plus your own tags and notes.
            </p>
          </div>
          <button
            type="button"
            onClick={cancel}
            aria-label="Cancel"
            className="hidden md:flex w-9 h-9 -mr-1.5 shrink-0 rounded-control items-center justify-center text-ink-muted hover:text-ink-bright hover:bg-slate-ground"
          >
            <i className="ph-bold ph-x text-lg" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-5 pt-3.5 pb-6 flex flex-col gap-4">
        <label className={LABEL_FIELD}>
          Name
          <input
            id="sysName"
            required
            maxLength={80}
            placeholder="As the Discoveries page shows it"
            autoFocus
            className={FIELD}
            {...text('name')}
          />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className={LABEL_FIELD}>
            Region
            <input maxLength={80} placeholder="e.g. Aeushne Sector" className={FIELD} {...text('region')} />
          </label>
          <label className={LABEL_FIELD}>
            Planets
            <input
              name="planetCount"
              inputMode="numeric"
              maxLength={2}
              placeholder="e.g. 5"
              value={draft.planetCount}
              onChange={event => {
                set({ planetCount: event.target.value.replace(/\D/g, '') });
              }}
              className={`${FIELD} font-mono`}
            />
          </label>
        </div>

        <LocationBlock value={location} star={draft.star} onChange={setLocation} />

        <Segments
          label="Star colour"
          rows={2}
          value={draft.star}
          onChange={star => {
            set({ star: star as Draft['star'] });
          }}
          options={[
            ...Object.entries(STAR_CLASSES).map(([key, star]): Option => [
              key,
              star.label,
              <span key="dot" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: star.color }} />
            ]),
            ['', 'Unknown']
          ]}
        />
        <Segments
          label="Dominant race"
          clearable
          value={draft.race}
          onChange={race => {
            set({ race: race as Draft['race'] });
          }}
          options={draft.race === 'abandoned' ? [...RACE_OPTIONS, ['abandoned', 'Abandoned']] : RACE_OPTIONS}
        />
        <label className={LABEL_FIELD}>
          Economy
          <input
            list="economyOptions"
            maxLength={40}
            placeholder="e.g. High Tech"
            className={FIELD}
            {...text('economy')}
          />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <Segments
            label="Wealth"
            clearable
            value={draft.wealth === '0' ? '' : draft.wealth}
            onChange={wealth => {
              set({ wealth: wealth || '0' });
            }}
            options={[
              ['1', '★', undefined, '1 of 3'],
              ['2', '★★', undefined, '2 of 3'],
              ['3', '★★★', undefined, '3 of 3']
            ]}
          />
          <Rating
            value={draft.rating}
            onChange={rating => {
              set({ rating });
            }}
          />
        </div>
        <Segments
          label="Conflict"
          clearable
          value={draft.conflict}
          onChange={conflict => {
            set({ conflict: conflict as Draft['conflict'] });
          }}
          options={Object.entries(CONFLICT_LEVELS).map(([key, label]): Option => [
            key,
            key === 'pirate' ? 'Pirate' : label
          ])}
        />

        <TagEditor tags={tags} onTags={setTags} typed={typed} onTyped={setTyped} />
        <label className={LABEL_FIELD}>
          Notes
          <textarea
            rows={3}
            maxLength={5000}
            placeholder="First impressions, what's here, why it matters"
            className={`${FIELD} h-auto py-2.5 leading-snug resize-y`}
            {...text('notes')}
          />
        </label>
        {isNew && (
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input
              name="logVisit"
              type="checkbox"
              checked={arrived}
              onChange={event => {
                setArrived(event.target.checked);
              }}
              className="w-4 h-4 accent-emerald-400"
            />
            I'm here now (log a visit)
          </label>
        )}
        {existing && (
          <ArmButton
            label="Delete system"
            armedLabel="Tap again to delete"
            onConfirm={() => {
              deleteSystem(existing.id);
              closeSystemPanel();
              if (window.location.hash.startsWith('#system/')) goBack('systems');
            }}
          />
        )}
      </div>

      <div className="sticky bottom-0 bg-slate-deep/95 backdrop-blur border-t border-hairline px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex flex-col gap-2">
        {error && (
          <p id="editorError" role="alert" className="text-caption text-danger-rose-text">
            {error}
          </p>
        )}
        <div className="grid grid-cols-[1fr_2fr] gap-2.5">
          <Button size="L" onClick={cancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            {isNew ? 'Add system' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}

// Your rating, 1–5 stars in one track that lights up once rated (the design's single star segment); tapping the
// current rating again clears it.
function Rating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <p id={labelId} className="text-caption text-ink-soft">
        Your rating
      </p>
      <div className="p-1 rounded-control bg-slate-ground border border-hairline">
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          className={`flex h-9 rounded-segment transition-colors ${value ? 'bg-[rgba(16,185,129,0.18)] shadow-[inset_0_0_0_1px_rgba(52,211,153,0.45)]' : ''}`}
        >
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={n === 1 ? '1 star' : `${String(n)} stars`}
              onClick={() => {
                onChange(value === n ? 0 : n);
              }}
              className={`flex-1 flex items-center justify-center text-[15px] ${n <= value ? 'text-units-amber-text' : 'text-ink-disabled hover:text-ink-soft'}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
