import * as THREE from 'three';
import { ToolKind } from '../types/game';
import { buildVoxelGroupFromGrid, VoxelMaterialSpec } from './voxelGridBuilder';

export type MaterialTierKey = 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'netherite';

export interface TierPalette {
  main: number;
  light: number;
  dark: number;
  accent: number;
  roughness: number;
  metalness: number;
  emissive?: number;
}

export const TIER_PALETTES: Record<MaterialTierKey, TierPalette> = {
  wood: { main: 0xb8874d, light: 0xd9ac72, dark: 0x734e26, accent: 0x54381a, roughness: 0.82, metalness: 0.05 },
  stone: { main: 0x868c96, light: 0xaab1bc, dark: 0x565b63, accent: 0x42464d, roughness: 0.78, metalness: 0.1 },
  iron: { main: 0xd8dfe8, light: 0xf7fbff, dark: 0x8a94a3, accent: 0x5e6773, roughness: 0.26, metalness: 0.78 },
  gold: { main: 0xf7ca3e, light: 0xfff296, dark: 0xb57d10, accent: 0x784f07, roughness: 0.2, metalness: 0.86 },
  diamond: { main: 0x3be8e0, light: 0xabfffc, dark: 0x169aa1, accent: 0x0e5e66, roughness: 0.14, metalness: 0.36, emissive: 0x0b3d40 },
  netherite: { main: 0x54494f, light: 0x7a6c73, dark: 0x2b2428, accent: 0xb5853b, roughness: 0.3, metalness: 0.82 },
};

// 16x16 high-detail 3D voxel tool blueprints:
// W = wooden shaft, G = dark grip wrap/pommel, C = heavy socket collar / crossguard,
// D = thick spine/ridge, M = main forged body, L = thin beveled edge highlight, A = trim accent
export const TOOL_BLUEPRINTS: Record<Exclude<ToolKind, 'none'>, string[]> = {
  pickaxe: [
    '......LLLLLL....',
    '.....LMMMMMMDL..',
    '....LM..DD..DML.',
    '...LD......CCML.',
    '..LM......CWCMML',
    '.LD......CWW..ML',
    '........CWW...ML',
    '.......GWW....DL',
    '......CWW.....L.',
    '.....CWW........',
    '....GWW.........',
    '...CWW..........',
    '..GWW...........',
    '.GWW............',
    'GGW.............',
    'GG..............',
  ],
  axe: [
    '......LLLLL.....',
    '.....LMMMMMDL...',
    '....LMMMMMMCC...',
    '...LLMMMMMCCWC..',
    '...LMMMMMCCWW...',
    '....LLLLCCWW....',
    '.......GWW......',
    '......CWW.......',
    '.....CWW........',
    '....GWW.........',
    '...CWW..........',
    '..GWW...........',
    '.GWW............',
    'GGW.............',
    'GG..............',
    '................',
  ],
  shovel: [
    '..........LLLL..',
    '.........LMMMML.',
    '........LMMMMMDL',
    '........LMMMMDL.',
    '........CCMMDL..',
    '.......CWCCLL...',
    '......CWW.......',
    '.....GWW........',
    '....CWW.........',
    '...CWW..........',
    '..GWW...........',
    '.CWW............',
    'GGW.............',
    'GG..............',
    '................',
    '................',
  ],
  hoe: [
    '.....LLLLLL.....',
    '....LMMMMMMDL...',
    '....LMMDD.CCW...',
    '....LD...CCWW...',
    '........CWW.....',
    '.......GWW......',
    '......CWW.......',
    '.....CWW........',
    '....GWW.........',
    '...CWW..........',
    '..GWW...........',
    '.GWW............',
    'GGW.............',
    'GG..............',
    '................',
    '................',
  ],
  sword: [
    '.............LLL',
    '............LMML',
    '...........LMMDL',
    '..........LMMDL.',
    '.........LMMDL..',
    '........LMMDL...',
    '.......LMMDL....',
    '..CC..LMMDL.....',
    '...CCLMMDL......',
    '...CCAMDC.......',
    '....CCWC........',
    '...CWWCC........',
    '..GWW.C.........',
    '.GWW............',
    'AGW.............',
    'AA..............',
  ],
};

const DEPTH_BY_CODE: Record<string, number> = {
  W: 0.92, // sturdy octagonal-feel wooden handle
  G: 1.12, // leather/wood grip wrap rings
  C: 1.24, // reinforced collar / crossguard
  A: 1.22, // pommel & guard accent inlay
  D: 1.34, // heavy forged spine / structural ridge
  M: 1.06, // core blade body
  L: 0.68, // thin razor-beveled cutting edge
};

export function extractTierFromItemId(itemId: string): MaterialTierKey {
  if (itemId.startsWith('stone_')) return 'stone';
  if (itemId.startsWith('iron_')) return 'iron';
  if (itemId.startsWith('gold_')) return 'gold';
  if (itemId.startsWith('diamond_')) return 'diamond';
  if (itemId.startsWith('netherite_')) return 'netherite';
  return 'wood';
}

export function createToolVoxelModel(
  kind: Exclude<ToolKind, 'none'>,
  tier: MaterialTierKey,
): THREE.Group {
  const p = TIER_PALETTES[tier];
  const palette: Record<string, VoxelMaterialSpec> = {
    W: { color: 0x7a4f2b, roughness: 0.84, metalness: 0.04 },
    G: { color: 0x4d3019, roughness: 0.88, metalness: 0.06 },
    C: { color: tier === 'netherite' ? 0x9c742e : 0x5c3b20, roughness: 0.56, metalness: tier === 'netherite' ? 0.6 : 0.16 },
    A: { color: p.accent, roughness: 0.3, metalness: Math.max(0.25, p.metalness) },
    M: { color: p.main, roughness: p.roughness, metalness: p.metalness, emissive: p.emissive, emissiveIntensity: p.emissive ? 0.35 : 0 },
    L: { color: p.light, roughness: Math.max(0.08, p.roughness - 0.1), metalness: p.metalness, emissive: p.emissive, emissiveIntensity: p.emissive ? 0.45 : 0 },
    D: { color: p.dark, roughness: Math.min(0.95, p.roughness + 0.1), metalness: p.metalness },
  };
  const group = buildVoxelGroupFromGrid(TOOL_BLUEPRINTS[kind], palette, 0.031, 0.054, DEPTH_BY_CODE);
  group.name = `tool_${tier}_${kind}`;
  return group;
}
