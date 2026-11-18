import { CraftingRecipe } from '../types/game';
import { TOOL_AND_ARMOR_RECIPES } from './toolRecipes';

export const RECIPES: CraftingRecipe[] = [
  // Basic Wood Processing (2x2)
  {
    id: 'oak_planks',
    resultItemId: 'oak_planks',
    resultCount: 4,
    requiresTable: false,
    ingredients: [{ itemId: 'oak_log', count: 1 }],
  },
  {
    id: 'birch_planks',
    resultItemId: 'birch_planks',
    resultCount: 4,
    requiresTable: false,
    ingredients: [{ itemId: 'birch_log', count: 1 }],
  },
  {
    id: 'spruce_planks',
    resultItemId: 'spruce_planks',
    resultCount: 4,
    requiresTable: false,
    ingredients: [{ itemId: 'spruce_log', count: 1 }],
  },
  {
    id: 'jungle_planks',
    resultItemId: 'jungle_planks',
    resultCount: 4,
    requiresTable: false,
    ingredients: [{ itemId: 'jungle_log', count: 1 }],
  },
  {
    id: 'acacia_planks',
    resultItemId: 'acacia_planks',
    resultCount: 4,
    requiresTable: false,
    ingredients: [{ itemId: 'acacia_log', count: 1 }],
  },
  {
    id: 'dark_oak_planks',
    resultItemId: 'dark_oak_planks',
    resultCount: 4,
    requiresTable: false,
    ingredients: [{ itemId: 'dark_oak_log', count: 1 }],
  },
  {
    id: 'stick',
    resultItemId: 'stick',
    resultCount: 4,
    requiresTable: false,
    pattern: ['P', 'P'],
    key: { P: 'oak_planks' },
  },
  {
    id: 'crafting_table',
    resultItemId: 'crafting_table',
    resultCount: 1,
    requiresTable: false,
    pattern: ['PP', 'PP'],
    key: { P: 'oak_planks' },
  },
  {
    id: 'torch',
    resultItemId: 'torch',
    resultCount: 4,
    requiresTable: false,
    pattern: ['C', 'S'],
    key: { C: 'coal', S: 'stick' },
  },
  {
    id: 'sandstone',
    resultItemId: 'sandstone',
    resultCount: 1,
    requiresTable: false,
    pattern: ['SS', 'SS'],
    key: { S: 'sand' },
  },
  {
    id: 'brick',
    resultItemId: 'brick',
    resultCount: 2,
    requiresTable: false,
    pattern: ['CC', 'CC'],
    key: { C: 'clay' },
  },

  // 3x3 Utility Blocks
  {
    id: 'furnace',
    resultItemId: 'furnace',
    resultCount: 1,
    requiresTable: true,
    pattern: ['CCC', 'C C', 'CCC'],
    key: { C: 'cobblestone' },
  },
  {
    id: 'chest',
    resultItemId: 'chest',
    resultCount: 1,
    requiresTable: true,
    pattern: ['PPP', 'P P', 'PPP'],
    key: { P: 'oak_planks' },
  },
  {
    id: 'barrel',
    resultItemId: 'barrel',
    resultCount: 1,
    requiresTable: true,
    pattern: ['PSP', 'P P', 'PSP'],
    key: { P: 'oak_planks', S: 'stick' },
  },
  {
    id: 'oak_door',
    resultItemId: 'oak_door',
    resultCount: 3,
    requiresTable: true,
    pattern: ['PP', 'PP', 'PP'],
    key: { P: 'oak_planks' },
  },
  {
    id: 'bed',
    resultItemId: 'bed',
    resultCount: 1,
    requiresTable: true,
    pattern: ['WWW', 'PPP'],
    key: { W: 'wool', P: 'oak_planks' },
  },
  {
    id: 'anvil',
    resultItemId: 'anvil',
    resultCount: 1,
    requiresTable: true,
    pattern: ['III', ' I ', 'CCC'],
    key: { I: 'iron_ingot', C: 'cobblestone' },
  },
  {
    id: 'bucket',
    resultItemId: 'bucket',
    resultCount: 1,
    requiresTable: true,
    pattern: ['I I', ' I '],
    key: { I: 'iron_ingot' },
  },

  // Smelting / Cooking (requires Furnace nearby OR Coal + raw material)
  {
    id: 'smelt_iron',
    resultItemId: 'iron_ingot',
    resultCount: 1,
    requiresTable: false,
    ingredients: [
      { itemId: 'iron_ore', count: 1 },
      { itemId: 'coal', count: 1 },
    ],
  },
  {
    id: 'smelt_gold',
    resultItemId: 'gold_ingot',
    resultCount: 1,
    requiresTable: false,
    ingredients: [
      { itemId: 'gold_ore', count: 1 },
      { itemId: 'coal', count: 1 },
    ],
  },
  {
    id: 'smelt_glass',
    resultItemId: 'glass',
    resultCount: 2,
    requiresTable: false,
    ingredients: [
      { itemId: 'sand', count: 2 },
      { itemId: 'coal', count: 1 },
    ],
  },
  {
    id: 'cook_beef',
    resultItemId: 'cooked_beef',
    resultCount: 1,
    requiresTable: false,
    ingredients: [
      { itemId: 'raw_beef', count: 1 },
      { itemId: 'coal', count: 1 },
    ],
  },
  {
    id: 'cook_pork',
    resultItemId: 'cooked_pork',
    resultCount: 1,
    requiresTable: false,
    ingredients: [
      { itemId: 'raw_pork', count: 1 },
      { itemId: 'coal', count: 1 },
    ],
  },
  {
    id: 'cook_chicken',
    resultItemId: 'cooked_chicken',
    resultCount: 1,
    requiresTable: false,
    ingredients: [
      { itemId: 'raw_chicken', count: 1 },
      { itemId: 'coal', count: 1 },
    ],
  },
  {
    id: 'craft_bread',
    resultItemId: 'bread',
    resultCount: 1,
    requiresTable: true,
    pattern: ['WWW'],
    key: { W: 'wheat' },
  },

  // Additional Building & Smelting
  {
    id: 'smelt_copper',
    resultItemId: 'copper_ingot',
    resultCount: 1,
    requiresTable: false,
    ingredients: [
      { itemId: 'copper_ore', count: 1 },
      { itemId: 'coal', count: 1 },
    ],
  },
  {
    id: 'terracotta',
    resultItemId: 'terracotta',
    resultCount: 2,
    requiresTable: false,
    ingredients: [
      { itemId: 'clay', count: 2 },
      { itemId: 'coal', count: 1 },
    ],
  },
  {
    id: 'white_concrete',
    resultItemId: 'white_concrete',
    resultCount: 4,
    requiresTable: true,
    ingredients: [
      { itemId: 'sand', count: 2 },
      { itemId: 'gravel', count: 2 },
    ],
  },
  ...TOOL_AND_ARMOR_RECIPES,
];
