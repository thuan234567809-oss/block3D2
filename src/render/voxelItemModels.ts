import * as THREE from 'three';
import { BLOCKS } from '../data/blocks';
import { ITEMS } from '../data/items';
import { ArmorSlotType, BlockId, ItemDef } from '../types/game';
import { LIGHTING_CONFIG } from './lightingConfig';
import { createBlockAtlasCanvas } from './textures';
import { buildVoxelGroupFromGrid, disposeGroupResources } from './voxelGridBuilder';
import { createToolVoxelModel, extractTierFromItemId } from './voxelToolModels';

let sharedAtlasTex: THREE.CanvasTexture | null = null;
const modelPrototypeCache = new Map<string, THREE.Group>();

function getSharedAtlasTexture(): THREE.CanvasTexture {
  if (sharedAtlasTex) return sharedAtlasTex;
  const tex = new THREE.CanvasTexture(createBlockAtlasCanvas());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  sharedAtlasTex = tex;
  return tex;
}

function makeTileUvBox(
  tex: { top: number; bottom: number; east: number; west: number; front?: number; south: number; back?: number; north: number },
  w: number,
  h: number,
  d: number,
): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // BoxGeometry face order: +X, -X, +Y, -Y, +Z (front), -Z (back)
  const faceTiles = [
    tex.east,
    tex.west,
    tex.top,
    tex.bottom,
    tex.front ?? tex.south,
    tex.back ?? tex.north,
  ];
  const cols = 16;
  const step = 1 / cols;
  const pad = 0.0015;
  for (let f = 0; f < 6; f++) {
    const t = faceTiles[f];
    const tx = t % cols;
    const ty = Math.floor(t / cols);
    const u0 = tx * step + pad;
    const u1 = (tx + 1) * step - pad;
    const v1 = 1 - ty * step - pad;
    const v0 = 1 - (ty + 1) * step + pad;
    for (let v = 0; v < 4; v++) {
      const idx = f * 4 + v;
      const ou = uv.getX(idx);
      const ov = uv.getY(idx);
      uv.setXY(idx, ou < 0.5 ? u0 : u1, ov < 0.5 ? v0 : v1);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

function addPart(
  g: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: number,
  roughness = 0.6,
  metalness = 0.1,
  emissive = 0,
): void {
  const envMapIntensity =
    metalness >= 0.35
      ? LIGHTING_CONFIG.materials.metalItemEnvIntensity
      : LIGHTING_CONFIG.materials.nonMetalItemEnvIntensity;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity, emissive, emissiveIntensity: emissive ? 0.65 : 0 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
}

function buildTorchModel(): THREE.Group {
  const g = new THREE.Group();
  addPart(g, 0.065, 0.28, 0.065, 0, -0.02, 0, 0x734a27, 0.88, 0.02);
  addPart(g, 0.072, 0.04, 0.072, 0, 0.125, 0, 0x262320, 0.9, 0.05);
  addPart(g, 0.068, 0.065, 0.068, 0, 0.165, 0, 0xff921c, 0.3, 0, 0xff6a00);
  addPart(g, 0.04, 0.05, 0.04, 0, 0.205, 0, 0xfff08a, 0.2, 0, 0xffd240);
  return g;
}

function buildIngotModel(main: number, light: number, dark: number): THREE.Group {
  const g = new THREE.Group();
  addPart(g, 0.28, 0.065, 0.14, 0, -0.01, 0, dark, 0.34, 0.82);
  addPart(g, 0.24, 0.055, 0.11, 0, 0.03, 0, main, 0.26, 0.85);
  addPart(g, 0.18, 0.02, 0.065, 0, 0.062, 0, light, 0.18, 0.9);
  return g;
}

function buildGemModel(main: number, light: number, dark: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(0.14, 0);
  geo.scale(0.95, 1.25, 0.72);
  const gem = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: main,
      roughness: 0.1,
      metalness: 0.25,
      emissive: dark,
      emissiveIntensity: 0.3,
      flatShading: true,
    }),
  );
  gem.castShadow = true;
  g.add(gem);
  addPart(g, 0.06, 0.12, 0.06, 0.03, 0.04, 0.03, light, 0.08, 0.35, light);
  return g;
}

function buildBucketModel(hasWater: boolean): THREE.Group {
  const g = new THREE.Group();
  addPart(g, 0.18, 0.035, 0.18, 0, -0.1, 0, 0x7b838f, 0.35, 0.8);
  addPart(g, 0.22, 0.19, 0.03, 0, -0.005, 0.095, 0xb8c2cf, 0.28, 0.82);
  addPart(g, 0.22, 0.19, 0.03, 0, -0.005, -0.095, 0xb8c2cf, 0.28, 0.82);
  addPart(g, 0.03, 0.19, 0.18, -0.095, -0.005, 0, 0x9aa4b2, 0.3, 0.82);
  addPart(g, 0.03, 0.19, 0.18, 0.095, -0.005, 0, 0x9aa4b2, 0.3, 0.82);
  addPart(g, 0.025, 0.08, 0.025, -0.105, 0.11, 0, 0x6f7782, 0.35, 0.78);
  addPart(g, 0.025, 0.08, 0.025, 0.105, 0.11, 0, 0x6f7782, 0.35, 0.78);
  addPart(g, 0.22, 0.025, 0.025, 0, 0.15, 0, 0x8b94a1, 0.35, 0.78);
  if (hasWater) {
    addPart(g, 0.16, 0.035, 0.16, 0, 0.055, 0, 0x2f94eb, 0.12, 0.2);
  }
  return g;
}

function buildArmorModel(slot: ArmorSlotType, mainHex: string, darkHex: string): THREE.Group {
  const g = new THREE.Group();
  const main = parseInt(mainHex.replace('#', ''), 16);
  const dark = parseInt(darkHex.replace('#', ''), 16);
  const metal = slot === 'helmet' || main > 0x999999 ? 0.65 : 0.08;
  const rough = metal > 0.3 ? 0.32 : 0.75;

  if (slot === 'helmet') {
    addPart(g, 0.26, 0.08, 0.26, 0, 0.08, 0, main, rough, metal);
    addPart(g, 0.26, 0.14, 0.05, 0, -0.01, -0.105, dark, rough, metal);
    addPart(g, 0.05, 0.14, 0.24, -0.105, -0.01, 0, main, rough, metal);
    addPart(g, 0.05, 0.14, 0.24, 0.105, -0.01, 0, main, rough, metal);
    addPart(g, 0.06, 0.09, 0.05, 0, 0.03, 0.105, dark, rough, metal);
  } else if (slot === 'chestplate') {
    addPart(g, 0.24, 0.26, 0.14, 0, 0, 0, main, rough, metal);
    addPart(g, 0.1, 0.12, 0.16, -0.15, 0.08, 0, dark, rough, metal);
    addPart(g, 0.1, 0.12, 0.16, 0.15, 0.08, 0, dark, rough, metal);
    addPart(g, 0.14, 0.08, 0.025, 0, 0.03, 0.075, dark, rough, metal);
  } else if (slot === 'leggings') {
    addPart(g, 0.24, 0.07, 0.14, 0, 0.1, 0, dark, rough, metal);
    addPart(g, 0.095, 0.2, 0.12, -0.065, -0.03, 0, main, rough, metal);
    addPart(g, 0.095, 0.2, 0.12, 0.065, -0.03, 0, main, rough, metal);
  } else {
    addPart(g, 0.1, 0.14, 0.14, -0.075, -0.02, 0, main, rough, metal);
    addPart(g, 0.1, 0.05, 0.06, -0.075, -0.065, 0.08, dark, rough, metal);
    addPart(g, 0.1, 0.14, 0.14, 0.075, -0.02, 0, main, rough, metal);
    addPart(g, 0.1, 0.05, 0.06, 0.075, -0.065, 0.08, dark, rough, metal);
  }
  return g;
}

function buildFoodModel(itemId: string, def: ItemDef): THREE.Group {
  const g = new THREE.Group();
  if (itemId === 'apple') {
    return buildVoxelGroupFromGrid(
      [
        '....S...',
        '...LL...',
        '.RWHRRR.',
        'RWHRRRRD',
        'RRRRRRRD',
        'RRRRRRRD',
        '.RRRRDD.',
        '..DDDD..',
      ],
      {
        S: { color: 0x6b4423, roughness: 0.85, metalness: 0.05 },
        L: { color: 0x4ea836, roughness: 0.7, metalness: 0.05 },
        R: { color: 0xd93030, roughness: 0.45, metalness: 0.05 },
        H: { color: 0xff7070, roughness: 0.35, metalness: 0.05 },
        W: { color: 0xffbaba, roughness: 0.3, metalness: 0.05 },
        D: { color: 0x9c1b1b, roughness: 0.55, metalness: 0.05 },
      },
      0.032,
      0.11,
      { S: 0.4, L: 0.35, R: 1.0, H: 1.05, W: 1.05, D: 0.9 },
    );
  }
  if (itemId === 'bread') {
    addPart(g, 0.3, 0.11, 0.16, 0, -0.02, 0, 0x9c6228, 0.85, 0.02);
    addPart(g, 0.26, 0.065, 0.13, 0, 0.05, 0, 0xd49a4c, 0.78, 0.02);
    addPart(g, 0.04, 0.02, 0.11, -0.06, 0.085, 0, 0xedd08c, 0.72, 0.02);
    addPart(g, 0.04, 0.02, 0.11, 0.05, 0.085, 0, 0xedd08c, 0.72, 0.02);
    return g;
  }
  // Meats (steak, pork, chicken)
  const main = parseInt(def.color.replace('#', ''), 16);
  const acc = parseInt((def.accentColor ?? '#e8d8cc').replace('#', ''), 16);
  addPart(g, 0.24, 0.075, 0.16, 0, 0, 0, main, 0.6, 0.05);
  addPart(g, 0.14, 0.03, 0.08, 0.03, 0.042, 0.02, acc, 0.52, 0.05);
  if (itemId.includes('chicken')) {
    addPart(g, 0.12, 0.04, 0.04, -0.14, 0, 0, 0xf2ede0, 0.75, 0.05);
  }
  return g;
}

function buildSaplingModel(itemId: string): THREE.Group {
  const g = new THREE.Group();
  const trunk = itemId === 'birch_sapling' ? 0xdcd8ce : itemId === 'spruce_sapling' ? 0x3b2414 : 0x694729;
  const leaf = itemId === 'spruce_sapling' ? 0x26593b : itemId === 'birch_sapling' ? 0x6cb553 : 0x4ba339;
  addPart(g, 0.05, 0.18, 0.05, 0, -0.05, 0, trunk, 0.85, 0.02);
  addPart(g, 0.2, 0.12, 0.12, 0, 0.08, 0, leaf, 0.78, 0.02);
  addPart(g, 0.12, 0.12, 0.2, 0, 0.08, 0, leaf, 0.78, 0.02);
  addPart(g, 0.1, 0.08, 0.1, 0, 0.16, 0, leaf, 0.78, 0.02);
  return g;
}

function buildFlowerItemModel(blockId: BlockId): THREE.Group {
  const g = new THREE.Group();
  const stemGreen = 0x3b822d;
  const leafGreen = 0x4b9938;
  const leafDark = 0x2f6c22;

  if (blockId === BlockId.FlowerRed) {
    // Poppy: slender stem + 2 staggered leaves + green calyx + 4 cupped crimson petals + dark center
    addPart(g, 0.036, 0.23, 0.036, 0, -0.045, 0, stemGreen, 0.88, 0.0);
    // Staggered angled stem leaves
    const leafMat = new THREE.MeshStandardMaterial({
      color: leafGreen,
      roughness: 0.86,
      metalness: 0.0,
      envMapIntensity: LIGHTING_CONFIG.materials.nonMetalItemEnvIntensity,
    });
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.018, 0.11), leafMat);
    l1.position.set(-0.045, -0.08, 0.02);
    l1.rotation.set(-0.4, -0.5, 0.2);
    l1.castShadow = true;
    g.add(l1);

    const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.018, 0.1), leafMat);
    l2.position.set(0.045, -0.02, -0.02);
    l2.rotation.set(0.4, -0.5, -0.2);
    l2.castShadow = true;
    g.add(l2);

    // Calyx
    addPart(g, 0.072, 0.038, 0.072, 0, 0.075, 0, leafDark, 0.88, 0.0);

    // 4 cupped scarlet petals
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xd42c2c,
      roughness: 0.85,
      metalness: 0.0,
      envMapIntensity: LIGHTING_CONFIG.materials.nonMetalItemEnvIntensity,
    });
    for (let i = 0; i < 4; i++) {
      const ang = i * (Math.PI * 0.5);
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.095, 0);
      pivot.rotation.y = ang;
      const petal = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.022, 0.105), petalMat);
      petal.position.set(0, 0.028, 0.062);
      petal.rotation.x = -0.62;
      petal.castShadow = true;
      pivot.add(petal);
      g.add(pivot);
    }

    // Dark seed capsule + pollen center
    addPart(g, 0.062, 0.048, 0.062, 0, 0.118, 0, 0x261d1a, 0.9, 0.0);
    addPart(g, 0.038, 0.024, 0.038, 0, 0.146, 0, 0xd4ba55, 0.88, 0.0);
    return g;
  }

  // Dandelion: shorter stem + 3 low basal rosette leaves + calyx + 8-ray golden rosette + amber center
  addPart(g, 0.038, 0.175, 0.038, 0, -0.075, 0, stemGreen, 0.88, 0.0);
  const basalMat = new THREE.MeshStandardMaterial({
    color: leafGreen,
    roughness: 0.86,
    metalness: 0.0,
    envMapIntensity: LIGHTING_CONFIG.materials.nonMetalItemEnvIntensity,
  });
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(0, -0.145, 0);
    pivot.rotation.y = i * ((Math.PI * 2) / 3);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.016, 0.11), basalMat);
    leaf.position.set(0, 0.015, 0.06);
    leaf.rotation.x = -0.32;
    leaf.castShadow = true;
    pivot.add(leaf);
    g.add(pivot);
  }

  addPart(g, 0.075, 0.034, 0.075, 0, 0.015, 0, leafDark, 0.88, 0.0);

  // Lower 4-ray + upper diagonal 4-ray golden petals
  addPart(g, 0.18, 0.022, 0.06, 0, 0.04, 0, 0xf2c933, 0.85, 0.0);
  addPart(g, 0.06, 0.022, 0.18, 0, 0.042, 0, 0xedb924, 0.85, 0.0);
  const diag = new THREE.Group();
  diag.rotation.y = Math.PI * 0.25;
  addPart(diag, 0.16, 0.02, 0.05, 0, 0.055, 0, 0xfae052, 0.85, 0.0);
  addPart(diag, 0.05, 0.02, 0.16, 0, 0.057, 0, 0xf2c933, 0.85, 0.0);
  g.add(diag);

  addPart(g, 0.098, 0.028, 0.098, 0, 0.071, 0, 0xf7d33e, 0.86, 0.0);
  addPart(g, 0.058, 0.026, 0.058, 0, 0.092, 0, 0xc97e14, 0.88, 0.0);
  return g;
}

function buildBlockItemModel(blockId: BlockId): THREE.Group {
  const g = new THREE.Group();
  const def = BLOCKS[blockId];
  if (!def) return g;

  if (blockId === BlockId.FlowerRed || blockId === BlockId.FlowerYellow) {
    return buildFlowerItemModel(blockId);
  }

  if (blockId === BlockId.Anvil) {
    addPart(g, 0.24, 0.07, 0.18, 0, -0.1, 0, 0x3b3e45, 0.45, 0.75);
    addPart(g, 0.12, 0.09, 0.1, 0, -0.02, 0, 0x2d3036, 0.5, 0.75);
    addPart(g, 0.3, 0.09, 0.16, 0, 0.07, 0, 0x4e525c, 0.4, 0.78);
    return g;
  }

  if (blockId === BlockId.Bed) {
    // Miniature 2-half 3D voxel bed item matching world model
    const wood = 0x7d532b;
    const darkWood = 0x5c3c1e;
    const frameL = 0.36;
    for (const lx of [-0.095, 0.095]) {
      for (const lz of [-0.155, 0.155]) {
        addPart(g, 0.036, 0.06, 0.036, lx, -0.09, lz, darkWood, 0.88, 0.0);
      }
    }
    addPart(g, 0.22, 0.045, frameL, 0, -0.055, 0, wood, 0.86, 0.0);
    addPart(g, 0.22, 0.14, 0.035, 0, 0.025, -0.165, darkWood, 0.85, 0.0); // Headboard
    addPart(g, 0.22, 0.075, 0.03, 0, -0.005, 0.168, darkWood, 0.85, 0.0); // Footboard
    addPart(g, 0.2, 0.045, 0.3, 0, -0.015, 0, 0xf2ede4, 0.9, 0.0); // Mattress
    addPart(g, 0.205, 0.055, 0.2, 0, -0.01, 0.052, 0xc73632, 0.88, 0.0); // Red blanket
    addPart(g, 0.206, 0.057, 0.045, 0, -0.008, -0.035, 0xf0dada, 0.9, 0.0); // Blanket fold trim
    addPart(g, 0.16, 0.038, 0.075, 0, 0.024, -0.11, 0xfaf6ed, 0.88, 0.0); // Pillow
    return g;
  }

  const mat = new THREE.MeshStandardMaterial({
    map: getSharedAtlasTexture(),
    roughness: blockId === BlockId.Glass || blockId === BlockId.Ice ? 0.22 : 0.92,
    metalness: 0.0,
    envMapIntensity:
      blockId === BlockId.Glass || blockId === BlockId.Ice
        ? LIGHTING_CONFIG.materials.translucentBlock.envMapIntensity
        : LIGHTING_CONFIG.materials.opaqueBlock.envMapIntensity,
    transparent: def.transparent,
    alphaTest: def.transparent && blockId !== BlockId.Glass && blockId !== BlockId.Ice ? 0.4 : 0,
  });
  const h = blockId === BlockId.Chest ? 0.24 : 0.26;
  const w = blockId === BlockId.OakDoor ? 0.07 : 0.26;
  const d = 0.26;
  const box = makeTileUvBox(def.textures, w, h, d);
  const mesh = new THREE.Mesh(box, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);

  if (blockId === BlockId.Chest) {
    addPart(g, 0.05, 0.06, 0.03, 0, 0.02, 0.135, 0xe2e6ed, 0.25, 0.85);
  }
  return g;
}

function createPrototypeModel(itemId: string): THREE.Group {
  const def = ITEMS[itemId];
  if (!def) return new THREE.Group();

  if (def.category === 'tool' && def.toolKind && def.toolKind !== 'none') {
    return createToolVoxelModel(def.toolKind, extractTierFromItemId(itemId));
  }
  if (itemId === 'torch') return buildTorchModel();
  if (itemId === 'stick') {
    const g = new THREE.Group();
    addPart(g, 0.045, 0.34, 0.045, 0, 0, 0, 0x7a522a, 0.88, 0.04);
    addPart(g, 0.055, 0.05, 0.055, 0, -0.06, 0, 0x5c3c1e, 0.88, 0.04);
    g.rotation.z = -0.35;
    return g;
  }
  if (itemId === 'coal' || itemId === 'charcoal') {
    const g = new THREE.Group();
    addPart(g, 0.18, 0.14, 0.16, 0, 0, 0, itemId === 'coal' ? 0x22252a : 0x38312c, 0.85, 0.12);
    addPart(g, 0.12, 0.12, 0.12, 0.05, 0.05, -0.03, 0x16181c, 0.9, 0.1);
    return g;
  }
  if (itemId === 'copper_ingot') return buildIngotModel(0xd97848, 0xf29f72, 0x994822);
  if (itemId === 'iron_ingot') return buildIngotModel(0xd5dbe3, 0xf7fbff, 0x8f98a3);
  if (itemId === 'gold_ingot') return buildIngotModel(0xf7c93e, 0xfff08a, 0xb88114);
  if (itemId === 'netherite_ingot') return buildIngotModel(0x52484d, 0x73666d, 0x2b2528);
  if (itemId === 'diamond') return buildGemModel(0x3be8e0, 0xb8fffc, 0x12787d);
  if (itemId === 'emerald') return buildGemModel(0x22d966, 0xabffc8, 0x0e7333);
  if (itemId === 'bucket' || itemId === 'water_bucket') return buildBucketModel(itemId === 'water_bucket');
  if (def.category === 'armor' && def.armorSlot) return buildArmorModel(def.armorSlot, def.color, def.accentColor ?? '#333333');
  if (def.category === 'food') return buildFoodModel(itemId, def);
  if (itemId.endsWith('_sapling')) return buildSaplingModel(itemId);
  if (itemId === 'wheat_seeds' || itemId === 'wheat') {
    const g = new THREE.Group();
    const col = itemId === 'wheat' ? 0xd9b84a : 0x7cb541;
    for (let i = -1; i <= 1; i++) {
      addPart(g, 0.05, itemId === 'wheat' ? 0.24 : 0.06, 0.05, i * 0.065, Math.abs(i) * -0.02, (i % 2) * 0.04, col, 0.78, 0.05);
    }
    return g;
  }
  if (def.blockId !== undefined && def.blockId !== BlockId.Air) {
    return buildBlockItemModel(def.blockId);
  }
  // Ore/Material fallback chunk with multi-voxel faceted form
  const main = parseInt(def.color.replace('#', ''), 16);
  const acc = parseInt((def.accentColor ?? '#555555').replace('#', ''), 16);
  const g = new THREE.Group();
  addPart(g, 0.18, 0.14, 0.15, 0, 0, 0, main, 0.7, 0.15);
  addPart(g, 0.11, 0.11, 0.12, 0.05, 0.04, 0.04, acc, 0.75, 0.1);
  return g;
}

export function getVoxelItemModel(itemId: string): THREE.Group {
  let proto = modelPrototypeCache.get(itemId);
  if (!proto) {
    proto = createPrototypeModel(itemId);
    modelPrototypeCache.set(itemId, proto);
  }
  return proto.clone(true);
}

export function clearVoxelItemModelCache(): void {
  for (const proto of modelPrototypeCache.values()) disposeGroupResources(proto);
  modelPrototypeCache.clear();
  if (sharedAtlasTex) {
    sharedAtlasTex.dispose();
    sharedAtlasTex = null;
  }
}
