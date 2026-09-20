import { MapUI } from './MapUI.js';

export class Screens {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.title = document.getElementById('screen-title');
    this.credits = document.getElementById('screen-credits');
    this.pause = document.getElementById('screen-pause');
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
    this.mapUI = new MapUI(document.getElementById('map-canvas'), document.getElementById('map-legend'));
  }

  showTitle() { this.title.classList.remove('hidden'); this.credits.classList.add('hidden'); this.pause.classList.add('hidden'); this.map.classList.add('hidden'); }
  showCredits() { this.credits.classList.remove('hidden'); }
  hideTitle() { this.title.classList.add('hidden'); }
  showPause() { this.pause.classList.remove('hidden'); }
  hidePause() { this.pause.classList.add('hidden'); }
  showMap() { this.map.classList.remove('hidden'); }
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