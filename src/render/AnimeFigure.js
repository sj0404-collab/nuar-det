import * as THREE from 'three';
import { makePainterlyMaterial, flatGeometry } from './Painterly.js';

// Anime-style eyes: glossy white sclera + big iris + bright glint.
// group is the parent that already contains the (facing +z) head.
export function buildAnimeEyes(group, { cx = 0, cy = 0, cz = 0.12, dist = 0.115, radius = 0.05, iris = 0x2a7f8f, width = 0.028 } = {}) {
  const whiteMat = makePainterlyMaterial(0xf4f6fa, { rimStrength: 0.15, toon: true });
  const irisMat = makePainterlyMaterial(iris, { toon: true, rimStrength: 0.25 });
  const pupilMat = makePainterlyMaterial(0x14161c, { toon: true });
  const glintMat = makePainterlyMaterial(0xffffff, { emission: 0xffffff, emissionBias: 1.4 });

  for (const s of [-1, 1]) {
    // almond-shaped sclera
    const white = new THREE.Mesh(flatGeometry(new THREE.SphereGeometry(radius, 10, 8)), whiteMat);
    white.scale.set(1, 0.72, 0.5);
    white.position.set(cx + s * dist, cy, cz);
    // big iris disc pushed toward the camera
    const irisMesh = new THREE.Mesh(flatGeometry(new THREE.SphereGeometry(radius * 0.66, 10, 8)), irisMat);
    irisMesh.scale.set(1, 1.15, 0.42);
    irisMesh.position.set(cx + s * dist, cy, cz + radius * 0.5);
    // pupil + highlight
    const pupil = new THREE.Mesh(flatGeometry(new THREE.SphereGeometry(radius * 0.3, 10, 7)), pupilMat);
    pupil.scale.set(1, 1.1, 0.5);
    pupil.position.set(cx + s * dist, cy, cz + radius * 0.72);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.14, 8, 6), glintMat);
    glint.position.set(cx + s * dist - width, cy + radius * 0.16, cz + radius * 0.86);
    const glint2 = glint.clone();
    glint2.scale.set(0.6, 0.6, 0.6);
    glint2.position.set(cx + s * dist + width * 0.8, cy - radius * 0.18, cz + radius * 0.8);
    group.add(white, irisMesh, pupil, glint, glint2);
  }
}

// Anime hair: a shiny cap of hair with fringe and style-specific extras.
export function buildAnimeHair(group, { cx = 0, cy = 0, cz = 0, radius = 0.15, color = 0x2a2118, style = 'spiky', tilt = 0 } = {}) {
  const hairMat = makePainterlyMaterial(color, { rimStrength: 0.35, toon: true });
  const cap = new THREE.Mesh(flatGeometry(new THREE.SphereGeometry(radius * 1.02, 12, 8)), hairMat);
  cap.scale.set(1.06, 0.82, 1.02);
  cap.position.set(cx, cy + radius * 0.22, cz - radius * 0.04);
  cap.rotation.x = tilt;
  group.add(cap);

  // fringe bangs across the forehead
  const bangMat = hairMat;
  const bangY = cy + radius * 0.28;
  for (const [bx, bz, bw] of [[-radius * 0.55, radius * 0.9, radius * 0.42], [0, radius * 0.98, radius * 0.55], [radius * 0.55, radius * 0.88, radius * 0.42]]) {
    const bang = new THREE.Mesh(flatGeometry(new THREE.BoxGeometry(bw, radius * 0.5, radius * 0.22)), bangMat);
    bang.position.set(cx + bx, bangY, cz + bz);
    bang.rotation.x = -0.15;
    group.add(bang);
  }

  if (style === 'spiky') {
    for (let i = 0; i < 4; i++) {
      const tuft = new THREE.Mesh(flatGeometry(new THREE.ConeGeometry(radius * 0.16, radius * 0.55, 8)), hairMat);
      const a = (i / 4) * Math.PI * 2 + 0.4;
      tuft.position.set(cx + Math.cos(a) * radius * 0.5, cy + radius * 0.75, cz + Math.sin(a) * radius * 0.4);
      tuft.rotation.x = Math.PI - Math.sin(a) * 0.5;
      tuft.rotation.z = -Math.cos(a) * 0.45;
      group.add(tuft);
    }
  } else if (style === 'bob') {
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(flatGeometry(new THREE.SphereGeometry(radius * 0.42, 10, 7)), hairMat);
      side.scale.set(0.8, 1.35, 0.8);
      side.position.set(cx + s * radius * 0.85, cy + radius * 0.1, cz - radius * 0.1);
      group.add(side);
      const tail = new THREE.Mesh(flatGeometry(new THREE.ConeGeometry(radius * 0.3, radius * 0.9, 8)), hairMat);
      tail.position.set(cx + s * radius * 0.8, cy - radius * 0.55, cz - radius * 0.15);
      tail.rotation.x = -0.9;
      group.add(tail);
    }
  } else if (style === 'short') {
    const top = new THREE.Mesh(flatGeometry(new THREE.SphereGeometry(radius * 0.72, 10, 7)), hairMat);
    top.scale.set(1, 0.6, 1);
    top.position.set(cx, cy + radius * 0.4, cz);
    group.add(top);
  } else if (style === 'hood') {
    const hood = new THREE.Mesh(flatGeometry(new THREE.ConeGeometry(radius * 1.15, radius * 1.6, 10)), hairMat);
    hood.position.set(cx, cy + radius * 0.5, cz - radius * 0.1);
    hood.rotation.x = 0.15;
    group.add(hood);
  }
}

// Cel-shaded anime mouth (simple triangle smile line).
export function buildAnimeMouth(group, { cx = 0, cy = 0, cz = 0.15, width = 0.045, color = 0x7a3b3b } = {}) {
  const mat = makePainterlyMaterial(color, { toon: true });
  const mouth = new THREE.Mesh(flatGeometry(new THREE.BoxGeometry(width, width * 0.35, 0.02)), mat);
  mouth.position.set(cx, cy, cz);
  group.add(mouth);
}

export function makeToon(color, opts = {}) {
  return makePainterlyMaterial(color, { ...opts, toon: true });
}