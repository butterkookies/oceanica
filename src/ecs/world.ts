import { createWorld, type Entity, type World } from 'koota';
import { BIOME_PRESETS, DECOR_CATALOG, TANK_BOUNDS, type BiomeId } from '../registry/decor';
import { SPECIES_CATALOG } from '../registry/species';
import {
  clearAquariumState,
  loadAquariumState,
  saveAquariumState,
  type SavedAquariumState,
} from './storage';
import { spawnCreatureEntity, spawnDecorEntity } from './spawners';
import { runEcosystemSystem } from './systems/ecosystemSystem';
import {
  CreatureDna,
  CreatureMeta,
  CreatureMind,
  CreatureVitals,
  DecorItem,
  FoodPellet,
  IsDecor,
  IsFish,
  IsFood,
  IsPlant,
  IsRipple,
  IsSnail,
  PlantBiology,
  Position,
  TankAlerts,
  TankEnvironment,
  WaterRipple,
} from './traits';

export { spawnCreatureEntity, spawnDecorEntity };

export const oceanicaWorld = createWorld(TankEnvironment, TankAlerts);

export function dropFoodPellets(world: World, x: number, z: number, count = 4): void {
  const clampedX = Math.max(-TANK_BOUNDS.halfW + 0.5, Math.min(TANK_BOUNDS.halfW - 0.5, x));
  const clampedZ = Math.max(-TANK_BOUNDS.halfD + 0.5, Math.min(TANK_BOUNDS.halfD - 0.5, z));

  for (let i = 0; i < count; i++) {
    world.spawn(
      IsFood,
      Position({
        x: clampedX + (Math.random() - 0.5) * 0.65,
        y: TANK_BOUNDS.surfaceY - 0.05,
        z: clampedZ + (Math.random() - 0.5) * 0.65,
      }),
      FoodPellet({
        vy: -0.46 - Math.random() * 0.2,
        life: 24,
        eaten: false,
      }),
    );
  }

  world.spawn(
    IsRipple,
    Position({ x: clampedX, y: TANK_BOUNDS.surfaceY - 0.01, z: clampedZ }),
    WaterRipple({ radius: 0.08, maxRadius: 1.75, alpha: 0.88 }),
  );
}

/** Performs a realistic 38% partial water change + substrate siphon. */
export function siphonAndCleanTank(world: World): void {
  const env = world.get(TankEnvironment);
  if (!env) return;
  const preset = BIOME_PRESETS[env.biome] ?? BIOME_PRESETS.marine_reef;
  world.set(TankEnvironment, {
    cleanliness: Math.min(100, env.cleanliness + 28),
    algaeLevel: Math.max(0, env.algaeLevel - 30),
    ammonia: Number((env.ammonia * 0.62).toFixed(3)),
    nitrite: Number((env.nitrite * 0.62).toFixed(3)),
    nitrate: Number((env.nitrate * 0.62).toFixed(2)),
    ph: Number((env.ph + (preset.ph - env.ph) * 0.35).toFixed(2)),
    salinity: Number((env.salinity + (preset.salinity - env.salinity) * 0.35).toFixed(1)),
  });
}

export const waterChangeAndSiphon = siphonAndCleanTank;

export function pulseOxygenAerator(world: World): void {
  const env = world.get(TankEnvironment);
  if (!env) return;
  world.set(TankEnvironment, {
    oxygen: Math.min(100, env.oxygen + 18),
  });
  world.query(IsDecor, Position, DecorItem).readEach(([pos, decor]) => {
    if (DECOR_CATALOG[decor.kind]?.emitsBubbles) {
      world.spawn(
        IsRipple,
        Position({ x: pos.x, y: TANK_BOUNDS.surfaceY - 0.01, z: pos.z }),
        WaterRipple({ radius: 0.08, maxRadius: 1.5, alpha: 0.78 }),
      );
    }
  });
}

/** Drops targeted food pellets directly above a pet and deepens its owner Trust bond. */
export function targetFeedCreature(world: World, entity: Entity): void {
  const pos = entity.get(Position);
  if (!pos) return;
  dropFoodPellets(world, pos.x, pos.z, 3);
  const mind = entity.get(CreatureMind);
  if (mind) {
    entity.set(CreatureMind, {
      trust: Math.min(100, mind.trust + 3.5),
      curiosity: Math.min(100, mind.curiosity + 12),
      greetTimer: 3.5,
      thought: 'Swimming toward your hand-fed morsels!',
    });
  }
}

/** Gently engages a pet at the glass, boosting curiosity and Trust bond. */
export function greetCreature(world: World, entity: Entity): void {
  const mind = entity.get(CreatureMind);
  const vitals = entity.get(CreatureVitals);
  if (!mind || !vitals?.alive) return;
  const nextTrust = Math.min(100, mind.trust + 2.5);
  entity.set(CreatureMind, {
    trust: nextTrust,
    curiosity: Math.min(100, mind.curiosity + 15),
    greetTimer: 4.0,
    startleTimer: 0,
    mood: nextTrust > 42 ? 'affectionate' : 'curious',
    thought: nextTrust > 42 ? 'Affectionately greeting you at the glass' : 'Curiously watching your gentle presence',
  });
  persistWorldState(world);
}

/** Replenishes nutrients and trace elements for a living aquatic plant or anemone. */
export function fertilizePlant(world: World, entity: Entity): void {
  if (!entity.has(IsPlant)) return;
  const plant = entity.get(PlantBiology);
  if (!plant || plant.health <= 0) return;
  entity.set(PlantBiology, {
    nutrients: Math.min(100, plant.nutrients + 38),
    chlorophyll: Math.min(100, plant.chlorophyll + 14),
    health: Math.min(100, plant.health + 10),
    droop: Math.max(0, plant.droop - 0.18),
  });
  persistWorldState(world);
}

/** Trims decaying leaves/stolons on a living plant, halting ammonia leak and stimulating new growth. */
export function prunePlant(world: World, entity: Entity): void {
  if (!entity.has(IsPlant)) return;
  const plant = entity.get(PlantBiology);
  if (!plant) return;
  entity.set(PlantBiology, {
    health: Math.min(100, Math.max(45, plant.health + 22)),
    chlorophyll: Math.min(100, Math.max(55, plant.chlorophyll + 18)),
    droop: Math.max(0, plant.droop - 0.3),
    growth: Math.max(0.35, plant.growth * 0.88),
    stage: 'mature',
  });
  persistWorldState(world);
}

export function populateBiomeTank(world: World, biome: BiomeId = 'marine_reef'): void {
  const preset = BIOME_PRESETS[biome];
  world.set(TankEnvironment, {
    biome,
    salinity: preset.salinity,
    temperature: preset.temperature,
    ph: preset.ph,
    co2: 14,
    ammonia: 0.02,
    nitrite: 0.01,
    nitrate: 4.0,
    biofilterMaturity: 68,
    oxygen: 92,
    cleanliness: 96,
    algaeLevel: 6,
  });

  if (biome === 'marine_reef') {
    // Pair of Ocellaris Clownfish hosting near the Bubble-Tip Anemone
    spawnCreatureEntity(world, SPECIES_CATALOG.clownfish_ocellaris, {
      name: 'Coral',
      x: -2.2,
      y: -1.1,
      z: 0.6,
      growth: 0.74,
      mind: { trust: 42, thought: 'Hovering playfully above Bubble-Tip Anemone' },
    });
    spawnCreatureEntity(world, SPECIES_CATALOG.clownfish_ocellaris, {
      name: 'Marlin',
      x: -1.2,
      y: -1.5,
      z: 1.1,
      growth: 0.68,
      mind: { trust: 38, thought: 'Swirling in tandem around reef anemone' },
    });

    // Regal Blue Tang grazing reef rock & sweeping midwater
    spawnCreatureEntity(world, SPECIES_CATALOG.tang_regal, {
      name: 'Indigo',
      x: 2.2,
      y: 0.4,
      z: -0.4,
      growth: 0.76,
      mind: { trust: 34, thought: 'Gliding across the reef canyon' },
    });

    // School of 4 Blue-Green Reef Chromis
    for (let i = 0; i < 4; i++) {
      spawnCreatureEntity(world, SPECIES_CATALOG.chromis_green, {
        name: `Shimmer ${i + 1}`,
        x: 0.6 + (i - 1.5) * 0.75,
        y: 1.35 + (i % 2) * 0.35,
        z: -0.5 + (i % 3) * 0.45,
        growth: 0.72,
        mind: { mood: 'playful', thought: 'Schooling in rhythm with reef mates' },
      });
    }

    // 2 Mexican Turbo Snails grazing aragonite & rock
    spawnCreatureEntity(world, SPECIES_CATALOG.snail_turbo, { name: 'Turbo', x: -3.2, z: 1.8 });
    spawnCreatureEntity(world, SPECIES_CATALOG.snail_turbo, { name: 'Shellby', x: 3.6, z: -1.4 });

    // Marine Reef Aquascape across panoramic 18 x 8.2 x 9.5 tank
    spawnDecorEntity(world, 'bubbler', { x: -7.1, z: -2.4, scale: 1.15 });
    spawnDecorEntity(world, 'live_rock', { x: -2.6, z: -0.6, rotationY: 0.3, scale: 1.32 });
    spawnDecorEntity(world, 'anemone', { x: -2.1, z: 0.3, rotationY: 0.2, scale: 1.24 });
    spawnDecorEntity(world, 'live_rock', { x: 3.8, z: -1.1, rotationY: -0.4, scale: 1.35 });
    spawnDecorEntity(world, 'caulerpa', { x: -5.4, z: -1.6, rotationY: 0.2, scale: 1.22 });
    spawnDecorEntity(world, 'caulerpa', { x: 1.6, z: -2.3, rotationY: -0.35, scale: 1.18 });
    spawnDecorEntity(world, 'seagrass', { x: -0.4, z: 1.9, rotationY: 0.15, scale: 1.22 });
    spawnDecorEntity(world, 'seagrass', { x: 5.8, z: 1.2, rotationY: -0.25, scale: 1.28 });
    spawnDecorEntity(world, 'kelp', { x: 6.4, z: -2.2, rotationY: 0.4, scale: 1.22 });
    return;
  }

  if (biome === 'freshwater_tropical') {
    spawnCreatureEntity(world, SPECIES_CATALOG.betta_halfmoon, {
      name: 'Sapphire',
      x: -2.8,
      y: 1.0,
      z: 0.6,
      growth: 0.76,
      mind: { trust: 40, thought: 'Patrolling broad Anubias leaves calmly' },
    });
    for (let i = 0; i < 4; i++) {
      spawnCreatureEntity(world, SPECIES_CATALOG.tetra_cardinal, {
        name: `Ruby ${i + 1}`,
        x: 1.4 + (i - 1.5) * 0.65,
        y: -0.4 + (i % 2) * 0.4,
        z: 0.4 + (i % 3) * 0.4,
        growth: 0.74,
        mind: { mood: 'playful', thought: 'Schooling cleanly through Jungle Val' },
      });
    }
    spawnCreatureEntity(world, SPECIES_CATALOG.snail_mystery, { name: 'Sunny', x: -1.4, z: 1.9 });
    spawnCreatureEntity(world, SPECIES_CATALOG.snail_nerite, { name: 'Ziggy', x: 3.8, z: -1.6 });

    spawnDecorEntity(world, 'bubbler', { x: -7.0, z: -2.4, scale: 1.15 });
    spawnDecorEntity(world, 'driftwood', { x: 0.8, z: -1.3, rotationY: 0.3, scale: 1.32 });
    spawnDecorEntity(world, 'river_rock', { x: -3.1, z: -1.2, rotationY: 0.4, scale: 1.28 });
    spawnDecorEntity(world, 'anubias', { x: -2.7, z: -0.7, rotationY: -0.2, scale: 1.22 });
    spawnDecorEntity(world, 'anubias', { x: 1.4, z: -0.9, rotationY: 0.3, scale: 1.16 });
    spawnDecorEntity(world, 'java_fern', { x: -5.2, z: -2.1, rotationY: 0.3, scale: 1.25 });
    spawnDecorEntity(world, 'java_fern', { x: 4.5, z: -1.8, rotationY: -0.25, scale: 1.22 });
    spawnDecorEntity(world, 'vallisneria', { x: 6.2, z: -1.6, rotationY: 0.2, scale: 1.24 });
    spawnDecorEntity(world, 'vallisneria', { x: -6.1, z: 1.1, rotationY: -0.15, scale: 1.18 });
    return;
  }

  // freshwater_coldwater
  spawnCreatureEntity(world, SPECIES_CATALOG.koi_kohaku, {
    name: 'Kohaku',
    x: -1.5,
    y: 0.2,
    z: 0.2,
    growth: 0.72,
    mind: { trust: 44, thought: 'Gliding smoothly over river stones' },
  });
  spawnCreatureEntity(world, SPECIES_CATALOG.koi_sanke, {
    name: 'Sanke',
    x: 2.2,
    y: -0.6,
    z: -0.5,
    growth: 0.7,
  });
  spawnCreatureEntity(world, SPECIES_CATALOG.goldfish_oranda, {
    name: 'Mochi',
    x: -3.8,
    y: -1.4,
    z: 1.2,
    growth: 0.74,
  });
  spawnCreatureEntity(world, SPECIES_CATALOG.goldfish_comet, {
    name: 'Amber',
    x: 3.9,
    y: 0.9,
    z: 0.8,
    growth: 0.72,
  });
  spawnCreatureEntity(world, SPECIES_CATALOG.snail_nerite, { name: 'Pebble', x: -1.2, z: 1.8 });
  spawnCreatureEntity(world, SPECIES_CATALOG.snail_nerite, { name: 'Stripes', x: 3.1, z: -1.5 });

  spawnDecorEntity(world, 'bubbler', { x: -7.1, z: -2.4, scale: 1.16 });
  spawnDecorEntity(world, 'river_rock', { x: -2.5, z: -1.3, rotationY: 0.4, scale: 1.32 });
  spawnDecorEntity(world, 'river_rock', { x: 3.6, z: -1.1, rotationY: -0.35, scale: 1.28 });
  spawnDecorEntity(world, 'driftwood', { x: 0.5, z: -1.7, rotationY: 0.2, scale: 1.28 });
  spawnDecorEntity(world, 'anubias', { x: -2.1, z: -0.8, rotationY: -0.2, scale: 1.22 });
  spawnDecorEntity(world, 'anubias', { x: 3.3, z: -0.6, rotationY: 0.25, scale: 1.18 });
  spawnDecorEntity(world, 'java_fern', { x: -5.4, z: -1.8, rotationY: 0.3, scale: 1.28 });
  spawnDecorEntity(world, 'java_fern', { x: 5.8, z: -1.6, rotationY: -0.2, scale: 1.24 });
  spawnDecorEntity(world, 'marimo', { x: -0.6, z: 1.9, scale: 1.28 });
  spawnDecorEntity(world, 'marimo', { x: 2.1, z: 1.6, scale: 1.2 });
}

export function populateStarterTank(world: World): void {
  populateBiomeTank(world, 'marine_reef');
}

function clearTankEntities(world: World): void {
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
}

export function switchTankBiome(world: World, biome: BiomeId): void {
  clearTankEntities(world);
  world.set(TankEnvironment, {
    selectedEntityId: -1,
    followEntityId: -1,
    placingDecorKind: '',
  });
  populateBiomeTank(world, biome);
  runEcosystemSystem(world, 0.1);
  persistWorldState(world);
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
    const mind = entity.get(CreatureMind);
    creatures.push({
      name: meta.name,
      speciesId: meta.speciesId,
      kind: meta.kind,
      blueprint: { ...dna },
      position: { x: pos.x, y: pos.y, z: pos.z },
      growth: meta.growth,
      ageMinutes: meta.ageMinutes,
      lifeStage: meta.lifeStage,
      generation: meta.generation,
      breedCooldown: meta.breedCooldown,
      fullness: vitals.fullness,
      health: vitals.health,
      energy: vitals.energy,
      stress: vitals.stress,
      alive: vitals.alive,
      gillRate: vitals.gillRate,
      finIntegrity: vitals.finIntegrity,
      colorVibrancy: vitals.colorVibrancy,
      mind: mind
        ? {
            mood: mind.mood,
            thought: mind.thought,
            trust: mind.trust,
            curiosity: mind.curiosity,
            security: mind.security,
            social: mind.social,
          }
        : undefined,
    });
  }

  const decor: SavedAquariumState['decor'] = [];
  world.query(IsDecor, Position, DecorItem).readEach(([pos, item], entity) => {
    const plant = entity.has(IsPlant) ? entity.get(PlantBiology) : undefined;
    decor.push({
      kind: item.kind,
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotationY: item.rotationY,
      scale: item.scale,
      flipped: item.flipped,
      plant: plant
        ? {
            health: plant.health,
            growth: plant.growth,
            nutrients: plant.nutrients,
            chlorophyll: plant.chlorophyll,
            droop: plant.droop,
            ageMinutes: plant.ageMinutes,
            stage: plant.stage,
            generation: plant.generation,
            propagateCooldown: plant.propagateCooldown,
            oxygenOutput: plant.oxygenOutput,
          }
        : undefined,
    });
  });

  return {
    version: 2,
    savedAt: Date.now(),
    env: {
      mode: env.mode,
      biome: env.biome,
      cameraMode: env.cameraMode,
      salinity: env.salinity,
      ph: env.ph,
      co2: env.co2,
      ammonia: env.ammonia,
      nitrite: env.nitrite,
      nitrate: env.nitrate,
      biofilterMaturity: env.biofilterMaturity,
      currentStrength: env.currentStrength,
      oxygen: env.oxygen,
      cleanliness: env.cleanliness,
      temperature: env.temperature,
      algaeLevel: env.algaeLevel,
      carePoints: env.carePoints,
      lightingPhase: env.lightingPhase,
    },
    creatures,
    decor,
  };
}

export function persistWorldState(world: World): void {
  saveAquariumState(serializeWorldState(world));
}

/**
 * Advances slow real-time biological state gently when returning after an offline gap
 * (capped to 12 hours, stepped in safe sub-steps).
 */
export function simulateOfflineElapsed(world: World, elapsedSeconds: number): void {
  const capped = Math.min(elapsedSeconds, 12 * 3600);
  if (capped < 2) return;
  // Gentle 0.15x offline decay/growth rate so pets don't instantly perish after stepping away briefly
  const effectiveSimSeconds = Math.min(600, capped * 0.08);
  const steps = Math.max(1, Math.ceil(effectiveSimSeconds / 5));
  const stepDt = effectiveSimSeconds / steps;
  for (let i = 0; i < steps; i++) {
    runEcosystemSystem(world, stepDt);
  }
}

export function initializeAquariumWorld(world: World = oceanicaWorld): void {
  const existingCount =
    world.query(IsFish).length + world.query(IsSnail).length + world.query(IsDecor).length;
  if (existingCount > 0) return;

  const saved = loadAquariumState();
  if (saved) {
    world.set(TankEnvironment, {
      mode: saved.env.mode,
      biome: saved.env.biome,
      cameraMode: saved.env.cameraMode,
      salinity: saved.env.salinity,
      ph: saved.env.ph,
      co2: saved.env.co2,
      ammonia: saved.env.ammonia,
      nitrite: saved.env.nitrite,
      nitrate: saved.env.nitrate,
      biofilterMaturity: saved.env.biofilterMaturity,
      currentStrength: saved.env.currentStrength,
      oxygen: saved.env.oxygen,
      cleanliness: saved.env.cleanliness,
      temperature: saved.env.temperature,
      algaeLevel: saved.env.algaeLevel,
      carePoints: saved.env.carePoints,
      lightingPhase: saved.env.lightingPhase,
    });
    for (const c of saved.creatures) {
      spawnCreatureEntity(world, c.blueprint, {
        name: c.name,
        x: c.position.x,
        y: c.position.y,
        z: c.position.z,
        growth: c.growth,
        ageMinutes: c.ageMinutes,
        lifeStage: c.lifeStage,
        generation: c.generation,
        breedCooldown: c.breedCooldown,
        fullness: c.fullness,
        health: c.health,
        energy: c.energy,
        stress: c.stress,
        alive: c.alive,
        gillRate: c.gillRate,
        finIntegrity: c.finIntegrity,
        colorVibrancy: c.colorVibrancy,
        mind: c.mind,
      });
    }
    for (const d of saved.decor) {
      spawnDecorEntity(world, d.kind, {
        x: d.position.x,
        z: d.position.z,
        rotationY: d.rotationY,
        scale: d.scale,
        flipped: d.flipped,
        plant: d.plant,
      });
    }
    const elapsedSec = (Date.now() - saved.savedAt) / 1000;
    simulateOfflineElapsed(world, elapsedSec);
    return;
  }

  populateStarterTank(world);
  runEcosystemSystem(world, 0.1);
}

export function resetWorldToStarter(world: World = oceanicaWorld): void {
  clearAquariumState();
  clearTankEntities(world);
  const currentBiome = world.get(TankEnvironment)?.biome ?? 'marine_reef';
  world.set(TankEnvironment, {
    carePoints: 120,
    selectedEntityId: -1,
    followEntityId: -1,
    placingDecorKind: '',
  });
  populateBiomeTank(world, currentBiome);
  runEcosystemSystem(world, 0.1);
  persistWorldState(world);
}
