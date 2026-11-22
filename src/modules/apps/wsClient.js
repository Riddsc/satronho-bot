// Cliente WebSocket con JSON para las apps conectadas (OBS, VTube Studio,
// T.I.T.S., Voicemod, Streamer.bot). Se reconecta solo con esperas cada vez
// más largas mientras la app esté encendida, y empareja cada pedido con su
// respuesta. Cada app pone su saludo (autenticación) y cómo se arman y se
// reconocen los mensajes.

const WebSocket = require('ws');
const crypto = require('crypto');

const sha256b64 = (s) => crypto.createHash('sha256').update(s).digest('base64');

function createWsClient({
  name,
  url, // () => 'ws://…'
  handshake = async () => {}, // (client) => se llama al abrir; si lanza, se cierra
  wrap, // (type, data, id) => objeto a enviar
  idOf, // (msg) => id de la respuesta, o null si es un evento
  unwrap = (msg) => msg, // (msg) => datos de la respuesta, o lanza si es un error
  onEvent = () => {},
  onStatus = () => {},
  timeoutMs = 8000,
  WS = WebSocket,
  timers = { setTimeout, clearTimeout },
}) {
  let ws = null;
  let wanted = false;
  let ready = false;
  let retry = 0;
  let retryTimer = null;
  let state = { state: 'off', detail: '' };
  const pending = new Map();
  let firstMsg = null; // para quien espera el saludo del servidor
  let seq = 0;

  const setState = (s, detail = '') => {
    if (state.state === s && state.detail === detail) return;
    state = { state: s, detail };
    onStatus(state);
  };

  function failAll(err) {
    for (const p of pending.values()) { timers.clearTimeout(p.timer); p.reject(err); }
    pending.clear();
  }

  function schedule() {
    if (!wanted || retryTimer) return;
    const wait = Math.min(60000, 3000 * 2 ** Math.min(retry, 5));
    retry += 1;
    retryTimer = timers.setTimeout(() => { retryTimer = null; open(); }, wait);
    retryTimer?.unref?.();
  }

  function open() {
    if (!wanted || ws) return;
    let target;
    try { target = url(); } catch (err) { setState('error', err.message); return; }
    setState('connecting');
    ready = false;
    let sock;
    try {
      sock = new WS(target, { handshakeTimeout: 6000 });
    } catch (err) {
      setState('error', err.message);
      schedule();
      return;
    }
    ws = sock;
    sock.on('open', async () => {
      try {
        await handshake(api);
        ready = true;
        retry = 0;
        setState('connected');
      } catch (err) {
        setState('error', String(err?.message || err));
        wanted = wanted && !err?.fatal; // un error de clave no se arregla reintentando
        try { sock.close(); } catch { /* ya cerrado */ }
      }
    });
    sock.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (firstMsg) { const f = firstMsg; firstMsg = null; f(msg); return; }
      const id = idOf(msg);
      const p = id != null ? pending.get(String(id)) : null;
      if (!p) { onEvent(msg); return; }
      pending.delete(String(id));
      timers.clearTimeout(p.timer);
      try { p.resolve(unwrap(msg)); } catch (err) { p.reject(err); }
    });
    sock.on('error', (err) => { if (state.state !== 'error') setState('error', friendly(err)); });
    sock.on('close', () => {
      if (firstMsg) { const f = firstMsg; firstMsg = null; f({ closed: true }); }
      if (ws === sock) ws = null;
      ready = false;
      failAll(new Error('Se cerró la conexión'));
      if (wanted) { if (state.state !== 'error') setState('connecting'); schedule(); } else if (state.state !== 'error') setState('off');
    });
  }

  function friendly(err) {
    const code = err?.code || '';
    if (code === 'ECONNREFUSED') return 'No responde: ¿está abierta la app y activada su conexión?';
    if (code === 'ETIMEDOUT' || /timed? ?out/i.test(err?.message || '')) return 'Tardó demasiado en responder';
    return String(err?.message || err).slice(0, 160);
  }

  // Durante el saludo: esperar el primer mensaje del servidor (OBS y Streamer.bot lo mandan).
  function nextMessage(ms = timeoutMs) {
    return new Promise((resolve, reject) => {
      const t = timers.setTimeout(() => { firstMsg = null; reject(new Error('La app no saludó a tiempo')); }, ms);
      firstMsg = (m) => { timers.clearTimeout(t); resolve(m); };
    });
  }

  function sendRaw(obj) {
    if (!ws || ws.readyState !== 1) throw new Error('No está conectada');
    ws.send(JSON.stringify(obj));
  }

  function request(type, data = {}, { duringHandshake = false, timeout = timeoutMs } = {}) {
    if (!duringHandshake && !ready) return Promise.reject(new Error('No está conectada'));
    const id = `${name}-${Date.now().toString(36)}-${(seq += 1)}`;
    return new Promise((resolve, reject) => {
      const timer = timers.setTimeout(() => { pending.delete(id); reject(new Error('La app no respondió a tiempo')); }, timeout);
      pending.set(id, { resolve, reject, timer });
      try { sendRaw(wrap(type, data, id)); } catch (err) { timers.clearTimeout(timer); pending.delete(id); reject(err); }
    });
  }

  const api = { request, sendRaw, nextMessage, sha256b64 };

  return {
    ...api,
    start() { wanted = true; retry = 0; if (retryTimer) { timers.clearTimeout(retryTimer); retryTimer = null; } open(); },
    stop() {
      wanted = false;
      if (retryTimer) { timers.clearTimeout(retryTimer); retryTimer = null; }
      if (ws) { try { ws.close(); } catch { /* nada */ } ws = null; }
      failAll(new Error('Desconectada'));
      setState('off');
    },
    restart() { this.stop(); this.start(); },
    status: () => state,
    ready: () => ready,
  };
}

// Un error que no vale la pena reintentar (clave equivocada, permiso negado).
function fatal(message) {
  const e = new Error(message);
  e.fatal = true;
  return e;
}

module.exports = { createWsClient, fatal, sha256b64 };
