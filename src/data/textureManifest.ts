import { TEX, TextureTileKey } from './blockTextures';

export const STANDARD_TILE_PX = 16;
export const ATLAS_GRID_COLS = 16;
export const ATLAS_TOTAL_PX = STANDARD_TILE_PX * ATLAS_GRID_COLS;
export const ATLAS_UV_INSET = 0.0015;

export interface TextureAssetEntry {
  key: TextureTileKey;
  index: number;
  filename: string;
  pngPath: string;
  width: number;
  height: number;
  atlasCol: number;
  atlasRow: number;
}

export interface TileUvRect {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

function toAssetFilename(key: TextureTileKey): string {
  return `${key.toLowerCase()}.png`;
}

export const TEXTURE_MANIFEST: Record<TextureTileKey, TextureAssetEntry> = Object.fromEntries(
  (Object.entries(TEX) as [TextureTileKey, number][]).map(([key, index]) => {
    const filename = toAssetFilename(key);
    return [
      key,
      {
        key,
        index,
        filename,
        pngPath: `/assets/textures/blocks/${filename}`,
        width: STANDARD_TILE_PX,
        height: STANDARD_TILE_PX,
        atlasCol: index % ATLAS_GRID_COLS,
        atlasRow: Math.floor(index / ATLAS_GRID_COLS),
      },
    ];
  }),
) as Record<TextureTileKey, TextureAssetEntry>;

export const TEXTURE_ASSET_LIST: TextureAssetEntry[] = Object.values(TEXTURE_MANIFEST).sort(
  (a, b) => a.index - b.index,
);

export function getAtlasTileUv(tileIndex: number, inset = ATLAS_UV_INSET): TileUvRect {
  const tx = tileIndex % ATLAS_GRID_COLS;
  const ty = Math.floor(tileIndex / ATLAS_GRID_COLS);
  const step = 1 / ATLAS_GRID_COLS;
  return {
    u0: tx * step + inset,
    u1: (tx + 1) * step - inset,
    v1: 1 - ty * step - inset,
    v0: 1 - (ty + 1) * step + inset,
  };
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  tileCount: number;
}

export function validateTextureManifest(): ManifestValidationResult {
  const errors: string[] = [];
  const seenIndices = new Set<number>();
  const seenFiles = new Set<string>();

  for (const entry of TEXTURE_ASSET_LIST) {
    if (entry.index < 0 || entry.index >= ATLAS_GRID_COLS * ATLAS_GRID_COLS) {
      errors.push(`Tile ${entry.key} index ${entry.index} out of 16x16 atlas bounds`);
    }
    if (seenIndices.has(entry.index)) {
      errors.push(`Duplicate tile index ${entry.index} on ${entry.key}`);
    }
    seenIndices.add(entry.index);

    if (seenFiles.has(entry.filename)) {
      errors.push(`Duplicate asset filename ${entry.filename}`);
    }
    seenFiles.add(entry.filename);

    if (entry.width !== STANDARD_TILE_PX || entry.height !== STANDARD_TILE_PX) {
      errors.push(`Invalid dimensions on ${entry.key}: ${entry.width}x${entry.height}`);
    }

    const uv = getAtlasTileUv(entry.index);
    if (uv.u0 >= uv.u1 || uv.v0 >= uv.v1 || uv.u0 < 0 || uv.u1 > 1 || uv.v0 < 0 || uv.v1 > 1) {
      errors.push(`Invalid UV rect for ${entry.key}`);
    }
  }

  return { valid: errors.length === 0, errors, tileCount: TEXTURE_ASSET_LIST.length };
}
