// Huellitas (0.29): los puntos del canal. Tu público los gana por estar,
// escribir, seguir, suscribirse o regalar; los gasta en los juegos del chat,
// en tu tienda y abriendo cofres. Aquí se configura todo y se ven los canjes.

import { $, $$, api, esc, toast, tr, trn, getLocale, PLATFORM_NAMES, timeOf } from './util.js';
import { sayFor } from './guides.js';
import { openSoundPicker, soundLabel } from './soundsUI.js';
import { playAlertSound } from '/overlays/sounds.js';

const PLATS = ['tiktok', 'kick', 'twitch', 'starvios'];
const nf = (n) => new Intl.NumberFormat(getLocale()).format(Number(n) || 0);
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let pts = null; // ajustes de huellitas
let summary = { people: 0, total: 0, active: 0 };
let logList = [];
let users = [];
let search = '';
let games = null;
let gameState = {};
let shop = null;
let redemptions = [];
let sold = {};
let wheels = [];
let counters = [];
const feed = [];

// ---------- Utilidades ----------
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.');
  let cur = o;
  for (const k of ks.slice(0, -1)) cur = cur[k] ??= {};
  cur[ks.at(-1)] = v;
}
const valueOf = (el) => (el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value);
const unitName = (n) => {
  const one = pts?.name || tr('huellita');
  const many = pts?.namePlural || pts?.name || tr('huellitas');
  return Number(n) === 1 ? one : many;
};
const amount = (n) => `<b>${nf(n)}</b> ${esc(unitName(n))} ${esc(pts?.emoji || '')}`;
const logo = (p) => `<span class="pl plogo" data-logo="${esc(p)}" title="${esc(PLATFORM_NAMES[p] || p)}" aria-hidden="true"></span>`;
const debounce = (fn, ms = 500) => {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};
const sw = (attr, on, label, extra = '') => `<label class="switch"><input type="checkbox" ${attr} ${on ? 'checked' : ''}><span></span> ${label}</label>${extra}`;
const numF = (attr, v, label, { min = 0, max = '', step = 1, after = '' } = {}) =>
  `<label class="hu-f"><span>${label}</span><span class="hu-in"><input type="number" class="num" ${attr} value="${esc(v)}" min="${min}" ${max !== '' ? `max="${max}"` : ''} step="${step}">${after ? `<small>${after}</small>` : ''}</span></label>`;
const cmdF = (attr, v, label) => `<label class="hu-f"><span>${label}</span><span class="hu-cmd"><b>!</b><input ${attr} value="${esc(v)}" maxlength="24" autocomplete="off" spellcheck="false"></span></label>`;

// Dos toques para lo que no se puede deshacer.
function armed(btn) {
  if (btn.dataset.armed === '1') return true;
  btn.dataset.armed = '1';
  const before = btn.innerHTML;
  btn.innerHTML = tr('¿Seguro? Toca otra vez');
  setTimeout(() => { btn.dataset.armed = ''; btn.innerHTML = before; }, 3500);
  return false;
}

// ---------- Guardar ----------
const savePoints = debounce(async () => {
  try {
    const r = await api('POST', '/api/points/settings', pts);
    pts = r.settings;
    summary = r.summary;
    renderSummary();
  } catch (e) { toast(tr('No se guardó: {0}', e.message)); }
});
const saveGames = debounce(async () => {
  try { games = (await api('POST', '/api/games/settings', games)).settings; } catch (e) { toast(tr('No se guardó: {0}', e.message)); }
});
const saveShop = debounce(async (rerender = false) => {
  try {
    const r = await api('POST', '/api/shop/settings', shop);
    shop = r.settings;
    redemptions = r.redemptions;
    sold = r.sold;
    if (rerender) renderShop();
    renderRedeem();
  } catch (e) { toast(tr('No se guardó: {0}', e.message)); }
});

// ================= Pestaña «Huellitas» =================
function renderPoints() {
  const box = $('#hu-points');
  if (!box || !pts) return;
  const E = pts.earn;
  const C = pts.commands;
  box.innerHTML = `<div class="hu-layout">
    <div class="card hu-hero">
      <div class="hu-coin" aria-hidden="true"><span>${esc(pts.emoji || '🐾')}</span></div>
      <div class="hu-hero-b">
        ${sw('data-p="enabled"', pts.enabled, `<b>${tr('Huellitas activadas')}</b>`)}
        <p class="hint">${tr('Apagadas, nadie gana ni gasta, y los juegos y la tienda no responden. Lo que cada quien tiene se guarda.')}</p>
        <div class="hu-name">
          <label class="hu-f"><span>${tr('Emoji')}</span><input class="hu-emoji" data-p="emoji" maxlength="8" value="${esc(pts.emoji)}"></label>
          <label class="hu-f"><span>${tr('Nombre (una)')}</span><input data-p="name" maxlength="24" value="${esc(pts.name)}" placeholder="${esc(tr('huellita'))}"></label>
          <label class="hu-f"><span>${tr('Nombre (varias)')}</span><input data-p="namePlural" maxlength="24" value="${esc(pts.namePlural)}" placeholder="${esc(tr('huellitas'))}"></label>
          ${numF('data-p="start"', pts.start, tr('Al llegar por primera vez'), { max: 1000000 })}
        </div>
      </div>
      <div class="hu-stats" id="hu-stats"></div>
    </div>

    <div class="card hu-earn">
      <h3 class="card-title">${tr('Cómo se ganan')}</h3>
      <div class="hu-rule"><span class="hu-ri">⏱️</span><p>${tr('Por estar en el directo')}<small>${tr('Cuenta quien escribió algo en los últimos minutos que elijas.')}</small></p>
        <div class="hu-rf">${numF('data-p="earn.perInterval"', E.perInterval, tr('Gana'), { max: 100000 })}${numF('data-p="earn.intervalMin"', E.intervalMin, tr('Cada'), { min: 1, max: 120, after: tr('min') })}${numF('data-p="earn.activeMin"', E.activeMin, tr('Si escribió hace menos de'), { min: 1, max: 240, after: tr('min') })}</div></div>
      <div class="hu-rule"><span class="hu-ri">💬</span><p>${tr('Por escribir en el chat')}<small>${tr('Con una espera para que no valga escribir sin parar.')}</small></p>
        <div class="hu-rf">${numF('data-p="earn.perMessage"', E.perMessage, tr('Gana'), { max: 10000 })}${numF('data-p="earn.messageCooldownSec"', E.messageCooldownSec, tr('Como mucho una vez cada'), { max: 3600, after: tr('s') })}</div></div>
      <div class="hu-rule"><span class="hu-ri">♥</span><p>${tr('Por seguirte')}</p><div class="hu-rf">${numF('data-p="earn.follow"', E.follow, tr('Gana'), { max: 1000000 })}</div></div>
      <div class="hu-rule"><span class="hu-ri">✦</span><p>${tr('Por suscribirse')}<small>${tr('Quien regala suscripciones gana esto por cada una.')}</small></p><div class="hu-rf">${numF('data-p="earn.sub"', E.sub, tr('Gana'), { max: 1000000 })}</div></div>
      <div class="hu-rule"><span class="hu-ri">🎁</span><p>${tr('Por regalar')}<small>${tr('Por cada moneda que vale el regalo (TikTok).')}</small></p><div class="hu-rf">${numF('data-p="earn.perCoin"', E.perCoin, tr('Gana'), { max: 1000, step: 0.5, after: tr('por moneda') })}</div></div>
      <div class="hu-rule"><span class="hu-ri">👍</span><p>${tr('Por dar likes')}</p><div class="hu-rf">${numF('data-p="earn.perLikes"', E.perLikes, tr('Gana'), { max: 100000 })}${numF('data-p="earn.likesEvery"', E.likesEvery, tr('Cada'), { min: 1, max: 1000000, after: tr('likes') })}</div></div>
      <div class="hu-rule"><span class="hu-ri">↗</span><p>${tr('Por compartir el directo')}</p><div class="hu-rf">${numF('data-p="earn.share"', E.share, tr('Gana'), { max: 1000000 })}</div></div>
      <div class="hu-rule"><span class="hu-ri">⭐</span><p>${tr('Por volverse superfan')}</p><div class="hu-rf">${numF('data-p="earn.superfan"', E.superfan, tr('Gana'), { max: 1000000 })}</div></div>
      <div class="hu-rule"><span class="hu-ri">×</span><p>${tr('Extra para suscriptores')}<small>${tr('Multiplica lo que ganan por estar y por escribir.')}</small></p><div class="hu-rf">${numF('data-p="earn.subMultiplier"', E.subMultiplier, tr('Multiplicar por'), { min: 1, max: 10, step: 0.1 })}</div></div>
    </div>

    <div class="hu-side">
      <div class="card"><h3 class="card-title">${tr('Dónde cuentan')}</h3>
        <div class="row wrap chips">${PLATS.map((p) => `<label class="chip-check"><input type="checkbox" data-p="platforms.${p}" ${pts.platforms[p] ? 'checked' : ''}><span>${logo(p)} ${esc(PLATFORM_NAMES[p])}</span></label>`).join('')}</div>
        <p class="hint">${tr('Cada plataforma lleva su propia cuenta: quien te ve en TikTok y en Kick tiene dos saldos.')}</p></div>
      <div class="card"><h3 class="card-title">${tr('Comandos')}</h3>
        <div class="hu-cmds">
          ${cmdF('data-p="commands.balance"', C.balance, tr('Ver cuántas tengo'))}
          ${cmdF('data-p="commands.top"', C.top, tr('Los que más tienen'))}
          ${cmdF('data-p="commands.give"', C.give, tr('Regalar a alguien'))}
          ${cmdF('data-p="commands.add"', C.add, tr('Dar (solo tú y tus mods)'))}
          ${cmdF('data-p="commands.remove"', C.remove, tr('Quitar (solo tú y tus mods)'))}
        </div>
        <label class="hu-f"><span>${tr('Otros nombres para ver el saldo')}</span><input data-p-list="aliases.balance" value="${esc(pts.aliases.balance.join(', '))}" placeholder="puntos, points"></label>
        ${sw('data-p="speakReplies"', pts.speakReplies, tr('Leer las respuestas en voz alta'))}
        <p class="hint">${tr('En TikTok y Twitch el bot no puede escribir: con esto la voz dice la respuesta. En Kick y Starvios las escribe el Chat Bot.')}</p></div>
      <div class="card"><h3 class="card-title">${tr('Probar')}</h3>
        <p class="hint">${tr('Escribe como si fueras alguien del chat. Las respuestas salen aquí, no en tu chat.')}</p>
        <form class="hu-try" id="hu-try">
          <input id="hu-try-user" value="${esc(tr('Prueba'))}" maxlength="30" aria-label="${esc(tr('Nombre'))}">
          <input id="hu-try-msg" placeholder="!${esc(C.balance)}" autocomplete="off" aria-label="${esc(tr('Mensaje'))}">
          <button class="btn">${tr('Probar')}</button>
        </form>
        <label class="check"><input type="checkbox" id="hu-try-mod"> ${tr('Como moderador')}</label>
        <ul class="hu-try-out" id="hu-try-out" aria-live="polite"></ul></div>
    </div>

    <div class="card hu-people">
      <div class="row space wrap"><h3 class="card-title">${tr('Tu comunidad')}</h3>
        <span class="row tight"><input type="search" id="hu-search" placeholder="${esc(tr('Buscar a alguien…'))}" value="${esc(search)}"><button type="button" class="btn small ghost danger" id="hu-reset">${tr('Empezar de cero')}</button></span></div>
      <ol class="hu-users" id="hu-users"></ol></div>

    <div class="card hu-log"><h3 class="card-title">${tr('Últimos movimientos')}</h3><ul class="hu-moves" id="hu-moves"></ul></div>
  </div>`;
  renderSummary();
  renderUsers();
  renderLog();
}

function renderSummary() {
  const el = $('#hu-stats');
  if (!el) return;
  el.innerHTML = `<div><b>${nf(summary.people)}</b><small>${tr('personas')}</small></div>
    <div><b>${nf(summary.total)}</b><small>${tr('en total')}</small></div>
    <div><b>${nf(summary.active)}</b><small>${tr('ganando ahora')}</small></div>`;
}

function renderUsers() {
  const el = $('#hu-users');
  if (!el) return;
  if (!users.length) {
    el.innerHTML = `<li class="empty">${search ? tr('Nadie con ese nombre.') : tr('Todavía nadie tiene. Aparecerán aquí en cuanto alguien gane.')}</li>`;
    return;
  }
  const chestName = (id) => shop?.chests.find((c) => c.id === id);
  el.innerHTML = users.map((u, i) => {
    const keys = Object.entries(u.keys || {}).filter(([, n]) => n > 0).map(([id, n]) => `<span class="hu-key" title="${esc(tr('Llaves del cofre {0}', chestName(id)?.name || id))}">🔑${n} ${esc(chestName(id)?.emoji || '')}</span>`).join('');
    return `<li data-key="${esc(u.key)}"><span class="hu-pos">${i + 1}</span>${logo(u.platform)}<b class="hu-uname" translate="no">${esc(u.name)}</b>${keys}
      <input type="number" class="num" data-ubal value="${u.pts}" min="0" aria-label="${esc(tr('Saldo'))}"><small>${esc(pts?.emoji || '')}</small>
      <button type="button" class="btn small ghost danger" data-udel aria-label="${esc(tr('Quitar de la lista'))}">✕</button></li>`;
  }).join('');
}

function renderLog() {
  const el = $('#hu-moves');
  if (!el) return;
  const rows = [
    ...feed.map((f) => ({ ts: f.ts, html: `<span class="hu-mv-ic">${esc(f.emoji || '✨')}</span><span>${esc(f.text)}</span>` })),
    ...logList.filter((l) => l.reason).map((l) => ({ ts: l.ts, html: `<span class="hu-mv-ic ${l.delta < 0 ? 'neg' : ''}">${l.delta > 0 ? '+' : l.delta < 0 ? '−' : '·'}${l.delta ? nf(Math.abs(l.delta)) : ''}</span><span><b translate="no">${esc(l.name || '')}</b> ${esc(l.reason)}</span>` })),
  ].sort((a, b) => b.ts - a.ts).slice(0, 40);
  el.innerHTML = rows.length ? rows.map((r) => `<li>${r.html}<time>${timeOf(r.ts)}</time></li>`).join('') : `<li class="empty">${tr('Aquí verás quién gana, gasta o canjea.')}</li>`;
}

async function loadUsers() {
  try { users = (await api('GET', `/api/points/users?q=${encodeURIComponent(search)}`)).users.slice(0, 100); } catch { users = []; }
  renderUsers();
}
async function loadPoints() {
  const r = await api('GET', '/api/points');
  pts = r.settings;
  summary = r.summary;
  logList = r.log || [];
  await loadUsers();
}

// ================= Pestaña «Juegos del chat» =================
const GAME_INFO = {
  duel: { ic: '⚔️', name: 'Duelo', how: 'Alguien reta a otra persona por una cantidad; si acepta, la moneda decide y el ganador se lleva las dos apuestas.', usage: '!{0} @persona 100' },
  slots: { ic: '🎰', name: 'Tragamonedas', how: 'Tres rodillos. Dos iguales devuelven algo, tres iguales pagan mucho y tres 🐾 es el premio gordo. De cada 100 apostadas, en promedio vuelven unas 94.', usage: '!{0} 50' },
  gamble: { ic: '🎲', name: 'Apuesta', how: 'Doble o nada: si gana, recibe el doble; si pierde, se queda sin lo apostado.', usage: '!{0} 100 · !{0} todo' },
  colors: { ic: '🔴', name: 'Rojo, negro o verde', how: 'Gira una rueda de 15 casillas: 7 rojas, 7 negras y 1 verde. Rojo o negro paga el doble; el verde paga 14 veces.', usage: '!{0} rojo 100' },
  heist: { ic: '🏦', name: 'Atraco en grupo', how: 'Alguien empieza el atraco y los demás se unen durante un rato. Cuantos más se unan, más probable es que salga bien.', usage: '!{0} 200' },
  trivia: { ic: '❓', name: 'Trivia', how: 'Sale una pregunta en el chat; quien responde primero bien se lleva el premio. Tú o tus mods la lanzan, o sale sola cada cierto tiempo.', usage: '!{0}' },
};

function renderGames() {
  const box = $('#hu-games');
  if (!box || !games) return;
  const off = !pts?.enabled ? `<div class="hu-warn">${tr('Las huellitas están apagadas: los juegos no responderán hasta que las enciendas.')} <button type="button" class="btn small" data-hu-tab="puntos">${tr('Ir a Huellitas')}</button></div>` : '';
  box.innerHTML = `${off}<div class="hu-games">${Object.entries(GAME_INFO).map(([k, info]) => gameCard(k, info)).join('')}</div>`;
}

function gameCard(k, info) {
  const g = games[k];
  const f = (key, label, opt) => numF(`data-g="${k}.${key}"`, g[key], label, opt);
  let extra = '';
  if (k !== 'trivia') extra += f('min', tr('Mínimo'), { min: 1, max: 1000000 }) + f('max', tr('Máximo'), { min: 1, max: 10000000 });
  if ('cooldownSec' in g) extra += f('cooldownSec', tr('Espera por persona'), { max: 3600, after: tr('s') });
  if (k === 'duel') extra += cmdF(`data-g="duel.accept"`, g.accept, tr('Para aceptar')) + f('timeoutSec', tr('Tiempo para aceptar'), { min: 10, max: 600, after: tr('s') });
  if (k === 'gamble') extra += f('winChance', tr('Probabilidad de ganar'), { min: 1, max: 95, after: '%' });
  if (k === 'heist') extra += f('joinSec', tr('Tiempo para unirse'), { min: 10, max: 600, after: tr('s') }) + f('baseChance', tr('Probabilidad base'), { min: 1, max: 95, after: '%' }) + f('perPerson', tr('Más por cada persona'), { max: 50, after: '%' }) + f('maxChance', tr('Probabilidad máxima'), { min: 1, max: 95, after: '%' }) + f('payout', tr('Si sale bien, multiplica por'), { min: 1.1, max: 10, step: 0.1 });
  if (k === 'trivia') extra += f('prize', tr('Premio'), { min: 1, max: 1000000 }) + f('answerSec', tr('Tiempo para responder'), { min: 10, max: 180, after: tr('s') }) + f('autoEveryMin', tr('Lanzar sola cada'), { max: 240, after: tr('min (0 = nunca)') });
  const usage = tr(info.usage, g.command);
  const trivia = k === 'trivia' ? `<div class="hu-trivia">
      <div class="row space"><b>${tr('Tus preguntas')}</b><button type="button" class="btn small primary" id="hu-trivia-go">▶ ${tr('Lanzar una ahora')}</button></div>
      <p class="hint">${tr('Una por línea: la pregunta, un signo =, y las respuestas válidas separadas por |. Si no pones ninguna, uso las mías.')}</p>
      <textarea id="hu-trivia-own" rows="4" spellcheck="false" placeholder="${esc(tr('¿Cómo se llama mi perrita? = Samy'))}">${esc(g.own.map((x) => `${x.q} = ${x.a.join(' | ')}`).join('\n'))}</textarea>
      ${gameState.trivia ? `<p class="hu-live">❓ ${esc(gameState.trivia.q || '')}</p>` : ''}</div>` : '';
  return `<article class="card hu-game ${g.enabled ? '' : 'off'}" data-game="${k}">
    <header><span class="hu-gic" aria-hidden="true">${info.ic}</span><div><h3>${tr(info.name)}</h3><code translate="no">${esc(usage)}</code></div>${sw(`data-g="${k}.enabled"`, g.enabled, '')}</header>
    <p class="hint">${tr(info.how)}</p>
    <div class="hu-gf">${cmdF(`data-g="${k}.command"`, g.command, tr('Comando'))}${extra}</div>
    ${trivia}
  </article>`;
}

function parseOwn(text) {
  return String(text || '').split('\n').map((l) => {
    const i = l.indexOf('=');
    if (i < 0) return null;
    return { q: l.slice(0, i).trim(), a: l.slice(i + 1).split('|').map((x) => x.trim()).filter(Boolean) };
  }).filter((x) => x && x.q && x.a.length);
}

// ================= Pestaña «Tienda y cofres» =================
const ITEM_ACTIONS = {
  none: 'Nada automático (lo haces tú)',
  say: '🗣️ Que la voz lea un texto',
  chat: '💬 Que el bot escriba en el chat',
  sound: '🔊 Sonar un sonido',
  wheel: '🎡 Girar una ruleta',
  counter: '🔢 Sumar a un contador',
  time: '⏱️ Sumar tiempo a la cuenta regresiva',
  skip: '⏭️ Saltar la canción que suena',
  key: '🔑 Dar una llave de cofre',
};
const PRIZE_ACTIONS = { points: '🐾 Dar huellitas', ...ITEM_ACTIONS, item: '🛍️ Dar algo de la tienda gratis' };

function actionFields(a, scope) {
  const A = (k) => `data-${scope}-a="${k}"`;
  switch (a.type) {
    case 'say': case 'chat':
      return `<input class="hu-wide" ${A('text')} maxlength="300" value="${esc(a.text || '')}" placeholder="${esc(tr('Puedes usar {usuario}, {texto} y {premio}'))}">`;
    case 'sound':
      return `<button type="button" class="btn small" data-${scope}-sound>🔊 ${esc(soundLabel(a.sound))}</button><label class="hu-mini">${tr('Volumen')} <input type="number" class="num" ${A('volume')} min="0" max="100" value="${a.volume ?? 75}"></label>`;
    case 'wheel':
      return wheels.length ? `<select ${A('wheel')}><option value="">${tr('Elige la ruleta…')}</option>${wheels.map((w) => `<option value="${esc(w.id)}" ${w.id === a.wheel ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>` : `<small class="hint">${tr('Primero crea una ruleta en Ruletas.')}</small>`;
    case 'counter':
      return counters.length ? `<select ${A('counter')}>${counters.map((c) => `<option value="${esc(c.id)}" ${c.id === a.counter ? 'selected' : ''}>${esc(c.icon || '')} ${esc(c.name)}</option>`).join('')}</select><label class="hu-mini">${tr('Cuánto')} <input type="number" class="num" ${A('delta')} value="${a.delta ?? 1}"></label>` : `<small class="hint">${tr('Primero crea un contador en Overlays → Contadores.')}</small>`;
    case 'time':
      return `<label class="hu-mini">${tr('Segundos')} <input type="number" class="num" ${A('seconds')} value="${a.seconds ?? 60}"></label>`;
    case 'key':
      return `<select ${A('chest')}>${shop.chests.map((c) => `<option value="${esc(c.id)}" ${c.id === a.chest ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('')}</select><label class="hu-mini">${tr('Cuántas')} <input type="number" class="num" ${A('amount')} min="1" max="100" value="${a.amount ?? 1}"></label>`;
    case 'points':
      return `<label class="hu-mini">${tr('Cuántas')} <input type="number" class="num" ${A('amount')} value="${a.amount ?? 100}"></label>`;
    case 'item':
      return `<select ${A('item')}>${shop.items.map((it) => `<option value="${esc(it.id)}" ${it.id === a.item ? 'selected' : ''}>${esc(it.emoji)} ${esc(it.name)}</option>`).join('')}</select>`;
    default: return '';
  }
}

function itemRow(it, i) {
  const a = it.action || { type: 'none' };
  const left = it.stock >= 0 ? Math.max(0, it.stock - (sold[it.id] || 0)) : null;
  return `<li class="hu-item ${it.enabled ? '' : 'off'}" data-i="${i}">
    <div class="hu-item-main">
      <span class="hu-num">${i + 1}</span>
      <input class="hu-emoji" data-i-f="emoji" maxlength="8" value="${esc(it.emoji)}" aria-label="${esc(tr('Emoji'))}">
      <input class="hu-iname" data-i-f="name" maxlength="60" value="${esc(it.name)}" placeholder="${esc(tr('Qué se canjea'))}">
      <label class="hu-price"><input type="number" class="num" data-i-f="cost" min="0" value="${it.cost}"><span>${esc(pts?.emoji || '🐾')}</span></label>
      ${sw('data-i-f="enabled"', it.enabled, '')}
      <span class="hu-tools"><button type="button" class="btn small ghost" data-imove="-1" ${i === 0 ? 'disabled' : ''} aria-label="${esc(tr('Subir'))}">▲</button><button type="button" class="btn small ghost" data-imove="1" ${i === shop.items.length - 1 ? 'disabled' : ''} aria-label="${esc(tr('Bajar'))}">▼</button><button type="button" class="btn small ghost danger" data-idel aria-label="${esc(tr('Quitar'))}">✕</button></span>
    </div>
    <div class="hu-item-more">
      <div class="hu-act"><select data-i-a="type">${Object.entries(ITEM_ACTIONS).map(([k, n]) => `<option value="${k}" ${k === a.type ? 'selected' : ''}>${tr(n)}</option>`).join('')}</select>${actionFields(a, 'i')}</div>
      <div class="hu-opts">
        <label class="chip-check" title="${esc(tr('Queda en Canjes hasta que lo marques como hecho o devuelvas las huellitas'))}"><input type="checkbox" data-i-f="approve" ${it.approve ? 'checked' : ''}><span>✋ ${tr('Lo reviso yo')}</span></label>
        <label class="chip-check" title="${esc(tr('Quien canjea escribe algo después, como el nombre de la canción'))}"><input type="checkbox" data-i-f="askText" ${it.askText ? 'checked' : ''}><span>✍️ ${tr('Pide un texto')}</span></label>
        <label class="hu-mini" title="${esc(tr('Cuántas hay por directo (−1 = sin límite)'))}">${tr('Existencias')} <input type="number" class="num" data-i-f="stock" min="-1" value="${it.stock}">${left != null ? `<small>${tr('quedan {0}', left)}</small>` : ''}</label>
        <label class="hu-mini" title="${esc(tr('Cuántas veces por persona en cada directo (0 = sin límite)'))}">${tr('Por persona')} <input type="number" class="num" data-i-f="perUser" min="0" value="${it.perUser}"></label>
        <label class="hu-mini">${tr('Espera')} <input type="number" class="num" data-i-f="cooldownSec" min="0" value="${it.cooldownSec}"> ${tr('s')}</label>
        ${it.stock >= 0 && sold[it.id] ? `<button type="button" class="btn small ghost" data-irestock>↺ ${tr('Reponer')}</button>` : ''}
      </div>
    </div></li>`;
}

function chestCard(c, ci) {
  const total = c.prizes.reduce((s, p) => s + (Number(p.weight) || 0), 0) || 1;
  return `<article class="card hu-chest ${c.enabled ? '' : 'off'}" data-c="${ci}" style="--cc:${esc(c.color)}">
    <header>
      <span class="hu-chest-ic" aria-hidden="true">${esc(c.emoji)}</span>
      <input class="hu-emoji" data-c-f="emoji" maxlength="8" value="${esc(c.emoji)}" aria-label="${esc(tr('Emoji'))}">
      <input class="hu-iname" data-c-f="name" maxlength="40" value="${esc(c.name)}" aria-label="${esc(tr('Nombre del cofre'))}">
      <input type="color" data-c-f="color" value="${esc(c.color)}" title="${esc(tr('Color'))}">
      ${sw('data-c-f="enabled"', c.enabled, '')}
      <button type="button" class="btn small ghost danger" data-cdel aria-label="${esc(tr('Quitar cofre'))}">✕</button>
    </header>
    <p class="hint">${tr('Se abre con una llave escribiendo !{0} {1}. Las llaves se canjean en la tienda o salen de otro cofre.', shop.commands.open, c.name)}</p>
    <ol class="hu-prizes">${c.prizes.map((p, pi) => {
      const a = p.action || { type: 'none' };
      const pc = Math.round(((Number(p.weight) || 0) / total) * 1000) / 10;
      return `<li data-pz="${pi}" class="${pc < 10 ? 'rare' : ''}">
        <div class="hu-pz-main"><input class="hu-emoji" data-pz-f="emoji" maxlength="8" value="${esc(p.emoji)}" aria-label="${esc(tr('Emoji'))}"><input class="hu-iname" data-pz-f="label" maxlength="60" value="${esc(p.label)}">
          <label class="hu-mini" title="${esc(tr('Más peso = más probable'))}">${tr('Peso')} <input type="number" class="num" data-pz-f="weight" min="0" max="1000" value="${p.weight}"><small>${pc}%</small></label>
          <button type="button" class="btn small ghost danger" data-pzdel aria-label="${esc(tr('Quitar premio'))}">✕</button></div>
        <div class="hu-act"><select data-pz-a="type">${Object.entries(PRIZE_ACTIONS).map(([k, n]) => `<option value="${k}" ${k === a.type ? 'selected' : ''}>${tr(n)}</option>`).join('')}</select>${actionFields(a, 'pz')}</div></li>`;
    }).join('')}</ol>
    <button type="button" class="btn small" data-pzadd>＋ ${tr('Premio')}</button>
  </article>`;
}

function renderShop() {
  const box = $('#hu-shop');
  if (!box || !shop) return;
  const C = shop.commands;
  const off = !pts?.enabled ? `<div class="hu-warn">${tr('Las huellitas están apagadas: la tienda no responderá hasta que las enciendas.')} <button type="button" class="btn small" data-hu-tab="puntos">${tr('Ir a Huellitas')}</button></div>` : '';
  box.innerHTML = `${off}<div class="card hu-shop-top">
      ${sw('data-s="enabled"', shop.enabled, `<b>${tr('Tienda abierta')}</b>`)}
      <div class="hu-cmds">${cmdF('data-s="commands.list"', C.list, tr('Ver la tienda'))}${cmdF('data-s="commands.buy"', C.buy, tr('Canjear'))}${cmdF('data-s="commands.keys"', C.keys, tr('Ver mis llaves'))}${cmdF('data-s="commands.open"', C.open, tr('Abrir un cofre'))}${cmdF('data-s="commands.chest"', C.chest, tr('Qué trae un cofre'))}</div>
      <p class="hint">${tr('En el chat se canjea por número o por nombre: !{0} 2 o !{0} saludo.', C.buy)} ${tr('Al empezar cada directo se reponen las existencias y los límites por persona.')}</p>
    </div>
    <div class="card"><div class="row space"><h3 class="card-title">${tr('Lo que se puede canjear')} <small>${shop.items.length}/60</small></h3><button type="button" class="btn small primary" id="hu-iadd">＋ ${tr('Algo para canjear')}</button></div>
      <ol class="hu-items">${shop.items.map(itemRow).join('') || `<li class="empty">${tr('Tu tienda está vacía.')}</li>`}</ol></div>
    <div class="row space hu-chests-h"><h3 class="card-title">🧰 ${tr('Cofres')}</h3><button type="button" class="btn small primary" id="hu-cadd">＋ ${tr('Cofre')}</button></div>
    <div class="hu-chests">${shop.chests.map(chestCard).join('') || `<p class="hint">${tr('Sin cofres. Un cofre da un premio al azar a quien lo abre con una llave.')}</p>`}</div>`;
}

// ================= Pestaña «Canjes» =================
function renderRedeem() {
  const pend = redemptions.filter((r) => r.status === 'pending');
  for (const id of ['#nav-redeem', '#tab-redeem']) {
    const b = $(id);
    if (b) { b.hidden = !pend.length; b.textContent = pend.length; }
  }
  const box = $('#hu-redeem');
  if (!box) return;
  const row = (r, actions) => `<li class="hu-rd ${r.status}" data-rid="${esc(r.id)}">
    <span class="hu-rd-ic" aria-hidden="true">${esc(r.emoji || '🛍️')}</span>
    <div><b>${esc(r.item)}</b><small>${logo(r.platform)} <span translate="no">${esc(r.user?.name || '')}</span> · ${timeOf(r.ts)}${r.cost ? ` · ${nf(r.cost)} ${esc(pts?.emoji || '')}` : ''}</small>${r.text ? `<q translate="no">${esc(r.text)}</q>` : ''}</div>
    ${actions}</li>`;
  const hist = redemptions.filter((r) => r.status !== 'pending').slice(0, 60);
  const ST = { done: tr('Hecho'), refunded: tr('Devuelto') };
  box.innerHTML = `<div class="cols c2">
    <div class="card"><h3 class="card-title">✋ ${tr('Por cumplir')} <small>${pend.length}</small></h3>
      <p class="hint">${tr('Lo que marcaste como «Lo reviso yo». Cúmplelo y márcalo hecho, o devuelve lo que costó.')}</p>
      <ul class="hu-rds">${pend.map((r) => row(r, `<span class="row tight"><button type="button" class="btn small primary" data-rdone>✓ ${tr('Hecho')}</button><button type="button" class="btn small ghost" data-rrefund>↩ ${tr('Devolver')}</button></span>`)).join('') || `<li class="empty">${tr('Nada pendiente.')}</li>`}</ul></div>
    <div class="card"><h3 class="card-title">${tr('Historial')}</h3>
      <ul class="hu-rds">${hist.map((r) => row(r, `<span class="hu-st">${ST[r.status] || ''}</span>`)).join('') || `<li class="empty">${tr('Todavía nadie ha canjeado nada.')}</li>`}</ul></div>
  </div>`;
}

async function loadShop() {
  const r = await api('GET', '/api/shop');
  shop = r.settings;
  redemptions = r.redemptions;
  sold = r.sold;
}

// ---------- Eventos ----------
function onInput(ev) {
  const el = ev.target;
  const rerender = ev.type === 'change' && el.tagName === 'SELECT';
  if (el.dataset.p) {
    setPath(pts, el.dataset.p, valueOf(el));
    if (el.dataset.p === 'emoji' || el.dataset.p.startsWith('name')) $('.hu-coin span').textContent = pts.emoji || '🐾';
    return savePoints();
  }
  if (el.dataset.pList) {
    setPath(pts, el.dataset.pList, el.value.split(',').map((x) => x.trim()).filter(Boolean));
    return savePoints();
  }
  if (el.dataset.g) {
    setPath(games, el.dataset.g, valueOf(el));
    if (el.dataset.g.endsWith('.enabled')) el.closest('.hu-game')?.classList.toggle('off', !el.checked);
    return saveGames();
  }
  if (el.id === 'hu-trivia-own') {
    games.trivia.own = parseOwn(el.value);
    return saveGames();
  }
  if (el.dataset.s) {
    setPath(shop, el.dataset.s, valueOf(el));
    return saveShop();
  }
  const li = el.closest('[data-i]');
  if (li && el.dataset.iF) {
    const it = shop.items[Number(li.dataset.i)];
    it[el.dataset.iF] = valueOf(el);
    if (el.dataset.iF === 'enabled') li.classList.toggle('off', !el.checked);
    return saveShop(el.dataset.iF === 'stock' && ev.type === 'change');
  }
  if (li && el.dataset.iA) {
    const it = shop.items[Number(li.dataset.i)];
    it.action = el.dataset.iA === 'type' ? { type: el.value } : { ...it.action, [el.dataset.iA]: valueOf(el) };
    if (rerender && el.dataset.iA === 'type') renderShop();
    return saveShop();
  }
  const card = el.closest('[data-c]');
  if (card) {
    const c = shop.chests[Number(card.dataset.c)];
    if (el.dataset.cF) {
      c[el.dataset.cF] = valueOf(el);
      if (el.dataset.cF === 'color') card.style.setProperty('--cc', el.value);
      if (el.dataset.cF === 'emoji') $('.hu-chest-ic', card).textContent = el.value;
      if (el.dataset.cF === 'enabled') card.classList.toggle('off', !el.checked);
      return saveShop();
    }
    const pz = el.closest('[data-pz]');
    if (pz) {
      const p = c.prizes[Number(pz.dataset.pz)];
      if (el.dataset.pzF) {
        p[el.dataset.pzF] = valueOf(el);
        if (el.dataset.pzF === 'weight' && ev.type === 'change') renderShop();
        return saveShop();
      }
      if (el.dataset.pzA) {
        p.action = el.dataset.pzA === 'type' ? { type: el.value } : { ...p.action, [el.dataset.pzA]: valueOf(el) };
        if (rerender && el.dataset.pzA === 'type') renderShop();
        return saveShop();
      }
    }
  }
  return undefined;
}

async function onClick(ev) {
  const t = ev.target.closest('button, [data-hu-tab]');
  if (!t) return;
  if (t.dataset.huTab) return document.querySelector(`[data-tabs="huellitas"] [data-tab="${t.dataset.huTab}"]`)?.click();
  const li = t.closest('[data-i]');
  if (t.id === 'hu-iadd') {
    shop.items.push({ id: uid('i'), name: tr('Algo nuevo'), emoji: '🎁', cost: 100, stock: -1, perUser: 0, cooldownSec: 0, approve: true, askText: false, enabled: true, action: { type: 'none' } });
    renderShop();
    return saveShop();
  }
  if (t.id === 'hu-cadd') {
    shop.chests.push({ id: uid('c'), name: tr('Cofre {0}', shop.chests.length + 1), emoji: '🎁', color: '#5ab0ff', enabled: true, prizes: [{ id: uid('p'), label: tr('{0} huellitas', 100), emoji: '🐾', weight: 10, action: { type: 'points', amount: 100 } }] });
    renderShop();
    return saveShop();
  }
  if (li && t.dataset.idel !== undefined) {
    if (!armed(t)) return;
    shop.items.splice(Number(li.dataset.i), 1);
    renderShop();
    return saveShop();
  }
  if (li && t.dataset.imove) {
    const i = Number(li.dataset.i);
    const j = i + Number(t.dataset.imove);
    [shop.items[i], shop.items[j]] = [shop.items[j], shop.items[i]];
    renderShop();
    return saveShop();
  }
  if (li && t.dataset.irestock !== undefined) {
    const r = await api('POST', `/api/shop/restock/${encodeURIComponent(shop.items[Number(li.dataset.i)].id)}`);
    sold = r.sold;
    return renderShop();
  }
  if (li && t.dataset.iSound !== undefined) {
    const it = shop.items[Number(li.dataset.i)];
    return openSoundPicker(it.action.sound, (ref) => { it.action.sound = ref; playAlertSound({ sound: ref, volume: it.action.volume ?? 75, maxSeconds: 6 }); renderShop(); saveShop(); });
  }
  const card = t.closest('[data-c]');
  if (card) {
    const c = shop.chests[Number(card.dataset.c)];
    const pz = t.closest('[data-pz]');
    if (t.dataset.cdel !== undefined) {
      if (!armed(t)) return;
      shop.chests.splice(Number(card.dataset.c), 1);
      renderShop();
      return saveShop();
    }
    if (t.dataset.pzadd !== undefined) {
      c.prizes.push({ id: uid('p'), label: tr('Premio nuevo'), emoji: '✨', weight: 10, action: { type: 'points', amount: 50 } });
      renderShop();
      return saveShop();
    }
    if (pz && t.dataset.pzdel !== undefined) {
      c.prizes.splice(Number(pz.dataset.pz), 1);
      renderShop();
      return saveShop();
    }
    if (pz && t.dataset.pzSound !== undefined) {
      const p = c.prizes[Number(pz.dataset.pz)];
      return openSoundPicker(p.action.sound, (ref) => { p.action.sound = ref; playAlertSound({ sound: ref, volume: p.action.volume ?? 75, maxSeconds: 6 }); renderShop(); saveShop(); });
    }
  }
  const u = t.closest('[data-key]');
  if (u && t.dataset.udel !== undefined) {
    if (!armed(t)) return;
    await api('DELETE', `/api/points/users/${encodeURIComponent(u.dataset.key)}`);
    return loadUsers();
  }
  if (t.id === 'hu-reset') {
    if (!armed(t)) return;
    const r = await api('POST', '/api/points/reset', { confirm: true });
    summary = r.summary;
    renderSummary();
    sayFor('juana', tr('Listo: todo el mundo vuelve a empezar con {0}.', `${nf(pts.start)} ${unitName(pts.start)}`), 7000, 'ok');
    return loadUsers();
  }
  if (t.id === 'hu-trivia-go') {
    try {
      const r = await api('POST', '/api/games/trivia');
      gameState = r.state;
      renderGames();
    } catch (e) { toast(e.message); }
    return undefined;
  }
  const rd = t.closest('[data-rid]');
  if (rd && (t.dataset.rdone !== undefined || t.dataset.rrefund !== undefined)) {
    try {
      const r = await api('POST', `/api/shop/redemptions/${encodeURIComponent(rd.dataset.rid)}`, { status: t.dataset.rrefund !== undefined ? 'refunded' : 'done' });
      redemptions = r.redemptions;
      sold = r.sold;
      renderRedeem();
    } catch (e) { toast(e.message); }
  }
  return undefined;
}

async function onTry(ev) {
  ev.preventDefault();
  const msg = $('#hu-try-msg').value.trim();
  if (!msg) return;
  const out = $('#hu-try-out');
  try {
    const r = await api('POST', '/api/points/try', { user: $('#hu-try-user').value, message: msg, mod: $('#hu-try-mod').checked });
    const lines = r.hit ? (r.replies.length ? r.replies : [tr('(sin respuesta: es solo para tus mods o está en espera)')]) : [tr('Eso no es un comando de huellitas, juegos ni tienda.')];
    out.insertAdjacentHTML('afterbegin', `<li><code translate="no">${esc(msg)}</code>${lines.map((l) => `<span translate="no">${esc(l)}</span>`).join('')}</li>`);
    while (out.children.length > 6) out.lastElementChild.remove();
    $('#hu-try-msg').value = '';
  } catch (e) { toast(e.message); }
}

// Los cambios de huellitas llegan en ráfagas: se recargan como mucho cada 2 s.
const refreshSoon = debounce(async () => {
  if ($('#page-huellitas')?.hidden) return;
  try {
    const r = await api('GET', '/api/points');
    summary = r.summary;
    logList = r.log || [];
    renderSummary();
    renderLog();
    if (!document.activeElement?.matches?.('#hu-users input')) await loadUsers();
  } catch { /* sin conexión: ya se actualizará */ }
}, 2000);

export function onPointsChanged() { refreshSoon(); }
export function onPointsFeed(p) {
  feed.unshift(p);
  feed.length = Math.min(feed.length, 30);
  renderLog();
}
export function onRedemption(r) {
  const i = redemptions.findIndex((x) => x.id === r.id);
  if (i >= 0) redemptions[i] = r; else redemptions.unshift(r);
  if (r.status === 'pending' && i < 0) sayFor('juana', tr('{0} canjeó «{1}». Está en Canjes.', esc(r.user?.name || ''), esc(r.item)), 8000, 'ok');
  renderRedeem();
}

export async function initHuellitas() {
  const page = $('#page-huellitas');
  if (!page) return;
  page.addEventListener('input', (ev) => { if (!ev.target.matches('[data-ubal], #hu-search, #hu-try-user, #hu-try-msg')) onInput(ev); });
  page.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.matches('[data-ubal]')) {
      api('POST', `/api/points/users/${encodeURIComponent(el.closest('[data-key]').dataset.key)}`, { points: Number(el.value) })
        .then((r) => { summary = r.summary; renderSummary(); })
        .catch((e) => toast(e.message));
      return;
    }
    if (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'number') onInput(ev);
  });
  const searchSoon = debounce(() => loadUsers(), 300);
  page.addEventListener('input', (ev) => { if (ev.target.id === 'hu-search') { search = ev.target.value; searchSoon(); } });
  page.addEventListener('click', (ev) => { onClick(ev).catch((e) => toast(e.message)); });
  page.addEventListener('submit', (ev) => { if (ev.target.id === 'hu-try') onTry(ev); });
  try {
    const [, g, , w, l] = await Promise.all([
      loadPoints(),
      api('GET', '/api/games'),
      loadShop(),
      api('GET', '/api/wheels').catch(() => ({ wheels: [] })),
      api('GET', '/api/live').catch(() => ({ live: {} })),
    ]);
    games = g.settings;
    gameState = g.state || {};
    wheels = w.wheels || [];
    counters = l.live?.counters || [];
  } catch (e) {
    toast(tr('No se cargaron las huellitas: {0}', e.message));
    return;
  }
  renderPoints();
  renderGames();
  renderShop();
  renderRedeem();
}

// Al entrar a la pantalla se refresca lo que pudo cambiar en otras (ruletas, contadores).
export async function onHuellitasPage() {
  try {
    const [w, l, g] = await Promise.all([api('GET', '/api/wheels'), api('GET', '/api/live'), api('GET', '/api/games')]);
    wheels = w.wheels || [];
    counters = l.live?.counters || [];
    gameState = g.state || {};
  } catch { /* se queda lo que había */ }
  refreshSoon();
}

export const _test = { parseOwn, unitName: (n) => unitName(n) };
