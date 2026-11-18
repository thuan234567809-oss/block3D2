import * as THREE from 'three';
import { SoundEngine } from '../audio/soundEngine';
import { addItemToInventory, PlayerInventoryState } from '../player/inventory';
import { getPlayerHitbox, PlayerHitbox } from '../player/playerTransform';
import { disposeGroupResources } from '../render/voxelGridBuilder';
import { getVoxelItemModel } from '../render/voxelItemModels';
import { SavedDroppedItem } from '../types/game';
import { BlockAccessor } from '../world/mesher';
import {
  canCollectDrop,
  canInventoryAcceptAny,
  DEFAULT_DROP_LIFETIME,
  DroppedItemBody,
  findDropShadowY,
  mergeNearbyDropBodies,
  stepDropBody,
} from './droppedItemPhysics';

interface DroppedEntry extends DroppedItemBody {
  spinOffset: number;
  root: THREE.Group;
  model: THREE.Group;
  shadow: THREE.Mesh;
}

export class DroppedItemManager {
  private group = new THREE.Group();
  public items: DroppedEntry[] = [];
  private mergeAccum = 0;
  private lifetimeSec: number;
  private maxDrops: number;
  private shadowGeo = new THREE.CircleGeometry(0.18, 12);
  private shadowMat = new THREE.MeshBasicMaterial({
    color: 0x05070a,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });

  constructor(scene: THREE.Scene, lifetimeSec = DEFAULT_DROP_LIFETIME, maxDrops = 96) {
    this.lifetimeSec = lifetimeSec;
    this.maxDrops = maxDrops;
    this.shadowGeo.rotateX(-Math.PI / 2);
    scene.add(this.group);
  }

  public spawnDrop(
    itemId: string,
    count: number,
    durability: number | undefined,
    x: number,
    y: number,
    z: number,
    vx = 0,
    vy = 2.4,
    vz = 0,
    age = 0,
  ): void {
    if (count <= 0) return;
    if (this.items.length >= this.maxDrops) {
      mergeNearbyDropBodies(this.items, (removed) => this.removeEntry(removed));
    }
    if (this.items.length >= this.maxDrops) {
      const oldest = this.items.shift()!;
      this.removeEntry(oldest);
    }

    const root = new THREE.Group();
    root.position.set(x, y, z);
    root.scale.setScalar(age > 0.2 ? 1 : 0.22);

    const model = getVoxelItemModel(itemId);
    model.scale.setScalar(0.85);
    root.add(model);

    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.position.set(x, y - 0.16, z);
    this.group.add(root, shadow);

    this.items.push({
      itemId,
      count,
      durability,
      x,
      y,
      z,
      vx,
      vy,
      vz,
      age,
      grounded: false,
      pickingUp: false,
      pickupProgress: 0,
      spinOffset: Math.random() * Math.PI * 2,
      root,
      model,
      shadow,
    });
  }

  public exportSavedDrops(): SavedDroppedItem[] {
    return this.items
      .filter((d) => !d.pickingUp && d.count > 0)
      .map((d) => ({
        itemId: d.itemId,
        count: d.count,
        durability: d.durability,
        x: d.x,
        y: d.y,
        z: d.z,
        vx: d.vx,
        vy: d.vy,
        vz: d.vz,
        age: d.age,
      }));
  }

  public restoreSavedDrops(saved?: SavedDroppedItem[]): void {
    if (!saved || saved.length === 0) return;
    for (const s of saved) {
      this.spawnDrop(s.itemId, s.count, s.durability, s.x, s.y, s.z, s.vx, s.vy, s.vz, s.age);
    }
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    getBlock: BlockAccessor,
    inv: PlayerInventoryState,
    sound: SoundEngine,
    onCollected: () => void,
    playerHitbox: PlayerHitbox = getPlayerHitbox({ x: playerX, y: playerY, z: playerZ }),
  ): void {
    this.mergeAccum += dt;
    if (this.mergeAccum >= 0.35 && this.items.length > 1) {
      this.mergeAccum = 0;
      mergeNearbyDropBodies(this.items, (removed) => this.removeEntry(removed));
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const d = this.items[i];
      d.age += dt;
      if (d.age > this.lifetimeSec) {
        this.items.splice(i, 1);
        this.removeEntry(d);
        continue;
      }

      if (d.pickingUp) {
        d.pickupProgress = Math.min(1, d.pickupProgress + dt / 0.13);
        const lerpAlpha = Math.min(1, dt * 22);
        d.x = THREE.MathUtils.lerp(d.x, playerHitbox.centerX, lerpAlpha);
        d.y = THREE.MathUtils.lerp(d.y, playerHitbox.centerY, lerpAlpha);
        d.z = THREE.MathUtils.lerp(d.z, playerHitbox.centerZ, lerpAlpha);
        d.root.position.set(d.x, d.y, d.z);
        d.root.scale.setScalar(Math.max(0.15, 1 - d.pickupProgress * 0.85));
        d.model.rotation.y += dt * 10;
        d.shadow.visible = false;

        if (d.pickupProgress >= 1) {
          const rem = addItemToInventory(inv, d.itemId, d.count, d.durability);
          if (rem < d.count) {
            sound.playPickup();
            if (rem <= 0) {
              this.items.splice(i, 1);
              this.removeEntry(d);
            } else {
              // Partial stack left over: cancel pickup glide and keep remainder in world
              d.count = rem;
              d.pickingUp = false;
              d.pickupProgress = 0;
              d.root.scale.setScalar(1);
              d.shadow.visible = true;
            }
            onCollected();
          } else {
            d.pickingUp = false;
            d.pickupProgress = 0;
            d.root.scale.setScalar(1);
            d.shadow.visible = true;
          }
        }
        continue;
      }

      stepDropBody(d, dt, getBlock);

      // Spawn pop-in scale + smooth rotation/floating animation decoupled from physics coordinates
      const spawnScale = d.age < 0.18 ? 0.25 + (d.age / 0.18) * 0.75 : 1.0;
      const bob = d.grounded ? Math.sin(d.age * 3.1 + d.spinOffset) * 0.075 : 0;
      d.root.scale.setScalar(spawnScale);
      d.root.position.set(d.x, d.y + bob, d.z);
      d.model.rotation.y = d.age * 1.9 + d.spinOffset;

      const groundY = findDropShadowY(d.x, d.y, d.z, getBlock);
      if (groundY !== null) {
        const dropHeight = Math.max(0, d.y - groundY);
        const sScale = Math.max(0.35, 1 - dropHeight * 0.16) * spawnScale;
        d.shadow.visible = true;
        d.shadow.position.set(d.x, groundY + 0.015, d.z);
        d.shadow.scale.set(sScale, 1, sScale);
      } else {
        d.shadow.visible = false;
      }

      if (canCollectDrop(d, playerHitbox, getBlock) && canInventoryAcceptAny(inv, d.itemId)) {
        d.pickingUp = true;
        d.pickupProgress = 0;
      }
    }
  }

  private removeEntry(d: DroppedEntry): void {
    this.group.remove(d.root, d.shadow);
    disposeGroupResources(d.model);
  }

  public dispose(): void {
    for (const d of this.items) this.removeEntry(d);
    this.items = [];
    this.shadowGeo.dispose();
    this.shadowMat.dispose();
  }
}
