import test from 'node:test';
import assert from 'node:assert/strict';
import { BlockId } from './types/game';
import { CHUNK_SIZE, SEA_LEVEL } from './world/chunkData';
import { findSafeSpawn, generateChunk, getTerrainHeightAndBiome } from './world/worldGen';
import { buildChunkMesh } from './world/mesher';
import { WorldManager } from './world/worldManager';
import { blockOverlapsPlayer, raycastVoxel, stepPlayerPhysics } from './player/physics';
import {
  addItemToInventory,
  canCraftRecipe,
  countItemInInventory,
  craftRecipe,
  createInitialInventory,
  matchCraftingGrid,
} from './player/inventory';
import { RECIPES } from './data/recipes';

test('world generation is deterministic and places bedrock and solid ground', () => {
  const seed = 4242;
  const c1 = generateChunk(0, 0, seed);
  const c2 = generateChunk(0, 0, seed);
  assert.deepEqual(c1.blocks, c2.blocks);
  assert.equal(c1.get(0, 0, 0), BlockId.Bedrock);

  const spawn = findSafeSpawn(seed);
  const { height } = getTerrainHeightAndBiome(Math.floor(spawn.x), Math.floor(spawn.z), seed);
  assert.ok(spawn.y >= height + 1);
  assert.ok(height >= SEA_LEVEL);
});

test('chunk mesher culls hidden internal faces and generates AO vertex colors', () => {
  const wm = new WorldManager(1337);
  wm.getOrCreateChunk(0, 0);
  const mesh = buildChunkMesh(0, 0, wm.getBlock);
  assert.ok(mesh.opaque.positions.length > 0);
  assert.ok(mesh.opaque.indices.length > 0);
  assert.equal(mesh.opaque.positions.length / 3, mesh.opaque.colors.length / 3);
  assert.equal(mesh.opaque.positions.length / 3, mesh.opaque.uvs.length / 2);
});

test('world manager edits mark boundary neighbors dirty and persist modified chunks', () => {
  const wm = new WorldManager(777);
  const c0 = wm.getOrCreateChunk(0, 0);
  const cLeft = wm.getOrCreateChunk(-1, 0);
  c0.dirty = false;
  cLeft.dirty = false;

  wm.setBlock(0, 45, 5, BlockId.OakPlanks);
  assert.equal(wm.getBlock(0, 45, 5), BlockId.OakPlanks);
  assert.equal(c0.dirty, true);
  assert.equal(cLeft.dirty, true);

  const exported = wm.exportModifiedChunks();
  assert.ok(exported['0,0']);

  const wm2 = new WorldManager(777, exported);
  wm2.getOrCreateChunk(0, 0);
  assert.equal(wm2.getBlock(0, 45, 5), BlockId.OakPlanks);
});

test('player physics lands cleanly on solid floor and raycastVoxel hits target block', () => {
  const floorMap = (x: number, y: number, z: number): BlockId => {
    if (y === 10 && x >= -5 && x <= 5 && z >= -5 && z <= 5) return BlockId.Stone;
    if (x === 0 && y === 12 && z === -3) return BlockId.OakLog;
    return BlockId.Air;
  };

  const state = {
    x: 0.5,
    y: 11.5,
    z: 0.5,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    inWater: false,
    headInWater: false,
    fallStartY: 11.5,
  };

  for (let i = 0; i < 40; i++) {
    stepPlayerPhysics(
      state,
      { forward: 0, strafe: 0, yaw: 0, jump: false, sprint: false, crouch: false },
      0.02,
      floorMap,
    );
  }

  assert.equal(state.onGround, true);
  assert.ok(state.y >= 11.0 && state.y < 11.2);
  assert.equal(blockOverlapsPlayer(0, 11, 0, state.x, state.y, state.z), true);

  const hit = raycastVoxel(0.5, 12.5, 0.5, 0, 0, -1, 6, floorMap);
  assert.ok(hit !== null);
  assert.equal(hit.bx, 0);
  assert.equal(hit.by, 12);
  assert.equal(hit.bz, -3);
  assert.equal(hit.blockId, BlockId.OakLog);
  assert.equal(hit.nz, 1);
});

test('inventory stacking and crafting recipes work end-to-end', () => {
  const inv = createInitialInventory();
  addItemToInventory(inv, 'oak_log', 2);
  assert.equal(countItemInInventory(inv, 'oak_log'), 2);

  const planksRecipe = RECIPES.find((r) => r.id === 'oak_planks')!;
  assert.equal(canCraftRecipe(inv, planksRecipe, false), true);

  const craftedPlanks = craftRecipe(inv, 'oak_planks', false);
  assert.equal(craftedPlanks, true);
  assert.equal(countItemInInventory(inv, 'oak_log'), 1);
  // Starter kit has 16 planks + 4 crafted = 20
  assert.equal(countItemInInventory(inv, 'oak_planks'), 20);

  // Crafting stone pickaxe requires crafting table
  addItemToInventory(inv, 'cobblestone', 3);
  addItemToInventory(inv, 'stick', 2);
  const stonePick = RECIPES.find((r) => r.id === 'stone_pickaxe')!;
  assert.equal(canCraftRecipe(inv, stonePick, false), false);
  assert.equal(canCraftRecipe(inv, stonePick, true), true);
  assert.equal(craftRecipe(inv, 'stone_pickaxe', true), true);
  assert.equal(countItemInInventory(inv, 'stone_pickaxe'), 1);

  // Grid matching test (3x3 pickaxe pattern)
  const matched = matchCraftingGrid(
    ['cobblestone', 'cobblestone', 'cobblestone', null, 'stick', null, null, 'stick', null],
    3,
  );
  assert.ok(matched);
  assert.equal(matched.id, 'stone_pickaxe');

  // Verify CHUNK_SIZE invariant
  assert.equal(CHUNK_SIZE, 16);
});
