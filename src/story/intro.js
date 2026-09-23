// Сценарии заставок: история Ноктиса и представление каждого протагониста.
// Каждый кадр = положение камеры, точка взгляда, озвученная реплика,
// длительность и звуковые эффекты. Реплики читает голосовой движок игры,
// эффекты проигрывает AudioSys — заставка полностью озвучена.
import { DEFAULT_PROFILE } from './profiles.js';

export const NARRATOR_PROFILE = {
  ...DEFAULT_PROFILE,
  base: -8,
  rate: 0.92,
  waveform: 'sine',
  pitch: 0.75,
  jitter: 0.04,
  echo: 0.12,
  volume: 0.34,
  mask: 'дмит',
  edge: 'ru-RU-DmitryNeural',
};

// ключевые точки города для облёта
const HUB = { x: 0, y: 1.2, z: 22 };
const MARKET = { x: 127, y: 7, z: 26 };
const HARBOR = { x: 226, y: 9, z: 120 };
const MAUSOLEUM = { x: -42, y: 5, z: -230 };
const CISTERN = { x: 150, y: 16, z: 10 };

export const WORLD_INTRO = {
  id: 'world',
  title: 'Ноктис',
  subtitle: 'город, который прячет свет',
  shots: [
    {
      dur: 7.5,
      from: { x: HUB.x - 26, y: 20, z: HUB.z + 30 },
      to: { x: HUB.x + 6, y: 8.5, z: HUB.z - 4 },
      look: { x: HUB.x, y: 3, z: HUB.z },
      lookTo: { x: HUB.x, y: 2, z: HUB.z - 12 },
      title: 'Ноктис',
      vo: 'Ноктис — город, который прячет свет. Здесь фонари гаснут раньше, чем их зажигают, а туман пахнет ironом и дождём.',
      sfx: [['whoosh', 0], ['bell', 1.2]],
    },
    {
      dur: 7,
      from: { x: MARKET.x - 24, y: 16, z: MARKET.z + 22 },
      to: { x: MARKET.x + 10, y: 11, z: MARKET.z - 6 },
      look: { x: MARKET.x, y: 5, z: MARKET.z },
      lookTo: { x: MARKET.x + 4, y: 4, z: MARKET.z - 10 },
      title: 'Рынок теней',
      vo: 'Рынок открывается, когда гаснут фонари. Торговцы здесь продают не вещи, а чужие секреты — и берут за них память.',
      sfx: [['riffle', 0.4], ['riser', 2.2]],
    },
    {
      dur: 7.5,
      from: { x: HARBOR.x + 22, y: 22, z: HARBOR.z - 26 },
      to: { x: HARBOR.x - 6, y: 12, z: HARBOR.z + 8 },
      look: { x: HARBOR.x, y: 6, z: HARBOR.z },
      lookTo: { x: HARBOR.x - 10, y: 4, z: HARBOR.z + 2 },
      title: 'Гавань',
      vo: 'Гавань не спит. Здесь причалы липнут от соли, а корабли уходят в туман, которого не бывает на картах.',
      sfx: [['thunder', 0.6], ['whoosh', 3.4]],
    },
    {
      dur: 7,
      from: { x: MAUSOLEUM.x + 18, y: 18, z: MAUSOLEUM.z + 26 },
      to: { x: MAUSOLEUM.x - 4, y: 10, z: MAUSOLEUM.z - 6 },
      look: { x: MAUSOLEUM.x, y: 4, z: MAUSOLEUM.z },
      lookTo: { x: MAUSOLEUM.x, y: 3, z: MAUSOLEUM.z - 10 },
      title: 'Мавзолей',
      vo: 'В мавзолее хоронят не тела, а обещания. Камень помнит голос, которым их давали, и отвечает тем же голосом.',
      sfx: [['sting', 0.2], ['heart', 3.6]],
    },
    {
      dur: 8,
      from: { x: CISTERN.x + 16, y: 24, z: CISTERN.z + 18 },
      to: { x: CISTERN.x - 8, y: 14, z: CISTERN.z - 8 },
      look: { x: CISTERN.x, y: 8, z: CISTERN.z },
      lookTo: { x: CISTERN.x - 6, y: 6, z: CISTERN.z - 6 },
      title: 'Цистерна',
      vo: 'Под городом стоит вода, и вода помнит лица. Говорят, Фонарь Моррова до сих пор горит там, на дне, для тех, кто ищет.',
      sfx: [['riser', 0.2], ['thunder', 4.2]],
    },
    {
      dur: 8.5,
      from: { x: HUB.x - 12, y: 7, z: HUB.z + 20 },
      to: { x: HUB.x + 3, y: 4.2, z: HUB.z + 8 },
      look: { x: HUB.x, y: 2.2, z: HUB.z },
      lookTo: { x: HUB.x, y: 1.8, z: HUB.z - 4 },
      title: 'Дело №7',
      vo: 'Дело номер семь передают тем, кто ещё верит, что слова имеют вес. Добро пожаловать в Ноктис, детектив.',
      sfx: [['sting', 0.3], ['footsteps', 3.2]],
      end: true,
    },
  ],
};

// заставка выбранного протагониста: камера облетает героя, он сам себя представляет
function personaIntro(id, title, hue, lines) {
  return {
    id,
    title,
    subtitle: 'ваш детектив',
    hue,
    shots: lines.map((l, i) => ({
      dur: l.dur || 7,
      orbit: i,
      from: { x: HUB.x - 3.2 - i * 1.1, y: 2.4, z: HUB.z + 4.2 + i * 0.8 },
      to: { x: HUB.x + 3.4 - i * 0.7, y: 2.1, z: HUB.z + 3.4 - i * 1.2 },
      look: { x: HUB.x, y: 1.7, z: HUB.z },
      lookTo: { x: HUB.x, y: 1.6, z: HUB.z },
      title: i === 0 ? title : '',
      vo: l.vo,
      sfx: l.sfx || [],
    })),
  };
}

export const PERSONA_INTROS = {
  rook: personaIntro('rook', 'Грач — детектив', '#d8b36a', [
    { vo: 'Грач. Детектив, частный случай, ночные смены. Я верю логике ровно настолько, насколько она удобна платить за аренду.', sfx: [['footsteps', 0.4]], dur: 7.5 },
    { vo: 'Правило простое: улика — это человек, который боится, что его увидят. Я иду туда, где света меньше всего.', sfx: [['whoosh', 1.2]], dur: 7 },
    { vo: 'Морок уже близко. Фонарь Моррова горит, и кто-то его погасит. Не этот город. Я.', sfx: [['sting', 0.6], ['bell', 3.2]], dur: 7.5 },
  ]),
  nora: personaIntro('nora', 'Нора — журналистка', '#c78fc8', [
    { vo: 'Нора. Я пишу о Ноктисе. Каждая заметка начинается с чужой бессонницы и заканчивается моей.', sfx: [['riffle', 0.3]], dur: 7.5 },
    { vo: 'Люди думают, что правда — это улика. Нет. Правда — это то, что человек говорит, когда уверен, что его никто не записывает.', sfx: [['heart', 2.4]], dur: 8 },
    { vo: 'Я иду к мороку с диктофоном и без оружия. Обычно этого хватает, чтобы он начал говорить.', sfx: [['riser', 1.0], ['sting', 4.0]], dur: 7.5 },
  ]),
  keeper: personaIntro('keeper', 'Кей — смотритель огней', '#8fb7c8', [
    { vo: 'Кей. Полвека я слежу, чтобы огни в Ноктисе горели ровно. Ровно — значит, досчитывая каждый до утра.', sfx: [['bell', 0.2]], dur: 7.5 },
    { vo: 'Свет — это обещание, которое город даёт улицам. Когда гаснет фонарь, кто-то перестаёт ждать домой.', sfx: [['whoosh', 1.4], ['heart', 3.4]], dur: 7.5 },
    { vo: 'Фонарь Моррова погас не сам. Я знаю, кто донёс спичку. Осталось доказать это тени.', sfx: [['thunder', 0.8], ['sting', 4.2]], dur: 7.5 },
  ]),
};

export function personaIntroFor(persona) {
  return PERSONA_INTROS[persona && persona.id] || PERSONA_INTROS.rook;
}
