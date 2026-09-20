export const EPS = 0.001;

export function aabbOverlap(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX &&
         a.minY < b.maxY && a.maxY > b.minY &&
         a.minZ < b.maxZ && a.maxZ > b.minZ;
}

export function aabbPoint(a, p) {
  return p.x >= a.minX && p.x <= a.maxX && p.y >= a.minY && p.y <= a.maxY && p.z >= a.minZ && p.z <= a.maxZ;
}

// Standard sweep: move box by delta, resolve against list of solid boxes.
// Returns { pos, grounded, hitWallL, hitWallR, hitCeiling, hitSlope }
export function moveBox(box, delta, solids, oneWayPlatforms, stepHeight = 0.12) {
  let x = box.x, y = box.y, z = box.z;
  const halfW = box.halfW, halfH = box.halfH, halfD = box.halfD;

  let grounded = false;
  let hitWall = { x: 0, z: 0 };
  let hitCeiling = false;
  let bump = false;

  // Horizontal X
  let dx = delta.x;
  if (dx !== 0) {
    const target = x + dx;
    const nx = target;
    let blocked = false;
    for (const s of solids) {
      if (y + halfH > s.minY && y - halfH < s.maxY &&
          z + halfD > s.minZ && z - halfD < s.maxZ) {
        if (dx > 0 && nx + halfW > s.minX && x + halfW <= s.minX + EPS) {
          x = s.minX - halfW; blocked = true; hitWall.x += 1;
        } else if (dx < 0 && nx - halfW < s.maxX && x - halfW >= s.maxX - EPS) {
          x = s.maxX + halfW; blocked = true; hitWall.x -= 1;
        }
      }
    }
    if (!blocked) x = nx;
  }

  // Horizontal Z
  let dz = delta.z;
  if (dz !== 0) {
    const nz = z + dz;
    let blocked = false;
    for (const s of solids) {
      if (y + halfH > s.minY && y - halfH < s.maxY &&
          x + halfW > s.minX && x - halfW < s.maxX) {
        if (dz > 0 && nz + halfD > s.minZ && z + halfD <= s.minZ + EPS) {
          z = s.minZ - halfD; blocked = true; hitWall.z += 1;
        } else if (dz < 0 && nz - halfD < s.maxZ && z - halfD >= s.maxZ - EPS) {
          z = s.maxZ + halfD; blocked = true; hitWall.z -= 1;
        }
      }
    }
    if (!blocked) z = nz;
  }

  // Snap down (auto step onto small ledges)
  if (!delta.y && dx !== 0 && dz !== 0) {
    const probeY = y - stepHeight - EPS;
    let found = false;
    for (const s of solids) {
      if (probeY - halfH >= s.minY - EPS && probeY - halfH <= s.maxY &&
          x + halfW > s.minX && x - halfW < s.maxX &&
          z + halfD > s.minZ && z - halfD < s.maxZ) { found = true; break; }
    }
    if (!found) {
      y = probeY;
      grounded = true;
    }
  }

  // Vertical
  let dy = delta.y;
  if (dy !== 0) {
    const ny = y + dy;
    let blocked = false;
    for (const s of solids) {
      if (x + halfW > s.minX && x - halfW < s.maxX &&
          z + halfD > s.minZ && z - halfD < s.maxZ) {
        if (dy < 0 && ny - halfH < s.maxY && y - halfH >= s.maxY - EPS) {
          y = s.maxY + halfH; blocked = true; grounded = true;
        } else if (dy > 0 && ny + halfH > s.minY && y + halfH <= s.minY + EPS) {
          y = s.minY - halfH; blocked = true; hitCeiling = true;
        }
      }
    }
    if (!blocked) y = ny;
  }

  // One-way platforms (stand on top while falling, pass through while rising)
  if (delta.y <= 0) {
    for (const p of oneWayPlatforms) {
      if (x + halfW > p.minX && x - halfW < p.maxX &&
          z + halfD > p.minZ && z - halfD < p.maxZ) {
        const prevBottom = (y - halfH) - delta.y;
        const newBottom = y - halfH;
        if (prevBottom <= p.maxY + 0.001 && newBottom >= p.maxY && y - halfH < p.maxY + 0.5) {
          y = p.maxY + halfH;
          grounded = true;
        }
      }
    }
  }

  // If there was horizontal blocking against a wall AND grounded below, mark bump
  if ((hitWall.x !== 0 || hitWall.z !== 0)) bump = true;

  return { pos: { x, y, z }, grounded, hitWall, hitCeiling, bump };
}

export function pointInAABB(px, py, pz, s) {
  return px >= s.minX && px <= s.maxX && py >= s.minY && py <= s.maxY && pz >= s.minZ && pz <= s.maxZ;
}