import { COLORS } from './World.js';

// ground slab: top surface at yTop
export function pave(r, pal, x1, x2, z1, z2, yTop = 0) {
  const x = (x1 + x2) / 2, z = (z1 + z2) / 2;
  const w = Math.abs(x2 - x1), d = Math.abs(z2 - z1);
  r.box(pal.main, x, yTop - 0.5, z, w, 1, d);
  return r;
}

// facade wall with glowing windows on +z face
export function windowWall(r, pal, cx, cy, cz, w, h, d, cols = 4, rows = 3) {
  r.box(pal.wall, cx, cy + h / 2, cz, w, h, d);
  const ww = w / (cols * 2);
  const wh = h / (rows * 2.4);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const wx = cx - w / 2 + (i + 0.5) * (w / cols);
      const wy = cy + (rows - j - 0.5) * (h / rows) + h / rows * 0.1;
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
    r.decoBox(0xffd98a, ix, iy, cz, (w / (cols * 2)) * 0.7, (h / (rows * 2.4)) * 0.7, 0.16);
  }
}

// simple building block
export function building(r, pal, x, z, w, d, h, opts = {}) {
  r.box(pal.wall, x, h / 2, z, w, h, d);
  if (opts.roofSolid) r.oneWay(x, h - 0.15, z, w * 0.92, d * 0.92, pal.roof);
  else r.decoBox(pal.roof, x, h + 0.1, z, w * 1.04, 0.14, d * 1.04);
  if (opts.dormer) r.decoBox(pal.trim, x, h + 0.45, z, w * 0.24, 0.5, d * 0.24);
  if (opts.windows !== false && h > 3) {
    windowWall(r, pal, x, 0, z, w * 0.86, h * 0.8, 0.2, opts.winCols || 3, opts.winRows || 2);
  }
  return r;
}

// canopy stall with jumpable awning
export function stall(r, pal, x, z, w = 4, d = 3, opts = {}) {
  r.box(pal.wall, x, 0.8, z, w, 1.6, d);
  r.oneWay(x, 1.66, z, w * 0.98, d * 0.98, opts.awning || pal.trim);
  r.decoBox(opts.awning || pal.trim, x, 1.6, z, w, 0.1, d);
  r.decoBox(0xc27a3e, x - w / 4, 1.5, z, 0.5, 0.4, 0.5);
  r.decoBox(0x7ea0b8, x + w / 5, 1.6, z + 0.3, 0.4, 0.6, 0.4);
  r.decoBox(0x8a5a3a, x - w / 5, 1.35, z - 0.4, 0.7, 0.3, 0.7);
  return r;
}

// crate staircase
export function crates(r, x, z, n, color = 0x6b4a32) {
  for (let i = 0; i < n; i++) {
    r.box(color, x, i * 0.5 + 0.25, z, 0.55, 0.5, 0.55);
  }
  return r;
}

// pillar / column
export function pillar(r, color, x, z, hy, y0 = 0, rw = 0.5, opts = {}) {
  r.box(color, x, y0 + hy / 2, z, rw, hy, rw);
  if (opts.cap) r.decoBox(opts.cap, x, y0 + hy + 0.2, z, rw * 1.7, 0.26, rw * 1.7);
  return r;
}

export { COLORS };