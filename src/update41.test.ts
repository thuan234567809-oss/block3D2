import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  BLOCK_DROP_TABLE,
  isToolCompatibleWithBlock,
  resolveBlockBreakDropPosition,
  resolveBlockDrops,
} from './data/blockDrops';
import { ITEMS } from './data/items';
import { ContainerController } from './engine/ContainerController';
import { buildWorldSaveData } from './engine/EngineSnapshot';
import { PlayerController } from './engine/PlayerController';
import { DROP_PICKUP_COOLDOWN } from './entities/droppedItemPhysics';
import { DroppedItemManager } from './entities/droppedItems';
import { MobManager } from './entities/mobManager';
import { MOB_HITBOXES } from './entities/mobTargeting';
import { RaycastHit } from './player/physics';
import { animateMobRig } from './render/mobAnimator';
import { createMobRig, disposeMobRig, disposeSharedMobTextures } from './render/mobsMesh';
import { BlockId, ChestEntity, MobType, WeatherType } from './types/game';
import { WorldManager } from './world/worldManager';

// Headless Node canvas shim so voxelItemModels can build block-atlas drops in unit tests
if (typeof (globalThis as any).document === 'undefined') {
  const noopCtx = new Proxy(
    { fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) },
    { get: (t, k) => (k in t ? (t as any)[k] : () => {}) },
  );
  (globalThis as any).document = { createElement: () => ({ width: 256, height: 256, getContext: () => noopCtx }) };
}

const noopEffects = { spawnBurst: () => {} } as any;
const noopSound = {
  playBlockBreak: () => {},
  playPickup: () => {},
  playHit: () => {},
  playStep: () => {},
  playHurt: () => {},
  playBlockPlace: () => {},
} as any;

function makeHit(bx: number, by: number, bz: number, blockId: BlockId): RaycastHit {
  return { bx, by, bz, nx: 0, ny: 1, nz: 0, distance: 2.0, blockId };
}

function countItemInInv(player: PlayerController, itemId: string): number {
  let total = 0;
  for (const s of [...player.inv.hotbar, ...player.inv.inventory]) {
    if (s && s.itemId === itemId) total += s.count;
  }
  return total;
}

// ============================================================================
// PART A — BLOCK BREAK & ITEM DROP LOGIC TESTS (1-11)
// ============================================================================

test('Part A Test 1 & 6: Breaking Grass in Survival drops Dirt 3D entity instead of auto-collecting', () => {
  const world = new WorldManager(202604);
  const player = new PlayerController(202604);
  const scene = new THREE.Scene();
  const drops = new DroppedItemManager(scene);

  const bx = 4, by = 42, bz = 4;
  world.setBlock(bx, by - 1, bz, BlockId.Dirt);
  world.setBlock(bx, by, bz, BlockId.Grass);
  world.setBlock(bx, by + 1, bz, BlockId.Air);
  player.physics.x = 20.5;
  player.physics.y = 42.0;
  player.physics.z = 20.5;

  const dirtBefore = countItemInInv(player, 'dirt');
  const grassBefore = countItemInInv(player, 'grass');

  const hit = makeHit(bx, by, bz, BlockId.Grass);
  let broken = false;
  for (let i = 0; i < 40 && !broken; i++) {
    broken = player.mineBlockStep(0.05, hit, world, noopEffects, noopSound, (id, count, x, y, z, dur) => {
      drops.spawnDrop(id, count, dur, x, y, z, 0, 2.2, 0);
    });
  }

  assert.equal(broken, true);
  assert.equal(world.getBlock(bx, by, bz), BlockId.Air);
  // Inventory MUST NOT change on block break in Survival Mode
  assert.equal(countItemInInv(player, 'dirt'), dirtBefore);
  assert.equal(countItemInInv(player, 'grass'), grassBefore);
  // World Item Entity must spawn with Dirt at broken block coords
  assert.equal(drops.items.length, 1);
  assert.equal(drops.items[0].itemId, 'dirt');
  assert.equal(drops.items[0].count, 1);
  assert.ok(Math.abs(drops.items[0].x - (bx + 0.5)) < 0.05);
  assert.ok(Math.abs(drops.items[0].z - (bz + 0.5)) < 0.05);
  drops.dispose();
});

test('Part A Test 2: BLOCK_DROP_TABLE, tool tier compatibility, Silk Touch & Creative Mode rules', () => {
  assert.ok(BLOCK_DROP_TABLE[BlockId.Grass]);
  assert.ok(BLOCK_DROP_TABLE[BlockId.Stone]);
  assert.ok(BLOCK_DROP_TABLE[BlockId.IronOre]);
  assert.ok(BLOCK_DROP_TABLE[BlockId.DiamondOre]);

  // Stone requires pickaxe >= tier 1 (Hand drops nothing, Wood Pickaxe drops cobblestone, Silk Touch drops stone)
  assert.equal(isToolCompatibleWithBlock(BlockId.Stone, undefined), false);
  assert.deepEqual(resolveBlockDrops(BlockId.Stone, undefined), []);
  assert.deepEqual(resolveBlockDrops(BlockId.Stone, ITEMS.wood_pickaxe), [{ itemId: 'cobblestone', count: 1 }]);
  assert.deepEqual(resolveBlockDrops(BlockId.Stone, ITEMS.wood_pickaxe, { silkTouch: true }), [{ itemId: 'stone', count: 1 }]);

  // Iron Ore requires Stone Pickaxe (tier 2) or better; Wood Pickaxe is tier 1 -> drops nothing
  assert.deepEqual(resolveBlockDrops(BlockId.IronOre, ITEMS.wood_pickaxe), []);
  assert.deepEqual(resolveBlockDrops(BlockId.IronOre, ITEMS.stone_pickaxe), [{ itemId: 'iron_ore', count: 1 }]);

  // Gold & Diamond require Iron Pickaxe (tier 3)
  assert.deepEqual(resolveBlockDrops(BlockId.GoldOre, ITEMS.stone_pickaxe), []);
  assert.deepEqual(resolveBlockDrops(BlockId.GoldOre, ITEMS.iron_pickaxe), [{ itemId: 'gold_ore', count: 1 }]);
  assert.deepEqual(resolveBlockDrops(BlockId.DiamondOre, ITEMS.iron_pickaxe), [{ itemId: 'diamond', count: 1 }]);

  // Coal, OakLog, Sand, Gravel & deterministic Leaf drop
  assert.deepEqual(resolveBlockDrops(BlockId.CoalOre, ITEMS.wood_pickaxe), [{ itemId: 'coal', count: 1 }]);
  assert.deepEqual(resolveBlockDrops(BlockId.OakLog, undefined), [{ itemId: 'oak_log', count: 1 }]);
  assert.deepEqual(resolveBlockDrops(BlockId.Sand, undefined), [{ itemId: 'sand', count: 1 }]);
  assert.deepEqual(resolveBlockDrops(BlockId.Gravel, undefined), [{ itemId: 'gravel', count: 1 }]);
  assert.deepEqual(resolveBlockDrops(BlockId.OakLeaves, undefined, { rng: () => 0.1 }), [
    { itemId: 'oak_sapling', count: 1 },
    { itemId: 'apple', count: 1 },
  ]);

  // Creative mode produces zero drops even with diamond pickaxe
  assert.deepEqual(resolveBlockDrops(BlockId.DiamondOre, ITEMS.diamond_pickaxe, { gameMode: 'creative' }), []);
});

test('Part A Test 3, 4 & 5: Drop spawns at exact 3D block pos in caves & high towers (never surface/spawn)', () => {
  const world = new WorldManager(202604);
  const player = new PlayerController(202604);
  const scene = new THREE.Scene();
  const drops = new DroppedItemManager(scene);

  // Carve sealed cave at y = 14..16 under solid stone ceiling (y = 17..35)
  for (let x = 2; x <= 6; x++) {
    for (let z = 2; z <= 6; z++) {
      world.setBlock(x, 13, z, BlockId.Stone);
      for (let y = 14; y <= 16; y++) world.setBlock(x, y, z, BlockId.Air);
      for (let y = 17; y <= 36; y++) world.setBlock(x, y, z, BlockId.Stone);
    }
  }
  world.setBlock(4, 14, 4, BlockId.CoalOre);

  // Put player elsewhere so spawn/camera coords cannot leak into drop origin
  player.physics.x = 12.5;
  player.physics.y = 45.0;
  player.physics.z = 12.5;
  player.inv.hotbar[player.inv.selectedSlot] = { itemId: 'wood_pickaxe', count: 1, durability: 60 };

  const caveHit = makeHit(4, 14, 4, BlockId.CoalOre);
  let brokenCave = false;
  for (let i = 0; i < 60 && !brokenCave; i++) {
    brokenCave = player.mineBlockStep(0.05, caveHit, world, noopEffects, noopSound, (id, count, x, y, z, dur) => {
      drops.spawnDrop(id, count, dur, x, y, z, 0, 2.0, 0);
    });
  }
  assert.equal(brokenCave, true);
  assert.equal(drops.items.length, 1);
  assert.equal(drops.items[0].itemId, 'coal');
  // Simulate gravity inside cave -> must rest on cave floor at y=14.14, NOT teleport to surface y=37!
  for (let i = 0; i < 60; i++) {
    drops.update(0.03, 50, 50, 50, world.getCollisionBlock, player.inv, noopSound, () => {});
  }
  assert.ok(drops.items[0].y > 13.9 && drops.items[0].y < 14.5, `cave drop settled on cave floor y=${drops.items[0].y}`);
  assert.equal(drops.items[0].grounded, true);

  // High tower overhang break -> drop spawns at tower height and falls via gravity to terrain below
  for (let y = 10; y <= 62; y++) world.setBlock(10, y, 10, BlockId.Cobblestone);
  world.setBlock(11, 62, 10, BlockId.Cobblestone);
  for (let y = 35; y <= 61; y++) world.setBlock(11, y, 10, BlockId.Air);
  world.setBlock(11, 34, 10, BlockId.Stone);
  world.setBlock(11, 63, 10, BlockId.Air);
  const towerDropPos = resolveBlockBreakDropPosition(11, 62, 10, world.getCollisionBlock);
  assert.equal(towerDropPos.x, 11.5);
  assert.ok(towerDropPos.y >= 62.45 && towerDropPos.y <= 62.55, `tower drop y=${towerDropPos.y}`);
  assert.equal(towerDropPos.z, 10.5);

  world.setBlock(11, 62, 10, BlockId.Air);
  drops.spawnDrop('cobblestone', 1, undefined, towerDropPos.x, towerDropPos.y, towerDropPos.z, 0, 1.2, 0);
  const towerDrop = drops.items[drops.items.length - 1];
  for (let i = 0; i < 160; i++) {
    drops.update(0.03, 50, 50, 50, world.getCollisionBlock, player.inv, noopSound, () => {});
  }
  assert.ok(towerDrop.y < 36, `tower drop fell under gravity to lower terrain (y=${towerDrop.y})`);
  assert.equal(towerDrop.grounded, true);

  drops.dispose();
});

test('Part A Test 6b: Creative mode breaks blocks instantly with 0 drops and 0 tool durability loss', () => {
  const world = new WorldManager(202604);
  const player = new PlayerController(202604, undefined, null, 'creative');
  player.inv.hotbar[0] = { itemId: 'diamond_pickaxe', count: 1, durability: 100 };
  player.inv.selectedSlot = 0;
  world.setBlock(3, 50, 3, BlockId.DiamondOre);

  let spawned = 0;
  const broken = player.mineBlockStep(0.016, makeHit(3, 50, 3, BlockId.DiamondOre), world, noopEffects, noopSound, () => {
    spawned++;
  });
  assert.equal(broken, true);
  assert.equal(world.getBlock(3, 50, 3), BlockId.Air);
  assert.equal(spawned, 0);
  assert.equal(player.inv.hotbar[0]?.durability, 100);
});

test('Part A Test 7, 8 & 9: Walking near drop collects it cleanly; full inventory keeps drop intact without duplication', () => {
  const world = new WorldManager(202604);
  const player = new PlayerController(202604);
  const scene = new THREE.Scene();
  const drops = new DroppedItemManager(scene);

  for (let x = 0; x <= 6; x++) {
    for (let z = 0; z <= 6; z++) {
      world.setBlock(x, 20, z, BlockId.Stone);
      for (let y = 21; y <= 24; y++) world.setBlock(x, y, z, BlockId.Air);
    }
  }
  world.setBlock(3, 21, 3, BlockId.OakLog);
  player.physics.x = 3.5;
  player.physics.y = 21.0;
  player.physics.z = 5.2;

  const logsBefore = countItemInInv(player, 'oak_log');
  let broken = false;
  for (let i = 0; i < 60 && !broken; i++) {
    broken = player.mineBlockStep(0.05, makeHit(3, 21, 3, BlockId.OakLog), world, noopEffects, noopSound, (id, c, x, y, z, dur) => {
      drops.spawnDrop(id, c, dur, x, y, z, 0, 2.0, 0);
    });
  }
  assert.equal(broken, true);
  assert.equal(countItemInInv(player, 'oak_log'), logsBefore);
  assert.equal(drops.items.length, 1);

  // Fill every inventory slot with dirt (64) -> oak_log cannot fit, stays on ground!
  for (let i = 0; i < 9; i++) player.inv.hotbar[i] = { itemId: 'dirt', count: 64 };
  for (let i = 0; i < 27; i++) player.inv.inventory[i] = { itemId: 'dirt', count: 64 };

  player.physics.x = 3.5;
  player.physics.z = 3.6;
  for (let i = 0; i < 30; i++) {
    drops.update(0.04, player.physics.x, player.physics.y, player.physics.z, world.getCollisionBlock, player.inv, noopSound, () => {}, player.getHitbox());
  }
  assert.equal(drops.items.length, 1, 'full inventory must leave dropped item in world');
  assert.equal(drops.items[0].pickingUp, false);
  assert.equal(countItemInInv(player, 'oak_log'), 0);

  // Free slot 8 -> pickup completes cleanly after cooldown with exact count = 1 (zero duplication)
  player.inv.hotbar[8] = null;
  drops.items[0].age = DROP_PICKUP_COOLDOWN + 0.1;
  let collectedCallbacks = 0;
  for (let i = 0; i < 20; i++) {
    drops.update(0.04, player.physics.x, player.physics.y, player.physics.z, world.getCollisionBlock, player.inv, noopSound, () => {
      collectedCallbacks++;
    }, player.getHitbox());
  }
  assert.equal(drops.items.length, 0);
  assert.equal(countItemInInv(player, 'oak_log'), 1);
  assert.equal(collectedCallbacks, 1);
  drops.dispose();
});

test('Part A Test 10 & 11: Breaking Chest drops stored items into world and Save/Load preserves drops & gameMode', () => {
  const world = new WorldManager(202604);
  const player = new PlayerController(202604);
  const scene = new THREE.Scene();
  const drops = new DroppedItemManager(scene);

  world.setBlock(2, 20, 2, BlockId.Stone);
  world.setBlock(2, 21, 2, BlockId.Chest);
  const chest = world.blockEntities.ensureForBlock(BlockId.Chest, 2, 21, 2) as ChestEntity;
  chest.slots[0] = { itemId: 'diamond', count: 4 };
  chest.slots[1] = { itemId: 'bread', count: 2 };

  let broken = false;
  for (let i = 0; i < 60 && !broken; i++) {
    broken = player.mineBlockStep(0.05, makeHit(2, 21, 2, BlockId.Chest), world, noopEffects, noopSound, (id, c, x, y, z, dur) => {
      drops.spawnDrop(id, c, dur, x, y, z, 0, 1.5, 0);
    });
  }
  assert.equal(broken, true);
  assert.equal(drops.items.length, 3); // diamond x4, bread x2, chest x1
  const ids = drops.items.map((d) => `${d.itemId}:${d.count}`).sort();
  assert.deepEqual(ids, ['bread:2', 'chest:1', 'diamond:4']);

  // Save & Load roundtrip preserves droppedItems & gameMode
  const containers = new ContainerController();
  const save = JSON.parse(JSON.stringify(buildWorldSaveData(world, player, containers, 2, 0.4, WeatherType.Clear, drops.exportSavedDrops())));
  const restoredPlayer = new PlayerController(save.seed, save.player, save.respawnPoint, save.gameMode);
  const scene2 = new THREE.Scene();
  const restoredDrops = new DroppedItemManager(scene2);
  restoredDrops.restoreSavedDrops(save.droppedItems);
  assert.equal(restoredPlayer.gameMode, 'survival');
  assert.equal(restoredDrops.items.length, 3);
  drops.dispose();
  restoredDrops.dispose();
});

// ============================================================================
// PART B — CREATURE PROPORTION & ANIMATION OVERHAUL TESTS (1-10)
// ============================================================================

test('Part B Test 1-5: Cow, Pig, Sheep & Chicken rigs have multi-part silhouettes, necks & non-cube proportions', () => {
  const specs: Record<MobType.Cow | MobType.Pig | MobType.Sheep | MobType.Chicken, { legs: number; arms: number }> = {
    [MobType.Cow]: { legs: 4, arms: 0 },
    [MobType.Pig]: { legs: 4, arms: 0 },
    [MobType.Sheep]: { legs: 4, arms: 0 },
    [MobType.Chicken]: { legs: 2, arms: 2 },
  };

  const dims: Record<string, THREE.Vector3> = {};
  for (const type of [MobType.Cow, MobType.Pig, MobType.Sheep, MobType.Chicken] as const) {
    const rig = createMobRig(type);
    assert.ok(rig.neck, `${type} must have an articulated neck bridge`);
    assert.ok(rig.body.children.length >= 3, `${type} torso must be sculpted from >=3 voxel sub-parts (not 1 cube)`);
    assert.equal(rig.legs.length, specs[type].legs);
    assert.equal(rig.arms.length, specs[type].arms);
    assert.ok(rig.tail, `${type} must have an articulated tail`);

    rig.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig.group);
    const size = new THREE.Vector3();
    box.getSize(size);
    dims[type] = size;

    // Verify animal is NOT a 1x1x1 cube (length exceeds width clearly)
    assert.ok(size.z > size.x * 1.15, `${type} body silhouette should be elongated front-to-back (x=${size.x.toFixed(2)}, z=${size.z.toFixed(2)})`);
    assert.ok(box.min.y >= -0.02 && box.min.y <= 0.05, `${type} feet should rest on ground plane (min.y=${box.min.y.toFixed(3)})`);
    disposeMobRig(rig);
  }

  // Verify recognizable scale & proportion hierarchy across species
  assert.ok(dims[MobType.Cow].y > dims[MobType.Sheep].y, 'Cow taller than Sheep');
  assert.ok(dims[MobType.Sheep].y > dims[MobType.Pig].y, 'Sheep taller than Pig');
  assert.ok(dims[MobType.Pig].z > dims[MobType.Chicken].z, 'Pig larger than Chicken');
  disposeSharedMobTextures();
});

test('Part B Test 6-10: Passive & hostile animations, hitbox decoupling & MobManager AI/combat work cleanly', () => {
  for (const type of [MobType.Cow, MobType.Pig, MobType.Sheep, MobType.Chicken]) {
    const rig = createMobRig(type);
    const states = [
      { vx: 0, vy: 0, vz: 0, walkPhase: 0, animTime: 1.4, wanderTimer: 2.0, fleeTimer: 0, hitFlashTimer: 0, koTimer: 0 }, // Idle look
      { vx: 1.5, vy: 0, vz: 0.6, walkPhase: 1.3, animTime: 2.0, wanderTimer: 1.5, fleeTimer: 0, hitFlashTimer: 0, koTimer: 0 }, // Walk
      { vx: 3.1, vy: 0.9, vz: 1.2, walkPhase: 2.4, animTime: 3.1, wanderTimer: 0.8, fleeTimer: 1.4, hitFlashTimer: 0, koTimer: 0 }, // Run/Flee
      { vx: 0, vy: 0, vz: 0, walkPhase: 0, animTime: 2.5, wanderTimer: 0.4, fleeTimer: 0, hitFlashTimer: 0, koTimer: 0 }, // Grazing/Pecking
      { vx: 0.8, vy: 0, vz: 0, walkPhase: 0.5, animTime: 2.6, wanderTimer: 1.0, fleeTimer: 0, hitFlashTimer: 0.09, koTimer: 0 }, // Hurt
      { vx: 0, vy: 0, vz: 0, walkPhase: 0, animTime: 3.0, wanderTimer: 1.0, fleeTimer: 0, hitFlashTimer: 0, koTimer: 0.3 }, // Death
    ];
    for (const s of states) {
      animateMobRig({ type, rig, fuseTimer: -1, attackAnimTimer: 0, ...s }, 0.03);
      assert.ok(Number.isFinite(rig.neck!.rotation.x) && Number.isFinite(rig.head.rotation.x));
    }
    assert.ok(rig.group.rotation.z > 0.1, `${type} topples on death`);
    disposeMobRig(rig);
  }

  // Hitboxes remain decoupled & MobManager spawns/animates/damages animals cleanly
  assert.ok(MOB_HITBOXES[MobType.Cow].height > MOB_HITBOXES[MobType.Pig].height);
  assert.ok(MOB_HITBOXES[MobType.Sheep].eyeHeight > MOB_HITBOXES[MobType.Chicken].eyeHeight);

  const scene = new THREE.Scene();
  const mobs = new MobManager(scene);
  const cow = mobs.spawnMob(MobType.Cow, 10, 20, 10);
  const sheep = mobs.spawnMob(MobType.Sheep, 13, 20, 10);
  mobs.update(0.05, new THREE.Vector3(0, 20, 0), false, () => BlockId.Air, () => 19, {
    onPlayerHurt: () => {},
    onCreeperExplode: () => {},
  });
  const dmgRes = mobs.damageMob(cow, 4, 1, 0);
  assert.equal(dmgRes.killed, false);
  assert.ok(cow.fleeTimer > 0 && sheep.rig.materials.length > 0);
  mobs.dispose();
  disposeSharedMobTextures();
});
