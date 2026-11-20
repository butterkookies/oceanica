import { trait } from 'koota';
import { SPECIES_CATALOG, type CreatureBlueprint, type CreatureKind } from '../registry/species';
import type { BiomeId, DecorKind } from '../registry/decor';

export type SimulationMode = 'sandbox' | 'realistic';
export type CameraViewMode = 'side' | 'top' | 'free';
export type LightingPreset = 'auto' | 'morning' | 'day' | 'sunset' | 'night';
export type LifeStage = 'fry' | 'juvenile' | 'adult' | 'elder';
export type CreatureMood =
  | 'content'
  | 'curious'
  | 'playful'
  | 'affectionate'
  | 'hungry'
  | 'resting'
  | 'startled'
  | 'territorial'
  | 'stressed';
export type PlantStage = 'sprout' | 'young' | 'mature' | 'lush' | 'wilting' | 'decaying' | 'dead';

export interface SpineJoint {
  x: number;
  y: number;
  z: number;
}

export interface SpineState {
  joints: SpineJoint[];
  segLen: number;
  phase: number;
  pectoralPhase: number;
  heading: number;
  targetY: number;
  cruiseSpeed: number;
  burstTimer: number;
  airTimer: number;
  finLag: number;
  isSurfacing: boolean;
  isFlaring: boolean;
  isResting: boolean;
  pitch: number;
  bank: number;
  strokeTimer: number;
  glideFactor: number;
  gillPhase: number;
  foraging: boolean;
}

/** World-level tank environment, water chemistry, and UI mode state. */
export const TankEnvironment = trait({
  mode: 'realistic' as SimulationMode,
  biome: 'marine_reef' as BiomeId,
  cameraMode: 'side' as CameraViewMode,
  salinity: 35, // ppt (35 = Marine Reef, 0 = Freshwater)
  ph: 8.2,
  co2: 14, // mg/L
  ammonia: 0.02, // ppm (NH3)
  nitrite: 0.01, // ppm (NO2-)
  nitrate: 4.0, // ppm (NO3-)
  biofilterMaturity: 68, // 0..100%
  currentStrength: 0.45, // 0..1 laminar flow strength
  oxygen: 92,
  cleanliness: 96,
  temperature: 78, // °F
  algaeLevel: 6,
  carePoints: 120,
  lightingPhase: 'day' as LightingPreset,
  ambientMode: false,
  soundEnabled: false,
  decorateMode: false,
  showSpineDebug: false,
  selectedEntityId: -1,
  followEntityId: -1,
  placingDecorKind: '' as DecorKind | '',
});

/** World-level diagnostic warnings for Realistic Mode. */
export const TankAlerts = trait(() => ({
  warnings: [] as string[],
}));

/** 3D position inside tank coordinates. */
export const Position = trait({ x: 0, y: 0, z: 0 });

/** 3D linear velocity inside tank coordinates. */
export const Velocity = trait({ vx: 0, vy: 0, vz: 0 });

/** Creature identity, generation lineage, and developmental progress. */
export const CreatureMeta = trait({
  name: 'Coral',
  speciesId: 'clownfish_ocellaris',
  kind: 'clownfish' as CreatureKind,
  ageMinutes: 0,
  growth: 0.72,
  lifeStage: 'adult' as LifeStage,
  generation: 1,
  breedCooldown: 20,
});

/** AoS blueprint definition for modular rendering & behavior. */
export const CreatureDna = trait((): CreatureBlueprint => ({ ...SPECIES_CATALOG.clownfish_ocellaris }));

/** Creature life-cycle vitals and physiological degradation markers. */
export const CreatureVitals = trait({
  fullness: 88,
  health: 100,
  energy: 95,
  stress: 0,
  alive: true,
  gillRate: 1.0,
  finIntegrity: 1.0,
  colorVibrancy: 1.0,
});

/** Simulated cognitive state, emergent feelings, owner bond, and home territory. */
export const CreatureMind = trait({
  mood: 'content' as CreatureMood,
  thought: 'Exploring the reef calmly',
  trust: 34, // 0..100 owner bond
  curiosity: 52, // 0..100
  security: 84, // 0..100
  social: 65, // 0..100
  startleTimer: 0,
  greetTimer: 0,
  restTimer: 0,
  forageTimer: 0,
  homeX: 0,
  homeY: -2.0,
  homeZ: 0,
});

/** Constrained vertebral spine chain and hydrodynamic swimming phase state. */
export const SpineKinematics = trait((): SpineState => ({
  joints: [],
  segLen: 0.14,
  phase: 0,
  pectoralPhase: 0,
  heading: 0,
  targetY: 0,
  cruiseSpeed: 0.6,
  burstTimer: 1.2,
  airTimer: 8,
  finLag: 0,
  isSurfacing: false,
  isFlaring: false,
  isResting: false,
  pitch: 0,
  bank: 0,
  strokeTimer: 0,
  glideFactor: 0.5,
  gillPhase: 0,
  foraging: false,
}));

/** Surface-crawling state for marine & freshwater snails. */
export const SnailLocomotion = trait({
  surface: 'floor' as 'floor' | 'leftWall' | 'rightWall' | 'backWall' | 'parasnail',
  vx: 0.14,
  vy: 0,
  vz: 0.06,
  dir: 1,
  t: 0,
  siphonExtend: 0,
});

/** Placeable tank plant, hardscape, or equipment item. */
export const DecorItem = trait({
  kind: 'live_rock' as DecorKind,
  rotationY: 0,
  scale: 1,
  flipped: false,
});

/** Biological state for living aquatic plants, macroalgae, and host anemones. */
export const PlantBiology = trait({
  isLiving: true,
  health: 96, // 0..100
  growth: 0.72, // 0.2..1.35
  nutrients: 82, // 0..100 internal N/trace store
  chlorophyll: 94, // 0..100 (low = chlorosis yellowing)
  droop: 0.04, // 0..1 turgor wilt factor
  ageMinutes: 0,
  stage: 'mature' as PlantStage,
  generation: 1,
  propagateCooldown: 90,
  oxygenOutput: 0.4,
});

/** Sinking fish food pellet. */
export const FoodPellet = trait({
  vy: -0.55,
  life: 24,
  eaten: false,
});

/** Expanding surface water ripple ring. */
export const WaterRipple = trait({
  radius: 0.08,
  maxRadius: 1.6,
  alpha: 0.85,
});

export const IsFish = trait();
export const IsSnail = trait();
export const IsDecor = trait();
export const IsPlant = trait();
export const IsFood = trait();
export const IsRipple = trait();
