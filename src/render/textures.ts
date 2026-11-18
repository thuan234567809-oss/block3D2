import * as THREE from 'three';
import { ATLAS_GRID_COLS, STANDARD_TILE_PX, TEXTURE_ASSET_LIST } from '../data/textureManifest';
import { ATLAS_PX } from './atlasDraw';
import { drawCraftedTiles } from './blockArtCrafted';
import { drawNatureTiles } from './blockArtNature';
import { drawTerrainTiles } from './blockArtTerrain';
export { getItemIconDataUrl } from './itemIcons';

let cachedColorCanvas: HTMLCanvasElement | null = null;
let cachedBumpCanvas: HTMLCanvasElement | null = null;
let pngHydrationStarted = false;
const boundColorTextures = new Set<THREE.CanvasTexture>();

function ensureAtlasCanvases(): { color: HTMLCanvasElement; bump: HTMLCanvasElement } {
  if (cachedColorCanvas && cachedBumpCanvas) {
    return { color: cachedColorCanvas, bump: cachedBumpCanvas };
  }
  const color = document.createElement('canvas');
  color.width = ATLAS_PX;
  color.height = ATLAS_PX;
  const ctx = color.getContext('2d')!;

  const bump = document.createElement('canvas');
  bump.width = ATLAS_PX;
  bump.height = ATLAS_PX;
  const bumpCtx = bump.getContext('2d')!;

  drawTerrainTiles(ctx, bumpCtx);
  drawNatureTiles(ctx, bumpCtx);
  drawCraftedTiles(ctx, bumpCtx);

  cachedColorCanvas = color;
  cachedBumpCanvas = bump;
  return { color, bump };
}

function hydrateAtlasFromPngAssets(): void {
  if (pngHydrationStarted || typeof Image === 'undefined') return;
  pngHydrationStarted = true;
  const { color } = ensureAtlasCanvases();
  const ctx = color.getContext('2d');
  if (!ctx) return;

  let loadedCount = 0;
  for (const entry of TEXTURE_ASSET_LIST) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (img.naturalWidth !== STANDARD_TILE_PX || img.naturalHeight !== STANDARD_TILE_PX) return;
      const ox = (entry.index % ATLAS_GRID_COLS) * STANDARD_TILE_PX;
      const oy = Math.floor(entry.index / ATLAS_GRID_COLS) * STANDARD_TILE_PX;
      ctx.clearRect(ox, oy, STANDARD_TILE_PX, STANDARD_TILE_PX);
      ctx.drawImage(img, ox, oy, STANDARD_TILE_PX, STANDARD_TILE_PX);
      loadedCount++;
      if (loadedCount === TEXTURE_ASSET_LIST.length || loadedCount % 16 === 0) {
        for (const tex of boundColorTextures) {
          tex.needsUpdate = true;
        }
      }
    };
    img.src = entry.pngPath;
  }
}

export function createBlockAtlasCanvas(): HTMLCanvasElement {
  return ensureAtlasCanvases().color;
}

export interface BlockAtlasTextures {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

export function createBlockAtlasTextures(renderer: THREE.WebGLRenderer): BlockAtlasTextures {
  const { color, bump } = ensureAtlasCanvases();
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const colorMap = new THREE.CanvasTexture(color);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.magFilter = THREE.NearestFilter;
  colorMap.minFilter = THREE.NearestFilter;
  colorMap.generateMipmaps = false;
  colorMap.anisotropy = maxAniso;
  colorMap.needsUpdate = true;
  boundColorTextures.add(colorMap);

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.magFilter = THREE.NearestFilter;
  bumpMap.minFilter = THREE.NearestFilter;
  bumpMap.generateMipmaps = false;
  bumpMap.anisotropy = maxAniso;
  bumpMap.needsUpdate = true;

  hydrateAtlasFromPngAssets();
  return { colorMap, bumpMap };
}
