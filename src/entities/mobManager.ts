import * as THREE from 'three';
import { isBlockFluid, isBlockSolid } from '../data/blocks';
import { MOB_CONFIG } from '../data/mobs';
export { MOB_CONFIG };
import { getPlayerHitbox, hasLineOfSightVoxel, PlayerHitbox } from '../player/playerTransform';
import { animateMobRig } from '../render/mobAnimator';
import { createMobRig, disposeMobRig, disposeSharedMobTextures, MobRig } from '../render/mobsMesh';
import { BlockId, MobType } from '../types/game';
import { BlockAccessor } from '../world/mesher';
import { canMobExecuteAttack, evaluateMobTarget, MOB_HITBOXES } from './mobTargeting';

export interface MobEntity {
  id: number;
  type: MobType;
  hostile: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  walkPhase: number;
  wanderTimer: number;
  wanderAngle: number;
  attackCooldown: number;
  fuseTimer: number; // Creeper fuse countdown
  fleeTimer: number;
  hitFlashTimer: number;
  koTimer: number; // >0 means playing KO topple before removal
  animTime: number;
  attackAnimTimer: number;
  rig: MobRig;
}

interface ArrowProjectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  mesh: THREE.Mesh;
}

const _white = new THREE.Color(0xffffff);
const _tempCol = new THREE.Color();

const isCanopyBlock = (id: BlockId): boolean =>
  id === BlockId.OakLeaves ||
  id === BlockId.PineLeaves ||
  id === BlockId.JungleLeaves ||
  id === BlockId.BirchLeaves ||
  id === BlockId.AcaciaLeaves ||
  id === BlockId.DarkOakLeaves;

function resolveGroundSurfaceY(
  wx: number,
  wz: number,
  getTopY: (x: number, z: number) => number,
  getBlock: BlockAccessor,
): number | null {
  let y = getTopY(wx, wz);
  while (y > 36 && isCanopyBlock(getBlock(wx, y, wz))) {
    y--;
  }
  const ground = getBlock(wx, y, wz);
  if (y <= 36 || ground === BlockId.Water || !isBlockSolid(ground)) return null;
  const headClear = !isBlockSolid(getBlock(wx, y + 1, wz)) && !isBlockSolid(getBlock(wx, y + 2, wz));
  return headClear ? y + 1 : null;
}

export class MobManager {
  public mobs: MobEntity[] = [];
  private arrows: ArrowProjectile[] = [];
  private nextId = 1;
  private spawnTimer = 2.0;
  private scene: THREE.Scene;
  private arrowGeo: THREE.BoxGeometry;
  private arrowMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.arrowGeo = new THREE.BoxGeometry(0.08, 0.08, 0.55);
    this.arrowMat = new THREE.MeshStandardMaterial({ color: 0xdfd4b8, roughness: 0.6 });
  }

  public clearAll(): void {
    for (const m of this.mobs) {
      disposeMobRig(m.rig);
      this.scene.remove(m.rig.group);
    }
    this.mobs = [];
    for (const a of this.arrows) {
      this.scene.remove(a.mesh);
    }
    this.arrows = [];
  }

  public spawnInitialWildlife(px: number, pz: number, getTopY: (x: number, z: number) => number, getBlock: BlockAccessor): void {
    const passiveTypes = [MobType.Cow, MobType.Pig, MobType.Sheep, MobType.Chicken];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.4;
      const dist = 10 + (i % 3) * 5;
      const mx = Math.round(px + Math.cos(angle) * dist) + 0.5;
      const mz = Math.round(pz + Math.sin(angle) * dist) + 0.5;
      const spawnY = resolveGroundSurfaceY(Math.floor(mx), Math.floor(mz), getTopY, getBlock);
      if (spawnY !== null) {
        this.spawnMob(passiveTypes[i % passiveTypes.length], mx, spawnY, mz);
      }
    }
  }

  public spawnMob(type: MobType, x: number, y: number, z: number): MobEntity {
    const cfg = MOB_CONFIG[type];
    const rig = createMobRig(type);
    rig.group.position.set(x, y, z);
    this.scene.add(rig.group);
    const mob: MobEntity = {
      id: this.nextId++,
      type,
      hostile: cfg.hostile,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.random() * Math.PI * 2,
      hp: cfg.maxHp,
      maxHp: cfg.maxHp,
      walkPhase: Math.random() * 6,
      wanderTimer: 1 + Math.random() * 3,
      wanderAngle: Math.random() * Math.PI * 2,
      attackCooldown: 0.6,
      fuseTimer: -1,
      fleeTimer: 0,
      hitFlashTimer: 0,
      koTimer: 0,
      animTime: Math.random() * 10,
      attackAnimTimer: 0,
      rig,
    };
    this.mobs.push(mob);
    return mob;
  }

  public raycastMob(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
    getBlock?: BlockAccessor,
  ): MobEntity | null {
    let best: MobEntity | null = null;
    let bestDist = maxDist;

    for (const m of this.mobs) {
      if (m.koTimer > 0) continue;
      const spec = MOB_HITBOXES[m.type];
      const cx = m.x;
      const cy = m.y + spec.height * 0.5;
      const cz = m.z;
      const toX = cx - ox;
      const toY = cy - oy;
      const toZ = cz - oz;
      const proj = toX * dx + toY * dy + toZ * dz;
      if (proj < 0 || proj > bestDist) continue;
      const closestX = ox + dx * proj;
      const closestY = oy + dy * proj;
      const closestZ = oz + dz * proj;
      const horizSq = (closestX - cx) ** 2 + (closestZ - cz) ** 2;
      const vertDist = Math.abs(closestY - cy);
      if (horizSq <= spec.radius * spec.radius + 0.12 && vertDist <= spec.height * 0.55) {
        if (getBlock && !hasLineOfSightVoxel(ox, oy, oz, cx, cy, cz, getBlock, true)) continue;
        best = m;
        bestDist = proj;
      }
    }
    return best;
  }

  public damageMob(
    mob: MobEntity,
    amount: number,
    knockX: number,
    knockZ: number,
  ): { killed: boolean; drops: { itemId: string; count: number }[] } {
    if (mob.koTimer > 0) return { killed: false, drops: [] };
    mob.hp = Math.max(0, mob.hp - amount);
    mob.hitFlashTimer = 0.14;
    mob.vy = 4.2;
    mob.vx += knockX * 6;
    mob.vz += knockZ * 6;
    if (!mob.hostile) {
      mob.fleeTimer = 4.5;
      mob.wanderAngle = Math.atan2(knockX, knockZ);
    }
    if (mob.hp <= 0) {
      mob.koTimer = 0.35;
      return { killed: true, drops: MOB_CONFIG[mob.type].drops };
    }
    return { killed: false, drops: [] };
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    isNight: boolean,
    getBlock: BlockAccessor,
    getTopY: (x: number, z: number) => number,
    callbacks: {
      onPlayerHurt: (damage: number, srcX: number, srcZ: number) => void;
      onCreeperExplode: (x: number, y: number, z: number) => void;
      onCreeperFuse?: () => void;
    },
    playerHitbox: PlayerHitbox = getPlayerHitbox({ x: playerPos.x, y: playerPos.y, z: playerPos.z }),
    playerAlive = true,
  ): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.5;
      const passiveCount = this.mobs.filter((m) => !m.hostile).length;
      const hostileCount = this.mobs.filter((m) => m.hostile).length;

      if (passiveCount < 10) {
        const types = [MobType.Cow, MobType.Pig, MobType.Sheep, MobType.Chicken];
        this.trySpawnAround(types[Math.floor(Math.random() * types.length)], playerPos, 16, 34, getTopY, getBlock);
      }
      if (isNight && hostileCount < 8) {
        const types = [MobType.Zombie, MobType.Skeleton, MobType.Spider, MobType.Creeper];
        this.trySpawnAround(types[Math.floor(Math.random() * types.length)], playerPos, 15, 32, getTopY, getBlock);
      }
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const distToPlayer = Math.hypot(playerHitbox.centerX - m.x, playerHitbox.centerY - m.y, playerHitbox.centerZ - m.z);

      if (distToPlayer > 54 || (!m.hostile && m.y < 1) || (!isNight && m.hostile && distToPlayer > 28)) {
        disposeMobRig(m.rig);
        this.scene.remove(m.rig.group);
        this.mobs.splice(i, 1);
        continue;
      }

      m.animTime += dt;
      if (m.koTimer > 0) {
        m.koTimer -= dt;
        animateMobRig(m, dt);
        this.applyFlash(m, true);
        if (m.koTimer <= 0) {
          disposeMobRig(m.rig);
          this.scene.remove(m.rig.group);
          this.mobs.splice(i, 1);
        }
        continue;
      }

      if (m.hitFlashTimer > 0) m.hitFlashTimer -= dt;
      if (m.attackCooldown > 0) m.attackCooldown -= dt;
      if (m.attackAnimTimer > 0) m.attackAnimTimer -= dt;
      if (m.fleeTimer > 0) m.fleeTimer -= dt;

      const cfg = MOB_CONFIG[m.type];
      let targetVx = 0;
      let targetVz = 0;

      const targetEval = m.hostile && playerAlive && distToPlayer < 22
        ? evaluateMobTarget(m.x, m.y, m.z, m.type, playerHitbox, getBlock)
        : null;

      if (targetEval && (targetEval.hasVisualLos || m.fuseTimer > 0)) {
        const dx = playerHitbox.centerX - m.x;
        const dz = playerHitbox.centerZ - m.z;
        const len = Math.max(0.001, Math.hypot(dx, dz));
        const nx = dx / len;
        const nz = dz / len;
        m.yaw = Math.atan2(nx, nz);

        if (m.type === MobType.Skeleton) {
          if (targetEval.dist3D > 11) {
            targetVx = nx * cfg.speed;
            targetVz = nz * cfg.speed;
          } else if (targetEval.dist3D < 6.5) {
            targetVx = -nx * cfg.speed * 0.85;
            targetVz = -nz * cfg.speed * 0.85;
          }
          if (m.attackCooldown <= 0 && canMobExecuteAttack(m.x, m.y, m.z, m.type, 17, playerHitbox, playerAlive, getBlock, false)) {
            m.attackCooldown = 2.1;
            m.attackAnimTimer = 0.35;
            this.fireArrow(m.x, m.y + 1.35, m.z, playerHitbox.eyeX, playerHitbox.centerY, playerHitbox.eyeZ);
          }
        } else if (m.type === MobType.Creeper) {
          const canFuse = canMobExecuteAttack(m.x, m.y, m.z, m.type, 2.7, playerHitbox, playerAlive, getBlock, true);
          if (canFuse || m.fuseTimer > 0) {
            if (m.fuseTimer < 0) {
              m.fuseTimer = 1.25;
              callbacks.onCreeperFuse?.();
            }
            // Cancel fuse cleanly if player sealed a solid wall or moved out of blast reach
            if (!targetEval.hasAttackLos || targetEval.hitboxDist3D > 4.2) {
              m.fuseTimer = -1;
            } else {
              m.fuseTimer -= dt;
              if (m.fuseTimer <= 0) {
                callbacks.onCreeperExplode(m.x, m.y, m.z);
                if (canMobExecuteAttack(m.x, m.y, m.z, m.type, 4.5, playerHitbox, playerAlive, getBlock, true)) {
                  callbacks.onPlayerHurt(Math.round(cfg.damage * (1 - targetEval.hitboxDist3D / 5)), m.x, m.z);
                }
                disposeMobRig(m.rig);
                this.scene.remove(m.rig.group);
                this.mobs.splice(i, 1);
                continue;
              }
            }
          } else {
            targetVx = nx * cfg.speed;
            targetVz = nz * cfg.speed;
          }
        } else if (m.type === MobType.Spider) {
          targetVx = nx * cfg.speed;
          targetVz = nz * cfg.speed;
          if (targetEval.dist3D < 4.5 && targetEval.dist3D > 2.0 && m.vy === 0 && m.attackCooldown <= 0) {
            m.vy = 5.4;
          }
          if (m.attackCooldown <= 0 && canMobExecuteAttack(m.x, m.y, m.z, m.type, 1.55, playerHitbox, playerAlive, getBlock, true)) {
            m.attackCooldown = 1.1;
            m.attackAnimTimer = 0.35;
            callbacks.onPlayerHurt(cfg.damage, m.x, m.z);
          }
        } else {
          targetVx = nx * cfg.speed;
          targetVz = nz * cfg.speed;
          if (m.attackCooldown <= 0 && canMobExecuteAttack(m.x, m.y, m.z, m.type, 1.65, playerHitbox, playerAlive, getBlock, true)) {
            m.attackCooldown = 1.3;
            m.attackAnimTimer = 0.35;
            callbacks.onPlayerHurt(cfg.damage, m.x, m.z);
          }
        }
      } else {
        m.wanderTimer -= dt;
        if (m.wanderTimer <= 0) {
          m.wanderTimer = 2 + Math.random() * 3.5;
          m.wanderAngle += (Math.random() - 0.5) * 2.4;
        }
        const speedMult = m.fleeTimer > 0 ? 1.8 : m.wanderTimer > 1.2 ? 0.7 : 0;
        targetVx = Math.sin(m.wanderAngle) * cfg.speed * speedMult;
        targetVz = Math.cos(m.wanderAngle) * cfg.speed * speedMult;
        if (speedMult > 0) m.yaw = m.wanderAngle;
      }

      // Simple block step-up & collision
      m.vx = THREE.MathUtils.lerp(m.vx, targetVx, Math.min(1, dt * 8));
      m.vz = THREE.MathUtils.lerp(m.vz, targetVz, Math.min(1, dt * 8));
      m.vy -= 22 * dt;

      const nx = m.x + m.vx * dt;
      const nz = m.z + m.vz * dt;
      const footY = Math.floor(m.y + 0.1);
      const blockedX = isBlockSolid(getBlock(Math.floor(nx), footY, Math.floor(m.z)));
      if (!blockedX) {
        m.x = nx;
      } else {
        const canStep = !isBlockSolid(getBlock(Math.floor(nx), footY + 1, Math.floor(m.z)));
        if (canStep && Math.abs(m.vy) < 0.5) m.vy = 5.8;
        else m.vx = 0;
      }

      const blockedZ = isBlockSolid(getBlock(Math.floor(m.x), footY, Math.floor(nz)));
      if (!blockedZ) {
        m.z = nz;
      } else {
        const canStep = !isBlockSolid(getBlock(Math.floor(m.x), footY + 1, Math.floor(nz)));
        if (canStep && Math.abs(m.vy) < 0.5) m.vy = 5.8;
        else m.vz = 0;
      }

      const ny = m.y + m.vy * dt;
      const under = getBlock(Math.floor(m.x), Math.floor(ny), Math.floor(m.z));
      if (isBlockSolid(under) && m.vy <= 0) {
        m.y = Math.floor(ny) + 1;
        m.vy = 0;
      } else if (isBlockFluid(under)) {
        m.y = ny;
        m.vy = Math.max(m.vy, 1.4);
      } else {
        m.y = ny;
      }

      // Update Rig Transform & Gait Animation
      m.rig.group.position.set(m.x, m.y, m.z);
      m.rig.group.rotation.y = m.yaw;
      const horizSpeed = Math.hypot(m.vx, m.vz);
      m.walkPhase += horizSpeed * dt * 4.5;
      animateMobRig(m, dt);
      this.applyFlash(m, m.hitFlashTimer > 0 || (m.fuseTimer > 0 && Math.floor(m.fuseTimer * 12) % 2 === 0));
    }

    // 3. Update Skeleton Arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      a.vy -= 9.5 * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.z += a.vz * dt;
      a.mesh.position.set(a.x, a.y, a.z);
      a.mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);

      const hitPlayer =
        playerAlive &&
        a.x >= playerHitbox.minX - 0.12 &&
        a.x <= playerHitbox.maxX + 0.12 &&
        a.y >= playerHitbox.minY &&
        a.y <= playerHitbox.maxY &&
        a.z >= playerHitbox.minZ - 0.12 &&
        a.z <= playerHitbox.maxZ + 0.12;

      if (hitPlayer) {
        callbacks.onPlayerHurt(3, a.x, a.z);
        this.scene.remove(a.mesh);
        this.arrows.splice(i, 1);
      } else if (a.life <= 0 || isBlockSolid(getBlock(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z)))) {
        this.scene.remove(a.mesh);
        this.arrows.splice(i, 1);
      }
    }
  }

  private fireArrow(sx: number, sy: number, sz: number, tx: number, ty: number, tz: number): void {
    const dx = tx - sx;
    const dy = ty - sy + 0.6;
    const dz = tz - sz;
    const len = Math.max(0.1, Math.hypot(dx, dy, dz));
    const speed = 15;
    const mesh = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    mesh.position.set(sx, sy, sz);
    this.scene.add(mesh);
    this.arrows.push({
      x: sx,
      y: sy,
      z: sz,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      vz: (dz / len) * speed,
      life: 3.0,
      mesh,
    });
  }

  private trySpawnAround(
    type: MobType,
    playerPos: THREE.Vector3,
    minDist: number,
    maxDist: number,
    getTopY: (x: number, z: number) => number,
    getBlock: BlockAccessor,
  ): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const wx = Math.floor(playerPos.x + Math.cos(angle) * dist);
    const wz = Math.floor(playerPos.z + Math.sin(angle) * dist);
    const spawnY = resolveGroundSurfaceY(wx, wz, getTopY, getBlock);
    if (spawnY !== null) {
      this.spawnMob(type, wx + 0.5, spawnY, wz + 0.5);
    }
  }

  private applyFlash(m: MobEntity, flash: boolean): void {
    for (let i = 0; i < m.rig.materials.length; i++) {
      const mat = m.rig.materials[i];
      if (flash) {
        mat.emissive.copy(_white);
        mat.emissiveIntensity = 0.75;
      } else {
        mat.emissive.setHex(m.rig.baseEmissives[i]);
        mat.emissiveIntensity = m.rig.baseEmissiveIntensities[i];
        mat.color.copy(_tempCol.setHex(m.rig.baseColors[i]));
      }
    }
  }

  public dispose(): void {
    this.clearAll();
    disposeSharedMobTextures();
    this.arrowGeo.dispose();
    this.arrowMat.dispose();
  }
}
