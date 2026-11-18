import { isBlockFluid } from '../data/blocks';
import { BlockId } from '../types/game';
import { getBlockCollisionBox } from '../world/blockBounds';
import { BlockAccessor } from '../world/mesher';
import {
  getPlayerCollider,
  getPlayerEyeHeight,
  PhysicsState,
  PLAYER_EYE_HEIGHT,
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
} from './playerTransform';

export { PLAYER_EYE_HEIGHT, PLAYER_HALF_WIDTH, PLAYER_HEIGHT };
export type { PhysicsState };

const AABB_EPS = 1e-5;

export interface MoveIntent {
  forward: number; // -1..1
  strafe: number; // -1..1
  yaw: number;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
}

export interface RaycastHit {
  bx: number;
  by: number;
  bz: number;
  nx: number;
  ny: number;
  nz: number;
  blockId: BlockId;
  distance: number;
}

export function aabbCollidesWorld(
  x: number,
  y: number,
  z: number,
  halfW: number,
  height: number,
  getBlock: BlockAccessor,
): boolean {
  const pMinX = x - halfW + AABB_EPS;
  const pMaxX = x + halfW - AABB_EPS;
  const pMinY = y + AABB_EPS;
  const pMaxY = y + height - AABB_EPS;
  const pMinZ = z - halfW + AABB_EPS;
  const pMaxZ = z + halfW - AABB_EPS;

  const minX = Math.floor(pMinX);
  const maxX = Math.floor(pMaxX);
  const minY = Math.floor(pMinY);
  const maxY = Math.floor(pMaxY);
  const minZ = Math.floor(pMinZ);
  const maxZ = Math.floor(pMaxZ);

  for (let by = minY; by <= maxY; by++) {
    for (let bz = minZ; bz <= maxZ; bz++) {
      for (let bx = minX; bx <= maxX; bx++) {
        const box = getBlockCollisionBox(getBlock(bx, by, bz), bx, by, bz);
        if (
          box &&
          pMaxX > box.minX &&
          pMinX < box.maxX &&
          pMaxY > box.minY &&
          pMinY < box.maxY &&
          pMaxZ > box.minZ &&
          pMinZ < box.maxZ
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function findHighestFloorTop(
  x: number,
  minY: number,
  maxCheckY: number,
  z: number,
  halfW: number,
  getBlock: BlockAccessor,
): number | null {
  const pMinX = x - halfW + AABB_EPS;
  const pMaxX = x + halfW - AABB_EPS;
  const pMinZ = z - halfW + AABB_EPS;
  const pMaxZ = z + halfW - AABB_EPS;
  const minX = Math.floor(pMinX);
  const maxX = Math.floor(pMaxX);
  const minZ = Math.floor(pMinZ);
  const maxZ = Math.floor(pMaxZ);
  const startBy = Math.floor(maxCheckY);
  const endBy = Math.floor(minY + AABB_EPS);

  let highest: number | null = null;
  for (let by = startBy; by >= endBy; by--) {
    for (let bz = minZ; bz <= maxZ; bz++) {
      for (let bx = minX; bx <= maxX; bx++) {
        const box = getBlockCollisionBox(getBlock(bx, by, bz), bx, by, bz);
        if (box && pMaxX > box.minX && pMinX < box.maxX && pMaxZ > box.minZ && pMinZ < box.maxZ) {
          if (box.maxY <= maxCheckY + 0.65 && (highest === null || box.maxY > highest)) {
            highest = box.maxY;
          }
        }
      }
    }
  }
  return highest;
}

function findLowestCeilingBottom(
  x: number,
  minHeadY: number,
  maxHeadY: number,
  z: number,
  halfW: number,
  getBlock: BlockAccessor,
): number | null {
  const pMinX = x - halfW + AABB_EPS;
  const pMaxX = x + halfW - AABB_EPS;
  const pMinZ = z - halfW + AABB_EPS;
  const pMaxZ = z + halfW - AABB_EPS;
  const minX = Math.floor(pMinX);
  const maxX = Math.floor(pMaxX);
  const minZ = Math.floor(pMinZ);
  const maxZ = Math.floor(pMaxZ);
  const startBy = Math.floor(minHeadY);
  const endBy = Math.floor(maxHeadY - AABB_EPS);

  for (let by = startBy; by <= endBy; by++) {
    for (let bz = minZ; bz <= maxZ; bz++) {
      for (let bx = minX; bx <= maxX; bx++) {
        const box = getBlockCollisionBox(getBlock(bx, by, bz), bx, by, bz);
        if (box && pMaxX > box.minX && pMinX < box.maxX && pMaxZ > box.minZ && pMinZ < box.maxZ) {
          return box.minY;
        }
      }
    }
  }
  return null;
}

function hasGroundSupport(x: number, y: number, z: number, getBlock: BlockAccessor): boolean {
  return aabbCollidesWorld(x, y - 0.08, z, PLAYER_HALF_WIDTH, 0.08, getBlock);
}

export function stepPlayerPhysics(
  state: PhysicsState,
  intent: MoveIntent,
  dt: number,
  getBlock: BlockAccessor,
): { fallDamage: number; landed: boolean } {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  if (clampedDt === 0) return { fallDamage: 0, landed: false };

  const feetBlock = getBlock(Math.floor(state.x), Math.floor(state.y + 0.2), Math.floor(state.z));
  const headBlock = getBlock(Math.floor(state.x), Math.floor(state.y + getPlayerEyeHeight(intent.crouch)), Math.floor(state.z));
  state.inWater = isBlockFluid(feetBlock);
  state.headInWater = isBlockFluid(headBlock);

  const sinYaw = Math.sin(intent.yaw);
  const cosYaw = Math.cos(intent.yaw);
  const fwdX = -sinYaw;
  const fwdZ = -cosYaw;
  const rightX = cosYaw;
  const rightZ = -sinYaw;

  let moveX = fwdX * intent.forward + rightX * intent.strafe;
  let moveZ = fwdZ * intent.forward + rightZ * intent.strafe;
  const len = Math.hypot(moveX, moveZ);
  if (len > 0.001) {
    moveX /= len;
    moveZ /= len;
  }

  let speed = 4.6;
  if (intent.crouch) speed = 2.2;
  else if (intent.sprint && intent.forward > 0) speed = 7.0;
  if (state.inWater) speed *= 0.62;

  const targetVx = moveX * speed;
  const targetVz = moveZ * speed;
  const accel = state.onGround ? 18 : 8;
  const alpha = 1 - Math.exp(-accel * clampedDt);
  state.vx += (targetVx - state.vx) * alpha;
  state.vz += (targetVz - state.vz) * alpha;

  if (state.inWater) {
    state.vy -= 10 * clampedDt;
    if (intent.jump) {
      state.vy = Math.min(4.2, state.vy + 18 * clampedDt);
    }
    state.vy = Math.max(-4.5, state.vy);
    state.fallStartY = state.y;
  } else {
    state.vy -= 26 * clampedDt;
    if (intent.jump && state.onGround) {
      state.vy = 8.6;
      state.onGround = false;
    }
  }

  // Swept sub-stepping prevents tunneling through 1-block cave floors/ceilings during fast falls
  const totalDy = Math.abs(state.vy * clampedDt);
  const totalDx = Math.abs(state.vx * clampedDt);
  const totalDz = Math.abs(state.vz * clampedDt);
  const maxDelta = Math.max(totalDy, totalDx, totalDz);
  const subSteps = Math.max(1, Math.min(6, Math.ceil(maxDelta / 0.35)));
  const subDt = clampedDt / subSteps;

  let fallDamage = 0;
  let landed = false;

  for (let step = 0; step < subSteps; step++) {
    // X Axis (+ crouch ledge guard)
    const nextX = state.x + state.vx * subDt;
    if (!aabbCollidesWorld(nextX, state.y, state.z, PLAYER_HALF_WIDTH, PLAYER_HEIGHT, getBlock)) {
      if (intent.crouch && state.onGround && !hasGroundSupport(nextX, state.y, state.z, getBlock)) {
        state.vx = 0;
      } else {
        state.x = nextX;
      }
    } else {
      state.vx = 0;
    }

    // Z Axis (+ crouch ledge guard)
    const nextZ = state.z + state.vz * subDt;
    if (!aabbCollidesWorld(state.x, state.y, nextZ, PLAYER_HALF_WIDTH, PLAYER_HEIGHT, getBlock)) {
      if (intent.crouch && state.onGround && !hasGroundSupport(state.x, state.y, nextZ, getBlock)) {
        state.vz = 0;
      } else {
        state.z = nextZ;
      }
    } else {
      state.vz = 0;
    }

    // Y Axis: swept floor & ceiling resolution
    const prevY = state.y;
    const nextY = prevY + state.vy * subDt;
    if (!aabbCollidesWorld(state.x, nextY, state.z, PLAYER_HALF_WIDTH, PLAYER_HEIGHT, getBlock)) {
      if (state.vy < 0 && state.onGround) {
        state.fallStartY = prevY;
      }
      state.y = nextY;
      state.onGround = false;
    } else {
      if (state.vy < 0) {
        const floorTop = findHighestFloorTop(state.x, nextY, prevY, state.z, PLAYER_HALF_WIDTH, getBlock);
        const landedY = floorTop !== null ? floorTop + 0.0005 : Math.ceil(nextY) + 0.0005;
        state.y = landedY;
        const fell = state.fallStartY - state.y;
        if (!state.inWater && fell > 4.2) {
          fallDamage += Math.floor(fell - 3.5);
        }
        if (!state.onGround) landed = true;
        state.onGround = true;
        state.fallStartY = state.y;
      } else if (state.vy > 0) {
        const ceilBottom = findLowestCeilingBottom(
          state.x,
          prevY + PLAYER_HEIGHT,
          nextY + PLAYER_HEIGHT,
          state.z,
          PLAYER_HALF_WIDTH,
          getBlock,
        );
        if (ceilBottom !== null) {
          state.y = Math.min(prevY, ceilBottom - PLAYER_HEIGHT - 0.0005);
        }
      }
      state.vy = 0;
    }
  }

  if (state.onGround) {
    state.fallStartY = state.y;
  }

  return { fallDamage, landed };
}

export function raycastVoxel(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  getBlock: BlockAccessor,
  includeFluids = false,
): RaycastHit | null {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return null;
  const rdx = dx / len;
  const rdy = dy / len;
  const rdz = dz / len;

  let bx = Math.floor(ox);
  let by = Math.floor(oy);
  let bz = Math.floor(oz);

  const stepX = rdx > 0 ? 1 : -1;
  const stepY = rdy > 0 ? 1 : -1;
  const stepZ = rdz > 0 ? 1 : -1;

  const tDeltaX = Math.abs(rdx) > 1e-8 ? Math.abs(1 / rdx) : 1e30;
  const tDeltaY = Math.abs(rdy) > 1e-8 ? Math.abs(1 / rdy) : 1e30;
  const tDeltaZ = Math.abs(rdz) > 1e-8 ? Math.abs(1 / rdz) : 1e30;

  let tMaxX = Math.abs(rdx) > 1e-8 ? (rdx > 0 ? bx + 1 - ox : ox - bx) * tDeltaX : 1e30;
  let tMaxY = Math.abs(rdy) > 1e-8 ? (rdy > 0 ? by + 1 - oy : oy - by) * tDeltaY : 1e30;
  let tMaxZ = Math.abs(rdz) > 1e-8 ? (rdz > 0 ? bz + 1 - oz : oz - bz) * tDeltaZ : 1e30;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let dist = 0;

  const maxSteps = Math.min(128, Math.ceil(maxDist * 3) + 8);
  for (let i = 0; i < maxSteps; i++) {
    if (dist > maxDist) break;
    const id = getBlock(bx, by, bz);
    if (id !== BlockId.Air && (includeFluids || !isBlockFluid(id))) {
      return { bx, by, bz, nx, ny, nz, blockId: id, distance: dist };
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        dist = tMaxX;
        bx += stepX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else {
        dist = tMaxZ;
        bz += stepZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        dist = tMaxY;
        by += stepY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        dist = tMaxZ;
        bz += stepZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    }
  }

  return null;
}

export function blockOverlapsPlayer(
  bx: number,
  by: number,
  bz: number,
  px: number,
  py: number,
  pz: number,
): boolean {
  const col = getPlayerCollider({ x: px, y: py, z: pz });
  return (
    col.maxX - AABB_EPS > bx &&
    col.minX + AABB_EPS < bx + 1 &&
    col.maxY - AABB_EPS > by &&
    col.minY + AABB_EPS < by + 1 &&
    col.maxZ - AABB_EPS > bz &&
    col.minZ + AABB_EPS < bz + 1
  );
}
