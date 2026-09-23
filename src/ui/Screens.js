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
    const voiceBtn = document.getElementById('btn-voice-toggle');
    if (voiceBtn) {
      const refreshVoice = () => {
        const on = this.hooks.getVoiceEnabled ? this.hooks.getVoiceEnabled() : true;
        voiceBtn.textContent = 'Озвучка: ' + (on ? 'вкл' : 'выкл');
      };
      voiceBtn.addEventListener('click', () => {
        this.hooks.onToggleVoice && this.hooks.onToggleVoice();
        refreshVoice();
      });
      this._refreshVoice = refreshVoice;
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

    // время суток: синхрон с устройством ⇄ остановка
    const timeBtn = document.getElementById('btn-time-speed');
    if (timeBtn) {
      const cycle = ['device', 'pause'];
      const labels = { device: 'устройство', pause: 'стоп' };
      const refreshTime = () => {
        const cur = this.hooks.getTimeMode ? this.hooks.getTimeMode() : 'device';
        timeBtn.textContent = 'Время суток: ' + (labels[cur] || 'устройство');
      };
      timeBtn.addEventListener('click', () => {
        const cur = this.hooks.getTimeMode ? this.hooks.getTimeMode() : 'device';
        const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
        if (this.hooks.onTimeSpeed) this.hooks.onTimeSpeed(next);
        refreshTime();
      });
      this._refreshTime = refreshTime;
    }

    // horizontal camera invert toggle
    const invertCamBtn = document.getElementById('btn-invert-cam');
    if (invertCamBtn) {
      const refreshInvertCam = () => {
        const cur = localStorage.getItem('nuar_invert_cam') === '1';
        invertCamBtn.textContent = 'Инверсия камеры по горизонтали: ' + (cur ? 'вкл' : 'выкл');
      };
      invertCamBtn.addEventListener('click', () => {
        const cur = localStorage.getItem('nuar_invert_cam') === '1';
        localStorage.setItem('nuar_invert_cam', cur ? '0' : '1');
        this.hooks.onInvertCam && this.hooks.onInvertCam(!cur);
        refreshInvertCam();
      });
      this._refreshInvertCam = refreshInvertCam;
    }

    // voice engine selector
    const voiceEngineSelect = document.getElementById('voice-engine-select');
    if (voiceEngineSelect) {
      const savedEngine = localStorage.getItem('nuar_voice_engine') || 'auto';
      voiceEngineSelect.value = savedEngine;
      voiceEngineSelect.addEventListener('change', (e) => {
        localStorage.setItem('nuar_voice_engine', e.target.value);
        this.hooks.onVoiceEngineChange && this.hooks.onVoiceEngineChange(e.target.value);
        this.refreshVoiceProfiles();
        this.refreshVoiceCaps();
      });
    }

    // voice profile selector
    this.voiceProfileSelect = document.getElementById('voice-profile-select');
    this.refreshVoiceProfiles();

    const previewBtn = document.getElementById('btn-voice-preview');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        this.hooks.onVoicePreview && this.hooks.onVoicePreview();
        this.refreshVoiceLast();
      });
    }

    // TTS relay
    this.capsEl = document.getElementById('voice-caps');
    this.lastVoiceEl = document.getElementById('voice-last');
    this.relayInput = document.getElementById('tts-relay-input');
    if (this.relayInput) {
      this.relayInput.value = localStorage.getItem('nuar_tts_relay') || '';
      const relaySave = document.getElementById('btn-relay-save');
      if (relaySave) {
        relaySave.addEventListener('click', () => {
          const val = (this.relayInput.value || '').trim();
          localStorage.setItem('nuar_tts_relay', val);
          this.hooks.onRelayChange && this.hooks.onRelayChange(val);
          this.refreshVoiceCaps();
        });
      }
      const relayTest = document.getElementById('btn-relay-test');
      if (relayTest) {
        relayTest.addEventListener('click', () => this.hooks.onRelayTest && this.hooks.onRelayTest());
      }
    }

    this.mapUI = new MapUI(document.getElementById('map-canvas'), document.getElementById('map-legend'));
  }

  // показываем, какие движки реально доступны в этом окружении
  refreshVoiceCaps() {
    if (this.relayInput) {
      const cur = localStorage.getItem('nuar_tts_relay') || '';
      if (this.relayInput.value !== cur) this.relayInput.value = cur;
    }
    if (!this.capsEl) return;
    const caps = this.hooks.getVoiceCaps ? this.hooks.getVoiceCaps() : null;
    if (!caps) { this.capsEl.textContent = ''; return; }
    const mark = (ok, name) => `<span class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'}</span> ${name}`;
    const parts = [
      mark(caps.edge, 'Edge TTS'),
      mark(caps.google, 'Google TTS'),
      mark(caps.web, 'Голос устройства'),
      mark(caps.synth, 'Локальный синтезатор'),
    ];
    const relay = localStorage.getItem('nuar_tts_relay');
    if (relay) parts.push(`<span class="ok">✓</span> релей: ${relay}`);
    this.capsEl.innerHTML = parts.join('<br>');
  }

  refreshVoiceLast() {
    if (!this.lastVoiceEl) return;
    const name = this.hooks.getVoiceLast ? this.hooks.getVoiceLast() : '—';
    this.lastVoiceEl.textContent = 'Последний голос: ' + name;
  }

  refreshVoiceProfiles() {
    if (!this.voiceProfileSelect) return;
    const engine = localStorage.getItem('nuar_voice_engine') || 'auto';
    const profiles = {
      auto: ['Системный (авто)'],
      edge: ['ru-RU-DmitryNeural', 'ru-RU-SvetlanaNeural'],
      google: ['ru-RU-Standard-A', 'ru-RU-Standard-B'],
      web: ['Голос устройства (Android TTS / Web Speech)'],
      synth: ['Локальный синтезатор (WebAudio)'],
    };
    const list = profiles[engine] || profiles.auto;
    this.voiceProfileSelect.innerHTML = '';
    list.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      this.voiceProfileSelect.appendChild(opt);
    });
    const savedProfile = localStorage.getItem('nuar_voice_profile');
    if (savedProfile && list.includes(savedProfile)) {
      this.voiceProfileSelect.value = savedProfile;
    }
    this.voiceProfileSelect.addEventListener('change', (e) => {
      localStorage.setItem('nuar_voice_profile', e.target.value);
      this.hooks.onVoiceProfileChange && this.hooks.onVoiceProfileChange(e.target.value);
    });
  }

  showTitle() { this.title.classList.remove('hidden'); this.credits.classList.add('hidden'); this.pause.classList.add('hidden'); this.settings.classList.add('hidden'); this.map.classList.add('hidden'); if (this._refreshSound) this._refreshSound(); if (this._refreshVoice) this._refreshVoice(); if (this._refreshTime) this._refreshTime(); this.refreshSave(); }
  showCredits() { this.credits.classList.remove('hidden'); this.title.classList.remove('hidden'); }
  hideTitle() { this.title.classList.add('hidden'); }
  showPause() { this.pause.classList.remove('hidden'); this.settings.classList.add('hidden'); if (this._refreshTime) this._refreshTime(); this.refreshSave(); }
  hidePause() { this.pause.classList.add('hidden'); }
  showSettings() {
    this.title.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.credits.classList.add('hidden');
    this.settings.classList.remove('hidden');
    const invertBtn = document.getElementById('btn-invert-joy');
    if (invertBtn) invertBtn.textContent = 'Инверсия джойстика: ' + (localStorage.getItem('nuar_invert_joy') === '1' ? 'вкл' : 'выкл');
    if (this._refreshInvertCam) this._refreshInvertCam();
    if (this._refreshSound) this._refreshSound();
    if (this._refreshVoice) this._refreshVoice();
    if (this._refreshTime) this._refreshTime();
    this.refreshVoiceProfiles();
    this.refreshVoiceCaps();
    this.refreshVoiceLast();
  }
  hideSettings() { this.settings.classList.add('hidden'); }
  showMap() { this.map.classList.remove('hidden'); this.settings.classList.add('hidden'); }
  hideMap() { this.map.classList.add('hidden'); }

  hideLoad() { this.loadScreen.classList.add('hidden'); }
  showLoad() { this.loadScreen.classList.remove('hidden'); }

  setHud(hud) {
    document.getElementById('btn-map').addEventListener('click', () => this.hooks.onMap && this.hooks.onMap());
    document.getElementById('btn-menu').addEventListener('click', () => this.hooks.onPause && this.hooks.onPause());

    this._continueBtn = document.getElementById('btn-continue');
    this._saveStatus = document.getElementById('save-status');
    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) saveBtn.addEventListener('click', () => this.hooks.onSave && this.hooks.onSave());
    if (this._continueBtn) this._continueBtn.addEventListener('click', () => this.hooks.onContinue && this.hooks.onContinue());
  }

  refreshSave() {
    const hasSave = this.hooks.hasSave ? !!this.hooks.hasSave() : false;
    if (this._continueBtn) this._continueBtn.classList.toggle('hidden', !hasSave);
    if (this._saveStatus) this._saveStatus.textContent = hasSave && this.hooks.saveInfo ? (this.hooks.saveInfo() || 'Сохранение есть') : '';
  }

  updateMap(world, playerPos, flags) {
    this.mapUI.draw(world, playerPos, flags);
  }
}