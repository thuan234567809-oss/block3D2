import { BlockId, ToolKind, ToolTier } from '../types/game';
import { TEX } from './blockTextures';

export { TEX };

export interface BlockFaceTextures {
  top: number;
  bottom: number;
  side: number;
  north: number;
  south: number;
  east: number;
  west: number;
  front?: number;
  back?: number;
}

export type BlockTextureSpec =
  | number
  | {
      top: number;
      bottom: number;
      side?: number;
      north?: number;
      south?: number;
      east?: number;
      west?: number;
      front?: number;
      back?: number;
    };

export interface BlockDef {
  id: BlockId;
  name: string;
  solid: boolean;
  opaque: boolean;
  transparent: boolean;
  fluid: boolean;
  plant?: boolean;
  hardness: number;
  preferredTool: ToolKind;
  minTier: ToolTier;
  dropItemId: string | null;
  dropCount?: number;
  lightLevel?: number;
  functional?: boolean;
  interactHint?: string;
  textures: BlockFaceTextures;
}

function normalizeTextures(tex: BlockTextureSpec): BlockFaceTextures {
  if (typeof tex === 'number') {
    return { top: tex, bottom: tex, side: tex, north: tex, south: tex, east: tex, west: tex };
  }
  const side = tex.side ?? tex.north ?? tex.front ?? tex.top;
  return {
    top: tex.top,
    bottom: tex.bottom,
    side,
    north: tex.north ?? tex.back ?? side,
    south: tex.south ?? tex.front ?? side,
    east: tex.east ?? side,
    west: tex.west ?? side,
    front: tex.front,
    back: tex.back,
  };
}

const b = (
  id: BlockId,
  name: string,
  tex: BlockTextureSpec,
  hardness: number,
  preferredTool: ToolKind,
  minTier: ToolTier,
  dropItemId: string | null,
  opts: Partial<BlockDef> = {},
): BlockDef => ({
  id,
  name,
  solid: opts.solid ?? true,
  opaque: opts.opaque ?? true,
  transparent: opts.transparent ?? false,
  fluid: opts.fluid ?? false,
  plant: opts.plant,
  hardness,
  preferredTool,
  minTier,
  dropItemId,
  dropCount: opts.dropCount,
  lightLevel: opts.lightLevel,
  functional: opts.functional,
  interactHint: opts.interactHint,
  textures: normalizeTextures(tex),
});

export const BLOCKS: Record<BlockId, BlockDef> = {
  [BlockId.Air]: b(BlockId.Air, 'Air', 0, 0, 'none', 0, null, { solid: false, opaque: false, transparent: true }),
  [BlockId.Grass]: b(BlockId.Grass, 'Grass Block', { top: TEX.GRASS_TOP, bottom: TEX.DIRT, side: TEX.GRASS_SIDE }, 0.7, 'shovel', 0, 'dirt'),
  [BlockId.Dirt]: b(BlockId.Dirt, 'Dirt', TEX.DIRT, 0.6, 'shovel', 0, 'dirt'),
  [BlockId.Stone]: b(BlockId.Stone, 'Stone', TEX.STONE, 2.2, 'pickaxe', 1, 'cobblestone'),
  [BlockId.Cobblestone]: b(BlockId.Cobblestone, 'Cobblestone', TEX.COBBLESTONE, 2.5, 'pickaxe', 1, 'cobblestone'),
  [BlockId.Sand]: b(BlockId.Sand, 'Sand', TEX.SAND, 0.55, 'shovel', 0, 'sand'),
  [BlockId.Sandstone]: b(BlockId.Sandstone, 'Sandstone', { top: TEX.SANDSTONE_TOP, bottom: TEX.SAND, side: TEX.SANDSTONE_SIDE }, 1.5, 'pickaxe', 1, 'sandstone'),
  [BlockId.OakLog]: b(BlockId.OakLog, 'Oak Wood', { top: TEX.OAK_LOG_TOP, bottom: TEX.OAK_LOG_TOP, side: TEX.OAK_LOG_SIDE }, 1.5, 'axe', 0, 'oak_log'),
  [BlockId.OakLeaves]: b(BlockId.OakLeaves, 'Oak Leaves', TEX.OAK_LEAVES, 0.3, 'none', 0, 'apple', { opaque: false, transparent: true, dropCount: 1 }),
  [BlockId.OakPlanks]: b(BlockId.OakPlanks, 'Wood Planks', TEX.OAK_PLANKS, 1.4, 'axe', 0, 'oak_planks'),
  [BlockId.PineLog]: b(BlockId.PineLog, 'Spruce Wood', { top: TEX.PINE_LOG_TOP, bottom: TEX.PINE_LOG_TOP, side: TEX.PINE_LOG_SIDE }, 1.5, 'axe', 0, 'spruce_log'),
  [BlockId.PineLeaves]: b(BlockId.PineLeaves, 'Spruce Leaves', TEX.PINE_LEAVES, 0.3, 'none', 0, 'spruce_sapling', { opaque: false, transparent: true }),
  [BlockId.JungleLog]: b(BlockId.JungleLog, 'Jungle Wood', { top: TEX.JUNGLE_LOG_TOP, bottom: TEX.JUNGLE_LOG_TOP, side: TEX.JUNGLE_LOG_SIDE }, 1.5, 'axe', 0, 'jungle_log'),
  [BlockId.JungleLeaves]: b(BlockId.JungleLeaves, 'Jungle Leaves', TEX.JUNGLE_LEAVES, 0.3, 'none', 0, 'apple', { opaque: false, transparent: true }),
  [BlockId.Water]: b(BlockId.Water, 'Water', TEX.WATER, -1, 'none', 0, null, { solid: false, opaque: false, transparent: true, fluid: true }),
  [BlockId.Glass]: b(BlockId.Glass, 'Glass', TEX.GLASS, 0.45, 'none', 0, 'glass', { opaque: false, transparent: true }),
  [BlockId.CoalOre]: b(BlockId.CoalOre, 'Coal Ore', TEX.COAL_ORE, 2.6, 'pickaxe', 1, 'coal'),
  [BlockId.IronOre]: b(BlockId.IronOre, 'Iron Ore', TEX.IRON_ORE, 3.2, 'pickaxe', 2, 'iron_ore'),
  [BlockId.GoldOre]: b(BlockId.GoldOre, 'Gold Ore', TEX.GOLD_ORE, 3.5, 'pickaxe', 3, 'gold_ore'),
  [BlockId.DiamondOre]: b(BlockId.DiamondOre, 'Diamond Ore', TEX.DIAMOND_ORE, 4.2, 'pickaxe', 3, 'diamond'),
  [BlockId.Bedrock]: b(BlockId.Bedrock, 'Bedrock', TEX.BEDROCK, -1, 'none', 0, null),
  [BlockId.Snow]: b(BlockId.Snow, 'Snow Block', TEX.SNOW, 0.45, 'shovel', 0, 'snow'),
  [BlockId.Ice]: b(BlockId.Ice, 'Ice', TEX.ICE, 0.65, 'pickaxe', 0, 'ice', { opaque: false, transparent: true }),
  [BlockId.Cactus]: b(BlockId.Cactus, 'Cactus', { top: TEX.CACTUS_TOP, bottom: TEX.CACTUS_TOP, side: TEX.CACTUS_SIDE }, 0.5, 'none', 0, 'cactus'),
  [BlockId.CraftingTable]: b(BlockId.CraftingTable, 'Crafting Table', { top: TEX.CRAFTING_TOP, bottom: TEX.OAK_PLANKS, front: TEX.CRAFTING_FRONT, side: TEX.CRAFTING_SIDE, back: TEX.OAK_PLANKS }, 1.5, 'axe', 0, 'crafting_table', { functional: true, interactHint: 'Right-Click: Craft (3×3)' }),
  [BlockId.Furnace]: b(BlockId.Furnace, 'Furnace', { top: TEX.FURNACE_TOP, bottom: TEX.FURNACE_TOP, front: TEX.FURNACE_FRONT, side: TEX.FURNACE_SIDE, back: TEX.FURNACE_BACK }, 2.5, 'pickaxe', 1, 'furnace', { functional: true, interactHint: 'Right-Click: Smelt & Cook' }),
  [BlockId.Torch]: b(BlockId.Torch, 'Torch', TEX.TORCH, 0.15, 'none', 0, 'torch', { solid: false, opaque: false, transparent: true, plant: true, lightLevel: 14 }),
  [BlockId.Brick]: b(BlockId.Brick, 'Bricks', TEX.BRICK, 2.4, 'pickaxe', 1, 'brick'),
  [BlockId.Clay]: b(BlockId.Clay, 'Clay', TEX.CLAY, 0.65, 'shovel', 0, 'clay'),
  [BlockId.SwampGrass]: b(BlockId.SwampGrass, 'Swamp Grass', { top: TEX.SWAMP_GRASS_TOP, bottom: TEX.DIRT, side: TEX.SWAMP_GRASS_SIDE }, 0.7, 'shovel', 0, 'dirt'),
  [BlockId.SnowGrass]: b(BlockId.SnowGrass, 'Snowy Grass', { top: TEX.SNOW, bottom: TEX.DIRT, side: TEX.SNOW_GRASS_SIDE }, 0.7, 'shovel', 0, 'dirt'),
  [BlockId.TallGrass]: b(BlockId.TallGrass, 'Tall Grass', TEX.TALL_GRASS, 0.1, 'none', 0, 'wheat_seeds', { solid: false, opaque: false, transparent: true, plant: true }),
  [BlockId.FlowerRed]: b(BlockId.FlowerRed, 'Poppy', TEX.FLOWER_RED, 0.1, 'none', 0, 'flower_red', { solid: false, opaque: false, transparent: true, plant: true }),
  [BlockId.FlowerYellow]: b(BlockId.FlowerYellow, 'Dandelion', TEX.FLOWER_YELLOW, 0.1, 'none', 0, 'flower_yellow', { solid: false, opaque: false, transparent: true, plant: true }),
  [BlockId.Reed]: b(BlockId.Reed, 'Sugar Cane', TEX.REED, 0.15, 'none', 0, 'reed', { solid: false, opaque: false, transparent: true, plant: true }),
  [BlockId.Wool]: b(BlockId.Wool, 'White Wool', TEX.WOOL, 0.7, 'none', 0, 'wool'),
  [BlockId.Chest]: b(BlockId.Chest, 'Chest', { top: TEX.CHEST_TOP, bottom: TEX.OAK_PLANKS, front: TEX.CHEST_FRONT, side: TEX.CHEST_SIDE, back: TEX.CHEST_SIDE }, 1.6, 'axe', 0, 'chest', { opaque: false, functional: true, interactHint: 'Right-Click: Open Chest' }),
  [BlockId.Barrel]: b(BlockId.Barrel, 'Barrel', { top: TEX.BARREL_TOP, bottom: TEX.BARREL_BOTTOM, side: TEX.BARREL_SIDE }, 1.6, 'axe', 0, 'barrel', { functional: true, interactHint: 'Right-Click: Open Barrel' }),
  [BlockId.OakDoor]: b(BlockId.OakDoor, 'Oak Door', TEX.DOOR_WOOD, 1.5, 'axe', 0, 'oak_door', { opaque: false, transparent: true, functional: true, interactHint: 'Right-Click: Open / Close' }),
  [BlockId.Bed]: b(BlockId.Bed, 'Bed', { top: TEX.BED_BLANKET, bottom: TEX.BED_WOOD, front: TEX.BED_WOOD, side: TEX.BED_SIDE }, 0.8, 'axe', 0, 'bed', { opaque: false, functional: true, interactHint: 'Right-Click: Sleep / Set Spawn' }),
  [BlockId.Anvil]: b(BlockId.Anvil, 'Anvil', { top: TEX.ANVIL_TOP, bottom: TEX.ANVIL_TOP, side: TEX.ANVIL_SIDE }, 3.2, 'pickaxe', 1, 'anvil', { opaque: false, functional: true, interactHint: 'Right-Click: Repair & Combine' }),
  [BlockId.Gravel]: b(BlockId.Gravel, 'Gravel', TEX.GRAVEL, 0.75, 'shovel', 0, 'gravel'),
  [BlockId.Mud]: b(BlockId.Mud, 'Mud', TEX.MUD, 0.65, 'shovel', 0, 'mud'),
  [BlockId.BirchLog]: b(BlockId.BirchLog, 'Birch Wood', { top: TEX.BIRCH_LOG_TOP, bottom: TEX.BIRCH_LOG_TOP, side: TEX.BIRCH_LOG_SIDE }, 1.5, 'axe', 0, 'birch_log'),
  [BlockId.BirchLeaves]: b(BlockId.BirchLeaves, 'Birch Leaves', TEX.BIRCH_LEAVES, 0.3, 'none', 0, 'birch_sapling', { opaque: false, transparent: true }),
  [BlockId.AcaciaLog]: b(BlockId.AcaciaLog, 'Acacia Wood', { top: TEX.ACACIA_LOG_TOP, bottom: TEX.ACACIA_LOG_TOP, side: TEX.ACACIA_LOG_SIDE }, 1.5, 'axe', 0, 'acacia_log'),
  [BlockId.AcaciaLeaves]: b(BlockId.AcaciaLeaves, 'Acacia Leaves', TEX.ACACIA_LEAVES, 0.3, 'none', 0, 'oak_sapling', { opaque: false, transparent: true }),
  [BlockId.DarkOakLog]: b(BlockId.DarkOakLog, 'Dark Oak Wood', { top: TEX.DARK_OAK_LOG_TOP, bottom: TEX.DARK_OAK_LOG_TOP, side: TEX.DARK_OAK_LOG_SIDE }, 1.6, 'axe', 0, 'dark_oak_log'),
  [BlockId.DarkOakLeaves]: b(BlockId.DarkOakLeaves, 'Dark Oak Leaves', TEX.DARK_OAK_LEAVES, 0.3, 'none', 0, 'apple', { opaque: false, transparent: true }),
  [BlockId.CopperOre]: b(BlockId.CopperOre, 'Copper Ore', TEX.COPPER_ORE, 2.8, 'pickaxe', 1, 'copper_ore'),
  [BlockId.EmeraldOre]: b(BlockId.EmeraldOre, 'Emerald Ore', TEX.EMERALD_ORE, 4.0, 'pickaxe', 3, 'emerald'),
  [BlockId.WhiteConcrete]: b(BlockId.WhiteConcrete, 'White Concrete', TEX.WHITE_CONCRETE, 2.0, 'pickaxe', 1, 'white_concrete'),
  [BlockId.Terracotta]: b(BlockId.Terracotta, 'Terracotta', TEX.TERRACOTTA, 1.8, 'pickaxe', 1, 'terracotta'),
  [BlockId.BirchPlanks]: b(BlockId.BirchPlanks, 'Birch Planks', TEX.BIRCH_PLANKS, 1.4, 'axe', 0, 'birch_planks'),
  [BlockId.SprucePlanks]: b(BlockId.SprucePlanks, 'Spruce Planks', TEX.SPRUCE_PLANKS, 1.4, 'axe', 0, 'spruce_planks'),
  [BlockId.JunglePlanks]: b(BlockId.JunglePlanks, 'Jungle Planks', TEX.JUNGLE_PLANKS, 1.4, 'axe', 0, 'jungle_planks'),
  [BlockId.AcaciaPlanks]: b(BlockId.AcaciaPlanks, 'Acacia Planks', TEX.ACACIA_PLANKS, 1.4, 'axe', 0, 'acacia_planks'),
  [BlockId.DarkOakPlanks]: b(BlockId.DarkOakPlanks, 'Dark Oak Planks', TEX.DARK_OAK_PLANKS, 1.4, 'axe', 0, 'dark_oak_planks'),
  [BlockId.OakSapling]: b(BlockId.OakSapling, 'Oak Sapling', TEX.OAK_SAPLING, 0.1, 'none', 0, 'oak_sapling', { solid: false, opaque: false, transparent: true, plant: true }),
  [BlockId.BirchSapling]: b(BlockId.BirchSapling, 'Birch Sapling', TEX.BIRCH_SAPLING, 0.1, 'none', 0, 'birch_sapling', { solid: false, opaque: false, transparent: true, plant: true }),
  [BlockId.SpruceSapling]: b(BlockId.SpruceSapling, 'Spruce Sapling', TEX.SPRUCE_SAPLING, 0.1, 'none', 0, 'spruce_sapling', { solid: false, opaque: false, transparent: true, plant: true }),
  [BlockId.Shrub]: b(BlockId.Shrub, 'Wild Shrub', TEX.SHRUB, 0.1, 'none', 0, 'stick', { solid: false, opaque: false, transparent: true, plant: true }),
};

export function isBlockSolid(id: BlockId): boolean {
  return BLOCKS[id]?.solid ?? false;
}

export function isBlockOpaque(id: BlockId): boolean {
  return BLOCKS[id]?.opaque ?? false;
}

export function isBlockFluid(id: BlockId): boolean {
  return BLOCKS[id]?.fluid ?? false;
}
