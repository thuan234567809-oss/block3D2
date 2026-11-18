export enum GamePhase {
  Title = 'title',
  Playing = 'playing',
  Paused = 'paused',
  GameOver = 'gameover',
}

export type GameMode = 'survival' | 'creative';

export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Cobblestone = 4,
  Sand = 5,
  Sandstone = 6,
  OakLog = 7,
  OakLeaves = 8,
  OakPlanks = 9,
  PineLog = 10,
  PineLeaves = 11,
  JungleLog = 12,
  JungleLeaves = 13,
  Water = 14,
  Glass = 15,
  CoalOre = 16,
  IronOre = 17,
  GoldOre = 18,
  DiamondOre = 19,
  Bedrock = 20,
  Snow = 21,
  Ice = 22,
  Cactus = 23,
  CraftingTable = 24,
  Furnace = 25,
  Torch = 26,
  Brick = 27,
  Clay = 28,
  SwampGrass = 29,
  SnowGrass = 30,
  TallGrass = 31,
  FlowerRed = 32,
  FlowerYellow = 33,
  Reed = 34,
  Wool = 35,
  Chest = 36,
  Barrel = 37,
  OakDoor = 38,
  Bed = 39,
  Anvil = 40,
  Gravel = 41,
  Mud = 42,
  BirchLog = 43,
  BirchLeaves = 44,
  AcaciaLog = 45,
  AcaciaLeaves = 46,
  DarkOakLog = 47,
  DarkOakLeaves = 48,
  CopperOre = 49,
  EmeraldOre = 50,
  WhiteConcrete = 51,
  Terracotta = 52,
  BirchPlanks = 53,
  SprucePlanks = 54,
  JunglePlanks = 55,
  AcaciaPlanks = 56,
  DarkOakPlanks = 57,
  OakSapling = 58,
  BirchSapling = 59,
  SpruceSapling = 60,
  Shrub = 61,
}

export enum BiomeId {
  Plains = 'plains',
  Forest = 'forest',
  Desert = 'desert',
  Snow = 'snow',
  Jungle = 'jungle',
  Mountains = 'mountains',
  Ocean = 'ocean',
  Swamp = 'swamp',
}

export enum WeatherType {
  Clear = 'clear',
  Rain = 'rain',
  Snow = 'snow',
  Storm = 'storm',
}

export enum MobType {
  Cow = 'cow',
  Pig = 'pig',
  Sheep = 'sheep',
  Chicken = 'chicken',
  Zombie = 'zombie',
  Skeleton = 'skeleton',
  Spider = 'spider',
  Creeper = 'creeper',
}

export type ToolKind = 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'sword' | 'none';
export type ToolTier = 0 | 1 | 2 | 3 | 4 | 5; // 0=hand, 1=wood, 2=stone/gold, 3=iron, 4=diamond, 5=netherite
export type ArmorSlotType = 'helmet' | 'chestplate' | 'leggings' | 'boots';

export type ItemCategory = 'block' | 'tool' | 'armor' | 'food' | 'material';

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  maxStack: number;
  blockId?: BlockId;
  toolKind?: ToolKind;
  toolTier?: ToolTier;
  durability?: number;
  attackDamage?: number;
  miningSpeed?: number;
  armorSlot?: ArmorSlotType;
  armorDefense?: number;
  hungerRestore?: number;
  healthRestore?: number;
  fuelBurnSec?: number;
  color: string;
  accentColor?: string;
}

export interface InventorySlot {
  itemId: string;
  count: number;
  durability?: number;
}

export interface CraftingRecipe {
  id: string;
  resultItemId: string;
  resultCount: number;
  requiresTable: boolean;
  // Pattern rows for shaped (e.g. ['WW', 'WW']) or ingredients list for shapeless
  pattern?: string[];
  key?: Record<string, string>;
  ingredients?: { itemId: string; count: number }[];
}

export interface GameSettings {
  renderDistance: number; // 2..6 chunks radius
  mouseSensitivity: number; // 0.3..2.0
  muted: boolean;
  fov: number;
}

export interface FurnaceEntity {
  type: 'furnace';
  x: number;
  y: number;
  z: number;
  input: InventorySlot | null;
  fuel: InventorySlot | null;
  output: InventorySlot | null;
  burnTime: number;
  maxBurnTime: number;
  cookProgress: number;
  cookDuration: number;
}

export interface ChestEntity {
  type: 'chest';
  x: number;
  y: number;
  z: number;
  slots: (InventorySlot | null)[];
}

export interface BarrelEntity {
  type: 'barrel';
  x: number;
  y: number;
  z: number;
  slots: (InventorySlot | null)[];
}

export interface DoorEntity {
  type: 'door';
  x: number;
  y: number;
  z: number;
  open: boolean;
  facing: number; // 0..3 cardinal direction
}

export interface BedEntity {
  type: 'bed';
  x: number;
  y: number;
  z: number;
}

export interface AnvilEntity {
  type: 'anvil';
  x: number;
  y: number;
  z: number;
  left: InventorySlot | null;
  right: InventorySlot | null;
}

export type BlockEntity =
  | FurnaceEntity
  | ChestEntity
  | BarrelEntity
  | DoorEntity
  | BedEntity
  | AnvilEntity;

export interface ActiveBlockUi {
  type: 'crafting_table' | 'furnace' | 'chest' | 'barrel' | 'anvil';
  x: number;
  y: number;
  z: number;
  partnerX?: number;
  partnerZ?: number;
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  armor: number;
  oxygen: number;
  maxOxygen: number;
  dayCount: number;
  timeOfDay: number; // 0..1 (0.25=noon, 0.75=midnight)
  biome: BiomeId;
  weather: WeatherType;
  hotbar: (InventorySlot | null)[];
  inventory: (InventorySlot | null)[];
  armorSlots: Record<ArmorSlotType, InventorySlot | null>;
  selectedSlot: number;
  gameMode: GameMode;
  isFlying: boolean;
  pointerLocked: boolean;
  isInventoryOpen: boolean;
  cursorItem: InventorySlot | null;
  craftingGrid: (InventorySlot | null)[];
  activeBlockUi: ActiveBlockUi | null;
  activeBlockEntity: BlockEntity | null;
  activePartnerChest: ChestEntity | null;
  isNearCraftingTable: boolean;
  isNearFurnace: boolean;
  miningProgress: number; // 0..1
  targetBlockName: string | null;
  targetBlockHint: string | null;
  targetMobName: string | null;
  targetMobHp: number;
  targetMobMaxHp: number;
  playerCoords: { x: number; y: number; z: number };
  respawnCoords: { x: number; y: number; z: number } | null;
  blocksMined: number;
  mobsDefeated: number;
  statusMessage: string | null;
}

export interface SavedDroppedItem {
  itemId: string;
  count: number;
  durability?: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
}

export interface WorldSaveData {
  version: number;
  seed: number;
  savedAt: number;
  dayCount: number;
  timeOfDay: number;
  weather: WeatherType;
  gameMode?: GameMode;
  respawnPoint?: { x: number; y: number; z: number } | null;
  player: {
    x: number;
    y: number;
    z: number;
    vx?: number;
    vy?: number;
    vz?: number;
    onGround?: boolean;
    fallStartY?: number;
    crouching?: boolean;
    isFlying?: boolean;
    yaw: number;
    pitch: number;
    health: number;
    hunger: number;
    blocksMined: number;
    mobsDefeated: number;
    selectedSlot: number;
    hotbar: (InventorySlot | null)[];
    inventory: (InventorySlot | null)[];
    armorSlots: Record<ArmorSlotType, InventorySlot | null>;
  };
  modifiedChunks: Record<string, number[]>;
  modifiedChunkMeta?: Record<string, number[]>;
  blockEntities?: BlockEntity[];
  droppedItems?: SavedDroppedItem[];
}
