// My glyphs (design 38, 38b) at #glyphs, under Settings › In the game: a switch per glyph the player has found. It
// only tells them which addresses they can dial (03c, 39b); it never stops them logging, editing or dialling.
import { HEX, glyphOf } from '@atlas/core/portal';
import { setAllGlyphsFound, setGlyphFound } from '../actions.ts';
import { useAppState } from '../useAppState.ts';
import { goBack } from '../shell/section-store.ts';
import { GlyphWikiLink, useGlyphTable } from './glyph-parts.tsx';

const BACK =
  'w-10 h-10 rounded-control bg-[rgba(5,8,17,0.7)] border border-hairline grid place-items-center text-ink hover:border-control-edge';
// The wiki's pages for where glyphs come from, in the offline Codex.
const codex = (path: string) => `wiki/#/a/${encodeURIComponent(path)}`;

export function MyGlyphs() {
  const { myGlyphs } = useAppState();
  const table = useGlyphTable();
  const mine = new Set(myGlyphs);
  return (
    <div className="flex flex-col gap-4 pt-[env(safe-area-inset-top)] lg:max-w-[640px] lg:mx-auto">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            goBack('more');
          }}
          aria-label="Back to Settings"
          className={BACK}
        >
          <i className="ph-bold ph-caret-left text-lg" aria-hidden="true" />
        </button>
        <span className="text-xs text-ink-muted">Settings › In the game</span>
      </div>
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-extrabold text-ink-bright">My glyphs</h1>
        <p className="m-0 text-sub leading-snug text-ink-muted">
          The glyphs you’ve found in the game. Only used to tell you which addresses you can dial; it never stops you
          logging anything.
        </p>
      </header>
      {myGlyphs.length ? (
        <div className="flex items-center gap-3">
          <span className="font-mono text-[22px] text-ink-bright">
            {myGlyphs.length}
            <span className="text-ink-disabled"> / 16</span>
          </span>
          <span aria-hidden="true" className="flex-1 h-1 rounded-full bg-hairline overflow-hidden">
            <i
              className="block h-full bg-scanner-cyan-glow"
              style={{ width: `${String((myGlyphs.length / 16) * 100)}%` }}
            />
          </span>
        </div>
      ) : (
        <div className="flex gap-2.5 items-start p-4 rounded-xl border border-hairline bg-panel text-[13px] leading-normal text-ink-soft">
          <i className="ph-bold ph-info mt-0.5 text-ink-muted" aria-hidden="true" />
          <p className="m-0">
            <b className="text-ink-bright text-sm">None yet.</b> You’ll find them at{' '}
            {/* Not in the mirror: the wiki's own page, in a new tab. */}
            <a
              href="https://nomanssky.fandom.com/wiki/Traveller_Grave"
              target="_blank"
              rel="noopener noreferrer"
              className="text-scanner-cyan-pale underline"
            >
              Traveller Graves
            </a>{' '}
            and in{' '}
            <a href={codex('wiki/missions/The_Purge.md')} className="text-scanner-cyan-pale underline">
              The Purge
            </a>
            . Mark each one here as you do, and ATLAS will tell you which addresses you can dial.
          </p>
        </div>
      )}
      <ul
        aria-label="Glyphs found"
        className="m-0 p-0 list-none rounded-card bg-panel border border-hairline divide-y divide-hairline overflow-hidden"
      >
        {Array.from(HEX).map(digit => {
          const glyph = glyphOf(table, digit);
          const name = glyph?.name ?? digit;
          const found = mine.has(digit);
          return (
            <li key={digit} className="flex items-center gap-3 min-h-14 pl-3.5 pr-3.5">
              <span aria-hidden="true" className="w-4 font-mono text-xs text-scanner-cyan-pale">
                {digit}
              </span>
              <span className="flex-1 min-w-0 py-2">
                <span className="block text-[15px] font-medium text-ink-bright">{name}</span>
                {glyph?.alt && <span className="block text-xs text-ink-muted">{glyph.alt}</span>}
              </span>
              <GlyphWikiLink table={table} digit={digit} className="w-11 h-11 rounded-control" />
              <button
                type="button"
                role="switch"
                aria-checked={found}
                aria-label={`${name} found`}
                onClick={() => {
                  setGlyphFound(digit, !found);
                }}
                className="switch"
              />
            </li>
          );
        })}
      </ul>
      {myGlyphs.length < 16 && (
        <button
          type="button"
          onClick={setAllGlyphsFound}
          className="h-12 w-full rounded-[14px] border border-control-edge bg-slate-ground text-sm font-semibold text-ink-bright hover:border-control-edge-hover"
        >
          I have all 16
        </button>
      )}
      <p className="m-0 text-[11px] text-ink-muted">
        Names from the wiki’s Glyph pages. Kept on this device and in your sync.
      </p>
    </div>
  );
}
