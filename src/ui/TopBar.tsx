import {
  Box,
  Compass,
  Eye,
  EyeOff,
  Hammer,
  Maximize2,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useTrait, useWorld } from 'koota/react';
import { TankEnvironment, type CameraViewMode, type LightingPreset } from '../ecs/traits';
import { persistWorldState } from '../ecs/world';
import { ambientAudio } from '../utils/ambientAudio';

interface Props {
  onOpenCreator: () => void;
}

const CAMERA_OPTIONS: Array<{ id: CameraViewMode; label: string }> = [
  { id: 'side', label: 'Side' },
  { id: 'top', label: 'Top' },
  { id: 'free', label: '3D' },
];

const LIGHTING_CYCLE: LightingPreset[] = ['auto', 'morning', 'day', 'sunset', 'night'];

function LightingIcon({ phase }: { phase: LightingPreset }) {
  if (phase === 'morning') return <Sunrise className="w-3.5 h-3.5" />;
  if (phase === 'sunset') return <Sunset className="w-3.5 h-3.5" />;
  if (phase === 'night') return <Moon className="w-3.5 h-3.5" />;
  if (phase === 'auto') return <Sparkles className="w-3.5 h-3.5" />;
  return <Sun className="w-3.5 h-3.5" />;
}

function PixelGridIcon() {
  return (
    <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
      <rect x="1" y="1" width="3" height="3" />
      <rect x="5" y="1" width="3" height="3" opacity="0.65" />
      <rect x="9" y="1" width="2" height="3" />
      <rect x="1" y="5" width="3" height="3" opacity="0.65" />
      <rect x="5" y="5" width="3" height="3" />
      <rect x="9" y="5" width="2" height="3" opacity="0.65" />
      <rect x="1" y="9" width="3" height="2" />
      <rect x="5" y="9" width="3" height="2" opacity="0.65" />
      <rect x="9" y="9" width="2" height="2" />
    </svg>
  );
}

export function TopBar({ onOpenCreator }: Props) {
  const world = useWorld();
  const env = useTrait(world, TankEnvironment);
  if (!env) return null;

  const toggleSound = () => {
    const next = !env.soundEnabled;
    if (next) {
      ambientAudio.start();
    } else {
      ambientAudio.stop();
    }
    world.set(TankEnvironment, { soundEnabled: next });
  };

  const cycleLighting = () => {
    const idx = LIGHTING_CYCLE.indexOf(env.lightingPhase);
    const next = LIGHTING_CYCLE[(idx + 1) % LIGHTING_CYCLE.length];
    world.set(TankEnvironment, { lightingPhase: next });
    persistWorldState(world);
  };

  const toggleMode = (mode: 'sandbox' | 'realistic') => {
    world.set(TankEnvironment, { mode });
    persistWorldState(world);
  };

  const setCamera = (cameraMode: CameraViewMode) => {
    world.set(TankEnvironment, { cameraMode, followEntityId: -1 });
    persistWorldState(world);
  };

  const toggleDecorate = () => {
    world.set(TankEnvironment, {
      decorateMode: !env.decorateMode,
      selectedEntityId: -1,
      followEntityId: -1,
      placingDecorKind: '',
    });
  };

  const togglePixelArt = () => {
    world.set(TankEnvironment, { pixelArt: !env.pixelArt });
    persistWorldState(world);
  };

  const togglePixelScale = () => {
    world.set(TankEnvironment, { pixelScale: env.pixelScale === 'crisp' ? 'chunky' : 'crisp' });
    persistWorldState(world);
  };

  if (env.ambientMode) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-end p-3">
        <button
          onClick={() => world.set(TankEnvironment, { ambientMode: false })}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 backdrop-blur-md border border-white/15 hover:bg-slate-800/80 cursor-pointer"
          title="Exit Ambient Room Mode"
        >
          <Eye className="w-3.5 h-3.5" />
          Exit Ambient
        </button>
      </div>
    );
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex flex-wrap items-center justify-between gap-2 p-3">
      {/* Brand + Dual Mode Toggle */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900/75 px-3 py-1.5 backdrop-blur-md border border-white/15 shadow-lg">
        <span className="text-sm font-semibold tracking-tight text-sky-200 flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-sky-400" />
          Oceanica
        </span>
        <div className="h-4 w-px bg-white/15" />
        <div className="flex items-center rounded-xl bg-slate-950/70 p-0.5 border border-white/10">
          <button
            onClick={() => toggleMode('sandbox')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              env.mode === 'sandbox'
                ? 'bg-emerald-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Cozy Sandbox
          </button>
          <button
            onClick={() => toggleMode('realistic')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              env.mode === 'realistic'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Realistic Care
          </button>
        </div>
      </div>

      {/* Camera Views */}
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl bg-slate-900/75 p-1 backdrop-blur-md border border-white/15 shadow-lg">
        {CAMERA_OPTIONS.map((cam) => (
          <button
            key={cam.id}
            onClick={() => setCamera(cam.id)}
            className={`rounded-xl px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              env.cameraMode === cam.id && env.followEntityId < 0
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            {cam.label}
          </button>
        ))}
        <button
          onClick={() => world.set(TankEnvironment, { showSpineDebug: !env.showSpineDebug })}
          title="Toggle 3D Spine Joint Overlay"
          className={`rounded-xl px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
            env.showSpineDebug
              ? 'bg-cyan-400/25 text-cyan-200 border border-cyan-400/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          Spine
        </button>
        <div className="h-4 w-px bg-white/10 mx-0.5" />
        <button
          onClick={togglePixelArt}
          title={env.pixelArt ? 'Switch to Smooth 3D Rendering' : 'Switch to Retro Pixel Art Shader'}
          className={`rounded-xl px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            env.pixelArt
              ? 'bg-violet-400/25 text-violet-200 border border-violet-400/45 font-semibold'
              : 'bg-slate-800/70 text-slate-300 border border-white/10 hover:text-white'
          }`}
        >
          <PixelGridIcon />
          {env.pixelArt ? 'Pixel Art' : 'Smooth 3D'}
        </button>
        {env.pixelArt && (
          <button
            onClick={togglePixelScale}
            title="Cycle Pixel Grid Density (Crisp vs Chunky)"
            className="rounded-xl px-2 py-1 text-[11px] font-medium text-violet-200/90 hover:text-white hover:bg-white/10 transition-colors cursor-pointer capitalize"
          >
            {env.pixelScale}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-900/75 px-2.5 py-1.5 backdrop-blur-md border border-white/15 shadow-lg">
        <button
          onClick={onOpenCreator}
          className="flex items-center gap-1 rounded-xl bg-sky-500 hover:bg-sky-400 px-3 py-1 text-xs font-semibold text-slate-950 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Fish
        </button>
        <button
          onClick={toggleDecorate}
          className={`flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-medium transition-colors cursor-pointer border ${
            env.decorateMode
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
              : 'bg-slate-800/80 text-slate-200 border-white/10 hover:bg-slate-700'
          }`}
        >
          <Hammer className="w-3.5 h-3.5" />
          {env.decorateMode ? 'Done' : 'Decorate'}
        </button>
        <button
          onClick={cycleLighting}
          title={`Lighting: ${env.lightingPhase}`}
          className="flex items-center gap-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1 text-xs text-slate-200 border border-white/10 cursor-pointer capitalize"
        >
          <LightingIcon phase={env.lightingPhase} />
          <span className="hidden sm:inline">{env.lightingPhase}</span>
        </button>
        <button
          onClick={toggleSound}
          title={env.soundEnabled ? 'Mute Water Audio' : 'Enable Ambient Water Audio'}
          className="rounded-xl bg-slate-800/80 hover:bg-slate-700 p-1.5 text-slate-200 border border-white/10 cursor-pointer"
        >
          {env.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-sky-400" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => world.set(TankEnvironment, { ambientMode: true })}
          title="Fullscreen Ambient Room Mode"
          className="rounded-xl bg-slate-800/80 hover:bg-slate-700 p-1.5 text-slate-200 border border-white/10 cursor-pointer"
        >
          {env.ambientMode ? <EyeOff className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
}
