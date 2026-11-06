// Frontier (#frontier; design 26): what's still out there, from the log alone. Every first goes on the Traveller Card.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { planetFamily } from '@atlas/core/facts';
import { frontier, FAMILY_LABEL } from '@atlas/core/frontier';
import { RACES, STAR_CLASSES, type StarClass } from '@atlas/core/systems-model';
import { useAppState } from '../useAppState.ts';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { Button } from '../parts/Button.tsx';
import { PlanetMarker, StarMark } from '../parts/StarChart.tsx';
import { ShareShell } from '../share/ShareSheet.tsx';
import { CARD_EXPORT, drawFrontier } from '../share/draw.ts';
import { useSection } from '../shell/section-store.ts';

const STAR_ROW: StarClass[] = ['yellow', 'red', 'green', 'blue', 'purple'];
const CARD = 'rounded-card bg-panel-glass border border-hairline p-4 flex flex-col gap-3';
const EMPTY = 'border border-dashed border-control-edge text-ink-label grid place-items-center';

const Unknown = () => (
  <span role="img" aria-label="Not found yet" className={`${EMPTY} w-7 h-7 rounded-full text-xs font-semibold`}>
    ?
  </span>
);

function Collection({
  title,
  count,
  note,
  children
}: {
  title: string;
  count: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className={CARD} aria-label={title}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-display font-bold text-[15px] text-ink-bright">{title}</h2>
        <span className="font-mono text-sub text-scanner-cyan-pale">{count}</span>
      </header>
      {children}
      <p className="text-sub text-ink-muted">{note}</p>
    </section>
  );
}

export function Frontier() {
  const state = useAppState();
  const facts = useFacts();
  const shown = useSection() === 'frontier';
  useEffect(() => {
    if (shown) void loadFacts();
  }, [shown]);
  const view = useMemo(
    () => frontier({ systems: state.systems, gear: state.gear }, planet => planetFamily(facts, planet).family),
    [state, facts]
  );
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => {
    setSharing(false);
  }, []);
  const draw = useMemo(
    () => (canvas: HTMLCanvasElement) => {
      drawFrontier(canvas, view);
    },
    [view]
  );
  const families = Object.keys(FAMILY_LABEL) as (keyof typeof FAMILY_LABEL)[];
  const found = families.filter(kind => view.biomes.have.includes(kind));
  const stars = STAR_ROW.filter(star => view.stars.have.includes(star));
  return (
    <div className="flex flex-col gap-4 max-w-2xl pt-[env(safe-area-inset-top)]">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-screen-title text-ink-bright">Frontier</h1>
          <span className="rounded-full border border-[rgba(52,211,153,0.4)] bg-[rgba(16,185,129,0.12)] px-3 py-1 text-caption font-semibold text-ready-emerald-lit whitespace-nowrap">
            {view.firsts} first{view.firsts === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-sub text-ink-muted">
          What’s still out there for you. Every first goes on your Traveller Card.
        </p>
      </header>

      {view.next && (
        <a
          id="frontierNext"
          href={`wiki/#/?q=${encodeURIComponent(view.next.search)}`}
          className="rounded-card border border-[rgba(252,211,77,0.4)] bg-panel-glass p-4 flex items-center gap-4"
        >
          <span className="w-14 h-14 shrink-0 grid place-items-center" aria-hidden="true">
            <svg
              width="52"
              height="52"
              viewBox="-26 -26 52 52"
              fill="none"
              stroke={view.next.star ? STAR_CLASSES[view.next.star].color : '#94a3b8'}
            >
              <circle r="11" strokeDasharray="2 3" />
              <circle r="17" strokeOpacity="0.5" />
              <circle r="24" strokeOpacity="0.25" strokeDasharray="3 4" />
            </svg>
          </span>
          <span className="flex flex-col gap-1 min-w-0">
            <span className="text-label uppercase text-[#fcd34d]">Next first to chase</span>
            <span className="text-[17px] font-semibold text-ink-bright">{view.next.title}</span>
            <span className="text-sub text-ink-muted">{view.next.body}</span>
          </span>
        </a>
      )}

      <h2 className="text-label uppercase text-ink-label">Collections</h2>
      <Collection
        title="Star colours"
        count={`${String(stars.length)} / ${String(view.stars.total)}`}
        note={view.stars.note}
      >
        <div className="flex items-center justify-between h-14">
          {STAR_ROW.map((_, i) => {
            const star = stars[i];
            return star ? (
              <StarMark key={star} colour={star} r={7} label={`${STAR_CLASSES[star].label} star`} />
            ) : (
              <Unknown key={i} />
            );
          })}
        </div>
      </Collection>
      <Collection
        title="Biome families"
        count={`${String(found.length)} / ${String(view.biomes.total)}`}
        note={view.biomes.note}
      >
        <div className="flex items-center justify-between">
          {families.map((_, i) => {
            const kind = found[i];
            return kind ? (
              <span key={kind} role="img" aria-label={`${FAMILY_LABEL[kind]} world`}>
                <PlanetMarker family={kind} size={28} />
              </span>
            ) : (
              <Unknown key={i} />
            );
          })}
        </div>
      </Collection>
      <Collection
        title="Races met"
        count={`${String(view.races.have.length)} / ${String(view.races.total)}`}
        note={view.races.note}
      >
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: view.races.total }, (_, i) => {
            const race = view.races.have[i];
            return race ? (
              <span
                key={race}
                className="h-11 rounded-control border border-scanner-cyan-edge-strong bg-[rgba(34,211,238,0.12)] grid place-items-center text-sm font-semibold text-ink-bright"
              >
                {RACES[race]}
              </span>
            ) : (
              <span key={i} className={`${EMPTY} h-11 rounded-control text-sm`}>
                ?
              </span>
            );
          })}
        </div>
      </Collection>
      <Collection title="Starship types" count={`${String(view.ships.have.length)} logged`} note={view.ships.note}>
        <div className="flex flex-wrap gap-1.5">
          {view.ships.have.map(type => (
            <span
              key={type}
              className="h-9 px-3 rounded-control border border-[rgba(192,132,252,0.55)] bg-[rgba(126,34,206,0.2)] grid place-items-center text-xs font-semibold text-[#f3e8ff]"
            >
              {type}
            </span>
          ))}
          {Array.from({ length: view.ships.slots - view.ships.have.length }, (_, i) => (
            <span key={i} className={`${EMPTY} h-9 w-11 rounded-control text-xs`}>
              ?
            </span>
          ))}
        </div>
      </Collection>
      <Button
        icon="ph-sparkle"
        onClick={() => {
          setSharing(true);
        }}
      >
        Share my Frontier
      </Button>
      <ShareShell
        title="Share my Frontier"
        size={CARD_EXPORT}
        open={sharing}
        onClose={closeShare}
        file="my-frontier.png"
        shareTitle="My Frontier"
        label={`Frontier picture: ${String(view.firsts)} firsts`}
        draw={draw}
      >
        {null}
      </ShareShell>
    </div>
  );
}
