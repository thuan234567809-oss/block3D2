import * as THREE from 'three';
import { ITEMS } from '../data/items';
import { ToolKind } from '../types/game';
import { resolveFirstPersonItemTransform } from './firstPersonTransforms';
import { LIGHTING_CONFIG } from './lightingConfig';
import { disposeGroupResources, getVoxelPixelTexture } from './voxelGridBuilder';
import { getVoxelItemModel } from './voxelItemModels';

export type ViewAnimKind = 'idle' | 'walk' | 'sprint' | 'jump' | 'mine' | 'attack' | 'place' | 'eat';

export interface ViewMotionInput {
  dt: number;
  timeSec: number;
  moveSpeed: number;
  sprinting: boolean;
  onGround: boolean;
  vy: number;
  toolKind?: ToolKind;
  animKind: ViewAnimKind;
  swingAnim: number;
}

function createSkinTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#cf946d';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#b97c56';
  for (let i = 0; i < 16; i += 2) {
    ctx.fillRect(i, 0, 1, 2);
    ctx.fillRect(0, i, 2, 1);
  }
  ctx.fillStyle = '#dba581';
  ctx.fillRect(3, 3, 10, 9);
  ctx.fillStyle = '#c48660';
  ctx.fillRect(4, 12, 8, 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

export class HeldViewmodel {
  public group = new THREE.Group();
  private armGroup = new THREE.Group();
  private wristGroup = new THREE.Group();
  private fingerGroup = new THREE.Group();
  private itemMount = new THREE.Group();
  private activeModel: THREE.Group | null = null;
  private activeItemId: string | null = '__init__';

  private skinTex: THREE.CanvasTexture | null;
  private skinMat: THREE.MeshStandardMaterial;
  private knuckleMat: THREE.MeshStandardMaterial;
  private sleeveMat: THREE.MeshStandardMaterial;
  private cuffMat: THREE.MeshStandardMaterial;

  // Smoothed spring channels so idle/walk/sprint/jump/swing never snap abruptly
  private smoothPos = new THREE.Vector3(0.4, -0.34, -0.58);
  private smoothRot = new THREE.Euler(0, 0.16, 0);
  private airVelSmooth = 0;

  constructor() {
    this.skinTex = createSkinTexture();
    const grain = getVoxelPixelTexture();
    const envInt = LIGHTING_CONFIG.materials.nonMetalItemEnvIntensity;
    this.skinMat = new THREE.MeshStandardMaterial({ map: this.skinTex, roughness: 0.84, metalness: 0.0, envMapIntensity: envInt });
    this.knuckleMat = new THREE.MeshStandardMaterial({ color: 0xc28660, map: grain, roughness: 0.86, metalness: 0.0, envMapIntensity: envInt });
    this.sleeveMat = new THREE.MeshStandardMaterial({ color: 0x3569a1, map: grain, roughness: 0.9, metalness: 0.0, envMapIntensity: envInt });
    this.cuffMat = new THREE.MeshStandardMaterial({ color: 0x244870, map: grain, roughness: 0.86, metalness: 0.02, envMapIntensity: envInt });

    // Forearm sleeve + folded darker cuff + shaded wrist
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.155, 0.26), this.sleeveMat);
    sleeve.position.set(0.08, -0.09, 0.17);
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.164, 0.164, 0.045), this.cuffMat);
    cuff.position.set(0.08, -0.09, 0.025);
    const forearmSkin = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.132, 0.08), this.skinMat);
    forearmSkin.position.set(0.072, -0.082, -0.032);

    // Sculpted palm + thumb + curled grip fingers seated in wristGroup
    this.wristGroup.position.set(0.056, -0.068, -0.105);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.118, 0.118), this.skinMat);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.068, 0.068), this.knuckleMat);
    thumb.position.set(-0.058, 0.048, -0.022);
    thumb.rotation.set(-0.22, 0.18, 0.34);

    const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.048, 0.048), this.knuckleMat);
    knuckles.position.set(-0.008, -0.018, -0.072);
    const fingerTips = new THREE.Mesh(new THREE.BoxGeometry(0.114, 0.048, 0.052), this.skinMat);
    fingerTips.position.set(-0.024, -0.042, -0.055);
    this.fingerGroup.add(knuckles, fingerTips);

    this.wristGroup.add(palm, thumb, this.fingerGroup, this.itemMount);
    this.armGroup.add(sleeve, cuff, forearmSkin, this.wristGroup);
    this.armGroup.rotation.set(0.14, -0.16, 0.06);
    this.group.add(this.armGroup);
    this.group.position.copy(this.smoothPos);
  }

  public updateItem(itemId: string | null): void {
    if (itemId === this.activeItemId) return;
    this.activeItemId = itemId;
    if (this.activeModel) {
      this.itemMount.remove(this.activeModel);
      disposeGroupResources(this.activeModel);
      this.activeModel = null;
    }

    if (!itemId || !ITEMS[itemId]) {
      this.armGroup.position.set(0.01, 0.0, -0.04);
      this.fingerGroup.rotation.x = 0.15;
      return;
    }

    const def = ITEMS[itemId];
    this.armGroup.position.set(0.02, -0.02, 0.01);
    this.fingerGroup.rotation.x = 0.56; // curl fingers cleanly around held handle/item
    const model = getVoxelItemModel(itemId);
    const transform = resolveFirstPersonItemTransform(def);

    model.scale.setScalar(transform.scale);
    model.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2], 'XYZ');
    model.position.set(transform.position[0], transform.position[1], transform.position[2]);

    this.activeModel = model;
    this.itemMount.add(model);
  }

  public updateMotion(input: ViewMotionInput): void {
    const { dt, timeSec, moveSpeed, sprinting, onGround, vy, toolKind, animKind, swingAnim } = input;
    const isMoving = onGround && moveSpeed > 0.5;
    const strideFreq = sprinting ? 11.8 : 8.5;
    const strideAmp = isMoving ? Math.min(1.25, moveSpeed / 5.2) * (sprinting ? 1.3 : 1.0) : 0;

    const idleX = Math.cos(timeSec * 1.5) * 0.004;
    const idleY = Math.sin(timeSec * 2.1) * 0.005;
    const walkX = Math.sin(timeSec * strideFreq) * 0.02 * strideAmp;
    const walkY = Math.abs(Math.cos(timeSec * strideFreq)) * 0.018 * strideAmp;

    // Airborne / landing inertia
    const targetAirDip = onGround ? 0 : THREE.MathUtils.clamp(-vy * 0.006, -0.055, 0.05);
    this.airVelSmooth = THREE.MathUtils.lerp(this.airVelSmooth, targetAirDip, Math.min(1, dt * 10));

    const s = Math.sin(swingAnim * Math.PI);
    let tx = 0.4 + idleX + walkX;
    let ty = -0.34 + idleY - walkY + this.airVelSmooth;
    let tz = sprinting && isMoving ? -0.56 : -0.58;
    let rx = sprinting && isMoving ? -0.1 : 0;
    let ry = sprinting && isMoving ? 0.24 : 0.16;
    let rz = isMoving ? Math.sin(timeSec * strideFreq) * 0.03 * strideAmp : 0;
    let wristRx = 0;

    if (animKind === 'mine') {
      const chop = Math.sin(swingAnim * Math.PI * 1.35);
      const isShovel = toolKind === 'shovel';
      tx -= s * (isShovel ? 0.04 : 0.08);
      ty -= Math.abs(chop) * (isShovel ? 0.05 : 0.1);
      tz -= s * 0.15;
      rx = -s * (isShovel ? 0.68 : 0.92);
      rz = s * 0.22;
      wristRx = -s * 0.32;
    } else if (animKind === 'attack') {
      const isSword = toolKind === 'sword';
      tx -= s * (isSword ? 0.2 : 0.15);
      ty -= s * 0.07;
      tz -= s * 0.22;
      rx = -s * (isSword ? 0.78 : 0.95);
      ry += s * (isSword ? 0.42 : 0.3);
      rz = s * (isSword ? 0.48 : 0.28);
      wristRx = -s * 0.24;
    } else if (animKind === 'place') {
      ty -= s * 0.055;
      tz -= s * 0.14;
      rx = -s * 0.5;
      wristRx = -s * 0.2;
    } else if (animKind === 'eat') {
      const chew = Math.sin(timeSec * 24) * 0.016 * s;
      tx -= s * 0.22;
      ty += s * 0.11 + chew;
      tz += s * 0.07;
      rx = s * 0.36;
      ry -= s * 0.28;
    }

    const blend = Math.min(1, dt * 18);
    this.smoothPos.x = THREE.MathUtils.lerp(this.smoothPos.x, tx, blend);
    this.smoothPos.y = THREE.MathUtils.lerp(this.smoothPos.y, ty, blend);
    this.smoothPos.z = THREE.MathUtils.lerp(this.smoothPos.z, tz, blend);
    this.smoothRot.x = THREE.MathUtils.lerp(this.smoothRot.x, rx, blend);
    this.smoothRot.y = THREE.MathUtils.lerp(this.smoothRot.y, ry, blend);
    this.smoothRot.z = THREE.MathUtils.lerp(this.smoothRot.z, rz, blend);

    this.group.position.copy(this.smoothPos);
    this.group.rotation.copy(this.smoothRot);
    this.wristGroup.rotation.x = THREE.MathUtils.lerp(this.wristGroup.rotation.x, wristRx, blend);
  }

  public dispose(): void {
    if (this.activeModel) {
      this.itemMount.remove(this.activeModel);
      disposeGroupResources(this.activeModel);
      this.activeModel = null;
    }
    this.armGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.skinTex?.dispose();
    this.skinMat.dispose();
    this.knuckleMat.dispose();
    this.sleeveMat.dispose();
    this.cuffMat.dispose();
  }
}
