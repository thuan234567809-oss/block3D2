import { TEX } from '../data/blockTextures';
import { drawAtlasTile, stoneShade } from './atlasDraw';

function drawPlanksTile(
  ctx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D | null,
  idx: number,
  seamCol: string,
  darkCol: string,
  midCol: string,
  lightCol: string,
): void {
  drawAtlasTile(
    ctx,
    bumpCtx,
    idx,
    (x, y, r) => {
      if (y % 4 === 0) return seamCol;
      if ((y < 4 && x === 10) || (y >= 4 && y < 8 && x === 4) || (y >= 8 && y < 12 && x === 12) || (y >= 12 && x === 6)) {
        return seamCol;
      }
      if (y % 4 === 1) return lightCol;
      return r < 0.3 ? darkCol : r < 0.72 ? midCol : lightCol;
    },
    (x, y, r) => {
      const seam = y % 4 === 0 || (y < 4 && x === 10) || (y >= 4 && y < 8 && x === 4);
      return seam ? 72 : 138 + r * 20;
    },
  );
}

function drawOreTile(
  ctx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D | null,
  idx: number,
  baseCol: string,
  hiCol: string,
  darkRim: string,
): void {
  drawAtlasTile(
    ctx,
    bumpCtx,
    idx,
    (x, y, r) => {
      const cluster =
        (x >= 2 && x <= 5 && y >= 3 && y <= 5) ||
        (x >= 10 && x <= 13 && y >= 3 && y <= 6) ||
        (x >= 4 && x <= 7 && y >= 9 && y <= 12) ||
        (x >= 10 && x <= 13 && y >= 10 && y <= 13);
      if (cluster && r > 0.25) {
        if (r > 0.78) return hiCol;
        if (r < 0.4) return darkRim;
        return baseCol;
      }
      return stoneShade(r);
    },
    (x, y, r) => {
      const cluster =
        (x >= 2 && x <= 5 && y >= 3 && y <= 5) ||
        (x >= 10 && x <= 13 && y >= 3 && y <= 6) ||
        (x >= 4 && x <= 7 && y >= 9 && y <= 12);
      return cluster && r > 0.25 ? 172 : 120 + r * 18;
    },
  );
}

export function drawCraftedTiles(
  ctx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D | null,
): void {
  // Planks (6 species)
  drawPlanksTile(ctx, bumpCtx, TEX.OAK_PLANKS, '#6e4923', '#9e703c', '#b5844c', '#c7975d');
  drawPlanksTile(ctx, bumpCtx, TEX.BIRCH_PLANKS, '#9c8a56', '#c2af76', '#d4c087', '#e3d099');
  drawPlanksTile(ctx, bumpCtx, TEX.SPRUCE_PLANKS, '#3d2814', '#634427', '#785534', '#8c6642');
  drawPlanksTile(ctx, bumpCtx, TEX.JUNGLE_PLANKS, '#634128', '#8f6242', '#a87754', '#ba8966');
  drawPlanksTile(ctx, bumpCtx, TEX.ACACIA_PLANKS, '#70381c', '#9e4f28', '#b86238', '#cc7347');
  drawPlanksTile(ctx, bumpCtx, TEX.DARK_OAK_PLANKS, '#241508', '#3d2612', '#4c321b', '#5c3f24');

  // Ores (6 types)
  drawOreTile(ctx, bumpCtx, TEX.COAL_ORE, '#22252b', '#3e424a', '#131518');
  drawOreTile(ctx, bumpCtx, TEX.COPPER_ORE, '#d47444', '#56b59d', '#9e4b26');
  drawOreTile(ctx, bumpCtx, TEX.IRON_ORE, '#c99d7a', '#edd0b7', '#946c50');
  drawOreTile(ctx, bumpCtx, TEX.GOLD_ORE, '#e8b32c', '#f7e583', '#ab7815');
  drawOreTile(ctx, bumpCtx, TEX.DIAMOND_ORE, '#2cd9d3', '#a6fffc', '#189aa1');
  drawOreTile(ctx, bumpCtx, TEX.EMERALD_ORE, '#1fd160', '#9effbe', '#12853c');

  // Bricks, Glass, Wool, White Concrete, Terracotta
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.BRICK,
    (x, y, r) => {
      const mortar = y % 4 === 0 || (Math.floor(y / 4) % 2 === 0 ? x % 8 === 0 : (x + 4) % 8 === 0);
      if (mortar) return '#c9c2ba';
      if (y % 4 === 1) return '#b5584a';
      return r < 0.35 ? '#87382c' : r < 0.78 ? '#a1473b' : '#b05445';
    },
    (x, y) => (y % 4 === 0 || x % 8 === 0 ? 74 : 152),
  );

  drawAtlasTile(ctx, bumpCtx, TEX.GLASS, (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return 'rgba(176, 226, 245, 0.94)';
    if ((x === 3 && y === 3) || (x === 4 && y === 4) || (x === 11 && y === 11) || (x === 12 && y === 10)) {
      return 'rgba(255, 255, 255, 0.9)';
    }
    return 'rgba(205, 242, 255, 0.16)';
  });

  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.WOOL,
    (_x, _y, r) => (r < 0.35 ? '#dfe3ea' : r < 0.75 ? '#eceff4' : '#f7f8fa'),
    (_x, _y, r) => 116 + r * 28,
  );
  drawAtlasTile(ctx, bumpCtx, TEX.WHITE_CONCRETE, (_x, _y, r) =>
    r < 0.4 ? '#d9dfe6' : r < 0.8 ? '#e5eaef' : '#edf1f5',
  );
  drawAtlasTile(ctx, bumpCtx, TEX.TERRACOTTA, (_x, _y, r) =>
    r < 0.3 ? '#874b36' : r < 0.75 ? '#9e5d45' : '#ad6b52',
  );

  // Crafting Table: Top (3x3 grid), Front (grid panel + saw), Side (hammer + tongs)
  drawAtlasTile(ctx, bumpCtx, TEX.CRAFTING_TOP, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#59391b';
    if (x === 1 || y === 1 || x === 14 || y === 14) return '#754e28';
    if ((x === 5 || x === 10) && y >= 2 && y <= 13) return '#3b2410';
    if ((y === 5 || y === 10) && x >= 2 && x <= 13) return '#3b2410';
    return r < 0.5 ? '#ba854d' : '#a8743e';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.CRAFTING_FRONT, (x, y, r) => {
    if (y <= 2) return x % 5 === 0 ? '#3d2611' : '#9c6c39';
    if (x === 0 || x === 15 || y === 15) return '#59391b';
    // Hanging saw blade + wood handle
    if (x >= 3 && x <= 5 && y >= 5 && y <= 6) return '#663c1b';
    if (x >= 4 && x <= 6 && y >= 7 && y <= 12) return '#b6bec9';
    // Carpenter square on right
    if ((x === 11 && y >= 5 && y <= 12) || (y === 5 && x >= 9 && x <= 12)) return '#6e7682';
    return r < 0.5 ? '#af7b45' : '#996836';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.CRAFTING_SIDE, (x, y, r) => {
    if (y <= 2) return '#9c6c39';
    if (x === 0 || x === 15 || y === 15) return '#59391b';
    // Hammer & pliers silhouette
    if ((x >= 4 && x <= 7 && y === 6) || (x === 5 && y >= 7 && y <= 12)) return x >= 4 && y === 6 ? '#767e8a' : '#633c1b';
    if ((x === 10 || x === 12) && y >= 6 && y <= 12) return '#5c6470';
    return r < 0.5 ? '#ae7943' : '#966634';
  });

  // Furnace: Front (hearth + fire grate), Side (stone masonry frame), Back (solid cobble back), Top (cap)
  drawAtlasTile(ctx, bumpCtx, TEX.FURNACE_TOP, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#4b4e54';
    return (x + y) % 7 === 0 ? '#5c6066' : r < 0.5 ? '#666a70' : '#73777e';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.FURNACE_FRONT, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#484b52';
    // Top coal slot
    if (x >= 4 && x <= 11 && y >= 4 && y <= 7) return x === 4 || x === 11 ? '#292c30' : '#181a1d';
    // Bottom firebox arch with warm glowing ember grate
    if (x >= 4 && x <= 11 && y >= 10 && y <= 14) {
      if (y === 10 || x === 4 || x === 11) return '#27292e';
      return (x + y) % 2 === 0 ? '#ef8e24' : '#d94816';
    }
    if (y === 8 || y === 9) return '#5b6069';
    return stoneShade(r);
  }, (x, y, r) => (x >= 4 && x <= 11 && ((y >= 4 && y <= 7) || (y >= 10 && y <= 14)) ? 60 : 132 + r * 18));

  drawAtlasTile(ctx, bumpCtx, TEX.FURNACE_SIDE, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#4a4e54';
    if (y === 5 || y === 10) return '#575b63';
    if ((y < 5 && x === 8) || (y >= 5 && y < 10 && (x === 4 || x === 12)) || (y >= 10 && x === 7)) return '#575b63';
    return stoneShade(r);
  });
  drawAtlasTile(ctx, bumpCtx, TEX.FURNACE_BACK, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#484b52';
    if (y === 8 || x === 8) return '#5c6068';
    return stoneShade(r);
  });

  drawAtlasTile(ctx, null, TEX.TORCH, (x, y) => {
    if (x >= 7 && x <= 8 && y >= 6 && y <= 15) return '#78522b';
    if (x >= 6 && x <= 9 && y >= 2 && y <= 5) return y <= 3 ? '#fff394' : '#ff9f24';
    return null;
  });

  // Chest: Top (wood lid + frame), Front (clasp latch), Side (no latch!)
  drawAtlasTile(ctx, bumpCtx, TEX.CHEST_TOP, (x, y, r) => {
    if (x <= 1 || y <= 1 || x >= 14 || y >= 14) return '#4e3116';
    if (x === 2 || y === 2 || x === 13 || y === 13) return '#7a5026';
    return r < 0.5 ? '#b37a3b' : '#9e682e';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.CHEST_FRONT, (x, y, r) => {
    if (x <= 1 || y <= 1 || x >= 14 || y >= 14) return '#4e3116';
    if (y === 5) return '#331f0d';
    if (x >= 6 && x <= 9 && y >= 4 && y <= 8) return y === 7 && x >= 7 && x <= 8 ? '#3e424a' : '#dce1ea';
    return r < 0.5 ? '#b37a3b' : '#9c652c';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.CHEST_SIDE, (x, y, r) => {
    if (x <= 1 || y <= 1 || x >= 14 || y >= 14) return '#4e3116';
    if (y === 5) return '#331f0d';
    return r < 0.5 ? '#b37a3b' : '#9c652c';
  });

  // Barrel
  drawAtlasTile(ctx, bumpCtx, TEX.BARREL_TOP, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#4f3318';
    if (x === 5 || x === 10) return '#593b1d';
    if (x === 12 && y >= 6 && y <= 9) return '#3d4147';
    return r < 0.5 ? '#966736' : '#805529';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.BARREL_BOTTOM, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#452b13';
    if (y === 5 || y === 10) return '#54381b';
    return r < 0.5 ? '#875b2d' : '#734b22';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.BARREL_SIDE, (x, y, r) => {
    if (y === 3 || y === 12) return '#4a4e56';
    if (x % 4 === 0) return '#5c3c1d';
    return r < 0.5 ? '#966736' : '#805529';
  });

  drawAtlasTile(ctx, bumpCtx, TEX.DOOR_WOOD, (x, y, r) => {
    if (x <= 1 || x >= 14 || y === 0 || y === 15) return '#59391b';
    if (x >= 11 && x <= 12 && y >= 7 && y <= 9) return '#f0cc54';
    return r < 0.5 ? '#ab773f' : '#966531';
  });

  // Legacy + Dedicated 3D Bed Part Textures
  drawAtlasTile(ctx, bumpCtx, TEX.BED_TOP, (x, y, r) => {
    if (y < 5) return r < 0.5 ? '#ebeef2' : '#dce0e6';
    return r < 0.5 ? '#c43535' : '#ab2a2a';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.BED_SIDE, (_x, y, r) => {
    if (y < 6) return r < 0.5 ? '#c43535' : '#ab2a2a';
    if (y < 10) return '#946434';
    return '#5c3c1d';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.BED_WOOD, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#543518';
    if (y % 4 === 0) return '#6e4722';
    return r < 0.5 ? '#9c6936' : '#875728';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.BED_MATTRESS, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#cfc8bc';
    if ((x + y) % 6 === 0) return '#dfd9ce';
    return r < 0.5 ? '#ebe6dc' : '#f5f1e9';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.BED_BLANKET, (x, y, r) => {
    if (x === 0 || x === 15 || y === 15) return '#8c1f1f';
    if ((x + y) % 4 === 0) return '#b02929';
    return r < 0.5 ? '#c73434' : '#b82c2c';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.BED_BLANKET_TRIM, (_x, y, r) => {
    if (y === 15) return '#b5aeb0';
    return r < 0.5 ? '#e6e1d8' : '#f2eee6';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.BED_PILLOW, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#c8c3ba';
    if (y === 1 || x === 1) return '#ffffff';
    return r < 0.5 ? '#f2efe9' : '#e6e2da';
  });

  // Anvil
  drawAtlasTile(ctx, bumpCtx, TEX.ANVIL_TOP, (x, y, r) => {
    if (x <= 1 || y <= 1 || x >= 14 || y >= 14) return '#27292e';
    return r < 0.5 ? '#4c5058' : '#3d4148';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.ANVIL_SIDE, (_x, y, r) => {
    if (y < 5) return r < 0.5 ? '#4c5058' : '#3d4148';
    if (y < 11) return '#2a2c30';
    return r < 0.5 ? '#454850' : '#35383e';
  });
}
