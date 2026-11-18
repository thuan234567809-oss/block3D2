import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { SoundEngine } from './audio/soundEngine';
import { isBlockSolid } from './data/blocks';
import { TEX } from './data/blockTextures';
import { ATLAS_GRID_COLS, TEXTURE_MANIFEST, validateTextureManifest } from './data/textureManifest';
import { PlayerController } from './engine/PlayerController';
import { getVoxelItemModel } from './render/voxelItemModels';
import { BlockId } from './types/game';
import { getBlockSelectionBox } from './world/blockBounds';
import { buildChunkMesh, MeshBuffers } from './world/mesher';
import { WorldManager } from './world/worldManager';

function collectUsedTiles(buf: MeshBuffers): Set<number> {
  const used = new Set<number>();
  // Each quad pushes 4 vertices sharing the same tile; take centroid UV of each 4-vertex quad
  for (let v = 0; v < buf.uvs.length / 2; v += 4) {
    let su = 0;
    let sv = 0;
    for (let k = 0; k < 4; k++) {
      su += buf.uvs[(v + k) * 2];
      sv += buf.uvs[(v + k) * 2 + 1];
    }
    const cu = su / 4;
    const cv = sv / 4;
    const col = Math.floor(cu * ATLAS_GRID_COLS);
    const row = Math.floor((1 - cv) * ATLAS_GRID_COLS);
    used.add(row * ATLAS_GRID_COLS + col);
  }
  return used;
}

function measureMeshBounds(buf: MeshBuffers): {
  vertCount: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const vertCount = buf.positions.length / 3;
  for (let i = 0; i < buf.positions.length; i += 3) {
    const x = buf.positions[i];
    const y = buf.positions[i + 1];
    const z = buf.positions[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { vertCount, minX, maxX, minY, maxY, minZ, maxZ };
}

test('Flower Overhaul Phase 1, 2 & 5: Distinct 3D Poppy and Dandelion geometry & dedicated atlas tiles', () => {
  const manifest = validateTextureManifest();
  assert.equal(manifest.valid, true, manifest.errors.join(', '));
  for (const key of [
    'FLOWER_STEM',
    'FLOWER_LEAF',
    'POPPY_PETAL',
    'POPPY_CENTER',
    'DANDELION_PETAL',
    'DANDELION_CENTER',
  ] as const) {
    const entry = TEXTURE_MANIFEST[key];
    assert.ok(entry, `Missing manifest entry ${key}`);
    assert.equal(fs.existsSync(path.join(process.cwd(), 'public', entry.pngPath)), true);
  }

  const poppyMesh = buildChunkMesh(0, 0, (x, y, z) =>
    x === 5 && y === 21 && z === 5 ? BlockId.FlowerRed : BlockId.Air,
  );
  const dandelionMesh = buildChunkMesh(0, 0, (x, y, z) =>
    x === 5 && y === 21 && z === 5 ? BlockId.FlowerYellow : BlockId.Air,
  );

  const pBounds = measureMeshBounds(poppyMesh.opaque);
  const dBounds = measureMeshBounds(dandelionMesh.opaque);

  // True multi-part 3D voxel geometry (>= 200 vertices, not flat 8-vertex crossed quad)
  assert.ok(pBounds.vertCount >= 240, `Poppy must be rich 3D multi-part mesh, got ${pBounds.vertCount} verts`);
  assert.ok(dBounds.vertCount >= 240, `Dandelion must be rich 3D multi-part mesh, got ${dBounds.vertCount} verts`);

  // Poppy stands noticeably taller than compact Dandelion rosette
  assert.ok(pBounds.maxY > dBounds.maxY + 0.08, `Poppy (${pBounds.maxY}) should be taller than Dandelion (${dBounds.maxY})`);

  // Dedicated botanical tiles only — never BED_BLANKET or GOLD_ORE
  const poppyTiles = collectUsedTiles(poppyMesh.opaque);
  assert.equal(poppyTiles.has(TEX.FLOWER_STEM), true);
  assert.equal(poppyTiles.has(TEX.FLOWER_LEAF), true);
  assert.equal(poppyTiles.has(TEX.POPPY_PETAL), true);
  assert.equal(poppyTiles.has(TEX.POPPY_CENTER), true);
  assert.equal(poppyTiles.has(TEX.BED_BLANKET), false);

  const dandelionTiles = collectUsedTiles(dandelionMesh.opaque);
  assert.equal(dandelionTiles.has(TEX.FLOWER_STEM), true);
  assert.equal(dandelionTiles.has(TEX.FLOWER_LEAF), true);
  assert.equal(dandelionTiles.has(TEX.DANDELION_PETAL), true);
  assert.equal(dandelionTiles.has(TEX.DANDELION_CENTER), true);
  assert.equal(dandelionTiles.has(TEX.GOLD_ORE), false);
});

test('Flower Overhaul Phase 3 & 4: Grounding flush at y, cell containment, unit normals, and chunk batching', () => {
  const elevations = [12, 24, 52];
  for (const baseY of elevations) {
    for (const [lx, lz] of [
      [2, 3],
      [7, 9],
      [13, 4],
    ]) {
      for (const id of [BlockId.FlowerRed, BlockId.FlowerYellow]) {
        const res = buildChunkMesh(0, 0, (x, y, z) => (x === lx && y === baseY && z === lz ? id : BlockId.Air));
        const b = measureMeshBounds(res.opaque);
        assert.ok(Math.abs(b.minY - baseY) < 1e-5, `Flower ${id} at y=${baseY} must ground flush, got minY=${b.minY}`);
        assert.ok(b.maxY < baseY + 1.0, `Flower ${id} height ${b.maxY - baseY} must stay within cell`);
        assert.ok(b.minX >= lx && b.maxX <= lx + 1, `Flower ${id} X [${b.minX}, ${b.maxX}] must stay in [${lx}, ${lx + 1}]`);
        assert.ok(b.minZ >= lz && b.maxZ <= lz + 1, `Flower ${id} Z [${b.minZ}, ${b.maxZ}] must stay in [${lz}, ${lz + 1}]`);

        for (let i = 0; i < res.opaque.normals.length; i += 3) {
          const nx = res.opaque.normals[i];
          const ny = res.opaque.normals[i + 1];
          const nz = res.opaque.normals[i + 2];
          const len = Math.hypot(nx, ny, nz);
          assert.ok(Math.abs(len - 1) < 1e-4, `Normal must be unit length, got ${len}`);
        }
      }
    }
  }

  // Coexistence with Grass, TallGrass, Shrub, and Sapling in one single chunk batch
  const batched = buildChunkMesh(0, 0, (x, y, z) => {
    if (y === 20 && x >= 2 && x <= 8 && z === 5) return BlockId.Grass;
    if (y === 21 && z === 5) {
      if (x === 2) return BlockId.FlowerRed;
      if (x === 3) return BlockId.FlowerYellow;
      if (x === 4) return BlockId.TallGrass;
      if (x === 5) return BlockId.Shrub;
      if (x === 6) return BlockId.OakSapling;
    }
    return BlockId.Air;
  });
  assert.ok(batched.opaque.positions.length > 0);
  assert.equal(batched.translucent.positions.length, 0);
  assert.equal(batched.water.positions.length, 0);
});

test('Flower Overhaul Phase 6 & 7: Collision, hitbox, Survival drop, Creative break, Save/Load & 3D held item models', () => {
  assert.equal(isBlockSolid(BlockId.FlowerRed), false);
  assert.equal(isBlockSolid(BlockId.FlowerYellow), false);

  const wm = new WorldManager(777);
  wm.getOrCreateChunk(0, 0);
  for (let x = 2; x <= 8; x++) {
    for (let z = 2; z <= 8; z++) {
      wm.setBlock(x, 20, z, BlockId.Grass);
      wm.setBlock(x, 21, z, BlockId.Air);
    }
  }
  wm.setBlock(4, 21, 4, BlockId.FlowerRed);
  wm.setBlock(5, 21, 4, BlockId.FlowerYellow);

  const selPoppy = getBlockSelectionBox(4, 21, 4, wm.getBlock, wm.getBlockMeta);
  assert.ok(selPoppy);
  assert.equal(selPoppy.minY, 21);
  assert.ok(selPoppy.maxY > 21.5);

  const sound = new SoundEngine();
  sound.muted = true;
  const noopEffects = { spawnBurst: () => {} } as never;
  const player = new PlayerController(777);
  player.inv.hotbar.fill(null);

  const drops: { itemId: string; count: number }[] = [];
  for (let i = 0; i < 10; i++) {
    if (
      player.mineBlockStep(
        0.1,
        { bx: 4, by: 21, bz: 4, nx: 0, ny: 1, nz: 0, blockId: BlockId.FlowerRed, distance: 2 },
        wm,
        noopEffects,
        sound,
        (itemId, count) => drops.push({ itemId, count }),
      )
    ) {
      break;
    }
  }
  assert.equal(wm.getBlock(4, 21, 4), BlockId.Air);
  assert.deepEqual(drops, [{ itemId: 'flower_red', count: 1 }]);
  assert.equal(player.inv.hotbar[0], null, 'Survival mining must drop 3D item rather than auto-inserting into inventory');

  // Save/Load preserves planted flowers
  const saved = wm.exportModifiedChunks();
  const reloaded = new WorldManager(777, saved);
  reloaded.getOrCreateChunk(0, 0);
  assert.equal(reloaded.getBlock(5, 21, 4), BlockId.FlowerYellow);
  assert.equal(reloaded.getBlock(4, 21, 4), BlockId.Air);

  // 3D held/dropped item prototypes are distinct multi-part matte groups
  const poppyItem = getVoxelItemModel('flower_red');
  const dandelionItem = getVoxelItemModel('flower_yellow');
  let poppyMeshes = 0;
  let dandelionMeshes = 0;
  const checkMatte = (grp: typeof poppyItem, counter: () => void) => {
    grp.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        counter();
        assert.ok(obj.material.roughness >= 0.8, `Flower item material must be matte, got roughness=${obj.material.roughness}`);
        assert.equal(obj.material.metalness, 0.0);
      }
    });
  };
  checkMatte(poppyItem, () => poppyMeshes++);
  checkMatte(dandelionItem, () => dandelionMeshes++);
  assert.ok(poppyMeshes >= 10, `Poppy item should have >= 10 meshes, got ${poppyMeshes}`);
  assert.ok(dandelionMeshes >= 11, `Dandelion item should have >= 11 meshes, got ${dandelionMeshes}`);
  assert.notEqual(poppyMeshes, dandelionMeshes);
});
