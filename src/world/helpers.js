import { COLORS } from './World.js';

// --- noir-era facade detailing ---
const D_BASE = 0x1c232b;      // stone plinth
const D_COURSE = 0x2a323c;    // string course / floor band
const D_GLASS = 0x2b3640;     // night-reflecting glass
const D_FRAME = 0x14191f;     // window frame charcoal
const D_SILL = 0x2c343e;      // window sill ledge
const D_IRON = 0x12151a;      // fire-escape iron
const D_LIT = 0xffd98a;       // warm lit window
const D_LIT2 = 0xfff0c0;

function lcg(seed) {
  return function () {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

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

// full facade: plinth, floor string-courses, wrapped window curtain on all
// four faces, entrance with canopy light, optional awning / fire escape
export function windowWall(r, pal, cx, cy, cz, w, h, d, cols = 3, rows = 2, opts = {}) {
  r.box(pal.wall, cx, cy + h / 2, cz, w, h, d);

  // stone plinth — a couple of courses hugging the base
  for (let yb = 0.45; yb < 1.75 && yb < h - 1.4; yb += 0.9) {
    r.decoBox(D_BASE, cx, yb, cz, w + 0.02, 0.85, d + 0.02);
  }

  // string courses at each floor break + a top frieze band
  for (let i = 1; i <= rows; i++) {
    const f = (i / rows) * h;
    if (f < 1.7 || f > h - 0.15) continue;
    r.decoBox(D_COURSE, cx, cy + f, cz, w * 1.0, 0.16, d * 1.0);
  }
  r.decoBox(pal.trim, cx, cy + h - 0.1, cz, w * 1.0, 0.14, d * 1.0);

  const rand = lcg(Math.floor(cx * 7919 + cz * 104729 + h * 131));

  const pane = (extent, colN, kx, kz, sign, horiz, elev) => {
    const pww = (extent / colN) * 0.6;
    const pwh = (h / rows) * 0.62;
    const lit = rand() < 0.34;
    const off = sign * 0.03;
    r.decoBox(lit ? D_LIT : D_FRAME, kx, elev, kz, pww * 1.18, pwh * 1.18, 0.09, lit ? { emission: 0xffb35a, emissionBias: 1.1 } : {});
    r.decoBox(lit ? D_LIT : D_GLASS, kx, elev, kz + (horiz ? 0 : off), pww * 0.9, pwh * 0.9, horiz ? 0.1 : 0.08, lit ? { emission: 0xffd98a, emissionBias: 1.3 } : {});
    if (lit) {
      r.decoBox(D_LIT2, kx, elev, kz + (horiz ? 0 : off), pww * 0.16, pwh * 0.94, 0.05, { emission: 0xfff0c0, emissionBias: 1.4 });
      r.decoBox(D_LIT2, kx, elev, kz + (horiz ? 0 : off), pww * 0.94, pwh * 0.14, 0.05, { emission: 0xfff0c0, emissionBias: 1.4 });
    } else {
      r.decoBox(D_FRAME, kx, elev, kz + (horiz ? 0 : off), pww * 0.1, pwh * 0.96, 0.03);
    }
    r.decoBox(D_SILL, kx, elev - pwh * 0.6, kz, pww * 1.28, 0.1, 0.18);
  };

  // +/-z long faces
  const cZ = Math.max(1, Math.round(w / 3.4));
  for (const s of [1, -1]) {
    for (let ci = 0; ci < cZ; ci++) {
      for (let ri = 0; ri < rows; ri++) {
        pane(w, cZ, cx - w / 2 + (ci + 0.5) * (w / cZ), cz + s * (d / 2 + 0.04), s, false,
          cy + (rows - ri - 0.5) * (h / rows));
      }
    }
  }
  // +/-x faces (street-facing sides)
  const cX = Math.max(1, Math.round(d / 3.4));
  for (const s of [1, -1]) {
    for (let ci = 0; ci < cX; ci++) {
      for (let ri = 0; ri < rows; ri++) {
        pane(d, cX, cx + s * (w / 2 + 0.04), cz - d / 2 + (ci + 0.5) * (d / cX), s, true,
          cy + (rows - ri - 0.5) * (h / rows));
      }
    }
  }

  // entrance (front +z face)
  if (opts.door !== false && h >= 4.5) {
    const dz = cz + d / 2 + 0.05;
    r.decoBox(0x2a1f1a, cx, 1.55, dz, 1.7, 2.9, 0.12);
    r.decoBox(0x3a2d22, cx, 1.35, dz + 0.07, 1.1, 1.9, 0.1);
    r.decoBox(pal.trim, cx, 3.05, dz, 2.0, 0.2, 0.34);
    r.decoBox(D_SILL, cx, 0.2, dz, 2.1, 0.16, 0.36);
    r.decoBox(D_LIT, cx, 2.92, dz + 0.03, 0.9, 0.12, 0.12, { emission: 0xffc06a, emissionBias: 1.1 });
  }

  // striped shop awning over the entry
  if (opts.awning) {
    const aw = typeof opts.awning === 'number' ? opts.awning : pal.trim;
    const az = cz + d / 2 + 0.02;
    r.decoBox(aw, cx, 3.42, az, 4.2, 0.1, 1.0);
    for (let i = 0; i < 4; i++) {
      r.decoBox(0xe3e9ee, cx - 2.0 + 0.5 + i * 1.0, 3.49, az, 0.92, 0.05, 0.9);
    }
  }

  // rear fire escape ladders
  if (opts.fireEscape) {
    const rz = cz - d / 2 - 0.05;
    const spread = Math.min(w * 0.24, 3.0);
    let y = 1.5;
    while (y < h - 1.2) {
      r.decoBox(D_IRON, cx, y, rz, w * 0.14, 0.12, 0.12);
      r.decoBox(D_IRON, cx - spread, y + 0.05, rz + 0.06, 0.08, 1.05, 0.08);
      r.decoBox(D_IRON, cx + spread, y + 0.05, rz + 0.06, 0.08, 1.05, 0.08);
      r.decoBox(D_IRON, cx, y + 1.05, rz + 0.12, w * 0.3, 0.08, 0.62);
      for (const sx of [-0.6, 0, 0.6]) {
        r.decoBox(D_IRON, cx + sx, y + 1.06, rz + 0.06, 0.05, 0.04, 0.05);
      }
      y += 1.5;
    }
  }
}

// building block with roof ridge, chimney, cornice and full-wrap facade
export function building(r, pal, x, z, w, d, h, opts = {}) {
  // exterior trim under the roof cap
  r.decoBox(pal.trim, x, h - 0.05, z, w * 1.04, 0.16, d * 1.04);
  r.decoBox(D_COURSE, x, h - 0.34, z, w * 1.04, 0.14, d * 1.04);

  const empty = Object.keys(opts).length === 0;
  const opts2 = {
    door: opts.door !== false,
    awning: opts.awning,
    fireEscape: opts.fireEscape,
  };
  windowWall(r, pal, x, 0, z, w, h, d, opts.winCols || 3, opts.winRows || 2, opts2);

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
  return r;
}
export function neon(r, x, y, z, w, d, textHue = 0xff5a4a, opts = {}) {
  const h = opts.h || 1.1;
  const g = opts.glow || textHue;
  r.decoBox(0x0c0f14, x, y, z, w, h, 0.18, { emission: 0x1c222a, emissionBias: 0.5 });
  r.decoBox(textHue, x, y + h / 2 + 0.1, z, w - 0.1, 0.4, 0.2, { emission: g, emissionBias: 1.3 });
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