import * as THREE from 'three';
import { LIGHTING_CONFIG } from './lightingConfig';

export type MobTexKey =
  | 'cow_hide'
  | 'cow_face'
  | 'pig_skin'
  | 'sheep_wool'
  | 'sheep_face'
  | 'chicken_feather'
  | 'zombie_skin'
  | 'zombie_shirt'
  | 'zombie_pants'
  | 'skeleton_bone'
  | 'skeleton_skull'
  | 'spider_chitin'
  | 'spider_abdomen'
  | 'creeper_camo';

export interface MobRig {
  group: THREE.Group;
  body: THREE.Object3D;
  neck?: THREE.Object3D;
  head: THREE.Object3D;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  tail?: THREE.Object3D;
  specialParts?: THREE.Object3D[];
  bow?: THREE.Object3D;
  mandibles?: THREE.Object3D[];
  legLowerPivots?: THREE.Object3D[];
  legBaseYaws?: number[];
  materials: THREE.MeshStandardMaterial[];
  baseColors: number[];
  baseEmissives: number[];
  baseEmissiveIntensities: number[];
}

export interface MobPartLists {
  materials: THREE.MeshStandardMaterial[];
  baseColors: number[];
  baseEmissives: number[];
  baseEmissiveIntensities: number[];
}

export interface MobPartOptions {
  color?: number;
  texKey?: MobTexKey;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
}

const textureCache = new Map<MobTexKey, THREE.CanvasTexture | null>();

function hash2d(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

function paintNoiseGrid(
  ctx: CanvasRenderingContext2D,
  palette: string[],
  seed: number,
  size = 16,
): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = Math.floor(hash2d(x, y, seed) * palette.length);
      ctx.fillStyle = palette[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function buildMobTexture(key: MobTexKey): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  switch (key) {
    case 'cow_hide': {
      paintNoiseGrid(ctx, ['#5d3f2a', '#533724', '#684730', '#4b3120'], 11);
      ctx.fillStyle = '#ece7dc';
      ctx.fillRect(1, 2, 5, 4);
      ctx.fillRect(2, 6, 3, 2);
      ctx.fillRect(9, 8, 6, 5);
      ctx.fillRect(10, 6, 4, 2);
      ctx.fillStyle = '#d9d2c4';
      ctx.fillRect(1, 2, 1, 4);
      ctx.fillRect(14, 9, 1, 4);
      break;
    }
    case 'cow_face': {
      paintNoiseGrid(ctx, ['#4d3322', '#573a27', '#432b1c'], 12);
      ctx.fillStyle = '#ece7dc';
      ctx.fillRect(6, 1, 4, 6);
      ctx.fillStyle = '#cbb3a2';
      ctx.fillRect(2, 10, 12, 5);
      break;
    }
    case 'pig_skin': {
      paintNoiseGrid(ctx, ['#f19ba8', '#ec909e', '#f5a8b4', '#e48594'], 21);
      break;
    }
    case 'sheep_wool': {
      paintNoiseGrid(ctx, ['#f6f5f0', '#eceae3', '#ffffff', '#e0ddd4'], 31);
      ctx.fillStyle = '#d4d0c5';
      for (let i = 0; i < 16; i += 4) {
        ctx.fillRect(i, (i * 3) % 16, 2, 1);
      }
      break;
    }
    case 'sheep_face': {
      paintNoiseGrid(ctx, ['#dcc4b0', '#d2b8a2', '#e4ceb9'], 32);
      ctx.fillStyle = '#f4f2ec';
      ctx.fillRect(1, 0, 14, 3);
      break;
    }
    case 'chicken_feather': {
      paintNoiseGrid(ctx, ['#fbfbfa', '#f2f0ea', '#ffffff', '#e7e3da'], 41);
      break;
    }
    case 'zombie_skin': {
      paintNoiseGrid(ctx, ['#4b8b49', '#3f793d', '#589c56', '#366b34'], 51);
      break;
    }
    case 'zombie_shirt': {
      paintNoiseGrid(ctx, ['#29829c', '#226f86', '#3292ad', '#1d5d71'], 52);
      ctx.fillStyle = '#4b8b49';
      ctx.fillRect(5, 0, 6, 2);
      ctx.fillStyle = '#194d5e';
      ctx.fillRect(0, 13, 16, 3);
      break;
    }
    case 'zombie_pants': {
      paintNoiseGrid(ctx, ['#3b477e', '#313c6b', '#44518c'], 53);
      break;
    }
    case 'skeleton_bone': {
      paintNoiseGrid(ctx, ['#dcdad0', '#cfccc0', '#e5e3da', '#c1bdb0'], 61);
      break;
    }
    case 'skeleton_skull': {
      paintNoiseGrid(ctx, ['#dedcd2', '#d2cfc3', '#e7e5dc'], 62);
      ctx.fillStyle = '#8b877c';
      ctx.fillRect(2, 12, 12, 1);
      for (let x = 3; x <= 12; x += 2) {
        ctx.fillRect(x, 12, 1, 3);
      }
      break;
    }
    case 'spider_chitin': {
      paintNoiseGrid(ctx, ['#272127', '#1e191e', '#322b32', '#171317'], 71);
      break;
    }
    case 'spider_abdomen': {
      paintNoiseGrid(ctx, ['#2b232a', '#211b20', '#362d35', '#191418'], 72);
      ctx.fillStyle = '#4d2226';
      ctx.fillRect(6, 3, 4, 8);
      ctx.fillStyle = '#682c31';
      ctx.fillRect(7, 5, 2, 4);
      break;
    }
    case 'creeper_camo': {
      paintNoiseGrid(ctx, ['#3aa838', '#4ac048', '#2d882b', '#5cd359', '#257223'], 81);
      break;
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

export function getMobTexture(key: MobTexKey): THREE.CanvasTexture | null {
  if (!textureCache.has(key)) {
    textureCache.set(key, buildMobTexture(key));
  }
  return textureCache.get(key) ?? null;
}

export function disposeSharedMobTextures(): void {
  for (const tex of textureCache.values()) {
    tex?.dispose();
  }
  textureCache.clear();
}

export function makeMobPart(
  w: number,
  h: number,
  d: number,
  opts: MobPartOptions,
  lists: MobPartLists,
): THREE.Mesh {
  const map = opts.texKey ? getMobTexture(opts.texKey) : null;
  const color = opts.color ?? (map ? 0xffffff : 0xcccccc);
  const emissive = opts.emissive ?? 0x000000;
  const emissiveIntensity = opts.emissiveIntensity ?? 0;
  const mat = new THREE.MeshStandardMaterial({
    color,
    map,
    roughness: opts.roughness ?? 0.84,
    metalness: opts.metalness ?? 0.02,
    envMapIntensity: LIGHTING_CONFIG.materials.mobEnvIntensity,
    emissive,
    emissiveIntensity,
  });
  lists.materials.push(mat);
  lists.baseColors.push(color);
  lists.baseEmissives.push(emissive);
  lists.baseEmissiveIntensities.push(emissiveIntensity);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function addGroundContactShadow(group: THREE.Group, radiusX: number, radiusZ = radiusX): void {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 16),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(radiusX, radiusZ, 1);
  shadow.position.y = 0.015;
  group.add(shadow);
}

export function addFramedEyes(
  head: THREE.Object3D,
  eyeY: number,
  eyeZ: number,
  spreadX: number,
  pupilColor: number,
  lists: MobPartLists,
  withSclera = true,
): void {
  for (const side of [-1, 1]) {
    if (withSclera) {
      const sclera = makeMobPart(0.11, 0.075, 0.025, { color: 0xf4f4f0, roughness: 0.45 }, lists);
      sclera.position.set(side * spreadX, eyeY, eyeZ);
      head.add(sclera);
      const pupil = makeMobPart(0.06, 0.065, 0.03, { color: pupilColor, roughness: 0.25 }, lists);
      pupil.position.set(side * (spreadX - side * 0.014), eyeY, eyeZ + 0.008);
      head.add(pupil);
    } else {
      const eye = makeMobPart(0.09, 0.08, 0.03, { color: pupilColor, roughness: 0.3 }, lists);
      eye.position.set(side * spreadX, eyeY, eyeZ);
      head.add(eye);
    }
  }
}

export function disposeMobRig(rig: MobRig): void {
  rig.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) {
        for (const m of mat) m.dispose();
      } else if (mat) {
        mat.dispose();
      }
    }
  });
}
