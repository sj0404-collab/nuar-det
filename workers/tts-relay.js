// Встроенный Edge/Google TTS-релей для «Нуар-Дет» (Cluodflare Worker).
// Тот же API, что и у tools/tts-relay.js:
//   GET  /health                              → {"ok":true,...}
//   GET  /google?text=Привет&tl=ru             → audio/mpeg (CORS *)
//   POST /v1/audio/speech {input,voice,rate,pitch} → audio/mpeg
// Деплой: .github/workflows/relay.yml (wrangler deploy).
// В настройках игры адрес указывается в поле «Релей TTS».
import { connect } from 'cloudflare:sockets';

const EDGE_WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
const EDGE_TIMEOUT = 15000;

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const split = (t) => t.match(/[\s\S]{1,180}/g) || [t];

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function edgeMp3(text, voice, ratePct, pitchHz) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = connect(`${EDGE_WSS}?TrustedClientToken=${EDGE_TOKEN}&ConnectionId=${uuid()}`, {
        headers: { 'User-Agent': UA },
      });
    } catch (e) { reject(e); return; }
    const chunks = [];
    let settled = false;
    const done = (err, buf) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch (e) { /* ignore */ }
      if (err) reject(err); else resolve(buf);
    };
    const timer = setTimeout(() => done(new Error('edge timeout')), EDGE_TIMEOUT);
    ws.addEventListener('open', () => {
      const ts = new Date().toISOString().replace(/\.\d{3}Z$/, '.0000');
      ws.send('X-Timestamp:' + ts + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n'
        + '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}');
      const ssml = "<speak version='1.0' xml:lang='ru-RU'><voice name='" + voice + "'>"
        + "<prosody pitch='" + pitchHz + "Hz' rate='" + ratePct + "%' volume='+0%'>" + esc(text) + "</prosody></voice></speak>";
      ws.send('X-RequestId:' + uuid() + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + ts + '\r\nPath:ssml\r\n\r\n' + ssml);
    });
    ws.addEventListener('message', (ev) => {
      const data = ev.data;
      const isBinary = typeof data !== 'string';
      if (!isBinary) {
        if (String(data).indexOf('Path:turn.end') >= 0) {
          if (!chunks.length) done(new Error('edge empty'));
          else done(null, concat(chunks));
        }
        return;
      }
      const arr = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      let idx = 0;
      let audioStart = -1;
      while (idx < arr.length) {
        const nl = arr.indexOf(0x0a, idx);
        if (nl < 0) break;
        const line = String.fromCharCode(...arr.subarray(idx, nl)).trim();
        if (!line.length) { audioStart = nl + 1; break; }
        idx = nl + 1;
      }
      if (audioStart > 0 && audioStart < arr.length) chunks.push(arr.subarray(audioStart));
    });
    ws.addEventListener('error', (e) => done(e));
    ws.addEventListener('close', () => { if (!chunks.length) done(new Error('edge closed')); });
  });
}

function concat(chunks) {
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

async function googleMp3(text, tl) {
  const u = new URL('https://translate.google.com/translate_tts');
  u.searchParams.set('ie', 'UTF-8');
  u.searchParams.set('client', 'tw-ob');
  u.searchParams.set('tl', tl || 'ru');
  u.searchParams.set('q', text);
  const r = await fetch(u.toString(), { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('google http ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}

function audioRes(buf) {
  return new Response(buf, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function json(code, obj) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (code === 204) return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify(obj), { status: code, headers });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const p = url.pathname;

    if (request.method === 'OPTIONS') return json(204, null);

    if (p === '/health') {
      return json(200, { ok: true, service: 'nuar-det-tts-relay', engines: ['edge', 'google'], time: new Date().toISOString() });
    }

    if (p === '/google' && request.method === 'GET') {
      const text = (url.searchParams.get('text') || '').trim();
      if (!text) return json(400, { error: 'text is required' });
      try {
        const bufs = [];
        for (const part of split(text)) bufs.push(await googleMp3(part.trim(), url.searchParams.get('tl') || 'ru'));
        return audioRes(concat(bufs));
      } catch (e) { return json(502, { error: String(e.message || e) }); }
    }

    if (p === '/v1/audio/speech' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json(400, { error: 'bad json' }); }
      const input = String(body.input || '').trim();
      if (!input) return json(400, { error: 'input is required' });
      const voice = body.voice || 'ru-RU-DmitryNeural';
      const rate = Number(body.rate) || 1;
      const pitch = Number(body.pitch) || 1;
      const ratePct = Math.round((Math.max(0.5, Math.min(2, rate)) - 1) * 100);
      const pitchHz = Math.round((Math.max(0.2, Math.min(3, pitch)) - 1) * 100);
      try {
        const bufs = [];
        for (const part of split(input)) bufs.push(await edgeMp3(part.trim(), voice, ratePct, pitchHz));
        return audioRes(concat(bufs));
      } catch (e) { return json(502, { error: String(e.message || e) }); }
    }

    return json(404, { error: 'not found', paths: ['/health', '/google?text=', 'POST /v1/audio/speech'] });
  },
};