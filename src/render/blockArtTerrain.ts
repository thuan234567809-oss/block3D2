import { TEX } from '../data/blockTextures';
import { dirtShade, drawAtlasTile, stoneShade } from './atlasDraw';

function smoothCluster(x: number, y: number, seed: number): number {
  const cx = Math.floor(x / 2);
  const cy = Math.floor(y / 2);
  const n = Math.imul(cx + seed * 17, 374761393) + Math.imul(cy + seed * 31, 668265263);
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
}

export function drawTerrainTiles(
  ctx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D | null,
): void {
  // Grass Top - cohesive lush turf clusters with soft blade highlights (low visual noise)
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.GRASS_TOP,
    (x, y, r) => {
      const patch = smoothCluster(x, y, 11);
      const blade = (x * 5 + y * 3) % 13 === 0 && r > 0.45;
      if (blade) return '#67b54a';
      const tone = patch * 0.65 + r * 0.35;
      if (tone < 0.24) return '#438930';
      if (tone < 0.56) return '#4f9a39';
      if (tone < 0.84) return '#5aa842';
      return '#65b44b';
    },
    (x, y, r) => 118 + smoothCluster(x, y, 11) * 20 + r * 14,
  );

  // Grass Side - clean overhanging grass fringe + subtle rim shadow + cohesive dirt
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.GRASS_SIDE,
    (x, y, r) => {
      const lipPattern = [3, 4, 4, 3, 2, 3, 4, 3, 3, 4, 5, 4, 3, 2, 3, 4];
      const lip = lipPattern[x % 16];
      if (y === 0) return r < 0.5 ? '#55a23e' : '#61ad47';
      if (y < lip) return r < 0.35 ? '#468c32' : '#55a23e';
      if (y === lip) return '#356d26';
      if (y === lip + 1 && r < 0.5) return '#52361e';
      const patch = smoothCluster(x, y, 23);
      return dirtShade(patch * 0.6 + r * 0.4);
    },
    (x, y, r) => (y < 4 ? 142 : 112 + r * 20),
  );

  // Dirt - balanced organic soil clods without harsh speckles
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.DIRT,
    (x, y, r) => {
      const clod = smoothCluster(x, y, 31);
      if ((x * 3 + y * 5) % 23 === 0 && r > 0.7) return '#595550';
      return dirtShade(clod * 0.62 + r * 0.38);
    },
    (x, y, r) => 110 + smoothCluster(x, y, 31) * 26 + r * 14,
  );

  // Stone - subtle horizontal strata bands, minimal grid repetition
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.STONE,
    (x, y, r) => {
      const patch = smoothCluster(x, y, 47);
      const strata = (y === 4 || y === 11) && ((x + y * 3) % 9 < 5);
      if (strata) return '#666b73';
      const highlight = (y === 5 || y === 12) && ((x + y * 2) % 11 < 3) && r > 0.4;
      if (highlight) return '#9197a0';
      return stoneShade(patch * 0.68 + r * 0.32);
    },
    (x, y, r) => ((y === 4 || y === 11) && (x + y * 3) % 9 < 5 ? 96 : 124 + r * 18),
  );

  // Cobblestone - bevelled masonry stones with subtle recessed mortar
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.COBBLESTONE,
    (x, y, r) => {
      const mortar =
        x === 0 ||
        y === 0 ||
        (y === 5 && x < 10) ||
        (y === 10 && x >= 5) ||
        (y === 13 && x < 8) ||
        (x === 6 && y < 5) ||
        (x === 10 && y < 10) ||
        (x === 5 && y >= 5 && y < 13) ||
        (x === 12 && y >= 10);
      if (mortar) return '#454950';
      const topHighlight = y === 1 || y === 6 || y === 11 || x === 1;
      if (topHighlight && r > 0.4) return '#9399a3';
      return r < 0.3 ? '#656a73' : r < 0.72 ? '#787d86' : '#858b94';
    },
    (x, y, r) => {
      const mortar =
        x === 0 || y === 0 || (y === 5 && x < 10) || (y === 10 && x >= 5) || (x === 6 && y < 5) || (x === 10 && y < 10);
      return mortar ? 62 : 142 + r * 30;
    },
  );

  // Gravel - rounded multi-tone river pebbles
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.GRAVEL,
    (x, y, r) => {
      const cell = ((Math.floor(x / 3) * 7 + Math.floor(y / 3) * 13) % 5) / 5;
      const edge = x % 3 === 0 || y % 3 === 0;
      if (edge && r < 0.5) return '#5e5a59';
      const tone = (cell + r) * 0.5;
      if (tone < 0.28) return '#6b6766';
      if (tone < 0.56) return '#7f7c7a';
      if (tone < 0.82) return '#938e8b';
      return '#a5a09b';
    },
    (x, y, r) => (x % 3 === 0 || y % 3 === 0 ? 84 : 136 + r * 32),
  );

  // Sand - soft natural warm dune ripples (low contrast jitter)
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.SAND,
    (x, y, r) => {
      const patch = smoothCluster(x, y, 71);
      const ripple = Math.sin((x + y * 0.6) * 0.65) > 0.65;
      if (ripple && r > 0.45) return '#eadba4';
      const t = patch * 0.65 + r * 0.35;
      if (t < 0.25) return '#d0ba7a';
      if (t < 0.65) return '#decb8d';
      return '#e6d69c';
    },
    (_x, _y, r) => 120 + r * 14,
  );

  // Sandstone
  drawAtlasTile(ctx, bumpCtx, TEX.SANDSTONE_TOP, (x, y, r) => {
    const t = smoothCluster(x, y, 79) * 0.6 + r * 0.4;
    return t < 0.3 ? '#ccb572' : t < 0.75 ? '#dcc684' : '#e6d395';
  });
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.SANDSTONE_SIDE,
    (_x, y, r) => {
      if (y === 3 || y === 9 || y === 13) return '#b69d5c';
      if (y === 4 || y === 10) return '#e8d493';
      return r < 0.45 ? '#d4bd79' : '#dec986';
    },
    (_x, y, r) => (y === 3 || y === 9 || y === 13 ? 88 : 134 + r * 16),
  );

  // Clay & Mud
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.CLAY,
    (x, y, r) => {
      const t = smoothCluster(x, y, 83) * 0.6 + r * 0.4;
      if ((x + y) % 9 === 0 && r > 0.6) return '#acb6c4';
      return t < 0.35 ? '#8893a3' : t < 0.75 ? '#98a3b3' : '#a3aebf';
    },
    (_x, _y, r) => 118 + r * 16,
  );
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.MUD,
    (x, y, r) => {
      const t = smoothCluster(x, y, 89) * 0.6 + r * 0.4;
      if ((x * 2 + y) % 11 === 0 && r > 0.55) return '#312824';
      return t < 0.35 ? '#3e3430' : t < 0.75 ? '#4b403b' : '#574a44';
    },
    (_x, _y, r) => 112 + r * 22,
  );

  // Snow & Ice
  drawAtlasTile(ctx, bumpCtx, TEX.SNOW, (x, y, r) => {
    const t = smoothCluster(x, y, 97) * 0.65 + r * 0.35;
    if ((x + y * 3) % 13 === 0 && r > 0.75) return '#d8e7f6';
    return t < 0.3 ? '#e4effa' : t < 0.75 ? '#eff6fd' : '#f8fbff';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.ICE, (x, y, r) => {
    if (x === y || x === y + 1 || (x === 14 - y && y > 3 && y < 12)) return 'rgba(224, 245, 255, 0.9)';
    return r < 0.5 ? 'rgba(122, 198, 245, 0.82)' : 'rgba(148, 214, 252, 0.82)';
  });

  // Swamp & Snow Grass Sides
  drawAtlasTile(ctx, bumpCtx, TEX.SWAMP_GRASS_TOP, (x, y, r) => {
    const t = smoothCluster(x, y, 103) * 0.6 + r * 0.4;
    return t < 0.3 ? '#416332' : t < 0.7 ? '#4f733d' : '#5c8248';
  });
  drawAtlasTile(ctx, bumpCtx, TEX.SWAMP_GRASS_SIDE, (x, y, r) =>
    y < 3 + (x % 3) ? (r < 0.5 ? '#486b37' : '#557a43') : dirtShade(smoothCluster(x, y, 107) * 0.6 + r * 0.4),
  );
  drawAtlasTile(ctx, bumpCtx, TEX.SNOW_GRASS_SIDE, (x, y, r) => {
    const lip = 3 + ((x * 3) % 3);
    if (y < lip) return r < 0.4 ? '#e2eef9' : '#f2f8ff';
    if (y === lip) return '#bfd5eb';
    return dirtShade(smoothCluster(x, y, 109) * 0.6 + r * 0.4);
  });

  // Bedrock
  drawAtlasTile(
    ctx,
    bumpCtx,
    TEX.BEDROCK,
    (x, y, r) => {
      const t = smoothCluster(x, y, 113) * 0.55 + r * 0.45;
      return t < 0.3 ? '#1e2025' : t < 0.65 ? '#33373f' : '#4b505a';
    },
    (_x, _y, r) => 85 + r * 75,
  );

  // Water
  drawAtlasTile(ctx, bumpCtx, TEX.WATER, (x, y, r) => {
    const crest = Math.sin((x + y) * 0.55) > 0.55;
    if (crest) return 'rgba(92, 184, 255, 0.84)';
    return r < 0.5 ? 'rgba(42, 134, 218, 0.82)' : 'rgba(56, 154, 236, 0.82)';
  });
}
