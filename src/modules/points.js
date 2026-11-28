'use strict';
// Huellitas 🐾: los puntos del canal.
//
// Tu público las gana por estar en el directo y participar (mensajes,
// seguir, suscribirse, regalos, compartir…) y las gasta en los juegos del
// chat y en la tienda. El nombre y el emoji los eliges tú.
//
// Cada persona se guarda por plataforma («kick:ana»): sus huellitas, cuánto
// ha ganado y gastado, sus llaves de cofres y cuándo la vimos por última vez.
// Los datos viven en huellitas.json (fuera de la configuración, porque
// crecen con tu comunidad) y se guardan solos unos segundos después de cada
// cambio.
//
// Comandos (los nombres se cambian en el panel):
//   !huellitas            cuántas tienes (también !huellitas @otra)
//   !top                  las 5 personas con más
//   !regalar @ana 50      le pasas de las tuyas a otra persona
//   !dar @ana 50          (moderadores) le das huellitas
//   !quitar @ana 50       (moderadores) se las quitas

const fs = require('fs');
const { renameWithRetry } = require('../store');
const path = require('path');
const { t: tr, getLocale } = require('../i18n');

const PLATFORMS = ['tiktok', 'kick', 'twitch', 'starvios'];
const MAX_LOG = 300;

const names = require('./cmdNames');
const DEFAULTS = {
  enabled: false,
  name: '', // vacío = «huellita/huellitas» en el idioma de la app
  namePlural: '',
  emoji: '🐾',
  start: 0, // con cuántas empieza alguien nuevo
  platforms: { tiktok: true, kick: true, twitch: true, starvios: true },
  earn: {
    intervalMin: 5, // cada cuántos minutos se reparte por estar
    perInterval: 10, // cuántas por estar (si escribió hace poco)
    activeMin: 15, // «estar» = escribió o llegó en los últimos N minutos
    perMessage: 1,
    messageCooldownSec: 30,
    follow: 50,
    sub: 300,
    share: 25,
    superfan: 200,
    perCoin: 2, // por cada moneda de regalo
    likesEvery: 100, // cada N likes de una persona…
    perLikes: 5, // …gana esto
    subMultiplier: 1.5, // los suscriptores ganan más por estar y por escribir
  },
  commands: { balance: 'huellitas', top: 'top', give: 'regalar', add: 'dar', remove: 'quitar' },
  aliases: { balance: ['puntos', 'points'] },
  speakReplies: false, // en TikTok y Twitch el bot no puede escribir: leer la respuesta en voz alta
};

const clampInt = (n, min, max, def) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
};
const cleanName = (s) => String(s || '').trim().toLowerCase().replace(/^!+/, '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 24);

function settingsOf(raw = {}) {
  const r = raw || {};
  const e = r.earn || {};
  const d = DEFAULTS.earn;
  const cmd = r.commands || {};
  const out = {
    enabled: Boolean(r.enabled),
    name: String(r.name || '').trim().slice(0, 24),
    namePlural: String(r.namePlural || '').trim().slice(0, 24),
    emoji: String(r.emoji ?? DEFAULTS.emoji).trim().slice(0, 8),
    start: clampInt(r.start, 0, 1e6, 0),
    platforms: Object.fromEntries(PLATFORMS.map((p) => [p, r.platforms?.[p] !== false])),
    earn: {
      intervalMin: clampInt(e.intervalMin, 1, 120, d.intervalMin),
      perInterval: clampInt(e.perInterval, 0, 1e5, d.perInterval),
      activeMin: clampInt(e.activeMin, 1, 240, d.activeMin),
      perMessage: clampInt(e.perMessage, 0, 1e4, d.perMessage),
      messageCooldownSec: clampInt(e.messageCooldownSec, 0, 3600, d.messageCooldownSec),
      follow: clampInt(e.follow, 0, 1e6, d.follow),
      sub: clampInt(e.sub, 0, 1e6, d.sub),
      share: clampInt(e.share, 0, 1e6, d.share),
      superfan: clampInt(e.superfan, 0, 1e6, d.superfan),
      perCoin: Math.max(0, Math.min(1000, Number(e.perCoin ?? d.perCoin) || 0)),
      likesEvery: clampInt(e.likesEvery, 1, 1e6, d.likesEvery),
      perLikes: clampInt(e.perLikes, 0, 1e5, d.perLikes),
      subMultiplier: Math.max(1, Math.min(10, Number(e.subMultiplier ?? d.subMultiplier) || 1)),
    },
    commands: {},
    aliases: { balance: (Array.isArray(r.aliases?.balance) ? r.aliases.balance : names.aliases()).map(cleanName).filter(Boolean).slice(0, 5) },
    speakReplies: Boolean(r.speakReplies),
  };
  for (const k of Object.keys(DEFAULTS.commands)) out.commands[k] = cleanName(cmd[k]) || names.cmd(k);
  return out;
}

// «100», «1k», «2,5k», «todo/all/tudo/tout/tutto», «50%».
function parseAmount(raw, balance) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return NaN;
  if (['todo', 'todas', 'all', 'tudo', 'tout', 'tutto', 'max'].includes(s)) return balance;
  const pct = s.match(/^(\d{1,3})%$/);
  if (pct) return Math.floor((balance * Math.min(100, Number(pct[1]))) / 100);
  const m = s.replace(',', '.').match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return NaN;
  const n = Number(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1);
  return Math.floor(n);
}

function createPoints({ store, dataDir, broadcast = () => {}, reply = () => {}, isMod = () => false, now = Date.now, timers = { setInterval, clearInterval, setTimeout, clearTimeout } }) {
  const file = path.join(dataDir, 'huellitas.json');
  let data = { users: {}, log: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (raw && typeof raw === 'object') data = { users: raw.users || {}, log: Array.isArray(raw.log) ? raw.log : [] };
  } catch {
    /* primera vez: sin datos */
  }

  let saveTimer = null;
  function saveSoon() {
    if (saveTimer) return;
    saveTimer = timers.setTimeout(() => { saveTimer = null; saveNow(); }, 3000);
  }
  function saveNow() {
    try {
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
      renameWithRetry(`${file}.tmp`, file);
    } catch (err) {
      console.error(`No se pudieron guardar las huellitas: ${err?.code || err?.message || err}`);
      saveSoon(); // se reintenta en unos segundos
    }
  }

  const cfg = () => settingsOf(store.get('points'));
  const keyOf = (platform, user) => `${platform}:${String(user?.id || user?.name || '').toLowerCase()}`;

  // Nombre de la moneda: el que pusiste o «huellita/huellitas» en tu idioma.
  function unit(n) {
    const c = cfg();
    const one = c.name || tr('huellita');
    const many = c.namePlural || c.name || tr('huellitas');
    return Math.abs(n) === 1 ? one : many;
  }
  const fmt = (n) => `${Number(n).toLocaleString(getLocale())} ${unit(n)}${cfg().emoji ? ` ${cfg().emoji}` : ''}`;

  function userOf(platform, user, { create = true } = {}) {
    const key = keyOf(platform, user);
    if (!key.split(':')[1]) return null;
    let u = data.users[key];
    if (!u && create) {
      u = data.users[key] = { name: user?.name || user?.id || '', platform, pts: cfg().start, earned: 0, spent: 0, keys: {}, first: now(), seen: now() };
    }
    if (u) {
      if (user?.name) u.name = user.name;
      if (user?.avatar) u.avatar = user.avatar;
    }
    return u ? { key, u } : null;
  }

  function log(entry) {
    data.log.unshift({ ts: now(), ...entry });
    if (data.log.length > MAX_LOG) data.log.length = MAX_LOG;
  }

  let changedTimer = null;
  function changed() {
    saveSoon();
    if (changedTimer) return;
    changedTimer = timers.setTimeout(() => { changedTimer = null; broadcast('points-changed', {}); }, 800);
  }

  // Suma (o resta, con delta negativo) a una persona. Nunca baja de 0.
  function adjust(platform, user, delta, reason = '', { earned = true } = {}) {
    const r = userOf(platform, user);
    if (!r) return 0;
    const d = Math.round(Number(delta) || 0);
    const before = r.u.pts;
    r.u.pts = Math.max(0, r.u.pts + d);
    const real = r.u.pts - before;
    if (real > 0 && earned) r.u.earned += real;
    if (real < 0) r.u.spent += -real;
    r.u.seen = now();
    if (real && reason) log({ key: r.key, name: r.u.name, platform, delta: real, reason });
    if (real) changed();
    return real;
  }

  function balance(platform, user) {
    return userOf(platform, user, { create: false })?.u.pts ?? 0;
  }

  // Cobra si alcanza. Devuelve true si pudo.
  function spend(platform, user, amount, reason = '') {
    const n = Math.round(Number(amount) || 0);
    if (n <= 0) return true;
    if (balance(platform, user) < n) return false;
    adjust(platform, user, -n, reason);
    return true;
  }

  // ---------- Llaves de cofres (las guarda cada persona) ----------
  function keysOf(platform, user) {
    return { ...(userOf(platform, user, { create: false })?.u.keys || {}) };
  }
  function addKey(platform, user, chestId, n = 1) {
    const r = userOf(platform, user);
    if (!r) return 0;
    r.u.keys ||= {};
    r.u.keys[chestId] = Math.max(0, (r.u.keys[chestId] || 0) + n);
    if (!r.u.keys[chestId]) delete r.u.keys[chestId];
    changed();
    return r.u.keys[chestId] || 0;
  }

  // ---------- Ganar ----------
  const lastActive = new Map(); // key -> { ts, platform, user, sub }
  const lastMessagePay = new Map();
  const likeCount = new Map();

  const isSub = (e) => {
    const r = e.extra?.roles || {};
    return Boolean(r.sub) || (e.extra?.badges || []).some((b) => /subscriber|founder|vip/.test(String(b)));
  };

  function earnFrom(e) {
    const c = cfg();
    if (!c.enabled || !c.platforms[e.platform] || !e.user || e.test) return;
    const key = keyOf(e.platform, e.user);
    if (!key.split(':')[1]) return;
    const sub = isSub(e);
    if (e.type === 'chat' || e.type === 'join') lastActive.set(key, { ts: now(), platform: e.platform, user: { id: e.user.id, name: e.user.name, avatar: e.user.avatar }, sub });
    const mult = sub ? c.earn.subMultiplier : 1;
    switch (e.type) {
      case 'chat': {
        if (!c.earn.perMessage) break;
        if (now() - (lastMessagePay.get(key) || 0) < c.earn.messageCooldownSec * 1000) break;
        lastMessagePay.set(key, now());
        adjust(e.platform, e.user, Math.round(c.earn.perMessage * mult), '', {});
        break;
      }
      case 'follow': adjust(e.platform, e.user, c.earn.follow, tr('te siguió')); break;
      case 'sub': {
        const n = Math.max(1, Number(e.amount) || 1);
        // Suscripciones regaladas: premio por cada una para quien las regala.
        adjust(e.platform, e.user, c.earn.sub * (e.extra?.gifted ? n : 1), e.extra?.gifted ? tr('regaló suscripciones') : tr('se suscribió'));
        break;
      }
      case 'share': adjust(e.platform, e.user, c.earn.share, tr('compartió el directo')); break;
      case 'superfan': adjust(e.platform, e.user, c.earn.superfan, tr('se volvió superfan')); break;
      case 'gift': {
        const coins = Number(e.amount) || 0;
        if (coins > 0 && c.earn.perCoin > 0) adjust(e.platform, e.user, Math.round(coins * c.earn.perCoin), tr('regaló {0}', e.extra?.giftName || ''));
        break;
      }
      case 'like': {
        if (!c.earn.perLikes) break;
        const total = (likeCount.get(key) || 0) + (Number(e.amount) || 0);
        const times = Math.floor(total / c.earn.likesEvery);
        likeCount.set(key, total - times * c.earn.likesEvery);
        if (times > 0) adjust(e.platform, e.user, times * c.earn.perLikes, '', {});
        break;
      }
      default:
    }
  }

  // Cada minuto revisa si toca repartir «por estar».
  let lastPayout = now();
  function tick() {
    const c = cfg();
    if (!c.enabled) { lastPayout = now(); return 0; }
    if (now() - lastPayout < c.earn.intervalMin * 60000) return 0;
    lastPayout = now();
    let paid = 0;
    for (const [key, a] of lastActive) {
      if (now() - a.ts > c.earn.activeMin * 60000) { lastActive.delete(key); continue; }
      if (!c.platforms[a.platform]) continue;
      adjust(a.platform, a.user, Math.round(c.earn.perInterval * (a.sub ? c.earn.subMultiplier : 1)), '', {});
      paid += 1;
    }
    if (paid) broadcast('points-feed', { text: tr('{0} personas ganaron {1} por estar en el directo.', paid, fmt(c.earn.perInterval)), kind: 'payout', ts: now(), emoji: c.emoji || '🐾' });
    return paid;
  }
  const tickTimer = timers.setInterval(tick, 60000);
  tickTimer?.unref?.();

  // ---------- Buscar a alguien por @nombre ----------
  function findUser(platform, raw) {
    const name = String(raw || '').trim().replace(/^@/, '').toLowerCase();
    if (!name) return null;
    const direct = data.users[`${platform}:${name}`];
    if (direct) return { platform, user: { id: name, name: direct.name } };
    for (const [key, u] of Object.entries(data.users)) {
      if (u.platform === platform && (String(u.name).toLowerCase() === name || key.split(':')[1] === name)) return { platform, user: { id: key.split(':')[1], name: u.name } };
    }
    return null;
  }

  function top(n = 5, platform = '') {
    return Object.entries(data.users)
      .filter(([, u]) => !platform || u.platform === platform)
      .sort((a, b) => b[1].pts - a[1].pts)
      .slice(0, n)
      .map(([key, u]) => ({ key, ...u }));
  }

  // ---------- Comandos ----------
  function parse(message) {
    const m = String(message || '').trim().match(/^!(\S+)\s*(.*)$/);
    if (!m) return null;
    return { cmd: m[1].toLowerCase(), args: m[2].split(/\s+/).filter(Boolean) };
  }

  function commandNames() {
    const c = cfg();
    return [...Object.values(c.commands), ...c.aliases.balance];
  }

  // Devuelve true si el mensaje era un comando de huellitas (y ya respondió).
  function handleCommand(e) {
    const c = cfg();
    if (!c.enabled || e.type !== 'chat' || !c.platforms[e.platform]) return false;
    const p = parse(e.message);
    if (!p) return false;
    const C = c.commands;
    const who = e.user?.name || '';

    if (p.cmd === C.balance || c.aliases.balance.includes(p.cmd)) {
      if (p.args[0]) {
        const other = findUser(e.platform, p.args[0]);
        reply(e, other ? tr('{0} tiene {1}.', other.user.name, fmt(balance(other.platform, other.user))) : tr('{0}: no encontré a {1}.', who, p.args[0]));
      } else {
        userOf(e.platform, e.user);
        reply(e, tr('{0}, tienes {1}.', who, fmt(balance(e.platform, e.user))));
      }
      return true;
    }

    if (p.cmd === C.top) {
      const list = top(5, e.platform);
      reply(e, list.length ? `🏆 ${list.map((u, i) => `${i + 1}. ${u.name} (${Number(u.pts).toLocaleString(getLocale())})`).join(' · ')}` : tr('Todavía nadie tiene {0}.', unit(2)));
      return true;
    }

    if (p.cmd === C.give) {
      const other = findUser(e.platform, p.args[0]);
      if (!other) { reply(e, p.args[0] ? tr('{0}: no encontré a {1} en el chat.', who, p.args[0].replace(/^@/, '')) : tr('{0}: escribe !{1} @persona cantidad', who, C.give)); return true; }
      if (keyOf(other.platform, other.user) === keyOf(e.platform, e.user)) { reply(e, tr('{0}: no te puedes regalar a ti.', who)); return true; }
      const n = parseAmount(p.args[1], balance(e.platform, e.user));
      if (!(n > 0)) { reply(e, tr('{0}: escribe !{1} @persona cantidad', who, C.give)); return true; }
      if (!spend(e.platform, e.user, n, tr('regaló a {0}', other.user.name))) { reply(e, tr('{0}: no te alcanza (tienes {1}).', who, fmt(balance(e.platform, e.user)))); return true; }
      adjust(other.platform, other.user, n, tr('regalo de {0}', who), { earned: false });
      reply(e, tr('{0} le regaló {1} a {2} 💜', who, fmt(n), other.user.name));
      return true;
    }

    if (p.cmd === C.add || p.cmd === C.remove) {
      if (!isMod(e)) return true; // en silencio: no es para el público
      const other = findUser(e.platform, p.args[0]) || (p.args[0] ? { platform: e.platform, user: { id: p.args[0].replace(/^@/, '').toLowerCase(), name: p.args[0].replace(/^@/, '') } } : null);
      const n = parseAmount(p.args[1], 0);
      if (!other || !(n > 0)) { reply(e, tr('{0}: escribe !{1} @persona cantidad', who, p.cmd)); return true; }
      const delta = p.cmd === C.add ? n : -n;
      const real = adjust(other.platform, other.user, delta, p.cmd === C.add ? tr('{0} le dio', who) : tr('{0} le quitó', who), { earned: false });
      reply(e, real >= 0 ? tr('{0} ahora tiene {1} (+{2}).', other.user.name, fmt(balance(other.platform, other.user)), Math.abs(real)) : tr('{0} ahora tiene {1} (−{2}).', other.user.name, fmt(balance(other.platform, other.user)), Math.abs(real)));
      return true;
    }
    return false;
  }

  // ---------- Panel ----------
  function list({ q = '', platform = '', limit = 200 } = {}) {
    const s = String(q || '').toLowerCase();
    return Object.entries(data.users)
      .filter(([, u]) => (!platform || u.platform === platform) && (!s || String(u.name).toLowerCase().includes(s)))
      .sort((a, b) => b[1].pts - a[1].pts)
      .slice(0, limit)
      .map(([key, u]) => ({ key, name: u.name, platform: u.platform, pts: u.pts, earned: u.earned, spent: u.spent, keys: u.keys || {}, avatar: u.avatar || '', seen: u.seen }));
  }
  function setBalance(key, pts) {
    const u = data.users[key];
    if (!u) throw new Error(tr('Esa persona no está en la lista'));
    const n = clampInt(pts, 0, 1e9, u.pts);
    const delta = n - u.pts;
    u.pts = n;
    log({ key, name: u.name, platform: u.platform, delta, reason: tr('cambiado desde el panel') });
    changed();
    return u.pts;
  }
  function removeUser(key) {
    delete data.users[key];
    changed();
  }
  function resetAll() {
    for (const u of Object.values(data.users)) { u.pts = cfg().start; u.keys = {}; }
    log({ key: '', name: '', platform: '', delta: 0, reason: tr('todo el mundo volvió a empezar') });
    changed();
  }
  function summary() {
    const users = Object.values(data.users);
    return {
      people: users.length,
      total: users.reduce((a, u) => a + u.pts, 0),
      earned: users.reduce((a, u) => a + (u.earned || 0), 0),
      spent: users.reduce((a, u) => a + (u.spent || 0), 0),
      active: [...lastActive.values()].filter((a) => now() - a.ts < cfg().earn.activeMin * 60000).length,
    };
  }

  function stop() {
    timers.clearInterval(tickTimer);
    if (saveTimer) { timers.clearTimeout(saveTimer); saveTimer = null; }
    saveNow();
  }

  return {
    cfg, keyOf, unit, fmt, parseAmount, parse,
    earnFrom, handleCommand, commandNames, tick,
    adjust, balance, spend, findUser, top,
    keysOf, addKey,
    list, setBalance, removeUser, resetAll, summary, log: () => data.log.slice(0, 100),
    stop, saveNow,
  };
}

module.exports = { createPoints, settingsOf, parseAmount, DEFAULTS: DEFAULTS };
