import { SoundEngine } from '../audio/soundEngine';
import { ITEMS } from '../data/items';
import {
  addItemToInventory,
  matchCraftingGrid,
  PlayerInventoryState,
} from '../player/inventory';
import {
  clickInventorySlot,
  cloneSlot,
  computeDragDistribution,
  dropCursorOutside,
  shiftTransferSlot,
  SlotValidator,
  takeOutputToCursor,
} from '../player/inventoryOps';
import { RaycastHit } from '../player/physics';
import {
  ActiveBlockUi,
  ArmorSlotType,
  BlockEntity,
  BlockId,
  ChestEntity,
  InventorySlot,
} from '../types/game';
import { computeAnvilPreview } from '../world/blockEntities';
import { getFuelBurnDuration } from '../world/furnaceRecipes';
import { WorldManager } from '../world/worldManager';

export type ContainerArea =
  | 'hotbar'
  | 'inventory'
  | 'armor'
  | 'craft'
  | 'chest'
  | 'furnace_in'
  | 'furnace_fuel'
  | 'anvil_left'
  | 'anvil_right';

const ARMOR_KEYS: ArmorSlotType[] = ['helmet', 'chestplate', 'leggings', 'boots'];

interface DragVisit {
  area: ContainerArea;
  idx: number;
}

interface DragSession {
  button: 0 | 2;
  baseByArea: Partial<Record<ContainerArea, (InventorySlot | null)[]>>;
  baseCursor: InventorySlot;
  visited: DragVisit[];
}

export class ContainerController {
  public activeBlockUi: ActiveBlockUi | null = null;
  public craftingGrid: (InventorySlot | null)[] = new Array(9).fill(null);
  public cursorItem: InventorySlot | null = null;
  private drag: DragSession | null = null;

  public getGridSize(): 2 | 3 {
    return this.activeBlockUi?.type === 'crafting_table' ? 3 : 2;
  }

  public getActiveEntity(world: WorldManager): BlockEntity | null {
    if (!this.activeBlockUi) return null;
    return world.blockEntities.get(this.activeBlockUi.x, this.activeBlockUi.y, this.activeBlockUi.z) ?? null;
  }

  public getPartnerChest(world: WorldManager): ChestEntity | null {
    if (!this.activeBlockUi || this.activeBlockUi.type !== 'chest') return null;
    if (this.activeBlockUi.partnerX === undefined || this.activeBlockUi.partnerZ === undefined) return null;
    const e = world.blockEntities.get(this.activeBlockUi.partnerX, this.activeBlockUi.y, this.activeBlockUi.partnerZ);
    return e && e.type === 'chest' ? e : null;
  }

  public handleWorldInteract(
    hit: RaycastHit,
    world: WorldManager,
    sound: SoundEngine,
    onSleepBed: (x: number, y: number, z: number) => void,
  ): { openModal: boolean } {
    const id = hit.blockId;
    if (id === BlockId.CraftingTable) {
      this.activeBlockUi = { type: 'crafting_table', x: hit.bx, y: hit.by, z: hit.bz };
      return { openModal: true };
    }
    if (id === BlockId.Furnace) {
      world.blockEntities.ensureForBlock(BlockId.Furnace, hit.bx, hit.by, hit.bz);
      this.activeBlockUi = { type: 'furnace', x: hit.bx, y: hit.by, z: hit.bz };
      return { openModal: true };
    }
    if (id === BlockId.Chest) {
      world.blockEntities.ensureForBlock(BlockId.Chest, hit.bx, hit.by, hit.bz);
      const partner = world.blockEntities.findPartnerChest(hit.bx, hit.by, hit.bz);
      this.activeBlockUi = {
        type: 'chest',
        x: hit.bx,
        y: hit.by,
        z: hit.bz,
        partnerX: partner?.x,
        partnerZ: partner?.z,
      };
      return { openModal: true };
    }
    if (id === BlockId.Barrel) {
      world.blockEntities.ensureForBlock(BlockId.Barrel, hit.bx, hit.by, hit.bz);
      this.activeBlockUi = { type: 'barrel', x: hit.bx, y: hit.by, z: hit.bz };
      return { openModal: true };
    }
    if (id === BlockId.Anvil) {
      world.blockEntities.ensureForBlock(BlockId.Anvil, hit.bx, hit.by, hit.bz);
      this.activeBlockUi = { type: 'anvil', x: hit.bx, y: hit.by, z: hit.bz };
      return { openModal: true };
    }
    if (id === BlockId.OakDoor) {
      const door = world.blockEntities.ensureForBlock(BlockId.OakDoor, hit.bx, hit.by, hit.bz);
      if (door && door.type === 'door') {
        door.open = !door.open;
        sound.playBlockPlace();
      }
      return { openModal: false };
    }
    if (id === BlockId.Bed) {
      world.blockEntities.ensureForBlock(BlockId.Bed, hit.bx, hit.by, hit.bz);
      onSleepBed(hit.bx, hit.by, hit.bz);
      return { openModal: false };
    }
    return { openModal: false };
  }

  public returnTransientItems(inv: PlayerInventoryState): void {
    this.drag = null;
    if (this.cursorItem) {
      addItemToInventory(inv, this.cursorItem.itemId, this.cursorItem.count, this.cursorItem.durability);
      this.cursorItem = null;
    }
    for (let i = 0; i < this.craftingGrid.length; i++) {
      const s = this.craftingGrid[i];
      if (s) {
        addItemToInventory(inv, s.itemId, s.count, s.durability);
        this.craftingGrid[i] = null;
      }
    }
    this.activeBlockUi = null;
  }

  private getSlotArrayAndValidator(
    area: ContainerArea,
    inv: PlayerInventoryState,
    world: WorldManager,
  ): { slots: (InventorySlot | null)[]; writeBack: (next: (InventorySlot | null)[]) => void; validator?: SlotValidator } | null {
    if (area === 'hotbar') {
      return { slots: inv.hotbar, writeBack: (n) => { inv.hotbar = n; } };
    }
    if (area === 'inventory') {
      return { slots: inv.inventory, writeBack: (n) => { inv.inventory = n; } };
    }
    if (area === 'armor') {
      const arr = ARMOR_KEYS.map((k) => inv.armorSlots[k]);
      return {
        slots: arr,
        writeBack: (n) => {
          ARMOR_KEYS.forEach((k, i) => { inv.armorSlots[k] = n[i]; });
        },
        validator: (slot, idx) => ITEMS[slot.itemId]?.armorSlot === ARMOR_KEYS[idx],
      };
    }
    if (area === 'craft') {
      return { slots: this.craftingGrid, writeBack: (n) => { this.craftingGrid = n; } };
    }

    const entity = this.getActiveEntity(world);
    if (!entity) return null;

    if (area === 'chest') {
      if (entity.type === 'barrel') {
        return { slots: entity.slots, writeBack: (n) => { entity.slots = n; } };
      }
      if (entity.type === 'chest') {
        const partner = this.getPartnerChest(world);
        if (!partner) {
          return { slots: entity.slots, writeBack: (n) => { entity.slots = n; } };
        }
        const combined = [...entity.slots, ...partner.slots];
        return {
          slots: combined,
          writeBack: (n) => {
            entity.slots = n.slice(0, 27);
            partner.slots = n.slice(27, 54);
          },
        };
      }
    }

    if (entity.type === 'furnace') {
      if (area === 'furnace_in') {
        return { slots: [entity.input], writeBack: (n) => { entity.input = n[0]; } };
      }
      if (area === 'furnace_fuel') {
        return {
          slots: [entity.fuel],
          writeBack: (n) => { entity.fuel = n[0]; },
          validator: (slot) => getFuelBurnDuration(slot.itemId) > 0,
        };
      }
    }

    if (entity.type === 'anvil') {
      if (area === 'anvil_left') {
        return { slots: [entity.left], writeBack: (n) => { entity.left = n[0]; } };
      }
      if (area === 'anvil_right') {
        return { slots: [entity.right], writeBack: (n) => { entity.right = n[0]; } };
      }
    }

    return null;
  }

  public clickSlot(
    area: ContainerArea,
    idx: number,
    button: 0 | 2,
    shiftKey: boolean,
    inv: PlayerInventoryState,
    world: WorldManager,
  ): boolean {
    const target = this.getSlotArrayAndValidator(area, inv, world);
    if (!target) return false;

    if (shiftKey && button === 0) {
      const entity = this.getActiveEntity(world);
      const dests: { slots: (InventorySlot | null)[]; validator?: SlotValidator }[] = [];
      if (area === 'hotbar' || area === 'inventory') {
        if (entity?.type === 'chest') {
          const partner = this.getPartnerChest(world);
          dests.push({ slots: entity.slots });
          if (partner) dests.push({ slots: partner.slots });
        } else if (entity?.type === 'barrel') {
          dests.push({ slots: entity.slots });
        } else if (entity?.type === 'furnace') {
          const clicked = target.slots[idx];
          if (clicked && getFuelBurnDuration(clicked.itemId) > 0) {
            const fWrap = [entity.fuel];
            if (shiftTransferSlot(target.slots, idx, [{ slots: fWrap }])) {
              entity.fuel = fWrap[0];
              return true;
            }
          }
          const iWrap = [entity.input];
          if (shiftTransferSlot(target.slots, idx, [{ slots: iWrap }])) {
            entity.input = iWrap[0];
            return true;
          }
        } else {
          dests.push(area === 'hotbar' ? { slots: inv.inventory } : { slots: inv.hotbar });
        }
      } else {
        dests.push({ slots: inv.hotbar }, { slots: inv.inventory });
      }
      const moved = shiftTransferSlot(target.slots, idx, dests);
      if (moved) target.writeBack(target.slots);
      return moved;
    }

    const res = clickInventorySlot(target.slots, idx, this.cursorItem, button, target.validator);
    if (!res.changed) return false;
    target.writeBack(res.slots);
    this.cursorItem = res.cursor;
    return true;
  }

  public beginDrag(area: ContainerArea, idx: number, button: 0 | 2, inv: PlayerInventoryState, world: WorldManager): boolean {
    if (!this.cursorItem) return false;
    const target = this.getSlotArrayAndValidator(area, inv, world);
    if (!target) return false;
    const existing = target.slots[idx];
    const canDistributeIntoFirst =
      !existing ||
      (existing.itemId === this.cursorItem.itemId &&
        (ITEMS[existing.itemId]?.maxStack ?? 64) > 1 &&
        existing.durability === undefined &&
        this.cursorItem.durability === undefined &&
        existing.count < (ITEMS[existing.itemId]?.maxStack ?? 64));
    if (!canDistributeIntoFirst) {
      return this.clickSlot(area, idx, button, false, inv, world);
    }
    this.drag = {
      button,
      baseByArea: { [area]: target.slots.map(cloneSlot) },
      baseCursor: { ...this.cursorItem },
      visited: [{ area, idx }],
    };
    return this.applyMultiAreaDrag(inv, world);
  }

  public continueDrag(area: ContainerArea, idx: number, inv: PlayerInventoryState, world: WorldManager): boolean {
    if (!this.drag) return false;
    if (this.drag.visited.some((v) => v.area === area && v.idx === idx)) return false;
    const target = this.getSlotArrayAndValidator(area, inv, world);
    if (!target) return false;
    if (!this.drag.baseByArea[area]) {
      this.drag.baseByArea[area] = target.slots.map(cloneSlot);
    }
    this.drag.visited.push({ area, idx });
    return this.applyMultiAreaDrag(inv, world);
  }

  private applyMultiAreaDrag(inv: PlayerInventoryState, world: WorldManager): boolean {
    if (!this.drag) return false;
    const flatBase: (InventorySlot | null)[] = [];
    const validators: (SlotValidator | undefined)[] = [];
    for (const v of this.drag.visited) {
      const baseArr = this.drag.baseByArea[v.area];
      flatBase.push(baseArr ? cloneSlot(baseArr[v.idx]) : null);
      validators.push(this.getSlotArrayAndValidator(v.area, inv, world)?.validator);
    }
    const indices = this.drag.visited.map((_, i) => i);
    const res = computeDragDistribution(
      flatBase,
      this.drag.baseCursor,
      indices,
      this.drag.button,
      (slot, flatIdx) => {
        const fn = validators[flatIdx];
        const visit = this.drag!.visited[flatIdx];
        return fn ? fn(slot, visit.idx) : true;
      },
    );
    const workingByArea = new Map<ContainerArea, (InventorySlot | null)[]>();
    for (const [a, baseArr] of Object.entries(this.drag.baseByArea) as [ContainerArea, (InventorySlot | null)[]][]) {
      workingByArea.set(a, baseArr.map(cloneSlot));
    }
    this.drag.visited.forEach((v, flatIdx) => {
      const arr = workingByArea.get(v.area);
      if (arr) arr[v.idx] = res.slots[flatIdx];
    });
    for (const [a, nextArr] of workingByArea.entries()) {
      this.getSlotArrayAndValidator(a, inv, world)?.writeBack(nextArr);
    }
    this.cursorItem = res.cursor;
    return res.changed;
  }

  public endDrag(): boolean {
    const wasMulti = Boolean(this.drag && this.drag.visited.length > 1);
    this.drag = null;
    return wasMulti;
  }

  public getCraftingMatch() {
    const size = this.getGridSize();
    const ids: (string | null)[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        ids.push(this.craftingGrid[r * size + c]?.itemId ?? null);
      }
    }
    return matchCraftingGrid(ids, size);
  }

  public takeCraftingOutput(inv: PlayerInventoryState, shiftKey: boolean): boolean {
    const match = this.getCraftingMatch();
    if (!match) return false;
    const size = this.getGridSize();
    const outDef = ITEMS[match.resultItemId];
    const produced: InventorySlot = {
      itemId: match.resultItemId,
      count: match.resultCount,
      durability: outDef?.durability,
    };

    const consumeOneRound = () => {
      for (let i = 0; i < size * size; i++) {
        const s = this.craftingGrid[i];
        if (s) {
          s.count -= 1;
          if (s.count <= 0) this.craftingGrid[i] = null;
        }
      }
    };

    if (shiftKey) {
      let craftedAny = false;
      while (this.getCraftingMatch()?.id === match.id) {
        const rem = addItemToInventory(inv, produced.itemId, produced.count, produced.durability);
        if (rem > 0) break;
        consumeOneRound();
        craftedAny = true;
      }
      return craftedAny;
    }

    const res = takeOutputToCursor(produced, this.cursorItem);
    if (!res.taken) return false;
    consumeOneRound();
    this.cursorItem = res.nextCursor;
    return true;
  }

  public takeFurnaceOutput(inv: PlayerInventoryState, world: WorldManager, shiftKey: boolean): boolean {
    const entity = this.getActiveEntity(world);
    if (!entity || entity.type !== 'furnace' || !entity.output) return false;
    if (shiftKey) {
      const rem = addItemToInventory(inv, entity.output.itemId, entity.output.count);
      const taken = entity.output.count - rem;
      if (taken <= 0) return false;
      entity.output.count -= taken;
      if (entity.output.count <= 0) entity.output = null;
      return true;
    }
    const res = takeOutputToCursor(entity.output, this.cursorItem);
    if (!res.taken) return false;
    entity.output = null;
    this.cursorItem = res.nextCursor;
    return true;
  }

  public takeAnvilOutput(inv: PlayerInventoryState, world: WorldManager, shiftKey: boolean): boolean {
    const entity = this.getActiveEntity(world);
    if (!entity || entity.type !== 'anvil') return false;
    const preview = computeAnvilPreview(entity.left, entity.right);
    if (!preview) return false;

    if (shiftKey) {
      const rem = addItemToInventory(inv, preview.result.itemId, preview.result.count, preview.result.durability);
      if (rem > 0) return false;
      world.blockEntities.executeAnvilCraft(entity);
      return true;
    }

    const res = takeOutputToCursor(preview.result, this.cursorItem);
    if (!res.taken) return false;
    world.blockEntities.executeAnvilCraft(entity);
    this.cursorItem = res.nextCursor;
    return true;
  }

  public onDropOutside?: (slot: InventorySlot) => void;

  public dropCursorOutside(button: 0 | 2): boolean {
    const res = dropCursorOutside(this.cursorItem, button);
    if (!res.dropped) return false;
    this.cursorItem = res.nextCursor;
    this.onDropOutside?.(res.dropped);
    return true;
  }

  public pickCreativeItem(itemId: string, button: 0 | 2, shiftKey: boolean, inv: PlayerInventoryState): boolean {
    const def = ITEMS[itemId];
    if (!def) return false;
    if (shiftKey && button === 0) {
      const rem = addItemToInventory(inv, def.id, def.maxStack, def.durability);
      return rem < def.maxStack;
    }
    if (button === 2 && this.cursorItem) {
      if (this.cursorItem.itemId === def.id && this.cursorItem.count < def.maxStack && def.durability === undefined) {
        this.cursorItem = { ...this.cursorItem, count: this.cursorItem.count + 1 };
      } else {
        this.cursorItem = null;
      }
      return true;
    }
    if (button === 0 && this.cursorItem && this.cursorItem.itemId === def.id && this.cursorItem.count >= def.maxStack) {
      this.cursorItem = null;
      return true;
    }
    this.cursorItem = {
      itemId: def.id,
      count: button === 2 ? 1 : def.maxStack,
      durability: def.durability,
    };
    return true;
  }

  public clearCursor(): boolean {
    if (!this.cursorItem) return false;
    this.cursorItem = null;
    return true;
  }
}
