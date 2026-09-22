import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makePainterlyMaterial } from '../render/Painterly.js';
import { buildLayoutFrom } from './layout.js';
import { buildTraffic, updateTraffic } from './Traffic.js';

export const COLORS = {
  street: 0x3f4b57, floor: 0x2a323c, rooftop: 0x343c48,
  brick: 0x764a41, brickDark: 0x5a3630, redTrim: 0x8f4b3f,
  teal: 0x3a5a5c, tealDark: 0x2c4648,
  gold: 0xd4a559, goldDark: 0x8f6a2e,
  ivory: 0xe9dcc0, fog: 0x9fb2c4, mist: 0x7c8ea3,
  ember: 0xc27a3e, blood: 0xb0342e,
  lamp: 0xffcf8a,
};

export const PALETTES = {
  street: { main: COLORS.street, roof: COLORS.rooftop, wall: COLORS.brickDark, trim: COLORS.ivory },
  market: { main: COLORS.brick, roof: COLORS.brickDark, wall: COLORS.street, trim: COLORS.gold },
  cistern: { main: COLORS.teal, roof: COLORS.tealDark, wall: 0x1d2b30, trim: 0x7ee0c8 },
  tower: { main: COLORS.brick, roof: COLORS.brickDark, wall: 0x4a3330, trim: COLORS.gold },
  rookery: { main: COLORS.rooftop, roof: 0x232a33, wall: 0x39434f, trim: COLORS.fog },
  harbor: { main: COLORS.tealDark, roof: COLORS.street, wall: 0x24404a, trim: COLORS.fog },
  mausoleum: { main: 0x2a2533, roof: 0x1c1826, wall: 0x241f2d, trim: COLORS.gold },
  alley: { main: COLORS.street, roof: COLORS.rooftop, wall: COLORS.brick, trim: COLORS.fog },
};

class Room {
  constructor(world, id, label, palette, cx, cz) {
    this.w = world;
    this.id = id;
    this.label = label;
    this.pal = palette;
    this.cx = cx;
    this.cz = cz;
    this.boxes = [];
    this.oneWays = [];
    this.painted = new Map(); // key: color hex -> geometry array
    this.outerOpts = new Map(); // key: color hex -> material opts
    this.loaded = false;
  }

  paint(color, geo, opts = {}) {
    const key = color.toString(16);
    if (!this.painted.has(key)) this.painted.set(key, []);
    this.painted.get(key).push(geo);
    if (opts.emission && !this.outerOpts.has(key)) {
      this.outerOpts.set(key, opts);
    }
  }

  // solid box (merged geometry for performance)
  box(color, x, y, z, w, h, d, opts = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    this.paint(color, g);
    if (opts.solid !== false) {
      this.boxes.push({
        minX: x - w / 2, maxX: x + w / 2,
        minY: y - h / 2, maxY: y + h / 2,
        minZ: z - d / 2, maxZ: z + d / 2,
      });
    }
    return this;
  }

  // visual-only box (no collision), merged into room batches via paint
  decoBox(color, x, y, z, w, h, d, opts = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    this.paint(color, g, opts);
    return this;
  }

  oneWay(x, y, z, w, d, color) {
    const g = new THREE.BoxGeometry(w, 0.25, d);
    g.translate(x, y, z);
    this.paint(color, g);
    this.oneWays.push({
      minX: x - w / 2, maxX: x + w / 2,
      minY: y - 0.2, maxY: y + 0.2,
      minZ: z - d / 2, maxZ: z + d / 2,
    });
    return this;
  }

  // decor: standalone mesh, not collision
  decor(color, geo, x, y, z, opts = {}) {
    const mat = makePainterlyMaterial(color, opts);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    this.w.meshes.push({ mesh: m, room: this.id });
    return m;
  }

  decoBox2(color, x, y, z, w, h, d, opts = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    return this.decor(color, g, x, y, z, opts);
  }

  // lamp post
  lamp(x, z) {
    const group = new THREE.Group();
    // tapered post + base plate
    const baseMat = makePainterlyMaterial(0x171c22, { rimStrength: 0.3 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.18, 12), baseMat);
    base.position.set(x, 0.12, z);
    group.add(base);
    const pole = new THREE.CylinderGeometry(0.07, 0.1, 3.1, 10);
    const poleMat = makePainterlyMaterial(0x1a1f26);
    const poleMesh = new THREE.Mesh(pole, poleMat);
    poleMesh.position.set(x, 1.75, z);
    group.add(poleMesh);
    // lantern head with cage
    const headMat = makePainterlyMaterial(0x2a2f36, { rimStrength: 0.25 });
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.42, 10), headMat);
    cap.position.set(x, 3.95, z);
    group.add(cap);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.62, 10, 1, true), headMat);
    cage.position.set(x, 3.58, z);
    group.add(cage);
    // glowing globe + inner flame
    const globe = new THREE.SphereGeometry(0.19, 14, 10);
    const globeMat = makePainterlyMaterial(0xffcf8a, { emission: 0xffb54a, emissionBias: 1.0, rimStrength: 0.1 });
    const globeMesh = new THREE.Mesh(globe, globeMat);
    globeMesh.position.set(x, 3.58, z);
    globeMesh.scale.set(1, 1.25, 1);
    group.add(globeMesh);
    const flameMat = makePainterlyMaterial(0xfff3c0, { emission: 0xffe0a0, emissionBias: 1.4 });
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), flameMat);
    flame.position.set(x, 3.55, z);
    group.add(flame);
    group.userData.glow = { x, z, y: 3.58 };
    this.w.meshes.push({ mesh: group, room: this.id, lit: true });
    this.w.lamps.push({ x, z, y: 3.58 });
    return this;
  }

  // zone label trigger region
  region(minX, maxX, minY, maxY, minZ, maxZ) {
    this.w.zones.push({ room: this.id, label: this.label, minX, maxX, minY, maxY, minZ, maxZ, visited: false });
    return this;
  }

  // transition to another room (trigger rect on ground)
  link(id, x1, z1, x2, z2, toRoom, toX, toZ, hint) {
    this.w.transitions.push({
      room: this.id, toRoom, toX, toZ,
      minX: Math.min(x1, x2), maxX: Math.max(x1, x2),
      minY: -4, maxY: 26,
      minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2),
      hint: hint || `К: ${this.w.roomLabel(toRoom)}`,
    });
    return this;
  }
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.meshes = [];
    this.solids = [];
    this.oneWays = [];
    this.zones = [];
    this.transitions = [];
    this.items = [];
    this.npcs = [];
    this.gates = [];
    this.chests = [];
    this.lamps = [];
    this.roomInfo = {};
    this.fogSprites = [];
    this.roomList = [];
  }

  addRoom(id, label, palette, cx, cz) {
    const r = new Room(this, id, label, palette, cx, cz);
    this.roomList.push(r);
    return r;
  }

  buildLayout() {
    return buildLayoutFrom(this);
  }

  roomLabel(id) {
    const info = this.roomInfo[id];
    return info ? info.label : id;
  }

  build() {
    const rooms = this.buildLayout();
    this.rooms = rooms;
    for (const r of rooms) {
      this.solids.push(...r.boxes);
      this.oneWays.push(...r.oneWays);
    }
    // flush merged geometry per room per color
    for (const r of rooms) {
      if (r.loaded) continue;
      for (const [colorKey, geos] of r.painted) {
        if (geos.length === 0) continue;
        const color = parseInt(colorKey, 16);
        let merged;
        if (geos.length === 1) {
          merged = geos[0];
          merged.computeBoundingSphere();
        } else {
          merged = mergeGeometries(geos);
        }
        const opts = Object.assign({ rimStrength: 0.45 }, r.outerOpts.get(colorKey) || {});
        const mat = makePainterlyMaterial(color, opts);
        const mesh = new THREE.Mesh(merged, mat);
        this.scene.add(mesh);
      }
      r.loaded = true;
    }
    // decor meshes
    for (const m of this.meshes) {
      this.scene.add(m.mesh || m);
    }
    this.buildFogBank();
    buildTraffic(this);
  }

  buildFogBank() {
    // ground creeping fog - a big soft quad with radial alpha using canvas sprite
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(160,180,200,0.6)');
    grad.addColorStop(0.5, 'rgba(160,180,200,0.3)');
    grad.addColorStop(1, 'rgba(160,180,200,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const smat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      opacity: 0.55, fog: true,
    });
    const cloudCount = 42;
    // spread puffs across map bounds, heavier in cistern/plaza zones
    for (let i = 0; i < cloudCount; i++) {
      const x = (Math.random() * 2 - 1) * 260;
      const z = (Math.random() * 2 - 1) * 220;
      const s = new THREE.Sprite(smat.clone());
      const scale = 20 + Math.random() * 38;
      s.scale.set(scale, scale * (0.32 + Math.random() * 0.18), 1);
      s.material.opacity = 0.4 + Math.random() * 0.3;
      s.position.set(x, 0.8 + Math.random() * 1.6, z);
      this.scene.add(s);
      this.fogSprites.push({ s, base: 0.8 + Math.random() * 1.6, speed: 0.18 + Math.random() * 0.4, phase: Math.random() * 10 });
    }
  }

  updateFog(time) {
    for (const f of this.fogSprites) {
      f.s.position.y = f.base + Math.sin(time * f.speed + f.phase) * 0.7;
    }
  }

  updateTraffic(dt, t) {
    if (this.traffic) updateTraffic(this.traffic, dt, t);
  }

  getColliders() {
    return { solids: this.solids, oneWays: this.oneWays };
  }
}