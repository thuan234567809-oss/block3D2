import { BiomeId, BlockId } from '../types/game';
import { fbm2D } from './noise';

export interface BiomeConfig {
  id: BiomeId;
  name: string;
  baseHeight: number;
  heightAmplitude: number;
  topBlock: BlockId;
  subBlock: BlockId;
  treeDensity: number;
  grassDensity: number;
  flowerDensity: number;
  skyTint: string;
  fogColor: string;
  canSnow: boolean;
}

export const BIOMES: Record<BiomeId, BiomeConfig> = {
  [BiomeId.Plains]: {
    id: BiomeId.Plains,
    name: 'Plains',
    baseHeight: 40,
    heightAmplitude: 5,
    topBlock: BlockId.Grass,
    subBlock: BlockId.Dirt,
    treeDensity: 0.004,
    grassDensity: 0.065,
    flowerDensity: 0.025,
    skyTint: '#78b8ff',
    fogColor: '#b7daf7',
    canSnow: false,
  },
  [BiomeId.Forest]: {
    id: BiomeId.Forest,
    name: 'Forest',
    baseHeight: 42,
    heightAmplitude: 8,
    topBlock: BlockId.Grass,
    subBlock: BlockId.Dirt,
    treeDensity: 0.035,
    grassDensity: 0.045,
    flowerDensity: 0.018,
    skyTint: '#72b0f2',
    fogColor: '#add2eb',
    canSnow: false,
  },
  [BiomeId.Desert]: {
    id: BiomeId.Desert,
    name: 'Desert',
    baseHeight: 39,
    heightAmplitude: 6,
    topBlock: BlockId.Sand,
    subBlock: BlockId.Sandstone,
    treeDensity: 0.008, // cacti
    grassDensity: 0,
    flowerDensity: 0,
    skyTint: '#9bc9f5',
    fogColor: '#dfd1b0',
    canSnow: false,
  },
  [BiomeId.Snow]: {
    id: BiomeId.Snow,
    name: 'Snow Tundra',
    baseHeight: 41,
    heightAmplitude: 7,
    topBlock: BlockId.SnowGrass,
    subBlock: BlockId.Dirt,
    treeDensity: 0.018,
    grassDensity: 0,
    flowerDensity: 0,
    skyTint: '#9cc4e8',
    fogColor: '#d7e6f2',
    canSnow: true,
  },
  [BiomeId.Jungle]: {
    id: BiomeId.Jungle,
    name: 'Jungle',
    baseHeight: 43,
    heightAmplitude: 10,
    topBlock: BlockId.Grass,
    subBlock: BlockId.Dirt,
    treeDensity: 0.055,
    grassDensity: 0.09,
    flowerDensity: 0.028,
    skyTint: '#6bb8eb',
    fogColor: '#a6d9c9',
    canSnow: false,
  },
  [BiomeId.Mountains]: {
    id: BiomeId.Mountains,
    name: 'Mountains',
    baseHeight: 52,
    heightAmplitude: 22,
    topBlock: BlockId.Grass,
    subBlock: BlockId.Stone,
    treeDensity: 0.008,
    grassDensity: 0.02,
    flowerDensity: 0.008,
    skyTint: '#80b6eb',
    fogColor: '#c3d6eb',
    canSnow: true,
  },
  [BiomeId.Ocean]: {
    id: BiomeId.Ocean,
    name: 'Ocean',
    baseHeight: 26,
    heightAmplitude: 5,
    topBlock: BlockId.Sand,
    subBlock: BlockId.Clay,
    treeDensity: 0,
    grassDensity: 0,
    flowerDensity: 0,
    skyTint: '#6faee8',
    fogColor: '#a7cde8',
    canSnow: false,
  },
  [BiomeId.Swamp]: {
    id: BiomeId.Swamp,
    name: 'Swamp',
    baseHeight: 35,
    heightAmplitude: 3,
    topBlock: BlockId.SwampGrass,
    subBlock: BlockId.Clay,
    treeDensity: 0.022,
    grassDensity: 0.055,
    flowerDensity: 0.012,
    skyTint: '#789c94',
    fogColor: '#9eb5ad',
    canSnow: false,
  },
};

export function sampleBiome(wx: number, wz: number, seed: number): BiomeId {
  // Keep origin (0,0) in a welcoming Plains/Forest border so initial spawn is open & scenic
  const distFromOrigin = Math.hypot(wx, wz);
  const scale = 0.0045;
  const cont = fbm2D(wx * scale * 0.8 + 13.7, wz * scale * 0.8 - 7.3, seed + 101, 3);
  const temp = fbm2D(wx * scale + 51.2, wz * scale + 19.4, seed + 202, 3);
  const humid = fbm2D(wx * scale - 33.1, wz * scale + 88.9, seed + 303, 3);

  // Near spawn, bias gently away from deep ocean so player starts on dry land
  const oceanBias = distFromOrigin < 48 ? 0.28 : 0;
  if (cont + oceanBias < -0.22) return BiomeId.Ocean;
  if (cont > 0.28) return BiomeId.Mountains;
  if (temp < -0.22) return BiomeId.Snow;
  if (temp > 0.22 && humid < -0.08) return BiomeId.Desert;
  if (temp > 0.14 && humid > 0.18) return BiomeId.Jungle;
  if (humid > 0.22 && cont < 0.05) return BiomeId.Swamp;
  if (humid > -0.02) return BiomeId.Forest;
  return BiomeId.Plains;
}
