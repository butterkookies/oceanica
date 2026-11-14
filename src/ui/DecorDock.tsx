import { FlipHorizontal2, Maximize2, Minimize2, RotateCw, Trash2 } from 'lucide-react';
import { useQuery, useTrait, useWorld } from 'koota/react';
import type { Entity } from 'koota';
import { DECOR_CATALOG, type DecorKind } from '../registry/decor';
import { DecorItem, IsDecor, TankEnvironment } from '../ecs/traits';
import { persistWorldState } from '../ecs/world';

function SelectedDecorControls({ entity }: { entity: Entity }) {
  const world = useWorld();
  const item = useTrait(entity, DecorItem);
  if (!item) return null;

  const bp = DECOR_CATALOG[item.kind];

  const updateItem = (patch: Partial<{ rotationY: number; scale: number; flipped: boolean }>) => {
    entity.set(DecorItem, patch);
    persistWorldState(world);
  };

  const removeDecor = () => {
    entity.destroy();
    world.set(TankEnvironment, { selectedEntityId: -1 });
    persistWorldState(world);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
      <div className="text-xs text-emerald-200">
        Selected: <strong>{bp.label}</strong> — tap anywhere on sand floor to move
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => updateItem({ rotationY: item.rotationY + Math.PI / 4 })}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2 py-1 text-xs text-slate-200 border border-white/10 cursor-pointer flex items-center gap-1"
          title="Rotate 45°"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Rotate
        </button>
        <button
          onClick={() => updateItem({ flipped: !item.flipped })}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2 py-1 text-xs text-slate-200 border border-white/10 cursor-pointer flex items-center gap-1"
          title="Flip Horizontally"
        >
          <FlipHorizontal2 className="w-3.5 h-3.5" />
          Flip
        </button>
        <button
          onClick={() => updateItem({ scale: Math.max(0.65, item.scale - 0.15) })}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 p-1 text-xs text-slate-200 border border-white/10 cursor-pointer"
          title="Shrink"
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => updateItem({ scale: Math.min(1.65, item.scale + 0.15) })}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 p-1 text-xs text-slate-200 border border-white/10 cursor-pointer"
          title="Grow"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={removeDecor}
          className="rounded-lg bg-rose-500/20 hover:bg-rose-500/35 px-2 py-1 text-xs text-rose-200 border border-rose-400/30 cursor-pointer flex items-center gap-1"
          title="Remove Decor"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function DecorDock() {
  const world = useWorld();
  const env = useTrait(world, TankEnvironment);
  const decorEntities = useQuery(IsDecor);

  if (!env || !env.decorateMode || env.ambientMode) return null;

  const selectedDecor =
    env.selectedEntityId >= 0
      ? decorEntities.find((e) => e.id() === env.selectedEntityId)
      : undefined;

  const catalogItems = Object.values(DECOR_CATALOG);

  const selectPlacement = (kind: DecorKind) => {
    world.set(TankEnvironment, {
      placingDecorKind: env.placingDecorKind === kind ? '' : kind,
      selectedEntityId: -1,
    });
  };

  return (
    <div className="pointer-events-auto fixed inset-x-3 bottom-3 z-30 mx-auto max-w-4xl rounded-2xl bg-slate-900/85 p-3 backdrop-blur-md border border-emerald-400/30 shadow-2xl">
      {selectedDecor && <SelectedDecorControls entity={selectedDecor} />}

      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-emerald-300">
          {env.placingDecorKind
            ? `Tap the tank sand floor to place: ${DECOR_CATALOG[env.placingDecorKind].label}`
            : 'Decorate Mode — pick an item to add, or click any tank item to reposition'}
        </span>
      </div>

      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {catalogItems.map((bp) => {
          const isPlacing = env.placingDecorKind === bp.kind;
          return (
            <button
              key={bp.kind}
              onClick={() => selectPlacement(bp.kind)}
              className={`shrink-0 flex flex-col items-start rounded-xl px-3 py-2 text-left border transition-colors cursor-pointer min-w-34 ${
                isPlacing
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-semibold'
                  : 'bg-slate-800/80 text-slate-200 border-white/10 hover:bg-slate-700/80'
              }`}
            >
              <span className="text-xs font-semibold">{bp.label}</span>
              <span
                className={`text-xs capitalize ${
                  isPlacing ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {bp.category} {bp.oxygenBoost > 0 ? '• +O₂' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
