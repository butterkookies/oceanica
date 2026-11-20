import type { Entity, World } from 'koota';
import * as THREE from 'three';
import { DECOR_CATALOG, TANK_BOUNDS } from '../../registry/decor';
import type { CreatureBlueprint } from '../../registry/species';
import { pointerState } from '../pointerState';
import { spawnCreatureEntity, spawnDecorEntity } from '../spawners';
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
  IsSnail,
  PlantBiology,
  Position,
  SpineKinematics,
  TankAlerts,
  TankEnvironment,
  type CreatureMood,
  type LifeStage,
  type PlantStage,
} from '../traits';

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

export function computeLifeStage(growth: number, ageMinutes: number, lifespanHours: number): LifeStage {
  if (ageMinutes >= lifespanHours * 60 * 0.72) return 'elder';
  if (growth < 0.35) return 'fry';
  if (growth < 0.62) return 'juvenile';
  return 'adult';
}

export function computePlantStage(health: number, growth: number): PlantStage {
  if (health <= 2) return 'dead';
  if (health < 25) return 'decaying';
  if (health < 52) return 'wilting';
  if (growth < 0.42) return 'sprout';
  if (growth < 0.65) return 'young';
  if (growth >= 0.95 && health >= 84) return 'lush';
  return 'mature';
}

function mutateHexColor(hexA: string, hexB: string): string {
  const cA = new THREE.Color(hexA);
  const cB = new THREE.Color(hexB);
  const blend = cA.lerp(cB, Math.random());
  const hsl = { h: 0, s: 0, l: 0 };
  blend.getHSL(hsl);
  hsl.h = (hsl.h + (Math.random() - 0.5) * 0.045 + 1) % 1;
  hsl.s = clamp(hsl.s + (Math.random() - 0.5) * 0.1, 0.05, 0.95);
  hsl.l = clamp(hsl.l + (Math.random() - 0.5) * 0.08, 0.12, 0.9);
  return `#${new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l).getHexString()}`;
}

/**
 * Produces a heritable offspring DNA blueprint combining both parents
 * with subtle morphological, agility, pigment, and thermal micro-adaptation.
 */
export function mutateOffspringBlueprint(
  parentA: CreatureBlueprint,
  parentB: CreatureBlueprint,
  tankTemp: number,
): CreatureBlueprint {
  const scaleDrift = 0.94 + Math.random() * 0.14;
  const agilityDrift = 0.93 + Math.random() * 0.16;
  const avgTempMin = (parentA.tempMinF + parentB.tempMinF) * 0.5;
  const avgTempMax = (parentA.tempMaxF + parentB.tempMaxF) * 0.5;
  const tempAdapt = clamp((tankTemp - (avgTempMin + avgTempMax) * 0.5) * 0.08, -0.8, 0.8);

  return {
    ...parentA,
    primaryColor: mutateHexColor(parentA.primaryColor, parentB.primaryColor),
    secondaryColor: mutateHexColor(parentA.secondaryColor, parentB.secondaryColor),
    finColor: mutateHexColor(parentA.finColor, parentB.finColor),
    baseScale: Number(clamp(((parentA.baseScale + parentB.baseScale) * 0.5) * scaleDrift, 0.32, 1.5).toFixed(3)),
    maxScale: Number(clamp(((parentA.maxScale + parentB.maxScale) * 0.5) * scaleDrift, 0.45, 2.0).toFixed(3)),
    minSpeed: Number(clamp(((parentA.minSpeed + parentB.minSpeed) * 0.5) * agilityDrift, 0.06, 1.4).toFixed(3)),
    maxSpeed: Number(clamp(((parentA.maxSpeed + parentB.maxSpeed) * 0.5) * agilityDrift, 0.14, 2.8).toFixed(3)),
    waveAmp: Number(clamp(((parentA.waveAmp + parentB.waveAmp) * 0.5) * (0.94 + Math.random() * 0.12), 0.01, 0.25).toFixed(3)),
    tempMinF: Number((avgTempMin + tempAdapt).toFixed(1)),
    tempMaxF: Number((avgTempMax + tempAdapt).toFixed(1)),
  };
}

/**
 * Evaluates living plant physiology, real nitrogen cycle (NH3 -> NO2- -> NO3-),
 * Henry's-law O2, pH drift, creature vitals/degradation, generational evolution,
 * and emergent feelings/thoughts (CreatureMind).
 */
export function runEcosystemSystem(world: World, dt: number): void {
  const env = world.get(TankEnvironment);
  if (!env) return;

  const dayLight =
    env.lightingPhase === 'night'
      ? 0.0
      : env.lightingPhase === 'sunset'
        ? 0.65
        : env.lightingPhase === 'morning'
          ? 0.8
          : 1.0;

  let plantOxygen = 0;
  let plantClarity = 0;
  let totalPlantNitrateUptake = 0;
  let totalBiofilterBonus = 0;
  let phDriftSum = 0;
  let hasBubbler = false;
  let shelterCount = 0;
  let decayingPlantLeak = 0;
  let decayingPlantCount = 0;
  let livingPlantCount = 0;
  const pendingRunners: Array<{ kind: keyof typeof DECOR_CATALOG; x: number; z: number; gen: number }> = [];

  // 1. Evaluate Hardscape, Equipment & Living Plant Physiology
  const plantEntities = world.query(IsPlant, DecorItem, PlantBiology, Position);
  livingPlantCount = plantEntities.length;

  world.query(IsDecor, DecorItem).readEach(([decor]) => {
    const bp = DECOR_CATALOG[decor.kind];
    if (!bp) return;
    totalBiofilterBonus += bp.biofilterBonus * decor.scale;
    phDriftSum += bp.phDrift * decor.scale;
    if (bp.providesShelter) shelterCount += 1;
    if (bp.emitsBubbles) hasBubbler = true;

    if (!bp.isLivingPlant) {
      plantOxygen += bp.oxygenBoost * decor.scale;
      plantClarity += bp.clarityBuffer * decor.scale;
      totalPlantNitrateUptake += bp.nitrateUptake * decor.scale;
    }
  });

  for (const entity of plantEntities) {
    const decor = entity.get(DecorItem)!;
    const plant = entity.get(PlantBiology)!;
    const pos = entity.get(Position)!;
    const bp = DECOR_CATALOG[decor.kind];
    if (!bp) continue;

    const salinityOk =
      bp.salinityBand === 'universal' ||
      (bp.salinityBand === 'marine' ? env.salinity >= 22 : env.salinity <= 6);
    const tempOk = env.temperature >= bp.tempMinF && env.temperature <= bp.tempMaxF;
    const phOk = env.ph >= bp.phMin && env.ph <= bp.phMax;

    const nitrateFeed =
      salinityOk && dayLight > 0
        ? Math.min(1.5, (env.nitrate + 0.6) * 0.35) * bp.nitrateUptake * dayLight * dt * 2.2
        : 0;
    const nutrientBurn = (0.06 + bp.growthRate * 14) * dt;
    const nextNutrients = clamp(plant.nutrients + nitrateFeed - nutrientBurn, 0, 100);

    let healthDelta = 0;
    let chloroDelta = 0;
    let droopDelta = 0;
    let growthDelta = 0;

    if (!salinityOk) {
      if (env.mode === 'realistic') {
        healthDelta -= 3.8 * dt;
        chloroDelta -= 4.5 * dt;
        droopDelta += 0.08 * dt;
      } else {
        healthDelta -= 0.1 * dt;
      }
    } else if ((!tempOk || !phOk) && env.mode === 'realistic') {
      healthDelta -= 0.65 * dt;
      chloroDelta -= 0.55 * dt;
      droopDelta += 0.02 * dt;
    } else if (nextNutrients < 15 && env.mode === 'realistic') {
      healthDelta -= 0.3 * dt;
      chloroDelta -= 0.55 * dt;
      droopDelta += 0.02 * dt;
    } else if (env.algaeLevel > 70 && env.mode === 'realistic') {
      healthDelta -= 0.2 * dt;
      chloroDelta -= 0.25 * dt;
    } else if (dayLight > 0) {
      healthDelta += 0.85 * dt;
      chloroDelta += 0.9 * dt;
      droopDelta -= 0.04 * dt;
      growthDelta = bp.growthRate * (plant.health / 100) * dayLight * dt;
    } else {
      // Gentle resting maintenance at night
      droopDelta -= 0.01 * dt;
    }

    const nextHealth =
      env.mode === 'sandbox'
        ? clamp(plant.health + Math.max(0, healthDelta) + 0.5 * dt, 70, 100)
        : clamp(plant.health + healthDelta, 0, 100);
    const nextChloro = clamp(plant.chlorophyll + chloroDelta, 8, 100);
    const nextDroop = clamp(plant.droop + droopDelta, 0, 0.95);

    if (nextHealth < 35) {
      growthDelta = -0.002 * dt;
      decayingPlantLeak += (40 - nextHealth) * 0.00055;
      decayingPlantCount += 1;
    }

    const nextGrowth = clamp(plant.growth + growthDelta, 0.2, 1.35);
    const nextStage = computePlantStage(nextHealth, nextGrowth);
    const nextCooldown = Math.max(0, plant.propagateCooldown - dt);

    const o2Produced =
      dayLight > 0 && nextHealth > 20
        ? bp.oxygenBoost * (nextHealth / 100) * (0.45 + nextGrowth * 0.55) * dayLight * decor.scale
        : -0.045 * decor.scale; // Nighttime cellular respiration

    plantOxygen += o2Produced;
    if (nextHealth > 25) {
      plantClarity += bp.clarityBuffer * (nextHealth / 100) * decor.scale;
      totalPlantNitrateUptake += bp.nitrateUptake * (nextHealth / 100) * decor.scale;
    }

    let finalCooldown = nextCooldown;
    if (
      nextStage === 'lush' &&
      nextCooldown <= 0 &&
      livingPlantCount + pendingRunners.length < 18
    ) {
      finalCooldown = 180;
      pendingRunners.push({
        kind: decor.kind,
        x: clamp(pos.x + (Math.random() - 0.5) * 1.8, -TANK_BOUNDS.halfW + 0.8, TANK_BOUNDS.halfW - 0.8),
        z: clamp(pos.z + (Math.random() - 0.5) * 1.4, -TANK_BOUNDS.halfD + 0.8, TANK_BOUNDS.halfD - 0.8),
        gen: plant.generation + 1,
      });
    }

    entity.set(PlantBiology, {
      health: nextHealth,
      growth: nextGrowth,
      nutrients: nextNutrients,
      chlorophyll: nextChloro,
      droop: nextDroop,
      ageMinutes: plant.ageMinutes + dt / 60,
      stage: nextStage,
      propagateCooldown: finalCooldown,
      oxygenOutput: o2Produced,
    });
  }

  for (const runner of pendingRunners) {
    spawnDecorEntity(world, runner.kind, {
      x: runner.x,
      z: runner.z,
      scale: 0.9,
      plant: {
        health: 92,
        growth: 0.28,
        nutrients: 78,
        chlorophyll: 92,
        droop: 0.03,
        stage: 'sprout',
        generation: runner.gen,
        propagateCooldown: 150,
      },
    });
  }

  // 2. Collect Living Creatures & Species Counts
  const fishEntities = world.query(IsFish, CreatureDna, CreatureMeta, CreatureVitals, Position);
  const snailEntities = world.query(IsSnail, CreatureDna, CreatureMeta, CreatureVitals, Position);
  const creatures = [...fishEntities, ...snailEntities];

  let totalBioload = 0;
  let totalO2Demand = 0;
  let totalAlgaeClean = 0;
  let livingCount = 0;
  let bettaCount = 0;
  let hasMarineAnimal = false;
  let hasFreshwaterAnimal = false;
  let hasPondFish = false;
  let lonelySchooler = false;
  let thermalIssueCount = 0;
  let salinityIssueCount = 0;
  let phIssueCount = 0;

  const speciesCounts = new Map<string, number>();
  for (const entity of creatures) {
    const dna = entity.get(CreatureDna)!;
    const vitals = entity.get(CreatureVitals)!;
    if (!vitals.alive) continue;

    livingCount += 1;
    totalBioload += dna.bioload;
    totalO2Demand += dna.oxygenUse;
    totalAlgaeClean += dna.algaeCleanRate;
    speciesCounts.set(dna.speciesId, (speciesCounts.get(dna.speciesId) ?? 0) + 1);

    if (dna.salinityType === 'marine') hasMarineAnimal = true;
    else hasFreshwaterAnimal = true;
    if (dna.isPondFish) hasPondFish = true;
    if (dna.territorial) bettaCount += 1;
  }

  const uneatenFoodCount = world.query(IsFood, FoodPellet).length;

  // 3. Real Nitrogen Cycle, Biofilter, CO2, Henry's-Law O2, and pH
  const bioFactor = (env.biofilterMaturity / 100) * (0.45 + totalBiofilterBonus / 40);
  const wasteAmmonia = (totalBioload * 0.00055 + uneatenFoodCount * 0.0022 + decayingPlantLeak) * dt;
  const rawAmmonia = env.ammonia + wasteAmmonia;
  const nh3Oxidized = Math.min(rawAmmonia, 0.0042 * bioFactor * dt);
  const afterNh3 = clamp(rawAmmonia - nh3Oxidized, 0, 8);

  const rawNitrite = env.nitrite + nh3Oxidized * 0.96;
  const no2Oxidized = Math.min(rawNitrite, 0.0038 * bioFactor * dt);
  const afterNo2 = clamp(rawNitrite - no2Oxidized, 0, 8);

  const plantNitrateAbsorb = totalPlantNitrateUptake * Math.max(0.15, dayLight) * 0.006 * dt;
  const algaeNitrateAbsorb = (env.algaeLevel / 100) * 0.0012 * dt;
  const afterNo3 = clamp(env.nitrate + no2Oxidized * 4.5 - plantNitrateAbsorb - algaeNitrateAbsorb, 0, 120);

  const nextBiofilter = clamp(
    env.biofilterMaturity + (afterNh3 > 0.01 || afterNo2 > 0.01 ? 0.08 * dt : 0.015 * dt),
    15,
    100,
  );

  // Henry's-law temperature solubility cap for dissolved O2
  const tempO2Cap = clamp(100 - Math.max(0, env.temperature - 68) * 0.5, 86, 100);
  const netO2Rate = (0.38 + plantOxygen * 1.35 + (hasBubbler ? 0.45 : 0) - totalO2Demand * 0.45) * dt;
  const rawO2 = clamp(env.oxygen + netO2Rate, 5, tempO2Cap);

  const co2FromRespiration = totalO2Demand * 0.025 * dt + (dayLight === 0 ? livingPlantCount * 0.015 * dt : 0);
  const co2Uptake = totalPlantNitrateUptake * dayLight * 0.04 * dt;
  const co2Atm = (12 - env.co2) * 0.015 * dt;
  const nextCo2 = clamp(env.co2 + co2FromRespiration + co2Atm - co2Uptake, 2, 45);

  const wasteClarityDelta =
    (totalBioload * 0.08 + uneatenFoodCount * 0.22 + decayingPlantLeak * 25 - plantClarity * 0.42) * dt;
  const algaeGrowthDelta =
    ((dayLight > 0 ? 0.12 : 0.02) + (afterNo3 / 40) * 0.14 - totalAlgaeClean * 0.2) * dt;

  const targetPh = clamp((env.salinity >= 20 ? 8.2 : 7.1) + phDriftSum * 0.6 - afterNh3 * 0.06, 5.8, 8.6);
  const nextPh = Number(clamp(env.ph + (targetPh - env.ph) * Math.min(1, 0.03 * dt), 5.8, 8.6).toFixed(2));

  const nextOxygen = env.mode === 'sandbox' ? clamp(Math.max(88, rawO2), 88, 100) : rawO2;
  const nextAmmonia = env.mode === 'sandbox' ? clamp(afterNh3, 0, 0.04) : afterNh3;
  const nextNitrite = env.mode === 'sandbox' ? clamp(afterNo2, 0, 0.04) : afterNo2;
  const nextNitrate = env.mode === 'sandbox' ? clamp(afterNo3, 0, 12) : afterNo3;
  const nextCleanliness =
    env.mode === 'sandbox'
      ? clamp(Math.max(90, env.cleanliness - Math.max(0, wasteClarityDelta) * 0.15), 90, 100)
      : clamp(env.cleanliness - wasteClarityDelta, 0, 100);
  const nextAlgae = clamp(env.algaeLevel + algaeGrowthDelta, 0, 100);

  // 4. Individual Creature Biology, Degradation, Evolution & Emergent Feelings
  const recentPointerTap = performance.now() - pointerState.lastTapAt < 4000;

  for (const entity of creatures) {
    const dna = entity.get(CreatureDna)!;
    const meta = entity.get(CreatureMeta)!;
    const vitals = entity.get(CreatureVitals)!;
    const mind = entity.get(CreatureMind);
    const pos = entity.get(Position)!;
    const spine = entity.get(SpineKinematics);
    if (!vitals.alive) continue;

    const hungerRate = env.mode === 'sandbox' ? 0.14 : 0.32;
    const nextFullness = clamp(vitals.fullness - hungerRate * dt, 0, 100);
    const snailGraze =
      dna.algaeCleanRate > 0 && (nextAlgae > 2 || decayingPlantCount > 0)
        ? dna.algaeCleanRate * 0.45 * dt
        : 0;
    const adjustedFullness = clamp(nextFullness + snailGraze, 0, 100);

    const isSalinityOk = dna.salinityType === 'marine' ? env.salinity >= 20 : env.salinity <= 5;
    const isTempOk = env.temperature >= dna.tempMinF && env.temperature <= dna.tempMaxF;
    const isPhOk = env.ph >= dna.phMin && env.ph <= dna.phMax;
    const sameSpeciesCount = speciesCounts.get(dna.speciesId) ?? 1;

    if (!isSalinityOk) salinityIssueCount += 1;
    if (!isTempOk) thermalIssueCount += 1;
    if (!isPhOk) phIssueCount += 1;
    if (dna.socialType === 'schooling' && sameSpeciesCount < 2) lonelySchooler = true;

    let nextStress = 0;
    let nextHealth = vitals.health;

    if (env.mode === 'sandbox') {
      nextHealth = clamp(vitals.health + 2.0 * dt, 65, 100);
      nextStress = 0;
    } else {
      if (!isSalinityOk) nextStress += 52;
      if (nextAmmonia > 0.15) nextStress += (nextAmmonia - 0.15) * 55;
      if (nextNitrite > 0.25) nextStress += (nextNitrite - 0.25) * 45;
      if (nextNitrate > 45) nextStress += (nextNitrate - 45) * 0.8;
      if (!isTempOk) nextStress += 22;
      if (!isPhOk) nextStress += 18;
      if (!dna.hasLabyrinth && nextOxygen < 45) nextStress += 35;
      if (nextCleanliness < 35) nextStress += 24;
      if (adjustedFullness < 15) nextStress += 28;
      if (dna.territorial && bettaCount > 1) nextStress += 28;
      if (dna.socialType === 'schooling' && sameSpeciesCount < 2) nextStress += 18;

      nextStress = clamp(nextStress, 0, 100);

      const elderFrailty = meta.ageMinutes >= dna.lifespanHours * 60 ? 0.12 : 0;
      if (nextStress > 42 || adjustedFullness < 8 || nextOxygen < 18 || elderFrailty > 0) {
        const drain = (0.32 + (nextStress / 100) * 0.9 + elderFrailty) * dt;
        nextHealth = clamp(vitals.health - drain, 0, 100);
      } else if (adjustedFullness > 45 && nextOxygen > 55 && nextCleanliness > 50 && nextAmmonia < 0.2) {
        nextHealth = clamp(vitals.health + 0.55 * dt, 0, 100);
      }
    }

    const alive = env.mode === 'sandbox' ? true : nextHealth > 0;
    const nextEnergy = clamp(vitals.energy + (adjustedFullness > 30 ? 0.6 : -0.45) * dt, 10, 100);

    const targetGillRate = clamp(
      0.85 + (nextStress / 100) * 1.1 + Math.max(0, 65 - nextOxygen) * 0.015 + nextAmmonia * 0.8,
      0.7,
      2.5,
    );
    const nextGillRate = vitals.gillRate + (targetGillRate - vitals.gillRate) * Math.min(1, dt * 1.5);

    const targetVibrancy = clamp(
      0.32 + 0.68 * (nextHealth / 100) * (1 - (nextStress / 100) * 0.55),
      0.3,
      1.0,
    );
    const nextVibrancy = vitals.colorVibrancy + (targetVibrancy - vitals.colorVibrancy) * Math.min(1, dt * 0.35);

    const finDelta =
      nextHealth < 55 || nextAmmonia > 0.4
        ? -0.018 * dt
        : nextHealth > 75 && nextAmmonia < 0.15
          ? 0.012 * dt
          : 0;
    const nextFinIntegrity = clamp(vitals.finIntegrity + finDelta, 0.35, 1.0);

    entity.set(CreatureVitals, {
      fullness: adjustedFullness,
      health: nextHealth,
      energy: nextEnergy,
      stress: nextStress,
      alive,
      gillRate: nextGillRate,
      finIntegrity: nextFinIntegrity,
      colorVibrancy: nextVibrancy,
    });

    const growRate = adjustedFullness > 50 && alive ? 0.00045 * dt : 0;
    const nextAge = meta.ageMinutes + dt / 60;
    const nextGrowth = clamp(meta.growth + growRate, 0.12, 1);
    const nextLifeStage = computeLifeStage(nextGrowth, nextAge, dna.lifespanHours);

    entity.set(CreatureMeta, {
      ageMinutes: nextAge,
      growth: nextGrowth,
      lifeStage: nextLifeStage,
      breedCooldown: Math.max(0, meta.breedCooldown - dt),
    });

    // Update Simulated Mind, Mood & Trust
    if (mind) {
      const nextStartle = Math.max(0, mind.startleTimer - dt);
      const nextGreet = Math.max(0, mind.greetTimer - dt);
      const nextRest = Math.max(0, mind.restTimer - dt);
      const nextForage = Math.max(0, mind.forageTimer - dt);

      const distToPointer = pointerState.active
        ? Math.hypot(pointerState.x - pos.x, pointerState.y - pos.y, pointerState.z - pos.z)
        : 99;
      const calmPointerNearby = pointerState.active && distToPointer < 4.8 && pointerState.speed < 7;

      const coverScore = clamp(45 + shelterCount * 10, 45, 95);
      const nextSecurity = clamp(
        coverScore - nextStress * 0.55 - nextStartle * 14 + (sameSpeciesCount >= 2 ? 12 : 0),
        5,
        100,
      );
      const nextCuriosity = clamp(
        mind.curiosity + ((calmPointerNearby || recentPointerTap ? 8 : -2.5) * dt),
        15,
        100,
      );
      const nextSocial = clamp(
        dna.socialType === 'solitary_territorial'
          ? bettaCount > 1
            ? 18
            : 60
          : sameSpeciesCount >= 2
            ? 85
            : 30,
        10,
        100,
      );
      const trustDelta =
        nextStartle > 1.2
          ? -1.2 * dt
          : nextStress < 25 && (calmPointerNearby || nextGreet > 0)
            ? 0.9 * dt
            : nextStress < 20 && adjustedFullness > 55
              ? 0.08 * dt
              : 0;
      const nextTrust = clamp(mind.trust + trustDelta, 0, 100);

      let mood: CreatureMood = 'content';
      let thought = 'Swimming peacefully in natural current';

      if (nextStress > 50) {
        mood = 'stressed';
        if (!isSalinityOk) thought = 'Osmotic shock — salinity outside biological tolerance';
        else if (nextAmmonia > 0.25) thought = 'Rapid gill breathing — ammonia levels elevated';
        else if (nextNitrite > 0.35) thought = 'Labored respiration — nitrite levels high';
        else if (!isTempOk) thought = `Uncomfortable temperature (${env.temperature}°F)`;
        else if (!dna.hasLabyrinth && nextOxygen < 45) thought = 'Gasping near surface — dissolved O₂ low';
        else thought = 'Stressed by poor water quality';
      } else if (nextStartle > 0.1) {
        mood = 'startled';
        thought = 'Startled — darting toward shelter';
      } else if (spine?.isFlaring) {
        mood = 'territorial';
        thought = 'Fins flared — defending territory';
      } else if (adjustedFullness < 35) {
        mood = 'hungry';
        thought = dna.grazesSubstrate ? 'Hungry — sifting sand for morsels' : 'Hungry — scanning surface for food';
      } else if (spine?.isResting || env.lightingPhase === 'night') {
        mood = 'resting';
        thought = dna.perchesOnLeaves ? 'Resting quietly on broad leaf' : 'Sleeping softly in nocturnal calm';
      } else if (nextGreet > 0.1 && nextTrust > 42) {
        mood = 'affectionate';
        thought = 'Swimming up to greet you at the glass';
      } else if (nextGreet > 0.1 || nextCuriosity > 65) {
        mood = 'curious';
        thought = 'Curiously watching movement outside the glass';
      } else if (
        (dna.hostsAnemone || (dna.socialType === 'schooling' && sameSpeciesCount >= 2)) &&
        nextStress < 15 &&
        nextEnergy > 70
      ) {
        mood = 'playful';
        thought = dna.hostsAnemone
          ? 'Hosting playfully among anemone tentacles'
          : 'Schooling in rhythm with reef mates';
      } else if (spine?.foraging) {
        mood = 'content';
        thought = dna.grazesRock ? 'Grazing microalgae off porous rock' : 'Foraging calmly along substrate';
      }

      entity.set(CreatureMind, {
        mood,
        thought,
        trust: nextTrust,
        curiosity: nextCuriosity,
        security: nextSecurity,
        social: nextSocial,
        startleTimer: nextStartle,
        greetTimer: nextGreet,
        restTimer: nextRest,
        forageTimer: nextForage,
      });
    }
  }

  // 5. Generational Breeding & Heritable Micro-Evolution
  const checkBreedGroup = (group: readonly Entity[], maxPop: number, distLimit: number) => {
    if (group.length >= maxPop) return;
    let spawnedThisTick = 0;

    for (let i = 0; i < group.length; i++) {
      if (group.length + spawnedThisTick >= maxPop) break;
      const a = group[i];
      const dnaA = a.get(CreatureDna)!;
      const metaA = a.get(CreatureMeta)!;
      const vitA = a.get(CreatureVitals)!;
      const posA = a.get(Position)!;

      if (!vitA.alive || metaA.growth < 0.72 || vitA.health <= 82 || vitA.stress >= 20 || vitA.fullness <= 65 || metaA.breedCooldown > 0) {
        continue;
      }
      if (dnaA.morphology === 'snail' && dnaA.salinityType === 'freshwater' && !dnaA.canReproduceFreshwater) {
        continue;
      }

      for (let j = i + 1; j < group.length; j++) {
        const b = group[j];
        const dnaB = b.get(CreatureDna)!;
        const metaB = b.get(CreatureMeta)!;
        const vitB = b.get(CreatureVitals)!;
        const posB = b.get(Position)!;

        if (dnaA.speciesId !== dnaB.speciesId) continue;
        if (!vitB.alive || metaB.growth < 0.72 || vitB.health <= 82 || vitB.stress >= 20 || vitB.fullness <= 65 || metaB.breedCooldown > 0) {
          continue;
        }
        const dist = Math.hypot(posA.x - posB.x, posA.y - posB.y, posA.z - posB.z);
        if (dist > distLimit) continue;

        const childGen = Math.max(metaA.generation, metaB.generation) + 1;
        const childDna = mutateOffspringBlueprint(dnaA, dnaB, env.temperature);
        spawnCreatureEntity(world, childDna, {
          name: `${metaA.name.split(' ')[0]} Jr.`,
          x: (posA.x + posB.x) * 0.5,
          y: dnaA.morphology === 'snail' ? posA.y : (posA.y + posB.y) * 0.5,
          z: (posA.z + posB.z) * 0.5,
          growth: 0.14,
          lifeStage: 'fry',
          generation: childGen,
          breedCooldown: 180,
          mind: {
            mood: 'curious',
            thought: `Newly hatched Gen ${childGen} fry exploring`,
            trust: 45,
          },
        });
        a.set(CreatureMeta, { breedCooldown: 240 });
        b.set(CreatureMeta, { breedCooldown: 240 });
        spawnedThisTick += 1;
        break;
      }
    }
  };

  checkBreedGroup(fishEntities, 14, 2.8);
  checkBreedGroup(snailEntities, 8, 2.0);

  // 6. Diagnostic Biological Alerts (Realistic Mode)
  const warnings: string[] = [];
  if (env.mode === 'realistic') {
    if (salinityIssueCount > 0 || (hasMarineAnimal && hasFreshwaterAnimal)) {
      warnings.push(
        hasMarineAnimal && hasFreshwaterAnimal
          ? 'Salinity clash: Marine (35 ppt) and Freshwater (0 ppt) species cannot share water.'
          : `Salinity mismatch (${env.salinity} ppt) causing severe osmotic shock.`,
      );
    }
    if (nextAmmonia > 0.2) {
      warnings.push(`Toxic Ammonia NH₃ (${nextAmmonia.toFixed(2)} ppm) — perform a Water Change & reduce waste.`);
    }
    if (nextNitrite > 0.3) {
      warnings.push(`Elevated Nitrite NO₂⁻ (${nextNitrite.toFixed(2)} ppm) — biofilter still maturing.`);
    }
    if (nextNitrate > 45) {
      warnings.push(`High Nitrate NO₃⁻ (${Math.round(nextNitrate)} ppm) — add live plants or change water.`);
    }
    if (thermalIssueCount > 0) {
      warnings.push(`Thermal stress at ${env.temperature}°F — outside inhabitant comfort band.`);
    }
    if (phIssueCount > 0) {
      warnings.push(`pH ${nextPh.toFixed(1)} outside inhabitant biological tolerance.`);
    }
    if (nextOxygen < 45) {
      warnings.push(
        hasBubbler
          ? 'Dissolved O₂ low — high bioload or nighttime plant respiration.'
          : 'Low dissolved O₂ — add a Porous Air Diffuser or daytime flora.',
      );
    }
    if (bettaCount > 1) {
      warnings.push('Multiple territorial Bettas trigger chronic flaring and fin damage.');
    }
    if (lonelySchooler) {
      warnings.push('Solo schooling fish feel exposed — keep 2+ of the same schooling species.');
    }
    if (hasPondFish) {
      warnings.push('Pond Carp (Koi) grow very large over long lifetimes.');
    }
    if (decayingPlantCount > 0) {
      warnings.push('Decaying plant tissue leaking NH₃ — prune dead leaves or check salinity/nutrients.');
    }
  }

  world.set(TankAlerts, { warnings });

  const healthyRatio =
    livingCount > 0 && nextOxygen > 55 && nextCleanliness > 55 && nextAmmonia < 0.25 ? 0.35 : 0.05;
  world.set(TankEnvironment, {
    oxygen: nextOxygen,
    cleanliness: nextCleanliness,
    algaeLevel: nextAlgae,
    ammonia: nextAmmonia,
    nitrite: nextNitrite,
    nitrate: nextNitrate,
    co2: nextCo2,
    ph: nextPh,
    biofilterMaturity: nextBiofilter,
    carePoints: env.carePoints + healthyRatio * dt,
  });
}
