// A system's conflict as the game shows it (round 8, c22): the level's stars and the map's word, "★★ Rowdy". The
// stars are ink, never the amber of ratings and economy strength; an outlaw system is a crimson pill with the skull
// and the map's word, because the game marks it as danger. Screen readers hear words: "Conflict: Rowdy, medium, 2 of
// 3", never "black star".
import type { ConflictReading } from '@atlas/core/galaxy-map';

/** 1–3 ink stars, hidden from screen readers (the words beside them say it). */
export function ConflictStars({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span aria-hidden="true" className="text-ink-soft tracking-[1px]">
      {'★'.repeat(n)}
    </span>
  );
}

/** "★★ Rowdy", or "Calm · level not set"; an outlaw reading draws the pill. */
export function ConflictText({ reading, size = 'S' }: { reading: ConflictReading; size?: 'S' | 'M' }) {
  if (reading.pirate) return <PiratePill text={reading.text} size={size} spoken={reading.spoken} />;
  return (
    <>
      <span aria-hidden="true">
        {reading.stars > 0 && (
          <>
            <ConflictStars n={reading.stars} />{' '}
          </>
        )}
        {reading.text}
        {reading.levelNotSet && <span className="text-[0.85em] text-ink-muted"> · level not set</span>}
      </span>
      <span className="sr-only">{reading.spoken}</span>
    </>
  );
}

/**
 * The outlaw system's pill: the skull and the map's word ("Pirate Controlled", or "Pirate (outlaw)"). Above the name
 * in a list it's `hidden` (the name says ", outlaw system" after itself, inside the row's one link); in a fact cell
 * it's read with `spoken`.
 */
export function PiratePill({
  text,
  size = 'S',
  hidden = false,
  spoken
}: {
  text: string;
  size?: 'S' | 'M';
  hidden?: boolean;
  spoken?: string;
}) {
  const height = size === 'M' ? 'h-[26px] pl-2 pr-2.5 text-[13px]' : 'h-6 pl-[7px] pr-[9px] text-[11.5px]';
  return (
    <>
      <span
        aria-hidden={hidden || spoken ? 'true' : undefined}
        className={`inline-flex items-center gap-[5px] w-fit shrink-0 rounded-full border font-bold whitespace-nowrap bg-[rgba(220,38,38,0.16)] border-[rgba(248,113,113,0.6)] text-danger-crimson-text ${height}`}
      >
        <i aria-hidden="true" className="ph-bold ph-skull text-[1.1em]" />
        {text}
      </span>
      {spoken && !hidden && <span className="sr-only">{spoken}</span>}
    </>
  );
}
