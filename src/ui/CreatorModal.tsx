import { useState } from 'react';
import { Dices, Plus, Sparkles, X } from 'lucide-react';
import { useWorld } from 'koota/react';
import {
  createCustomFishBlueprint,
  SPECIES_CATALOG,
  type BodyMorphology,
  type DietType,
  type PatternStyle,
  type TailStyle,
  type TempBand,
} from '../registry/species';
import { persistWorldState, spawnCreatureEntity } from '../ecs/world';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PALETTES = [
  ['#f8fafc', '#ef4444', '#f1f5f9'],
  ['#2563eb', '#dc2626', '#60a5fa'],
  ['#f97316', '#facc15', '#fed7aa'],
  ['#14b8a6', '#f43f5e', '#99f6e4'],
  ['#a855f7', '#ec4899', '#f5d0fe'],
  ['#0f172a', '#fbbf24', '#f8fafc'],
];

const RANDOM_NAMES = [
  'Coral',
  'Miso',
  'Azure',
  'Koiwai',
  'Pebble',
  'Nori',
  'Saffron',
  'Ghibli',
  'Tide',
  'Bubbles',
];

export function CreatorModal({ open, onClose }: Props) {
  const world = useWorld();
  const [tab, setTab] = useState<'presets' | 'custom'>('presets');

  // Custom Fish Studio state
  const [name, setName] = useState('Nimbus');
  const [morphology, setMorphology] = useState<Exclude<BodyMorphology, 'snail'>>('fusiform');
  const [tailStyle, setTailStyle] = useState<Exclude<TailStyle, 'none'>>('halfmoon');
  const [pattern, setPattern] = useState<PatternStyle>('koi');
  const [primaryColor, setPrimaryColor] = useState('#14b8a6');
  const [secondaryColor, setSecondaryColor] = useState('#f43f5e');
  const [finColor, setFinColor] = useState('#99f6e4');
  const [size, setSize] = useState(0.95);
  const [agility, setAgility] = useState(1.0);
  const [diet, setDiet] = useState<DietType>('omnivore');
  const [tempBand, setTempBand] = useState<TempBand>('versatile');

  if (!open) return null;

  const presets = Object.values(SPECIES_CATALOG);

  const handleAdoptPreset = (speciesId: string) => {
    const bp = SPECIES_CATALOG[speciesId];
    if (!bp) return;
    spawnCreatureEntity(world, bp, { name: bp.label });
    persistWorldState(world);
    onClose();
  };

  const randomizeCustom = () => {
    const morphs: Array<Exclude<BodyMorphology, 'snail'>> = ['fusiform', 'compressiform', 'globiform'];
    const tails: Array<Exclude<TailStyle, 'none'>> = ['forked', 'halfmoon', 'crowntail', 'veil', 'double', 'fan'];
    const pats: PatternStyle[] = ['solid', 'koi', 'stripes', 'spotted', 'bicolor', 'marble'];
    const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)];

    setName(RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]);
    setMorphology(morphs[Math.floor(Math.random() * morphs.length)]);
    setTailStyle(tails[Math.floor(Math.random() * tails.length)]);
    setPattern(pats[Math.floor(Math.random() * pats.length)]);
    setPrimaryColor(pal[0]);
    setSecondaryColor(pal[1]);
    setFinColor(pal[2]);
    setSize(Number((0.65 + Math.random() * 0.5).toFixed(2)));
    setAgility(Number((0.75 + Math.random() * 0.6).toFixed(2)));
  };

  const handleSpawnCustom = () => {
    const bp = createCustomFishBlueprint({
      label: name,
      morphology,
      tailStyle,
      pattern,
      primaryColor,
      secondaryColor,
      finColor,
      size,
      agility,
      diet,
      tempBand,
    });
    spawnCreatureEntity(world, bp, { name: bp.label });
    persistWorldState(world);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-white/15 p-4 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('presets')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                tab === 'presets' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              Species Presets
            </button>
            <button
              onClick={() => setTab('custom')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                tab === 'custom' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Custom Fish Studio
            </button>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {tab === 'presets' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {presets.map((bp) => (
              <div
                key={bp.speciesId}
                className="rounded-xl bg-slate-950/60 border border-white/10 p-3 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{bp.label}</span>
                    <div className="flex items-center gap-1">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/25"
                        style={{ backgroundColor: bp.primaryColor }}
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/25"
                        style={{ backgroundColor: bp.secondaryColor }}
                      />
                    </div>
                  </div>
                  <p className="text-xs italic text-slate-400">
                    {bp.scientificName} • {bp.tempBand}
                  </p>
                  <p className="text-xs text-slate-300 mt-1 leading-snug">{bp.description}</p>
                </div>

                <button
                  onClick={() => handleAdoptPreset(bp.speciesId)}
                  className="w-full rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/30 py-1.5 text-xs font-semibold text-sky-200 cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Release into Tank
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex-1 min-w-44 flex flex-col gap-1 text-xs text-slate-300">
                Fish Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-sm text-white outline-none focus:border-sky-400"
                />
              </label>
              <button
                onClick={randomizeCustom}
                className="self-end rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 px-3 py-2 text-xs font-medium text-sky-200 cursor-pointer flex items-center gap-1.5"
              >
                <Dices className="w-4 h-4" />
                Randomize DNA
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <label className="flex flex-col gap-1 text-xs text-slate-300">
                Body Shape
                <select
                  value={morphology}
                  onChange={(e) => setMorphology(e.target.value as Exclude<BodyMorphology, 'snail'>)}
                  className="rounded-xl bg-slate-950 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="fusiform">Torpedo (Koi / Minnow)</option>
                  <option value="compressiform">Sleek Flat (Betta / Angel)</option>
                  <option value="globiform">Round Plump (Fancy Goldfish)</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-300">
                Tail & Fin Style
                <select
                  value={tailStyle}
                  onChange={(e) => setTailStyle(e.target.value as Exclude<TailStyle, 'none'>)}
                  className="rounded-xl bg-slate-950 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="halfmoon">Halfmoon (180° Fan)</option>
                  <option value="crowntail">Crowntail (Spiky)</option>
                  <option value="veil">Flowing Veil</option>
                  <option value="double">Double Tail</option>
                  <option value="forked">Forked Cruiser</option>
                  <option value="fan">Compact Fan</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-300">
                Skin Pattern
                <select
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value as PatternStyle)}
                  className="rounded-xl bg-slate-950 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="koi">Koi Patches</option>
                  <option value="marble">Sanke Marble</option>
                  <option value="stripes">Stripes</option>
                  <option value="spotted">Spotted</option>
                  <option value="bicolor">Two-Tone Gradient</option>
                  <option value="solid">Solid Pearl</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <label className="flex items-center justify-between rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-xs text-slate-300">
                Body
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0" />
              </label>
              <label className="flex items-center justify-between rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-xs text-slate-300">
                Pattern
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0" />
              </label>
              <label className="flex items-center justify-between rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-xs text-slate-300">
                Fins
                <input type="color" value={finColor} onChange={(e) => setFinColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate-300">
                Size ({Math.round(size * 100)}%)
                <input type="range" min={0.5} max={1.3} step={0.05} value={size} onChange={(e) => setSize(Number(e.target.value))} className="accent-sky-400" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-300">
                Swim Agility ({agility.toFixed(1)}x)
                <input type="range" min={0.6} max={1.5} step={0.1} value={agility} onChange={(e) => setAgility(Number(e.target.value))} className="accent-sky-400" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1 text-xs text-slate-300">
                Diet
                <select
                  value={diet}
                  onChange={(e) => setDiet(e.target.value as DietType)}
                  className="rounded-xl bg-slate-950 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="omnivore">Omnivore</option>
                  <option value="carnivore">Carnivore (Surface Feeder)</option>
                  <option value="herbivore">Herbivore</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-300">
                Preferred Water
                <select
                  value={tempBand}
                  onChange={(e) => setTempBand(e.target.value as TempBand)}
                  className="rounded-xl bg-slate-950 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="versatile">Versatile</option>
                  <option value="tropical">Tropical (78–82°F)</option>
                  <option value="coldwater">Coldwater (65–72°F)</option>
                </select>
              </label>
            </div>

            <button
              onClick={handleSpawnCustom}
              className="w-full rounded-xl bg-sky-500 hover:bg-sky-400 py-2 text-sm font-semibold text-slate-950 cursor-pointer transition-colors"
            >
              Create & Release "{name || 'Custom Fish'}"
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
