// Each character of a portal address with its glyph's name, in dialling order, so a player can match the address to
// the portal's glyphs. Names only: the glyphs themselves are the game's art. The names come from the wiki's glyph
// pages (wiki/facts.json); until they load, or if they can't, the plate stays away and the address still reads.
import { useEffect } from 'react';
import { glyphNames } from '@atlas/core/glyphs';
import { loadFacts, useFacts } from '../gear/facts-store.ts';

const codexHref = (path: string) => `wiki/#/a/${encodeURIComponent(path)}`;

export function GlyphPlate({ glyphs, credit = 'link' }: { glyphs: string; credit?: 'link' | 'text' }) {
  const facts = useFacts();
  useEffect(() => {
    void loadFacts();
  }, []);
  const table = facts?.glyphs ?? null;
  const named = glyphNames(glyphs, table);
  if (!table || !named) return null;
  const source = 'Glyph names from the No Man’s Sky wiki';
  return (
    <div data-glyph-plate className="@container flex flex-col gap-1.5">
      <span aria-hidden="true" className="text-[11px] text-ink-muted">
        Portal order
      </span>
      {/* Screen readers hear the names; the tiles repeat the digits for the eye. */}
      <p className="sr-only">{`Portal order: ${named.map(glyph => glyph.name).join(', ')}.`}</p>
      <ol aria-hidden="true" className="grid grid-cols-6 @[40rem]:grid-cols-12 gap-1 m-0 p-0 list-none">
        {named.map((glyph, i) => (
          <li
            key={i}
            title={glyph.alt ? `${glyph.name}, also called ${glyph.alt}` : glyph.name}
            className="flex flex-col items-center gap-0.5 min-w-0 px-px py-1.5 rounded-[6px] bg-slate-ground border border-hairline"
          >
            <span className="font-mono text-[13px] leading-none text-quantity-cyan">{glyph.digit}</span>
            {/* "Dragonfly" is the longest name; a size down keeps it whole in the narrowest tile. */}
            <span
              className={`max-w-full leading-tight text-ink-soft text-center wrap-break-word ${glyph.name.length > 8 ? 'text-[9px] tracking-tight' : 'text-[10px]'}`}
            >
              {glyph.name}
            </span>
          </li>
        ))}
      </ol>
      {credit === 'link' ? (
        <a
          href={codexHref(table.path)}
          className="self-start text-[11px] text-scanner-cyan-pale hover:text-quantity-cyan underline"
        >
          {source}
        </a>
      ) : (
        <span className="text-[11px] text-ink-muted">{source}</span>
      )}
    </div>
  );
}
