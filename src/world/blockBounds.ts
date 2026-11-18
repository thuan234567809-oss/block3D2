import { BLOCKS, isBlockSolid } from '../data/blocks';
import { BlockId } from '../types/game';
import { getBedPartnerCoords } from './blockOrientation';

export interface AabbBox {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export function getBlockCollisionBox(
  id: BlockId,
  bx: number,
  by: number,
  bz: number,
): AabbBox | null {
  if (!isBlockSolid(id)) return null;
  if (id === BlockId.Bed) {
    return {
      minX: bx,
      minY: by,
      minZ: bz,
      maxX: bx + 1,
      maxY: by + 0.5625,
      maxZ: bz + 1,
    };
  }
  if (id === BlockId.Chest) {
    return {
      minX: bx + 0.0625,
      minY: by,
      minZ: bz + 0.0625,
      maxX: bx + 0.9375,
      maxY: by + 0.875,
      maxZ: bz + 0.9375,
    };
  }
  if (id === BlockId.Anvil) {
    return {
      minX: bx + 0.125,
      minY: by,
      minZ: bz + 0.125,
      maxX: bx + 0.875,
      maxY: by + 1.0,
      maxZ: bz + 0.875,
    };
  }
  return {
    minX: bx,
    minY: by,
    minZ: bz,
    maxX: bx + 1,
    maxY: by + 1,
    maxZ: bz + 1,
  };
}

export function getBlockSelectionBox(
  bx: number,
  by: number,
  bz: number,
  getBlock: (wx: number, wy: number, wz: number) => BlockId,
  getBlockMeta: (wx: number, wy: number, wz: number) => number,
): AabbBox | null {
  const id = getBlock(bx, by, bz);
  if (id === BlockId.Air) return null;

  if (id === BlockId.Bed) {
    const meta = getBlockMeta(bx, by, bz);
    const partner = getBedPartnerCoords(bx, by, bz, meta);
    if (getBlock(partner.x, partner.y, partner.z) === BlockId.Bed) {
      return {
        minX: Math.min(bx, partner.x),
        minY: by,
        minZ: Math.min(bz, partner.z),
        maxX: Math.max(bx, partner.x) + 1,
        maxY: by + 0.82,
        maxZ: Math.max(bz, partner.z) + 1,
      };
    }
    return { minX: bx, minY: by, minZ: bz, maxX: bx + 1, maxY: by + 0.5625, maxZ: bz + 1 };
  }

  if (id === BlockId.Chest) {
    return {
      minX: bx + 0.0625,
      minY: by,
      minZ: bz + 0.0625,
      maxX: bx + 0.9375,
      maxY: by + 0.875,
      maxZ: bz + 0.9375,
    };
  }

  if (id === BlockId.Anvil) {
    return {
      minX: bx + 0.125,
      minY: by,
      minZ: bz + 0.125,
      maxX: bx + 0.875,
      maxY: by + 1.0,
      maxZ: bz + 0.875,
    };
  }

  if (id === BlockId.Torch) {
    return {
      minX: bx + 0.36,
      minY: by,
      minZ: bz + 0.36,
      maxX: bx + 0.64,
      maxY: by + 0.78,
      maxZ: bz + 0.64,
    };
  }

  if (BLOCKS[id]?.plant) {
    return {
      minX: bx + 0.16,
      minY: by,
      minZ: bz + 0.16,
      maxX: bx + 0.84,
      maxY: by + 0.82,
      maxZ: bz + 0.84,
    };
  }

  return { minX: bx, minY: by, minZ: bz, maxX: bx + 1, maxY: by + 1, maxZ: bz + 1 };
}
