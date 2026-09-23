// Протагонисты Нуар-Дета: «от какого лица играть».
// Выбор простой — меняет имя героя, портрет-палитру и голосовой профиль
// реплик игрока. Сюжет один и тот же.
import { DEFAULT_PROFILE } from './profiles.js';

export const PERSONAS = [
  {
    id: 'rook',
    title: 'Детектив',
    label: 'Грач',
    blurb: 'Сухой, циничный, завсегдатай ночных заведений.',
    hue: '#d8b36a',
    body: { height: 1.06, build: 0.94, head: 0.97 },
    profile: { ...DEFAULT_PROFILE, base: -4, rate: 0.95, waveform: 'triangle', pitch: 0.8, jitter: 0.05, echo: 0, volume: 0.32, mask: 'дмит', edge: 'ru-RU-DmitryNeural' },
  },
  {
    id: 'nora',
    title: 'Журналистка',
    label: 'Нора',
    blurb: 'Пишет о городе, который ловит каждый шорох.',
    hue: '#c78fc8',
    body: { height: 0.95, build: 0.9, head: 1.07 },
    profile: { ...DEFAULT_PROFILE, base: 5, rate: 1.0, waveform: 'sine', pitch: 1.15, jitter: 0.06, echo: 0.08, volume: 0.3, mask: 'светл', edge: 'ru-RU-SvetlanaNeural' },
  },
  {
    id: 'keeper',
    title: 'Смотритель огней',
    label: 'Кей',
    blurb: 'Полвека присматривает за светом Ноктиса.',
    hue: '#8fb7c8',
    body: { height: 1.0, build: 1.1, head: 1.0 },
    profile: { ...DEFAULT_PROFILE, base: -1, rate: 0.9, waveform: 'sine', pitch: 0.9, jitter: 0.08, echo: 0.1, volume: 0.28, mask: 'ста', edge: 'ru-RU-DmitryNeural' },
  },
];

export const DEFAULT_PERSONA = PERSONAS[0].id;

export function personaById(id) {
  return PERSONAS.find((p) => p.id === id) || PERSONAS[0];
}

export function loadPersona() {
  let id = null;
  try { id = localStorage.getItem('nuar_persona'); } catch (e) { /* ignore */ }
  return personaById(id);
}

export function savePersona(p) {
  try { localStorage.setItem('nuar_persona', p.id); } catch (e) { /* ignore */ }
  return p;
}