export class TouchControls {
  constructor(canvas, onMove, onJump, onDash, onCam = () => {}) {
    this.el = document.getElementById('touch-controls');
    this.joyZone = document.getElementById('joy-zone');
    this.joyBase = document.getElementById('joy-base');
    this.joyThumb = document.getElementById('joy-thumb');
    this.camZone = document.getElementById('cam-zone');
    this.btnJump = document.getElementById('btn-jump');
    this.btnDash = document.getElementById('btn-dash');
    this.btnInteract = document.getElementById('btn-interact');

    this.onMove = onMove;
    this.onJump = onJump;
    this.onDash = onDash;
    this.onCam = onCam;

    // camera sensitivity (persisted)
    this.camSensitivity = parseFloat(localStorage.getItem('nuar_cam_sens')) || 1.0;

    this.joyPointer = null;
    this.joyCenter = { x: 0, y: 0 };
    this.joyRadius = 52;
    this.vec = { x: 0, y: 0 };

    this.active = false;
    this.bindEvents();
  }

  setCamSensitivity(val) {
    this.camSensitivity = Math.max(0.2, Math.min(3, val));
    localStorage.setItem('nuar_cam_sens', this.camSensitivity.toString());
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

    this.btnInteract.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onInteract && this.onInteract(); });

    this.joyZone.addEventListener('pointerdown', (e) => this.beginJoy(e));
    this.joyZone.addEventListener('pointermove', (e) => this.moveJoy(e));
    this.joyZone.addEventListener('pointerup', (e) => this.endJoy(e));
    this.joyZone.addEventListener('pointercancel', () => this.endJoy(null));

    this.camPointer = null;
    this.camLastX = 0;
    this.camZone.addEventListener('pointerdown', (e) => this.beginCam(e));
    this.camZone.addEventListener('pointermove', (e) => this.moveCam(e));
    this.camZone.addEventListener('pointerup', (e) => this.endCam(e));
    this.camZone.addEventListener('pointercancel', () => this.endCam(null));
  }

  beginCam(e) {
    e.preventDefault();
    this.camPointer = e.pointerId;
    this.camLastX = e.clientX;
    this.camZone.setPointerCapture(e.pointerId);
    this.onCam && this.onCam(0);
  }

  moveCam(e) {
    if (this.camPointer !== e.pointerId) return;
    const dx = e.clientX - this.camLastX;
    this.camLastX = e.clientX;
    const rate = Math.max(-1, Math.min(1, dx / 50 * this.camSensitivity));
    if (dx !== 0) this.onCam && this.onCam(rate);
  }

  endCam(e) {
    if (e && e.pointerId !== this.camPointer) return;
    this.camPointer = null;
    this.onCam && this.onCam(0);
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
    this.vec.x = dx / this.joyRadius;
    this.vec.y = -dy / this.joyRadius;
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