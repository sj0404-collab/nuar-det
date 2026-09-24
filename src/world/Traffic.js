import * as THREE from 'three';
import { makePainterlyMaterial } from '../render/Painterly.js';

const CAR_COLORS = [0x6d7d86, 0x9c5a43, 0x3f5f6d, 0x8f7a3f, 0x7a5a66, 0x4a6b58];
const WHEEL_MAT = makePainterlyMaterial(0x0a0c10);
const SPOKE_MAT = makePainterlyMaterial(0x2a2520);

// wheel group that can be spun around the axle (world X) for ride animations
function carWheel(x, y, z, r) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 10), WHEEL_MAT);
  m.rotation.x = Math.PI / 2;
  g.add(m);
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.045, r * 1.7, 0.035), SPOKE_MAT);
  g.add(spoke);
  const spoke2 = spoke.clone();
  spoke2.rotation.z = Math.PI / 2;
  g.add(spoke2);
  return g;
}

// noir-era motorcar: running boards, fenders, rounded cabin, spare wheel, lamps
function makeCar(color, taxi) {
  const g = new THREE.Group();
  const bodyMat = makePainterlyMaterial(color, { rimStrength: 0.5 });
  const steel = makePainterlyMaterial(0x161a20, { rimStrength: 0.4 });

  // chassis + hood
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 3.1), bodyMat);
  body.position.y = 0.78;
  g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.46, 1.0), bodyMat);
  hood.position.set(0, 0.78, 1.62);
  g.add(hood);

  // running boards along the sides
  for (const s of [-1, 1]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 1.7), steel);
    board.position.set(s * 0.88, 0.4, 0.15);
    g.add(board);
    const fender = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.14, 1.05), steel);
    fender.position.set(s * 0.84, 0.6, 1.35);
    g.add(fender);
    const fenderR = fender.clone();
    fenderR.position.set(s * 0.84, 0.6, -1.05);
    g.add(fenderR);
  }

  // cabin with roof, windshield and glazed windows
  const cabinMat = makePainterlyMaterial(0x232a33, { rimStrength: 0.45 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.62, 1.35), cabinMat);
  cabin.position.set(0, 1.42, -0.12);
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.09, 1.5), bodyMat);
  roof.position.set(0, 1.78, -0.12);
  g.add(roof);
  const glassMat = makePainterlyMaterial(0x9fc0cd, { emission: 0x3a5560, emissionBias: 0.4 });
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.34, 0.05), glassMat);
  windshield.position.set(0, 1.5, 0.62);
  g.add(windshield);

  // headlamps (emissive) + tail lights
  const headMat = makePainterlyMaterial(0xfff3c0, { emission: 0xffe08a, emissionBias: 1.6 });
  const tailMat = makePainterlyMaterial(0xff5a50, { emission: 0xff3a30, emissionBias: 1.2 });
  for (const s of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.16), headMat);
    lamp.position.set(s * 0.62, 0.74, 2.16);
    g.add(lamp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.08), tailMat);
    tail.position.set(s * 0.62, 0.7, -1.62);
    g.add(tail);
  }

  // spare wheel on the boot
  const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 9), WHEEL_MAT);
  spare.rotation.x = Math.PI / 2;
  spare.position.set(0, 0.86, -1.72);
  g.add(spare);

  // taxi roof sign
  if (taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.3), makePainterlyMaterial(0x10141a));
    sign.position.set(0, 1.88, -0.1);
    g.add(sign);
    const lit = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.22), makePainterlyMaterial(0xffd98a, { emission: 0xffb35a, emissionBias: 1.3 }));
    lit.position.set(0, 1.88, -0.1);
    g.add(lit);
  }

  // wheels (spin-able)
  const wheels = [];
  for (const [wx, wz] of [[-0.84, 1.1], [0.84, 1.1], [-0.84, -1.1], [0.84, -1.1]]) {
    const w = carWheel(wx, 0.34, wz, 0.3);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

// electric tram: glazed windows, trolley pole, warm interior
function makeTram() {
  const g = new THREE.Group();
  const bodyMat = makePainterlyMaterial(0xc8a052, { rimStrength: 0.5 });
  const frameMat = makePainterlyMaterial(0x7a5a2e);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 6.4), frameMat);
  deck.position.y = 0.5;
  g.add(deck);

  for (const sx of [-0.75, 0, 0.75]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 5.6), bodyMat);
    wall.position.set(sx, 1.05, 0);
    g.add(wall);
  }

  // individual warm glazed windows down each side
  const gl = makePainterlyMaterial(0xffe9c0, { emission: 0xffd08a, emissionBias: 1.2 });
  const glDark = makePainterlyMaterial(0x9fc0cd, { emission: 0x3a5560, emissionBias: 0.4 });
  for (let i = 0; i < 5; i++) {
    for (const s of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.9), i % 2 ? gl : glDark);
      win.position.set(s * 1.06, 1.25, -2.5 + i * 1.2);
      g.add(win);
      const winT = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.9), i % 2 ? gl : glDark);
      winT.position.set(s * 0.28, 1.25, -2.5 + i * 1.2);
      g.add(winT);
    }
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.12, 5.8), frameMat);
  roof.position.set(0, 1.62, 0);
  g.add(roof);

  // trolley pole + bow
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6), makePainterlyMaterial(0x14181c));
  pole.position.set(0, 2.5, -2.4);
  pole.rotation.z = 0.5;
  g.add(pole);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 5, 8, Math.PI), makePainterlyMaterial(0x14181c));
  bow.position.set(0.48, 3.4, -2.4);
  bow.rotation.y = Math.PI / 2;
  g.add(bow);

  // headlamp + bell
  const headMat = makePainterlyMaterial(0xfff3c0, { emission: 0xffe08a, emissionBias: 1.6 });
  for (const s of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.12), headMat);
    h.position.set(s, 0.72, 3.24);
    g.add(h);
  }

  const wheels = [];
  for (const [wx, wz] of [[-1.0, 2.6], [1.0, 2.6], [-1.0, -2.6], [1.0, -2.6], [-1.0, 0], [1.0, 0]]) {
    const w = carWheel(wx, 0.34, wz, 0.34);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

// horse-drawn hansom cab: animated horse gait + carriage with lantern
function makeCab() {
  const g = new THREE.Group();
  const wood = makePainterlyMaterial(0x5c3a26, { rimStrength: 0.55 });
  const dark = makePainterlyMaterial(0x1a1e24, { rimStrength: 0.4 });
  const horseCoat = makePainterlyMaterial(0x4a3d33, { rimStrength: 0.5 });
  const mane = makePainterlyMaterial(0x241f1a, { rimStrength: 0.3 });

  // --- carriage (stern of the group) ---
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 2.1), wood);
  floor.position.set(0, 0.98, -0.55);
  g.add(floor);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.0, 1.7), dark);
  cab.position.set(0, 1.72, -1.15);
  g.add(cab);
  const window = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.08),
    makePainterlyMaterial(0xffe9c0, { emission: 0xffd08a, emissionBias: 1.2 }));
  window.position.set(0, 1.95, -0.32);
  g.add(window);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.26, 0.55), wood);
  bench.position.set(0, 1.4, 0.35);
  g.add(bench);
  // driver seat + reins post
  const seatTop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.4), dark);
  seatTop.position.set(0, 1.62, 0.45);
  g.add(seatTop);

  // canopy ribs + cover
  const cover = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 2.0), wood);
  cover.position.set(0, 2.3, -1.05);
  g.add(cover);

  // shafts to the horse
  for (const s of [-1, 1]) {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 2.6), wood);
    shaft.position.set(s * 0.78, 1.05, 0.85);
    g.add(shaft);
  }

  // big carriage wheels (spin-able)
  const wheels = [];
  for (const [wx, wz, r] of [[-0.92, 0.5, 0.5], [0.92, 0.5, 0.5], [-0.92, -1.35, 0.4], [0.92, -1.35, 0.4]]) {
    const w = carWheel(wx, 0.42, wz, r);
    g.add(w);
    wheels.push(w);
  }

  // --- horse (heads toward +z, i.e. direction of travel on dir=+1 routes) ---
  const horse = new THREE.Group();
  horse.position.set(0, 0, 1.55);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 1.35), horseCoat);
  body.position.y = 1.0;
  horse.add(body);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.4), horseCoat);
  chest.position.set(0, 1.05, 0.82);
  horse.add(chest);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 0.3), horseCoat);
  neck.position.set(0, 1.45, 0.55);
  neck.rotation.x = 0.5;
  horse.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.4), horseCoat);
  head.position.set(0, 1.72, 0.88);
  horse.add(head);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.3), mane);
  muzzle.position.set(0, 1.6, 1.05);
  horse.add(muzzle);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 0.7, 5), mane);
  tail.position.set(0, 1.0, -0.7);
  tail.rotation.x = -0.5;
  horse.add(tail);
  const ear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), mane);
  ear.position.set(0, 1.96, 0.86);
  horse.add(ear);

  // animated legs: groups pivoted at the hip
  const legDefs = [[-0.22, 0.62, 0.5], [0.22, 0.62, 0.5], [-0.22, 0.62, -0.45], [0.22, 0.62, -0.45]];
  const legs = [];
  const legGeo = new THREE.BoxGeometry(0.13, 0.72, 0.13);
  for (let i = 0; i < 4; i++) {
    const [lx, ly, lz] = legDefs[i];
    const lg = new THREE.Group();
    lg.position.set(lx, ly, lz);
    const leg = new THREE.Mesh(legGeo, horseCoat);
    leg.position.y = -0.36;
    lg.add(leg);
    const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.2), mane);
    hoof.position.y = -0.72;
    lg.add(hoof);
    horse.add(lg);
    legs.push(lg);
  }

  // blinkers + harness strap
  const blinker = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.38), mane);
  blinker.position.set(0.15, 1.72, 0.88);
  horse.add(blinker);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 2.4), mane);
  strap.position.set(0, 1.12, 0.6);
  horse.add(strap);

  // hanging lantern (emissive)
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22),
    makePainterlyMaterial(0xffcf8a, { emission: 0xffb54a, emissionBias: 1.3 }));
  lamp.position.set(0, 2.1, 0.45);
  g.add(lamp);

  g.add(horse);
  g.userData.wheels = wheels;
  g.userData.legs = legs;
  g.userData.body = body;
  g.userData.head = head;
  g.userData.tail = tail;
  g.userData.cab = true;
  return g;
}

// routes: axis 'z' along world Z at fixed X; axis 'x' along X at fixed Z
const ROUTES = [
  { axis: 'z', fixed: -3.0, min: -58, max: 38, dir: 1, speed: 2.1, rot: 0, cab: true, spawnBoost: 0 },
  { axis: 'z', fixed: 3.4, min: -56, max: 60, dir: -1, speed: 2.9, rot: Math.PI, taxi: true, spawnBoost: 0 },
  { axis: 'z', fixed: -3.4, min: -60, max: 58, dir: 1, speed: 2.4, rot: 0, spawnBoost: 26 },
  { axis: 'z', fixed: 3.1, min: -56, max: 58, dir: 1, speed: 3.1, rot: 0, spawnBoost: -14 },
  { axis: 'z', fixed: -4.3, min: -64, max: 52, dir: -1, speed: 2.2, rot: Math.PI, tram: true, spawnBoost: 10 },
  { axis: 'z', fixed: 3.8, min: -52, max: 62, dir: -1, speed: 2.7, rot: Math.PI, taxi: true, spawnBoost: 30 },
  // market alley (along X)
  { axis: 'x', fixed: 2.2, min: 16, max: 46, dir: 1, speed: 2.6, rot: -Math.PI / 2, spawnBoost: 0 },
  { axis: 'x', fixed: -2.6, min: 14, max: 44, dir: -1, speed: 2.2, rot: Math.PI / 2, spawnBoost: 0 },
  { axis: 'x', fixed: 2.6, min: 48, max: 102, dir: 1, speed: 2.0, rot: -Math.PI / 2, spawnBoost: -20 },
  // harbor road (along Z)
  { axis: 'z', fixed: 180, min: 46, max: 80, dir: 1, speed: 3.0, rot: 0, spawnBoost: 0 },
  { axis: 'z', fixed: 192, min: 44, max: 78, dir: -1, speed: 2.5, rot: Math.PI, taxi: true, spawnBoost: -12 },
];

export function buildTraffic(world) {
  world.traffic = [];
  for (let i = 0; i < ROUTES.length; i++) {
    const rt = ROUTES[i];
    const mesh = rt.cab ? makeCab() : rt.tram ? makeTram() : makeCar(CAR_COLORS[(i * 3 + 1) % CAR_COLORS.length], rt.taxi);
    mesh.rotation.y = rt.rot;
    world.scene.add(mesh);
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
      cab: !!rt.cab, tram: !!rt.tram,
    });
  }
}

export function updateTraffic(traffic, dt, t) {
  for (const c of traffic) {
    const m = c.mesh;
    if (c.playerDriven) {
      // водитель управляет сам: скорость и поворот уже заданы из Game.updateMount
      const sp = c.speed * dt;
      m.position.x += Math.sin(m.rotation.y) * sp;
      m.position.z += Math.cos(m.rotation.y) * sp;
      for (const w of m.userData.wheels || []) {
        w.rotation.x += (c.speed / 0.32) * dt;
      }
      if (c.cab && m.userData.body) {
        const phase = t * 5.2 + c.phase;
        const pair = Math.sin(phase) * 0.45;
        m.userData.legs[0].rotation.z = pair;
        m.userData.legs[3].rotation.z = pair;
        m.userData.legs[1].rotation.z = -pair;
        m.userData.legs[2].rotation.z = -pair;
        m.userData.body.position.y = 1.0 + Math.abs(Math.cos(phase)) * 0.05;
        m.position.y = Math.abs(Math.cos(phase * 0.5)) * 0.03;
      } else {
        m.position.y = Math.sin(t * 0.9 + c.phase) * 0.015;
        m.rotation.z = Math.sin(t * 0.9 + c.phase) * 0.01;
      }
      continue;
    }
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

    // wheels spin with travel speed
    const dirSign = c.axis === 'z' ? c.dir : -c.dir;
    for (const w of m.userData.wheels || []) {
      w.rotation.x += dirSign * (c.speed / 0.32) * dt;
    }

    if (c.cab && m.userData.body) {
      // horse gait: diagonal pairs swing together
      const phase = t * 5.2 + c.phase;
      const legs = m.userData.legs;
      const pair = Math.sin(phase) * 0.45;
      legs[0].rotation.z = pair;
      legs[3].rotation.z = pair;
      legs[1].rotation.z = -pair;
      legs[2].rotation.z = -pair;
      m.userData.body.position.y = 1.0 + Math.abs(Math.cos(phase)) * 0.05;
      m.userData.head.rotation.x = Math.sin(phase * 0.5) * 0.06;
      m.userData.tail.rotation.y = Math.sin(phase * 0.8) * 0.25;
      // harness sway
      for (const w of m.userData.wheels) w.rotation.x += dirSign * (c.speed / 0.45) * dt;
      // gentle ride bounce
      m.position.y = Math.abs(Math.cos(phase * 0.5)) * 0.03;
    } else {
      // motorised body sway feels alive
      m.position.y = Math.sin(t * 0.9 + c.phase) * 0.015;
      m.rotation.z = Math.sin(t * 0.9 + c.phase) * 0.01;
    }
  }
}