// The Traveller Card's own screen (#card; Home tab): the card large, tilt to inspect, tap or Flip for its back, and full
// screen for the card alone. Tilt follows the pointer or the phone's motion and turns the whole card. iOS
// shows motion only after a permission prompt, which must come from a tap, so the first tap on the card asks. Reduced
// motion: no tilt, no pulses, and the flip is instant. From xl there's room for both faces, so nothing needs flipping,
// except in full screen, which is still the one card.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { goBack, useSection } from '../shell/section-store.ts';
import { shareFileName } from '@atlas/core/share';
import { Button } from '../parts/Button.tsx';
import { useMedia } from '../parts/useMedia.ts';
import { ShareShell } from '../share/ShareSheet.tsx';
import { CARD_EXPORT, drawTravellerExport } from '../share/draw.ts';
import { CardBack, CardFront } from './TravellerCard.tsx';
import { useTravellerCard } from './card-data.ts';

const STILL = '(prefers-reduced-motion: reduce)';
// The card's natural size, scaled as one piece in full screen so its type grows with it.
const CARD_W = 380;
const CARD_H = (CARD_W * 16) / 9;
const FLICK_PX = 70;
const FLICK_MS = 350;
const TAP_SLOP_PX = 10;
// A turn of the wrist this far is the full tilt.
const MOTION_DEG = 15;
// How slowly level follows the hand: slow enough that a held tilt stays visible.
const REST_MS = 10_000;

// iOS only, so it isn't in TypeScript's DOM types; the typeof check below is what proves it's callable.
type AskingOrientation = { requestPermission?: () => Promise<'granted' | 'denied'> };
const motionPrompt = () =>
  typeof DeviceOrientationEvent === 'undefined'
    ? undefined
    : (DeviceOrientationEvent as unknown as AskingOrientation).requestPermission;
const TOP_BUTTON =
  'w-11 h-11 rounded-control bg-slate-ground border border-control-edge grid place-items-center text-ink hover:border-control-edge-hover';
const LINK =
  'h-11 rounded-control bg-slate-ground border border-control-edge flex items-center justify-center gap-2 text-sm font-semibold text-ink hover:border-control-edge-hover';

// -0.5 … 0.5 across the card, as CSS variables, so a pointer move doesn't re-render the card.
function setTilt(stage: HTMLElement | null, x: number, y: number) {
  const clamp = (v: number) => Math.max(-0.5, Math.min(0.5, v));
  // Side by side there are two cards inside the stage, and each .card-stage sets its own variables: they don't inherit.
  for (const card of stage ? [stage, ...stage.querySelectorAll<HTMLElement>('.card-stage')] : []) {
    card.style.setProperty('--tilt-x', clamp(x).toFixed(3));
    card.style.setProperty('--tilt-y', clamp(y).toFixed(3));
  }
}

export function CardScreen() {
  const { card, art, lyPerRegion, game } = useTravellerCard();
  const [flipped, setFlipped] = useState(false);
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => {
    setSharing(false);
  }, []);
  const draw = useMemo(
    () => (canvas: HTMLCanvasElement) => {
      drawTravellerExport(canvas, {
        lines: art.lines,
        eyes: art.eyes,
        title: card.rank.title,
        sub: `${String(card.systems)} ${card.systems === 1 ? 'system' : 'systems'} · ${String(card.galaxies)} ${card.galaxies === 1 ? 'galaxy' : 'galaxies'}`,
        rarity: `CLASS ${card.cls}`
      });
    },
    [art, card]
  );
  const [still, setStill] = useState(() => matchMedia(STILL).matches);
  const [motionOn, setMotionOn] = useState(() => !motionPrompt());
  const [full, setFull] = useState(false);
  const roomForBoth = useMedia('(min-width: 1280px)');
  const both = roomForBoth && !full;
  const [scale, setScale] = useState(1);
  const asked = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const safeInsets = useRef<HTMLSpanElement>(null);
  const press = useRef<{ x: number; y: number; at: number; moved: boolean } | null>(null);
  const shown = useSection() === 'card';

  useEffect(() => {
    const media = matchMedia(STILL);
    const change = () => {
      setStill(media.matches);
    };
    media.addEventListener('change', change);
    return () => {
      media.removeEventListener('change', change);
    };
  }, []);

  // The phone's motion, measured from how it was first held, so any comfortable angle starts level. The rest position
  // drifts slowly after the hand, so a change of grip doesn't leave the card leaning.
  useEffect(() => {
    if (!shown || still || !motionOn) return;
    let rest: { beta: number; gamma: number; at: number } | null = null;
    const tilt = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      rest ??= { beta: event.beta, gamma: event.gamma, at: event.timeStamp };
      const drift = Math.min(1, (event.timeStamp - rest.at) / REST_MS);
      rest.at = event.timeStamp;
      rest.beta += (event.beta - rest.beta) * drift;
      rest.gamma += (event.gamma - rest.gamma) * drift;
      setTilt(
        stage.current,
        ((event.gamma - rest.gamma) / MOTION_DEG) * 0.5,
        ((event.beta - rest.beta) / MOTION_DEG) * 0.5
      );
    };
    window.addEventListener('deviceorientation', tilt);
    return () => {
      window.removeEventListener('deviceorientation', tilt);
    };
  }, [shown, still, motionOn]);

  // Must run inside a tap, or iOS refuses. It asks once; a no leaves finger tilt in full screen.
  const askMotion = () => {
    const prompt = motionPrompt();
    if (!prompt || asked.current || still) return;
    asked.current = true;
    prompt
      .call(DeviceOrientationEvent)
      .then(answer => {
        setMotionOn(answer === 'granted');
      })
      .catch(() => undefined);
  };

  const closeFull = useCallback(() => {
    setFull(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, []);
  const openFull = () => {
    askMotion();
    setFull(true);
    // Where the browser has it, this hides its own bars too. iPhones don't; an installed app has none to hide.
    const box = overlay.current;
    if (box && 'requestFullscreen' in box) box.requestFullscreen().catch(() => undefined);
  };
  useEffect(() => {
    if (!full) return;
    const fit = () => {
      const box = overlay.current?.getBoundingClientRect();
      const notch = safeInsets.current?.offsetTop ?? 0;
      if (box) setScale(Math.min(box.width / CARD_W, (box.height - notch * 2) / CARD_H));
    };
    fit();
    closeButton.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeFull();
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    window.addEventListener('resize', fit);
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.body.classList.add('overflow-hidden');
    return () => {
      window.removeEventListener('resize', fit);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.body.classList.remove('overflow-hidden');
    };
  }, [full, closeFull]);
  // Leaving the screen leaves full screen too.
  if (full && !shown) closeFull();

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (still) return;
    // Side by side, each card tilts from where the pointer is on the card under it.
    const under = event.target instanceof Element ? event.target.closest('.card-stage') : null;
    const rect = (under ?? event.currentTarget).getBoundingClientRect();
    setTilt(
      stage.current,
      (event.clientX - rect.left) / rect.width - 0.5,
      (event.clientY - rect.top) / rect.height - 0.5
    );
  };

  return (
    <div className="flex flex-col items-center gap-4 pt-[env(safe-area-inset-top)]">
      <header inert={full} className="w-full max-w-[380px] flex items-center justify-between gap-3 mt-4 lg:mt-0">
        <button
          type="button"
          onClick={() => {
            goBack('more');
          }}
          aria-label="Back"
          className="w-11 h-11 rounded-control bg-slate-ground border border-control-edge grid place-items-center text-ink hover:border-control-edge-hover"
        >
          <i className="ph-bold ph-caret-left text-lg" aria-hidden="true" />
        </button>
        <h1 className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-label">Traveller Card</h1>
        <button type="button" onClick={openFull} aria-label="Full screen" className={TOP_BUTTON}>
          <i className="ph-bold ph-corners-out text-lg" aria-hidden="true" />
        </button>
      </header>

      <div
        ref={overlay}
        {...(full ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Traveller Card, full screen' } : {})}
        className={full ? 'card-full' : 'contents'}
      >
        <span ref={safeInsets} className="card-full-inset" aria-hidden="true" />
        {full && (
          <>
            <button
              ref={closeButton}
              type="button"
              onClick={closeFull}
              aria-label="Close full screen"
              className="card-full-close"
            >
              <i className="ph-bold ph-x" aria-hidden="true" />
            </button>
            <p className="card-full-hint">Tap to flip · flick down to close</p>
          </>
        )}
        <div
          ref={stage}
          id="travellerCard"
          onPointerMove={event => {
            const start = press.current;
            if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP_PX) start.moved = true;
            onPointerMove(event);
          }}
          onPointerDown={event => {
            press.current = { x: event.clientX, y: event.clientY, at: event.timeStamp, moved: false };
          }}
          onPointerUp={event => {
            const start = press.current;
            if (full && start && event.clientY - start.y > FLICK_PX && event.timeStamp - start.at < FLICK_MS)
              closeFull();
          }}
          onPointerLeave={() => {
            setTilt(stage.current, 0, 0);
          }}
          onClick={event => {
            askMotion();
            if (press.current?.moved) return; // a drag to tilt, not a tap
            // A tap on the card flips it; its own controls (the back's tabs) don't.
            if (!both && (!(event.target instanceof Element) || !event.target.closest('button'))) setFlipped(!flipped);
          }}
          style={
            full
              ? {
                  width: CARD_W,
                  height: CARD_H,
                  flex: 'none',
                  transform: `scale(${scale.toFixed(3)})`,
                  touchAction: flipped ? 'pan-y' : 'none' // the front tilts under a finger; the back scrolls
                }
              : undefined
          }
          className={
            both
              ? 'flex justify-center gap-6 w-full'
              : `card-stage cursor-pointer select-none ${full ? '' : 'w-full max-w-[380px] aspect-[9/16]'}`
          }
        >
          {both ? (
            <>
              <div className="card-stage w-[380px] aspect-[9/16] shrink-0 select-none">
                <div className="card-tilt relative w-full h-full">
                  <section aria-label="Traveller Card, front" className="absolute inset-0">
                    <CardFront card={card} art={art} lyPerRegion={lyPerRegion} game={game} animate={shown && !still} />
                  </section>
                </div>
              </div>
              <div className="card-stage w-[380px] aspect-[9/16] shrink-0 select-none">
                <div className="card-tilt relative w-full h-full">
                  <section aria-label="Traveller Card, back" className="absolute inset-0">
                    <CardBack card={card} art={art} />
                  </section>
                </div>
              </div>
            </>
          ) : (
            <div className="card-tilt relative w-full h-full">
              <div className={`card-flip relative w-full h-full ${flipped ? 'is-flipped' : ''}`}>
                <section
                  aria-label="Traveller Card, front"
                  aria-hidden={flipped}
                  inert={flipped}
                  className="card-side absolute inset-0"
                >
                  <CardFront
                    card={card}
                    art={art}
                    lyPerRegion={lyPerRegion}
                    game={game}
                    animate={shown && !still && !flipped}
                  />
                </section>
                <section
                  aria-label="Traveller Card, back"
                  aria-hidden={!flipped}
                  inert={!flipped}
                  className="card-side card-side-back absolute inset-0"
                >
                  <CardBack card={card} art={art} />
                </section>
              </div>
            </div>
          )}
        </div>
      </div>

      <div inert={full} className="contents">
        <p className="text-caption text-ink-muted">{both ? 'Tilt to inspect' : 'Tilt to inspect · tap to flip'}</p>
        <div className={`w-full max-w-[380px] grid gap-2 ${both ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {!both && (
            <Button
              icon="ph-arrows-clockwise"
              onClick={() => {
                setFlipped(!flipped);
              }}
            >
              {flipped ? 'Show the front' : 'Flip'}
            </Button>
          )}
          <Button
            icon="ph-download-simple"
            onClick={() => {
              setSharing(true);
            }}
          >
            Share
          </Button>
        </div>
        <nav aria-label="More from your travels" className="w-full max-w-[380px] grid grid-cols-2 gap-2">
          <a href="#cards" className={LINK}>
            <i className="ph-bold ph-cards" aria-hidden="true" />
            Collection
          </a>
          <a href="#frontier" className={LINK}>
            <i className="ph-bold ph-compass" aria-hidden="true" />
            Frontier
          </a>
        </nav>
        <ShareShell
          title="Share your card"
          size={CARD_EXPORT}
          open={sharing}
          onClose={closeShare}
          file={shareFileName(card.rank.title, 'traveller-card')}
          shareTitle="My Traveller Card"
          label={`Traveller Card picture: ${card.rank.title}, class ${card.cls}`}
          draw={draw}
        >
          {null}
        </ShareShell>
      </div>
    </div>
  );
}
