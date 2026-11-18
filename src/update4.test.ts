import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { computePlayerDropSpawn, buildHudSnapshot, buildWorldSaveData } from './engine/EngineSnapshot';
import { ContainerController } from './engine/ContainerController';
import { PlayerController } from './engine/PlayerController';
import {
  canCollectDrop,
  canInventoryAcceptAny,
  DroppedItemBody,
  DROP_PICKUP_COOLDOWN,
  findDropShadowY,
  mergeNearbyDropBodies,
  resolveSafeDropOrigin,
  stepDropBody,
} from './entities/droppedItemPhysics';
import { DroppedItemManager } from './entities/droppedItems';
import { MobManager } from './entities/mobManager';
import { canMobExecuteAttack, evaluateMobTarget } from './entities/mobTargeting';
import { addItemToInventory, createInitialInventory } from './player/inventory';
import { aabbCollidesWorld, blockOverlapsPlayer, PhysicsState, raycastVoxel, stepPlayerPhysics } from './player/physics';
import {
  computeDistance3D,
  getPlayerBlockCoords,
  getPlayerCollider,
  getPlayerEyeHeight,
  getPlayerHitbox,
  hasLineOfSightVoxel,
  PLAYER_CROUCH_EYE_HEIGHT,
  PLAYER_EYE_HEIGHT,
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
} from './player/playerTransform';
import { BlockId, MobType, WeatherType } from './types/game';
import { BlockAccessor } from './world/mesher';
import { WorldManager } from './world/worldManager';

function makeFlatWorld(floorY = 10): {
  blocks: Map<string, BlockId>;
  getBlock: BlockAccessor;
  setBlock: (x: number, y: number, z: number, id: BlockId) => void;
} {
  const blocks = new Map<string, BlockId>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const setBlock = (x: number, y: number, z: number, id: BlockId) => {
    if (id === BlockId.Air) blocks.delete(key(x, y, z));
    else blocks.set(key(x, y, z), id);
  };
  const getBlock: BlockAccessor = (x, y, z) => {
    if (y <= floorY) return blocks.get(key(x, y, z)) ?? BlockId.Stone;
    return blocks.get(key(x, y, z)) ?? BlockId.Air;
  };
  return { blocks, getBlock, setBlock };
}

function makePhysics(x: number, y: number, z: number): PhysicsState {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    inWater: false,
    headInWater: false,
    fallStartY: y,
  };
}

function makeDrop(itemId: string, count: number, x: number, y: number, z: number, age = 1.0): DroppedItemBody {
  return {
    itemId,
    count,
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    age,
    grounded: false,
    pickingUp: false,
    pickupProgress: 0,
  };
}

// ============================================================================
// PART A — WORLD POSITION, HITBOX, PHYSICS, MOB 3D LOS & SAVE/LOAD TESTS (1-6)
// ============================================================================

test('Part A Test 1: Ground movement updates Player position, collider, hitbox and block coords synchronously', () => {
  const { getBlock } = makeFlatWorld(10);
  const p = makePhysics(0.5, 11.0, 0.5);
  for (let i = 0; i < 30; i++) {
    stepPlayerPhysics(p, { forward: 1, strafe: 0, yaw: Math.PI, jump: false, sprint: false, crouch: false }, 0.03, getBlock);
  }
  assert.ok(p.z > 2.5, 'player moved forward in +Z');
  const col = getPlayerCollider(p);
  const hb = getPlayerHitbox(p, false);
  const coords = getPlayerBlockCoords(p);
  assert.equal(col.minX, p.x - 0.3);
  assert.equal(hb.eyeY, p.y + PLAYER_EYE_HEIGHT);
  assert.equal(coords.x, Math.floor(p.x));
  assert.equal(coords.y, Math.floor(p.y));
  assert.equal(coords.z, Math.floor(p.z));

  // Negative coordinate floor rounding (must not emit -0 or +1 offset)
  const neg = getPlayerBlockCoords({ x: -0.25, y: 11.0, z: -1.8 });
  assert.equal(neg.x, -1);
  assert.equal(neg.y, 11);
  assert.equal(neg.z, -2);
  const zeroNeg = getPlayerBlockCoords({ x: -0.0, y: 0, z: 0.2 });
  assert.ok(!Object.is(zeroNeg.x, -0));
});

test('Part A Test 2: Underground cave coordinates, HUD snapshot & ceiling occlusion work at real depth', () => {
  const world = new WorldManager(202604);
  const player = new PlayerController(202604);
  // Carve an underground chamber at y = 14..17 beneath solid stone ceiling (y >= 18)
  for (let x = 2; x <= 6; x++) {
    for (let z = 2; z <= 6; z++) {
      for (let y = 14; y <= 17; y++) {
        world.setBlock(x, y, z, BlockId.Air);
      }
      world.setBlock(x, 13, z, BlockId.Stone);
      world.setBlock(x, 18, z, BlockId.Stone);
    }
  }
  player.physics.x = 4.5;
  player.physics.y = 14.0;
  player.physics.z = 4.5;
  player.physics.onGround = true;

  const containers = new ContainerController();
  const hud = buildHudSnapshot({
    world,
    player,
    containers,
    dayCount: 1,
    timeOfDay: 0.25,
    weather: WeatherType.Clear,
    pointerLocked: true,
    isInventoryOpen: false,
    currentRayHit: null,
    currentMobHit: null,
    statusMessage: null,
  });

  assert.equal(hud.playerCoords.x, 4);
  assert.equal(hud.playerCoords.y, 14);
  assert.equal(hud.playerCoords.z, 4);

  // Surface mob at y = 40 above solid stone ceiling cannot see or attack underground player
  const surfaceEval = evaluateMobTarget(4.5, 40.0, 4.5, MobType.Zombie, player.getHitbox(), world.getCollisionBlock);
  assert.ok(surfaceEval.dist3D > 18);
  assert.equal(surfaceEval.hasVisualLos, false);
  assert.equal(canMobExecuteAttack(4.5, 40.0, 4.5, MobType.Zombie, 2.2, player.getHitbox(), true, world.getCollisionBlock), false);
});

test('Part A Test 3: Vertical tower building, step-up stability, crouch eye height & crouch ledge guard', () => {
  const { setBlock, getBlock } = makeFlatWorld(10);
  // Build a 1x1x5 pillar from y=11..15
  for (let y = 11; y <= 15; y++) setBlock(2, y, 2, BlockId.Cobblestone);

  const p = makePhysics(2.5, 16.0, 2.5);
  p.onGround = true;
  // Walk forward while crouching on top of the 1x1 tower -> must NOT fall off the ledge
  for (let i = 0; i < 40; i++) {
    stepPlayerPhysics(p, { forward: 1, strafe: 0, yaw: 0, jump: false, sprint: false, crouch: true }, 0.03, getBlock);
  }
  assert.ok(p.y >= 15.99, `crouch kept player on tower at y=${p.y}`);
  assert.ok(p.z >= 1.69 && p.z <= 3.31, `crouch kept player footprint overlapping pillar [2,3] z=${p.z}`);

  const crouchHb = getPlayerHitbox(p, true);
  assert.equal(crouchHb.eyeY, p.y + PLAYER_CROUCH_EYE_HEIGHT);
  assert.equal(getPlayerEyeHeight(true), PLAYER_CROUCH_EYE_HEIGHT);
});

test('Part A Test 4: Fast falling uses swept vertical resolution (no mid-air snapping) & applies fall damage', () => {
  const { getBlock } = makeFlatWorld(10);
  const p = makePhysics(0.5, 45.0, 0.5);
  p.fallStartY = 45.0;
  let totalFallDamage = 0;
  let landedOnce = false;

  for (let i = 0; i < 120; i++) {
    const res = stepPlayerPhysics(
      p,
      { forward: 0, strafe: 0, yaw: 0, jump: false, sprint: false, crouch: false },
      0.04,
      getBlock,
    );
    totalFallDamage += res.fallDamage;
    if (res.landed) {
      landedOnce = true;
      break;
    }
    // Never falsely report onGround while still high in the air
    if (p.y > 12) assert.equal(p.onGround, false);
  }

  assert.equal(landedOnce, true);
  assert.ok(Math.abs(p.y - 11.0) < 0.01, `landed cleanly on top of y=10 floor (p.y=${p.y})`);
  assert.ok(totalFallDamage > 10, `fall damage applied accurately (${totalFallDamage})`);
  assert.equal(aabbCollidesWorld(p.x, p.y, p.z, PLAYER_HALF_WIDTH, PLAYER_HEIGHT, getBlock), false);
});

test('Part A Test 5: Mob 3D distance, solid wall LOS block, Glass sight rule & raycastMob occlusion', () => {
  const { setBlock, getBlock } = makeFlatWorld(10);
  // Build a 3-high solid stone wall at x=3, z=-2..2
  for (let y = 11; y <= 14; y++) {
    for (let z = -2; z <= 2; z++) setBlock(3, y, z, BlockId.Stone);
  }

  const player = makePhysics(1.5, 11.0, 0.5);
  const hb = getPlayerHitbox(player, false);

  // Mob on opposite side of stone wall at x=4.5 -> 3D distance is 3m, but LOS & attack MUST be blocked
  const behindWall = evaluateMobTarget(4.5, 11.0, 0.5, MobType.Zombie, hb, getBlock);
  assert.ok(behindWall.dist3D <= 18);
  assert.equal(behindWall.hasVisualLos, false);
  assert.equal(behindWall.hasAttackLos, false);
  assert.equal(canMobExecuteAttack(4.5, 11.0, 0.5, MobType.Zombie, 3.5, hb, true, getBlock), false);

  // Replace wall with Glass -> mob can SEE player visually, but physical melee attack is STILL blocked!
  for (let y = 11; y <= 14; y++) {
    for (let z = -2; z <= 2; z++) setBlock(3, y, z, BlockId.Glass);
  }
  const behindGlass = evaluateMobTarget(4.5, 11.0, 0.5, MobType.Zombie, hb, getBlock);
  assert.equal(behindGlass.hasVisualLos, true);
  assert.equal(behindGlass.hasAttackLos, false);
  assert.equal(canMobExecuteAttack(4.5, 11.0, 0.5, MobType.Zombie, 3.5, hb, true, getBlock), false);

  // Mob raycast through wall must NOT hit mob behind wall
  const scene = new THREE.Scene();
  const mobs = new MobManager(scene);
  mobs.spawnMob(MobType.Zombie, 4.5, 11.0, 0.5);
  const blockedHit = mobs.raycastMob(hb.eyeX, hb.eyeY, hb.eyeZ, 1, 0, 0, 5.0, getBlock);
  assert.equal(blockedHit, null);

  // Remove wall -> raycast hits the mob cleanly
  for (let y = 11; y <= 14; y++) {
    for (let z = -2; z <= 2; z++) setBlock(3, y, z, BlockId.Air);
  }
  const openHit = mobs.raycastMob(hb.eyeX, hb.eyeY, hb.eyeZ, 1, 0, 0, 5.0, getBlock);
  assert.ok(openHit !== null);

  assert.equal(computeDistance3D(0, 0, 0, 3, 4, 12), 13);
});

test('Part A Test 6: Save/Load preserves full underground player position, velocity, crouch & block placement', () => {
  const world = new WorldManager(202604);
  const player = new PlayerController(202604);
  player.physics.x = -12.35;
  player.physics.y = 16.0;
  player.physics.z = 8.72;
  player.physics.vx = 1.5;
  player.physics.vy = -0.2;
  player.physics.vz = -0.9;
  player.physics.onGround = true;
  player.physics.fallStartY = 19.0;
  player.crouching = true;
  player.yaw = 1.25;
  player.pitch = -0.35;
  world.setBlock(-12, 18, 8, BlockId.Torch);

  const containers = new ContainerController();
  const saved = buildWorldSaveData(world, player, containers, 3, 0.72, WeatherType.Rain, []);
  const jsonRoundTrip = JSON.parse(JSON.stringify(saved));

  const restoredWorld = new WorldManager(jsonRoundTrip.seed, jsonRoundTrip.modifiedChunks, jsonRoundTrip.blockEntities);
  restoredWorld.getOrCreateChunk(Math.floor(-12 / 16), Math.floor(8 / 16));
  const restoredPlayer = new PlayerController(jsonRoundTrip.seed, jsonRoundTrip.player, jsonRoundTrip.respawnPoint);

  assert.equal(restoredPlayer.physics.x, -12.35);
  assert.equal(restoredPlayer.physics.y, 16.0);
  assert.equal(restoredPlayer.physics.z, 8.72);
  assert.equal(restoredPlayer.physics.vx, 1.5);
  assert.equal(restoredPlayer.physics.vy, -0.2);
  assert.equal(restoredPlayer.physics.onGround, true);
  assert.equal(restoredPlayer.physics.fallStartY, 19.0);
  assert.equal(restoredPlayer.crouching, true);
  assert.equal(restoredWorld.getBlock(-12, 18, 8), BlockId.Torch);
});

// ============================================================================
// PART B — ITEM DROP PHYSICS, ANIMATION, PICKUP, STACKING & SAVE/LOAD (1-10)
// ============================================================================

test('Part B Test 1 & 2: Ground drop & underground cave drop never clip inside walls', () => {
  const { setBlock, getBlock } = makeFlatWorld(10);
  // Build solid wall directly in front of player at x=1 (player at 0.5, facing +X)
  for (let y = 11; y <= 13; y++) setBlock(1, y, 0, BlockId.Stone);

  const player = new PlayerController(202604);
  player.physics.x = 0.5;
  player.physics.y = 11.0;
  player.physics.z = 0.5;
  player.yaw = -Math.PI / 2; // facing +X toward the wall at x=1
  player.pitch = 0;

  const spawn = computePlayerDropSpawn(player, getBlock);
  assert.ok(spawn.x < 1.0 - 0.14, `safe drop origin stopped outside solid wall (x=${spawn.x})`);

  // Also test direct resolveSafeDropOrigin inside narrow 1-wide tunnel
  const safe = resolveSafeDropOrigin(0.5, 12.2, 0.5, 1, 0, 0, 1.2, getBlock);
  assert.ok(safe.x < 0.87, `resolveSafeDropOrigin kept item out of x=1 wall (${safe.x})`);
});

test('Part B Test 3 & 4: Tower edge drop & jumping throw fall cleanly down to ground', () => {
  const { setBlock, getBlock } = makeFlatWorld(10);
  for (let y = 11; y <= 20; y++) setBlock(0, y, 0, BlockId.Cobblestone);

  // Throw off the tower toward +X (x=1.5 is open down to floorY=10)
  const drop = makeDrop('cobblestone', 1, 0.95, 22.3, 0.5, 0);
  drop.vx = 3.2;
  drop.vy = 2.6;

  for (let i = 0; i < 150; i++) {
    stepDropBody(drop, 0.03, getBlock);
  }
  assert.ok(drop.x > 1.2, `item cleared tower edge to x=${drop.x}`);
  assert.equal(drop.grounded, true);
  assert.ok(Math.abs(drop.y - 11.14) < 0.05, `item fell all the way to ground y=${drop.y}`);
});

test('Part B Test 5: Terrain bounce, water buoyancy & falling when support block underneath is mined', () => {
  const { setBlock, getBlock } = makeFlatWorld(10);
  setBlock(2, 15, 2, BlockId.Dirt);

  const drop = makeDrop('dirt', 1, 2.5, 18.0, 2.5, 0);
  let sawBounceUp = false;
  for (let i = 0; i < 60; i++) {
    const prevVy = drop.vy;
    stepDropBody(drop, 0.03, getBlock);
    if (prevVy < -2 && drop.vy > 0.2) sawBounceUp = true;
  }
  assert.equal(sawBounceUp, true, 'item bounced on first impact');
  assert.equal(drop.grounded, true);
  assert.ok(Math.abs(drop.y - 16.14) < 0.02);

  // Break the dirt block underneath -> item must NOT hover in mid-air!
  setBlock(2, 15, 2, BlockId.Air);
  for (let i = 0; i < 80; i++) stepDropBody(drop, 0.03, getBlock);
  assert.ok(Math.abs(drop.y - 11.14) < 0.02, `item fell to lower floor when support broke (y=${drop.y})`);

  // Water buoyancy keeps drop afloat
  setBlock(5, 11, 5, BlockId.Water);
  setBlock(5, 12, 5, BlockId.Water);
  const waterDrop = makeDrop('stick', 1, 5.5, 11.3, 5.5, 0);
  waterDrop.vy = -3.0;
  for (let i = 0; i < 40; i++) stepDropBody(waterDrop, 0.03, getBlock);
  assert.ok(waterDrop.vy > 0, `water buoyancy lifted item upward (vy=${waterDrop.vy})`);
});

test('Part B Test 6: Animation rotation & bobbing are visual-only and decoupled from physics coordinates', () => {
  const { getBlock } = makeFlatWorld(10);
  const scene = new THREE.Scene();
  const mgr = new DroppedItemManager(scene);
  const inv = createInitialInventory();
  // Place player far away so pickup does not trigger
  mgr.spawnDrop('diamond', 1, undefined, 2.5, 11.14, 2.5, 0, 0, 0, 1.0);
  const soundMock = { playPickup: () => {} } as any;

  const ySamples: number[] = [];
  const rotSamples: number[] = [];
  for (let i = 0; i < 20; i++) {
    mgr.update(0.05, 50, 11, 50, getBlock, inv, soundMock, () => {});
    ySamples.push(mgr.items[0].y);
    rotSamples.push(mgr.items[0].model.rotation.y);
  }
  // Physics Y stays settled on floor, while mesh bob + rotation animate smoothly
  assert.ok(Math.abs(ySamples[ySamples.length - 1] - 11.14) < 0.02);
  assert.ok(rotSamples[rotSamples.length - 1] > rotSamples[0] + 1.5);
  assert.ok(findDropShadowY(2.5, 11.5, 2.5, getBlock) === 11);
  mgr.dispose();
});

test('Part B Test 7: 3D pickup respects cooldown, 3D distance, and solid wall LOS occlusion', () => {
  const { setBlock, getBlock } = makeFlatWorld(10);
  const hb = getPlayerHitbox(makePhysics(0.5, 11.0, 0.5), false);

  // Too young (< 0.75s cooldown) -> cannot collect even at point blank
  const freshDrop = makeDrop('coal', 1, 0.5, 11.5, 0.5, DROP_PICKUP_COOLDOWN - 0.2);
  assert.equal(canCollectDrop(freshDrop, hb, getBlock), false);

  // Ready & within range, clear path -> collects
  const readyDrop = makeDrop('coal', 1, 1.4, 11.5, 0.5, 1.0);
  assert.equal(canCollectDrop(readyDrop, hb, getBlock), true);

  // Solid wall between player (x=0.5) and drop (x=2.05, within 1.65m range) at x=1 -> blocked by LOS!
  for (let y = 11; y <= 13; y++) setBlock(1, y, 0, BlockId.Stone);
  const walledDrop = makeDrop('coal', 1, 2.05, 11.5, 0.5, 1.0);
  assert.equal(canCollectDrop(walledDrop, hb, getBlock), false);
});

test('Part B Test 8: Full inventory conservation preserves remainder in world with zero loss/duplication', () => {
  const inv = createInitialInventory();
  // Fill every hotbar & inventory slot with Stone (64/64)
  for (let i = 0; i < 9; i++) inv.hotbar[i] = { itemId: 'stone', count: 64 };
  for (let i = 0; i < 27; i++) inv.inventory[i] = { itemId: 'stone', count: 64 };

  assert.equal(canInventoryAcceptAny(inv, 'coal'), false);
  assert.equal(canInventoryAcceptAny(inv, 'stone'), false);

  // Leave 4 room in slot 0 -> partial acceptance conserves remainder
  inv.hotbar[0] = { itemId: 'coal', count: 60 };
  assert.equal(canInventoryAcceptAny(inv, 'coal'), true);
  const rem = addItemToInventory(inv, 'coal', 10);
  assert.equal(inv.hotbar[0].count, 64);
  assert.equal(rem, 6);
});

test('Part B Test 9: Nearby matching dropped items merge up to maxStack without exceeding stack cap', () => {
  const entries: DroppedItemBody[] = [
    makeDrop('cobblestone', 40, 2.0, 11.14, 2.0, 1.0),
    makeDrop('cobblestone', 30, 2.4, 11.14, 2.1, 1.5),
    makeDrop('wooden_pickaxe', 1, 2.2, 11.14, 2.0, 1.0),
    makeDrop('wooden_pickaxe', 1, 2.3, 11.14, 2.0, 1.0),
  ];
  entries[2].durability = 55;
  entries[3].durability = 55;

  const removed: DroppedItemBody[] = [];
  mergeNearbyDropBodies(entries, (r) => removed.push(r));

  // Stackable cobblestone merged 40+30 -> 64 and 6 (neither exceeds 64); unstackable tools remain separate
  assert.equal(entries[0].count, 64);
  assert.equal(entries[1].count, 6);
  assert.equal(entries.length, 4);

  // Full merge removes empty second entry cleanly
  const exactEntries: DroppedItemBody[] = [
    makeDrop('coal', 10, 2.0, 11.14, 2.0, 1.0),
    makeDrop('coal', 15, 2.3, 11.14, 2.1, 1.2),
  ];
  const exactRemoved: DroppedItemBody[] = [];
  mergeNearbyDropBodies(exactEntries, (r) => exactRemoved.push(r));
  assert.equal(exactEntries.length, 1);
  assert.equal(exactEntries[0].count, 25);
  assert.equal(exactRemoved.length, 1);
});

test('Part B Test 10: Save/Load persists dropped items cleanly across sessions', () => {
  const scene1 = new THREE.Scene();
  const mgr1 = new DroppedItemManager(scene1);
  mgr1.spawnDrop('diamond', 3, undefined, -4.2, 15.5, 9.8, 0.5, -1.2, 0.3, 4.5);
  mgr1.spawnDrop('iron_pickaxe', 1, 180, -3.5, 15.5, 9.2, 0, 0, 0, 12.0);
  const exported = mgr1.exportSavedDrops();

  const world = new WorldManager(202604);
  const player = new PlayerController(202604);
  const containers = new ContainerController();
  const save = JSON.parse(JSON.stringify(buildWorldSaveData(world, player, containers, 2, 0.5, WeatherType.Clear, exported)));

  const scene2 = new THREE.Scene();
  const mgr2 = new DroppedItemManager(scene2);
  mgr2.restoreSavedDrops(save.droppedItems);

  assert.equal(mgr2.items.length, 2);
  assert.equal(mgr2.items[0].itemId, 'diamond');
  assert.equal(mgr2.items[0].count, 3);
  assert.equal(mgr2.items[0].x, -4.2);
  assert.equal(mgr2.items[1].durability, 180);
  assert.equal(mgr2.items[1].age, 12.0);

  mgr1.dispose();
  mgr2.dispose();
  assert.equal(hasLineOfSightVoxel(0.5, 12, 0.5, 2.5, 12, 0.5, () => BlockId.Air), true);
});

test('Part A Extra: Creeper fuse cancels behind sealed wall and blockOverlapsPlayer matches PlayerCollider', () => {
  const { setBlock, getBlock } = makeFlatWorld(10);
  const scene = new THREE.Scene();
  const mobs = new MobManager(scene);
  const creeper = mobs.spawnMob(MobType.Creeper, 2.5, 11.0, 0.5);
  const hb = getPlayerHitbox(makePhysics(0.5, 11.0, 0.5), false);
  let hurt = 0;
  let exploded = 0;
  const cbs = { onPlayerHurt: () => { hurt++; }, onCreeperExplode: () => { exploded++; } };
  mobs.update(0.05, new THREE.Vector3(0.5, 11.0, 0.5), true, getBlock, () => 10, cbs, hb, true);
  assert.ok(creeper.fuseTimer > 0, 'Creeper starts fuse in open line of sight');

  // Seal solid stone wall between player (x=0.5) and creeper (x=2.5) at x=1 -> fuse cancels!
  for (let y = 11; y <= 13; y++) setBlock(1, y, 0, BlockId.Stone);
  mobs.update(0.05, new THREE.Vector3(0.5, 11.0, 0.5), true, getBlock, () => 10, cbs, hb, true);
  assert.equal(creeper.fuseTimer, -1);
  assert.equal(hurt, 0);
  assert.equal(exploded, 0);
  assert.equal(blockOverlapsPlayer(0, 11, 0, 0.5, 11.0, 0.5), true);
  assert.equal(raycastVoxel(hb.eyeX, hb.eyeY, hb.eyeZ, 1, 0, 0, 4, getBlock)?.bx, 1);
  mobs.dispose();
});
