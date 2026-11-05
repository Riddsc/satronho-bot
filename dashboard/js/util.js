export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }));
  if (!data.ok) throw new Error(data.error || 'Error');
  return data;
}

// Guarda cambios de configuración agrupándolos (evita una petición por tecla).
let pending = {};
let timer;
const listeners = [];
function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] || {}, v) : v;
  }
  return out;
}
export function saveConfig(partial) {
  pending = merge(pending, partial);
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const body = pending;
    pending = {};
    try {
      const { config } = await api('POST', '/api/config', body);
      listeners.forEach((fn) => fn(config));
    } catch (e) {
      toast(`No se guardó: ${e.message}`);
    }
  }, 300);
}
export const onConfigSaved = (fn) => listeners.push(fn);

export const PLATFORM_NAMES = { tiktok: 'TikTok', kick: 'Kick', starvios: 'Starvios', twitch: 'Twitch', panel: 'Panel' };

let toastTimer;
export function toast(text, guideHtml = '') {
  const el = $('#toast');
  el.innerHTML = `${guideHtml}<span>${esc(text)}</span>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

export const timeOf = (ts) => new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// Pide un texto en una ventanita propia (la app de escritorio no muestra
// prompt()). Devuelve el texto, o null si se cancela.
export function askText(title, value = '', okText = 'Guardar') {
  return new Promise((resolve) => {
    const m = document.createElement('div');
    m.className = 'ask-modal';
    m.innerHTML = `<form class="ask-card" role="dialog" aria-modal="true" aria-label="${esc(title)}"><label><b>${esc(title)}</b><input maxlength="60" value="${esc(value)}"></label><div class="ask-actions"><button type="button" class="btn ghost" data-ask-cancel>Cancelar</button><button class="btn primary">${esc(okText)}</button></div></form>`;
    document.body.append(m);
    const input = m.querySelector('input');
    const done = (v) => { m.remove(); resolve(v); };
    m.querySelector('form').addEventListener('submit', (ev) => { ev.preventDefault(); const v = input.value.trim(); if (v) done(v); else input.focus(); });
    m.addEventListener('click', (ev) => { if (ev.target === m || ev.target.closest('[data-ask-cancel]')) done(null); });
    m.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') done(null); });
    requestAnimationFrame(() => { input.focus(); input.select(); });
  });
}
