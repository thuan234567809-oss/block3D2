import {
  computeDistance3D,
  hasLineOfSightVoxel,
  PlayerHitbox,
} from '../player/playerTransform';
import { MobType } from '../types/game';
import { BlockAccessor } from '../world/mesher';

export interface MobHitboxSpec {
  radius: number;
  height: number;
  eyeHeight: number;
}

export const MOB_HITBOXES: Record<MobType, MobHitboxSpec> = {
  [MobType.Cow]: { radius: 0.56, height: 1.38, eyeHeight: 1.08 },
  [MobType.Pig]: { radius: 0.46, height: 0.92, eyeHeight: 0.72 },
  [MobType.Sheep]: { radius: 0.48, height: 1.24, eyeHeight: 0.96 },
  [MobType.Chicken]: { radius: 0.34, height: 0.76, eyeHeight: 0.62 },
  [MobType.Zombie]: { radius: 0.45, height: 1.85, eyeHeight: 1.6 },
  [MobType.Skeleton]: { radius: 0.42, height: 1.85, eyeHeight: 1.6 },
  [MobType.Spider]: { radius: 0.68, height: 0.85, eyeHeight: 0.45 },
  [MobType.Creeper]: { radius: 0.42, height: 1.75, eyeHeight: 1.48 },
};

export interface MobTargetMetrics {
  dist3D: number;
  hitboxDist3D: number;
  hasVisualLos: boolean;
  hasAttackLos: boolean;
}

export function distancePointToAabb3D(
  px: number,
  py: number,
  pz: number,
  box: Pick<PlayerHitbox, 'minX' | 'maxX' | 'minY' | 'maxY' | 'minZ' | 'maxZ'>,
): number {
  const cx = Math.max(box.minX, Math.min(px, box.maxX));
  const cy = Math.max(box.minY, Math.min(py, box.maxY));
  const cz = Math.max(box.minZ, Math.min(pz, box.maxZ));
  return Math.hypot(px - cx, py - cy, pz - cz);
}

export function evaluateMobTarget(
  mobX: number,
  mobY: number,
  mobZ: number,
  mobType: MobType,
  playerHitbox: PlayerHitbox,
  getBlock: BlockAccessor,
): MobTargetMetrics {
  const spec = MOB_HITBOXES[mobType];
  const mobEyeY = mobY + spec.eyeHeight;
  const dist3D = computeDistance3D(mobX, mobY + spec.height * 0.5, mobZ, playerHitbox.centerX, playerHitbox.centerY, playerHitbox.centerZ);
  const hitboxDist3D = distancePointToAabb3D(mobX, mobEyeY, mobZ, playerHitbox);

  // Check LOS to either player eye or chest so partial cover at feet doesn't falsely blind mobs
  const hasVisualLos =
    hasLineOfSightVoxel(mobX, mobEyeY, mobZ, playerHitbox.eyeX, playerHitbox.eyeY, playerHitbox.eyeZ, getBlock, false) ||
    hasLineOfSightVoxel(mobX, mobEyeY, mobZ, playerHitbox.centerX, playerHitbox.centerY, playerHitbox.centerZ, getBlock, false);

  const hasAttackLos =
    hasLineOfSightVoxel(mobX, mobEyeY, mobZ, playerHitbox.eyeX, playerHitbox.eyeY, playerHitbox.eyeZ, getBlock, true) ||
    hasLineOfSightVoxel(mobX, mobEyeY, mobZ, playerHitbox.centerX, playerHitbox.centerY, playerHitbox.centerZ, getBlock, true);

  return { dist3D, hitboxDist3D, hasVisualLos, hasAttackLos };
}

export function canMobExecuteAttack(
  mobX: number,
  mobY: number,
  mobZ: number,
  mobType: MobType,
  maxRange: number,
  playerHitbox: PlayerHitbox,
  playerAlive: boolean,
  getBlock: BlockAccessor,
  requireSolidClearance = true,
): boolean {
  if (!playerAlive) return false;
  const metrics = evaluateMobTarget(mobX, mobY, mobZ, mobType, playerHitbox, getBlock);
  if (metrics.hitboxDist3D > maxRange) return false;
  return requireSolidClearance ? metrics.hasAttackLos : metrics.hasVisualLos;
}
