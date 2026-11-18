import { MobType } from '../types/game';

export interface MobConfig {
  name: string;
  hostile: boolean;
  maxHp: number;
  speed: number;
  damage: number;
  drops: { itemId: string; count: number }[];
}

export const MOB_CONFIG: Record<MobType, MobConfig> = {
  [MobType.Cow]: { name: 'Cow', hostile: false, maxHp: 10, speed: 1.8, damage: 0, drops: [{ itemId: 'raw_beef', count: 2 }, { itemId: 'leather', count: 1 }] },
  [MobType.Pig]: { name: 'Pig', hostile: false, maxHp: 8, speed: 2.0, damage: 0, drops: [{ itemId: 'raw_pork', count: 2 }] },
  [MobType.Sheep]: { name: 'Sheep', hostile: false, maxHp: 8, speed: 1.9, damage: 0, drops: [{ itemId: 'wool', count: 2 }] },
  [MobType.Chicken]: { name: 'Chicken', hostile: false, maxHp: 4, speed: 2.3, damage: 0, drops: [{ itemId: 'raw_chicken', count: 1 }, { itemId: 'feather', count: 2 }] },
  [MobType.Zombie]: { name: 'Zombie', hostile: true, maxHp: 18, speed: 2.6, damage: 3, drops: [{ itemId: 'coal', count: 1 }] },
  [MobType.Skeleton]: { name: 'Skeleton', hostile: true, maxHp: 16, speed: 2.4, damage: 3, drops: [{ itemId: 'bone', count: 2 }] },
  [MobType.Spider]: { name: 'Spider', hostile: true, maxHp: 14, speed: 3.8, damage: 2, drops: [{ itemId: 'string', count: 2 }] },
  [MobType.Creeper]: { name: 'Creeper', hostile: true, maxHp: 16, speed: 2.5, damage: 9, drops: [{ itemId: 'gunpowder', count: 2 }] },
};
