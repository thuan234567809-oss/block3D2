import { isBlockFluid } from '../data/blocks';
import { ITEMS } from '../data/items';
import { hasLineOfSightVoxel, PlayerHitbox } from '../player/playerTransform';
import { getBlockCollisionBox } from '../world/blockBounds';
import { BlockAccessor } from '../world/mesher';

export const DROP_HALF_EXTENT = 0.14;
export const DROP_GRAVITY = 19.0;
export const DROP_PICKUP_COOLDOWN = 0.75;
export const DROP_PICKUP_RANGE = 1.65;
export const DEFAULT_DROP_LIFETIME = 300;
export const DROP_MERGE_RADIUS = 1.15;

export interface DroppedItemBody {
  itemId: string;
  count: number;
  durability?: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  grounded: boolean;
  pickingUp: boolean;
  pickupProgress: number;
}

function getDropHighestCollisionTop(
  x: number,
  y: number,
  z: number,
  getBlock: BlockAccessor,
): number | null {
  const bMinX = x - DROP_HALF_EXTENT + 1e-4;
  const bMaxX = x + DROP_HALF_EXTENT - 1e-4;
  const bMinY = y - DROP_HALF_EXTENT + 1e-4;
  const bMaxY = y + DROP_HALF_EXTENT - 1e-4;
  const bMinZ = z - DROP_HALF_EXTENT + 1e-4;
  const bMaxZ = z + DROP_HALF_EXTENT - 1e-4;

  let highest: number | null = null;
  for (let by = Math.floor(bMinY); by <= Math.floor(bMaxY); by++) {
    for (let bz = Math.floor(bMinZ); bz <= Math.floor(bMaxZ); bz++) {
      for (let bx = Math.floor(bMinX); bx <= Math.floor(bMaxX); bx++) {
        const box = getBlockCollisionBox(getBlock(bx, by, bz), bx, by, bz);
        if (!box) continue;
        if (
          bMaxX > box.minX &&
          bMinX < box.maxX &&
          bMaxY > box.minY &&
          bMinY < box.maxY &&
          bMaxZ > box.minZ &&
          bMinZ < box.maxZ
        ) {
          if (highest === null || box.maxY > highest) highest = box.maxY;
        }
      }
    }
  }
  return highest;
}

function isDropAreaSolid(
  x: number,
  y: number,
  z: number,
  getBlock: BlockAccessor,
): boolean {
  return getDropHighestCollisionTop(x, y, z, getBlock) !== null;
}

export function resolveSafeDropOrigin(
  ox: number,
  oy: number,
  oz: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  maxForward: number,
  getBlock: BlockAccessor,
): { x: number; y: number; z: number } {
  const len = Math.max(1e-4, Math.hypot(dirX, dirY, dirZ));
  const nx = dirX / len;
  const ny = dirY / len;
  const nz = dirZ / len;
  let safeX = ox;
  let safeY = oy;
  let safeZ = oz;

  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * maxForward;
    const tx = ox + nx * t;
    const ty = oy + ny * t;
    const tz = oz + nz * t;
    if (isDropAreaSolid(tx, ty, tz, getBlock)) break;
    safeX = tx;
    safeY = ty;
    safeZ = tz;
  }
  return { x: safeX, y: safeY, z: safeZ };
}

export function stepDropBody(
  d: DroppedItemBody,
  dt: number,
  getBlock: BlockAccessor,
): void {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  if (clampedDt === 0) return;

  const centerBlock = getBlock(Math.floor(d.x), Math.floor(d.y), Math.floor(d.z));
  const inWater = isBlockFluid(centerBlock);

  if (inWater) {
    d.vy += (1.1 - d.vy * 3.2) * clampedDt;
    const drag = Math.exp(-5.0 * clampedDt);
    d.vx *= drag;
    d.vz *= drag;
  } else {
    d.vy = Math.max(-24, d.vy - DROP_GRAVITY * clampedDt);
    const airDrag = Math.exp(-0.8 * clampedDt);
    d.vx *= airDrag;
    d.vz *= airDrag;
  }

  // Horizontal X/Z resolution
  const nx = d.x + d.vx * clampedDt;
  if (!isDropAreaSolid(nx, d.y, d.z, getBlock)) {
    d.x = nx;
  } else {
    d.vx = -d.vx * 0.25;
  }

  const nz = d.z + d.vz * clampedDt;
  if (!isDropAreaSolid(d.x, d.y, nz, getBlock)) {
    d.z = nz;
  } else {
    d.vz = -d.vz * 0.25;
  }

  // Vertical sub-stepped resolution (prevents tunneling through 1-block platforms)
  const subSteps = Math.max(1, Math.min(4, Math.ceil(Math.abs(d.vy * clampedDt) / 0.25)));
  const subDt = clampedDt / subSteps;

  for (let s = 0; s < subSteps; s++) {
    const ny = d.y + d.vy * subDt;
    const hitTop = getDropHighestCollisionTop(d.x, ny, d.z, getBlock);
    if (hitTop === null) {
      d.y = ny;
      d.grounded = false;
    } else if (d.vy < 0) {
      d.y = hitTop + DROP_HALF_EXTENT + 1e-4;
      if (!inWater && Math.abs(d.vy) > 2.1) {
        d.vy = -d.vy * 0.32;
        d.grounded = false;
      } else {
        d.vy = 0;
        d.grounded = true;
      }
      const friction = Math.exp(-9.5 * subDt);
      d.vx *= friction;
      d.vz *= friction;
    } else {
      d.vy = 0;
    }
  }
}

export function findDropShadowY(
  x: number,
  y: number,
  z: number,
  getBlock: BlockAccessor,
): number | null {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  const startY = Math.floor(y);
  for (let sy = startY; sy >= Math.max(0, startY - 8); sy--) {
    const box = getBlockCollisionBox(getBlock(bx, sy, bz), bx, sy, bz);
    if (box) {
      return box.maxY;
    }
  }
  return null;
}

export function canCollectDrop(
  d: DroppedItemBody,
  playerHitbox: PlayerHitbox,
  getBlock: BlockAccessor,
): boolean {
  if (d.age < DROP_PICKUP_COOLDOWN) return false;
  const dist = Math.hypot(
    d.x - playerHitbox.centerX,
    d.y - playerHitbox.centerY,
    d.z - playerHitbox.centerZ,
  );
  if (dist > DROP_PICKUP_RANGE) return false;
  if (dist < 0.75) return true;
  return hasLineOfSightVoxel(
    d.x,
    d.y,
    d.z,
    playerHitbox.centerX,
    playerHitbox.centerY,
    playerHitbox.centerZ,
    getBlock,
    true,
  );
}

export function mergeNearbyDropBodies<T extends DroppedItemBody>(
  entries: T[],
  onRemoved: (entry: T) => void,
): void {
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (a.count <= 0 || a.pickingUp || a.durability !== undefined) continue;
    const maxStack = ITEMS[a.itemId]?.maxStack ?? 64;
    if (a.count >= maxStack) continue;

    for (let j = entries.length - 1; j > i; j--) {
      const b = entries[j];
      if (b.count <= 0 || b.pickingUp || b.itemId !== a.itemId || b.durability !== undefined) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > DROP_MERGE_RADIUS) continue;

      const room = maxStack - a.count;
      if (room <= 0) break;
      const move = Math.min(room, b.count);
      a.count += move;
      b.count -= move;
      a.age = Math.min(a.age, b.age);
      if (b.count <= 0) {
        entries.splice(j, 1);
        onRemoved(b);
      }
    }
  }
}

export function canInventoryAcceptAny(
  inv: { hotbar: ({ itemId: string; count: number } | null)[]; inventory: ({ itemId: string; count: number } | null)[] },
  itemId: string,
): boolean {
  const def = ITEMS[itemId];
  if (!def) return false;
  const maxStack = def.maxStack;
  for (const arr of [inv.hotbar, inv.inventory]) {
    for (let i = 0; i < arr.length; i++) {
      const slot = arr[i];
      if (!slot) return true;
      if (maxStack > 1 && slot.itemId === itemId && slot.count < maxStack) return true;
    }
  }
  return false;
}
