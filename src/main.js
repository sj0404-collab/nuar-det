import { Game } from './Game.js';

async function boot() {
  const canvas = document.getElementById('game-canvas');
  const tips = [
    'Слеза тумана и перо вороны вместе откроют гавань.',
    'Дренажная решётка в центре рынка ведёт в цистерну.',
    'Кровавый след на крышах ведёт от маяка к скалам.',
    'Кот на рынке помнит ночь, когда украли свет.',
    'Карта «Истина» прокалывает защиту морока в бою.',
  ];
  let tipI = 0;
  const tipEl = document.getElementById('load-tip');
  if (tipEl) {
    tipEl.textContent = tips[0];
    setInterval(() => {
      tipI = (tipI + 1) % tips.length;
      tipEl.textContent = tips[tipI];
    }, 3500);
  }
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