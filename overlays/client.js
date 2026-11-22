// Cliente WebSocket compartido por el panel y los overlays.
// Se reconecta solo si la app se reinicia o se corta la conexión.
// Devuelve { send } para mandar mensajes al servidor.
// También pone cada página en el idioma del streamer (ver i18n/i18n.js).
import { initI18n } from './i18n/i18n.js';

export const i18nReady = initI18n().catch(() => 'es');
let uiLang = null;
i18nReady.then((l) => { uiLang = l; });

export function connectSatronho(onMessage, onConnection = () => {}) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}/ws`;
  let retry = 500;
  let ws = null;

  function open() {
    ws = new WebSocket(url);
    ws.onopen = () => {
      retry = 500;
      onConnection(true);
    };
    ws.onmessage = (ev) => {
      try {
        const { kind, payload } = JSON.parse(ev.data);
        // El streamer cambió el idioma: la página se recarga ya traducida.
        if (kind === 'ui-lang') {
          if (uiLang && payload?.lang && payload.lang !== uiLang) location.reload();
          return;
        }
        onMessage(kind, payload);
      } catch {
        /* mensaje inválido: lo ignoramos */
      }
    };
    ws.onclose = () => {
      onConnection(false);
      setTimeout(open, retry);
      retry = Math.min(retry * 2, 5000);
    };
  }

  open();
  return {
    send(msg) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
  };
}

export function param(name, fallback = '') {
  return new URLSearchParams(location.search).get(name) ?? fallback;
}
