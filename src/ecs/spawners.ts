import type { Entity, World } from 'koota';
import { DECOR_CATALOG, TANK_BOUNDS, type DecorKind } from '../registry/decor';
import type { CreatureBlueprint } from '../registry/species';
import { initSpineJoints } from './systems/movementSystem';
import {
  CreatureDna,
  CreatureMeta,
  CreatureMind,
  CreatureVitals,
  DecorItem,
  IsDecor,
  IsFish,
  IsPlant,
  IsSnail,
  PlantBiology,
  Position,
  SnailLocomotion,
  SpineKinematics,
  Velocity,
  type CreatureMood,
  type LifeStage,
  type PlantStage,
} from './traits';

export interface SpawnCreatureOptions {
  name?: string;
  x?: number;
  y?: number;
  z?: number;
  growth?: number;
  ageMinutes?: number;
  lifeStage?: LifeStage;
  generation?: number;
  breedCooldown?: number;
  fullness?: number;
  health?: number;
  energy?: number;
  stress?: number;
  alive?: boolean;
  gillRate?: number;
  finIntegrity?: number;
  colorVibrancy?: number;
  mind?: Partial<{
    mood: CreatureMood;
    thought: string;
    trust: number;
    curiosity: number;
    security: number;
    social: number;
    homeX: number;
    homeY: number;
    homeZ: number;
  }>;
}

export interface SpawnDecorOptions {
  x?: number;
  z?: number;
  rotationY?: number;
  scale?: number;
  flipped?: boolean;
  plant?: Partial<{
    health: number;
    growth: number;
    nutrients: number;
    chlorophyll: number;
    droop: number;
    ageMinutes: number;
    stage: PlantStage;
    generation: number;
    propagateCooldown: number;
    oxygenOutput: number;
  }>;
}

function defaultLifeStage(growth: number): LifeStage {
  if (growth < 0.35) return 'fry';
  if (growth < 0.62) return 'juvenile';
  return 'adult';
}

function defaultPlantStage(health: number, growth: number): PlantStage {
  if (health <= 2) return 'dead';
  if (health < 25) return 'decaying';
  if (health < 52) return 'wilting';
  if (growth < 0.42) return 'sprout';
  if (growth < 0.65) return 'young';
  if (growth >= 0.95 && health >= 84) return 'lush';
  return 'mature';
}

function defaultThought(bp: CreatureBlueprint): string {
  if (bp.hostsAnemone) return 'Seeking a comforting anemone host';
  if (bp.socialType === 'schooling') return 'Scanning for reef schoolmates';
  if (bp.grazesRock) return 'Looking for microalgae on reef rock';
  if (bp.grazesSubstrate) return 'Curious about the sand bed';
  if (bp.perchesOnLeaves) return 'Patrolling upper leaves calmly';
  if (bp.morphology === 'snail') return 'Gliding steadily along biofilm';
  return 'Exploring the water column calmly';
}

export function spawnCreatureEntity(
  world: World,
  blueprint: CreatureBlueprint,
  options?: SpawnCreatureOptions,
): Entity {
  const x = options?.x ?? (Math.random() - 0.5) * (TANK_BOUNDS.halfW * 1.35);
  const z = options?.z ?? (Math.random() - 0.5) * (TANK_BOUNDS.halfD * 1.25);
  const name = options?.name ?? blueprint.label;
  const growth = options?.growth ?? 0.68;
  const lifeStage = options?.lifeStage ?? defaultLifeStage(growth);
  const generation = options?.generation ?? 1;
  const breedCooldown = options?.breedCooldown ?? 35;

  const mindInit = {
    mood: options?.mind?.mood ?? ('content' as CreatureMood),
    thought: options?.mind?.thought ?? defaultThought(blueprint),
    trust: options?.mind?.trust ?? 34,
    curiosity: options?.mind?.curiosity ?? 52,
    security: options?.mind?.security ?? 84,
    social: options?.mind?.social ?? 65,
    startleTimer: 0,
    greetTimer: 0,
    restTimer: 0,
    forageTimer: 0,
    homeX: options?.mind?.homeX ?? x,
    homeY: options?.mind?.homeY ?? (options?.y ?? -1.2),
    homeZ: options?.mind?.homeZ ?? z,
  };

  if (blueprint.morphology === 'snail') {
    const y = options?.y ?? TANK_BOUNDS.floorY + 0.14;
    return world.spawn(
      IsSnail,
      Position({ x, y, z }),
      CreatureMeta({
        name,
        speciesId: blueprint.speciesId,
        kind: blueprint.kind,
        ageMinutes: options?.ageMinutes ?? 0,
        growth,
        lifeStage,
        generation,
        breedCooldown,
      }),
      CreatureDna({ ...blueprint }),
      CreatureVitals({
        fullness: options?.fullness ?? 90,
        health: options?.health ?? 100,
        energy: options?.energy ?? 95,
        stress: options?.stress ?? 0,
        alive: options?.alive ?? true,
        gillRate: options?.gillRate ?? 1.0,
        finIntegrity: options?.finIntegrity ?? 1.0,
        colorVibrancy: options?.colorVibrancy ?? 1.0,
      }),
      CreatureMind({ ...mindInit, homeY: y }),
      SnailLocomotion({
        surface: 'floor',
        vx: (Math.random() > 0.5 ? 1 : -1) * blueprint.minSpeed,
        vy: 0,
        vz: (Math.random() - 0.5) * blueprint.minSpeed,
        dir: 1,
        t: Math.random() * 10,
        siphonExtend: 0,
      }),
    );
  }

  const y =
    options?.y ??
    blueprint.preferredDepthMin +
      Math.random() * (blueprint.preferredDepthMax - blueprint.preferredDepthMin);
  const heading = Math.random() * Math.PI * 2;
  const scale = blueprint.baseScale + (blueprint.maxScale - blueprint.baseScale) * growth;
  const segLen = 0.115 * blueprint.lengthFactor * scale;

  return world.spawn(
    IsFish,
    Position({ x, y, z }),
    Velocity({
      vx: Math.cos(heading) * blueprint.minSpeed,
      vy: 0,
      vz: Math.sin(heading) * blueprint.minSpeed,
    }),
    CreatureMeta({
      name,
      speciesId: blueprint.speciesId,
      kind: blueprint.kind,
      ageMinutes: options?.ageMinutes ?? 0,
      growth,
      lifeStage,
      generation,
      breedCooldown,
    }),
    CreatureDna({ ...blueprint }),
    CreatureVitals({
      fullness: options?.fullness ?? 88,
      health: options?.health ?? 100,
      energy: options?.energy ?? 95,
      stress: options?.stress ?? 0,
      alive: options?.alive ?? true,
      gillRate: options?.gillRate ?? 1.0,
      finIntegrity: options?.finIntegrity ?? 1.0,
      colorVibrancy: options?.colorVibrancy ?? 1.0,
    }),
    CreatureMind({ ...mindInit, homeY: y }),
    SpineKinematics({
      joints: initSpineJoints(x, y, z, heading, segLen),
      segLen,
      phase: Math.random() * Math.PI * 2,
      pectoralPhase: Math.random() * Math.PI * 2,
      heading,
      targetY: y,
      cruiseSpeed: blueprint.minSpeed * 1.15,
      burstTimer: 0.8 + Math.random() * 1.8,
      airTimer: 6 + Math.random() * 8,
      finLag: heading,
      isSurfacing: false,
      isFlaring: false,
      isResting: false,
      pitch: 0,
      bank: 0,
      strokeTimer: Math.random() * 4,
      glideFactor: 0.5,
      gillPhase: Math.random() * Math.PI * 2,
      foraging: false,
    }),
  );
}

export function spawnDecorEntity(
  world: World,
  kind: DecorKind,
  options?: SpawnDecorOptions,
): Entity {
  const x = options?.x ?? (Math.random() - 0.5) * (TANK_BOUNDS.halfW * 1.5);
  const z = options?.z ?? (Math.random() - 0.5) * (TANK_BOUNDS.halfD * 1.3);
  const bp = DECOR_CATALOG[kind];
  const baseScale = options?.scale ?? 1;

  if (bp?.isLivingPlant) {
    const pHealth = options?.plant?.health ?? 96;
    const pGrowth = options?.plant?.growth ?? 0.74;
    const pStage = options?.plant?.stage ?? defaultPlantStage(pHealth, pGrowth);
    return world.spawn(
      IsDecor,
      IsPlant,
      Position({ x, y: TANK_BOUNDS.floorY, z }),
      DecorItem({
        kind,
        rotationY: options?.rotationY ?? (Math.random() - 0.5) * 0.9,
        scale: baseScale,
        flipped: options?.flipped ?? false,
      }),
      PlantBiology({
        isLiving: true,
        health: pHealth,
        growth: pGrowth,
        nutrients: options?.plant?.nutrients ?? 82,
        chlorophyll: options?.plant?.chlorophyll ?? 94,
        droop: options?.plant?.droop ?? 0.04,
        ageMinutes: options?.plant?.ageMinutes ?? 0,
        stage: pStage,
        generation: options?.plant?.generation ?? 1,
        propagateCooldown: options?.plant?.propagateCooldown ?? 90,
        oxygenOutput: options?.plant?.oxygenOutput ?? bp.oxygenBoost,
      }),
    );
  }

  return world.spawn(
    IsDecor,
    Position({ x, y: TANK_BOUNDS.floorY, z }),
    DecorItem({
      kind,
      rotationY: options?.rotationY ?? (Math.random() - 0.5) * 0.9,
      scale: baseScale,
      flipped: options?.flipped ?? false,
    }),
  );
}
