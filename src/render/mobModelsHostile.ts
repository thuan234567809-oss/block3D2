import * as THREE from 'three';
import {
  addFramedEyes,
  addGroundContactShadow,
  makeMobPart,
  MobPartLists,
  MobRig,
} from './mobTextures';

export function buildZombieRig(group: THREE.Group, lists: MobPartLists): MobRig {
  addGroundContactShadow(group, 0.42, 0.42);

  const torso = makeMobPart(0.5, 0.72, 0.28, { texKey: 'zombie_shirt', roughness: 0.86 }, lists);
  torso.position.set(0, 1.06, 0);
  const belt = makeMobPart(0.51, 0.08, 0.29, { color: 0x26324d, roughness: 0.85 }, lists);
  belt.position.set(0, -0.32, 0);
  torso.add(belt);
  group.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.42, 0);
  const skull = makeMobPart(0.46, 0.46, 0.46, { texKey: 'zombie_skin', roughness: 0.76 }, lists);
  skull.position.set(0, 0.23, 0);
  const brow = makeMobPart(0.47, 0.07, 0.47, { color: 0x356934, roughness: 0.8 }, lists);
  brow.position.set(0, 0.34, 0.015);
  const mouth = makeMobPart(0.18, 0.05, 0.03, { color: 0x234222, roughness: 0.8 }, lists);
  mouth.position.set(0, 0.1, 0.235);
  headGroup.add(skull, brow, mouth);
  addFramedEyes(headGroup, 0.25, 0.235, 0.125, 0x162416, lists, false);
  group.add(headGroup);

  const legs: THREE.Object3D[] = [];
  for (const lx of [-0.13, 0.13]) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.7, 0);
    const leg = makeMobPart(0.22, 0.56, 0.22, { texKey: 'zombie_pants', roughness: 0.82 }, lists);
    leg.position.y = -0.28;
    const boot = makeMobPart(0.23, 0.14, 0.24, { color: 0x262b3d, roughness: 0.88 }, lists);
    boot.position.set(0, -0.63, 0.01);
    pivot.add(leg, boot);
    group.add(pivot);
    legs.push(pivot);
  }

  const arms: THREE.Object3D[] = [];
  for (const ax of [-0.36, 0.36]) {
    const pivot = new THREE.Group();
    pivot.position.set(ax, 1.36, 0);
    const sleeve = makeMobPart(0.21, 0.24, 0.21, { texKey: 'zombie_shirt', roughness: 0.86 }, lists);
    sleeve.position.y = -0.1;
    const forearm = makeMobPart(0.19, 0.44, 0.19, { texKey: 'zombie_skin', roughness: 0.78 }, lists);
    forearm.position.y = -0.44;
    pivot.add(sleeve, forearm);
    pivot.rotation.x = -1.32;
    group.add(pivot);
    arms.push(pivot);
  }

  return { group, body: torso, head: headGroup, legs, arms, ...lists };
}

function buildSkeletonBow(lists: MobPartLists): THREE.Group {
  const bow = new THREE.Group();
  const grip = makeMobPart(0.06, 0.22, 0.07, { color: 0x5d3b20, roughness: 0.72 }, lists);
  const topLimb = makeMobPart(0.055, 0.22, 0.06, { color: 0x6f4728, roughness: 0.72 }, lists);
  topLimb.position.set(0, 0.19, -0.05);
  topLimb.rotation.x = 0.42;
  const botLimb = makeMobPart(0.055, 0.22, 0.06, { color: 0x6f4728, roughness: 0.72 }, lists);
  botLimb.position.set(0, -0.19, -0.05);
  botLimb.rotation.x = -0.42;
  const stringMesh = makeMobPart(0.02, 0.56, 0.02, { color: 0xe3dcc9, roughness: 0.6 }, lists);
  stringMesh.position.set(0, 0, -0.12);
  const arrowShaft = makeMobPart(0.025, 0.025, 0.42, { color: 0xc29b6b, roughness: 0.7 }, lists);
  arrowShaft.position.set(0, 0, 0.07);
  const arrowTip = makeMobPart(0.05, 0.05, 0.06, { color: 0x8f98a2, roughness: 0.35, metalness: 0.22 }, lists);
  arrowTip.position.set(0, 0, 0.28);
  bow.add(grip, topLimb, botLimb, stringMesh, arrowShaft, arrowTip);
  return bow;
}

export function buildSkeletonRig(group: THREE.Group, lists: MobPartLists): MobRig {
  addGroundContactShadow(group, 0.38, 0.38);

  // Segmented spine + ribcage + pelvis so gaps between ribs read cleanly
  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 1.06, 0);
  const spine = makeMobPart(0.11, 0.68, 0.11, { texKey: 'skeleton_bone', roughness: 0.58 }, lists);
  const pelvis = makeMobPart(0.42, 0.11, 0.22, { texKey: 'skeleton_bone', roughness: 0.6 }, lists);
  pelvis.position.set(0, -0.3, 0);
  const clavicle = makeMobPart(0.56, 0.09, 0.16, { texKey: 'skeleton_bone', roughness: 0.56 }, lists);
  clavicle.position.set(0, 0.31, 0);
  bodyGroup.add(spine, pelvis, clavicle);

  for (const ry of [0.18, 0.04, -0.1]) {
    const rib = makeMobPart(0.46, 0.085, 0.26, { texKey: 'skeleton_bone', roughness: 0.58 }, lists);
    rib.position.set(0, ry, 0);
    bodyGroup.add(rib);
  }
  group.add(bodyGroup);

  // Skull with hollow eye sockets & nasal cavity
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.42, 0);
  const skull = makeMobPart(0.44, 0.44, 0.44, { texKey: 'skeleton_skull', roughness: 0.6 }, lists);
  skull.position.set(0, 0.23, 0);
  const brow = makeMobPart(0.46, 0.08, 0.45, { texKey: 'skeleton_bone', roughness: 0.58 }, lists);
  brow.position.set(0, 0.33, 0.015);
  const nose = makeMobPart(0.07, 0.07, 0.04, { color: 0x1e1e1c, roughness: 0.9 }, lists);
  nose.position.set(0, 0.18, 0.215);
  headGroup.add(skull, brow, nose);
  addFramedEyes(headGroup, 0.25, 0.218, 0.115, 0x151513, lists, false);
  group.add(headGroup);

  const legs: THREE.Object3D[] = [];
  for (const lx of [-0.14, 0.14]) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.7, 0);
    const femur = makeMobPart(0.11, 0.68, 0.11, { texKey: 'skeleton_bone', roughness: 0.62 }, lists);
    femur.position.y = -0.34;
    const foot = makeMobPart(0.12, 0.06, 0.16, { texKey: 'skeleton_bone', roughness: 0.65 }, lists);
    foot.position.set(0, -0.67, 0.025);
    pivot.add(femur, foot);
    group.add(pivot);
    legs.push(pivot);
  }

  const arms: THREE.Object3D[] = [];
  let bow: THREE.Object3D | undefined;
  for (let i = 0; i < 2; i++) {
    const ax = i === 0 ? -0.34 : 0.34;
    const pivot = new THREE.Group();
    pivot.position.set(ax, 1.36, 0);
    const arm = makeMobPart(0.11, 0.64, 0.11, { texKey: 'skeleton_bone', roughness: 0.6 }, lists);
    arm.position.y = -0.3;
    pivot.add(arm);
    if (i === 1) {
      bow = buildSkeletonBow(lists);
      bow.position.set(-0.04, -0.58, 0.12);
      bow.rotation.x = Math.PI / 2;
      pivot.add(bow);
      pivot.rotation.x = -1.42;
    } else {
      pivot.rotation.x = -1.15;
    }
    group.add(pivot);
    arms.push(pivot);
  }

  return { group, body: bodyGroup, head: headGroup, legs, arms, bow, ...lists };
}

export function buildSpiderRig(group: THREE.Group, lists: MobPartLists): MobRig {
  addGroundContactShadow(group, 0.75, 0.8);

  // Rear bulbous segmented abdomen + Front cephalothorax
  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 0.38, 0);
  const thorax = makeMobPart(0.46, 0.26, 0.42, { texKey: 'spider_chitin', roughness: 0.68 }, lists);
  thorax.position.set(0, 0, 0.04);
  const abdomen = makeMobPart(0.68, 0.4, 0.74, { texKey: 'spider_abdomen', roughness: 0.72 }, lists);
  abdomen.position.set(0, 0.08, -0.48);
  abdomen.rotation.x = 0.14;
  const dorsalPlate = makeMobPart(0.44, 0.07, 0.52, { texKey: 'spider_chitin', roughness: 0.58 }, lists);
  dorsalPlate.position.set(0, 0.21, 0);
  abdomen.add(dorsalPlate);
  bodyGroup.add(thorax, abdomen);
  group.add(bodyGroup);

  // Head + 8 glowing eyes + 2 articulated pincer mandibles
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.39, 0.32);
  const headBox = makeMobPart(0.44, 0.3, 0.34, { texKey: 'spider_chitin', roughness: 0.62 }, lists);
  headBox.position.set(0, 0, 0.1);
  headGroup.add(headBox);

  // 8 glowing crimson spider eyes (2 big central, 2 outer medium, 4 upper small)
  const eyeSpecs: [number, number, number][] = [
    [-0.075, 0.02, 0.07],
    [0.075, 0.02, 0.07],
    [-0.155, 0.04, 0.055],
    [0.155, 0.04, 0.055],
    [-0.11, 0.09, 0.04],
    [0.11, 0.09, 0.04],
    [-0.045, 0.095, 0.038],
    [0.045, 0.095, 0.038],
  ];
  for (const [ex, ey, sz] of eyeSpecs) {
    const eye = makeMobPart(
      sz,
      sz,
      0.03,
      { color: 0xff2b2b, emissive: 0xb81414, emissiveIntensity: 0.65, roughness: 0.2 },
      lists,
    );
    eye.position.set(ex, ey, 0.275);
    headGroup.add(eye);
  }

  const mandibles: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const mPivot = new THREE.Group();
    mPivot.position.set(side * 0.11, -0.09, 0.25);
    const fang = makeMobPart(0.065, 0.11, 0.08, { color: 0x161216, roughness: 0.45 }, lists);
    fang.position.set(0, -0.03, 0.04);
    fang.rotation.z = side * 0.28;
    const tip = makeMobPart(0.04, 0.05, 0.04, { color: 0x8f2424, roughness: 0.35 }, lists);
    tip.position.set(-side * 0.015, -0.06, 0.06);
    fang.add(tip);
    mPivot.add(fang);
    headGroup.add(mPivot);
    mandibles.push(mPivot);
  }
  group.add(headGroup);

  // 8 Distinct 2-segment articulated radial legs (4 left, 4 right)
  const legs: THREE.Object3D[] = [];
  const legLowerPivots: THREE.Object3D[] = [];
  const legBaseYaws: number[] = [];
  const yawSpread = [0.58, 0.2, -0.18, -0.56];
  const zAnchors = [0.16, 0.08, 0.0, -0.08];

  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.22, 0.38, zAnchors[i]);
      const baseYaw = side * -yawSpread[i];
      hip.rotation.y = baseYaw;
      legBaseYaws.push(baseYaw);

      const femur = makeMobPart(0.36, 0.08, 0.08, { texKey: 'spider_chitin', roughness: 0.72 }, lists);
      femur.position.set(side * 0.18, 0.07, 0);
      femur.rotation.z = side * 0.4;
      hip.add(femur);

      const knee = new THREE.Group();
      knee.position.set(side * 0.34, 0.14, 0);
      const tibia = makeMobPart(0.48, 0.065, 0.065, { texKey: 'spider_chitin', roughness: 0.76 }, lists);
      tibia.position.set(side * 0.15, -0.24, 0);
      tibia.rotation.z = side * -1.0;
      knee.add(tibia);
      hip.add(knee);

      group.add(hip);
      legs.push(hip);
      legLowerPivots.push(knee);
    }
  }

  return {
    group,
    body: bodyGroup,
    head: headGroup,
    legs,
    arms: [],
    mandibles,
    legLowerPivots,
    legBaseYaws,
    ...lists,
  };
}

export function buildCreeperRig(group: THREE.Group, lists: MobPartLists): MobRig {
  addGroundContactShadow(group, 0.4, 0.4);

  const torso = makeMobPart(0.48, 0.86, 0.32, { texKey: 'creeper_camo', roughness: 0.82 }, lists);
  torso.position.set(0, 0.82, 0);
  group.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.25, 0);
  const skull = makeMobPart(0.52, 0.52, 0.52, { texKey: 'creeper_camo', roughness: 0.8 }, lists);
  skull.position.set(0, 0.26, 0);
  headGroup.add(skull);

  // Iconic Creeper pixel-inset frown face
  addFramedEyes(headGroup, 0.31, 0.265, 0.125, 0x101410, lists, false);
  const noseBridge = makeMobPart(0.11, 0.1, 0.03, { color: 0x101410, roughness: 0.85 }, lists);
  noseBridge.position.set(0, 0.2, 0.265);
  const frownTop = makeMobPart(0.24, 0.09, 0.03, { color: 0x101410, roughness: 0.85 }, lists);
  frownTop.position.set(0, 0.13, 0.265);
  for (const fx of [-0.085, 0.085]) {
    const corner = makeMobPart(0.07, 0.09, 0.03, { color: 0x101410, roughness: 0.85 }, lists);
    corner.position.set(fx, 0.07, 0.265);
    headGroup.add(corner);
  }
  headGroup.add(noseBridge, frownTop);
  group.add(headGroup);

  const legs: THREE.Object3D[] = [];
  for (const [lx, lz] of [
    [-0.16, 0.16],
    [0.16, 0.16],
    [-0.16, -0.16],
    [0.16, -0.16],
  ] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.4, lz);
    const leg = makeMobPart(0.2, 0.36, 0.2, { texKey: 'creeper_camo', roughness: 0.85 }, lists);
    leg.position.y = -0.18;
    const foot = makeMobPart(0.21, 0.06, 0.22, { color: 0x205d1e, roughness: 0.88 }, lists);
    foot.position.set(0, -0.37, lz > 0 ? 0.015 : -0.015);
    pivot.add(leg, foot);
    group.add(pivot);
    legs.push(pivot);
  }

  return { group, body: torso, head: headGroup, legs, arms: [], ...lists };
}
