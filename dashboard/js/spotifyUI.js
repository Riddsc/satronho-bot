// Música → Spotify (Ñoño): conectar tu cuenta Premium y que los pedidos del
// chat vayan a tu cola de Spotify. También: lo que suena, saltar y pausar.

import { $, api, esc, toast, saveConfig } from './util.js';
import { guideToast } from './guides.js';

let config;
let st = null;
let queue = [];

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

function render() {
  const box = $('#spotify-box');
  if (!box || !st) return;
  const c = config.spotify || {};
  const n = st.now;
  const head = st.connected
    ? `<div class="spf-me"><span class="spf-logo">♫</span><div><b>${esc(st.user?.name || 'Tu cuenta')}</b><small>${st.user ? (st.user.premium ? '<em class="spf-prem">Premium</em>' : '<em class="spf-free">Sin Premium: Spotify no deja poner canciones en la cola</em>') : 'Conectado'}</small></div><button type="button" class="btn small ghost" data-spf="disconnect">Desconectar</button></div>`
    : `<div class="spf-me"><span class="spf-logo">♫</span><div><b>Conecta tu Spotify</b><small>Con Premium, lo que pidan con <code>!play</code> va directo a tu cola de Spotify.</small></div><button type="button" class="btn primary" data-spf="login" ${st.clientId ? '' : 'disabled'}>Conectar Spotify</button></div>
       ${st.clientId ? '' : '<p class="hint spf-warn">Esta copia no trae la app de Spotify incluida. Pega tu Client ID abajo, en «Mi propia app de Spotify».</p>'}`;
  const now = st.connected ? (n
    ? `<div class="spf-now">${n.thumbnail ? `<img src="${esc(n.thumbnail)}" alt="">` : '<span class="spf-noart">♪</span>'}<div><small>${n.playing ? 'SONANDO EN SPOTIFY' : 'EN PAUSA'}</small><b>${esc(n.title)}</b><span>${esc(n.author)}${n.requester ? ` · la pidió <b>${esc(n.requester)}</b>` : ''}</span></div>
        <div class="spf-ctl"><button type="button" class="btn small" data-spf="${n.playing ? 'pause' : 'play'}">${n.playing ? '⏸' : '▶'}</button><button type="button" class="btn small" data-spf="skip" title="Siguiente">⏭</button></div></div>`
    : `<p class="hint">${esc(st.error || 'Abre Spotify en tu PC o celular y pon algo a sonar.')}</p>`) : '';
  const q = st.connected ? `<div class="row space mt"><h4 class="kb-sub" style="margin:0">Lo que viene en tu cola</h4><button type="button" class="btn small ghost" data-spf="queue">Actualizar</button></div>
      <ol class="spf-queue">${queue.length ? queue.map((t) => `<li><b>${esc(t.title)}</b><small>${esc(t.author)}${t.requester ? ` · ${esc(t.requester)}` : ''}</small></li>`).join('') : '<li class="hint">Pulsa «Actualizar» para verla.</li>'}</ol>
      <form class="spf-add" id="spf-add"><input name="q" placeholder="Agregar una canción a tu cola (nombre o enlace de Spotify)"><button class="btn small">Agregar</button></form>` : '';
  box.innerHTML = `${head}
    <label class="switch mt"><input type="checkbox" data-spc="requests" ${c.requests ? 'checked' : ''} ${st.connected ? '' : 'disabled'}><span></span> <em class="sw-t">Los pedidos del chat (<code>!play</code>) van a mi Spotify en vez de YouTube</em></label>
    <label class="switch"><input type="checkbox" data-spc="showInOverlay" ${c.showInOverlay !== false ? 'checked' : ''}><span></span> <em class="sw-t">Mostrar lo que suena en Spotify en el overlay «Sonando ahora»</em></label>
    ${now}${q}
    <details class="mt"><summary><b>Mi propia app de Spotify</b> (si la app no trae una o quieres usar la tuya)</summary>
      <ol class="spf-steps"><li>Entra a <b>developer.spotify.com</b> → Dashboard → <b>Create app</b>.</li>
        <li>En <b>Redirect URI</b> pega: <code>${esc(st.redirectUri)}</code> y marca <b>Web API</b>.</li>
        <li>En <b>User Management</b> agrega el correo de cada cuenta que vaya a usarla (en modo desarrollo, hasta 5, y quien crea la app debe tener Premium).</li>
        <li>Copia el <b>Client ID</b> y pégalo aquí:</li></ol>
      <label class="field"><span>Client ID</span><input data-spc="clientId" value="${esc(c.clientId || '')}" placeholder="${st.builtin ? 'Vacío = la app que trae Satronho' : 'Pega aquí tu Client ID'}" autocomplete="off"></label>
    </details>`;
}

export function onSpotify(s) {
  st = s;
  render();
}

export function initSpotify(cfg, initial) {
  config = cfg;
  st = initial || st;
  const box = $('#spotify-box');
  if (!box) return;
  if (!st) api('GET', '/api/spotify').then((r) => onSpotify(r.spotify)).catch(() => {});
  render();
  box.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-spf]');
    if (!b) return;
    const a = b.dataset.spf;
    try {
      if (a === 'login') {
        const r = await api('POST', '/api/spotify/login');
        window.open(r.url, '_blank');
        guideToast('nono', 'En tu navegador, entra a Spotify y acepta el permiso. Luego vuelve aquí.');
      }
      if (a === 'disconnect' && confirm('¿Desconectar Spotify?')) await api('POST', '/api/spotify/disconnect');
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
    if (k === 'requests' && v) guideToast('nono', 'Listo: lo que pidan con !play va a tu Spotify. Ten Spotify abierto y sonando.');
    if (k === 'clientId') api('GET', '/api/spotify').then((r) => onSpotify(r.spotify)).catch(() => {});
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
}
