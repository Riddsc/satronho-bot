// Chat en vivo: todas las plataformas en un solo chat, con Samy de guía.
//   - Pestañas por plataforma con contador, o una columna por plataforma.
//   - Insignias: moderador, suscriptor, VIP y nivel en tu equipo de TikTok.
//   - 🔊 / 🔇 con el motivo de Troya en cada mensaje.
//   - Acciones al pasar el ratón: leer ahora, silenciar o darle voz propia.
//   - Columna de regalos con el total por moneda.
//   - Panel de ajustes: plataformas, ruido y regalos (se recuerda en este PC).

import { $, $$, api, esc, toast, timeOf, PLATFORM_NAMES } from './util.js';
import { avatarHtml, upsertSpecial, specialFor } from './voice.js';
import { sayFor } from './guides.js';

const PLATS = ['tiktok', 'kick', 'twitch', 'starvios'];
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
  giftsInline: false,
  giftsColumn: true,
  minGift: 0,
  platforms: { tiktok: true, kick: true, twitch: true, starvios: true },
  panel: true,
};
let prefs = loadPrefs();
const items = []; // eventos del directo (más viejo primero)
const decisions = new Map(); // id -> { read, reason }
const counts = { all: 0, tiktok: 0, kick: 0, twitch: 0, starvios: 0 };
const gifts = [];
let paused = false;
let q = '';

function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { ...DEFAULTS, ...raw, platforms: { ...DEFAULTS.platforms, ...(raw.platforms || {}) } };
  } catch {
    return { ...DEFAULTS };
  }
}
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* sin almacenamiento */ }
}

const LOGO = (p) => (p === 'twitch'
  ? '<span class="pl lc-pl" style="background:#9146ff;color:#fff">Tw</span>'
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
    case 'live-start': return '· empezó tu directo';
    case 'live-end': return '· terminó tu directo';
    default: return '';
  }
}

const isCommand = (e) => e.type === 'chat' && /^\s*!/.test(e.message || '');

function nodeFor(e) {
  const li = document.createElement('li');
  li.dataset.id = e.id;
  li.dataset.p = e.platform;
  const d = decisions.get(e.id);
  const sp = e.user ? specialFor(e.platform, e.user) : null;
  li.className = ['lc-item', e.type === 'chat' ? 'lc-chat' : 'lc-event', `t-${e.type}`,
    isCommand(e) ? 'is-cmd' : '', d?.reason === 'es un bot' ? 'is-bot' : '', d && !d.read ? 'is-muted' : '',
    sp?.action === 'mute' ? 'is-silenced' : ''].filter(Boolean).join(' ');
  const color = e.extra?.color || '';
  const name = esc(e.user?.name || 'Anónimo');
  const tts = d ? (d.read ? '<span class="lc-tts ok" title="Troya lo leyó">🔊</span>' : `<span class="lc-tts no" title="No se leyó: ${esc(d.reason)}">🔇 <small>${esc(d.reason)}</small></span>`) : '';
  if (e.type === 'chat') {
    li.innerHTML = `<span class="lc-avw">${avatarHtml(e.user?.name, e.user?.avatar, color)}${LOGO(e.platform)}</span>
      <div class="lc-body"><div class="lc-meta">${badgesHtml(e)}<b class="lc-name" ${color ? `style="color:${esc(color)}"` : ''}>${name}</b>${sp?.voice || sp?.spokenName ? '<i class="bd voz" title="Tiene voz propia">🎙</i>' : ''}<time>${timeOf(e.ts)}</time>${e.test ? '<small class="lc-test">prueba</small>' : ''}${tts}</div>
      <p class="lc-text">${esc(e.message)}</p></div>
      <div class="lc-act" role="group" aria-label="Acciones">
        <button type="button" data-lc="read" title="Leer ahora">🔊</button>
        <button type="button" data-lc="voice" title="Darle voz propia">🎙</button>
        <button type="button" data-lc="mute" title="${sp?.action === 'mute' ? 'Devolverle la voz' : 'Silenciar su voz'}">${sp?.action === 'mute' ? '🔈' : '🔇'}</button>
      </div>`;
  } else {
    const img = (e.type === 'gift' || e.type === 'sticker') && e.extra?.image ? `<img class="lc-giftimg ${e.type === 'sticker' ? 'lc-sticker' : ''}" src="/gift-img?u=${encodeURIComponent(e.extra.image)}" alt="" loading="lazy">` : '';
    const amount = e.type === 'gift' ? `<span class="lc-amount">${Number(e.amount || 0).toLocaleString('es-CO')} ${esc(e.extra?.currency || '')}</span>` : '';
    li.innerHTML = `<span class="lc-evicon">${{ follow: '♥', sub: '✦', gift: '🎁', like: '👍', share: '↗', sticker: '✨', join: '👋', superfan: '⭐', 'live-start': '🔴', 'live-end': '⏹' }[e.type] || '•'}</span>
      <p class="lc-evtext">${LOGO(e.platform)}<b>${name}</b> ${describe(e)} ${img}${amount}</p><time>${timeOf(e.ts)}</time>`;
  }
  return li;
}

// ---------- Filtros ----------
function visible(e) {
  if (!prefs.platforms[e.platform] && PLATS.includes(e.platform)) return false;
  if (!prefs.split && prefs.tab !== 'all' && e.platform !== prefs.tab) return false;
  if (e.type !== 'chat') {
    if (e.type === 'gift') {
      if (!prefs.giftsInline) return false;
      if (e.amount < (Number(prefs.minGift) || 0)) return false;
      return true;
    }
    if (e.type === 'sticker') return prefs.showStickers !== false;
    if (e.type === 'join') return Boolean(prefs.showJoins);
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
  wrap.className = `lc-feeds ${prefs.split ? 'split' : ''} ${prefs.hideBots ? 'hide-bots' : ''} ${prefs.hideMuted ? 'hide-muted' : ''}`;
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
  for (const g of gifts) by.set(g.currency, (by.get(g.currency) || 0) + g.amount);
  return [...by].map(([cur, n]) => `<b>${n.toLocaleString('es-CO')}</b> ${esc(cur || '')}`).join(' · ') || 'Todavía nada';
}
function giftRow(e) {
  const x = e.extra || {};
  return `<li>${avatarHtml(e.user?.name, e.user?.avatar)}<div><b>${esc(e.user?.name || 'Anónimo')}</b><small>${LOGO(e.platform)}${x.count > 1 ? `${x.count}× ` : ''}${esc(x.giftName || 'Regalo')}</small></div>${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<span class="lc-amount">${Number(e.amount || 0).toLocaleString('es-CO')}<small>${esc(x.currency || '')}</small></span></li>`;
}
function renderGifts() {
  const col = $('#lc-gifts');
  if (!col) return;
  col.hidden = !prefs.giftsColumn;
  $('#lc-gift-total').innerHTML = giftTotals();
  $('#lc-gift-count').textContent = `${gifts.length} ${gifts.length === 1 ? 'regalo' : 'regalos'}`;
  const list = gifts.filter((g) => g.amount >= (Number(prefs.minGift) || 0));
  $('#lc-gift-list').innerHTML = list.length ? list.slice(0, 120).map((g) => giftRow(g.e)).join('') : '<li class="lc-empty">Los regalos y propinas de todas las plataformas salen aquí.</li>';
}

// ---------- Panel de ajustes ----------
function fillPanel() {
  for (const el of $$('[data-lcp]')) {
    const [a, b] = el.dataset.lcp.split('.');
    const v = b ? prefs[a][b] : prefs[a];
    if (el.type === 'checkbox') el.checked = Boolean(v);
    else el.value = v;
  }
  $('#lc-layout').classList.toggle('no-panel', !prefs.panel);
  $('#lc-panel-btn').setAttribute('aria-pressed', String(prefs.panel));
  $('#lc-order').textContent = prefs.newestBottom ? 'Lo nuevo abajo' : 'Lo nuevo arriba';
}

// ---------- Entradas ----------
export function addChatEvent(e) {
  items.push(e);
  if (items.length > 1500) items.splice(0, items.length - 1500);
  if (PLATS.includes(e.platform) && e.type === 'chat') { counts.all += 1; counts[e.platform] += 1; }
  if (e.type === 'gift') {
    gifts.unshift({ e, amount: Number(e.amount) || 0, currency: e.extra?.currency || '' });
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

// Al (re)conectar con la app: se vacía y llegan de nuevo los recientes.
export function resetChat() {
  items.length = 0;
  gifts.length = 0;
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
    const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) || 0 : el.value;
    if (b) prefs[a][b] = v; else prefs[a] = v;
    if (a === 'platforms' && !prefs.platforms[prefs.tab]) prefs.tab = 'all';
    savePrefs();
    renderFeeds();
    renderGifts();
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
    if (btn.dataset.lc === 'read') {
      api('POST', '/api/tts/say', { text: `${sp?.spokenName || e.user?.name} dice: ${e.message}`, voice: sp?.voice || undefined, rate: sp?.rate, pitch: sp?.pitch }).catch((err) => toast(err.message));
    } else if (btn.dataset.lc === 'mute') {
      const muted = sp?.action === 'mute';
      upsertSpecial({ key: sp?.key || key, name: e.user?.name, avatar: e.user?.avatar || '', action: muted ? 'allow' : 'mute' });
      sayFor('samy', muted ? `<b>${esc(e.user?.name)}</b> vuelve a tener voz.` : `Listo, Troya ya no lee a <b>${esc(e.user?.name)}</b>. Lo puedes cambiar en Voz del chat → Espectadores especiales.`, 5000, 'ok');
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
