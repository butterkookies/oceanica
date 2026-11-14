import { useState } from 'react';
import { AquariumScene } from './scene/AquariumScene';
import { TopBar } from './ui/TopBar';
import { VitalsPanel } from './ui/VitalsPanel';
import { CreatureInspector } from './ui/CreatureInspector';
import { DecorDock } from './ui/DecorDock';
import { CreatorModal } from './ui/CreatorModal';

export default function App() {
  const [creatorOpen, setCreatorOpen] = useState(false);

  return (
    <main className="relative h-full w-full overflow-hidden bg-slate-950">
      <AquariumScene />
      <TopBar onOpenCreator={() => setCreatorOpen(true)} />
      <VitalsPanel />
      <CreatureInspector />
      <DecorDock />
      <CreatorModal open={creatorOpen} onClose={() => setCreatorOpen(false)} />
    </main>
  );
}
