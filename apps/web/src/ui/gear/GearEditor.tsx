// Add or edit a ship, Multi-Tool or Exosuit (design 12): a bottom sheet below lg, a side panel from lg up. Supercharged
// slots are marked by tapping the technology grid (SlotPicker), which follows the wiki's cited rules for the kind and
// class; notes can be linked to it, and show on its own screen.
import { useCallback, useEffect, useRef, useState, type SubmitEvent } from 'react';
import { newId } from '@atlas/core/systems-model';
import { ROLE_SUGGESTIONS, classLetter, slotRules, type GearItem, type GearKind } from '@atlas/core/gear';
import { notesForGear } from '@atlas/core/notes';
import { deleteGear, linkGearNotes, saveGear } from '../actions.ts';
import { showToast } from '../../app/ui.ts';
import { useAppState } from '../useAppState.ts';
import { closeEditor } from '../parts/editor-store.ts';
import { PanelGrab, SheetGrab, useSheetDrag } from '../parts/Sheet.tsx';
import { Button } from '../parts/Button.tsx';
import { ArmButton } from '../parts/Gesture.tsx';
import { FIELD, LABEL_FIELD, Segments } from '../systems/editor-parts.tsx';
import { SlotPicker } from './SlotPicker.tsx';
import { KINDS } from './kinds.ts';
import { loadFacts, useFacts } from './facts-store.ts';

export function GearEditor({ existing, preset }: { existing: GearItem | undefined; preset: GearKind }) {
  const state = useAppState();
  const [draft, setDraft] = useState<GearItem>(
    () =>
      existing ?? {
        id: newId('gear'),
        kind: preset,
        name: '',
        class: '',
        type: '',
        role: '',
        superchargedSlots: [],
        slotLabels: {},
        notes: '',
        createdAt: new Date().toISOString()
      }
  );
  const [linked, setLinked] = useState(() => notesForGear(state.notes, draft.id).map(note => note.id));
  const [showNotes, setShowNotes] = useState(false);
  const [original] = useState(() => JSON.stringify({ draft, linked }));
  // Deleted on another device (or tab) while open: the first Save says so, a second one keeps it on purpose.
  const [wasSaved] = useState(Boolean(existing));
  const [restore, setRestore] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify({ draft, linked }) !== original;
  const facts = useFacts();
  const rules = slotRules(facts, draft.kind, draft.class);
  useEffect(() => {
    void loadFacts();
  }, []);
  const set = (changes: Partial<GearItem>) => {
    setDraft(current => ({ ...current, ...changes }));
  };

  // Esc, the bar, a swipe and a tap outside leave only when nothing would be lost; Cancel discards.
  const dismiss = useCallback(() => {
    if (dirty) showToast('Unsaved changes: save, or Cancel to discard.');
    else closeEditor();
  }, [dirty]);
  const sheet = useRef<HTMLDivElement>(null);
  useSheetDrag(sheet, dismiss);
  const latest = useRef(dismiss);
  useEffect(() => {
    latest.current = dismiss;
  }, [dismiss]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('overflow-hidden');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('overflow-hidden'); // focus goes back to the opener in closeEditor()
    };
  }, []);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError('Give it a name.');
      return;
    }
    if (wasSaved && !existing && !restore) {
      setRestore(true);
      setError(`${draft.name} was deleted on another device. Save again to keep it.`);
      return;
    }
    saveGear(draft.kind === 'exosuit' ? { ...draft, class: '', type: '' } : draft); // fields hidden for an Exosuit
    linkGearNotes(draft.id, linked);
    closeEditor();
  };
  const field = (key: 'name' | 'type' | 'role' | 'notes') => ({
    value: draft[key],
    onChange: (event: { target: { value: string } }) => {
      set({ [key]: event.target.value });
    }
  });
  const kindLabel = KINDS[draft.kind].label;
  const linkedTitles = state.notes.filter(note => linked.includes(note.id)).map(note => note.title);

  return (
    <>
      <div onClick={dismiss} className="fixed inset-0 z-[60] bg-scrim backdrop-blur-[2px]" />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gearEditorTitle"
        className="kb-sheet fixed z-[61] flex flex-col bg-slate-deep border-control-edge inset-x-0 bottom-0 h-[92dvh] rounded-t-sheet border-t lg:inset-x-auto lg:right-5 lg:top-5 lg:bottom-5 lg:h-auto lg:w-[540px] lg:rounded-panel lg:overflow-hidden lg:border"
      >
        <PanelGrab onClose={dismiss} label={`Close ${kindLabel.toLowerCase()} editor`} />
        <form id="gearEditor" onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div data-sheet-grab className="sticky top-0 z-10 bg-slate-deep/95 backdrop-blur px-5 pt-3 lg:pt-5 pb-3">
              <SheetGrab onClose={dismiss} label={`Close ${kindLabel.toLowerCase()} editor`} />
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h2
                    id="gearEditorTitle"
                    className="font-display font-extrabold text-[22px] leading-tight text-ink-bright"
                  >
                    {wasSaved ? `Edit ${draft.kind === 'starship' ? 'ship' : kindLabel}` : 'Add to your fleet'}
                  </h2>
                  <p className="text-sub text-ink-muted">Mark the supercharged slots once and never forget them.</p>
                </div>
              </div>
            </div>

            <div className="px-5 pt-3.5 pb-6 flex flex-col gap-4">
              <Segments
                label="Kind"
                value={draft.kind}
                onChange={kind => {
                  if (kind === 'starship' || kind === 'multitool' || kind === 'exosuit') set({ kind });
                }}
                options={[
                  ['starship', 'Starship'],
                  ['multitool', 'Multi-Tool'],
                  ['exosuit', 'Exosuit']
                ]}
              />
              <label className={LABEL_FIELD}>
                Name
                <input
                  id="gearName"
                  required
                  maxLength={80}
                  autoFocus
                  placeholder="As named in game"
                  className={FIELD}
                  {...field('name')}
                />
              </label>
              <div className={`grid gap-2.5 ${draft.kind === 'exosuit' ? '' : 'grid-cols-2'}`}>
                {draft.kind !== 'exosuit' && (
                  <label className={LABEL_FIELD}>
                    Type
                    <input
                      maxLength={60}
                      placeholder={draft.kind === 'multitool' ? 'e.g. Sentinel Rifle' : 'e.g. Interceptor'}
                      className={FIELD}
                      {...field('type')}
                    />
                  </label>
                )}
                <label className={LABEL_FIELD}>
                  Role
                  <input
                    list="gearRoles"
                    maxLength={40}
                    placeholder="e.g. Flagship"
                    className={FIELD}
                    {...field('role')}
                  />
                </label>
              </div>
              <datalist id="gearRoles">
                {ROLE_SUGGESTIONS.map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
              {draft.kind !== 'exosuit' && (
                <Segments
                  label="Class"
                  clearable
                  value={classLetter(draft.class) ?? ''}
                  onChange={value => {
                    set({ class: value });
                  }}
                  options={['C', 'B', 'A', 'S'].map(value => [value, value, undefined, `${value}-class`])}
                />
              )}
              <SlotPicker
                key={draft.kind}
                slots={draft.superchargedSlots}
                labels={draft.slotLabels}
                kind={draft.kind}
                cls={draft.class}
                rules={rules}
                onChange={(superchargedSlots, slotLabels) => {
                  set({ superchargedSlots, slotLabels });
                }}
              />
              <label className={LABEL_FIELD}>
                Notes
                <textarea
                  rows={3}
                  maxLength={20_000}
                  placeholder="Layout, what goes where, plans. Markdown works."
                  className={`${FIELD} h-auto py-2.5 leading-snug resize-y`}
                  {...field('notes')}
                />
              </label>

              {state.notes.length > 0 && (
                <div className="rounded-2xl border border-hairline bg-panel-glass">
                  <button
                    type="button"
                    aria-expanded={showNotes}
                    aria-controls="gearLinkedNotes"
                    onClick={() => {
                      setShowNotes(!showNotes);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <i className="ph-bold ph-file-text text-lg text-scanner-cyan-pale shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold text-ink-bright">Linked notes</span>
                      <span className="block text-caption text-ink-muted">
                        {linkedTitles.length ? linkedTitles.join(' · ') : 'None yet: pick notes to show on its screen'}
                      </span>
                    </span>
                    <i
                      className={`ph-bold ph-caret-right text-ink-label shrink-0 transition-transform ${showNotes ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  {showNotes && (
                    <fieldset id="gearLinkedNotes" className="border-t border-hairline px-4 py-2">
                      <legend className="sr-only">Notes linked to {draft.name || 'this'}</legend>
                      {state.notes.map(note => (
                        <label key={note.id} className="flex items-center gap-3 py-2 text-sub text-ink">
                          <input
                            type="checkbox"
                            checked={linked.includes(note.id)}
                            onChange={() => {
                              setLinked(
                                linked.includes(note.id) ? linked.filter(id => id !== note.id) : [...linked, note.id]
                              );
                            }}
                            className="w-4 h-4 accent-emerald-400"
                          />
                          <span className="truncate">{note.title}</span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                </div>
              )}

              {existing && (
                <ArmButton
                  label="Remove from fleet"
                  armedLabel="Tap again to remove"
                  onConfirm={() => {
                    deleteGear(existing.id);
                    linkGearNotes(existing.id, []);
                    closeEditor();
                    if (location.hash.startsWith('#ship/')) location.hash = '#gear';
                  }}
                />
              )}
            </div>
          </div>

          <div className="bg-slate-deep/95 backdrop-blur border-t border-hairline px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex flex-col gap-2">
            {error && (
              <p role="alert" className="text-caption text-danger-rose-text">
                {error}
              </p>
            )}
            <div className="grid grid-cols-[1fr_2fr] gap-2.5">
              <Button size="L" onClick={closeEditor}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                {wasSaved ? 'Save changes' : 'Add to fleet'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
