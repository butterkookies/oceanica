import type { World } from 'koota';
import { TANK_BOUNDS } from '../../registry/decor';
import {
  CreatureDna,
  CreatureVitals,
  FoodPellet,
  IsFood,
  IsSnail,
  Position,
  SnailLocomotion,
} from '../traits';

/**
 * Updates freshwater snail surface crawling across the sand bed and tank walls,
 * including occasional Mystery Snail parasnailing and algae/detritus foraging.
 */
export function runSnailSystem(world: World, dt: number): void {
  const clampedDt = Math.min(dt, 0.05);
  const floorY = TANK_BOUNDS.floorY + 0.12;
  const maxWallY = TANK_BOUNDS.surfaceY - 0.25;
  const boundX = TANK_BOUNDS.halfW - 0.16;
  const boundZ = TANK_BOUNDS.halfD - 0.16;

  // Collect floor-level food pellets for scavenging snails
  const floorFoods: Array<{ x: number; z: number; entity: ReturnType<World['query']>[number] }> = [];
  world.query(IsFood, Position, FoodPellet).readEach(([pos, pellet], entity) => {
    if (!pellet.eaten && pos.y < floorY + 0.25) {
      floorFoods.push({ x: pos.x, z: pos.z, entity });
    }
  });

  const snails = world.query(IsSnail, Position, SnailLocomotion, CreatureDna, CreatureVitals);

  for (const entity of snails) {
    const pos = entity.get(Position)!;
    const loco = entity.get(SnailLocomotion)!;
    const dna = entity.get(CreatureDna)!;
    const vitals = entity.get(CreatureVitals)!;

    if (!vitals.alive) continue;

    let { x, y, z } = pos;
    let { surface, vx, vy, vz, dir, t, siphonExtend } = loco;
    t += clampedDt;

    if (surface === 'parasnail') {
      // Gentle Mystery Snail drift downward after letting go near top
      y -= 0.32 * clampedDt;
      x += Math.sin(t * 2.5) * 0.12 * clampedDt;
      if (y <= floorY) {
        y = floorY;
        surface = 'floor';
        vx = (Math.random() > 0.5 ? 1 : -1) * dna.minSpeed;
        vz = (Math.random() - 0.5) * dna.minSpeed;
      }
    } else if (surface === 'backWall') {
      y += vy * clampedDt;
      x += vx * clampedDt;
      if (x < -boundX || x > boundX) vx *= -1;
      if (y >= maxWallY) {
        // Mystery snails extend siphon briefly or parasnail back down
        if (dna.hasLabyrinth && Math.random() < 0.35) {
          surface = 'parasnail';
          siphonExtend = 1;
        } else {
          vy = -Math.abs(vy);
        }
      } else if (y <= floorY) {
        y = floorY;
        surface = 'floor';
        vz = Math.abs(dna.minSpeed);
      }
      siphonExtend = Math.max(0, siphonExtend - clampedDt * 0.25);
    } else {
      // Crawling on sand substrate floor
      y = floorY;
      // Steer toward fallen pellets if omnivorous scavenger
      if (dna.diet !== 'herbivore' && floorFoods.length > 0) {
        const target = floorFoods[0];
        const dx = target.x - x;
        const dz = target.z - z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.6 && dist > 1e-4) {
          vx = (dx / dist) * dna.maxSpeed;
          vz = (dz / dist) * dna.maxSpeed;
        }
        if (dist < 0.26) {
          target.entity.set(FoodPellet, { eaten: true });
          entity.set(CreatureVitals, { fullness: Math.min(100, vitals.fullness + 30) });
        }
      }

      x += vx * clampedDt;
      z += vz * clampedDt;

      if (x < -boundX || x > boundX) {
        x = Math.max(-boundX, Math.min(boundX, x));
        vx *= -1;
      }
      if (z > boundZ) {
        z = boundZ;
        vz *= -1;
      } else if (z < -boundZ) {
        // Transition smoothly onto back glass wall occasionally
        z = -boundZ;
        if (Math.random() < 0.45) {
          surface = 'backWall';
          vy = dna.minSpeed * 0.9;
        } else {
          vz = Math.abs(vz);
        }
      }
      siphonExtend = 0;
    }

    dir = vx >= 0 ? 1 : -1;
    entity.set(Position, { x, y, z }, false);
    entity.set(SnailLocomotion, { surface, vx, vy, vz, dir, t, siphonExtend }, false);
  }
}
