import type { Entity, World } from 'koota';
import { DECOR_CATALOG, TANK_BOUNDS } from '../../registry/decor';
import {
  CreatureDna,
  CreatureMeta,
  CreatureVitals,
  DecorItem,
  FoodPellet,
  IsDecor,
  IsFish,
  IsFood,
  Position,
  SpineKinematics,
  Velocity,
  WaterRipple,
  IsRipple,
} from '../traits';

export const SPINE_JOINT_COUNT = 12;

/** Initializes a fish's 3D vertebral spine chain behind its starting head position. */
export function initSpineJoints(
  x: number,
  y: number,
  z: number,
  heading: number,
  segLen: number,
): Array<{ x: number; y: number; z: number }> {
  const joints: Array<{ x: number; y: number; z: number }> = [];
  const dx = Math.cos(heading);
  const dz = Math.sin(heading);
  for (let i = 0; i < SPINE_JOINT_COUNT; i++) {
    joints.push({
      x: x - dx * segLen * i,
      y,
      z: z - dz * segLen * i,
    });
  }
  return joints;
}

interface Obstacle {
  x: number;
  z: number;
  height: number;
  radius: number;
}

interface FoodTarget {
  entity: Entity;
  x: number;
  y: number;
  z: number;
}

function collectObstacles(world: World): Obstacle[] {
  const obstacles: Obstacle[] = [];
  world.query(IsDecor, Position, DecorItem).readEach(([pos, decor]) => {
    const bp = DECOR_CATALOG[decor.kind];
    if (!bp) return;
    obstacles.push({
      x: pos.x,
      z: pos.z,
      height: bp.height * decor.scale,
      radius: bp.radius * decor.scale + 0.25,
    });
  });
  return obstacles;
}

function collectActiveFood(world: World): FoodTarget[] {
  const items: FoodTarget[] = [];
  world.query(IsFood, Position, FoodPellet).readEach(([pos, pellet], entity) => {
    if (!pellet.eaten) {
      items.push({ entity, x: pos.x, y: pos.y, z: pos.z });
    }
  });
  return items;
}

function findNearestFood(x: number, y: number, z: number, foods: FoodTarget[]): FoodTarget | null {
  let nearest: FoodTarget | null = null;
  let bestDist = 5.5;
  for (const f of foods) {
    const d = Math.hypot(f.x - x, (f.y - y) * 1.15, f.z - z);
    if (d < bestDist) {
      bestDist = d;
      nearest = f;
    }
  }
  return nearest;
}

function spawnSurfaceRipple(world: World, x: number, z: number, maxRadius = 0.9): void {
  world.spawn(
    IsRipple,
    Position({ x, y: TANK_BOUNDS.surfaceY - 0.01, z }),
    WaterRipple({ radius: 0.06, maxRadius, alpha: 0.72 }),
  );
}

/** Updates fish steering, obstacle avoidance, feeding bursts, surface breaths, and 3D spine kinematics. */
export function runMovementSystem(world: World, dt: number): void {
  const clampedDt = Math.min(dt, 0.05);
  const obstacles = collectObstacles(world);
  const foods = collectActiveFood(world);

  const fishEntities = world.query(IsFish, Position, Velocity, CreatureDna, CreatureMeta, CreatureVitals, SpineKinematics);

  // Collect neighbor betta positions for territorial flaring check
  const bettaPositions: Array<{ id: number; x: number; y: number; z: number }> = [];
  for (const entity of fishEntities) {
    const dna = entity.get(CreatureDna);
    const pos = entity.get(Position);
    const vitals = entity.get(CreatureVitals);
    if (dna?.territorial && pos && vitals?.alive) {
      bettaPositions.push({ id: entity.id(), x: pos.x, y: pos.y, z: pos.z });
    }
  }

  for (const entity of fishEntities) {
    const pos = entity.get(Position)!;
    const vel = entity.get(Velocity)!;
    const dna = entity.get(CreatureDna)!;
    const meta = entity.get(CreatureMeta)!;
    const vitals = entity.get(CreatureVitals)!;
    const spine = entity.get(SpineKinematics)!;

    const scale = dna.baseScale + (dna.maxScale - dna.baseScale) * meta.growth;
    const desiredSegLen = (0.115 * dna.lengthFactor * scale);
    spine.segLen = desiredSegLen;

    if (spine.joints.length !== SPINE_JOINT_COUNT) {
      spine.joints = initSpineJoints(pos.x, pos.y, pos.z, spine.heading, desiredSegLen);
    }

    // Handle lifeless drift if fish died in Realistic Mode
    if (!vitals.alive) {
      const floatY = Math.min(TANK_BOUNDS.surfaceY - 0.14, pos.y + 0.25 * clampedDt);
      entity.set(Position, { x: pos.x, y: floatY, z: pos.z }, false);
      entity.set(Velocity, { vx: 0, vy: 0, vz: 0 }, false);
      spine.joints[0].x = pos.x;
      spine.joints[0].y = floatY;
      spine.joints[0].z = pos.z;
      continue;
    }

    const energyScale = 0.5 + 0.5 * (vitals.health / 100);
    const minSpeed = dna.minSpeed * energyScale;
    const maxSpeed = dna.maxSpeed * energyScale;

    let desiredVx = vel.vx;
    let desiredVy = vel.vy;
    let desiredVz = vel.vz;
    let seekingFood = false;

    // 1. Seek dropped food if hungry or nearby
    if (foods.length > 0 && vitals.fullness < 98) {
      const food = findNearestFood(pos.x, pos.y, pos.z, foods);
      if (food) {
        seekingFood = true;
        spine.isSurfacing = false;
        const dx = food.x - pos.x;
        const dy = food.y - pos.y;
        const dz = food.z - pos.z;
        const dist = Math.hypot(dx, dy, dz) || 1e-4;
        desiredVx = (dx / dist) * maxSpeed;
        desiredVy = (dy / dist) * maxSpeed * 0.85;
        desiredVz = (dz / dist) * maxSpeed;

        if (dist < 0.28 * scale + 0.12) {
          const pellet = food.entity.get(FoodPellet);
          if (pellet && !pellet.eaten) {
            food.entity.set(FoodPellet, { eaten: true });
            const nextFullness = Math.min(100, vitals.fullness + 26);
            const nextEnergy = Math.min(100, vitals.energy + 12);
            const nextGrowth = Math.min(1, meta.growth + 0.018);
            entity.set(CreatureVitals, { fullness: nextFullness, energy: nextEnergy });
            entity.set(CreatureMeta, { growth: nextGrowth });
            if (food.y > TANK_BOUNDS.surfaceY - 0.35) {
              spawnSurfaceRipple(world, pos.x, pos.z, 0.75);
            }
          }
        }
      }
    }

    // 2. Normal wandering, labyrinth surfacing, and obstacle steering
    if (!seekingFood) {
      spine.burstTimer -= clampedDt;
      if (spine.burstTimer <= 0) {
        spine.burstTimer = 1.4 + Math.random() * 2.6;
        spine.heading += (Math.random() - 0.5) * 1.35;
        spine.targetY =
          dna.preferredDepthMin +
          Math.random() * (dna.preferredDepthMax - dna.preferredDepthMin);
        spine.cruiseSpeed = minSpeed + Math.random() * (maxSpeed - minSpeed) * 0.62;
      }

      // Betta labyrinth surface breath
      if (dna.hasLabyrinth) {
        spine.airTimer -= clampedDt;
        if (spine.airTimer <= 0) {
          spine.isSurfacing = true;
          spine.targetY = TANK_BOUNDS.surfaceY - 0.16;
          if (pos.y >= TANK_BOUNDS.surfaceY - 0.24) {
            spine.isSurfacing = false;
            spine.airTimer = 9 + Math.random() * 8;
            spine.targetY = (dna.preferredDepthMin + dna.preferredDepthMax) * 0.5;
            spawnSurfaceRipple(world, pos.x, pos.z, 0.85);
          }
        }
      }

      // Territorial flaring check for Bettas
      spine.isFlaring = false;
      if (dna.territorial) {
        for (const other of bettaPositions) {
          if (other.id === entity.id()) continue;
          const dist = Math.hypot(other.x - pos.x, other.y - pos.y, other.z - pos.z);
          if (dist < 1.8) {
            spine.isFlaring = true;
            break;
          }
        }
      }

      // Soft tank boundary steering
      const marginX = TANK_BOUNDS.halfW - 0.75;
      const marginZ = TANK_BOUNDS.halfD - 0.65;
      if (pos.x < -marginX) {
        spine.heading = Math.atan2(Math.sin(spine.heading), Math.abs(Math.cos(spine.heading)) + 0.6);
      } else if (pos.x > marginX) {
        spine.heading = Math.atan2(Math.sin(spine.heading), -Math.abs(Math.cos(spine.heading)) - 0.6);
      }
      if (pos.z < -marginZ) {
        spine.heading = Math.atan2(Math.abs(Math.sin(spine.heading)) + 0.6, Math.cos(spine.heading));
      } else if (pos.z > marginZ) {
        spine.heading = Math.atan2(-Math.abs(Math.sin(spine.heading)) - 0.6, Math.cos(spine.heading));
      }

      // Smooth obstacle avoidance (e.g. underwater cactus, driftwood, stones)
      for (const obs of obstacles) {
        if (pos.y > TANK_BOUNDS.floorY + obs.height + 0.3) continue;
        const dx = pos.x - obs.x;
        const dz = pos.z - obs.z;
        const dist = Math.hypot(dx, dz);
        const safeR = obs.radius + 0.45 * scale;
        if (dist < safeR && dist > 1e-4) {
          spine.heading = Math.atan2(dz, dx);
          spine.cruiseSpeed = Math.max(spine.cruiseSpeed, minSpeed * 1.15);
        }
      }

      // Gentle personal-space separation between swimming fish
      for (const other of fishEntities) {
        if (other.id() === entity.id()) continue;
        const oPos = other.get(Position);
        if (!oPos) continue;
        const dx = pos.x - oPos.x;
        const dy = pos.y - oPos.y;
        const dz = pos.z - oPos.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 1.1 && dist > 1e-4) {
          spine.heading = Math.atan2(dz, dx);
        }
      }

      const targetSpeed = spine.isSurfacing ? maxSpeed * 0.75 : spine.cruiseSpeed;
      desiredVx = Math.cos(spine.heading) * targetSpeed;
      desiredVz = Math.sin(spine.heading) * targetSpeed;
      desiredVy = Math.max(-0.85, Math.min(0.85, (spine.targetY - pos.y) * (spine.isSurfacing ? 1.5 : 0.7)));
    }

    // 3. Smooth velocity damping (burst-glide fluid feel)
    const steerRate = seekingFood ? 4.8 : 2.3;
    const blend = Math.min(1, steerRate * clampedDt);
    const vx = vel.vx + (desiredVx - vel.vx) * blend;
    const vy = vel.vy + (desiredVy - vel.vy) * blend;
    const vz = vel.vz + (desiredVz - vel.vz) * blend;

    const nx = Math.max(-TANK_BOUNDS.halfW + 0.32, Math.min(TANK_BOUNDS.halfW - 0.32, pos.x + vx * clampedDt));
    const maxY = spine.isSurfacing ? TANK_BOUNDS.surfaceY - 0.18 : TANK_BOUNDS.surfaceY - 0.36;
    const ny = Math.max(TANK_BOUNDS.floorY + 0.25, Math.min(maxY, pos.y + vy * clampedDt));
    const nz = Math.max(-TANK_BOUNDS.halfD + 0.32, Math.min(TANK_BOUNDS.halfD - 0.32, pos.z + vz * clampedDt));

    entity.set(Position, { x: nx, y: ny, z: nz }, false);
    entity.set(Velocity, { vx, vy, vz }, false);

    // 4. Advance swimming wave phase & fin drag
    const speed = Math.hypot(vx, vy, vz);
    const speedNorm = Math.min(1.6, speed / Math.max(0.2, dna.maxSpeed));
    spine.phase += clampedDt * dna.waveFreq * (0.42 + speedNorm * 0.92);
    spine.pectoralPhase += clampedDt * (4.2 + speedNorm * 4.5);

    const hAngle = Math.atan2(vz, vx);
    let angDiff = hAngle - spine.finLag;
    while (angDiff > Math.PI) angDiff -= Math.PI * 2;
    while (angDiff < -Math.PI) angDiff += Math.PI * 2;
    spine.finLag += angDiff * Math.min(1, clampedDt * (5.2 - dna.finDrag * 2.5));

    // 5. Solve 3D distance-constrained spine chain
    spine.joints[0].x = nx;
    spine.joints[0].y = ny;
    spine.joints[0].z = nz;

    for (let i = 1; i < SPINE_JOINT_COUNT; i++) {
      const prev = spine.joints[i - 1];
      const curr = spine.joints[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dz = curr.z - prev.z;
      const dist = Math.hypot(dx, dy, dz) || 1e-5;
      const ratio = desiredSegLen / dist;
      curr.x = prev.x + dx * ratio;
      curr.y = prev.y + dy * ratio;
      curr.z = prev.z + dz * ratio;
    }
  }
}
