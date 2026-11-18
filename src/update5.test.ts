import assert from 'node:assert/strict';
import test from 'node:test';
import { SoundEngine } from './audio/soundEngine';
import {
  CREATIVE_CATEGORIES,
  classifyCreativeItem,
  filterCreativeItems,
  getCreativeCatalogByCategory,
} from './data/creativeCatalog';
import { ITEMS } from './data/items';
import { ContainerController } from './engine/ContainerController';
import { buildHudSnapshot, buildWorldSaveData } from './engine/EngineSnapshot';
import { PlayerController } from './engine/PlayerController';
import { shouldToggleFlightOnSpaceTap, stepCreativeFlight } from './player/flightPhysics';
import { getPlayerBlockCoords, getPlayerCollider } from './player/playerTransform';
import {
  computeTransformedTipDirection,
  FIRST_PERSON_ITEM_TRANSFORMS,
  resolveFirstPersonItemTransform,
} from './render/firstPersonTransforms';
import { HeldViewmodel, ViewAnimKind } from './render/heldViewmodel';
import { LIGHTING_CONFIG } from './render/lightingConfig';
import { EffectsPool } from './render/particles';
import { BlockId, WeatherType } from './types/game';
import { BlockAccessor } from './world/mesher';
import { WorldManager } from './world/worldManager';

if (typeof globalThis.document === 'undefined') {
  const noop = () => {};
  const ctx2d = {
    fillStyle: '#000000',
    fillRect: noop,
    clearRect: noop,
    drawImage: noop,
  };
  (globalThis as Record<string, unknown>).document = {
    createElement: () => ({
      width: 16,
      height: 16,
      getContext: () => ctx2d,
      toDataURL: () => '',
    }),
  };
}

function flatWorld(floorY = 10): BlockAccessor {
  return (_x, y, _z) => (y <= floorY ? BlockId.Stone : BlockId.Air);
}

test('Update 5.0 Part A1: Creative Catalog covers 100% of implemented ITEMS across 10 categories & search', () => {
  assert.equal(CREATIVE_CATEGORIES.length, 10);
  const byCat = getCreativeCatalogByCategory();
  const mappedIds = new Set<string>();
  for (const cat of CREATIVE_CATEGORIES) {
    assert.ok(byCat[cat.id].length > 0, `Category ${cat.id} should contain items`);
    for (const item of byCat[cat.id]) {
      assert.ok(ITEMS[item.id], `Unknown item ${item.id} in catalog`);
      mappedIds.add(item.id);
    }
  }
  for (const id of Object.keys(ITEMS)) {
    assert.ok(mappedIds.has(id), `Item ${id} missing from Creative Catalog`);
    assert.ok(classifyCreativeItem(ITEMS[id]));
  }
  const swords = filterCreativeItems('building_blocks', 'sword');
  assert.ok(swords.some((d) => d.id === 'diamond_sword'));
  assert.ok(filterCreativeItems('tools', '').every((d) => d.category === 'tool' && d.toolKind !== 'sword'));
});

test('Update 5.0 Part A2: Double-tap Space flight toggle & zero-gravity 3D flight physics preserve collider & coords', () => {
  const t1 = shouldToggleFlightOnSpaceTap(0, 1000);
  assert.equal(t1.toggled, false);
  const t2 = shouldToggleFlightOnSpaceTap(t1.nextLastTapMs, 1180);
  assert.equal(t2.toggled, true);
  const t3 = shouldToggleFlightOnSpaceTap(t2.nextLastTapMs, 1250);
  assert.equal(t3.toggled, false);
  const tSlow = shouldToggleFlightOnSpaceTap(1000, 1450);
  assert.equal(tSlow.toggled, false);

  const player = new PlayerController(202604, undefined, null, 'creative');
  player.physics.x = 4.5;
  player.physics.y = 20;
  player.physics.z = 4.5;
  assert.equal(player.toggleFlight(), true);

  const acc = flatWorld(10);
  for (let i = 0; i < 20; i++) {
    stepCreativeFlight(
      player.physics,
      { forward: 1, strafe: 0, yaw: 0, ascend: true, descend: false, sprint: true },
      0.04,
      acc,
    );
  }
  assert.ok(player.physics.y > 24, 'Ascending while flying should gain altitude with zero gravity');
  assert.ok(player.physics.z < 0, 'Forward along yaw=0 should move toward -Z');
  const col = getPlayerCollider(player.physics);
  const coords = getPlayerBlockCoords(player.physics);
  assert.equal(coords.x, Math.floor(player.physics.x));
  assert.equal(coords.y, Math.floor(player.physics.y));
  assert.equal(coords.z, Math.floor(player.physics.z));
  assert.ok(col.maxY - col.minY > 1.7);

  // Descend down onto flat floor at y=11 without clipping into stone
  for (let i = 0; i < 60; i++) {
    stepCreativeFlight(
      player.physics,
      { forward: 0, strafe: 0, yaw: 0, ascend: false, descend: true, sprint: false },
      0.04,
      acc,
    );
  }
  assert.ok(player.physics.y >= 11 - 1e-4, 'Collider must stop cleanly on solid ground while flying');
});

test('Update 5.0 Part A3: Creative mode switching preserves inventory, prevents damage/hunger, keeps Bedrock safe & infinite placement', () => {
  const world = new WorldManager(202604);
  const player = new PlayerController(202604, undefined, null, 'survival');
  const sound = new SoundEngine();
  sound.muted = true;
  const containers = new ContainerController();

  player.inv.hotbar[0] = { itemId: 'stone', count: 12 };
  player.inv.hotbar[1] = { itemId: 'water_bucket', count: 1 };
  player.health = 10;
  player.hunger = 6;

  player.setGameMode('creative');
  assert.equal(player.gameMode, 'creative');
  assert.equal(player.inv.hotbar[0]?.count, 12, 'Switching mode must not wipe inventory');
  assert.equal(player.health, player.maxHealth);
  assert.equal(player.hunger, player.maxHunger);

  // Creative invulnerability
  let died = false;
  player.takeDamage(50, 0, 0, sound, () => {
    died = true;
  });
  assert.equal(died, false);
  assert.equal(player.health, player.maxHealth);

  // Creative inventory pick & hotbar transfer
  assert.equal(containers.pickCreativeItem('diamond_sword', 0, false, player.inv), true);
  assert.equal(containers.cursorItem?.itemId, 'diamond_sword');
  assert.equal(containers.pickCreativeItem('oak_planks', 0, true, player.inv), true);
  assert.ok(player.inv.hotbar.some((s) => s?.itemId === 'oak_planks' && s.count === 64));

  // Creative block placement does not decrement item count
  const px = Math.floor(player.physics.x);
  const py = Math.floor(player.physics.y);
  const pz = Math.floor(player.physics.z) + 4;
  world.setBlock(px, py, pz, BlockId.Stone);
  player.inv.selectedSlot = 0;
  const placed = player.rightClickAction(
    { bx: px, by: py, bz: pz, nx: 0, ny: 1, nz: 0, blockId: BlockId.Stone, distance: 3 },
    null,
    world,
    sound,
    () => {},
  );
  assert.equal(placed, true);
  assert.equal(world.getBlock(px, py + 1, pz), BlockId.Stone);
  assert.equal(player.inv.hotbar[0]?.count, 12, 'Creative placement must not consume blocks');

  // Creative mining breaks Stone instantly with zero drops, but keeps Bedrock indestructible
  const fx = new EffectsPool({ add() {} } as never);
  const spawned: string[] = [];
  const brokeBedrock = player.mineBlockStep(
    0.016,
    { bx: px, by: 0, bz: pz, nx: 0, ny: 1, nz: 0, blockId: BlockId.Bedrock, distance: 3 },
    world,
    fx,
    sound,
    (id) => spawned.push(id),
  );
  assert.equal(brokeBedrock, false, 'Bedrock must remain unbreakable in Creative');

  const brokeStone = player.mineBlockStep(
    0.016,
    { bx: px, by: py + 1, bz: pz, nx: 0, ny: 1, nz: 0, blockId: BlockId.Stone, distance: 3 },
    world,
    fx,
    sound,
    (id) => spawned.push(id),
  );
  assert.equal(brokeStone, true);
  assert.equal(world.getBlock(px, py + 1, pz), BlockId.Air);
  assert.equal(spawned.length, 0, 'Creative break must not drop item entities');

  // Save & restore preserves gameMode + isFlying, and switching back to survival disables flight
  player.toggleFlight();
  assert.equal(player.isFlying, true);
  const save = buildWorldSaveData(world, player, containers, 2, 0.25, WeatherType.Clear);
  assert.equal(save.gameMode, 'creative');
  assert.equal(save.player.isFlying, true);
  const restored = new PlayerController(202604, save.player, save.respawnPoint, save.gameMode);
  assert.equal(restored.gameMode, 'creative');
  assert.equal(restored.isFlying, true);
  const hud = buildHudSnapshot({
    world,
    player: restored,
    containers,
    dayCount: 2,
    timeOfDay: 0.25,
    weather: WeatherType.Clear,
    pointerLocked: false,
    isInventoryOpen: false,
    currentRayHit: null,
    currentMobHit: null,
    statusMessage: null,
  });
  assert.equal(hud.gameMode, 'creative');
  assert.equal(hud.isFlying, true);

  restored.setGameMode('survival');
  assert.equal(restored.isFlying, false);
});

test('Update 5.0 Part B: First-person tool/weapon alignment points forward (-Z) & handles all 8 animations', () => {
  for (const kind of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe'] as const) {
    const profile = FIRST_PERSON_ITEM_TRANSFORMS[kind];
    const dir = computeTransformedTipDirection(profile);
    assert.ok(
      dir.z < -0.5,
      `Tool/Weapon ${kind} tip direction z=${dir.z.toFixed(3)} must aim clearly forward (-Z), not backward/sideways`,
    );
    assert.ok(dir.y > 0.1, `Tool/Weapon ${kind} tip direction y=${dir.y.toFixed(3)} must angle upward naturally`);
  }

  for (const def of Object.values(ITEMS)) {
    const t = resolveFirstPersonItemTransform(def);
    assert.ok(t.scale > 0.5 && t.scale <= 1.0);
  }

  const viewmodel = new HeldViewmodel();
  const anims: ViewAnimKind[] = ['idle', 'walk', 'sprint', 'jump', 'mine', 'attack', 'place', 'eat'];
  for (const itemId of ['diamond_sword', 'iron_pickaxe', 'iron_axe', 'torch', 'oak_planks', 'apple']) {
    viewmodel.updateItem(itemId);
    for (const animKind of anims) {
      viewmodel.updateMotion({
        dt: 0.016,
        timeSec: 1.2,
        moveSpeed: animKind === 'sprint' ? 7 : animKind === 'walk' ? 4.5 : 0,
        sprinting: animKind === 'sprint',
        onGround: animKind !== 'jump',
        vy: animKind === 'jump' ? 3 : 0,
        toolKind: ITEMS[itemId]?.toolKind,
        animKind,
        swingAnim: animKind === 'mine' || animKind === 'attack' || animKind === 'place' || animKind === 'eat' ? 0.5 : 0,
      });
    }
  }
  viewmodel.dispose();
});

test('Update 5.0 Part C: Lighting, exposure, bloom & material reflection bounds are rebalanced', () => {
  assert.ok(LIGHTING_CONFIG.renderer.toneMappingExposure <= 0.95);
  assert.ok(LIGHTING_CONFIG.renderer.environmentIntensity <= 0.35);

  const peakSun = LIGHTING_CONFIG.sun.dayBaseIntensity + LIGHTING_CONFIG.sun.dayAddedIntensity;
  const peakHemi = LIGHTING_CONFIG.hemi.baseIntensity + LIGHTING_CONFIG.hemi.dayAddedIntensity;
  assert.ok(peakSun <= 1.1, `Peak sun intensity ${peakSun} must be <= 1.1`);
  assert.ok(peakHemi <= 0.55, `Peak hemi intensity ${peakHemi} must be <= 0.55`);

  const { opaqueBlock, translucentBlock, water, mobEnvIntensity } = LIGHTING_CONFIG.materials;
  assert.ok(opaqueBlock.roughness >= 0.9);
  assert.equal(opaqueBlock.metalness, 0);
  assert.ok(opaqueBlock.envMapIntensity <= 0.2);

  assert.ok(translucentBlock.envMapIntensity <= 0.5);
  assert.ok(water.roughness >= 0.2);
  assert.ok(water.envMapIntensity <= 0.45);
  assert.ok(mobEnvIntensity <= 0.3);

  assert.ok(LIGHTING_CONFIG.bloom.strength <= 0.1);
  assert.ok(LIGHTING_CONFIG.bloom.threshold >= 0.95);
});
