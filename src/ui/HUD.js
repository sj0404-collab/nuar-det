export class HUD {
  constructor() {
    this.caseLabel = document.getElementById('case-label');
    this.logs = document.getElementById('logs');
    this.abilities = document.getElementById('abilities');
    this.hint = document.getElementById('hint');
    this.toastEl = document.getElementById('toast');
    this.touch = null;
    this.toastTimer = null;
    this.hintTimer = null;
    this.hourHand = document.getElementById('clock-hour');
    this.minuteHand = document.getElementById('clock-minute');
    this.secondHand = document.getElementById('clock-second');
    this.clockDigital = document.getElementById('clock-digital');
    this.clockIcon = document.getElementById('clock-icon');
    this.weatherIcon = document.getElementById('weather-icon');
    this.weatherState = '';
  }

  setClock(h, m, s, dayFactor) {
    if (!this.hourHand) return;
    const sd = s * 6;
    const md = m * 6 + s * 0.1;
    const hd = (h % 12) * 30 + m * 0.5 + s * (0.5 / 60);
    this.secondHand.style.transform = `rotate(${sd}deg)`;
    this.minuteHand.style.transform = `rotate(${md}deg)`;
    this.hourHand.style.transform = `rotate(${hd}deg)`;
    this.clockDigital.textContent =
      `${('0' + h).slice(-2)}:${('0' + m).slice(-2)}:${('0' + s).slice(-2)}`;
    if (this.clockIcon) {
      this.clockIcon.textContent = dayFactor > 0.85 ? '☀️'
        : dayFactor > 0.45 ? '🌇' : '🌙';
    }
  }

  setWeather(state) {
    if (!this.weatherIcon || state === this.weatherState) return;
    this.weatherState = state;
    const icons = { clear: '☀️', fog: '🌫', wind: '💨', rain: '🌧' };
    const labels = { clear: 'Ясно', fog: 'Туман', wind: 'Ветер', rain: 'Дождь' };
    this.weatherIcon.textContent = icons[state] || '☁';
    this.weatherIcon.title = labels[state] || 'Погода';
  }

  setTouch(tc) { this.touch = tc; }

  setCase(text) { this.caseLabel.textContent = text; }

  setLogs(arr) {
    this.logs.innerHTML = '';
    for (const l of arr) {
      const span = document.createElement('span');
      span.className = 'log-chip';
      span.textContent = l;
      this.logs.appendChild(span);
    }
  }

  setAbilities(opt) {
    const defs = [
      { key: 'dash', icon: '➤', label: 'Рывок' },
      { key: 'jump', icon: '✦', label: 'Двоение тени' },
      { key: 'wall', icon: '🕸', label: 'Свод теней' },
      { key: 'lens', icon: '🔍', label: 'Зрение личины' },
    ];
    this.abilities.innerHTML = '';
    for (const d of defs) {
      const el = document.createElement('div');
      el.className = 'ability-ico' + (opt[d.key] ? ' owned' : '');
      el.title = d.label;
      el.textContent = d.icon;
      this.abilities.appendChild(el);
    }
  }

  showHint(text, persist = false) {
    this.hint.textContent = text;
    this.hint.classList.remove('hidden');
    if (this.hintTimer) clearTimeout(this.hintTimer);
    if (!persist) {
      this.hintTimer = setTimeout(() => this.hint.classList.add('hidden'), 2600);
    }
  }

  hideHint() {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hint.classList.add('hidden');
  }

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2600);
  }

  showInteract(show) {
    if (this.touch) this.touch.showInteract(show);
  }
}