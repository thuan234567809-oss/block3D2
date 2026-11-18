import { BlockDef } from '../data/blocks';
import { TEX } from '../data/blockTextures';
import { BlockId } from '../types/game';
import { decodeBlockMeta, facingToFrontDir, isLogBlock } from './blockOrientation';

export interface QuadFaceSpec {
  dir: [number, number, number];
  corners: [number, number, number][];
  uvs: [number, number][];
  shade: number;
  faceKind: 'top' | 'bottom' | 'side';
}

export interface QuadEmitter {
  pushQuad(
    corners: [number, number, number][],
    normal: [number, number, number],
    tileIndex: number,
    uvs: [number, number][],
    shades: [number, number, number, number],
    flipDiag?: boolean,
  ): void;
}

export const CUBE_FACES: QuadFaceSpec[] = [
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 1.0, faceKind: 'top' },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.55, faceKind: 'bottom' },
  { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.82, faceKind: 'side' },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.82, faceKind: 'side' },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.9, faceKind: 'side' },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.9, faceKind: 'side' },
];

export function rotateUvPair(uv: [number, number], rot: number): [number, number] {
  if (rot === 1) return [1 - uv[1], uv[0]];
  if (rot === 2) return [1 - uv[0], 1 - uv[1]];
  if (rot === 3) return [uv[1], 1 - uv[0]];
  return uv;
}

function rotatePointXZ(px: number, pz: number, facing: number): [number, number] {
  const f = ((facing % 4) + 4) % 4;
  const dx = px - 0.5;
  const dz = pz - 0.5;
  if (f === 1) return [0.5 - dz, 0.5 + dx];
  if (f === 2) return [0.5 - dx, 0.5 - dz];
  if (f === 3) return [0.5 + dz, 0.5 - dx];
  return [px, pz];
}

function rotateDirXZ(nx: number, nz: number, facing: number): [number, number] {
  const f = ((facing % 4) + 4) % 4;
  if (f === 1) return [-nz, nx];
  if (f === 2) return [-nx, -nz];
  if (f === 3) return [nz, -nx];
  return [nx, nz];
}

function emitRotatedBox(
  emitter: QuadEmitter,
  lx: number,
  ly: number,
  lz: number,
  facing: number,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  tiles: number | { top: number; bottom: number; front: number; back: number; side: number },
  shade = 1.0,
): void {
  const t = typeof tiles === 'number'
    ? { top: tiles, bottom: tiles, front: tiles, back: tiles, side: tiles }
    : tiles;
  const tileByFace = [t.top, t.bottom, t.side, t.side, t.front, t.back];
  const uvs: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];

  for (let f = 0; f < 6; f++) {
    const face = CUBE_FACES[f];
    const corners: [number, number, number][] = face.corners.map((c) => {
      const px = c[0] === 0 ? x0 : x1;
      const py = c[1] === 0 ? y0 : y1;
      const pz = c[2] === 0 ? z0 : z1;
      const [rx, rz] = rotatePointXZ(px, pz, facing);
      return [lx + rx, ly + py, lz + rz];
    });
    const [rnx, rnz] = rotateDirXZ(face.dir[0], face.dir[2], facing);
    const fs = shade * face.shade;
    emitter.pushQuad(corners, [rnx, face.dir[1], rnz], tileByFace[f], uvs, [fs, fs, fs, fs]);
  }
}

export function resolveCubeFaceTileAndUv(
  def: BlockDef,
  faceIdx: number,
  meta: number,
  uvRot: number,
): { tileIndex: number; uvs: [number, number][] } {
  const face = CUBE_FACES[faceIdx];
  const { facing, axis } = decodeBlockMeta(meta);

  if (isLogBlock(def.id) && axis !== 'y') {
    const [nx, ny, nz] = face.dir;
    if (axis === 'x') {
      if (nx !== 0) return { tileIndex: def.textures.top, uvs: face.uvs };
      // Horizontal bark running along X on both Y faces and Z faces
      return { tileIndex: def.textures.side, uvs: face.uvs.map((u) => rotateUvPair(u, 1)) };
    }
    // axis === 'z'
    if (nz !== 0) return { tileIndex: def.textures.top, uvs: face.uvs };
    if (ny !== 0) return { tileIndex: def.textures.side, uvs: face.uvs };
    return { tileIndex: def.textures.side, uvs: face.uvs.map((u) => rotateUvPair(u, 1)) };
  }

  let tileIndex: number;
  if (face.faceKind === 'top') {
    tileIndex = def.textures.top;
  } else if (face.faceKind === 'bottom') {
    tileIndex = def.textures.bottom;
  } else if (def.textures.front !== undefined) {
    const [fx, , fz] = facingToFrontDir(facing);
    const [dx, , dz] = face.dir;
    if (dx === fx && dz === fz) tileIndex = def.textures.front;
    else if (dx === -fx && dz === -fz) tileIndex = def.textures.back ?? def.textures.side;
    else tileIndex = def.textures.side;
  } else {
    tileIndex = def.textures.side;
  }

  const uvs = face.faceKind === 'top' && uvRot > 0 ? face.uvs.map((u) => rotateUvPair(u, uvRot)) : face.uvs;
  return { tileIndex, uvs };
}

export function emitCustomBlockModel(
  emitter: QuadEmitter,
  id: BlockId,
  lx: number,
  ly: number,
  lz: number,
  meta: number,
): boolean {
  const { facing, part } = decodeBlockMeta(meta);

  if (id === BlockId.Chest) {
    const chestTiles = {
      top: TEX.CHEST_TOP,
      bottom: TEX.OAK_PLANKS,
      front: TEX.CHEST_FRONT,
      back: TEX.CHEST_SIDE,
      side: TEX.CHEST_SIDE,
    };
    emitRotatedBox(emitter, lx, ly, lz, facing, 0.0625, 0, 0.0625, 0.9375, 0.625, 0.9375, chestTiles);
    emitRotatedBox(emitter, lx, ly, lz, facing, 0.0625, 0.625, 0.0625, 0.9375, 0.875, 0.9375, chestTiles);
    // Raised 3D iron clasp latch on front
    emitRotatedBox(emitter, lx, ly, lz, facing, 0.4375, 0.46, 0.9375, 0.5625, 0.70, 0.995, TEX.WHITE_CONCRETE, 0.92);
    return true;
  }

  if (id === BlockId.Anvil) {
    const t = { top: TEX.ANVIL_TOP, bottom: TEX.ANVIL_TOP, front: TEX.ANVIL_SIDE, back: TEX.ANVIL_SIDE, side: TEX.ANVIL_SIDE };
    emitRotatedBox(emitter, lx, ly, lz, facing, 0.125, 0, 0.125, 0.875, 0.25, 0.875, t);
    emitRotatedBox(emitter, lx, ly, lz, facing, 0.25, 0.25, 0.1875, 0.75, 0.375, 0.8125, t);
    emitRotatedBox(emitter, lx, ly, lz, facing, 0.375, 0.375, 0.3125, 0.625, 0.625, 0.6875, t);
    emitRotatedBox(emitter, lx, ly, lz, facing, 0.1875, 0.625, 0.0, 0.8125, 1.0, 1.0, t);
    return true;
  }

  if (id === BlockId.Bed) {
    if (part === 'head') {
      // 2 Head Legs
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.04, 0, 0.06, 0.19, 0.1875, 0.21, TEX.BED_WOOD);
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.81, 0, 0.06, 0.96, 0.1875, 0.21, TEX.BED_WOOD);
      // Frame deck (joins seamlessly at z=1.0 with foot half)
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.04, 0.1875, 0.04, 0.96, 0.3125, 1.0, TEX.BED_WOOD);
      // Carved Headboard + Corner Finials
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.04, 0.3125, 0.04, 0.96, 0.76, 0.14, TEX.BED_WOOD);
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.04, 0.76, 0.03, 0.18, 0.83, 0.15, TEX.BED_WOOD);
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.82, 0.76, 0.03, 0.96, 0.83, 0.15, TEX.BED_WOOD);
      // Mattress resting atop deck
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.08, 0.3125, 0.14, 0.92, 0.48, 1.0, TEX.BED_MATTRESS);
      // Pillow tucked cleanly atop mattress in front of headboard
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.16, 0.48, 0.17, 0.84, 0.60, 0.51, TEX.BED_PILLOW);
      // Folded Blanket Cuff + Quilt section joining foot half
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.05, 0.48, 0.56, 0.95, 0.568, 0.72, TEX.BED_BLANKET_TRIM);
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.05, 0.48, 0.72, 0.95, 0.5625, 1.0, TEX.BED_BLANKET);
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.05, 0.34, 0.72, 0.08, 0.48, 1.0, TEX.BED_BLANKET);
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.92, 0.34, 0.72, 0.95, 0.48, 1.0, TEX.BED_BLANKET);
    } else {
      // 2 Foot Legs
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.04, 0, 0.79, 0.19, 0.1875, 0.94, TEX.BED_WOOD);
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.81, 0, 0.79, 0.96, 0.1875, 0.94, TEX.BED_WOOD);
      // Frame deck (joins seamlessly at z=0.0 with head half)
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.04, 0.1875, 0.0, 0.96, 0.3125, 0.96, TEX.BED_WOOD);
      // Low Footboard + Corner Finials
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.04, 0.3125, 0.86, 0.96, 0.50, 0.96, TEX.BED_WOOD);
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.04, 0.50, 0.85, 0.18, 0.56, 0.97, TEX.BED_WOOD);
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.82, 0.50, 0.85, 0.96, 0.56, 0.97, TEX.BED_WOOD);
      // Mattress + Blanket + Side Skirts
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.08, 0.3125, 0.0, 0.92, 0.48, 0.86, TEX.BED_MATTRESS);
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.05, 0.48, 0.0, 0.95, 0.5625, 0.86, TEX.BED_BLANKET);
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.05, 0.34, 0.0, 0.08, 0.48, 0.86, TEX.BED_BLANKET);
      emitRotatedBox(emitter, lx, ly, lz, facing, 0.92, 0.34, 0.0, 0.95, 0.48, 0.86, TEX.BED_BLANKET);
    }
    return true;
  }

  return false;
}
