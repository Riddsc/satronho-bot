// Satronho Bot · panel · © 2026 RiddsSatronho
// Une todas las piezas: navegación, conexiones, voz, música, alertas, metas,
// overlays, estadísticas, apariencia y los guías.

import { connectSatronho } from '/overlays/client.js';
import { $, $$, api, esc, saveConfig, toast, timeOf, PLATFORM_NAMES, onConfigSaved } from './util.js';
import { initGuides, setBubble, sayFor, guideToast, GUIDES } from './guides.js';
import { initVoice, renderEngine, renderAllowed, onTtsItem, updateTroya, onTtsQueue, setOnlineVoices } from './voice.js';
import { initMusic, onMusic, onMusicNotice } from './music.js';
import { initStats, onStats, onStatsHistory } from './stats.js';
import { initHelp, setHelpContext, openHelp, _test as helpKb } from './help.js';
import { initNav, countEvent, setStepFacts } from './nav.js';
import { initAppearance, applyAppearance } from './appearance.js';
import { initOverlays, setOverlayGoals } from './overlays.js';
import { initKickbot, renderKickbot } from './kickbot.js';
import { initAlerts } from './alerts.js';
import { initStarviosbot, renderStarviosbot } from './starviosbot.js';
import { initHome, homeEvent, homeVoice, homeMusic, homeStats } from './home.js';

let config = null;
let lastMusic = null;
let lastStats = null;
let lastEngine = null;
let appVersion = '';
const goals = new Map();
const status = {};

// ---------- Samy: conexiones ----------
const STATE_CLASS = { connected: 'on', connecting: 'wait', error: 'err' };
const STATE_TEXT = { connected: 'Conectado', connecting: 'Conectando…', error: 'Error', disconnected: 'Desconectado' };

function renderStatus(s) {
  if (!PLATFORM_NAMES[s.platform] || s.platform === 'panel') return;
  status[s.platform] = s;
  const name = PLATFORM_NAMES[s.platform];
  const chip = $(`#chip-${s.platform}`);
  chip.className = `pchip ${STATE_CLASS[s.state] || ''}`;
  chip.querySelector('.who').textContent = s.state === 'connected' && s.channel ? `@${String(s.channel).replace(/^@/, '')}` : name;
  chip.title = `${name}: ${STATE_TEXT[s.state] || s.state}${s.detail ? ` · ${s.detail}` : ''}`;

  const box = $(`.platform[data-platform="${s.platform}"] .pstate`);
  box.textContent = s.detail ? `${STATE_TEXT[s.state] || s.state} · ${s.detail}` : STATE_TEXT[s.state] || s.state;
  box.className = `pstate ${STATE_CLASS[s.state] || ''}`;

  updateConnCount();
}

// Plataformas visibles (Conexiones → «Plataformas que uso»).
const ALL_PLATFORMS = ['kick', 'starvios', 'twitch', 'tiktok'];
const isShown = (p) => !config.platforms[p]?.hidden;

function updateConnCount() {
  const shown = ALL_PLATFORMS.filter(isShown);
  const on = shown.filter((p) => status[p]?.state === 'connected').length;
  $('#nav-conn').textContent = `${on}/${shown.length}`;
  setStepFacts({ connected: on > 0 });
  updateSamy();
}

function applyPlatformVisibility() {
  for (const p of ALL_PLATFORMS) {
    const show = isShown(p);
    $(`#chip-${p}`).hidden = !show;
    for (const el of $$(`[data-platform="${p}"], [data-platform-write="${p}"]`)) el.hidden = !show;
    const box = $(`#conn-pick [data-show="${p}"]`);
    if (box) box.checked = show;
  }
  const none = !ALL_PLATFORMS.some(isShown);
  $('#conn-pick').toggleAttribute('open', none || $('#conn-pick').open);
  updateConnCount();
}

function initConnTabs() {
  const tabs = $('#conn-tabs');
  const show = (tab) => {
    for (const b of tabs.querySelectorAll('[data-conn-tab]')) b.setAttribute('aria-pressed', String(b.dataset.connTab === tab));
    for (const pane of $$('[data-conn-pane]')) pane.hidden = pane.dataset.connPane !== tab;
    try { localStorage.setItem('satronho.connTab', tab); } catch { /* sin almacenamiento */ }
  };
  tabs.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-conn-tab]');
    if (b) show(b.dataset.connTab);
  });
  let saved = 'listen';
  try { saved = localStorage.getItem('satronho.connTab') || 'listen'; } catch { /* sin almacenamiento */ }
  show(saved === 'write' ? 'write' : 'listen');

  $('#conn-pick').addEventListener('change', async (ev) => {
    const p = ev.target.dataset.show;
    if (!p) return;
    const hidden = !ev.target.checked;
    config.platforms[p].hidden = hidden;
    saveConfig({ platforms: { [p]: { hidden } } });
    // Al esconder una plataforma también se desconecta.
    if (hidden && status[p]?.state && status[p].state !== 'disconnected') {
      await api('POST', `/api/disconnect/${p}`).catch(() => {});
    }
    applyPlatformVisibility();
  });
  applyPlatformVisibility();
}

// Estado de «Escribir» para Kick en la cabecera de su tarjeta.
export function kickWriteState(st) {
  const el = $('#kick-write-state');
  if (!el) return;
  const acc = st?.sendAs === 'bot' ? st.bot : st?.me;
  const anyOk = st?.me?.ok || st?.bot?.ok;
  el.textContent = anyOk ? `Escribe como @${(acc?.ok ? acc : st.me.ok ? st.me : st.bot).name || 'tu cuenta'}` : 'Sin autorizar';
  el.className = `pstate ${anyOk ? 'on' : ''}`;
}

function updateSamy() {
  if (!config) return;
  if (!ALL_PLATFORMS.some(isShown)) return setBubble('samy', 'Escondiste todas las plataformas. Abre <b>Plataformas que uso</b> y marca las tuyas.');
  const on = Object.values(status).filter((s) => s.state === 'connected').map((s) => PLATFORM_NAMES[s.platform]);
  const trouble = Object.values(status).find((s) => s.state === 'connecting' && s.detail);
  if (trouble) return setBubble('samy', `${PLATFORM_NAMES[trouble.platform]} no me deja entrar todavía (${esc(trouble.detail)}). Sigo intentando yo solo.`);
  if (on.length) return setBubble('samy', `¡Estoy escuchando ${on.join(', ')}! Marca «Conectar al abrir la app» y la próxima vez me conecto solo.`);
  const chatOnly = ['kick', 'starvios', 'twitch'].filter(isShown).map((p) => PLATFORM_NAMES[p]);
  const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} y ${a.at(-1)}` : a[0]);
  const parts = [];
  if (isShown('tiktok')) parts.push('TikTok trae alertas, metas y voz');
  if (chatOnly.length) parts.push(`${list(chatOnly)} ${chatOnly.length > 1 ? 'traen' : 'trae'} chat para la voz y la música`);
  setBubble('samy', `Escribe tu usuario y pulsa <b>Conectar</b>. ${parts.join('; ')}.`);
}

function initPlatforms() {
  for (const box of $$('.platform[data-platform]')) {
    const platform = box.dataset.platform;
    const field = (name) => box.querySelector(`[data-field="${name}"]`);
    const cfg = config.platforms[platform];
    field('channel').value = cfg.channel || '';
    field('autoConnect').checked = Boolean(cfg.autoConnect);
    if (field('signApiKey')) field('signApiKey').value = cfg.signApiKey || '';

    const connect = async () => {
      const channel = field('channel').value.trim();
      if (!channel) return guideToast('samy', `Necesito tu usuario de ${PLATFORM_NAMES[platform]}`);
      // Error común: escribir el nombre del bot en vez del canal propio.
      if (platform === 'kick' && /^@?satronho_?bot$/i.test(channel)) {
        return sayFor('samy', 'Ahí va <b>tu canal</b>, el de tus directos (por ejemplo <b>riddsc</b>), no el de SatronhoBot. El bot escribe en el canal que pongas aquí.', 10000, 'warn');
      }
      await api('POST', `/api/connect/${platform}`, { channel }).catch((e) => toast(e.message));
    };
    box.querySelector('[data-act="connect"]').addEventListener('click', connect);
    field('channel').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') connect(); });
    box.querySelector('[data-act="disconnect"]').addEventListener('click', () => api('POST', `/api/disconnect/${platform}`).catch((e) => toast(e.message)));
    field('autoConnect').addEventListener('change', (ev) => saveConfig({ platforms: { [platform]: { autoConnect: ev.target.checked } } }));
    field('signApiKey')?.addEventListener('change', (ev) => saveConfig({ platforms: { [platform]: { signApiKey: ev.target.value.trim() } } }));
  }
}

// ---------- Juana: metas ----------
const TYPE_NAMES = { follow: 'Seguidores', sub: 'Suscripciones', gift: 'Diamantes', like: 'Likes', share: 'Compartidos' };

function renderGoals() {
  const list = $('#goal-list');
  list.innerHTML = goals.size
    ? [...goals.values()]
        .map((g) => {
          const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
          return `<div class="goal" data-id="${esc(g.id)}">
            <div><div class="name">${esc(g.title)}</div><div class="meta">${TYPE_NAMES[g.type] || g.type} · ${g.countBy === 'amount' ? 'suma cantidad' : 'cuenta eventos'}</div></div>
            <div><div class="bar"><i style="width:${pct}%"></i></div><div class="nums">${g.current} / ${g.target} · ${Math.floor(pct)}%</div></div>
            <div class="actions">
              <button class="btn small" data-act="dec">−1</button><button class="btn small" data-act="inc">+1</button>
              <input type="number" min="1" value="${g.target}" data-act="target" title="Objetivo">
              <button class="btn small ghost" data-act="reset">Reiniciar</button>
              <button class="btn small ghost danger" data-act="delete" title="Eliminar">✕</button>
            </div></div>`;
        })
        .join('')
    : '<p class="hint">No hay metas. Crea una abajo.</p>';
  setOverlayGoals([...goals.values()]);
  updateJuana();
}

function updateJuana() {
  const near = [...goals.values()].find((g) => g.target && g.current < g.target && g.current / g.target >= 0.8);
  if (near) return setBubble('juana', `¡La meta «${esc(near.title)}» va al ${Math.floor((near.current / near.target) * 100)}%! Anímalos, que falta poquito.`);
  setBubble('juana', 'Crea una meta y ponla en OBS desde <b>Overlays para OBS</b>. La barra se llena sola con lo que pasa en TikTok.');
}

function initGoalsAndAlerts() {
  $('#goal-list').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('.goal').dataset.id;
    const g = goals.get(id);
    const patch = (body) => api('PATCH', `/api/goals/${encodeURIComponent(id)}`, body);
    try {
      if (btn.dataset.act === 'inc') await patch({ current: g.current + 1 });
      if (btn.dataset.act === 'dec') await patch({ current: Math.max(0, g.current - 1) });
      if (btn.dataset.act === 'reset') await patch({ current: 0 });
      if (btn.dataset.act === 'delete' && confirm(`¿Eliminar la meta «${g.title}»?`)) await api('DELETE', `/api/goals/${encodeURIComponent(id)}`);
    } catch (e) {
      toast(e.message);
    }
  });
  $('#goal-list').addEventListener('change', (ev) => {
    if (ev.target.dataset.act !== 'target') return;
    const id = ev.target.closest('.goal').dataset.id;
    api('PATCH', `/api/goals/${encodeURIComponent(id)}`, { target: Number(ev.target.value) || 1 }).catch((e) => toast(e.message));
  });
  $('#goal-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = Object.fromEntries(new FormData(ev.target));
    try {
      await api('POST', '/api/goals', { ...form, platform: 'tiktok', countBy: form.type === 'gift' || form.type === 'like' ? 'amount' : 'events' });
      ev.target.reset();
      guideToast('juana', 'Meta creada. Su URL ya está en Overlays para OBS.');
    } catch (e) {
      toast(e.message);
    }
  });

  initAlerts(config);
}

// ---------- Chat y actividad ----------
function describe(e) {
  switch (e.type) {
    case 'follow': return 'te sigue';
    case 'sub': return e.amount > 1 ? `se suscribió (${e.amount} meses)` : 'se suscribió';
    case 'gift': {
      const x = e.extra || {};
      return `envió ${x.count > 1 ? `${x.count}× ` : ''}${esc(x.giftName || 'un regalo')} (${e.amount} diamantes)`;
    }
    case 'like': return `dio ${e.amount} likes`;
    case 'share': return 'compartió el directo';
    default: return '';
  }
}

function addLog(e) {
  const log = $('#log');
  log.querySelector('.empty')?.remove();
  const li = document.createElement('li');
  li.dataset.id = e.id;
  const action = e.type === 'chat' ? `: ${esc(e.message)}` : ` ${describe(e)}`;
  li.innerHTML = `<span class="tag ${e.type}">${e.type === 'chat' ? 'chat' : e.type === 'gift' ? 'regalo' : e.type}</span>
    <span class="txt"><span class="plat ${e.platform}">${esc(PLATFORM_NAMES[e.platform] || e.platform)}</span><b>${esc(e.user.name)}</b>${action}${e.test ? ' <small>(prueba)</small>' : ''}</span>
    <time>${timeOf(e.ts)}</time>`;
  log.prepend(li);
  while (log.children.length > 200) log.lastChild.remove();
}

// Marca cada mensaje con lo que decidió Troya.
function markDecision(d) {
  const txt = $(`#log li[data-id="${CSS.escape(d.eventId)}"] .txt`);
  if (!txt) return;
  const span = document.createElement('span');
  span.className = 'tts';
  span.textContent = d.read ? '🔊' : `🔇 ${d.reason}`;
  span.title = d.read ? 'Leído en voz alta' : `No se leyó: ${d.reason}`;
  txt.append(span);
}

function initSimulator() {
  $('#sim').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    if (!f.message.trim()) return;
    const name = f.user.trim() || 'Espectador';
    await api('POST', '/api/test/chat', { platform: f.platform, user: { id: name.toLowerCase(), name }, message: f.message }).catch((e) => toast(e.message));
    ev.target.message.value = '';
  });
}

// ---------- Ajustes → App ----------
function initAppSettings() {
  const tray = $('#tray-toggle');
  tray.checked = Boolean(config.window?.minimizeToTray);
  tray.addEventListener('change', () => saveConfig({ window: { minimizeToTray: tray.checked } }));
  const auto = $('#update-auto');
  auto.checked = config.updates?.auto !== false;
  auto.addEventListener('change', () => saveConfig({ updates: { auto: auto.checked } }));
  const feed = $('#update-feed');
  feed.value = config.updates?.feedUrl || '';
  feed.addEventListener('change', () => saveConfig({ updates: { feedUrl: feed.value.trim() } }));
  $('#update-check').addEventListener('click', () => api('POST', '/api/update/check').then(() => toast('Buscando actualizaciones…')).catch((e) => toast(e.message)));
}

// ---------- Actualizaciones ----------
function renderUpdate(u) {
  const el = $('#update-banner');
  if (!u || u.state === 'error') {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (u.state === 'ready') {
    el.innerHTML = `<span>🐾 Ya descargué la versión ${esc(u.version)} de Satronho Bot.</span><button class="btn primary small" id="update-apply">Reiniciar y actualizar</button>`;
  } else if (u.state === 'available') {
    el.innerHTML = `<span>🐾 Hay una versión nueva de Satronho Bot: ${esc(u.version)}.</span>${u.url ? `<button class="btn primary small" id="update-open">Descargarla</button>` : ''}<button class="btn ghost small" id="update-later">Luego</button>`;
  } else {
    el.innerHTML = `<span>Descargando la versión ${esc(u.version)}… ${Math.round(u.pct || 0)}%</span>`;
  }
  $('#update-apply')?.addEventListener('click', () => api('POST', '/api/update/apply').catch((e) => toast(e.message)));
  $('#update-open')?.addEventListener('click', () => window.open(u.url, '_blank'));
  $('#update-later')?.addEventListener('click', () => { el.hidden = true; });
}

// ---------- Ayuda: preguntas por guía ----------
function renderHelpPage() {
  $('#help-guides').innerHTML = ['samy', 'troya', 'nono', 'juana']
    .map((id) => {
      const qs = helpKb.KB.filter((e) => e.guide === id);
      return `<div class="card help-guide" style="--g:${GUIDES[id].color}">
        <div class="who"><span class="guide" data-avatar="${id}" data-size="70"></span><div><b>${esc(GUIDES[id].name)}</b><small>${esc(GUIDES[id].role)}</small></div></div>
        ${qs.map((e) => `<button type="button" class="faq-q" data-faq="${id}">${esc(e.q)}</button>`).join('')}
        <button type="button" class="btn small mt" data-open-help="${id}">Preguntarle a ${esc(GUIDES[id].name)}</button></div>`;
    })
    .join('');
  $('#help-guides').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-faq]');
    if (b) openHelp(b.dataset.faq, b.textContent);
  });
}

// ---------- Arranque ----------
async function init() {
  const state = await api('GET', '/api/state');
  config = state.config;
  applyAppearance(config);
  const v = `v${state.app?.version || ''}`;
  appVersion = v;
  $('#app-version').textContent = v;
  $('#foot-version').textContent = v;
  onConfigSaved((c) => {
    Object.assign(config, c);
    updateTroya();
    homeVoice(config, lastEngine);
  });
  renderHelpPage();
  initHelp();
  initNav(config);
  initGuides(config);
  setHelpContext(() => {
    const voice = lastEngine?.voices?.find((x) => x.id === config.tts.piperVoice && x.installed);
    return { status, music: lastMusic, stats: lastStats, version: appVersion, voiceLabel: voice?.label || '' };
  });
  initAppearance(config);
  initPlatforms();
  initConnTabs();
  initVoice(config);
  onTtsQueue(() => homeVoice(config, lastEngine));
  initGoalsAndAlerts();
  initOverlays(config);
  initSimulator();
  initHome();
  initAppSettings();
  for (const p of ['tiktok', 'kick', 'starvios', 'twitch']) renderStatus({ platform: p, state: 'disconnected' });

  let started = false;
  const ws = connectSatronho(
    (kind, p) => {
      switch (kind) {
        case 'hello':
          goals.clear();
          p.goals.forEach((g) => goals.set(g.id, g));
          renderGoals();
          Object.values(p.status || {}).forEach(renderStatus);
          $('#log').innerHTML = '<li class="empty">Aún no hay actividad.</li>';
          $('#home-feed').innerHTML = '<li class="empty">Aún no llega nada. Prueba con ▶ Simular.</li>';
          [...(p.recent || [])].reverse().forEach((e) => { addLog(e); homeEvent(e); });
          lastEngine = p.engine;
          lastStats = p.stats;
          lastMusic = p.music;
          setOnlineVoices(p.onlineVoices || []);
          if (!started) {
            initKickbot(config, p.kickbot);
            initStarviosbot(config, p.starviosbot);
          } else {
            renderKickbot(p.kickbot);
            renderStarviosbot(p.starviosbot);
          }
          kickWriteState(p.kickbot);
          renderEngine(p.engine);
          setStepFacts({ voice: p.engine?.voices?.some((x) => x.installed) });
          renderAllowed(p.allowed || []);
          if (!started) {
            started = true;
            initMusic(config, { clientId: p.clientId, sendWs: (m) => ws.send(m) });
            initStats({ stats: p.stats, statsHistory: p.statsHistory });
          } else {
            onStats(p.stats);
            onStatsHistory(p.statsHistory || []);
            ws.send({ kind: 'player-hello' }); // tras reconectar, seguimos siendo el reproductor
          }
          onMusic(p.music);
          homeMusic(p.music);
          homeStats(p.stats);
          homeVoice(config, p.engine);
          renderUpdate(p.update);
          break;
        case 'update': renderUpdate(p); break;
        case 'kickbot': renderKickbot(p); kickWriteState(p); break;
        case 'starviosbot': renderStarviosbot(p); break;
        case 'event': addLog(p); homeEvent(p); countEvent(); break;
        case 'goal': goals.set(p.id, p); renderGoals(); break;
        case 'goal-removed': goals.delete(p.id); renderGoals(); break;
        case 'goal-complete': sayFor('juana', `¡Cumpliste la meta «${esc(p.title)}»! 🎉`, 9000, 'ok'); break;
        case 'status': renderStatus(p); break;
        case 'tts': onTtsItem(p); break;
        case 'tts-engine':
          lastEngine = p;
          renderEngine(p);
          homeVoice(config, p);
          setStepFacts({ voice: p.voices?.some((x) => x.installed) });
          break;
        case 'tts-allowed': renderAllowed(p); break;
        case 'music': lastMusic = p; onMusic(p); homeMusic(p); break;
        case 'music-notice': onMusicNotice(p); break;
        case 'tts-decision': markDecision(p); break;
        case 'stats': lastStats = p; onStats(p); homeStats(p); break;
        case 'stats-history': onStatsHistory(p); break;
        default: break;
      }
    },
    (up) => document.body.classList.toggle('offline', !up)
  );
}

init().catch((e) => toast(`Error al iniciar: ${e.message}`));
