// Utilidades comunes para los conectores: estado, reintentos con espera
// creciente y emisión de eventos normalizados al bus.

const { makeEvent } = require('../eventBus');

function createConnectorBase({ platform, bus, onStatus }) {
  let channel = '';
  let stopped = true;
  let retryTimer = null;
  let backoff = 2000;

  return {
    platform,
    get channel() {
      return channel;
    },
    set channel(v) {
      channel = v;
    },
    get stopped() {
      return stopped;
    },
    start(ch) {
      channel = ch;
      stopped = false;
      backoff = 2000;
    },
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
    },
    status(state, detail = '') {
      onStatus({ platform, state, channel, detail });
    },
    emit(data) {
      if (!stopped) bus.emit('event', makeEvent({ platform, ...data }));
    },
    resetBackoff() {
      backoff = 2000;
    },
    // Programa un reintento con espera creciente (2s, 4s, 8s... hasta 60s).
    retry(fn, reason) {
      if (stopped) return;
      clearTimeout(retryTimer);
      this.status('connecting', `${reason ? `${reason} · ` : ''}reintento en ${Math.round(backoff / 1000)} s`);
      retryTimer = setTimeout(fn, backoff);
      backoff = Math.min(backoff * 2, 60000);
    },
  };
}

// Limpia lo que el usuario pega: "@nombre", URLs completas, mayúsculas.
function cleanChannel(input) {
  let s = String(input || '').trim();
  try {
    if (/^https?:\/\//i.test(s)) {
      const parts = new URL(s).pathname.split('/').filter(Boolean);
      // tiktok.com/@nombre/live · kick.com/nombre · starvios.com/popout/chat/nombre
      s = parts.find((p) => p.startsWith('@')) || parts[parts.length - 1] || '';
      if (s === 'live' && parts.length > 1) s = parts[parts.length - 2];
    }
  } catch {
    /* no era una URL válida */
  }
  return s.replace(/^@/, '').trim();
}

async function getJson(fetchFn, url, options = {}) {
  const res = await fetchFn(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${new URL(url).host}`);
  return res.json();
}

module.exports = { createConnectorBase, cleanChannel, getJson };
