import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SoundEngine } from './audio/soundEngine';
import { BLOCKS } from './data/blocks';
import { TEX } from './data/blockTextures';
import { TEXTURE_ASSET_LIST, TEXTURE_MANIFEST, getAtlasTileUv, validateTextureManifest } from './data/textureManifest';
import { resolveBedSleep } from './engine/EngineSnapshot';
import { PlayerController } from './engine/PlayerController';
import { stepDropBody } from './entities/droppedItemPhysics';
import { PhysicsState, stepPlayerPhysics } from './player/physics';
import { LIGHTING_CONFIG } from './render/lightingConfig';
import { getVoxelItemModel } from './render/voxelItemModels';
import { BiomeId, BlockId, WeatherType } from './types/game';
import { BIOMES } from './world/biome';
import { getBlockCollisionBox, getBlockSelectionBox } from './world/blockBounds';
import { CUBE_FACES, resolveCubeFaceTileAndUv } from './world/blockModels';
import {
  decodeBlockMeta,
  encodeBlockMeta,
  facingToForwardDelta,
  facingToFrontDir,
  getBedPartnerCoords,
  yawToCardinalFacing,
} from './world/blockOrientation';
import { buildChunkMesh } from './world/mesher';
import { WorldManager } from './world/worldManager';

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${filePath} must be valid PNG`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

test('Visual Overhaul Phase 1 & 7: Texture manifest and exported 16x16 RGBA PNG assets on disk', () => {
  const check = validateTextureManifest();
  assert.equal(check.valid, true, `Manifest errors: ${check.errors.join(', ')}`);
  assert.equal(TEXTURE_ASSET_LIST.length, 93);

  for (const entry of TEXTURE_ASSET_LIST) {
    const filePath = path.join(process.cwd(), 'public', entry.pngPath);
    assert.equal(fs.existsSync(filePath), true, `Missing PNG asset: ${filePath}`);
    const dims = readPngDimensions(filePath);
    assert.equal(dims.width, 16, `${entry.key} width must be 16`);
    assert.equal(dims.height, 16, `${entry.key} height must be 16`);

    const uv = getAtlasTileUv(entry.index);
    assert.ok(uv.u0 >= 0 && uv.u1 <= 1 && uv.u0 < uv.u1);
    assert.ok(uv.v0 >= 0 && uv.v1 <= 1 && uv.v0 < uv.v1);
  }

  const atlasDims = readPngDimensions(path.join(process.cwd(), 'public/assets/textures/atlas.png'));
  assert.equal(atlasDims.width, 256);
  assert.equal(atlasDims.height, 256);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'public/assets/textures/manifest.json')), true);
  assert.equal(TEXTURE_MANIFEST.FURNACE_FRONT.index, TEX.FURNACE_FRONT);
});

test('Visual Overhaul Phase 1 & 2: Distinct per-face textures, directional facing & Log axis UV rotation', () => {
  assert.notEqual(BLOCKS[BlockId.Grass].textures.top, BLOCKS[BlockId.Grass].textures.side);
  assert.notEqual(BLOCKS[BlockId.Grass].textures.side, BLOCKS[BlockId.Grass].textures.bottom);
  assert.equal(BLOCKS[BlockId.Furnace].textures.front, TEX.FURNACE_FRONT);
  assert.equal(BLOCKS[BlockId.Furnace].textures.side, TEX.FURNACE_SIDE);
  assert.equal(BLOCKS[BlockId.Furnace].textures.back, TEX.FURNACE_BACK);
  assert.equal(BLOCKS[BlockId.CraftingTable].textures.front, TEX.CRAFTING_FRONT);
  assert.equal(BLOCKS[BlockId.CraftingTable].textures.side, TEX.CRAFTING_SIDE);
  assert.equal(BLOCKS[BlockId.CraftingTable].textures.back, TEX.OAK_PLANKS);
  assert.equal(BLOCKS[BlockId.Chest].textures.front, TEX.CHEST_FRONT);
  assert.notEqual(TEX.CHEST_FRONT, TEX.CHEST_SIDE);

  // Cardinal facing maps Furnace front to exact face pointing toward player
  assert.equal(yawToCardinalFacing(0), 0);
  assert.equal(yawToCardinalFacing(-Math.PI / 2), 1);
  assert.equal(yawToCardinalFacing(Math.PI), 2);
  assert.equal(yawToCardinalFacing(Math.PI / 2), 3);

  for (const facing of [0, 1, 2, 3] as const) {
    const meta = encodeBlockMeta({ facing });
    const [fx, , fz] = facingToFrontDir(facing);
    let frontCount = 0;
    let backCount = 0;
    for (let f = 0; f < CUBE_FACES.length; f++) {
      const dir = CUBE_FACES[f].dir;
      const resolved = resolveCubeFaceTileAndUv(BLOCKS[BlockId.Furnace], f, meta, 0);
      if (dir[0] === fx && dir[2] === fz) {
        assert.equal(resolved.tileIndex, TEX.FURNACE_FRONT);
        frontCount++;
      } else if (dir[0] === -fx && dir[2] === -fz) {
        assert.equal(resolved.tileIndex, TEX.FURNACE_BACK);
        backCount++;
      } else if (dir[1] === 0) {
        assert.equal(resolved.tileIndex, TEX.FURNACE_SIDE);
      } else {
        assert.equal(resolved.tileIndex, TEX.FURNACE_TOP);
      }
    }
    assert.equal(frontCount, 1);
    assert.equal(backCount, 1);
  }

  // Log placement axes rotate bark rings to cap faces and rotate side UVs
  const logXMeta = encodeBlockMeta({ axis: 'x' });
  const logZMeta = encodeBlockMeta({ axis: 'z' });
  for (let f = 0; f < CUBE_FACES.length; f++) {
    const dir = CUBE_FACES[f].dir;
    const rx = resolveCubeFaceTileAndUv(BLOCKS[BlockId.OakLog], f, logXMeta, 0);
    assert.equal(rx.tileIndex, dir[0] !== 0 ? TEX.OAK_LOG_TOP : TEX.OAK_LOG_SIDE);
    const rz = resolveCubeFaceTileAndUv(BLOCKS[BlockId.OakLog], f, logZMeta, 0);
    assert.equal(rz.tileIndex, dir[2] !== 0 ? TEX.OAK_LOG_TOP : TEX.OAK_LOG_SIDE);
  }
});

test('Visual Overhaul Phase 2 & 3: WorldManager oriented placement, 2-block Bed validation & Save/Load meta persistence', () => {
  const wm = new WorldManager(202604);
  wm.getOrCreateChunk(0, 0);
  // Build flat platform at y=20
  for (let x = 2; x <= 10; x++) {
    for (let z = 2; z <= 10; z++) {
      wm.setBlock(x, 20, z, BlockId.OakPlanks);
      wm.setBlock(x, 21, z, BlockId.Air);
      wm.setBlock(x, 22, z, BlockId.Air);
    }
  }

  // Place Bed facing = 1 (+X -> foot at x=4, head at x=5)
  const placedOk = wm.placeOrientedBlock(4, 21, 5, BlockId.Bed, 1);
  assert.equal(placedOk.placed, true);
  assert.equal(wm.getBlock(4, 21, 5), BlockId.Bed);
  assert.equal(wm.getBlock(5, 21, 5), BlockId.Bed);
  const footMeta = decodeBlockMeta(wm.getBlockMeta(4, 21, 5));
  const headMeta = decodeBlockMeta(wm.getBlockMeta(5, 21, 5));
  assert.equal(footMeta.part, 'foot');
  assert.equal(headMeta.part, 'head');
  assert.equal(footMeta.facing, 1);
  assert.equal(headMeta.facing, 1);

  const partnerFromFoot = getBedPartnerCoords(4, 21, 5, wm.getBlockMeta(4, 21, 5));
  assert.deepEqual(partnerFromFoot, { x: 5, y: 21, z: 5 });
  const partnerFromHead = getBedPartnerCoords(5, 21, 5, wm.getBlockMeta(5, 21, 5));
  assert.deepEqual(partnerFromHead, { x: 4, y: 21, z: 5 });

  // Obstruction check: wall right ahead blocks Bed placement cleanly
  wm.setBlock(7, 21, 8, BlockId.Stone);
  const blocked = wm.placeOrientedBlock(6, 21, 8, BlockId.Bed, 1);
  assert.equal(blocked.placed, false);
  assert.ok(blocked.failReason);
  assert.equal(wm.getBlock(6, 21, 8), BlockId.Air);

  // Horizontal OakLog & Furnace orientation persisted across Save/Load
  wm.placeOrientedBlock(3, 21, 3, BlockId.Furnace, 2);
  wm.placeOrientedBlock(3, 21, 4, BlockId.OakLog, 0, 1, 0, 0);

  const savedChunks = wm.exportModifiedChunks();
  const savedMeta = wm.exportModifiedChunkMeta();
  const reloaded = new WorldManager(202604, savedChunks, wm.blockEntities.serialize(), savedMeta);
  reloaded.getOrCreateChunk(0, 0);

  assert.equal(decodeBlockMeta(reloaded.getBlockMeta(3, 21, 3)).facing, 2);
  assert.equal(decodeBlockMeta(reloaded.getBlockMeta(3, 21, 4)).axis, 'x');
  assert.equal(decodeBlockMeta(reloaded.getBlockMeta(4, 21, 5)).part, 'foot');
  assert.equal(decodeBlockMeta(reloaded.getBlockMeta(5, 21, 5)).part, 'head');
});

test('Visual Overhaul Phase 3 & 4: Breaking either Bed half breaks both, single drop in Survival, 0 in Creative, collision & 2-block selection bounds', () => {
  const wm = new WorldManager(12345);
  wm.getOrCreateChunk(0, 0);
  for (let x = 2; x <= 9; x++) {
    for (let z = 2; z <= 9; z++) {
      wm.setBlock(x, 20, z, BlockId.Stone);
      for (let y = 21; y <= 25; y++) wm.setBlock(x, y, z, BlockId.Air);
    }
  }
  const facing = 0; // Forward delta = (0, -1) -> foot (5,21,6), head (5,21,5)
  const delta = facingToForwardDelta(facing);
  assert.deepEqual(delta, { dx: 0, dz: -1 });
  assert.equal(wm.placeBed(5, 21, 6, facing), true);

  // Selection box spans BOTH blocks cleanly
  const selFromFoot = getBlockSelectionBox(5, 21, 6, wm.getBlock, wm.getBlockMeta);
  const selFromHead = getBlockSelectionBox(5, 21, 5, wm.getBlock, wm.getBlockMeta);
  assert.ok(selFromFoot && selFromHead);
  assert.deepEqual(selFromFoot, selFromHead);
  assert.equal(selFromFoot.maxZ - selFromFoot.minZ, 2);
  assert.equal(selFromFoot.maxX - selFromFoot.minX, 1);
  assert.equal(selFromFoot.maxY, 21.82);

  // Collision box height matches mattress top (0.5625) for player & item drops
  const bedCol = getBlockCollisionBox(BlockId.Bed, 5, 21, 6);
  assert.equal(bedCol?.maxY, 21.5625);
  const pState: PhysicsState = {
    x: 5.5, y: 22.1, z: 6.5, vx: 0, vy: -2.0, vz: 0,
    onGround: false, inWater: false, headInWater: false, fallStartY: 22.1,
  };
  for (let i = 0; i < 20; i++) {
    stepPlayerPhysics(pState, { forward: 0, strafe: 0, yaw: 0, jump: false, sprint: false, crouch: false }, 0.03, wm.getCollisionBlock);
  }
  assert.equal(pState.onGround, true);
  assert.ok(Math.abs(pState.y - 21.5625) < 0.01, `Player must stand at mattress top 21.5625, got ${pState.y}`);

  const dropBody = {
    itemId: 'apple',
    count: 1,
    x: 5.5,
    y: 22.4,
    z: 6.5,
    vx: 0,
    vy: -2.0,
    vz: 0,
    age: 0,
    grounded: false,
    pickingUp: false,
    pickupProgress: 0,
  };
  for (let i = 0; i < 40; i++) stepDropBody(dropBody, 0.03, wm.getCollisionBlock);
  assert.ok(dropBody.y >= 21.5625 && dropBody.y < 21.85, `Item must rest on mattress top, got y=${dropBody.y}`);

  // Mining HEAD half in Survival breaks both halves & drops exactly 1 bed
  const sound = new SoundEngine();
  sound.muted = true;
  const noopEffects = { spawnBurst: () => {} } as never;
  const player = new PlayerController(12345);
  player.inv.selectedSlot = 0;
  player.inv.hotbar[0] = null;

  const drops: { itemId: string; count: number }[] = [];
  for (let i = 0; i < 20; i++) {
    const done = player.mineBlockStep(
      0.1,
      { bx: 5, by: 21, bz: 5, nx: 0, ny: 1, nz: 0, blockId: BlockId.Bed, distance: 2 },
      wm,
      noopEffects,
      sound,
      (itemId, count) => drops.push({ itemId, count }),
    );
    if (done) break;
  }
  assert.equal(wm.getBlock(5, 21, 5), BlockId.Air);
  assert.equal(wm.getBlock(5, 21, 6), BlockId.Air);
  assert.equal(drops.length, 1);
  assert.equal(drops[0].itemId, 'bed');
  assert.equal(drops[0].count, 1);

  // Creative mode break drops 0 items and breaks both halves immediately
  wm.placeBed(5, 21, 6, 1);
  player.setGameMode('creative');
  const creativeDrops: string[] = [];
  const brokenCreative = player.mineBlockStep(
    0.016,
    { bx: 6, by: 21, bz: 6, nx: 0, ny: 1, nz: 0, blockId: BlockId.Bed, distance: 2 },
    wm,
    noopEffects,
    sound,
    (id) => creativeDrops.push(id),
  );
  assert.equal(brokenCreative, true);
  assert.equal(wm.getBlock(5, 21, 6), BlockId.Air);
  assert.equal(wm.getBlock(6, 21, 6), BlockId.Air);
  assert.equal(creativeDrops.length, 0);

  // Sleep & Respawn flow still works
  const sleepRes = resolveBedSleep(player, 5, 21, 6, 0.72, 1, WeatherType.Clear);
  assert.equal(sleepRes.dayCount, 2);
  assert.ok(player.respawnPoint);
});

test('Visual Overhaul Phase 3, 4, 5 & 6: Multi-part Bed/Chest/Anvil meshes, grounded plants, reduced grass density & matte lighting', () => {
  const wm = new WorldManager(999);
  wm.getOrCreateChunk(0, 0);
  for (let x = 1; x < 14; x++) {
    for (let z = 1; z < 14; z++) {
      wm.setBlock(x, 20, z, BlockId.Grass);
      wm.setBlock(x, 21, z, BlockId.Air);
    }
  }
  wm.placeBed(3, 21, 4, 0);
  wm.setBlock(6, 21, 6, BlockId.Chest, 2);
  wm.setBlock(8, 21, 6, BlockId.Anvil, 1);
  wm.setBlock(10, 21, 6, BlockId.TallGrass);
  wm.setBlock(11, 21, 6, BlockId.FlowerRed);

  const bedMesh = buildChunkMesh(0, 0, (x, y, z) => {
    if ((x === 3 && y === 21 && (z === 4 || z === 3))) return BlockId.Bed;
    return BlockId.Air;
  }, wm.getBlockMeta);
  // Two halves -> legs + frame + headboard + finials + footboard + mattress + pillow + blanket + trim (>= 220 verts)
  assert.ok(bedMesh.opaque.positions.length / 3 >= 220, 'Bed mesh must have detailed multi-part 3D geometry');

  const chestMesh = buildChunkMesh(0, 0, (x, y, z) => (x === 6 && y === 21 && z === 6 ? BlockId.Chest : BlockId.Air), wm.getBlockMeta);
  // Base + lid + 3D iron latch = 3 boxes * 24 verts = 72 verts
  assert.equal(chestMesh.opaque.positions.length / 3, 72);
  const chestBox = getBlockCollisionBox(BlockId.Chest, 6, 21, 6);
  assert.equal(chestBox?.maxY, 21.875);

  const plantMesh = buildChunkMesh(0, 0, (x, y, z) => (x === 10 && y === 21 && z === 6 ? BlockId.TallGrass : BlockId.Air), wm.getBlockMeta);
  let minPlantY = Infinity;
  for (let i = 1; i < plantMesh.opaque.positions.length; i += 3) {
    minPlantY = Math.min(minPlantY, plantMesh.opaque.positions[i]);
  }
  assert.equal(minPlantY, 21, 'TallGrass must sit flush at y=21 without floating or clipping');

  // Grass density rebalanced down (no tall-grass spam)
  assert.ok(BIOMES[BiomeId.Plains].grassDensity <= 0.08);
  assert.ok(BIOMES[BiomeId.Forest].grassDensity <= 0.06);

  // Strictly matte terrain materials
  assert.ok(LIGHTING_CONFIG.materials.opaqueBlock.roughness >= 0.94);
  assert.equal(LIGHTING_CONFIG.materials.opaqueBlock.metalness, 0.0);
  assert.ok(LIGHTING_CONFIG.materials.opaqueBlock.envMapIntensity <= 0.15);
  assert.ok(LIGHTING_CONFIG.materials.translucentBlock.roughness < 0.3);

  // Held/dropped 3D Bed item is multi-part voxel bed group
  const bedItemGroup = getVoxelItemModel('bed');
  assert.ok(bedItemGroup.children.length >= 10, `3D Bed item should have >= 10 parts, got ${bedItemGroup.children.length}`);
});
