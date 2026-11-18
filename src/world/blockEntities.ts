import { ITEMS } from '../data/items';
import {
  AnvilEntity,
  BarrelEntity,
  BedEntity,
  BlockEntity,
  BlockId,
  ChestEntity,
  DoorEntity,
  FurnaceEntity,
  InventorySlot,
} from '../types/game';
import { getFuelBurnDuration, getSmeltRecipe } from './furnaceRecipes';

export const CHEST_SLOTS = 27;

export function posKey(x: number, y: number, z: number): string {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

export interface AnvilPreview {
  result: InventorySlot;
  consumeLeft: number;
  consumeRight: number;
  costLabel: string;
}

function getRepairMaterialForItem(itemId: string): string | null {
  if (itemId.startsWith('wood_')) return 'oak_planks';
  if (itemId.startsWith('stone_')) return 'cobblestone';
  if (itemId.startsWith('iron_')) return 'iron_ingot';
  if (itemId.startsWith('diamond_')) return 'diamond';
  if (itemId.startsWith('leather_')) return 'leather';
  return null;
}

export function computeAnvilPreview(
  left: InventorySlot | null,
  right: InventorySlot | null,
): AnvilPreview | null {
  if (!left || !right) return null;
  const leftDef = ITEMS[left.itemId];
  if (!leftDef?.durability || left.durability === undefined) return null;
  const maxDur = leftDef.durability;
  if (left.durability >= maxDur) return null;

  // Case 1: Combine two identical tools/armor
  if (left.itemId === right.itemId && right.durability !== undefined) {
    const bonus = Math.ceil(maxDur * 0.12);
    const nextDur = Math.min(maxDur, left.durability + right.durability + bonus);
    return {
      result: { itemId: left.itemId, count: 1, durability: nextDur },
      consumeLeft: 1,
      consumeRight: 1,
      costLabel: 'Combine Gear (1+1)',
    };
  }

  // Case 2: Repair with base material (each unit restores 25% durability)
  const reqMat = getRepairMaterialForItem(left.itemId);
  if (reqMat && right.itemId === reqMat && right.count >= 1) {
    const perUnit = Math.max(1, Math.ceil(maxDur * 0.25));
    const missing = maxDur - left.durability;
    const needed = Math.min(right.count, Math.ceil(missing / perUnit));
    const nextDur = Math.min(maxDur, left.durability + needed * perUnit);
    return {
      result: { itemId: left.itemId, count: 1, durability: nextDur },
      consumeLeft: 1,
      consumeRight: needed,
      costLabel: `Uses ${needed}× ${ITEMS[reqMat]?.name ?? reqMat}`,
    };
  }

  return null;
}

export function createBlockEntity(
  blockId: BlockId,
  x: number,
  y: number,
  z: number,
  facing = 0,
): BlockEntity | null {
  if (blockId === BlockId.Furnace) {
    return {
      type: 'furnace',
      x,
      y,
      z,
      input: null,
      fuel: null,
      output: null,
      burnTime: 0,
      maxBurnTime: 0,
      cookProgress: 0,
      cookDuration: 4.0,
    };
  }
  if (blockId === BlockId.Chest) {
    return { type: 'chest', x, y, z, slots: new Array(CHEST_SLOTS).fill(null) };
  }
  if (blockId === BlockId.Barrel) {
    return { type: 'barrel', x, y, z, slots: new Array(CHEST_SLOTS).fill(null) };
  }
  if (blockId === BlockId.OakDoor) {
    return { type: 'door', x, y, z, open: false, facing };
  }
  if (blockId === BlockId.Bed) {
    return { type: 'bed', x, y, z };
  }
  if (blockId === BlockId.Anvil) {
    return { type: 'anvil', x, y, z, left: null, right: null };
  }
  return null;
}

export class BlockEntityManager {
  public entities = new Map<string, BlockEntity>();

  constructor(saved?: BlockEntity[]) {
    if (saved) {
      for (const e of saved) {
        this.entities.set(posKey(e.x, e.y, e.z), structuredClone(e));
      }
    }
  }

  public get(x: number, y: number, z: number): BlockEntity | undefined {
    return this.entities.get(posKey(x, y, z));
  }

  public ensureForBlock(blockId: BlockId, x: number, y: number, z: number, facing = 0): BlockEntity | null {
    const key = posKey(x, y, z);
    const existing = this.entities.get(key);
    if (existing) return existing;
    const created = createBlockEntity(blockId, x, y, z, facing);
    if (created) this.entities.set(key, created);
    return created;
  }

  public remove(x: number, y: number, z: number): BlockEntity | undefined {
    const key = posKey(x, y, z);
    const existing = this.entities.get(key);
    if (existing) this.entities.delete(key);
    return existing;
  }

  public findPartnerChest(x: number, y: number, z: number): ChestEntity | null {
    const offsets: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dz] of offsets) {
      const e = this.get(x + dx, y, z + dz);
      if (e && e.type === 'chest') return e;
    }
    return null;
  }

  public isDoorOpen(x: number, y: number, z: number): boolean {
    const e = this.get(x, y, z);
    return e?.type === 'door' ? e.open : false;
  }

  public getAllDoors(): DoorEntity[] {
    const list: DoorEntity[] = [];
    for (const e of this.entities.values()) {
      if (e.type === 'door') list.push(e);
    }
    return list;
  }

  public getLitFurnaces(): FurnaceEntity[] {
    const list: FurnaceEntity[] = [];
    for (const e of this.entities.values()) {
      if (e.type === 'furnace' && e.burnTime > 0) list.push(e);
    }
    return list;
  }

  public tickFurnaces(dt: number): boolean {
    let anyActive = false;
    for (const entity of this.entities.values()) {
      if (entity.type !== 'furnace') continue;
      if (this.stepSingleFurnace(entity, dt)) {
        anyActive = true;
      }
    }
    return anyActive;
  }

  private stepSingleFurnace(f: FurnaceEntity, dt: number): boolean {
    const wasLit = f.burnTime > 0;
    const recipe = getSmeltRecipe(f.input?.itemId);
    const canAcceptOutput =
      recipe !== null &&
      f.input !== null &&
      f.input.count > 0 &&
      (f.output === null ||
        (f.output.itemId === recipe.outputId &&
          f.output.count + recipe.outputCount <= (ITEMS[recipe.outputId]?.maxStack ?? 64)));

    if (f.burnTime > 0) {
      f.burnTime = Math.max(0, f.burnTime - dt);
    }

    // Consume fuel if burnTime ran out and smelting can proceed
    if (f.burnTime <= 0 && canAcceptOutput && f.fuel && f.fuel.count > 0) {
      const burn = getFuelBurnDuration(f.fuel.itemId);
      if (burn > 0) {
        f.burnTime = burn;
        f.maxBurnTime = burn;
        f.fuel.count -= 1;
        if (f.fuel.count <= 0) f.fuel = null;
      }
    }

    if (f.burnTime > 0 && canAcceptOutput && recipe && f.input) {
      f.cookDuration = recipe.cookTimeSec;
      f.cookProgress += dt;
      if (f.cookProgress >= f.cookDuration) {
        f.cookProgress = 0;
        f.input.count -= 1;
        if (f.input.count <= 0) f.input = null;
        if (f.output) {
          f.output.count += recipe.outputCount;
        } else {
          f.output = { itemId: recipe.outputId, count: recipe.outputCount };
        }
      }
    } else {
      f.cookProgress = Math.max(0, f.cookProgress - dt * 1.5);
    }

    const isLit = f.burnTime > 0;
    return wasLit || isLit;
  }

  public executeAnvilCraft(anvil: AnvilEntity): InventorySlot | null {
    const preview = computeAnvilPreview(anvil.left, anvil.right);
    if (!preview) return null;
    if (anvil.left) {
      anvil.left.count -= preview.consumeLeft;
      if (anvil.left.count <= 0) anvil.left = null;
    }
    if (anvil.right) {
      anvil.right.count -= preview.consumeRight;
      if (anvil.right.count <= 0) anvil.right = null;
    }
    return preview.result;
  }

  public extractAllStoredItems(entity: BlockEntity): InventorySlot[] {
    const out: InventorySlot[] = [];
    if (entity.type === 'chest' || entity.type === 'barrel') {
      for (const s of entity.slots) {
        if (s) out.push({ ...s });
      }
    } else if (entity.type === 'furnace') {
      if (entity.input) out.push({ ...entity.input });
      if (entity.fuel) out.push({ ...entity.fuel });
      if (entity.output) out.push({ ...entity.output });
    } else if (entity.type === 'anvil') {
      if (entity.left) out.push({ ...entity.left });
      if (entity.right) out.push({ ...entity.right });
    }
    return out;
  }

  public serialize(): BlockEntity[] {
    return Array.from(this.entities.values()).map((e) => structuredClone(e));
  }
}

export type StorageEntity = ChestEntity | BarrelEntity | BedEntity;
