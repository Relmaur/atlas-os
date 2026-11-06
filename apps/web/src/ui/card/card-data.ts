// Everything the Traveller Card shows, from the log and the wiki's small indexes (cited facts, the galaxy list).
// Computed once per change of the log: the art traces a few thousand short steps.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { getFact, planetFamily } from '@atlas/core/facts';
import { firsts } from '@atlas/core/frontier';
import { travellerCard } from '@atlas/core/traveller';
import { currentArt } from '@atlas/core/current';
import { appState, getVersion, subscribe } from '../../app/store.ts';
import { loadFacts, useFacts } from '../gear/facts-store.ts';
import { loadGalaxies, useGalaxies } from '../systems/galaxies-store.ts';

export function useTravellerCard() {
  // The store mutates its arrays in place, so its version number is what says the log changed.
  const version = useSyncExternalStore(subscribe, getVersion);
  const facts = useFacts();
  const galaxies = useGalaxies();
  useEffect(() => {
    void loadFacts();
    void loadGalaxies();
  }, []);
  return useMemo(() => {
    const { systems, gear, notes, runs, checklists } = appState;
    const earned = firsts({ systems, gear }, planet => planetFamily(facts, planet).family);
    const card = travellerCard({ systems, gear, notes, runs, checklists }, earned, galaxies);
    return {
      card,
      art: currentArt(card.trip),
      lyPerRegion: getFact(facts, 'region-light-years')?.value ?? null,
      game: facts?.game ?? null
    };
  }, [version, facts, galaxies]);
}
