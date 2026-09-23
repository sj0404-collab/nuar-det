import * as THREE from 'three';
import { makePainterlyMaterial, flatGeometry, addInkOutline } from '../render/Painterly.js';

// city crowd: sidewalk walkers + little daily-life scenes (pigeons, gulls,
// chimney sweep, newsboy, fishmonger). Purely ambience — no collisions.

const COATS = [0x9c5a43, 0x3f5f6d, 0x6d7d86, 0x8f7a3f, 0x4a6b58, 0x7a5a66, 0x5c6b8a, 0x8a5a3a];
const HATS = ['cap', 'flat', 'beret'];

function citizenFigure(opts) {
  const coat = opts.coat !== undefined ? opts.coat : COATS[Math.floor(Math.random() * COATS.length)];
  const coatMat = makePainterlyMaterial(coat, { rimStrength: 0.5 });
  const skinMat = makePainterlyMaterial(0xf0dcc0, { rimStrength: 0.3 });
  const darkMat = makePainterlyMaterial(0x181b21, { rimStrength: 0.4 });
  const g = new THREE.Group();

  // legs (groups pivot at the hip for walk swing)
  const legGeo = flatGeometry(new THREE.CylinderGeometry(0.07, 0.085, 0.4, 4));
  const legL = new THREE.Group();
  const legLm = new THREE.Mesh(legGeo, darkMat);
  legLm.position.y = -0.2;
  legL.add(legLm);
  legL.position.set(-0.13, 0.5, 0);
  const legR = new THREE.Group();
  const legRm = new THREE.Mesh(legGeo, darkMat);
  legRm.position.y = -0.2;
  legR.add(legRm);
  legR.position.set(0.13, 0.5, 0);
  g.add(legL, legR);

  // torso coat
  const coatGeo = flatGeometry(new THREE.CylinderGeometry(0.19, 0.27, 0.6, 5, 1));
  coatGeo.translate(0, 0.5, 0);
  const body = new THREE.Mesh(coatGeo, coatMat);
  body.position.y = 0.15;
  g.add(body);

  // head + hat
  const head = new THREE.Mesh(flatGeometry(new THREE.SphereGeometry(0.13, 6, 5)), skinMat);
  head.position.y = 0.98;
  const headG = new THREE.Group();
  headG.add(head);
  const hatMat = makePainterlyMaterial(opts.hatColor || 0x242a33, { rimStrength: 0.4 });
  const hatType = opts.hat || HATS[Math.floor(Math.random() * HATS.length)];
  if (hatType === 'beret') {
    const b = new THREE.Mesh(flatGeometry(new THREE.SphereGeometry(0.15, 6, 4).scale(1, 0.45, 1)), hatMat);
    b.position.y = 0.12;
    headG.add(b);
  } else if (hatType === 'flat') {
    const cap = new THREE.Mesh(flatGeometry(new THREE.CylinderGeometry(0.12, 0.14, 0.1, 6)), hatMat);
    cap.position.y = 0.12;
    headG.add(cap);
    const brim = new THREE.Mesh(flatGeometry(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 6)), hatMat);
    brim.position.y = 0.09;
    headG.add(brim);
  } else {
    const brim = new THREE.Mesh(flatGeometry(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 7)), hatMat);
    brim.position.y = 0.12;
    const crown = new THREE.Mesh(flatGeometry(new THREE.CylinderGeometry(0.1, 0.13, 0.14, 6)), hatMat);
    crown.position.y = 0.19;
    headG.add(brim, crown);
  }
  headG.position.y = 0.85;
  g.add(headG);

  // arms
  const armGeo = flatGeometry(new THREE.CylinderGeometry(0.045, 0.055, 0.4, 4));
  const armL = new THREE.Group();
  const armLm = new THREE.Mesh(armGeo, coatMat);
  armLm.position.y = -0.12;
  armL.add(armLm);
  armL.position.set(-0.3, 0.88, 0);
  const armR = new THREE.Group();
  const armRm = new THREE.Mesh(armGeo, coatMat);
  armRm.position.y = -0.12;
  armR.add(armRm);
  armR.position.set(0.3, 0.88, 0);
  g.add(armL, armR);

  const c = { g, legL, legR, armL, armR, headG, body };
  if (opts.outline !== false) {
    addInkOutline(body, { thickness: 0.012, opacity: 0.7 });
    addInkOutline(head, { thickness: 0.011, opacity: 0.7 });
  }
  return c;
}

// waypoint walks — keep to sidewalks/pier edges so walkers never cross traffic lanes
const WALKS = [
  { path: [{ x: 7.5, z: 30 }, { x: 7.5, z: -18 }], speed: 1.6 },
  { path: [{ x: -7.5, z: -18 }, { x: -7.5, z: 30 }], speed: 1.9 },
  { path: [{ x: 7.5, z: -22 }, { x: 7.5, z: 38 }], speed: 1.35 },
  { path: [{ x: -7.5, z: 38 }, { x: -7.5, z: -22 }], speed: 1.75 },
  { path: [{ x: -15, z: 16 }, { x: -15, z: -8 }], speed: 1.5 },
  { path: [{ x: 108, z: -14 }, { x: 146, z: -14 }], speed: 1.6 },
  { path: [{ x: 146, z: 34 }, { x: 108, z: 34 }], speed: 1.4 },
  { path: [{ x: 108, z: 20 }, { x: 146, z: 20 }], speed: 1.8 },
  { path: [{ x: 240, z: 121 }, { x: 206, z: 121 }], speed: 1.45 },
  { path: [{ x: 206, z: 108 }, { x: 206, z: 118 }], speed: 1.3 },
  { path: [{ x: -7.5, z: 34 }, { x: -7.5, z: -20 }], speed: 1.65 },
  { path: [{ x: 15, z: 34 }, { x: 15, z: -18 }], speed: 1.5 },
];

export function buildPedestrians(world) {
  const peds = [];
  for (const w of WALKS) {
    const fig = citizenFigure({ cat: 'walk' });
    const p = w.path[0];
    fig.g.position.set(p.x, 0, p.z);
    world.scene.add(fig.g);
    peds.push({
      fig, wp: w.path, i: 0, dir: 1, speed: w.speed,
      pause: Math.random() * 2.2, pauseT: 0, phase: Math.random() * 6.28,
      activity: null,
    });
  }

  // ---- daily scenes ----
  const props = { pigeons: [], gulls: [], sweep: null, newsboy: null, fish: null };

  // 1) old lady feeding pigeons by the plaza
  const lady = citizenFigure({ coat: 0x8a5a3a, hat: 'beret', hatColor: 0x4a3a33 });
  lady.g.position.set(2.2, 0, 8);
  world.scene.add(lady.g);
  peds.push({ fig: lady, activity: 'feeder', phase: Math.random() * 6.28, speed: 0, wp: null, pause: 0, pauseT: 0, i: 0, dir: 1 });
  const pigeonMat = makePainterlyMaterial(0x7c8590, { rimStrength: 0.45 });
  const beakMat = makePainterlyMaterial(0x4a4f55);
  for (let i = 0; i < 6; i++) {
    const pg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.24), pigeonMat);
    body.position.y = 0.4;
    pg.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), pigeonMat);
    head.position.set(0, 0.5, 0.12);
    pg.add(head);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.06), beakMat);
    beak.position.set(0, 0.5, 0.18);
    pg.add(beak);
    const x = -1.5 + (i % 3) * 2.2 + Math.random() * 0.5;
    const z = 5.5 + Math.floor(i / 3) * 1.8 + Math.random() * 0.5;
    pg.position.set(x, 0, z);
    world.scene.add(pg);
    props.pigeons.push({ g: pg, x, z, phase: Math.random() * 6.28, hop: Math.random() });
  }

  // 2) chimney sweep on a hub roof with a long brush
  const sweep = citizenFigure({ coat: 0x2b2f38, hat: 'cap', hatColor: 0x1a1d24 });
  sweep.g.position.set(26.5, 0, -50.5);
  world.scene.add(sweep.g);
  const brushMat = makePainterlyMaterial(0x4a3018, { rimStrength: 0.5 });
  const bristleMat = makePainterlyMaterial(0x9c7a3a, { rimStrength: 0.4 });
  const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.7, 5), brushMat);
  brush.position.set(0.6, 1.55, 0);
  brush.rotation.z = 0.25;
  sweep.g.add(brush);
  const bristles = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.024, 0.2, 5), bristleMat);
  bristles.position.set(0.6, 2.4, 0);
  brush.rotation.x = -0.6;
  sweep.g.add(bristles);
  peds.push({ fig: sweep, activity: 'sweep', phase: Math.random() * 6.28, speed: 0, wp: null, pause: 0, pauseT: 0, i: 0, dir: 1, extras: { brush, bristles } });
  props.sweep = sweep;

  // 3) newsboy with a paper stand at the market
  const newsboy = citizenFigure({ coat: 0x6d7d86, hat: 'cap', hatColor: 0x2b2f38 });
  newsboy.g.position.set(116, 0, -10);
  newsboy.g.rotation.y = 2.6;
  world.scene.add(newsboy.g);
  const standMat = makePainterlyMaterial(0x5c3a26, { rimStrength: 0.5 });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.4), standMat);
  stand.position.set(0.8, 0.27, 0.3);
  world.scene.add(stand);
  const papers = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.28), makePainterlyMaterial(0xddd3bd, { rimStrength: 0.3 }));
  papers.position.set(0.8, 0.6, 0.3);
  world.scene.add(papers);
  peds.push({ fig: newsboy, activity: 'newsboy', phase: Math.random() * 6.28, speed: 0, wp: null, pause: 0, pauseT: 0, i: 0, dir: 1 });
  props.newsboy = newsboy;

  // 4) fishmonger at the harbor pier with crates + circling gulls
  const fish = citizenFigure({ coat: 0x3f5f6d, hat: 'flat', hatColor: 0x2b3a44 });
  fish.g.position.set(216, 0, 122);
  fish.g.rotation.y = 2.2;
  world.scene.add(fish.g);
  if (world.scene) {
    const crateMat = makePainterlyMaterial(0x6b4a32, { rimStrength: 0.5 });
    const fishMat = makePainterlyMaterial(0x9fc0cd, { rimStrength: 0.4 });
    const lampMat = makePainterlyMaterial(0xffcf8a, { emission: 0xffb54a, emissionBias: 1.3 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.6), crateMat);
    c1.position.set(0.4, 0.25, 0.5);
    world.scene.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), crateMat);
    c2.position.set(0.35, 0.7, 0.45);
    world.scene.add(c2);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.12), fishMat);
      f.position.set(0.35 + i * 0.12, 0.95, 0.45);
      world.scene.add(f);
    }
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.12), lampMat);
    lamp.position.set(0.4, 1.9, 0.5);
    world.scene.add(lamp);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 5), makePainterlyMaterial(0x2a2118));
    pole.position.set(0.4, 1.0, 0.5);
    world.scene.add(pole);
  }
  peds.push({ fig: fish, activity: 'fish', phase: Math.random() * 6.28, speed: 0, wp: null, pause: 0, pauseT: 0, i: 0, dir: 1 });
  props.fish = fish;
  const gullMat = makePainterlyMaterial(0xe8e6da, { rimStrength: 0.4 });
  for (let i = 0; i < 3; i++) {
    const gl = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.34), gullMat);
    b.position.y = 0.4;
    gl.add(b);
    const wl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.08), gullMat);
    wl.position.set(-0.05, 0.4, -0.12);
    gl.add(wl);
    const wr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.08), gullMat);
    wr.position.set(-0.05, 0.4, 0.16);
    gl.add(wr);
    gl.position.set(218, 4, 126);
    world.scene.add(gl);
    props.gulls.push({ g: gl, phase: Math.random() * 6.28, wings: [wl, wr] });
  }

  world.peds = peds;
  world.pedsProps = props;
}

export function updatePedestrians(peds, props, dt, t) {
  for (const p of peds || []) {
    const fig = p.fig;

    // ---------- walkers ----------
    if (p.activity === null) {
      let moving = false;
      if (p.pauseT > 0) {
        p.pauseT -= dt;
      } else {
        const len = p.wp.length;
        let ti = p.i + p.dir;
        if (ti < 0) ti = 0;
        if (ti >= len) ti = len - 1;
        const a = p.wp[p.i], b = p.wp[ti];
        const dx = b.x - a.x, dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.001) { p.i = ti; continue; }
        fig.g.position.x += (dx / dist) * p.speed * dt;
        fig.g.position.z += (dz / dist) * p.speed * dt;
        fig.g.rotation.y = Math.atan2(dx, dz);
        p.phase += dt * p.speed * 3.2;
        moving = true;
        const nx = b.x - fig.g.position.x, nz = b.z - fig.g.position.z;
        if (nx * nx + nz * nz < 0.08) {
          p.i = ti;
          if (p.i <= 0) { p.dir = 1; p.pauseT = 0.6 + Math.random() * 2.2; }
          else if (p.i >= len - 1) { p.dir = -1; p.pauseT = 0.6 + Math.random() * 2.2; }
        }
      }
      fig.legL.rotation.x = moving ? Math.sin(p.phase) * 0.55 : Math.sin(t * 2 + p.phase) * 0.06;
      fig.legR.rotation.x = moving ? -Math.sin(p.phase) * 0.55 : -Math.sin(t * 2 + p.phase) * 0.06;
      fig.armL.rotation.x = moving ? -Math.sin(p.phase) * 0.5 : Math.sin(t * 1.5 + p.phase) * 0.08;
      fig.armR.rotation.x = moving ? Math.sin(p.phase) * 0.5 : -Math.sin(t * 1.5 + p.phase) * 0.08;
      fig.g.position.y = moving ? Math.abs(Math.sin(p.phase)) * 0.04 : Math.sin(t * 1.3 + p.phase) * 0.015;
      continue;
    }

    // ---------- activity figures ----------
    if (p.activity === 'feeder') {
      fig.g.rotation.y = Math.atan2(-1.5, -2) - Math.PI / 2;
      const crouch = 0.12 + Math.max(0, Math.sin(t * 0.8 + p.phase)) * 0.1;
      fig.armR.rotation.x = -0.9 - crouch * 2;
      fig.armL.rotation.x = -0.4;
      fig.g.position.y = Math.sin(t * 1.1 + p.phase) * 0.02;
    } else if (p.activity === 'sweep') {
      const s = p.extras;
      const sweep = 0.35 + Math.sin(t * 0.9 + p.phase) * 0.2;
      s.brush.rotation.z = 0.25 + Math.sin(t * 1.6 + p.phase) * 0.12;
      s.brush.position.y = 1.55 + Math.sin(t * 1.6 + p.phase) * 0.08;
      s.bristles.position.y = 2.4 + Math.sin(t * 1.6 + p.phase) * 0.08;
      fig.armL.rotation.x = sweep;
      fig.armR.rotation.x = -sweep;
      fig.g.position.y = Math.sin(t * 1.2 + p.phase) * 0.03;
    } else if (p.activity === 'newsboy') {
      const wave = Math.sin(t * 1.4 + p.phase);
      fig.armR.rotation.x = -0.6 + wave * 0.35;
      fig.armR.rotation.z = -0.3 + wave * 0.08;
      fig.armL.rotation.x = 0.15;
      fig.g.position.y = Math.sin(t * 1.3 + p.phase) * 0.025;
    } else if (p.activity === 'fish') {
      const rock = Math.sin(t * 1.1 + p.phase) * 0.06;
      fig.body.rotation.z = rock;
      fig.armL.rotation.x = Math.sin(t * 1.1 + p.phase) * 0.3;
      fig.armR.rotation.x = -Math.sin(t * 1.1 + p.phase) * 0.3;
      fig.g.position.y = Math.sin(t * 1.2 + p.phase) * 0.02;
    }
  }

  // pigeons hop-peck
  for (const pg of (props && props.pigeons) || []) {
    const tt = t * 2.2 + pg.phase;
    pg.g.position.y = Math.max(0, Math.sin(tt)) * 0.06;
    if (Math.sin(tt) > 0.96) pg.g.rotation.y = Math.sin(t * 3.1 + pg.phase * 2) * 0.6;
    pg.g.rotation.x = Math.max(0, Math.sin(tt + 1.6)) * 0.5;
    pg.g.position.x = pg.x + Math.sin(t * 0.4 + pg.phase) * 0.25;
    pg.g.position.z = pg.z + Math.cos(t * 0.35 + pg.phase * 1.3) * 0.25;
  }

  // gulls circle
  for (const glide of (props && props.gulls) || []) {
    const a = t * 0.5 + glide.phase;
    const rg = 3.5 + Math.sin(t * 0.3 + glide.phase) * 1.2;
    glide.g.position.x = 218 + Math.cos(a) * rg;
    glide.g.position.z = 127 + Math.sin(a) * rg;
    glide.g.position.y = 4.5 + Math.sin(t * 0.9 + glide.phase) * 0.4;
    glide.g.rotation.y = -a + Math.PI / 2;
    const flap = Math.sin(t * 6 + glide.phase) * 0.5;
    for (const w of glide.wings) w.rotation.z = flap;
  }
}