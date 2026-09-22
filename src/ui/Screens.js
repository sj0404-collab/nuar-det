import { MapUI } from './MapUI.js';

export class Screens {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.title = document.getElementById('screen-title');
    this.credits = document.getElementById('screen-credits');
    this.pause = document.getElementById('screen-pause');
    this.settings = document.getElementById('screen-settings');
    this.map = document.getElementById('screen-map');
    this.loadScreen = document.getElementById('load-screen');

    document.getElementById('btn-start').addEventListener('click', () => {
      this.hooks.onStart && this.hooks.onStart();
    });
    document.getElementById('btn-credits').addEventListener('click', () => this.showCredits());
    document.getElementById('btn-back-title').addEventListener('click', () => this.showTitle());
    document.getElementById('btn-resume').addEventListener('click', () => this.hooks.onResume && this.hooks.onResume());
    document.getElementById('btn-map-full').addEventListener('click', () => { this.showMap(); });
    document.getElementById('btn-map-close').addEventListener('click', () => { this.hideMap(); this.hooks.onResume && this.hooks.onResume(); });
    document.getElementById('btn-to-title').addEventListener('click', () => this.hooks.onToTitle && this.hooks.onToTitle());
    document.getElementById('btn-map').addEventListener('click', () => this.hooks.onMap && this.hooks.onMap());
    document.getElementById('btn-menu').addEventListener('click', () => this.hooks.onPause && this.hooks.onPause());

    // settings screen
    const openSettings = () => this.showSettings();
    document.getElementById('btn-title-settings').addEventListener('click', () => { this._settingsFrom = 'title'; openSettings(); });
    document.getElementById('btn-pause-settings').addEventListener('click', () => { this._settingsFrom = 'pause'; openSettings(); });
    document.getElementById('btn-settings-back').addEventListener('click', () => {
      if (this._settingsFrom === 'pause') this.showPause();
      else this.showTitle();
    });
    const invertBtn = document.getElementById('btn-invert-joy');
    if (invertBtn) {
      invertBtn.addEventListener('click', () => {
        const cur = localStorage.getItem('nuar_invert_joy') === '1';
        localStorage.setItem('nuar_invert_joy', cur ? '0' : '1');
        this.hooks.onInvertJoy && this.hooks.onInvertJoy(!cur);
        invertBtn.textContent = 'Инверсия джойстика: ' + (!cur ? 'вкл' : 'выкл');
      });
    }
    const soundBtn = document.getElementById('btn-sound-toggle');
    if (soundBtn) {
      const refreshSound = () => {
        const muted = this.hooks.getSoundMuted ? this.hooks.getSoundMuted() : false;
        soundBtn.textContent = 'Звук: ' + (muted ? 'выкл' : 'вкл');
      };
      soundBtn.addEventListener('click', () => {
        this.hooks.onToggleSound && this.hooks.onToggleSound();
        refreshSound();
      });
      this._refreshSound = refreshSound;
    }
    const settingsSens = document.getElementById('settings-cam-sens-slider');
    if (settingsSens) {
      settingsSens.value = parseFloat(localStorage.getItem('nuar_cam_sens')) || 1.0;
      settingsSens.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.hooks.onCamSens) this.hooks.onCamSens(val);
      });
    }

    // camera sensitivity slider (pause)
    const sensSlider = document.getElementById('cam-sens-slider');
    if (sensSlider) {
      const saved = parseFloat(localStorage.getItem('nuar_cam_sens')) || 1.0;
      sensSlider.value = saved;
      sensSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.hooks.onCamSens) this.hooks.onCamSens(val);
      });
    }

    this.mapUI = new MapUI(document.getElementById('map-canvas'), document.getElementById('map-legend'));
  }

  showTitle() { this.title.classList.remove('hidden'); this.credits.classList.add('hidden'); this.pause.classList.add('hidden'); this.settings.classList.add('hidden'); this.map.classList.add('hidden'); if (this._refreshSound) this._refreshSound(); }
  showCredits() { this.credits.classList.remove('hidden'); this.title.classList.remove('hidden'); }
  hideTitle() { this.title.classList.add('hidden'); }
  showPause() { this.pause.classList.remove('hidden'); this.settings.classList.add('hidden'); }
  hidePause() { this.pause.classList.add('hidden'); }
  showSettings() {
    this.title.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.credits.classList.add('hidden');
    this.settings.classList.remove('hidden');
    const invertBtn = document.getElementById('btn-invert-joy');
    if (invertBtn) invertBtn.textContent = 'Инверсия джойстика: ' + (localStorage.getItem('nuar_invert_joy') === '1' ? 'вкл' : 'выкл');
    if (this._refreshSound) this._refreshSound();
  }
  hideSettings() { this.settings.classList.add('hidden'); }
  showMap() { this.map.classList.remove('hidden'); this.settings.classList.add('hidden'); }
  hideMap() { this.map.classList.add('hidden'); }

  hideLoad() { this.loadScreen.classList.add('hidden'); }
  showLoad() { this.loadScreen.classList.remove('hidden'); }

  setHud(hud) {
    document.getElementById('btn-map').addEventListener('click', () => this.hooks.onMap && this.hooks.onMap());
    document.getElementById('btn-menu').addEventListener('click', () => this.hooks.onPause && this.hooks.onPause());
  }

  updateMap(world, playerPos, flags) {
    this.mapUI.draw(world, playerPos, flags);
  }
}