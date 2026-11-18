import * as THREE from 'three';
import { SoundEngine } from '../audio/soundEngine';
import { BLOCKS } from '../data/blocks';
import { DroppedItemManager } from '../entities/droppedItems';
import { MobEntity, MobManager } from '../entities/mobManager';
import { PlayerInventoryState } from '../player/inventory';
import { raycastVoxel, RaycastHit } from '../player/physics';
import { HeldViewmodel } from '../render/heldViewmodel';
import { EffectsPool } from '../render/particles';
import { PostProcessor } from '../render/postProcess';
import { SkyWeatherSystem } from '../render/skyWeather';
import { clearVoxelItemModelCache } from '../render/voxelItemModels';
import { BiomeId, BlockId, GameMode, GamePhase, GameSettings, HudSnapshot, WeatherType, WorldSaveData } from '../types/game';
import { sampleBiome } from '../world/biome';
import { getBlockSelectionBox } from '../world/blockBounds';
import { worldToChunkCoord } from '../world/chunkData';
import { WorldManager } from '../world/worldManager';
import { ChunkRenderer } from './ChunkRenderer';
import { ContainerController } from './ContainerController';
import { DoorRenderer } from './DoorRenderer';
import { buildHudSnapshot, buildWorldSaveData, carveExplosion, computePlayerDropSpawn, resolveBedSleep } from './EngineSnapshot';
import { InputController } from './InputController';
import { PlayerController } from './PlayerController';
import { createRendererContext } from './RendererSetup';

const _fwd = new THREE.Vector3();
const _playerPos = new THREE.Vector3();

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;

  private world: WorldManager;
  private chunkRenderer: ChunkRenderer;
  private doorRenderer: DoorRenderer;
  private skyWeather: SkyWeatherSystem;
  private effects: EffectsPool;
  private mobs: MobManager;
  private droppedItems: DroppedItemManager;
  private postProcess: PostProcessor;
  private sound = new SoundEngine();
  private player: PlayerController;
  private input: InputController;
  public containers = new ContainerController();

  private phase: GamePhase = GamePhase.Title;
  private settings: GameSettings;
  private dayCount = 1;
  private timeOfDay = 0.22;
  private weather: WeatherType = WeatherType.Clear;
  private weatherTimer = 95;
  private statusMessage: string | null = null;
  private statusTimer = 0;

  private heldViewmodel: HeldViewmodel;
  private hitstopTimer = 0;
  private isInventoryOpen = false;
  private mouseRightPending = false;
  private currentRayHit: RaycastHit | null = null;
  private currentMobHit: MobEntity | null = null;
  private hudThrottle = 0;
  private elapsedSec = 0;
  private titleOrbitAngle = 0;
  private frameId = 0;
  private lastTime = performance.now();
  private destroyed = false;

  private onHudUpdate: (hud: HudSnapshot) => void;
  private onPhaseChange: (phase: GamePhase) => void;

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    onHudUpdate: (hud: HudSnapshot) => void,
    onPhaseChange: (phase: GamePhase) => void,
    seed = 202604,
    savedWorld?: WorldSaveData | null,
    initialGameMode: GameMode = 'survival',
  ) {
    this.container = container;
    this.settings = { ...initialSettings };
    this.onHudUpdate = onHudUpdate;
    this.onPhaseChange = onPhaseChange;
    this.sound.muted = initialSettings.muted;

    const ctx = createRendererContext(container, this.settings.fov, this.settings.renderDistance);
    this.renderer = ctx.renderer;
    this.scene = ctx.scene;
    this.camera = ctx.camera;
    this.isSoftwareGl = ctx.isSoftwareGl;

    this.heldViewmodel = new HeldViewmodel();
    this.camera.add(this.heldViewmodel.group);

    this.world = new WorldManager(savedWorld ? savedWorld.seed : seed, savedWorld?.modifiedChunks, savedWorld?.blockEntities, savedWorld?.modifiedChunkMeta);
    this.chunkRenderer = new ChunkRenderer(this.scene, this.renderer);
    this.doorRenderer = new DoorRenderer(this.scene);
    this.skyWeather = new SkyWeatherSystem(this.scene, this.isSoftwareGl);
    this.effects = new EffectsPool(this.scene);
    this.mobs = new MobManager(this.scene);
    this.droppedItems = new DroppedItemManager(this.scene);
    this.postProcess = new PostProcessor(this.renderer, this.scene, this.camera, this.isSoftwareGl, Math.max(1, container.clientWidth || window.innerWidth || 1280), Math.max(1, container.clientHeight || window.innerHeight || 720));
    this.player = new PlayerController(this.world.seed, savedWorld?.player, savedWorld?.respawnPoint, savedWorld?.gameMode ?? initialGameMode);
    this.droppedItems.restoreSavedDrops(savedWorld?.droppedItems);
    this.containers.onDropOutside = (s) => this.spawnDroppedFromPlayer(s.itemId, s.count, s.durability);

    if (savedWorld) {
      this.dayCount = savedWorld.dayCount;
      this.timeOfDay = savedWorld.timeOfDay;
      this.weather = savedWorld.weather;
    }

    const pcx = worldToChunkCoord(this.player.physics.x);
    const pcz = worldToChunkCoord(this.player.physics.z);
    const initDist = this.isSoftwareGl ? Math.min(2, this.settings.renderDistance) : this.settings.renderDistance;
    this.chunkRenderer.prebuildAllVisible(this.world, pcx, pcz, initDist);
    this.mobs.spawnInitialWildlife(
      this.player.physics.x,
      this.player.physics.z,
      (x, z) => this.world.getTopSolidY(x, z),
      this.world.getBlock,
    );

    if (!this.isSoftwareGl) { try { this.renderer.compile(this.scene, this.camera); } catch { /* render on demand */ } }

    this.input = new InputController(this.renderer.domElement, {
      getPhase: () => this.phase,
      isInventoryOpen: () => this.isInventoryOpen,
      getSensitivity: () => this.settings.mouseSensitivity,
      onToggleInventory: (f) => this.toggleInventory(f),
      onSetPhase: (p) => this.setPhase(p),
      onSelectSlot: (i) => this.selectSlot(i),
      onDropItem: () => this.dropSelectedItem(),
      onToggleMute: () => this.updateSettings({ ...this.settings, muted: !this.settings.muted }),
      onLeftDown: () => this.onLeftClickDown(),
      onLeftUp: () => { this.player.miningTarget = null; },
      onRightClick: () => { this.mouseRightPending = true; },
      onPointerLockChange: () => this.pushHud(),
      onLookDelta: (dy, dp) => {
        const next = this.input.applyLook(this.player.yaw, this.player.pitch, dy, dp);
        this.player.yaw = next.yaw;
        this.player.pitch = next.pitch;
      },
      onWheelDelta: (dir) => this.selectSlot((this.player.inv.selectedSlot + dir + 9) % 9),
      onSpaceDoubleTap: () => this.toggleCreativeFlight(),
    });

    window.addEventListener('resize', this.onResize);
    this.updateHeldMeshVisual();
    this.pushHud();
    this.startLoop();
  }

  private onResize = (): void => {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth || 1280);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight || 720);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.postProcess.setSize(w, h);
  };

  private onLeftClickDown(): void {
    this.player.viewAnimKind = this.currentMobHit ? 'attack' : 'mine';
    this.player.swingAnim = 1.0;
    if (this.currentMobHit) {
      if (this.player.attackMob(this.currentMobHit, this.mobs, this.effects, this.sound, (m) => this.showStatus(m), this.spawnDropAt)) {
        this.hitstopTimer = 0.04;
        this.updateHeldMeshVisual();
        this.pushHud();
      }
    }
  }

  public requestLock(): void { this.input.requestLock(); }

  public setPhase(next: GamePhase): void {
    this.phase = next;
    this.input.clearHeld();
    if (next !== GamePhase.Playing) {
      this.isInventoryOpen = false;
      this.containers.returnTransientItems(this.player.inv);
      document.exitPointerLock?.();
    } else {
      this.player.syncCamera(this.camera, this.heldViewmodel, false);
    }
    this.heldViewmodel.group.visible = next === GamePhase.Playing && !this.isInventoryOpen;
    this.onPhaseChange(next);
    this.pushHud();
  }

  public toggleInventory(force?: boolean): void {
    this.isInventoryOpen = force !== undefined ? force : !this.isInventoryOpen;
    this.input.clearHeld();
    if (this.isInventoryOpen) {
      document.exitPointerLock?.();
    } else {
      this.containers.returnTransientItems(this.player.inv);
      this.updateHeldMeshVisual();
    }
    this.heldViewmodel.group.visible = this.phase === GamePhase.Playing && !this.isInventoryOpen;
    this.pushHud();
  }

  public mutateContainer(fn: (c: ContainerController, inv: PlayerInventoryState, world: WorldManager) => boolean): boolean {
    const changed = fn(this.containers, this.player.inv, this.world);
    if (changed) {
      this.updateHeldMeshVisual();
      this.pushHud();
    }
    return changed;
  }

  public selectSlot(index: number): void {
    this.player.inv.selectedSlot = THREE.MathUtils.clamp(index, 0, 8);
    this.updateHeldMeshVisual();
    this.pushHud();
  }

  private updateHeldMeshVisual(): void {
    const slot = this.player.inv.hotbar[this.player.inv.selectedSlot];
    this.heldViewmodel.updateItem(slot?.itemId ?? null);
  }

  private spawnDropAt = (itemId: string, count: number, x: number, y: number, z: number, durability?: number): void => {
    this.droppedItems.spawnDrop(itemId, count, durability, x, y, z, (Math.random() - 0.5) * 1.4, 2.4, (Math.random() - 0.5) * 1.4);
  };

  private spawnDroppedFromPlayer(itemId: string, count: number, durability?: number): void {
    const s = computePlayerDropSpawn(this.player, this.world.getCollisionBlock);
    this.droppedItems.spawnDrop(itemId, count, durability, s.x, s.y, s.z, s.vx, s.vy, s.vz);
  }

  public dropSelectedItem(): void {
    const slot = this.player.inv.hotbar[this.player.inv.selectedSlot];
    if (!slot) return;
    this.spawnDroppedFromPlayer(slot.itemId, 1, slot.durability);
    slot.count -= 1;
    if (slot.count <= 0) this.player.inv.hotbar[this.player.inv.selectedSlot] = null;
    this.updateHeldMeshVisual();
    this.showStatus('Dropped 1 item');
    this.pushHud();
  }

  public craft(recipeId: string): boolean {
    const ok = this.player.craft(recipeId, this.world, this.sound);
    if (ok) {
      this.updateHeldMeshVisual();
      this.pushHud();
    }
    return ok;
  }

  public updateSettings(next: GameSettings): void {
    this.settings = { ...next };
    this.sound.muted = next.muted;
    this.camera.fov = next.fov;
    this.camera.updateProjectionMatrix();
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = 20;
      this.scene.fog.far = next.renderDistance * 16 + 10;
    }
    this.pushHud();
  }

  public setTimeAndWeather(timeOfDay?: number, weather?: WeatherType): void {
    if (timeOfDay !== undefined) this.timeOfDay = timeOfDay;
    if (weather !== undefined) this.weather = weather;
    this.pushHud();
  }

  public setGameMode(mode: GameMode): void {
    this.player.setGameMode(mode);
    this.showStatus(mode === 'creative' ? 'Switched to Creative Mode' : 'Switched to Survival Mode');
    this.pushHud();
  }

  private toggleCreativeFlight(): void {
    if (this.player.gameMode !== 'creative') return;
    const flying = this.player.toggleFlight();
    this.showStatus(flying ? 'Flight Enabled' : 'Flight Disabled');
    this.pushHud();
  }

  public respawnPlayer(): void {
    this.player.respawn(this.world.seed);
    this.setPhase(GamePhase.Playing);
  }

  public exportSaveData(): WorldSaveData {
    return buildWorldSaveData(this.world, this.player, this.containers, this.dayCount, this.timeOfDay, this.weather, this.droppedItems.exportSavedDrops());
  }

  public showStatus(msg: string): void {
    this.statusMessage = msg;
    this.statusTimer = 2.6;
  }

  private startLoop(): void {
    const tick = () => {
      if (this.destroyed) return;
      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.step(dt);
      this.postProcess.render();
      if (this.isSoftwareGl) this.afterDraw(tick);
      else this.frameId = requestAnimationFrame(tick);
    };
    if (this.isSoftwareGl) this.afterDraw(tick);
    else this.frameId = requestAnimationFrame(tick);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.destroyed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) this.frameId = window.setTimeout(poll, 5);
      else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private step(dt: number): void {
    this.elapsedSec += dt;
    this.chunkRenderer.updateWater(this.elapsedSec);
    if (this.statusTimer > 0) {
      this.statusTimer -= dt;
      if (this.statusTimer <= 0) this.statusMessage = null;
    }

    const p = this.player.physics;
    if (this.phase === GamePhase.Title) {
      this.titleOrbitAngle += dt * 0.14;
      this.camera.up.set(0, 1, 0);
      this.camera.rotation.order = 'YXZ';
      this.camera.position.set(p.x + Math.cos(this.titleOrbitAngle) * 18, p.y + 11, p.z + Math.sin(this.titleOrbitAngle) * 18);
      this.camera.lookAt(p.x, p.y + 1, p.z);
      this.heldViewmodel.group.visible = false;
      this.effects.setTargetHighlight(0, 0, 0, false, 0);
      _playerPos.set(p.x, p.y, p.z);
      this.skyWeather.update(this.scene, _playerPos, this.timeOfDay, this.weather, dt);
      return;
    }
    if (this.phase !== GamePhase.Playing) {
      this.heldViewmodel.group.visible = false;
      return;
    }

    this.heldViewmodel.group.visible = !this.isInventoryOpen;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.effects.update(dt);
      return;
    }

    this.timeOfDay += dt / 360;
    if (this.timeOfDay >= 1) { this.timeOfDay -= 1; this.dayCount++; }
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 60 + Math.random() * 80;
      const biome = sampleBiome(p.x, p.z, this.world.seed);
      const roll = Math.random();
      this.weather = roll < 0.62 ? WeatherType.Clear : biome === BiomeId.Snow ? WeatherType.Snow : roll < 0.88 ? WeatherType.Rain : WeatherType.Storm;
    }

    const jumpBuf = this.input.jumpBuffered;
    this.input.jumpBuffered = false;
    this.player.stepSurvivalAndMove(dt, this.input.keys, jumpBuf, this.isInventoryOpen, this.world, this.sound, () => this.setPhase(GamePhase.GameOver));
    this.player.syncCamera(this.camera, this.heldViewmodel, this.player.crouching);

    this.camera.getWorldDirection(_fwd);
    this.currentMobHit = this.mobs.raycastMob(this.camera.position.x, this.camera.position.y, this.camera.position.z, _fwd.x, _fwd.y, _fwd.z, 4.5, this.world.getCollisionBlock);
    this.currentRayHit = this.currentMobHit ? null : raycastVoxel(this.camera.position.x, this.camera.position.y, this.camera.position.z, _fwd.x, _fwd.y, _fwd.z, 5.2, this.world.getBlock);

    if (this.input.mouseLeft && this.currentRayHit && !this.isInventoryOpen) {
      if (this.player.mineBlockStep(dt, this.currentRayHit, this.world, this.effects, this.sound, this.spawnDropAt)) {
        this.updateHeldMeshVisual();
        this.pushHud();
      }
    } else {
      this.player.miningTarget = null;
    }

    if (this.mouseRightPending) {
      this.mouseRightPending = false;
      const sneaking = this.input.keys.has('ShiftLeft') || this.input.keys.has('ShiftRight');
      const hitDef = this.currentRayHit ? BLOCKS[this.currentRayHit.blockId] : undefined;
      if (!sneaking && this.currentRayHit && hitDef?.functional && !this.isInventoryOpen) {
        const res = this.containers.handleWorldInteract(this.currentRayHit, this.world, this.sound, (bx, by, bz) => this.handleBedInteract(bx, by, bz));
        if (res.openModal) this.toggleInventory(true);
        else this.pushHud();
      } else {
        const heldId = this.player.inv.hotbar[this.player.inv.selectedSlot]?.itemId;
        const fluidHit = heldId === 'bucket'
          ? raycastVoxel(this.camera.position.x, this.camera.position.y, this.camera.position.z, _fwd.x, _fwd.y, _fwd.z, 5.2, this.world.getBlock, true)
          : null;
        if (this.player.rightClickAction(this.currentRayHit, fluidHit, this.world, this.sound, (m) => this.showStatus(m))) {
          this.updateHeldMeshVisual();
          this.pushHud();
        }
      }
    }

    const showHighlight = Boolean(this.currentRayHit && !this.isInventoryOpen);
    const selBounds = showHighlight && this.currentRayHit ? getBlockSelectionBox(this.currentRayHit.bx, this.currentRayHit.by, this.currentRayHit.bz, this.world.getBlock, this.world.getBlockMeta) : null;
    this.effects.setTargetHighlight(this.currentRayHit?.bx ?? 0, this.currentRayHit?.by ?? 0, this.currentRayHit?.bz ?? 0, showHighlight, this.player.miningTarget?.progress ?? 0, selBounds);

    const activeDist = this.isSoftwareGl ? Math.min(2, this.settings.renderDistance) : this.settings.renderDistance;
    this.chunkRenderer.updateChunks(this.world, worldToChunkCoord(p.x), worldToChunkCoord(p.z), activeDist, this.isSoftwareGl ? 1 : 3);
    this.doorRenderer.sync(this.world.blockEntities.getAllDoors(), dt);
    if (this.world.blockEntities.tickFurnaces(dt) && Math.random() < dt * 7) {
      for (const f of this.world.blockEntities.getLitFurnaces()) {
        this.effects.spawnBurst(f.x + 0.5, f.y + 0.65, f.z + 0.5, 0xff7b24, 2, 1.4);
      }
    }

    _playerPos.set(p.x, p.y, p.z);
    const isNight = this.timeOfDay > 0.52 && this.timeOfDay < 0.96;
    this.mobs.update(dt, _playerPos, isNight, this.world.getCollisionBlock, (x, z) => this.world.getTopSolidY(x, z), {
      onPlayerHurt: (dmg, sx, sz) => { this.player.takeDamage(dmg, sx, sz, this.sound, () => this.setPhase(GamePhase.GameOver)); this.pushHud(); },
      onCreeperFuse: () => this.sound.playThunder(),
      onCreeperExplode: (ex, ey, ez) => {
        this.sound.playExplosion();
        this.player.cameraShake = 0.85;
        carveExplosion(this.world, this.effects, ex, ey, ez);
      },
    }, this.player.getHitbox(), this.player.health > 0);

    this.skyWeather.update(this.scene, _playerPos, this.timeOfDay, this.weather, dt, () => this.sound.playThunder());
    this.droppedItems.update(dt, p.x, p.y, p.z, this.world.getCollisionBlock, this.player.inv, this.sound, () => {
      this.updateHeldMeshVisual();
      this.pushHud();
    }, this.player.getHitbox());
    this.effects.update(dt);

    this.hudThrottle += dt;
    if (this.hudThrottle >= 0.12) { this.hudThrottle = 0; this.pushHud(); }
  }

  private handleBedInteract(bx: number, by: number, bz: number): void {
    const res = resolveBedSleep(this.player, bx, by, bz, this.timeOfDay, this.dayCount, this.weather);
    this.timeOfDay = res.timeOfDay;
    this.dayCount = res.dayCount;
    this.weather = res.weather;
    this.showStatus(res.message);
    this.sound.playPickup();
  }

  private pushHud(): void {
    this.onHudUpdate(
      buildHudSnapshot({
        world: this.world,
        player: this.player,
        containers: this.containers,
        dayCount: this.dayCount,
        timeOfDay: this.timeOfDay,
        weather: this.weather,
        pointerLocked: this.input.pointerLocked,
        isInventoryOpen: this.isInventoryOpen,
        currentRayHit: this.currentRayHit,
        currentMobHit: this.currentMobHit,
        statusMessage: this.statusMessage,
      }),
    );
  }

  public dispose(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    this.input.dispose();
    this.chunkRenderer.dispose();
    this.doorRenderer.dispose();
    this.skyWeather.dispose();
    this.effects.dispose();
    this.mobs.dispose();
    this.droppedItems.dispose();
    this.heldViewmodel.dispose();
    this.postProcess.dispose();
    clearVoxelItemModelCache();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) this.container.removeChild(this.renderer.domElement);
  }
}
