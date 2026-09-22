import * as THREE from 'three';
import { makePainterlyMaterial } from '../render/Painterly.js';

const CAR_COLORS = [0x6d7d86, 0x9c5a43, 0x3f5f6d, 0x8f7a3f, 0x7a5a66, 0x4a6b58];

function makeCar(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 3.2), makePainterlyMaterial(color, { rimStrength: 0.5 }));
  body.position.y = 0.75;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.7, 1.5), makePainterlyMaterial(0x10141a));
  cabin.position.set(0, 1.35, -0.15);
  g.add(cabin);
  const wheelMat = makePainterlyMaterial(0x0a0c10);
  for (const [wx, wz] of [[-0.85, 1.15], [0.85, 1.15], [-0.85, -1.15], [0.85, -1.15]]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10), wheelMat);
    wh.rotation.x = Math.PI / 2;
    wh.position.set(wx, 0.34, wz);
    g.add(wh);
  }
  const headMat = makePainterlyMaterial(0xfff3c0, { emission: 0xffe08a, emissionBias: 1.6 });
  for (const wx of [-0.55, 0.55]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.1), headMat);
    h.position.set(wx, 0.6, 1.6);
    g.add(h);
  }
  const tailMat = makePainterlyMaterial(0xff5a50, { emission: 0xff3a30, emissionBias: 1.2 });
  for (const wx of [-0.55, 0.55]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), tailMat);
    t.position.set(wx, 0.64, -1.6);
    g.add(t);
  }
  return g;
}

function makeTram() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 6.4), makePainterlyMaterial(0xc8a052, { rimStrength: 0.5 }));
  body.position.y = 0.5;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.0, 5.6), makePainterlyMaterial(0x7a5a2e));
  cabin.position.set(0, 1.05, 0);
  g.add(cabin);
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 5.2), makePainterlyMaterial(0xffe9c0, { emission: 0xffd08a, emissionBias: 1.2 }));
  win.position.set(0, 1.45, 0);
  g.add(win);
  for (const [wx, wz] of [[-1.0, 2.6], [1.0, 2.6], [-1.0, -2.6], [1.0, -2.6], [-1.0, 0], [1.0, 0]]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), makePainterlyMaterial(0x0a0c10));
    wh.rotation.x = Math.PI / 2;
    wh.position.set(wx, 0.34, wz);
    g.add(wh);
  }
  const headMat = makePainterlyMaterial(0xfff3c0, { emission: 0xffe08a, emissionBias: 1.6 });
  for (const wx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.12), headMat);
    h.position.set(wx, 0.7, 3.2);
    g.add(h);
  }
  return g;
}

// routes: axis 'z' = car drives along world Z at fixed X; axis 'x' = drives along X at fixed Z
const ROUTES = [
  { axis: 'z', fixed: -3.0, min: -58, max: 62, dir: 1, speed: 3.4, rot: 0, spawnBoost: 0 },
  { axis: 'z', fixed: 3.4, min: 60, max: -56, dir: -1, speed: 2.9, rot: Math.PI, spawnBoost: 0 },
  { axis: 'z', fixed: -3.4, min: -60, max: 58, dir: 1, speed: 2.4, rot: 0, spawnBoost: 26 },
  { axis: 'z', fixed: 3.1, min: -56, max: 58, dir: 1, speed: 3.1, rot: 0, spawnBoost: -14 },
  { axis: 'z', fixed: -4.3, min: -64, max: 52, dir: -1, speed: 2.2, rot: Math.PI, tram: true, spawnBoost: 10 },
  { axis: 'z', fixed: 3.8, min: 62, max: -52, dir: -1, speed: 2.7, rot: Math.PI, spawnBoost: 30 },
  // market alley (along X)
  { axis: 'x', fixed: 2.2, min: 16, max: 46, dir: 1, speed: 2.6, rot: -Math.PI / 2, spawnBoost: 0 },
  { axis: 'x', fixed: -2.6, min: 44, max: 14, dir: -1, speed: 2.2, rot: Math.PI / 2, spawnBoost: 0 },
  { axis: 'x', fixed: 2.6, min: 48, max: 102, dir: 1, speed: 2.0, rot: -Math.PI / 2, spawnBoost: -20 },
  // harbor road (along Z)
  { axis: 'z', fixed: 180, min: 46, max: 80, dir: 1, speed: 3.0, rot: 0, spawnBoost: 0 },
  { axis: 'z', fixed: 192, min: 78, max: 44, dir: -1, speed: 2.5, rot: Math.PI, spawnBoost: -12 },
];

export function buildTraffic(world) {
  world.traffic = [];
  for (let i = 0; i < ROUTES.length; i++) {
    const rt = ROUTES[i];
    const mesh = rt.tram ? makeTram() : makeCar(CAR_COLORS[(i * 3 + 1) % CAR_COLORS.length]);
    mesh.rotation.y = rt.rot;
    const g = world.scene.add(mesh);
    let start;
    if (rt.axis === 'z') {
      start = rt.dir > 0 ? rt.min + (rt.spawnBoost || 0) : rt.max + (rt.spawnBoost || 0);
    } else {
      start = rt.dir > 0 ? rt.min + (rt.spawnBoost || 0) : rt.max + (rt.spawnBoost || 0);
    }
    if (rt.axis === 'z') mesh.position.set(rt.fixed + (rt.spawnBoost ? Math.sin(i * 7) : 0), 0, start);
    else mesh.position.set(start, 0, rt.fixed);
    world.traffic.push({
      mesh, axis: rt.axis, fixed: rt.fixed, dir: rt.dir, speed: rt.speed,
      min: rt.min, max: rt.max, phase: Math.random() * Math.PI * 2,
    });
  }
}

export function updateTraffic(traffic, dt, t) {
  for (const c of traffic) {
    const m = c.mesh;
    if (c.axis === 'z') {
      let z = m.position.z + c.dir * c.speed * dt;
      if (z > c.max) z = c.min;
      if (z < c.min) z = c.max;
      m.position.set(c.fixed, 0, z);
    } else {
      let x = m.position.x + c.dir * c.speed * dt;
      if (x > c.max) x = c.min;
      if (x < c.min) x = c.max;
      m.position.set(x, 0, c.fixed);
    }
    // gentle body roll to feel alive
    m.rotation.z = Math.sin(t * 0.9 + c.phase) * 0.015;
  }
}