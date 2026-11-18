import { BiomeId, BlockId } from '../types/game';
import { BIOMES, sampleBiome } from './biome';
import { CHUNK_HEIGHT, CHUNK_SIZE, ChunkData, SEA_LEVEL } from './chunkData';
import { fbm2D, hash2D, hash3D, noise3D } from './noise';
import { placeMultiVariantTree } from './treeGen';

export function getTerrainHeightAndBiome(
  wx: number,
  wz: number,
  seed: number,
): { height: number; biome: BiomeId } {
  const centerBiome = sampleBiome(wx, wz, seed);
  let blendedBase = 0;
  let blendedAmp = 0;
  const sampleStep = 4;
  for (let ox = -1; ox <= 1; ox++) {
    for (let oz = -1; oz <= 1; oz++) {
      const b = ox === 0 && oz === 0 ? centerBiome : sampleBiome(wx + ox * sampleStep, wz + oz * sampleStep, seed);
      const cfg = BIOMES[b];
      blendedBase += cfg.baseHeight;
      blendedAmp += cfg.heightAmplitude;
    }
  }
  blendedBase /= 9;
  blendedAmp /= 9;

  const detail = fbm2D(wx * 0.015, wz * 0.015, seed + 505, 4);
  const ridge = 1 - Math.abs(fbm2D(wx * 0.008, wz * 0.008, seed + 606, 3));
  let h = blendedBase + detail * blendedAmp;
  if (centerBiome === BiomeId.Mountains) {
    h += ridge * 12;
  }

  const riverNoise = Math.abs(fbm2D(wx * 0.0045 + 100, wz * 0.0045 - 100, seed + 707, 3));
  if (riverNoise < 0.035 && centerBiome !== BiomeId.Ocean && centerBiome !== BiomeId.Mountains) {
    const t = riverNoise / 0.035;
    const riverBed = SEA_LEVEL - 4;
    h = riverBed + (h - riverBed) * (t * t);
  }

  return {
    height: Math.max(4, Math.min(CHUNK_HEIGHT - 16, Math.round(h))),
    biome: centerBiome,
  };
}

export function generateChunk(cx: number, cz: number, seed: number): ChunkData {
  const chunk = new ChunkData(cx, cz);
  const heights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
  const biomes: BiomeId[] = new Array(CHUNK_SIZE * CHUNK_SIZE);

  // 1. Base Terrain + Caves + Ores + Water + Gravel/Mud Shorelines
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      const { height, biome } = getTerrainHeightAndBiome(wx, wz, seed);
      const cfg = BIOMES[biome];
      heights[lz * CHUNK_SIZE + lx] = height;
      biomes[lz * CHUNK_SIZE + lx] = biome;
      const shoreNoise = hash2D(wx, wz, seed + 313);

      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        if (y === 0) {
          chunk.set(lx, y, lz, BlockId.Bedrock);
          continue;
        }

        if (y <= height) {
          if (y > 2 && y < height - 2) {
            const cave = noise3D(wx * 0.055, y * 0.075, wz * 0.055, seed + 808);
            if (cave > 0.36) {
              chunk.set(lx, y, lz, BlockId.Air);
              continue;
            }
          }

          if (y === height) {
            if (height <= SEA_LEVEL + 1 && biome === BiomeId.Swamp) {
              chunk.set(lx, y, lz, shoreNoise > 0.45 ? BlockId.Mud : BlockId.SwampGrass);
            } else if (height <= SEA_LEVEL + 1) {
              chunk.set(lx, y, lz, shoreNoise > 0.74 ? BlockId.Gravel : BlockId.Sand);
            } else if (biome === BiomeId.Mountains && height > 62) {
              chunk.set(lx, y, lz, BlockId.Snow);
            } else if (biome === BiomeId.Mountains && height > 55) {
              chunk.set(lx, y, lz, shoreNoise > 0.72 ? BlockId.Gravel : BlockId.Stone);
            } else {
              chunk.set(lx, y, lz, cfg.topBlock);
            }
          } else if (y >= height - 3) {
            chunk.set(lx, y, lz, height <= SEA_LEVEL + 1 ? (biome === BiomeId.Swamp ? BlockId.Mud : BlockId.Sand) : cfg.subBlock);
          } else {
            const oreHash = hash3D(wx, y, wz, seed + 404);
            if (y < 18 && oreHash > 0.992) {
              chunk.set(lx, y, lz, BlockId.DiamondOre);
            } else if (biome === BiomeId.Mountains && y < 34 && oreHash > 0.988 && oreHash <= 0.992) {
              chunk.set(lx, y, lz, BlockId.EmeraldOre);
            } else if (y < 28 && oreHash > 0.984 && oreHash <= 0.988) {
              chunk.set(lx, y, lz, BlockId.GoldOre);
            } else if (y < 46 && oreHash > 0.972 && oreHash <= 0.984) {
              chunk.set(lx, y, lz, BlockId.IronOre);
            } else if (y < 54 && oreHash > 0.961 && oreHash <= 0.972) {
              chunk.set(lx, y, lz, BlockId.CopperOre);
            } else if (oreHash > 0.946 && oreHash <= 0.961) {
              chunk.set(lx, y, lz, BlockId.CoalOre);
            } else {
              chunk.set(lx, y, lz, BlockId.Stone);
            }
          }
        } else if (y <= SEA_LEVEL) {
          chunk.set(lx, y, lz, biome === BiomeId.Snow && y === SEA_LEVEL ? BlockId.Ice : BlockId.Water);
        }
      }
    }
  }

  // 2. Surface Flora, Multi-Variant Trees, Shrubs & Reeds
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      const h = heights[lz * CHUNK_SIZE + lx];
      const biome = biomes[lz * CHUNK_SIZE + lx];
      const cfg = BIOMES[biome];
      const top = chunk.get(lx, h, lz);

      if (h <= SEA_LEVEL) continue;
      const nearOrigin = Math.hypot(wx, wz) < 5;

      const r = hash2D(wx, wz, seed + 1234);
      const canTree =
        !nearOrigin &&
        lx >= 2 &&
        lx <= CHUNK_SIZE - 3 &&
        lz >= 2 &&
        lz <= CHUNK_SIZE - 3 &&
        (top === BlockId.Grass || top === BlockId.SwampGrass || top === BlockId.SnowGrass || (biome === BiomeId.Desert && top === BlockId.Sand));

      if (canTree && r < cfg.treeDensity) {
        placeMultiVariantTree(chunk, lx, h + 1, lz, biome, seed, wx, wz);
      } else if (top === BlockId.Grass || top === BlockId.SwampGrass) {
        const plantR = hash2D(wx, wz, seed + 5678);
        if (plantR < cfg.flowerDensity * 0.5) {
          chunk.set(lx, h + 1, lz, BlockId.FlowerRed);
        } else if (plantR < cfg.flowerDensity) {
          chunk.set(lx, h + 1, lz, BlockId.FlowerYellow);
        } else if (plantR < cfg.flowerDensity + cfg.grassDensity * 0.25) {
          chunk.set(lx, h + 1, lz, BlockId.Shrub);
        } else if (plantR < cfg.flowerDensity + cfg.grassDensity) {
          chunk.set(lx, h + 1, lz, BlockId.TallGrass);
        } else if (plantR < cfg.flowerDensity + cfg.grassDensity + 0.004 && !nearOrigin) {
          chunk.set(lx, h + 1, lz, biome === BiomeId.Forest && r > 0.5 ? BlockId.BirchSapling : BlockId.OakSapling);
        }
      } else if (top === BlockId.Sand && h === SEA_LEVEL + 1 && r < 0.03) {
        chunk.set(lx, h + 1, lz, BlockId.Reed);
      } else if (biome === BiomeId.Desert && top === BlockId.Sand && r < 0.015) {
        chunk.set(lx, h + 1, lz, BlockId.Shrub);
      }
    }
  }

  chunk.dirty = true;
  chunk.modified = false;
  return chunk;
}

export function findSafeSpawn(seed: number): { x: number; y: number; z: number } {
  for (let r = 0; r < 56; r += 2) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const wx = Math.round(Math.cos(angle) * r);
      const wz = Math.round(Math.sin(angle) * r);
      const { height, biome } = getTerrainHeightAndBiome(wx, wz, seed);
      if (height >= SEA_LEVEL + 3 && biome !== BiomeId.Ocean && biome !== BiomeId.Desert) {
        return { x: wx + 0.5, y: height + 1.2, z: wz + 0.5 };
      }
    }
  }
  const { height } = getTerrainHeightAndBiome(0, 0, seed);
  return { x: 0.5, y: Math.max(height + 2, SEA_LEVEL + 4), z: 0.5 };
}
