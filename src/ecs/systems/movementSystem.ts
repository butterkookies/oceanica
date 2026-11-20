import type { Entity, World } from 'koota';
import { DECOR_CATALOG, TANK_BOUNDS } from '../../registry/decor';
import { pointerState } from '../pointerState';
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
  PlantBiology,
  Position,
  SpineKinematics,
  TankEnvironment,
  Velocity,
  WaterRipple,
} from '../traits';

export const SPINE_JOINT_COUNT = 12;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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

interface HabitatAnchor {
  x: number;
  y: number;
  z: number;
  kind: string;
  isAnemone: boolean;
  isPerch: boolean;
  isRock: boolean;
  isShelter: boolean;
}

interface FoodTarget {
  entity: Entity;
  x: number;
  y: number;
  z: number;
}

function collectHabitat(world: World): {
  obstacles: Obstacle[];
  anchors: HabitatAnchor[];
} {
  const obstacles: Obstacle[] = [];
  const anchors: HabitatAnchor[] = [];
  world.query(IsDecor, Position, DecorItem).readEach(([pos, decor], entity) => {
    const bp = DECOR_CATALOG[decor.kind];
    if (!bp) return;
    const plant = entity.has(IsPlant) ? entity.get(PlantBiology) : undefined;
    const gScale = plant ? 0.4 + plant.growth * 0.65 : 1;
    const h = bp.height * decor.scale * gScale;
    const r = bp.radius * decor.scale * gScale;

    if (!bp.isHostAnemone) {
      obstacles.push({ x: pos.x, z: pos.z, height: h, radius: r + 0.28 });
    }
    if (bp.isHostAnemone || bp.isPerchPlant || bp.providesShelter || decor.kind === 'live_rock' || decor.kind === 'river_rock') {
      anchors.push({
        x: pos.x,
        y: TANK_BOUNDS.floorY + Math.min(h * 0.72, 1.45),
        z: pos.z,
        kind: decor.kind,
        isAnemone: bp.isHostAnemone,
        isPerch: bp.isPerchPlant,
        isRock: decor.kind === 'live_rock' || decor.kind === 'river_rock',
        isShelter: bp.providesShelter,
      });
    }
  });
  return { obstacles, anchors };
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
  let bestDist = 7.5;
  for (const f of foods) {
    const d = Math.hypot(f.x - x, (f.y - y) * 1.15, f.z - z);
    if (d < bestDist) {
      bestDist = d;
      nearest = f;
    }
  }
  return nearest;
}

function findNearestAnchor(
  x: number,
  z: number,
  anchors: HabitatAnchor[],
  predicate: (a: HabitatAnchor) => boolean,
): HabitatAnchor | null {
  let best: HabitatAnchor | null = null;
  let bestDist = Infinity;
  for (const a of anchors) {
    if (!predicate(a)) continue;
    const d = Math.hypot(a.x - x, a.z - z);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  return best;
}

function spawnSurfaceRipple(world: World, x: number, z: number, maxRadius = 1.0): void {
  world.spawn(
    IsRipple,
    Position({ x, y: TANK_BOUNDS.surfaceY - 0.01, z }),
    WaterRipple({ radius: 0.06, maxRadius, alpha: 0.75 }),
  );
}

/**
 * Updates natural hydrodynamic propulsion (burst-and-coast), Boids schooling,
 * anemone hosting, leaf perching, circadian night rest, substrate/rock grazing,
 * owner cursor curiosity/startle reactions, and 3D constrained spine kinematics.
 */
export function runMovementSystem(world: World, dt: number): void {
  const clampedDt = Math.min(dt, 0.05);
  const env = world.get(TankEnvironment);
  const { obstacles, anchors } = collectHabitat(world);
  const foods = collectActiveFood(world);
  const isNight = env?.lightingPhase === 'night';
  const currentStrength = env?.currentStrength ?? 0.45;

  const fishEntities = world.query(
    IsFish,
    Position,
    Velocity,
    CreatureDna,
    CreatureMeta,
    CreatureVitals,
    SpineKinematics,
  );

  // Pre-collect fish positions/headings for schooling & territorial flaring
  const fishStates: Array<{
    id: number;
    speciesId: string;
    territorial: boolean;
    x: number;
    y: number;
    z: number;
    heading: number;
  }> = [];
  for (const entity of fishEntities) {
    const dna = entity.get(CreatureDna)!;
    const pos = entity.get(Position)!;
    const vitals = entity.get(CreatureVitals)!;
    const spine = entity.get(SpineKinematics)!;
    if (!vitals.alive) continue;
    fishStates.push({
      id: entity.id(),
      speciesId: dna.speciesId,
      territorial: dna.territorial,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      heading: spine.heading,
    });
  }

  for (const entity of fishEntities) {
    const pos = entity.get(Position)!;
    const vel = entity.get(Velocity)!;
    const dna = entity.get(CreatureDna)!;
    const meta = entity.get(CreatureMeta)!;
    const vitals = entity.get(CreatureVitals)!;
    const spine = entity.get(SpineKinematics)!;
    const mind = entity.get(CreatureMind);

    const scale = dna.baseScale + (dna.maxScale - dna.baseScale) * meta.growth;
    const desiredSegLen = 0.115 * dna.lengthFactor * scale;
    spine.segLen = desiredSegLen;

    if (spine.joints.length !== SPINE_JOINT_COUNT) {
      spine.joints = initSpineJoints(pos.x, pos.y, pos.z, spine.heading, desiredSegLen);
    }

    // Handle lifeless buoyancy drift if fish died in Realistic Mode
    if (!vitals.alive) {
      const floatY = Math.min(TANK_BOUNDS.surfaceY - 0.52, pos.y + 0.25 * clampedDt);
      entity.set(Position, { x: pos.x, y: floatY, z: pos.z }, false);
      entity.set(Velocity, { vx: 0, vy: 0, vz: 0 }, false);
      spine.joints[0].x = pos.x;
      spine.joints[0].y = floatY;
      spine.joints[0].z = pos.z;
      continue;
    }

    const energyScale = 0.45 + 0.55 * (vitals.health / 100) * (0.4 + 0.6 * (vitals.energy / 100));
    const minSpeed = dna.minSpeed * energyScale;
    const maxSpeed = dna.maxSpeed * energyScale;

    // 1. Burst-and-Coast Hydrodynamic Stroke Cycle
    spine.strokeTimer += clampedDt * (1.1 + energyScale * 0.8);
    if (dna.swimStyle === 'labriform_waddle') {
      spine.glideFactor = 0.65 + 0.35 * Math.sin(spine.strokeTimer * 2.1);
    } else {
      const cycle = spine.strokeTimer % 2.4;
      spine.glideFactor = cycle < 0.75 ? 1.0 : 0.38;
    }

    // 2. Owner Cursor Presence (Startle on abrupt motion; Curiosity / Greeting on calm presence)
    if (mind && pointerState.active) {
      const distToCursor = Math.hypot(pointerState.x - pos.x, pointerState.y - pos.y, pointerState.z - pos.z);
      const startleRadius = dna.territorial ? 2.2 : 3.4;
      if (pointerState.speed > 18 && distToCursor < startleRadius && mind.trust < 80) {
        mind.startleTimer = 2.6;
        mind.greetTimer = 0;
        spine.isResting = false;
      } else if (
        pointerState.speed < 6 &&
        distToCursor < 5.0 &&
        mind.trust > 20 &&
        vitals.stress < 45 &&
        mind.startleTimer <= 0
      ) {
        mind.greetTimer = Math.max(mind.greetTimer, 1.4);
      }
    }

    let desiredVx = vel.vx;
    let desiredVy = vel.vy;
    let desiredVz = vel.vz;
    let seekingFood = false;
    spine.foraging = false;

    const prevHeading = spine.heading;

    // 3. Priority A: Feeding on dropped pellets
    if (foods.length > 0 && vitals.fullness < 98 && (mind?.startleTimer ?? 0) <= 0.2) {
      const food = findNearestFood(pos.x, pos.y, pos.z, foods);
      if (food) {
        seekingFood = true;
        spine.isSurfacing = false;
        spine.isResting = false;
        const dx = food.x - pos.x;
        const dy = food.y - pos.y;
        const dz = food.z - pos.z;
        const dist = Math.hypot(dx, dy, dz) || 1e-4;
        desiredVx = (dx / dist) * maxSpeed;
        desiredVy = (dy / dist) * maxSpeed * 0.85;
        desiredVz = (dz / dist) * maxSpeed;
        spine.heading = Math.atan2(dz, dx);

        if (dist < 0.3 * scale + 0.14) {
          const pellet = food.entity.get(FoodPellet);
          if (pellet && !pellet.eaten) {
            food.entity.set(FoodPellet, { eaten: true });
            const nextFullness = Math.min(100, vitals.fullness + 26);
            const nextEnergy = Math.min(100, vitals.energy + 12);
            const nextGrowth = Math.min(1, meta.growth + 0.008);
            entity.set(CreatureVitals, { fullness: nextFullness, energy: nextEnergy });
            entity.set(CreatureMeta, { growth: nextGrowth });
            if (mind) {
              entity.set(CreatureMind, { trust: clamp(mind.trust + 1.4, 0, 100) });
            }
            if (food.y > TANK_BOUNDS.surfaceY - 0.5) {
              spawnSurfaceRipple(world, pos.x, pos.z, 0.85);
            }
          }
        }
      }
    }

    // 4. Priority B: Species Ethology, Schooling, Hosting, Greeting, Resting & Obstacle Steering
    if (!seekingFood) {
      spine.burstTimer -= clampedDt;
      if (spine.burstTimer <= 0) {
        spine.burstTimer = 1.6 + Math.random() * 2.8;
        spine.heading += (Math.random() - 0.5) * 1.15;
        spine.targetY =
          dna.preferredDepthMin +
          Math.random() * (dna.preferredDepthMax - dna.preferredDepthMin);
        spine.cruiseSpeed = minSpeed + Math.random() * (maxSpeed - minSpeed) * 0.58;

        // Occasional substrate sifting / rock grazing or leaf perching
        if (!isNight && (dna.grazesSubstrate || dna.grazesRock) && Math.random() < 0.34 && mind) {
          mind.forageTimer = 3.2;
        }
        if (dna.perchesOnLeaves && Math.random() < 0.24 && mind) {
          mind.restTimer = 4.5;
        }
      }

      // Nocturnal circadian rest
      spine.isResting = Boolean(isNight && !dna.territorial) || Boolean(mind && mind.restTimer > 0 && dna.perchesOnLeaves);

      // Betta labyrinth surface breath OR hypoxia/ammonia distress surfacing
      const distressSurface =
        !dna.hasLabyrinth && vitals.stress > 55 && ((env?.oxygen ?? 100) < 45 || (env?.ammonia ?? 0) > 0.35);

      if (dna.hasLabyrinth || distressSurface) {
        if (dna.hasLabyrinth) spine.airTimer -= clampedDt;
        if (distressSurface || spine.airTimer <= 0) {
          spine.isSurfacing = true;
          spine.isResting = false;
          spine.targetY = TANK_BOUNDS.surfaceY - 0.45;
          if (pos.y >= TANK_BOUNDS.surfaceY - 0.58) {
            spine.isSurfacing = false;
            spine.airTimer = 11 + Math.random() * 8;
            spine.targetY = (dna.preferredDepthMin + dna.preferredDepthMax) * 0.5;
            spawnSurfaceRipple(world, pos.x, pos.z, 0.85);
          }
        }
      } else {
        spine.isSurfacing = false;
      }

      // Territorial flaring check for Bettas
      spine.isFlaring = false;
      if (dna.territorial) {
        for (const other of fishStates) {
          if (other.id === entity.id() || !other.territorial) continue;
          const dist = Math.hypot(other.x - pos.x, other.y - pos.y, other.z - pos.z);
          if (dist < 2.6) {
            spine.isFlaring = true;
            spine.isResting = false;
            break;
          }
        }
      }

      // Startled escape to nearest shelter
      if (mind && mind.startleTimer > 0) {
        const shelter = findNearestAnchor(pos.x, pos.z, anchors, (a) => a.isAnemone || a.isShelter);
        if (shelter) {
          spine.heading = Math.atan2(shelter.z - pos.z, shelter.x - pos.x);
          spine.targetY = shelter.y + 0.35;
        }
        spine.cruiseSpeed = maxSpeed * 1.15;
      } else if (mind && mind.greetTimer > 0 && pointerState.active) {
        // Curious/affectionate greeting near owner's cursor
        const dx = pointerState.x - pos.x;
        const dz = pointerState.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.95) {
          spine.heading = Math.atan2(dz, dx);
        }
        spine.targetY = clamp(pointerState.y, TANK_BOUNDS.floorY + 0.6, TANK_BOUNDS.surfaceY - 0.7);
        spine.cruiseSpeed = (minSpeed + maxSpeed) * 0.55;
      } else if (dna.hostsAnemone) {
        // Clownfish Anemone Hosting territory
        const anemone = findNearestAnchor(pos.x, pos.z, anchors, (a) => a.isAnemone || a.isShelter);
        if (anemone) {
          if (mind) {
            mind.homeX = anemone.x;
            mind.homeY = anemone.y + 0.35;
            mind.homeZ = anemone.z;
          }
          const distHome = Math.hypot(pos.x - anemone.x, pos.z - anemone.z);
          if (distHome > 2.6) {
            spine.heading = Math.atan2(anemone.z - pos.z, anemone.x - pos.x);
            spine.targetY = anemone.y + 0.45;
          }
        }
      } else if (spine.isResting && dna.perchesOnLeaves) {
        const perch = findNearestAnchor(pos.x, pos.z, anchors, (a) => a.isPerch);
        if (perch) {
          const distPerch = Math.hypot(pos.x - perch.x, pos.z - perch.z);
          if (distPerch > 0.65) {
            spine.heading = Math.atan2(perch.z - pos.z, perch.x - pos.x);
          }
          spine.targetY = perch.y + 0.2;
          spine.cruiseSpeed = minSpeed * 0.35;
        }
      } else if (mind && mind.forageTimer > 0) {
        // Substrate sifting or live-rock grazing
        spine.foraging = true;
        if (dna.grazesRock) {
          const rock = findNearestAnchor(pos.x, pos.z, anchors, (a) => a.isRock);
          if (rock) {
            if (Math.hypot(rock.x - pos.x, rock.z - pos.z) > 1.1) {
              spine.heading = Math.atan2(rock.z - pos.z, rock.x - pos.x);
            }
            spine.targetY = rock.y + 0.35;
          }
        } else {
          spine.targetY = TANK_BOUNDS.floorY + 0.52;
        }
        spine.cruiseSpeed = minSpeed * 0.85;
      }

      // Boids Schooling (Reef Chromis & Cardinal Tetras)
      if (dna.socialType === 'schooling' && (!mind || mind.startleTimer <= 0)) {
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        let alignCos = 0;
        let alignSin = 0;
        let count = 0;

        for (const other of fishStates) {
          if (other.id === entity.id() || other.speciesId !== dna.speciesId) continue;
          const dist = Math.hypot(other.x - pos.x, other.y - pos.y, other.z - pos.z);
          if (dist < 4.5) {
            sumX += other.x;
            sumY += other.y;
            sumZ += other.z;
            alignCos += Math.cos(other.heading);
            alignSin += Math.sin(other.heading);
            count += 1;
          }
        }

        if (count > 0) {
          const cx = sumX / count;
          const cy = sumY / count;
          const cz = sumZ / count;
          const distCenter = Math.hypot(cx - pos.x, cz - pos.z);
          const alignAngle = Math.atan2(alignSin, alignCos);

          if (distCenter > 1.35) {
            const cohAngle = Math.atan2(cz - pos.z, cx - pos.x);
            let diff = cohAngle - spine.heading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            spine.heading += diff * Math.min(1, clampedDt * 2.2);
            spine.targetY = spine.targetY * 0.65 + cy * 0.35;
          } else {
            let diff = alignAngle - spine.heading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            spine.heading += diff * Math.min(1, clampedDt * 2.6);
          }
        }
      }

      // Soft tank boundary steering (scaled for bigger panoramic tank)
      const marginX = TANK_BOUNDS.halfW - 1.1;
      const marginZ = TANK_BOUNDS.halfD - 0.9;
      if (pos.x < -marginX) {
        spine.heading = Math.atan2(Math.sin(spine.heading), Math.abs(Math.cos(spine.heading)) + 0.65);
      } else if (pos.x > marginX) {
        spine.heading = Math.atan2(Math.sin(spine.heading), -Math.abs(Math.cos(spine.heading)) - 0.65);
      }
      if (pos.z < -marginZ) {
        spine.heading = Math.atan2(Math.abs(Math.sin(spine.heading)) + 0.65, Math.cos(spine.heading));
      } else if (pos.z > marginZ) {
        spine.heading = Math.atan2(-Math.abs(Math.sin(spine.heading)) - 0.65, Math.cos(spine.heading));
      }

      // Smooth obstacle avoidance
      for (const obs of obstacles) {
        if (pos.y > TANK_BOUNDS.floorY + obs.height + 0.35) continue;
        const dx = pos.x - obs.x;
        const dz = pos.z - obs.z;
        const dist = Math.hypot(dx, dz);
        const safeR = obs.radius + 0.45 * scale;
        if (dist < safeR && dist > 1e-4) {
          spine.heading = Math.atan2(dz, dx);
          spine.cruiseSpeed = Math.max(spine.cruiseSpeed, minSpeed * 1.1);
        }
      }

      // Personal-space separation between fish
      const personalSpace = dna.socialType === 'schooling' ? 0.72 : 1.15;
      for (const other of fishStates) {
        if (other.id === entity.id()) continue;
        const dx = pos.x - other.x;
        const dy = pos.y - other.y;
        const dz = pos.z - other.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < personalSpace && dist > 1e-4) {
          spine.heading = Math.atan2(dz, dx);
        }
      }

      const nightFactor = spine.isResting ? 0.44 : 1.0;
      const thrustMod =
        mind && mind.startleTimer > 0
          ? 1.15
          : spine.isSurfacing
            ? 0.85
            : (0.68 + 0.48 * spine.glideFactor) * nightFactor;

      const targetSpeed = clamp(spine.cruiseSpeed * thrustMod, minSpeed * 0.35, maxSpeed * 1.2);
      desiredVx = Math.cos(spine.heading) * targetSpeed;
      desiredVz = Math.sin(spine.heading) * targetSpeed;
      desiredVy = clamp((spine.targetY - pos.y) * (spine.isSurfacing ? 1.5 : 0.72), -0.95, 0.95);
    }

    // 5. Gentle laminar tank circulation + hydrodynamic velocity blending
    const flowAngle = Math.atan2(pos.z, pos.x) + Math.PI * 0.5;
    const flowSpeed = currentStrength * 0.085;
    const flowVx = Math.cos(flowAngle) * flowSpeed;
    const flowVz = Math.sin(flowAngle) * flowSpeed;

    const steerRate = seekingFood || (mind && mind.startleTimer > 0) ? 4.8 : 2.35;
    const blend = Math.min(1, steerRate * clampedDt);
    const vx = vel.vx + (desiredVx + flowVx - vel.vx) * blend;
    const vy = vel.vy + (desiredVy - vel.vy) * blend;
    const vz = vel.vz + (desiredVz + flowVz - vel.vz) * blend;

    const nx = clamp(pos.x + vx * clampedDt, -TANK_BOUNDS.halfW + 0.42, TANK_BOUNDS.halfW - 0.42);
    const maxY = spine.isSurfacing ? TANK_BOUNDS.surfaceY - 0.38 : TANK_BOUNDS.surfaceY - 0.62;
    const ny = clamp(pos.y + vy * clampedDt, TANK_BOUNDS.floorY + 0.34, maxY);
    const nz = clamp(pos.z + vz * clampedDt, -TANK_BOUNDS.halfD + 0.42, TANK_BOUNDS.halfD - 0.42);

    entity.set(Position, { x: nx, y: ny, z: nz }, false);
    entity.set(Velocity, { vx, vy, vz }, false);

    // 6. Advance swimming wave, operculum gill breathing, pitch & turn banking
    const speed = Math.hypot(vx, vy, vz);
    const speedNorm = Math.min(1.6, speed / Math.max(0.2, dna.maxSpeed));

    spine.phase += clampedDt * dna.waveFreq * (0.36 + speedNorm * 0.92) * (0.65 + 0.35 * spine.glideFactor);
    spine.pectoralPhase +=
      clampedDt * (dna.swimStyle === 'labriform_waddle' ? 6.2 + speedNorm * 4.8 : 3.8 + speedNorm * 4.0);
    spine.gillPhase += clampedDt * 5.2 * vitals.gillRate;

    let headingDelta = spine.heading - prevHeading;
    while (headingDelta > Math.PI) headingDelta -= Math.PI * 2;
    while (headingDelta < -Math.PI) headingDelta += Math.PI * 2;
    const targetBank = clamp(-(headingDelta / Math.max(0.01, clampedDt)) * 0.08, -0.42, 0.42);
    spine.bank += (targetBank - spine.bank) * Math.min(1, clampedDt * 5.0);

    const horizSpeed = Math.hypot(vx, vz);
    let targetPitch = clamp(Math.atan2(vy, Math.max(0.25, horizSpeed)), -0.52, 0.52);
    if (spine.foraging) targetPitch = clamp(targetPitch - 0.24, -0.55, 0.25);
    spine.pitch += (targetPitch - spine.pitch) * Math.min(1, clampedDt * 5.0);

    const hAngle = Math.atan2(vz, vx);
    let angDiff = hAngle - spine.finLag;
    while (angDiff > Math.PI) angDiff -= Math.PI * 2;
    while (angDiff < -Math.PI) angDiff += Math.PI * 2;
    spine.finLag += angDiff * Math.min(1, clampedDt * (5.2 - dna.finDrag * 2.5));

    // 7. Solve 3D distance-constrained spine chain
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
