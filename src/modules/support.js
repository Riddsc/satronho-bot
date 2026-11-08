// Ayuda y reportes: el streamer cuenta qué falla (o pide ayuda, o da una
// idea) y llega a un canal de Discord de RiddsSatronho por un webhook.
//
// El webhook no está en el código: se graba al empaquetar desde el secreto
// DISCORD_WEBHOOK_URL de GitHub Actions (o SATRONHO_DISCORD_WEBHOOK en tu
// PC, o src/builtin.json → discord.webhook).
//
// Diagnóstico (opcional, el streamer ve exactamente qué se envía):
// versión, Windows, plataformas conectadas y los últimos errores de la app.
// Nunca se envían claves, tokens ni contraseñas: se tachan antes.

const fs = require('fs');
const os = require('os');
const path = require('path');

function builtinWebhook() {
  if (process.env.SATRONHO_DISCORD_WEBHOOK) return process.env.SATRONHO_DISCORD_WEBHOOK;
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'builtin.json'), 'utf8')).discord?.webhook || '';
  } catch {
    return '';
  }
}

// Tacha lo que parezca una clave: tokens largos, «secret=…», webhooks.
function redact(text) {
  return String(text)
    .replace(/https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/webhooks\/\S+/gi, '[webhook]')
    .replace(/((?:secret|token|password|clave|authorization|apikey|api_key)["'\s:=]+)[^\s"',}]+/gi, '$1[oculto]')
    .replace(/\b(?:sb_publishable_|sk_|pk_)?[A-Za-z0-9_\-]{32,}\b/g, '[oculto]');
}

// Bitácora de errores: últimas 150 líneas, en memoria.
function createLogbook() {
  const lines = [];
  const add = (level, ...parts) => {
    const text = redact(parts.map((p) => (p instanceof Error ? p.stack || p.message : typeof p === 'string' ? p : JSON.stringify(p))).join(' ')).slice(0, 800);
    lines.push(`${new Date().toISOString()} [${level}] ${text}`);
    if (lines.length > 150) lines.shift();
  };
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...a) => { add('error', ...a); origError(...a); };
  console.warn = (...a) => { add('aviso', ...a); origWarn(...a); };
  process.on('uncaughtException', (err) => add('fallo', err));
  process.on('unhandledRejection', (err) => add('fallo', err));
  return { add, lines: () => lines.slice(), recent: (n = 60) => lines.slice(-n) };
}

const KINDS = {
  error: { title: '🐞 Algo falla', color: 0xff5d6c },
  ayuda: { title: '🙋 Necesito ayuda', color: 0x5fd0ff },
  idea: { title: '💡 Tengo una idea', color: 0xffb23e },
};

function createSupport({ fetch: fetchFn = fetch, logbook, appInfo = {}, getStatus = () => ({}), getExtra = () => [], webhook = builtinWebhook() }) {
  let lastSent = 0;
  let sentToday = { day: '', n: 0 };

  function diagnostics() {
    const status = getStatus() || {};
    const plats = Object.values(status)
      .filter((s) => s?.platform && s.platform !== 'panel')
      .map((s) => `${s.platform}: ${s.state}${s.detail ? ` (${redact(s.detail)})` : ''}`)
      .join('\n') || 'ninguna';
    return [
      `Satronho Bot ${appInfo.version || '?'}`,
      `Windows: ${os.type()} ${os.release()} · ${os.arch()} · ${Math.round(os.totalmem() / 1e9)} GB RAM`,
      `Idioma del sistema: ${Intl.DateTimeFormat().resolvedOptions().locale}`,
      '',
      'Plataformas:',
      plats,
      '',
      ...(() => { try { const x = getExtra() || []; return x.length ? [...x, ''] : []; } catch { return []; } })(),
      'Últimos errores:',
      ...(logbook?.recent(60) || []),
    ].join('\n');
  }

  async function send({ kind = 'error', message = '', contact = '', includeDiag = true } = {}) {
    const msg = String(message).trim();
    if (msg.length < 5) throw new Error('Cuéntame un poco más (mínimo 5 letras)');
    if (!webhook) throw new Error('Esta copia de Satronho Bot no puede enviar reportes. Copia el reporte y envíalo por otro medio.');
    const now = Date.now();
    if (now - lastSent < 60 * 1000) throw new Error('Espera un minuto antes de enviar otro reporte');
    const day = new Date().toISOString().slice(0, 10);
    if (sentToday.day !== day) sentToday = { day, n: 0 };
    if (sentToday.n >= 10) throw new Error('Ya enviaste 10 reportes hoy. Mañana puedes enviar más.');

    const k = KINDS[kind] || KINDS.error;
    const embed = {
      title: k.title,
      description: redact(msg).slice(0, 3500),
      color: k.color,
      fields: [
        { name: 'Versión', value: String(appInfo.version || '?'), inline: true },
        { name: 'Windows', value: `${os.release()} · ${os.arch()}`, inline: true },
        ...(contact ? [{ name: 'Contacto', value: redact(String(contact)).slice(0, 200), inline: false }] : []),
      ],
      footer: { text: 'Enviado desde Satronho Bot · Ayuda' },
      timestamp: new Date().toISOString(),
    };
    const payload = { username: 'MechaRidds · Reportes', embeds: [embed], allowed_mentions: { parse: [] } };

    let res;
    if (includeDiag) {
      const form = new FormData();
      form.append('payload_json', JSON.stringify(payload));
      form.append('files[0]', new Blob([diagnostics()], { type: 'text/plain' }), 'diagnostico.txt');
      res = await fetchFn(webhook, { method: 'POST', body: form });
    } else {
      res = await fetchFn(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    if (!res.ok) throw new Error(`No se pudo enviar (Discord respondió ${res.status}). Inténtalo más tarde.`);
    lastSent = now;
    sentToday.n++;
    return { ok: true };
  }

  return { send, diagnostics, available: () => Boolean(webhook) };
}

module.exports = { createSupport, createLogbook, redact };
