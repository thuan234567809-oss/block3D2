import * as THREE from 'three';
import { MobType } from '../types/game';
import { MobRig } from './mobTextures';

export interface MobAnimInput {
  type: MobType;
  rig: MobRig;
  vx: number;
  vy: number;
  vz: number;
  walkPhase: number;
  animTime: number;
  wanderTimer: number;
  fleeTimer: number;
  hitFlashTimer: number;
  koTimer: number;
  fuseTimer: number;
  attackAnimTimer: number;
}

export function animateMobRig(m: MobAnimInput, dt: number): void {
  const { rig } = m;
  const blend = Math.min(1, dt * 14);

  if (m.koTimer > 0) {
    rig.group.rotation.z = THREE.MathUtils.lerp(rig.group.rotation.z, Math.PI * 0.48, 0.25);
    return;
  }

  const horizSpeed = Math.hypot(m.vx, m.vz);
  const isMoving = horizSpeed > 0.28;
  const swingAmp = isMoving ? Math.min(0.68, horizSpeed * 0.25) : 0;
  const swing = Math.sin(m.walkPhase) * swingAmp;
  const attackWave = m.attackAnimTimer > 0 ? Math.sin((m.attackAnimTimer / 0.35) * Math.PI) : 0;
  const hurtTilt = m.hitFlashTimer > 0 ? -0.24 * Math.sin((m.hitFlashTimer / 0.14) * Math.PI) : 0;

  // Gentle breathing & damage flinch on body
  const breath = Math.sin(m.animTime * 2.3) * 0.024;
  rig.body.scale.y = THREE.MathUtils.lerp(rig.body.scale.y, 1 + breath, blend);
  rig.body.rotation.x = THREE.MathUtils.lerp(rig.body.rotation.x, hurtTilt, blend);

  // Turning Head / idle curiosity (split smoothly across neck + head when neck exists)
  const idleLookYaw = isMoving ? Math.sin(m.walkPhase * 0.5) * 0.05 : Math.sin(m.animTime * 0.95) * 0.22;
  if (rig.neck) {
    rig.neck.rotation.y = THREE.MathUtils.lerp(rig.neck.rotation.y, idleLookYaw * 0.45, blend);
    rig.head.rotation.y = THREE.MathUtils.lerp(rig.head.rotation.y, idleLookYaw * 0.55, blend);
  } else {
    rig.head.rotation.y = THREE.MathUtils.lerp(rig.head.rotation.y, idleLookYaw, blend);
  }

  if (m.type === MobType.Cow || m.type === MobType.Pig || m.type === MobType.Sheep) {
    const isRunning = m.fleeTimer > 0 || horizSpeed > 2.3;
    const legGain = isRunning ? 1.18 : 1.0;
    if (rig.legs.length >= 4) {
      rig.legs[0].rotation.x = swing * legGain;
      rig.legs[1].rotation.x = -swing * legGain;
      rig.legs[2].rotation.x = -swing * legGain;
      rig.legs[3].rotation.x = swing * legGain;
    }
    rig.body.rotation.z = THREE.MathUtils.lerp(
      rig.body.rotation.z,
      isMoving ? Math.sin(m.walkPhase) * (isRunning ? 0.065 : 0.038) : 0,
      blend,
    );
    const grazing = !isMoving && m.fleeTimer <= 0 && m.wanderTimer < 1.2 && m.type !== MobType.Pig;
    const neckPitch = grazing ? 0.42 : isRunning ? 0.14 : hurtTilt * 0.35;
    const headPitch = grazing ? 0.32 + Math.sin(m.animTime * 7.5) * 0.08 : isRunning ? -0.06 : hurtTilt * 0.45;
    if (rig.neck) {
      rig.neck.rotation.x = THREE.MathUtils.lerp(rig.neck.rotation.x, neckPitch, blend);
      rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, headPitch, blend);
    } else {
      rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, neckPitch + headPitch, blend);
    }

    if (rig.specialParts) {
      const earWave = Math.sin(m.animTime * (isRunning ? 10 : 2.6)) * 0.08;
      for (let i = 0; i < rig.specialParts.length; i++) {
        rig.specialParts[i].rotation.x = earWave * (i % 2 === 0 ? 1 : -1);
      }
    }
    if (rig.tail) {
      rig.tail.rotation.z = Math.sin(m.animTime * (isMoving ? 9.0 : 3.2)) * (isRunning ? 0.35 : 0.22);
    }
    return;
  }

  if (m.type === MobType.Chicken) {
    const isRunning = m.fleeTimer > 0 || horizSpeed > 2.0;
    if (rig.legs.length >= 2) {
      rig.legs[0].rotation.x = swing * (isRunning ? 1.3 : 1.1);
      rig.legs[1].rotation.x = -swing * (isRunning ? 1.3 : 1.1);
    }
    const pecking = !isMoving && !isRunning && m.wanderTimer < 1.0;
    const neckPitch = pecking ? 0.38 : isMoving ? Math.sin(m.walkPhase * 2) * 0.12 : 0;
    const headPitch = pecking ? 0.28 + Math.sin(m.animTime * 11) * 0.12 : Math.sin(m.animTime * 3) * 0.05;
    if (rig.neck) {
      rig.neck.rotation.x = THREE.MathUtils.lerp(rig.neck.rotation.x, neckPitch, blend);
      rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, headPitch, blend);
    } else {
      rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, neckPitch + headPitch, blend);
    }

    const shouldFlap = Math.abs(m.vy) > 0.6 || isRunning;
    const flapAngle = shouldFlap
      ? 0.28 + Math.abs(Math.sin(m.animTime * 24)) * 0.88
      : 0.06 + Math.max(0, Math.sin(m.animTime * 2.2)) * 0.05;
    if (rig.arms.length >= 2) {
      rig.arms[0].rotation.z = THREE.MathUtils.lerp(rig.arms[0].rotation.z, -flapAngle, blend);
      rig.arms[1].rotation.z = THREE.MathUtils.lerp(rig.arms[1].rotation.z, flapAngle, blend);
    }
    if (rig.tail) {
      rig.tail.rotation.x = Math.sin(m.animTime * (isRunning ? 9 : 5)) * 0.1;
    }
    return;
  }

  if (m.type === MobType.Spider) {
    // Alternating tetrapod gait across 8 2-segment legs without overlapping neighbors
    const baseYaws = rig.legBaseYaws;
    const lowerPivots = rig.legLowerPivots;
    const sweepAmp = isMoving ? Math.min(0.16, horizSpeed * 0.045) : 0.015;
    const liftAmp = isMoving ? Math.min(0.24, horizSpeed * 0.065) : 0;

    for (let idx = 0; idx < rig.legs.length; idx++) {
      const pair = Math.floor(idx / 2);
      const side = idx % 2 === 0 ? -1 : 1;
      const diagPhase = (pair + (side === 1 ? 1 : 0)) % 2 === 0 ? m.walkPhase : m.walkPhase + Math.PI;
      const hip = rig.legs[idx];
      const baseYaw = baseYaws ? baseYaws[idx] : hip.rotation.y;
      hip.rotation.y = baseYaw + Math.cos(diagPhase) * sweepAmp;
      const lift = Math.max(0, Math.sin(diagPhase)) * liftAmp;
      hip.rotation.z = side * lift;
      if (lowerPivots && lowerPivots[idx]) {
        lowerPivots[idx].rotation.z = -side * lift * 0.55;
      }
    }

    rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, -attackWave * 0.25 + hurtTilt * 0.4, blend);
    if (rig.mandibles && rig.mandibles.length >= 2) {
      const snap = 0.06 + attackWave * 0.32 + Math.sin(m.animTime * 4) * 0.04;
      rig.mandibles[0].rotation.y = -snap;
      rig.mandibles[1].rotation.y = snap;
    }
    return;
  }

  if (m.type === MobType.Creeper) {
    if (rig.legs.length >= 4) {
      rig.legs[0].rotation.x = swing;
      rig.legs[1].rotation.x = -swing;
      rig.legs[2].rotation.x = -swing;
      rig.legs[3].rotation.x = swing;
    }
    if (m.fuseTimer > 0) {
      const charge = Math.max(0, 1 - m.fuseTimer / 1.25);
      const pulse = 1 + charge * 0.14 + Math.sin(m.fuseTimer * 26) * 0.12;
      rig.group.scale.set(pulse, 1 / pulse, pulse);
      rig.group.rotation.z = Math.sin(m.fuseTimer * 48) * 0.06;
    } else {
      rig.group.scale.set(1, 1, 1);
      rig.group.rotation.z = THREE.MathUtils.lerp(rig.group.rotation.z, 0, blend);
    }
    rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, hurtTilt * 0.5, blend);
    return;
  }

  // Bipedal Zombie & Skeleton
  if (rig.legs.length >= 2) {
    rig.legs[0].rotation.x = swing;
    rig.legs[1].rotation.x = -swing;
  }
  rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, hurtTilt * 0.5, blend);

  if (m.type === MobType.Zombie && rig.arms.length >= 2) {
    const shamble = Math.sin(m.walkPhase) * 0.14 + Math.sin(m.animTime * 2.5) * 0.05;
    rig.arms[0].rotation.x = -1.32 + shamble + attackWave * 0.65;
    rig.arms[1].rotation.x = -1.32 - shamble + attackWave * 0.65;
  } else if (m.type === MobType.Skeleton && rig.arms.length >= 2) {
    const strideSway = swing * 0.15;
    // Left arm stabilizes bowstring, right arm draws & recoils when shooting
    rig.arms[0].rotation.x = -1.15 - attackWave * 0.25 + strideSway;
    rig.arms[1].rotation.x = -1.42 + attackWave * 0.34 - strideSway;
  }
}
