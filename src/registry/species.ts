export type CreatureKind = 'koi' | 'betta' | 'goldfish' | 'snail' | 'custom';
export type BodyMorphology = 'fusiform' | 'compressiform' | 'globiform' | 'snail';
export type TailStyle = 'forked' | 'halfmoon' | 'crowntail' | 'veil' | 'double' | 'fan' | 'none';
export type PatternStyle = 'solid' | 'koi' | 'stripes' | 'spotted' | 'bicolor' | 'marble';
export type DietType = 'omnivore' | 'carnivore' | 'herbivore';
export type TempBand = 'coldwater' | 'tropical' | 'versatile';

export interface CreatureBlueprint {
  speciesId: string;
  label: string;
  scientificName: string;
  kind: CreatureKind;
  morphology: BodyMorphology;
  tailStyle: TailStyle;
  pattern: PatternStyle;
  primaryColor: string;
  secondaryColor: string;
  finColor: string;
  baseScale: number;
  maxScale: number;
  lengthFactor: number;
  heightFactor: number;
  widthFactor: number;
  minSpeed: number;
  maxSpeed: number;
  waveFreq: number;
  waveAmp: number;
  finDrag: number;
  preferredDepthMin: number; // -2.1 to 2.1 (bottom to top)
  preferredDepthMax: number;
  diet: DietType;
  tempBand: TempBand;
  bioload: number; // Waste generation factor
  oxygenUse: number;
  algaeCleanRate: number; // Positive for snails
  hasLabyrinth: boolean; // Surfaces for air
  hasBarbels: boolean;
  territorial: boolean;
  isPondFish: boolean; // Outgrows standard indoor tanks in Realistic Mode
  cost: number; // Care points
  description: string;
}

export const SPECIES_CATALOG: Record<string, CreatureBlueprint> = {
  koi_kohaku: {
    speciesId: 'koi_kohaku',
    label: 'Kohaku Koi',
    scientificName: 'Cyprinus rubrofuscus',
    kind: 'koi',
    morphology: 'fusiform',
    tailStyle: 'forked',
    pattern: 'koi',
    primaryColor: '#f8fafc',
    secondaryColor: '#ef4444',
    finColor: '#f1f5f9',
    baseScale: 0.92,
    maxScale: 1.55,
    lengthFactor: 1.35,
    heightFactor: 0.42,
    widthFactor: 0.34,
    minSpeed: 0.75,
    maxSpeed: 1.95,
    waveFreq: 6.8,
    waveAmp: 0.17,
    finDrag: 0.25,
    preferredDepthMin: -1.7,
    preferredDepthMax: 1.6,
    diet: 'omnivore',
    tempBand: 'coldwater',
    bioload: 1.5,
    oxygenUse: 1.3,
    algaeCleanRate: 0,
    hasLabyrinth: false,
    hasBarbels: true,
    territorial: false,
    isPondFish: true,
    cost: 40,
    description: 'Snow-white carp with bold crimson patches, sensory barbels, and sweeping S-curve swimming.',
  },
  koi_sanke: {
    speciesId: 'koi_sanke',
    label: 'Taisho Sanke Koi',
    scientificName: 'Cyprinus rubrofuscus',
    kind: 'koi',
    morphology: 'fusiform',
    tailStyle: 'forked',
    pattern: 'marble',
    primaryColor: '#f8fafc',
    secondaryColor: '#f97316',
    finColor: '#e2e8f0',
    baseScale: 0.88,
    maxScale: 1.5,
    lengthFactor: 1.32,
    heightFactor: 0.41,
    widthFactor: 0.33,
    minSpeed: 0.72,
    maxSpeed: 1.9,
    waveFreq: 7.0,
    waveAmp: 0.16,
    finDrag: 0.25,
    preferredDepthMin: -1.7,
    preferredDepthMax: 1.6,
    diet: 'omnivore',
    tempBand: 'coldwater',
    bioload: 1.5,
    oxygenUse: 1.3,
    algaeCleanRate: 0,
    hasLabyrinth: false,
    hasBarbels: true,
    territorial: false,
    isPondFish: true,
    cost: 45,
    description: 'Tri-color ornamental koi blending white skin, warm vermilion patches, and sumi ink accents.',
  },
  betta_halfmoon: {
    speciesId: 'betta_halfmoon',
    label: 'Halfmoon Betta',
    scientificName: 'Betta splendens',
    kind: 'betta',
    morphology: 'compressiform',
    tailStyle: 'halfmoon',
    pattern: 'bicolor',
    primaryColor: '#2563eb',
    secondaryColor: '#dc2626',
    finColor: '#ef4444',
    baseScale: 0.65,
    maxScale: 0.88,
    lengthFactor: 0.92,
    heightFactor: 0.38,
    widthFactor: 0.2,
    minSpeed: 0.28,
    maxSpeed: 1.15,
    waveFreq: 5.2,
    waveAmp: 0.12,
    finDrag: 0.72,
    preferredDepthMin: -0.4,
    preferredDepthMax: 1.85,
    diet: 'carnivore',
    tempBand: 'tropical',
    bioload: 0.55,
    oxygenUse: 0.45, // Labyrinth organ supplements O2
    algaeCleanRate: 0,
    hasLabyrinth: true,
    hasBarbels: false,
    territorial: true,
    isPondFish: false,
    cost: 25,
    description: 'Labyrinth-breathing fighter with billowing 180-degree silk fins that likes resting on Anubias leaves.',
  },
  betta_plakat: {
    speciesId: 'betta_plakat',
    label: 'Koi Plakat Betta',
    scientificName: 'Betta splendens',
    kind: 'betta',
    morphology: 'compressiform',
    tailStyle: 'fan',
    pattern: 'koi',
    primaryColor: '#f8fafc',
    secondaryColor: '#ea580c',
    finColor: '#1e293b',
    baseScale: 0.62,
    maxScale: 0.84,
    lengthFactor: 0.9,
    heightFactor: 0.36,
    widthFactor: 0.21,
    minSpeed: 0.45,
    maxSpeed: 1.55,
    waveFreq: 6.4,
    waveAmp: 0.14,
    finDrag: 0.22,
    preferredDepthMin: -0.6,
    preferredDepthMax: 1.85,
    diet: 'carnivore',
    tempBand: 'tropical',
    bioload: 0.55,
    oxygenUse: 0.45,
    algaeCleanRate: 0,
    hasLabyrinth: true,
    hasBarbels: false,
    territorial: true,
    isPondFish: false,
    cost: 30,
    description: 'Short-finned, agile marble betta with quick darts and occasional surface air gulps.',
  },
  goldfish_oranda: {
    speciesId: 'goldfish_oranda',
    label: 'Oranda Goldfish',
    scientificName: 'Carassius auratus',
    kind: 'goldfish',
    morphology: 'globiform',
    tailStyle: 'double',
    pattern: 'bicolor',
    primaryColor: '#f97316',
    secondaryColor: '#f8fafc',
    finColor: '#fb923c',
    baseScale: 0.72,
    maxScale: 1.05,
    lengthFactor: 0.95,
    heightFactor: 0.62,
    widthFactor: 0.46,
    minSpeed: 0.38,
    maxSpeed: 1.1,
    waveFreq: 8.6,
    waveAmp: 0.19,
    finDrag: 0.48,
    preferredDepthMin: -1.8,
    preferredDepthMax: 0.9,
    diet: 'omnivore',
    tempBand: 'coldwater',
    bioload: 1.35,
    oxygenUse: 1.15,
    algaeCleanRate: 0,
    hasLabyrinth: false,
    hasBarbels: false,
    territorial: false,
    isPondFish: false,
    cost: 20,
    description: 'Plump, inquisitive double-tail fancy goldfish with a gentle waddle and long memory.',
  },
  goldfish_comet: {
    speciesId: 'goldfish_comet',
    label: 'Comet Goldfish',
    scientificName: 'Carassius auratus',
    kind: 'goldfish',
    morphology: 'fusiform',
    tailStyle: 'forked',
    pattern: 'solid',
    primaryColor: '#fb923c',
    secondaryColor: '#facc15',
    finColor: '#fde047',
    baseScale: 0.7,
    maxScale: 1.15,
    lengthFactor: 1.15,
    heightFactor: 0.42,
    widthFactor: 0.3,
    minSpeed: 0.65,
    maxSpeed: 1.75,
    waveFreq: 8.0,
    waveAmp: 0.16,
    finDrag: 0.28,
    preferredDepthMin: -1.7,
    preferredDepthMax: 1.4,
    diet: 'omnivore',
    tempBand: 'coldwater',
    bioload: 1.25,
    oxygenUse: 1.05,
    algaeCleanRate: 0,
    hasLabyrinth: false,
    hasBarbels: false,
    territorial: false,
    isPondFish: false,
    cost: 15,
    description: 'Sleek, fast-cruising classic orange goldfish with flowing forked tail fins.',
  },
  snail_mystery: {
    speciesId: 'snail_mystery',
    label: 'Golden Mystery Snail',
    scientificName: 'Pomacea diffusa',
    kind: 'snail',
    morphology: 'snail',
    tailStyle: 'none',
    pattern: 'solid',
    primaryColor: '#facc15',
    secondaryColor: '#ca8a04',
    finColor: '#fef3c7',
    baseScale: 0.55,
    maxScale: 0.72,
    lengthFactor: 0.6,
    heightFactor: 0.55,
    widthFactor: 0.55,
    minSpeed: 0.12,
    maxSpeed: 0.24,
    waveFreq: 2.0,
    waveAmp: 0.02,
    finDrag: 0,
    preferredDepthMin: -2.25,
    preferredDepthMax: -2.25,
    diet: 'omnivore',
    tempBand: 'versatile',
    bioload: 0.35,
    oxygenUse: 0.2,
    algaeCleanRate: 0.55,
    hasLabyrinth: true, // Extendable breathing siphon
    hasBarbels: false,
    territorial: false,
    isPondFish: false,
    cost: 10,
    description: 'Active golden clean-up snail that glides across sand and glass, scavenges leftovers, and parasnails.',
  },
  snail_nerite: {
    speciesId: 'snail_nerite',
    label: 'Zebra Nerite Snail',
    scientificName: 'Neritina natalensis',
    kind: 'snail',
    morphology: 'snail',
    tailStyle: 'none',
    pattern: 'stripes',
    primaryColor: '#d97706',
    secondaryColor: '#1e293b',
    finColor: '#f59e0b',
    baseScale: 0.38,
    maxScale: 0.48,
    lengthFactor: 0.45,
    heightFactor: 0.42,
    widthFactor: 0.42,
    minSpeed: 0.08,
    maxSpeed: 0.17,
    waveFreq: 1.5,
    waveAmp: 0.01,
    finDrag: 0,
    preferredDepthMin: -2.25,
    preferredDepthMax: -2.25,
    diet: 'herbivore',
    tempBand: 'versatile',
    bioload: 0.2,
    oxygenUse: 0.15,
    algaeCleanRate: 1.15,
    hasLabyrinth: false,
    hasBarbels: false,
    territorial: false,
    isPondFish: false,
    cost: 12,
    description: 'Striped algae powerhouse with strong suction that keeps glass and hardscape spotless without reproducing.',
  },
};

export interface CustomFishInput {
  label: string;
  morphology: Exclude<BodyMorphology, 'snail'>;
  tailStyle: Exclude<TailStyle, 'none'>;
  pattern: PatternStyle;
  primaryColor: string;
  secondaryColor: string;
  finColor: string;
  size: number; // 0.5 to 1.25
  agility: number; // 0.5 to 1.5
  diet: DietType;
  tempBand: TempBand;
}

/** Builds a modular CreatureBlueprint from user-selected Studio DNA parameters. */
export function createCustomFishBlueprint(input: CustomFishInput): CreatureBlueprint {
  const isPlump = input.morphology === 'globiform';
  const isFlat = input.morphology === 'compressiform';
  const isLongTail = input.tailStyle === 'halfmoon' || input.tailStyle === 'veil';

  return {
    speciesId: `custom_${Date.now().toString(36)}`,
    label: input.label.trim() || 'Custom Fish',
    scientificName: 'Oceanica customis',
    kind: 'custom',
    morphology: input.morphology,
    tailStyle: input.tailStyle,
    pattern: input.pattern,
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    finColor: input.finColor,
    baseScale: input.size * 0.72,
    maxScale: input.size * 1.15,
    lengthFactor: isPlump ? 0.96 : isFlat ? 0.95 : 1.25,
    heightFactor: isPlump ? 0.6 : isFlat ? 0.46 : 0.4,
    widthFactor: isPlump ? 0.45 : isFlat ? 0.22 : 0.32,
    minSpeed: 0.35 * input.agility,
    maxSpeed: 1.35 * input.agility,
    waveFreq: 6.2 * input.agility,
    waveAmp: isPlump ? 0.18 : 0.15,
    finDrag: isLongTail ? 0.65 : 0.25,
    preferredDepthMin: -1.6,
    preferredDepthMax: 1.65,
    diet: input.diet,
    tempBand: input.tempBand,
    bioload: 0.75 * input.size,
    oxygenUse: 0.7 * input.size,
    algaeCleanRate: 0,
    hasLabyrinth: isFlat,
    hasBarbels: input.morphology === 'fusiform' && input.diet === 'omnivore',
    territorial: false,
    isPondFish: false,
    cost: 15,
    description: `Custom ${input.morphology} fish with ${input.tailStyle} fins and ${input.pattern} markings.`,
  };
}
