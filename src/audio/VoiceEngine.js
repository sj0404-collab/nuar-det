// TTS facade for dialogue. Source priority:
//   1. Edge TTS cloud voices — direct WS in Microsoft Edge, or an optional
//      self-hosted OpenAI-compatible relay (localStorage `nuar_tts_relay`)
//      on other browsers/WebViews
//   2. Web Speech API (system voices)
//   3. WebAudio oscillator "declaimer" fallback (works offline, no voices)
const NOTE = 110;
const EDGE_WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_TIMEOUT = 8000;

export class VoiceEngine {
  constructor(audio) {
    this.audio = audio; // AudioSys: shared ctx + master
    this.enabled = localStorage.getItem('nuar_voice') !== '0';
    this.mode = 'auto'; // auto | edge | web | synth
    this.voices = [];
    this.synth = null;
    this.speaking = false;
    // optional self-hosted OpenAI-compatible Edge TTS relay (needed on
    // browsers other than Edge: Edge blocks direct WS from non-Edge UAs)
    this._edgeRelay = localStorage.getItem('nuar_tts_relay') || '';
    this._synthTimer = null;
    this._edgeWs = null;
    this._edgeTimer = null;
    this._source = null;
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

  get isEdgeBrowser() {
    try { return /Edg\//i.test(navigator.userAgent); } catch (e) { return false; }
  }

  get supportedEdge() {
    if (this._edgeRelay) return typeof navigator !== 'undefined' && navigator.onLine !== false;
    // the Read Aloud API accepts connections only from Edge browsers
    return this.isEdgeBrowser && navigator.onLine !== false && 'WebSocket' in window;
  }

  setEnabled(b) {
    this.enabled = !!b;
    localStorage.setItem('nuar_voice', this.enabled ? '1' : '0');
    if (!this.enabled) this.stop();
    return this.enabled;
  }

  toggle() { return this.setEnabled(!this.enabled); }

  stop() {
    try { if (this.synth) this.synth.cancel(); } catch (e) {}
    if (this._source) { try { this._source.stop(); } catch (e) {} this._source = null; }
    this._cleanupEdge();
    this._killSynth();
    this.speaking = false;
  }

  speak(line, profile = {}) {
    if (!this.enabled || !line) return;
    this.stop();
    const mode = this.mode;
    if (mode === 'synth') { this._speakSynth(line, profile); return; }
    if (mode === 'web' || (mode === 'auto' && !this.supportedEdge)) {
      this._speakWebThenSynth(line, profile);
      return;
    }
    // edge or auto → Edge TTS first
    this._speakEdge(line, profile, (ok) => {
      if (!ok) this._speakWebThenSynth(line, profile);
    });
  }

  // --- 1. Edge TTS cloud ---
  _speakEdge(line, profile, cb) {
    if (!this.supportedEdge) { cb(false); return; }
    if (this._edgeRelay) { this._relaySpeech(line, profile, cb); return; }
    const ws = new WebSocket(`${EDGE_WSS}?TrustedClientToken=${EDGE_TOKEN}&ConnectionId=${this._uuid()}`);
    this._edgeWs = ws;
    const chunks = [];
    let audioChunk = false;
    const fail = () => { this._cleanupEdge(); cb(false); };
    this._edgeTimer = setTimeout(fail, EDGE_TIMEOUT);
    ws.onopen = () => {
      const ts = new Date().toISOString().replace(/\.\d{3}Z$/, '.0000');
      ws.send('X-Timestamp:' + ts + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n'
        + '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}');
      const voice = profile.edge || 'ru-RU-DmitryNeural';
      const ratePct = Math.round((this._clamp(profile.rate !== undefined ? profile.rate : 1, 0.5, 2) - 1) * 100);
      const pitchHz = Math.round((this._clamp(profile.pitch !== undefined ? profile.pitch : 1, 0.2, 3) - 1) * 100);
      const ssml = "<speak version='1.0' xml:lang='ru-RU'><voice name='" + voice + "'><prosody pitch='" + pitchHz + "Hz' rate='" + ratePct + "%' volume='+0%'>"
        + this._esc(line) + '</prosody></voice></speak>';
      ws.send('X-RequestId:' + this._uuid() + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + ts + '\r\nPath:ssml\r\n\r\n' + ssml);
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        if (ev.data.indexOf('Path:turn.end') >= 0) {
          if (this._edgeTimer) { clearTimeout(this._edgeTimer); this._edgeTimer = null; }
          this._playEdgeAudio(chunks, profile, cb);
        }
        return;
      }
      const bufPromise = ev.data instanceof Blob ? ev.data.arrayBuffer() : Promise.resolve(ev.data);
      bufPromise.then((ab) => {
        const arr = new Uint8Array(ab);
        let idx = 0;
        let audioStart = -1;
        while (idx < arr.length) {
          const nl = arr.indexOf(0x0a, idx);
          if (nl < 0) { idx = arr.length; break; }
          const line = String.fromCharCode.apply(null, arr.subarray(idx, nl)).trim();
          if (line.length === 0) { audioStart = nl + 1; break; }
          if (line.indexOf('Path:audio') >= 0) audioChunk = true;
          idx = nl + 1;
        }
        if (audioChunk && audioStart >= 0 && audioStart < arr.length) {
          const chunk = arr.subarray(audioStart);
          chunks.push(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
        }
        audioChunk = false;
      }).catch(() => {});
    };
    ws.onerror = fail;
    ws.onclose = () => {
      if (this._edgeTimer) { clearTimeout(this._edgeTimer); this._edgeTimer = null; }
      if (!this._edgeDone) cb(false);
    };
  }

  _playEdgeAudio(chunks, profile, cb) {
    this._cleanupEdge();
    if (!chunks.length) { cb(false); return; }
    const mp3 = new Blob(chunks, { type: 'audio/mpeg' });
    mp3.arrayBuffer().then((buf) => this._playBuf(buf, cb)).catch(() => cb(false));
  }

  // self-hosted OpenAI-compatible Edge TTS relay (/v1/audio/speech)
  _relaySpeech(line, profile, cb) {
    const base = String(this._edgeRelay).replace(/\/+$/, '');
    fetch(base + '/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'edge-tts',
        input: line,
        voice: profile.edge || 'ru-RU-DmitryNeural',
        rate: this._clamp(profile.rate !== undefined ? profile.rate : 1, 0.5, 2),
        pitch: this._clamp(profile.pitch !== undefined ? profile.pitch : 1, 0.2, 3),
        response_format: 'mp3',
      }),
    }).then((res) => {
      if (!res.ok) throw new Error('relay ' + res.status);
      return res.arrayBuffer();
    }).then((buf) => {
      this._playBuf(buf, cb);
    }).catch(() => cb(false));
  }

  _playBuf(buf, cb) {
    const ctx = this.audio.ctx || (this.audio.init(), this.audio.ctx);
    if (!ctx) { cb(false); return; }
    ctx.decodeAudioData(buf).then((audioBuf) => {
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      const g = ctx.createGain();
      g.gain.value = this.audio.muted ? 0 : 0.55;
      src.connect(g).connect(this.audio.master || ctx.destination);
      this.speaking = true;
      this._source = src;
      src.onended = () => { this.speaking = false; this._source = null; };
      if (ctx.state === 'suspended') ctx.resume();
      src.start();
      cb(true);
    }).catch(() => { this.speaking = false; cb(false); });
  }

  _cleanupEdge() {
    if (this._edgeTimer) { clearTimeout(this._edgeTimer); this._edgeTimer = null; }
    if (this._edgeWs) {
      this._edgeDone = true;
      try { this._edgeWs.close(); } catch (e) {}
      this._edgeWs = null;
    }
  }

  // --- 2. Web Speech API ---
  _speakWebThenSynth(line, profile) {
    if (!this.supportedWeb) { this._speakSynth(line, profile); return; }
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
    } catch (e) {
      this.speaking = false;
      this._speakSynth(line, profile);
    }
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

  // --- 3. WebAudio "declaimer" fallback ---
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

  _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  _uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  _clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
}