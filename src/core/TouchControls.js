export class TouchControls {
  constructor(canvas, onMove, onJump, onDash, onCamJoy = () => {}) {
    this.el = document.getElementById('touch-controls');
    this.joyZone = document.getElementById('joy-zone');
    this.joyBase = document.getElementById('joy-base');
    this.joyThumb = document.getElementById('joy-thumb');
    this.camJoyZone = document.getElementById('cam-joy-zone');
    this.camJoyBase = document.getElementById('cam-joy-base');
    this.camJoyThumb = document.getElementById('cam-joy-thumb');
    this.btnJump = document.getElementById('btn-jump');
    this.btnDash = document.getElementById('btn-dash');
    this.btnRun = document.getElementById('btn-run');
    this.btnCrouch = document.getElementById('btn-crouch');
    this.btnAttack = document.getElementById('btn-attack');
    this.btnInteract = document.getElementById('btn-interact');

    this.onMove = onMove;
    this.onJump = onJump;
    this.onDash = onDash;
    this.onCamJoy = onCamJoy;

    // camera sensitivity (persisted)
    this.camSensitivity = parseFloat(localStorage.getItem('nuar_cam_sens')) || 1.0;
    // joystick Y: default off (forward = up); user can invert from settings
    this.invertJoy = localStorage.getItem('nuar_invert_joy') === '1';

    this.joyPointer = null;
    this.joyCenter = { x: 0, y: 0 };
    this.joyRadius = 52;
    this.vec = { x: 0, y: 0 };

    this.camJoyPointer = null;
    this.camJoyCenter = { x: 0, y: 0 };
    this.camJoyRadius = 52;
    this.camVec = { x: 0, y: 0 };

    this.active = false;
    this.bindEvents();
  }

  setCamSensitivity(val) {
    this.camSensitivity = Math.max(0.2, Math.min(3, val));
    localStorage.setItem('nuar_cam_sens', this.camSensitivity.toString());
  }

  setInvertJoy(val) {
    this.invertJoy = !!val;
    localStorage.setItem('nuar_invert_joy', this.invertJoy ? '1' : '0');
  }

  get isTouch() {
    return this.active || ('ontouchstart' in window && window.matchMedia('(pointer: coarse)').matches);
  }

  enable() { this.el.classList.remove('hidden'); this.active = true; }
  disable() { this.el.classList.add('hidden'); this.active = false; }

  bindEvents() {
    this.jumpDown = false;
    this.btnJump.addEventListener('pointerdown', (e) => { e.preventDefault(); this.jumpDown = true; this.onJump(true); });
    this.btnJump.addEventListener('pointerup', () => { this.jumpDown = false; this.onJump(false); });
    this.btnJump.addEventListener('pointerleave', () => { this.jumpDown = false; this.onJump(false); });

    this.btnDash.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onDash(true); });
    this.btnDash.addEventListener('pointerup', () => { this.onDash(false); });

    this.btnRun.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onRun && this.onRun(true); });
    this.btnRun.addEventListener('pointerup', () => { this.onRun && this.onRun(false); });
    this.btnRun.addEventListener('pointerleave', () => { this.onRun && this.onRun(false); });
    this.btnRun.addEventListener('pointercancel', () => { this.onRun && this.onRun(false); });

    this.btnCrouch.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onCrouch && this.onCrouch(true); });
    this.btnCrouch.addEventListener('pointerup', () => { this.onCrouch && this.onCrouch(false); });
    this.btnCrouch.addEventListener('pointerleave', () => { this.onCrouch && this.onCrouch(false); });
    this.btnCrouch.addEventListener('pointercancel', () => { this.onCrouch && this.onCrouch(false); });

    this.btnAttack.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onAttack && this.onAttack(); });

    this.btnInteract.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onInteract && this.onInteract(); });

    this.joyZone.addEventListener('pointerdown', (e) => this.beginJoy(e));
    this.joyZone.addEventListener('pointermove', (e) => this.moveJoy(e));
    this.joyZone.addEventListener('pointerup', (e) => this.endJoy(e));
    this.joyZone.addEventListener('pointercancel', () => this.endJoy(null));

    // camera is a second joystick on the right side, the mirror of the move stick
    this.camJoyZone.addEventListener('pointerdown', (e) => this.beginCamJoy(e));
    this.camJoyZone.addEventListener('pointermove', (e) => this.moveCamJoy(e));
    this.camJoyZone.addEventListener('pointerup', (e) => this.endCamJoy(e));
    this.camJoyZone.addEventListener('pointercancel', () => this.endCamJoy(null));
  }

  beginCamJoy(e) {
    e.preventDefault();
    this.camJoyPointer = e.pointerId;
    const r = this.camJoyBase.getBoundingClientRect();
    this.camJoyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    this.camJoyZone.setPointerCapture(e.pointerId);
    this.camVec.x = 0; this.camVec.y = 0;
    this.onCamJoy && this.onCamJoy(0, 0);
  }

  moveCamJoy(e) {
    if (this.camJoyPointer !== e.pointerId) return;
    let dx = e.clientX - this.camJoyCenter.x;
    let dy = e.clientY - this.camJoyCenter.y;
    const len = Math.hypot(dx, dy);
    if (len > this.camJoyRadius) {
      dx = dx / len * this.camJoyRadius;
      dy = dy / len * this.camJoyRadius;
    }
    this.camJoyThumb.style.transform = `translate(${dx}px, ${dy}px)`;
    const rawX = dx / this.camJoyRadius;
    const rawY = dy / this.camJoyRadius;
    const dead = 0.14;
    const ease = (v) => (Math.abs(v) < dead ? 0 : Math.sign(v) * Math.pow((Math.abs(v) - dead) / (1 - dead), 1.35));
    this.camVec.x = ease(rawX);
    this.camVec.y = ease(rawY);
    this.onCamJoy && this.onCamJoy(this.camVec.x, this.camVec.y);
  }

  endCamJoy(e) {
    if (e && e.pointerId !== this.camJoyPointer) return;
    this.camJoyPointer = null;
    this.camJoyThumb.style.transform = 'translate(0px,0px)';
    this.camVec.x = 0; this.camVec.y = 0;
    this.onCamJoy && this.onCamJoy(0, 0);
  }

  beginJoy(e) {
    this.joyPointer = e.pointerId;
    const r = this.joyBase.getBoundingClientRect();
    this.joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    this.joyZone.setPointerCapture(e.pointerId);
    this.moveJoy(e);
    this.vec.x = 0; this.vec.y = 0;
    this.onMove && this.onMove(0, 0);
  }

  moveJoy(e) {
    if (this.joyPointer !== e.pointerId) return;
    let dx = e.clientX - this.joyCenter.x;
    let dy = e.clientY - this.joyCenter.y;
    const len = Math.hypot(dx, dy);
    if (len > this.joyRadius) {
      dx = dx / len * this.joyRadius;
      dy = dy / len * this.joyRadius;
    }
    this.joyThumb.style.transform = `translate(${dx}px, ${dy}px)`;
    // dead zone + eased response so small nudges don't drift
    const rawX = dx / this.joyRadius;
    const rawY = (this.invertJoy ? -dy : dy) / this.joyRadius;
    const dead = 0.14;
    const ease = (v) => (Math.abs(v) < dead ? 0 : Math.sign(v) * Math.pow((Math.abs(v) - dead) / (1 - dead), 1.35));
    this.vec.x = ease(rawX);
    this.vec.y = ease(rawY);
    this.onMove && this.onMove(this.vec.x, this.vec.y);
  }

  endJoy(e) {
    if (e && e.pointerId !== this.joyPointer) return;
    this.joyPointer = null;
    this.joyThumb.style.transform = 'translate(0px,0px)';
    this.vec.x = 0; this.vec.y = 0;
    this.onMove && this.onMove(0, 0);
  }

  showInteract(show) {
    this.btnInteract.classList.toggle('hidden', !show);
  }

  setInteract(fn) { this.onInteract = fn; }
}