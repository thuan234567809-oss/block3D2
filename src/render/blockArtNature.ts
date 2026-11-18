import { TEX } from '../data/blockTextures';
import { drawAtlasTile } from './atlasDraw';

function drawLogEnd(
  ctx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D | null,
  idx: number,
  bark: string,
  ringDark: string,
  ringLight: string,
  heart: string,
): void {
  drawAtlasTile(
    ctx,
    bumpCtx,
    idx,
    (x, y, r) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (d > 6.4) return bark;
      if (d > 5.4) return ringDark;
      if (d < 1.8) return heart;
      return Math.floor(d) % 2 === 0 ? ringLight : r < 0.4 ? ringDark : ringLight;
    },
    (x, y) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      return d > 6.4 ? 156 : 122 + (Math.floor(d) % 2) * 18;
    },
  );
}

function drawLeavesTile(
  ctx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D | null,
  idx: number,
  dark: string,
  mid: string,
  light: string,
  gapMod: number,
): void {
  drawAtlasTile(
    ctx,
    bumpCtx,
    idx,
    (x, y, r) => {
      if ((x + y * 3) % gapMod === 0 && r < 0.5) return null;
      if ((x * 5 + y * 2) % 13 === 0 && r > 0.52) return light;
      return r < 0.34 ? dark : r < 0.76 ? mid : light;
    },
    (_x, _y, r) => 112 + r * 45,
  );
}

function drawSaplingTile(
  ctx: CanvasRenderingContext2D,
  idx: number,
  stemCol: string,
  leafDark: string,
  leafLight: string,
): void {
  drawAtlasTile(ctx, null, idx, (x, y, r) => {
    if (x >= 7 && x <= 8 && y >= 9 && y <= 15) return stemCol;
    const dx = Math.abs(x - 7.5);
    const dy = y - 5.5;
    if (dx * 0.9 + Math.abs(dy) * 0.85 < 4.5 && r > 0.18) {
      return r < 0.45 ? leafDark : leafLight;
    }
    return null;
  });
}

export function drawNatureTiles(
  ctx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D | null,
): void {
  // 1. Oak (clear vertical bark grooves + distinct growth rings)
  drawLogEnd(ctx, bumpCtx, TEX.OAK_LOG_TOP, '#54371f', '#ab804e', '#cca673', '#8b6236');
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.OAK_LOG_SIDE,
    (x, y, r) => {
      if (x % 4 === 0 || (x % 4 === 2 && (y + x) % 6 === 0)) return '#472d18';
      if (x % 4 === 1) return '#7b5330';
      return r < 0.45 ? '#654225' : '#734d2b';
    },
    (x, _y, r) => (x % 4 === 0 ? 86 : 138 + r * 24),
  );
  drawLeavesTile(ctx, bumpCtx, TEX.OAK_LEAVES, '#2a631f', '#3d872f', '#52a33f', 7);

  // 2. Birch
  drawLogEnd(ctx, bumpCtx, TEX.BIRCH_LOG_TOP, '#d6d2c9', '#b8ad95', '#ded3b8', '#99896c');
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.BIRCH_LOG_SIDE,
    (x, y, r) => {
      const knot = (y % 5 === 2 && x >= (y * 3) % 10 && x <= ((y * 3) % 10) + 4) || (y % 7 === 0 && x % 6 < 2);
      if (knot) return r < 0.5 ? '#32302c' : '#4a4740';
      return r < 0.35 ? '#cfcbc2' : r < 0.75 ? '#e4e1d8' : '#f0ede6';
    },
    (x, y, r) => (y % 5 === 2 && x % 7 < 3 ? 96 : 132 + r * 18),
  );
  drawLeavesTile(ctx, bumpCtx, TEX.BIRCH_LEAVES, '#487a33', '#5f9443', '#78b058', 7);

  // 3. Spruce / Pine
  drawLogEnd(ctx, bumpCtx, TEX.PINE_LOG_TOP, '#362112', '#7a5836', '#997149', '#5e4124');
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.PINE_LOG_SIDE,
    (x, y, r) => {
      if (x % 3 === 0 || (y % 6 === 0 && r < 0.4)) return '#29180d';
      return r < 0.5 ? '#3e2716' : '#4d321c';
    },
    (x, _y, r) => (x % 3 === 0 ? 84 : 135 + r * 24),
  );
  drawLeavesTile(ctx, bumpCtx, TEX.PINE_LEAVES, '#1c452d', '#285e3e', '#36754e', 6);

  // 4. Jungle
  drawLogEnd(ctx, bumpCtx, TEX.JUNGLE_LOG_TOP, '#523c1f', '#8f6a3b', '#ad834f', '#735229');
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.JUNGLE_LOG_SIDE,
    (x, y, r) => {
      if (x % 4 === 0) return '#4a361c';
      if ((x + y) % 7 === 0 && r > 0.55) return '#4e6e29';
      return r < 0.5 ? '#664c29' : '#755832';
    },
    (x, _y, r) => (x % 4 === 0 ? 92 : 132 + r * 22),
  );
  drawLeavesTile(ctx, bumpCtx, TEX.JUNGLE_LEAVES, '#27751b', '#3a9928', '#52b33a', 5);

  // 5. Acacia
  drawLogEnd(ctx, bumpCtx, TEX.ACACIA_LOG_TOP, '#5c574f', '#9c4b2b', '#ba633c', '#7a371d');
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.ACACIA_LOG_SIDE,
    (x, _y, r) => (x % 3 === 0 ? '#4d4842' : r < 0.5 ? '#696259' : '#787066'),
    (x, _y, r) => (x % 3 === 0 ? 85 : 135 + r * 22),
  );
  drawLeavesTile(ctx, bumpCtx, TEX.ACACIA_LEAVES, '#4a6b24', '#638a32', '#7da842', 6);

  // 6. Dark Oak
  drawLogEnd(ctx, bumpCtx, TEX.DARK_OAK_LOG_TOP, '#29190d', '#54381e', '#6e4b2b', '#402914');
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.DARK_OAK_LOG_SIDE,
    (x, _y, r) => (x % 4 === 0 ? '#21140a' : r < 0.5 ? '#362212' : '#452c18'),
    (x, _y, r) => (x % 4 === 0 ? 84 : 136 + r * 24),
  );
  drawLeavesTile(ctx, bumpCtx, TEX.DARK_OAK_LEAVES, '#1e4a17', '#2b6621', '#3b822d', 8);

  // Cactus
  drawAtlasTile(ctx, bumpCtx, TEX.CACTUS_TOP, (x, y, r) =>
    x === 0 || y === 0 || x === 15 || y === 15 ? '#20521e' : r < 0.5 ? '#398034' : '#4a9944',
  );
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.CACTUS_SIDE,
    (x, y, r) => {
      if (x % 4 === 0 && y % 3 === 0) return '#d8e8b0';
      return x % 3 === 0 ? '#245c20' : r < 0.5 ? '#378031' : '#479641';
    },
    (x, y) => (x % 4 === 0 && y % 3 === 0 ? 200 : x % 3 === 0 ? 92 : 140),
  );

  // Flora: grounded cleanly at y = 15 (bottom row) so blades never float or sink
  drawAtlasTile(ctx, null, TEX.TALL_GRASS, (x, y, r) => {
    const heights: Record<number, number> = { 2: 8, 5: 4, 8: 6, 11: 5, 13: 9 };
    const topY = heights[x];
    if (topY === undefined) {
      if ((x === 4 || x === 10) && y >= 10) return '#397529';
      return null;
    }
    if (y < topY) return null;
    if (y <= topY + 2) return '#6cbd51';
    if (y >= 13) return '#2f6321';
    return r < 0.5 ? '#438a31' : '#539e3d';
  });

  drawAtlasTile(ctx, null, TEX.SHRUB, (x, y, r) => {
    if (y >= 12 && (x === 7 || x === 8)) return '#5c3c1e';
    const d = Math.hypot(x - 7.5, y - 9.2);
    if (d < 5.0 && y < 15 && r > 0.22) return r < 0.45 ? '#366b29' : r < 0.8 ? '#4e8a3a' : '#6ca346';
    return null;
  });

  drawAtlasTile(ctx, null, TEX.FLOWER_RED, (x, y) => {
    if (x >= 7 && x <= 8 && y >= 7 && y <= 15) return '#357327';
    if ((x === 6 && y === 12) || (x === 9 && y === 11)) return '#4b9438';
    if (x >= 5 && x <= 10 && y >= 2 && y <= 7) {
      if ((x === 5 || x === 10) && (y === 2 || y === 7)) return null;
      if (x >= 7 && x <= 8 && y === 5) return '#2b1b17';
      return (x + y) % 2 === 0 ? '#dc3434' : '#be2222';
    }
    return null;
  });

  drawAtlasTile(ctx, null, TEX.FLOWER_YELLOW, (x, y) => {
    if (x >= 7 && x <= 8 && y >= 7 && y <= 15) return '#357327';
    if ((x === 6 && y === 13) || (x === 9 && y === 12)) return '#4b9438';
    if (x >= 5 && x <= 10 && y >= 3 && y <= 7) {
      if ((x === 5 || x === 10) && y === 3) return null;
      return x >= 7 && x <= 8 && y === 5 ? '#d98f16' : (x + y) % 2 === 0 ? '#fae04b' : '#eab721';
    }
    return null;
  });

  drawAtlasTile(ctx, null, TEX.REED, (x, y) => {
    if ((x === 4 || x === 8 || x === 12) && y >= 1) return y % 4 === 0 ? '#498031' : '#71b553';
    if ((x === 5 || x === 9) && y % 5 === 2) return '#59993e';
    return null;
  });

  drawSaplingTile(ctx, TEX.OAK_SAPLING, '#694729', '#387d2b', '#58ab42');
  drawSaplingTile(ctx, TEX.BIRCH_SAPLING, '#dcd9d0', '#548c3e', '#76b856');
  drawSaplingTile(ctx, TEX.SPRUCE_SAPLING, '#402917', '#1d4a30', '#33754e');

  // Dedicated 3D flower part tiles (matte botanical pixel art)
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.FLOWER_STEM,
    (x, y, r) => {
      if (x % 4 === 0) return '#27591d';
      if (y % 5 === 2 && r < 0.35) return '#316e24';
      return r < 0.45 ? '#357828' : r < 0.8 ? '#438c33' : '#539e3f';
    },
    (x, _y, r) => (x % 4 === 0 ? 116 : 128 + r * 14),
  );

  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.FLOWER_LEAF,
    (x, y, r) => {
      const distEdge = Math.min(x, 15 - x, y, 15 - y);
      if (distEdge === 0) return '#26591d';
      if (x === 7 || x === 8 || (y === 7 && distEdge > 2)) return '#5cab44';
      return r < 0.35 ? '#2f6c22' : r < 0.78 ? '#3e852e' : '#4f9c3b';
    },
    (x, _y, r) => (x === 7 || x === 8 ? 142 : 122 + r * 16),
  );

  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.POPPY_PETAL,
    (x, y, r) => {
      const edge = x === 0 || x === 15 || y === 0 || y === 15;
      if (edge) return '#9c1a1a';
      if (y >= 12) return r < 0.5 ? '#871414' : '#9c1a1a';
      if ((x === 7 || x === 8) && y >= 4 && y <= 11) return '#b52222';
      return r < 0.3 ? '#b82121' : r < 0.75 ? '#cf2c2c' : '#de3f3b';
    },
    (_x, y, r) => 122 + (15 - y) * 1.1 + r * 10,
  );

  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.POPPY_CENTER,
    (x, y, r) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 2.5) return '#3d3028';
      if ((x === 7 || y === 7) && d < 6.0) return '#332721';
      return r < 0.45 ? '#1b1412' : r < 0.85 ? '#261d1a' : '#332823';
    },
    (_x, _y, r) => 118 + r * 20,
  );

  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.DANDELION_PETAL,
    (x, y, r) => {
      const edge = x === 0 || x === 15 || y === 0 || y === 15;
      if (edge) return '#c98812';
      if ((x + y) % 5 === 0 && r > 0.4) return '#fae052';
      return r < 0.3 ? '#d99a16' : r < 0.75 ? '#edc02b' : '#f7d33e';
    },
    (_x, _y, r) => 124 + r * 16,
  );

  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.DANDELION_CENTER,
    (x, y, r) => {
      if ((x + y) % 3 === 0 && r > 0.45) return '#f2c335';
      return r < 0.35 ? '#b5700e' : r < 0.75 ? '#cf8815' : '#e09f1f';
    },
    (_x, _y, r) => 120 + r * 20,
  );
}
