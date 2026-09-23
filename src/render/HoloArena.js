import * as THREE from 'three';

// Голо-Арена боя в стиле Ю-Ги-О! Arc-V: второй WebGL-слой поверх боя,
// рисует голубую проекционную арену, голо-чудовище врага, призывы,
// лучи атак и вспышки.

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(180,240,255,0.9)');
  g.addColorStop(0.4, 'rgba(120,210,255,0.35)');
  g.addColorStop(1, 'rgba(120,210,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// цвет голо-чудовища по врагу
const HOLO_TINT = {
  rat: 0x5fc8c8,
  shade: 0x9a8cff,
  wisp: 0xf0c14f,
  boss: 0xff6a4a,
};

const FLOAT_SLOT = new THREE.Vector3(0, 0.28, 2.3); // позиция призыва игрока
const ENEMY_POS = new THREE.Vector3(0, 1.45, 0);

export class HoloArena {
  constructor() {
    this.canvas = document.getElementById('holo-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 30);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this._buildArena();
    this._buildEnemy();
    this._buildBeam();
    this.active = false;
    this.time = 0;

    this._onResize = () => this.setSize();
    window.addEventListener('resize', this._onResize);
    this.setSize();
  }

  setSize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- статические части арены ----------
  holoMat(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: opacity !== undefined ? opacity : 0.7,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
  }

  _buildArena() {
    // пол-проекция: кольца + спицы, как голографический стол
    this.field = new THREE.Group();
    const cyan = 0x39e0e0;
    for (const r of [3.4, 2.5, 1.6]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.025, r, 42), this.holoMat(cyan, 0.16));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0;
      this.field.add(ring);
    }
    // спицы
    const spokeGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6, Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4);
    }
    spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const spokes = new THREE.LineSegments(spokeGeo, new THREE.LineBasicMaterial({
      color: cyan, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.field.add(spokes);
    this.group.add(this.field);

    // кольцо призыва игрока
    this.playerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.78, 36),
      this.holoMat(0x9adcff, 0.0)
    );
    this.playerRing.rotation.x = -Math.PI / 2;
    this.playerRing.position.copy(FLOAT_SLOT);
    this.playerRing.position.y = 0.02;
    this.playerRing.userData.base = 1;
    this.group.add(this.playerRing);
    this.playerRingMat = this.playerRing.material;

    // бегущая скан-линия по полю
    const scanGeo = new THREE.PlaneGeometry(7.4, 0.22);
    this.scan = new THREE.Mesh(scanGeo, this.holoMat(0x9adcff, 0.10));
    this.scan.rotation.x = -Math.PI / 2;
    this.field.add(this.scan);

    // вертикальный луч порядка над врагом (сквозное свечение)
    const colGeo = new THREE.CylinderGeometry(0.12, 1.3, 6.5, 10, 1, true);
    this.column = new THREE.Mesh(colGeo, this.holoMat(0x5fc8d8, 0.05));
    this.column.position.set(0, 3.2, 0);
    this.column.rotation.z = Math.PI / 2;
    this.group.add(this.column);
  }

  _makeShard(x, y, z, s = 1) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), this.shardMat);
    m.position.set(x, y, z);
    m.scale.setScalar(s);
    this.enemy.add(m);
  }

  _buildEnemy() {
    this.enemy = new THREE.Group();
    this.enemy.position.copy(ENEMY_POS);

    // аура позади
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.5,
    }));
    this.aura.scale.set(4.6, 4.6, 1);
    this.aura.position.set(0, 0.6, -0.6);
    this.enemy.add(this.aura);

    // ядро-кристалл
    this.coreMat = this.holoMat(0xffffff, 0.75);
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), this.coreMat);
    this.enemy.add(this.core);

    // шипы
    const spikeMat = this.holoMat(0xffffff, 0.6);
    for (let i = 0; i < 9; i++) {
      const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random(), Math.random() * 2 - 1).normalize();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 5), spikeMat);
      cone.position.copy(dir.clone().multiplyScalar(0.6));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      this.enemy.add(cone);
    }

    // скин-линии (кольцевая каркасная оболочка)
    const shellEdges = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.35, 1));
    this.shell = new THREE.LineSegments(shellEdges, new THREE.LineBasicMaterial({
      color: 0xaef2ff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.enemy.add(this.shell);

    // орбитальные осколки
    this.shardMat = this.holoMat(0xffffff, 0.8);
    this.shards = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = 0.95;
      this._makeShard(Math.cos(a) * r, 0.1 + Math.sin(i * 2.4) * 0.35, Math.sin(a) * r);
    }
    this.enemy.add(this.shards);

    this.group.add(this.enemy);

    // вспышка удара рядом с врагом
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xffffff, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    }));
    this.flash.scale.set(3.2, 3.2, 1);
    this.flash.position.copy(ENEMY_POS);
    this.group.add(this.flash);

    // голо-столб призыва игрока (карта-проекция)
    this.cardHol = new THREE.Group();
    const cardGeo = new THREE.BoxGeometry(0.62, 0.9, 0.03);
    this.cardMat = this.holoMat(0xffffff, 0);
    this.cardHol.add(new THREE.Mesh(cardGeo, this.cardMat));
    const cardEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(cardGeo),
      new THREE.LineBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.cardHol.add(cardEdge);
    this.cardEdgeMat = cardEdge.material;
    this.cardHol.position.copy(FLOAT_SLOT);
    this.cardHol.position.y = 0.9;
    this.group.add(this.cardHol);
  }

  _buildBeam() {
    const geo = new THREE.BoxGeometry(0.16, 1, 0.16);
    this.beam = new THREE.Mesh(geo, this.holoMat(0x9adcff, 0));
    this.beam.visible = false;
    this.group.add(this.beam);
    this.beamMat = this.beam.material;

    this.beamOrb = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xc9f6ff, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    }));
    this.beamOrb.scale.set(1.1, 1.1, 1);
    this.group.add(this.beamOrb);

    // частицы-искры бассейна
    this.sparkCount = 90;
    this.sparks = new Float32Array(this.sparkCount * 3);
    this.sparkAlive = new Float32Array(this.sparkCount);
    this.sparkLife = new Float32Array(this.sparkCount);
    this.sparkMax = new Float32Array(this.sparkCount);
    this.sparkVel = new Float32Array(this.sparkCount * 3);
    this.sparkColor = new Float32Array(this.sparkCount * 3);
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(this.sparks, 3));
    sgeo.setAttribute('aColor', new THREE.BufferAttribute(this.sparkColor, 3));
    sgeo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(this.sparkCount), 1));
    this.sparkSizes = new Float32Array(this.sparkCount);
    sgeo.setAttribute('aSize', new THREE.BufferAttribute(this.sparkSizes, 1));
    sgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
    this.sparkGeo = sgeo;
    const sparkMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: glowTexture() } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        varying float vAlpha; varying vec3 vColor;
        void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize=aSize*(140.0/max(-mv.z,0.5)); gl_Position=projectionMatrix*mv;
          vAlpha=aAlpha; vColor=aColor; }
      `,
      fragmentShader: `
        uniform sampler2D uMap; varying float vAlpha; varying vec3 vColor;
        void main(){ vec4 t=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(vColor,1.0)*t.a*vAlpha; }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.sparksMesh = new THREE.Points(sgeo, sparkMat);
    this.sparksMesh.frustumCulled = false;
    this.group.add(this.sparksMesh);
  }

  sparkBurst(pos, color = [0.6, 0.9, 1], n = 60, speed = 4) {
    for (let i = 0; i < n; i++) {
      this.spawnSpark(i, pos, color, speed);
    }
    for (let i = n; i < this.sparkCount; i++) this.sparkAlive[i] = 0;
    this.writeSparks();
  }

  spawnSpark(i, pos, color, speed) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI;
    this.sparks[i * 3] = pos.x;
    this.sparks[i * 3 + 1] = pos.y;
    this.sparks[i * 3 + 2] = pos.z;
    this.sparkVel[i * 3] = Math.sin(ph) * Math.cos(th) * speed;
    this.sparkVel[i * 3 + 1] = Math.cos(ph) * speed + 1.2;
    this.sparkVel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * speed;
    this.sparkLife[i] = 0;
    this.sparkMax[i] = 0.4 + Math.random() * 0.6;
    this.sparkAlive[i] = 1;
    this.sparkSizes[i] = 0.3 + Math.random() * 0.5;
    this.sparkColor[i * 3] = color[0] * (0.7 + Math.random() * 0.4);
    this.sparkColor[i * 3 + 1] = color[1] * (0.7 + Math.random() * 0.4);
    this.sparkColor[i * 3 + 2] = color[2] * (0.7 + Math.random() * 0.4);
  }

  writeSparks() {
    this.sparkGeo.attributes.position.needsUpdate = true;
    this.sparkGeo.attributes.aColor.needsUpdate = true;
    this.sparkGeo.attributes.aSize.needsUpdate = true;
    this.sparkGeo.attributes.aAlpha.needsUpdate = true;
  }

  // ---------- публичное API ----------
  open(enemy) {
    this.active = true;
    this._fx = {};
    this.spawnT = 0;
    this.summonT = 0;
    this.beamT = 0;
    this.hitT = 0;
    this.enemyAtkT = 0;
    this._enemyRedFlash = 0;
    this.shake = 0;
    const tint = new THREE.Color(HOLO_TINT[enemy.id] || 0x5fc8c8);
    this._auraColor = tint.getHex();
    this.aura.material.color.copy(tint);
    this.coreMat.color.copy(tint);
    this.coreMat.color.multiplyScalar(1.3).min(new THREE.Color(1, 1, 1));
    this.shardMat.color.copy(tint);
    this.enemy.scale.setScalar(0.05);
    this.enemy.visible = true;
    // аура врага — фоновая подсветка (голо-индикатор рядом с фигурой)
    this.aura.material.opacity = 0.5;
    this.playerRingMat.opacity = 0;
    this.cardMat.opacity = 0;
    this.cardEdgeMat.opacity = 0;
  }

  close() {
    this.active = false;
  }

  play(r) {
    if (!this.active || !r) return;
    const type = r.card.fx.type;
    if (type === 'atk') {
      this.summonT = 0.001; // призыв голо-чудовища
      this._summonKind = 'off';
      this.shake = 0.28;
    } else if (type === 'block' || type === 'util') {
      this.summonT = 0.001;
      this._summonKind = r.card.kind === 'def' ? 'def' : 'util';
      this.shake = 0.14;
    } else if (type === 'heal') {
      this.summonT = 0.001;
      this._summonKind = 'heal';
    }
  }

  enemyTurn() {
    if (!this.active) return;
    this.enemyAtkT = 0.001;
    this._enemyRedFlash = 0.5;
    this.shake = 0.32;
  }

  // ---------- перерисовка ----------
  update(t, dt) {
    if (!this.active) return;
    this.time = t;

    // появление врага
    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt * 1.6);
      const k = 1 - Math.pow(1 - this.spawnT, 3);
      this.enemy.scale.setScalar(Math.max(0.001, 0.05 + k * 0.95) * (1 + Math.sin(this.spawnT * 14) * 0.03));
      this.enemy.rotation.y = (1 - k) * 2.4;
    }

    // непрерывные анимации
    this.enemy.rotation.y += dt * 0.5;
    this.shards.rotation.y += dt * 1.1;
    this.shards.rotation.x = Math.sin(t * 0.6) * 0.15;
    this.core.rotation.x += dt * 0.4;
    this.core.rotation.y += dt * 0.6;
    const pulse = 1 + Math.sin(t * 3.2) * 0.035;
    this.core.scale.set(pulse, pulse, pulse);
    this.shell.rotation.y += dt * 0.25;
    const flick = 0.78 + Math.sin(t * 7) * 0.05 + Math.sin(t * 23.7) * 0.04;
    this.coreMat.opacity = flick * (1 - this.fadeEnemy());
    this.shell.material.opacity = 0.3 + Math.sin(t * 3) * 0.06;
    this.aura.material.opacity = 0.45 + Math.sin(t * 2.1) * 0.1;
    // парение
    this.enemy.position.y = ENEMY_POS.y + Math.sin(t * 1.4) * 0.08;
    // скан-линия
    this.scan.position.x = ((t * 1.4) % 8) - 4;

    // кольцо призыва игрока
    if (this.playerRingMat.opacity > 0.01) {
      this.playerRingMat.opacity *= Math.pow(0.6, dt * 3);
      this.playerRing.scale.multiplyScalar(1 + dt * 2.2);
    }
    this.playerRing.rotation.z += dt * 1.7;

    // призыв карты-проекции
    if (this.summonT > 0 && this.summonT < 1) {
      this.summonT = Math.min(1, this.summonT + dt * 2.6);
      const k = 1 - Math.pow(1 - this.summonT, 2);
      const col = this._summonColor();
      this.cardMat.color.setHex(col);
      this.cardMat.opacity = 0.85 * (1 - this.summonT) + 0.4;
      this.cardEdgeMat.opacity = 0.9 * (1 - this.summonT);
      this.cardHol.scale.setScalar(k * (1 + Math.sin(this.summonT * 10) * 0.04));
      this.cardHol.rotation.y += dt * 9; // вращение «оборота карты»
      this.cardHol.position.y = 0.9 + (1 - k) * 2.2;
      // вспышка портала на стороне игрока
      this.playerRingMat.opacity = Math.max(this.playerRingMat.opacity, 0.8 * (1 - this.summonT));
      this.playerRing.scale.setScalar(0.8 + (1 - k) * 1.6);
      if (this.summonT >= 1) {
        this.summonT = 0;
        this.cardMat.opacity = 0;
        this.cardEdgeMat.opacity = 0;
        this.sparkBurst(FLOAT_SLOT, this._summonColorVec(this._summonKind), 70, 4.5);
        // атака лучом (для атакующих карт)
        if (this._summonKind === 'off') {
          this.beamT = 0.001;
          this._beamHitFired = false;
        }
      }
    }

    // луч атаки
    if (this.beamT > 0 && this.beamT < 1) {
      this.beamT = Math.min(1, this.beamT + dt * 3.6);
      const k = this.beamT;
      const grow = Math.min(1, k * 4);
      const from = FLOAT_SLOT.clone();
      from.y = 1.1;
      const to = ENEMY_POS.clone();
      const dvec = to.clone().sub(from);
      const len = dvec.length();
      const dirN = dvec.clone().normalize();
      this.beam.visible = true;
      this.beam.position.copy(from.clone().add(dvec.clone().multiplyScalar(0.5 * grow)));
      this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirN);
      this.beam.scale.set(1, len * grow, 1);
      this.beamMat.opacity = 0.9 * Math.sin(grow * Math.PI) * (1 - k * 0.3);
      this.beamOrb.material.opacity = 1;
      this.beamOrb.position.copy(from.clone().add(dvec.clone().multiplyScalar(grow)));
      if (k >= 0.5 && !this._beamHitFired) {
        this._beamHitFired = true;
        this.hitT = 0.001;
        this.flash.material.opacity = 1;
        this.sparkBurst(ENEMY_POS, [1, 0.55, 0.35], 60, 5);
        this.shake = 0.4;
      }
      if (k >= 1) {
        this.beam.visible = false;
        this.beamT = 0;
      }
    } else if (this.beamT === 0) {
      this.beam.visible = false;
      this.beamOrb.material.opacity = Math.max(0, this.beamOrb.material.opacity - dt * 4);
    }

    // вспышка у врага
    if (this.flash.material.opacity > 0) {
      this.flash.material.opacity *= Math.pow(0.25, dt * 6);
      this.flash.scale.multiplyScalar(1 + dt * 5);
    }

    // атака врага (рывок к игроку + красная вспышка по экрану)
    if (this.enemyAtkT > 0 && this.enemyAtkT < 1) {
      this.enemyAtkT = Math.min(1, this.enemyAtkT + dt * 2.2);
      const k = this.enemyAtkT;
      this.enemy.position.z = ENEMY_POS.z + Math.sin(k * Math.PI) * -1.6;
      this.enemy.position.y = ENEMY_POS.y - Math.sin(k * Math.PI) * 0.25;
      this._enemyRedFlash = 0.5;
      if (k >= 1) {
        this.enemyAtkT = 0;
        this.sparkBurst(new THREE.Vector3(0, 0.5, 2.6), [1, 0.4, 0.3], 45, 4);
      }
    }
    // красная вспышка ауры мгновенно, затем возврат к фирменному цвету врага
    if (this._enemyRedFlash > 0) {
      this._enemyRedFlash = Math.max(0, this._enemyRedFlash - dt * 2.4);
      this.aura.material.color.setHex(0xff5550).lerp(new THREE.Color(this._auraColor), 1 - this._enemyRedFlash * 2);
    } else {
      this.aura.material.color.setHex(this._auraColor);
    }

    // тряска камеры
    if (this.shake > 0.001) {
      this.shake = Math.max(0, this.shake - dt * 1.4);
      this.camera.position.y = 1.35 + (Math.random() - 0.5) * this.shake * 0.5;
      this.camera.position.x = (Math.random() - 0.5) * this.shake * 0.5;
      this.camera.position.z = 5.3 + (Math.random() - 0.5) * this.shake * 0.4;
    } else {
      this.camera.position.set(0, 1.35, 5.3);
      this.camera.lookAt(0, 1.35, -0.2);
    }

    // искры
    this.updateSparks(dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateSparks(dt) {
    for (let i = 0; i < this.sparkCount; i++) {
      if (!this.sparkAlive[i]) continue;
      this.sparkLife[i] += dt;
      if (this.sparkLife[i] >= this.sparkMax[i]) {
        this.sparkAlive[i] = 0;
        this.sparkColor[i * 3] = 0;
        this.sparkColor[i * 3 + 1] = 0;
        this.sparkColor[i * 3 + 2] = 0;
        continue;
      }
      this.sparks[i * 3] += this.sparkVel[i * 3] * dt;
      this.sparks[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt;
      this.sparks[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt;
      this.sparkVel[i * 3 + 1] -= 6 * dt;
    }
    this.writeSparks();
  }

  fadeEnemy() {
    // приглушаем фигуру в момент ударов
    const v = this.hitT + this.beamT * 0.5;
    return Math.sin(Math.min(1, v * 4) * Math.PI) * 0.35;
  }

  _summonColor() {
    if (this._summonKind === 'def') return 0x7ee0c8;
    if (this._summonKind === 'util') return 0xb28ee2;
    if (this._summonKind === 'heal') return 0x8fe29a;
    return 0xffb45a;
  }

  _summonColorVec(kind) {
    const hex = this._summonColor();
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  }
}