// Procedural audio: noir ambient pad + SFX via WebAudio (no assets)
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.muted = false;
    this.padTimer = null;
    this.windGain = null;
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