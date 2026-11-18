import { ITEMS } from './items';
import { ItemDef } from '../types/game';

export type CreativeCategoryId =
  | 'building_blocks'
  | 'natural_blocks'
  | 'ores_minerals'
  | 'tools'
  | 'weapons'
  | 'food'
  | 'materials'
  | 'decoration'
  | 'functional_blocks'
  | 'miscellaneous';

export interface CreativeCategoryTab {
  id: CreativeCategoryId;
  label: string;
}

export const CREATIVE_CATEGORIES: CreativeCategoryTab[] = [
  { id: 'building_blocks', label: 'Building Blocks' },
  { id: 'natural_blocks', label: 'Natural Blocks' },
  { id: 'ores_minerals', label: 'Ores & Minerals' },
  { id: 'tools', label: 'Tools' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'food', label: 'Food' },
  { id: 'materials', label: 'Materials' },
  { id: 'decoration', label: 'Decoration' },
  { id: 'functional_blocks', label: 'Functional Blocks' },
  { id: 'miscellaneous', label: 'Miscellaneous' },
];

const BUILDING_IDS = new Set([
  'oak_planks',
  'birch_planks',
  'spruce_planks',
  'jungle_planks',
  'acacia_planks',
  'dark_oak_planks',
  'cobblestone',
  'stone',
  'sandstone',
  'brick',
  'glass',
  'wool',
  'white_concrete',
  'terracotta',
]);

const NATURAL_IDS = new Set([
  'grass',
  'dirt',
  'sand',
  'gravel',
  'mud',
  'clay',
  'snow',
  'ice',
  'oak_log',
  'birch_log',
  'spruce_log',
  'jungle_log',
  'acacia_log',
  'dark_oak_log',
  'oak_leaves',
  'cactus',
  'oak_sapling',
  'birch_sapling',
  'spruce_sapling',
]);

const ORES_MINERALS_IDS = new Set([
  'coal',
  'charcoal',
  'copper_ore',
  'copper_ingot',
  'iron_ore',
  'iron_ingot',
  'gold_ore',
  'gold_ingot',
  'diamond',
  'emerald',
  'netherite_ingot',
]);

const DECORATION_IDS = new Set([
  'torch',
  'flower_red',
  'flower_yellow',
  'reed',
]);

const FUNCTIONAL_IDS = new Set([
  'crafting_table',
  'furnace',
  'chest',
  'barrel',
  'oak_door',
  'bed',
  'anvil',
]);

const MATERIAL_IDS = new Set([
  'stick',
  'wheat',
  'wheat_seeds',
  'leather',
  'feather',
  'string',
  'bone',
  'gunpowder',
]);

const MISC_IDS = new Set([
  'bucket',
  'water_bucket',
]);

export function classifyCreativeItem(def: ItemDef): CreativeCategoryId {
  if (BUILDING_IDS.has(def.id)) return 'building_blocks';
  if (NATURAL_IDS.has(def.id)) return 'natural_blocks';
  if (ORES_MINERALS_IDS.has(def.id)) return 'ores_minerals';
  if (DECORATION_IDS.has(def.id)) return 'decoration';
  if (FUNCTIONAL_IDS.has(def.id)) return 'functional_blocks';
  if (MATERIAL_IDS.has(def.id)) return 'materials';
  if (MISC_IDS.has(def.id)) return 'miscellaneous';
  if (def.category === 'food') return 'food';
  if (def.category === 'tool') {
    return def.toolKind === 'sword' ? 'weapons' : 'tools';
  }
  if (def.category === 'armor') return 'miscellaneous';
  if (def.category === 'material') return 'materials';
  return 'building_blocks';
}

export function getCreativeCatalogByCategory(): Record<CreativeCategoryId, ItemDef[]> {
  const map: Record<CreativeCategoryId, ItemDef[]> = {
    building_blocks: [],
    natural_blocks: [],
    ores_minerals: [],
    tools: [],
    weapons: [],
    food: [],
    materials: [],
    decoration: [],
    functional_blocks: [],
    miscellaneous: [],
  };
  for (const def of Object.values(ITEMS)) {
    map[classifyCreativeItem(def)].push(def);
  }
  return map;
}

export function filterCreativeItems(
  category: CreativeCategoryId,
  searchQuery: string,
): ItemDef[] {
  const q = searchQuery.trim().toLowerCase();
  if (q.length > 0) {
    return Object.values(ITEMS).filter(
      (def) => def.name.toLowerCase().includes(q) || def.id.toLowerCase().includes(q),
    );
  }
  return getCreativeCatalogByCategory()[category];
}
