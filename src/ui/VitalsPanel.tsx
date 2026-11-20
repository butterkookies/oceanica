import { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Droplets,
  Fish,
  RotateCcw,
  Sparkles,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useTrait, useWorld } from 'koota/react';
import { BIOME_PRESETS } from '../registry/decor';
import { TankAlerts, TankEnvironment } from '../ecs/traits';
import {
  dropFoodPellets,
  persistWorldState,
  pulseOxygenAerator,
  resetWorldToStarter,
  waterChangeAndSiphon,
} from '../ecs/world';

function StatMeter({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-200">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function chemTone(val: number, warn: number, danger: number): string {
  if (val >= danger) return 'text-rose-300';
  if (val >= warn) return 'text-amber-300';
  return 'text-emerald-300';
}

export function VitalsPanel() {
  const world = useWorld();
  const env = useTrait(world, TankEnvironment);
  const alerts = useTrait(world, TankAlerts);
  const [collapsed, setCollapsed] = useState(false);

  if (!env || env.ambientMode || env.decorateMode) return null;

  const warnings = alerts?.warnings ?? [];
  const biomeLabel = BIOME_PRESETS[env.biome]?.label ?? 'Marine Reef';

  return (
    <aside className="pointer-events-auto fixed left-3 bottom-3 z-20 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-slate-900/75 p-3 backdrop-blur-md border border-white/15 shadow-xl flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-300">
            {biomeLabel}
          </span>
          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-mono text-cyan-200 border border-cyan-400/25">
            {env.salinity.toFixed(0)} ppt • pH {env.ph.toFixed(1)}
          </span>
          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300 border border-amber-400/30">
            {Math.floor(env.carePoints)} pts
          </span>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          title={collapsed ? 'Expand Water Chemistry' : 'Collapse Water Chemistry'}
        >
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatMeter label="O₂" value={env.oxygen} color="bg-cyan-400" />
            <StatMeter label="Clarity" value={env.cleanliness} color="bg-emerald-400" />
            <StatMeter label="Biofilter" value={env.biofilterMaturity} color="bg-violet-400" />
          </div>

          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-950/65 px-2.5 py-1.5 border border-white/10 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">NH₃</div>
              <div className={`text-xs font-mono font-semibold ${chemTone(env.ammonia, 0.12, 0.25)}`}>
                {env.ammonia.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">NO₂⁻</div>
              <div className={`text-xs font-mono font-semibold ${chemTone(env.nitrite, 0.15, 0.35)}`}>
                {env.nitrite.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">NO₃⁻</div>
              <div className={`text-xs font-mono font-semibold ${chemTone(env.nitrate, 25, 45)}`}>
                {env.nitrate.toFixed(1)} ppm
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1 text-slate-300">
              <Thermometer className="w-3.5 h-3.5 text-rose-300" />
              Temp: <strong className="font-mono text-white">{env.temperature}°F</strong>
            </span>
            <input
              type="range"
              min={64}
              max={84}
              step={1}
              value={env.temperature}
              onChange={(e) => {
                world.set(TankEnvironment, { temperature: Number(e.target.value) });
                persistWorldState(world);
              }}
              className="w-32 accent-sky-400 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            <button
              onClick={() => dropFoodPellets(world, (Math.random() - 0.5) * 6.5, (Math.random() - 0.5) * 3.5, 5)}
              className="flex flex-col items-center gap-0.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 py-1.5 text-xs font-medium text-amber-200 cursor-pointer"
            >
              <Fish className="w-3.5 h-3.5" />
              Feed
            </button>
            <button
              onClick={() => pulseOxygenAerator(world)}
              className="flex flex-col items-center gap-0.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 py-1.5 text-xs font-medium text-cyan-200 cursor-pointer"
            >
              <Wind className="w-3.5 h-3.5" />
              Aerate
            </button>
            <button
              onClick={() => waterChangeAndSiphon(world)}
              title="Perform 38% partial water change & siphon waste"
              className="flex flex-col items-center gap-0.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 py-1.5 text-[11px] font-medium text-emerald-200 cursor-pointer"
            >
              <Droplets className="w-3.5 h-3.5" />
              Water Chg
            </button>
            <button
              onClick={() => resetWorldToStarter(world)}
              title="Reset current biome back to starter ecosystem"
              className="flex flex-col items-center gap-0.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 py-1.5 text-xs font-medium text-slate-300 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          {warnings.length > 0 ? (
            <div className="rounded-xl bg-amber-950/60 border border-amber-500/35 p-2 flex flex-col gap-1">
              {warnings.slice(0, 2).map((w, i) => (
                <p key={i} className="text-xs text-amber-200 flex items-start gap-1.5 leading-snug">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              {env.mode === 'sandbox'
                ? 'Sandbox active — chemistry buffered & stress-free.'
                : 'Nitrogen cycle & water chemistry balanced.'}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
