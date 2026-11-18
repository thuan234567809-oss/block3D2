import * as THREE from 'three';
import {
  addFramedEyes,
  addGroundContactShadow,
  makeMobPart,
  MobPartLists,
  MobRig,
} from './mobTextures';

const SHEEP_WOOL_VARIANTS = [0xf6f4ec, 0xf6f4ec, 0xf6f4ec, 0xd4d8de, 0x5c6168, 0x8d694b];

export function buildCowRig(group: THREE.Group, lists: MobPartLists): MobRig {
  addGroundContactShadow(group, 0.48, 0.72);
  const legH = 0.5;
  const bodyCenterY = legH + 0.27;

  // Sculpted multi-part bovine torso (chest, tapered loin, shoulder hump, brisket, udder)
  const torso = new THREE.Group();
  torso.position.set(0, bodyCenterY, 0);
  const chest = makeMobPart(0.66, 0.54, 0.54, { texKey: 'cow_hide', roughness: 0.78 }, lists);
  chest.position.set(0, 0, 0.24);
  const loin = makeMobPart(0.58, 0.5, 0.54, { texKey: 'cow_hide', roughness: 0.78 }, lists);
  loin.position.set(0, 0.01, -0.24);
  const shoulder = makeMobPart(0.52, 0.1, 0.36, { texKey: 'cow_hide', roughness: 0.8 }, lists);
  shoulder.position.set(0, 0.29, 0.26);
  const brisket = makeMobPart(0.4, 0.12, 0.28, { texKey: 'cow_hide', roughness: 0.82 }, lists);
  brisket.position.set(0, -0.26, 0.33);
  const udder = makeMobPart(0.28, 0.08, 0.24, { color: 0xeba9b5, roughness: 0.65 }, lists);
  udder.position.set(0, -0.26, -0.26);
  for (const [tx, tz] of [[-0.07, -0.05], [0.07, -0.05], [-0.07, 0.05], [0.07, 0.05]] as const) {
    const teat = makeMobPart(0.035, 0.05, 0.035, { color: 0xdf92a0, roughness: 0.62 }, lists);
    teat.position.set(tx, -0.055, tz);
    udder.add(teat);
  }
  torso.add(chest, loin, shoulder, brisket, udder);
  group.add(torso);

  // Articulated Neck -> Head hierarchy
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, legH + 0.4, 0.46);
  const neckMesh = makeMobPart(0.34, 0.34, 0.28, { texKey: 'cow_hide', roughness: 0.78 }, lists);
  neckMesh.position.set(0, 0.04, 0.11);
  neckMesh.rotation.x = -0.22;
  neckPivot.add(neckMesh);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.1, 0.22);
  const skull = makeMobPart(0.38, 0.36, 0.34, { texKey: 'cow_face', roughness: 0.72 }, lists);
  skull.position.set(0, 0, 0.14);
  const brow = makeMobPart(0.32, 0.08, 0.22, { texKey: 'cow_face', roughness: 0.74 }, lists);
  brow.position.set(0, 0.19, 0.12);
  const muzzle = makeMobPart(0.3, 0.17, 0.16, { color: 0xd9bfb0, roughness: 0.6 }, lists);
  muzzle.position.set(0, -0.08, 0.35);
  const jaw = makeMobPart(0.24, 0.055, 0.12, { color: 0xc2a596, roughness: 0.64 }, lists);
  jaw.position.set(0, -0.175, 0.32);
  headGroup.add(skull, brow, muzzle, jaw);

  for (const nx of [-0.075, 0.075]) {
    const nostril = makeMobPart(0.048, 0.048, 0.03, { color: 0x3b2a24, roughness: 0.5 }, lists);
    nostril.position.set(nx, -0.06, 0.43);
    headGroup.add(nostril);
  }
  addFramedEyes(headGroup, 0.05, 0.315, 0.125, 0x1a1512, lists, true);

  const specialParts: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const ear = makeMobPart(0.15, 0.075, 0.06, { color: 0x4b3222, roughness: 0.78 }, lists);
    ear.position.set(side * 0.25, 0.08, 0.11);
    ear.rotation.z = side * -0.26;
    headGroup.add(ear);
    specialParts.push(ear);

    const hornBase = makeMobPart(0.075, 0.12, 0.075, { color: 0xe3dccb, roughness: 0.45 }, lists);
    hornBase.position.set(side * 0.2, 0.21, 0.11);
    hornBase.rotation.z = side * -0.38;
    const hornTip = makeMobPart(0.055, 0.1, 0.055, { color: 0xa69b86, roughness: 0.4 }, lists);
    hornTip.position.set(0, 0.085, 0.025);
    hornTip.rotation.x = 0.38;
    hornBase.add(hornTip);
    headGroup.add(hornBase);
  }
  neckPivot.add(headGroup);
  group.add(neckPivot);

  // Articulated 2-segment Tail
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, legH + 0.44, -0.51);
  const tailStem = makeMobPart(0.065, 0.3, 0.065, { color: 0x4a3121, roughness: 0.82 }, lists);
  tailStem.position.set(0, -0.14, -0.04);
  tailStem.rotation.x = -0.22;
  const tailTuft = makeMobPart(0.095, 0.11, 0.095, { color: 0x2c1d13, roughness: 0.9 }, lists);
  tailTuft.position.set(0, -0.17, 0);
  tailStem.add(tailTuft);
  tailPivot.add(tailStem);
  group.add(tailPivot);

  // 4 Articulated Legs (upper leg, slender shin, cloven hoof)
  const legs: THREE.Object3D[] = [];
  for (const [lx, lz] of [[-0.21, 0.41], [0.21, 0.41], [-0.21, -0.4], [0.21, -0.4]] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, legH, lz);
    const thigh = makeMobPart(0.16, 0.22, 0.16, { texKey: 'cow_hide', roughness: 0.82 }, lists);
    thigh.position.y = -0.11;
    const shin = makeMobPart(0.135, 0.2, 0.135, { texKey: 'cow_hide', roughness: 0.82 }, lists);
    shin.position.y = -0.32;
    const hoof = makeMobPart(0.155, 0.085, 0.165, { color: 0x261c15, roughness: 0.65 }, lists);
    hoof.position.y = -legH + 0.042;
    pivot.add(thigh, shin, hoof);
    group.add(pivot);
    legs.push(pivot);
  }

  return { group, body: torso, neck: neckPivot, head: headGroup, legs, arms: [], tail: tailPivot, specialParts, ...lists };
}

export function buildPigRig(group: THREE.Group, lists: MobPartLists): MobRig {
  addGroundContactShadow(group, 0.4, 0.58);
  const legH = 0.34;

  // Sculpted porcine barrel torso (chest, fuller ribcage, tapered rump, dorsal ridge)
  const torso = new THREE.Group();
  torso.position.set(0, legH + 0.22, 0);
  const chest = makeMobPart(0.5, 0.42, 0.38, { texKey: 'pig_skin', roughness: 0.72 }, lists);
  chest.position.set(0, 0, 0.2);
  const ribcage = makeMobPart(0.54, 0.44, 0.38, { texKey: 'pig_skin', roughness: 0.72 }, lists);
  ribcage.position.set(0, -0.01, -0.05);
  const rump = makeMobPart(0.46, 0.38, 0.24, { texKey: 'pig_skin', roughness: 0.74 }, lists);
  rump.position.set(0, 0.01, -0.3);
  const ridge = makeMobPart(0.36, 0.06, 0.58, { texKey: 'pig_skin', roughness: 0.7 }, lists);
  ridge.position.set(0, 0.22, -0.04);
  torso.add(chest, ribcage, rump, ridge);
  group.add(torso);

  // Short Neck collar -> Head + deep Snout + drooping Ears
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, legH + 0.28, 0.36);
  const neckMesh = makeMobPart(0.34, 0.3, 0.18, { texKey: 'pig_skin', roughness: 0.72 }, lists);
  neckMesh.position.set(0, 0.02, 0.07);
  neckPivot.add(neckMesh);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.04, 0.14);
  const skull = makeMobPart(0.36, 0.34, 0.34, { texKey: 'pig_skin', roughness: 0.7 }, lists);
  skull.position.set(0, 0, 0.14);
  const snout = makeMobPart(0.22, 0.14, 0.15, { color: 0xffb3c0, roughness: 0.55 }, lists);
  snout.position.set(0, -0.06, 0.34);
  const chin = makeMobPart(0.16, 0.05, 0.1, { color: 0xe68c9a, roughness: 0.65 }, lists);
  chin.position.set(0, -0.14, 0.3);
  headGroup.add(skull, snout, chin);

  for (const nx of [-0.05, 0.05]) {
    const nostril = makeMobPart(0.042, 0.052, 0.025, { color: 0x873b49, roughness: 0.6 }, lists);
    nostril.position.set(nx, -0.055, 0.415);
    headGroup.add(nostril);
  }
  addFramedEyes(headGroup, 0.05, 0.315, 0.115, 0x161616, lists, true);

  const specialParts: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const ear = makeMobPart(0.12, 0.11, 0.05, { color: 0xe68c9a, roughness: 0.74 }, lists);
    ear.position.set(side * 0.19, 0.11, 0.14);
    ear.rotation.z = side * -0.45;
    ear.rotation.x = 0.25;
    headGroup.add(ear);
    specialParts.push(ear);
  }
  neckPivot.add(headGroup);
  group.add(neckPivot);

  // Curled 3-segment Pig Tail
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, legH + 0.28, -0.42);
  const tailBase = makeMobPart(0.065, 0.065, 0.09, { color: 0xffa6b6, roughness: 0.65 }, lists);
  tailBase.position.set(0, 0.02, -0.045);
  const tailCurl = makeMobPart(0.06, 0.095, 0.055, { color: 0xe88d9c, roughness: 0.65 }, lists);
  tailCurl.position.set(0.03, 0.065, -0.075);
  tailCurl.rotation.z = -0.48;
  const tailTip = makeMobPart(0.05, 0.05, 0.06, { color: 0xffb3c0, roughness: 0.65 }, lists);
  tailTip.position.set(-0.01, 0.095, -0.05);
  tailPivot.add(tailBase, tailCurl, tailTip);
  group.add(tailPivot);

  // 4 Balanced Legs
  const legs: THREE.Object3D[] = [];
  for (const [lx, lz] of [[-0.17, 0.31], [0.17, 0.31], [-0.17, -0.31], [0.17, -0.31]] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, legH, lz);
    const upper = makeMobPart(0.15, 0.15, 0.15, { texKey: 'pig_skin', roughness: 0.76 }, lists);
    upper.position.y = -0.075;
    const lower = makeMobPart(0.13, 0.13, 0.13, { texKey: 'pig_skin', roughness: 0.76 }, lists);
    lower.position.y = -0.21;
    const hoof = makeMobPart(0.14, 0.065, 0.15, { color: 0xa15964, roughness: 0.65 }, lists);
    hoof.position.y = -legH + 0.032;
    pivot.add(upper, lower, hoof);
    group.add(pivot);
    legs.push(pivot);
  }

  return { group, body: torso, neck: neckPivot, head: headGroup, legs, arms: [], tail: tailPivot, specialParts, ...lists };
}

export function buildSheepRig(group: THREE.Group, lists: MobPartLists): MobRig {
  addGroundContactShadow(group, 0.44, 0.62);
  const legH = 0.44;
  const woolColor = SHEEP_WOOL_VARIANTS[Math.floor(Math.random() * SHEEP_WOOL_VARIANTS.length)];

  // Inner slender body + contoured multi-layer voxel fleece (distinctly NOT a single box)
  const torso = new THREE.Group();
  torso.position.set(0, legH + 0.25, 0);
  const innerBody = makeMobPart(0.46, 0.36, 0.74, { color: 0xdcc4b0, roughness: 0.8 }, lists);
  const mainFleece = makeMobPart(0.6, 0.46, 0.72, { texKey: 'sheep_wool', color: woolColor, roughness: 0.98 }, lists);
  const backSaddle = makeMobPart(0.48, 0.1, 0.62, { texKey: 'sheep_wool', color: woolColor, roughness: 0.98 }, lists);
  backSaddle.position.set(0, 0.25, -0.02);
  const chestRuff = makeMobPart(0.5, 0.38, 0.18, { texKey: 'sheep_wool', color: woolColor, roughness: 0.98 }, lists);
  chestRuff.position.set(0, 0.01, 0.35);
  const rumpFleece = makeMobPart(0.48, 0.36, 0.16, { texKey: 'sheep_wool', color: woolColor, roughness: 0.98 }, lists);
  rumpFleece.position.set(0, 0.01, -0.35);
  torso.add(innerBody, mainFleece, backSaddle, chestRuff, rumpFleece);
  for (const sx of [-1, 1]) {
    const flank = makeMobPart(0.07, 0.34, 0.52, { texKey: 'sheep_wool', color: woolColor, roughness: 0.98 }, lists);
    flank.position.set(sx * 0.31, -0.01, 0);
    torso.add(flank);
  }
  group.add(torso);

  // Distinct forward Neck extending head clearly outside the wool body
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, legH + 0.36, 0.38);
  const woolCollar = makeMobPart(0.32, 0.28, 0.18, { texKey: 'sheep_wool', color: woolColor, roughness: 0.98 }, lists);
  woolCollar.position.set(0, 0.02, 0.06);
  const throat = makeMobPart(0.25, 0.24, 0.16, { color: 0xdcc4b0, roughness: 0.76 }, lists);
  throat.position.set(0, 0.04, 0.14);
  neckPivot.add(woolCollar, throat);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.07, 0.18);
  const skull = makeMobPart(0.32, 0.31, 0.34, { texKey: 'sheep_face', roughness: 0.72 }, lists);
  skull.position.set(0, 0, 0.14);
  const headWool = makeMobPart(0.35, 0.12, 0.24, { texKey: 'sheep_wool', color: woolColor, roughness: 0.98 }, lists);
  headWool.position.set(0, 0.16, 0.09);
  const snout = makeMobPart(0.21, 0.14, 0.11, { color: 0xd1b6a0, roughness: 0.7 }, lists);
  snout.position.set(0, -0.07, 0.32);
  const nose = makeMobPart(0.1, 0.06, 0.03, { color: 0xb88b82, roughness: 0.6 }, lists);
  nose.position.set(0, -0.05, 0.38);
  headGroup.add(skull, headWool, snout, nose);

  addFramedEyes(headGroup, 0.04, 0.315, 0.105, 0x191919, lists, true);

  const specialParts: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const ear = makeMobPart(0.14, 0.075, 0.055, { color: 0xd1b6a0, roughness: 0.78 }, lists);
    ear.position.set(side * 0.2, 0.04, 0.11);
    ear.rotation.z = side * -0.32;
    headGroup.add(ear);
    specialParts.push(ear);
  }
  neckPivot.add(headGroup);
  group.add(neckPivot);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, legH + 0.3, -0.44);
  const woolTail = makeMobPart(0.15, 0.15, 0.14, { texKey: 'sheep_wool', color: woolColor, roughness: 0.98 }, lists);
  woolTail.position.set(0, -0.04, -0.05);
  tailPivot.add(woolTail);
  group.add(tailPivot);

  // 4 Visible Slender Legs with wool upper cuffs
  const legs: THREE.Object3D[] = [];
  for (const [lx, lz] of [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.3], [0.18, -0.3]] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, legH, lz);
    const cuff = makeMobPart(0.17, 0.13, 0.17, { texKey: 'sheep_wool', color: woolColor, roughness: 0.96 }, lists);
    cuff.position.y = -0.065;
    const shank = makeMobPart(0.11, legH - 0.18, 0.11, { color: 0xc9af9b, roughness: 0.78 }, lists);
    shank.position.y = -0.13 - (legH - 0.18) / 2;
    const hoof = makeMobPart(0.125, 0.06, 0.13, { color: 0x3b312a, roughness: 0.68 }, lists);
    hoof.position.y = -legH + 0.03;
    pivot.add(cuff, shank, hoof);
    group.add(pivot);
    legs.push(pivot);
  }

  return { group, body: torso, neck: neckPivot, head: headGroup, legs, arms: [], tail: tailPivot, specialParts, ...lists };
}

export function buildChickenRig(group: THREE.Group, lists: MobPartLists): MobRig {
  addGroundContactShadow(group, 0.25, 0.3);

  // Compact ovoid avian torso (breast keel + back saddle + belly)
  const torso = new THREE.Group();
  torso.position.set(0, 0.36, 0);
  const breast = makeMobPart(0.28, 0.25, 0.24, { texKey: 'chicken_feather', roughness: 0.85 }, lists);
  breast.position.set(0, 0.01, 0.07);
  const backSaddle = makeMobPart(0.24, 0.21, 0.24, { texKey: 'chicken_feather', roughness: 0.86 }, lists);
  backSaddle.position.set(0, 0.02, -0.1);
  const keel = makeMobPart(0.19, 0.07, 0.3, { texKey: 'chicken_feather', roughness: 0.88 }, lists);
  keel.position.set(0, -0.11, -0.01);
  torso.add(breast, backSaddle, keel);
  group.add(torso);

  // Fanned 3-plume Tail Feathers
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.43, -0.2);
  for (const [tx, rotY] of [[0, 0], [-0.055, 0.24], [0.055, -0.24]] as const) {
    const plume = makeMobPart(0.08, 0.15, 0.12, { texKey: 'chicken_feather', roughness: 0.88 }, lists);
    plume.position.set(tx, 0.05, -0.06);
    plume.rotation.set(0.52, rotY, 0);
    tailPivot.add(plume);
  }
  group.add(tailPivot);

  // Upright Neck -> compact Head + 2-part Beak + stepped Comb + Wattle
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.45, 0.13);
  const neckCol = makeMobPart(0.15, 0.17, 0.14, { texKey: 'chicken_feather', roughness: 0.84 }, lists);
  neckCol.position.set(0, 0.06, 0.03);
  neckPivot.add(neckCol);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.13, 0.05);
  const skull = makeMobPart(0.18, 0.18, 0.19, { texKey: 'chicken_feather', roughness: 0.82 }, lists);
  skull.position.set(0, 0.06, 0.02);
  const combMain = makeMobPart(0.045, 0.08, 0.13, { color: 0xd92626, roughness: 0.55 }, lists);
  combMain.position.set(0, 0.18, 0.02);
  const combTip = makeMobPart(0.045, 0.035, 0.08, { color: 0xe63535, roughness: 0.55 }, lists);
  combTip.position.set(0, 0.225, 0.01);
  const upperBeak = makeMobPart(0.1, 0.04, 0.13, { color: 0xf2a729, roughness: 0.42 }, lists);
  upperBeak.position.set(0, 0.045, 0.155);
  const lowerBeak = makeMobPart(0.08, 0.03, 0.1, { color: 0xd9871c, roughness: 0.45 }, lists);
  lowerBeak.position.set(0, 0.015, 0.135);
  const wattle = makeMobPart(0.06, 0.085, 0.055, { color: 0xd92626, roughness: 0.58 }, lists);
  wattle.position.set(0, -0.025, 0.11);
  headGroup.add(skull, combMain, combTip, upperBeak, lowerBeak, wattle);

  addFramedEyes(headGroup, 0.08, 0.12, 0.065, 0x111111, lists, false);
  neckPivot.add(headGroup);
  group.add(neckPivot);

  // 2 Articulated Flapping Wings with primary feather layer
  const arms: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const wingPivot = new THREE.Group();
    wingPivot.position.set(side * 0.155, 0.46, 0);
    const shoulderWing = makeMobPart(0.055, 0.15, 0.25, { texKey: 'chicken_feather', roughness: 0.88 }, lists);
    shoulderWing.position.set(side * 0.015, -0.075, -0.02);
    const tipFeather = makeMobPart(0.04, 0.1, 0.14, { color: 0xebe8df, roughness: 0.9 }, lists);
    tipFeather.position.set(side * 0.01, -0.1, -0.14);
    wingPivot.add(shoulderWing, tipFeather);
    group.add(wingPivot);
    arms.push(wingPivot);
  }

  // 2 Slender Legs with feathered thighs & 3-toed splayed feet
  const legs: THREE.Object3D[] = [];
  for (const lx of [-0.085, 0.085]) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.24, 0);
    const thigh = makeMobPart(0.085, 0.07, 0.085, { texKey: 'chicken_feather', roughness: 0.86 }, lists);
    thigh.position.y = -0.03;
    const leg = makeMobPart(0.042, 0.18, 0.042, { color: 0xe8a32c, roughness: 0.48 }, lists);
    leg.position.y = -0.14;
    const midToe = makeMobPart(0.035, 0.024, 0.12, { color: 0xe8a32c, roughness: 0.48 }, lists);
    midToe.position.set(0, -0.228, 0.045);
    pivot.add(thigh, leg, midToe);
    for (const side of [-1, 1]) {
      const toe = makeMobPart(0.03, 0.022, 0.1, { color: 0xe8a32c, roughness: 0.48 }, lists);
      toe.position.set(side * 0.032, -0.228, 0.04);
      toe.rotation.y = side * -0.42;
      pivot.add(toe);
    }
    group.add(pivot);
    legs.push(pivot);
  }

  return { group, body: torso, neck: neckPivot, head: headGroup, legs, arms, tail: tailPivot, ...lists };
}
