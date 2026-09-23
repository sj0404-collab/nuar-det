// Speaker → voice profile map (voice "portraits").
export const DEFAULT_PROFILE = {
  base: -2,    // semitones relative to 110 Hz
  rate: 1.0,
  waveform: 'sine',
  pitch: 1.0,
  jitter: 0.08,
  echo: 0,
  volume: 0.3,
  mask: '',    // device-voice name substring hint
};

export const VOICE_PROFILES = {
  'Констебль Грач': { base: -4, rate: 0.95, waveform: 'triangle', pitch: 0.85, jitter: 0.05, echo: 0, volume: 0.32, mask: 'раш' },   // хриплый детектив-баритон
  'Тень на мосту': { base: 2, rate: 1.15, waveform: 'sine', pitch: 1.35, jitter: 0.2, echo: 0.4, volume: 0.22, mask: 'эт' },          // шёпот-загадка
  'Жестянщик Грип': { base: -7, rate: 1.05, waveform: 'square', pitch: 0.6, jitter: 0.1, echo: 0, volume: 0.3, mask: 'ми' },          // металлический ремесленник
  'Госпожа Корвида': { base: 6, rate: 0.9, waveform: 'triangle', pitch: 1.2, jitter: 0.08, echo: 0.15, volume: 0.3, mask: 'ви' },     // гордая дама с вибрато
  'Призрак-эхо': { base: 3, rate: 0.75, waveform: 'sawtooth', pitch: 1.45, jitter: 0.3, echo: 0.6, volume: 0.2, mask: 'эхо' },        // дрожащий призрак
  'Караульщик часов': { base: 0, rate: 1.0, waveform: 'triangle', pitch: 1.0, jitter: 0.05, echo: 0, volume: 0.3, mask: 'ка' },       // ровный, честный
  'Смотритель огней': { base: -2, rate: 0.9, waveform: 'sine', pitch: 0.85, jitter: 0.06, echo: 0, volume: 0.28, mask: 'ста' },       // мягкий старик
  'Хозяйка гавани': { base: 5, rate: 1.0, waveform: 'sine', pitch: 1.15, jitter: 0.05, echo: 0.12, volume: 0.3, mask: 'ха' },        // звонкая морянка
  'Фонарь Моррова': { base: -3, rate: 0.8, waveform: 'sawtooth', pitch: 0.7, jitter: 0.15, echo: 0.5, volume: 0.26, mask: 'мо' },    // древний голос тумана
};

export function voiceFor(speaker) {
  return VOICE_PROFILES[speaker] || DEFAULT_PROFILE;
}