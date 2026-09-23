// Procedural audio: noir ambient pad + SFX via WebAudio (no assets)
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.muted = false;
    this.padTimer = null;
    this.windGain = null;
    this.zones = {};
    this.zoneGains = {};
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.enabled = true;
      this.buildAmbient();
    } catch (e) { /* no audio */ }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  buildAmbient() {
    // wind noise via filtered buffer
    const len = this.ctx.sampleRate * 3;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.98 + white * 0.02;
      data[i] = last * 3;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 40;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.12;
    noise.connect(lp).connect(hp).connect(this.windGain).connect(this.master);
    noise.start();

    // melancholic pad loop (minor chords, airy)
    const chords = [[0, -14, -7, -3], [-2, -16, -9, -5], [-3, -15, -8, -4], [-5, -17, -10, -6]];
    const padPlay = (i) => {
      if (!this.enabled || this.muted) return;
      const t = this.ctx.currentTime;
      const chord = chords[i % chords.length];
      if (!chord) return;
      for (const semi of chord) {
        this.tone(semi, 8, t, 0.06, 0.72, 'triangle');
      }
      this.padTimer = setTimeout(() => padPlay(i + 1), 8200 + Math.random() * 2000);
    };
    padPlay(0);
    const delayed = () => setTimeout(padPlay, 4200);
    // move subtle arpeggio
    const arp = (i) => {
      if (!this.enabled || this.muted) return;
      const t = this.ctx.currentTime;
      const semis = [[0, 3, 7, 10], [0, 2, 5, 9], [-3, 0, 4, 7]];
      const s = semis[i % semis.length];
      const n = s[(Math.floor(Date.now() / 90000) + i) % s.length];
      this.tone(n, 0.5, t, 0.015, 0.5, 'sine');
      setTimeout(() => arp(i + 1), 1550 + Math.random() * 900);
    };
    arp(0);
    delayed();
    this.buildZones();
  }

  // --- location-based ambience layer (noir city texture) ---
  buildZones() {
    const makeZoneGain = (name) => {
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      this.zoneGains[name] = g;
      this.zones[name] = 0;
    };
    const zone = (name) => this.zoneGains[name];
    const loop = (name, fn, minMs, maxMs) => {
      const schedule = () => {
        if (!this.enabled) return;
        const w = this.zones[name] || 0;
        if (w > 0.02) fn(w, this.ctx.currentTime);
        setTimeout(schedule, minMs + Math.random() * (maxMs - minMs));
      };
      setTimeout(schedule, 400);
    };

    makeZoneGain('bar');   // bar "Сэм": vinyl crackle + deep double-bass thrum
    loop('bar', (w, t) => {
      this.noiseBurst(0.008 + Math.random() * 0.045, 800 + Math.random() * 2600, 0.010 * w);
      if (Math.random() < 0.12) this.tone(-10 + (Math.random() * 3 | 0), 0.38, t, 0.012 * w, 1, 'sine', 82);
    }, 45, 270);

    makeZoneGain('harbor'); // foghorn + gull cries off the pier
    loop('harbor', (w, t) => {
      this.drone(52 + Math.random() * 10, 0.045 * w, 2.4 + Math.random() * 1.4);
    }, 13000, 32000);
    loop('harbor', (w, t) => {
      const f = 950 + Math.random() * 300;
      this.tone(0, 0.16, t, 0.011 * w, 1, 'sine', f);
      setTimeout(() => this.tone(-1, 0.2, t + 0.15, 0.012 * w, 1, 'sine', f * 1.08), 150);
    }, 2400, 8200);

    makeZoneGain('plaza'); // pigeons cooing around the square
    loop('plaza', (w, t) => {
      const f = 300 + Math.random() * 40;
      this.tone(-1, 0.13, t, 0.016 * w, 1, 'sine', f);
      setTimeout(() => this.tone(-2, 0.16, t + 0.15, 0.016 * w, 1, 'sine', f * 0.97), 150);
    }, 1700, 5600);

    makeZoneGain('drain'); // echoey water drips in the cistern
    loop('drain', (w, t) => {
      this.tone(0, 0.05, t, 0.012 * w, 1, 'sine', 1500 + Math.random() * 500);
    }, 650, 2300);
  }

  setZone(name, w) {
    if (!this.ctx) return;
    const target = Math.max(0, Math.min(1, w));
    this.zones[name] = target;
    const g = this.zoneGains[name];
    if (g) g.gain.setTargetAtTime(target, this.ctx.currentTime, 1.1);
  }

  setWind(w) {
    if (!this.windGain) return;
    this.windGain.gain.setTargetAtTime(0.05 + Math.max(0, Math.min(1, w)) * 0.4, this.ctx.currentTime, 0.9);
  }

  drone(freq, gainV, dur) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainV, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(freq * 4, 300);
    for (const det of [0, 6]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(lp).connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  tone(semi, dur, t, gainV, freqMul = 1, type = 'sine', base = 110) {
    const f = base * Math.pow(2, semi / 12) * freqMul;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gainV, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  sfx(name) {
    if (!this.enabled || !this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'step':
        this.noiseBurst(0.045, 320, 0.02);
        break;
      case 'jump':
        this.tone(7, 0.22, t, 0.05, 1, 'square', 220);
        break;
      case 'doublejump':
        this.tone(12, 0.22, t, 0.05, 1, 'square', 280);
        setTimeout(() => this.tone(15, 0.2, t + 0.07, 0.04, 1, 'sine', 320), 60);
        break;
      case 'dash':
        this.noiseBurst(0.28, 600, 0.09);
        break;
      case 'chest':
        this.tone(0, 0.5, t, 0.07, 1, 'triangle', 440);
        setTimeout(() => this.tone(4, 0.7, t + 0.1, 0.07, 1, 'triangle', 440), 90);
        break;
      case 'unlock':
        this.tone(7, 0.3, t, 0.07, 1, 'triangle', 330);
        setTimeout(() => this.tone(10, 0.5, t + 0.15, 0.07, 1, 'triangle', 370), 140);
        setTimeout(() => this.tone(12, 0.8, t + 0.3, 0.08, 1, 'triangle', 420), 280);
        break;
      case 'hit':
        this.noiseBurst(0.12, 200, 0.12);
        this.tone(-12, 0.15, t, 0.08, 1, 'sawtooth', 160);
        break;
      case 'card':
        this.tone(0, 0.18, t, 0.05, 1, 'square', 520);
        break;
      case 'enemy':
        this.tone(-5, 0.3, t, 0.08, 1, 'sawtooth', 130);
        this.noiseBurst(0.2, 350, 0.06);
        break;
      case 'dialogue':
        this.tone(2, 0.15, t, 0.04, 1, 'sine', 392);
        break;
      case 'death':
        this.tone(-14, 1.1, t, 0.1, 1, 'sawtooth', 150);
        this.tone(-19, 1.1, t, 0.1, 1, 'sawtooth', 120);
        break;
      // --- звук заставок/синематографа ---
      case 'thunder':
        this.noiseBurst(1.1, 160, 0.16);
        this.tone(-22, 1.6, t, 0.1, 1, 'sawtooth', 70);
        setTimeout(() => this.noiseBurst(0.5, 120, 0.07), 220);
        break;
      case 'riser':
        for (let i = 0; i < 6; i++) {
          this.tone(i * 3, 0.7, t + i * 0.11, 0.05, 1, 'triangle', 220);
        }
        break;
      case 'sting':
        this.tone(0, 1.2, t, 0.09, 1, 'sawtooth', 165);
        this.tone(-5, 1.4, t + 0.04, 0.08, 1, 'triangle', 165);
        break;
      case 'whoosh':
        this.noiseBurst(0.75, 900, 0.07);
        break;
      case 'heart':
        this.tone(-8, 0.22, t, 0.12, 1, 'sine', 82);
        setTimeout(() => this.tone(-5, 0.3, t + 0.26, 0.1, 1, 'sine', 82), 260);
        break;
      case 'bell':
        this.tone(12, 1.6, t, 0.08, 1, 'sine', 520);
        this.tone(19, 1.3, t + 0.02, 0.05, 1, 'sine', 520);
        break;
      case 'riffle':
        for (let i = 0; i < 4; i++) this.noiseBurst(0.07, 2600, 0.035);
        break;
      case 'footsteps':
        for (let i = 0; i < 5; i++) setTimeout(() => this.sfx('step'), i * 430);
        break;
      default: break;
    }
  }

  noiseBurst(dur, freq, gainV) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gainV;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }
}