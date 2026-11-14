import type { World } from 'koota';
import { DECOR_CATALOG } from '../../registry/decor';
import {
  CreatureDna,
  CreatureMeta,
  CreatureVitals,
  DecorItem,
  FoodPellet,
  IsDecor,
  IsFish,
  IsFood,
  IsSnail,
  TankAlerts,
  TankEnvironment,
} from '../traits';

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

/**
 * Evaluates water chemistry, oxygen balance, algae growth, species compatibility,
 * and creature health according to the active SimulationMode ('sandbox' vs 'realistic').
 */
export function runEcosystemSystem(world: World, dt: number): void {
  const env = world.get(TankEnvironment);
  if (!env) return;

  let plantOxygen = 0;
  let plantClarity = 0;
  let hasBubbler = false;

  world.query(IsDecor, DecorItem).readEach(([decor]) => {
    const bp = DECOR_CATALOG[decor.kind];
    if (!bp) return;
    const lightFactor = env.lightingPhase === 'night' ? 0.25 : 1.0;
    plantOxygen += bp.oxygenBoost * (bp.category === 'plant' ? lightFactor : 1) * decor.scale;
    plantClarity += bp.clarityBuffer * decor.scale;
    if (bp.emitsBubbles) hasBubbler = true;
  });

  let totalBioload = 0;
  let totalO2Demand = 0;
  let totalAlgaeClean = 0;
  let hasTropical = false;
  let hasColdwater = false;
  let hasKoi = false;
  let bettaCount = 0;
  let livingCount = 0;

  const creatures = [
    ...world.query(IsFish, CreatureDna, CreatureMeta, CreatureVitals),
    ...world.query(IsSnail, CreatureDna, CreatureMeta, CreatureVitals),
  ];

  for (const entity of creatures) {
    const dna = entity.get(CreatureDna)!;
    const vitals = entity.get(CreatureVitals)!;
    if (!vitals.alive) continue;

    livingCount += 1;
    totalBioload += dna.bioload;
    totalO2Demand += dna.oxygenUse;
    totalAlgaeClean += dna.algaeCleanRate;
    if (dna.tempBand === 'tropical') hasTropical = true;
    if (dna.tempBand === 'coldwater') hasColdwater = true;
    if (dna.kind === 'koi') hasKoi = true;
    if (dna.kind === 'betta' && dna.territorial) bettaCount += 1;
  }

  const uneatenFoodCount = world.query(IsFood, FoodPellet).length;

  // Environmental rates (scaled for gentle, rewarding real-time feedback)
  const netOxygenRate = (0.35 + plantOxygen * 1.4 - totalO2Demand * 0.42) * dt;
  const wasteRate = (totalBioload * 0.14 + uneatenFoodCount * 0.25 - plantClarity * 0.5) * dt;
  const algaeRate = ((env.lightingPhase === 'day' ? 0.16 : 0.04) + totalBioload * 0.05 - totalAlgaeClean * 0.22) * dt;

  const nextOxygen = env.mode === 'sandbox'
    ? clamp(Math.max(85, env.oxygen + netOxygenRate * 0.4), 85, 100)
    : clamp(env.oxygen + netOxygenRate, 5, 100);

  const nextCleanliness = env.mode === 'sandbox'
    ? clamp(Math.max(88, env.cleanliness - Math.max(0, wasteRate) * 0.2), 88, 100)
    : clamp(env.cleanliness - wasteRate, 0, 100);

  const nextAlgae = clamp(env.algaeLevel + algaeRate, 0, 100);

  // Build Realistic Mode compatibility & health warnings
  const warnings: string[] = [];
  if (env.mode === 'realistic') {
    if (hasTropical && hasColdwater) {
      warnings.push('Thermal clash: Bettas thrive at 78–82°F while Goldfish & Koi prefer 65–72°F.');
    }
    if (hasTropical && env.temperature < 74) {
      warnings.push(`Water too cold (${env.temperature}°F) for tropical fish like Bettas.`);
    }
    if (hasColdwater && env.temperature > 76) {
      warnings.push(`Water too warm (${env.temperature}°F) for coldwater Goldfish & Koi.`);
    }
    if (hasKoi) {
      warnings.push('Adult Koi reach 24–36 in and outgrow standard indoor aquariums.');
    }
    if (bettaCount > 1) {
      warnings.push('Multiple territorial Bettas in one tank trigger flaring and stress.');
    }
    if (nextOxygen < 45) {
      warnings.push(
        hasBubbler
          ? 'Oxygen dropping due to high bioload — add live plants.'
          : 'Low dissolved oxygen — place an Aerator Bubbler or live plants.',
      );
    }
    if (nextCleanliness < 45) {
      warnings.push('Water clarity is low — siphon tank or add Nerite Snails.');
    }
  }

  world.set(TankAlerts, { warnings });

  // Care points accumulate passively when creatures thrive
  const healthyRatio = livingCount > 0 && nextOxygen > 55 && nextCleanliness > 55 ? 0.35 : 0.05;
  const nextPoints = env.carePoints + healthyRatio * dt;

  world.set(TankEnvironment, {
    oxygen: nextOxygen,
    cleanliness: nextCleanliness,
    algaeLevel: nextAlgae,
    carePoints: nextPoints,
  });

  // Update individual creature hunger, stress, health, and growth
  for (const entity of creatures) {
    const dna = entity.get(CreatureDna)!;
    const meta = entity.get(CreatureMeta)!;
    const vitals = entity.get(CreatureVitals)!;
    if (!vitals.alive) continue;

    // Gentle fullness decay (faster in Realistic Mode, mild in Sandbox)
    const hungerRate = env.mode === 'sandbox' ? 0.18 : 0.42;
    const nextFullness = clamp(vitals.fullness - hungerRate * dt, 0, 100);

    // Passive snail algae grazing keeps snails fed when algae exists
    const snailGraze = dna.algaeCleanRate > 0 && nextAlgae > 2 ? dna.algaeCleanRate * 0.45 * dt : 0;
    const adjustedFullness = clamp(nextFullness + snailGraze, 0, 100);

    let nextStress = 0;
    let nextHealth = vitals.health;

    if (env.mode === 'sandbox') {
      nextHealth = clamp(vitals.health + 2.0 * dt, 60, 100);
      nextStress = 0;
    } else {
      // Realistic biological penalties
      if (dna.tempBand === 'tropical' && env.temperature < 74) nextStress += 24;
      if (dna.tempBand === 'coldwater' && env.temperature > 76) nextStress += 20;
      if (dna.kind === 'betta' && bettaCount > 1) nextStress += 28;
      if (!dna.hasLabyrinth && nextOxygen < 40) nextStress += 35;
      if (nextCleanliness < 35) nextStress += 28;
      if (adjustedFullness < 15) nextStress += 30;

      nextStress = clamp(nextStress, 0, 100);

      if (nextStress > 45 || adjustedFullness < 8 || nextOxygen < 18) {
        const drain = (0.35 + (nextStress / 100) * 0.9) * dt;
        nextHealth = clamp(vitals.health - drain, 0, 100);
      } else if (adjustedFullness > 45 && nextOxygen > 55 && nextCleanliness > 50) {
        nextHealth = clamp(vitals.health + 0.55 * dt, 0, 100);
      }
    }

    const alive = env.mode === 'sandbox' ? true : nextHealth > 0;
    const nextEnergy = clamp(
      vitals.energy + (adjustedFullness > 30 ? 0.6 : -0.5) * dt,
      10,
      100,
    );

    entity.set(CreatureVitals, {
      fullness: adjustedFullness,
      health: nextHealth,
      energy: nextEnergy,
      stress: nextStress,
      alive,
    });

    // Gradual natural growth over active time when nourished
    const growRate = adjustedFullness > 50 && alive ? 0.0012 * dt : 0;
    entity.set(CreatureMeta, {
      ageMinutes: meta.ageMinutes + dt / 60,
      growth: clamp(meta.growth + growRate, 0.5, 1),
    });
  }
}
