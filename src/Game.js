import * as THREE from 'three';
import { World } from './world/World.js';
import { Player } from './player/Player.js';
import { SkyDome } from './render/SkyDome.js';
import { Input } from './core/Input.js';
import { TouchControls } from './core/TouchControls.js';
import { TimeCycle } from './core/TimeCycle.js';
import { HUD } from './ui/HUD.js';
import { Screens } from './ui/Screens.js';
import { DialogueUI } from './ui/DialogueUI.js';
import { CombatUI } from './ui/CombatUI.js';
import { Dialogue } from './story/Dialogue.js';
import { Combat } from './cards/Combat.js';
import { CARDS, STARTER_DECK, ENCOUNTERS, ENEMIES } from './cards/data.js';
import { FINAL, ENDINGS } from './story/data.js';
import { AudioSys } from './audio/AudioSys.js';
import { VoiceEngine } from './audio/VoiceEngine.js';
import { voiceFor } from './story/profiles.js';
import { PERSONAS, loadPersona, savePersona, personaById } from './story/personas.js';
import { Cinematic } from './ui/Cinematic.js';
import { WORLD_INTRO, NARRATOR_PROFILE, personaIntroFor } from './story/intro.js';
import { makePainterlyMaterial, addInkOutline, flatGeometry } from './render/Painterly.js';
import { buildAnimeEyes, buildAnimeHair, buildAnimeMouth, makeToon } from './render/AnimeFigure.js';
import { Effects } from './render/Particles.js';
import { GlowSprites } from './render/GlowSprites.js';
import { HoloArena } from './render/HoloArena.js';
import { buildPedestrians, updatePedestrians } from './world/Pedestrians.js';
import { Minimap } from './ui/Minimap.js';
import { Tutorial } from './ui/Tutorial.js';

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
    this.voice = new VoiceEngine(this.audio);
    // выбранный протагонист («от какого лица играть»)
    this.persona = loadPersona();
    this.exploreMode = false;
    // load voice settings
    const savedEngine = localStorage.getItem('nuar_voice_engine') || 'auto';
    const savedProfile = localStorage.getItem('nuar_voice_profile');
    if (savedEngine) this.voice.setMode(savedEngine);
    if (savedProfile) this.voice.setProfile(savedProfile);
    // суточный цикл привязан к реальному дню устройства (24 реальных часа)
    this.timeCycle = new TimeCycle();
    this.timeMode = localStorage.getItem('nuar_time_mode') || 'device'; // device | pause
    this._lastDayFactor = -1;
    // fog day/night palettes
    this.fogNight = new THREE.Color(0x0f1a2c);
    this.fogDay = new THREE.Color(0x9fb8cc);

    this.world = new World(this.scene);
    // install room builder
    this.world.build();

    this.sky = new SkyDome(this.scene);

    this.effects = new Effects(this.scene);
    this.glow = new GlowSprites(this.scene);
    this.glow.build(this.world);

    this.player = new Player(this.scene, this.effects, (s) => this.audio.sfx(s));
    this.player.onAttack = (pos, dir) => this.playerAttack(pos, dir);
    this.player.applyBody(this.persona ? this.persona.body : null);
    const coll = this.world.getColliders();
    this.player.setColliders(coll.solids, coll.oneWays);

    // camera orbit state
    this.cameraYaw = Math.PI;
    this.cameraPitch = -0.12;
    const savedCamMode = localStorage.getItem('nuar_cam_mode');
    this.cameraMode = (savedCamMode === 'fps' || savedCamMode === 'top') ? savedCamMode : 'orbit';
    this.cameraInverted = localStorage.getItem('nuar_invert_cam') === '1';

    // UI
    this.hud = new HUD();
    this.touch = new TouchControls(this.canvas, () => {}, () => {}, () => {});
    this.hud.setTouch(this.touch);
    this.input = new Input(this.touch);
    this.dialogueUI = new DialogueUI({
      onChoose: (i) => this.onDialogueChoose(i),
      onSound: (s) => this.audio.sfx(s),
      onSpeak: (d) => this.onDialogueSpeak(d),
    });
    this.combatUI = new CombatUI({
      onPlay: (i) => this.onCombatPlay(i),
      onEndTurn: () => this.onCombatEndTurn(),
      onFlee: () => this.onCombatFlee(),
      onRetry: () => this.onCombatRetry(),
      onGiveUp: () => this.onCombatGiveUp(),
      onTitle: () => this.onCombatToTitle(),
    });
    this.holo = new HoloArena();
    this.minimap = new Minimap(this);
    this.tutorial = new Tutorial(this);
    this.screens = new Screens({
      onStart: () => this.newGame(),
      onExploreStart: () => this.startExplore(),
      onContinue: () => this.continueGame(),
      onSave: () => { this.saveGame(); this.hud.toast('Игра сохранена.'); },
      onResume: () => this.resumeFromPause(),
      onPause: () => this.togglePause(),
      onMap: () => this.toggleMap(),
      onInventory: () => this.toggleInventory(),
      onCameraMode: (mode) => this.setCameraMode(mode),
      onWorldIntro: () => this.playWorldIntro(),
      onPersonaIntro: (p) => this.playPersonaIntro(p),
      getInventory: () => this.inventoryData(),
      onToTitle: () => this.toTitle(),
      onCamSens: (val) => this.touch.setCamSensitivity(val),
      onInvertJoy: (val) => this.touch.setInvertJoy(val),
      onInvertCam: (val) => { this.cameraInverted = val; this.hud.toast('Инверсия камеры: ' + (val ? 'вкл' : 'выкл')); },
      onToggleSound: () => this.toggleSound(),
      getSoundMuted: () => this.audio.muted,
      onToggleVoice: () => this.toggleVoice(),
      getVoiceEnabled: () => this.voice.enabled,
      onVoiceEngineChange: (engine) => this.voice.setMode(engine),
      onVoiceProfileChange: (profile) => this.voice.setProfile(profile),
      onVoicePreview: () => this.previewVoice(),
      getVoiceCaps: () => this.voice.capabilities(),
      getVoiceLast: () => this.voice.sourceName(),
      onRelayChange: (url) => { this.voice.setRelay(url); },
      onRelayTest: () => this.testRelay(),
      onTimeSpeed: (mode) => this.setTimeMode(mode),
      getTimeMode: () => this.timeMode,
      onPersonaSet: (p) => { this.setPersona(p); },
      getPersona: () => this.persona.id,
      hasSave: () => this.hasSave(),
      saveInfo: () => this.saveInfoText(),
    });
    this.screens.setHud(this.hud);
    this.screens.showTitle();
    this.screens.setCameraMode(this.cameraMode);

    // кинематографичные заставки: мир и выбранный протагонист
    this.cinematic = new Cinematic(this);
    this.cinematic.setNarrator(NARRATOR_PROFILE);

    // state
    this.mode = 'title';
    this.flags = {};
    this.seed = 'truth';
    this.checkpoint = { x: 0, y: 1.2, z: 22 };
    this.deck = [...STARTER_DECK];
    this.state = { hp: 100, maxHp: 100 };
    this.lensActive = false;
    this.mount = null;
    this.pendingVehicle = null;

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
    this.buildCitizens();
    this.buildEasterEggs();
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
    document.getElementById('btn-ending-play').addEventListener('click', () => this.newGame());
    document.getElementById('btn-seat-driver').addEventListener('click', () => this.confirmBoard(true));
    document.getElementById('btn-seat-passenger').addEventListener('click', () => this.confirmBoard(false));
    const tutSkip = document.getElementById('tutorial-skip');
    if (tutSkip) tutSkip.addEventListener('click', () => this.tutorial.skip());
    const tutReset = document.getElementById('btn-tutorial-reset');
    if (tutReset) {
      tutReset.addEventListener('click', () => {
        this.tutorial.reset();
        this.resumeFromPause();
        this.hud.toast('Обучение запущено заново.');
      });
    }
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

  // стабильная «биометрия» персонажа: одно и то же при каждом запуске
  npcBodySpec(n) {
    if (n.body) return n.body;
    let h = 2166136261;
    const key = String(n.id || n.name || 'npc');
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const r = (salt) => {
      h ^= salt + 0x9e3779b9;
      h = Math.imul(h, 16777619);
      return ((h >>> 0) % 1000) / 1000;
    };
    const height = 0.88 + r(1) * 0.28;
    const build = 0.84 + r(2) * 0.34;
    const head = 1.0 + (1.02 - height) * 0.5 + (r(3) - 0.5) * 0.1;
    return { height, build, head };
  }

  buildNpcs() {
    for (const n of this.world.npcs) {
      // faceted low-poly 3D figure so characters read in the world
      const figure = this.buildLowPolyFigure(n);
      // у каждого NPC своя аниме-пропорция: рост, вес, голова
      const body = this.npcBodySpec(n);
      figure.scale.set(body.build, body.height, body.build);
      if (n.headG) n.headG.scale.setScalar(body.head);
      n.body = body;
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

  buildCitizens() {
    buildPedestrians(this.world);
  }

  // noir easter eggs: cinema-sign boards + postcards speckled through the city
  buildEasterEggs() {
    const boardMat = new THREE.MeshBasicMaterial({
      color: 0x14181c, transparent: true, opacity: 0.82, side: THREE.DoubleSide,
    });
    const addSign = (text, x, y, z, size, color, bw, bh) => {
      if (bw) {
        const b = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), boardMat);
        b.position.set(x, y, z);
        this.scene.add(b);
      }
      const s = this.makeTextSprite(text, size, color);
      s.position.set(x, y, z + 0.18);
      s.scale.set(s.scale.x * 1.15, s.scale.y * 1.15, 1);
      this.scene.add(s);
    };
    // The Maltese Falcon — glowing marquee over the market hall
    addSign('МАЛЬТИЙСКИЙ СОКОЛ · СЕАНС 19:30', 112, 8.6, -43.1, 46, '#e9c46a', 30, 2.4);
    // Casablanca bar
    addSign('БАР «СЫГРАЙТЕ ЕЩЁ, СЭМ»', 32, 6.2, 4.3, 40, '#ffd98a', 16, 2.0);
    // Blade Runner nod, harbor lane
    addSign('ЧЁРНЫЙ ЛОТОС', 210, 6.2, 116, 44, '#ffb3e0', 10, 1.9);
    // Wanted poster by the harbormaster
    addSign('РАЗЫСКИВАЕТСЯ: ФОНАРЬ', 228, 2.4, 112, 30, '#e9dcc0', 9, 1.5);
    // graffiti nod to the constable
    addSign('ГРАЧ ЗДЕСЬ БЫЛ · СЮДА ПРИДУТ', 10, 1.7, 4, 24, '#aac7d8', 7, 1.2);
    // The Third Man plaque above the cistern drain
    addSign('ТРЕТИЙ ЧЕЛОВЕК · ДО КЛЮЧА — 3 ЧАСА', 138, 2.8, 10, 24, '#aac7d8', 8, 1.4);
  }

  buildLowPolyFigure(n) {
    const g = new THREE.Group();

    const base = this.npcBaseColor(n);
    const coatMat = makeToon(base, { rimStrength: 0.55 });
    const skinMat = makeToon(0xf0dcc0, { rimStrength: 0.3 });
    const bootMat = makeToon(0x16191f);

    // --- legs (trousers) ---
    const legGeo = flatGeometry(new THREE.CylinderGeometry(0.075, 0.09, 0.34, 4));
    const legL = new THREE.Mesh(legGeo, bootMat);
    legL.position.set(-0.12, 0.14, 0);
    const legR = legL.clone();
    legR.position.x = 0.12;
    g.add(legL, legR);

    // --- coat (anime blazer) ---
    const coatGeo = flatGeometry(new THREE.CylinderGeometry(0.2, 0.3, 0.82, 6, 1));
    coatGeo.translate(0, 0.4, 0);
    const body = new THREE.Mesh(coatGeo, coatMat);
    addInkOutline(body, { thickness: 0.016, opacity: 0.75 });
    g.add(body);

    // belt
    const beltMat = makeToon(0x1c2129, { rimStrength: 0.4 });
    const belt = new THREE.Mesh(flatGeometry(new THREE.CylinderGeometry(0.205, 0.22, 0.05, 6)), beltMat);
    belt.position.y = 0.46;
    g.add(belt);
    // collar ring (open jacket lapels)
    const collarGeo = flatGeometry(new THREE.TorusGeometry(0.17, 0.05, 4, 7, Math.PI * 0.85));
    collarGeo.rotateX(Math.PI / 2);
    const collar = new THREE.Mesh(collarGeo, coatMat);
    collar.position.set(0, 0.78, 0);
    g.add(collar);
    // white shirt chest hint
    const shirtMat = makeToon(0xefe6d0, { rimStrength: 0.3 });
    const shirt = new THREE.Mesh(flatGeometry(new THREE.BoxGeometry(0.14, 0.14, 0.02)), shirtMat);
    shirt.position.set(0, 0.72, 0.21);
    g.add(shirt);

    // --- arms (animated idle swing) ---
    const armGeo = flatGeometry(new THREE.CylinderGeometry(0.05, 0.062, 0.42, 4));
    const armL = new THREE.Group();
    const armLM = new THREE.Mesh(armGeo, coatMat);
    armLM.position.y = -0.13;
    const handMat = skinMat;
    const handL = new THREE.Mesh(flatGeometry(new THREE.SphereGeometry(0.045, 5, 4)), handMat);
    handL.position.y = -0.36;
    armL.add(armLM, handL);
    armL.position.set(-0.26, 0.58, 0);
    const armR = new THREE.Group();
    const armRM = new THREE.Mesh(armGeo.clone(), coatMat);
    armRM.position.y = -0.13;
    const handR = new THREE.Mesh(flatGeometry(new THREE.SphereGeometry(0.045, 5, 4)), handMat);
    handR.position.y = -0.36;
    armR.add(armRM, handR);
    armR.position.set(0.26, 0.58, 0);
    g.add(armL, armR);

    // --- anime head: live face, big eyes, unique hair ---
    const headG = new THREE.Group();
    const headGeo = flatGeometry(new THREE.SphereGeometry(0.15, 7, 5));
    const skull = new THREE.Mesh(headGeo, skinMat);
    skull.scale.set(0.95, 1.1, 0.98);
    skull.position.y = 0.96;
    headG.add(skull);
    const hairStyle = this.npcHairStyle(n);
    buildAnimeHair(headG, {
      cx: 0, cy: 1.06, cz: -0.02, radius: 0.145,
      color: this.npcHairColor(n), style: hairStyle,
    });
    buildAnimeEyes(headG, {
      cx: 0, cy: 0.97, cz: 0.12, dist: 0.095, radius: 0.045,
      iris: this.npcEyeColor(n), width: 0.028,
    });
    buildAnimeMouth(headG, { cx: 0, cy: 0.84, cz: 0.13, width: 0.045, color: 0x9c4a48 });
    // eyebrows (per expression)
    const browMat = makeToon(this.npcHairColor(n), { toon: true });
    for (const s of [-1, 1]) {
      const brow = new THREE.Mesh(flatGeometry(new THREE.BoxGeometry(0.06, 0.013, 0.013)), browMat);
      brow.position.set(s * 0.07, 1.02, 0.14);
      brow.rotation.z = s * -0.12;
      headG.add(brow);
    }
    g.add(headG);
    n.armL = armL;
    n.armR = armR;
    n.headG = headG;

    // --- headgear / accessories (style depends on the owner) ---
    const hatMat = makeToon(this.npcHatColor(n), { rimStrength: 0.4 });
    const hatType = n.id === 'rook' || n.id === 'bellsong' ? 'cap'
      : n.id === 'madame' ? 'hat'
      : n.id === 'echowisp' || n.id === 'shade' ? 'hood'
      : n.id === 'harbormaster' ? 'beret'
      : n.id === 'tinker' ? 'goggles'
      : 'cap';
    const hat = this.npcHat(hatType, hatMat);
    hat.position.y = 1.08;
    g.add(hat);

    // props per character
    if (n.id === 'lamplighter') {
      const lantern = new THREE.Mesh(
        flatGeometry(new THREE.BoxGeometry(0.1, 0.26, 0.08)),
        makeToon(0xd4a559, { emission: 0xffcf8a, emissionBias: 1.1 })
      );
      lantern.position.set(0.34, 0.32, 0);
      g.add(lantern);
    } else if (n.id === 'rook') {
      const badge = new THREE.Mesh(
        flatGeometry(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 5)),
        makeToon(0xd4a559, { emission: 0xd4a559, emissionBias: 0.7 })
      );
      badge.rotation.x = Math.PI / 2;
      badge.position.set(0.16, 0.55, 0.2);
      g.add(badge);
    } else if (n.id === 'harbormaster') {
      const wheel = new THREE.Mesh(
        flatGeometry(new THREE.TorusGeometry(0.12, 0.02, 4, 8)),
        makeToon(0x8f6a2e, { rimStrength: 0.5 })
      );
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(0.34, 0.48, -0.06);
      g.add(wheel);
    } else if (n.id === 'shade' || n.id === 'echowisp') {
      // ghost NPCs: faint inner glow
      const ghostGlow = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.5, 0),
        new THREE.MeshBasicMaterial({
          color: 0x7c8ea3, transparent: true, opacity: 0.35,
          side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      ghostGlow.position.y = 0.55;
      g.add(ghostGlow);
    }

    g.rotation.x = 0.08;
    return g;
  }

  npcHat(type, hatMat) {
    const hat = new THREE.Group();
    const g0 = new THREE.Group();
    if (type === 'goggles') {
      const band = new THREE.Mesh(flatGeometry(new THREE.BoxGeometry(0.3, 0.06, 0.04)), hatMat);
      band.position.y = 0.05;
      g0.add(band);
      const glassGeo = flatGeometry(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 8));
      glassGeo.rotateZ(Math.PI / 2);
      for (const s of [-1, 1]) {
        const glass = new THREE.Mesh(glassGeo, makeToon(0x9fe0d8, { emission: 0x4a8f9a, emissionBias: 0.7 }));
        glass.position.set(s * 0.1, 0.05, 0.02);
        g0.add(glass);
      }
      return hat;
    }
    if (type === 'cap') {
      const top = new THREE.Mesh(flatGeometry(new THREE.CylinderGeometry(0.18, 0.2, 0.05, 7)), hatMat);
      top.position.y = 0.02;
      const dome = new THREE.Mesh(flatGeometry(new THREE.SphereGeometry(0.16, 6, 4)), hatMat);
      dome.scale.y = 0.6;
      dome.position.y = 0.08;
      g0.add(top, dome);
    } else if (type === 'hat') {
      const brim = new THREE.Mesh(flatGeometry(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 8)), hatMat);
      const crown = new THREE.Mesh(flatGeometry(new THREE.CylinderGeometry(0.13, 0.16, 0.22, 7)), hatMat);
      crown.position.y = 0.12;
      const band = new THREE.Mesh(flatGeometry(new THREE.TorusGeometry(0.145, 0.018, 4, 7)), hatMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.11;
      g0.add(brim, crown, band);
    } else if (type === 'hood') {
      const hood = new THREE.Mesh(flatGeometry(new THREE.ConeGeometry(0.24, 0.34, 6, 1)), hatMat);
      hood.position.y = 0.08;
      g0.add(hood);
    } else if (type === 'beret') {
      const beret = new THREE.Mesh(flatGeometry(new THREE.SphereGeometry(0.19, 6, 4)), hatMat);
      beret.scale.y = 0.45;
      beret.position.y = 0.07;
      g0.add(beret);
    }
    hat.add(g0);
    return hat;
  }

  npcBaseColor(n) {
    const map = {
      rook: 0x3a4a5a, tinker: 0x4a3f35, madame: 0x3a2b33, echowisp: 0x2c3a44,
      lamplighter: 0x3a3f4a, harbormaster: 0x2c4244, bellsong: 0x39423a, shade: 0x2a3038,
    };
    return map[n.id] || 0x3a3336;
  }

  npcHatColor(n) {
    const map = {
      rook: 0x262b33, tinker: 0x2b2416, madame: 0x241a26, echowisp: 0x20303c,
      lamplighter: 0x222c38, harbormaster: 0x1f2e30, bellsong: 0x272e28, shade: 0x202426,
    };
    return map[n.id] || 0x262b33;
  }

  npcHairStyle(n) {
    const map = {
      rook: 'short', tinker: 'spiky', madame: 'bob', echowisp: 'hood',
      lamplighter: 'short', harbormaster: 'bob', bellsong: 'short', shade: 'hood',
    };
    return map[n.id] || 'short';
  }

  npcHairColor(n) {
    const map = {
      rook: 0x2a2f38, tinker: 0x6b4a32, madame: 0x2a1a2c, echowisp: 0x3a524f,
      lamplighter: 0x7a4a2c, harbormaster: 0x203c42, bellsong: 0x33403a, shade: 0x2a3238,
    };
    return map[n.id] || 0x2a2118;
  }

  npcEyeColor(n) {
    const map = {
      rook: 0x2a5f7f, tinker: 0x8f5a2e, madame: 0x8f4a7f, echowisp: 0x7ee0c8,
      lamplighter: 0xffb45a, harbormaster: 0x4a9a9a, bellsong: 0x5f7f2a, shade: 0x9fb2c4,
    };
    return map[n.id] || 0x2a5f7f;
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

  async testRelay() {
    const base = String(localStorage.getItem('nuar_tts_relay') || '').replace(/\/+$/, '');
    if (!base) { this.hud.toast('Адрес релея не задан.'); return; }
    this.hud.toast('Проверяю релей…');
    try {
      const r = await fetch(base + '/health');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      this.hud.toast(`Релей отвечает: ${j.service || 'ok'}`);
      this.screens.refreshVoiceCaps();
    } catch (e) {
      this.hud.toast('Релей недоступен: ' + (e.message || e));
    }
  }

  previewVoice() {
    // превью не должно включать выключенную озвучку — пользователь явно
    // нажал «прослушать», значит озвучка ему нужна
    const wasEnabled = this.voice.enabled;
    this.voice.setEnabled(true);
    this.voice.speak('Туман красив, но улицы помнят всё.', { mask: this.voice.profile || '', rate: 0.95, pitch: 1 });
    if (!wasEnabled) {
      setTimeout(() => { if (!this.voice.speaking) this.voice.setEnabled(false); }, 1200);
    }
  }

  // ---------- game flow ----------
  startGame() {
    this.audio.init();
    this.audio.resume();
    this.mode = 'explore';
    this.exploreMode = false;
    this.minimap.show();
    this.screens.hideTitle();
    this.screens.hidePause();
    this.screens.hideMap();
    this.screens.hideLoad();
    document.getElementById('screen-ending').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.touch.enable();
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
    this.hud.toast('Дело №7: «Фонарь Моррова». Удачи, ' + this.persona.label + '.');
    this.hud.showHint('ПК: W/A/S/D — движение, Пробел — прыжок, F — взаимодействие. Мобилка: джойстик слева.', true);
    setTimeout(() => this.hud.hideHint(), 5000);
  }

  startExplore() {
    this.audio.init();
    this.audio.resume();
    this.mode = 'explore';
    this.exploreMode = true;
    this.minimap.show();
    this.screens.hideTitle();
    this.screens.hidePause();
    this.screens.hideMap();
    this.screens.hideLoad();
    document.getElementById('screen-ending').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.touch.enable();
    this.player.reset();
    this.player.pos.set(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z);
    this.deck = [...STARTER_DECK];
    this.flags = { explore: true };
    this.seed = 'truth';
    this.player.inventory.clear();
    // режим исследования: город полностью открыт, все способности доступны
    this.player.abilities.dash = true;
    this.player.abilities.jump = true;
    this.player.abilities.wall = true;
    this.player.abilities.lens = true;
    this.updateHud();
    this.hud.setCase('Свободный город · ' + this.persona.label);
    this.hud.toast('Режим исследования: город Ноктис открыт. Играйте за ' + this.persona.label + ' — всё разрешено.');
    this.hud.showHint('Прыжок — дважды для двойного, Shift — рывок, F — общение. Пробуйте транспорт и все уголки города.', true);
    setTimeout(() => this.hud.hideHint(), 6000);
  }

  setPersona(p) {
    this.persona = savePersona(p);
    if (this.player && p.body) this.player.applyBody(p.body);
  }

  toTitle() {
    this.mode = 'title';
    if (this.voice) this.voice.stop();
    this.screens.showTitle();
    document.getElementById('hud').classList.add('hidden');
    this.screens.hideMap();
    this.screens.hidePause();
    this.screens.hideLoad();
    document.getElementById('screen-ending').classList.add('hidden');
    this.touch.disable();
  }

  // ---------- saves ----------
  newGame() {
    if (this.hasSave()) {
      if (!window.confirm('Есть сохранённое дело. Начать заново и стереть его?')) return;
      this.clearSave();
    }
    this.startGame();
  }

  hasSave() {
    try { return !!localStorage.getItem('nuar_save_v1'); } catch (e) { return false; }
  }

  clearSave() {
    try { localStorage.removeItem('nuar_save_v1'); } catch (e) { /* ignore */ }
  }

  saveInfoText() {
    try {
      const d = JSON.parse(localStorage.getItem('nuar_save_v1'));
      if (!d) return '';
      if (d.at) return 'Сохранение: ' + new Date(d.at).toLocaleString();
      return 'Сохранение есть';
    } catch (e) { return ''; }
  }

  saveGame() {
    try {
      const data = {
        v: 1,
        at: Date.now(),
        checkpoint: { ...this.checkpoint },
        flags: { ...this.flags },
        seed: this.seed,
        deck: [...this.deck],
        state: { hp: this.state.hp, maxHp: this.state.maxHp },
        inventory: [...this.player.inventory],
        abilities: { ...this.player.abilities },
        opened: this.world.chests.filter((c) => c.opened).map((c) => c.id),
        taken: this.world.items.filter((it) => it.taken).map((it) => it.key || it.id),
        dead: this.wisps.filter((w) => w.dead).map((w) => w.zone + '#' + w.baseX + ',' + w.baseZ),
        bossDefeated: !!this.bossDefeated,
        persona: this.persona ? this.persona.id : 'rook',
      };
      localStorage.setItem('nuar_save_v1', JSON.stringify(data));
      if (this.tutorial) this.tutorial.marksSwitches.save = true;
    } catch (e) { /* storage unavailable/full */ }
  }

  autosave() {
    if (this.mode === 'title' || this.exploreMode) return;
    this.saveGame();
  }

  continueGame() {
    if (!this.hasSave()) { this.startGame(); return; }
    this.startGame();
    this.loadGame();
  }

  loadGame() {
    const raw = localStorage.getItem('nuar_save_v1');
    if (!raw) return false;
    try {
      const d = JSON.parse(raw);
      this.checkpoint = d.checkpoint || { x: 0, y: 1.2, z: 22 };
      this.flags = d.flags || {};
      if (d.persona && PERSONAS.some((p) => p.id === d.persona)) {
        this.persona = personaById(d.persona);
        this.player.applyBody(this.persona.body);
      }
      this.seed = d.seed || 'truth';
      this.deck = Array.isArray(d.deck) ? [...d.deck] : [...STARTER_DECK];
      if (d.state) {
        this.state.hp = d.state.hp;
        this.state.maxHp = d.state.maxHp;
      }
      this.player.inventory.clear();
      for (const k of d.inventory || []) this.player.inventory.add(k);
      const ab = d.abilities || {};
      this.player.abilities.dash = !!ab.dash;
      this.player.abilities.jump = !!ab.jump;
      this.player.abilities.wall = !!ab.wall;
      this.player.abilities.lens = !!ab.lens;
      const opened = new Set(d.opened || []);
      for (const c of this.world.chests) c.opened = opened.has(c.id);
      const taken = new Set(d.taken || []);
      for (const it of this.world.items) {
        const key = it.key || it.id;
        it.taken = taken.has(key);
        if (it.taken) {
          it.mesh.visible = false;
          it.halo.visible = false;
          it.ring.visible = false;
          it.glint.visible = false;
        }
      }
      const dead = new Set(d.dead || []);
      for (const w of this.wisps) {
        const key = w.zone + '#' + w.baseX + ',' + w.baseZ;
        if (dead.has(key)) { w.dead = true; if (w.mesh) w.mesh.visible = false; }
      }
      this.bossDefeated = !!d.bossDefeated;
      this.mount = null;
      this.player.vel.set(0, 0, 0);
      this.player.pos.set(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z);
      this.cameraYaw = Math.PI;
      this.cameraPitch = -0.12;
      this.checkGatesAuto(false);
      this.updateHud();
      this.hud.showHint('Сохранённое дело продолжено.', true);
      setTimeout(() => this.hud.hideHint(), 2600);
      return true;
    } catch (e) {
      return false;
    }
  }

  togglePause() {
    if (this.mode === 'explore') {
      this.mode = 'pause';
      if (this.voice) this.voice.stop();
      this.screens.showPause();
    }
  }

  toggleSound() {
    this.audio.toggleMute();
  }

  toggleVoice() {
    const on = this.voice.toggle();
    if (!on) this.voice.stop();
    this.hud.toast(on ? 'Озвучка реплик: вкл' : 'Озвучка реплик: выкл');
  }

  setTimeMode(mode) {
    this.timeMode = mode;
    localStorage.setItem('nuar_time_mode', mode);
  }

  // множитель скорости времени: устройство-режим синхронизирован всегда,
  // единственный тумблер — «остановка времени» (полезно в найт-сценах)
  getTimeScale() {
    if (this.mode === 'pause' || this.timeMode === 'pause') return 0;
    return 1;
  }

  applyDayNight(dayFactor) {
    if (Math.abs(dayFactor - this._lastDayFactor) < 0.002) return;
    this._lastDayFactor = dayFactor;
    // туман мира: ночью тёмный нуар, днём — светлая дымка
    if (this.scene.fog) {
      this.scene.fog.color.copy(this.fogNight).lerp(this.fogDay, dayFactor);
    }
  }

  resumeFromPause() {
    if (this.mode === 'pause' || this.mode === 'map' || this.mode === 'inventory' || this.mode === 'explore') {
      this.mode = 'explore';
      this.screens.hidePause();
      this.screens.hideMap();
      this.screens.hideInventory();
      this.touch.enable();
    }
  }

  toggleMap() {
    if (this.mode === 'explore' || this.mode === 'pause') {
      this.mode = 'map';
      this.screens.showMap();
      this.screens.updateMap(this.world, this.player.pos, this.flags);
      this.touch.disable();
    } else if (this.mode === 'map') {
      this.mode = 'explore';
      this.screens.hideMap();
      this.touch.enable();
    }
  }

  toggleInventory() {
    if (this.mode === 'explore' || this.mode === 'pause') {
      this.mode = 'inventory';
      this.screens.showPause();
      this.screens.showInventory();
      this.screens.showInvTab('deck');
      this.touch.disable();
    } else if (this.mode === 'inventory') {
      this.mode = 'explore';
      this.screens.hideInventory();
      this.screens.hidePause();
      this.touch.enable();
    }
  }

  // ---------- заставки ----------
  playWorldIntro(after) {
    if (this.cinematic.playing) return;
    this.audio.init();
    this.audio.resume();
    const wasMode = this.mode;
    this.mode = 'intro';
    this.screens.hideTitle();
    this.screens.hidePause();
    this.screens.hideInventory();
    this.touch.disable();
    this.cinematic.play(WORLD_INTRO, () => {
      // восстанавливаем режим, из которого заставка была запущена
      this.mode = wasMode;
      if (after) { after(); return; }
      if (wasMode === 'title') this.toTitle();
      else this.resumeFromPause();
    });
  }

  playPersonaIntro(p, after) {
    if (this.cinematic.playing) return;
    this.audio.init();
    this.audio.resume();
    const persona = p || this.persona;
    this.persona = persona;
    if (this.player && persona.body) this.player.applyBody(persona.body);
    this.mode = 'intro';
    this.screens.hideTitle();
    this.touch.disable();
    this.cinematic.play(personaIntroFor(persona), () => {
      this.mode = 'title';
      if (after) after();
      else this.toTitle();
    });
  }

  setCameraMode(mode) {
    if (!['orbit', 'top', 'fps'].includes(mode)) return;
    this.cameraMode = mode;
    localStorage.setItem('nuar_cam_mode', mode);
    this.screens.setCameraMode(mode);
    const names = { orbit: 'сбоку (обзор)', top: 'сверху', fps: 'от первого лица' };
    this.hud.toast('Камера: ' + names[mode]);
  }

  inventoryData() {
    const deck = this.deck.map((id) => CARDS[id]).filter(Boolean).map((c) => ({
      name: c.name, kind: c.kind, art: c.art, desc: c.desc, cost: c.cost,
    }));
    const clues = [];
    const used = new Set();
    for (const it of this.world.items) {
      if (!it.taken) continue;
      if (it.key && !this.player.inventory.has(it.key)) continue;
      if (it.key) used.add(it.key);
      clues.push({ icon: it.icon || '✦', name: it.label, meta: 'улика', desc: it.room ? 'Найдено в Ноктисе' : '' });
    }
    for (const key of this.player.inventory) {
      if (used.has(key)) continue;
      clues.push({ icon: '🗝', name: key, meta: 'улика', desc: '' });
    }
    const tools = [];
    const ab = this.player.abilities;
    if (ab.dash) tools.push({ icon: '➤', name: 'Дымополёт', meta: 'рывок', desc: 'Рывок вперёд (Shift)' });
    if (ab.jump) tools.push({ icon: '✦', name: 'Двоение тени', meta: 'способность', desc: 'Двойной прыжок в воздухе' });
    if (ab.wall) tools.push({ icon: '🕸', name: 'Свод теней', meta: 'способность', desc: 'Выход на стены и потолки' });
    if (ab.lens) tools.push({ icon: '🔍', name: 'Зрение личины', meta: 'способность', desc: 'Следы и улики светятся (L)' });
    return { deck, clues, tools };
  }

  updateHud() {
    this.hud.setLogs(this.buildLogs());
    this.hud.setAbilities(this.player.abilities);
    if (this.exploreMode) this.hud.setCase('Свободный город · ' + (this.persona ? this.persona.label : ''));
    else this.hud.setCase('Дело №7 · Фонарь Моррова');
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
    if (this.tutorial) this.tutorial.marksSwitches.dialogue = true;
    const chosen = this.dialogue.choices[i];
    this.dialogue.choose(i);
    if (this.dialogue.active) {
      // реплика, которую произносит игрок, — голосом выбранной персоны
      if (chosen && this.voice && this.voice.enabled) {
        this.voice.speak(chosen.label, this.persona ? this.persona.profile : null, { queue: true });
      }
      this.dialogueUI.render(this.dialogue);
    } else {
      this.dialogueUI.close();
      this.mode = 'explore';
      this.audio.sfx('dialogue');
      this.voice.stop();
    }
  }

  onDialogueSpeak(d) {
    if (!d || !d.text) return;
    this.voice.speak(d.text, voiceFor(d.speaker), { queue: true });
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
    if (this.mount) {
      // в фиакре F пересаживает между местами, в остальном транспорте — выход
      if (this.mount.veh.cab) this.swapSeat();
      else this.dismount(true);
      return;
    }
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
      if (!this.chestReach(c, p)) continue;
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
    // near an unreachable chest? tell the player why the press did nothing
    for (const c of this.world.chests) {
      if (c.opened) continue;
      const dx = p.x - c.pos.x, dz = p.z - c.pos.z;
      if (dx * dx + dz * dz < 64) {
        if (p.y < c.pos.y - 3.5) this.hud.toast('Сундук выше — заберитесь наверх.');
        else this.hud.toast('Подойдите к сундуку ближе.');
        return;
      }
    }
    // transport
    const v = this.findVehicleNear();
    if (v) { this.board(v); }
  }

  chestReach(c, p) {
    const dx = p.x - c.pos.x, dz = p.z - c.pos.z;
    return dx * dx + dz * dz < 36 && Math.abs(p.y - c.pos.y) < 4;
  }

  // ---------------- riding / transport ----------------
  findVehicleNear() {
    const p = this.player.pos;
    let best = null, bd = 25;
    for (const v of this.world.traffic) {
      const m = v.mesh.position;
      const dx = p.x - m.x, dz = p.z - m.z;
      const dd = dx * dx + dz * dz;
      if (dd < bd) { bd = dd; best = v; }
    }
    return best;
  }

  board(v) {
    this.pendingVehicle = v;
    const canDrive = !!v.cab;
    // у трамвая/автобуса водителя нет — предлагаем только пассажира
    document.getElementById('btn-seat-driver').classList.toggle('hidden', !canDrive);
    document.getElementById('seat-choice').classList.remove('hidden');
    this.audio.sfx('chest');
  }

  // пересадка места на ходу: F в машине меняет водитель/пассажир
  swapSeat() {
    const m = this.mount;
    if (!m || !m.veh.cab) return;
    const asDriver = !m.driver;
    m.veh.playerDriven = asDriver;
    if (asDriver && m.veh.baseSpeed === undefined) m.veh.baseSpeed = m.veh.speed;
    if (!asDriver && m.veh.baseSpeed !== undefined) m.veh.speed = m.veh.baseSpeed;
    m.driver = asDriver;
    m.seatOffset = asDriver ? 0 : 0.7;
    this.hud.toast(asDriver ? 'Вы пересели за руль. W/S — газ, A/D — поворот.' : 'Вы пересели на пассажирское место.');
    this.audio.sfx('ui');
  }

  confirmBoard(asDriver) {
    const v = this.pendingVehicle;
    if (!v) return;
    if (this.tutorial) this.tutorial.marksSwitches.transport = true;
    this.pendingVehicle = null;
    document.getElementById('seat-choice').classList.add('hidden');
    const seatY = v.cab ? 1.15 : v.tram ? 0.7 : 0.95;
    if (asDriver && v.baseSpeed === undefined) v.baseSpeed = v.speed;
    this.mount = {
      veh: v,
      seat: new THREE.Vector3(0, seatY, 0),
      driver: asDriver,
      seatOffset: asDriver ? 0 : 0.7,
    };
    this.hud.toast(asDriver
      ? 'Вы за рулём! W/S — газ и тормоз, A/D — поворот, выход — F или пробел.'
      : 'Вы пассажир. Транспорт едет по маршруту, выход — F или пробел.');
    this.audio.sfx('chest');
  }

  dismount(hop) {
    const v = this.mount.veh;
    if (this.mount.driver) {
      v.playerDriven = false;
      if (v.baseSpeed !== undefined) v.speed = v.baseSpeed;
    }
    const m = v.mesh.position;
    const side = v.axis === 'z'
      ? (v.fixed < 0 ? -1 : 1)
      : (v.fixed < 0 ? -1 : 1);
    const ox = v.axis === 'z' ? 4 * -side : 0;
    const oz = v.axis === 'x' ? 4 * -side : 0;
    this.player.pos.set(m.x + ox, Math.max(0.3, m.y + 0.3), m.z + oz);
    this.player.vel.set((v.axis === 'z' ? ox : oz) * 1.5, hop ? 8 : 0, (v.axis === 'x' ? ox : oz) * 1.5);
    this.player.grounded = false;
    this.mount = null;
    this.player.facing.set(ox || 1, 0, oz || 0).normalize();
  }

  updateMount(dt, t) {
    const v = this.mount.veh;
    const m = v.mesh;
    const s = this.mount.seat;
    // пассажир сидит сбоку от водителя — иначе он рисуется на месте водителя
    const lateral = (this.mount.seatOffset || 0) * (v.axis === 'z' ? 1 : 0);
    this.player.pos.set(
      m.position.x + s.x + (v.axis === 'z' ? lateral : 0),
      m.position.y + s.y,
      m.position.z + s.z + (v.axis === 'x' ? lateral : 0)
    );

    if (this.mount.driver && v.cab) {
      // водитель: газ по axis2D, поворот по axis.x, с инерцией и коастингом
      const axis = this.input.axis2D();
      const throttle = -axis.z; // W (z=-1) — вперёд
      const target = throttle * 14;
      // разгон плавный, торможение чуть резче; без газа — накат с трением
      const k = target === 0 && Math.abs(v.speed) > 0.4 ? 0.8 : 2.2;
      v.speed += (target - v.speed) * Math.min(1, dt * k);
      if (Math.abs(v.speed) < 0.1 && target === 0) v.speed = 0;
      if (Math.abs(axis.x) > 0.12 && Math.abs(v.speed) > 0.15) {
        const turnGain = Math.min(2.4, 0.9 + Math.abs(v.speed) * 0.08);
        v.mesh.rotation.y += axis.x * dt * turnGain * Math.sign(v.speed);
      }
      v.dir = v.speed >= 0 ? 1 : -1;
      v.playerDriven = true;
      this.player.mesh.rotation.y = v.mesh.rotation.y;
      this.player.facing.set(Math.sin(v.mesh.rotation.y), 0, Math.cos(v.mesh.rotation.y));
    } else {
      // пассажир: транспорт едет по своему маршруту
      v.playerDriven = false;
      const dx = v.axis === 'z' ? v.dir : 0;
      const dz = v.axis === 'x' ? v.dir : 0;
      if (dx !== 0 || dz !== 0) this.player.facing.set(dx, 0, dz).normalize();
      this.player.mesh.rotation.y = Math.atan2(dx, dz);
    }
    const bob = Math.sin(t * 4.5) * 0.02;
    this.player.mesh.position.set(this.player.pos.x, this.player.pos.y + 0.06 + bob, this.player.pos.z);
    this.player.grounded = true;
    this.player.animate(dt * 0.4, 4, 0);
  }

  // ---------- combat ----------
  startCombat(enemyId, wisp) {
    this.state.combatDeck = [...this.deck];
    this.state.hp = this.player.hp;
    this.state.maxHp = this.player.maxHp;
    this.mode = 'combat';
    document.body.classList.add('in-combat');
    this.combat = new Combat(this.state);
    this.combat.startCombat(enemyId);
    this.activeWisp = wisp;
    this.combatUI.open(this.combat, this.state);
    this.holo.open(this.combat.enemy);
  }

  onCombatPlay(i) {
    const r = this.combat.play(i);
    if (r) {
      this.audio.sfx(r.card.fx.type === 'block' || r.card.fx.type === 'heal' ? 'card' : 'hit');
      this.holo.play(r);
    }
    if (this.combat.over) this.combatUI.render(this.combat, this.state);
    this.combatUI.render(this.combat, this.state);
    if (this.combat.over) this.resolveCombat();
  }

  onCombatEndTurn() {
    this.combat.endTurn();
    this.audio.sfx('enemy');
    this.holo.enemyTurn();
    this.combatUI.render(this.combat, this.state);
    if (this.combat.over) this.resolveCombat();
  }

  onCombatFlee() {
    if (!this.combat || this.combat.over) return;
    if (this.tutorial) this.tutorial.marksSwitches.flee = true;
    this.combat.retreat(); // just logs
    this.state.hp = Math.max(1, this.state.hp - 10);
    this.player.hp = this.state.hp;
    this.player.pos.set(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z);
    this.audio.sfx('jump');
    this.hud.toast('Вы выскользнули из тумана (−10 ❤).');
    if (this.activeWisp) this.activeWisp.dead = false;
    this.endCombatCleanup();
  }

  onCombatRetry() {
    if (!this.combat) return;
    const enemyId = this.combat.enemyId;
    this.state.hp = this.state.maxHp;
    this.player.hp = this.state.maxHp;
    this.combat.restartEnemy();
    this.holo.open(this.combat.enemy);
    this.combatUI.hideResult();
    this.combatUI.render(this.combat, this.state);
    this.audio.sfx('ui');
    this.hud.toast('Туман вновь сгущается. Бой начинается.');
  }

  onCombatGiveUp() {
    if (!this.combat) return;
    this.deathPenalty(10);
    this.endCombatCleanup();
  }

  onCombatToTitle() {
    this.combat = null;
    this.combatUI.close();
    this.holo.close();
    this.toTitle();
  }

  deathPenalty(hpPenalty) {
    this.state.hp = Math.max(1, this.state.hp - hpPenalty);
    this.player.hp = this.state.hp;
    this.player.pos.set(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z);
    this.audio.sfx('death');
    this.hud.toast('Туман смыкается... вы очнулись у чекпоинта.');
    if (this.activeWisp) this.activeWisp.dead = false;
    this.updateHud();
  }

  endCombatCleanup() {
    document.body.classList.remove('in-combat');
    this.combatUI.close();
    this.combat = null;
    this.mode = 'explore';
    this.holo.close();
    this.updateHud();
  }

  resolveCombat() {
    if (this.combat.won) {
      const enemyId = this.combat.enemyId;
      const rew = ENEMIES[enemyId]?.reward;
      if (rew) {
        for (const c of rew.cards) {
          if (CARDS[c]) this.deck.push(c);
        }
      }
      this.player.hp = Math.min(this.player.maxHp, this.state.hp + 18);
      if (enemyId === 'boss') {
        this.bossDefeated = true;
        this.effects.bursts.emit(new THREE.Vector3(-10, 2, -216), { count: 80, color: { r: 1, g: 0.5, b: 0.3 }, speed: 6, spread: 4, lift: 4, gravity: 2, size: 0.7 });
      } else if (this.activeWisp) {
        this.activeWisp.dead = true;
        this.effects.bursts.emit(this.activeWisp.mesh.position.clone(), { count: 34, color: { r: 0.9, g: 0.45, b: 0.35 }, speed: 4.5, spread: 1.8, lift: 3, gravity: 1.5, size: 0.55 });
      }
      this.autosave();
      this.audio.sfx('unlock');
      this.hud.toast('Победа! Туман отступает.');
      this.endCombatCleanup();
    } else {
      this.combatUI.showResult(this.combat);
      this.audio.sfx(this.combat.retreated ? 'jump' : 'death');
      this.hud.toast(this.combat.retreated ? 'Вы отступили.' : 'Туман сомкнулся.');
    }
    if (this.bossDefeated && !this.flags.finalShown) {
      this.flags.finalShown = true;
      this.mode = 'dialogue';
      this.dialogueUI.open(FINAL);
      this.dialogueUI.speaker.textContent = FINAL.speaker;
      this.dialogueUI.text.textContent = FINAL.text;
      this.dialogueUI.choices.innerHTML = '';
      this.onDialogueSpeak(FINAL);
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
    this.voice.stop();
    document.getElementById('ending-title').textContent = e.title;
    document.getElementById('ending-text').textContent = e.text;
    document.getElementById('screen-ending').classList.remove('hidden');
    this.dialogueUI.close();
    this.combatUI.close();
  }

  // ---------- per-frame update ----------
  loop() {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const raw = this.lastFrameTime ? (now - this.lastFrameTime) / 1000 : 0.05;
    this.lastFrameTime = now;
    // fixed-step accumulator: world runs at real speed even at low fps
    this.stepAcc = (this.stepAcc || 0) + Math.min(raw, 0.25);
    let steps = 0;
    while (this.stepAcc >= 0.05 && steps < 8) {
      this.stepAcc -= 0.05;
      this.clock.elapsedTime += 0.05;
      this.update(0.05);
      steps++;
    }
    this.renderer.render(this.scene, this.camera);
    this.minimap.render();
  }

  update(dt) {
    const t = this.clock.elapsedTime;
    // суточный цикл
    const timeScale = this.getTimeScale();
    if (timeScale > 0) this.timeCycle.update(dt * timeScale);
    const dayFactor = this.timeCycle.dayFactorF || 0;
    this.sky.update(t, dayFactor);
    this.applyDayNight(dayFactor);
    this.world.updateFog(t, dayFactor);
    this.effects.update(dt, t, this.camera.position);
    this.glow.update(t, dayFactor);
    this.hud.setClock(
      this.timeCycle.hour, this.timeCycle.minute, this.timeCycle.second, dayFactor
    );
    this.effects.rain.points.visible = this.player.pos.y > -5;
    this.holo.update(t, dt);

    if (this.mode === 'ending') {
      this.driftCamera(dt);
      return;
    }

    if (this.mode === 'intro') {
      this.cinematic.update(dt);
      this.animateProps(dt);
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
      if (input.inventory) this.toggleInventory();

      if (this.mount && input.jumpSpace) this.dismount(true);

      if (this.mount) {
        this.updateMount(dt, t);
      } else {
        this.player.update(dt * 1.0, this.input, this.cameraYaw, this.setupGateSolids());
      }
      this.updateCamera(dt, input);
      this.minimap.update(dt);
      this.updateInteractions();
      this.checkZones();
      this.checkTransitions();
      this.player.mesh.visible = true;

      // enemy wisps
      this.updateWisps(dt);
      this.updateCrowd(dt, t);

      // boss trigger
      this.checkBossTrigger();
    } else if (this.mode === 'dialogue') {
      this.input.consume();
    } else if (this.mode === 'map') {
      if (input.map || input.pause) this.toggleMap();
    } else if (this.mode === 'inventory') {
      if (input.map || input.pause || input.inventory) this.toggleInventory();
      this.input.consume();
    } else if (this.mode === 'pause') {
      if (input.pause) { this.resumeFromPause(); }
      this.input.consume();
    } else if (this.mode === 'combat') {
      this.driftCamera(dt);
    }
    this.animateProps(dt);
    this.updateAmbience(dt);
    this.tutorial.update();
  }

  // location-based ambience crossfade + altitude-scaled wind
  updateAmbience(dt) {
    const p = this.player.pos;
    const zone = (x, z, r) => {
      const dx = (p.x - x) / r;
      const dz = (p.z - z) / r;
      return Math.exp(-(dx * dx + dz * dz));
    };
    this.audio.setZone('bar', zone(32, 3, 26));
    this.audio.setZone('plaza', zone(64, -33, 30));
    this.audio.setZone('harbor', zone(196, 122, 44));
    this.audio.setZone('drain', zone(132, 12, 24));
    this.audio.setWind(Math.max(0, Math.min(1, p.y / 26 + zone(84, 4, 40) * 0.5)));
    void dt;
  }

  setupGateSolids() {
    return this.gateColliders;
  }

  updateCamera(dt, input) {
    const p = this.player;
    const joyX = this.input.camJoyX;
    const joyY = this.input.camJoyY;
    const keyCam = this.input.camHeld;

    // camera mode: V cycles, 1/2/3 and HUD buttons pick a specific view
    if (input.camModeSet) {
      this.setCameraMode(input.camModeSet);
      if (this.tutorial) this.tutorial.marksSwitches.camera = true;
    }
    if (input.camMode) {
      const modes = ['orbit', 'fps', 'top'];
      const idx = modes.indexOf(this.cameraMode);
      this.setCameraMode(modes[(idx + 1) % modes.length]);
      if (this.tutorial) this.tutorial.marksSwitches.camera = true;
    }

    if (this.cameraMode === 'fps') {
      const yawRate = -(keyCam * 2.7 + joyX * 2.7) * (this.cameraInverted ? -1 : 1);
      if (yawRate !== 0) this.cameraYaw += yawRate * dt;
      if (joyY !== 0) {
        this.cameraPitch = Math.max(-1.2, Math.min(1.2, this.cameraPitch + joyY * 1.4 * dt));
      }
      p.mesh.rotation.y = this.cameraYaw;
      const headY = p.pos.y + p.headHeight;
      this.camera.position.set(p.pos.x, headY, p.pos.z);
      const dir = new THREE.Vector3(
        Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
        Math.sin(this.cameraPitch),
        Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
      );
      this.camera.lookAt(p.pos.x + dir.x, headY + dir.y, p.pos.z + dir.z);
      return;
    }

    if (this.cameraMode === 'top') {
      const dist = 28;
      const targetX = p.pos.x;
      const targetZ = p.pos.z;
      const targetY = p.pos.y + dist;
      this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, dt * 5);
      this.camera.position.y += (targetY - this.camera.position.y) * Math.min(1, dt * 5);
      this.camera.position.z += (targetZ - this.camera.position.z) * Math.min(1, dt * 5);
      this.camera.lookAt(p.pos.x, p.pos.y, p.pos.z);
      return;
    }

    // ORBIT (default)
    const yawRate = -(keyCam * 2.7 + joyX * 2.7) * (this.cameraInverted ? -1 : 1);
    if (yawRate !== 0) this.cameraYaw += yawRate * dt;

    if (joyY !== 0) {
      this.cameraPitch = Math.max(-0.6, Math.min(0.9, this.cameraPitch + joyY * 1.4 * dt));
    }

    const aspect = this.camera.aspect;
    const portrait = aspect < 1;
    const dist = portrait ? 11.5 : 9;
    const hy = portrait ? 3.6 : 3.1;
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
    if (this.mount) {
      near = { text: this.mount.veh.cab
        ? (this.mount.driver ? 'За рулём: W/S газ, A/D поворот · F — пересесть, пробел — выйти' : 'Пассажир: F — пересесть за руль, пробел — выйти')
        : 'Выйти из транспорта — F или пробел', interact: true };
    } else {
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
          if (!this.chestReach(c, p)) continue;
          near = { text: `Сундук — F`, interact: true };
          break;
        }
      }
      if (!near && this.findVehicleNear()) {
        const v = this.findVehicleNear();
        near = { text: v.cab ? 'Сесть в фиакр — F' : 'Сесть на транспорт — F', interact: true };
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
          // чекпоинт — точка входа в зону, а не её центр:
          // центр может оказаться внутри стены, и возрождение выкинет игрока
          // в геометрию или в пропасть
          this.checkpoint = { x: p.x, y: Math.max(1.2, p.y), z: p.z };
          this.autosave();
        }
      }
    }
  }

  checkTransitions() {
    const p = this.player.pos;
    for (const tr of this.world.transitions) {
      if (p.x >= tr.minX && p.x <= tr.maxX && p.z >= tr.minZ && p.z <= tr.maxZ && p.y >= tr.minY && p.y <= tr.maxY) {
        if (this.mount) this.dismount(false);
        this.audio.sfx('dash');
        this.player.pos.set(tr.toX, tr.toY, tr.toZ);
        this.player.vel.set(0, 0, 0);
        // чекпоинт ставим в точку прибытия — она гарантированно «на земле»
        if (tr.take) this.checkpoint = { x: tr.toX, y: Math.max(1.2, tr.toY), z: tr.toZ };
        if (tr.take) this.autosave();
        this.hud.toast(tr.take === 'down' ? 'Спуск в цистерну' : 'Подъём на рынок');
        return;
      }
    }
  }

  // удар кулаком: расталкивает прохожих вокруг и разгоняет виспов в радиусе
  playerAttack(pos, dir) {
    const range = 1.9;
    const ang = 1.2;
    if (this.world.peds) {
      for (const ped of this.world.peds) {
        if (ped.activity !== null || !ped.fig || !ped.fig.g) continue;
        const fx = ped.fig.g.position.x, fz = ped.fig.g.position.z;
        const dx = fx - pos.x, dz = fz - pos.z;
        if (Math.hypot(dx, dz) > range) continue;
        if (dir && Math.hypot(dx, dz) > 0.001) {
          const dot = (dx * dir.x + dz * dir.z) / Math.hypot(dx, dz);
          if (dot < -ang) continue;
        }
        ped.fig.g.position.x += dx * 0.45;
        ped.fig.g.position.z += dz * 0.45;
        ped._bump = 0.5;
        this.audio.sfx('hit');
      }
    }
    for (const w of this.wisps) {
      if (w.dead) continue;
      const dx = w.x - pos.x, dz = w.z - pos.z;
      if (Math.hypot(dx, dz) > range + 0.4) continue;
      w.x += dx * 0.8;
      w.z += dz * 0.8;
      w.mesh.position.x = w.x;
      w.mesh.position.z = w.z;
      this.effects.wispHit(new THREE.Vector3(w.x, 1.6, w.z));
      this.audio.sfx('hit');
    }
  }

  // толпа: прохожие осязаемы — тело мешает пройти, при контакте толчок,
  // звук и короткая озвученная реплика («крик прохожего»)
  updateCrowd(dt, t) {
    if (this.mount || !this.world.peds) return;
    const R2 = 0.75 * 0.75;
    const p = this.player.pos;
    if (this._crowdBumpCooldown) this._crowdBumpCooldown -= dt;
    const phrases = ['Осторожнее!', 'Эй, смотри куда идёшь!', 'Куда прёшь-то?', 'Посторонись, любезный!', 'Ах!'];
    for (const ped of this.world.peds) {
      if (ped.activity !== null || !ped.fig || !ped.fig.g) continue;
      const fx = ped.fig.g.position.x, fz = ped.fig.g.position.z;
      const dx = p.x - fx, dz = p.z - fz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R2) { ped._bump = 0; continue; }
      const dist = Math.sqrt(d2) || 0.01;
      const nx = dx / dist, nz = dz / dist;
      const overlap = 0.75 - dist;
      // раздвигаем обоих: прохожий отползает, игрока слегка отталкивает
      ped.fig.g.position.x -= nx * overlap * 0.55;
      ped.fig.g.position.z -= nz * overlap * 0.55;
      ped._bump = 0.3;
      if (ped._bumpReached) continue; // уже в контакте, реакции не повторяем
      ped._bumpReached = true;
      this.audio.sfx('hit');
      if (this._crowdBumpCooldown <= 0 && this.voice.enabled && !this.lensActive) {
        this._crowdBumpCooldown = 2.5;
        this.voice.speak(phrases[Math.floor(Math.random() * phrases.length)]);
      }
    }
    for (const ped of this.world.peds) {
      if (ped._bumpReached) {
        if (!(ped._bump > 0)) ped._bumpReached = false;
        if (ped._bump > 0) ped._bump -= dt;
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
    this.world.updateTraffic(dt, t);
    updatePedestrians(this.world.peds, this.world.pedsProps, dt, t, this.player.pos);
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
      // anime idle: arms sway, head drifts, slight breathing lean
      const breathe = Math.sin(t * 1.4 + n.bobPhase) * 0.02;
      if (n.armL) n.armL.rotation.z = 0.08 + Math.sin(t * 1.2 + n.bobPhase) * 0.06;
      if (n.armR) n.armR.rotation.z = -0.08 - Math.sin(t * 1.2 + n.bobPhase) * 0.06;
      if (n.armL) n.armL.rotation.x = Math.sin(t * 0.9 + n.bobPhase) * 0.05;
      if (n.armR) n.armR.rotation.x = -Math.sin(t * 0.9 + n.bobPhase) * 0.05;
      // оживший NPC: следит за игроком, когда тот подходит, и кивает
      const pdx = this.player.pos.x - n.pos.x;
      const pdz = this.player.pos.z - n.pos.z;
      const near = pdx * pdx + pdz * pdz < 36;
      if (near) {
        const want = Math.atan2(pdx, pdz);
        let rel = want - n.figure.rotation.y;
        while (rel > Math.PI) rel -= Math.PI * 2;
        while (rel < -Math.PI) rel += Math.PI * 2;
        n.figure.rotation.y += Math.max(-1, Math.min(1, rel)) * Math.min(1, dt * 3);
        n.headG.rotation.y = Math.max(-0.6, Math.min(0.6, rel)) * 0.7;
        n.headG.rotation.z = Math.sin(t * 3 + n.bobPhase) * 0.02;
      } else {
        if (n.headG) n.headG.rotation.y = Math.sin(t * 0.5 + n.bobPhase) * 0.08;
      }
      n.figure.rotation.x = 0.08 + breathe;
      n.figure.rotation.z = Math.sin(t * 1.1 + n.bobPhase) * 0.015;
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