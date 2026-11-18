import { isBlockOpaque, isBlockSolid } from '../data/blocks';
import { BlockId } from '../types/game';
import { BlockAccessor } from '../world/mesher';

export const PLAYER_HALF_WIDTH = 0.3;
export const PLAYER_HEIGHT = 1.78;
export const PLAYER_EYE_HEIGHT = 1.6;
export const PLAYER_CROUCH_EYE_HEIGHT = 1.42;

export interface PhysicsState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  inWater: boolean;
  headInWater: boolean;
  fallStartY: number;
}

export interface PlayerCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface PlayerHitbox extends PlayerCollider {
  centerX: number;
  centerY: number;
  centerZ: number;
  eyeX: number;
  eyeY: number;
  eyeZ: number;
}

export interface BlockCoords {
  x: number;
  y: number;
  z: number;
}

export function getPlayerEyeHeight(crouching: boolean): number {
  return crouching ? PLAYER_CROUCH_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
}

export function getPlayerCollider(state: Pick<PhysicsState, 'x' | 'y' | 'z'>): PlayerCollider {
  return {
    minX: state.x - PLAYER_HALF_WIDTH,
    maxX: state.x + PLAYER_HALF_WIDTH,
    minY: state.y,
    maxY: state.y + PLAYER_HEIGHT,
    minZ: state.z - PLAYER_HALF_WIDTH,
    maxZ: state.z + PLAYER_HALF_WIDTH,
  };
}

export function getPlayerHitbox(
  state: Pick<PhysicsState, 'x' | 'y' | 'z'>,
  crouching = false,
): PlayerHitbox {
  const c = getPlayerCollider(state);
  return {
    ...c,
    centerX: state.x,
    centerY: state.y + PLAYER_HEIGHT * 0.5,
    centerZ: state.z,
    eyeX: state.x,
    eyeY: state.y + getPlayerEyeHeight(crouching),
    eyeZ: state.z,
  };
}

export function getPlayerBlockCoords(state: Pick<PhysicsState, 'x' | 'y' | 'z'>): BlockCoords {
  const normalizeZero = (n: number) => (n === 0 ? 0 : n);
  return {
    x: normalizeZero(Math.floor(state.x)),
    y: normalizeZero(Math.floor(state.y)),
    z: normalizeZero(Math.floor(state.z)),
  };
}

export function computeDistance3D(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  return Math.hypot(bx - ax, by - ay, bz - az);
}

/**
 * 3D Amanatides-Woo DDA Line-of-Sight test between two world coordinates.
 * By default blocks are considered sight-blocking when they are both solid and opaque.
 * Set `blockAllSolid = true` to block through Glass / Leaves / closed Doors too (used for melee/pickup occlusion).
 */
export function hasLineOfSightVoxel(
  ox: number,
  oy: number,
  oz: number,
  tx: number,
  ty: number,
  tz: number,
  getBlock: BlockAccessor,
  blockAllSolid = false,
): boolean {
  const dx = tx - ox;
  const dy = ty - oy;
  const dz = tz - oz;
  const totalDist = Math.hypot(dx, dy, dz);
  if (totalDist < 1e-4) return true;

  const rdx = dx / totalDist;
  const rdy = dy / totalDist;
  const rdz = dz / totalDist;

  let bx = Math.floor(ox);
  let by = Math.floor(oy);
  let bz = Math.floor(oz);

  const endBx = Math.floor(tx);
  const endBy = Math.floor(ty);
  const endBz = Math.floor(tz);

  const stepX = rdx > 0 ? 1 : -1;
  const stepY = rdy > 0 ? 1 : -1;
  const stepZ = rdz > 0 ? 1 : -1;

  const tDeltaX = Math.abs(rdx) > 1e-8 ? Math.abs(1 / rdx) : 1e30;
  const tDeltaY = Math.abs(rdy) > 1e-8 ? Math.abs(1 / rdy) : 1e30;
  const tDeltaZ = Math.abs(rdz) > 1e-8 ? Math.abs(1 / rdz) : 1e30;

  let tMaxX = Math.abs(rdx) > 1e-8 ? (rdx > 0 ? bx + 1 - ox : ox - bx) * tDeltaX : 1e30;
  let tMaxY = Math.abs(rdy) > 1e-8 ? (rdy > 0 ? by + 1 - oy : oy - by) * tDeltaY : 1e30;
  let tMaxZ = Math.abs(rdz) > 1e-8 ? (rdz > 0 ? bz + 1 - oz : oz - bz) * tDeltaZ : 1e30;

  const blocksRay = (id: BlockId): boolean =>
    blockAllSolid ? isBlockSolid(id) : isBlockSolid(id) && isBlockOpaque(id);

  let dist = 0;
  const maxSteps = Math.min(256, Math.ceil(totalDist * 3) + 4);
  for (let i = 0; i < maxSteps; i++) {
    const id = getBlock(bx, by, bz);
    if (blocksRay(id)) {
      return false;
    }
    if (bx === endBx && by === endBy && bz === endBz) {
      return true;
    }
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        dist = tMaxX;
        bx += stepX;
        tMaxX += tDeltaX;
      } else {
        dist = tMaxZ;
        bz += stepZ;
        tMaxZ += tDeltaZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        dist = tMaxY;
        by += stepY;
        tMaxY += tDeltaY;
      } else {
        dist = tMaxZ;
        bz += stepZ;
        tMaxZ += tDeltaZ;
      }
    }
    if (dist >= totalDist) return true;
  }
  return true;
}
