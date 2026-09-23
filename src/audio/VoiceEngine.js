// TTS facade for dialogue. Each engine has a real endpoint / source:
//   1. `edge`   — Microsoft Edge Read Aloud cloud TTS over WebSocket
//                 (direct in Edge, or via the bundled relay tools/tts-relay.js)
//   2. `google` — Google Translate TTS (translate_tts mp3 + clients5 JSON base64)
//   3. `web`    — device voices: native Android TextToSpeech bridge
//                 (`window.NuarTTS`) or the browser Web Speech API
//   4. `synth`  — local WebAudio "declaimer", always works offline
//   `auto` walks the chain by availability.
const NOTE = 110;
const EDGE_WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_TIMEOUT = 8000;
// Google Translate TTS: mp3 endpoint (limit ~200 chars per request) and the
// newer JSON endpoint Chrome itself uses (base64 mp3 in payload[1]).
const GTTS_URL = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ru&q=';
const GTTS_CHUNK = 180;
const CLIENTS5_URL = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=ru&tl=en&q=';

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
    this.profile = localStorage.getItem('nuar_voice_profile') || '';
    // мост Android вызывает это в конце реплики
    try {
      if (typeof window !== 'undefined') window.__ttsDone = () => this.notifyDone();
    } catch (e) { /* ignore */ }
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

  // нативный мост Android TextToSpeech, добавляется оболочкой APK
  get androidTTS() {
    return (typeof window !== 'undefined' && window.NuarTTS) ? window.NuarTTS : null;
  }

  get supportedAndroid() {
    const b = this.androidTTS;
    return !!(b && typeof b.speak === 'function');
  }

  // что реально доступно в этом окружении (для UI настроек)
  capabilities() {
    return {
      edge: this.supportedEdge,
      google: true, // http-запрос работает из WebView напрямую
      web: this.supportedAndroid || this.supportedWeb,
      android: this.supportedAndroid,
      synth: true,
    };
  }

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

  setMode(mode) {
    const valid = ['auto', 'edge', 'web', 'synth', 'google'];
    if (valid.includes(mode)) {
      this.mode = mode;
      localStorage.setItem('nuar_voice_engine', mode);
      this.stop();
    }
  }

  setProfile(profile) {
    if (profile) {
      this.profile = profile;
      localStorage.setItem('nuar_voice_profile', profile);
    }
  }

  // адрес релея используется и для Edge, и для Google (там он снимает CORS)
  setRelay(url) {
    this._edgeRelay = String(url || '').trim();
    localStorage.setItem('nuar_tts_relay', this._edgeRelay);
    this.stop();
  }

  // вызывается нативным мостом Android, когда реплика договорена
  notifyDone() {
    if (this._ttsTimer) { clearTimeout(this._ttsTimer); this._ttsTimer = null; }
    this.speaking = false;
  }

  stop() {
    try { if (this.synth) this.synth.cancel(); } catch (e) {}
    if (this._source) { try { this._source.stop(); } catch (e) {} this._source = null; }
    if (this._audioEl) { try { this._audioEl.pause(); } catch (e) {} this._audioEl = null; }
    if (this._gTimer) { clearTimeout(this._gTimer); this._gTimer = null; }
    const bridge = this.androidTTS;
    if (bridge && typeof bridge.stop === 'function') { try { bridge.stop(); } catch (e) {} }
    this._cleanupEdge();
    this._killSynth();
    this.speaking = false;
  }

  // режет текст на куски <= limit, не разрывая слова
  _chunkText(text, limit) {
    const clean = String(text).replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    if (clean.length <= limit) return [clean];
    const parts = [];
    let cur = '';
    for (const word of clean.split(' ')) {
      if (!cur) { cur = word; continue; }
      if ((cur + ' ' + word).length <= limit) {
        cur += ' ' + word;
      } else {
        parts.push(cur);
        cur = word;
        while (cur.length > limit) {
          parts.push(cur.slice(0, limit));
          cur = cur.slice(limit);
        }
      }
    }
    if (cur) parts.push(cur);
    return parts.filter(Boolean);
  }

  speak(line, profile = {}) {
    if (!this.enabled || !line) return;
    this.stop();
    const mode = this.mode;
    if (mode === 'synth') { this._speakSynth(line, profile); return; }
    if (mode === 'google') {
      this._speakGoogle(line, profile, (ok) => { if (!ok) this._speakWebThenSynth(line, profile); });
      return;
    }
    if (mode === 'web') { this._speakWebThenSynth(line, profile); return; }
    if (mode === 'edge') {
      this._speakEdge(line, profile, (ok) => { if (!ok) this._speakGoogle(line, profile, (ok2) => { if (!ok2) this._speakSynth(line, profile); }); });
      return;
    }
    // auto: Edge → Google → системный голос → локальный синтезатор
    if (this.supportedEdge) {
      this._speakEdge(line, profile, (ok) => {
        if (ok) return;
        this._speakGoogle(line, profile, (ok2) => { if (!ok2) this._speakWebThenSynth(line, profile); });
      });
      return;
    }
    this._speakGoogle(line, profile, (ok) => { if (!ok) this._speakWebThenSynth(line, profile); });
  }

  // --- 2. Google Translate TTS ---
  // Три пути, по очереди:
  //   1) релей (если задан) — mp3 с CORS, читаем байты и играем через WebAudio;
  //   2) прямой mp3 через <audio> — CORS не нужен, но звучит системный плеер;
  //   3) JSON-эндпоинт clients5 с base64 (если он ещё отдаёт аудио).
  _speakGoogle(line, profile, cb) {
    const chunks = this._chunkText(line, GTTS_CHUNK);
    if (!chunks.length) { cb(false); return; }
    let i = 0;
    const playNext = () => {
      if (i >= chunks.length) { this.speaking = false; cb(true); return; }
      const text = chunks[i++];
      this._googleChunk(text, profile, (ok) => {
        if (!ok) { this.speaking = false; cb(false); return; }
        setTimeout(playNext, 60);
      });
    };
    this.speaking = true;
    playNext();
  }

  // токен gTTS: без него endpoint иногда отдаёт HTML-ошибку вместо mp3
  _gttsToken(text) {
    const bytes = new TextEncoder().encode(text);
    let buf = 0;
    let len = 0;
    for (const c of bytes) {
      buf = c;
      len += buf * (len + 1);
      if (len >= 0x8000) {
        len = 0;
        len += (buf ^ 0xff) << 24 >> 2;
      }
      while (len & 0xffff0000) len = (len & 0x7fffffff) >> 1;
    }
    return len >>> 0;
  }

  _googleChunk(text, profile, cb) {
    const rate = this._clamp(profile.rate !== undefined ? profile.rate : 1, 0.5, 2);
    const tl = profile.tl || 'ru';
    // Google принимает ttspeed только в диапазоне 0.24…0.99
    const speed = Math.max(0.24, Math.min(0.99, rate * 0.45 + 0.32)).toFixed(2);
    const tk = this._gttsToken(text);
    const direct = `${GTTS_URL}${encodeURIComponent(text)}&ttspeed=${speed}&tk=${tk}&total=1&idx=0&textlen=${text.length}`;

    if (this._edgeRelay) {
      // 1) релей: CORS открыт, байты читаем и играем через общий WebAudio
      const base = String(this._edgeRelay).replace(/\/+$/, '');
      fetch(base + '/google?text=' + encodeURIComponent(text) + '&tl=' + encodeURIComponent(tl), { mode: 'cors' })
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('relay ' + r.status))))
        .then((buf) => this._playBuf(buf, cb))
        .catch(() => this._googleDirect(text, direct, cb));
      return;
    }
    this._googleDirect(text, direct, cb);
  }

  _googleDirect(text, url, cb) {
    let settled = false;
    const finish = (ok) => { if (settled) return; settled = true; this._audioEl = null; if (this._gTimer) { clearTimeout(this._gTimer); this._gTimer = null; } cb(ok); };
    const tryJson = () => {
      if (settled) return;
      if (typeof fetch !== 'function') { finish(false); return; }
      fetch(CLIENTS5_URL + encodeURIComponent(text), { mode: 'cors', credentials: 'omit' })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error('http ' + r.status))))
        .then((txt) => {
          const json = JSON.parse(txt);
          const b64 = json && json[1] && typeof json[1] === 'string' ? json[1] : '';
          if (!b64) throw new Error('no audio');
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
          this._playBuf(bytes.buffer, finish);
        })
        .catch(() => finish(false));
    };
    try {
      const a = new Audio(url);
      this._audioEl = a;
      this._markSource('google');
      a.volume = this.audio.muted ? 0 : 1;
      a.onended = () => finish(true);
      a.onerror = () => tryJson();
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => tryJson());
      this._gTimer = setTimeout(() => tryJson(), 2500);
    } catch (e) {
      tryJson();
    }
  }

  // --- 1. Edge TTS cloud ---
  _speakEdge(line, profile, cb) {
    if (!this.supportedEdge) { cb(false); return; }
    if (this._edgeRelay) { this._relaySpeech(line, profile, cb); return; }
    this._edgePending = true;
    const ws = new WebSocket(`${EDGE_WSS}?TrustedClientToken=${EDGE_TOKEN}&ConnectionId=${this._uuid()}`);
    this._edgeWs = ws;
    const chunks = [];
    let audioChunk = false;
    const fail = () => { this._cleanupEdge(); cb(false); };
    this._edgeTimer = setTimeout(fail, EDGE_TIMEOUT);
    ws.onopen = () => {
      this._markSource('edge');
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
    this._markSource('edge');
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

  // имя движка, который реально озвучил последнюю реплику (для настроек)
  _markSource(name) { this.lastSource = name; }

  sourceName() {
    if (this.lastSource === 'android') return 'Системный голос Android';
    if (this.lastSource === 'edge') return 'Edge TTS';
    if (this.lastSource === 'google') return 'Google TTS';
    if (this.lastSource === 'web') return 'Web Speech (браузер)';
    if (this.lastSource === 'synth') return 'Локальный синтезатор';
    return '—';
  }

  _cleanupEdge() {
    if (this._edgeTimer) { clearTimeout(this._edgeTimer); this._edgeTimer = null; }
    if (this._edgeWs) {
      this._edgeDone = true;
      try { this._edgeWs.close(); } catch (e) {}
      this._edgeWs = null;
    }
  }

  // --- 3. Системные голоса устройства: Android TextToSpeech → Web Speech → synth ---
  _speakWebThenSynth(line, profile) {
    const bridge = this.androidTTS;
    if (this.supportedAndroid && bridge) {
      this.speaking = true;
      const rate = this._clamp(profile.rate !== undefined ? profile.rate : 1, 0.5, 2);
      const pitch = this._clamp(profile.pitch !== undefined ? profile.pitch : 1, 0.5, 2);
      const ok = bridge.speak(line, rate, pitch);
      if (ok !== false) {
        this._markSource('android');
        // мост вызывает window.__ttsDone() по окончании реплики; подстрахуемся
        // таймером, чтобы флаг speaking не залип навсегда
        if (this._ttsTimer) clearTimeout(this._ttsTimer);
        const estMs = Math.max(1500, String(line).length * 95);
        this._ttsTimer = setTimeout(() => {
          this._ttsTimer = null;
          if (this.speaking && this.lastSource === 'android') this.speaking = false;
        }, estMs + 4000);
        return;
      }
      this.speaking = false;
    }
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
      this._markSource('web');
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
    const mask = ((profile && profile.mask) || this.profile || '').toLowerCase().trim();
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
    this._markSource('synth');
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