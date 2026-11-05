// Música: YouTube o Spotify (Ñoño).
// Arriba, dos botones: [YouTube | Spotify]. Con Spotify, lo que pidan con
// !play va a tu cola de Spotify (necesita Premium). Si aún no conectaste tu
// cuenta, sale una tarjeta para hacerlo en un clic; cuando aceptas en el
// navegador, la tarjeta se actualiza sola.

import { $, $$, api, esc, toast, saveConfig } from './util.js';
import { guideToast } from './guides.js';

let config;
let st = null;
let queue = [];
let waiting = false;

const mode = () => (config.spotify?.requests ? 'spotify' : 'youtube');

function applyMode() {
  const page = $('#page-musica');
  if (!page) return;
  const m = mode();
  for (const b of $$('[data-mumode]')) b.setAttribute('aria-pressed', String(b.dataset.mumode === m));
  page.classList.toggle('mode-spotify', m === 'spotify');
  page.classList.toggle('sp-off', m === 'spotify' && !st?.connected);
  $('#spotify-box').hidden = m !== 'spotify';
  // Con Spotify no hay consola de YouTube: se queda «Permisos y comandos».
  if (m === 'spotify' && st?.connected) $('#page-musica [data-tab="permisos"]')?.click();
}

function connectCard() {
  if (!st.clientId) {
    return `<div class="spf-card"><div class="spf-top"><span class="spf-icon">((·))</span><h2>Spotify</h2><p>Esta copia de Satronho Bot no trae la app de Spotify incluida.</p></div>
      <div class="spf-bottom">${ownApp(true)}</div></div>`;
  }
  return `<div class="spf-card"><div class="spf-top"><span class="spf-icon">((·))</span><h2>Spotify</h2>
      <p>Conecta tu cuenta de Spotify para que tu público agregue canciones a tu cola con <code>!play</code>.</p>
      <span class="spf-badge">👑 Requiere Spotify Premium</span></div>
    <div class="spf-bottom">
      ${waiting ? '<p class="spf-wait"><i class="spf-spin"></i>Esperando la autorización…</p><p class="hint">Se abrió Spotify en tu navegador: inicia sesión y toca «Aceptar». Esta pantalla se actualiza sola.</p>' : '<p class="hint">Se abre Spotify en tu navegador, inicias sesión y tocas «Aceptar». Nada más.</p>'}
      <button type="button" class="spf-go" data-spf="login">${waiting ? 'Volver a abrir Spotify' : 'Abrir Spotify para autorizar'} →</button>
      ${st.error && waiting ? `<p class="hint spf-err">${esc(st.error)}</p>` : ''}
      <details class="spf-adv"><summary>Avanzado: usar mi propia app de Spotify</summary>${ownApp(false)}</details>
    </div></div>`;
}
function ownApp(open) {
  const c = config.spotify || {};
  return `<ol class="spf-steps"><li>Entra a <b>developer.spotify.com</b> → Dashboard → <b>Create app</b>.</li>
      <li>En <b>Redirect URI</b> pega <code>${esc(st.redirectUri)}</code> y marca <b>Web API</b>.</li>
      <li>En <b>User Management</b> agrega el correo de cada cuenta que la use (en modo desarrollo, hasta 5; quien crea la app necesita Premium).</li>
      <li>Copia el <b>Client ID</b> y pégalo aquí.</li></ol>
    <label class="field"><span>Client ID</span><input data-spc="clientId" value="${esc(c.clientId || '')}" placeholder="${st.builtin ? 'Vacío = la app que trae Satronho' : 'Pega aquí tu Client ID'}" autocomplete="off" ${open ? 'autofocus' : ''}></label>`;
}

function connectedPanel() {
  const c = config.spotify || {};
  const n = st.now;
  return `<div class="card spf-panel">
    <div class="spf-me"><span class="spf-logo">((·))</span><div><b>${esc(st.user?.name || 'Tu cuenta de Spotify')}</b><small>${st.user && !st.user.premium ? '<em class="spf-free">Sin Premium: Spotify no deja poner canciones en la cola</em>' : '<em class="spf-prem">Premium · los pedidos van a tu Spotify</em>'}</small></div><button type="button" class="btn small ghost" data-spf="disconnect">Desconectar</button></div>
    ${n ? `<div class="spf-now">${n.thumbnail ? `<img src="${esc(n.thumbnail)}" alt="">` : '<span class="spf-noart">♪</span>'}<div><small>${n.playing ? 'SONANDO EN SPOTIFY' : 'EN PAUSA'}</small><b>${esc(n.title)}</b><span>${esc(n.author)}${n.requester ? ` · la pidió <b>${esc(n.requester)}</b>` : ''}</span></div>
        <div class="spf-ctl"><button type="button" class="btn small" data-spf="${n.playing ? 'pause' : 'play'}" title="${n.playing ? 'Pausar' : 'Seguir'}">${n.playing ? '⏸' : '▶'}</button><button type="button" class="btn small" data-spf="skip" title="Siguiente">⏭</button></div></div>`
      : `<p class="hint spf-idle">${esc(st.error || 'Abre Spotify en tu PC o celular y pon algo a sonar: así sabemos dónde poner las canciones.')}</p>`}
    <div class="row space mt"><h4 class="kb-sub" style="margin:0">Lo que viene en tu cola</h4><button type="button" class="btn small ghost" data-spf="queue">Actualizar</button></div>
    <ol class="spf-queue">${queue.length ? queue.map((t) => `<li><b>${esc(t.title)}</b><small>${esc(t.author)}${t.requester ? ` · ${esc(t.requester)}` : ''}</small></li>`).join('') : '<li class="hint">Pulsa «Actualizar» para verla.</li>'}</ol>
    <form class="spf-add" id="spf-add"><input name="q" placeholder="Agregar una canción a tu cola (nombre o enlace de Spotify)"><button class="btn small primary">Agregar</button></form>
    <label class="switch mt"><input type="checkbox" data-spc="showInOverlay" ${c.showInOverlay !== false ? 'checked' : ''}><span></span> <em class="sw-t">Mostrar lo que suena en Spotify en el overlay «Sonando ahora»</em></label>
    <p class="hint">Quién puede pedir, los nombres de los comandos y los límites se ajustan abajo, en «Permisos y comandos».</p>
  </div>`;
}

function render() {
  const box = $('#spotify-box');
  if (!box || !st) return;
  if (st.connected) waiting = false;
  box.innerHTML = st.connected ? connectedPanel() : connectCard();
  applyMode();
}

export function onSpotify(s) {
  const was = st?.connected;
  st = s;
  render();
  if (!was && s.connected && config?.spotify?.requests) guideToast('nono', `¡Spotify conectado${s.user?.name ? ` como ${s.user.name}` : ''}! Lo que pidan con !play va a tu cola.`);
}

function setMode(m) {
  config.spotify = { ...(config.spotify || {}), requests: m === 'spotify' };
  saveConfig({ spotify: { requests: m === 'spotify' } });
  render();
  if (m === 'youtube') guideToast('nono', 'Listo: las canciones vuelven a sonar con YouTube, aquí en la app.');
  else if (st?.connected) guideToast('nono', 'Listo: lo que pidan con !play va a tu Spotify. Tenlo abierto y sonando.');
}

export function initSpotify(cfg) {
  config = cfg;
  const box = $('#spotify-box');
  if (!box) return;
  api('GET', '/api/spotify').then((r) => onSpotify(r.spotify)).catch(() => {});
  $('#mu-mode').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-mumode]');
    if (b && b.dataset.mumode !== mode()) setMode(b.dataset.mumode);
  });
  box.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-spf]');
    if (!b) return;
    const a = b.dataset.spf;
    try {
      if (a === 'login') {
        const r = await api('POST', '/api/spotify/login');
        window.open(r.url, '_blank');
        waiting = true;
        render();
      }
      if (a === 'disconnect' && confirm('¿Desconectar Spotify? La música vuelve a YouTube hasta que lo conectes de nuevo.')) await api('POST', '/api/spotify/disconnect');
      if (['skip', 'pause', 'play'].includes(a)) await api('POST', `/api/spotify/control/${a}`);
      if (a === 'queue') { queue = (await api('GET', '/api/spotify/queue')).queue; render(); }
    } catch (e) { toast(e.message); }
  });
  box.addEventListener('change', (ev) => {
    const el = ev.target;
    if (!el.dataset.spc) return;
    const k = el.dataset.spc;
    const v = el.type === 'checkbox' ? el.checked : el.value.trim();
    config.spotify = { ...(config.spotify || {}), [k]: v };
    saveConfig({ spotify: { [k]: v } });
    if (k === 'clientId') setTimeout(() => api('GET', '/api/spotify').then((r) => onSpotify(r.spotify)).catch(() => {}), 500);
  });
  box.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const q = new FormData(ev.target).get('q');
    if (!String(q).trim()) return;
    try {
      await api('POST', '/api/spotify/control/request', { q });
      ev.target.reset();
      guideToast('nono', 'Agregada a tu cola de Spotify.');
    } catch (e) { toast(e.message); }
  });
  applyMode();
}
