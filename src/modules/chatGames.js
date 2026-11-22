'use strict';
// Juegos del chat con huellitas 🐾 (necesitan las huellitas encendidas).
//
//   !duelo @ana 100      reta a alguien; acepta con !acepto (60 s). Quien gane se lleva las dos apuestas.
//   !tragamonedas 50     tres rodillos: tres iguales pagan según el símbolo; dos iguales devuelven algo.
//   !apuesta 100         todo o nada (la probabilidad de ganar la eliges tú).
//   !color rojo 100      rojo o negro pagan ×2; verde paga ×14 (es mucho más difícil).
//   !atraco 100          un golpe en grupo: los demás se suman con !atraco en 60 s; cuantos más, más fácil.
//   !trivia              (tú o tus moderadores) lanza una pregunta; la primera respuesta correcta gana.
//
// Cada juego se enciende aparte, con su comando, apuesta mínima y máxima y
// espera por persona. Lo que pasa se escribe en el chat (Kick y Starvios),
// sale en el panel y en el overlay de huellitas, y si quieres lo lee la voz.

const crypto = require('crypto');
const { t: tr, tn: trn, getLang } = require('../i18n');
const TRIVIA = require('../data/trivia.json');

const names = require('./cmdNames');
const GAMES = ['duel', 'slots', 'gamble', 'colors', 'heist', 'trivia'];
const DEFAULTS = {
  duel: { enabled: true, command: 'duelo', accept: 'acepto', min: 10, max: 5000, cooldownSec: 30, timeoutSec: 60 },
  slots: { enabled: true, command: 'tragamonedas', min: 10, max: 1000, cooldownSec: 20 },
  gamble: { enabled: true, command: 'apuesta', min: 10, max: 5000, cooldownSec: 30, winChance: 45 },
  colors: { enabled: true, command: 'color', min: 10, max: 5000, cooldownSec: 20 },
  heist: { enabled: true, command: 'atraco', min: 50, max: 5000, cooldownSec: 300, joinSec: 60, baseChance: 35, perPerson: 5, maxChance: 75, payout: 2 },
  trivia: { enabled: true, command: 'trivia', prize: 100, answerSec: 30, autoEveryMin: 0, own: [] },
};

const SLOT_SYMBOLS = [
  { s: '🐾', w: 30, x: 3 },
  { s: '🦴', w: 25, x: 4 },
  { s: '🍖', w: 20, x: 5 },
  { s: '⭐', w: 12, x: 8 },
  { s: '🐶', w: 9, x: 12 },
  { s: '💎', w: 4, x: 25 },
];

const clampInt = (n, min, max, def) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
};
const cleanName = (s) => String(s || '').trim().toLowerCase().replace(/^!+/, '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 24);
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();

function settingsOf(raw = {}) {
  const out = {};
  for (const g of GAMES) {
    const r = raw?.[g] || {};
    const d = DEFAULTS[g];
    const o = { enabled: r.enabled ?? d.enabled, command: cleanName(r.command) || names.cmd(g) };
    if ('min' in d) {
      o.min = clampInt(r.min, 1, 1e9, d.min);
      o.max = Math.max(o.min, clampInt(r.max, 1, 1e9, d.max));
    }
    if ('cooldownSec' in d) o.cooldownSec = clampInt(r.cooldownSec, 0, 3600, d.cooldownSec);
    if (g === 'duel') { o.accept = cleanName(r.accept) || names.cmd('accept'); o.timeoutSec = clampInt(r.timeoutSec, 15, 300, d.timeoutSec); }
    if (g === 'gamble') o.winChance = clampInt(r.winChance, 1, 95, d.winChance);
    if (g === 'heist') {
      o.joinSec = clampInt(r.joinSec, 15, 300, d.joinSec);
      o.baseChance = clampInt(r.baseChance, 1, 95, d.baseChance);
      o.perPerson = clampInt(r.perPerson, 0, 50, d.perPerson);
      o.maxChance = clampInt(r.maxChance, o.baseChance, 95, d.maxChance);
      o.payout = Math.max(1.1, Math.min(10, Number(r.payout ?? d.payout) || d.payout));
    }
    if (g === 'trivia') {
      o.prize = clampInt(r.prize, 1, 1e6, d.prize);
      o.answerSec = clampInt(r.answerSec, 10, 180, d.answerSec);
      o.autoEveryMin = clampInt(r.autoEveryMin, 0, 240, 0);
      o.own = (Array.isArray(r.own) ? r.own : [])
        .map((x) => ({ q: String(x?.q || '').trim().slice(0, 200), a: (Array.isArray(x?.a) ? x.a : String(x?.a || '').split('|')).map((y) => String(y).trim()).filter(Boolean).slice(0, 6) }))
        .filter((x) => x.q && x.a.length)
        .slice(0, 200);
    }
    o.enabled = Boolean(o.enabled);
    out[g] = o;
  }
  return out;
}

function pickWeighted(list, rnd) {
  const total = list.reduce((a, x) => a + x.w, 0);
  let r = rnd() * total;
  for (const x of list) {
    r -= x.w;
    if (r < 0) return x;
  }
  return list[list.length - 1];
}

function createChatGames({ store, points, reply, isMod = () => false, broadcast = () => {}, now = Date.now, random = Math.random, timers = { setTimeout, clearTimeout, setInterval, clearInterval } }) {
  const cfg = () => settingsOf(store.get('games'));
  const cooldowns = new Map();
  const duels = new Map(); // key del retado -> { from, to, amount, timer, platform }
  let heist = null;
  let trivia = null;
  const askedTrivia = [];

  const who = (e) => e.user?.name || '';
  const keyOf = (e) => points.keyOf(e.platform, e.user);
  const fmt = (n) => points.fmt(n);
  const feed = (text, kind, extra = {}) => broadcast('points-feed', { text, kind, ts: now(), ...extra });

  // Respuesta en el chat + aviso en el panel y el overlay.
  function say(e, text, kind = 'game', extra) {
    reply(e, text);
    feed(text, kind, extra);
  }

  function onCooldown(e, game, g) {
    const k = `${game}|${keyOf(e)}`;
    const left = (cooldowns.get(k) || 0) + g.cooldownSec * 1000 - now();
    if (left > 0) return Math.ceil(left / 1000);
    return 0;
  }
  const startCooldown = (e, game) => cooldowns.set(`${game}|${keyOf(e)}`, now());

  // Lee la apuesta y comprueba mínimo, máximo y saldo. Devuelve el número o null (y ya avisó).
  function betOf(e, raw, g) {
    const bal = points.balance(e.platform, e.user);
    const n = points.parseAmount(raw, Math.min(bal, g.max));
    if (!(n > 0)) { reply(e, tr('{0}: ¿cuánto apuestas? Entre {1} y {2}.', who(e), g.min, g.max)); return null; }
    if (n < g.min) { reply(e, tr('{0}: la apuesta mínima es {1}.', who(e), fmt(g.min))); return null; }
    if (n > g.max) { reply(e, tr('{0}: la apuesta máxima es {1}.', who(e), fmt(g.max))); return null; }
    if (bal < n) { reply(e, tr('{0}: no te alcanza (tienes {1}).', who(e), fmt(bal))); return null; }
    return n;
  }

  // ---------- Duelo ----------
  function duel(e, args, g) {
    const target = points.findUser(e.platform, args[0]);
    if (!target) { reply(e, args[0] ? tr('{0}: no encontré a {1} en el chat.', who(e), args[0].replace(/^@/, '')) : tr('{0}: escribe !{1} @persona cantidad', who(e), g.command)); return; }
    const tKey = points.keyOf(target.platform, target.user);
    if (tKey === keyOf(e)) { reply(e, tr('{0}: no te puedes retar a ti.', who(e))); return; }
    if (duels.has(tKey)) { reply(e, tr('{0}: {1} ya tiene un reto pendiente.', who(e), target.user.name)); return; }
    const cd = onCooldown(e, 'duel', g);
    if (cd) { reply(e, tr('{0}: espera {1} s para otro duelo.', who(e), cd)); return; }
    const n = betOf(e, args[1], g);
    if (n == null) return;
    if (points.balance(target.platform, target.user) < n) { reply(e, tr('{0}: a {1} no le alcanza para ese duelo.', who(e), target.user.name)); return; }
    startCooldown(e, 'duel');
    const timer = timers.setTimeout(() => {
      if (duels.get(tKey)?.timer !== timer) return;
      duels.delete(tKey);
      say(e, tr('⏱ {0} no aceptó el duelo de {1}.', target.user.name, who(e)), 'duel');
    }, g.timeoutSec * 1000);
    duels.set(tKey, { from: { platform: e.platform, user: e.user }, to: target, amount: n, timer });
    say(e, tr('⚔️ {0} reta a {1} por {2}. {1}, escribe !{3} en {4} s.', who(e), target.user.name, fmt(n), g.accept, g.timeoutSec), 'duel');
  }

  function acceptDuel(e) {
    const d = duels.get(keyOf(e));
    if (!d) return false;
    timers.clearTimeout(d.timer);
    duels.delete(keyOf(e));
    const a = d.from;
    const b = { platform: e.platform, user: e.user };
    if (points.balance(a.platform, a.user) < d.amount) { reply(e, tr('{0} ya no tiene {1}: duelo cancelado.', a.user.name, fmt(d.amount))); return true; }
    if (points.balance(b.platform, b.user) < d.amount) { reply(e, tr('{0}: no te alcanza para el duelo.', who(e))); return true; }
    const aWins = random() < 0.5;
    const [win, lose] = aWins ? [a, b] : [b, a];
    points.adjust(lose.platform, lose.user, -d.amount, tr('perdió un duelo con {0}', win.user.name));
    points.adjust(win.platform, win.user, d.amount, tr('ganó un duelo a {0}', lose.user.name));
    say(e, tr('⚔️ ¡{0} gana el duelo contra {1} y se lleva {2}!', win.user.name, lose.user.name, fmt(d.amount)), 'duel', { winner: win.user.name, big: true });
    return true;
  }

  // ---------- Tragamonedas ----------
  function slots(e, args, g) {
    const cd = onCooldown(e, 'slots', g);
    if (cd) { reply(e, tr('{0}: espera {1} s para volver a jugar.', who(e), cd)); return; }
    const n = betOf(e, args[0], g);
    if (n == null) return;
    startCooldown(e, 'slots');
    const reels = [0, 1, 2].map(() => pickWeighted(SLOT_SYMBOLS, random));
    const line = reels.map((r) => r.s).join(' ');
    let win = 0;
    if (reels[0].s === reels[1].s && reels[1].s === reels[2].s) win = n * reels[0].x;
    else if (reels[0].s === reels[1].s || reels[1].s === reels[2].s || reels[0].s === reels[2].s) win = Math.floor(n * 1.5);
    const delta = win - n;
    points.adjust(e.platform, e.user, delta, tr('tragamonedas'));
    if (win > n * 2) say(e, tr('🎰 {0} | ¡{1} gana {2}!', line, who(e), fmt(win)), 'slots', { big: true });
    else if (win > 0) say(e, tr('🎰 {0} | {1} recupera {2}.', line, who(e), fmt(win)), 'slots');
    else say(e, tr('🎰 {0} | {1} pierde {2}.', line, who(e), fmt(n)), 'slots');
  }

  // ---------- Apuesta ----------
  function gamble(e, args, g) {
    const cd = onCooldown(e, 'gamble', g);
    if (cd) { reply(e, tr('{0}: espera {1} s para volver a apostar.', who(e), cd)); return; }
    const n = betOf(e, args[0], g);
    if (n == null) return;
    startCooldown(e, 'gamble');
    const won = random() * 100 < g.winChance;
    points.adjust(e.platform, e.user, won ? n : -n, tr('apuesta'));
    say(e, won ? tr('🎲 ¡{0} apostó {1} y ganó! Ahora tiene {2}.', who(e), fmt(n), fmt(points.balance(e.platform, e.user))) : tr('🎲 {0} apostó {1} y perdió. Le quedan {2}.', who(e), fmt(n), fmt(points.balance(e.platform, e.user))), 'gamble', { big: won && n >= g.max / 2 });
  }

  // ---------- Colores (como la ruleta del casino) ----------
  const COLOR_WORDS = {
    red: ['rojo', 'red', 'vermelho', 'rouge', 'rosso', 'r'],
    black: ['negro', 'black', 'preto', 'noir', 'nero', 'n', 'b'],
    green: ['verde', 'green', 'vert', 'v', 'g'],
  };
  const colorOf = (w) => Object.keys(COLOR_WORDS).find((k) => COLOR_WORDS[k].includes(fold(w)));
  const COLOR_LABEL = { red: () => tr('rojo'), black: () => tr('negro'), green: () => tr('verde') };
  const COLOR_EMOJI = { red: '🔴', black: '⚫', green: '🟢' };
  function colors(e, args, g) {
    const pick = colorOf(args[0]) || colorOf(args[1]);
    const amountArg = colorOf(args[0]) ? args[1] : args[0];
    if (!pick) { reply(e, tr('{0}: escribe !{1} rojo, negro o verde y la cantidad.', who(e), g.command)); return; }
    const cd = onCooldown(e, 'colors', g);
    if (cd) { reply(e, tr('{0}: espera {1} s para volver a jugar.', who(e), cd)); return; }
    const n = betOf(e, amountArg, g);
    if (n == null) return;
    startCooldown(e, 'colors');
    // 15 casillas: 7 rojas, 7 negras y 1 verde (paga ×14).
    const slot = Math.floor(random() * 15);
    const landed = slot === 0 ? 'green' : slot <= 7 ? 'red' : 'black';
    const mult = landed === 'green' ? 14 : 2;
    const won = landed === pick;
    points.adjust(e.platform, e.user, won ? n * (mult - 1) : -n, tr('colores'));
    say(e, won ? tr('{0} ¡Salió {1}! {2} gana {3}.', COLOR_EMOJI[landed], COLOR_LABEL[landed](), who(e), fmt(n * mult)) : tr('{0} Salió {1}. {2} pierde {3}.', COLOR_EMOJI[landed], COLOR_LABEL[landed](), who(e), fmt(n)), 'colors', { big: won && landed === 'green' });
  }

  // ---------- Atraco en grupo ----------
  function heistJoin(e, args, g) {
    if (heist?.crew.has(keyOf(e))) { reply(e, tr('{0}: ya estás en el atraco.', who(e))); return; }
    if (!heist) {
      const cd = (cooldowns.get('heist|all') || 0) + g.cooldownSec * 1000 - now();
      if (cd > 0) { reply(e, tr('{0}: la policía sigue vigilando. Próximo atraco en {1} s.', who(e), Math.ceil(cd / 1000))); return; }
    }
    const n = betOf(e, args[0], g);
    if (n == null) return;
    points.adjust(e.platform, e.user, -n, tr('entró a un atraco'));
    if (!heist) {
      heist = { crew: new Map(), started: now(), platform: e.platform, origin: e };
      heist.timer = timers.setTimeout(() => runHeist(g), g.joinSec * 1000);
      heist.crew.set(keyOf(e), { platform: e.platform, user: e.user, amount: n });
      say(e, tr('🦹 {0} arma un atraco con {1}. Súmate con !{2} cantidad en {3} s.', who(e), fmt(n), g.command, g.joinSec), 'heist');
      return;
    }
    heist.crew.set(keyOf(e), { platform: e.platform, user: e.user, amount: n });
    feed(tr('🦹 {0} se suma al atraco con {1} ({2} en el grupo).', who(e), fmt(n), heist.crew.size), 'heist');
  }

  function runHeist(g) {
    const h = heist;
    heist = null;
    if (!h) return;
    cooldowns.set('heist|all', now());
    const crew = [...h.crew.values()];
    const chance = Math.min(g.maxChance, g.baseChance + g.perPerson * (crew.length - 1));
    const winners = [];
    for (const m of crew) {
      if (random() * 100 < chance) {
        const prize = Math.floor(m.amount * g.payout);
        points.adjust(m.platform, m.user, prize, tr('atraco con éxito'));
        winners.push(`${m.user.name} (+${prize})`);
      }
    }
    const text = !winners.length
      ? trn(crew.length, '🚨 ¡Atraparon a {0}! Se perdió todo lo del atraco.', '🚨 ¡Atraparon a los {0}! Se perdió todo lo del atraco.', crew.length === 1 ? crew[0].user.name : crew.length)
      : winners.length === crew.length
        ? tr('💰 ¡Atraco perfecto! Todos escaparon: {0}', winners.join(', '))
        : tr('💰 Escaparon {0} de {1}: {2}', winners.length, crew.length, winners.join(', '));
    say(h.origin, text, 'heist', { big: winners.length > 0 });
  }

  // ---------- Trivia ----------
  function triviaPool() {
    const own = cfg().trivia.own;
    const lang = getLang();
    const base = TRIVIA[lang] || TRIVIA.es || [];
    return [...own, ...base];
  }
  function startTrivia(origin) {
    const g = cfg().trivia;
    if (!g.enabled || trivia) return false;
    const pool = triviaPool();
    if (!pool.length) return false;
    let idx = Math.floor(random() * pool.length);
    for (let i = 0; i < pool.length && askedTrivia.includes(idx); i += 1) idx = (idx + 1) % pool.length;
    askedTrivia.push(idx);
    if (askedTrivia.length > Math.min(30, pool.length - 1)) askedTrivia.shift();
    const q = pool[idx];
    const e = origin || { platform: 'panel', user: { name: 'Satronho Bot' } };
    trivia = { q, answers: q.a.map(fold), origin: e, timer: timers.setTimeout(() => {
      const t = trivia;
      trivia = null;
      if (t) say(t.origin, tr('⏱ Nadie acertó. La respuesta era: {0}', t.q.a[0]), 'trivia');
    }, g.answerSec * 1000) };
    say(e, tr('❓ Trivia por {0}: {1} ({2} s)', fmt(g.prize), q.q, g.answerSec), 'trivia');
    return true;
  }
  function checkTrivia(e) {
    if (!trivia || e.type !== 'chat') return false;
    const msg = fold(e.message);
    // Vale la respuesta exacta o dentro de una frase («creo que es Marte»).
    if (!msg || !trivia.answers.some((a) => msg === a || (a.length >= 4 && ` ${msg} `.includes(` ${a} `)))) return false;
    const t = trivia;
    trivia = null;
    timers.clearTimeout(t.timer);
    const g = cfg().trivia;
    points.adjust(e.platform, e.user, g.prize, tr('acertó la trivia'));
    say(e, tr('🎉 ¡{0} acertó! Era «{1}». Gana {2}.', who(e), t.q.a[0], fmt(g.prize)), 'trivia', { winner: who(e), big: true });
    return true;
  }
  let lastAutoTrivia = now();
  const autoTimer = timers.setInterval(() => {
    const g = cfg().trivia;
    if (!g.enabled || !g.autoEveryMin || !points.cfg().enabled) { lastAutoTrivia = now(); return; }
    if (now() - lastAutoTrivia < g.autoEveryMin * 60000) return;
    lastAutoTrivia = now();
    if (lastChat && now() - lastChat.ts < 10 * 60000) startTrivia(lastChat.e);
  }, 30000);
  autoTimer?.unref?.();
  let lastChat = null;

  // ---------- Entrada ----------
  function handle(e) {
    if (e.type !== 'chat' || !points.cfg().enabled || !points.cfg().platforms[e.platform]) return false;
    lastChat = { ts: now(), e };
    const games = cfg();
    if (games.trivia.enabled && checkTrivia(e)) return true;
    const p = points.parse(e.message);
    if (!p) return false;
    if (games.duel.enabled && p.cmd === games.duel.accept) return acceptDuel(e);
    for (const name of GAMES) {
      const g = games[name];
      if (!g.enabled || p.cmd !== g.command) continue;
      switch (name) {
        case 'duel': duel(e, p.args, g); break;
        case 'slots': slots(e, p.args, g); break;
        case 'gamble': gamble(e, p.args, g); break;
        case 'colors': colors(e, p.args, g); break;
        case 'heist': heistJoin(e, p.args, g); break;
        case 'trivia':
          if (isMod(e)) { if (!startTrivia(e)) reply(e, tr('{0}: ya hay una trivia en curso.', who(e))); }
          break;
        default:
      }
      return true;
    }
    return false;
  }

  function commandNames() {
    const g = cfg();
    return [...GAMES.map((k) => g[k].command), g.duel.accept];
  }

  function state() {
    return {
      heist: heist ? { crew: [...heist.crew.values()].map((m) => ({ name: m.user.name, amount: m.amount })), endsIn: Math.max(0, cfg().heist.joinSec * 1000 - (now() - heist.started)) } : null,
      trivia: trivia ? { q: trivia.q.q } : null,
      duels: [...duels.values()].map((d) => ({ from: d.from.user.name, to: d.to.user.name, amount: d.amount })),
    };
  }

  function stop() {
    timers.clearInterval(autoTimer);
    if (heist) timers.clearTimeout(heist.timer);
    if (trivia) timers.clearTimeout(trivia.timer);
    for (const d of duels.values()) timers.clearTimeout(d.timer);
  }

  return { handle, startTrivia, commandNames, state, stop, _slots: SLOT_SYMBOLS };
}

module.exports = { createChatGames, settingsOf, GAMES, DEFAULTS, SLOT_SYMBOLS, _id: () => crypto.randomUUID() };
