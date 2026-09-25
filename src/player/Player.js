import * as THREE from 'three';
import { moveBox } from '../world/Collision.js';
import { addInkOutline, flatGeometry } from '../render/Painterly.js';
import { buildAnimeEyes, buildAnimeHair, buildAnimeMouth, makeToon } from '../render/AnimeFigure.js';

const GRAVITY = -24;
const MOVE_SPEED = 6.4;
const RUN_SPEED = 9.6;
const CROUCH_SPEED = 3.4;
const AIR_CTRL = 0.55;
const JUMP_VEL = 14.2;
const DOUBLE_JUMP_VEL = 12.5;
const WALL_JUMP_VEL = 12.5;
const DASH_SPEED = 17;
const DASH_TIME = 0.26;
const DASH_CD = 0.65;
const ATTACK_CD = 0.55;
const ATTACK_RANGE = 1.9;
const ATTACK_TIME = 0.32;

export class Player {
  constructor(scene, effects, onSound) {
    this.scene = scene;
    this.effects = effects || null;
    this.onSound = onSound || null;
    this.pos = new THREE.Vector3(0, 1, 20);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.halfW = 0.42;
    this.halfH = 0.82;
    this.halfD = 0.42;

    this.grounded = false;
    this.jumps = 0;
    this.coyote = 0;
    this.buffer = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashDir = new THREE.Vector3(0, 0, -1);
    this.facing = new THREE.Vector3(0, 0, -1);
    this.wallHit = new THREE.Vector3(0, 0, 0);

    this.hp = 100;
    this.maxHp = 100;

    this.abilities = { dash: false, jump: false, wall: false, lens: false };
    this.inventory = new Set();

    this.solids = [];
    this.oneWays = [];

    this.walkT = 0;
    this.landT = 0;
    this.hurt = 0;
    this.crouching = false;
    this.running = false;
    this.attackT = 0;
    this.attackCd = 0;
    this.onAttack = null;

    this.buildMesh(scene);
  }

  buildMesh(scene) {
    const g = new THREE.Group();
    // внутренняя группа тела: сюда applyBody() тянет рост/вес персоны,
    // не задевая squash-stretch анимации на this.mesh
    const bodyG = new THREE.Group();
    g.add(bodyG);
    this.body = bodyG;

    const coatMat = makeToon(0x2b3542, { rimStrength: 0.65 });
    const darkMat = makeToon(0x1c2129, { rimStrength: 0.4 });
    const skinMat = makeToon(0xf0dcc0, { rimStrength: 0.3 });
    const hatMat = makeToon(0x232931, { rimStrength: 0.5 });

    // --- legs ---
    this.legL = new THREE.Group();
    const legGeo = flatGeometry(new THREE.CylinderGeometry(0.09, 0.115, 0.36, 8, 2));
    const legLM = new THREE.Mesh(legGeo, darkMat);
    legLM.position.y = -0.16;
    const shoeMat = makeToon(0x16191f);
    const shoeL = new THREE.Mesh(flatGeometry(new THREE.BoxGeometry(0.12, 0.09, 0.2)), shoeMat);
    shoeL.position.set(0, -0.37, 0.05);
    this.legL.add(legLM, shoeL);
    this.legR = new THREE.Group();
    const legRM = new THREE.Mesh(flatGeometry(new THREE.CylinderGeometry(0.09, 0.115, 0.36, 8, 2)), darkMat);
    legRM.position.y = -0.16;
    const shoeR = new THREE.Mesh(flatGeometry(new THREE.BoxGeometry(0.12, 0.09, 0.2)), shoeMat);
    shoeR.position.set(0, -0.37, 0.05);
    this.legR.add(legRM, shoeR);
    this.legL.position.set(-0.16, -0.04, 0);
    this.legR.position.set(0.16, -0.04, 0);
    bodyG.add(this.legL, this.legR);

    // --- trench coat (anime blazer shape, smoother tapered torso) ---
    const coatGeo = flatGeometry(new THREE.CylinderGeometry(0.2, 0.34, 0.92, 10, 2));
    coatGeo.translate(0, 0.5, 0);
    this.coat = new THREE.Mesh(coatGeo, coatMat);
    this.coat.position.y = 0;
    bodyG.add(this.coat);

    // collar
    const collarGeo = flatGeometry(new THREE.TorusGeometry(0.17, 0.06, 6, 14, Math.PI * 0.9));
    collarGeo.rotateX(Math.PI / 2);
    this.collar = new THREE.Mesh(collarGeo, coatMat);
    this.collar.position.set(0, 0.98, 0);
    bodyG.add(this.collar);

    // --- arms ---
    this.armL = new THREE.Group();
    const armGeo = flatGeometry(new THREE.CylinderGeometry(0.055, 0.07, 0.5, 8, 2));
    const armLM = new THREE.Mesh(armGeo, coatMat);
    armLM.position.y = -0.15;
    this.armL.add(armLM);
    this.armL.position.set(-0.32, 0.62, 0);
    this.armR = new THREE.Group();
    const armRM = new THREE.Mesh(flatGeometry(new THREE.CylinderGeometry(0.055, 0.07, 0.5, 8, 2)), coatMat);
    armRM.position.y = -0.15;
    this.armR.add(armRM);
    this.armR.position.set(0.32, 0.62, 0);
    bodyG.add(this.armL, this.armR);

    // --- anime head: stylised face + big expressive eyes ---
    const headG = new THREE.Group();
    const headGeo = flatGeometry(new THREE.SphereGeometry(0.17, 12, 9));
    const skull = new THREE.Mesh(headGeo, skinMat);
    skull.scale.set(0.95, 1.1, 0.98);
    skull.position.y = 1.22;
    headG.add(skull);
    // anime hair (spiky, dark)
    buildAnimeHair(headG, {
      cx: 0, cy: 1.34, cz: -0.02, radius: 0.16, color: 0x2a2118, style: 'spiky',
    });
    // big anime eyes with glints
    buildAnimeEyes(headG, {
      cx: 0, cy: 1.23, cz: 0.13, dist: 0.108, radius: 0.05, iris: 0x2a5f7f, width: 0.032,
    });
    buildAnimeMouth(headG, { cx: 0, cy: 1.06, cz: 0.15, width: 0.05 });
    bodyG.add(headG);
    this.head = headG;
    const headMesh = skull;

    // --- fedora ---
    const brim = new THREE.Mesh(flatGeometry(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 12)), hatMat);
    brim.position.y = 1.45;
    const crownGeo = flatGeometry(new THREE.CylinderGeometry(0.16, 0.2, 0.2, 10));
    crownGeo.translate(0, 0.1, 0);
    const crown = new THREE.Mesh(crownGeo, hatMat);
    crown.position.y = 1.45;
    // band
    const bandMat = makeToon(0x7a3b2e, { emission: 0x7a3b2e, emissionBias: 0.25 });
    const band = new THREE.Mesh(flatGeometry(new THREE.CylinderGeometry(0.175, 0.185, 0.05, 12)), bandMat);
    band.position.y = 1.51;
    this.hat = new THREE.Group();
    this.hat.add(brim, crown, band);
    this.hat.position.y = 0.02;
    bodyG.add(this.hat);

    // --- scarf (cloth: hinged ribbon, wave travels from the knot out) ---
    const scarfMat = makeToon(0xc98f3f, { rimStrength: 0.3 });
    const scarfGlowMat = makeToon(0xc98f3f, { emission: 0x8a5f2e, emissionBias: 0.12, rimStrength: 0.3 });
    this.scarf = new THREE.Group();
    const knot = new THREE.Mesh(flatGeometry(new THREE.BoxGeometry(0.24, 0.09, 0.16, 2, 2, 2)), scarfGlowMat);
    knot.position.set(0, 0.14, -0.04);
    this.scarf.add(knot);

    const SCARF_SEGS = 10;
    const LINK_LEN = 0.1;
    const linkGeo = flatGeometry(new THREE.BoxGeometry(0.12, 0.016, LINK_LEN, 2, 1, 2));
    const tipGeo = flatGeometry(new THREE.BoxGeometry(0.085, 0.014, LINK_LEN, 2, 1, 2));
    this.scarfAnchor = new THREE.Vector3(0, 0, -0.12);
    this.scarfDirection = new THREE.Vector3(0, 0, -1);
    this.scarfDelta = new THREE.Vector3();
    this.scarfPoint = new THREE.Vector3();
    this.scarfSegs = [];
    for (let i = 0; i < SCARF_SEGS; i++) {
      const linkG = new THREE.Group();
      const link = new THREE.Mesh(i === SCARF_SEGS - 1 ? tipGeo : linkGeo, i === SCARF_SEGS - 1 ? scarfGlowMat : scarfMat);
      link.position.z = -LINK_LEN / 2;
      linkG.add(link);
      this.scarf.add(linkG);
      this.scarfSegs.push({
        g: linkG,
        pitch: -0.08 - i * 0.01,
        pitchVelocity: 0,
        sway: 0,
        swayVelocity: 0,
        phase: i * 0.73,
      });
    }
    this.scarfLinkLength = LINK_LEN;
    this.scarf.position.y = 1.0;
    bodyG.add(this.scarf);
    this.scarfYaw = Math.PI;

    // ink outlines on key pieces
    addInkOutline(this.coat, { thickness: 0.014 });
    addInkOutline(headMesh, { thickness: 0.013 });
    addInkOutline(brim, { thickness: 0.012 });
    addInkOutline(crown, { thickness: 0.012 });
    for (const m of [legLM, legRM]) addInkOutline(m, { thickness: 0.012, opacity: 0.8 });

    g.position.copy(this.pos);
    g.rotation.y = Math.PI;
    scene.add(g);
    this.mesh = g;
    this.legs = [this.legL, this.legR];
  }

  // аниме-пропорции конкретного героя: рост, вес, размер головы
  applyBody(spec) {
    if (!this.body || !spec) return;
    const height = spec.height || 1;
    const build = spec.build || 1;
    const head = spec.head || 1;
    this.body.scale.set(build, height, build);
    if (this.head) this.head.scale.setScalar(head);
    // рост сказывается и на хитбоксе, и на высоте камеры от первого лица
    this.halfH = 0.82 * height;
    this.halfW = 0.34 * build;
    this.halfD = 0.3 * build;
    this._headOffset = 1.28 * height * head;
    this.bodySpec = { height, build, head };
  }

  reset() {
    this.hp = this.maxHp;
    this.vel.set(0, 0, 0);
    this.dashT = 0;
    this.grounded = true;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  setColliders(solids, oneWays) {
    this.solids = solids;
    this.oneWays = oneWays;
  }

  get headHeight() {
    const base = (this._headOffset || 1.28) + 0.05;
    return this.crouching ? base * 0.6 : base;
  }

  update(dt, input, cameraYaw, worldGatesSolids = []) {
    const solids = this.solids.concat(worldGatesSolids);
    const axis = input.axis2D();
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    // world-space: R = (-cos, sin), F = (sin, cos) — fixes left/right inversion
    let mx = -axis.x * cos - axis.z * sin;
    let mz = axis.x * sin - axis.z * cos;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    if (len > 0.12) {
      this.facing.set(mx, 0, mz).normalize();
      this.mesh.rotation.y = Math.atan2(mx, mz);
    }

    this.dashCd -= dt;
    this.dashT -= dt;
    this.coyote -= dt;
    this.buffer -= dt;
    this.hurt = Math.max(0, this.hurt - dt);
    this.attackCd -= dt;
    this.attackT = Math.max(0, this.attackT - dt);

    const wasGrounded = this.grounded;
    const wantsRun = !!(input.run && this.grounded);
    const wantsCrouch = !!(input.crouch && this.grounded);
    this.running = wantsRun && !wantsCrouch && len > 0.12;
    this.crouching = wantsCrouch;

    if (input.attack && this.attackCd <= 0 && this.attackT <= 0) {
      this.attackT = ATTACK_TIME;
      this.attackCd = ATTACK_CD;
      const atkPos = new THREE.Vector3(this.pos.x, this.pos.y + 1.1, this.pos.z);
      if (this.effects) this.effects.punch(atkPos, this.facing.clone());
      if (this.onSound) this.onSound('punch');
      if (this.onAttack) this.onAttack(atkPos.clone(), this.facing.clone());
    }

    if (input.dash && this.abilities.dash && this.dashCd <= 0 && this.dashT <= 0 && !this.crouching) {
      this.dashT = DASH_TIME;
      this.dashCd = DASH_CD;
      if (len > 0.3) this.dashDir.set(mx, 0, mz).normalize();
      this.vel.y = 0;
      if (this.effects) this.effects.dash(this.mesh.position.clone(), this.dashDir.clone());
      if (this.onSound) this.onSound('dash');
    }

    let tx = 0, tz = 0;
    if (this.dashT > 0) {
      tx = this.dashDir.x * DASH_SPEED;
      tz = this.dashDir.z * DASH_SPEED;
    } else {
      const ctrl = this.grounded ? 1 : AIR_CTRL + (this.abilities.wall ? 0.15 : 0);
      const spd = this.crouching ? CROUCH_SPEED : (this.running ? RUN_SPEED : MOVE_SPEED);
      tx = mx * spd * ctrl;
      tz = mz * spd * ctrl;
      if (!this.grounded && this.abilities.wall && this.vel.y < 0 && this.wallSlide) {
        this.vel.y = -1.6;
      }
    }

    let ty = this.vel.y;
    ty += GRAVITY * dt;
    if (ty < -32) ty = -32;

    let jumping = false;
    if (this.abilities.wall && input.jump && this.wallSlide && !this.grounded && this.jumps === 0) {
      this.vel.y = WALL_JUMP_VEL;
      let pushX = 0, pushZ = 0;
      if (Math.abs(this.wallHit.x) > Math.abs(this.wallHit.z)) pushX = Math.sign(this.wallHit.x) * -1;
      else pushZ = Math.sign(this.wallHit.z) * -1;
      this.vel.x = pushX * 8;
      this.vel.z = pushZ * 8;
      this.jumps = 0;
      this.wallSlide = false;
      this.wallHit.set(0, 0, 0);
      this.buffer = 0;
      jumping = true;
    } else if (input.jump && (this.grounded || this.coyote > 0)) {
      ty = JUMP_VEL;
      this.jumps = 0;
      this.grounded = false;
      this.coyote = 0;
      this.buffer = 0;
      jumping = true;
      if (this.effects) this.effects.jump(this.mesh.position.clone());
      if (this.onSound) this.onSound('jump');
    } else if (input.jump && this.abilities.jump && this.jumps < 1) {
      ty = DOUBLE_JUMP_VEL;
      this.jumps += 1;
      this.buffer = 0;
      jumping = true;
      this.dashSpark = 0.3;
      if (this.effects) this.effects.jump(this.mesh.position.clone());
      if (this.onSound) this.onSound('doublejump');
    }

    const prevY = this.pos.y;
    const effHalfH = this.crouching ? this.halfH * 0.55 : this.halfH;
    const box = {
      x: this.pos.x, y: this.pos.y + effHalfH, z: this.pos.z,
      halfW: this.halfW, halfH: effHalfH, halfD: this.halfD,
    };
    const res = moveBox(box, { x: tx * dt, y: ty * dt, z: tz * dt }, solids, this.oneWays);
    this.pos.x = res.pos.x;
    this.pos.y = res.pos.y - effHalfH;
    this.pos.z = res.pos.z;
    const landed = !this.grounded && res.grounded && (this.pos.y < prevY - 0.01);
    this.grounded = res.grounded;
    this.vel.y = ty;
    this.vel.x = this.dashT > 0 ? this.dashDir.x * DASH_SPEED : tx;
    this.vel.z = this.dashT > 0 ? this.dashDir.z * DASH_SPEED : tz;

    let ws = false;
    if (!this.grounded && this.abilities.wall && this.vel.y < 0 && !this.dashTimerActive()) {
      const w = res.hitWall;
      if (w.x !== 0 || w.z !== 0) {
        ws = true;
        this.wallHit.set(w.x, 0, w.z);
      }
    }
    this.wallSlide = ws;

    this.groundY = this.grounded ? this.pos.y : this.groundY;

    if (wasGrounded && !this.grounded) this.coyote = 0.1;
    if (res.grounded) {
      this.jumps = 0;
      this.coyote = 0.12;
      if (landed && this.effects) { this.landT = 0.6; this.effects.land(this.mesh.position.clone()); }
      if (landed && this.onSound) this.onSound('jump');
    }

    // walk cycle
    const speed = Math.hypot(tx, tz);
    if (this.grounded && speed > 0.6) {
      this.walkT += dt * (4 + speed * 1.1);
      this.stepAcc = (this.stepAcc || 0) + dt * speed;
      if (this.stepAcc > (this.crouching ? 2.6 : 1.35) && this.onSound) {
        this.stepAcc = 0;
        this.onSound('step');
      }
    } else {
      this.walkT = 0;
      this.stepAcc = 0;
    }

    this.mesh.position.set(this.pos.x, this.pos.y + (this.crouching ? 0.0 : 0.06), this.pos.z);
    this.animate(dt, speed, ty);

    if (this.pos.y < -60) {
      this.pos.set(0, 6, 20);
      this.vel.set(0, 0, 0);
      this.hp = Math.max(1, this.hp - 10);
      return 'respawn';
    }

    if (jumping) this.dashSpark = 0.25;
  }

  updateScarf(dt, t, speed, verticalVelocity) {
    const step = Math.min(dt, 1 / 30);
    const count = this.scarfSegs.length;
    const motionLift = Math.min(speed * 0.065, 0.78);
    const airShift = Math.max(-0.28, Math.min(0.32, -verticalVelocity * 0.022));
    for (let i = 0; i < count; i++) {
      const s = this.scarfSegs[i];
      const tail = (i + 1) / count;
      const restPitch = -0.62 - tail * 0.62 - Math.sin(tail * Math.PI) * 0.12;
      const targetPitch = restPitch + motionLift + airShift;
      const gravityTorque = -8 * Math.cos(s.pitch);
      const bendSpring = (targetPitch - s.pitch) * 12;
      s.pitchVelocity += (gravityTorque + bendSpring - s.pitchVelocity * 6.2) * step;
      s.pitch += s.pitchVelocity * step;
      if (s.pitch < -1.52) {
        s.pitch = -1.52;
        s.pitchVelocity = Math.max(0, s.pitchVelocity);
      } else if (s.pitch > 0.2) {
        s.pitch = 0.2;
        s.pitchVelocity = Math.min(0, s.pitchVelocity);
      }
      const swayTarget = Math.sin(t * 3.1 + s.phase) * (0.05 + tail * 0.1) * (0.5 + Math.min(speed, 12) * 0.06);
      s.swayVelocity += ((swayTarget - s.sway) * 12 - s.swayVelocity * 5) * step;
      s.sway += s.swayVelocity * step;
      s.sway = Math.max(-0.32, Math.min(0.32, s.sway));
    }

    this.scarfPoint.copy(this.scarfAnchor);
    for (let i = 0; i < count; i++) {
      const s = this.scarfSegs[i];
      const tail = (i + 1) / count;
      const horizontal = Math.cos(s.pitch);
      this.scarfDelta.set(Math.sin(s.sway) * horizontal, Math.sin(s.pitch), -Math.cos(s.sway) * horizontal).normalize();
      s.g.position.copy(this.scarfPoint);
      s.g.quaternion.setFromUnitVectors(this.scarfDirection, this.scarfDelta);
      s.g.rotateY(Math.sin(t * 4.2 + s.phase) * 0.12 * tail);
      s.g.scale.x = 1 + Math.sin(t * 4.2 + s.phase) * (0.04 + tail * 0.08);
      this.scarfPoint.addScaledVector(this.scarfDelta, this.scarfLinkLength);
    }
  }

  animate(dt, speed, vy) {
    const t = performance.now() / 1000;
    const walk = this.grounded && speed > 0.6;
    const a = walk ? Math.sin(this.walkT) : 0;

    const attacking = this.attackT > 0;
    const atkK = attacking ? 1 - this.attackT / ATTACK_TIME : 0;

    // legs swing
    const swing = a * (walk ? 0.7 : 0.05);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing * 0.96 + 0.08;

    // crouch pose: knees bent, hips low, arms forward/guarding
    if (this.crouching) {
      this.legL.rotation.x = swing * 0.4 - 0.95;
      this.legR.rotation.x = -swing * 0.4 - 0.8;
      this.legL.position.y = -0.04;
      this.legR.position.y = -0.04;
    } else {
      this.legL.position.x = walk ? -0.16 + Math.sin(this.walkT * 0.9) * 0.03 : -0.16;
      this.legR.position.x = walk ? 0.16 - Math.sin(this.walkT * 0.9) * 0.03 : 0.16;
      this.legL.position.y = -0.04;
      this.legR.position.y = -0.04;
    }

    // arms: attack punches outward, otherwise counter-swing (crouch guards)
    if (attacking) {
      const punch = Math.sin(atkK * Math.PI);
      this.armR.rotation.x = -2.4 * punch + 0.3;
      this.armL.rotation.x = 0.9 + punch * 0.3;
      this.armR.position.z = punch * 0.18;
      this.armL.position.z = 0;
    } else {
      this.armR.position.z = 0;
      this.armL.position.z = 0;
      this.armR.rotation.x = this.crouching ? 1.15 : (swing * 0.55 + 0.25);
      this.armL.rotation.x = this.crouching ? 1.15 : (-swing * 0.55 + 0.25);
    }

    // coat bob & sway
    const bob = walk ? Math.abs(Math.sin(this.walkT)) * 0.05 : 0;
    this.coat.position.y = Math.sin(this.walkT * 0.5) * 0.03 - bob * 0.4;
    this.collar.position.y = 0.98 + Math.sin(this.walkT * 0.5) * 0.03;
    this.coat.rotation.z = Math.sin(this.walkT * 0.5) * 0.02;
    this.coat.rotation.x = Math.sin(this.walkT * 0.5 + 1) * 0.02;

    // hat tilt — leads the lean
    const lean = this.dashT > 0 ? 0.35 : 0;
    this.hat.rotation.x = lean - Math.cos(this.walkT * 0.5) * 0.04;
    this.hat.position.y = 0.02 - bob;

    // scarf trailing lag — the tail sweeps behind turns
    const targetYaw = this.mesh.rotation.y + Math.PI;
    let yawD = targetYaw - this.scarfYaw;
    while (yawD > Math.PI) yawD -= Math.PI * 2;
    while (yawD < -Math.PI) yawD += Math.PI * 2;
    this.scarfYaw += yawD * Math.min(1, dt * 4.5);
    this.scarf.rotation.y = this.scarfYaw - this.mesh.rotation.y;
    this.updateScarf(dt, t, speed, vy);
    this.scarf.position.y = 1.0 + Math.sin(t * 5) * 0.015;

    // squash on landing
    if (this.landT > 0) {
      this.landT -= dt;
      const s = 1 - Math.sin((1 - this.landT / 0.6) * Math.PI) * 0.22;
      this.mesh.scale.y = Math.max(0.82, s);
      this.mesh.scale.x = this.mesh.scale.z = Math.max(0.92, 2 - s);
    } else {
      this.mesh.scale.set(1, 1, 1);
    }

    // crouch lowers the whole body
    this.body.position.y = this.crouching ? -0.18 : 0;

    // airborne tilt
    if (!this.grounded) {
      this.mesh.rotation.z = vy > 0.5 ? -0.08 : 0.1;
    } else {
      this.mesh.rotation.z = attacking ? Math.sin(atkK * Math.PI) * 0.12 : 0;
    }
  }

  dashTimerActive() { return this.dashT > 0; }

  lookAtCamera(yaw) {
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    this.mesh.rotation.y = Math.atan2(s, c) + Math.PI;
  }
}