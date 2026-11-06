// The Log tab's segmented control, at the top of Systems, Map, Fleet and Notes, below lg only: from lg the nav lists
// them (round 6). It's navigation, not a setting, so the
// open segment takes the scanner cyan of the active tab (with aria-current), not the emerald of a selected segment.
import { useSection } from '../shell/section-store.ts';

// A detail screen keeps its list's segment lit: from lg they sit side by side.
const PARENT: Record<string, string> = { system: 'systems', ship: 'gear', note: 'notes' };
const SEGMENTS = [
  { section: 'systems', label: 'Systems' },
  { section: 'map', label: 'Map' },
  { section: 'gear', label: 'Fleet' },
  { section: 'notes', label: 'Notes' }
] as const;

export function LogSegment() {
  const section = useSection();
  const open = PARENT[section] ?? section;
  return (
    <nav
      aria-label="Log sections"
      className="lg:hidden flex gap-1 p-1 rounded-control bg-slate-ground border border-hairline max-w-xl"
    >
      {SEGMENTS.map(({ section: segment, label }) => (
        <a
          key={segment}
          href={`#${segment}`}
          aria-current={open === segment ? 'page' : undefined}
          className={`flex-1 h-[34px] rounded-segment border flex items-center justify-center text-control transition-colors duration-[var(--duration-micro)] ${
            open === segment
              ? 'bg-scanner-cyan-tint border-scanner-cyan-edge text-scanner-cyan-text'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
