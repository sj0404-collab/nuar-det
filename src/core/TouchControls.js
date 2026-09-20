export class TouchControls {
  constructor(canvas, onMove, onJump, onDash) {
    this.el = document.getElementById('touch-controls');
    this.joyZone = document.getElementById('joy-zone');
    this.joyBase = document.getElementById('joy-base');
    this.joyThumb = document.getElementById('joy-thumb');
    this.btnJump = document.getElementById('btn-jump');
    this.btnDash = document.getElementById('btn-dash');
    this.btnInteract = document.getElementById('btn-interact');

    this.onMove = onMove;
    this.onJump = onJump;
    this.onDash = onDash;

    this.joyPointer = null;
    this.joyCenter = { x: 0, y: 0 };
    this.joyRadius = 52;
    this.vec = { x: 0, y: 0 };

    this.active = false;
    this.bindEvents();
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