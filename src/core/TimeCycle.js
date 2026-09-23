// TimeCycle - суточный цикл Нуар-Дета.
// По умолчанию (mode: 'device') игровое время жёстко привязано к реальному
// дню устройства: полноценные 24 часа = реальные 24 часа по часам ОС.
// Режим 'game' (daySeconds) — ускоренный цикл для отладки/демо.
// Управляет:
//  - часом/минутой/секундой для циферблата
//  - плавным фактором дня dayFactor (0 = ночь, 1 = полдень) с мягкими
//    переходами на рассвете/закате, чтобы светильники и небо дышали.

export class TimeCycle {
  constructor(opts = {}) {
    this.mode = opts.mode || 'device';
    this.daySeconds = opts.daySeconds || 360;
    this.hour = 22;
    this.minute = 0;
    this.second = 0;
    this.day = 1;
    this.fixedStep = opts.fixedStep !== undefined ? opts.fixedStep : 0.05;
    this.totalSec = this.hour * 3600 + this.minute * 60 + this.second;
    this.dayFactor = this._dayFactor(this.totalSec);
    if (this.mode === 'device') this.syncToDevice();
  }

  setClock(h, m, s) {
    // рассинхрон аккуратно раскладываем по шкале 24ч
    let total = h * 3600 + m * 60 + s;
    total = ((total % 86400) + 86400) % 86400;
    this._fromTotal(total);
  }

  // привязка к реальному дню устройства
  syncToDevice() {
    const d = new Date();
    this.setClock(d.getHours(), d.getMinutes(), d.getSeconds());
  }

  _fromTotal(totalSec) {
    totalSec = ((totalSec % 86400) + 86400) % 86400;
    this.hour = Math.floor(totalSec / 3600);
    this.minute = Math.floor((totalSec % 3600) / 60);
    this.second = Math.floor(totalSec % 60);
    this.dayFactor = this._dayFactor(totalSec);
    this.totalSec = totalSec;
  }

  // плавная восьмёрка: ночь(0)...рассвет(...)→день(1)...закат→ночь
  // with gentle sine easing so transitions never pop
  _dayFactor(sec) {
    const f = sec / 86400; // 0..1
    // sunrise 06:00-08:00 (f=0.25..0.3333), high noon 12:00, sunset 17:00-20:00
    const d1 = 6 / 24, d2 = 8 / 24, d3 = 12 / 24, d4 = 17 / 24, d5 = 20 / 24;
    if (f < d1 || f >= d5) return 0;
    if (f >= d2 && f < d4) return 1;
    if (f >= d1 && f < d2) {
      const t = (f - d1) / (d2 - d1);
      return smooth(t);
    }
    // f >= d4 && f < d5
    const t = (f - d4) / (d5 - d4);
    return 1 - smooth(t);
    function smooth(x) { return x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x); }
  }

  // вызывается каждое фикс-пересчитывание из Game.update(dt)
  update(dt) {
    if (this.mode === 'device') {
      // реальное время устройства: читаем часы каждый кадр (без дрейфа)
      this.syncToDevice();
      return;
    }
    const gameDelta = dt * (86400 / this.daySeconds); // игровые секунды
    this._fromTotal(((this.totalSec + gameDelta) % 86400 + 86400) % 86400);
  }

  // строки для HUD
  pad(n) { return (n < 10 ? '0' : '') + n; }
  getTimeString() { return `${this.pad(this.hour)}:${this.pad(this.minute)}:${this.pad(this.second)}`; }

  // фракция для неба/светильников: 0..1
  get dayFactorF() { return this.dayFactor; }
}