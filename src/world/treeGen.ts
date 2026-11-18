import { BiomeId, BlockId } from '../types/game';
import { CHUNK_SIZE, ChunkData } from './chunkData';
import { hash2D } from './noise';

function setIfAir(chunk: ChunkData, lx: number, y: number, lz: number, id: BlockId): void {
  if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
  if (chunk.get(lx, y, lz) === BlockId.Air) {
    chunk.set(lx, y, lz, id);
  }
}

function placeCanopy(
  chunk: ChunkData,
  cx: number,
  baseY: number,
  cz: number,
  radius: number,
  leafId: BlockId,
  seed: number,
  wx: number,
  wz: number,
  skipCorners = true,
): void {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (skipCorners && Math.abs(dx) === radius && Math.abs(dz) === radius) {
        if (hash2D(wx + dx, wz + dz, seed + baseY) < 0.6) continue;
      }
      setIfAir(chunk, cx + dx, baseY, cz + dz, leafId);
    }
  }
}

export function placeMultiVariantTree(
  chunk: ChunkData,
  lx: number,
  baseY: number,
  lz: number,
  biome: BiomeId,
  seed: number,
  wx: number,
  wz: number,
): void {
  const hRand = hash2D(wx, wz, seed + 901);
  const speciesRand = hash2D(wx, wz, seed + 1777);

  if (biome === BiomeId.Desert) {
    if (speciesRand < 0.78) {
      const cactusH = 2 + Math.floor(hRand * 2);
      for (let dy = 0; dy < cactusH; dy++) chunk.set(lx, baseY + dy, lz, BlockId.Cactus);
      return;
    }
    // Occasional Acacia savanna tree near desert edges
    placeAcaciaTree(chunk, lx, baseY, lz, seed, wx, wz, hRand);
    return;
  }

  if (biome === BiomeId.Snow || biome === BiomeId.Mountains) {
    placeSpruceTree(chunk, lx, baseY, lz, hRand);
    return;
  }

  if (biome === BiomeId.Jungle) {
    placeJungleTree(chunk, lx, baseY, lz, seed, wx, wz, hRand);
    return;
  }

  if (biome === BiomeId.Plains && speciesRand > 0.72) {
    placeAcaciaTree(chunk, lx, baseY, lz, seed, wx, wz, hRand);
    return;
  }

  if (biome === BiomeId.Forest) {
    if (speciesRand < 0.34) {
      placeBirchTree(chunk, lx, baseY, lz, seed, wx, wz, hRand);
      return;
    }
    if (speciesRand < 0.52) {
      placeDarkOakTree(chunk, lx, baseY, lz, seed, wx, wz, hRand);
      return;
    }
  } else if (biome === BiomeId.Swamp && speciesRand < 0.45) {
    placeDarkOakTree(chunk, lx, baseY, lz, seed, wx, wz, hRand);
    return;
  } else if (biome === BiomeId.Plains && speciesRand < 0.25) {
    placeBirchTree(chunk, lx, baseY, lz, seed, wx, wz, hRand);
    return;
  }

  placeOakTree(chunk, lx, baseY, lz, seed, wx, wz, hRand);
}

function placeOakTree(
  chunk: ChunkData,
  lx: number,
  baseY: number,
  lz: number,
  seed: number,
  wx: number,
  wz: number,
  hRand: number,
): void {
  const trunkH = 4 + Math.floor(hRand * 3);
  for (let dy = 0; dy < trunkH; dy++) chunk.set(lx, baseY + dy, lz, BlockId.OakLog);
  for (let dy = trunkH - 2; dy <= trunkH + 1; dy++) {
    const r = dy === trunkH + 1 ? 1 : 2;
    placeCanopy(chunk, lx, baseY + dy, lz, r, BlockId.OakLeaves, seed, wx, wz);
  }
  setIfAir(chunk, lx, baseY + trunkH + 2, lz, BlockId.OakLeaves);
}

function placeBirchTree(
  chunk: ChunkData,
  lx: number,
  baseY: number,
  lz: number,
  seed: number,
  wx: number,
  wz: number,
  hRand: number,
): void {
  const trunkH = 5 + Math.floor(hRand * 2);
  for (let dy = 0; dy < trunkH; dy++) chunk.set(lx, baseY + dy, lz, BlockId.BirchLog);
  for (let dy = trunkH - 2; dy <= trunkH; dy++) {
    placeCanopy(chunk, lx, baseY + dy, lz, 2, BlockId.BirchLeaves, seed + 13, wx, wz);
  }
  placeCanopy(chunk, lx, baseY + trunkH + 1, lz, 1, BlockId.BirchLeaves, seed + 19, wx, wz, false);
}

function placeSpruceTree(chunk: ChunkData, lx: number, baseY: number, lz: number, hRand: number): void {
  const trunkH = 5 + Math.floor(hRand * 3);
  for (let dy = 0; dy < trunkH; dy++) chunk.set(lx, baseY + dy, lz, BlockId.PineLog);
  for (let dy = 2; dy <= trunkH + 1; dy++) {
    const tier = trunkH + 1 - dy;
    const r = tier === 0 ? 1 : tier % 2 === 1 ? 2 : 1;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && r > 1) continue;
        setIfAir(chunk, lx + dx, baseY + dy, lz + dz, BlockId.PineLeaves);
      }
    }
  }
  setIfAir(chunk, lx, baseY + trunkH + 2, lz, BlockId.PineLeaves);
}

function placeJungleTree(
  chunk: ChunkData,
  lx: number,
  baseY: number,
  lz: number,
  seed: number,
  wx: number,
  wz: number,
  hRand: number,
): void {
  const trunkH = 6 + Math.floor(hRand * 4);
  for (let dy = 0; dy < trunkH; dy++) chunk.set(lx, baseY + dy, lz, BlockId.JungleLog);
  for (let dy = trunkH - 2; dy <= trunkH + 1; dy++) {
    const r = dy === trunkH + 1 ? 2 : 3;
    placeCanopy(chunk, lx, baseY + dy, lz, r, BlockId.JungleLeaves, seed + 29, wx, wz);
  }
  // Hanging jungle foliage tendrils
  const offsets: [number, number][] = [[-2, 0], [2, 0], [0, -2], [0, 2]];
  for (const [ox, oz] of offsets) {
    if (hash2D(wx + ox, wz + oz, seed + 71) > 0.45) {
      setIfAir(chunk, lx + ox, baseY + trunkH - 3, lz + oz, BlockId.JungleLeaves);
    }
  }
}

function placeAcaciaTree(
  chunk: ChunkData,
  lx: number,
  baseY: number,
  lz: number,
  seed: number,
  wx: number,
  wz: number,
  hRand: number,
): void {
  const leanX = hRand < 0.5 ? 1 : -1;
  const trunkH = 4 + Math.floor(hRand * 2);
  for (let dy = 0; dy < trunkH - 1; dy++) chunk.set(lx, baseY + dy, lz, BlockId.AcaciaLog);
  const topX = Math.max(1, Math.min(CHUNK_SIZE - 2, lx + leanX));
  chunk.set(topX, baseY + trunkH - 1, lz, BlockId.AcaciaLog);
  chunk.set(topX, baseY + trunkH, lz, BlockId.AcaciaLog);
  // Flat umbrella savanna crown
  placeCanopy(chunk, topX, baseY + trunkH, lz, 2, BlockId.AcaciaLeaves, seed + 41, wx, wz, false);
  placeCanopy(chunk, topX, baseY + trunkH + 1, lz, 1, BlockId.AcaciaLeaves, seed + 43, wx, wz, false);
}

function placeDarkOakTree(
  chunk: ChunkData,
  lx: number,
  baseY: number,
  lz: number,
  seed: number,
  wx: number,
  wz: number,
  hRand: number,
): void {
  const trunkH = 4 + Math.floor(hRand * 2);
  for (let dy = 0; dy < trunkH; dy++) {
    chunk.set(lx, baseY + dy, lz, BlockId.DarkOakLog);
    if (lx + 1 < CHUNK_SIZE && dy < trunkH - 1) chunk.set(lx + 1, baseY + dy, lz, BlockId.DarkOakLog);
  }
  for (let dy = trunkH - 2; dy <= trunkH + 1; dy++) {
    const r = dy === trunkH + 1 ? 2 : 3;
    placeCanopy(chunk, lx, baseY + dy, lz, r, BlockId.DarkOakLeaves, seed + 59, wx, wz);
  }
}
