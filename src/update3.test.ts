import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BLOCKS } from './data/blocks';
import { ITEMS } from './data/items';
import { RECIPES } from './data/recipes';
import { createInitialInventory, matchCraftingGrid } from './player/inventory';
import { HeldViewmodel } from './render/heldViewmodel';
import { extractVoxelCells } from './render/voxelGridBuilder';
import { TOOL_BLUEPRINTS, createToolVoxelModel } from './render/voxelToolModels';
import { BlockId } from './types/game';
import { getSmeltRecipe } from './world/furnaceRecipes';
import { buildChunkMesh } from './world/mesher';
import { generateChunk } from './world/worldGen';
import { WorldManager } from './world/worldManager';

test('Update 3.0 registers new terrain, wood species, ores, hoes, and netherite tools', () => {
  const expectedBlocks = [
    BlockId.Gravel, BlockId.Mud, BlockId.BirchLog, BlockId.BirchLeaves,
    BlockId.AcaciaLog, BlockId.AcaciaLeaves, BlockId.DarkOakLog, BlockId.DarkOakLeaves,
    BlockId.CopperOre, BlockId.EmeraldOre, BlockId.WhiteConcrete, BlockId.Terracotta,
    BlockId.BirchPlanks, BlockId.SprucePlanks, BlockId.JunglePlanks,
    BlockId.AcaciaPlanks, BlockId.DarkOakPlanks, BlockId.Shrub,
  ];
  for (const id of expectedBlocks) {
    assert.ok(BLOCKS[id], `Block ${id} should be registered`);
  }

  for (const tier of ['wood', 'stone', 'iron', 'gold', 'diamond', 'netherite']) {
    for (const kind of ['pickaxe', 'axe', 'shovel', 'hoe', 'sword']) {
      const itemId = `${tier}_${kind}`;
      assert.ok(ITEMS[itemId], `Item ${itemId} should exist`);
      assert.ok(RECIPES.some((r) => r.resultItemId === itemId), `Recipe for ${itemId} should exist`);
    }
  }

  assert.equal(getSmeltRecipe('copper_ore')?.outputId, 'copper_ingot');
  assert.equal(getSmeltRecipe('birch_log')?.outputId, 'charcoal');

  const inv = createInitialInventory();
  assert.equal(inv.hotbar.length, 9);
  const hoeMatch = matchCraftingGrid(
    ['iron_ingot', 'iron_ingot', null, null, 'stick', null, null, 'stick', null],
    3,
  );
  assert.equal(hoeMatch?.resultItemId, 'iron_hoe');
});

test('3D voxel tool blueprints and models generate stepped-depth multi-voxel geometry', () => {
  for (const kind of ['pickaxe', 'axe', 'shovel', 'hoe', 'sword'] as const) {
    const cells = extractVoxelCells(TOOL_BLUEPRINTS[kind]);
    assert.ok(cells.length > 10, `${kind} should contain >10 voxel cells`);
    const group = createToolVoxelModel(kind, 'diamond');
    assert.ok(group.children.length > 0, `${kind} model should have 3D mesh children`);
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    assert.ok(size.z > 0.02, `${kind} must have real 3D thickness on Z axis`);
  }
});

test('buildChunkMesh separates water buffer and emits 3D torch and flora geometry', () => {
  const wm = new WorldManager(5150);
  wm.getOrCreateChunk(0, 0);
  wm.setBlock(4, 52, 4, BlockId.Torch);
  wm.setBlock(5, 52, 5, BlockId.Water);
  wm.setBlock(6, 52, 6, BlockId.Shrub);
  wm.setBlock(7, 52, 7, BlockId.FlowerRed);

  const res = buildChunkMesh(0, 0, wm.getBlock);
  assert.ok(res.opaque.positions.length > 0);
  assert.ok(res.water.positions.length > 0, 'Water should be placed in dedicated water buffer');
  assert.equal(res.water.positions.length / 3, res.water.uvs.length / 2);
});

test('worldGen generates diverse surface and underground blocks deterministically', () => {
  const c1 = generateChunk(1, -1, 9090);
  const c2 = generateChunk(1, -1, 9090);
  assert.deepEqual(c1.blocks, c2.blocks);

  let foundStoneOrOre = false;
  for (let i = 0; i < c1.blocks.length; i++) {
    if (c1.blocks[i] === BlockId.CopperOre || c1.blocks[i] === BlockId.CoalOre || c1.blocks[i] === BlockId.Stone) {
      foundStoneOrOre = true;
      break;
    }
  }
  assert.equal(foundStoneOrOre, true);
});

test('HeldViewmodel animates all 8 view states cleanly', () => {
  const vm = new HeldViewmodel();
  vm.updateItem('diamond_pickaxe');
  for (const animKind of ['idle', 'walk', 'sprint', 'jump', 'mine', 'attack', 'place', 'eat'] as const) {
    vm.updateMotion({
      dt: 0.016,
      timeSec: 1.25,
      moveSpeed: animKind === 'walk' ? 4.5 : animKind === 'sprint' ? 6.8 : 0,
      sprinting: animKind === 'sprint',
      onGround: animKind !== 'jump',
      vy: animKind === 'jump' ? 4.2 : 0,
      toolKind: 'pickaxe',
      animKind,
      swingAnim: 0.5,
    });
  }
  assert.ok(Number.isFinite(vm.group.position.x));
  assert.ok(Number.isFinite(vm.group.rotation.x));
  vm.dispose();
});
