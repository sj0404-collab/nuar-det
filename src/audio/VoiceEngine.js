// TTS facade for dialogue: Web Speech API (device voices) with a WebAudio
// oscillator "declaimer" fallback so the game is voiced even with no voices.
const NOTE = 110;

export class VoiceEngine {
  constructor(audio) {
    this.audio = audio; // AudioSys: shared ctx + master
    this.enabled = localStorage.getItem('nuar_voice') !== '0';
    this.mode = 'auto'; // auto | web | synth
    this.voices = [];
    this.synth = null;
    this.speaking = false;
    this._synthTimer = null;
    this._tryLoadVoices();
  }

  _tryLoadVoices() {
    try {
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
        this.voices = this.synth.getVoices() || [];
        this.synth.addEventListener('voiceschanged', () => {
          this.voices = this.synth.getVoices() || [];
        });
      }
    } catch (e) { this.synth = null; }
  }

  get supportedWeb() { return !!(this.synth && this.voices.length); }

  setEnabled(b) {
    this.enabled = !!b;
    localStorage.setItem('nuar_voice', this.enabled ? '1' : '0');
    if (!this.enabled) this.stop();
    return this.enabled;
  }

  toggle() { return this.setEnabled(!this.enabled); }

  stop() {
    try { if (this.synth) this.synth.cancel(); } catch (e) {}
    this._killSynth();
    this.speaking = false;
  }

  speak(line, profile = {}) {
    if (!this.enabled || !line) return;
    this.stop();
    if (this.mode !== 'synth' && this.supportedWeb) {
      this.speaking = true;
      try {
        const u = new SpeechSynthesisUtterance(line);
        u.lang = 'ru-RU';
        u.volume = this.audio.muted ? 0 : 1;
        u.rate = this._clamp(profile.rate !== undefined ? profile.rate : 1, 0.5, 2);
        u.pitch = this._clamp(profile.pitch !== undefined ? profile.pitch : 1, 0, 2);
        const v = this._pickVoice(profile);
        if (v) u.voice = v;
        u.onend = () => { this.speaking = false; };
        u.onerror = () => {
          this.speaking = false;
          this._speakSynth(line, profile);
        };
        this.synth.speak(u);
        return;
      } catch (e) {}
    }
    this._speakSynth(line, profile);
  }

  _pickVoice(profile) {
    if (!this.synth || !this.voices.length) return null;
    const rus = this.voices.filter(v => /ru/i.test(v.lang || ''));
    const pool = rus.length ? rus : this.voices;
    const mask = (profile.mask || '').toLowerCase().trim();
    if (mask) {
      for (const v of pool) {
        if (v.name.toLowerCase().includes(mask)) return v;
      }
    }
    return pool[0];
  }

  // --- WebAudio fallback "declaimer" ---
  _speakSynth(line, profile) {
    const ctx = this.audio.ctx || (this.audio.init(), this.audio.ctx);
    if (!ctx) { this.speaking = false; return; }
    this.speaking = true;
    const p = Object.assign({ base: -2, rate: 1, waveform: 'sine', pitch: 1, jitter: 0.08, echo: 0, volume: 0.3 }, profile);
    const rising = /[?？]\s*$/.test(line);
    const exclaim = /[!！]\s*$/.test(line);
    const ellipsis = /(\.\.\.|…)\s*$/.test(line);
    const words = line.split(/\s+/).filter(Boolean);
    const sPerWord = 0.55 / p.rate;
    let t = ctx.currentTime + 0.02;
    for (const w of words) {
      const n = Math.max(1, Math.min(4, Math.ceil(w.length / 3)));
      const per = sPerWord / n;
      for (let i = 0; i < n; i++) {
        this._blip(ctx, p, w, i, n, t + per * i, per, { rising, exclaim, ellipsis });
      }
      // punctuation pauses
      if (/[.!?…]/.test(w[w.length - 1])) {
        if (ellipsis) t += 0.34;
        else if (/[!?]/.test(w[w.length - 1])) t += 0.26;
        else t += 0.2;
      }
      t += sPerWord;
    }
    const end = t + 0.2;
    this._synthTimer = setTimeout(() => { this.speaking = false; }, (end - ctx.currentTime) * 1000);
  }

  _blip(ctx, p, word, i, n, t, dur, mood) {
    if (this.audio.muted) return;
    const master = this.audio.master || ctx.destination;
    const freqBase = NOTE * Math.pow(2, (p.base || 0) / 12) * (p.pitch || 1);
    const lastSyl = i === n - 1;
    const accent = lastSyl ? 1.12 : (i === 0 ? 1.0 : 0.93);
    const jit = 1 + (Math.random() * 2 - 1) * (p.jitter || 0.1);
    let f0 = freqBase * accent * jit;
    let f1 = f0 * (lastSyl && mood.rising ? 1.3 : mood.exclaim ? 1.18 : 0.88);
    if (lastSyl && mood.ellipsis) f1 = f0 * 0.7;
    f0 = Math.max(30, f0);
    f1 = Math.max(30, f1);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.00015, p.volume || 0.3), t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);

    const o = ctx.createOscillator();
    o.type = p.waveform || 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.9);

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = f0 * 2.1;
    bpf.Q.value = 5;
    o.connect(bpf).connect(g).connect(master);

    if (p.echo > 0) {
      const d = ctx.createDelay(0.7);
      d.delayTime.value = 0.2;
      const eg = ctx.createGain();
      eg.gain.value = (p.volume || 0.3) * 0.4 * p.echo;
      g.connect(d);
      d.connect(eg).connect(master);
    }

    o.start(t);
    o.stop(t + dur + 0.05);

    if (i === 0) this._noiseBurst(ctx, t, dur * 0.4, f0 * 2.4, (p.volume || 0.3) * 0.45);
  }

  _noiseBurst(ctx, t, dur, freq, gainV) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gainV;
    src.connect(f).connect(g).connect(this.audio.master || ctx.destination);
    src.start(t);
  }

  _killSynth() {
    if (this._synthTimer) { clearTimeout(this._synthTimer); this._synthTimer = null; }
  }

  _clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
}