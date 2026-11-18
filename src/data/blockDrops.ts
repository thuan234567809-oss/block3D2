import { resolveSafeDropOrigin } from '../entities/droppedItemPhysics';
import { BlockId, GameMode, ItemDef, ToolKind, ToolTier } from '../types/game';
import { BlockAccessor } from '../world/mesher';
import { BLOCKS } from './blocks';

export interface BlockDropEntry {
  itemId: string;
  count: number;
  chance?: number; // 0..1 probability; omitted or 1 means guaranteed
}

export interface BlockDropRule {
  drops: BlockDropEntry[];
  requiredTool?: ToolKind;
  minTier?: ToolTier;
  silkTouchItemId?: string;
}

export interface ResolvedDropItem {
  itemId: string;
  count: number;
}

export interface ResolveBlockDropOptions {
  gameMode?: GameMode;
  silkTouch?: boolean;
  rng?: () => number;
}

export const BLOCK_DROP_TABLE: Partial<Record<BlockId, BlockDropRule>> = {
  [BlockId.Air]: { drops: [] },
  [BlockId.Water]: { drops: [] },
  [BlockId.Bedrock]: { drops: [] },

  // Soil & Surface Terrain
  [BlockId.Grass]: { drops: [{ itemId: 'dirt', count: 1 }], silkTouchItemId: 'grass' },
  [BlockId.SwampGrass]: { drops: [{ itemId: 'dirt', count: 1 }], silkTouchItemId: 'grass' },
  [BlockId.SnowGrass]: { drops: [{ itemId: 'dirt', count: 1 }], silkTouchItemId: 'grass' },
  [BlockId.Dirt]: { drops: [{ itemId: 'dirt', count: 1 }] },
  [BlockId.Sand]: { drops: [{ itemId: 'sand', count: 1 }] },
  [BlockId.Gravel]: { drops: [{ itemId: 'gravel', count: 1 }] },
  [BlockId.Clay]: { drops: [{ itemId: 'clay', count: 1 }] },
  [BlockId.Mud]: { drops: [{ itemId: 'mud', count: 1 }] },
  [BlockId.Snow]: { drops: [{ itemId: 'snow', count: 1 }] },
  [BlockId.Ice]: { drops: [{ itemId: 'ice', count: 1 }], silkTouchItemId: 'ice' },

  // Stone, Masonry & Ores (require Pickaxe of matching tier)
  [BlockId.Stone]: {
    drops: [{ itemId: 'cobblestone', count: 1 }],
    requiredTool: 'pickaxe',
    minTier: 1,
    silkTouchItemId: 'stone',
  },
  [BlockId.Cobblestone]: { drops: [{ itemId: 'cobblestone', count: 1 }], requiredTool: 'pickaxe', minTier: 1 },
  [BlockId.Sandstone]: { drops: [{ itemId: 'sandstone', count: 1 }], requiredTool: 'pickaxe', minTier: 1 },
  [BlockId.Brick]: { drops: [{ itemId: 'brick', count: 1 }], requiredTool: 'pickaxe', minTier: 1 },
  [BlockId.WhiteConcrete]: { drops: [{ itemId: 'white_concrete', count: 1 }], requiredTool: 'pickaxe', minTier: 1 },
  [BlockId.Terracotta]: { drops: [{ itemId: 'terracotta', count: 1 }], requiredTool: 'pickaxe', minTier: 1 },
  [BlockId.Furnace]: { drops: [{ itemId: 'furnace', count: 1 }], requiredTool: 'pickaxe', minTier: 1 },
  [BlockId.Anvil]: { drops: [{ itemId: 'anvil', count: 1 }], requiredTool: 'pickaxe', minTier: 1 },

  [BlockId.CoalOre]: { drops: [{ itemId: 'coal', count: 1 }], requiredTool: 'pickaxe', minTier: 1 },
  [BlockId.CopperOre]: { drops: [{ itemId: 'copper_ore', count: 1 }], requiredTool: 'pickaxe', minTier: 1 },
  [BlockId.IronOre]: { drops: [{ itemId: 'iron_ore', count: 1 }], requiredTool: 'pickaxe', minTier: 2 },
  [BlockId.GoldOre]: { drops: [{ itemId: 'gold_ore', count: 1 }], requiredTool: 'pickaxe', minTier: 3 },
  [BlockId.DiamondOre]: { drops: [{ itemId: 'diamond', count: 1 }], requiredTool: 'pickaxe', minTier: 3 },
  [BlockId.EmeraldOre]: { drops: [{ itemId: 'emerald', count: 1 }], requiredTool: 'pickaxe', minTier: 3 },

  // Wood Logs & Planks
  [BlockId.OakLog]: { drops: [{ itemId: 'oak_log', count: 1 }] },
  [BlockId.PineLog]: { drops: [{ itemId: 'spruce_log', count: 1 }] },
  [BlockId.JungleLog]: { drops: [{ itemId: 'jungle_log', count: 1 }] },
  [BlockId.BirchLog]: { drops: [{ itemId: 'birch_log', count: 1 }] },
  [BlockId.AcaciaLog]: { drops: [{ itemId: 'acacia_log', count: 1 }] },
  [BlockId.DarkOakLog]: { drops: [{ itemId: 'dark_oak_log', count: 1 }] },
  [BlockId.OakPlanks]: { drops: [{ itemId: 'oak_planks', count: 1 }] },
  [BlockId.BirchPlanks]: { drops: [{ itemId: 'birch_planks', count: 1 }] },
  [BlockId.SprucePlanks]: { drops: [{ itemId: 'spruce_planks', count: 1 }] },
  [BlockId.JunglePlanks]: { drops: [{ itemId: 'jungle_planks', count: 1 }] },
  [BlockId.AcaciaPlanks]: { drops: [{ itemId: 'acacia_planks', count: 1 }] },
  [BlockId.DarkOakPlanks]: { drops: [{ itemId: 'dark_oak_planks', count: 1 }] },

  // Leaves & Flora
  [BlockId.OakLeaves]: {
    drops: [
      { itemId: 'oak_sapling', count: 1, chance: 0.35 },
      { itemId: 'apple', count: 1, chance: 0.2 },
    ],
    silkTouchItemId: 'oak_leaves',
  },
  [BlockId.PineLeaves]: { drops: [{ itemId: 'spruce_sapling', count: 1, chance: 0.4 }], silkTouchItemId: 'oak_leaves' },
  [BlockId.BirchLeaves]: { drops: [{ itemId: 'birch_sapling', count: 1, chance: 0.4 }], silkTouchItemId: 'oak_leaves' },
  [BlockId.JungleLeaves]: {
    drops: [
      { itemId: 'oak_sapling', count: 1, chance: 0.3 },
      { itemId: 'apple', count: 1, chance: 0.2 },
    ],
    silkTouchItemId: 'oak_leaves',
  },
  [BlockId.AcaciaLeaves]: { drops: [{ itemId: 'oak_sapling', count: 1, chance: 0.35 }], silkTouchItemId: 'oak_leaves' },
  [BlockId.DarkOakLeaves]: {
    drops: [
      { itemId: 'oak_sapling', count: 1, chance: 0.35 },
      { itemId: 'apple', count: 1, chance: 0.25 },
    ],
    silkTouchItemId: 'oak_leaves',
  },
  [BlockId.TallGrass]: { drops: [{ itemId: 'wheat_seeds', count: 1 }] },
  [BlockId.Shrub]: { drops: [{ itemId: 'stick', count: 1 }] },

  // Glass & Functional / Decor Blocks
  [BlockId.Glass]: { drops: [{ itemId: 'glass', count: 1 }], silkTouchItemId: 'glass' },
};

export function isToolCompatibleWithBlock(blockId: BlockId, toolDef?: ItemDef): boolean {
  const rule = BLOCK_DROP_TABLE[blockId];
  const def = BLOCKS[blockId];
  const requiredTool = rule?.requiredTool ?? (def && def.minTier > 0 ? def.preferredTool : undefined);
  const minTier = rule?.minTier ?? def?.minTier ?? 0;

  if (minTier === 0) return true;
  const heldTier = toolDef?.toolTier ?? 0;
  if (heldTier < minTier) return false;
  if (requiredTool && requiredTool !== 'none') {
    return toolDef?.toolKind === requiredTool;
  }
  return true;
}

export function resolveBlockDrops(
  blockId: BlockId,
  toolDef?: ItemDef,
  opts: ResolveBlockDropOptions = {},
): ResolvedDropItem[] {
  const gameMode = opts.gameMode ?? 'survival';
  if (gameMode === 'creative') return [];

  if (!isToolCompatibleWithBlock(blockId, toolDef)) {
    return [];
  }

  const rule = BLOCK_DROP_TABLE[blockId];
  const def = BLOCKS[blockId];
  const rng = opts.rng ?? Math.random;

  if (opts.silkTouch && rule?.silkTouchItemId) {
    return [{ itemId: rule.silkTouchItemId, count: 1 }];
  }

  if (rule) {
    const out: ResolvedDropItem[] = [];
    for (const entry of rule.drops) {
      if (entry.count <= 0) continue;
      if (entry.chance === undefined || entry.chance >= 1 || rng() < entry.chance) {
        out.push({ itemId: entry.itemId, count: entry.count });
      }
    }
    return out;
  }

  if (def?.dropItemId) {
    return [{ itemId: def.dropItemId, count: def.dropCount ?? 1 }];
  }
  return [];
}

/**
 * Computes a valid 3D world spawn position for a broken block's Item Entity.
 * Must be anchored at the broken block's coordinates (never player spawn/camera/surface height)
 * and safely offset clear of remaining solid neighbors.
 */
export function resolveBlockBreakDropPosition(
  bx: number,
  by: number,
  bz: number,
  getCollisionBlock: BlockAccessor,
): { x: number; y: number; z: number } {
  const cx = bx + 0.5;
  const cy = by + 0.45;
  const cz = bz + 0.5;
  return resolveSafeDropOrigin(cx, cy, cz, 0, 1, 0, 0.08, getCollisionBlock);
}
