import { createWorld, type Entity, type World } from 'koota';
import { DECOR_CATALOG, TANK_BOUNDS, type DecorKind } from '../registry/decor';
import { SPECIES_CATALOG, type CreatureBlueprint } from '../registry/species';
import {
  clearAquariumState,
  loadAquariumState,
  saveAquariumState,
  type SavedAquariumState,
} from './storage';
import { initSpineJoints } from './systems/movementSystem';
import {
  CreatureDna,
  CreatureMeta,
  CreatureVitals,
  DecorItem,
  FoodPellet,
  IsDecor,
  IsFish,
  IsFood,
  IsRipple,
  IsSnail,
  Position,
  SnailLocomotion,
  SpineKinematics,
  TankAlerts,
  TankEnvironment,
  Velocity,
  WaterRipple,
} from './traits';

export const oceanicaWorld = createWorld(TankEnvironment, TankAlerts);

export function spawnCreatureEntity(
  world: World,
  blueprint: CreatureBlueprint,
  options?: {
    name?: string;
    x?: number;
    y?: number;
    z?: number;
    growth?: number;
    ageMinutes?: number;
    fullness?: number;
    health?: number;
    energy?: number;
    alive?: boolean;
  },
): Entity {
  const x = options?.x ?? (Math.random() - 0.5) * (TANK_BOUNDS.halfW * 1.35);
  const z = options?.z ?? (Math.random() - 0.5) * (TANK_BOUNDS.halfD * 1.25);
  const name = options?.name ?? blueprint.label;
  const growth = options?.growth ?? 0.68;

  if (blueprint.morphology === 'snail') {
    const y = options?.y ?? TANK_BOUNDS.floorY + 0.12;
    return world.spawn(
      IsSnail,
      Position({ x, y, z }),
      CreatureMeta({
        name,
        speciesId: blueprint.speciesId,
        kind: blueprint.kind,
        ageMinutes: options?.ageMinutes ?? 0,
        growth,
      }),
      CreatureDna({ ...blueprint }),
      CreatureVitals({
        fullness: options?.fullness ?? 90,
        health: options?.health ?? 100,
        energy: options?.energy ?? 95,
        stress: 0,
        alive: options?.alive ?? true,
      }),
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
    }),
    CreatureDna({ ...blueprint }),
    CreatureVitals({
      fullness: options?.fullness ?? 88,
      health: options?.health ?? 100,
      energy: options?.energy ?? 95,
      stress: 0,
      alive: options?.alive ?? true,
    }),
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
    }),
  );
}

export function spawnDecorEntity(
  world: World,
  kind: DecorKind,
  options?: { x?: number; z?: number; rotationY?: number; scale?: number; flipped?: boolean },
): Entity {
  const x = options?.x ?? (Math.random() - 0.5) * (TANK_BOUNDS.halfW * 1.5);
  const z = options?.z ?? (Math.random() - 0.5) * (TANK_BOUNDS.halfD * 1.3);
  return world.spawn(
    IsDecor,
    Position({ x, y: TANK_BOUNDS.floorY, z }),
    DecorItem({
      kind,
      rotationY: options?.rotationY ?? (Math.random() - 0.5) * 0.8,
      scale: options?.scale ?? 1,
      flipped: options?.flipped ?? false,
    }),
  );
}

export function dropFoodPellets(world: World, x: number, z: number, count = 4): void {
  const clampedX = Math.max(-TANK_BOUNDS.halfW + 0.4, Math.min(TANK_BOUNDS.halfW - 0.4, x));
  const clampedZ = Math.max(-TANK_BOUNDS.halfD + 0.4, Math.min(TANK_BOUNDS.halfD - 0.4, z));

  for (let i = 0; i < count; i++) {
    world.spawn(
      IsFood,
      Position({
        x: clampedX + (Math.random() - 0.5) * 0.45,
        y: TANK_BOUNDS.surfaceY - 0.04,
        z: clampedZ + (Math.random() - 0.5) * 0.45,
      }),
      FoodPellet({
        vy: -0.42 - Math.random() * 0.18,
        life: 16,
        eaten: false,
      }),
    );
  }

  world.spawn(
    IsRipple,
    Position({ x: clampedX, y: TANK_BOUNDS.surfaceY - 0.01, z: clampedZ }),
    WaterRipple({ radius: 0.08, maxRadius: 1.5, alpha: 0.88 }),
  );
}

export function siphonAndCleanTank(world: World): void {
  const env = world.get(TankEnvironment);
  if (!env) return;
  world.set(TankEnvironment, {
    cleanliness: Math.min(100, env.cleanliness + 28),
    algaeLevel: Math.max(0, env.algaeLevel - 32),
  });
}

export function pulseOxygenAerator(world: World): void {
  const env = world.get(TankEnvironment);
  if (!env) return;
  world.set(TankEnvironment, {
    oxygen: Math.min(100, env.oxygen + 20),
  });
  // Spawn visual ripples from bubbler locations
  world.query(IsDecor, Position, DecorItem).readEach(([pos, decor]) => {
    if (DECOR_CATALOG[decor.kind]?.emitsBubbles) {
      world.spawn(
        IsRipple,
        Position({ x: pos.x, y: TANK_BOUNDS.surfaceY - 0.01, z: pos.z }),
        WaterRipple({ radius: 0.06, maxRadius: 1.3, alpha: 0.75 }),
      );
    }
  });
}

export function populateStarterTank(world: World): void {
  // Starter fish & snails
  spawnCreatureEntity(world, SPECIES_CATALOG.betta_halfmoon, {
    name: 'Sapphire',
    x: -1.4,
    y: 0.9,
    z: 0.4,
  });
  spawnCreatureEntity(world, SPECIES_CATALOG.koi_kohaku, {
    name: 'Kohaku',
    x: 0.2,
    y: 0.1,
    z: -0.3,
  });
  spawnCreatureEntity(world, SPECIES_CATALOG.goldfish_oranda, {
    name: 'Mochi',
    x: 1.8,
    y: -0.7,
    z: 0.7,
  });
  spawnCreatureEntity(world, SPECIES_CATALOG.snail_mystery, {
    name: 'Sunny',
    x: -0.9,
    z: 1.1,
  });
  spawnCreatureEntity(world, SPECIES_CATALOG.snail_nerite, {
    name: 'Ziggy',
    x: 2.3,
    z: -1.2,
  });

  // Starter plants, hardscape, bubbler, and signature Underwater Cactus
  spawnDecorEntity(world, 'bubbler', { x: -3.5, z: -1.3, scale: 1 });
  spawnDecorEntity(world, 'java_fern', { x: -2.8, z: -1.6, rotationY: 0.3, scale: 1.05 });
  spawnDecorEntity(world, 'river_rock', { x: -1.3, z: -0.9, rotationY: 0.4, scale: 1.1 });
  spawnDecorEntity(world, 'anubias', { x: -1.1, z: -0.7, rotationY: -0.2, scale: 1 });
  spawnDecorEntity(world, 'driftwood', { x: 0.6, z: -1.2, rotationY: 0.25, scale: 1 });
  spawnDecorEntity(world, 'marimo', { x: 1.1, z: 1.2, scale: 1 });
  spawnDecorEntity(world, 'cactus', { x: 2.9, z: 0.3, rotationY: -0.35, scale: 1.08 });
}

export function serializeWorldState(world: World): SavedAquariumState {
  const env = world.get(TankEnvironment)!;
  const creatures: SavedAquariumState['creatures'] = [];

  const allCreatures = [
    ...world.query(IsFish, Position, CreatureMeta, CreatureDna, CreatureVitals),
    ...world.query(IsSnail, Position, CreatureMeta, CreatureDna, CreatureVitals),
  ];

  for (const entity of allCreatures) {
    const pos = entity.get(Position)!;
    const meta = entity.get(CreatureMeta)!;
    const dna = entity.get(CreatureDna)!;
    const vitals = entity.get(CreatureVitals)!;
    creatures.push({
      name: meta.name,
      speciesId: meta.speciesId,
      kind: meta.kind,
      blueprint: { ...dna },
      position: { x: pos.x, y: pos.y, z: pos.z },
      growth: meta.growth,
      ageMinutes: meta.ageMinutes,
      fullness: vitals.fullness,
      health: vitals.health,
      energy: vitals.energy,
      alive: vitals.alive,
    });
  }

  const decor: SavedAquariumState['decor'] = [];
  world.query(IsDecor, Position, DecorItem).readEach(([pos, item]) => {
    decor.push({
      kind: item.kind,
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotationY: item.rotationY,
      scale: item.scale,
      flipped: item.flipped,
    });
  });

  return {
    version: 1,
    savedAt: Date.now(),
    env: {
      mode: env.mode,
      cameraMode: env.cameraMode,
      oxygen: env.oxygen,
      cleanliness: env.cleanliness,
      temperature: env.temperature,
      algaeLevel: env.algaeLevel,
      carePoints: env.carePoints,
      lightingPhase: env.lightingPhase,
      pixelArt: env.pixelArt,
      pixelScale: env.pixelScale,
    },
    creatures,
    decor,
  };
}

export function persistWorldState(world: World): void {
  saveAquariumState(serializeWorldState(world));
}

export function initializeAquariumWorld(world: World = oceanicaWorld): void {
  const existingCount =
    world.query(IsFish).length + world.query(IsSnail).length + world.query(IsDecor).length;
  if (existingCount > 0) return;

  const saved = loadAquariumState();
  if (saved) {
    world.set(TankEnvironment, {
      mode: saved.env.mode,
      cameraMode: saved.env.cameraMode,
      oxygen: saved.env.oxygen,
      cleanliness: saved.env.cleanliness,
      temperature: saved.env.temperature,
      algaeLevel: saved.env.algaeLevel,
      carePoints: saved.env.carePoints,
      lightingPhase: saved.env.lightingPhase,
      pixelArt: saved.env.pixelArt ?? true,
      pixelScale: saved.env.pixelScale ?? 'crisp',
    });
    for (const c of saved.creatures) {
      spawnCreatureEntity(world, c.blueprint, {
        name: c.name,
        x: c.position.x,
        y: c.position.y,
        z: c.position.z,
        growth: c.growth,
        ageMinutes: c.ageMinutes,
        fullness: c.fullness,
        health: c.health,
        energy: c.energy,
        alive: c.alive,
      });
    }
    for (const d of saved.decor) {
      spawnDecorEntity(world, d.kind, {
        x: d.position.x,
        z: d.position.z,
        rotationY: d.rotationY,
        scale: d.scale,
        flipped: d.flipped,
      });
    }
    return;
  }

  populateStarterTank(world);
}

export function resetWorldToStarter(world: World = oceanicaWorld): void {
  clearAquariumState();
  const entities = [
    ...world.query(IsFish),
    ...world.query(IsSnail),
    ...world.query(IsDecor),
    ...world.query(IsFood),
    ...world.query(IsRipple),
  ];
  for (const e of entities) {
    e.destroy();
  }
  world.set(TankEnvironment, {
    oxygen: 92,
    cleanliness: 95,
    temperature: 76,
    algaeLevel: 8,
    carePoints: 120,
    selectedEntityId: -1,
    followEntityId: -1,
    placingDecorKind: '',
  });
  populateStarterTank(world);
  persistWorldState(world);
}
