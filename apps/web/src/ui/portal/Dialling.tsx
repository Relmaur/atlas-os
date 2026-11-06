// Dialling (design 39, 39b) at #dial/<system>: the address one glyph at a time, huge, for standing at a portal's
// keypad. Next and back by button, arrow key or swipe; the screen is kept on where the browser allows (Screen Wake
// Lock). A glyph not marked in My glyphs gets a note, never a block. Names only: no glyph is drawn.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { HEX, glyphOf, glyphWikiUrl } from '@atlas/core/portal';
import { useAppState } from '../useAppState.ts';
import { goBack, useSectionParam } from '../shell/section-store.ts';
import { useGlyphTable } from './glyph-parts.tsx';

const SECONDARY =
  'h-16 rounded-[14px] border border-control-edge bg-slate-ground text-sm font-semibold text-ink-bright inline-flex items-center justify-center gap-1.5 disabled:opacity-40';
const PRIMARY =
  'h-16 rounded-[14px] border border-ready-emerald-edge bg-ready-emerald-tint text-[17px] font-semibold text-ready-emerald-text inline-flex items-center justify-center gap-2 hover:bg-ready-emerald-tint-hover';

/** Keeps the screen on while dialling, where supported; says whether it is. */
function useWakeLock(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const take = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then(sentinel => {
          if (gone) {
            void sentinel.release();
            return;
          }
          lock = sentinel;
          setOn(true);
          sentinel.addEventListener('release', () => {
            setOn(false);
          });
        })
        .catch(() => {
          setOn(false); // refused (battery saver, a hidden tab): dialling still works
        });
    };
    take();
    // The browser drops the lock when the page is hidden; take it again on the way back.
    document.addEventListener('visibilitychange', take);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', take);
      void lock?.release();
    };
  }, []);
  return on;
}

// Each system dials from its first glyph: a new address starts a fresh screen.
export function Dialling() {
  const id = useSectionParam();
  return <DialSystem key={id} id={id} />;
}

function DialSystem({ id }: { id: string }) {
  const { systems, myGlyphs } = useAppState();
  const table = useGlyphTable();
  const system = systems.find(item => item.id === id);
  const [step, setStep] = useState(0);
  const awake = useWakeLock();
  const swipe = useRef<number | null>(null);
  const glyphs = system?.glyphs ?? '';
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setStep(at => Math.min(at + 1, 11));
      if (event.key === 'ArrowLeft') setStep(at => Math.max(at - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const stop = () => {
    goBack(system ? `system/${encodeURIComponent(system.id)}` : 'systems');
  };
  if (!system || glyphs.length !== 12) {
    return (
      <div className="fixed inset-0 z-[60] bg-[#020617] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-xl text-ink-bright">Nothing to dial</h1>
        <p className="m-0 text-sub text-ink-muted">This system has no portal address logged.</p>
        <button type="button" onClick={stop} className={`${SECONDARY} px-5 h-12`}>
          Back
        </button>
      </div>
    );
  }
  const digit = glyphs[step] ?? '0';
  const glyph = glyphOf(table, digit);
  const name = glyph?.name ?? digit;
  const nameAt = (at: number) => glyphOf(table, glyphs[at] ?? '')?.name ?? glyphs[at] ?? '';
  const planet = system.planetGlyphUnknown ? 'planet not known' : `planet ${String(HEX.indexOf(glyphs[0] ?? '0'))}`;
  const notFound = myGlyphs.length > 0 && !myGlyphs.includes(digit);
  const onPointerDown = (event: PointerEvent) => {
    swipe.current = event.clientX;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (swipe.current === null) return;
    const dx = event.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) < 50) return;
    setStep(at => (dx < 0 ? Math.min(at + 1, 11) : Math.max(at - 1, 0)));
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className="fixed inset-0 z-[60] flex flex-col bg-[#020617] pt-[env(safe-area-inset-top)] touch-pan-y"
    >
      <div className="flex items-center justify-between px-4 pt-5">
        <button
          type="button"
          onClick={stop}
          aria-label="Stop dialling"
          className="w-10 h-10 rounded-control bg-[rgba(5,8,17,0.7)] border border-hairline grid place-items-center text-ink hover:border-control-edge"
        >
          <i className="ph-bold ph-x text-lg" aria-hidden="true" />
        </button>
        {awake && (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <i className="ph-bold ph-sun-dim" aria-hidden="true" />
            Screen stays on
          </span>
        )}
      </div>
      <div className="px-5 pt-4 flex flex-col gap-1.5 w-full max-w-xl mx-auto">
        <h1 className="m-0 text-xs font-normal text-ink-muted">{`Dialling ${system.name} · ${planet}`}</h1>
        <div role="img" aria-label={`Glyph ${String(step + 1)} of 12`} className="flex gap-1 items-center">
          {Array.from(glyphs).map((_, at) => (
            <span
              key={at}
              className={`flex-1 rounded-full ${at < step ? 'h-1 bg-ready-emerald' : at === step ? 'h-2 bg-scanner-cyan-glow' : 'h-1 bg-hairline'}`}
            />
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-2.5 px-5 text-center">
        <span aria-hidden="true" className="font-mono text-[15px] tracking-[0.12em] text-scanner-cyan-pale">
          {`${String(step + 1)} OF 12`}
        </span>
        <p aria-live="polite" className="m-0 flex flex-col items-center gap-2">
          <span className="font-display text-[56px] font-extrabold leading-[1.05] text-ink-bright [overflow-wrap:anywhere]">
            {name}
          </span>
          {glyph?.alt && <span className="text-xl text-ink-soft">{glyph.alt}</span>}
        </p>
        <span aria-hidden="true" className="font-mono text-sm text-ink-muted">
          {`glyph ${String(HEX.indexOf(digit) + 1)} / 16 · digit ${digit}`}
        </span>
        <a
          href={glyphWikiUrl(digit)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 min-h-11 text-[13px] text-scanner-cyan-pale"
        >
          <i className="ph-bold ph-arrow-square-out" aria-hidden="true" />
          {`See ${name} on the wiki`}
        </a>
      </div>
      {notFound && (
        <p className="mx-5 mb-0 flex gap-2.5 items-start p-3 rounded-xl border border-units-amber-edge bg-units-amber-tint text-[12.5px] leading-normal text-units-amber-pale max-w-xl sm:mx-auto">
          <i className="ph-bold ph-warning mt-0.5" aria-hidden="true" />
          <span>
            You haven’t marked <b>{name}</b> as found, so the portal may not let you press it yet. It comes from a
            Traveller Grave or The Purge.{' '}
            <a href="#glyphs" className="text-units-amber-pale underline">
              My glyphs
            </a>
          </span>
        </p>
      )}
      <div className="grid grid-cols-[1fr_2fr] gap-2.5 px-5 pt-4 pb-2 w-full max-w-xl mx-auto">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => {
            setStep(at => Math.max(at - 1, 0));
          }}
          aria-label={step ? `Back to ${nameAt(step - 1)}` : 'Back'}
          className={SECONDARY}
        >
          <i className="ph-bold ph-caret-left" aria-hidden="true" />
          {step ? nameAt(step - 1) : ''}
        </button>
        {step < 11 ? (
          <button
            type="button"
            onClick={() => {
              setStep(at => Math.min(at + 1, 11));
            }}
            className={PRIMARY}
          >
            {`Next: ${nameAt(step + 1)}`}
          </button>
        ) : (
          <button type="button" onClick={stop} className={PRIMARY}>
            <i className="ph-bold ph-check" aria-hidden="true" />
            Done
          </button>
        )}
      </div>
      <p className="m-0 pb-[calc(1.75rem+env(safe-area-inset-bottom))] text-center text-xs text-ink-muted">
        Or swipe left and right
      </p>
    </div>
  );
}
