import { isBlockSolid } from '../data/blocks';
import { BlockEntity, BlockId } from '../types/game';
import { BlockEntityManager } from './blockEntities';
import {
  encodeBlockMeta,
  facingToForwardDelta,
  getBedPartnerCoords,
  isLogBlock,
  resolvePlacementAxis,
} from './blockOrientation';
import {
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  ChunkData,
  chunkKey,
  worldToChunkCoord,
  worldToLocalCoord,
} from './chunkData';
import { generateChunk } from './worldGen';

export class WorldManager {
  public seed: number;
  public chunks = new Map<string, ChunkData>();
  public blockEntities: BlockEntityManager;
  private savedBlocks = new Map<string, number[]>();
  private savedMeta = new Map<string, number[]>();

  constructor(
    seed: number,
    modifiedChunks?: Record<string, number[]>,
    savedBlockEntities?: BlockEntity[],
    modifiedChunkMeta?: Record<string, number[]>,
  ) {
    this.seed = seed;
    this.blockEntities = new BlockEntityManager(savedBlockEntities);
    if (modifiedChunks) {
      for (const [k, arr] of Object.entries(modifiedChunks)) {
        this.savedBlocks.set(k, arr);
      }
    }
    if (modifiedChunkMeta) {
      for (const [k, arr] of Object.entries(modifiedChunkMeta)) {
        this.savedMeta.set(k, arr);
      }
    }
  }

  public getOrCreateChunk(cx: number, cz: number): ChunkData {
    const key = chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const saved = this.savedBlocks.get(key);
    const savedM = this.savedMeta.get(key);
    let chunk: ChunkData;
    if (saved) {
      chunk = new ChunkData(
        cx,
        cz,
        new Uint8Array(saved),
        savedM ? new Uint8Array(savedM) : undefined,
      );
      chunk.modified = true;
      chunk.dirty = true;
    } else {
      chunk = generateChunk(cx, cz, this.seed);
    }
    this.chunks.set(key, chunk);
    return chunk;
  }

  public getBlock = (wx: number, wy: number, wz: number): BlockId => {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockId.Air;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BlockId.Air;
    return chunk.get(worldToLocalCoord(wx), wy, worldToLocalCoord(wz));
  };

  public getBlockMeta = (wx: number, wy: number, wz: number): number => {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return 0;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return 0;
    return chunk.getMeta(worldToLocalCoord(wx), wy, worldToLocalCoord(wz));
  };

  public getCollisionBlock = (wx: number, wy: number, wz: number): BlockId => {
    const id = this.getBlock(wx, wy, wz);
    if (id === BlockId.OakDoor && this.blockEntities.isDoorOpen(wx, wy, wz)) {
      return BlockId.Air;
    }
    return id;
  };

  public setBlock(
    wx: number,
    wy: number,
    wz: number,
    id: BlockId,
    facing = 0,
    explicitMeta?: number,
  ): boolean {
    if (wy <= 0 || wy >= CHUNK_HEIGHT) return false;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const lx = worldToLocalCoord(wx);
    const lz = worldToLocalCoord(wz);
    const chunk = this.getOrCreateChunk(cx, cz);
    const prev = chunk.get(lx, wy, lz);
    if (prev !== id) {
      this.blockEntities.remove(wx, wy, wz);
    }
    const metaVal =
      id === BlockId.Air
        ? 0
        : explicitMeta !== undefined
          ? explicitMeta
          : encodeBlockMeta({ facing });
    chunk.set(lx, wy, lz, id, true, metaVal);
    if (id !== BlockId.Air) {
      this.blockEntities.ensureForBlock(id, wx, wy, wz, facing);
    }

    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
    return true;
  }

  public canPlaceBed(
    wx: number,
    wy: number,
    wz: number,
    facing: number,
    overlapsPlayer?: (bx: number, by: number, bz: number) => boolean,
  ): boolean {
    if (wy <= 0 || wy >= CHUNK_HEIGHT - 1) return false;
    const { dx, dz } = facingToForwardDelta(facing);
    const coords: [number, number, number][] = [
      [wx, wy, wz],
      [wx + dx, wy, wz + dz],
    ];
    for (const [bx, by, bz] of coords) {
      if (overlapsPlayer?.(bx, by, bz)) return false;
      const cur = this.getBlock(bx, by, bz);
      const replaceable =
        cur === BlockId.Air ||
        cur === BlockId.Water ||
        cur === BlockId.TallGrass ||
        cur === BlockId.Shrub;
      if (!replaceable) return false;
    }
    return true;
  }

  public placeBed(wx: number, wy: number, wz: number, facing: number): boolean {
    if (!this.canPlaceBed(wx, wy, wz, facing)) return false;
    const { dx, dz } = facingToForwardDelta(facing);
    const footMeta = encodeBlockMeta({ facing, part: 'foot' });
    const headMeta = encodeBlockMeta({ facing, part: 'head' });
    this.setBlock(wx, wy, wz, BlockId.Bed, facing, footMeta);
    this.setBlock(wx + dx, wy, wz + dz, BlockId.Bed, facing, headMeta);
    return true;
  }

  public placeOrientedBlock(
    wx: number,
    wy: number,
    wz: number,
    id: BlockId,
    facing: number,
    nx = 0,
    ny = 1,
    nz = 0,
    overlapsPlayer?: (bx: number, by: number, bz: number) => boolean,
  ): { placed: boolean; failReason?: string } {
    if (id === BlockId.Bed) {
      if (!this.canPlaceBed(wx, wy, wz, facing, overlapsPlayer)) {
        return { placed: false, failReason: 'Need 2 clear blocks for Bed' };
      }
      return { placed: this.placeBed(wx, wy, wz, facing) };
    }
    if (isBlockSolid(id) && overlapsPlayer?.(wx, wy, wz)) {
      return { placed: false };
    }
    if (isLogBlock(id)) {
      const axis = resolvePlacementAxis(nx, ny, nz);
      return { placed: this.setBlock(wx, wy, wz, id, facing, encodeBlockMeta({ facing, axis })) };
    }
    return { placed: this.setBlock(wx, wy, wz, id, facing) };
  }

  public breakBlockWithPartner(wx: number, wy: number, wz: number): void {
    const id = this.getBlock(wx, wy, wz);
    if (id === BlockId.Bed) {
      const meta = this.getBlockMeta(wx, wy, wz);
      const partner = getBedPartnerCoords(wx, wy, wz, meta);
      this.setBlock(wx, wy, wz, BlockId.Air);
      if (this.getBlock(partner.x, partner.y, partner.z) === BlockId.Bed) {
        this.setBlock(partner.x, partner.y, partner.z, BlockId.Air);
      }
      return;
    }
    this.setBlock(wx, wy, wz, BlockId.Air);
  }

  private markDirty(cx: number, cz: number): void {
    const c = this.chunks.get(chunkKey(cx, cz));
    if (c) c.dirty = true;
  }

  public getTopSolidY(wx: number, wz: number): number {
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.getOrCreateChunk(cx, cz);
    return chunk.getTopSolidY(worldToLocalCoord(wx), worldToLocalCoord(wz));
  }

  public hasBlockNearby(wx: number, wy: number, wz: number, targetId: BlockId, radius = 4): boolean {
    const bx = Math.floor(wx);
    const by = Math.floor(wy);
    const bz = Math.floor(wz);
    for (let y = by - 2; y <= by + 3; y++) {
      for (let z = bz - radius; z <= bz + radius; z++) {
        for (let x = bx - radius; x <= bx + radius; x++) {
          if (this.getBlock(x, y, z) === targetId) return true;
        }
      }
    }
    return false;
  }

  public exportModifiedChunks(): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    for (const [k, arr] of this.savedBlocks.entries()) {
      out[k] = arr;
    }
    for (const [k, chunk] of this.chunks.entries()) {
      if (chunk.modified) {
        out[k] = Array.from(chunk.blocks);
      }
    }
    return out;
  }

  public exportModifiedChunkMeta(): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    for (const [k, arr] of this.savedMeta.entries()) {
      out[k] = arr;
    }
    for (const [k, chunk] of this.chunks.entries()) {
      if (chunk.modified) {
        out[k] = Array.from(chunk.meta);
      }
    }
    return out;
  }
}
