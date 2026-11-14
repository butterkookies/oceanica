import { trait } from 'koota';
import { SPECIES_CATALOG, type CreatureBlueprint, type CreatureKind } from '../registry/species';
import type { DecorKind } from '../registry/decor';

export type SimulationMode = 'sandbox' | 'realistic';
export type CameraViewMode = 'side' | 'top' | 'free';
export type LightingPreset = 'auto' | 'morning' | 'day' | 'sunset' | 'night';

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
}

/** World-level tank environment and UI mode state. */
export const TankEnvironment = trait({
  mode: 'sandbox' as SimulationMode,
  cameraMode: 'side' as CameraViewMode,
  oxygen: 92,
  cleanliness: 95,
  temperature: 76, // Fahrenheit (65-72 coldwater, 78-82 tropical)
  algaeLevel: 8,
  carePoints: 120,
  lightingPhase: 'day' as LightingPreset,
  ambientMode: false,
  soundEnabled: false,
  decorateMode: false,
  showSpineDebug: false,
  pixelArt: true,
  pixelScale: 'crisp' as 'chunky' | 'crisp',
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

/** Creature identity and developmental progress. */
export const CreatureMeta = trait({
  name: 'Finley',
  speciesId: 'koi_kohaku',
  kind: 'koi' as CreatureKind,
  ageMinutes: 0,
  growth: 0.72,
});

/** AoS blueprint definition for modular rendering & behavior. */
export const CreatureDna = trait((): CreatureBlueprint => ({ ...SPECIES_CATALOG.koi_kohaku }));

/** Creature life-cycle vitals (0–100 scale; higher is healthier). */
export const CreatureVitals = trait({
  fullness: 88,
  health: 100,
  energy: 95,
  stress: 0,
  alive: true,
});

/** Constrained vertebral spine chain and swimming phase state. */
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
}));

/** Surface-crawling state for freshwater snails. */
export const SnailLocomotion = trait({
  surface: 'floor' as 'floor' | 'leftWall' | 'rightWall' | 'backWall' | 'parasnail',
  vx: 0.14,
  vy: 0,
  vz: 0.06,
  dir: 1,
  t: 0,
  siphonExtend: 0,
});

/** Placeable tank plant, hardscape, or custom decor item. */
export const DecorItem = trait({
  kind: 'cactus' as DecorKind,
  rotationY: 0,
  scale: 1,
  flipped: false,
});

/** Sinking fish food pellet. */
export const FoodPellet = trait({
  vy: -0.55,
  life: 16,
  eaten: false,
});

/** Expanding surface water ripple ring. */
export const WaterRipple = trait({
  radius: 0.08,
  maxRadius: 1.4,
  alpha: 0.85,
});

export const IsFish = trait();
export const IsSnail = trait();
export const IsDecor = trait();
export const IsFood = trait();
export const IsRipple = trait();
