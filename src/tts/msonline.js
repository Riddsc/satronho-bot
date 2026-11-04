// Voces en línea de Microsoft (las voces neuronales de «Leer en voz alta» de
// Edge). Dan acentos de casi toda Latinoamérica, pero:
//   - necesitan internet en cada mensaje,
//   - no son un servicio oficial para apps: Microsoft puede cambiarlo o
//     cortarlo sin aviso. Si fallan, Troya usa la voz de Windows.
// Es una opción extra; Piper sigue siendo la base sin internet.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { secMsGecV2 } = require('./msGec');

// Una femenina y una masculina por país (lo que ofrece Microsoft).
const RAW = [
  ['es-CO', 'Colombia', 'Salome', 'f'], ['es-CO', 'Colombia', 'Gonzalo', 'm'],
  ['es-MX', 'México', 'Dalia', 'f'], ['es-MX', 'México', 'Jorge', 'm'],
  ['es-AR', 'Argentina', 'Elena', 'f'], ['es-AR', 'Argentina', 'Tomas', 'm'],
  ['es-CL', 'Chile', 'Catalina', 'f'], ['es-CL', 'Chile', 'Lorenzo', 'm'],
  ['es-PE', 'Perú', 'Camila', 'f'], ['es-PE', 'Perú', 'Alex', 'm'],
  ['es-VE', 'Venezuela', 'Paola', 'f'], ['es-VE', 'Venezuela', 'Sebastian', 'm'],
  ['es-EC', 'Ecuador', 'Andrea', 'f'], ['es-EC', 'Ecuador', 'Luis', 'm'],
  ['es-UY', 'Uruguay', 'Valentina', 'f'], ['es-UY', 'Uruguay', 'Mateo', 'm'],
  ['es-BO', 'Bolivia', 'Sofia', 'f'], ['es-BO', 'Bolivia', 'Marcelo', 'm'],
  ['es-PY', 'Paraguay', 'Tania', 'f'], ['es-PY', 'Paraguay', 'Mario', 'm'],
  ['es-CR', 'Costa Rica', 'Maria', 'f'], ['es-CR', 'Costa Rica', 'Juan', 'm'],
  ['es-PA', 'Panamá', 'Margarita', 'f'], ['es-PA', 'Panamá', 'Roberto', 'm'],
  ['es-DO', 'República Dominicana', 'Ramona', 'f'], ['es-DO', 'República Dominicana', 'Emilio', 'm'],
  ['es-GT', 'Guatemala', 'Marta', 'f'], ['es-GT', 'Guatemala', 'Andres', 'm'],
  ['es-HN', 'Honduras', 'Karla', 'f'], ['es-HN', 'Honduras', 'Carlos', 'm'],
  ['es-NI', 'Nicaragua', 'Yolanda', 'f'], ['es-NI', 'Nicaragua', 'Federico', 'm'],
  ['es-SV', 'El Salvador', 'Lorena', 'f'], ['es-SV', 'El Salvador', 'Rodrigo', 'm'],
  ['es-PR', 'Puerto Rico', 'Karina', 'f'], ['es-PR', 'Puerto Rico', 'Victor', 'm'],
  ['es-CU', 'Cuba', 'Belkys', 'f'], ['es-CU', 'Cuba', 'Manuel', 'm'],
  ['es-US', 'Latinos en EE. UU.', 'Paloma', 'f'], ['es-US', 'Latinos en EE. UU.', 'Alonso', 'm'],
];
const PRETTY = { Salome: 'Salomé', Tomas: 'Tomás', Sebastian: 'Sebastián', Sofia: 'Sofía', Maria: 'María', Andres: 'Andrés', Victor: 'Víctor' };

const MS_VOICES = RAW.map(([locale, country, name, gender]) => ({
  id: `${locale}-${name}Neural`,
  key: `ms:${locale}-${name}Neural`,
  locale,
  country,
  name: PRETTY[name] || name,
  gender,
}));

const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
// Versión de Edge que se presenta (la misma que edge-tts 7.3.1).
const CHROMIUM = '143.0.3650.75';
const WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';

const escXml = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

function createMsOnlineEngine({ outDir }) {
  let skewSec = 0; // corrección si el reloj del PC está desfasado
  let failures = 0;

  // Firma que pide el servicio (v2, cambia cada 5 minutos). Ver msGec.js.
  const secGec = () => secMsGecV2(Date.now() / 1000 + skewSec, TOKEN);
  const muid = () => crypto.randomBytes(16).toString('hex').toUpperCase();

  function once(voiceId, text, rate) {
    return new Promise((resolve, reject) => {
      const url = `${WSS}?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${secGec()}&Sec-MS-GEC-Version=2-${CHROMIUM}&ConnectionId=${crypto.randomUUID().replace(/-/g, '')}`;
      const ws = new WebSocket(url, {
        headers: {
          Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM.split('.')[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM.split('.')[0]}.0.0.0`,
          Pragma: 'no-cache',
          'Cache-Control': 'no-cache',
          'Accept-Language': 'en-US,en;q=0.9',
          Cookie: `muid=${muid()};`,
        },
        perMessageDeflate: true,
      });
      const chunks = [];
      const timer = setTimeout(() => { ws.terminate(); reject(new Error('Las voces en línea tardaron demasiado')); }, 15000);
      const done = (err, buf) => { clearTimeout(timer); try { ws.close(); } catch { /* ya cerrado */ } if (err) reject(err); else resolve(buf); };

      ws.on('unexpected-response', (_req, res) => {
        // 403 suele ser el reloj del PC desfasado: tomamos la hora del servidor.
        const date = Date.parse(res.headers.date || '');
        if (res.statusCode === 403 && date) skewSec = (date - Date.now()) / 1000;
        done(new Error(`Microsoft rechazó la voz en línea (HTTP ${res.statusCode})`));
      });
      ws.on('error', (e) => done(new Error(`Sin conexión con las voces en línea (${e.code || e.message})`)));
      ws.on('open', () => {
        const ts = new Date().toString();
        ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}');
        const pct = Math.round((Number(rate) || 1) * 100 - 100);
        const locale = voiceId.split('-').slice(0, 2).join('-');
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${locale}'><voice name='Microsoft Server Speech Text to Speech Voice (${locale}, ${voiceId.slice(locale.length + 1)})'><prosody pitch='+0Hz' rate='${pct >= 0 ? '+' : ''}${pct}%' volume='+0%'>${escXml(text)}</prosody></voice></speak>`;
        ws.send(`X-RequestId:${crypto.randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`);
      });
      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          const buf = Buffer.from(data);
          const headLen = buf.readUInt16BE(0);
          const head = buf.subarray(2, 2 + headLen).toString();
          if (head.includes('Path:audio')) chunks.push(buf.subarray(2 + headLen));
        } else if (String(data).includes('Path:turn.end')) {
          const audio = Buffer.concat(chunks);
          if (!audio.length) done(new Error('La voz en línea no devolvió audio'));
          else done(null, audio);
        }
      });
    });
  }

  async function synth(text, { voiceId, rate = 1 }) {
    if (!MS_VOICES.some((v) => v.id === voiceId)) throw new Error(`Voz en línea desconocida: ${voiceId}`);
    let audio;
    try {
      audio = await once(voiceId, text, rate);
    } catch (err) {
      if (!/403/.test(err.message)) { failures += 1; throw err; }
      audio = await once(voiceId, text, rate); // segundo intento con la hora corregida
    }
    failures = 0;
    const name = `tts-ms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.mp3`;
    fs.writeFileSync(path.join(outDir, name), audio);
    return name;
  }

  return { synth, voices: () => MS_VOICES, failures: () => failures };
}

module.exports = { createMsOnlineEngine, MS_VOICES };
