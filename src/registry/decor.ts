export type BiomeId = 'marine_reef' | 'freshwater_tropical' | 'freshwater_coldwater';
export type SalinityBand = 'marine' | 'freshwater' | 'universal';

export type DecorKind =
  | 'caulerpa'
  | 'seagrass'
  | 'kelp'
  | 'anemone'
  | 'live_rock'
  | 'anubias'
  | 'java_fern'
  | 'vallisneria'
  | 'marimo'
  | 'river_rock'
  | 'driftwood'
  | 'bubbler';

export interface TankDimensions {
  width: number;
  height: number;
  depth: number;
  halfW: number;
  halfD: number;
  floorY: number;
  surfaceY: number;
}

export const TANK_BOUNDS: TankDimensions = {
  width: 18,
  height: 8.2,
  depth: 9.5,
  halfW: 8.75,
  halfD: 4.5,
  floorY: -3.7,
  surfaceY: 3.55,
};

export interface BiomePreset {
  id: BiomeId;
  label: string;
  salinity: number; // ppt (35 = natural reef seawater, 0 = freshwater)
  temperature: number; // °F
  ph: number;
  substrateColor: string;
  description: string;
}

export const BIOME_PRESETS: Record<BiomeId, BiomePreset> = {
  marine_reef: {
    id: 'marine_reef',
    label: 'Marine Reef',
    salinity: 35,
    temperature: 78,
    ph: 8.2,
    substrateColor: '#cfc4ad',
    description: '35 ppt aragonite reef lagoon with live coral rock, macroalgae, anemone host & reef fish.',
  },
  freshwater_tropical: {
    id: 'freshwater_tropical',
    label: 'Tropical',
    salinity: 0,
    temperature: 79,
    ph: 7.0,
    substrateColor: '#b8a586',
    description: 'Warm 0 ppt blackwater-inspired planted biotope with driftwood, epiphytes & schooling tetras.',
  },
  freshwater_coldwater: {
    id: 'freshwater_coldwater',
    label: 'Coldwater',
    salinity: 0,
    temperature: 68,
    ph: 7.4,
    substrateColor: '#a8a298',
    description: 'Cool oxygenated 0 ppt riverine stone & pond ecosystem suited to koi, goldfish & nerites.',
  },
};

export interface DecorBlueprint {
  kind: DecorKind;
  label: string;
  scientificName: string;
  category: 'plant' | 'hardscape' | 'equipment';
  salinityBand: SalinityBand;
  isLivingPlant: boolean;
  tempMinF: number;
  tempMaxF: number;
  phMin: number;
  phMax: number;
  nitrateUptake: number;
  co2Demand: number;
  oxygenBoost: number;
  clarityBuffer: number;
  biofilterBonus: number;
  providesShelter: boolean;
  isHostAnemone: boolean;
  isPerchPlant: boolean;
  growthRate: number;
  phDrift: number;
  radius: number;
  height: number;
  emitsBubbles: boolean;
  isSwaying: boolean;
  cost: number;
  description: string;
}

export const DECOR_CATALOG: Record<DecorKind, DecorBlueprint> = {
  caulerpa: {
    kind: 'caulerpa',
    label: 'Feather Caulerpa',
    scientificName: 'Caulerpa taxifolia',
    category: 'plant',
    salinityBand: 'marine',
    isLivingPlant: true,
    tempMinF: 72,
    tempMaxF: 83,
    phMin: 7.8,
    phMax: 8.5,
    nitrateUptake: 0.42,
    co2Demand: 0.28,
    oxygenBoost: 0.46,
    clarityBuffer: 0.24,
    biofilterBonus: 2,
    providesShelter: true,
    isHostAnemone: false,
    isPerchPlant: false,
    growthRate: 0.0018,
    phDrift: 0,
    radius: 1.05,
    height: 2.35,
    emitsBubbles: false,
    isSwaying: true,
    cost: 16,
    description: 'Fast-growing pinnate marine macroalgae that exports nitrates via stolon runners and releases daytime O₂.',
  },
  seagrass: {
    kind: 'seagrass',
    label: 'Turtle Seagrass',
    scientificName: 'Thalassia testudinum',
    category: 'plant',
    salinityBand: 'marine',
    isLivingPlant: true,
    tempMinF: 73,
    tempMaxF: 84,
    phMin: 7.8,
    phMax: 8.5,
    nitrateUptake: 0.34,
    co2Demand: 0.24,
    oxygenBoost: 0.42,
    clarityBuffer: 0.2,
    biofilterBonus: 2,
    providesShelter: true,
    isHostAnemone: false,
    isPerchPlant: false,
    growthRate: 0.0014,
    phDrift: 0,
    radius: 0.95,
    height: 2.55,
    emitsBubbles: false,
    isSwaying: true,
    cost: 15,
    description: 'True marine angiosperm forming undulating ribbon meadows that shelter schooling Chromis and stabilize sand.',
  },
  kelp: {
    kind: 'kelp',
    label: 'Reef Kelp',
    scientificName: 'Macrocystis pyrifera',
    category: 'plant',
    salinityBand: 'marine',
    isLivingPlant: true,
    tempMinF: 64,
    tempMaxF: 80,
    phMin: 7.8,
    phMax: 8.4,
    nitrateUptake: 0.52,
    co2Demand: 0.32,
    oxygenBoost: 0.58,
    clarityBuffer: 0.28,
    biofilterBonus: 2,
    providesShelter: true,
    isHostAnemone: false,
    isPerchPlant: false,
    growthRate: 0.0021,
    phDrift: 0,
    radius: 0.92,
    height: 4.15,
    emitsBubbles: false,
    isSwaying: true,
    cost: 22,
    description: 'Tall canopy-forming marine macroalgae with buoyant pneumatocysts and rippling laminar blades.',
  },
  anemone: {
    kind: 'anemone',
    label: 'Bubble-Tip Anemone',
    scientificName: 'Entacmaea quadricolor',
    category: 'plant',
    salinityBand: 'marine',
    isLivingPlant: true,
    tempMinF: 74,
    tempMaxF: 82,
    phMin: 8.0,
    phMax: 8.4,
    nitrateUptake: 0.14,
    co2Demand: 0.12,
    oxygenBoost: 0.24,
    clarityBuffer: 0.08,
    biofilterBonus: 3,
    providesShelter: true,
    isHostAnemone: true,
    isPerchPlant: false,
    growthRate: 0.0007,
    phDrift: 0,
    radius: 1.0,
    height: 1.45,
    emitsBubbles: false,
    isSwaying: true,
    cost: 30,
    description: 'Photosynthetic zooxanthellate cnidarian whose swaying bulbous tentacles serve as a natural Clownfish host.',
  },
  live_rock: {
    kind: 'live_rock',
    label: 'Live Reef Rock',
    scientificName: 'Porous Aragonite',
    category: 'hardscape',
    salinityBand: 'marine',
    isLivingPlant: false,
    tempMinF: 64,
    tempMaxF: 86,
    phMin: 7.5,
    phMax: 8.6,
    nitrateUptake: 0.05,
    co2Demand: 0,
    oxygenBoost: 0,
    clarityBuffer: 0.16,
    biofilterBonus: 22,
    providesShelter: true,
    isHostAnemone: false,
    isPerchPlant: false,
    growthRate: 0,
    phDrift: 0.015,
    radius: 1.45,
    height: 1.85,
    emitsBubbles: false,
    isSwaying: false,
    cost: 20,
    description: 'Porous calcium-carbonate reef rock colonized by nitrifying bacteria and coralline algae; buffers alkaline pH.',
  },
  anubias: {
    kind: 'anubias',
    label: 'Anubias barteri',
    scientificName: 'Anubias barteri',
    category: 'plant',
    salinityBand: 'freshwater',
    isLivingPlant: true,
    tempMinF: 68,
    tempMaxF: 84,
    phMin: 6.2,
    phMax: 7.8,
    nitrateUptake: 0.22,
    co2Demand: 0.1,
    oxygenBoost: 0.28,
    clarityBuffer: 0.14,
    biofilterBonus: 2,
    providesShelter: true,
    isHostAnemone: false,
    isPerchPlant: true,
    growthRate: 0.0008,
    phDrift: 0,
    radius: 0.95,
    height: 1.5,
    emitsBubbles: false,
    isSwaying: true,
    cost: 14,
    description: 'Slow-growing leathery epiphyte anchored by rhizome; provides a natural resting perch for Betta fish.',
  },
  java_fern: {
    kind: 'java_fern',
    label: 'Java Fern',
    scientificName: 'Microsorum pteropus',
    category: 'plant',
    salinityBand: 'freshwater',
    isLivingPlant: true,
    tempMinF: 64,
    tempMaxF: 82,
    phMin: 6.0,
    phMax: 7.8,
    nitrateUptake: 0.3,
    co2Demand: 0.14,
    oxygenBoost: 0.36,
    clarityBuffer: 0.18,
    biofilterBonus: 2,
    providesShelter: true,
    isHostAnemone: false,
    isPerchPlant: false,
    growthRate: 0.0011,
    phDrift: 0,
    radius: 1.05,
    height: 2.35,
    emitsBubbles: false,
    isSwaying: true,
    cost: 16,
    description: 'Resilient freshwater epiphyte with lance-shaped fronds that sway in the current and shelter shy fish.',
  },
  vallisneria: {
    kind: 'vallisneria',
    label: 'Jungle Val',
    scientificName: 'Vallisneria spiralis',
    category: 'plant',
    salinityBand: 'freshwater',
    isLivingPlant: true,
    tempMinF: 64,
    tempMaxF: 83,
    phMin: 6.5,
    phMax: 8.0,
    nitrateUptake: 0.44,
    co2Demand: 0.24,
    oxygenBoost: 0.48,
    clarityBuffer: 0.24,
    biofilterBonus: 2,
    providesShelter: true,
    isHostAnemone: false,
    isPerchPlant: false,
    growthRate: 0.0019,
    phDrift: 0,
    radius: 0.95,
    height: 3.65,
    emitsBubbles: false,
    isSwaying: true,
    cost: 15,
    description: 'Ribbon-like freshwater grass that forms lush vertical curtains, absorbs nitrates rapidly, and spreads runners.',
  },
  marimo: {
    kind: 'marimo',
    label: 'Marimo Moss Ball',
    scientificName: 'Aegagropila linnaei',
    category: 'plant',
    salinityBand: 'freshwater',
    isLivingPlant: true,
    tempMinF: 58,
    tempMaxF: 76,
    phMin: 6.5,
    phMax: 8.0,
    nitrateUptake: 0.18,
    co2Demand: 0.08,
    oxygenBoost: 0.18,
    clarityBuffer: 0.16,
    biofilterBonus: 3,
    providesShelter: false,
    isHostAnemone: false,
    isPerchPlant: false,
    growthRate: 0.0005,
    phDrift: 0,
    radius: 0.52,
    height: 0.62,
    emitsBubbles: false,
    isSwaying: false,
    cost: 10,
    description: 'Spherical coldwater filamentous algae colony that thrives in cool currents and consumes dissolved nitrates.',
  },
  river_rock: {
    kind: 'river_rock',
    label: 'Basalt Strata Stones',
    scientificName: 'Weathered Basalt',
    category: 'hardscape',
    salinityBand: 'universal',
    isLivingPlant: false,
    tempMinF: 50,
    tempMaxF: 90,
    phMin: 5.5,
    phMax: 8.8,
    nitrateUptake: 0,
    co2Demand: 0,
    oxygenBoost: 0,
    clarityBuffer: 0.06,
    biofilterBonus: 14,
    providesShelter: true,
    isHostAnemone: false,
    isPerchPlant: false,
    growthRate: 0,
    phDrift: 0,
    radius: 1.25,
    height: 1.15,
    emitsBubbles: false,
    isSwaying: false,
    cost: 10,
    description: 'Layered river stones offering grazing biofilm surfaces for snails and colonization area for beneficial bacteria.',
  },
  driftwood: {
    kind: 'driftwood',
    label: 'Spider Driftwood',
    scientificName: 'Submerged Hardwood',
    category: 'hardscape',
    salinityBand: 'freshwater',
    isLivingPlant: false,
    tempMinF: 50,
    tempMaxF: 90,
    phMin: 5.5,
    phMax: 8.2,
    nitrateUptake: 0,
    co2Demand: 0,
    oxygenBoost: 0,
    clarityBuffer: 0.08,
    biofilterBonus: 12,
    providesShelter: true,
    isHostAnemone: false,
    isPerchPlant: false,
    growthRate: 0,
    phDrift: -0.02,
    radius: 1.35,
    height: 2.25,
    emitsBubbles: false,
    isSwaying: false,
    cost: 18,
    description: 'Gnarled branching hardwood releasing subtle tannins that gently soften freshwater pH and create swim-through cover.',
  },
  bubbler: {
    kind: 'bubbler',
    label: 'Porous Air Diffuser',
    scientificName: 'Micro-Pore Ceramic Stone',
    category: 'equipment',
    salinityBand: 'universal',
    isLivingPlant: false,
    tempMinF: 50,
    tempMaxF: 90,
    phMin: 5.5,
    phMax: 8.8,
    nitrateUptake: 0,
    co2Demand: 0,
    oxygenBoost: 0.9,
    clarityBuffer: 0.1,
    biofilterBonus: 4,
    providesShelter: false,
    isHostAnemone: false,
    isPerchPlant: false,
    growthRate: 0,
    phDrift: 0.004,
    radius: 0.45,
    height: 0.45,
    emitsBubbles: true,
    isSwaying: false,
    cost: 20,
    description: 'Fine-pore air diffuser driving gas exchange at the surface and circulating oxygenated laminar current.',
  },
};
