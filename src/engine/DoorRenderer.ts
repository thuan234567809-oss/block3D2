import * as THREE from 'three';
import { DoorEntity } from '../types/game';
import { posKey } from '../world/blockEntities';

interface DoorMeshRecord {
  pivot: THREE.Group;
  anim: number;
}

export class DoorRenderer {
  private group = new THREE.Group();
  private doors = new Map<string, DoorMeshRecord>();
  private woodMat = new THREE.MeshStandardMaterial({ color: 0xa3713c, roughness: 0.78 });
  private frameMat = new THREE.MeshStandardMaterial({ color: 0x6b4622, roughness: 0.85 });
  private handleMat = new THREE.MeshStandardMaterial({ color: 0xe6c34c, roughness: 0.35, metalness: 0.6 });
  private panelGeo = new THREE.BoxGeometry(0.96, 1.0, 0.16);
  private windowGeo = new THREE.BoxGeometry(0.56, 0.36, 0.18);
  private handleGeo = new THREE.BoxGeometry(0.1, 0.14, 0.22);

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  private createDoorRecord(d: DoorEntity): DoorMeshRecord {
    const pivot = new THREE.Group();
    // Place hinge at corner of voxel based on cardinal facing
    const hingeOffset: [number, number] =
      d.facing === 0 ? [0.04, 0.08] :
      d.facing === 1 ? [0.92, 0.04] :
      d.facing === 2 ? [0.96, 0.92] :
      [0.08, 0.96];

    pivot.position.set(d.x + hingeOffset[0], d.y + 0.5, d.z + hingeOffset[1]);

    const panel = new THREE.Mesh(this.panelGeo, this.woodMat);
    panel.position.set(0.44, 0, 0);
    panel.castShadow = true;
    panel.receiveShadow = true;

    const inset = new THREE.Mesh(this.windowGeo, this.frameMat);
    inset.position.set(0.44, 0.18, 0);

    const handle = new THREE.Mesh(this.handleGeo, this.handleMat);
    handle.position.set(0.76, -0.02, 0);

    const leafGroup = new THREE.Group();
    leafGroup.add(panel, inset, handle);

    pivot.add(leafGroup);
    this.group.add(pivot);

    const initial = d.open ? 1 : 0;
    pivot.rotation.y = -(d.facing * Math.PI) / 2 - initial * (Math.PI * 0.48);
    return { pivot, anim: initial };
  }

  public sync(entities: DoorEntity[], dt: number): void {
    const activeKeys = new Set<string>();

    for (const d of entities) {
      const k = posKey(d.x, d.y, d.z);
      activeKeys.add(k);
      let rec = this.doors.get(k);
      if (!rec) {
        rec = this.createDoorRecord(d);
        this.doors.set(k, rec);
      }
      const target = d.open ? 1 : 0;
      rec.anim = THREE.MathUtils.damp(rec.anim, target, 14, dt);
      rec.pivot.rotation.y = -(d.facing * Math.PI) / 2 - rec.anim * (Math.PI * 0.48);
    }

    for (const [k, rec] of this.doors.entries()) {
      if (!activeKeys.has(k)) {
        this.group.remove(rec.pivot);
        this.doors.delete(k);
      }
    }
  }

  public dispose(): void {
    this.panelGeo.dispose();
    this.windowGeo.dispose();
    this.handleGeo.dispose();
    this.woodMat.dispose();
    this.frameMat.dispose();
    this.handleMat.dispose();
  }
}
