// The Card viewer (#cards, #cards/<id>; design 27): the collection one card at a time, with its neighbours peeking.
// Swipe for the next, tilt to inspect, tap to flip. On a wide screen the rail runs the full width and a mouse drags it
// like a swipe. Only the cards on screen draw their art, since a rosette is thousands of points and a log can hold
// hundreds of cards.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { collection, groupAddress, type CollectionCard } from '@atlas/core/collectible';
import { planetFamily } from '@atlas/core/facts';
import type { PlanetLike } from '@atlas/core/systems-model';
import { shareFileName } from '@atlas/core/share';
import { useAppState } from '../useAppState.ts';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { Button } from '../parts/Button.tsx';
import { ShareShell, copyText } from '../share/ShareSheet.tsx';
import { CARD_EXPORT, drawCollectionCard } from '../share/draw.ts';
import { goBack, useSection, useSectionParam } from '../shell/section-store.ts';
import { ArtSvg } from './ArtSvg.tsx';

const TOP_BUTTON =
  'w-11 h-11 rounded-control bg-slate-ground border border-control-edge grid place-items-center text-ink hover:border-control-edge-hover';
const ACTION =
  'h-[62px] rounded-control bg-slate-ground border border-control-edge flex flex-col items-center justify-center gap-1 text-xs font-semibold text-ink hover:border-control-edge-hover disabled:opacity-40';
const BADGE: Record<string, string> = {
  first: 'text-[#fde68a] border-[rgba(251,191,36,0.5)] bg-[rgba(245,158,11,0.12)]',
  fleet: 'text-[#fde68a] border-[rgba(251,191,36,0.5)] bg-[rgba(245,158,11,0.12)]'
};
// Everything but the rail keeps the phone's width, centred.
const COLUMN = 'w-full max-w-md mx-auto';
// A drag shorter than this is a tap (flip), not a swipe.
const DRAG = 6;
const RARITY: Record<string, string> = {
  logged: 'text-ink-label',
  addressed: 'text-scanner-cyan-pale',
  first: 'text-[#fcd34d]',
  fleet: 'text-[#e9d5ff]'
};

function Front({ card, near, active }: { card: CollectionCard; near: boolean; active: boolean }) {
  const art = useMemo(() => (near ? card.art() : null), [card, near]);
  return (
    <>
      <div className="absolute inset-0 overflow-hidden rounded-[inherit] bg-[#050a14]">
        {art && <ArtSvg art={art} animate={active} />}
      </div>
      {card.badge && (
        <span
          className={`absolute right-3.5 top-3.5 h-[26px] px-2.5 rounded-full border inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${BADGE[card.kind] ?? ''}`}
        >
          {card.kind === 'first' && <i className="ph-fill ph-star" aria-hidden="true" />}
          {card.badge}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 rounded-b-[inherit] px-4 pb-3.5 pt-11 flex flex-col gap-1.5 bg-gradient-to-b from-transparent via-[rgba(5,8,17,0.82)] to-[rgba(5,8,17,0.94)]">
        <h2 className="font-display font-bold text-lg leading-tight text-ink-bright break-words">{card.title}</h2>
        <p className="flex items-center justify-between gap-2">
          <span className="text-sub text-ink-muted truncate">{card.sub}</span>
          <span className={`text-[9px] font-bold tracking-[0.18em] whitespace-nowrap ${RARITY[card.kind] ?? ''}`}>
            {card.rarity}
          </span>
        </p>
      </div>
    </>
  );
}

function Back({ card, version }: { card: CollectionCard; version: string }) {
  return (
    <div className="absolute inset-0 rounded-[inherit] bg-slate-deep p-4 flex flex-col gap-2.5 overflow-y-auto">
      <p className="flex justify-between gap-2 text-[9px] font-bold tracking-[0.18em] text-ink-label">
        <span>{card.rarity}</span>
        {version && <span>v{version}</span>}
      </p>
      <h2 className="font-display font-bold text-xl leading-tight text-ink-bright break-words">{card.title}</h2>
      <p className="text-sub text-ink-muted">{card.place}</p>
      {card.address && (
        <p className="rounded-control border border-hairline bg-slate-ground px-3 py-2 flex flex-col gap-0.5">
          <span className="text-[9px] font-bold tracking-[0.18em] text-ink-label">PORTAL ADDRESS</span>
          <span className="font-mono text-sm tracking-[0.08em] text-scanner-cyan-pale">
            {groupAddress(card.address)}
          </span>
        </p>
      )}
      {card.pills.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {card.pills.map(pill => (
            <li key={pill} className="text-caption text-ink rounded-full border border-hairline px-2.5 py-0.5">
              {pill}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sub text-ink-muted">{card.note}</p>
      <a href={card.href} className="text-sub text-scanner-cyan-pale underline self-start">
        Open in your log
      </a>
      <p className="mt-auto font-mono text-[10px] tracking-[0.1em] text-ink-label">{card.seal}</p>
    </div>
  );
}

export function Collection() {
  const state = useAppState();
  const facts = useFacts();
  const shown = useSection() === 'cards';
  const param = useSectionParam();
  const family = useCallback((planet: PlanetLike) => planetFamily(facts, planet).family, [facts]);
  const infestedOf = useCallback((planet: PlanetLike) => planetFamily(facts, planet).infested, [facts]);
  const cards = useMemo(
    () => (shown ? collection({ systems: state.systems, gear: state.gear }, family, infestedOf) : []),
    [shown, state, family, infestedOf]
  );
  useEffect(() => {
    if (shown) void loadFacts();
  }, [shown]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sharing, setSharing] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  // How many cards either side of the one in view are on screen: 1 on a phone, more across a desktop.
  const [reach, setReach] = useState(1);
  const drag = useRef<{ x: number; left: number; from: number; moved: boolean } | null>(null);
  const closeShare = useCallback(() => {
    setSharing(false);
  }, []);

  const goTo = useCallback((next: number, smooth = true) => {
    const slide = rail.current?.children[next];
    if (slide instanceof HTMLElement)
      slide.scrollIntoView({ inline: 'center', block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  // A link to one card opens there; a card that's gone leaves the first.
  useEffect(() => {
    if (!param) return;
    const at = cards.findIndex(card => card.id === param);
    if (at >= 0) goTo(at, false); // the rail's scroll then says which card is in view
  }, [param, cards, goTo]);

  useEffect(() => {
    const box = rail.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const slide = box.firstElementChild;
      const width = slide instanceof HTMLElement ? slide.offsetWidth : 0;
      setReach(width ? Math.max(1, Math.ceil(box.clientWidth / width / 2)) : 1);
    };
    const watch = new ResizeObserver(measure);
    watch.observe(box);
    return () => {
      watch.disconnect();
    };
  }, [shown, cards.length]);

  const nearest = () => {
    const box = rail.current;
    if (!box) return 0;
    const middle = box.scrollLeft + box.clientWidth / 2;
    let best = 0;
    let bestGap = Infinity;
    Array.from(box.children).forEach((child, i) => {
      if (!(child instanceof HTMLElement)) return;
      const gap = Math.abs(child.offsetLeft + child.offsetWidth / 2 - middle);
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    });
    return best;
  };
  const onScroll = () => {
    const best = nearest();
    if (best !== index) {
      setIndex(best);
      setFlipped(false);
    }
  };
  // A mouse has no swipe: dragging the rail moves it, and letting go settles on a card, at least the next one over.
  const onRailDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, from: index, moved: false };
  };
  const onRailMove = (event: PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (!held) return;
    const dx = event.clientX - held.x;
    if (!held.moved && Math.abs(dx) < DRAG) return;
    if (!held.moved) {
      held.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.style.scrollSnapType = 'none'; // snapping would fight the hand
    }
    event.currentTarget.scrollLeft = held.left - dx;
  };
  const onRailUp = (event: PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    drag.current = null;
    if (!held?.moved) return;
    event.currentTarget.style.scrollSnapType = '';
    const dx = event.clientX - held.x;
    let next = nearest();
    if (next === held.from && Math.abs(dx) > 40) next = held.from + (dx < 0 ? 1 : -1);
    goTo(Math.max(0, Math.min(next, cards.length - 1)));
    // The click that ends a drag isn't a tap on a card.
    const swallow = (click: MouseEvent) => {
      click.stopPropagation();
      click.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => {
      window.removeEventListener('click', swallow, { capture: true });
    }, 0);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--tilt-x', ((event.clientX - box.left) / box.width - 0.5).toFixed(3));
    event.currentTarget.style.setProperty('--tilt-y', ((event.clientY - box.top) / box.height - 0.5).toFixed(3));
  };
  const card = cards[index];
  const draw = useMemo(
    () =>
      card
        ? (canvas: HTMLCanvasElement) => {
            drawCollectionCard(canvas, card, card.art());
          }
        : () => undefined,
    [card]
  );
  const version = facts?.game?.version ?? '';

  const top = (
    <div className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 ${COLUMN}`}>
      <button
        type="button"
        aria-label="Back"
        onClick={() => {
          goBack('card');
        }}
        className={TOP_BUTTON}
      >
        <i className="ph-bold ph-caret-left text-lg" aria-hidden="true" />
      </button>
      <p className="text-center flex flex-col">
        <span className="text-label uppercase text-ink-label">Collection</span>
        <span id="collectionPosition" className="font-mono text-sub text-ink">
          {cards.length ? `${String(index + 1)} of ${String(cards.length)}` : 'No cards yet'}
        </span>
      </p>
      <span className="w-11" />
    </div>
  );
  if (!shown) return null;
  if (!card)
    return (
      <div className="flex flex-col gap-section max-w-2xl pt-[env(safe-area-inset-top)]">
        {top}
        <div className="rounded-card border border-dashed border-control-edge p-6 flex flex-col items-start gap-3">
          <h2 className="font-display font-bold text-lg text-ink-bright">Your collection starts here</h2>
          <p className="text-sub text-ink-muted">Every system you log and every ship you add becomes a card.</p>
          <a href="#systems" className="text-sub text-scanner-cyan-pale underline">
            Log your first system
          </a>
        </div>
      </div>
    );
  const first = Math.max(0, Math.min(index - 2, cards.length - 5));
  const dots = cards.slice(first, first + 5);
  return (
    <div className="flex flex-col gap-3 pt-[env(safe-area-inset-top)]">
      {top}
      <div
        ref={rail}
        id="cardRail"
        onScroll={onScroll}
        tabIndex={0}
        role="group"
        aria-label="Your cards"
        onPointerDown={onRailDown}
        onPointerMove={onRailMove}
        onPointerUp={onRailUp}
        onPointerCancel={onRailUp}
        onKeyDown={event => {
          if (event.key === 'ArrowRight') goTo(Math.min(index + 1, cards.length - 1));
          else if (event.key === 'ArrowLeft') goTo(Math.max(index - 1, 0));
          else return;
          event.preventDefault();
        }}
        className="card-rail relative -mx-4 sm:-mx-6 lg:-mx-8 px-[9%] sm:px-[calc(50%-170px)] lg:px-[calc(50%-150px)] flex gap-3 overflow-x-auto"
      >
        {cards.map((item, i) => {
          const active = i === index;
          return (
            <div key={item.id} className="snap-center shrink-0 w-[82%] sm:w-[340px] lg:w-[300px]">
              <div
                onPointerMove={active ? onPointerMove : undefined}
                onClick={event => {
                  if (!active) goTo(i);
                  else if (!(event.target instanceof Element) || !event.target.closest('a')) setFlipped(!flipped);
                }}
                className="card-stage aspect-[300/420] cursor-pointer select-none"
              >
                <div
                  className={`card-flip collect-card relative w-full h-full ${active && flipped ? 'is-flipped' : ''}`}
                >
                  <section
                    aria-label={`${item.title}, front`}
                    aria-hidden={!active || flipped}
                    inert={!active || flipped}
                    className={`card-side absolute inset-0 rounded-[20px] finish-${item.kind}`}
                  >
                    <Front card={item} near={Math.abs(i - index) <= reach} active={active} />
                  </section>
                  <section
                    aria-label={`${item.title}, back`}
                    aria-hidden={!active || !flipped}
                    inert={!active || !flipped}
                    className={`card-side card-side-back absolute inset-0 rounded-[20px] finish-${item.kind}`}
                  >
                    {active && <Back card={item} version={version} />}
                  </section>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={`flex justify-center items-center gap-2 ${COLUMN}`} aria-hidden="true">
        {dots.map(item => (
          <span
            key={item.id}
            className={`h-1.5 rounded-full ${item.id === card.id ? 'w-[18px] bg-scanner-cyan-pale' : 'w-1.5 bg-control-edge'}`}
          />
        ))}
      </div>
      <p className={`text-caption text-ink-muted text-center ${COLUMN}`}>
        <span className="pointer-fine:hidden">Tilt to inspect · tap to flip · swipe for the next card</span>
        <span className="hidden pointer-fine:inline">
          Tilt to inspect · click to flip · drag or use ← → for the next card
        </span>
      </p>
      <div
        id="cardTrust"
        className={`rounded-card border border-hairline bg-panel-glass px-3.5 py-3 flex items-center justify-between gap-3 ${COLUMN}`}
      >
        <span className="flex flex-col gap-0.5 min-w-0">
          <span className={`text-label uppercase ${RARITY[card.kind] ?? ''}`}>{card.trust}</span>
          <span className="text-caption text-ink-muted truncate">{card.place}</span>
        </span>
        {card.address && (
          <span className="font-mono text-[11px] tracking-[0.1em] text-scanner-cyan-pale whitespace-nowrap">
            {groupAddress(card.address)}
          </span>
        )}
      </div>
      <div className={`grid grid-cols-3 gap-2 ${COLUMN}`}>
        <button
          type="button"
          onClick={() => {
            setFlipped(!flipped);
          }}
          className={ACTION}
        >
          <i className="ph-bold ph-arrows-clockwise text-lg" aria-hidden="true" />
          Flip
        </button>
        <button
          type="button"
          onClick={() => {
            setSharing(true);
          }}
          className={ACTION}
        >
          <i className="ph-bold ph-download-simple text-lg" aria-hidden="true" />
          Share
        </button>
        <button
          type="button"
          disabled={!card.address}
          onClick={() => {
            copyText(card.address, `Copied the portal address ${groupAddress(card.address)}.`);
          }}
          className={ACTION}
        >
          <i className="ph-bold ph-link-simple text-lg" aria-hidden="true" />
          Copy address
        </button>
      </div>
      <Button
        variant="ghost"
        icon="ph-compass"
        className={COLUMN}
        onClick={() => {
          location.hash = '#frontier';
        }}
      >
        What’s still out there
      </Button>
      <ShareShell
        title="Share this card"
        size={CARD_EXPORT}
        open={sharing}
        onClose={closeShare}
        file={shareFileName(card.title, 'card')}
        shareTitle={card.title}
        label={`Card of ${card.title}: ${card.rarity}`}
        draw={draw}
      >
        {null}
      </ShareShell>
    </div>
  );
}
