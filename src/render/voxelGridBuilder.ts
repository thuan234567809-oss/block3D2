import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LIGHTING_CONFIG } from './lightingConfig';

export interface VoxelCell {
  gx: number;
  gy: number;
  code: string;
  depthScale: number;
}

export interface VoxelMaterialSpec {
  color: number;
  roughness: number;
  metalness: number;
  emissive?: number;
  emissiveIntensity?: number;
}

let cachedPixelGrainTex: THREE.CanvasTexture | null = null;

/**
 * Generates a crisp 16x16 pixel-art micro-grain texture shared across 3D voxel tools/items
 * so voxel surfaces have tactile pixel-art shading instead of flat untextured plastic.
 */
export function getVoxelPixelTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedPixelGrainTex) return cachedPixelGrainTex;
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const edge = x === 0 || y === 0 ? 12 : x === 15 || y === 15 ? -14 : 0;
      const checker = ((x + y * 3) % 4 === 0 ? 7 : ((x * 5 + y) % 5 === 0 ? -7 : 0));
      const v = Math.max(195, Math.min(255, 236 + edge + checker));
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cachedPixelGrainTex = tex;
  return tex;
}

/**
 * Extracts non-empty cells from a 2D pixel-grid pattern (row 0 = top) into centered 3D voxel descriptors.
 * Pure function suitable for unit testing without WebGL.
 */
export function extractVoxelCells(
  rows: string[],
  depthByCode: Record<string, number> = {},
): VoxelCell[] {
  const cells: VoxelCell[] = [];
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  for (let r = 0; r < h; r++) {
    const line = rows[r];
    for (let c = 0; c < w; c++) {
      const ch = line[c];
      if (!ch || ch === '.' || ch === ' ') continue;
      cells.push({
        gx: c - (w - 1) / 2,
        gy: (h - 1) / 2 - r,
        code: ch,
        depthScale: depthByCode[ch] ?? 1.0,
      });
    }
  }
  return cells;
}

export function buildVoxelGroupFromGrid(
  rows: string[],
  palette: Record<string, VoxelMaterialSpec>,
  voxelSize = 0.032,
  baseDepth = 0.046,
  depthByCode: Record<string, number> = {},
): THREE.Group {
  const group = new THREE.Group();
  const cells = extractVoxelCells(rows, depthByCode);
  const buckets = new Map<string, THREE.BufferGeometry[]>();
  const grainTex = getVoxelPixelTexture();

  for (const cell of cells) {
    const spec = palette[cell.code];
    if (!spec) continue;
    const dz = baseDepth * cell.depthScale;
    const box = new THREE.BoxGeometry(voxelSize, voxelSize, dz);
    box.translate(cell.gx * voxelSize, cell.gy * voxelSize, 0);
    const key = `${spec.color}_${spec.roughness}_${spec.metalness}_${spec.emissive ?? 0}`;
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(box);
  }

  for (const [key, geos] of buckets.entries()) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const firstCell = cells.find((c) => {
      const s = palette[c.code];
      return s && `${s.color}_${s.roughness}_${s.metalness}_${s.emissive ?? 0}` === key;
    });
    const spec = firstCell ? palette[firstCell.code] : { color: 0xffffff, roughness: 0.7, metalness: 0.1 };
    const envMapIntensity =
      spec.metalness >= 0.35
        ? LIGHTING_CONFIG.materials.metalItemEnvIntensity
        : LIGHTING_CONFIG.materials.nonMetalItemEnvIntensity;
    const mat = new THREE.MeshStandardMaterial({
      color: spec.color,
      map: grainTex,
      roughness: spec.roughness,
      metalness: spec.metalness,
      envMapIntensity,
      emissive: spec.emissive ?? 0x000000,
      emissiveIntensity: spec.emissiveIntensity ?? 0,
    });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

export function disposeGroupResources(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m) continue;
        m.dispose();
      }
    }
  });
}
