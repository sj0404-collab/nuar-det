// Пошаговое обучение при первом столкновении с каждой системой.
// Прогресс хранится в localStorage (`nuar_tutorial`) и переживает перезапуск.

const KEY = 'nuar_tutorial';

// Шаги: id → { title, text, when(game), done(game) }
// done проверяется каждый кадр — как только условие выполнено, шаг гаснет.
const STEPS = [
  {
    id: 'move',
    title: 'Первые шаги',
    text: 'Двигайтесь: джойстик слева внизу или WASD. Прыжок — ✦, рывок — ➤, бег — удерживайте «>», присед — «▬», удар — «⚔».',
    when: (g) => g.mode === 'explore' && !g.mount,
    done: (g) => !!(g.tutorial && g.tutorial.marksSwitches.moved),
  },
  {
    id: 'camera',
    title: 'Камера',
    text: 'Правый джойстик или Q/E — поворот камеры. Клавиша V переключает вид: обзор, от первого лица, сверху.',
    when: (g) => g.mode === 'explore',
    done: (g) => !!(g.tutorial && g.tutorial.marksSwitches.camera),
  },
  {
    id: 'ability',
    title: 'Способности',
    text: 'Иконки сверху — ваши способности. Прыжок и рывок открываются с первого дела, стенка и лупа — по ходу сюжета.',
    when: (g) => g.mode === 'explore' && g.player.abilities.jump,
    done: (g) => !!g.player.abilities.dash && g.player.abilities.jump,
  },
  {
    id: 'item',
    title: 'Улики',
    text: 'Подойдите к светящейся улике и нажмите F или кнопку «!» — улика попадёт в блокнот.',
    when: (g) => g.mode === 'explore' && !g.mount,
    done: (g) => g.player.inventory.size > 0,
  },
  {
    id: 'key',
    title: 'Ключи и двери',
    text: 'Ключи-улики открывают двери, которые запирают туман. Подойдите к двери и нажмите F.',
    when: (g) => g.mode === 'explore' && g.player.inventory.has('key_bar') === false && g.player.inventory.size > 0,
    done: (g) => g.gates.some((x) => !x.locked) || g.player.inventory.has('key_gate'),
  },
  {
    id: 'combat',
    title: 'Первый бой',
    text: 'Тапайте карту, чтобы сыграть её. ◆ — энергия, щит гасит урон. «Завершить ход» — когда карты кончились.',
    when: (g) => g.mode === 'combat',
    done: (g) => !!(g.tutorial && g.tutorial.marksSwitches.combat),
  },
  {
    id: 'flee',
    title: 'Побег и поражение',
    text: 'Если бой не идёт — «Убежать» (−10 ❤). После поражения можно начать бой заново или вернуться к чекпоинту.',
    when: (g) => g.mode === 'combat' && g.combat && g.combat.turn >= 1,
    done: (g) => !!(g.tutorial && g.tutorial.marksSwitches.flee),
  },
  {
    id: 'dialog',
    title: 'Диалоги',
    text: 'В разговоре выбирайте реплики — они меняют ход дела. Некоторые улики открываются только через диалог.',
    when: (g) => g.mode === 'dialogue',
    done: (g) => !!(g.tutorial && g.tutorial.marksSwitches.dialogue),
  },
  {
    id: 'transport',
    title: 'Транспорт',
    text: 'Фиакры возят по городу. При посадке выберите место: Водитель — вы управляете (W/S газ, A/D поворот), Пассажир — едете сами.',
    when: (g) => g.mode === 'explore' && !g.mount && !!g.findVehicleNear(),
    done: (g) => !!(g.tutorial && g.tutorial.marksSwitches.transport),
  },
  {
    id: 'save',
    title: 'Сохранения',
    text: 'Игра сохраняется сама у чекпоинтов. В меню паузы есть «Сохранить игру», а на титуле — «Продолжить дело».',
    when: (g) => g.mode === 'explore',
    done: (g) => !!(g.tutorial && g.tutorial.marksSwitches.save) || g.hasSave(),
  },
];

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('tutorial-tip');
    this.done = this.load();
    this.current = null;
    this.shown = false;
    this.marksSwitches = { moved: false, camera: false, ability: false, item: false, key: false, combat: false, flee: false, dialogue: false, transport: false, save: false };
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (e) {
      return {};
    }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.done)); } catch (e) {}
  }

  reset() {
    this.done = {};
    this.save();
    this.current = null;
    this.hide();
  }

  isDone(id) { return !!this.done[id]; }

  mark(id) {
    if (this.done[id]) return;
    this.done[id] = true;
    this.save();
    if (this.current && this.current.id === id) {
      this.current = null;
      this.hide();
    }
  }

  skip() {
    for (const s of STEPS) this.done[s.id] = true;
    this.save();
    this.current = null;
    this.hide();
  }

  hide() {
    if (this.el) this.el.classList.add('hidden');
  }

  // вызывается каждый кадр из Game.update
  update() {
    const g = this.game;
    if (g.mode === 'combat') {
      if (g.combat && g.combat.turn > 0) this.marksSwitches.combat = true;
    }
    if (g.mode === 'explore' && !g.mount) {
      // засчитываем реальное движение, а не смещение от чекпоинта
      const a = g.input.axis2D();
      if (Math.abs(a.x) > 0.15 || Math.abs(a.z) > 0.15) this.marksSwitches.moved = true;
    }

    // сначала гасим выполненные шаги
    for (const s of STEPS) {
      if (!this.isDone(s.id) && s.done(g)) this.mark(s.id);
    }

    // ищем первый невыполненный шаг, условия которого сейчас актуальны
    let next = null;
    for (const s of STEPS) {
      if (this.isDone(s.id)) continue;
      let ok = false;
      try { ok = s.when(g); } catch (e) { ok = false; }
      if (ok) { next = s; break; }
    }

    if (!next) {
      this.current = null;
      this.hide();
      return;
    }
    if (this.current && this.current.id === next.id) { this.showTip(next); return; }
    this.current = next;
    this.showTip(next);
  }

  showTip(step) {
    if (!this.el) return;
    this.el.classList.remove('hidden');
    const t = this.el.querySelector('#tutorial-text');
    const h = this.el.querySelector('#tutorial-title');
    if (h) h.textContent = step.title;
    if (t) t.textContent = step.text;
  }
}

export { STEPS as TUTORIAL_STEPS };
