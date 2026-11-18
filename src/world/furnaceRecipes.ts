import { ITEMS } from '../data/items';

export interface SmeltRecipe {
  inputId: string;
  outputId: string;
  outputCount: number;
  cookTimeSec: number;
}

export const SMELT_RECIPES: SmeltRecipe[] = [
  { inputId: 'copper_ore', outputId: 'copper_ingot', outputCount: 1, cookTimeSec: 3.5 },
  { inputId: 'iron_ore', outputId: 'iron_ingot', outputCount: 1, cookTimeSec: 4.0 },
  { inputId: 'gold_ore', outputId: 'gold_ingot', outputCount: 1, cookTimeSec: 4.0 },
  { inputId: 'sand', outputId: 'glass', outputCount: 1, cookTimeSec: 3.5 },
  { inputId: 'cobblestone', outputId: 'stone', outputCount: 1, cookTimeSec: 3.5 },
  { inputId: 'oak_log', outputId: 'charcoal', outputCount: 1, cookTimeSec: 3.5 },
  { inputId: 'birch_log', outputId: 'charcoal', outputCount: 1, cookTimeSec: 3.5 },
  { inputId: 'spruce_log', outputId: 'charcoal', outputCount: 1, cookTimeSec: 3.5 },
  { inputId: 'clay', outputId: 'brick', outputCount: 1, cookTimeSec: 3.5 },
  { inputId: 'raw_beef', outputId: 'cooked_beef', outputCount: 1, cookTimeSec: 3.0 },
  { inputId: 'raw_pork', outputId: 'cooked_pork', outputCount: 1, cookTimeSec: 3.0 },
  { inputId: 'raw_chicken', outputId: 'cooked_chicken', outputCount: 1, cookTimeSec: 3.0 },
];

const SMELT_MAP = new Map<string, SmeltRecipe>(
  SMELT_RECIPES.map((r) => [r.inputId, r]),
);

export function getSmeltRecipe(inputItemId: string | undefined): SmeltRecipe | null {
  if (!inputItemId) return null;
  return SMELT_MAP.get(inputItemId) ?? null;
}

export function getFuelBurnDuration(fuelItemId: string | undefined): number {
  if (!fuelItemId) return 0;
  return ITEMS[fuelItemId]?.fuelBurnSec ?? 0;
}
