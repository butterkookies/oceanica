import { useState } from 'react';
import {
  Check,
  Droplet,
  Eye,
  Heart,
  HeartPulse,
  Pencil,
  Scissors,
  Sparkles,
  Trash2,
  Utensils,
  Video,
  X,
} from 'lucide-react';
import { useQuery, useTrait, useWorld } from 'koota/react';
import type { Entity } from 'koota';
import { DECOR_CATALOG } from '../registry/decor';
import {
  CreatureDna,
  CreatureMeta,
  CreatureMind,
  CreatureVitals,
  DecorItem,
  IsFish,
  IsPlant,
  IsSnail,
  PlantBiology,
  TankEnvironment,
  type CreatureMood,
} from '../ecs/traits';
import {
  fertilizePlant,
  greetCreature,
  persistWorldState,
  prunePlant,
  targetFeedCreature,
} from '../ecs/world';

const MOOD_STYLES: Record<CreatureMood, string> = {
  content: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  curious: 'bg-sky-500/20 text-sky-200 border-sky-400/30',
  playful: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/30',
  affectionate: 'bg-pink-500/20 text-pink-200 border-pink-400/30',
  hungry: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  resting: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
  startled: 'bg-orange-500/20 text-orange-200 border-orange-400/30',
  territorial: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
  stressed: 'bg-red-500/25 text-red-200 border-red-400/40',
};

function CreatureInspectorCard({ entity, followEntityId }: { entity: Entity; followEntityId: number }) {
  const world = useWorld();
  const meta = useTrait(entity, CreatureMeta);
  const dna = useTrait(entity, CreatureDna);
  const vitals = useTrait(entity, CreatureVitals);
  const mind = useTrait(entity, CreatureMind);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

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

  const saveRename = () => {
    const trimmed = draftName.trim();
    if (trimmed) {
      entity.set(CreatureMeta, { name: trimmed });
      persistWorldState(world);
    }
    setEditingName(false);
  };

  const mood: CreatureMood = mind?.mood ?? 'content';
  const trustPct = Math.round(mind?.trust ?? 30);

  return (
    <aside className="pointer-events-auto fixed right-3 bottom-3 z-20 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-slate-900/85 p-3.5 backdrop-blur-md border border-white/15 shadow-xl flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                autoFocus
                className="w-full rounded-lg bg-slate-950 border border-sky-400 px-2 py-0.5 text-sm text-white outline-none"
              />
              <button
                onClick={saveRename}
                className="rounded-lg bg-sky-500 p-1 text-slate-950 cursor-pointer"
                title="Save Name"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-white truncate">{meta.name}</h3>
              <button
                onClick={() => {
                  setDraftName(meta.name);
                  setEditingName(true);
                }}
                className="rounded p-0.5 text-slate-400 hover:text-white cursor-pointer"
                title="Rename Pet"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
          <p className="text-xs italic text-slate-400 truncate">
            {dna.label} ({dna.scientificName})
          </p>
          <p className="text-[11px] text-sky-300/90 capitalize mt-0.5">
            {meta.lifeStage} • Gen {meta.generation} • {dna.salinityType}
          </p>
        </div>
        <button
          onClick={() => world.set(TankEnvironment, { selectedEntityId: -1, followEntityId: -1 })}
          className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Emulated Feeling & Behavioral Thought */}
      <div className="rounded-xl bg-slate-950/70 p-2 border border-white/10 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${MOOD_STYLES[mood]}`}
          >
            {mood}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Gill {vitals.gillRate.toFixed(1)}x • Fins {Math.round(vitals.finIntegrity * 100)}%
          </span>
        </div>
        <p className="text-xs text-slate-200 leading-snug">
          “{mind?.thought ?? dna.description}”
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-xl bg-slate-950/60 p-1.5 border border-white/10">
          <div className="text-[11px] text-slate-400">Health</div>
          <div className="text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1">
            <HeartPulse className="w-3 h-3" />
            {vitals.alive ? `${Math.round(vitals.health)}%` : 'Lost'}
          </div>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-1.5 border border-white/10">
          <div className="text-[11px] text-slate-400">Fullness</div>
          <div className="text-xs font-semibold text-amber-300">{Math.round(vitals.fullness)}%</div>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-1.5 border border-white/10">
          <div className="text-[11px] text-slate-400">Growth</div>
          <div className="text-xs font-semibold text-sky-300">{Math.round(meta.growth * 100)}%</div>
        </div>
      </div>

      {/* Owner Bond / Trust Bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 flex items-center gap-1">
            <Heart className="w-3 h-3 text-pink-400" />
            Pet Bond / Trust
          </span>
          <span className="font-mono text-pink-200">{trustPct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full rounded-full bg-pink-400 transition-all duration-300" style={{ width: `${trustPct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
        <button
          onClick={() => targetFeedCreature(world, entity)}
          disabled={!vitals.alive}
          className="flex items-center justify-center gap-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 border border-amber-400/30 py-1.5 text-xs font-medium text-amber-200 cursor-pointer"
        >
          <Utensils className="w-3.5 h-3.5" />
          Target Feed
        </button>
        <button
          onClick={() => greetCreature(world, entity)}
          disabled={!vitals.alive}
          className="flex items-center justify-center gap-1 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 disabled:opacity-40 border border-pink-400/30 py-1.5 text-xs font-medium text-pink-200 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Greet
        </button>
      </div>

      <div className="flex items-center gap-2">
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

function PlantInspectorCard({ entity }: { entity: Entity }) {
  const world = useWorld();
  const decor = useTrait(entity, DecorItem);
  const plant = useTrait(entity, PlantBiology);
  if (!decor || !plant) return null;

  const bp = DECOR_CATALOG[decor.kind];
  if (!bp) return null;

  const removePlant = () => {
    entity.destroy();
    world.set(TankEnvironment, { selectedEntityId: -1 });
    persistWorldState(world);
  };

  return (
    <aside className="pointer-events-auto fixed right-3 bottom-3 z-20 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-slate-900/85 p-3.5 backdrop-blur-md border border-emerald-400/25 shadow-xl flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">{bp.label}</h3>
          <p className="text-xs italic text-slate-400">{bp.scientificName}</p>
          <p className="text-[11px] text-emerald-300 capitalize mt-0.5">
            {plant.stage} • Gen {plant.generation} • {bp.salinityBand}
          </p>
        </div>
        <button
          onClick={() => world.set(TankEnvironment, { selectedEntityId: -1 })}
          className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-slate-300 leading-snug">{bp.description}</p>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-xl bg-slate-950/60 p-1.5 border border-white/10">
          <div className="text-[11px] text-slate-400">Health</div>
          <div className="text-xs font-semibold text-emerald-300">{Math.round(plant.health)}%</div>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-1.5 border border-white/10">
          <div className="text-[11px] text-slate-400">Growth</div>
          <div className="text-xs font-semibold text-sky-300">{Math.round(plant.growth * 100)}%</div>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-1.5 border border-white/10">
          <div className="text-[11px] text-slate-400">Chlorophyll</div>
          <div className="text-xs font-semibold text-lime-300">{Math.round(plant.chlorophyll)}%</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs rounded-xl bg-slate-950/60 px-2.5 py-1.5 border border-white/10">
        <span className="text-slate-300">Nutrients: <strong className="text-white">{Math.round(plant.nutrients)}%</strong></span>
        <span className={`font-mono ${plant.oxygenOutput >= 0 ? 'text-cyan-300' : 'text-amber-300'}`}>
          O₂ {plant.oxygenOutput >= 0 ? '+' : ''}{plant.oxygenOutput.toFixed(2)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => fertilizePlant(world, entity)}
          className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 py-1.5 text-xs font-medium text-emerald-200 cursor-pointer"
        >
          <Droplet className="w-3.5 h-3.5" />
          Fertilize
        </button>
        <button
          onClick={() => prunePlant(world, entity)}
          className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 py-1.5 text-xs font-medium text-sky-200 cursor-pointer"
        >
          <Scissors className="w-3.5 h-3.5" />
          Prune
        </button>
        <button
          onClick={removePlant}
          title="Remove plant from tank"
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
  const plantList = useQuery(IsPlant);

  if (!env || env.ambientMode || env.decorateMode || env.selectedEntityId < 0) return null;

  const creature = [...fishList, ...snailList].find((e) => e.id() === env.selectedEntityId);
  if (creature) {
    return <CreatureInspectorCard entity={creature} followEntityId={env.followEntityId} />;
  }

  const plant = plantList.find((e) => e.id() === env.selectedEntityId);
  if (plant) {
    return <PlantInspectorCard entity={plant} />;
  }

  return null;
}
