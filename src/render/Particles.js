import * as THREE from 'three';

export function makeSoftTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, outer.replace('0)', '0.45)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function makeRainTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(225,240,255,0)');
  g.addColorStop(0.22, 'rgba(225,240,255,1)');
  g.addColorStop(0.72, 'rgba(235,248,255,0.95)');
  g.addColorStop(1, 'rgba(235,248,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(3, 0, 10, 64);
  return new THREE.CanvasTexture(c);
}

const PARTICLE_VERT = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (120.0 / max(-mv.z, 0.5));
    gl_Position = projectionMatrix * mv;
    vAlpha = aAlpha;
    vColor = aColor;
  }
`;

const PARTICLE_FRAG = `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor, 1.0) * t.a * vAlpha;
  }
`;

function makePointsMaterial(map, blending = THREE.AdditiveBlending) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map } },
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending,
  });
}

// A single point-cloud field. Behavior updates particles on the CPU.
// behavior: 'dust'  drift around base positions
//           'rain'  fast downward fall in a camera-relative box
//           'ember' hot motes rising (additive flicker)
//           'mote'  slow rising glow (cistern)
class ParticleField {
  constructor(scene, { behavior, count = 100, area = { x: 260, z: 230 }, anchor, texture, blending }) {
    this.behavior = behavior;
    this.count = count;
    this.activeCount = count;
    this.intensity = 1;
    this.windX = 0;
    this.windZ = 0;
    this.anchor = anchor || { x: 0, y: 0, z: 0 };
    this.area = area;

    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    this.base = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.phase = new Float32Array(count);
    this.size0 = new Float32Array(count);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);

    this.points = new THREE.Points(geo, makePointsMaterial(texture || makeSoftTexture(), blending));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);

    this.reset();
  }

  reset() {
    for (let i = 0; i < this.count; i++) {
      this.spawn(i, 0);
      this.life[i] = this.maxLife[i];
    }
    this.write();
  }

  spawn(i, t) {
    const ax = this.anchor.x, ay = this.anchor.y, az = this.anchor.z;
    let x, y, z, vx = 0, vy = 0, vz = 0, maxLife = 10, size = 0.4, color;
    const j = i * 3;

    switch (this.behavior) {
      case 'dust': {
        x = ax + (Math.random() * 2 - 1) * this.area.x;
        y = 0.4 + Math.random() * 9;
        z = az + (Math.random() * 2 - 1) * this.area.z;
        maxLife = 6 + Math.random() * 6;
        size = 0.5 + Math.random() * 0.9;
        color = [0.62, 0.68, 0.78];
        break;
      }
      case 'rain': {
        x = ax + (Math.random() * 2 - 1) * this.area.x;
        y = ay + 16 + Math.random() * 14;
        z = az + (Math.random() * 2 - 1) * this.area.z;
        vx = 0.4 + Math.random() * 0.6;
        vy = -24 - Math.random() * 7;
        vz = 0.2 + Math.random() * 0.5;
        maxLife = 2.5;
        size = 1.1 + Math.random() * 1.0;
        color = [0.72, 0.84, 0.98];
        break;
      }
      case 'ember': {
        x = ax + (Math.random() * 2 - 1) * this.area.x;
        y = ay + Math.random() * 0.6;
        z = az + (Math.random() * 2 - 1) * this.area.z;
        vx = (Math.random() * 2 - 1) * 0.5;
        vy = 0.8 + Math.random() * 1.4;
        vz = (Math.random() * 2 - 1) * 0.5;
        maxLife = 1.2 + Math.random() * 1.4;
        size = 0.5 + Math.random() * 0.8;
        color = [1.0, 0.55 + Math.random() * 0.3, 0.22 + Math.random() * 0.2];
        break;
      }
      case 'mote': {
        x = ax + (Math.random() * 2 - 1) * this.area.x;
        y = ay + Math.random() * this.area.y;
        z = az + (Math.random() * 2 - 1) * this.area.z;
        vx = (Math.random() * 2 - 1) * 0.2;
        vy = 0.2 + Math.random() * 0.35;
        vz = (Math.random() * 2 - 1) * 0.2;
        maxLife = 5 + Math.random() * 4;
        size = 0.5 + Math.random() * 1.1;
        color = [0.25, 0.85, 0.75];
        break;
      }
      default: {
        x = 0; y = 0; z = 0; size = 0.5;
        color = [1, 1, 1];
      }
    }

    this.positions[j] = x;
    this.positions[j + 1] = y;
    this.positions[j + 2] = z;
    this.vel[j] = vx;
    this.vel[j + 1] = vy;
    this.vel[j + 2] = vz;
    this.base[j] = x;
    this.base[j + 1] = y;
    this.base[j + 2] = z;
    this.maxLife[i] = maxLife;
    this.life[i] = t * 0;
    this.phase[i] = (t + Math.random() * 6.28) % 6.28;
    this.size0[i] = size;
    this.colors[j] = color[0];
    this.colors[j + 1] = color[1];
    this.colors[j + 2] = color[2];
  }

  follow(camPos) {
    this.anchor.x = camPos.x;
    this.anchor.y = camPos.y;
    this.anchor.z = camPos.z;
    // re-home base positions when the camera moves a lot (rain field)
    for (let i = 0; i < this.count; i++) {
      const j = i * 3;
      const bx = this.base[j] - this.anchor.x;
      const bz = this.base[j + 2] - this.anchor.z;
      if (Math.abs(bx) > this.area.x || Math.abs(bz) > this.area.z) {
        this.base[j] = this.anchor.x + (Math.random() * 2 - 1) * this.area.x;
        this.base[j + 2] = this.anchor.z + (Math.random() * 2 - 1) * this.area.z;
        if (this.behavior === 'rain') {
          this.positions[j] = this.base[j];
          this.positions[j + 1] = this.anchor.y + 16 + Math.random() * 14;
          this.positions[j + 2] = this.base[j + 2];
        }
      }
    }
  }

  update(dt, t, camPos) {
    for (let i = 0; i < this.activeCount; i++) {
      const j = i * 3;
      const ageFactor = 1.0;
      this.life[i] += dt;

      switch (this.behavior) {
        case 'dust': {
          this.positions[j] = this.base[j] + Math.sin(t * 0.25 + this.phase[i]) * 0.9;
          this.positions[j + 1] = this.base[j + 1] + Math.sin(t * 0.45 + this.phase[i] * 1.7) * 0.5;
          this.positions[j + 2] = this.base[j + 2] + Math.cos(t * 0.22 + this.phase[i]) * 0.9;
          break;
        }
        case 'rain': {
          this.positions[j] += (this.vel[j] + this.windX) * dt;
          this.positions[j + 1] += this.vel[j + 1] * dt;
          this.positions[j + 2] += (this.vel[j + 2] + this.windZ) * dt;
          if (this.positions[j + 1] < camPos.y + 1) {
            this.spawn(i, t);
            this.positions[j + 1] = camPos.y + 16 + Math.random() * 14;
          }
          break;
        }
        case 'ember': {
          this.positions[j] += this.vel[j] * dt;
          this.positions[j + 1] += this.vel[j + 1] * dt;
          this.positions[j + 2] += this.vel[j + 2] * dt;
          this.vel[j + 1] += 0.15 * dt;
          if (this.life[i] > this.maxLife[i] || this.positions[j + 1] > this.anchor.y + 6) {
            this.life[i] = 0;
            this.life[i] = 0;
            this.spawn(i, t);
          }
          break;
        }
        case 'mote': {
          this.positions[j] += this.vel[j] * dt;
          this.positions[j + 1] += this.vel[j + 1] * dt;
          this.positions[j + 2] += this.vel[j + 2] * dt;
          if (this.life[i] > this.maxLife[i] || this.positions[j + 1] > this.anchor.y + this.area.y + 1) {
            this.life[i] = 0;
            this.spawn(i, t);
            this.positions[j + 1] = this.anchor.y;
          }
          break;
        }
      }

      // emissive alpha flicker
      let alpha = 1.0;
      if (this.behavior === 'ember') alpha = 0.5 + 0.5 * Math.sin(t * 9 + this.phase[i]);
      if (this.behavior === 'mote') alpha = 0.22 + 0.2 * Math.sin(t * 1.4 + this.phase[i]);
      if (this.behavior === 'dust') alpha = 0.10 + 0.08 * Math.sin(t * 0.8 + this.phase[i]);
      if (this.behavior === 'rain') alpha = 0.34 + this.intensity * 0.36;

      this.sizes[i] = this.size0[i];
      this.alphas[i] = alpha;
    }
    this.points.position.set(0, 0, 0);
    this.write();
  }

  write() {
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
  }

  setArea(area) {
    this.area = area;
  }

  setIntensity(value, windX = 0, windZ = 0) {
    const intensity = Math.max(0, Math.min(1, value));
    const nextCount = Math.ceil(this.count * intensity);
    for (let i = this.activeCount; i < nextCount; i++) this.spawn(i, 0);
    this.intensity = intensity;
    this.activeCount = nextCount;
    this.windX = windX;
    this.windZ = windZ;
    this.points.geometry.setDrawRange(0, this.activeCount);
    this.points.visible = this.activeCount > 0;
  }

  remove() {
    this.scene && this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

class RainField {
  constructor(scene, count = 360, area = { x: 46, z: 40 }) {
    this.count = count;
    this.activeCount = count;
    this.intensity = 1;
    this.area = area;
    this.anchor = new THREE.Vector3();
    this.groundY = 0;
    this.shelter = null;
    this.drops = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.positions = new Float32Array(count * 6);
    this.windX = 0;
    this.windZ = 0;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
    this.material = new THREE.LineBasicMaterial({
      color: 0xb9d9ef, transparent: true, opacity: 0.62, depthWrite: false,
    });
    this.object = new THREE.LineSegments(this.geometry, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 5;
    this.points = this.object;
    scene.add(this.object);
    for (let i = 0; i < count; i++) this.spawn(i, 0);
    this.write();
  }

  spawn(i) {
    const j = i * 3;
    this.drops[j] = this.anchor.x + (Math.random() * 2 - 1) * this.area.x;
    this.drops[j + 1] = this.groundY + 12 + Math.random() * 16;
    this.drops[j + 2] = this.anchor.z + (Math.random() * 2 - 1) * this.area.z;
    this.vel[j] = 0.35 + Math.random() * 0.55;
    this.vel[j + 1] = -23 - Math.random() * 9;
    this.vel[j + 2] = 0.15 + Math.random() * 0.4;
  }

  setIntensity(value, windX = 0, windZ = 0) {
    const intensity = Math.max(0, Math.min(1, value));
    const nextCount = Math.ceil(this.count * intensity);
    for (let i = this.activeCount; i < nextCount; i++) this.spawn(i);
    this.intensity = intensity;
    this.activeCount = nextCount;
    this.windX = windX;
    this.windZ = windZ;
    this.material.opacity = 0.28 + intensity * 0.4;
    this.geometry.setDrawRange(0, this.activeCount * 2);
    this.object.visible = this.activeCount > 0;
  }

  setShelter(shelter) {
    this.shelter = shelter && !shelter.indoor ? shelter : null;
  }

  isInsideShelter(x, y, z) {
    const s = this.shelter;
    return !!s && x >= s.minX && x <= s.maxX && y >= s.minY && y <= s.maxY && z >= s.minZ && z <= s.maxZ;
  }

  respawnOutside(i) {
    this.spawn(i);
    if (!this.shelter) return;
    const j = i * 3;
    if (this.isInsideShelter(this.drops[j], this.drops[j + 1], this.drops[j + 2])) {
      this.drops[j] = Math.random() < 0.5 ? this.shelter.minX - 1 : this.shelter.maxX + 1;
      this.drops[j + 2] = this.anchor.z + (Math.random() * 2 - 1) * this.area.z;
    }
  }

  follow(camPos, groundY = this.groundY) {
    this.anchor.set(camPos.x, groundY, camPos.z);
    this.groundY = groundY;
    for (let i = 0; i < this.activeCount; i++) {
      const j = i * 3;
      if (Math.abs(this.drops[j] - camPos.x) > this.area.x || Math.abs(this.drops[j + 2] - camPos.z) > this.area.z || this.drops[j + 1] < groundY || this.drops[j + 1] > groundY + 30) {
        this.respawnOutside(i);
      }
    }
  }

  update(dt) {
    for (let i = 0; i < this.activeCount; i++) {
      const j = i * 3;
      const vx = this.vel[j] + this.windX;
      const vy = this.vel[j + 1];
      const vz = this.vel[j + 2] + this.windZ;
      this.drops[j] += vx * dt;
      this.drops[j + 1] += vy * dt;
      this.drops[j + 2] += vz * dt;
      if (this.drops[j + 1] < this.groundY + 0.4) this.respawnOutside(i);
      if (this.isInsideShelter(this.drops[j], this.drops[j + 1], this.drops[j + 2])) this.respawnOutside(i);
      const k = i * 6;
      this.positions[k] = this.drops[j];
      this.positions[k + 1] = this.drops[j + 1];
      this.positions[k + 2] = this.drops[j + 2];
      this.positions[k + 3] = this.drops[j] - vx * 0.028;
      this.positions[k + 4] = this.drops[j + 1] - vy * 0.028;
      this.positions[k + 5] = this.drops[j + 2] - vz * 0.028;
    }
    this.write();
  }

  write() {
    this.geometry.attributes.position.needsUpdate = true;
  }
}

// One-shot burst pool driven by game events (jump, dash, land, chest, item).
class BurstPool {
  constructor(scene, count = 420) {
    this.count = count;
    this.alive = 0;

    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.size0 = new Float32Array(count);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);

    this.points = new THREE.Points(geo, makePointsMaterial(makeSoftTexture()));
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
  }

  emit(pos, opts = {}) {
    const count = opts.count || 12;
    const color = opts.color || { r: 1, g: 0.75, b: 0.4 };
    const speed = opts.speed !== undefined ? opts.speed : 3;
    const spread = opts.spread !== undefined ? opts.spread : 1.4;
    const lift = opts.lift !== undefined ? opts.lift : 0.6;
    const gravity = opts.gravity !== undefined ? opts.gravity : 5;
    const size = opts.size !== undefined ? opts.size : 0.6;
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      const j = i * 3;
      const th = Math.random() * Math.PI * 2;
      const rad = Math.random() * spread;
      this.positions[j] = pos.x + Math.cos(th) * rad;
      this.positions[j + 1] = pos.y + Math.random() * (spread * 0.5);
      this.positions[j + 2] = pos.z + Math.sin(th) * rad;
      this.vel[j] = (Math.cos(th) + (Math.random() * 2 - 1) * 0.6) * speed;
      this.vel[j + 1] = Math.random() * lift + 0.5;
      this.vel[j + 2] = (Math.sin(th) + (Math.random() * 2 - 1) * 0.6) * speed;
      this.maxLife[i] = 0.5 + Math.random() * 0.7;
      this.life[i] = 0;
      this.size0[i] = size * (0.6 + Math.random() * 0.9);
      this.colors[j] = color.r * (0.75 + Math.random() * 0.35);
      this.colors[j + 1] = color.g * (0.75 + Math.random() * 0.35);
      this.colors[j + 2] = color.b * (0.75 + Math.random() * 0.35);
    }
  }

  update(dt) {
    const jmax = this.count * 3;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] >= this.maxLife[i]) {
        this.alphas[i] = 0;
        continue;
      }
      this.life[i] += dt;
      const j = i * 3;
      this.vel[j + 1] -= 5 * dt;
      this.positions[j] += this.vel[j] * dt;
      this.positions[j + 1] += this.vel[j + 1] * dt;
      this.positions[j + 2] += this.vel[j + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.alphas[i] = (1 - k) * 0.9;
      this.sizes[i] = this.size0[i] * (1 - k * 0.6);
    }
    this.write();
  }

  write() {
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
  }
}

// Master class wired into Game: ambient city weather + sparks.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tex = makeSoftTexture();

    this.dust = new ParticleField(scene, { behavior: 'dust', count: 150, area: { x: 300, z: 260 } });
    this.rain = new RainField(scene, 440, { x: 40, z: 34 });
    this.bursts = new BurstPool(scene);

    // ember hotspots: market braziers / drain pit / mausoleum gargoyles
    this.embers = new ParticleField(scene, {
      behavior: 'ember', count: 200, area: { x: 10, z: 10 }, anchor: { x: 138, y: 0, z: 10 },
    });
    this.motes = new ParticleField(scene, {
      behavior: 'mote', count: 110, area: { x: 78, y: 9, z: 80 }, anchor: { x: 138, y: -40, z: -44 },
    });

    this.emberAnchors = [
      { x: 138, y: 0.8, z: 10 }, { x: 118, y: 0.8, z: -24 }, { x: 148, y: 0.8, z: 22 },
      { x: -10, y: 0.8, z: -206 }, { x: -30, y: 0.8, z: -206 }, { x: -2, y: 0.8, z: -206 },
    ];
  }

  follow(camPos) {
    this.rain.follow(camPos, this.rainGroundY);
  }

  setWeather(weather, groundY = 0) {
    const rain = weather.rain || 0;
    this.rainGroundY = groundY;
    this.rain.setShelter(weather.shelter || null);
    this.rain.setIntensity(rain, (weather.windX || 0) * 4.5, (weather.windZ || 0) * 4.5);
  }

  // warm sparks above the braziers/gargoyles — repurpose a few ember slots
  update(dt, t, camPos) {
    this.dust.update(dt, t, camPos);
    if (this.rain.activeCount > 0) {
      this.rain.follow(camPos, this.rainGroundY);
      this.rain.update(dt, t, camPos);
    }
    this.motes.update(dt, t, camPos);
    // ember field: strongest near the active hotspot
    let hx = 138, hy = 0.8, hz = 10;
    let best = 1e9;
    for (const a of this.emberAnchors) {
      const d = (a.x - camPos.x) ** 2 + (a.z - camPos.z) ** 2;
      if (d < best) { best = d; hx = a.x; hy = a.y; hz = a.z; }
    }
    this.embers.anchor.x = hx; this.embers.anchor.y = hy; this.embers.anchor.z = hz;
    this.embers.update(dt, t, camPos);
    this.bursts.update(dt);
  }

  setGravityZone(g) { this.gravityZone = g; }

  dustPuff(pos, color) {
    this.bursts.emit(pos, { count: 8, color, speed: 1.2, spread: 0.8, lift: 1.2, gravity: 3, size: 0.7 });
  }

  jump(pos) {
    this.bursts.emit(pos, { count: 10, color: { r: 0.8, g: 0.82, b: 0.9 }, speed: 1, spread: 0.5, lift: 0.4, gravity: 2, size: 0.7 });
  }

  land(pos) {
    this.bursts.emit(pos, { count: 14, color: { r: 0.72, g: 0.7, b: 0.66 }, speed: 2.4, spread: 1.1, lift: 0.8, gravity: 6, size: 0.8 });
  }

  dash(pos, dir) {
    this.bursts.emit(pos, { count: 26, color: { r: 0.5, g: 0.84, b: 1 }, speed: 4, spread: 0.9, lift: 1, gravity: 1, size: 0.55 });
    for (let i = 0; i < 5; i++) {
      const p = { x: pos.x - dir.x * i * 0.15, y: pos.y + Math.random() * 0.2, z: pos.z - dir.z * i * 0.15 };
      this.bursts.emit(p, { count: 3, color: { r: 0.4, g: 0.7, b: 1 }, speed: 0.6, spread: 0.2, lift: 0.2, gravity: 0, size: 0.5 });
    }
  }

  chestSparkle(pos) {
    this.bursts.emit(pos, { count: 30, color: { r: 1, g: 0.86, b: 0.45 }, speed: 3.4, spread: 1.4, lift: 2, gravity: 2, size: 0.55 });
  }

  itemGather(pos) {
    this.bursts.emit(pos, { count: 20, color: { r: 0.55, g: 0.9, b: 1 }, speed: 2.2, spread: 1, lift: 1.6, gravity: 0.5, size: 0.5 });
  }

  wispHit(pos) {
    this.bursts.emit(pos, { count: 16, color: { r: 0.95, g: 0.35, b: 0.3 }, speed: 2.6, spread: 1, lift: 1.4, gravity: 1.5, size: 0.6 });
  }

  punch(pos, dir) {
    this.bursts.emit(pos, { count: 26, color: { r: 0.95, g: 0.9, b: 0.7 }, speed: 3.2, spread: 0.6, lift: 0.7, gravity: 2, size: 0.5 });
    const px = pos.x + (dir ? dir.x : 0) * 0.55;
    const py = pos.y + 1.2;
    const pz = pos.z + (dir ? dir.z : 0) * 0.55;
    this.bursts.emit(new THREE.Vector3(px, py, pz), { count: 10, color: { r: 1, g: 0.75, b: 0.45 }, speed: 1.6, spread: 0.35, lift: 1.8, gravity: 1, size: 0.45 });
  }
}