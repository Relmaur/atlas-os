// The main page's header below lg, on the screens that don't draw their own: the logo (back to Home), Settings, the
// session, and Export and Import (click, or drop a file). From lg the rail takes over and only the search stays mounted
// here, shown as a floating panel when the rail's key opens it.
import { useState } from 'react';
import { exportState, importState } from '../../app/backup.ts';
import { Search } from './Search.tsx';
import { showSection } from './section-store.ts';
import { openSession } from '../session/sheet-store.ts';
import { useAppState } from '../useAppState.ts';

export function Header() {
  const [dropping, setDropping] = useState(false);
  return (
    <div className="max-w-[1600px] mx-auto h-14 lg:h-0 px-4 sm:px-6 flex items-center gap-3 sm:gap-4">
      <a
        href="#home"
        onClick={event => {
          event.preventDefault();
          void showSection('home');
        }}
        className="lg:hidden flex items-center gap-3 shrink-0 min-w-0 rounded-lg"
      >
        <i className="ph-bold ph-diamond text-[22px] text-scanner-cyan-glow" aria-hidden="true" />
        <span className="font-display font-bold text-sm sm:text-base tracking-wider text-white whitespace-nowrap">
          ATLAS<span className="text-scanner-cyan-pale">:OS</span>
        </span>
      </a>

      <Search />

      <div className="lg:hidden ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Settings (More) has no tab: below lg it sits behind this gear. Search is on the tab bar's key. */}
        <a
          href="#more"
          aria-label="Settings"
          title="Settings"
          className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-900 md:bg-slate-900 md:border md:border-slate-800 md:hover:bg-slate-800 transition"
        >
          <i className="ph-bold ph-gear-six text-xl md:text-base" aria-hidden="true" />
        </a>
        <SessionButton
          id="sessionButton"
          className="w-10 h-10 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 md:bg-slate-900 md:border md:border-slate-800 md:hover:bg-slate-800"
        />
        <button
          type="button"
          onClick={exportState}
          title="Export your log"
          aria-label="Export your log"
          className="hidden md:flex h-10 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-emerald-300 items-center gap-2 transition"
        >
          <i className="ph-bold ph-download-simple text-base" aria-hidden="true" />
          <span className="hidden xl:inline">Export</span>
        </button>
        <label
          id="importDropzone"
          title="Import a log (click or drop the file here)"
          onDragOver={event => {
            event.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => {
            setDropping(false);
          }}
          onDrop={event => {
            event.preventDefault();
            setDropping(false);
            void importState(event.dataTransfer.files[0]);
          }}
          className={`hidden md:flex cursor-pointer h-10 px-3 rounded-xl hover:bg-slate-800 border border-dashed text-xs font-medium text-amber-300 items-center gap-2 transition focus-within:ring-2 focus-within:ring-cyan-400 ${dropping ? 'border-amber-400 bg-amber-500/10' : 'bg-slate-900 border-slate-700'}`}
        >
          <i className="ph-bold ph-upload-simple text-base" aria-hidden="true" />
          <span className="hidden xl:inline">Import</span>
          <input
            type="file"
            accept=".json,application/json"
            onChange={event => {
              void importState(event.target.files?.[0]);
              event.target.value = ''; // allow re-importing the same file
            }}
            className="sr-only"
            aria-label="Import a log"
          />
        </label>
      </div>
    </div>
  );
}

// Opens the Session screen (timers and the session), with a dot while something runs: cyan, or emerald once a timer is
// done. In the app header, and in Home's own header below lg (design 01's Timers button).
export function SessionButton({ id, className }: { id: string; className: string }) {
  const { session, timers } = useAppState();
  const active = session !== null || timers.length > 0;
  const done = timers.some(timer => timer.alerted); // announced and not yet dismissed
  return (
    <button
      type="button"
      id={id}
      onClick={openSession}
      aria-label={
        done ? 'Session and timers (a timer is done)' : active ? 'Session and timers (running)' : 'Session and timers'
      }
      title="Session and timers"
      className={`relative flex items-center justify-center transition ${className}`}
    >
      <i className="ph-bold ph-timer text-xl md:text-base" aria-hidden="true" />
      {active && (
        <span
          className={`absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-slate-950 ${done ? 'bg-emerald-400' : 'bg-cyan-400'}`}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
