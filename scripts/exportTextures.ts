import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ATLAS_GRID_COLS, ATLAS_TOTAL_PX, STANDARD_TILE_PX, TEXTURE_ASSET_LIST } from '../src/data/textureManifest';
import { drawCraftedTiles } from '../src/render/blockArtCrafted';
import { drawNatureTiles } from '../src/render/blockArtNature';
import { drawTerrainTiles } from '../src/render/blockArtTerrain';

function parseCssColor(color: string): [number, number, number, number] {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b, 255];
  }
  const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3]), 255];
  }
  const rgbaMatch = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
  if (rgbaMatch) {
    return [
      Number(rgbaMatch[1]),
      Number(rgbaMatch[2]),
      Number(rgbaMatch[3]),
      Math.max(0, Math.min(255, Math.round(Number(rgbaMatch[4]) * 255))),
    ];
  }
  return [255, 0, 255, 255];
}

class HeadlessCanvas2D {
  public readonly data: Uint8ClampedArray;
  public fillStyle = '#000000';

  constructor(
    public readonly width: number,
    public readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  public clearRect(x: number, y: number, w: number, h: number): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * this.width + px) * 4;
        this.data[i] = 0;
        this.data[i + 1] = 0;
        this.data[i + 2] = 0;
        this.data[i + 3] = 0;
      }
    }
  }

  public fillRect(x: number, y: number, w: number, h: number): void {
    const [r, g, b, a] = parseCssColor(this.fillStyle);
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * this.width + px) * 4;
        this.data[i] = r;
        this.data[i + 1] = g;
        this.data[i + 2] = b;
        this.data[i + 3] = a;
      }
    }
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBytes, Buffer.from(data), crc]);
}

function encodePngRgba(width: number, height: number, rgba: Uint8ClampedArray): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter None
    const srcStart = y * stride;
    for (let i = 0; i < stride; i++) {
      raw[rowStart + 1 + i] = rgba[srcStart + i];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

function main(): void {
  const colorCtx = new HeadlessCanvas2D(ATLAS_TOTAL_PX, ATLAS_TOTAL_PX);
  const bumpCtx = new HeadlessCanvas2D(ATLAS_TOTAL_PX, ATLAS_TOTAL_PX);
  const c2d = colorCtx as unknown as CanvasRenderingContext2D;
  const b2d = bumpCtx as unknown as CanvasRenderingContext2D;

  drawTerrainTiles(c2d, b2d);
  drawNatureTiles(c2d, b2d);
  drawCraftedTiles(c2d, b2d);

  const outDir = path.resolve(process.cwd(), 'public/assets/textures/blocks');
  fs.mkdirSync(outDir, { recursive: true });

  for (const entry of TEXTURE_ASSET_LIST) {
    const tx = (entry.index % ATLAS_GRID_COLS) * STANDARD_TILE_PX;
    const ty = Math.floor(entry.index / ATLAS_GRID_COLS) * STANDARD_TILE_PX;
    const tileRgba = new Uint8ClampedArray(STANDARD_TILE_PX * STANDARD_TILE_PX * 4);
    for (let y = 0; y < STANDARD_TILE_PX; y++) {
      for (let x = 0; x < STANDARD_TILE_PX; x++) {
        const src = ((ty + y) * ATLAS_TOTAL_PX + (tx + x)) * 4;
        const dst = (y * STANDARD_TILE_PX + x) * 4;
        tileRgba[dst] = colorCtx.data[src];
        tileRgba[dst + 1] = colorCtx.data[src + 1];
        tileRgba[dst + 2] = colorCtx.data[src + 2];
        tileRgba[dst + 3] = colorCtx.data[src + 3];
      }
    }
    const png = encodePngRgba(STANDARD_TILE_PX, STANDARD_TILE_PX, tileRgba);
    fs.writeFileSync(path.join(outDir, entry.filename), png);
  }

  const atlasPng = encodePngRgba(ATLAS_TOTAL_PX, ATLAS_TOTAL_PX, colorCtx.data);
  fs.writeFileSync(path.resolve(process.cwd(), 'public/assets/textures/atlas.png'), atlasPng);
  fs.writeFileSync(
    path.resolve(process.cwd(), 'public/assets/textures/manifest.json'),
    JSON.stringify({ tileSize: STANDARD_TILE_PX, atlasCols: ATLAS_GRID_COLS, tiles: TEXTURE_ASSET_LIST }, null, 2),
  );
  console.log(`Exported ${TEXTURE_ASSET_LIST.length} standalone 16x16 PNG block textures + atlas.png`);
}

main();
