// Tags a row of systems or planets carries beside its name.
// - Not mapped yet (round 7c, c19 B): a dashed cyan tag, the map's "not placed yet" hue, never amber or rose. It's a
//   label inside a row that's already a link, never a second tap target; screen readers hear it after the name.
// - Infested (round 4b, c20): a neutral tag, never red (Infested isn't a hazard by itself), so the spore ring never
//   has to be decoded.

/** "No address" (a system) or "No glyph" (a planet), drawn above the name or at a one-line row's end. */
export function NotMappedTag({ what }: { what: 'system' | 'planet' }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center gap-1 h-5 pl-[5px] pr-[7px] rounded-full border border-dashed border-[rgba(103,232,249,0.6)] text-[#a5f3fc] text-[11px] font-semibold whitespace-nowrap shrink-0 w-fit"
    >
      <i className="ph-bold ph-map-pin-plus text-[12px]" />
      {what === 'system' ? 'No address' : 'No glyph'}
    </span>
  );
}

/** What a screen reader hears after the name, in place of the tag. */
export function NotMappedText({ what }: { what: 'system' | 'planet' }) {
  return (
    <span className="sr-only">
      {what === 'system' ? ', Not mapped: no portal address yet' : ', Not mapped: no planet glyph yet'}
    </span>
  );
}

export function InfestedTag() {
  return (
    <span className="h-[22px] px-2 rounded-full border border-control-edge bg-slate-ground text-ink-soft text-pill uppercase inline-flex items-center">
      Infested
    </span>
  );
}
