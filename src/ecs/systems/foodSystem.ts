import type { World } from 'koota';
import { TANK_BOUNDS } from '../../registry/decor';
import {
  FoodPellet,
  IsFood,
  IsRipple,
  Position,
  TankEnvironment,
  WaterRipple,
} from '../traits';

/** Advances falling food pellets with gentle tank current drift and expanding surface ripples. */
export function runFoodAndRippleSystem(world: World, dt: number): void {
  const clampedDt = Math.min(dt, 0.05);
  const floorY = TANK_BOUNDS.floorY + 0.08;
  const currentStrength = world.get(TankEnvironment)?.currentStrength ?? 0.45;

  for (const entity of world.query(IsFood, Position, FoodPellet)) {
    const pos = entity.get(Position)!;
    const pellet = entity.get(FoodPellet)!;

    if (pellet.eaten || pellet.life <= 0) {
      entity.destroy();
      continue;
    }

    const nextY = Math.max(floorY, pos.y + pellet.vy * clampedDt);
    const swayX =
      pos.y > floorY
        ? (Math.sin(pellet.life * 3.5) * 0.04 + Math.sin(pos.z * 0.6) * 0.08 * currentStrength) * clampedDt
        : 0;
    entity.set(Position, { x: pos.x + swayX, y: nextY, z: pos.z }, false);
    entity.set(FoodPellet, { life: pellet.life - clampedDt }, false);
  }

  for (const entity of world.query(IsRipple, WaterRipple)) {
    const ripple = entity.get(WaterRipple)!;
    const nextR = ripple.radius + 1.25 * clampedDt;
    const nextAlpha = ripple.alpha - 0.62 * clampedDt;
    if (nextAlpha <= 0 || nextR >= ripple.maxRadius) {
      entity.destroy();
    } else {
      entity.set(WaterRipple, { radius: nextR, alpha: nextAlpha }, false);
    }
  }
}
