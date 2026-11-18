import { BLOCKS } from '../data/blocks';
import { MOB_CONFIG } from '../data/mobs';
import { resolveSafeDropOrigin } from '../entities/droppedItemPhysics';
import { MobEntity } from '../entities/mobManager';
import { getTotalArmorDefense } from '../player/inventory';
import { RaycastHit } from '../player/physics';
import { getPlayerBlockCoords } from '../player/playerTransform';
import { EffectsPool } from '../render/particles';
import { BlockId, HudSnapshot, SavedDroppedItem, WeatherType, WorldSaveData } from '../types/game';
import { sampleBiome } from '../world/biome';
import { BlockAccessor } from '../world/mesher';
import { WorldManager } from '../world/worldManager';
import { ContainerController } from './ContainerController';
import { PlayerController } from './PlayerController';

export function buildWorldSaveData(
  world: WorldManager,
  player: PlayerController,
  containers: ContainerController,
  dayCount: number,
  timeOfDay: number,
  weather: WeatherType,
  droppedItems?: SavedDroppedItem[],
): WorldSaveData {
  containers.returnTransientItems(player.inv);
  return {
    version: 3,
    seed: world.seed,
    savedAt: Date.now(),
    dayCount,
    timeOfDay,
    weather,
    gameMode: player.gameMode,
    respawnPoint: player.respawnPoint,
    player: {
      x: player.physics.x,
      y: player.physics.y,
      z: player.physics.z,
      vx: player.physics.vx,
      vy: player.physics.vy,
      vz: player.physics.vz,
      onGround: player.physics.onGround,
      fallStartY: player.physics.fallStartY,
      crouching: player.crouching,
      isFlying: player.isFlying,
      yaw: player.yaw,
      pitch: player.pitch,
      health: player.health,
      hunger: player.hunger,
      blocksMined: player.blocksMined,
      mobsDefeated: player.mobsDefeated,
      selectedSlot: player.inv.selectedSlot,
      hotbar: player.inv.hotbar,
      inventory: player.inv.inventory,
      armorSlots: player.inv.armorSlots,
    },
    modifiedChunks: world.exportModifiedChunks(),
    modifiedChunkMeta: world.exportModifiedChunkMeta(),
    blockEntities: world.blockEntities.serialize(),
    droppedItems,
  };
}

export function buildHudSnapshot(params: {
  world: WorldManager;
  player: PlayerController;
  containers: ContainerController;
  dayCount: number;
  timeOfDay: number;
  weather: WeatherType;
  pointerLocked: boolean;
  isInventoryOpen: boolean;
  currentRayHit: RaycastHit | null;
  currentMobHit: MobEntity | null;
  statusMessage: string | null;
}): HudSnapshot {
  const { world, player, containers, currentRayHit, currentMobHit } = params;
  const biome = sampleBiome(player.physics.x, player.physics.z, world.seed);
  const hitDef = currentRayHit ? BLOCKS[currentRayHit.blockId] : undefined;
  const playerCoords = getPlayerBlockCoords(player.physics);
  return {
    health: Math.ceil(player.health),
    maxHealth: player.maxHealth,
    hunger: Math.ceil(player.hunger),
    maxHunger: player.maxHunger,
    armor: getTotalArmorDefense(player.inv.armorSlots),
    oxygen: Math.ceil(player.oxygen),
    maxOxygen: player.maxOxygen,
    dayCount: params.dayCount,
    timeOfDay: params.timeOfDay,
    biome,
    weather: params.weather,
    hotbar: player.inv.hotbar.map((s) => (s ? { ...s } : null)),
    inventory: player.inv.inventory.map((s) => (s ? { ...s } : null)),
    armorSlots: { ...player.inv.armorSlots },
    selectedSlot: player.inv.selectedSlot,
    gameMode: player.gameMode,
    isFlying: player.isFlying,
    pointerLocked: params.pointerLocked,
    isInventoryOpen: params.isInventoryOpen,
    cursorItem: containers.cursorItem ? { ...containers.cursorItem } : null,
    craftingGrid: containers.craftingGrid.map((s) => (s ? { ...s } : null)),
    activeBlockUi: containers.activeBlockUi ? { ...containers.activeBlockUi } : null,
    activeBlockEntity: structuredClone(containers.getActiveEntity(world)),
    activePartnerChest: structuredClone(containers.getPartnerChest(world)),
    isNearCraftingTable:
      world.hasBlockNearby(player.physics.x, player.physics.y, player.physics.z, BlockId.CraftingTable, 4) ||
      containers.activeBlockUi?.type === 'crafting_table',
    isNearFurnace: world.hasBlockNearby(player.physics.x, player.physics.y, player.physics.z, BlockId.Furnace, 4),
    miningProgress: player.miningTarget?.progress ?? 0,
    targetBlockName: hitDef?.name ?? null,
    targetBlockHint: hitDef?.interactHint ?? null,
    targetMobName: currentMobHit ? MOB_CONFIG[currentMobHit.type].name : null,
    targetMobHp: currentMobHit?.hp ?? 0,
    targetMobMaxHp: currentMobHit?.maxHp ?? 0,
    playerCoords,
    respawnCoords: player.respawnPoint
      ? {
          x: Math.floor(player.respawnPoint.x),
          y: Math.floor(player.respawnPoint.y),
          z: Math.floor(player.respawnPoint.z),
        }
      : null,
    blocksMined: player.blocksMined,
    mobsDefeated: player.mobsDefeated,
    statusMessage: params.statusMessage,
  };
}

export function carveExplosion(world: WorldManager, effects: EffectsPool, ex: number, ey: number, ez: number): void {
  effects.spawnBurst(ex, ey + 0.8, ez, 0x55aa44, 24, 6.5);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -1; dy <= 2; dy++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (dx * dx + dy * dy + dz * dz <= 5) {
          const bx = Math.floor(ex) + dx;
          const by = Math.floor(ey) + dy;
          const bz = Math.floor(ez) + dz;
          if (by > 1 && world.getBlock(bx, by, bz) !== BlockId.Bedrock) {
            world.setBlock(bx, by, bz, BlockId.Air);
          }
        }
      }
    }
  }
}

export function resolveBedSleep(
  player: PlayerController,
  bx: number,
  by: number,
  bz: number,
  timeOfDay: number,
  dayCount: number,
  weather: WeatherType,
): { timeOfDay: number; dayCount: number; weather: WeatherType; message: string } {
  player.respawnPoint = { x: bx + 0.5, y: by + 1, z: bz + 0.5 };
  const canSleep = timeOfDay >= 0.48 || timeOfDay < 0.04 || weather === WeatherType.Storm;
  if (canSleep) {
    player.health = Math.min(player.maxHealth, player.health + 4);
    return { timeOfDay: 0.05, dayCount: dayCount + 1, weather: WeatherType.Clear, message: 'Respawn set — Slept until morning!' };
  }
  return { timeOfDay, dayCount, weather, message: 'Respawn point set (sleep at night or in storms)' };
}

export function computePlayerDropSpawn(
  player: PlayerController,
  getCollisionBlock: BlockAccessor,
): { x: number; y: number; z: number; vx: number; vy: number; vz: number } {
  const eye = player.getEyePosition();
  const cosP = Math.cos(player.pitch);
  const dx = -Math.sin(player.yaw) * cosP;
  const dy = Math.sin(player.pitch);
  const dz = -Math.cos(player.yaw) * cosP;
  const origin = resolveSafeDropOrigin(eye.x, eye.y - 0.25, eye.z, dx, dy, dz, 0.85, getCollisionBlock);
  return {
    x: origin.x,
    y: origin.y,
    z: origin.z,
    vx: dx * 3.6,
    vy: Math.max(0.6, dy * 3.0 + 1.9),
    vz: dz * 3.6,
  };
}
