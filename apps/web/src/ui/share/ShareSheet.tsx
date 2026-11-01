// The Share sheet (design 23): the picture as it will be saved, what's on it, and how it leaves. It's made on the device
// and goes nowhere until the player taps Save or Share, which hand it to the browser or the phone's own share sheet.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { slotRules, rulesSummary, type GearItem } from '@atlas/core/gear';
import { systemOrbit } from '@atlas/core/orbit';
import {
  FLEET_SIZE,
  POSTCARD_DEFAULTS,
  SHARE_FORMATS,
  fleetCard,
  plainNote,
  postcard,
  postcardText,
  shareFileName,
  type PostcardOptions,
  type ShareFormat
} from '@atlas/core/share';
import { biomeFamily } from '@atlas/core/facts';
import type { System } from '@atlas/core/systems-model';
import { showToast } from '../../app/ui.ts';
import { useFacts } from '../gear/facts-store.ts';
import { KINDS } from '../gear/kinds.ts';
import { Button } from '../parts/Button.tsx';
import { PanelGrab, SheetGrab, useSheetDrag, useSheetOpen } from '../parts/Sheet.tsx';
import { useGameVersion } from '../runs/run-bits.tsx';
import { Segments } from '../systems/editor-parts.tsx';
import { drawFleetCard, drawPostcard, loadShareFonts, pictureBlob } from './draw.ts';

const SHEET_LAYOUT = '(min-width: 0px)';
const ROW = 'flex items-center justify-between gap-4 px-4 py-3';

export function copyText(text: string, done: string) {
  ('clipboard' in navigator ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard')))
    .then(() => {
      showToast(done);
    })
    .catch(() => {
      showToast(text);
    });
}

const isDismissal = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

function canShareFiles(): boolean {
  if (!('canShare' in navigator)) return false;
  return navigator.canShare({ files: [new File([], 'atlas.png', { type: 'image/png' })] });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  showToast(`Saved ${name}.`);
}

function Choice({
  title,
  detail,
  on,
  disabled = false,
  onChange
}: {
  title: string;
  detail: ReactNode;
  on: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <li className={ROW}>
      <span className="flex flex-col min-w-0">
        <span id={id} className="text-sm font-semibold text-ink-bright">
          {title}
        </span>
        <span className="text-caption text-ink-muted truncate">{detail}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => {
          onChange(!on);
        }}
        className="switch shrink-0 disabled:opacity-40"
      />
    </li>
  );
}

export function ShareShell({
  title,
  size,
  open,
  onClose,
  file,
  shareTitle,
  label,
  draw,
  copy,
  children
}: {
  title: string;
  size: { width: number; height: number };
  open: boolean;
  /** Stable (useCallback): the sheet's open effect depends on it. */
  onClose: () => void;
  file: string;
  shareTitle: string;
  label: string;
  draw: (canvas: HTMLCanvasElement) => void;
  copy?: () => void;
  children: ReactNode;
}) {
  // Several screens keep a sheet mounted at once; only the open one carries the ids.
  const titleId = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useSheetDrag(sheet, onClose);
  useSheetOpen(open, onClose, { layout: SHEET_LAYOUT, focus: heading });
  // Made ahead of the tap: a phone only opens its share sheet from the tap itself, not after waiting for a picture.
  const picture = useRef<Promise<Blob> | null>(null);
  useEffect(() => {
    if (!open) return;
    let current = true;
    void loadShareFonts().then(() => {
      if (!current || !canvas.current) return;
      draw(canvas.current);
      picture.current = pictureBlob(canvas.current);
    });
    return () => {
      current = false;
    };
  }, [open, draw]);

  // Going anywhere else closes it: it belongs to the screen it was opened from.
  useEffect(() => {
    if (!open) return;
    window.addEventListener('hashchange', onClose);
    return () => {
      window.removeEventListener('hashchange', onClose);
    };
  }, [open, onClose]);

  const sharing = open && canShareFiles();
  const phone = sharing && matchMedia('(pointer: coarse)').matches;
  const get = () => {
    if (!canvas.current) return Promise.reject(new Error('no canvas'));
    return picture.current ?? pictureBlob(canvas.current);
  };
  const share = () => {
    get()
      .then(blob => navigator.share({ title: shareTitle, files: [new File([blob], file, { type: 'image/png' })] }))
      .catch((error: unknown) => {
        if (!isDismissal(error)) showToast('Couldn’t share the picture. Try saving it instead.');
      });
  };
  const save = () => {
    get()
      .then(blob => {
        download(blob, file);
      })
      .catch(() => {
        showToast('Couldn’t make the picture.');
      });
  };

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[55] bg-scrim backdrop-blur-[2px] transition-opacity duration-200 ${open ? '' : 'opacity-0 pointer-events-none'}`}
      />
      <div
        ref={sheet}
        id={open ? 'shareSheet' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
        inert={!open}
        className={`fixed z-[56] flex flex-col bg-slate-deep border-control-edge transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] inset-x-0 bottom-0 max-h-[92dvh] rounded-t-sheet border-t ${open ? '' : 'translate-y-full'} lg:inset-x-auto lg:right-0 lg:top-0 lg:bottom-0 lg:max-h-none lg:w-[440px] lg:rounded-none lg:border-t-0 lg:border-l lg:translate-y-0 ${open ? '' : 'lg:translate-x-full'}`}
      >
        <PanelGrab onClose={onClose} label="Close sharing" />
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-4">
          <div data-sheet-grab className="sticky top-0 z-10 -mx-5 px-5 pt-3 pb-1 bg-slate-deep">
            <SheetGrab onClose={onClose} label="Close sharing" />
            <div className="flex items-baseline justify-between gap-3">
              <h2
                ref={heading}
                id={titleId}
                tabIndex={-1}
                className="font-display text-lg font-bold text-ink-bright focus:outline-hidden"
              >
                {title}
              </h2>
              <span
                id={open ? 'shareSize' : undefined}
                className="font-mono text-caption text-ink-muted whitespace-nowrap"
              >
                {size.width} × {size.height}
              </span>
            </div>
          </div>
          <canvas
            ref={canvas}
            id={open ? 'sharePreview' : undefined}
            role="img"
            aria-label={label}
            width={size.width}
            height={size.height}
            className="block mx-auto max-w-full max-h-[42dvh] w-auto h-auto rounded-card"
          />
          {children}
          {phone ? (
            <Button variant="primary" icon="ph-download-simple" onClick={share}>
              Save to Photos
            </Button>
          ) : (
            <Button variant="primary" icon="ph-download-simple" onClick={save}>
              Save picture
            </Button>
          )}
          {(sharing || copy) && (
            <div className={`grid gap-2 ${sharing && copy ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {sharing && (
                <Button icon="ph-link-simple" onClick={share}>
                  Share…
                </Button>
              )}
              {copy && (
                <Button icon="ph-file-text" onClick={copy}>
                  Copy as text
                </Button>
              )}
            </div>
          )}
          <p className="text-caption text-ink-muted text-center">
            Made on this device, nothing uploaded. The picture carries a small ATLAS mark.
          </p>
        </div>
      </div>
    </>
  );
}

const CHOICES = 'rounded-card bg-panel-glass border border-hairline divide-y divide-hairline';

export function ShareSystemSheet({ system, open, onClose }: { system: System; open: boolean; onClose: () => void }) {
  const facts = useFacts();
  const game = useGameVersion();
  const [format, setFormat] = useState<ShareFormat>('square');
  const [options, setOptions] = useState<PostcardOptions>(POSTCARD_DEFAULTS);
  const set = (part: Partial<PostcardOptions>) => {
    setOptions({ ...options, ...part });
  };
  const card = useMemo(() => postcard(system, options, game?.version ?? null), [system, options, game]);
  const draw = useMemo(() => {
    const orbit = systemOrbit(system, biome => biomeFamily(facts, biome));
    const scene = {
      card,
      format,
      seed: orbit.seed,
      star: system.star,
      planets: orbit.planets,
      total: system.planetCount
    };
    return (canvas: HTMLCanvasElement) => {
      drawPostcard(canvas, scene);
    };
  }, [card, format, system, facts]);
  const stars = '★'.repeat(Math.max(0, Math.min(5, Math.round(system.rating))));
  const note = plainNote(system.notes, 60);
  return (
    <ShareShell
      title="Share this system"
      size={SHARE_FORMATS[format]}
      open={open}
      onClose={onClose}
      file={shareFileName(system.name, format)}
      shareTitle={system.name}
      label={`Postcard of ${system.name}: ${[card.eyebrow, ...card.lines].filter(Boolean).join(', ')}`}
      draw={draw}
      copy={() => {
        copyText(postcardText(card), `Copied ${system.name} as text.`);
      }}
    >
      <Segments
        label="Picture shape"
        hideLabel
        value={format}
        options={(Object.keys(SHARE_FORMATS) as ShareFormat[]).map(key => [key, SHARE_FORMATS[key].label])}
        onChange={value => {
          setFormat(value as ShareFormat); // the options above are the only values it can send
        }}
      />
      <ul className={CHOICES}>
        <Choice
          title="Planet names and biomes"
          detail="On the picture"
          on={options.planets}
          onChange={planets => {
            set({ planets });
          }}
        />
        <Choice
          title="My rating and tags"
          detail={[stars, ...system.tags].filter(Boolean).join(' · ') || 'None logged yet'}
          on={options.rating}
          onChange={rating => {
            set({ rating });
          }}
        />
        <Choice
          title="My notes"
          detail={note ? `“${note}”` : 'None written yet'}
          on={options.notes && Boolean(note)}
          disabled={!note}
          onChange={notes => {
            set({ notes });
          }}
        />
        <Choice
          title="Portal address"
          detail={system.glyphs || 'Not logged yet. Add it in the editor'}
          on={options.portal && Boolean(system.glyphs)}
          disabled={!system.glyphs}
          onChange={portal => {
            set({ portal });
          }}
        />
      </ul>
    </ShareShell>
  );
}

export function ShareShipSheet({ item, open, onClose }: { item: GearItem; open: boolean; onClose: () => void }) {
  const facts = useFacts();
  const game = useGameVersion();
  const [withNote, setWithNote] = useState(true);
  const note = plainNote(item.notes, 60);
  const kind = KINDS[item.kind].label;
  const draw = useMemo(() => {
    const rules = slotRules(facts, item.kind, item.class);
    const summary = rulesSummary(rules, item.kind, item.class, item.superchargedSlots);
    const card = fleetCard(item, kind, rules, summary?.status === 'match', withNote, game?.version ?? null);
    return (canvas: HTMLCanvasElement) => {
      drawFleetCard(canvas, card, FLEET_SIZE);
    };
  }, [item, kind, facts, withNote, game]);
  return (
    <ShareShell
      title={`Share this ${kind.toLowerCase()}`}
      size={FLEET_SIZE}
      open={open}
      onClose={onClose}
      file={shareFileName(item.name, 'fleet')}
      shareTitle={item.name}
      label={`Fleet card of ${item.name}: ${[item.type, kind].filter(Boolean).join(', ')}`}
      draw={draw}
    >
      <ul className={CHOICES}>
        <Choice
          title="The build"
          detail={note ? `“${note}”` : 'No note written yet'}
          on={withNote && Boolean(note)}
          disabled={!note}
          onChange={setWithNote}
        />
      </ul>
    </ShareShell>
  );
}
