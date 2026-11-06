// Book 3: supercharged slots and Multi-Tool archetypes (hand-written playbook; see docs/STATE.md). General on purpose:
// a player's own ships and layouts belong in Ships & Multi-Tools and in notes pinned to this book.

export function Book3() {
  return (
    <>
      {/* 1. The 3 Golden Rules of Supercharged Slots */}
      <div className="hud-card rounded-2xl p-5 space-y-3">
        <h2 className="font-display font-bold text-base text-white border-b border-slate-800 pb-2.5">
          1. The 3 Golden Rules of Supercharged Slots
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <strong className="text-purple-300 block mb-1">Rule 1: Strictly Tied to Class</strong> Starships,
            Multi-Tools and Freighters get <strong>1 supercharged slot in Class C, 2 in B, 3 in A and 4 in S</strong>.
            Upgrading the class can reveal more, up to 4 at S-Class. The Exosuit and Exocraft always have{' '}
            <strong>3</strong>, in the same places for every player.
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900 border border-purple-500/40">
            <strong className="text-amber-300 block mb-1">Rule 2: Why a New Multi-Tool Can Show 0 SC Slots</strong>{' '}
            Their position is random, though <strong>almost always in the first 3 or 4 rows</strong> of the technology
            grid, and two can touch. A tool with only part of that grid unlocked can keep them in slots it hasn’t
            unlocked yet: they show up as the inventory grows.
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <strong className="text-cyan-300 block mb-1">Rule 3: Harmonic Camp Cabinet Lock</strong> Reloading a Save
            Beacon at the same Harmonic Camp <strong>never</strong> changes the cabinet's Class (a B-Class camp stays
            B-Class). Reloading on different planets only swaps the visual model between Sentinel Pistol and Sentinel
            Rifle.
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Rules 1 and 2 follow the wiki’s{' '}
          <a
            href="wiki/#/a/wiki%2Fmechanics%2FSupercharged_Slot.md"
            className="text-cyan-300 hover:text-cyan-200 underline"
          >
            Supercharged Slot
          </a>{' '}
          page; the slot picker in Ships &amp; Multi-Tools checks your marks against it.
        </p>
      </div>

      {/* 2. Choosing a flagship: the layout of its supercharged slots + an example grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 hud-card rounded-2xl p-5 space-y-4">
          <h2 className="font-display font-bold text-base text-white border-b border-slate-800 pb-2.5">
            2. Choosing a Flagship: Adjacent vs. Diagonal SC Slots
          </h2>
          <p className="text-xs text-slate-300">
            Two S-Class ships of the same type can be worlds apart: what matters is <em>where</em> their four
            supercharged slots sit. Keep the one whose slots touch; strip and scrap the other.
          </p>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2">Layout</th>
                <th className="py-2 text-emerald-400">🥇 Keep as flagship</th>
                <th className="py-2 text-amber-400">🥈 Strip & scrap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              <tr>
                <td className="py-2 font-semibold">SC slots</td>
                <td className="py-2 font-mono text-purple-300 font-bold">Three in a row (e.g. R2C2, R2C3, R2C4)</td>
                <td className="py-2 font-mono text-slate-400">Scattered or diagonal (e.g. R3C1, R2C2, R1C5)</td>
              </tr>
              <tr>
                <td className="py-2 font-semibold">Flat Edge Synergy</td>
                <td className="py-2 text-emerald-300 font-bold">Shared edges between SC slots</td>
                <td className="py-2 text-red-300">None (Diagonals don't count)</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400">
            Comparing two ships? Check their SC slots with the tech slots empty, since installed modules change the
            numbers on screen.
          </p>
        </div>

        <div className="lg:col-span-6 hud-card rounded-2xl p-5 space-y-4">
          <h2 className="font-display font-bold text-base text-purple-300 border-b border-slate-800 pb-2.5">
            Example: Infra-Knife Grid on Three SC Slots in a Row
          </h2>
          <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-mono break-words">
            <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/40">
              <span className="text-[10px] text-slate-400 block">Above, left</span>{' '}
              <strong className="text-cyan-300">S-Class Infra Mod #3</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/40">
              <span className="text-[10px] text-slate-400 block">Above, middle</span>{' '}
              <strong className="text-white">Q-Resonator (Tech)</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/40">
              <span className="text-[10px] text-slate-400 block">Above, right</span>{' '}
              <strong className="text-cyan-300">S-Class Infra Mod #2</strong>
            </div>
            <div className="p-3 rounded-xl sc-slot">
              <span className="text-[10px] text-purple-200 block">★ SC SLOT 1</span>{' '}
              <strong className="text-white">S-Class Infra Mod #1</strong>
            </div>
            <div className="p-3 rounded-xl sc-slot">
              <span className="text-[10px] text-purple-200 block">★ SC SLOT 2 (middle)</span>{' '}
              <strong className="text-amber-300">MAIN INFRA-KNIFE</strong>
            </div>
            <div className="p-3 rounded-xl sc-slot">
              <span className="text-[10px] text-purple-200 block">★ SC SLOT 3</span>{' '}
              <strong className="text-white">S-Class Infra Mod #2</strong>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            The weapon goes in the middle SC slot, its mods on either side and above. Put your{' '}
            <strong>Luminance Engine (Pulse Drive)</strong> or <strong>Hyperdrive</strong> upgrade into the fourth SC
            slot.
          </p>
        </div>
      </div>

      {/* 3. Multi-Tools: an example scanner layout, and the archetypes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 hud-card rounded-2xl p-5 space-y-4">
          <h2 className="font-display font-bold text-base text-cyan-300 border-b border-slate-800 pb-2.5">
            3. Example: Wiring a Scanner & Mining Multi-Tool
          </h2>
          <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-mono break-words">
            <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/40">
              <span className="text-[10px] text-slate-400 block">Left of SC</span>{' '}
              <strong className="text-cyan-300">S-Class Scanner Mod</strong>
            </div>
            <div className="p-3 rounded-xl sc-slot">
              <span className="text-[10px] text-purple-200 block">★ SC SLOT</span>{' '}
              <strong className="text-amber-300">Best S-Class Scanner</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/40">
              <span className="text-[10px] text-slate-400 block">Right of SC</span>{' '}
              <strong className="text-cyan-300">A-Class Scanner</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
              <span className="text-[10px] text-slate-400 block">Below, left</span>{' '}
              <strong className="text-white">Analysis Visor</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
              <span className="text-[10px] text-slate-400 block">Below SC</span>{' '}
              <strong className="text-white">Main Scanner Module</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
              <span className="text-[10px] text-slate-400 block">Below, right</span>{' '}
              <strong className="text-white">Survey Device</strong>
            </div>
          </div>
          <p className="text-xs text-emerald-300">
            <strong>Mining Yield Trick:</strong> Move your <strong>Optical Drill</strong> onto another Supercharged
            slot, surrounded by your green Mining Beam mods!
          </p>
        </div>

        <div className="lg:col-span-6 hud-card rounded-2xl p-5 space-y-3">
          <h2 className="font-display font-bold text-base text-white border-b border-slate-800 pb-2.5">
            Multi-Tool Archetype Meta
          </h2>
          <p className="text-xs text-slate-300">
            A Sentinel Long-Rifle is worth upgrading to <strong>S-Class (50k Nanites)</strong> and expanding with free
            Anomaly Expansion Slots. Sentinel Rifles have the <strong>highest base combat damage (+50%)</strong> AND let
            you install both the <strong>Hijacked Laser + Standard Mining Beam</strong> simultaneously for 2&times;
            mining speed and zero overheating!
          </p>
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Multi-Tool archetypes (scrolls sideways)"
          >
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-1.5">Archetype</th>
                  <th className="py-1.5">Damage</th>
                  <th className="py-1.5">Mining</th>
                  <th className="py-1.5">Scanner</th>
                  <th className="py-1.5">Best Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                <tr>
                  <td className="py-1.5 font-bold text-purple-300">Sentinel Rifle/Pistol</td>
                  <td>★ S+ (+50%)</td>
                  <td>Med (+15%)</td>
                  <td>High (+50%)</td>
                  <td>#1 Combat & Dual-Laser</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-bold text-cyan-300">Experimental / Royal</td>
                  <td>Med (+25%)</td>
                  <td>High (+30%)</td>
                  <td>★ S+ (+100%)</td>
                  <td>#1 Fauna Scanner</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-bold text-emerald-300">Atlantid (Runic)</td>
                  <td>Med (+20%)</td>
                  <td>★ S+ (+50%)</td>
                  <td>★ S+ (+100%)</td>
                  <td>#1 Pure Mining Speed</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-bold text-amber-300">Voltaic Staff</td>
                  <td>★ S+ (+50%)</td>
                  <td>Med (+20%)</td>
                  <td>High (+50%)</td>
                  <td>Tied #1 Heavy Combat</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
