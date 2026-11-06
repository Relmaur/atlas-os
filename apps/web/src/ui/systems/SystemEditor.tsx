// Add or edit a system (design 06). The draft lives here until Save; the stored system changes only through
// saveSystem().
import { useEffect, useId, useState, type ReactNode, type SubmitEvent } from 'react';
import { economyType, starFromSpectral, strengthStars } from '@atlas/core/galaxy-map';
import { WordCombobox, type WordGroup } from '../parts/WordCombobox.tsx';
import {
  CONFLICT_LEVELS,
  ECONOMIES,
  STAR_CLASSES,
  newId,
  normalizeSystem,
  tagSlug,
  type System
} from '@atlas/core/systems-model';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { deleteSystem, saveSystem } from '../actions.ts';
import { showToast } from '../../app/ui.ts';
import {
  closeSystemPanel,
  dismissSystemPanel,
  openSystem,
  openSystemEditor,
  setCloseGuard,
  type EditorPreset
} from './panel-store.ts';
import { SheetGrab } from '../parts/Sheet.tsx';
import { Button } from '../parts/Button.tsx';
import { ArmButton } from '../parts/Gesture.tsx';
import { goBack } from '../shell/section-store.ts';
import { LocationBlock, locationGlyphs, locationOf, type Location } from './LocationBlock.tsx';
import { FIELD, LABEL_FIELD, Segments, TagEditor, type Option } from './editor-parts.tsx';
import { DiscoveryFields } from './DiscoveryFields.tsx';
import { useAppState } from '../useAppState.ts';

type Draft = Omit<System, 'wealth' | 'planetCount'> & { wealth: string; planetCount: string };
type TextField = 'name' | 'region' | 'economy' | 'economyStrength' | 'notes';

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
  const [location, setLocation] = useState<Location>(() => locationOf(draft, preset.way));
  // Opened for its address (03d, 01b): Location comes into view.
  useEffect(() => {
    if (!preset.way) return;
    const block = document.getElementById('sysLocation');
    const scroller = document.getElementById('systemPanelScroll');
    if (block && scroller) scroller.scrollTop = block.offsetTop - 72;
  }, [preset.way]);
  const facts = useFacts();
  useEffect(() => {
    void loadFacts(); // the galaxy map's words, for the spectral class and economy pickers
  }, []);
  const map = facts?.galaxyMap ?? null;
  // The star colour and the wealth stars follow the spectral class and the strength word only while the player
  // hasn't set them: a value they chose, or one already logged, is never changed for them.
  const [starFollows, setStarFollows] = useState(!draft.star);
  const [wealthFollows, setWealthFollows] = useState(draft.wealth === '0');
  const [tags, setTags] = useState(draft.tags);
  const [typed, setTyped] = useState('');
  const [arrived, setArrived] = useState(true);
  const [error, setError] = useState('');
  const { accounts } = useAppState();
  const discoveryId = useId();
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
        location.way === 'booster'
          ? 'Galactic coordinates are four groups like 046A:0081:0D6D:0038, or leave them empty.'
          : 'The portal address needs all 12 glyphs (glyph 1 may wait for Photo Mode), or none.'
      );
      document.getElementById('sysLocation')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    const system = normalizeSystem({
      ...draft,
      ...glyphs,
      tags: allTags,
      galaxy: location.galaxy.trim() || 'Euclid',
      planetCount: Number(draft.planetCount) || 0
    });
    saveSystem(system, { arrived: isNew && arrived });
    // Logged without its address (01b): one tap to add it, read from Photo Mode.
    if (isNew && !system.glyphs)
      showToast('System logged', {
        detail: system.name,
        action: {
          label: 'Add its address',
          run: () => {
            openSystemEditor(system.id, { way: 'photo' });
          }
        }
      });
    // A new system opens on its own screen; an edited one is already showing under the sheet.
    if (isNew) openSystem(system.id);
    else closeSystemPanel();
  };

  // The galaxy map's words for the pairs (c14): the class letters with the colour each gives, the economy names
  // by type, the strength words by stars.
  const classStar = starFromSpectral(map, draft.spectralClass);
  const classGroups: WordGroup[] = map
    ? [
        {
          label: 'Spectral classes · wiki',
          options: Object.entries(map.spectral.classes).map(([letter, star]) => ({
            value: letter,
            extra: (
              <span className="inline-flex items-center gap-1.5 text-caption text-ink-muted">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: STAR_CLASSES[star].color }}
                  aria-hidden="true"
                />
                {STAR_CLASSES[star].label}
              </span>
            )
          }))
        }
      ]
    : [];
  const economyGroups: WordGroup[] = map
    ? map.economy.types.map(type => ({ label: `${type.name} · wiki`, options: type.names.map(value => ({ value })) }))
    : [{ options: ECONOMIES.map(value => ({ value })) }];
  const strengthGroups: WordGroup[] = map
    ? ([3, 2, 1] as const).map(n => ({
        label: `${'★'.repeat(n)} · wiki`,
        options: map.economy.strength[n].map(value => ({ value }))
      }))
    : [];
  const type = economyType(map, draft.economy);
  const strength = strengthStars(map, draft.economyStrength);
  const economyNote =
    draft.economy.trim() && map && !type
      ? `“${draft.economy.trim()}” isn’t one of the wiki’s economy names; it’s kept as typed.${strength ? ' Strength still sets the stars.' : ''}`
      : type || strength
        ? `${type ? `A ${type} economy` : 'An economy'}${strength ? `, ${'★'.repeat(strength)} strength` : ''}.`
        : '';
  const setBy = strength !== null && draft.wealth === String(strength) && wealthFollows;

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
              <span className="lg:hidden">What the game shows, plus your own tags and notes.</span>
              {/* From lg (d14): which system, and how to leave. */}
              <span className="hidden lg:inline">
                {`${existing?.name ?? 'A new system'} · Esc or the grab bar closes`}
              </span>
            </p>
          </div>
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
            Planets & moons
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
          label="Dominant race"
          clearable
          value={draft.race}
          onChange={race => {
            set({ race: race as Draft['race'] });
          }}
          options={draft.race === 'abandoned' ? [...RACE_OPTIONS, ['abandoned', 'Abandoned']] : RACE_OPTIONS}
        />

        <PairCard title="Star" caption="as the galaxy map shows it">
          <div className="flex items-end gap-2">
            <WordCombobox
              label="Class"
              name="spectralClass"
              value={draft.spectralClass}
              onChange={spectralClass => {
                const star = starFromSpectral(map, spectralClass);
                set({ spectralClass, ...(starFollows ? { star: star ?? '' } : {}) });
              }}
              groups={classGroups}
              placeholder="F4"
              maxLength={8}
              mono
              className="flex-1"
            />
            <Slashes />
            <div className="flex gap-1.5 shrink-0" role="group" aria-label="On the map">
              <Toggle
                label="Water"
                on={draft.water}
                onChange={water => {
                  set({ water });
                }}
              />
              <Toggle
                label="Dissonant"
                on={draft.dissonant}
                onChange={dissonant => {
                  set({ dissonant });
                }}
              />
            </div>
          </div>
          {classStar && draft.star && draft.star !== classStar && (
            // The player's colour disagrees with the wiki's reading of the class: theirs stays (06c).
            <div className="rounded-control border border-[rgba(251,191,36,0.45)] bg-units-amber-tint px-3.5 py-3 flex items-center gap-3">
              <p className="flex-1 text-sub text-units-amber-text">
                {`You chose ${STAR_CLASSES[draft.star].label}. ${draft.spectralClass.trim().toUpperCase()} reads ${STAR_CLASSES[classStar].label.toLowerCase()} on the wiki; your choice stays.`}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStarFollows(true);
                  set({ star: classStar });
                }}
                className="h-10 px-3.5 rounded-control border border-[rgba(251,191,36,0.55)] text-units-amber-text text-sm font-semibold shrink-0 hover:bg-units-amber-tint"
              >
                {`Use ${STAR_CLASSES[classStar].label.toLowerCase()}`}
              </button>
            </div>
          )}
          <Segments
            label="Star colour"
            rows={2}
            value={draft.star}
            onChange={star => {
              setStarFollows(false);
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
          {classStar && draft.star === classStar && starFollows && (
            <p className="text-caption text-ink-muted">
              {`${draft.spectralClass.trim().charAt(0).toUpperCase()} is a ${STAR_CLASSES[classStar].label.toLowerCase()} class on the wiki’s Spectral class page, so the colour follows. Pick another to override.`}
            </p>
          )}
        </PairCard>

        <PairCard title="Economy" caption="name // strength">
          <div className="flex items-end gap-2">
            <WordCombobox
              label="Name"
              name="economy"
              value={draft.economy}
              onChange={economy => {
                set({ economy });
              }}
              groups={economyGroups}
              placeholder="Prospecting"
              maxLength={40}
              className="flex-1"
            />
            <Slashes />
            <WordCombobox
              label="Strength"
              name="economyStrength"
              value={draft.economyStrength}
              onChange={economyStrength => {
                const stars = strengthStars(map, economyStrength);
                set({ economyStrength, ...(wealthFollows ? { wealth: String(stars ?? 0) } : {}) });
              }}
              groups={strengthGroups}
              placeholder="Opulent"
              maxLength={40}
              className="flex-1"
            />
          </div>
          {economyNote && <p className="text-caption text-ink-soft">{economyNote}</p>}
          <Segments
            label="Wealth"
            clearable
            value={draft.wealth === '0' ? '' : draft.wealth}
            onChange={wealth => {
              setWealthFollows(false);
              set({ wealth: wealth || '0' });
            }}
            options={[
              ['1', '★', undefined, '1 of 3'],
              ['2', '★★', undefined, '2 of 3'],
              ['3', '★★★', undefined, '3 of 3']
            ]}
          />
          {setBy && (
            <p className="text-caption text-ink-muted">{`Set by “${draft.economyStrength.trim()}”. Change it if the game disagrees.`}</p>
          )}
        </PairCard>

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
        <Rating
          value={draft.rating}
          onChange={rating => {
            set({ rating });
          }}
        />

        <section
          aria-labelledby={discoveryId}
          className="flex flex-col gap-3 p-3.5 rounded-2xl border border-hairline bg-panel"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 id={discoveryId} className="font-display font-bold text-[13px] text-ink-bright">
              Discovery
            </h3>
            <span className="text-[11px] text-ink-muted text-right">As the system’s discovery page shows it</span>
          </div>
          <DiscoveryFields value={draft} onChange={set} accounts={accounts} />
        </section>

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
        <div className="grid grid-cols-[1fr_2fr] gap-2.5 lg:flex lg:justify-end">
          <Button size="L" onClick={cancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            {isNew ? 'Add system' : 'Save changes'}
            <kbd aria-hidden="true" className="hidden lg:inline nav-kbd ml-1.5">
              Ctrl ↵
            </kbd>
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

// A group of the editor as the galaxy map pairs it (06b): a card with its title and what it mirrors.
function PairCard({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-card bg-panel border border-hairline p-4 flex flex-col gap-3 min-w-0">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden="true" className="flex items-baseline justify-between gap-3">
        <span className="font-display text-sm font-bold text-ink-bright">{title}</span>
        <span className="text-caption text-ink-muted">{caption}</span>
      </div>
      {children}
    </fieldset>
  );
}

// The map's separator, for the eye only: the fields are named on their own.
const Slashes = () => (
  <span aria-hidden="true" className="h-11 flex items-center font-mono text-lg text-ink-muted shrink-0">
    //
  </span>
);

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        onChange(!on);
      }}
      className={`h-11 px-3 rounded-control border text-[13px] font-semibold transition-colors ${
        on
          ? 'bg-[rgba(16,185,129,0.18)] text-[#d1fae5] border-[rgba(52,211,153,0.45)]'
          : 'bg-slate-ground border-control-edge text-ink-soft hover:text-ink-bright'
      }`}
    >
      {on && <i className="ph-bold ph-check text-[11px] mr-1.5" aria-hidden="true" />}
      {label}
    </button>
  );
}
