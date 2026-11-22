'use strict';
// Tienda y cofres: tu público canjea huellitas 🐾 por cosas que tú decides.
//
//   !tienda               lista lo que hay (con su número y precio)
//   !canjear 2            canjea el artículo 2 (también por nombre: !canjear saludo)
//   !canjear 2 texto…     algunos artículos piden un texto («¿qué canción?»)
//   !llaves               las llaves de cofres que tienes
//   !abrir dorado         abre un cofre con una de sus llaves
//   !cofre dorado         qué premios trae un cofre y qué tan probables son
//
// Un artículo puede: quedar en la lista de pendientes para que lo cumplas tú
// (y si no, devuelves las huellitas), escribir en el chat, hablar con la voz,
// sonar un sonido, girar una ruleta, sumar a un contador o al tiempo, saltar
// la canción o dar la llave de un cofre.
//
// Un cofre se abre con su llave y da un premio al azar según su peso:
// huellitas, un artículo de la tienda o cualquiera de las acciones de arriba.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { t: tr, getLocale } = require('../i18n');

const ACTIONS = ['none', 'chat', 'say', 'sound', 'wheel', 'counter', 'time', 'skip', 'key', 'points', 'item'];
const uid = (p) => `${p}${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
const clampInt = (n, min, max, def) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
};
const cleanName = (s) => String(s || '').trim().toLowerCase().replace(/^!+/, '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 24);
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function cleanAction(a, { inChest = false } = {}) {
  const type = ACTIONS.includes(a?.type) ? a.type : 'none';
  if (!inChest && (type === 'points' || type === 'item')) return { type: 'none' };
  const out = { type };
  if (type === 'chat' || type === 'say') out.text = String(a.text || '').slice(0, 300);
  if (type === 'sound') { out.sound = String(a.sound || 'campanita').slice(0, 120); out.volume = clampInt(a.volume, 0, 100, 75); }
  if (type === 'wheel') out.wheel = String(a.wheel || '').slice(0, 40);
  if (type === 'counter') { out.counter = String(a.counter || '').slice(0, 40); out.delta = clampInt(a.delta, -1e6, 1e6, 1); }
  if (type === 'time') out.seconds = clampInt(a.seconds, -86400, 86400, 60);
  if (type === 'key') { out.chest = String(a.chest || '').slice(0, 40); out.amount = clampInt(a.amount, 1, 100, 1); }
  if (type === 'points') out.amount = clampInt(a.amount, -1e6, 1e6, 100);
  if (type === 'item') out.item = String(a.item || '').slice(0, 40);
  return out;
}

function cleanItem(x, i) {
  return {
    id: String(x?.id || uid('i')).slice(0, 40),
    name: String(x?.name || tr('Artículo {0}', i + 1)).trim().slice(0, 60),
    emoji: String(x?.emoji ?? '🎁').slice(0, 8),
    cost: clampInt(x?.cost, 0, 1e9, 100),
    stock: clampInt(x?.stock, -1, 1e6, -1), // -1 = sin límite
    perUser: clampInt(x?.perUser, 0, 1000, 0), // por directo; 0 = sin límite
    cooldownSec: clampInt(x?.cooldownSec, 0, 86400, 0),
    approve: Boolean(x?.approve),
    askText: Boolean(x?.askText),
    enabled: x?.enabled !== false,
    action: cleanAction(x?.action),
  };
}

function cleanChest(c, i) {
  const prizes = (Array.isArray(c?.prizes) ? c.prizes : []).slice(0, 40).map((p, j) => ({
    id: String(p?.id || uid('p')).slice(0, 40),
    label: String(p?.label || tr('Premio {0}', j + 1)).trim().slice(0, 60),
    emoji: String(p?.emoji ?? '✨').slice(0, 8),
    weight: Math.max(0, Math.min(1000, Number(p?.weight ?? 1) || 0)),
    action: cleanAction(p?.action, { inChest: true }),
  }));
  return {
    id: String(c?.id || uid('c')).slice(0, 40),
    name: String(c?.name || tr('Cofre {0}', i + 1)).trim().slice(0, 40),
    emoji: String(c?.emoji ?? '🧰').slice(0, 8),
    color: /^#[0-9a-f]{6}$/i.test(c?.color || '') ? c.color : '#ffb23e',
    enabled: c?.enabled !== false,
    prizes,
  };
}

const names = require('./cmdNames');
const DEFAULT_COMMANDS = { list: 'tienda', buy: 'canjear', keys: 'llaves', open: 'abrir', chest: 'cofre' };

function settingsOf(raw = {}) {
  const cmds = {};
  for (const k of Object.keys(DEFAULT_COMMANDS)) cmds[k] = cleanName(raw?.commands?.[k]) || names.cmd(k);
  return {
    enabled: Boolean(raw?.enabled),
    commands: cmds,
    items: (Array.isArray(raw?.items) ? raw.items : []).slice(0, 60).map(cleanItem),
    chests: (Array.isArray(raw?.chests) ? raw.chests : []).slice(0, 20).map(cleanChest),
  };
}

// Una tienda de ejemplo, lista para encender y ajustar.
function exampleShop() {
  const chest = { id: 'dorado', name: tr('Dorado'), emoji: '🧰', color: '#ffb23e', enabled: true, prizes: [
    { id: 'c1', label: tr('{0} huellitas', 50), emoji: '🐾', weight: 40, action: { type: 'points', amount: 50 } },
    { id: 'c2', label: tr('{0} huellitas', 200), emoji: '💰', weight: 25, action: { type: 'points', amount: 200 } },
    { id: 'c3', label: tr('{0} huellitas', 1000), emoji: '💎', weight: 5, action: { type: 'points', amount: 1000 } },
    { id: 'c4', label: tr('Saludo especial'), emoji: '👋', weight: 20, action: { type: 'say', text: tr('¡Un saludo enorme para {usuario}!') } },
    { id: 'c5', label: tr('Otra llave'), emoji: '🔑', weight: 10, action: { type: 'key', chest: 'dorado', amount: 1 } },
  ] };
  return settingsOf({
    enabled: false,
    items: [
      { id: 'saludo', name: tr('Saludo en voz alta'), emoji: '📢', cost: 200, action: { type: 'say', text: tr('¡{usuario} manda un saludo a todo el directo!') } },
      { id: 'cancion', name: tr('Elegir la próxima canción'), emoji: '🎵', cost: 800, approve: true, askText: true },
      { id: 'reto', name: tr('Reto para el streamer'), emoji: '🔥', cost: 1500, approve: true, askText: true },
      { id: 'llave', name: tr('Llave del cofre dorado'), emoji: '🔑', cost: 500, action: { type: 'key', chest: 'dorado', amount: 1 } },
    ],
    chests: [chest],
  });
}

function createShop({ store, dataDir, points, reply, broadcast = () => {}, actions = {}, isMod = () => false, now = Date.now, random = Math.random }) {
  const file = path.join(dataDir, 'tienda.json');
  let data = { redemptions: [], sold: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    data = { redemptions: Array.isArray(raw?.redemptions) ? raw.redemptions : [], sold: raw?.sold || {} };
  } catch {
    /* primera vez */
  }
  let saveTimer = null;
  const save = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
        fs.renameSync(`${file}.tmp`, file);
      } catch { /* se reintenta en el próximo cambio */ }
    }, 1500);
    saveTimer.unref?.();
  };

  const cfg = () => settingsOf(store.get('shop') || exampleShop());
  const perStream = new Map(); // `${itemId}|${userKey}` -> veces en este directo
  const cooldowns = new Map();
  const fmt = (n) => points.fmt(n);
  const feed = (text, kind, extra = {}) => broadcast('points-feed', { text, kind, ts: now(), ...extra });

  function findItem(arg) {
    const items = cfg().items.filter((x) => x.enabled);
    const n = Number(arg);
    if (Number.isInteger(n) && n >= 1 && n <= items.length) return items[n - 1];
    const f = fold(arg);
    return f ? items.find((x) => fold(x.name) === f) || items.find((x) => fold(x.name).includes(f)) : null;
  }
  function findChest(arg) {
    const f = fold(arg);
    const list = cfg().chests.filter((c) => c.enabled);
    if (!f) return list.length === 1 ? list[0] : null;
    return list.find((c) => fold(c.name) === f || c.id === f) || list.find((c) => fold(c.name).includes(f));
  }

  const fill = (text, e, extra = {}) => String(text || '')
    .replace(/\{usuario\}/gi, e.user?.name || '')
    .replace(/\{texto\}/gi, extra.text || '')
    .replace(/\{articulo\}|\{artículo\}/gi, extra.item || '')
    .replace(/\{premio\}/gi, extra.prize || '');

  // Ejecuta una acción (de un artículo o de un premio de cofre).
  function run(action, e, extra = {}) {
    const a = action || { type: 'none' };
    switch (a.type) {
      case 'chat': actions.chat?.(e.platform, fill(a.text, e, extra)); break;
      case 'say': actions.say?.(fill(a.text, e, extra)); break;
      case 'sound': actions.sound?.(a.sound, a.volume); break;
      case 'wheel': actions.wheel?.(a.wheel, e.user, e.platform); break;
      case 'counter': actions.counter?.(a.counter, a.delta); break;
      case 'time': actions.time?.(a.seconds); break;
      case 'skip': actions.skip?.(); break;
      case 'key': points.addKey(e.platform, e.user, a.chest, a.amount); break;
      case 'points': points.adjust(e.platform, e.user, a.amount, tr('premio de cofre'), { earned: false }); break;
      case 'item': {
        const it = cfg().items.find((x) => x.id === a.item);
        if (it) deliver(it, e, extra.text || '', { free: true });
        break;
      }
      default:
    }
  }

  // Entrega un artículo ya pagado: a la lista de pendientes o directo.
  function deliver(item, e, text, { free = false } = {}) {
    const r = { id: uid('r'), ts: now(), itemId: item.id, item: item.name, emoji: item.emoji, cost: free ? 0 : item.cost, platform: e.platform, user: { id: e.user?.id, name: e.user?.name }, text: String(text || '').slice(0, 200), status: item.approve ? 'pending' : 'done' };
    data.redemptions.unshift(r);
    if (data.redemptions.length > 300) data.redemptions.length = 300;
    save();
    if (!item.approve) run(item.action, e, { text, item: item.name });
    broadcast('shop-redemption', r);
    bus?.(r, e);
    return r;
  }
  let bus = null;

  function buy(e, args) {
    const c = cfg();
    const who = e.user?.name || '';
    const item = findItem(args[0]);
    if (!item) { reply(e, tr('{0}: no encontré ese artículo. Mira la lista con !{1}', who, c.commands.list)); return; }
    const userKey = points.keyOf(e.platform, e.user);
    const text = args.slice(1).join(' ').trim();
    if (item.askText && !text) { reply(e, tr('{0}: escribe !{1} {2} y lo que quieres.', who, c.commands.buy, c.items.filter((x) => x.enabled).findIndex((x) => x.id === item.id) + 1)); return; }
    if (item.stock === 0 || (item.stock > 0 && (data.sold[item.id] || 0) >= item.stock)) { reply(e, tr('{0}: «{1}» se agotó.', who, item.name)); return; }
    const used = perStream.get(`${item.id}|${userKey}`) || 0;
    if (item.perUser && used >= item.perUser) { reply(e, tr('{0}: ya canjeaste «{1}» las veces que se puede en este directo.', who, item.name)); return; }
    const cdLeft = (cooldowns.get(`${item.id}|${userKey}`) || 0) + item.cooldownSec * 1000 - now();
    if (cdLeft > 0) { reply(e, tr('{0}: espera {1} s para volver a canjear «{2}».', who, Math.ceil(cdLeft / 1000), item.name)); return; }
    if (!points.spend(e.platform, e.user, item.cost, tr('canjeó {0}', item.name))) { reply(e, tr('{0}: «{1}» cuesta {2} y tienes {3}.', who, item.name, fmt(item.cost), fmt(points.balance(e.platform, e.user)))); return; }
    perStream.set(`${item.id}|${userKey}`, used + 1);
    cooldowns.set(`${item.id}|${userKey}`, now());
    data.sold[item.id] = (data.sold[item.id] || 0) + 1;
    deliver(item, e, text);
    const msg = item.approve ? tr('🛍️ {0} canjeó «{1}». Queda en la lista para cumplirlo.', who, item.name) : item.action.type === 'key' ? tr('🔑 {0} consiguió una llave. Ábrela con !{1}', who, c.commands.open) : tr('🛍️ {0} canjeó «{1}».', who, item.name);
    reply(e, msg);
    feed(msg, 'shop', { emoji: item.emoji });
  }

  function listItems(e) {
    const c = cfg();
    const items = c.items.filter((x) => x.enabled);
    if (!items.length) { reply(e, tr('La tienda está vacía por ahora.')); return; }
    reply(e, `🛍️ ${items.map((x, i) => `${i + 1}. ${x.emoji} ${x.name} (${Number(x.cost).toLocaleString(getLocale())})`).join(' · ')} · !${c.commands.buy} ${tr('número')}`.slice(0, 480));
  }

  function openChest(e, args) {
    const c = cfg();
    const who = e.user?.name || '';
    const chest = findChest(args.join(' '));
    if (!chest) { reply(e, tr('{0}: ¿qué cofre? Escribe !{1} y el nombre.', who, c.commands.open)); return; }
    const have = points.keysOf(e.platform, e.user)[chest.id] || 0;
    if (!have) { reply(e, tr('{0}: no tienes llaves del cofre {1}.', who, chest.name)); return; }
    const prizes = chest.prizes.filter((p) => p.weight > 0);
    if (!prizes.length) { reply(e, tr('El cofre {0} está vacío por ahora.', chest.name)); return; }
    points.addKey(e.platform, e.user, chest.id, -1);
    const total = prizes.reduce((a, p) => a + p.weight, 0);
    let r = random() * total;
    let prize = prizes[prizes.length - 1];
    for (const p of prizes) { r -= p.weight; if (r < 0) { prize = p; break; } }
    run(prize.action, e, { prize: prize.label });
    const msg = tr('{0} {1} abrió el cofre {2}: {3} {4}', chest.emoji, who, chest.name, prize.emoji, prize.label);
    reply(e, msg);
    broadcast('chest-open', { ts: now(), chest: { id: chest.id, name: chest.name, emoji: chest.emoji, color: chest.color }, prize: { label: prize.label, emoji: prize.emoji, rare: prize.weight / total < 0.1 }, user: { name: who, avatar: e.user?.avatar || '' }, platform: e.platform });
    feed(msg, 'chest', { emoji: chest.emoji });
  }

  function showKeys(e) {
    const who = e.user?.name || '';
    const keys = points.keysOf(e.platform, e.user);
    const list = cfg().chests.filter((c) => keys[c.id]).map((c) => `${c.emoji} ${c.name} ×${keys[c.id]}`);
    reply(e, list.length ? tr('🔑 {0}: {1}', who, list.join(' · ')) : tr('{0}: no tienes llaves todavía.', who));
  }

  function showChest(e, args) {
    const chest = findChest(args.join(' '));
    if (!chest) { reply(e, tr('Cofres: {0}', cfg().chests.filter((c) => c.enabled).map((c) => `${c.emoji} ${c.name}`).join(' · ') || '—')); return; }
    const total = chest.prizes.reduce((a, p) => a + p.weight, 0) || 1;
    reply(e, `${chest.emoji} ${chest.name}: ${chest.prizes.filter((p) => p.weight > 0).map((p) => `${p.emoji} ${p.label} ${Math.round((p.weight / total) * 100)}%`).join(' · ')}`.slice(0, 480));
  }

  function handle(e) {
    const c = cfg();
    if (!c.enabled || e.type !== 'chat' || !points.cfg().enabled || !points.cfg().platforms[e.platform]) return false;
    const p = points.parse(e.message);
    if (!p) return false;
    switch (p.cmd) {
      case c.commands.list: listItems(e); return true;
      case c.commands.buy: buy(e, p.args); return true;
      case c.commands.keys: showKeys(e); return true;
      case c.commands.open: openChest(e, p.args); return true;
      case c.commands.chest: showChest(e, p.args); return true;
      default: return false;
    }
  }

  // ---------- Panel ----------
  function redemptions() {
    return data.redemptions.slice(0, 200);
  }
  function resolve(id, status) {
    const r = data.redemptions.find((x) => x.id === id);
    if (!r) throw new Error(tr('Ese canje ya no existe'));
    if (r.status !== 'pending') return r;
    if (status === 'refunded') {
      points.adjust(r.platform, r.user, r.cost, tr('devolución de {0}', r.item), { earned: false });
      if (data.sold[r.itemId]) data.sold[r.itemId] -= 1;
      r.status = 'refunded';
    } else {
      r.status = 'done';
      const item = cfg().items.find((x) => x.id === r.itemId);
      if (item) run(item.action, { platform: r.platform, user: r.user }, { text: r.text, item: r.item });
    }
    save();
    broadcast('shop-redemption', r);
    return r;
  }
  function sold() {
    return { ...data.sold };
  }
  function restock(itemId) {
    delete data.sold[itemId];
    save();
  }
  function newStream() {
    perStream.clear();
  }
  function onRedeem(fn) { bus = fn; }

  return { cfg, handle, redemptions, resolve, sold, restock, newStream, onRedeem, commandNames: () => Object.values(cfg().commands), openChestFor: openChest };
}

module.exports = { createShop, settingsOf, exampleShop, cleanItem, cleanChest };
