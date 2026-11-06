// The desktop nav (round 6, d01 and d02), from 1024: a floating rail of grouped icons with a name and count on hover,
// or, opened (Ctrl+\), a sidebar that pushes the panes aside with section names, counts and a few shortcuts into the
// log. Below lg the tab bar does this job. Search opens the palette (Ctrl K).
import { formatAgo } from '@atlas/core/format';
import { lastVisit, type System } from '@atlas/core/systems-model';
import type { ReactNode } from 'react';
import { useSyncStatus } from '../../app/sync.ts';
import { useAppState } from '../useAppState.ts';
import { StarDot } from '../parts/SystemBits.tsx';
import { openRunEditor } from '../runs/run-editor-store.ts';
import { useLoaded, useOutlawReady } from './counts.ts';
import { toggleNav, useNavOpen } from './nav-store.ts';
import { toggleSearch, useSearchOpen } from './Search.tsx';
import { useSection } from './section-store.ts';

interface Item {
  href: string;
  icon: string;
  label: string;
  sections: string[]; // the screens that light it
  count?: string | undefined;
  dot?: string; // why the dot shows, for screen readers
}
interface Group {
  label: string;
  items: Item[];
}

const latest = (system: System): string => lastVisit(system)?.at ?? system.createdAt;
// "40h ago" → "40h": the sidebar's count column is narrow.
const short = (iso: string): string => formatAgo(iso).replace(/ ago$/, '');

function useGroups(): Group[] {
  const { systems, gear, notes, runs, timers, session, myGlyphs } = useAppState();
  const loaded = useLoaded();
  const { ready } = useOutlawReady();
  const count = (n: number) => (loaded ? n.toLocaleString() : undefined);
  const live = timers.length + (session ? 1 : 0);
  return [
    {
      label: 'Now',
      items: [
        { href: '#home', icon: 'ph-house', label: 'Home', sections: ['home'] },
        {
          href: '#session',
          icon: 'ph-timer',
          label: 'Session & timers',
          sections: ['session'],
          ...(timers.length ? { count: count(timers.length) } : {}),
          ...(live ? { dot: session ? 'a session is on' : 'timers running' } : {})
        }
      ]
    },
    {
      label: 'Log',
      items: [
        {
          href: '#systems',
          icon: 'ph-planet',
          label: 'Systems',
          sections: ['systems', 'system', 'planet', 'dial'],
          count: count(systems.length)
        },
        { href: '#map', icon: 'ph-map-trifold', label: 'Map', sections: ['map'] },
        {
          href: '#gear',
          icon: 'ph-rocket-launch',
          label: 'Fleet',
          sections: ['gear', 'ship'],
          count: count(gear.length)
        },
        { href: '#notes', icon: 'ph-note', label: 'Notes', sections: ['notes', 'note'], count: count(notes.length) }
      ]
    },
    {
      label: 'Runs & tools',
      items: [
        {
          href: '#runs',
          icon: 'ph-path',
          label: 'Runs',
          sections: ['runs', 'outlaw'],
          count: count(runs.length + 1), // Outlaw stations is built in
          ...(ready ? { dot: `${String(ready)} ${ready === 1 ? 'station' : 'stations'} ready` } : {})
        },
        { href: '#calculators', icon: 'ph-list-checks', label: 'Recipe planner', sections: ['calculators', 'plan'] },
        { href: '#crafts', icon: 'ph-coins', label: 'Best crafts', sections: ['crafts'] }
      ]
    },
    {
      label: 'Knowledge',
      items: [
        { href: 'wiki/', icon: 'ph-books', label: 'Codex', sections: [] },
        {
          href: '#guides',
          icon: 'ph-book-open-text',
          label: 'Guides',
          sections: ['guides', 'book1', 'book2', 'book3', 'book4', 'book5', 'book6']
        }
      ]
    },
    {
      label: 'You',
      items: [
        { href: '#card', icon: 'ph-identification-card', label: 'Traveller Card', sections: ['card', 'cards'] },
        { href: '#frontier', icon: 'ph-compass', label: 'Frontier', sections: ['frontier'] },
        {
          href: '#glyphs',
          icon: 'ph-circles-four',
          label: 'My glyphs',
          sections: ['glyphs'],
          ...(loaded && myGlyphs.length ? { count: `${String(myGlyphs.length)}/16` } : {})
        }
      ]
    }
  ];
}

function SyncLine() {
  const sync = useSyncStatus();
  const { devices } = useAppState();
  if (!sync.enabled) return null;
  const [icon, text, tone] = sync.problem
    ? [
        'ph-warning-circle',
        sync.problem === 'offline' ? 'Offline · will sync' : 'Sync needs you',
        'text-units-amber-text'
      ]
    : sync.busy
      ? ['ph-arrows-clockwise', 'Syncing…', 'text-ink-muted']
      : [
          'ph-cloud-check',
          devices.length > 1 ? `Synced · ${String(devices.length)} devices` : 'Synced',
          'text-ready-emerald-pale'
        ];
  return (
    <a href="#more" className={`nav-link ${tone}`}>
      <i className={`ph-bold ${icon}`} aria-hidden="true" />
      <span className="nav-name">{text}</span>
    </a>
  );
}

function Link({ item, open, at, children }: { item: Item; open: boolean; at: string; children?: ReactNode }) {
  const current = item.sections.includes(at);
  const spoken = [item.label, item.count && !item.count.includes('/') ? item.count : '', item.dot ?? '']
    .filter(Boolean)
    .join(', ');
  return (
    <>
      <a
        href={item.href}
        aria-current={current ? 'page' : undefined}
        aria-label={open ? undefined : spoken}
        className="nav-link"
      >
        <span className="nav-icon">
          <i className={`ph-bold ${item.icon}`} aria-hidden="true" />
          {!open && item.dot && <span className="nav-dot" aria-hidden="true" />}
        </span>
        {open ? (
          <>
            <span className="nav-name">{item.label}</span>
            {item.dot && <span className="nav-dot-inline" aria-hidden="true" />}
            {item.dot && <span className="sr-only">{`, ${item.dot}`}</span>}
            {item.count && <span className="nav-count">{item.count}</span>}
          </>
        ) : (
          <span className="nav-tip" aria-hidden="true">
            {item.label}
            {item.count && <span className="nav-count">{item.count}</span>}
          </span>
        )}
      </a>
      {open && current && children}
    </>
  );
}

// Under Systems when the sidebar is open: where you are and the two before it.
function RecentSystems() {
  const { systems } = useAppState();
  const recent = [...systems].sort((a, b) => latest(b).localeCompare(latest(a))).slice(0, 3);
  return (
    <>
      {recent.map((system, i) => (
        <a key={system.id} href={`#system/${encodeURIComponent(system.id)}`} className="nav-link nav-sub">
          <StarDot system={system} size="w-[7px] h-[7px]" />
          <span className="nav-name">{system.name}</span>
          <span className="nav-count">{i === 0 ? 'here' : short(latest(system))}</span>
        </a>
      ))}
    </>
  );
}

function RunShortcuts() {
  return (
    <>
      <a href="#outlaw" className="nav-link nav-sub">
        <i className="ph-bold ph-plus" aria-hidden="true" />
        <span className="nav-name">Outlaw stations</span>
      </a>
      <button
        type="button"
        onClick={() => {
          openRunEditor();
        }}
        className="nav-link nav-sub"
      >
        <i className="ph-bold ph-plus" aria-hidden="true" />
        <span className="nav-name">New run</span>
      </button>
    </>
  );
}

export function WorkbenchNav() {
  const open = useNavOpen();
  const at = useSection();
  const searching = useSearchOpen();
  const groups = useGroups();
  const toggle = (
    <button
      type="button"
      onClick={toggleNav}
      aria-expanded={open}
      aria-label={open ? 'Close the sidebar (Ctrl \\)' : 'Open the sidebar (Ctrl \\)'}
      className="nav-link nav-toggle"
    >
      <span className="nav-icon">
        <i className="ph-bold ph-sidebar-simple" aria-hidden="true" />
      </span>
      {!open && (
        <span className="nav-tip" aria-hidden="true">
          Open the sidebar <kbd className="nav-kbd">Ctrl \</kbd>
        </span>
      )}
    </button>
  );
  return (
    <nav aria-label="Primary" className={`workbench-nav ${open ? 'is-open' : ''}`}>
      {open && (
        <div className="nav-head">
          <span className="font-display font-extrabold text-[13px] tracking-[0.18em] text-ink-bright">
            ATLAS<span className="text-scanner-cyan-glow">:</span>OS
          </span>
          {toggle}
        </div>
      )}
      <button
        type="button"
        onClick={toggleSearch}
        aria-expanded={searching}
        aria-label={open ? undefined : 'Search and quick actions (Ctrl K)'}
        className="nav-link nav-search"
      >
        <span className="nav-icon">
          <i className="ph-bold ph-magnifying-glass" aria-hidden="true" />
        </span>
        {open ? (
          <>
            <span className="nav-name">Search</span>
            <kbd className="nav-kbd">Ctrl K</kbd>
          </>
        ) : (
          <span className="nav-tip" aria-hidden="true">
            Search <kbd className="nav-kbd">Ctrl K</kbd>
          </span>
        )}
      </button>
      <div className="nav-groups">
        {groups.map(group => (
          <div key={group.label} role="group" aria-label={group.label} className="nav-group">
            {open && (
              <span className="nav-section" aria-hidden="true">
                {group.label}
              </span>
            )}
            {group.items.map(item => (
              <Link key={item.label} item={item} open={open} at={at}>
                {item.label === 'Systems' ? <RecentSystems /> : item.label === 'Runs' ? <RunShortcuts /> : null}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="nav-foot">
        <Link
          item={{ href: '#more', icon: 'ph-gear-six', label: 'Settings', sections: ['more'] }}
          open={open}
          at={at}
        />
        {open ? <SyncLine /> : toggle}
      </div>
    </nav>
  );
}
