import { createWorld } from 'koota';
import { describe, expect, it } from 'vitest';
import { createCustomFishBlueprint, SPECIES_CATALOG } from '../../registry/species';
import { DECOR_CATALOG, TANK_BOUNDS } from '../../registry/decor';
import {
  ASCII_ATLAS_COLS,
  ASCII_ATLAS_ROWS,
  ASCII_CELL_CSS_H,
  ASCII_CELL_CSS_W,
  ASCII_GLYPH_CHARS,
  computeAsciiGridSize,
  isPureAsciiCharSet,
} from '../../scene/asciiGlyphAtlas';
import { mutateOffspringBlueprint, runEcosystemSystem } from '../systems/ecosystemSystem';
import { runFoodAndRippleSystem } from '../systems/foodSystem';
import { runMovementSystem, SPINE_JOINT_COUNT } from '../systems/movementSystem';
import { runSnailSystem } from '../systems/snailSystem';
import {
  CreatureDna,
  CreatureMeta,
  CreatureMind,
  CreatureVitals,
  DecorItem,
  IsDecor,
  IsFish,
  IsFood,
  IsPlant,
  IsSnail,
  PlantBiology,
  Position,
  SpineKinematics,
  TankAlerts,
  TankEnvironment,
} from '../traits';
import {
  dropFoodPellets,
  populateStarterTank,
  serializeWorldState,
  siphonAndCleanTank,
  spawnCreatureEntity,
  spawnDecorEntity,
  switchTankBiome,
} from '../world';

function makeTestWorld() {
  return createWorld(TankEnvironment, TankAlerts);
}

describe('Oceanica Realistic Ecosystem Simulation', () => {
  it('populates Marine Reef default starter tank with 0 alerts and supports biome switching', () => {
    const world = makeTestWorld();
    populateStarterTank(world);
    runEcosystemSystem(world, 1);

    const env = world.get(TankEnvironment)!;
    expect(env.mode).toBe('realistic');
    expect(env.biome).toBe('marine_reef');
    expect(env.salinity).toBe(35);
    expect(world.get(TankAlerts)!.warnings).toHaveLength(0);

    const fishKinds = world.query(IsFish, CreatureDna).map((e) => e.get(CreatureDna)!.kind);
    expect(fishKinds.filter((k) => k === 'clownfish')).toHaveLength(2);
    expect(fishKinds.filter((k) => k === 'tang')).toHaveLength(1);
    expect(fishKinds.filter((k) => k === 'chromis')).toHaveLength(4);
    expect(world.query(IsSnail)).toHaveLength(2);

    const decorKinds = world.query(IsDecor, DecorItem).map((e) => e.get(DecorItem)!.kind);
    expect(decorKinds).toContain('anemone');
    expect(decorKinds).toContain('caulerpa');
    expect(decorKinds).toContain('seagrass');
    expect(decorKinds).toContain('live_rock');
    expect(decorKinds).toContain('bubbler');

    switchTankBiome(world, 'freshwater_tropical');
    expect(world.get(TankEnvironment)!.biome).toBe('freshwater_tropical');
    expect(world.get(TankEnvironment)!.salinity).toBe(0);
    expect(world.query(IsFish, CreatureDna).some((e) => e.get(CreatureDna)!.kind === 'tetra')).toBe(true);

    switchTankBiome(world, 'freshwater_coldwater');
    expect(world.get(TankEnvironment)!.biome).toBe('freshwater_coldwater');
    expect(world.query(IsFish, CreatureDna).some((e) => e.get(CreatureDna)!.kind === 'koi')).toBe(true);
  });

  it('models Nitrogen Cycle (NH3 -> NO2- -> NO3- -> flora uptake) and partial water changes', () => {
    const world = makeTestWorld();
    world.set(TankEnvironment, {
      mode: 'realistic',
      biome: 'marine_reef',
      salinity: 35,
      ammonia: 0.4,
      nitrite: 0.1,
      nitrate: 2.0,
      biofilterMaturity: 90,
      lightingPhase: 'day',
    });
    spawnDecorEntity(world, 'live_rock', { x: 0, z: 0 });
    const kelp = spawnDecorEntity(world, 'kelp', { x: 2, z: 0 });
    const startBio = kelp.get(PlantBiology)!;

    for (let i = 0; i < 20; i++) {
      runEcosystemSystem(world, 2);
    }

    const afterEnv = world.get(TankEnvironment)!;
    expect(afterEnv.ammonia).toBeLessThan(0.4);
    expect(afterEnv.nitrate).toBeGreaterThan(2.0);
    expect(kelp.get(PlantBiology)!.growth).toBeGreaterThan(startBio.growth);

    const preChangeNitrate = afterEnv.nitrate;
    siphonAndCleanTank(world);
    expect(world.get(TankEnvironment)!.nitrate).toBeLessThan(preChangeNitrate);
  });

  it('degrades living plants under osmotic mismatch and leaks ammonia while decaying', () => {
    const world = makeTestWorld();
    world.set(TankEnvironment, {
      mode: 'realistic',
      biome: 'freshwater_tropical',
      salinity: 0,
      ammonia: 0,
    });
    const caulerpa = spawnDecorEntity(world, 'caulerpa', { x: 0, z: 0 });
    expect(caulerpa.has(IsPlant)).toBe(true);

    for (let i = 0; i < 25; i++) {
      runEcosystemSystem(world, 1);
    }

    const bio = caulerpa.get(PlantBiology)!;
    expect(bio.health).toBeLessThan(40);
    expect(bio.chlorophyll).toBeLessThan(50);
    expect(bio.droop).toBeGreaterThan(0.5);
    expect(['wilting', 'decaying', 'dead']).toContain(bio.stage);
    expect(world.get(TankEnvironment)!.ammonia).toBeGreaterThan(0);
  });

  it('tracks physiological stress degradation, CreatureMind moods, and generational micro-evolution', () => {
    const world = makeTestWorld();
    world.set(TankEnvironment, {
      mode: 'realistic',
      biome: 'freshwater_tropical',
      salinity: 0,
      ammonia: 0.65,
      temperature: 79,
      ph: 7.0,
    });

    const marineFish = spawnCreatureEntity(world, SPECIES_CATALOG.clownfish_ocellaris, {
      name: 'Shocked',
      x: 0,
      y: 0,
      z: 0,
    });

    for (let i = 0; i < 12; i++) {
      runEcosystemSystem(world, 1);
    }

    const stressedVitals = marineFish.get(CreatureVitals)!;
    const stressedMind = marineFish.get(CreatureMind)!;
    expect(stressedVitals.stress).toBeGreaterThan(55);
    expect(stressedVitals.gillRate).toBeGreaterThan(1.3);
    expect(stressedVitals.colorVibrancy).toBeLessThan(0.95);
    expect(stressedVitals.finIntegrity).toBeLessThan(1.0);
    expect(stressedMind.mood).toBe('stressed');

    // Now test thriving pair reproduction & micro-evolution
    const cleanWorld = makeTestWorld();
    cleanWorld.set(TankEnvironment, {
      mode: 'realistic',
      biome: 'marine_reef',
      salinity: 35,
      temperature: 78,
      ph: 8.2,
    });
    spawnDecorEntity(cleanWorld, 'live_rock', { x: 0, z: 0 });
    spawnDecorEntity(cleanWorld, 'caulerpa', { x: 1.5, z: 0 });

    spawnCreatureEntity(cleanWorld, SPECIES_CATALOG.clownfish_ocellaris, {
      name: 'ParentA',
      x: 0,
      y: 0,
      z: 0,
      growth: 0.88,
      health: 96,
      fullness: 92,
      breedCooldown: 0,
    });
    spawnCreatureEntity(cleanWorld, SPECIES_CATALOG.clownfish_ocellaris, {
      name: 'ParentB',
      x: 0.8,
      y: 0,
      z: 0.3,
      growth: 0.86,
      health: 95,
      fullness: 92,
      breedCooldown: 0,
    });

    runEcosystemSystem(cleanWorld, 1);

    const fishList = cleanWorld.query(IsFish, CreatureMeta);
    expect(fishList.length).toBe(3);
    const fry = fishList.find((e) => e.get(CreatureMeta)!.generation === 2);
    expect(fry).toBeDefined();
    expect(fry!.get(CreatureMeta)!.lifeStage).toBe('fry');

    const mutated = mutateOffspringBlueprint(
      SPECIES_CATALOG.clownfish_ocellaris,
      SPECIES_CATALOG.clownfish_ocellaris,
      81,
    );
    expect(mutated.speciesId).toBe('clownfish_ocellaris');
  });

  it('maintains constrained 3D spine joint spacing in panoramic tank and feeds on pellets', () => {
    const world = makeTestWorld();
    const tang = spawnCreatureEntity(world, SPECIES_CATALOG.tang_regal, {
      name: 'Test Tang',
      x: 0,
      y: 0,
      z: 0,
    });
    tang.set(CreatureVitals, { fullness: 40 });

    dropFoodPellets(world, 0.08, 0.05, 1);
    const food = world.query(IsFood)[0];
    food.set(Position, { x: 0.08, y: 0.02, z: 0.05 });

    for (let step = 0; step < 30; step++) {
      runMovementSystem(world, 0.03);
      runFoodAndRippleSystem(world, 0.03);
    }

    const spine = tang.get(SpineKinematics)!;
    expect(spine.joints).toHaveLength(SPINE_JOINT_COUNT);
    for (let i = 1; i < spine.joints.length; i++) {
      const a = spine.joints[i - 1];
      const b = spine.joints[i];
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeCloseTo(spine.segLen, 3);
    }
    expect(tang.get(CreatureVitals)!.fullness).toBeGreaterThan(40);
  });

  it('moves snails inside panoramic tank bounds and serializes v2 creatures & living plants', () => {
    const world = makeTestWorld();
    const snail = spawnCreatureEntity(world, SPECIES_CATALOG.snail_turbo, { x: 0, z: 0 });

    for (let i = 0; i < 40; i++) {
      runSnailSystem(world, 0.04);
    }

    const pos = snail.get(Position)!;
    expect(Math.abs(pos.x)).toBeLessThanOrEqual(TANK_BOUNDS.halfW);
    expect(Math.abs(pos.z)).toBeLessThanOrEqual(TANK_BOUNDS.halfD);
    expect(pos.y).toBeGreaterThanOrEqual(TANK_BOUNDS.floorY);

    const customBp = createCustomFishBlueprint({
      label: 'Reef Anthias',
      salinityType: 'marine',
      morphology: 'fusiform',
      tailStyle: 'forked',
      pattern: 'bicolor',
      primaryColor: '#d96b27',
      secondaryColor: '#f43f5e',
      finColor: '#fde047',
      size: 0.85,
      agility: 1.2,
      diet: 'carnivore',
      tempBand: 'tropical',
      socialType: 'schooling',
    });
    spawnCreatureEntity(world, customBp, { name: customBp.label });
    spawnDecorEntity(world, 'anemone', { x: 2.5, z: 0.5 });

    expect(TANK_BOUNDS.width).toBe(18);
    expect(DECOR_CATALOG.anemone.isHostAnemone).toBe(true);
    const saved = serializeWorldState(world);
    expect(saved.version).toBe(2);
    expect(saved.creatures).toHaveLength(2);
    expect(saved.decor[0].plant).toBeDefined();
  });

  it('uses exclusively 72 printable 7-bit ASCII characters for the unified scene glyph atlas', () => {
    expect(ASCII_CELL_CSS_W).toBe(2.8);
    expect(ASCII_CELL_CSS_H).toBe(4.2);
    expect(ASCII_ATLAS_COLS * ASCII_ATLAS_ROWS).toBe(72);
    expect(ASCII_GLYPH_CHARS).toHaveLength(72);
    expect(new Set(ASCII_GLYPH_CHARS).size).toBe(72);
    expect(isPureAsciiCharSet(ASCII_GLYPH_CHARS)).toBe(true);

    const desktop1x = computeAsciiGridSize(927, 920, 1);
    expect(desktop1x.cols).toBeGreaterThanOrEqual(300);
    expect(desktop1x.rows).toBeGreaterThanOrEqual(200);

    const capped2x = computeAsciiGridSize(1920, 1080, 2);
    expect(capped2x.cols).toBeLessThanOrEqual(640);
    expect(capped2x.rows).toBeLessThanOrEqual(360);
  });
});
