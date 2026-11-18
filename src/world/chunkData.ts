import { BlockId } from '../types/game';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 96;
export const SEA_LEVEL = 36;

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function worldToChunkCoord(w: number): number {
  return Math.floor(w / CHUNK_SIZE);
}

export function worldToLocalCoord(w: number): number {
  return ((w % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}

export class ChunkData {
  public readonly cx: number;
  public readonly cz: number;
  public readonly blocks: Uint8Array;
  public readonly meta: Uint8Array;
  public dirty = true;
  public modified = false;

  constructor(cx: number, cz: number, initialBlocks?: Uint8Array, initialMeta?: Uint8Array) {
    this.cx = cx;
    this.cz = cz;
    const total = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE;
    this.blocks = initialBlocks ?? new Uint8Array(total);
    this.meta = initialMeta ?? new Uint8Array(total);
  }

  public index(lx: number, y: number, lz: number): number {
    return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
  }

  public get(lx: number, y: number, lz: number): BlockId {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) {
      return BlockId.Air;
    }
    return this.blocks[this.index(lx, y, lz)] as BlockId;
  }

  public getMeta(lx: number, y: number, lz: number): number {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) {
      return 0;
    }
    return this.meta[this.index(lx, y, lz)];
  }

  public set(lx: number, y: number, lz: number, id: BlockId, markModified = false, metaVal?: number): void {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) {
      return;
    }
    const idx = this.index(lx, y, lz);
    this.blocks[idx] = id;
    if (metaVal !== undefined) {
      this.meta[idx] = metaVal;
    } else if (id === BlockId.Air) {
      this.meta[idx] = 0;
    }
    this.dirty = true;
    if (markModified) this.modified = true;
  }

  public setMeta(lx: number, y: number, lz: number, value: number, markModified = false): void {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) {
      return;
    }
    this.meta[this.index(lx, y, lz)] = value & 0xff;
    this.dirty = true;
    if (markModified) this.modified = true;
  }

  public getTopSolidY(lx: number, lz: number): number {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const b = this.get(lx, y, lz);
      if (b !== BlockId.Air && b !== BlockId.Water) {
        return y;
      }
    }
    return 0;
  }
}
