import * as THREE from 'three';
import { moveBox } from '../world/Collision.js';
import { makePainterlyMaterial, addInkOutline } from '../render/Painterly.js';

const GRAVITY = -24;
const MOVE_SPEED = 6.4;
const AIR_CTRL = 0.55;
const JUMP_VEL = 14.2;
const DOUBLE_JUMP_VEL = 12.5;
const WALL_JUMP_VEL = 12.5;
const DASH_SPEED = 17;
const DASH_TIME = 0.26;
const DASH_CD = 0.65;

export class Player {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects || null;
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

    this.buildMesh(scene);
  }

  buildMesh(scene) {
    const g = new THREE.Group();

    const coatMat = makePainterlyMaterial(0x2b3542, { rimStrength: 0.65 });
    const darkMat = makePainterlyMaterial(0x1c2129, { rimStrength: 0.4 });
    const skinMat = makePainterlyMaterial(0xd8c9ae, { rimStrength: 0.3 });
    const hatMat = makePainterlyMaterial(0x232931, { rimStrength: 0.5 });
    const goldMat = makePainterlyMaterial(0xd4a559, { emission: 0xd4a559, emissionBias: 0.35, rimStrength: 0.3 });

    // --- legs ---
    this.legL = new THREE.Group();
    const legGeo = new THREE.CylinderGeometry(0.09, 0.115, 0.36, 12);
    const legLM = new THREE.Mesh(legGeo, darkMat);
    legLM.position.y = -0.16;
    const shoeMat = makePainterlyMaterial(0x16191f);
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.2), shoeMat);
    shoeL.position.set(0, -0.37, 0.05);
    this.legL.add(legLM, shoeL);
    this.legR = new THREE.Group();
    const legRM = new THREE.Mesh(legGeo.clone(), darkMat);
    legRM.position.y = -0.16;
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.2), shoeMat);
    shoeR.position.set(0, -0.37, 0.05);
    this.legR.add(legRM, shoeR);
    this.legL.position.set(-0.16, -0.04, 0);
    this.legR.position.set(0.16, -0.04, 0);
    g.add(this.legL, this.legR);

    // --- trench coat (tapered, more silhouette than box) ---
    const coatGeo = new THREE.CylinderGeometry(0.2, 0.34, 0.92, 14, 1);
    coatGeo.translate(0, 0.5, 0);
    this.coat = new THREE.Mesh(coatGeo, coatMat);
    this.coat.position.y = 0;
    g.add(this.coat);

    // collar
    const collarGeo = new THREE.TorusGeometry(0.17, 0.06, 8, 14, Math.PI * 0.9);
    collarGeo.rotateX(Math.PI / 2);
    this.collar = new THREE.Mesh(collarGeo, coatMat);
    this.collar.position.set(0, 0.98, 0);
    g.add(this.collar);

    // --- arms ---
    this.armL = new THREE.Group();
    const armGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.5, 10);
    const armLM = new THREE.Mesh(armGeo, coatMat);
    armLM.position.y = -0.15;
    this.armL.add(armLM);
    this.armL.position.set(-0.32, 0.62, 0);
    this.armR = new THREE.Group();
    const armRM = new THREE.Mesh(armGeo.clone(), coatMat);
    armRM.position.y = -0.15;
    this.armR.add(armRM);
    this.armR.position.set(0.32, 0.62, 0);
    g.add(this.armL, this.armR);

    // --- head ---
    const headGeo = new THREE.SphereGeometry(0.17, 16, 12);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.scale.set(1, 1.15, 1);
    head.position.y = 1.22;
    // hair hint
    const hairMat = makePainterlyMaterial(0x2a2118);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 10), hairMat);
    hair.scale.set(1.02, 0.72, 1.02);
    hair.position.y = 1.3;
    g.add(head, hair);
    // eye shadow (sideways face reads in 3/4)
    const eyeMat = makePainterlyMaterial(0x0c0e12, { emission: 0x22262e, emissionBias: 0.4 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
    eyeL.position.set(-0.1, 1.24, 0.14);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
    eyeR.position.set(0.1, 1.24, 0.14);
    g.add(eyeL, eyeR);

    // --- fedora ---
    const brimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.035, 18);
    const brim = new THREE.Mesh(brimGeo, hatMat);
    brim.position.y = 1.45;
    const crownGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.2, 16);
    crownGeo.translate(0, 0.1, 0);
    const crown = new THREE.Mesh(crownGeo, hatMat);
    crown.position.y = 1.45;
    // band
    const bandMat = makePainterlyMaterial(0x7a3b2e, { emission: 0x7a3b2e, emissionBias: 0.25 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.185, 0.05, 16), bandMat);
    band.position.y = 1.51;
    this.hat = new THREE.Group();
    this.hat.add(brim, crown, band);
    this.hat.position.y = 0.02;
    g.add(this.hat);

    // --- scarf ---
    this.scarf = new THREE.Group();
    const scarfBack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.1), goldMat);
    scarfBack.position.set(0, 0.2, -0.08);
    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.9), goldMat);
    scarfTail.position.set(0, 0.12, -0.5);
    this.scarf.add(scarfBack, scarfTail);
    this.scarf.position.y = 1.06;
    g.add(this.scarf);

    // ink outlines on key pieces
    addInkOutline(this.coat, { thickness: 0.014 });
    addInkOutline(head, { thickness: 0.013 });
    addInkOutline(brim, { thickness: 0.012 });
    addInkOutline(crown, { thickness: 0.012 });
    for (const m of [legLM, legRM]) addInkOutline(m, { thickness: 0.012, opacity: 0.8 });

    g.position.copy(this.pos);
    scene.add(g);
    this.mesh = g;
    this.head = head;
    this.legs = [this.legL, this.legR];
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

  get headHeight() { return this.halfH + 0.05; }

  update(dt, input, cameraYaw, worldGatesSolids = []) {
    const solids = this.solids.concat(worldGatesSolids);
    const axis = input.axis2D();
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    let mx = axis.x * cos - axis.z * sin;
    let mz = axis.x * sin + axis.z * cos;
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

    const wasGrounded = this.grounded;

    if (input.dash && this.abilities.dash && this.dashCd <= 0 && this.dashT <= 0) {
      this.dashT = DASH_TIME;
      this.dashCd = DASH_CD;
      if (len > 0.3) this.dashDir.set(mx, 0, mz).normalize();
      this.vel.y = 0;
      if (this.effects) this.effects.dash(this.mesh.position.clone(), this.dashDir.clone());
    }

    let tx = 0, tz = 0;
    if (this.dashT > 0) {
      tx = this.dashDir.x * DASH_SPEED;
      tz = this.dashDir.z * DASH_SPEED;
    } else {
      const ctrl = this.grounded ? 1 : AIR_CTRL + (this.abilities.wall ? 0.15 : 0);
      tx = mx * MOVE_SPEED * ctrl;
      tz = mz * MOVE_SPEED * ctrl;
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
    } else if (input.jump && this.abilities.jump && this.jumps < 1) {
      ty = DOUBLE_JUMP_VEL;
      this.jumps += 1;
      this.buffer = 0;
      jumping = true;
      this.dashSpark = 0.3;
      if (this.effects) this.effects.jump(this.mesh.position.clone());
    }

    const prevY = this.pos.y;
    const box = {
      x: this.pos.x, y: this.pos.y + this.halfH, z: this.pos.z,
      halfW: this.halfW, halfH: this.halfH, halfD: this.halfD,
    };
    const res = moveBox(box, { x: tx * dt, y: ty * dt, z: tz * dt }, solids, this.oneWays);
    this.pos.x = res.pos.x;
    this.pos.y = res.pos.y - this.halfH;
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
    if (res.grounded) { this.jumps = 0; this.coyote = 0.12; if (landed && this.effects) { this.landT = 0.6; this.effects.land(this.mesh.position.clone()); } }

    // walk cycle
    const speed = Math.hypot(tx, tz);
    if (this.grounded && speed > 0.6) this.walkT += dt * (4 + speed * 1.1);
    else this.walkT = 0;

    this.mesh.position.set(this.pos.x, this.pos.y + 0.06, this.pos.z);
    this.animate(dt, speed, ty);

    if (this.pos.y < -60) {
      this.pos.set(0, 6, 20);
      this.vel.set(0, 0, 0);
      this.hp = Math.max(1, this.hp - 10);
      return 'respawn';
    }

    if (jumping) this.dashSpark = 0.25;
  }

  animate(dt, speed, vy) {
    const t = performance.now() / 1000;
    const walk = this.grounded && speed > 0.6;
    const a = walk ? Math.sin(this.walkT) : 0;

    // legs swing
    const swing = a * (walk ? 0.7 : 0.05);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing * 0.96 + 0.08;
    this.legL.position.x = walk ? -0.16 + Math.sin(this.walkT * 0.9) * 0.03 : -0.16;
    this.legR.position.x = walk ? 0.16 - Math.sin(this.walkT * 0.9) * 0.03 : 0.16;

    // arms counter-swing
    this.armL.rotation.x = -swing * 0.55 + 0.25;
    this.armR.rotation.x = swing * 0.55 + 0.25;

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

    // scarf flutter
    this.scarf.rotation.x = Math.sin(t * 7) * 0.12 + lean * 0.4;
    this.scarf.position.y = 1.06 + Math.sin(t * 5) * 0.015;

    // squash on landing
    if (this.landT > 0) {
      this.landT -= dt;
      const s = 1 - Math.sin((1 - this.landT / 0.6) * Math.PI) * 0.22;
      this.mesh.scale.y = Math.max(0.82, s);
      this.mesh.scale.x = this.mesh.scale.z = Math.max(0.92, 2 - s);
    } else {
      this.mesh.scale.set(1, 1, 1);
    }

    // airborne tilt
    if (!this.grounded) {
      this.mesh.rotation.z = vy > 0.5 ? -0.08 : 0.1;
    } else {
      this.mesh.rotation.z = 0;
    }
  }

  dashTimerActive() { return this.dashT > 0; }

  lookAtCamera(yaw) {
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    this.mesh.rotation.y = Math.atan2(s, c) + Math.PI;
  }
}