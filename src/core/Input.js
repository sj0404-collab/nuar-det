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
    this.runHeld = false;
    this.crouchHeld = false;
    this.attackPressed = false;
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
    // какой источник ввода вышел последним: так кнопки и джойстик работают
    // одновременно с клавиатурой на любом устройстве (мышь, тач-гибриды)
    this.preferTouch = !!(this.touch && this.touch.isTouch);

    // геймпад (Xbox-раскладка): стики, кнопки, триггеры.
    // Работает и в портрете, и в альбоме — это просто ещё один источник осей.
    this.pad = null;
    this._btnNow = null; // состояние кнопок в текущем кадре
    this._btnEdge = null; // «только что нажали» в текущем кадре
    this._padAxes = null;
    this.padActive = false; // был ли геймпад использован (для подсказок)

    this.bind();
    if (this.touch) {
      this.touch.onMove = (x, y) => {
        this.preferTouch = true;
        this.padActive = false;
        this.moveX = x;
        this.moveZ = y;
      };
      this.touch.onCamJoy = (x, y) => {
        this.preferTouch = true;
        this.padActive = false;
        this.camJoyX = x;
        this.camJoyY = y;
      };
      this.touch.onJump = (down) => {
        this.preferTouch = true;
        this.padActive = false;
        this.jumpHeld = down;
        if (down) this.jumpPressed = true;
      };
      this.touch.onDash = (down) => {
        this.preferTouch = true;
        this.padActive = false;
        if (down) this.dashPressed = true;
      };
      this.touch.onRun = (down) => {
        this.preferTouch = true;
        this.padActive = false;
        this.runHeld = down;
      };
      this.touch.onCrouch = (down) => {
        this.preferTouch = true;
        this.padActive = false;
        this.crouchHeld = down;
      };
      this.touch.onAttack = () => {
        this.preferTouch = true;
        this.padActive = false;
        this.attackPressed = true;
      };
    }
  }

  get usingTouch() {
    return this.touch && this.touch.isTouch;
  }

  // адаптивные подписи действий для подсказок и туториала:
  // тач-кнопки на телефоне, кнопки геймпада, клавиши на ПК
  get ctrl() {
    const s = this.scheme;
    if (s === 'gamepad') {
      return {
        move: 'левый стик',
        moveLong: 'Левый стик — движение',
        jump: 'A', dash: 'B', run: 'RT', crouch: 'LT', attack: 'X', interact: 'Y',
        lens: 'LB', camera: 'Правый стик — камера', cameraMode: 'крестовина ↓',
        map: 'BACK', pause: 'START', inventory: 'RB', jumpLong: 'A — прыжок (в воздухе снова — двойной)',
      };
    }
    if (s === 'touch') {
      return {
        move: 'джойстик слева',
        moveLong: 'Джойстик слева — движение',
        jump: '✦', dash: '➤', run: '»', crouch: '▬', attack: '⚔', interact: '!',
        lens: '🔍', camera: 'Правый джойстик — камера', cameraMode: 'V в меню вида',
        map: 'карта', pause: 'пауза', inventory: '🎒', jumpLong: '✦ — прыжок (в воздухе снова — двойной)',
      };
    }
    return {
      move: 'W/A/S/D',
      moveLong: 'W/A/S/D — движение',
      jump: 'Пробел', dash: 'Shift', run: 'Ctrl', crouch: 'X', attack: 'J', interact: 'F',
      lens: 'L', camera: 'Q/E — камера', cameraMode: 'V — вид',
      map: 'Tab/M', pause: 'Esc/P', inventory: 'C/I', jumpLong: 'Пробел — прыжок (двойной — двойной прыжок)',
    };
  }

  // какой источник сейчас реально используется (для адаптивных подсказок)
  get scheme() {
    if (this.pad && this.pad.connected && this.padActive) return 'gamepad';
    if (this.preferTouch || this.usingTouch) return 'touch';
    return 'keyboard';
  }

  // игра без базы «navigator.getGamepads» не падает
  pollGamepad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (!pads || !pads.length) return null;
    return pads.find((p) => p && p.connected) || null;
  }

  // ось с мёртвой зоной (0..1), которая применяется поверх стиков и триггеров
  axis(v, dead = 0.18) {
    return Math.abs(v) < dead ? 0 : v;
  }

  // есть ли нажатие кнопки именно в этом кадре (серия: A, B, X, Y, крестовина…)
  padPressed(idx) {
    if (!this.pad || !this._btnNow || this._btnNow.length <= idx) return false;
    return this._btnNow[idx] && this._btnEdge[idx];
  }

  padHeld(idx) {
    if (!this.pad || !this._btnNow || this._btnNow.length <= idx) return false;
    return this._btnNow[idx];
  }

  readGamepad() {
    const pad = this.pollGamepad();
    if (!pad || !pad.connected) { this.pad = null; this._btnNow = null; return; }
    this.pad = pad;
    const hasAxes = !!(pad.axes && pad.axes.length >= 4);

    // фиксируем состояние всех кнопок раз в кадр — и «нажато», и «только что нажали»
    const now = (pad.buttons || []).map((b) => !!(b.pressed || b.value > 0.5));
    const prev = this._btnNow || [];
    this._btnNow = now;
    this._btnEdge = now.map((h, i) => h && !prev[i]);

    const rx = hasAxes ? this.axis(pad.axes[2]) : 0;
    const ry = hasAxes ? this.axis(pad.axes[3]) : 0;
    const anyMove = hasAxes && Math.hypot(this.axis(pad.axes[0]), this.axis(pad.axes[1])) > 0.2;
    const anyCam = Math.hypot(rx, ry) > 0.2;
    const anyBtn = now.some(Boolean);
    if (anyMove || anyCam || anyBtn) this.padActive = true;

    // геймпад приоритетнее тача с этого момента: подсказки переключаются на него
    if (anyMove || anyCam) {
      this.preferTouch = false;
    }
    // камера: правый стик. Пишем каждый кадр (включая 0 при отпускании),
    // но только когда геймпад уже используется — не затирать тач-значения
    if (this.padActive && hasAxes) {
      this.camJoyX = rx;
      this.camJoyY = -ry;
    }
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
      this.padActive = false;
      this.keys.add(k);
      this.pressed.add(k);
      if (k === ' ' || k === 'arrowup' || k === 'w') {
        this.jumpHeld = true;
        this.jumpPressed = true;
        if (k === ' ') this.jumpSpace = true;
        e.preventDefault();
      }
      if (k === 'shift') { this.dashPressed = true; }
      if (k === 'ctrl') { this.runHeld = true; }
      if (k === 'x' || k === 'ч') { this.crouchHeld = true; }
      if (k === 'j' || k === 'о') { this.attackPressed = true; e.preventDefault(); }
      if (k === 'f' || k === 'а') { this.interactPressed = true; }
      if (k === 'q' || k === 'й') { this.camKeyHeld = -1; }
      if (k === 'e' || k === 'л') { this.camKeyHeld = 1; }
      if (k === 'l' || k === 'д') { this.lensPressed = true; }
      if (k === 'tab' || k === 'm' || k === 'ь') { this.mapPressed = true; e.preventDefault(); }
      if (k === 'escape' || k === 'p' || k === 'з') { this.pausePressed = true; }
      if (k === 'c') { this.deckPressed = true; this.inventoryPressed = true; }
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
      if (k === 'ctrl') this.runHeld = false;
      if (k === 'x' || k === 'ч') this.crouchHeld = false;
      if (k === 'q' || k === 'й') { if (this.camKeyHeld === -1) this.camKeyHeld = 0; }
      if (k === 'e' || k === 'л') { if (this.camKeyHeld === 1) this.camKeyHeld = 0; }
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.jumpHeld = false; this.runHeld = false; this.crouchHeld = false; this.camKeyHeld = 0; this.camJoyX = 0; this.camJoyY = 0; });
  }

  axis2D() {
    if (this.preferTouch && this.touch) return { x: this.moveX, z: this.moveZ };
    if (this.pad && this.pad.connected && this.pad.axes && this.pad.axes.length >= 2) {
      let x = this.axis(this.pad.axes[0]);
      let z = this.axis(this.pad.axes[1]);
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      return { x, z };
    }
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
  get run() { return this._run; }
  get crouch() { return this._crouch; }
  get attack() { return this._attack; }

  consume() {
    this.readGamepad();
    const isPad = !!(this.pad && this.pad.connected);
    const out = {
      jumpHeld: this.jumpHeld || (isPad ? this.padHeld(0) : false),
      jump: this.jumpPressed || (isPad && this.padPressed(0)),
      dash: this.dashPressed || this.pressed.has('shift') || (isPad && this.padPressed(1)),
      run: this.runHeld || (isPad && this.padHeld(7)),
      crouch: this.crouchHeld || (isPad && this.padHeld(6)),
      attack: this.attackPressed || (isPad && this.padPressed(2)),
      interact: this.interactPressed || this.pressed.has('f') || (isPad && this.padPressed(3)),
      lens: this.lensPressed || (isPad && this.padPressed(4)),
      map: this.mapPressed || (isPad && this.padPressed(8)),
      pause: this.pausePressed || (isPad && this.padPressed(9)),
      deck: this.deckPressed || (isPad && this.padPressed(5)),
      camMode: this.camModePressed || (isPad && this.padPressed(13)),
      camModeSet: this.camModeSet,
      inventory: this.inventoryPressed || (isPad && this.padPressed(5)),
      jumpSpace: this.jumpSpace || (isPad && this.padPressed(0)),
    };
    this._jump = out.jump;
    this._dash = out.dash;
    this._run = out.run;
    this._crouch = out.crouch;
    this._attack = out.attack;
    this.jumpPressed = false;
    this.jumpSpace = false;
    this.dashPressed = false;
    this.attackPressed = false;
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