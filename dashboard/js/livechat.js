// Chat en vivo: todas las plataformas en un solo chat, con Samy de guía.
//   - Pestañas por plataforma con contador, o una columna por plataforma.
//   - Insignias: moderador, suscriptor, VIP y nivel en tu equipo de TikTok.
//   - 🔊 / 🔇 con el motivo de Troya en cada mensaje.
//   - Acciones al pasar el mouse: leer ahora, silenciar o darle voz propia.
//   - Columna de regalos con el total por moneda.
//   - Panel de ajustes: plataformas, ruido y regalos (se recuerda en este PC).
//   - Emotes de Kick y Twitch como imagen, canjes de la tienda de Kick y
//     «📺 En pantalla» para mostrar un mensaje en el overlay.
// La ventana aparte (popout-chat.html) lee estos mismos ajustes.

import { $, $$, api, esc, toast, timeOf, PLATFORM_NAMES } from './util.js';
import { avatarHtml, upsertSpecial, specialFor } from './voice.js';
import { sayFor } from './guides.js';
import { messageHtml, onlyEmotes } from './emotes.js';

const PLATS = ['tiktok', 'kick', 'twitch', 'starvios'];
let config = null; // la configuración de la app (palabras prohibidas, tus canales)
export function setChatConfig(c) { config = c; }
const PREFS_KEY = 'satronho.livechat';
const DEFAULTS = {
  tab: 'all',
  split: false,
  newestBottom: true,
  hideCommands: false,
  hideBots: false,
  hideMuted: false,
  showEvents: true,
  showStickers: true,
  showJoins: false,
  showRewards: true,
  emotes: true,
  giftsInline: false,
  giftsColumn: true,
  minGift: 0,
  countSubs: true,
  censor: false,
  hiddenAccounts: '',
  hl: { mods: true, subs: false, team: false, special: true, first: false, mentions: true },
  mentionWords: '',
  fontSize: 14,
  showAvatars: true,
  showTime: true,
  compact: false,
  ptab: 'filtros',
  platforms: { tiktok: true, kick: true, twitch: true, starvios: true },
  panel: true,
};
let prefs = loadPrefs();
const items = []; // eventos del directo (más viejo primero)
const decisions = new Map(); // id -> { read, reason }
const counts = { all: 0, tiktok: 0, kick: 0, twitch: 0, starvios: 0 };
const gifts = [];
const users = new Map(); // platform:usuario -> { name, platform, avatar, count, last, e }
let paused = false;
let q = '';

function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { ...DEFAULTS, ...raw, platforms: { ...DEFAULTS.platforms, ...(raw.platforms || {}) }, hl: { ...DEFAULTS.hl, ...(raw.hl || {}) } };
  } catch {
    return { ...DEFAULTS };
  }
}
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* sin almacenamiento */ }
}

const LOGO = (p) => (p === 'twitch'
  ? '<span class="pl plogo lc-pl" data-logo="twitch" aria-hidden="true"></span>'
  : `<span class="pl plogo lc-pl" data-logo="${esc(p)}" aria-hidden="true"></span>`);

// ---------- Insignias ----------
function badgesHtml(e) {
  const out = [];
  const r = e.extra?.roles || {};
  const b = new Set(e.extra?.badges || []);
  if (r.host || b.has('broadcaster')) out.push('<i class="bd host" title="Tú">★</i>');
  if (r.mod || b.has('moderator')) out.push('<i class="bd mod" title="Moderador">🛡</i>');
  if (b.has('vip')) out.push('<i class="bd vip" title="VIP">◆</i>');
  if (r.sub || b.has('subscriber') || b.has('founder') || b.has('og')) out.push('<i class="bd sub" title="Suscriptor">✦</i>');
  if (r.team) out.push(`<i class="bd team" title="Miembro de tu equipo, nivel ${r.team}">♥${r.team}</i>`);
  return out.join('');
}

function describe(e) {
  const x = e.extra || {};
  switch (e.type) {
    case 'follow': return 'empezó a seguirte';
    case 'sub': return e.amount > 1 ? `se suscribió (${e.amount} meses)` : 'se suscribió';
    case 'gift': return `envió ${x.count > 1 ? `${x.count}× ` : ''}<b>${esc(x.giftName || 'un regalo')}</b>`;
    case 'like': return `dio ${e.amount} me gusta`;
    case 'share': return 'compartió tu directo';
    case 'sticker': return 'mandó un sticker';
    case 'join': return 'llegó al directo';
    case 'superfan': return 'ahora es superfan ⭐';
    case 'reward': return `canjeó <b class="lc-reward" ${/^#[0-9a-f]{3,8}$/i.test(x.color || '') ? `style="--rw:${x.color}"` : ''}>${esc(x.rewardTitle || 'una recompensa')}</b>${e.amount ? ` <small class="lc-pts">${Number(e.amount).toLocaleString('es-CO')} pts</small>` : ''}${e.message ? `<span class="lc-rwmsg">«${messageHtml(e, { emotes: prefs.emotes, transform: censor })}»</span>` : ''}`;
    case 'live-start': return '· empezó tu directo';
    case 'live-end': return '· terminó tu directo';
    default: return '';
  }
}

const isCommand = (e) => e.type === 'chat' && /^\s*!/.test(e.message || '');

// ---------- Cuentas ocultas, censura y destacados ----------
const listOf = (txt) => String(txt || '').split(',').map((x) => x.trim().replace(/^@/, '').toLowerCase()).filter(Boolean);
const isHidden = (e) => {
  const hidden = listOf(prefs.hiddenAccounts);
  return hidden.length > 0 && [e.user?.name, e.user?.id].some((x) => hidden.includes(String(x || '').toLowerCase()));
};
function censor(text) {
  if (!prefs.censor) return text;
  const words = (config?.tts?.bannedWords || []).map((w) => String(w).trim()).filter((w) => w.length > 1);
  if (!words.length) return text;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'giu');
  return text.replace(re, (m) => '✱'.repeat(Math.min(6, m.length)));
}
const firstSeen = new Set(); // platform:usuario que ya escribió en este directo
function mentionRe() {
  const mine = Object.values(config?.platforms || {}).map((p) => String(p?.channel || '').replace(/^@/, '')).filter(Boolean);
  const words = [...mine, ...listOf(prefs.mentionWords)];
  return words.length ? new RegExp(`(^|[^\\p{L}\\p{N}])@?(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}])`, 'iu') : null;
}
function highlightOf(e, sp, first) {
  if (e.type !== 'chat') return '';
  const r = e.extra?.roles || {};
  const b = new Set(e.extra?.badges || []);
  const h = prefs.hl || {};
  const re = h.mentions ? mentionRe() : null;
  if (h.mentions && re && re.test(e.message || '')) return 'hl-mention';
  if (h.mods && (r.mod || b.has('moderator'))) return 'hl-mod';
  if (h.special && sp && sp.action !== 'mute') return 'hl-special';
  if (h.subs && (r.sub || b.has('subscriber') || b.has('vip') || b.has('founder'))) return 'hl-sub';
  if (h.team && r.team) return 'hl-team';
  if (h.first && first) return 'hl-first';
  return '';
}

function nodeFor(e) {
  const li = document.createElement('li');
  li.dataset.id = e.id;
  li.dataset.p = e.platform;
  const d = decisions.get(e.id);
  const sp = e.user ? specialFor(e.platform, e.user) : null;
  li.className = ['lc-item', e.type === 'chat' ? 'lc-chat' : 'lc-event', `t-${e.type}`,
    isCommand(e) ? 'is-cmd' : '', d?.reason === 'es un bot' ? 'is-bot' : '', d && !d.read ? 'is-muted' : '',
    sp?.action === 'mute' ? 'is-silenced' : '', highlightOf(e, sp, e._first)].filter(Boolean).join(' ');
  const color = e.extra?.color || '';
  const name = esc(e.user?.name || 'Anónimo');
  const tts = d ? (d.read ? '<span class="lc-tts ok" title="Se leyó en voz alta">🔊</span>' : `<span class="lc-tts no" title="No se leyó: ${esc(d.reason)}">🔇 <small>${esc(d.reason)}</small></span>`) : '';
  if (e.type === 'chat') {
    li.innerHTML = `<span class="lc-avw">${avatarHtml(e.user?.name, e.user?.avatar, color)}${LOGO(e.platform)}</span>
      <div class="lc-body"><div class="lc-meta">${badgesHtml(e)}<b class="lc-name" ${color ? `style="color:${esc(color)}"` : ''}>${name}</b>${sp?.voice || sp?.spokenName ? '<i class="bd voz" title="Tiene voz propia">🎙</i>' : ''}<time>${timeOf(e.ts)}</time>${e.test ? '<small class="lc-test">prueba</small>' : ''}${tts}</div>
      <p class="lc-text${prefs.emotes && onlyEmotes(e) ? ' only-emotes' : ''}">${messageHtml(e, { emotes: prefs.emotes, transform: censor })}</p></div>
      <div class="lc-act" role="group" aria-label="Acciones">
        <button type="button" data-lc="spot" title="Mostrar en pantalla (overlay «Mensaje en pantalla»)">📺</button>
        <button type="button" data-lc="read" title="Leer ahora">🔊</button>
        <button type="button" data-lc="voice" title="Darle voz propia">🎙</button>
        <button type="button" data-lc="mute" title="${sp?.action === 'mute' ? 'Devolverle la voz' : 'Silenciar su voz'}">${sp?.action === 'mute' ? '🔈' : '🔇'}</button>
      </div>`;
  } else {
    const img = (e.type === 'gift' || e.type === 'sticker') && e.extra?.image ? `<img class="lc-giftimg ${e.type === 'sticker' ? 'lc-sticker' : ''}" src="/gift-img?u=${encodeURIComponent(e.extra.image)}" alt="" loading="lazy">` : '';
    const amount = e.type === 'gift' ? `<span class="lc-amount">${Number(e.amount || 0).toLocaleString('es-CO')} ${esc(e.extra?.currency || '')}</span>` : '';
    li.innerHTML = `<span class="lc-evicon">${{ follow: '♥', sub: '✦', gift: '🎁', like: '👍', share: '↗', sticker: '✨', join: '👋', superfan: '⭐', reward: '🎟', 'live-start': '🔴', 'live-end': '⏹' }[e.type] || '•'}</span>
      <p class="lc-evtext">${LOGO(e.platform)}<b>${name}</b> ${describe(e)} ${img}${amount}</p><time>${timeOf(e.ts)}</time>`;
  }
  return li;
}

// ---------- Filtros ----------
function visible(e) {
  if (!prefs.platforms[e.platform] && PLATS.includes(e.platform)) return false;
  if (e.user && isHidden(e)) return false;
  if (!prefs.split && prefs.tab !== 'all' && e.platform !== prefs.tab) return false;
  if (e.type !== 'chat') {
    if (e.type === 'gift') {
      if (!prefs.giftsInline) return false;
      if (e.amount < (Number(prefs.minGift) || 0)) return false;
      return true;
    }
    if (e.type === 'sticker') return prefs.showStickers !== false;
    if (e.type === 'join') return Boolean(prefs.showJoins);
    if (e.type === 'reward') return prefs.showRewards !== false;
    if (e.type === 'live-start' || e.type === 'live-end') return true;
    return prefs.showEvents && e.type !== 'like';
  }
  if (prefs.hideCommands && isCommand(e)) return false;
  if (q && !`${e.user?.name} ${e.message}`.toLowerCase().includes(q)) return false;
  return true;
}

function feedOf(e) {
  if (!prefs.split) return $('#lc-feed-all');
  return $(`#lc-feed-${e.platform}`) || $('#lc-feed-all');
}

function scrollEnd(ul) {
  if (paused) return;
  if (prefs.newestBottom) ul.scrollTop = ul.scrollHeight;
  else ul.scrollTop = 0;
}

function place(ul, li) {
  ul.querySelector('.lc-empty')?.remove();
  if (prefs.newestBottom) ul.append(li); else ul.prepend(li);
  while (ul.children.length > 400) (prefs.newestBottom ? ul.firstElementChild : ul.lastElementChild).remove();
}

function renderFeeds() {
  const wrap = $('#lc-feeds');
  if (!wrap) return;
  const cols = prefs.split ? PLATS.filter((p) => prefs.platforms[p]) : ['all'];
  wrap.className = `lc-feeds ${prefs.split ? 'split' : ''} ${prefs.hideBots ? 'hide-bots' : ''} ${prefs.hideMuted ? 'hide-muted' : ''} ${prefs.showAvatars ? '' : 'no-av'} ${prefs.showTime ? '' : 'no-time'} ${prefs.compact ? 'compact' : ''}`;
  wrap.style.setProperty('--lc-fs', `${Number(prefs.fontSize) || 14}px`);
  wrap.style.setProperty('--cols', cols.length);
  wrap.innerHTML = cols.map((p) => `<section class="lc-col">${prefs.split ? `<h4>${LOGO(p)}${PLATFORM_NAMES[p]} <small>${counts[p]}</small></h4>` : ''}<ul class="lc-feed" id="lc-feed-${p}"></ul></section>`).join('');
  for (const e of items) if (visible(e)) place(feedOf(e), nodeFor(e));
  for (const ul of $$('.lc-feed', wrap)) {
    if (!ul.children.length) ul.innerHTML = `<li class="lc-empty">${items.length ? 'Nada con estos filtros.' : 'Cuando alguien escriba, aparece aquí. Puedes probar con «Simular» arriba o el formulario de abajo.'}</li>`;
    scrollEnd(ul);
  }
  renderTabs();
}

function renderTabs() {
  const el = $('#lc-tabs');
  if (!el) return;
  el.hidden = prefs.split;
  el.innerHTML = [['all', 'Todas'], ...PLATS.filter((p) => prefs.platforms[p]).map((p) => [p, PLATFORM_NAMES[p]])]
    .map(([id, n]) => `<button type="button" data-lc-tab="${id}" aria-pressed="${prefs.tab === id}">${id === 'all' ? '' : LOGO(id)}${n}<small>${counts[id] || 0}</small></button>`).join('');
}

// ---------- Regalos ----------
function giftTotals() {
  const by = new Map();
  for (const g of gifts) if (!g.sub) by.set(g.currency, (by.get(g.currency) || 0) + g.amount);
  return [...by].map(([cur, n]) => `<b>${n.toLocaleString('es-CO')}</b> ${esc(cur || '')}`).join(' · ') || 'Todavía nada';
}
function giftRow(e) {
  const x = e.extra || {};
  if (e.type === 'sub') return `<li>${avatarHtml(e.user?.name, e.user?.avatar)}<div><b>${esc(e.user?.name || 'Anónimo')}</b><small>${LOGO(e.platform)}${e.amount > 1 ? `se suscribió (${e.amount} meses)` : 'se suscribió'}</small></div><span class="lc-amount">✦</span></li>`;
  return `<li>${avatarHtml(e.user?.name, e.user?.avatar)}<div><b>${esc(e.user?.name || 'Anónimo')}</b><small>${LOGO(e.platform)}${x.count > 1 ? `${x.count}× ` : ''}${esc(x.giftName || 'Regalo')}</small></div>${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<span class="lc-amount">${Number(e.amount || 0).toLocaleString('es-CO')}<small>${esc(x.currency || '')}</small></span></li>`;
}
function renderGifts() {
  const col = $('#lc-gifts');
  if (!col) return;
  col.hidden = !prefs.giftsColumn;
  $('#lc-gift-total').innerHTML = giftTotals();
  $('#lc-gift-count').textContent = `${gifts.length} ${gifts.length === 1 ? 'regalo' : 'regalos'}`;
  const list = gifts.filter((g) => (g.sub ? prefs.countSubs : g.amount >= (Number(prefs.minGift) || 0)));
  $('#lc-gift-list').innerHTML = list.length ? list.slice(0, 120).map((g) => giftRow(g.e)).join('') : '<li class="lc-empty">Los regalos y propinas de todas las plataformas salen aquí.</li>';
}

// ---------- Usuarios del directo ----------
let uq = '';
function renderUsers() {
  const el = $('#lc-users');
  if (!el) return;
  const hidden = listOf(prefs.hiddenAccounts);
  const list = [...users.values()]
    .filter((u) => !uq || u.name.toLowerCase().includes(uq))
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, 150);
  el.innerHTML = list.length ? list.map((u) => {
    const sp = specialFor(u.platform, u.e.user);
    const off = hidden.includes(u.name.toLowerCase());
    return `<li data-uk="${esc(u.platform)}:${esc(String(u.e.user.id || u.name).toLowerCase())}">${avatarHtml(u.name, u.avatar)}<div class="lc-u-who"><b>${esc(u.name)}</b><small>${LOGO(u.platform)}${u.count} ${u.count === 1 ? 'mensaje' : 'mensajes'}</small></div>
      <span class="lc-u-act"><button type="button" data-ua="voice" title="Darle voz propia">🎙</button><button type="button" data-ua="mute" title="${sp?.action === 'mute' ? 'Devolverle la voz' : 'Silenciar su voz'}">${sp?.action === 'mute' ? '🔈' : '🔇'}</button><button type="button" data-ua="hide" title="${off ? 'Volver a mostrar en el chat' : 'Ocultar en el chat'}" aria-pressed="${off}">${off ? '👁' : '🙈'}</button></span></li>`;
  }).join('') : `<li class="lc-empty">${users.size ? 'Nadie con ese nombre.' : 'Aquí aparece quien escribe en este directo, con cuántos mensajes lleva.'}</li>`;
}

// ---------- Panel de ajustes ----------
function fillPanel() {
  for (const el of $$('[data-lcp]')) {
    const [a, b] = el.dataset.lcp.split('.');
    const v = b ? prefs[a][b] : prefs[a];
    if (el.type === 'checkbox') el.checked = Boolean(v);
    else el.value = v;
  }
  for (const b of $$('#lc-ptabs [data-lcpt]')) b.setAttribute('aria-selected', String(b.dataset.lcpt === prefs.ptab));
  for (const sec of $$('#lc-panel [data-lcps]')) sec.hidden = sec.dataset.lcps !== prefs.ptab;
  if ($('#lc-fs-val')) $('#lc-fs-val').textContent = `${prefs.fontSize} px`;
  $('#lc-split')?.setAttribute('aria-pressed', String(prefs.split));
  if (prefs.ptab === 'usuarios') renderUsers();
  $('#lc-layout').classList.toggle('no-panel', !prefs.panel);
  $('#lc-panel-btn').setAttribute('aria-pressed', String(prefs.panel));
  $('#lc-order').textContent = prefs.newestBottom ? 'Lo nuevo abajo' : 'Lo nuevo arriba';
}

// ---------- Entradas ----------
export function addChatEvent(e) {
  items.push(e);
  if (items.length > 1500) items.splice(0, items.length - 1500);
  if (PLATS.includes(e.platform) && e.type === 'chat') { counts.all += 1; counts[e.platform] += 1; }
  if (e.type === 'chat' && e.user) {
    const k = `${e.platform}:${String(e.user.id || e.user.name).toLowerCase()}`;
    if (!firstSeen.has(k)) { firstSeen.add(k); e._first = true; }
    const u = users.get(k) || { name: e.user.name, platform: e.platform, avatar: '', count: 0, last: 0, e };
    u.count += 1; u.last = e.ts || Date.now(); u.name = e.user.name; u.e = e;
    if (e.user.avatar) u.avatar = e.user.avatar;
    users.set(k, u);
    if (prefs.ptab === 'usuarios') renderUsers();
  }
  if (e.type === 'gift' || (e.type === 'sub' && prefs.countSubs)) {
    gifts.unshift({ e, amount: e.type === 'sub' ? 0 : Number(e.amount) || 0, currency: e.type === 'sub' ? '' : e.extra?.currency || '', sub: e.type === 'sub' });
    if (gifts.length > 500) gifts.length = 500;
    renderGifts();
  }
  if (!$('#lc-feeds')) return;
  if (visible(e)) {
    const ul = feedOf(e);
    if (ul) { place(ul, nodeFor(e)); scrollEnd(ul); }
  }
  updateCounters();
}

function updateCounters() {
  for (const b of $$('#lc-tabs [data-lc-tab]')) b.querySelector('small').textContent = counts[b.dataset.lcTab] || 0;
  for (const h of $$('.lc-col h4 small')) {
    const p = h.closest('.lc-col').querySelector('.lc-feed').id.replace('lc-feed-', '');
    h.textContent = counts[p] || 0;
  }
}

export function markChatDecision(d) {
  decisions.set(d.eventId, { read: d.read, reason: d.reason });
  const li = $(`.lc-item[data-id="${CSS.escape(d.eventId)}"]`);
  if (!li) return;
  const e = items.find((x) => x.id === d.eventId);
  if (e) li.replaceWith(nodeFor(e));
}

// Desde las cuentas de arriba: ver solo una plataforma o mostrarla u ocultarla.
export function showOnlyPlatform(p) {
  prefs.split = false;
  prefs.tab = p;
  prefs.platforms[p] = true;
  savePrefs();
  if ($('#lc-feeds')) { renderFeeds(); fillPanel(); }
}
export const chatShows = (p) => prefs.platforms[p] !== false;
export function setChatShows(p, on) {
  prefs.platforms[p] = on;
  if (!on && prefs.tab === p) prefs.tab = 'all';
  savePrefs();
  if ($('#lc-feeds')) { renderFeeds(); fillPanel(); }
}

// Al (re)conectar con la app: se vacía y llegan de nuevo los recientes.
export function resetChat() {
  items.length = 0;
  gifts.length = 0;
  users.clear();
  firstSeen.clear();
  decisions.clear();
  for (const k of Object.keys(counts)) counts[k] = 0;
  if ($('#lc-feeds')) { renderFeeds(); renderGifts(); }
}

// ---------- Inicio ----------
export function initLiveChat() {
  if (!$('#lc-layout')) return;
  renderFeeds();
  renderGifts();
  fillPanel();

  $('#lc-tabs').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-lc-tab]');
    if (!b) return;
    prefs.tab = b.dataset.lcTab;
    savePrefs();
    renderFeeds();
  });
  $('#lc-q').addEventListener('input', (ev) => { q = ev.target.value.trim().toLowerCase(); renderFeeds(); });
  $('#lc-panel-btn').addEventListener('click', () => { prefs.panel = !prefs.panel; savePrefs(); fillPanel(); });
  $('#lc-ptabs').addEventListener('click', (ev) => { const b = ev.target.closest('[data-lcpt]'); if (!b) return; prefs.ptab = b.dataset.lcpt; savePrefs(); fillPanel(); });
  $('#lc-split').addEventListener('click', () => { prefs.split = !prefs.split; savePrefs(); fillPanel(); renderFeeds(); });
  $('#lc-popout').addEventListener('click', () => window.open('/popout-chat.html', 'satronho-chat', 'width=440,height=720'));
  $('#lc-uq').addEventListener('input', (ev) => { uq = ev.target.value.trim().toLowerCase(); renderUsers(); });
  $('#lc-users').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ua]');
    const u = users.get(b?.closest('[data-uk]')?.dataset.uk);
    if (!b || !u) return;
    const e = u.e;
    const sp = specialFor(e.platform, e.user);
    const key = `${e.platform}:${String(e.user?.id || e.user?.name || '').toLowerCase()}`;
    if (b.dataset.ua === 'hide') {
      const list = listOf(prefs.hiddenAccounts);
      const n = u.name.toLowerCase();
      prefs.hiddenAccounts = (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]).join(', ');
      savePrefs(); fillPanel(); renderFeeds();
    } else if (b.dataset.ua === 'mute') {
      upsertSpecial({ key: sp?.key || key, name: e.user?.name, avatar: e.user?.avatar || '', action: sp?.action === 'mute' ? 'allow' : 'mute' });
      renderUsers(); renderFeeds();
    } else if (b.dataset.ua === 'voice') {
      upsertSpecial({ key: sp?.key || key, name: e.user?.name, avatar: e.user?.avatar || '', action: 'allow' });
      location.hash = '#/voz/especiales';
    }
  });
  $('#lc-unspot').addEventListener('click', () => api('POST', '/api/chat/spotlight', { clear: true }).then(() => { $('#lc-unspot').hidden = true; }).catch((err) => toast(err.message)));
  $('#lc-order').addEventListener('click', () => { prefs.newestBottom = !prefs.newestBottom; savePrefs(); fillPanel(); renderFeeds(); });
  $('#lc-clear').addEventListener('click', () => {
    items.length = 0;
    gifts.length = 0;
    for (const k of Object.keys(counts)) counts[k] = 0;
    renderFeeds();
    renderGifts();
  });
  $('#lc-panel').addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-lcp]');
    if (!el) return;
    const [a, b] = el.dataset.lcp.split('.');
    const v = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? Number(el.value) || 0 : el.value;
    if (b) prefs[a][b] = v; else prefs[a] = v;
    if (a === 'platforms' && !prefs.platforms[prefs.tab]) prefs.tab = 'all';
    savePrefs();
    fillPanel();
    renderFeeds();
    renderGifts();
  });
  $('#lc-panel').addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-lcp="fontSize"]');
    if (!el) return;
    prefs.fontSize = Number(el.value) || 14;
    $('#lc-fs-val').textContent = `${prefs.fontSize} px`;
    $('#lc-feeds').style.setProperty('--lc-fs', `${prefs.fontSize}px`);
  });

  // Pausar el desplazamiento mientras lees algo más arriba.
  $('#lc-feeds').addEventListener('scroll', (ev) => {
    const ul = ev.target;
    if (!ul.classList?.contains('lc-feed')) return;
    const atEnd = prefs.newestBottom ? ul.scrollHeight - ul.scrollTop - ul.clientHeight < 40 : ul.scrollTop < 40;
    paused = !atEnd;
    $('#lc-paused').hidden = !paused;
  }, true);
  $('#lc-paused').addEventListener('click', () => { paused = false; $('#lc-paused').hidden = true; for (const ul of $$('.lc-feed')) scrollEnd(ul); });

  // Acciones de cada mensaje.
  $('#lc-feeds').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-lc]');
    if (!btn) return;
    const e = items.find((x) => x.id === btn.closest('.lc-item')?.dataset.id);
    if (!e) return;
    const who = String(e.user?.name || e.user?.id || '').toLowerCase();
    const key = `${e.platform}:${who}`;
    const sp = specialFor(e.platform, e.user);
    if (btn.dataset.lc === 'spot') {
      api('POST', '/api/chat/spotlight', { event: e })
        .then(() => { $('#lc-unspot').hidden = false; toast('En pantalla. Si no lo ves, agrega el overlay «Mensaje en pantalla» en Overlays.'); })
        .catch((err) => toast(err.message));
    } else if (btn.dataset.lc === 'read') {
      api('POST', '/api/tts/say', { text: `${sp?.spokenName || e.user?.name} dice: ${e.message}`, voice: sp?.voice || undefined, rate: sp?.rate, pitch: sp?.pitch }).catch((err) => toast(err.message));
    } else if (btn.dataset.lc === 'mute') {
      const muted = sp?.action === 'mute';
      upsertSpecial({ key: sp?.key || key, name: e.user?.name, avatar: e.user?.avatar || '', action: muted ? 'allow' : 'mute' });
      sayFor('samy', muted ? `<b>${esc(e.user?.name)}</b> vuelve a tener voz.` : `Listo, <b>${esc(e.user?.name)}</b> queda sin voz. Lo cambias en Voz del chat → Espectadores especiales.`, 5000, 'ok');
      renderFeeds();
    } else if (btn.dataset.lc === 'voice') {
      upsertSpecial({ key: sp?.key || key, name: e.user?.name, avatar: e.user?.avatar || '', action: 'allow' });
      location.hash = '#/voz/especiales';
      setTimeout(() => {
        const inp = $('#sp-q');
        if (inp) { inp.value = e.user?.name || ''; inp.dispatchEvent(new Event('input')); }
      }, 60);
    }
  });

  $('#sim').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    if (!f.message.trim()) return;
    const name = f.user.trim() || 'Espectador';
    await api('POST', '/api/test/chat', { platform: f.platform, user: { id: name.toLowerCase(), name }, message: f.message }).catch((err) => toast(err.message));
    ev.target.message.value = '';
  });
}
