// Проигрыватель заставки: ведёт камеру по кадрам сценария, показывает субтитры,
// озвучивает реплики голосовым движком и играет звуковые эффекты.
// Пропуск — клик, пробел или Esc.
import * as THREE from 'three';

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class Cinematic {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('intro-overlay');
    this.titleEl = document.getElementById('intro-title');
    this.subEl = document.getElementById('intro-sub');
    this.capEl = document.getElementById('intro-cap');
    this.skipEl = document.getElementById('intro-skip');
    this.barEl = document.getElementById('intro-bar');
    this.playing = false;
    this.shots = [];
    this.idx = 0;
    this.t = 0;
    this.onDone = null;
    this._from = new THREE.Vector3();
    this._to = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._lookTo = new THREE.Vector3();
    this._boundSkip = () => this.skip();
    this._boundKey = (e) => {
      if (!this.playing) return;
      if (e.key === ' ' || e.key === 'Escape' || e.key === 'Enter' || e.key === 'ы' || e.key === 'у') {
        e.preventDefault();
        this.skip();
      }
    };
    if (this.el) this.el.addEventListener('pointerdown', this._boundSkip);
  }

  play(seq, onDone) {
    if (!seq || !seq.shots || !seq.shots.length) { if (onDone) onDone(); return; }
    this.seq = seq;
    this.shots = seq.shots;
    this.onDone = onDone;
    this.idx = -1;
    this.t = 0;
    this.playing = true;
    if (this.el) this.el.classList.remove('hidden');
    if (this.subEl) this.subEl.textContent = seq.subtitle || '';
    if (this.el) this.el.style.setProperty('--intro-hue', seq.hue || '#d8b36a');
    window.addEventListener('keydown', this._boundKey);
    this.nextShot();
  }

  nextShot() {
    this.idx++;
    if (this.idx >= this.shots.length) { this.finish(); return; }
    const s = this.shots[this.idx];
    this.t = 0;
    if (this.titleEl) this.titleEl.textContent = s.title || '';
    if (this.capEl) this.capEl.textContent = '';
    this.voiceCue = '';
    // реплика кадра: у мира — голос рассказчика, у персоны — голос героя
    const isPersona = this.seq.id && this.seq.id !== 'world';
    const profile = isPersona && this.game.persona ? this.game.persona.profile : this.narrator;
    if (s.vo) {
      this.voiceCue = s.vo;
      if (this.game.voice && this.game.voice.enabled) this.game.voice.speak(s.vo, profile);
    }
    for (const [name, delay] of (s.sfx || [])) {
      setTimeout(() => {
        if (!this.playing) return;
        this.game.audio.sfx(name);
      }, delay * 1000);
    }
  }

  setNarrator(profile) { this.narrator = profile; }

  update(dt) {
    if (!this.playing) return;
    const s = this.shots[this.idx];
    if (!s) return;
    this.t += dt;
    const k = Math.min(1, this.t / s.dur);
    const e = ease(k);
    this._from.set(s.from.x, s.from.y, s.from.z);
    this._to.set(s.to.x, s.to.y, s.to.z);
    const cam = this.game.camera;
    cam.position.lerpVectors(this._from, this._to, e);
    this._look.set(s.look.x, s.look.y, s.look.z);
    this._lookTo.set(s.lookTo.x, s.lookTo.y, s.lookTo.z);
    this._look.lerp(this._lookTo, e);
    cam.lookAt(this._look);
    // субтитр появляется после первой трети кадра
    if (this.capEl && k > 0.12 && this.voiceCue) this.capEl.textContent = this.voiceCue;
    if (this.skipEl) this.skipEl.style.opacity = k > 0.15 ? '0.8' : '0';
    if (k >= 1) this.nextShot();
  }

  skip() {
    if (!this.playing) return;
    // быстрый финал: последний кадр показываем целиком и завершаем
    const last = this.shots[this.shots.length - 1];
    if (last && this.idx < this.shots.length - 1) {
      if (this.game.voice) this.game.voice.stop();
      this.idx = this.shots.length - 2;
      this.t = 0;
      this.nextShot();
      return;
    }
    this.finish();
  }

  finish() {
    this.playing = false;
    if (this.el) this.el.classList.add('hidden');
    if (this.capEl) this.capEl.textContent = '';
    if (this.titleEl) this.titleEl.textContent = '';
    window.removeEventListener('keydown', this._boundKey);
    if (this.game.voice) this.game.voice.stop();
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb();
  }
}
