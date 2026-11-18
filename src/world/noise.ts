// Pure deterministic PRNG and 2D/3D gradient noise utilities

export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2D(x: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function hash3D(x: number, y: number, z: number, seed: number): number {
  let h =
    Math.imul(x, 374761393) +
    Math.imul(y, 1103515245) +
    Math.imul(z, 668265263) +
    Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const GRAD2: [number, number][] = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const GRAD3: [number, number, number][] = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

function grad2(ix: number, iz: number, dx: number, dz: number, seed: number): number {
  const h = Math.floor(hash2D(ix, iz, seed) * 8) & 7;
  const g = GRAD2[h];
  return g[0] * dx + g[1] * dz;
}

function grad3(ix: number, iy: number, iz: number, dx: number, dy: number, dz: number, seed: number): number {
  const h = Math.floor(hash3D(ix, iy, iz, seed) * 12) % 12;
  const g = GRAD3[h];
  return g[0] * dx + g[1] * dy + g[2] * dz;
}

export function noise2D(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const dx = x - x0;
  const dz = z - z0;
  const u = fade(dx);
  const v = fade(dz);

  const n00 = grad2(x0, z0, dx, dz, seed);
  const n10 = grad2(x0 + 1, z0, dx - 1, dz, seed);
  const n01 = grad2(x0, z0 + 1, dx, dz - 1, seed);
  const n11 = grad2(x0 + 1, z0 + 1, dx - 1, dz - 1, seed);

  const nx0 = lerp(n00, n10, u);
  const nx1 = lerp(n01, n11, u);
  return lerp(nx0, nx1, v); // roughly [-1, 1]
}

export function fbm2D(
  x: number,
  z: number,
  seed: number,
  octaves = 4,
  lacunarity = 2.0,
  gain = 0.5,
): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2D(x * freq, z * freq, seed + i * 1013) * amp;
    maxAmp += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / maxAmp;
}

export function noise3D(x: number, y: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const dx = x - x0;
  const dy = y - y0;
  const dz = z - z0;
  const u = fade(dx);
  const v = fade(dy);
  const w = fade(dz);

  const n000 = grad3(x0, y0, z0, dx, dy, dz, seed);
  const n100 = grad3(x0 + 1, y0, z0, dx - 1, dy, dz, seed);
  const n010 = grad3(x0, y0 + 1, z0, dx, dy - 1, dz, seed);
  const n110 = grad3(x0 + 1, y0 + 1, z0, dx - 1, dy - 1, dz, seed);
  const n001 = grad3(x0, y0, z0 + 1, dx, dy, dz - 1, seed);
  const n101 = grad3(x0 + 1, y0, z0 + 1, dx - 1, dy, dz - 1, seed);
  const n011 = grad3(x0, y0 + 1, z0 + 1, dx, dy - 1, dz - 1, seed);
  const n111 = grad3(x0 + 1, y0 + 1, z0 + 1, dx - 1, dy - 1, dz - 1, seed);

  const nx00 = lerp(n000, n100, u);
  const nx10 = lerp(n010, n110, u);
  const nx01 = lerp(n001, n101, u);
  const nx11 = lerp(n011, n111, u);

  const nxy0 = lerp(nx00, nx10, v);
  const nxy1 = lerp(nx01, nx11, v);
  return lerp(nxy0, nxy1, w);
}
