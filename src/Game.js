import * as THREE from 'three';
import { World } from './world/World.js';
import { Player } from './player/Player.js';
import { SkyDome } from './render/SkyDome.js';
import { Input } from './core/Input.js';
import { TouchControls } from './core/TouchControls.js';
import { HUD } from './ui/HUD.js';
import { Screens } from './ui/Screens.js';
import { DialogueUI } from './ui/DialogueUI.js';
import { CombatUI } from './ui/CombatUI.js';
import { Dialogue } from './story/Dialogue.js';
import { Combat } from './cards/Combat.js';
import { CARDS, STARTER_DECK, ENCOUNTERS, ENEMIES } from './cards/data.js';
import { FINAL, ENDINGS } from './story/data.js';
import { AudioSys } from './audio/AudioSys.js';
import { makePainterlyMaterial, addInkOutline } from './render/Painterly.js';
import { Effects } from './render/Particles.js';
import { GlowSprites } from './render/GlowSprites.js';

const ABILITY_KEYS = { dash: 'dash', jump: 'jump', wall: 'wall', lens: 'lens' };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0f1a2c, 26, 250);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1400);
    this.camera.position.set(0, 3, 18);

    this.clock = new THREE.Clock();
    this.audio = new AudioSys();

    this.world = new World(this.scene);
    // install room builder
    this.world.build();

    this.sky = new SkyDome(this.scene);

    this.effects = new Effects(this.scene);
    this.glow = new GlowSprites(this.scene);
    this.glow.build(this.world);

    this.player = new Player(this.scene, this.effects);
    const coll = this.world.getColliders();
    this.player.setColliders(coll.solids, coll.oneWays);

    // camera orbit state
    this.cameraYaw = Math.PI;
    this.cameraPitch = -0.12;

    // UI
    this.hud = new HUD();
    this.touch = new TouchControls(this.canvas, () => {}, () => {}, () => {});
    this.hud.setTouch(this.touch);
    this.input = new Input(this.touch);
    this.dialogueUI = new DialogueUI({
      onChoose: (i) => this.onDialogueChoose(i),
      onSound: (s) => this.audio.sfx(s),
    });
    this.combatUI = new CombatUI({
      onPlay: (i) => this.onCombatPlay(i),
      onEndTurn: () => this.onCombatEndTurn(),
    });
    this.screens = new Screens({
      onStart: () => this.startGame(),
      onResume: () => this.resumeFromPause(),
      onPause: () => this.togglePause(),
      onMap: () => this.toggleMap(),
      onToTitle: () => this.toTitle(),
    });
    this.screens.showTitle();

    // state
    this.mode = 'title';
    this.flags = {};
    this.seed = 'truth';
    this.checkpoint = { x: 0, y: 1.2, z: 22 };
    this.deck = [...STARTER_DECK];
    this.state = { hp: 100, maxHp: 100 };
    this.lensActive = false;

    // data
    this.gates = [];
    this.gateColliders = [];
    this.dialogue = new Dialogue({
      onFlag: (k, v) => this.setFlag(k, v),
      onReward: (r) => this.applyReward(r),
      onClose: () => this.closeDialogue(),
    });

    this.buildGates();
    this.buildItems();
    this.buildChests();
    this.buildNpcs();
    this.buildEnemies();
    this.initPanelListeners();

    window.addEventListener('resize', () => this.onResize());

    this.phase = 0;
    this.transitionActive = null;
    this.transitionT = 0;

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setFlag(k, v) {
    if (k === 'seed') this.seed = v;
    else this.flags[k] = v;
    this.checkGatesAuto();
  }

  initPanelListeners() {
    document.getElementById('btn-ending-title').addEventListener('click', () => this.toTitle());
    document.getElementById('btn-ending-play').addEventListener('click', () => this.startGame());
    this.touch.setInteract(() => this.tryInteract());
  }

  // ---------- build world entities ----------
  buildGates() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9fb2c4, transparent: true, opacity: 0.35, depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const g of this.world.gates) {
      const h = g.size.h || 8;
      const w = g.size.w || 8;
      const geo = new THREE.PlaneGeometry(w, h);
      const mesh = new THREE.Mesh(geo, mat.clone());
      if (g.flat) {
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(g.pos.x, 0.6, g.pos.z);
      } else {
        mesh.rotation.y = (g.rot || 0);
        mesh.position.set(g.pos.x, h / 2 - 0.4, g.pos.z);
      }
      g.mesh = mesh;
      this.scene.add(mesh);
      const locked = this.gateLocked(g);
      g.locked = locked;
      if (locked) {
        const b = this.gateBox(g);
        b._gateId = g.id;
        this.gateColliders.push(b);
      }
      this.gates.push(g);
    }
    this.checkGatesAuto(false);
  }

  gateBox(g) {
    const h = g.size.h || 8;
    const w = g.size.w || 8;
    if (g.flat) {
      return {
        minX: g.pos.x - 0.6, maxX: g.pos.x + 0.6,
        minY: 0, maxY: 1.4, minZ: g.pos.z - w / 2, maxZ: g.pos.z + w / 2,
      };
    }
    return {
      minX: g.pos.x - w / 2, maxX: g.pos.x + w / 2,
      minY: -2, maxY: h + 1, minZ: g.pos.z - 0.5, maxZ: g.pos.z + 0.5,
    };
  }

  gateLocked(g) {
    const need = g.needs;
    if (Array.isArray(need)) {
      return need.some((k) => !this.player.inventory.has(k));
    }
    if (need in ABILITY_KEYS) {
      return !this.player.abilities[need];
    }
    return !this.player.inventory.has(need);
  }

  checkGatesAuto(quiet = true) {
    for (const g of this.gates) {
      const locked = this.gateLocked(g);
      if (!locked && g.locked) {
        g.locked = false;
        this.gateColliders = this.gateColliders.filter((c) => c._gateId !== g.id);
        if (g.mesh) {
          this.effects.bursts.emit(g.mesh.position.clone(), { count: 26, color: { r: 0.8, g: 0.9, b: 1 }, speed: 3.4, spread: 2.2, lift: 2, gravity: 1, size: 0.5 });
          g.mesh.visible = false;
        }
        this.audio.sfx('unlock');
        this.hud.toast(`«${g.label}» — путь открыт`);
      } else if (locked && !g.locked) {
        g.locked = true;
        const b = this.gateBox(g);
        b._gateId = g.id;
        this.gateColliders.push(b);
        g.mesh.visible = true;
      }
    }
  }

  buildItems() {
    for (const it of worldItems(this.world)) {
      // high-poly crystal core + ink outline
      const geo = new THREE.IcosahedronGeometry(0.32, 1);
      const mat = makePainterlyMaterial(it.color || 0xd4a559, { emission: it.color || 0xd4a559, emissionBias: 0.9, rimStrength: 0.8 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(it.pos.x, it.pos.y, it.pos.z);
      addInkOutline(mesh, { thickness: 0.02, opacity: 0.7 });
      this.scene.add(mesh);
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.62, 24),
        new THREE.MeshBasicMaterial({ color: it.color || 0xffe6a0, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(it.pos.x, it.pos.y + 0.05, it.pos.z);
      this.scene.add(halo);
      // rotating orbit ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.02, 6, 24),
        new THREE.MeshBasicMaterial({ color: it.color || 0xffe6a0, transparent: true, opacity: 0.5 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(it.pos.x, it.pos.y, it.pos.z);
      this.scene.add(ring);
      // orbiting glint
      const glintMat = makePainterlyMaterial(it.color || 0xffffff, { emission: it.color || 0xffffff, emissionBias: 1.2 });
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), glintMat);
      glint.position.set(it.pos.x, it.pos.y, it.pos.z);
      this.scene.add(glint);
      it.mesh = mesh;
      it.halo = halo;
      it.ring = ring;
      it.glint = glint;
      it.taken = false;
    }
  }

  buildChests() {
    for (const c of this.world.chests) {
      const g = new THREE.Group();
      const woodMat = makePainterlyMaterial(0x6b4a32, { rimStrength: 0.5 });
      const darkWoodMat = makePainterlyMaterial(0x4a3322, { rimStrength: 0.4 });
      const goldMat = makePainterlyMaterial(0xd4a559, { emission: 0xd4a559, emissionBias: 0.8, rimStrength: 0.4 });

      // base
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.62, 0.62), woodMat);
      box.position.y = 0.34;
      addInkOutline(box, { thickness: 0.02, opacity: 0.8 });
      g.add(box);
      // metal corner bands
      for (const sx of [-1, 1]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.64), goldMat);
        band.position.set(sx * 0.42, 0.35, 0);
        g.add(band);
      }
      // hinged lid (pivot at the back edge for the open animation)
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.66, -0.32);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.2, 0.68), darkWoodMat);
      lid.geometry.translate(0, 0.02, -0.05);
      lid.position.y = 0.1;
      addInkOutline(lid, { thickness: 0.02, opacity: 0.8 });
      pivot.add(lid);
      // rounded lid crest
      const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.16, 18), darkWoodMat);
      crest.position.y = 0.18;
      pivot.add(crest);
      // gold hasp
      const hasp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.1), goldMat);
      hasp.position.set(0, 0.06, 0.3);
      pivot.add(hasp);
      g.add(pivot);
      // front lock plate
      const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), goldMat);
      lock.rotation.x = Math.PI / 2;
      lock.position.set(0, 0.36, 0.34);
      g.add(lock);
      g.position.set(c.pos.x, c.pos.y, c.pos.z);
      this.scene.add(g);
      c.mesh = g;
      c.pivot = pivot;
      c.lid = lid;
      c.lock = lock;
      c.opened = false;
    }
  }

  buildNpcs() {
    for (const n of this.world.npcs) {
      // small 3D figure so characters read in the world
      const figure = new THREE.Group();
      const coatMat = makePainterlyMaterial(0x3a3336, { rimStrength: 0.55 });
      const skinMat = makePainterlyMaterial(0xd8c9ae, { rimStrength: 0.3 });
      const hatMat = makePainterlyMaterial(0x262b33, { rimStrength: 0.4 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.9, 14), coatMat);
      body.position.y = 0.45;
      addInkOutline(body, { thickness: 0.016, opacity: 0.75 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), skinMat);
      head.position.y = 1.05;
      addInkOutline(head, { thickness: 0.015, opacity: 0.7 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 16), hatMat);
      brim.position.y = 1.24;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.14, 14), hatMat);
      crown.position.y = 1.31;
      figure.add(body, head, brim, crown);
      // slouched idle
      figure.rotation.x = 0.08;
      figure.position.set(n.pos.x, n.pos.y + 0.1, n.pos.z);
      figure.rotation.y = Math.atan2(-this.checkpoint.x + n.pos.x, -this.checkpoint.z + n.pos.z) || 0;
      this.scene.add(figure);
      n.figure = figure;
      n.bobPhase = Math.random() * Math.PI * 2;

      const sprite = this.makeTextSprite(n.face, 64, n.face.length > 2 ? '#5bc0c0' : null);
      sprite.position.set(n.pos.x, n.pos.y + (n.room === 'cistern' ? 2.1 : 1.7), n.pos.z);
      this.scene.add(sprite);
      const label = this.makeTextSprite(n.name, 34, '#e9dcc0');
      label.position.set(n.pos.x, n.pos.y + (n.room === 'cistern' ? 2.4 : 2.3), n.pos.z);
      this.scene.add(label);
      n.sprite = sprite;
      n.label = label;
      // warm light pool
      const light = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.2),
        new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0.1, depthWrite: false })
      );
      light.rotation.x = -Math.PI / 2;
      light.position.set(n.pos.x, 0.02, n.pos.z);
      this.scene.add(light);
      n.light = light;
    }
  }

  buildEnemies() {
    this.wisps = [];
    for (const zone of Object.keys(ENCOUNTERS)) {
      const econf = ENCOUNTERS[zone];
      const count = econf.count;
      for (let i = 0; i < count; i++) {
        const sp = econf.spawn[i % econf.spawn.length];
        const w = {
          enemyId: econf.enemy, zone, x: sp[0], z: sp[1],
          baseX: sp[0], baseZ: sp[1], aggro: false, dead: false,
        };
        // wisp nest: spiked core + orbiting motes + aura shell
        const g = new THREE.Group();
        const coreMat = makePainterlyMaterial(0x4a2a2a, { emission: 0x7a3030, emissionBias: 0.85, rimStrength: 0.5 });
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), coreMat);
        addInkOutline(core, { thickness: 0.02, opacity: 0.75 });
        g.add(core);
        const shellMat = new THREE.MeshBasicMaterial({ color: 0x9a3a3a, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), shellMat);
        shell.position.y = 0.3;
        g.add(shell);
        const motes = [];
        for (let m = 0; m < 3; m++) {
          const moteMat = makePainterlyMaterial(0xcf6a6a, { emission: 0xcf4444, emissionBias: 1.1 });
          const mote = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), moteMat);
          g.add(mote);
          motes.push({ mesh: mote, phase: (m / 3) * Math.PI * 2 });
        }
        g.position.set(w.x, 1.6, w.z);
        this.scene.add(g);
        w.mesh = g;
        w.core = core;
        w.shell = shell;
        w.motes = motes;
        this.wisps.push(w);
      }
    }
    this.bossSpawned = false;
    this.bossDefeated = false;
  }

  makeTextSprite(text, size, color) {
    const c = document.createElement('canvas');
    c.width = size * text.length + 24;
    c.height = size + 18;
    const ctx = c.getContext('2d');
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color || '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(text, c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(c.width / 90, c.height / 90, 1);
    return sprite;
  }

  // ---------- game flow ----------
  startGame() {
    this.audio.init();
    this.audio.resume();
    this.mode = 'explore';
    this.screens.hideTitle();
    this.screens.hidePause();
    this.screens.hideMap();
    this.screens.hideLoad();
    document.getElementById('screen-ending').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    if (this.touch.isTouch) this.touch.enable();
    this.player.reset();
    this.player.pos.set(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z);
    this.deck = [...STARTER_DECK];
    this.flags = {};
    this.seed = 'truth';
    this.player.inventory.clear();
    this.player.abilities.dash = false;
    this.player.abilities.jump = false;
    this.player.abilities.wall = false;
    this.player.abilities.lens = false;
    this.updateHud();
    this.hud.toast('Дело №7: «Фонарь Моррова». Удачи, детектив.');
    this.hud.showHint('ПК: W/A/S/D — движение, Пробел — прыжок, F — взаимодействие. Мобилка: джойстик слева.', true);
    setTimeout(() => this.hud.hideHint(), 5000);
  }

  toTitle() {
    this.mode = 'title';
    this.screens.showTitle();
    document.getElementById('hud').classList.add('hidden');
    this.screens.hideMap();
    this.screens.hidePause();
    this.screens.hideLoad();
    document.getElementById('screen-ending').classList.add('hidden');
    this.touch.disable();
  }

  togglePause() {
    if (this.mode === 'explore') {
      this.mode = 'pause';
      this.screens.showPause();
    }
  }

  resumeFromPause() {
    if (this.mode === 'pause' || this.mode === 'map') {
      this.mode = 'explore';
      this.screens.hidePause();
      this.screens.hideMap();
      if (this.touch && this.touch.isTouch) this.touch.enable();
    }
  }

  toggleMap() {
    if (this.mode === 'explore' || this.mode === 'pause') {
      this.mode = 'map';
      this.screens.showMap();
      this.screens.updateMap(this.world, this.player.pos, this.flags);
      if (this.touch) this.touch.disable();
    } else if (this.mode === 'map') {
      this.mode = 'explore';
      this.screens.hideMap();
      if (this.touch) this.touch.enable();
    }
  }

  updateHud() {
    this.hud.setLogs(this.buildLogs());
    this.hud.setAbilities(this.player.abilities);
    this.hud.setCase('Дело №7 · Фонарь Моррова');
  }

  buildLogs() {
    const logs = [];
    if (this.player.inventory.has('slea')) logs.push('Слеза тумана');
    if (this.player.inventory.has('pero')) logs.push('Перо вороны');
    if (this.player.inventory.has('zvonok')) logs.push('Звонок башни');
    if (this.flags.caseAccepted) logs.push('Дело принято');
    if (this.bossDefeated) logs.push('Морок повержен');
    logs.push('❣ ' + this.state.hp);
    return logs;
  }

  // ---------- dialogue ----------
  startDialogue(id) {
    if (this.mode !== 'explore') return;
    this.mode = 'dialogue';
    this.dialogue.start(id);
    this.dialogueUI.open(this.dialogue);
  }

  onDialogueChoose(i) {
    this.dialogue.choose(i);
    if (this.dialogue.active) {
      this.dialogueUI.render(this.dialogue);
    } else {
      this.dialogueUI.close();
      this.mode = 'explore';
      this.audio.sfx('dialogue');
    }
  }

  closeDialogue() {}

  applyReward(r) {
    if (r.seed) {
      this.setFlag('seed', r.seed);
    }
    if (r.deck) {
      for (const c of r.deck) {
        if (CARDS[c]) this.deck.push(c);
      }
      this.hud.toast('В колоду добавлены карты');
      this.audio.sfx('card');
    }
    if (r.tome) {
      this.grantAbility(r.tome);
    }
    if (r.ending) {
      this.showEnding(r.ending);
    }
    if (r.heal) {
      this.player.heal(this.state.maxHp);
      this.hud.toast('Вы восстановили силы');
    }
  }

  grantAbility(key) {
    if (key in ABILITY_KEYS) {
      this.player.abilities[key] = true;
      this.audio.sfx('unlock');
      this.hud.toast('Новая способность получена!');
      this.updateHud();
    }
  }

  tryInteract() {
    if (this.mode !== 'explore') return;
    const p = this.player.pos;
    // NPC
    for (const n of this.world.npcs) {
      const dx = p.x - n.pos.x, dz = p.z - n.pos.z;
      const dy = Math.abs(p.y - n.pos.y);
      if (dx * dx + dz * dz < 5 && dy < 3.5) {
        this.startDialogue(n.dialogueId);
        return;
      }
    }
    // item
    for (const it of this.world.items) {
      if (it.taken) continue;
      const dx = p.x - it.pos.x, dz = p.z - it.pos.z;
      if (dx * dx + dz * dz < 4 && Math.abs(p.y - it.pos.y) < 3.5) {
        it.taken = true;
        it.mesh.visible = false;
        it.halo.visible = false;
        it.ring.visible = false;
        it.glint.visible = false;
        this.effects.itemGather(new THREE.Vector3(it.pos.x, it.pos.y, it.pos.z));
        this.player.inventory.add(it.key || it.id);
        this.audio.sfx('unlock');
        this.hud.toast(`Получено: ${it.label}`);
        this.updateHud();
        this.checkGatesAuto();
        return;
      }
    }
    // chest
    for (const c of this.world.chests) {
      if (c.opened) continue;
      const dx = p.x - c.pos.x, dz = p.z - c.pos.z;
      if (dx * dx + dz * dz < 5 && Math.abs(p.y - c.pos.y) < 3.5) {
        c.opened = true;
        c.openT = 0;
        c.animating = true;
        this.effects.chestSparkle(new THREE.Vector3(c.pos.x, c.pos.y + 0.7, c.pos.z));
        this.audio.sfx('chest');
        let txt = `Сундук: ${c.label}.`;
        for (const item of c.contents) {
          if (item.kind === 'tome') {
            const ab = { t_wall: 'wall', t_jump: 'jump', t_lens: 'lens' }[item.id];
            if (ab) this.grantAbility(ab);
            txt += ` Том: ${item.label}.`;
          } else if (item.kind === 'key') {
            this.player.inventory.add(item.id);
            txt += ` Ключ: ${item.label}.`;
            this.checkGatesAuto();
          } else if (item.kind === 'card') {
            if (CARDS[item.id]) this.deck.push(item.id);
            txt += ` Карта: ${CARDS[item.id] ? CARDS[item.id].name : item.id}.`;
          }
        }
        this.hud.toast(txt);
        this.updateHud();
        return;
      }
    }
  }

  // ---------- combat ----------
  startCombat(enemyId, wisp) {
    this.state.combatDeck = [...this.deck];
    this.state.hp = this.player.hp;
    this.state.maxHp = this.player.maxHp;
    this.mode = 'combat';
    this.combat = new Combat(this.state);
    this.combat.startCombat(enemyId);
    this.activeWisp = wisp;
    this.combatUI.open(this.combat, this.state);
  }

  onCombatPlay(i) {
    const r = this.combat.play(i);
    if (r) this.audio.sfx(r.card.fx.type === 'block' || r.card.fx.type === 'heal' ? 'card' : 'hit');
    if (this.combat.over) this.combatUI.render(this.combat, this.state);
    this.combatUI.render(this.combat, this.state);
    if (this.combat.over) this.resolveCombat();
  }

  onCombatEndTurn() {
    this.combat.endTurn();
    this.audio.sfx('enemy');
    this.combatUI.render(this.combat, this.state);
    if (this.combat.over) this.resolveCombat();
  }

  resolveCombat() {
    if (this.combat.won) {
      const rew = ENEMIES[this.activeWisp ? this.activeWisp.enemyId : 'boss'].reward;
      if (rew) {
        for (const c of rew.cards) {
          if (CARDS[c]) this.deck.push(c);
        }
      }
      this.player.hp = Math.min(this.player.maxHp, this.state.hp + 18);
      if (this.activeWisp) {
        this.activeWisp.dead = true;
        this.effects.bursts.emit(this.activeWisp.mesh.position.clone(), { count: 34, color: { r: 0.9, g: 0.45, b: 0.35 }, speed: 4.5, spread: 1.8, lift: 3, gravity: 1.5, size: 0.55 });
      } else {
        this.bossDefeated = true;
        this.effects.bursts.emit(new THREE.Vector3(-10, 2, -216), { count: 80, color: { r: 1, g: 0.5, b: 0.3 }, speed: 6, spread: 4, lift: 4, gravity: 2, size: 0.7 });
      }
      this.audio.sfx('unlock');
      this.hud.toast('Победа! Туман отступает.');
    } else {
      this.state.hp = 40;
      this.player.hp = 40;
      this.player.pos.set(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z);
      this.audio.sfx('death');
      this.hud.toast('Туман смыкается... вы очнулись.');
      if (this.activeWisp) this.activeWisp.dead = false;
    }
    this.combatUI.close();
    this.combat = null;
    this.mode = 'explore';
    this.updateHud();
    if (this.bossDefeated && !this.flags.finalShown) {
      this.flags.finalShown = true;
      this.mode = 'dialogue';
      this.dialogueUI.open(FINAL);
      this.dialogueUI.speaker.textContent = FINAL.speaker;
      this.dialogueUI.text.textContent = FINAL.text;
      this.dialogueUI.choices.innerHTML = '';
      FINAL.choices.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'dlg-choice';
        btn.textContent = c.label;
        btn.addEventListener('click', () => {
          this.dialogueUI.close();
          this.mode = 'explore';
          this.applyReward({ ending: c.reward.ending });
        });
        this.dialogueUI.choices.appendChild(btn);
      });
    }
  }

  showEnding(ending) {
    const e = ENDINGS[ending] || ENDINGS.truth;
    this.mode = 'ending';
    document.getElementById('ending-title').textContent = e.title;
    document.getElementById('ending-text').textContent = e.text;
    document.getElementById('screen-ending').classList.remove('hidden');
    this.dialogueUI.close();
    this.combatUI.close();
  }

  // ---------- per-frame update ----------
  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime || (this.clock.elapsedTime = 0);
    this.clock.elapsedTime += dt;

    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    const t = this.clock.elapsedTime;
    this.sky.update(t);
    this.world.updateFog(t);
    this.effects.update(dt, t, this.camera.position);
    this.glow.update(t);
    this.effects.rain.points.visible = this.player.pos.y > -5;

    if (this.mode === 'ending') {
      this.driftCamera(dt);
      return;
    }

    const input = this.input.consume();

    if (this.mode === 'explore') {
      if (input.pause) { this.togglePause(); }
      if (input.map) { this.toggleMap(); }
      if (input.lens) {
        this.lensActive = !this.lensActive;
        this.hud.toast(this.lensActive ? 'Зрение личины: следы светятся' : 'Зрение личины выключено');
        this.world.items.forEach((it) => { if (!it.taken) it.halo.material.opacity = this.lensActive ? 0.95 : 0.65; });
      }
      if (input.interact) this.tryInteract();

      this.player.update(dt * 1.0, this.input, this.cameraYaw, this.setupGateSolids());
      this.updateCamera(dt);
      this.updateInteractions();
      this.checkZones();
      this.checkTransitions();
      this.player.mesh.visible = true;

      // enemy wisps
      this.updateWisps(dt);

      // boss trigger
      this.checkBossTrigger();
    } else if (this.mode === 'dialogue') {
      this.input.consume();
    } else if (this.mode === 'map') {
      if (input.map || input.pause) this.toggleMap();
    } else if (this.mode === 'pause') {
      // buttons drive resume/title; presses are consumed here
    } else if (this.mode === 'combat') {
      this.driftCamera(dt);
    }
    this.animateProps(dt);
  }

  setupGateSolids() {
    return this.gateColliders;
  }

  updateCamera(dt) {
    const p = this.player;
    const cam = this.input.camHeld;
    if (cam !== 0) this.cameraYaw += cam * 2.7 * dt;
    const dist = 9;
    const hy = 3.1;
    const ax = Math.sin(this.cameraYaw) * dist;
    const az = Math.cos(this.cameraYaw) * dist;
    const targetX = p.pos.x - ax;
    const targetZ = p.pos.z - az;
    const targetY = p.pos.y + hy + Math.sin(this.cameraPitch) * dist * 0.35;
    this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, dt * 7);
    this.camera.position.y += (targetY - this.camera.position.y) * Math.min(1, dt * 7);
    this.camera.position.z += (targetZ - this.camera.position.z) * Math.min(1, dt * 7);
    this.camera.lookAt(p.pos.x, p.pos.y + 1.4, p.pos.z);
  }

  driftCamera(dt) {
    this.camera.position.x += 0;
  }

  updateInteractions() {
    const p = this.player.pos;
    let near = null;
    for (const n of this.world.npcs) {
      const dx = p.x - n.pos.x, dz = p.z - n.pos.z;
      if (dx * dx + dz * dz < 6) { near = { text: `${n.name} — F/взаимодействие`, interact: true }; break; }
    }
    if (!near) {
      for (const it of this.world.items) {
        if (it.taken) continue;
        const dx = p.x - it.pos.x, dz = p.z - it.pos.z;
        if (dx * dx + dz * dz < 5) { near = { text: `Подобрать: ${it.label} — F`, interact: true }; break; }
      }
    }
    if (!near) {
      for (const c of this.world.chests) {
        if (c.opened) continue;
        const dx = p.x - c.pos.x, dz = p.z - c.pos.z;
        if (dx * dx + dz * dz < 6) { near = { text: `Сундук — F`, interact: true }; break; }
      }
    }
    if (near) {
      this.hud.showHint(near.text, true);
      this.hud.showInteract(true);
    } else {
      this.hud.hideHint();
      this.hud.showInteract(false);
    }
  }

  checkZones() {
    const p = this.player.pos;
    for (const z of this.world.zones) {
      if (p.x >= z.minX && p.x <= z.maxX && p.y >= z.minY && p.y <= z.maxY && p.z >= z.minZ && p.z <= z.maxZ) {
        if (!z.visited) {
          z.visited = true;
          this.hud.toast(`◆ ${z.label}`);
          // checkpoint at zone center
          this.checkpoint = { x: (z.minX + z.maxX) / 2, y: Math.max(1.2, z.minY + 0.8), z: (z.minZ + z.maxZ) / 2 };
        }
      }
    }
  }

  checkTransitions() {
    const p = this.player.pos;
    for (const tr of this.world.transitions) {
      if (p.x >= tr.minX && p.x <= tr.maxX && p.z >= tr.minZ && p.z <= tr.maxZ && p.y >= tr.minY && p.y <= tr.maxY) {
        this.audio.sfx('dash');
        this.player.pos.set(tr.toX, tr.toY, tr.toZ);
        this.player.vel.set(0, 0, 0);
        if (tr.take === 'up') this.checkpoint = { x: 130, y: 1.2, z: 40 };
        this.hud.toast(tr.take === 'down' ? 'Спуск в цистерну' : 'Подъём на рынок');
        return;
      }
    }
  }

  updateWisps(dt) {
    const p = this.player.pos;
    const t = this.clock.elapsedTime;
    for (const w of this.wisps) {
      if (w.dead) {
        w.mesh.visible = false;
        continue;
      }
      const dx = p.x - w.x, dz = p.z - w.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 9) w.aggro = true;
      if (dist > 26) w.aggro = false;
      if (w.aggro) {
        const sp = 3.2;
        w.x += (dx / Math.max(dist, 0.01)) * sp * dt * (dist > 1.4 ? 1 : 0.2);
        w.z += (dz / Math.max(dist, 0.01)) * sp * dt * (dist > 1.4 ? 1 : 0.2);
      } else {
        w.x = w.baseX + Math.sin(t * 0.6 + w.baseZ) * 3;
        w.z = w.baseZ + Math.cos(t * 0.5 + w.baseX) * 3;
      }
      w.mesh.position.x = w.x;
      w.mesh.position.z = w.z;
      w.mesh.position.y = 1.6 + Math.sin(t * 2 + w.baseX) * 0.3;
      w.mesh.rotation.y += dt * 1.4;
      // orbiting motes
      for (let m = 0; m < w.motes.length; m++) {
        const mo = w.motes[m];
        const a = t * 2.6 + mo.phase;
        mo.mesh.position.set(Math.cos(a) * 0.72, Math.sin(a * 1.3) * 0.45 + 0.25, Math.sin(a) * 0.72);
      }
      // core pulse
      const pulse = 1 + Math.sin(t * 4 + w.baseX) * 0.08;
      w.core.scale.set(pulse, pulse, pulse);
      w.shell.material.opacity = 0.14 + Math.sin(t * 3 + w.baseZ) * 0.06;
      w.shell.scale.set(1 + Math.sin(t * 2.2 + w.baseX) * 0.08, 1, 1 + Math.sin(t * 2.2 + w.baseX) * 0.08);
      if (dist < 1.3 && !this.combat) {
        this.startCombat(w.enemyId, w);
      }
    }
  }

  checkBossTrigger() {
    const p = this.player.pos;
    // inside mausoleum arena near sarcophagus
    if (this.bossDefeated || this.bossSpawned) return;
    if (p.x > -40 && p.x < 20 && p.z < -196 && p.z > -240 && p.y > -6) {
      this.bossSpawned = true;
      this.hud.toast('Магма-Морок пробуждается из саркофага!');
      this.effects.bursts.emit(new THREE.Vector3(-10, 2, -228), { count: 46, color: { r: 1, g: 0.4, b: 0.22 }, speed: 5, spread: 3, lift: 3, gravity: 1, size: 0.65 });
      setTimeout(() => this.startCombat('boss', null), 900);
    }
  }

  animateProps(dt) {
    const t = this.clock.elapsedTime;
    for (const it of this.world.items) {
      if (it.taken) continue;
      it.mesh.position.y = it.pos.y + Math.sin(t * 2 + it.pos.x) * 0.18;
      it.mesh.rotation.y += dt * 1.4;
      it.ring.rotation.z = t * 1.6;
      it.ring.position.y = it.pos.y + Math.sin(t * 2 + it.pos.x) * 0.18;
      const ga = t * 2.4;
      it.glint.position.set(
        it.pos.x + Math.cos(ga) * 0.62,
        it.pos.y + 0.18 + Math.sin(ga * 1.3) * 0.2,
        it.pos.z + Math.sin(ga) * 0.62
      );
      it.halo.material.opacity = 0.55 + Math.sin(t * 3 + it.pos.x) * 0.15;
      it.halo.rotation.z = t;
    }
    for (const c of this.world.chests) {
      if (c.opened) {
        if (c.animating) {
          c.openT += dt;
          const k = Math.min(1, c.openT / 0.5);
          const ease = 1 - Math.pow(1 - k, 3);
          c.pivot.rotation.x = -ease * 1.35;
          if (k >= 1) {
            c.animating = false;
            c.lock.visible = false;
          }
        }
        continue;
      }
      c.mesh.rotation.y = Math.sin(t * 1.2 + c.pos.x) * 0.1;
      // gold lock breathes
      const lockMat = c.lock.material;
      if (lockMat && lockMat.uniforms) lockMat.uniforms.uEmissiveBias.value = 0.6 + Math.sin(t * 3 + c.pos.x) * 0.4;
    }
    for (const n of this.world.npcs) {
      n.figure.position.y = n.pos.y + 0.1 + Math.sin(t * 1.1 + n.bobPhase) * 0.04;
      n.figure.rotation.y += Math.sin(t * 0.4 + n.bobPhase) * 0.002;
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function worldItems(world) {
  return world.items;
}