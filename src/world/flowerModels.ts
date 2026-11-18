import { TEX } from '../data/blockTextures';
import { BlockId } from '../types/game';
import { CUBE_FACES, QuadEmitter } from './blockModels';

interface OrientedBoxParams {
  px: number;
  py: number;
  pz: number;
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  yaw: number;
  pitch?: number;
  tile: number;
  shade?: number;
}

const BOX_UVS: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

function transformVec(
  vx: number,
  vy: number,
  vz: number,
  pitch: number,
  yaw: number,
): [number, number, number] {
  let y = vy;
  let z = vz;
  if (pitch !== 0) {
    // Negative X rotation lifts +Z outward points upward into +Y
    const cp = Math.cos(-pitch);
    const sp = Math.sin(-pitch);
    const ny = y * cp - z * sp;
    const nz = y * sp + z * cp;
    y = ny;
    z = nz;
  }
  if (yaw !== 0) {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const nx = vx * cy + z * sy;
    const nz = -vx * sy + z * cy;
    return [nx, y, nz];
  }
  return [vx, y, z];
}

function emitOrientedBox(emitter: QuadEmitter, p: OrientedBoxParams): void {
  const pitch = p.pitch ?? 0;
  const shadeBase = p.shade ?? 1.0;

  for (let f = 0; f < CUBE_FACES.length; f++) {
    const face = CUBE_FACES[f];
    const corners: [number, number, number][] = face.corners.map((c) => {
      const lx = c[0] === 0 ? p.x0 : p.x1;
      const ly = c[1] === 0 ? p.y0 : p.y1;
      const lz = c[2] === 0 ? p.z0 : p.z1;
      const [rx, ry, rz] = transformVec(lx, ly, lz, pitch, p.yaw);
      return [p.px + rx, p.py + ry, p.pz + rz];
    });
    const [nx, ny, nz] = transformVec(face.dir[0], face.dir[1], face.dir[2], pitch, p.yaw);
    const fs = shadeBase * face.shade;
    emitter.pushQuad(corners, [nx, ny, nz], p.tile, BOX_UVS, [fs, fs, fs, fs]);
  }
}

function emitPoppyModel(
  emitter: QuadEmitter,
  cx: number,
  baseY: number,
  cz: number,
  yaw: number,
): void {
  // Grounded 2-segment slender stem (connected seamlessly at y = 0.25)
  emitOrientedBox(emitter, {
    px: cx,
    py: baseY,
    pz: cz,
    x0: -0.036,
    y0: 0,
    z0: -0.036,
    x1: 0.036,
    y1: 0.25,
    z1: 0.036,
    yaw,
    tile: TEX.FLOWER_STEM,
    shade: 0.96,
  });
  emitOrientedBox(emitter, {
    px: cx,
    py: baseY + 0.24,
    pz: cz,
    x0: -0.032,
    y0: 0,
    z0: -0.032,
    x1: 0.032,
    y1: 0.24,
    z1: 0.032,
    yaw,
    pitch: -0.08,
    tile: TEX.FLOWER_STEM,
    shade: 0.98,
  });

  // Top head pivot offset matches slight upper-stem tilt (sin(0.08) * 0.22 ≈ 0.017)
  const leanDist = Math.sin(0.08) * 0.22;
  const hx = cx - Math.sin(yaw) * leanDist;
  const hz = cz - Math.cos(yaw) * leanDist;
  const hy = baseY + 0.46;

  // Two staggered 3D stem leaves firmly embedded into stem
  emitOrientedBox(emitter, {
    px: cx,
    py: baseY + 0.13,
    pz: cz,
    x0: -0.062,
    y0: 0,
    z0: 0.015,
    x1: 0.062,
    y1: 0.032,
    z1: 0.21,
    yaw: yaw + 0.9,
    pitch: 0.44,
    tile: TEX.FLOWER_LEAF,
    shade: 0.98,
  });
  emitOrientedBox(emitter, {
    px: cx,
    py: baseY + 0.26,
    pz: cz,
    x0: -0.056,
    y0: 0,
    z0: 0.015,
    x1: 0.056,
    y1: 0.03,
    z1: 0.19,
    yaw: yaw + 3.7,
    pitch: 0.5,
    tile: TEX.FLOWER_LEAF,
    shade: 0.94,
  });

  // Green calyx receptacle connecting stem to petals
  emitOrientedBox(emitter, {
    px: hx,
    py: hy,
    pz: hz,
    x0: -0.068,
    y0: 0,
    z0: -0.068,
    x1: 0.068,
    y1: 0.065,
    z1: 0.068,
    yaw,
    tile: TEX.FLOWER_LEAF,
    shade: 0.95,
  });

  // Four distinct cupped crimson petals flaring outward & upward from calyx
  for (let i = 0; i < 4; i++) {
    const petalYaw = yaw + i * (Math.PI * 0.5);
    emitOrientedBox(emitter, {
      px: hx,
      py: hy + 0.04,
      pz: hz,
      x0: -0.095,
      y0: 0,
      z0: 0.035,
      x1: 0.095,
      y1: 0.036,
      z1: 0.215,
      yaw: petalYaw,
      pitch: 0.66,
      tile: TEX.POPPY_PETAL,
      shade: i % 2 === 0 ? 1.02 : 0.95,
    });
  }

  // Dark seed capsule + stamen core nestled inside petal cup (clearly visible from top & 3/4)
  emitOrientedBox(emitter, {
    px: hx,
    py: hy + 0.052,
    pz: hz,
    x0: -0.058,
    y0: 0,
    z0: -0.058,
    x1: 0.058,
    y1: 0.075,
    z1: 0.058,
    yaw: yaw + 0.4,
    tile: TEX.POPPY_CENTER,
    shade: 0.98,
  });
  emitOrientedBox(emitter, {
    px: hx,
    py: hy + 0.125,
    pz: hz,
    x0: -0.032,
    y0: 0,
    z0: -0.032,
    x1: 0.032,
    y1: 0.032,
    z1: 0.032,
    yaw: yaw + 0.4,
    tile: TEX.DANDELION_CENTER,
    shade: 1.0,
  });
}

function emitDandelionModel(
  emitter: QuadEmitter,
  cx: number,
  baseY: number,
  cz: number,
  yaw: number,
): void {
  // Compact herb stem grounded cleanly at baseY
  emitOrientedBox(emitter, {
    px: cx,
    py: baseY,
    pz: cz,
    x0: -0.038,
    y0: 0,
    z0: -0.038,
    x1: 0.038,
    y1: 0.34,
    z1: 0.038,
    yaw,
    tile: TEX.FLOWER_STEM,
    shade: 0.98,
  });

  // Three low basal rosette leaves hugging near ground without clipping below baseY
  for (let i = 0; i < 3; i++) {
    const leafYaw = yaw + i * ((Math.PI * 2) / 3);
    emitOrientedBox(emitter, {
      px: cx,
      py: baseY + 0.018,
      pz: cz,
      x0: -0.048,
      y0: 0,
      z0: 0.018,
      x1: 0.048,
      y1: 0.026,
      z1: 0.185,
      yaw: leafYaw,
      pitch: 0.34,
      tile: TEX.FLOWER_LEAF,
      shade: i === 0 ? 1.0 : 0.93,
    });
  }

  // Flared green involucre calyx beneath flower rosette
  emitOrientedBox(emitter, {
    px: cx,
    py: baseY + 0.32,
    pz: cz,
    x0: -0.062,
    y0: 0,
    z0: -0.062,
    x1: 0.062,
    y1: 0.052,
    z1: 0.062,
    yaw,
    tile: TEX.FLOWER_LEAF,
    shade: 0.95,
  });

  // Lower 4-ray golden outer floret cross-bars (balanced 0.34 span)
  emitOrientedBox(emitter, {
    px: cx,
    py: baseY + 0.368,
    pz: cz,
    x0: -0.17,
    y0: 0,
    z0: -0.055,
    x1: 0.17,
    y1: 0.04,
    z1: 0.055,
    yaw,
    tile: TEX.DANDELION_PETAL,
    shade: 1.0,
  });
  emitOrientedBox(emitter, {
    px: cx,
    py: baseY + 0.37,
    pz: cz,
    x0: -0.055,
    y0: 0,
    z0: -0.17,
    x1: 0.055,
    y1: 0.04,
    z1: 0.17,
    yaw,
    tile: TEX.DANDELION_PETAL,
    shade: 0.97,
  });

  // Upper diagonal 4-ray florets (45° offset, non-coplanar -> 8-ray golden rosette)
  const diagYaw = yaw + Math.PI * 0.25;
  emitOrientedBox(emitter, {
    px: cx,
    py: baseY + 0.392,
    pz: cz,
    x0: -0.15,
    y0: 0,
    z0: -0.046,
    x1: 0.15,
    y1: 0.038,
    z1: 0.046,
    yaw: diagYaw,
    tile: TEX.DANDELION_PETAL,
    shade: 1.02,
  });
  emitOrientedBox(emitter, {
    px: cx,
    py: baseY + 0.394,
    pz: cz,
    x0: -0.046,
    y0: 0,
    z0: -0.15,
    x1: 0.046,
    y1: 0.038,
    z1: 0.15,
    yaw: diagYaw,
    tile: TEX.DANDELION_PETAL,
    shade: 0.98,
  });

  // Inner golden crown + warm amber central disc dome
  emitOrientedBox(emitter, {
    px: cx,
    py: baseY + 0.412,
    pz: cz,
    x0: -0.092,
    y0: 0,
    z0: -0.092,
    x1: 0.092,
    y1: 0.048,
    z1: 0.092,
    yaw: yaw + 0.2,
    tile: TEX.DANDELION_PETAL,
    shade: 1.03,
  });
  emitOrientedBox(emitter, {
    px: cx,
    py: baseY + 0.452,
    pz: cz,
    x0: -0.054,
    y0: 0,
    z0: -0.054,
    x1: 0.054,
    y1: 0.044,
    z1: 0.054,
    yaw: yaw + 0.55,
    tile: TEX.DANDELION_CENTER,
    shade: 0.98,
  });
}

export function emitFlowerModel(
  emitter: QuadEmitter,
  id: BlockId,
  lx: number,
  y: number,
  lz: number,
  rand: number,
): boolean {
  if (id !== BlockId.FlowerRed && id !== BlockId.FlowerYellow) {
    return false;
  }

  // Keep center offset strictly within [0.43..0.57] so petals (max radius 0.22) stay inside [0..1]
  const ox = (rand - 0.5) * 0.14;
  const oz = (((rand * 7.3) % 1) - 0.5) * 0.14;
  const cx = lx + 0.5 + ox;
  const cz = lz + 0.5 + oz;
  const yaw = ((rand * 13.7) % 1) * Math.PI * 2;

  if (id === BlockId.FlowerRed) {
    emitPoppyModel(emitter, cx, y, cz, yaw);
  } else {
    emitDandelionModel(emitter, cx, y, cz, yaw);
  }
  return true;
}
