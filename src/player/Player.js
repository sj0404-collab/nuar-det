import * as THREE from 'three';
import { moveBox } from '../world/Collision.js';
import { makePainterlyMaterial } from '../render/Painterly.js';

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
  constructor(scene) {
    this.scene = scene;
    this.pos = new THREE.Vector3(0, 1, 20);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.halfW = 0.42;
    this.halfH = 0.82;
    this.halfD = 0.42;

    this.grounded = false;
    this.jumps = 0;           // 0 = jump used this air-time
    this.coyote = 0;
    this.buffer = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashDir = new THREE.Vector3(0, 0, -1);
    this.facing = new THREE.Vector3(0, 0, -1);
    this.wallHit = new THREE.Vector3(0, 0, 0);

    this.hp = 100;
    this.maxHp = 100;

    this.abilities = {
      dash: false,
      jump: false,
      wall: false,
      lens: false,
    };
    this.inventory = new Set(); // keys etc.

    this.solids = [];
    this.oneWays = [];

    this.buildMesh(scene);
  }

  buildMesh(scene) {
    const g = new THREE.Group();
    // trench coat (body)
    const coat = makePainterlyMaterial(0x2b3542, { rimStrength: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 0.36), coat);
    body.position.y = 0.34;
    g.add(body);
    // legs hint
    const legM = makePainterlyMaterial(0x1c2129);
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 5), legM);
    legL.position.set(-0.15, -0.24, 0);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 5), legM);
    legR.position.set(0.15, -0.24, 0);
    g.add(legL, legR);
    // head
    const headM = makePainterlyMaterial(0xd8c9ae);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), headM);
    head.position.y = 1.02;
    g.add(head);
    // hat (fedora)
    const hatM = makePainterlyMaterial(0x232931);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 10), hatM);
    brim.position.y = 1.2;
    g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.18, 10), hatM);
    crown.position.y = 1.3;
    g.add(crown);
    // scarf (gold)
    const scarfM = makePainterlyMaterial(0xd4a559, { emission: 0xd4a559 });
    const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 8), scarfM);
    scarf.position.y = 0.86;
    g.add(scarf);
    g.position.copy(this.pos);
    scene.add(g);
    this.mesh = g;
    this.head = head;
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
    // --- input axis (camera-relative) ---
    const axis = input.axis2D();
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    // camera forward on ground plane
    let mx = axis.x * cos - axis.z * sin;
    let mz = axis.x * sin + axis.z * cos;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    // facing
    if (len > 0.12) {
      this.facing.set(mx, 0, mz).normalize();
      this.mesh.rotation.y = Math.atan2(mx, mz);
    }

    // --- timers ---
    this.dashCd -= dt;
    this.dashT -= dt;
    this.coyote -= dt;
    this.buffer -= dt;

    const wasGrounded = this.grounded;

    // --- dash ---
    if (input.dash && this.abilities.dash && this.dashCd <= 0 && this.dashT <= 0) {
      this.dashT = DASH_TIME;
      this.dashCd = DASH_CD;
      if (len > 0.3) this.dashDir.set(mx, 0, mz).normalize();
      this.vel.y = 0;
    }

    // --- horizontal ---
    let tx = 0, tz = 0;
    if (this.dashT > 0) {
      tx = this.dashDir.x * DASH_SPEED;
      tz = this.dashDir.z * DASH_SPEED;
    } else {
      const ctrl = this.grounded ? 1 : AIR_CTRL + (this.abilities.wall ? 0.15 : 0);
      tx = mx * MOVE_SPEED * ctrl;
      tz = mz * MOVE_SPEED * ctrl;
      // wall slide lock
      if (!this.grounded && this.abilities.wall && this.vel.y < 0 && this.wallSlide) {
        this.vel.y = -1.6;
      }
    }

    // --- vertical ---
    let ty = this.vel.y;
    ty += GRAVITY * dt;
    if (ty < -32) ty = -32;

    let jumping = false;
    // wall jump
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
    } else if (input.jump && this.abilities.jump && this.jumps < 1) {
      ty = DOUBLE_JUMP_VEL;
      this.jumps += 1;
      this.buffer = 0;
      jumping = true;
      // trail effect tint
      this.dashSpark = 0.3;
    }

    // move with collision
    const box = {
      x: this.pos.x, y: this.pos.y + this.halfH, z: this.pos.z,
      halfW: this.halfW, halfH: this.halfH, halfD: this.halfD,
    };
    const res = moveBox(box, { x: tx * dt, y: ty * dt, z: tz * dt }, solids, this.oneWays);
    this.pos.x = res.pos.x;
    this.pos.y = res.pos.y - this.halfH;
    this.pos.z = res.pos.z;
    this.grounded = res.grounded;
    this.vel.y = ty;
    this.vel.x = this.dashT > 0 ? this.dashDir.x * DASH_SPEED : tx;
    this.vel.z = this.dashT > 0 ? this.dashDir.z * DASH_SPEED : tz;

    // wall slide detection
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

    // coyote
    if (wasGrounded && !this.grounded) this.coyote = 0.1;
    if (res.grounded) { this.jumps = 0; this.coyote = 0.12; }

    // mesh transform
    this.mesh.position.set(this.pos.x, this.pos.y + 0.06, this.pos.z);
    // fall
    if (this.pos.y < -60) {
      this.pos.set(0, 6, 20);
      this.vel.set(0, 0, 0);
      this.hp = Math.max(1, this.hp - 10);
      return 'respawn';
    }

    if (jumping) this.dashSpark = 0.25;
  }

  dashTimerActive() { return this.dashT > 0; }

  lookAtCamera(yaw) {
    // tilt hat toward camera facing for flair
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    this.mesh.rotation.y = Math.atan2(s, c) + Math.PI;
  }
}