import { BlockId } from '../types/game';

export type CardinalFacing = 0 | 1 | 2 | 3;
export type BlockAxis = 'y' | 'x' | 'z';
export type BedPart = 'foot' | 'head';

export interface DecodedBlockMeta {
  facing: CardinalFacing;
  axis: BlockAxis;
  part: BedPart;
  lit: boolean;
}

const AXIS_TO_BITS: Record<BlockAxis, number> = { y: 0, x: 1, z: 2 };
const BITS_TO_AXIS: Record<number, BlockAxis> = { 0: 'y', 1: 'x', 2: 'z' };

export function yawToCardinalFacing(yaw: number): CardinalFacing {
  return ((((Math.round(-yaw / (Math.PI / 2)) % 4) + 4) % 4) as CardinalFacing);
}

export function encodeBlockMeta(opts: {
  facing?: number;
  axis?: BlockAxis;
  part?: BedPart;
  lit?: boolean;
}): number {
  const facing = ((opts.facing ?? 0) & 0x3);
  const axisBits = AXIS_TO_BITS[opts.axis ?? 'y'] << 2;
  const partBit = opts.part === 'head' ? 16 : 0;
  const litBit = opts.lit ? 32 : 0;
  return facing | axisBits | partBit | litBit;
}

export function decodeBlockMeta(meta: number): DecodedBlockMeta {
  return {
    facing: (meta & 0x3) as CardinalFacing,
    axis: BITS_TO_AXIS[(meta >> 2) & 0x3] ?? 'y',
    part: (meta & 16) !== 0 ? 'head' : 'foot',
    lit: (meta & 32) !== 0,
  };
}

/**
 * Horizontal unit step in the direction the player was looking when placing (Foot -> Head for Bed).
 * facing 0 = -Z, 1 = +X, 2 = +Z, 3 = -X.
 */
export function facingToForwardDelta(facing: number): { dx: number; dz: number } {
  const f = ((facing % 4) + 4) % 4;
  if (f === 0) return { dx: 0, dz: -1 };
  if (f === 1) return { dx: 1, dz: 0 };
  if (f === 2) return { dx: 0, dz: 1 };
  return { dx: -1, dz: 0 };
}

/**
 * World-space normal facing TOWARD the player when placed (`front` of Furnace / Chest / Crafting Table).
 */
export function facingToFrontDir(facing: number): [number, number, number] {
  const f = ((facing % 4) + 4) % 4;
  if (f === 0) return [0, 0, 1];
  if (f === 1) return [-1, 0, 0];
  if (f === 2) return [0, 0, -1];
  return [1, 0, 0];
}

export function isLogBlock(id: BlockId): boolean {
  return (
    id === BlockId.OakLog ||
    id === BlockId.PineLog ||
    id === BlockId.JungleLog ||
    id === BlockId.BirchLog ||
    id === BlockId.AcaciaLog ||
    id === BlockId.DarkOakLog
  );
}

export function isDirectionalBlock(id: BlockId): boolean {
  return (
    id === BlockId.Furnace ||
    id === BlockId.Chest ||
    id === BlockId.CraftingTable ||
    id === BlockId.Barrel ||
    id === BlockId.Anvil ||
    id === BlockId.OakDoor ||
    id === BlockId.Bed
  );
}

export function resolvePlacementAxis(nx: number, ny: number, nz: number): BlockAxis {
  if (Math.abs(nx) > 0 && ny === 0 && nz === 0) return 'x';
  if (Math.abs(nz) > 0 && nx === 0 && ny === 0) return 'z';
  return 'y';
}

export function getBedPartnerCoords(
  bx: number,
  by: number,
  bz: number,
  meta: number,
): { x: number; y: number; z: number } {
  const { facing, part } = decodeBlockMeta(meta);
  const { dx, dz } = facingToForwardDelta(facing);
  const sign = part === 'head' ? -1 : 1;
  return { x: bx + dx * sign, y: by, z: bz + dz * sign };
}
