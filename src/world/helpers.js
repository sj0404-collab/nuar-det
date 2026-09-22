import { COLORS } from './World.js';

// ground slab: top surface at yTop
export function pave(r, pal, x1, x2, z1, z2, yTop = 0) {
  const x = (x1 + x2) / 2, z = (z1 + z2) / 2;
  const w = Math.abs(x2 - x1), d = Math.abs(z2 - z1);
  r.box(pal.main, x, yTop - 0.5, z, w, 1, d);
  return r;
}

// low curb edge along a road — reads as gutter in the painterly style
export function curb(r, pal, x, z, w, d, yTop = 0.22) {
  r.decoBox(0x20262e, x, yTop, z, w, 0.4, d);
  return r;
}

// glowing grate / manhole disc
export function grate(r, color, x, z) {
  r.decoBox(color, x, 0.12, z, 1.5, 0.14, 1.5);
  r.decoBox(0x0c0f14, x, 0.22, z, 0.7, 0.06, 0.2);
  r.decoBox(0x0c0f14, x, 0.22, z, 0.2, 0.06, 0.7);
  return r;
}

// facade wall with framed windows + sills on the +z face
export function windowWall(r, pal, cx, cy, cz, w, h, d, cols = 4, rows = 3) {
  r.box(pal.wall, cx, cy + h / 2, cz, w, h, d);
  // frame band where the wall meets the street
  r.decoBox(pal.trim, cx, cy + 0.18, cz, w * 1.02, 0.3, 0.3);
  r.decoBox(pal.trim, cx, cy + h, cz, w * 1.02, 0.24, 0.3);

  const ww = w / (cols * 2);
  const wh = h / (rows * 2.4);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const wx = cx - w / 2 + (i + 0.5) * (w / cols);
      const wy = cy + (rows - j - 0.5) * (h / rows) + h / rows * 0.1;
      // sill ledge under each window
      r.decoBox(0x232a33, wx, wy - wh * 0.55, cz, ww * 1.12, 0.12, 0.24);
      r.decoBox(0x312a22, wx, wy, cz, ww * 0.9, wh * 0.9, 0.08);
    }
  }
  // lit ones
  const litN = 3 + ((cx * 7 + cz * 13) % 4);
  let seed = cx * 5 + cz * 3;
  for (let i = 0; i < litN; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const ci = seed % cols;
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const ri = seed % rows;
    const ix = cx - w / 2 + (ci + 0.5) * (w / cols);
    const iy = cy + (rows - ri - 0.5) * (h / rows);
    r.decoBox(0xffd98a, ix, iy, cz, (w / (cols * 2)) * 0.72, (h / (rows * 2.4)) * 0.72, 0.16, { emission: 0xffb35a, emissionBias: 1.0 });
    r.decoBox(0xfff0c0, ix, iy, cz - 0.06, (w / (cols * 2)) * 0.3, (h / (rows * 2.4)) * 0.3, 0.3, { emission: 0xffe9b0, emissionBias: 1.2 });
  }
}

// glowing neon sign across a facade; opts: { color, glow, h }
export function neon(r, x, y, z, w, d, textHue = 0xff5a4a, opts = {}) {
  const h = opts.h || 1.1;
  const g = opts.glow || textHue;
  r.decoBox(0x0c0f14, x, y, z, w, h, 0.18, { emission: 0x1c222a, emissionBias: 0.5 });
  r.decoBox(textHue, x, y + h / 2 + 0.1, z, w - 0.1, 0.4, 0.2, { emission: g, emissionBias: 1.3 });
  return r;
}

// building block with roof ridge, chimneys and parapets
export function building(r, pal, x, z, w, d, h, opts = {}) {
  r.box(pal.wall, x, h / 2, z, w, h, d);
  // street-level trim on the two long faces
  r.decoBox(pal.trim, x, 0.22, z, w * 1.02, 0.24, 0.2);
  r.decoBox(pal.trim, x, 0.22, z + d * 0.5, 0.2, 0.24, d * 0.96);
  r.decoBox(pal.trim, x, 0.22, z - d * 0.5, 0.2, 0.24, d * 0.96);

  if (opts.roofSolid) {
    r.oneWay(x, h - 0.15, z, w * 0.92, d * 0.92, pal.roof);
    // parapet ledge around the usable roof
    r.decoBox(pal.roof, x, h + 0.12, z, w * 1.02, 0.26, d * 0.94);
    r.decoBox(pal.roof, x, h + 0.12, z, w * 0.94, 0.26, d * 1.02);
    r.decoBox(pal.trim, x, h + 0.3, z, w * 0.94, 0.1, d * 0.94);
  } else {
    r.decoBox(pal.roof, x, h + 0.1, z, w * 1.04, 0.14, d * 1.04);
    // roof ridge along the long axis
    r.decoBox(pal.trim, x, h + 0.24, z, w * 0.9, 0.16, d * 0.3);
  }

  // chimney
  const chimneySide = (x * 31 + z * 17) % 2 === 0 ? 1 : -1;
  r.decoBox(0x2a313a, x + chimneySide * w * 0.32, h + 0.7, z, 0.7, 1.1, 0.7);
  r.decoBox(0x1c2128, x + chimneySide * w * 0.32, h + 1.25, z, 0.78, 0.16, 0.78);
  if ((x + z) % 3 === 0) {
    // smoking chimney — softly emissive plume box
    r.decoBox(0x3a4450, x + chimneySide * w * 0.32, h + 1.7, z, 0.5, 0.9, 0.5, { emission: 0x55606a, emissionBias: 0.55 });
  }

  if (opts.dormer) r.decoBox(pal.trim, x, h + 0.45, z, w * 0.24, 0.5, d * 0.24);
  if (opts.windows !== false && h > 3) {
    windowWall(r, pal, x, 0, z, w * 0.86, h * 0.8, 0.2, opts.winCols || 3, opts.winRows || 2);
  }
  return r;
}

// canopy stall with jumpable awning + hanging lamp + wares
export function stall(r, pal, x, z, w = 4, d = 3, opts = {}) {
  r.box(pal.wall, x, 0.8, z, w, 1.6, d);
  r.oneWay(x, 1.66, z, w * 0.98, d * 0.98, opts.awning || pal.trim);
  r.decoBox(opts.awning || pal.trim, x, 1.6, z, w, 0.1, d);
  // awning stripes along the top edge
  const stripes = 4;
  for (let i = 0; i < stripes; i++) {
    r.decoBox(0xdfe6ec, x - w / 2 + 0.25 + i * (w / stripes), 1.68, z, w / stripes - 0.06, 0.04, d * 0.7);
  }
  // hanging lantern (emissive)
  r.decoBox(0x1c2128, x, 1.95, z, 0.12, 0.5, 0.12);
  r.decoBox(0xffcf8a, x, 2.2, z, 0.34, 0.3, 0.34, { emission: 0xffb54a });
  // wares
  r.decoBox(0xc27a3e, x - w / 4, 1.5, z, 0.5, 0.4, 0.5);
  r.decoBox(0x7ea0b8, x + w / 5, 1.6, z + 0.3, 0.4, 0.6, 0.4);
  r.decoBox(0x8a5a3a, x - w / 5, 1.35, z - 0.4, 0.7, 0.3, 0.7);
  r.decoBox(0xd4a559, x + w / 7, 1.45, z + 0.15, 0.3, 0.18, 0.3);
  r.decoBox(0xb8533f, x - w / 6, 1.5, z + 0.3, 0.4, 0.32, 0.4);
  return r;
}

// crate staircase
export function crates(r, x, z, n, color = 0x6b4a32) {
  for (let i = 0; i < n; i++) {
    r.box(color, x, i * 0.5 + 0.25, z, 0.55, 0.5, 0.55);
    if (i % 2 === 0) r.decoBox(0x50402a, x, i * 0.5 + 0.25, z, 0.58, 0.06, 0.58);
  }
  return r;
}

// pillar / column with optional capital
export function pillar(r, color, x, z, hy, y0 = 0, rw = 0.5, opts = {}) {
  r.box(color, x, y0 + hy / 2, z, rw, hy, rw);
  if (opts.cap) {
    r.decoBox(opts.cap, x, y0 + hy + 0.2, z, rw * 1.7, 0.26, rw * 1.7);
    r.decoBox(opts.cap, x, y0 + 0.12, z, rw * 1.5, 0.24, rw * 1.5);
    r.decoBox(0x1d2127, x, y0 + hy + 0.34, z, rw * 0.9, 0.28, rw * 0.9);
  }
  return r;
}

export { COLORS };