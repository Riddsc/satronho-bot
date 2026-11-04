// Barra superior (cuentas y tu perfil), barra rápida y la página «Tu perfil».
//   - Cada cuenta arriba abre un menú: estado, ver solo esa plataforma en
//     el chat, mostrarla u ocultarla, conectar o desconectar, abrir tu canal
//     e ir a Conexiones. «‹‹» encoge las cuentas a solo el logo.
//   - Barra rápida: botones a un clic para el directo, fija a la derecha o
//     flotante (la mueves arrastrando), y eliges cuáles y en qué orden.
//   - Tu perfil: nombre, foto, saludo, cuentas, orden del menú y barra.

import { $, $$, api, esc, toast, saveConfig, PLATFORM_NAMES } from './util.js';
import { iconSVG, applyMenuPrefs, showPage } from './nav.js';
import { skipTts } from './voice.js';
import { showOnlyPlatform, chatShows, setChatShows } from './livechat.js';
import { sayFor, guideToast } from './guides.js';

let config;
const status = {};
let music = { paused: false, enabled: true, current: null };

const STATE = { connected: ['on', 'Conectado'], connecting: ['wait', 'Conectando…'], error: ['err', 'Con problemas'], disconnected: ['', 'Desconectado'] };
const CHANNEL_URL = { kick: (c) => `https://kick.com/${c}`, twitch: (c) => `https://twitch.tv/${c}`, tiktok: (c) => `https://www.tiktok.com/@${c}/live` };
const LOGO = (p) => (p === 'twitch' ? '<span class="pl" style="background:#9146ff;color:#fff">Tw</span>' : `<span class="pl plogo" data-logo="${p}" aria-hidden="true"></span>`);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};
const profile = () => (config.profile ??= {});
const rail = () => (profile().rail ??= { mode: 'fixed', buttons: [] });
function saveProfile(patch) {
  Object.assign(profile(), patch);
  saveConfig({ profile: patch });
}

// ---------- Cuentas arriba ----------
export function onQuickStatus(s) {
  status[s.platform] = s;
  if (!$('#pchip-pop').hidden && $('#pchip-pop').dataset.p === s.platform) renderPop(s.platform);
  renderAccounts();
}

let popFor = '';
function renderPop(p) {
  const s = status[p] || { state: 'disconnected' };
  const [cls, text] = STATE[s.state] || STATE.disconnected;
  const ch = String(config.platforms?.[p]?.channel || s.channel || '').replace(/^@/, '');
  const off = !s.state || s.state === 'disconnected';
  const pop = $('#pchip-pop');
  pop.dataset.p = p;
  pop.innerHTML = `<div class="pp-head">${LOGO(p)}<div><b>${esc(PLATFORM_NAMES[p])}</b><small>${ch ? `@${esc(ch)}` : 'Sin cuenta'}</small></div><span class="pp-state ${cls}"><i></i>${esc(text)}</span></div>
    ${s.detail ? `<p class="pp-detail">${esc(s.detail)}</p>` : ''}
    <button type="button" data-pp="only">${iconSVG('filter')}<span>Ver solo ${esc(PLATFORM_NAMES[p])} en el chat</span></button>
    <label class="pp-row">${iconSVG('chat')}<span>Mostrar en el chat</span><span class="switch small"><input type="checkbox" data-pp="show" ${chatShows(p) ? 'checked' : ''}><span></span></span></label>
    <div class="pp-sep"></div>
    ${ch ? `<button type="button" data-pp="${off ? 'connect' : 'reconnect'}">${iconSVG('plug')}<span>${off ? 'Conectar' : 'Reconectar'}</span></button>` : ''}
    ${!off ? `<button type="button" data-pp="disconnect">${iconSVG('door')}<span>Desconectar</span></button>` : ''}
    ${ch && CHANNEL_URL[p] ? `<button type="button" data-pp="open">${iconSVG('link')}<span>Abrir mi canal</span></button>` : ''}
    <button type="button" data-pp="go">${iconSVG('gear')}<span>${ch ? 'Ajustes en Conexiones' : 'Poner mi cuenta en Conexiones'}</span></button>`;
}
function openPop(p, chip) {
  const pop = $('#pchip-pop');
  if (!pop.hidden && popFor === p) return closePop();
  popFor = p;
  renderPop(p);
  pop.hidden = false;
  const r = chip.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 300))}px`;
  pop.style.top = `${r.bottom + 8}px`;
}
function closePop() {
  $('#pchip-pop').hidden = true;
  popFor = '';
}

function initChips() {
  const fold = $('#pchips-fold');
  const applyFold = () => {
    const on = store.get('satronho.chipsFolded', false);
    $('#pchips').classList.toggle('folded', on);
    fold.textContent = on ? '»' : '«';
    fold.title = on ? 'Mostrar los nombres de las cuentas' : 'Encoger las cuentas';
  };
  applyFold();
  fold.addEventListener('click', () => { store.set('satronho.chipsFolded', !store.get('satronho.chipsFolded', false)); applyFold(); });
  $('#pchips').addEventListener('click', (ev) => {
    const chip = ev.target.closest('[data-pchip]');
    if (chip) { ev.stopPropagation(); openPop(chip.dataset.pchip, chip); }
  });
  $('#pchip-pop').addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-pp]');
    if (!b || b.type === 'checkbox') return;
    const p = $('#pchip-pop').dataset.p;
    const act = b.dataset.pp;
    if (act === 'only') { showOnlyPlatform(p); showPage('actividad'); closePop(); }
    if (act === 'go') { showPage('conexiones'); closePop(); }
    if (act === 'open') window.open(CHANNEL_URL[p](String(config.platforms[p].channel).replace(/^@/, '')), '_blank');
    if (act === 'connect' || act === 'reconnect') api('POST', `/api/connect/${p}`, {}).catch((e) => toast(e.message));
    if (act === 'disconnect') api('POST', `/api/disconnect/${p}`).catch((e) => toast(e.message));
  });
  $('#pchip-pop').addEventListener('change', (ev) => {
    if (ev.target.dataset.pp === 'show') setChatShows($('#pchip-pop').dataset.p, ev.target.checked);
  });
  document.addEventListener('click', (ev) => {
    if (!$('#pchip-pop').hidden && !ev.target.closest('#pchip-pop')) closePop();
    if (!$('#me-menu').hidden && !ev.target.closest('.me-wrap')) $('#me-menu').hidden = true;
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { closePop(); $('#me-menu').hidden = true; } });
}

// ---------- Tú (arriba a la derecha) ----------
function avatarOf() {
  const p = profile();
  const name = p.name || 'Tú';
  const initials = name.split(/\s+/).map((w) => [...w][0] || '').join('').slice(0, 2).toUpperCase() || 'TÚ';
  return p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<b>${esc(initials)}</b>`;
}
function renderMe() {
  const t = $('#home-title');
  if (t) t.textContent = profile().greet !== false && profile().name ? `¡Hola, ${profile().name}!` : 'Inicio';
  $('#me-av').innerHTML = avatarOf();
  $('#me-name').textContent = profile().name || 'Tu perfil';
  const pf = $('#pf-av');
  if (pf) pf.innerHTML = avatarOf();
}
function initMe() {
  $('#me-btn').addEventListener('click', (ev) => { ev.stopPropagation(); $('#me-menu').hidden = !$('#me-menu').hidden; });
  $('#me-menu').addEventListener('click', (ev) => {
    if (ev.target.closest('[data-me-close]')) $('#me-menu').hidden = true;
    if (ev.target.closest('#me-rail')) {
      const next = rail().mode === 'off' ? 'fixed' : 'off';
      setRailMode(next);
      $('#me-menu').hidden = true;
    }
  });
}

// ---------- Barra rápida ----------
const ACTIONS = {
  voice: { icon: () => (config.tts.enabled ? 'mic' : 'mic-off'), name: () => (config.tts.enabled ? 'Apagar la voz' : 'Encender la voz'), on: () => config.tts.enabled, run() {
    const on = !config.tts.enabled;
    config.tts.enabled = on;
    saveConfig({ tts: { enabled: on } });
    const box = $('[data-tts="enabled"]');
    if (box) box.checked = on;
    guideToast('troya', on ? 'Voz encendida.' : 'Voz apagada.');
  } },
  skipVoice: { icon: 'next', name: 'Saltar el mensaje que se lee', run: () => skipTts() },
  music: { icon: () => (music.paused || !music.current ? 'play' : 'pause'), name: () => (music.paused ? 'Seguir la música' : 'Pausar la música'), on: () => Boolean(music.current) && !music.paused, run: () => api('POST', `/api/music/${music.paused ? 'resume' : 'pause'}`).catch((e) => toast(e.message)) },
  musicSkip: { icon: 'skipSong', name: 'Siguiente canción', run: () => api('POST', '/api/music/skip').catch((e) => toast(e.message)) },
  requests: { icon: 'music', name: () => (music.enabled ? 'Cerrar los pedidos de música' : 'Abrir los pedidos de música'), on: () => music.enabled, run: () => api('POST', '/api/music/enabled', { enabled: !music.enabled }).catch((e) => toast(e.message)) },
  alertsSkip: { icon: 'stop', name: 'Cortar la alerta que suena', run: () => api('POST', '/api/alerts/control', { action: 'skip' }).catch((e) => toast(e.message)) },
  alertsClear: { icon: 'trash', name: 'Vaciar la fila de alertas', run: () => api('POST', '/api/alerts/control', { action: 'clear' }).then(() => guideToast('troya', 'Fila de alertas vacía.')).catch((e) => toast(e.message)) },
  alertsMute: { icon: () => (config.overlayStyle?.sound === false ? 'bellOff' : 'bell'), name: () => (config.overlayStyle?.sound === false ? 'Devolver el sonido a las alertas' : 'Silenciar las alertas'), on: () => config.overlayStyle?.sound !== false, run() {
    const on = config.overlayStyle?.sound === false;
    config.overlayStyle = { ...config.overlayStyle, sound: on };
    saveConfig({ overlayStyle: { sound: on } });
    guideToast('troya', on ? 'Las alertas vuelven a sonar.' : 'Alertas en silencio (siguen saliendo en pantalla).');
  } },
  podiumReset: { icon: 'trophy', name: 'Reiniciar el podio', run: () => api('POST', '/api/podium/reset').then(() => guideToast('juana', 'Podio en cero.')).catch((e) => toast(e.message)) },
  testAlert: { icon: 'spark', name: 'Probar una alerta', run: () => api('POST', '/api/test/follow', { platform: 'tiktok' }).catch((e) => toast(e.message)) },
  chat: { icon: 'chat', name: 'Chat en vivo', run: () => showPage('actividad') },
  overlays: { icon: 'layers', name: 'Overlays para OBS', run: () => showPage('overlays') },
  stats: { icon: 'chart', name: 'Estadísticas', run: () => showPage('estadisticas') },
  news: { icon: 'news', name: 'Novedades', badge: () => !$('#nav-news')?.hidden, run: () => showPage('novedades') },
  report: { icon: 'flag', name: 'Reportar un problema', run: () => { location.hash = '#/ayuda/reportar'; } },
  endLive: { icon: 'door', name: 'Terminar el directo (guardar estadísticas)', run() {
    if (!confirm('¿Terminar el directo actual y guardar sus estadísticas?')) return;
    api('POST', '/api/stats/end').then(() => sayFor('juana', 'Guardé tu directo. ¡Buen trabajo!', 6000, 'ok')).catch((e) => toast(e.message));
  } },
};
const val = (x) => (typeof x === 'function' ? x() : x);

function renderRail() {
  const r = rail();
  const el = $('#qrail');
  const mode = r.mode || 'fixed';
  document.body.classList.toggle('has-rail', mode === 'fixed');
  el.hidden = mode === 'off';
  el.className = `qrail ${mode}`;
  const btns = (r.buttons?.length ? r.buttons : Object.keys(ACTIONS)).filter((k) => ACTIONS[k]);
  el.innerHTML = `${mode === 'floating' ? '<span class="qr-grip" title="Arrastra para mover">⠿</span>' : ''}${btns.map((k) => {
    const a = ACTIONS[k];
    const on = a.on ? a.on() : null;
    return `<button type="button" class="qr-btn ${on === false ? 'off' : on ? 'on' : ''}" data-q="${k}" aria-label="${esc(val(a.name))}" data-tip="${esc(val(a.name))}">${iconSVG(val(a.icon), 19)}${a.badge?.() ? '<i class="qr-dot"></i>' : ''}</button>`;
  }).join('')}<span class="qr-sp"></span><button type="button" class="qr-btn qr-edit" data-q="__edit" data-tip="Elegir botones" aria-label="Elegir botones">${iconSVG('gear', 17)}</button>`;
  if (mode === 'floating') {
    const x = r.x ?? innerWidth - 80;
    const y = r.y ?? 120;
    el.style.left = `${Math.max(4, Math.min(x, innerWidth - 60))}px`;
    el.style.top = `${Math.max(4, Math.min(y, innerHeight - 120))}px`;
  } else {
    el.style.left = '';
    el.style.top = '';
  }
}
function setRailMode(mode) {
  rail().mode = mode;
  saveConfig({ profile: { rail: { mode } } });
  renderRail();
  renderProfile();
}
function initRail() {
  const el = $('#qrail');
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-q]');
    if (!b) return;
    if (b.dataset.q === '__edit') { showPage('perfil'); setTimeout(() => $('#pf-rail')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); return; }
    ACTIONS[b.dataset.q]?.run();
    setTimeout(renderRail, 250);
  });
  // Etiqueta con el nombre del botón (fija, para que no la corte el borde).
  const tip = document.createElement('div');
  tip.className = 'qr-tip';
  tip.hidden = true;
  document.body.append(tip);
  el.addEventListener('pointerover', (ev) => {
    const b = ev.target.closest('[data-tip]');
    if (!b) return;
    const r = b.getBoundingClientRect();
    tip.textContent = b.dataset.tip;
    tip.hidden = false;
    const left = r.left - tip.offsetWidth - 10;
    tip.style.left = `${left < 8 ? r.right + 10 : left}px`;
    tip.style.top = `${r.top + r.height / 2}px`;
  });
  el.addEventListener('pointerout', (ev) => { if (!ev.relatedTarget?.closest?.('[data-tip]')) tip.hidden = true; });

  // Mover la barra flotante con su asa.
  let drag = null;
  el.addEventListener('pointerdown', (ev) => {
    if (!ev.target.closest('.qr-grip')) return;
    const r = el.getBoundingClientRect();
    drag = { dx: ev.clientX - r.left, dy: ev.clientY - r.top };
    el.setPointerCapture(ev.pointerId);
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    el.style.left = `${Math.max(4, Math.min(ev.clientX - drag.dx, innerWidth - el.offsetWidth - 4))}px`;
    el.style.top = `${Math.max(4, Math.min(ev.clientY - drag.dy, innerHeight - el.offsetHeight - 4))}px`;
  });
  el.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = null;
    el.classList.remove('dragging');
    const x = parseInt(el.style.left, 10);
    const y = parseInt(el.style.top, 10);
    Object.assign(rail(), { x, y });
    saveConfig({ profile: { rail: { x, y } } });
  });
  window.addEventListener('resize', () => { if (rail().mode === 'floating') renderRail(); });
  renderRail();
}
export function onQuickMusic(s) {
  music = { ...music, ...s };
  renderRail();
}
export function refreshRail() {
  if (config) renderRail();
}

// ---------- Tu perfil ----------
function renderAccounts() {
  const box = $('#pf-accounts');
  if (!box || !config) return;
  box.innerHTML = ['tiktok', 'kick', 'twitch', 'starvios'].map((p) => {
    const ch = String(config.platforms?.[p]?.channel || '').replace(/^@/, '');
    const [cls, text] = STATE[status[p]?.state] || STATE.disconnected;
    return `<div class="pf-acc">${LOGO(p)}<div><b>${esc(PLATFORM_NAMES[p])}</b><small>${ch ? `@${esc(ch)}` : 'Sin cuenta'}</small></div><span class="pp-state ${cls}"><i></i>${esc(text)}</span></div>`;
  }).join('');
}
function renderMenuPrefs() {
  const box = $('#pf-menu');
  if (!box) return;
  const hidden = new Set(profile().menuHidden || []);
  box.innerHTML = $$('.side .nav-group').map((g, gi) => {
    const title = g.querySelector('h6')?.textContent.trim() || '';
    const items = $$('.nav-item[data-page]', g);
    return `<div class="pf-group"><h5>${esc(title)}</h5>${items.map((a, i) => {
      const page = a.dataset.page;
      const locked = ['inicio', 'perfil', 'ajustes', 'ayuda'].includes(page);
      return `<div class="pf-item ${hidden.has(page) ? 'off' : ''}" data-mp="${page}" data-g="${gi}">
        <span class="pf-ic">${a.querySelector('.ic')?.innerHTML || ''}</span><b>${esc([...a.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() || a.textContent.trim())}</b>
        <button type="button" data-mp-up ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button type="button" data-mp-down ${i === items.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
        <label class="switch small" title="${locked ? 'Siempre visible' : 'Mostrar en el menú'}"><input type="checkbox" data-mp-show ${hidden.has(page) ? '' : 'checked'} ${locked ? 'disabled' : ''}><span></span></label></div>`;
    }).join('')}</div>`;
  }).join('');
}
function currentOrder() {
  return $$('.side .nav-item[data-page]').map((a) => a.dataset.page);
}
function renderRailPrefs() {
  const box = $('#pf-rail');
  if (!box) return;
  const r = rail();
  for (const b of $$('[data-rail-mode]')) b.setAttribute('aria-pressed', String((r.mode || 'fixed') === b.dataset.railMode));
  const chosen = (r.buttons?.length ? r.buttons : []).filter((k) => ACTIONS[k]);
  const rest = Object.keys(ACTIONS).filter((k) => !chosen.includes(k));
  box.innerHTML = [...chosen, ...rest].map((k) => {
    const on = chosen.includes(k);
    const i = chosen.indexOf(k);
    return `<div class="pf-qb ${on ? 'on' : ''}" data-qb="${k}"><span class="pf-qic">${iconSVG(val(ACTIONS[k].icon), 18)}</span><b>${esc(val(ACTIONS[k].name))}</b>
      ${on ? `<button type="button" data-qb-up ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button type="button" data-qb-down ${i === chosen.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>` : '<span></span><span></span>'}
      <label class="switch small"><input type="checkbox" data-qb-on ${on ? 'checked' : ''}><span></span></label></div>`;
  }).join('');
}
function renderProfile() {
  if (!$('#page-perfil')) return;
  $('#pf-name').value = profile().name || '';
  $('#pf-greet').checked = profile().greet !== false;
  renderMe();
  renderAccounts();
  renderMenuPrefs();
  renderRailPrefs();
}

function initProfile() {
  $('#pf-name').addEventListener('change', (ev) => {
    saveProfile({ name: ev.target.value.trim().slice(0, 40) });
    renderMe();
    sayFor('samy', profile().name ? `¡Listo, ${esc(profile().name)}! Así te voy a llamar.` : 'Listo, sin nombre.', 4000, 'ok');
  });
  $('#pf-greet').addEventListener('change', (ev) => { saveProfile({ greet: ev.target.checked }); renderMe(); });
  $('#pf-photo-btn').addEventListener('click', () => $('#pf-photo-file').click());
  $('#pf-photo-file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) return toast('La foto pesa más de 6 MB');
    const res = await fetch('/api/profile/photo', { method: 'POST', headers: { 'Content-Type': f.type }, body: f });
    const d = await res.json().catch(() => ({}));
    if (!d.ok) return toast(d.error || 'No se pudo subir la foto');
    profile().photo = d.photo;
    renderMe();
  });
  $('#pf-photo-del').addEventListener('click', async () => {
    await api('DELETE', '/api/profile/photo').catch(() => {});
    profile().photo = '';
    renderMe();
  });

  $('#pf-menu').addEventListener('click', (ev) => {
    const row = ev.target.closest('[data-mp]');
    if (!row) return;
    const up = ev.target.closest('[data-mp-up]');
    const down = ev.target.closest('[data-mp-down]');
    if (!up && !down) return;
    const order = currentOrder();
    const groupPages = $$(`.pf-item[data-g="${row.dataset.g}"]`).map((x) => x.dataset.mp);
    const i = groupPages.indexOf(row.dataset.mp);
    const j = up ? i - 1 : i + 1;
    if (j < 0 || j >= groupPages.length) return;
    const a = order.indexOf(groupPages[i]);
    const b = order.indexOf(groupPages[j]);
    [order[a], order[b]] = [order[b], order[a]];
    saveProfile({ menuOrder: order });
    applyMenuPrefs(config);
    renderMenuPrefs();
  });
  $('#pf-menu').addEventListener('change', (ev) => {
    const row = ev.target.closest('[data-mp]');
    if (!row || !ev.target.matches('[data-mp-show]')) return;
    const hidden = new Set(profile().menuHidden || []);
    if (ev.target.checked) hidden.delete(row.dataset.mp); else hidden.add(row.dataset.mp);
    saveProfile({ menuHidden: [...hidden] });
    applyMenuPrefs(config);
    row.classList.toggle('off', !ev.target.checked);
  });
  $('#pf-menu-reset').addEventListener('click', () => {
    saveProfile({ menuOrder: [], menuHidden: [] });
    location.reload();
  });

  $('#pf-rail-mode').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-rail-mode]');
    if (b) setRailMode(b.dataset.railMode);
  });
  const saveButtons = (list) => {
    rail().buttons = list;
    saveConfig({ profile: { rail: { buttons: list } } });
    renderRail();
    renderRailPrefs();
  };
  $('#pf-rail').addEventListener('click', (ev) => {
    const row = ev.target.closest('[data-qb]');
    if (!row) return;
    const list = [...(rail().buttons || [])];
    const i = list.indexOf(row.dataset.qb);
    if (ev.target.closest('[data-qb-up]') && i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; saveButtons(list); }
    if (ev.target.closest('[data-qb-down]') && i >= 0 && i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; saveButtons(list); }
  });
  $('#pf-rail').addEventListener('change', (ev) => {
    const row = ev.target.closest('[data-qb]');
    if (!row || !ev.target.matches('[data-qb-on]')) return;
    const list = (rail().buttons || []).filter((k) => k !== row.dataset.qb);
    if (ev.target.checked) list.push(row.dataset.qb);
    saveButtons(list);
  });
}

export function initQuick(cfg) {
  config = cfg;
  initChips();
  initMe();
  initRail();
  initProfile();
  renderProfile();
}
