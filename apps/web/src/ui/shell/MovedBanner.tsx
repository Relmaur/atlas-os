// The old address's build (mode "pages", ADR-0010): ATLAS lives at atlas-os.cloud now. A log belongs to its address, so
// nothing moves by itself and nobody is redirected before they've had the chance to take theirs along.
import { exportState } from '../../app/backup.ts';

const NEW_HOME = 'https://atlas-os.cloud/app/';

export function MovedBanner() {
  if (import.meta.env.VITE_MOVED !== '1') return null;
  return (
    <div role="status" className="bg-slate-deep border-b border-scanner-cyan-edge px-4 py-3 text-sub text-ink">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="flex-1 min-w-[16rem]">
          ATLAS:OS has moved to atlas-os.cloud. Your log stays in this browser until you take it: export it here, then
          import it there.
        </p>
        <button type="button" onClick={exportState} className="font-semibold text-scanner-cyan-pale underline">
          Export your atlas
        </button>
        <a href={NEW_HOME} className="font-semibold text-scanner-cyan-pale underline">
          Open the new address
        </a>
      </div>
    </div>
  );
}
