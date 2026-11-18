import { ITEMS } from '../data/items';
import { RECIPES } from '../data/recipes';
import { ArmorSlotType, CraftingRecipe, InventorySlot } from '../types/game';

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 27;

export interface PlayerInventoryState {
  hotbar: (InventorySlot | null)[];
  inventory: (InventorySlot | null)[];
  armorSlots: Record<ArmorSlotType, InventorySlot | null>;
  selectedSlot: number;
}

export function createInitialInventory(): PlayerInventoryState {
  const hotbar: (InventorySlot | null)[] = new Array(HOTBAR_SIZE).fill(null);
  const inventory: (InventorySlot | null)[] = new Array(INVENTORY_SIZE).fill(null);

  // Starter survival kit: stone/wood basics so player can immediately build or explore
  hotbar[0] = { itemId: 'wood_pickaxe', count: 1, durability: ITEMS.wood_pickaxe.durability };
  hotbar[1] = { itemId: 'wood_axe', count: 1, durability: ITEMS.wood_axe.durability };
  hotbar[2] = { itemId: 'wood_sword', count: 1, durability: ITEMS.wood_sword.durability };
  hotbar[3] = { itemId: 'torch', count: 8 };
  hotbar[4] = { itemId: 'oak_planks', count: 16 };
  hotbar[5] = { itemId: 'bread', count: 3 };

  return {
    hotbar,
    inventory,
    armorSlots: {
      helmet: null,
      chestplate: null,
      leggings: null,
      boots: null,
    },
    selectedSlot: 0,
  };
}

export function addItemToInventory(
  state: PlayerInventoryState,
  itemId: string,
  count = 1,
  durability?: number,
): number {
  const def = ITEMS[itemId];
  if (!def || count <= 0) return count;

  let remaining = count;
  const maxStack = def.maxStack;

  // 1. Merge into existing stacks in hotbar then main inventory
  if (maxStack > 1) {
    for (const arr of [state.hotbar, state.inventory]) {
      for (let i = 0; i < arr.length && remaining > 0; i++) {
        const slot = arr[i];
        if (slot && slot.itemId === itemId && slot.count < maxStack) {
          const take = Math.min(remaining, maxStack - slot.count);
          slot.count += take;
          remaining -= take;
        }
      }
    }
  }

  // 2. Fill empty slots
  for (const arr of [state.hotbar, state.inventory]) {
    for (let i = 0; i < arr.length && remaining > 0; i++) {
      if (!arr[i]) {
        const take = Math.min(remaining, maxStack);
        arr[i] = {
          itemId,
          count: take,
          durability: durability ?? def.durability,
        };
        remaining -= take;
      }
    }
  }

  return remaining;
}

export function countItemInInventory(state: PlayerInventoryState, itemId: string): number {
  let total = 0;
  for (const s of state.hotbar) {
    if (s && s.itemId === itemId) total += s.count;
  }
  for (const s of state.inventory) {
    if (s && s.itemId === itemId) total += s.count;
  }
  return total;
}

export function consumeItemFromInventory(
  state: PlayerInventoryState,
  itemId: string,
  count: number,
): boolean {
  if (countItemInInventory(state, itemId) < count) return false;
  let remaining = count;
  for (const arr of [state.hotbar, state.inventory]) {
    for (let i = 0; i < arr.length && remaining > 0; i++) {
      const slot = arr[i];
      if (slot && slot.itemId === itemId) {
        const take = Math.min(remaining, slot.count);
        slot.count -= take;
        remaining -= take;
        if (slot.count <= 0) arr[i] = null;
      }
    }
  }
  return true;
}

export function getRecipeIngredients(recipe: CraftingRecipe): Record<string, number> {
  const req: Record<string, number> = {};
  if (recipe.ingredients) {
    for (const ing of recipe.ingredients) {
      req[ing.itemId] = (req[ing.itemId] ?? 0) + ing.count;
    }
    return req;
  }
  if (recipe.pattern && recipe.key) {
    for (const row of recipe.pattern) {
      for (const ch of row) {
        if (ch === ' ') continue;
        const itemId = recipe.key[ch];
        if (itemId) req[itemId] = (req[itemId] ?? 0) + 1;
      }
    }
  }
  return req;
}

export function canCraftRecipe(
  state: PlayerInventoryState,
  recipe: CraftingRecipe,
  hasTableNearby: boolean,
): boolean {
  if (recipe.requiresTable && !hasTableNearby) return false;
  const req = getRecipeIngredients(recipe);
  for (const [itemId, count] of Object.entries(req)) {
    if (countItemInInventory(state, itemId) < count) return false;
  }
  return true;
}

export function craftRecipe(
  state: PlayerInventoryState,
  recipeId: string,
  hasTableNearby: boolean,
): boolean {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return false;
  if (!canCraftRecipe(state, recipe, hasTableNearby)) return false;

  const req = getRecipeIngredients(recipe);
  for (const [itemId, count] of Object.entries(req)) {
    consumeItemFromInventory(state, itemId, count);
  }
  addItemToInventory(state, recipe.resultItemId, recipe.resultCount);
  return true;
}

// Match an explicit 2x2 or 3x3 crafting grid (size = 2 or 3)
export function matchCraftingGrid(
  grid: (string | null)[],
  gridSize: 2 | 3,
): CraftingRecipe | null {
  // Trim empty rows/cols from grid
  let minR: number = gridSize;
  let maxR = -1;
  let minC: number = gridSize;
  let maxC = -1;
  const itemCounts: Record<string, number> = {};
  let totalItems = 0;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const id = grid[r * gridSize + c];
      if (id) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
        itemCounts[id] = (itemCounts[id] ?? 0) + 1;
        totalItems++;
      }
    }
  }

  if (totalItems === 0) return null;
  const h = maxR - minR + 1;
  const w = maxC - minC + 1;

  for (const recipe of RECIPES) {
    if (recipe.requiresTable && gridSize < 3) continue;

    if (recipe.ingredients) {
      const req = getRecipeIngredients(recipe);
      const reqKeys = Object.keys(req);
      if (
        reqKeys.length === Object.keys(itemCounts).length &&
        reqKeys.every((k) => itemCounts[k] === req[k])
      ) {
        return recipe;
      }
      continue;
    }

    if (recipe.pattern && recipe.key) {
      const ph = recipe.pattern.length;
      const pw = recipe.pattern[0].length;
      if (ph !== h || pw !== w) continue;

      let matched = true;
      for (let r = 0; r < ph && matched; r++) {
        for (let c = 0; c < pw; c++) {
          const ch = recipe.pattern[r][c];
          const expected = ch === ' ' ? null : recipe.key[ch] ?? null;
          const actual = grid[(minR + r) * gridSize + (minC + c)];
          if (expected !== actual) {
            matched = false;
            break;
          }
        }
      }
      if (matched) return recipe;
    }
  }

  return null;
}

export function getTotalArmorDefense(
  armorSlots: Record<ArmorSlotType, InventorySlot | null>,
): number {
  let defense = 0;
  for (const slot of Object.values(armorSlots)) {
    if (slot) {
      defense += ITEMS[slot.itemId]?.armorDefense ?? 0;
    }
  }
  return defense;
}

export function damageHeldTool(state: PlayerInventoryState): void {
  const slot = state.hotbar[state.selectedSlot];
  if (!slot || slot.durability === undefined) return;
  slot.durability -= 1;
  if (slot.durability <= 0) {
    state.hotbar[state.selectedSlot] = null;
  }
}
