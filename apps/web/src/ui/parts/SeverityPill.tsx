// The severity pill (component c15, option A): how bad the weather or the sentinels are, in the wiki's own levels.
// Quiet for Clear, Normal, Low and High; crimson with the warning mark for Extreme, Aggressive and Corrupted, the
// game's danger. The word always carries the meaning: colour is never alone.
export function SeverityPill({
  children,
  danger,
  size = 'S'
}: {
  children: string;
  danger: boolean;
  size?: 'S' | 'M';
}) {
  const height = size === 'M' ? 'h-[26px] px-2.5 text-[13px]' : 'h-[22px] px-2 text-[11px]';
  return (
    <span
      className={`inline-flex items-center gap-1 shrink-0 rounded-full border font-semibold whitespace-nowrap ${height} ${
        danger
          ? 'bg-danger-crimson-tint border-danger-crimson-edge text-danger-crimson-text'
          : 'bg-transparent border-control-edge text-ink-soft'
      }`}
    >
      {danger && <i aria-hidden="true" className="ph-bold ph-warning text-[0.95em]" />}
      {children}
    </span>
  );
}
