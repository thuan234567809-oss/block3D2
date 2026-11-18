import { BLOCKS, isBlockOpaque } from '../data/blocks';
import { TEX } from '../data/blockTextures';
import { BlockId } from '../types/game';
import {
  CUBE_FACES,
  emitCustomBlockModel,
  QuadEmitter,
  resolveCubeFaceTileAndUv,
} from './blockModels';
import { CHUNK_HEIGHT, CHUNK_SIZE } from './chunkData';
import { emitFlowerModel } from './flowerModels';

export interface MeshBuffers {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

export interface ChunkMeshResult {
  opaque: MeshBuffers;
  translucent: MeshBuffers;
  water: MeshBuffers;
}

export type BlockAccessor = (wx: number, wy: number, wz: number) => BlockId;
export type BlockMetaAccessor = (wx: number, wy: number, wz: number) => number;

const ATLAS_COLS = 16;
const UV_INSET = 0.0015;

const ROTATABLE_TOPS = new Set<BlockId>([
  BlockId.Grass, BlockId.Dirt, BlockId.Sand, BlockId.Stone,
  BlockId.Snow, BlockId.SwampGrass, BlockId.Gravel, BlockId.Mud,
]);

function cellHash(wx: number, wy: number, wz: number): number {
  let n = Math.imul(wx, 374761393) + Math.imul(wy, 668265263) + Math.imul(wz, 1274126177);
  n = (n ^ (n >>> 13)) >>> 0;
  return (Math.imul(n, 1274126177) >>> 0) / 4294967296;
}

function vertexAO(
  wx: number, wy: number, wz: number,
  nx: number, ny: number, nz: number,
  cx: number, cy: number, cz: number,
  getBlock: BlockAccessor,
): number {
  const sx = cx === 0 ? -1 : 1;
  const sy = cy === 0 ? -1 : 1;
  const sz = cz === 0 ? -1 : 1;

  let side1 = false;
  let side2 = false;
  let corner = false;

  if (ny !== 0) {
    const ay = wy + ny;
    side1 = isBlockOpaque(getBlock(wx + sx, ay, wz));
    side2 = isBlockOpaque(getBlock(wx, ay, wz + sz));
    corner = isBlockOpaque(getBlock(wx + sx, ay, wz + sz));
  } else if (nx !== 0) {
    const ax = wx + nx;
    side1 = isBlockOpaque(getBlock(ax, wy + sy, wz));
    side2 = isBlockOpaque(getBlock(ax, wy, wz + sz));
    corner = isBlockOpaque(getBlock(ax, wy + sy, wz + sz));
  } else {
    const az = wz + nz;
    side1 = isBlockOpaque(getBlock(wx + sx, wy, az));
    side2 = isBlockOpaque(getBlock(wx, wy + sy, az));
    corner = isBlockOpaque(getBlock(wx + sx, wy + sy, az));
  }

  const occ = side1 && side2 ? 3 : (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
  return 1.0 - occ * 0.145;
}

class BufferBuilder implements QuadEmitter {
  public pos: number[] = [];
  public norm: number[] = [];
  public uv: number[] = [];
  public col: number[] = [];
  public idx: number[] = [];
  private vCount = 0;

  public pushQuad(
    corners: [number, number, number][],
    normal: [number, number, number],
    tileIndex: number,
    uvs: [number, number][],
    shades: [number, number, number, number],
    flipDiag = false,
  ): void {
    const tx = tileIndex % ATLAS_COLS;
    const ty = Math.floor(tileIndex / ATLAS_COLS);
    const step = 1 / ATLAS_COLS;
    const u0 = tx * step + UV_INSET;
    const u1 = (tx + 1) * step - UV_INSET;
    const v1 = 1 - ty * step - UV_INSET;
    const v0 = 1 - (ty + 1) * step + UV_INSET;

    const base = this.vCount;
    for (let i = 0; i < 4; i++) {
      const c = corners[i];
      this.pos.push(c[0], c[1], c[2]);
      this.norm.push(normal[0], normal[1], normal[2]);
      this.uv.push(uvs[i][0] === 0 ? u0 : u1, uvs[i][1] === 0 ? v0 : v1);
      const s = shades[i];
      this.col.push(s, s, s);
    }

    if (flipDiag) this.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    else this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.vCount += 4;
  }

  public pushBox(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    tileIndex: number,
    shade = 1.0,
  ): void {
    const uvs: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let f = 0; f < 6; f++) {
      const face = CUBE_FACES[f];
      const corners: [number, number, number][] = face.corners.map((c) => [
        c[0] === 0 ? x0 : x1,
        c[1] === 0 ? y0 : y1,
        c[2] === 0 ? z0 : z1,
      ]);
      const fs = shade * face.shade;
      this.pushQuad(corners, face.dir, tileIndex, uvs, [fs, fs, fs, fs]);
    }
  }

  public toBuffers(): MeshBuffers {
    return {
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.norm),
      uvs: new Float32Array(this.uv),
      colors: new Float32Array(this.col),
      indices: new Uint32Array(this.idx),
    };
  }
}

function emitPlantOrTorch(
  opaque: BufferBuilder,
  id: BlockId,
  lx: number,
  y: number,
  lz: number,
  tile: number,
  rand: number,
): void {
  if (id === BlockId.Torch) {
    opaque.pushBox(lx + 0.43, y, lz + 0.43, lx + 0.57, y + 0.56, lz + 0.57, TEX.OAK_PLANKS, 0.95);
    opaque.pushBox(lx + 0.42, y + 0.56, lz + 0.42, lx + 0.58, y + 0.65, lz + 0.58, TEX.COAL_ORE, 0.9);
    opaque.pushBox(lx + 0.41, y + 0.65, lz + 0.41, lx + 0.59, y + 0.78, lz + 0.59, TEX.TORCH, 1.3);
    return;
  }

  const plantUvs: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const s = 0.92;
  const ox = (rand - 0.5) * 0.12;
  const oz = (((rand * 7.3) % 1) - 0.5) * 0.12;

  if (emitFlowerModel(opaque, id, lx, y, lz, rand)) {
    return;
  }

  if (id === BlockId.OakSapling || id === BlockId.BirchSapling || id === BlockId.SpruceSapling) {
    const trunkTex = id === BlockId.BirchSapling ? TEX.BIRCH_LOG_SIDE : id === BlockId.SpruceSapling ? TEX.PINE_LOG_SIDE : TEX.OAK_LOG_SIDE;
    const leafTex = id === BlockId.BirchSapling ? TEX.BIRCH_LEAVES : id === BlockId.SpruceSapling ? TEX.PINE_LEAVES : TEX.OAK_LEAVES;
    opaque.pushBox(lx + 0.44, y, lz + 0.44, lx + 0.56, y + 0.42, lz + 0.56, trunkTex, 0.95);
    opaque.pushBox(lx + 0.25, y + 0.38, lz + 0.25, lx + 0.75, y + 0.82, lz + 0.75, leafTex, 0.96);
    return;
  }

  if (id === BlockId.Shrub) {
    opaque.pushBox(lx + 0.44, y, lz + 0.44, lx + 0.56, y + 0.24, lz + 0.56, TEX.OAK_LOG_SIDE, 0.9);
    opaque.pushBox(lx + 0.24, y + 0.18, lz + 0.24, lx + 0.76, y + 0.62, lz + 0.76, TEX.OAK_LEAVES, 0.92);
    return;
  }

  // TallGrass & Reed: clean crossed tuft grounded strictly at y = 0
  const yTop = id === BlockId.Reed ? y + 1.0 : y + 0.72 + rand * 0.14;
  const blades: [number, number, number, number][] = [
    [0.18, 0.18, 0.82, 0.82],
    [0.82, 0.18, 0.18, 0.82],
  ];
  for (const [x0, z0, x1, z1] of blades) {
    const q: [number, number, number][] = [
      [lx + ox + x0, y, lz + oz + z0],
      [lx + ox + x1, y, lz + oz + z1],
      [lx + ox + x1, yTop, lz + oz + z1],
      [lx + ox + x0, yTop, lz + oz + z0],
    ];
    opaque.pushQuad(q, [0, 1, 0], tile, plantUvs, [s, s, s, s]);
  }
}

export function buildChunkMesh(
  cx: number,
  cz: number,
  getBlock: BlockAccessor,
  getBlockMeta: BlockMetaAccessor = () => 0,
): ChunkMeshResult {
  const opaque = new BufferBuilder();
  const translucent = new BufferBuilder();
  const water = new BufferBuilder();
  const baseWx = cx * CHUNK_SIZE;
  const baseWz = cz * CHUNK_SIZE;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseWx + lx;
        const wz = baseWz + lz;
        const id = getBlock(wx, y, wz);
        if (id === BlockId.Air) continue;

        const def = BLOCKS[id];
        if (!def) continue;
        if (id === BlockId.OakDoor) continue;

        const rand = cellHash(wx, y, wz);
        const meta = getBlockMeta(wx, y, wz);

        if (def.plant) {
          emitPlantOrTorch(opaque, id, lx, y, lz, def.textures.side, rand);
          continue;
        }

        if (emitCustomBlockModel(opaque, id, lx, y, lz, meta)) {
          continue;
        }

        const isWater = id === BlockId.Water;
        const isGlassOrIce = id === BlockId.Glass || id === BlockId.Ice;
        const target = isWater ? water : isGlassOrIce ? translucent : opaque;
        const uvRot = ROTATABLE_TOPS.has(id) ? Math.floor(rand * 4) % 4 : 0;
        const microTint = ROTATABLE_TOPS.has(id) ? 0.96 + rand * 0.08 : 1.0;

        for (let f = 0; f < 6; f++) {
          const face = CUBE_FACES[f];
          const nx = wx + face.dir[0];
          const ny = y + face.dir[1];
          const nz = wz + face.dir[2];
          const neighbor = getBlock(nx, ny, nz);

          if (isWater) {
            if (neighbor === BlockId.Water || isBlockOpaque(neighbor)) continue;
          } else if (def.transparent) {
            if (neighbor === id || isBlockOpaque(neighbor)) continue;
          } else {
            if (isBlockOpaque(neighbor)) continue;
          }

          const { tileIndex, uvs: faceUvs } = resolveCubeFaceTileAndUv(def, f, meta, uvRot);
          const yDrop = isWater && getBlock(wx, y + 1, wz) !== BlockId.Water ? 0.14 : 0;

          const worldCorners: [number, number, number][] = face.corners.map((c) => [
            lx + c[0],
            y + c[1] - (c[1] === 1 ? yDrop : 0),
            lz + c[2],
          ]);

          let ao0 = 1;
          let ao1 = 1;
          let ao2 = 1;
          let ao3 = 1;
          if (!def.transparent) {
            ao0 = vertexAO(wx, y, wz, face.dir[0], face.dir[1], face.dir[2], face.corners[0][0], face.corners[0][1], face.corners[0][2], getBlock);
            ao1 = vertexAO(wx, y, wz, face.dir[0], face.dir[1], face.dir[2], face.corners[1][0], face.corners[1][1], face.corners[1][2], getBlock);
            ao2 = vertexAO(wx, y, wz, face.dir[0], face.dir[1], face.dir[2], face.corners[2][0], face.corners[2][1], face.corners[2][2], getBlock);
            ao3 = vertexAO(wx, y, wz, face.dir[0], face.dir[1], face.dir[2], face.corners[3][0], face.corners[3][1], face.corners[3][2], getBlock);
          }

          const sFactor = face.shade * (face.faceKind === 'top' ? microTint : 1);
          const flipDiag = ao0 + ao2 < ao1 + ao3;
          target.pushQuad(
            worldCorners,
            face.dir,
            tileIndex,
            faceUvs,
            [ao0 * sFactor, ao1 * sFactor, ao2 * sFactor, ao3 * sFactor],
            flipDiag,
          );
        }
      }
    }
  }

  return {
    opaque: opaque.toBuffers(),
    translucent: translucent.toBuffers(),
    water: water.toBuffers(),
  };
}
