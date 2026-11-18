import * as THREE from 'three';
import { ItemDef } from '../types/game';

export type FirstPersonItemProfileKey =
  | 'sword'
  | 'pickaxe'
  | 'axe'
  | 'shovel'
  | 'hoe'
  | 'torch'
  | 'stick'
  | 'block'
  | 'food'
  | 'bucket'
  | 'sapling'
  | 'default';

export interface FirstPersonItemTransform {
  profile: FirstPersonItemProfileKey;
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
  /**
   * Local model axis vector pointing toward the tool/weapon's business end (tip / cutting head).
   * After applying `rotation`, this vector must aim forward (`-Z`) and away from the player.
   */
  localTipDirection: [number, number, number];
}

/**
 * Standardized First-Person Grip & Orientation Registry.
 * Coordinate system in `itemMount` (inside right-hand `wristGroup`):
 *   - `-Z` = Forward (away from camera toward crosshair target)
 *   - `+Y` = Up
 *   - `+X` = Right, `-X` = Inward toward screen center
 *
 * Note on 16x16 tool voxel blueprints (`voxelToolModels.ts`):
 *   - Handle bottom sits at `(-X, -Y)`.
 *   - Sword tip, Shovel scoop, and Pickaxe arch point toward `(+X, +Y)`.
 *     Rotating by `R_y(+1.36 rad)` maps `+X -> -Z (forward)` and `-X -> +Z (back in palm)`.
 *   - Axe & Hoe have their blades on the top-left `(-X, +Y)` side of the handle diagonal.
 *     Rotating in-plane first (`R_z(+0.98 rad)`) then yawing (`R_y(-1.38 rad)` -> `-X -> -Z`)
 *     places the handle bottom cleanly inside the palm while aiming the cutting head FORWARD (`-Z`).
 */
export const FIRST_PERSON_ITEM_TRANSFORMS: Record<FirstPersonItemProfileKey, FirstPersonItemTransform> = {
  sword: {
    profile: 'sword',
    scale: 0.84,
    position: [0.018, 0.082, -0.165],
    rotation: [-0.08, 1.28, -0.36],
    localTipDirection: [0.707, 0.707, 0],
  },
  pickaxe: {
    profile: 'pickaxe',
    scale: 0.82,
    position: [0.018, 0.084, -0.165],
    rotation: [-0.06, 1.32, -0.34],
    localTipDirection: [0.707, 0.707, 0],
  },
  axe: {
    profile: 'axe',
    scale: 0.82,
    position: [-0.022, 0.145, -0.065],
    rotation: [0.04, -1.32, 0.88],
    localTipDirection: [-0.3, 0.95, 0],
  },
  shovel: {
    profile: 'shovel',
    scale: 0.82,
    position: [0.018, 0.082, -0.165],
    rotation: [-0.04, 1.32, -0.38],
    localTipDirection: [0.707, 0.707, 0],
  },
  hoe: {
    profile: 'hoe',
    scale: 0.82,
    position: [-0.022, 0.145, -0.065],
    rotation: [0.04, -1.32, 0.88],
    localTipDirection: [-0.3, 0.95, 0],
  },
  torch: {
    profile: 'torch',
    scale: 0.88,
    position: [-0.01, 0.135, -0.055],
    rotation: [-0.32, 0.22, 0.06],
    localTipDirection: [0, 1, 0],
  },
  stick: {
    profile: 'stick',
    scale: 0.84,
    position: [0.006, 0.125, -0.075],
    rotation: [-0.26, 1.32, -0.12],
    localTipDirection: [0.34, 0.94, 0],
  },
  block: {
    profile: 'block',
    scale: 0.8,
    position: [-0.032, 0.058, -0.098],
    rotation: [0.14, 0.62, 0.06],
    localTipDirection: [0, 0, -1],
  },
  food: {
    profile: 'food',
    scale: 0.78,
    position: [-0.024, 0.062, -0.082],
    rotation: [0.18, 0.48, -0.08],
    localTipDirection: [0, 0, -1],
  },
  bucket: {
    profile: 'bucket',
    scale: 0.78,
    position: [-0.022, 0.07, -0.09],
    rotation: [0.14, 0.42, 0],
    localTipDirection: [0, 0, -1],
  },
  sapling: {
    profile: 'sapling',
    scale: 0.82,
    position: [-0.022, 0.09, -0.082],
    rotation: [-0.12, 0.45, 0.04],
    localTipDirection: [0, 1, 0],
  },
  default: {
    profile: 'default',
    scale: 0.8,
    position: [-0.024, 0.072, -0.084],
    rotation: [0.12, 0.45, -0.08],
    localTipDirection: [0, 0, -1],
  },
};

export function resolveFirstPersonItemTransform(def: ItemDef): FirstPersonItemTransform {
  if (def.category === 'tool' && def.toolKind && def.toolKind !== 'none') {
    return FIRST_PERSON_ITEM_TRANSFORMS[def.toolKind];
  }
  if (def.id === 'torch') return FIRST_PERSON_ITEM_TRANSFORMS.torch;
  if (def.id === 'stick') return FIRST_PERSON_ITEM_TRANSFORMS.stick;
  if (def.id === 'bucket' || def.id === 'water_bucket') return FIRST_PERSON_ITEM_TRANSFORMS.bucket;
  if (def.id.endsWith('_sapling')) return FIRST_PERSON_ITEM_TRANSFORMS.sapling;
  if (def.category === 'food') return FIRST_PERSON_ITEM_TRANSFORMS.food;
  if (def.category === 'block') return FIRST_PERSON_ITEM_TRANSFORMS.block;
  return FIRST_PERSON_ITEM_TRANSFORMS.default;
}

export function computeTransformedTipDirection(transform: FirstPersonItemTransform): THREE.Vector3 {
  const euler = new THREE.Euler(
    transform.rotation[0],
    transform.rotation[1],
    transform.rotation[2],
    'XYZ',
  );
  return new THREE.Vector3(...transform.localTipDirection).applyEuler(euler).normalize();
}
