export class Input {
  constructor(touchControls) {
    this.touch = touchControls;
    this.keys = new Set();
    this.pressed = new Set();
    this.moveX = 0;
    this.moveZ = 0;
    this.jumpHeld = false;
    this.jumpPressed = false;
    this.jumpSpace = false;
    this.dashPressed = false;
    this.interactPressed = false;
    this.lensPressed = false;
    this.mapPressed = false;
    this.pausePressed = false;
    this.camKeyHeld = 0; // keyboard Q/E (-1/0/+1)
    this.camJoyX = 0;
    this.camJoyY = 0;
    this.camModePressed = false;
    this.camModeSet = null;
    this.inventoryPressed = false;
    this.camModeSet = null;
    this.inventoryPressed = false;
    // какой источник ввода вышел последним: так кнопки и джойстик работают
    // одновременно с клавиатурой на любом устройстве (мышь, тач-гибриды)
    this.preferTouch = !!(this.touch && this.touch.isTouch);

    this.bind();
    if (this.touch) {
      this.touch.onMove = (x, y) => {
        this.preferTouch = true;
        this.moveX = x;
        this.moveZ = y;
      };
      this.touch.onCamJoy = (x, y) => {
        this.preferTouch = true;
        this.camJoyX = x;
        this.camJoyY = y;
      };
      this.touch.onJump = (down) => {
        this.preferTouch = true;
        this.jumpHeld = down;
        if (down) this.jumpPressed = true;
      };
      this.touch.onDash = (down) => {
        this.preferTouch = true;
        if (down) this.dashPressed = true;
      };
    }
  }

  get usingTouch() {
    return this.touch && this.touch.isTouch;
  }

  // combined camera rotate direction: keyboard Q/E
  get camHeld() {
    return this.camKeyHeld;
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.preferTouch = false;
      this.keys.add(k);
      this.pressed.add(k);
      if (k === ' ' || k === 'arrowup' || k === 'w') {
        this.jumpHeld = true;
        this.jumpPressed = true;
        if (k === ' ') this.jumpSpace = true;
        e.preventDefault();
      }
      if (k === 'shift') { this.dashPressed = true; }
      if (k === 'f' || k === 'а') { this.interactPressed = true; }
      if (k === 'q' || k === 'й') { this.camKeyHeld = -1; }
      if (k === 'e' || k === 'л') { this.camKeyHeld = 1; }
      if (k === 'l' || k === 'д') { this.lensPressed = true; }
      if (k === 'tab' || k === 'm' || k === 'ь') { this.mapPressed = true; e.preventDefault(); }
      if (k === 'escape' || k === 'p' || k === 'з') { this.pausePressed = true; }
      if (k === 'c') { this.deckPressed = true; }
      if (k === 'v') { this.camModePressed = true; }
      if (k === '1') { this.camModeSet = 'orbit'; }
      if (k === '2') { this.camModeSet = 'top'; }
      if (k === '3') { this.camModeSet = 'fps'; }
      if (k === 'i' || k === 'ш') { this.inventoryPressed = true; }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === ' ' || k === 'arrowup' || k === 'w') this.jumpHeld = false;
      if (k === 'q' || k === 'й') { if (this.camKeyHeld === -1) this.camKeyHeld = 0; }
      if (k === 'e' || k === 'л') { if (this.camKeyHeld === 1) this.camKeyHeld = 0; }
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.jumpHeld = false; this.camKeyHeld = 0; this.camJoyX = 0; this.camJoyY = 0; });
  }

  axis2D() {
    if (this.preferTouch && this.touch) return { x: this.moveX, z: this.moveZ };
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
      camMode: this.camModePressed,
      camModeSet: this.camModeSet,
      inventory: this.inventoryPressed,
      jumpSpace: this.jumpSpace,
    };
    this._jump = out.jump;
    this._dash = out.dash;
    this.jumpPressed = false;
    this.jumpSpace = false;
    this.dashPressed = false;
    this.interactPressed = false;
    this.lensPressed = false;
    this.mapPressed = false;
    this.pausePressed = false;
    this.deckPressed = false;
    this.camModePressed = false;
    this.camModeSet = null;
    this.inventoryPressed = false;
    this.pressed.clear();
    return out;
  }

  held(key) { return this.keys.has(key.toLowerCase()); }
}