#!/usr/bin/env node
// TTS relay for «Нуар-Дет».
//
// Нужен, когда облачный движок недоступен прямо из клиента:
//   • Edge TTS принимает соединения не от любых UA, а с IP дата-центра
//     отдаёт 403 (анти-бот Microsoft);
//   • Google Translate TTS отдаёт mp3 без заголовков CORS, поэтому браузер
//     может его только слушать (<audio>), но не прочитать байты.
//
// Этот сервер решает обе проблемы: сам ходит в облако и отдаёт результат
// с `Access-Control-Allow-Origin: *`.
//
// Запуск:      node tools/tts-relay.js
// Порт:        8787 (меняется переменной PORT)
// Проверка:    curl http://127.0.0.1:8787/health
// В игре:      Настройки → «Адрес релея»: http://<хост>:8787
//
// Эндпоинты:
//   GET  /health                              → {"ok":true,...}
//   GET  /google?text=Привет&tl=ru             → audio/mpeg (CORS *)
//   POST /v1/audio/speech {input,voice,...}   → audio/mpeg (OpenAI-совместимый)

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

// Порт: RELAY_PORT (не PORT — эта переменная часто занята хостингом), 8787 по умолчанию
const PORT = Number(process.env.RELAY_PORT || 8787);
const HOST = process.env.RELAY_HOST || '0.0.0.0';
const EDGE_WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_TIMEOUT = 10000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Edg/124.0';
const CHUNK = 180;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const uuid = () => (randomUUID ? randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const split = (t) => t.match(/[\s\S]{1,180}/g) || [t];

// --- Edge TTS: тот же протокол Read Aloud, но с серверной стороны ---
function edgeMp3(text, voice, ratePct, pitchHz) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${EDGE_WSS}?TrustedClientToken=${EDGE_TOKEN}&ConnectionId=${uuid()}`, {
      headers: { 'User-Agent': UA },
    });
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
    ws.on('open', () => {
      const ts = new Date().toISOString().replace(/\.\d{3}Z$/, '.0000');
      ws.send('X-Timestamp:' + ts + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n'
        + '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}');
      const ssml = "<speak version='1.0' xml:lang='ru-RU'><voice name='" + voice + "'>"
        + "<prosody pitch='" + pitchHz + "Hz' rate='" + ratePct + "%' volume='+0%'>" + esc(text) + "</prosody></voice></speak>";
      ws.send('X-RequestId:' + uuid() + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + ts + '\r\nPath:ssml\r\n\r\n' + ssml);
    });
    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        if (data.toString().indexOf('Path:turn.end') >= 0) {
          if (!chunks.length) done(new Error('edge empty'));
          else done(null, Buffer.concat(chunks));
        }
        return;
      }
      const arr = Buffer.isBuffer(data) ? data : Buffer.from(data);
      let idx = 0;
      let audioStart = -1;
      while (idx < arr.length) {
        const nl = arr.indexOf(0x0a, idx);
        if (nl < 0) break;
        const line = arr.subarray(idx, nl).toString('latin1').trim();
        if (!line.length) { audioStart = nl + 1; break; }
        idx = nl + 1;
      }
      if (audioStart > 0 && audioStart < arr.length) chunks.push(Buffer.from(arr.subarray(audioStart)));
    });
    ws.on('error', (e) => done(e));
    ws.on('close', () => { if (!chunks.length) done(new Error('edge closed')); });
  });
}

// --- Google Translate TTS (mp3, режем по ~180 символов) ---
async function googleMp3(text, tl) {
  const u = new URL('https://translate.google.com/translate_tts');
  u.searchParams.set('ie', 'UTF-8');
  u.searchParams.set('client', 'tw-ob');
  u.searchParams.set('tl', tl || 'ru');
  u.searchParams.set('q', text);
  const r = await fetch(u.toString(), { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('google http ' + r.status);
  const b = Buffer.from(await r.arrayBuffer());
  if (!b.length) throw new Error('google empty');
  return b;
}

function sendMp3(res, buf) {
  res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
  res.end(buf);
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  if (p === '/health') {
    sendJson(res, 200, { ok: true, service: 'nuar-det-tts-relay', engines: ['edge', 'google'], time: new Date().toISOString() });
    return;
  }

  if (p === '/google' && req.method === 'GET') {
    const text = (url.searchParams.get('text') || '').trim();
    if (!text) { sendJson(res, 400, { error: 'text is required' }); return; }
    try {
      const bufs = [];
      for (const part of split(text)) bufs.push(await googleMp3(part.trim(), url.searchParams.get('tl') || 'ru'));
      sendMp3(res, Buffer.concat(bufs));
    } catch (e) {
      sendJson(res, 502, { error: String(e.message || e) });
    }
    return;
  }

  if (p === '/v1/audio/speech' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (e) { sendJson(res, 400, { error: 'bad json' }); return; }
    const input = String(body.input || '').trim();
    if (!input) { sendJson(res, 400, { error: 'input is required' }); return; }
    const voice = body.voice || 'ru-RU-DmitryNeural';
    const rate = Number(body.rate) || 1;
    const pitch = Number(body.pitch) || 1;
    const ratePct = Math.round((Math.max(0.5, Math.min(2, rate)) - 1) * 100);
    const pitchHz = Math.round((Math.max(0.2, Math.min(3, pitch)) - 1) * 100);
    try {
      const bufs = [];
      for (const part of split(input)) bufs.push(await edgeMp3(part.trim(), voice, ratePct, pitchHz));
      sendMp3(res, Buffer.concat(bufs));
    } catch (e) {
      sendJson(res, 502, { error: String(e.message || e) });
    }
    return;
  }

  sendJson(res, 404, { error: 'not found', paths: ['/health', '/google?text=', 'POST /v1/audio/speech'] });
});

server.listen(PORT, HOST, () => {
  console.log(`[relay] Нуар-Дет TTS relay: http://${HOST}:${PORT}`);
  console.log('[relay] health:  /health');
  console.log('[relay] google:  /google?text=Привет&tl=ru');
  console.log('[relay] edge:    POST /v1/audio/speech');
});
