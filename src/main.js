import { Game } from './Game.js';

async function boot() {
  const canvas = document.getElementById('game-canvas');
  try {
    const game = new Game(canvas);
    window.__game = game;
    document.getElementById('load-screen').classList.add('hidden');
  } catch (err) {
    console.error('Boot error:', err);
    const load = document.getElementById('load-screen');
    load.textContent = 'Ошибка инициализации: ' + err.message;
    load.style.color = '#b0342e';
  }
}

boot();