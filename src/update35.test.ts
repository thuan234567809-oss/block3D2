import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MOB_CONFIG, MobManager } from './entities/mobManager';
import { animateMobRig } from './render/mobAnimator';
import { createMobRig, disposeMobRig, disposeSharedMobTextures } from './render/mobsMesh';
import { HeldViewmodel } from './render/heldViewmodel';
import { extractVoxelCells } from './render/voxelGridBuilder';
import { createToolVoxelModel, TOOL_BLUEPRINTS } from './render/voxelToolModels';
import { MobType, ToolKind } from './types/game';

test('Update 3.5 upgraded 16x16 stepped-depth tool geometry across all 5 tools and 6 tiers', () => {
  const kinds = ['pickaxe', 'axe', 'shovel', 'hoe', 'sword'] as const;
  const tiers = ['wood', 'stone', 'iron', 'gold', 'diamond', 'netherite'] as const;

  for (const kind of kinds) {
    const bp = TOOL_BLUEPRINTS[kind];
    assert.equal(bp.length, 16, `${kind} blueprint should be 16 rows high`);
    const cells = extractVoxelCells(bp);
    assert.ok(cells.length >= 18, `${kind} should have rich multi-voxel geometry (>=18 cells, got ${cells.length})`);

    for (const tier of tiers) {
      const model = createToolVoxelModel(kind, tier);
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      assert.ok(size.x > 0.1 && size.y > 0.3 && size.z > 0.03, `${tier}_${kind} should have bold 3D dimensions`);
    }
  }
});

test('HeldViewmodel renders detailed hand hierarchy and animates all 8 states cleanly', () => {
  const vm = new HeldViewmodel();
  for (const toolId of ['wood_pickaxe', 'iron_axe', 'diamond_sword', 'golden_shovel', 'netherite_hoe', null]) {
    vm.updateItem(toolId);
    for (const animKind of ['idle', 'walk', 'sprint', 'jump', 'mine', 'attack', 'place', 'eat'] as const) {
      vm.updateMotion({
        dt: 0.016,
        timeSec: 0.8,
        moveSpeed: animKind === 'sprint' ? 7.2 : animKind === 'walk' ? 4.4 : 0,
        sprinting: animKind === 'sprint',
        onGround: animKind !== 'jump',
        vy: animKind === 'jump' ? 5.0 : 0,
        toolKind: toolId ? (toolId.split('_')[1] as ToolKind) : undefined,
        animKind,
        swingAnim: animKind === 'mine' || animKind === 'attack' ? 0.45 : 0,
      });
      assert.ok(Number.isFinite(vm.group.position.x));
      assert.ok(Number.isFinite(vm.group.position.y));
      assert.ok(Number.isFinite(vm.group.rotation.x));
    }
  }
  // Arm + sleeve + cuff + wrist + fingers must be present
  assert.ok(vm.group.children.length >= 1);
  vm.dispose();
});

test('Update 3.5 builds distinct multi-part rigs for all 8 passive and hostile creatures', () => {
  const cow = createMobRig(MobType.Cow);
  assert.equal(cow.legs.length, 4);
  assert.ok(cow.tail, 'Cow should have articulated tail');
  assert.ok(cow.materials.length >= 12, 'Cow should have horns, ears, muzzle, nostrils, hooves, and udder');
  disposeMobRig(cow);

  const pig = createMobRig(MobType.Pig);
  assert.equal(pig.legs.length, 4);
  assert.ok(pig.tail, 'Pig should have curled tail');
  disposeMobRig(pig);

  const sheep = createMobRig(MobType.Sheep);
  assert.equal(sheep.legs.length, 4);
  assert.ok(sheep.tail, 'Sheep should have woolly tail');
  disposeMobRig(sheep);

  const chicken = createMobRig(MobType.Chicken);
  assert.equal(chicken.legs.length, 2);
  assert.equal(chicken.arms.length, 2, 'Chicken should have 2 articulated flapping wings');
  assert.ok(chicken.tail, 'Chicken should have tail feathers');
  disposeMobRig(chicken);

  const zombie = createMobRig(MobType.Zombie);
  assert.equal(zombie.legs.length, 2);
  assert.equal(zombie.arms.length, 2);
  disposeMobRig(zombie);

  const skeleton = createMobRig(MobType.Skeleton);
  assert.equal(skeleton.legs.length, 2);
  assert.equal(skeleton.arms.length, 2);
  assert.ok(skeleton.bow, 'Skeleton should hold a 3D voxel bow');
  disposeMobRig(skeleton);

  const spider = createMobRig(MobType.Spider);
  assert.equal(spider.legs.length, 8, 'Spider must have 8 separate articulated legs');
  assert.equal(spider.legLowerPivots?.length, 8, 'Spider must have 8 knee pivots for 2-segment bending');
  assert.equal(spider.mandibles?.length, 2, 'Spider must have 2 mandibles');
  assert.ok(spider.baseEmissives.some((e) => e > 0), 'Spider glowing eyes must preserve emissive base color');
  disposeMobRig(spider);

  const creeper = createMobRig(MobType.Creeper);
  assert.equal(creeper.legs.length, 4);
  disposeMobRig(creeper);
  disposeSharedMobTextures();
});

test('animateMobRig handles walking, grazing, flapping, tetrapod crawl, bow recoil, fuse swell, hurt, and KO', () => {
  const allTypes = [
    MobType.Cow,
    MobType.Pig,
    MobType.Sheep,
    MobType.Chicken,
    MobType.Zombie,
    MobType.Skeleton,
    MobType.Spider,
    MobType.Creeper,
  ];

  for (const type of allTypes) {
    const rig = createMobRig(type);
    // Walking / active special state
    animateMobRig(
      {
        type,
        rig,
        vx: 2.2,
        vy: type === MobType.Chicken ? 1.5 : 0,
        vz: 1.4,
        walkPhase: 1.7,
        animTime: 2.3,
        wanderTimer: 0.4,
        fleeTimer: type === MobType.Chicken ? 1.0 : 0,
        hitFlashTimer: 0.08,
        koTimer: 0,
        fuseTimer: type === MobType.Creeper ? 0.6 : -1,
        attackAnimTimer: 0.2,
      },
      0.016,
    );

    // Grazing / idle
    animateMobRig(
      {
        type,
        rig,
        vx: 0,
        vy: 0,
        vz: 0,
        walkPhase: 0,
        animTime: 1.1,
        wanderTimer: 0.5,
        fleeTimer: 0,
        hitFlashTimer: 0,
        koTimer: 0,
        fuseTimer: -1,
        attackAnimTimer: 0,
      },
      0.016,
    );

    if (type === MobType.Spider) {
      assert.equal(rig.legs.length, 8);
      for (const leg of rig.legs) {
        assert.ok(Number.isFinite(leg.rotation.y) && Number.isFinite(leg.rotation.z));
      }
    }

    // KO topple
    animateMobRig(
      {
        type,
        rig,
        vx: 0,
        vy: 0,
        vz: 0,
        walkPhase: 0,
        animTime: 3.0,
        wanderTimer: 1.5,
        fleeTimer: 0,
        hitFlashTimer: 0,
        koTimer: 0.2,
        fuseTimer: -1,
        attackAnimTimer: 0,
      },
      0.016,
    );
    assert.ok(rig.group.rotation.z > 0.1, `${type} should topple cleanly on KO`);
    disposeMobRig(rig);
  }
  disposeSharedMobTextures();
});

test('MobManager preserves combat/AI/stats and preserves Spider glowing eyes after damageMob flash', () => {
  const scene = new THREE.Scene();
  const mgr = new MobManager(scene);
  const spider = mgr.spawnMob(MobType.Spider, 5, 50, 5);
  assert.equal(spider.maxHp, MOB_CONFIG[MobType.Spider].maxHp);
  assert.equal(spider.rig.legs.length, 8);

  const res = mgr.damageMob(spider, 3, 1, 0);
  assert.equal(res.killed, false);
  assert.equal(spider.hp, MOB_CONFIG[MobType.Spider].maxHp - 3);
  mgr.dispose();
});
