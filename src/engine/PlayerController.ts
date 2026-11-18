import * as THREE from 'three';
import { SoundEngine } from '../audio/soundEngine';
import { resolveBlockBreakDropPosition, resolveBlockDrops } from '../data/blockDrops';
import { BLOCKS } from '../data/blocks';
import { ITEMS } from '../data/items';
import { MOB_CONFIG } from '../data/mobs';
import { yawToCardinalFacing } from '../world/blockOrientation';
import { MobEntity, MobManager } from '../entities/mobManager';
import {
  addItemToInventory,
  craftRecipe,
  createInitialInventory,
  damageHeldTool,
  getTotalArmorDefense,
  PlayerInventoryState,
} from '../player/inventory';
import { stepCreativeFlight } from '../player/flightPhysics';
import {
  blockOverlapsPlayer,
  PhysicsState,
  RaycastHit,
  stepPlayerPhysics,
} from '../player/physics';
import {
  BlockCoords,
  getPlayerBlockCoords,
  getPlayerEyeHeight,
  getPlayerHitbox,
  PlayerHitbox,
} from '../player/playerTransform';
import { HeldViewmodel, ViewAnimKind } from '../render/heldViewmodel';
import { EffectsPool } from '../render/particles';
import { ArmorSlotType, BlockId, GameMode, WorldSaveData } from '../types/game';
import { findSafeSpawn } from '../world/worldGen';
import { WorldManager } from '../world/worldManager';

export class PlayerController {
  public inv: PlayerInventoryState = createInitialInventory();
  public physics: PhysicsState;
  public yaw = 0;
  public pitch = -0.08;
  public health = 20;
  public maxHealth = 20;
  public hunger = 20;
  public maxHunger = 20;
  public oxygen = 20;
  public maxOxygen = 20;
  public blocksMined = 0;
  public mobsDefeated = 0;

  public gameMode: GameMode = 'survival';
  public isFlying = false;
  public crouching = false;
  public swingAnim = 0;
  public viewAnimKind: ViewAnimKind = 'idle';
  private elapsedAnim = 0;
  private isSprinting = false;
  public stepDist = 0;
  public cameraShake = 0;
  public attackCooldown = 0;
  public miningTarget: { x: number; y: number; z: number; progress: number } | null = null;
  public respawnPoint: { x: number; y: number; z: number } | null = null;
  private hungerTick = 0;
  private regenTick = 0;

  constructor(
    seed: number,
    saved?: WorldSaveData['player'],
    savedRespawn?: { x: number; y: number; z: number } | null,
    savedGameMode?: GameMode,
  ) {
    this.gameMode = savedGameMode ?? 'survival';
    this.respawnPoint = savedRespawn ? { ...savedRespawn } : null;
    if (saved) {
      this.health = saved.health;
      this.hunger = saved.hunger;
      this.blocksMined = saved.blocksMined;
      this.mobsDefeated = saved.mobsDefeated;
      this.yaw = saved.yaw;
      this.pitch = saved.pitch;
      this.crouching = Boolean(saved.crouching);
      this.isFlying = Boolean(saved.isFlying && this.gameMode === 'creative');
      this.inv = {
        hotbar: saved.hotbar,
        inventory: saved.inventory,
        armorSlots: saved.armorSlots,
        selectedSlot: saved.selectedSlot,
      };
      this.physics = {
        x: saved.x,
        y: saved.y,
        z: saved.z,
        vx: saved.vx ?? 0,
        vy: saved.vy ?? 0,
        vz: saved.vz ?? 0,
        onGround: saved.onGround ?? false,
        inWater: false,
        headInWater: false,
        fallStartY: saved.fallStartY ?? saved.y,
      };
    } else {
      const spawn = findSafeSpawn(seed);
      this.physics = {
        x: spawn.x,
        y: spawn.y,
        z: spawn.z,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: false,
        inWater: false,
        headInWater: false,
        fallStartY: spawn.y,
      };
    }
  }

  public getEyePosition(): { x: number; y: number; z: number } {
    return {
      x: this.physics.x,
      y: this.physics.y + getPlayerEyeHeight(this.crouching),
      z: this.physics.z,
    };
  }

  public getHitbox(): PlayerHitbox {
    return getPlayerHitbox(this.physics, this.crouching);
  }

  public getBlockCoords(): BlockCoords {
    return getPlayerBlockCoords(this.physics);
  }

  public setGameMode(mode: GameMode): void {
    this.gameMode = mode;
    if (mode === 'survival') {
      this.isFlying = false;
      this.physics.fallStartY = this.physics.y;
    } else {
      this.health = this.maxHealth;
      this.hunger = this.maxHunger;
      this.oxygen = this.maxOxygen;
    }
  }

  public toggleFlight(): boolean {
    if (this.gameMode !== 'creative') {
      this.isFlying = false;
      return false;
    }
    this.isFlying = !this.isFlying;
    this.physics.vy = 0;
    this.physics.fallStartY = this.physics.y;
    if (this.isFlying) this.crouching = false;
    return this.isFlying;
  }

  public respawn(seed: number): void {
    const spawn = this.respawnPoint ?? findSafeSpawn(seed);
    this.crouching = false;
    Object.assign(this.physics, {
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: false,
      fallStartY: spawn.y,
    });
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.oxygen = this.maxOxygen;
  }

  public stepSurvivalAndMove(
    dt: number,
    keys: Set<string>,
    jumpBuffered: boolean,
    isInventoryOpen: boolean,
    world: WorldManager,
    sound: SoundEngine,
    onDeath: () => void,
  ): void {
    if (!isInventoryOpen) {
      const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const str = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const prevX = this.physics.x;
      const prevZ = this.physics.z;
      const sprint = keys.has('ControlLeft') || keys.has('ControlRight');
      const flyingNow = this.gameMode === 'creative' && this.isFlying;
      if (flyingNow) {
        this.crouching = false;
        this.isSprinting = sprint && (fwd !== 0 || str !== 0);
        stepCreativeFlight(
          this.physics,
          { forward: fwd, strafe: str, yaw: this.yaw, ascend: keys.has('Space'), descend: keys.has('ShiftLeft') || keys.has('ShiftRight'), sprint },
          dt,
          world.getCollisionBlock,
        );
      } else {
        this.crouching = keys.has('ShiftLeft') || keys.has('ShiftRight');
        this.isSprinting = sprint && fwd > 0 && !this.crouching;
        const { fallDamage, landed } = stepPlayerPhysics(
          this.physics,
          { forward: fwd, strafe: str, yaw: this.yaw, jump: jumpBuffered || keys.has('Space'), sprint, crouch: this.crouching },
          dt,
          world.getCollisionBlock,
        );
        if (fallDamage > 0) this.takeDamage(fallDamage, this.physics.x, this.physics.z, sound, onDeath);
        if (landed) sound.playStep(this.physics.inWater);
      }

      const moved = Math.hypot(this.physics.x - prevX, this.physics.z - prevZ);
      if (!flyingNow && this.physics.onGround && moved > 0.001) {
        this.stepDist += moved;
        if (this.stepDist > 1.75) {
          this.stepDist = 0;
          sound.playStep(this.physics.inWater);
        }
      }
    }

    if (this.gameMode === 'creative') {
      this.health = this.maxHealth;
      this.hunger = this.maxHunger;
      this.oxygen = this.maxOxygen;
    } else {
      this.hungerTick += dt;
      if (this.hungerTick > 14) {
        this.hungerTick = 0;
        if (this.hunger > 0) this.hunger = Math.max(0, this.hunger - 1);
      }
      this.regenTick += dt;
      if (this.regenTick > 3.5) {
        this.regenTick = 0;
        if (this.hunger >= 14 && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + 1);
        else if (this.hunger === 0 && this.health > 1) this.health = Math.max(1, this.health - 1);
      }
      if (this.physics.headInWater) {
        this.oxygen = Math.max(0, this.oxygen - dt * 2.2);
        if (this.oxygen <= 0) {
          this.health = Math.max(0, this.health - dt * 2);
          if (this.health <= 0) onDeath();
        }
      } else {
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + dt * 5);
      }
    }
    this.elapsedAnim += dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
    this.swingAnim = Math.max(0, this.swingAnim - dt * 4.5);
    if (this.swingAnim <= 0.01) {
      const hSpeed = Math.hypot(this.physics.vx, this.physics.vz);
      this.viewAnimKind = !this.physics.onGround && !this.isFlying
        ? 'jump'
        : hSpeed > 0.6
          ? (this.isSprinting ? 'sprint' : 'walk')
          : 'idle';
    }
    this.lastDt = dt;
  }

  private lastDt = 0.016;

  public syncCamera(camera: THREE.PerspectiveCamera, heldViewmodel: HeldViewmodel, crouching = this.crouching): void {
    const shakeAmt = this.cameraShake * this.cameraShake * 0.12;
    const eyeH = getPlayerEyeHeight(crouching);
    const walkBob = this.physics.onGround ? Math.sin(this.stepDist * 3.6) * 0.045 : 0;
    camera.position.set(
      this.physics.x + (Math.random() - 0.5) * shakeAmt,
      this.physics.y + eyeH + walkBob,
      this.physics.z + (Math.random() - 0.5) * shakeAmt,
    );
    camera.up.set(0, 1, 0);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    const held = this.inv.hotbar[this.inv.selectedSlot];
    const toolKind = held ? ITEMS[held.itemId]?.toolKind : undefined;
    heldViewmodel.updateMotion({
      dt: this.lastDt,
      timeSec: this.elapsedAnim,
      moveSpeed: Math.hypot(this.physics.vx, this.physics.vz),
      sprinting: this.isSprinting,
      onGround: this.physics.onGround,
      vy: this.physics.vy,
      toolKind,
      animKind: this.viewAnimKind,
      swingAnim: this.swingAnim,
    });
  }

  public takeDamage(rawDmg: number, srcX: number, srcZ: number, sound: SoundEngine, onDeath: () => void): void {
    if (this.gameMode === 'creative') return;
    const defense = getTotalArmorDefense(this.inv.armorSlots);
    const dmg = Math.max(1, Math.round(rawDmg * (1 - Math.min(0.75, defense * 0.04))));
    this.health = Math.max(0, this.health - dmg);
    this.cameraShake = 0.45;
    sound.playHurt();

    const dx = this.physics.x - srcX;
    const dz = this.physics.z - srcZ;
    const len = Math.max(0.1, Math.hypot(dx, dz));
    this.physics.vx += (dx / len) * 5.5;
    this.physics.vz += (dz / len) * 5.5;
    this.physics.vy = Math.max(this.physics.vy, 3.8);
    if (this.health <= 0) onDeath();
  }

  public attackMob(
    mob: MobEntity,
    mobs: MobManager,
    effects: EffectsPool,
    sound: SoundEngine,
    onStatus: (msg: string) => void,
    onOverflowDrop?: (itemId: string, count: number, x: number, y: number, z: number, durability?: number) => void,
  ): boolean {
    if (this.attackCooldown > 0) return false;
    this.viewAnimKind = 'attack';
    const held = this.inv.hotbar[this.inv.selectedSlot];
    const dmg = held ? ITEMS[held.itemId]?.attackDamage ?? 1 : 1;
    const res = mobs.damageMob(mob, dmg, -Math.sin(this.yaw), -Math.cos(this.yaw));
    if (this.gameMode === 'survival') damageHeldTool(this.inv);
    sound.playHit();
    effects.spawnBurst(mob.x, mob.y + 0.8, mob.z, 0xe84848, 10, 3.8);
    this.attackCooldown = 0.35;
    if (res.killed) {
      this.mobsDefeated++;
      for (const drop of res.drops) {
        const rem = addItemToInventory(this.inv, drop.itemId, drop.count);
        if (rem > 0) onOverflowDrop?.(drop.itemId, rem, mob.x, mob.y + 0.5, mob.z);
      }
      sound.playPickup();
      onStatus(`Defeated ${MOB_CONFIG[mob.type].name}`);
    }
    return true;
  }

  public mineBlockStep(
    dt: number,
    hit: RaycastHit,
    world: WorldManager,
    effects: EffectsPool,
    sound: SoundEngine,
    onDropSpawn?: (itemId: string, count: number, x: number, y: number, z: number, durability?: number) => void,
    dropOpts?: { silkTouch?: boolean; rng?: () => number },
  ): boolean {
    const def = BLOCKS[hit.blockId];
    if (!def || def.hardness < 0) return false;
    if (!this.miningTarget || this.miningTarget.x !== hit.bx || this.miningTarget.y !== hit.by || this.miningTarget.z !== hit.bz) {
      this.miningTarget = { x: hit.bx, y: hit.by, z: hit.bz, progress: 0 };
    }
    const held = this.inv.hotbar[this.inv.selectedSlot];
    const heldDef = held ? ITEMS[held.itemId] : undefined;
    if (this.gameMode === 'creative') {
      this.miningTarget.progress = 1.0;
    } else {
      const speed = heldDef?.toolKind === def.preferredTool ? (heldDef.miningSpeed ?? 2.0) : 1.0;
      this.miningTarget.progress += (dt * speed) / Math.max(0.15, def.hardness);
    }
    this.viewAnimKind = 'mine';
    this.swingAnim = Math.max(this.swingAnim, 0.5);

    if (this.miningTarget.progress >= 1.0) {
      const brokenEntity = world.blockEntities.get(hit.bx, hit.by, hit.bz);
      const stored = brokenEntity ? world.blockEntities.extractAllStoredItems(brokenEntity) : [];
      world.breakBlockWithPartner(hit.bx, hit.by, hit.bz);

      const dropPos = resolveBlockBreakDropPosition(hit.bx, hit.by, hit.bz, world.getCollisionBlock);
      for (const s of stored) {
        onDropSpawn?.(s.itemId, s.count, dropPos.x, dropPos.y, dropPos.z, s.durability);
      }

      this.blocksMined++;
      sound.playBlockBreak();
      const dropColor = def.dropItemId ? ITEMS[def.dropItemId]?.color ?? '#8a8e94' : '#659e4b';
      effects.spawnBurst(hit.bx + 0.5, hit.by + 0.5, hit.bz + 0.5, parseInt(dropColor.replace('#', ''), 16) || 0x888888, 14, 3.6);

      const resolvedDrops = resolveBlockDrops(hit.blockId, heldDef, {
        gameMode: this.gameMode,
        silkTouch: dropOpts?.silkTouch,
        rng: dropOpts?.rng,
      });
      for (const drop of resolvedDrops) {
        onDropSpawn?.(drop.itemId, drop.count, dropPos.x, dropPos.y, dropPos.z);
      }

      if (this.gameMode === 'survival') {
        damageHeldTool(this.inv);
      }
      this.miningTarget = null;
      return true;
    }
    return false;
  }

  public rightClickAction(
    hit: RaycastHit | null,
    fluidHit: RaycastHit | null,
    world: WorldManager,
    sound: SoundEngine,
    onStatus: (msg: string) => void,
  ): boolean {
    const slot = this.inv.hotbar[this.inv.selectedSlot];
    const def = slot ? ITEMS[slot.itemId] : undefined;
    const isCreative = this.gameMode === 'creative';
    if (def?.id === 'bucket' && fluidHit?.blockId === BlockId.Water && slot) {
      world.setBlock(fluidHit.bx, fluidHit.by, fluidHit.bz, BlockId.Air);
      if (!isCreative) {
        slot.count -= 1;
        if (slot.count <= 0) this.inv.hotbar[this.inv.selectedSlot] = null;
        addItemToInventory(this.inv, 'water_bucket', 1);
      }
      this.viewAnimKind = 'place';
      this.swingAnim = 1.0;
      sound.playPickup();
      onStatus('Scooped Water');
      return true;
    }
    if (def?.id === 'water_bucket' && hit && slot) {
      const tx = hit.bx + hit.nx;
      const ty = hit.by + hit.ny;
      const tz = hit.bz + hit.nz;
      if (world.setBlock(tx, ty, tz, BlockId.Water)) {
        if (!isCreative) this.inv.hotbar[this.inv.selectedSlot] = { itemId: 'bucket', count: 1 };
        this.viewAnimKind = 'place';
        this.swingAnim = 1.0;
        sound.playBlockPlace();
        return true;
      }
    }
    if (def?.category === 'food' && (isCreative || this.hunger < this.maxHunger || this.health < this.maxHealth)) {
      this.hunger = Math.min(this.maxHunger, this.hunger + (def.hungerRestore ?? 2));
      this.health = Math.min(this.maxHealth, this.health + (def.healthRestore ?? 0));
      if (!isCreative) {
        slot!.count -= 1;
        if (slot!.count <= 0) this.inv.hotbar[this.inv.selectedSlot] = null;
      }
      this.viewAnimKind = 'eat';
      this.swingAnim = 1.0;
      sound.playPickup();
      onStatus(`Ate ${def.name}`);
      return true;
    }
    if (hit && def?.blockId !== undefined) {
      const tx = hit.bx + hit.nx;
      const ty = hit.by + hit.ny;
      const tz = hit.bz + hit.nz;
      const res = world.placeOrientedBlock(tx, ty, tz, def.blockId, yawToCardinalFacing(this.yaw), hit.nx, hit.ny, hit.nz, (bx, by, bz) =>
        blockOverlapsPlayer(bx, by, bz, this.physics.x, this.physics.y, this.physics.z),
      );
      if (res.placed) {
        if (!isCreative) {
          slot!.count -= 1;
          if (slot!.count <= 0) this.inv.hotbar[this.inv.selectedSlot] = null;
        }
        this.viewAnimKind = 'place';
        this.swingAnim = 1.0;
        sound.playBlockPlace();
        return true;
      }
      if (res.failReason) onStatus(res.failReason);
    }
    return false;
  }

  public craft(recipeId: string, world: WorldManager, sound: SoundEngine): boolean {
    const nearTable = world.hasBlockNearby(this.physics.x, this.physics.y, this.physics.z, BlockId.CraftingTable, 4);
    const ok = craftRecipe(this.inv, recipeId, nearTable);
    if (ok) sound.playPickup();
    return ok;
  }

  public moveOrEquipSlot(
    srcArea: 'hotbar' | 'inventory' | 'armor',
    srcIdx: number | ArmorSlotType,
    dstArea: 'hotbar' | 'inventory' | 'armor',
    dstIdx: number | ArmorSlotType,
  ): void {
    const get = (a: 'hotbar' | 'inventory' | 'armor', i: number | ArmorSlotType) =>
      a === 'hotbar' ? this.inv.hotbar[i as number] : a === 'inventory' ? this.inv.inventory[i as number] : this.inv.armorSlots[i as ArmorSlotType];
    const set = (a: 'hotbar' | 'inventory' | 'armor', i: number | ArmorSlotType, v: typeof this.inv.hotbar[0]) => {
      if (a === 'hotbar') this.inv.hotbar[i as number] = v;
      else if (a === 'inventory') this.inv.inventory[i as number] = v;
      else this.inv.armorSlots[i as ArmorSlotType] = v;
    };
    const src = get(srcArea, srcIdx);
    const dst = get(dstArea, dstIdx);
    if (dstArea === 'armor' && src && ITEMS[src.itemId]?.armorSlot !== dstIdx) return;
    set(dstArea, dstIdx, src);
    set(srcArea, srcIdx, dst);
  }
}
