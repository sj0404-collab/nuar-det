// Card & enemy definitions for "Нуар-Дет" card battles

export const CARDS = {
  duma: { id: 'duma', name: 'Дума', cost: 0, kind: 'off', art: '💭', desc: 'Наносит 4 урона', fx: { type: 'atk', val: 4 } },
  ura: { id: 'ura', name: 'Ураган доводов', cost: 2, kind: 'off', art: '🌪', desc: 'Наносит 10 урона', fx: { type: 'atk', val: 10 } },
  klyuv: { id: 'klyuv', name: 'Клюв корвиды', cost: 1, kind: 'off', art: '🐦‍⬛', desc: '6 урона, +1 карта', fx: { type: 'atk', val: 6, draw: 1 } },
  kope: { id: 'kope', name: 'Копеечная улика', cost: 1, kind: 'off', art: '🪙', desc: '5 урона. Если улик 3 — враг оглушён', fx: { type: 'atk', val: 5, clue: 1 } },
  alter: { id: 'alter', name: 'Аллюзия', cost: 1, kind: 'util', art: '🌀', desc: 'Враг слабеет: -4 атаки на 2 хода', fx: { type: 'weak', val: 4, turns: 2 } },
  ded: { id: 'ded', name: 'Дедукция', cost: 3, kind: 'off', art: '🔍', desc: '14 урона игнорирует защиту', fx: { type: 'atk', val: 14, pierce: true } },
  vex: { id: 'vex', name: 'Сомнение', cost: 0, kind: 'def', art: '🫥', desc: '+1 карта, восстановить 4', fx: { type: 'heal', val: 4, draw: 1 } },
  murk: { id: 'murk', name: 'Чутьё мора', cost: 1, kind: 'ut', art: '🌫', desc: '+6 защиты', fx: { type: 'block', val: 6 } },
  stalk: { id: 'stalk', name: 'Слежка', cost: 0, kind: 'util', art: '👣', desc: 'Враг оглушается (пропустит ход)', fx: { type: 'stun', val: 1 } },
  truth: { id: 'truth', name: 'Истина', cost: 2, kind: 'off', art: '☀️', desc: '12 урона, игнорирует слабость и защиту', fx: { type: 'atk', val: 12, pierce: true } },
  mort: { id: 'mort', name: 'Морок', cost: 1, kind: 'off', art: '🌧', desc: '6 урона', fx: { type: 'atk', val: 6 } },
};

export const STARTER_DECK = ['duma', 'duma', 'duma', 'ura', 'ura', 'kope', 'alter', 'vex'];

export const ENEMIES = {
  rat: {
    id: 'rat', name: 'Туманный крыс', face: '🐀', hp: 26, maxHp: 26, baseAtk: 7, block: 0,
    moods: ['пищит сквозь туман', 'точит зубы о монету', 'смотрит одним глазом'],
    attacks: [
      { name: 'Кусачий туман', atk: 7 },
      { name: 'Рывок тени', atk: 6 },
    ],
    reward: { cards: ['murk'], gold: 0 },
    flavor: 'Вызывает подозрение, что он — просто крыса.',
  },
  shade: {
    id: 'shade', name: 'Половинная тень', face: '🌘', hp: 34, maxHp: 34, baseAtk: 9, block: 2,
    moods: ['повторяет ваши жесты', 'шепчет улики', 'прячет лицо в воротник'],
    attacks: [
      { name: 'Удар забыться', atk: 9 },
      { name: 'Тень рукопожатия', atk: 8, block: 3 },
    ],
    reward: { cards: ['truth'] },
    flavor: 'Тень от фонаря, которая слушает.',
  },
  wisp: {
    id: 'wisp', name: 'Морок-шарф', face: '🎭', hp: 46, maxHp: 46, baseAtk: 10, block: 3,
    moods: ['дышит чьим-то дыханием', 'примеряет чужое пальто', 'искрится глупой радостью'],
    attacks: [
      { name: 'Удушье шёлка', atk: 10 },
      { name: 'Смех улицы', atk: 8 },
    ],
    reward: { cards: ['stalk'] },
    flavor: 'Лицо неизвестного прохожего сшито из тумана.',
  },
  boss: {
    id: 'boss', name: 'Магма-Морок', face: '💀', hp: 130, maxHp: 130, baseAtk: 13, block: 4,
    moods: ['кипит чужими снами', 'в нём они — хор', 'горит внутри холодно'],
    attacks: [
      { name: 'Кипящее отчаяние', atk: 13 },
      { name: 'Дождь пепла', atk: 11 },
      { name: 'Рев всех умерших надежд', atk: 16 },
    ],
    reward: { cards: ['truth', 'ded'] },
    flavor: 'То, что осталось от смотрителя огней — и его фонаря.',
  },
};

// map zone -> roaming encounter enemy + spawn list (world coords)
export const ENCOUNTERS = {
  cistern: { enemy: 'wisp', count: 2, spawn: [[120, -70], [160, -30], [126, -60]] },
  rookery: { enemy: 'shade', count: 2, spawn: [[-130, 20], [-120, 50]] },
  harbor: { enemy: 'wisp', count: 3, spawn: [[220, 120], [232, 90], [212, 150]] },
  mausoleum: { enemy: 'shade', count: 3, spawn: [[20, -180], [-30, -230], [0, -200]] },
};