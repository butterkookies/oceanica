import { createWorld } from 'koota';
import { describe, expect, it } from 'vitest';
import { createCustomFishBlueprint, SPECIES_CATALOG } from '../../registry/species';
import { DECOR_CATALOG, TANK_BOUNDS } from '../../registry/decor';
import { runEcosystemSystem } from '../systems/ecosystemSystem';
import { runFoodAndRippleSystem } from '../systems/foodSystem';
import { runMovementSystem, SPINE_JOINT_COUNT } from '../systems/movementSystem';
import { runSnailSystem } from '../systems/snailSystem';
import {
  CreatureVitals,
  DecorItem,
  IsDecor,
  IsFish,
  IsFood,
  IsSnail,
  Position,
  SpineKinematics,
  TankAlerts,
  TankEnvironment,
} from '../traits';
import {
  dropFoodPellets,
  populateStarterTank,
  serializeWorldState,
  spawnCreatureEntity,
  spawnDecorEntity,
} from '../world';

function makeTestWorld() {
  return createWorld(TankEnvironment, TankAlerts);
}

describe('Oceanica ECS Simulation', () => {
  it('populates starter tank with Koi, Betta, Goldfish, Snails, plants, and Underwater Cactus', () => {
    const world = makeTestWorld();
    populateStarterTank(world);

    expect(world.query(IsFish).length).toBe(3);
    expect(world.query(IsSnail).length).toBe(2);

    const decorKinds = world.query(IsDecor, DecorItem).map((e) => e.get(DecorItem)!.kind);
    expect(decorKinds).toContain('cactus');
    expect(decorKinds).toContain('anubias');
    expect(decorKinds).toContain('java_fern');
    expect(decorKinds).toContain('bubbler');
  });

  it('maintains constrained 3D spine joint spacing and feeds on nearby pellets', () => {
    const world = makeTestWorld();
    const koi = spawnCreatureEntity(world, SPECIES_CATALOG.koi_kohaku, {
      name: 'Test Koi',
      x: 0,
      y: 0,
      z: 0,
    });
    koi.set(CreatureVitals, { fullness: 40 });

    // Drop pellet right in front of the fish
    dropFoodPellets(world, 0.08, 0.05, 1);
    const food = world.query(IsFood)[0];
    food.set(Position, { x: 0.08, y: 0.02, z: 0.05 });

    for (let step = 0; step < 30; step++) {
      runMovementSystem(world, 0.03);
      runFoodAndRippleSystem(world, 0.03);
    }

    const spine = koi.get(SpineKinematics)!;
    expect(spine.joints).toHaveLength(SPINE_JOINT_COUNT);

    for (let i = 1; i < spine.joints.length; i++) {
      const a = spine.joints[i - 1];
      const b = spine.joints[i];
      const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      expect(dist).toBeCloseTo(spine.segLen, 3);
    }

    expect(koi.get(CreatureVitals)!.fullness).toBeGreaterThan(40);
  });

  it('moves snails inside tank bounds without exiting substrate floor', () => {
    const world = makeTestWorld();
    const snail = spawnCreatureEntity(world, SPECIES_CATALOG.snail_mystery, { x: 0, z: 0 });

    for (let i = 0; i < 40; i++) {
      runSnailSystem(world, 0.04);
    }

    const pos = snail.get(Position)!;
    expect(Math.abs(pos.x)).toBeLessThanOrEqual(TANK_BOUNDS.halfW);
    expect(Math.abs(pos.z)).toBeLessThanOrEqual(TANK_BOUNDS.halfD);
    expect(pos.y).toBeGreaterThanOrEqual(TANK_BOUNDS.floorY);
  });

  it('enforces dual-mode rules: Sandbox stays stress-free while Realistic flags clashes and drains health on neglect', () => {
    const world = makeTestWorld();
    populateStarterTank(world);

    // Cozy Sandbox keeps stress at 0 and everyone alive
    world.set(TankEnvironment, { mode: 'sandbox', temperature: 65 });
    runEcosystemSystem(world, 5);
    expect(world.get(TankAlerts)!.warnings).toHaveLength(0);
    for (const f of world.query(IsFish)) {
      expect(f.get(CreatureVitals)!.stress).toBe(0);
      expect(f.get(CreatureVitals)!.alive).toBe(true);
    }

    // Realistic Mode detects tropical Betta + coldwater Goldfish/Koi clash
    world.set(TankEnvironment, { mode: 'realistic', temperature: 66, oxygen: 25, cleanliness: 20 });
    runEcosystemSystem(world, 1);
    const warnings = world.get(TankAlerts)!.warnings;
    expect(warnings.some((w) => w.includes('Thermal clash'))).toBe(true);
    expect(warnings.some((w) => w.includes('Adult Koi'))).toBe(true);

    // Prolonged starvation/neglect in Realistic Mode causes fish health to reach 0
    const betta = world.query(IsFish).find((e) => e.get(CreatureVitals))!;
    betta.set(CreatureVitals, { fullness: 0, health: 1.0, alive: true });
    runEcosystemSystem(world, 10);
    expect(betta.get(CreatureVitals)!.alive).toBe(false);
  });

  it('creates custom fish blueprints and serializes decor and creatures cleanly', () => {
    const world = makeTestWorld();
    const customBp = createCustomFishBlueprint({
      label: 'Neon Dragon',
      morphology: 'compressiform',
      tailStyle: 'crowntail',
      pattern: 'stripes',
      primaryColor: '#06b6d4',
      secondaryColor: '#f43f5e',
      finColor: '#67e8f9',
      size: 0.9,
      agility: 1.2,
      diet: 'carnivore',
      tempBand: 'tropical',
    });

    spawnCreatureEntity(world, customBp, { name: customBp.label });
    spawnDecorEntity(world, 'cactus', { x: 1.5, z: 0.5 });

    expect(DECOR_CATALOG.cactus.category).toBe('novelty');
    const saved = serializeWorldState(world);
    expect(saved.env.pixelArt).toBe(true);
    expect(saved.env.pixelScale).toBe('crisp');
    expect(saved.creatures).toHaveLength(1);
    expect(saved.creatures[0].name).toBe('Neon Dragon');
    expect(saved.decor).toHaveLength(1);
    expect(saved.decor[0].kind).toBe('cactus');

    world.set(TankEnvironment, { pixelArt: false, pixelScale: 'chunky' });
    const updated = serializeWorldState(world);
    expect(updated.env.pixelArt).toBe(false);
    expect(updated.env.pixelScale).toBe('chunky');
  });
});
