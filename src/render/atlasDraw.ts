import { hash2D } from '../world/noise';

export const TILE_SIZE = 16;
export const ATLAS_TILES = 16;
export const ATLAS_PX = TILE_SIZE * ATLAS_TILES; // 256x256

export type PixelSampler = (x: number, y: number, r: number) => string | null;
export type HeightSampler = (x: number, y: number, r: number) => number; // 0..255

export function drawAtlasTile(
  ctx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D | null,
  index: number,
  drawPixel: PixelSampler,
  drawHeight?: HeightSampler,
): void {
  const tx = index % ATLAS_TILES;
  const ty = Math.floor(index / ATLAS_TILES);
  const ox = tx * TILE_SIZE;
  const oy = ty * TILE_SIZE;
  ctx.clearRect(ox, oy, TILE_SIZE, TILE_SIZE);
  if (bumpCtx) {
    bumpCtx.fillStyle = 'rgb(128,128,128)';
    bumpCtx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
  }

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const r = hash2D(x + tx * 31, y + ty * 37, index + 99);
      const col = drawPixel(x, y, r);
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
      if (bumpCtx && drawHeight) {
        const h = Math.max(0, Math.min(255, Math.round(drawHeight(x, y, r))));
        bumpCtx.fillStyle = `rgb(${h},${h},${h})`;
        bumpCtx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
}

export function dirtShade(r: number): string {
  if (r < 0.16) return '#4e331c';
  if (r < 0.42) return '#664326';
  if (r < 0.74) return '#7a5230';
  if (r < 0.92) return '#8b613c';
  return '#996d46';
}

export function stoneShade(r: number): string {
  if (r < 0.15) return '#5b6068';
  if (r < 0.42) return '#6f747d';
  if (r < 0.75) return '#81868f';
  if (r < 0.92) return '#91969f';
  return '#a0a6b0';
}
