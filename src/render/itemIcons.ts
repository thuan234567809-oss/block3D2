import { BLOCKS } from '../data/blocks';
import { ITEMS } from '../data/items';
import { BlockId, ItemDef } from '../types/game';
import { ATLAS_TILES, TILE_SIZE } from './atlasDraw';
import { createBlockAtlasCanvas } from './textures';
import { extractTierFromItemId, TIER_PALETTES, TOOL_BLUEPRINTS } from './voxelToolModels';

const iconCache = new Map<string, string>();

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function drawIsometricBlockIcon(ctx: CanvasRenderingContext2D, blockId: BlockId): void {
  const def = BLOCKS[blockId];
  const atlas = createBlockAtlasCanvas();
  const drawFace = (tileIdx: number, a: number, b: number, c: number, d: number, e: number, f: number, shade: string | null) => {
    const tx = (tileIdx % ATLAS_TILES) * TILE_SIZE;
    const ty = Math.floor(tileIdx / ATLAS_TILES) * TILE_SIZE;
    ctx.save();
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(atlas, tx, ty, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
    if (shade) {
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    }
    ctx.restore();
  };
  // Isometric 32x32 cube projection using crisp 16x16 atlas tiles (top + front + side)
  drawFace(def.textures.top, 0.82, 0.42, -0.82, 0.42, 16, 2.5, 'rgba(255,255,255,0.08)');
  drawFace(def.textures.front ?? def.textures.south, 0.82, 0.42, 0, 0.88, 2.9, 9.2, 'rgba(0,0,0,0.06)');
  drawFace(def.textures.side, 0.82, -0.42, 0, 0.88, 16, 15.9, 'rgba(0,0,0,0.28)');
}

function drawGridSprite(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  colors: Record<string, string>,
  offsetX = 2,
  offsetY = 2,
  scale = 2,
): void {
  for (let r = 0; r < rows.length; r++) {
    const line = rows[r];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      const col = colors[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(offsetX + c * scale, offsetY + r * scale, scale, scale);
    }
  }
}

function drawToolIcon(ctx: CanvasRenderingContext2D, itemId: string, def: ItemDef): void {
  if (!def.toolKind || def.toolKind === 'none') return;
  const tier = extractTierFromItemId(itemId);
  const p = TIER_PALETTES[tier];
  const bp = TOOL_BLUEPRINTS[def.toolKind];
  // 1px dark silhouette pass for ultra crisp readability
  const outline: Record<string, string> = { W: '#14110e', C: '#14110e', M: '#14110e', L: '#14110e', D: '#14110e' };
  drawGridSprite(ctx, bp, outline, 3, 4, 2);
  drawGridSprite(ctx, bp, outline, 5, 4, 2);
  drawGridSprite(ctx, bp, outline, 4, 3, 2);
  drawGridSprite(ctx, bp, outline, 4, 5, 2);
  drawGridSprite(
    ctx,
    bp,
    {
      W: '#85582f',
      C: tier === 'netherite' ? '#a67b35' : '#57381c',
      M: hex(p.main),
      L: hex(p.light),
      D: hex(p.dark),
    },
    4,
    4,
    2,
  );
}

function drawSpecialItemIcon(ctx: CanvasRenderingContext2D, itemId: string, def: ItemDef): boolean {
  const m = def.color;
  const a = def.accentColor ?? '#3a3a3a';

  if (itemId === 'torch') {
    drawGridSprite(ctx, ['..LL..', '.LFFL.', '.FFFF.', '..CC..', '..WW..', '..WW..', '..WW..', '..WW..', '..WW..', '..WW..'], {
      L: '#fff6a6', F: '#ff9d24', C: '#382a1e', W: '#7a522a',
    }, 10, 4, 2);
    return true;
  }
  if (itemId === 'stick') {
    drawGridSprite(ctx, ['........W.', '.......WW.', '......WW..', '.....WW...', '....WW....', '...WW.....', '..WW......', '.WW.......', '.W........'], { W: '#8a5c31' }, 6, 6, 2);
    return true;
  }
  if (itemId === 'coal' || itemId === 'charcoal') {
    drawGridSprite(ctx, ['..DDDD..', '.DMMMMD.', 'DMMLMMMD', 'DMMMMMDD', 'DDMMMMDD', '..DDDD..'], {
      D: '#141619', M: itemId === 'coal' ? '#292d33' : '#3d342d', L: '#4e545e',
    }, 6, 8, 2.5);
    return true;
  }
  if (itemId.endsWith('_ingot')) {
    drawGridSprite(ctx, ['...LLLLL..', '..LMMMMMD.', '.LMMMMMMDD', 'LMMMMMMMDD', '.DDDDDDDD.'], {
      L: '#ffffffaa', M: m, D: a,
    }, 4, 9, 2.4);
    return true;
  }
  if (itemId === 'diamond' || itemId === 'emerald') {
    drawGridSprite(ctx, ['...LL...', '..LMMML.', '.LMMLMMD', 'LMMMMMMD', '.DMMMMD.', '..DMMD..', '...DD...'], {
      L: itemId === 'diamond' ? '#c9fffe' : '#baffcf', M: m, D: a,
    }, 6, 6, 2.5);
    return true;
  }
  if (itemId === 'bucket' || itemId === 'water_bucket') {
    drawGridSprite(ctx, ['..BBBB..', '.B....B.', 'BWWWWWWB', 'BMMMMMMB', 'BMMMMMMB', '.BMMMMB.', '..BBBB..'], {
      B: '#7a838f', M: '#c2cad6', W: itemId === 'water_bucket' ? '#3699f0' : '#2a2e36',
    }, 6, 6, 2.5);
    return true;
  }
  if (itemId === 'bed') {
    drawGridSprite(
      ctx,
      [
        'WW..........',
        'WPP.........',
        'WPPTTTTTTTT.',
        'WMMRRRRRRRRW',
        'WWWWWWWWWWWW',
        '.W........W.',
      ],
      { W: '#6e4722', P: '#faf6ee', T: '#f0dada', M: '#ece6da', R: '#c93834' },
      3,
      9,
      2.2,
    );
    return true;
  }
  if (itemId === 'apple') {
    drawGridSprite(ctx, ['....S...', '...LL...', '.RHRRRR.', 'RHRRRRRD', 'RRRRRRRD', 'RRRRRRRD', '.RRRRDD.', '..DDDD..'], {
      S: '#694423', L: '#52a638', R: '#d93232', H: '#ff9c9c', D: '#8c1919',
    }, 6, 6, 2.5);
    return true;
  }
  if (itemId === 'bread') {
    drawGridSprite(ctx, ['..LLLLLL..', '.LMHMMMHD.', 'LMMMMMMMMD', 'DDDDDDDDDD'], {
      L: '#e6b865', H: '#fff0b8', M: '#c7883c', D: '#784a18',
    }, 4, 10, 2.4);
    return true;
  }
  if (itemId === 'flower_red') {
    drawGridSprite(
      ctx,
      [
        '..RR..RR..',
        '.RRRRRRRR.',
        '.RRCCCRRR.',
        '..RPPPRR..',
        '...RRRR...',
        '....CC....',
        '....SS.LL.',
        '.LL.SSLL..',
        '..LLSS....',
        '....SS....',
        '....SS....',
      ],
      { R: '#d92f2f', C: '#261c19', P: '#d6bd56', S: '#347327', L: '#4d9c38' },
      6,
      4,
      2.2,
    );
    return true;
  }
  if (itemId === 'flower_yellow') {
    drawGridSprite(
      ctx,
      [
        '..YY..YY..',
        '.YYYYYYYY.',
        'YYAAYYYYYY',
        '.YYAAYYYY.',
        '..YYYYYY..',
        '....CC....',
        '....SS....',
        '....SS....',
        '..LLSSLL..',
        '.LLLSSLLL.',
        '....SS....',
      ],
      { Y: '#f5d23b', A: '#cc8214', C: '#387d2b', S: '#3a822d', L: '#4fa13a' },
      6,
      4,
      2.2,
    );
    return true;
  }
  if (itemId === 'wheat_seeds') {
    drawGridSprite(ctx, ['..G.....', '.GL....G', '...G..GL', '.G..G...', 'GL...GL.'], {
      G: '#6aa336', L: '#9cd65e',
    }, 6, 8, 2.5);
    return true;
  }
  if (itemId.endsWith('_sapling')) {
    drawGridSprite(ctx, ['..LL..', '.LMMM.', 'LMMMMD', '.LMMD.', '..WW..', '..WW..', '..WW..'], {
      L: '#78cf59', M: m, D: '#27591d', W: a,
    }, 8, 6, 2.5);
    return true;
  }
  if (def.category === 'armor') {
    ctx.fillStyle = '#14171c';
    ctx.fillRect(5, 5, 22, 22);
    ctx.fillStyle = m;
    if (def.armorSlot === 'helmet') {
      ctx.fillRect(7, 7, 18, 15);
      ctx.clearRect(11, 15, 10, 7);
    } else if (def.armorSlot === 'chestplate') {
      ctx.fillRect(6, 7, 20, 8);
      ctx.fillRect(9, 13, 14, 12);
    } else if (def.armorSlot === 'leggings') {
      ctx.fillRect(8, 7, 16, 6);
      ctx.fillRect(8, 13, 6, 12);
      ctx.fillRect(18, 13, 6, 12);
    } else {
      ctx.fillRect(7, 15, 7, 10);
      ctx.fillRect(18, 15, 7, 10);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(8, 8, 5, 3);
    return true;
  }
  return false;
}

export function getItemIconDataUrl(itemId: string): string {
  const cached = iconCache.get(itemId);
  if (cached) return cached;
  const def = ITEMS[itemId];
  if (!def) return '';

  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  if (def.toolKind && def.toolKind !== 'none') {
    drawToolIcon(ctx, itemId, def);
  } else if (!drawSpecialItemIcon(ctx, itemId, def)) {
    if (
      def.blockId !== undefined &&
      def.blockId !== BlockId.Air &&
      !BLOCKS[def.blockId]?.plant &&
      def.blockId !== BlockId.OakDoor
    ) {
      drawIsometricBlockIcon(ctx, def.blockId);
    } else {
      const m = def.color;
      const a = def.accentColor ?? '#333333';
      drawGridSprite(
        ctx,
        ['..MMMM..', '.MMLMMM.', 'MMMMMMMM', 'MMMMMMAA', '.MMAAAA.', '..AAAA..'],
        { M: m, L: '#ffffff88', A: a },
        6,
        8,
        2.5,
      );
    }
  }

  const url = c.toDataURL();
  iconCache.set(itemId, url);
  return url;
}
