export class Input {
  constructor(touchControls) {
    this.touch = touchControls;
    this.keys = new Set();
    this.pressed = new Set();
    this.moveX = 0;
    this.moveZ = 0;
    this.jumpHeld = false;
    this.jumpPressed = false;
    this.dashPressed = false;
    this.interactPressed = false;
    this.lensPressed = false;
    this.mapPressed = false;
    this.pausePressed = false;
    this.camHeld = 0;
    this.camRate = 0;
    this.camDX = 0;
    this.camDY = 0;

    this.bind();
    if (this.touch) {
      this.touch.onMove = (x, y) => {
        if (this.usingTouch) {
          this.moveX = x;
          this.moveZ = y;
        }
      };
      this.touch.onCam = (dx, dy) => {
        if (this.usingTouch) {
          this.camDX += dx;
          this.camDY += dy;
        }
      };
      this.touch.onJump = (down) => {
        if (this.usingTouch) {
          this.jumpHeld = down;
          if (down) this.jumpPressed = true;
        }
      };
      this.touch.onDash = (down) => {
        if (this.usingTouch && down) this.dashPressed = true;
      };
    }
  }

  get usingTouch() {
    return this.touch && this.touch.isTouch;
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      this.pressed.add(k);
      if (k === ' ' || k === 'arrowup' || k === 'w') { this.jumpHeld = true; this.jumpPressed = true; e.preventDefault(); }
      if (k === 'shift') { this.dashPressed = true; }
      if (k === 'f' || k === 'а') { this.interactPressed = true; }
      if (k === 'q' || k === 'й') { this.camHeld = -1; }
      if (k === 'e' || k === 'л') { this.camHeld = 1; }
      if (k === 'l' || k === 'д') { this.lensPressed = true; }
      if (k === 'tab' || k === 'm' || k === 'ь') { this.mapPressed = true; e.preventDefault(); }
      if (k === 'escape' || k === 'p' || k === 'з') { this.pausePressed = true; }
      if (k === 'c') { this.deckPressed = true; }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === ' ' || k === 'arrowup' || k === 'w') this.jumpHeld = false;
      if (k === 'q' || k === 'й') { if (this.camHeld === -1) this.camHeld = 0; }
      if (k === 'e' || k === 'л') { if (this.camHeld === 1) this.camHeld = 0; }
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.jumpHeld = false; this.camHeld = 0; this.camRate = 0; this.camDX = 0; this.camDY = 0; });
  }

  axis2D() {
    if (this.usingTouch) return { x: this.moveX, z: this.moveZ };
    let x = 0, z = 0;
    if (this.keys.has('d') || this.keys.has('arrowright') || this.keys.has('в')) x += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft') || this.keys.has('ф')) x -= 1;
    if (this.keys.has('w') || this.keys.has('arrowup') || this.keys.has('ц')) z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown') || this.keys.has('ы')) z += 1;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z };
  }

  get dash() { return this._dash; }
  get jump() { return this._jump; }

  consume() {
    const out = {
      jumpHeld: this.jumpHeld,
      jump: this.jumpPressed,
      dash: this.dashPressed || this.pressed.has('shift'),
      interact: this.interactPressed || this.pressed.has('f'),
      lens: this.lensPressed,
      map: this.mapPressed,
      pause: this.pausePressed,
      deck: this.deckPressed,
    };
    this._jump = out.jump;
    this._dash = out.dash;
    this.jumpPressed = false;
    this.dashPressed = false;
    this.interactPressed = false;
    this.lensPressed = false;
    this.mapPressed = false;
    this.pausePressed = false;
    this.deckPressed = false;
    this.pressed.clear();
    return out;
  }

  // per-frame screen-space camera delta from touch swipes
  takeCamDelta() {
    const d = { x: this.camDX, y: this.camDY };
    this.camDX = 0;
    this.camDY = 0;
    return d;
  }

  held(key) { return this.keys.has(key.toLowerCase()); }
}