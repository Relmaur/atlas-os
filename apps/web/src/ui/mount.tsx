// Mounts the main page's React roots into index.html: the frame (header, sidebar, tab bar, storage banner) right
// away, and the screens once the state has loaded, so none flashes the built-in defaults.
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Home } from './home/Home.tsx';
import { Systems } from './systems/Systems.tsx';
import { SystemPanel } from './systems/SystemPanel.tsx';
import { SystemDetails } from './systems/SystemDetails.tsx';
import { PlanetDetails } from './systems/PlanetDetails.tsx';
import { MyGlyphs } from './portal/MyGlyphs.tsx';
import { Dialling } from './portal/Dialling.tsx';
import { PlanetSheet } from './systems/PlanetSheet.tsx';
import { Outlaw } from './outlaw/Outlaw.tsx';
import { Runs } from './runs/Runs.tsx';
import { MapScreen } from './map/Map.tsx';
import { CardScreen } from './card/CardScreen.tsx';
import { Collection } from './collection/Collection.tsx';
import { Frontier } from './frontier/Frontier.tsx';
import { Calculators } from './calculators/Calculators.tsx';
import { PlanScreen } from './calculators/Planner.tsx';
import { BestCrafts } from './calculators/BestCrafts.tsx';
import { Guides } from './guides/Guides.tsx';
import { Book } from './guides/Book.tsx';
import { More } from './more/More.tsx';
import { Gear } from './gear/Gear.tsx';
import { ShipDetail } from './gear/ShipDetail.tsx';
import { Notes } from './notes/Notes.tsx';
import { NoteScreen } from './notes/NoteEditor.tsx';
import { PlayerEditors } from './PlayerEditors.tsx';
import { ImportDialog } from './shell/ImportDialog.tsx';
import { BOOKS } from '@atlas/core/guides';
import { Header } from './shell/Header.tsx';
import { Sidebar } from './shell/Sidebar.tsx';
import { TabBar } from './shell/TabBar.tsx';
import { MovedBanner } from './shell/MovedBanner.tsx';
import { StorageBanner } from './shell/StorageBanner.tsx';
import { CapacityBanner } from './shell/CapacityBanner.tsx';
import { SessionBar } from './session/SessionBar.tsx';
import { Session } from './session/Session.tsx';
import { SessionSheet } from './session/SessionSheet.tsx';

const FRAME: [string, ReactNode][] = [
  ['headerRoot', <Header />],
  ['sidebarNav', <Sidebar />],
  ['tabBarRoot', <TabBar />],
  [
    'storageBannerRoot',
    <>
      <MovedBanner />
      <StorageBanner />
      <CapacityBanner />
    </>
  ],
  ['sessionBarRoot', <SessionBar />],
  ['sessionSheetRoot', <SessionSheet />]
];

const SCREENS: [string, ReactNode][] = [
  ['homeRoot', <Home />],
  ['systemsRoot', <Systems />],
  ['systemDetailRoot', <SystemDetails />],
  ['planetDetailRoot', <PlanetDetails />],
  ['myGlyphsRoot', <MyGlyphs />],
  ['diallingRoot', <Dialling />],
  ['sessionRoot', <Session />],
  ['mapRoot', <MapScreen />],
  ['cardRoot', <CardScreen />],
  ['cardsRoot', <Collection />],
  ['frontierRoot', <Frontier />],
  ['runsRoot', <Runs />],
  ['outlawRoot', <Outlaw />],
  ['calculatorsRoot', <Calculators />],
  ['planRoot', <PlanScreen />],
  ['craftsRoot', <BestCrafts />],
  ['systemPanelRoot', <SystemPanel />],
  ['planetSheetRoot', <PlanetSheet />],
  ['guidesRoot', <Guides />],
  ...BOOKS.map(({ key }): [string, ReactNode] => [`${key}Root`, <Book book={key} />]),
  ['moreRoot', <More />],
  ['gearRoot', <Gear />],
  ['shipRoot', <ShipDetail />],
  ['notesRoot', <Notes />],
  ['noteRoot', <NoteScreen />],
  [
    'playerEditorRoot',
    <>
      <PlayerEditors />
      <ImportDialog />
    </>
  ]
];

function mount(roots: [string, ReactNode][]): void {
  for (const [id, node] of roots) {
    const container = document.getElementById(id);
    if (container) createRoot(container).render(<StrictMode>{node}</StrictMode>);
  }
}

export function mountFrame(): void {
  mount(FRAME);
}

export function mountScreens(): void {
  mount(SCREENS);
}
