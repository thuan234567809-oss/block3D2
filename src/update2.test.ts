import test from 'node:test';
import assert from 'node:assert/strict';
import { BlockId, InventorySlot } from './types/game';
import { SoundEngine } from './audio/soundEngine';
import { ContainerController } from './engine/ContainerController';
import { createInitialInventory } from './player/inventory';
import {
  clickInventorySlot,
  computeDragDistribution,
  dropCursorOutside,
  shiftTransferSlot,
  takeOutputToCursor,
} from './player/inventoryOps';
import {
  BlockEntityManager,
  computeAnvilPreview,
} from './world/blockEntities';
import { WorldManager } from './world/worldManager';

function sumCounts(slots: (InventorySlot | null)[], cursor: InventorySlot | null, itemId: string): number {
  let total = cursor && cursor.itemId === itemId ? cursor.count : 0;
  for (const s of slots) {
    if (s && s.itemId === itemId) total += s.count;
  }
  return total;
}

test('inventoryOps handles left-click pickup, merge, swap, and maxStack cap without loss', () => {
  const slots: (InventorySlot | null)[] = [
    { itemId: 'cobblestone', count: 50 },
    { itemId: 'cobblestone', count: 30 },
    { itemId: 'oak_planks', count: 12 },
    null,
  ];
  let cursor: InventorySlot | null = null;

  // Left-click slot 0: pick up 50 cobblestone
  let res = clickInventorySlot(slots, 0, cursor, 0);
  assert.equal(res.slots[0], null);
  assert.deepEqual(res.cursor, { itemId: 'cobblestone', count: 50 });

  // Left-click slot 1 (30 cobblestone): merge up to 64, remainder 16 stays on cursor
  res = clickInventorySlot(res.slots, 1, res.cursor, 0);
  assert.deepEqual(res.slots[1], { itemId: 'cobblestone', count: 64 });
  assert.deepEqual(res.cursor, { itemId: 'cobblestone', count: 16 });
  assert.equal(sumCounts(res.slots, res.cursor, 'cobblestone'), 80);

  // Left-click slot 2 (12 oak_planks): swap stacks cleanly
  res = clickInventorySlot(res.slots, 2, res.cursor, 0);
  assert.deepEqual(res.slots[2], { itemId: 'cobblestone', count: 16 });
  assert.deepEqual(res.cursor, { itemId: 'oak_planks', count: 12 });
  assert.equal(sumCounts(res.slots, res.cursor, 'cobblestone'), 80);
  assert.equal(sumCounts(res.slots, res.cursor, 'oak_planks'), 12);

  // Left-click empty slot 3: place whole cursor
  res = clickInventorySlot(res.slots, 3, res.cursor, 0);
  assert.deepEqual(res.slots[3], { itemId: 'oak_planks', count: 12 });
  assert.equal(res.cursor, null);
});

test('inventoryOps handles right-click half split and single-item placement', () => {
  const slots: (InventorySlot | null)[] = [
    { itemId: 'coal', count: 15 },
    null,
    { itemId: 'coal', count: 63 },
  ];

  // Right-click slot 0 with empty cursor -> picks up ceil(15/2) = 8, leaves 7
  let res = clickInventorySlot(slots, 0, null, 2);
  assert.deepEqual(res.cursor, { itemId: 'coal', count: 8 });
  assert.deepEqual(res.slots[0], { itemId: 'coal', count: 7 });

  // Right-click empty slot 1 -> places 1, cursor becomes 7
  res = clickInventorySlot(res.slots, 1, res.cursor, 2);
  assert.deepEqual(res.slots[1], { itemId: 'coal', count: 1 });
  assert.deepEqual(res.cursor, { itemId: 'coal', count: 7 });

  // Right-click slot 2 (63 coal) -> adds 1 to 64, cursor becomes 6
  res = clickInventorySlot(res.slots, 2, res.cursor, 2);
  assert.deepEqual(res.slots[2], { itemId: 'coal', count: 64 });
  assert.deepEqual(res.cursor, { itemId: 'coal', count: 6 });

  // Right-click slot 2 again (already 64) -> no change
  const blocked = clickInventorySlot(res.slots, 2, res.cursor, 2);
  assert.equal(blocked.changed, false);
  assert.equal(sumCounts(res.slots, res.cursor, 'coal'), 15 + 63);
});

test('computeDragDistribution distributes evenly on left-drag and 1-per-slot on right-drag', () => {
  const baseSlots: (InventorySlot | null)[] = [null, null, null, { itemId: 'dirt', count: 1 }];
  const baseCursor: InventorySlot = { itemId: 'oak_planks', count: 10 };

  // Left-drag across slots 0, 1, 2 (skipping incompatible slot 3 with dirt)
  const leftRes = computeDragDistribution(baseSlots, baseCursor, [0, 1, 3, 2], 0);
  assert.equal(leftRes.slots[0]?.count, 3);
  assert.equal(leftRes.slots[1]?.count, 3);
  assert.equal(leftRes.slots[2]?.count, 3);
  assert.equal(leftRes.slots[3]?.itemId, 'dirt');
  assert.deepEqual(leftRes.cursor, { itemId: 'oak_planks', count: 1 });
  assert.equal(sumCounts(leftRes.slots, leftRes.cursor, 'oak_planks'), 10);

  // Right-drag across slots 0, 1, 2
  const rightRes = computeDragDistribution(baseSlots, baseCursor, [0, 1, 2], 2);
  assert.equal(rightRes.slots[0]?.count, 1);
  assert.equal(rightRes.slots[1]?.count, 1);
  assert.equal(rightRes.slots[2]?.count, 1);
  assert.deepEqual(rightRes.cursor, { itemId: 'oak_planks', count: 7 });
  assert.equal(sumCounts(rightRes.slots, rightRes.cursor, 'oak_planks'), 10);
});

test('dropCursorOutside, shiftTransferSlot, and takeOutputToCursor enforce limits', () => {
  const d1 = dropCursorOutside({ itemId: 'sand', count: 5 }, 2);
  assert.deepEqual(d1.dropped, { itemId: 'sand', count: 1 });
  assert.deepEqual(d1.nextCursor, { itemId: 'sand', count: 4 });

  const dAll = dropCursorOutside(d1.nextCursor, 0);
  assert.deepEqual(dAll.dropped, { itemId: 'sand', count: 4 });
  assert.equal(dAll.nextCursor, null);

  const src: (InventorySlot | null)[] = [{ itemId: 'oak_log', count: 10 }];
  const dest: (InventorySlot | null)[] = [{ itemId: 'oak_log', count: 60 }, null];
  assert.equal(shiftTransferSlot(src, 0, [{ slots: dest }]), true);
  assert.deepEqual(dest[0], { itemId: 'oak_log', count: 64 });
  assert.deepEqual(dest[1], { itemId: 'oak_log', count: 6 });
  assert.equal(src[0], null);

  // Output stacking check for unstackable tools
  const toolOut = takeOutputToCursor(
    { itemId: 'iron_pickaxe', count: 1, durability: 251 },
    { itemId: 'iron_pickaxe', count: 1, durability: 251 },
  );
  assert.equal(toolOut.taken, false);
});

test('BlockEntityManager runs furnace smelting, double chest pairing, anvil repair, and persistence', () => {
  const mgr = new BlockEntityManager();

  // Furnace smelting: iron_ore + coal -> iron_ingot
  const furnace = mgr.ensureForBlock(BlockId.Furnace, 2, 40, 2);
  assert.ok(furnace && furnace.type === 'furnace');
  furnace.input = { itemId: 'iron_ore', count: 2 };
  furnace.fuel = { itemId: 'coal', count: 1 };

  for (let i = 0; i < 45; i++) {
    mgr.tickFurnaces(0.1);
  }
  assert.equal(furnace.output?.itemId, 'iron_ingot');
  assert.equal(furnace.output?.count, 1);
  assert.equal(furnace.input?.count, 1);
  assert.ok(furnace.burnTime > 0);

  // Double chest detection (adjacent X+1)
  const c1 = mgr.ensureForBlock(BlockId.Chest, 5, 40, 5);
  const c2 = mgr.ensureForBlock(BlockId.Chest, 6, 40, 5);
  assert.ok(c1 && c1.type === 'chest');
  assert.ok(c2 && c2.type === 'chest');
  c2.slots[0] = { itemId: 'diamond', count: 3 };
  const partner = mgr.findPartnerChest(5, 40, 5);
  assert.ok(partner);
  assert.equal(partner.slots[0]?.itemId, 'diamond');

  // Anvil repair with material
  const anvil = mgr.ensureForBlock(BlockId.Anvil, 8, 40, 8);
  assert.ok(anvil && anvil.type === 'anvil');
  anvil.left = { itemId: 'iron_pickaxe', count: 1, durability: 100 };
  anvil.right = { itemId: 'iron_ingot', count: 2 };
  const preview = computeAnvilPreview(anvil.left, anvil.right);
  assert.ok(preview);
  assert.ok((preview.result.durability ?? 0) > 100);
  const repaired = mgr.executeAnvilCraft(anvil);
  assert.ok(repaired);
  assert.equal(anvil.left, null);

  // Serialization round-trip
  const saved = mgr.serialize();
  const mgr2 = new BlockEntityManager(saved);
  const f2 = mgr2.get(2, 40, 2);
  assert.ok(f2 && f2.type === 'furnace');
  assert.equal(f2.output?.itemId, 'iron_ingot');
  const c2Restored = mgr2.get(6, 40, 5);
  assert.ok(c2Restored && c2Restored.type === 'chest');
  assert.equal(c2Restored.slots[0]?.count, 3);
});

test('ContainerController supports 3x3 crafting, multi-area drag, double chest shift-transfer, and item conservation', () => {
  const world = new WorldManager(1234);
  const inv = createInitialInventory();
  const ctrl = new ContainerController();
  const sound = new SoundEngine();

  // Place crafting table and open 3x3 grid
  world.setBlock(4, 50, 4, BlockId.CraftingTable);
  const openRes = ctrl.handleWorldInteract(
    { bx: 4, by: 50, bz: 4, nx: 0, ny: 1, nz: 0, blockId: BlockId.CraftingTable, distance: 2 },
    world,
    sound,
    () => {},
  );
  assert.equal(openRes.openModal, true);
  assert.equal(ctrl.getGridSize(), 3);

  // Put iron_ingot x3 and stick x2 into inventory, lay out iron_pickaxe pattern
  inv.inventory[0] = { itemId: 'iron_ingot', count: 3 };
  inv.inventory[1] = { itemId: 'stick', count: 2 };
  ctrl.craftingGrid[0] = { itemId: 'iron_ingot', count: 1 };
  ctrl.craftingGrid[1] = { itemId: 'iron_ingot', count: 1 };
  ctrl.craftingGrid[2] = { itemId: 'iron_ingot', count: 1 };
  ctrl.craftingGrid[4] = { itemId: 'stick', count: 1 };
  ctrl.craftingGrid[7] = { itemId: 'stick', count: 1 };

  assert.equal(ctrl.getCraftingMatch()?.resultItemId, 'iron_pickaxe');
  assert.equal(ctrl.takeCraftingOutput(inv, false), true);
  assert.equal(ctrl.cursorItem?.itemId, 'iron_pickaxe');
  assert.equal(ctrl.craftingGrid.every((s) => s === null), true);

  // Closing container returns cursor item safely into inventory without loss
  ctrl.returnTransientItems(inv);
  assert.equal(ctrl.cursorItem, null);
  assert.ok(
    inv.hotbar.some((s) => s?.itemId === 'iron_pickaxe') || inv.inventory.some((s) => s?.itemId === 'iron_pickaxe'),
  );

  // Multi-area drag across inventory and hotbar
  inv.inventory[5] = null;
  inv.hotbar[8] = null;
  ctrl.cursorItem = { itemId: 'cobblestone', count: 10 };
  assert.equal(ctrl.beginDrag('inventory', 5, 0, inv, world), true);
  assert.equal(ctrl.continueDrag('hotbar', 8, inv, world), true);
  assert.equal(ctrl.endDrag(), true);
  assert.equal((inv.inventory[5] as InventorySlot | null)?.count, 5);
  assert.equal((inv.hotbar[8] as InventorySlot | null)?.count, 5);
  assert.equal(ctrl.cursorItem, null);

  // Double chest Shift-Click transfer
  world.setBlock(8, 50, 8, BlockId.Chest);
  world.setBlock(9, 50, 8, BlockId.Chest);
  ctrl.handleWorldInteract(
    { bx: 8, by: 50, bz: 8, nx: 0, ny: 1, nz: 0, blockId: BlockId.Chest, distance: 2 },
    world,
    sound,
    () => {},
  );
  assert.equal(ctrl.clickSlot('hotbar', 8, 0, true, inv, world), true);
  assert.equal(inv.hotbar[8], null);
  const cEntity = world.blockEntities.get(8, 50, 8);
  assert.ok(cEntity && cEntity.type === 'chest');
  assert.equal(cEntity.slots[0]?.itemId, 'cobblestone');
  assert.equal(cEntity.slots[0]?.count, 5);
});

test('WorldManager toggles OakDoor collision cleanly on open/close', () => {
  const world = new WorldManager(999);
  const ctrl = new ContainerController();
  const sound = new SoundEngine();

  world.setBlock(6, 55, 6, BlockId.OakDoor, 1);
  assert.equal(world.getBlock(6, 55, 6), BlockId.OakDoor);
  assert.equal(world.getCollisionBlock(6, 55, 6), BlockId.OakDoor);

  ctrl.handleWorldInteract(
    { bx: 6, by: 55, bz: 6, nx: 0, ny: 0, nz: 1, blockId: BlockId.OakDoor, distance: 2 },
    world,
    sound,
    () => {},
  );
  assert.equal(world.getBlock(6, 55, 6), BlockId.OakDoor);
  assert.equal(world.getCollisionBlock(6, 55, 6), BlockId.Air);

  world.setBlock(6, 55, 6, BlockId.Air);
  assert.equal(world.blockEntities.get(6, 55, 6), undefined);
});
