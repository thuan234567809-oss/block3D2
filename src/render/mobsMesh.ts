import * as THREE from 'three';
import { MobType } from '../types/game';
import {
  buildCreeperRig,
  buildSkeletonRig,
  buildSpiderRig,
  buildZombieRig,
} from './mobModelsHostile';
import {
  buildChickenRig,
  buildCowRig,
  buildPigRig,
  buildSheepRig,
} from './mobModelsPassive';
import {
  disposeMobRig,
  disposeSharedMobTextures,
  MobPartLists,
  MobRig,
} from './mobTextures';

export type { MobRig };
export { disposeMobRig, disposeSharedMobTextures };

export function createMobRig(type: MobType): MobRig {
  const group = new THREE.Group();
  const lists: MobPartLists = {
    materials: [],
    baseColors: [],
    baseEmissives: [],
    baseEmissiveIntensities: [],
  };

  switch (type) {
    case MobType.Cow:
      return buildCowRig(group, lists);
    case MobType.Pig:
      return buildPigRig(group, lists);
    case MobType.Sheep:
      return buildSheepRig(group, lists);
    case MobType.Chicken:
      return buildChickenRig(group, lists);
    case MobType.Zombie:
      return buildZombieRig(group, lists);
    case MobType.Skeleton:
      return buildSkeletonRig(group, lists);
    case MobType.Spider:
      return buildSpiderRig(group, lists);
    case MobType.Creeper:
      return buildCreeperRig(group, lists);
  }
}
