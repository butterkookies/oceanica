import { Eye, HeartPulse, Trash2, Video, X } from 'lucide-react';
import { useQuery, useTrait, useWorld } from 'koota/react';
import type { Entity } from 'koota';
import {
  CreatureDna,
  CreatureMeta,
  CreatureVitals,
  IsFish,
  IsSnail,
  TankEnvironment,
} from '../ecs/traits';
import { persistWorldState } from '../ecs/world';

function InspectorCard({ entity, followEntityId }: { entity: Entity; followEntityId: number }) {
  const world = useWorld();
  const meta = useTrait(entity, CreatureMeta);
  const dna = useTrait(entity, CreatureDna);
  const vitals = useTrait(entity, CreatureVitals);

  if (!meta || !dna || !vitals) return null;

  const isFollowing = followEntityId === entity.id();

  const toggleFollow = () => {
    world.set(TankEnvironment, { followEntityId: isFollowing ? -1 : entity.id() });
  };

  const removeCreature = () => {
    entity.destroy();
    world.set(TankEnvironment, { selectedEntityId: -1, followEntityId: -1 });
    persistWorldState(world);
  };

  return (
    <aside className="pointer-events-auto fixed right-3 bottom-3 z-20 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-slate-900/80 p-3.5 backdrop-blur-md border border-white/15 shadow-xl flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">{meta.name}</h3>
          <p className="text-xs italic text-slate-400">
            {dna.label} ({dna.scientificName})
          </p>
        </div>
        <button
          onClick={() => world.set(TankEnvironment, { selectedEntityId: -1, followEntityId: -1 })}
          className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-slate-300 leading-snug">{dna.description}</p>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-xl bg-slate-950/60 p-1.5 border border-white/10">
          <div className="text-xs text-slate-400">Health</div>
          <div className="text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1">
            <HeartPulse className="w-3 h-3" />
            {vitals.alive ? `${Math.round(vitals.health)}%` : 'Lost'}
          </div>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-1.5 border border-white/10">
          <div className="text-xs text-slate-400">Fullness</div>
          <div className="text-xs font-semibold text-amber-300">{Math.round(vitals.fullness)}%</div>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-1.5 border border-white/10">
          <div className="text-xs text-slate-400">Growth</div>
          <div className="text-xs font-semibold text-sky-300">{Math.round(meta.growth * 100)}%</div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={toggleFollow}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            isFollowing
              ? 'bg-sky-400 text-slate-950'
              : 'bg-sky-500/20 text-sky-200 border border-sky-400/30 hover:bg-sky-500/30'
          }`}
        >
          {isFollowing ? <Eye className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
          {isFollowing ? 'Following' : 'Follow-Cam'}
        </button>
        <button
          onClick={removeCreature}
          title="Remove creature from tank"
          className="rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/30 px-2.5 py-1.5 text-xs text-rose-200 cursor-pointer flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}

export function CreatureInspector() {
  const world = useWorld();
  const env = useTrait(world, TankEnvironment);
  const fishList = useQuery(IsFish);
  const snailList = useQuery(IsSnail);

  if (!env || env.ambientMode || env.decorateMode || env.selectedEntityId < 0) return null;

  const entity = [...fishList, ...snailList].find((e) => e.id() === env.selectedEntityId);
  if (!entity) return null;

  return <InspectorCard entity={entity} followEntityId={env.followEntityId} />;
}
