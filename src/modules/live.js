// Datos en vivo para los overlays (todo en memoria, salvo contadores y la
// cuenta regresiva, que se guardan para sobrevivir a un reinicio):
//   - inicio del directo, espectadores por plataforma y su pico
//   - seguidores nuevos, likes, monedas, suscripciones y compartidos
//   - últimos regalos, el mejor regalo y la mejor racha
//   - contadores (muertes, jefes…): se mueven desde el panel, con comandos
//     del chat (tú y tus moderadores) o con regalos
//   - cuenta regresiva que se alarga con regalos, follows, subs y likes
// Manda 'live' a los overlays (agrupado cada medio segundo).

const { whoReason } = require('./roles');

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function createLive({ store, broadcast }) {
  let s = fresh();
  let timer = null;
  function fresh() {
    return { startedAt: 0, viewers: {}, peak: 0, follows: 0, likes: 0, coins: 0, subs: 0, shares: 0, gifts: [], best: null, streak: null, chatters: new Set(), messages: 0 };
  }
  const counters = () => store.get('counters') || [];
  const clock = () => store.get('countdown') || { endsAt: 0, left: 0, running: false };

  function snapshot() {
    const c = clock();
    return {
      startedAt: s.startedAt,
      viewers: s.viewers,
      viewersTotal: Object.values(s.viewers).reduce((a, b) => a + b, 0),
      peak: s.peak,
      follows: s.follows,
      likes: s.likes,
      coins: s.coins,
      subs: s.subs,
      shares: s.shares,
      messages: s.messages,
      chatters: s.chatters.size,
      gifts: s.gifts.slice(0, 30),
      best: s.best,
      streak: s.streak,
      counters: counters(),
      countdown: { running: c.running, endsAt: c.endsAt, left: c.running ? Math.max(0, c.endsAt - Date.now()) : c.left || 0 },
      followersBase: Number(store.get('profile')?.followersBase) || 0,
      now: Date.now(),
    };
  }
  const push = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; broadcast('live', snapshot()); }, 500);
  };

  // ---------- Cuenta regresiva ----------
  function setClock(c) {
    store.set('countdown', c);
    push();
  }
  function addTime(ms, manual = false) {
    if (!manual && ms > 0) ms = capped(ms);
    if (!ms) return;
    const c = { ...clock() };
    if (c.running) c.endsAt = ms >= 0 ? Math.max(Date.now(), c.endsAt) + ms : Math.max(Date.now(), c.endsAt + ms);
    else c.left = Math.max(0, (c.left || 0) + ms);
    setClock(c);
  }
  function countdown(action, value) {
    const c = { ...clock() };
    if (action === 'start' && !c.running) { c.endsAt = Date.now() + (c.left || 0); c.running = true; }
    if (action === 'pause' && c.running) { c.left = Math.max(0, c.endsAt - Date.now()); c.running = false; }
    if (action === 'set') { const ms = Math.max(0, Number(value) || 0) * 1000; if (c.running) c.endsAt = Date.now() + ms; else c.left = ms; }
    if (action === 'add') return addTime((Number(value) || 0) * 1000, true);
    setClock(c);
  }
  // Lo que suma tiempo sale de los ajustes del overlay «Cuenta regresiva»
  // (el streamer decide cuánto «cobra» cada cosa, por plataforma).
  const PLATS = ['tiktok', 'kick', 'twitch', 'starvios'];
  function cdSettings() {
    const all = store.get('widgets') || {};
    return all.countdown?.settings || Object.values(all).find((x) => x?.kind === 'countdown')?.settings || {};
  }
  function rules() {
    const w = cdSettings();
    const num = (v, d) => (v === undefined || v === '' || v === null ? d : Number(v) || 0);
    const rates = {};
    for (const p of PLATS) {
      const r = w.rates?.[p] || {};
      rates[p] = { on: r.on !== false, perUnit: num(r.perUnit, p === 'tiktok' ? num(w.perCoin, 10) : 0), minUnits: num(r.minUnits, 1) };
    }
    return {
      auto: w.autoAdd !== false, rates,
      gifts: Array.isArray(w.giftRules) ? w.giftRules : [],
      perFollow: num(w.perFollow, 0), perSub: num(w.perSub, 60), perShare: num(w.perShare, 0),
      likesEvery: Math.max(1, num(w.likesEvery, 100)), likesSeconds: num(w.likesSeconds, num(w.per100Likes, 0)),
      maxMin: num(w.maxMin, 0), modCommand: String(w.modCommand ?? 'tiempo').replace(/^!/, '').trim(),
    };
  }
  let likePool = 0;
  function timeFor(e) {
    if (!clock().running) return 0;
    const r = rules();
    if (!r.auto) return 0;
    const rate = r.rates[e.platform] || { on: true, perUnit: 0, minUnits: 1 };
    if (!rate.on) return 0;
    if (e.type === 'gift') {
      const x = e.extra || {};
      const name = norm(x.giftName);
      const hit = r.gifts.find((g) => g && norm(g.gift) === name && (!g.platform || g.platform === 'any' || g.platform === e.platform));
      const count = Number(x.count) || 1;
      if (hit) return (Number(hit.seconds) || 0) * count + (hit.plus ? (Number(e.amount) || 0) * rate.perUnit : 0);
      const units = Number(e.amount) || 0;
      if (units < rate.minUnits) return 0;
      return units * rate.perUnit;
    }
    if (e.type === 'follow') return r.perFollow;
    if (e.type === 'sub') return r.perSub;
    if (e.type === 'share') return r.perShare;
    if (e.type === 'like' && r.likesSeconds) {
      likePool += Number(e.amount) || 0;
      const n = Math.floor(likePool / r.likesEvery);
      likePool -= n * r.likesEvery;
      return n * r.likesSeconds;
    }
    return 0;
  }
  // Tope: la cuenta nunca pasa de N minutos por delante.
  function capped(ms) {
    const max = rules().maxMin * 60000;
    if (!max) return ms;
    const c = clock();
    const left = c.running ? Math.max(0, c.endsAt - Date.now()) : c.left || 0;
    return Math.max(0, Math.min(ms, max - left));
  }
  // «!tiempo +5m», «!tiempo -30s», «!tiempo 1h» (tú y tus moderadores).
  function modTime(e) {
    const r = rules();
    if (!r.modCommand) return;
    const m = String(e.message || '').trim().match(/^!(\S+)\s+([+-]?)(\d+(?:[.,]\d+)?)\s*(h|m|min|s|seg)?\b/i);
    if (!m || norm(m[1]) !== norm(r.modCommand)) return;
    if (whoReason(e, 'mods')) return;
    const n = Number(m[3].replace(',', '.'));
    const unit = (m[4] || 'm').toLowerCase();
    const sec = n * (unit === 'h' ? 3600 : unit.startsWith('s') ? 1 : 60);
    if (m[2] === '-') addTime(-sec * 1000, true);
    else addTime(sec * 1000, true);
  }

  // ---------- Contadores ----------
  function counter(id, { delta, set } = {}) {
    const list = counters().map((c) => ({ ...c }));
    const c = list.find((x) => x.id === id);
    if (!c) return null;
    c.value = set !== undefined ? Number(set) || 0 : (Number(c.value) || 0) + (Number(delta) || 0);
    if (c.min !== undefined && c.min !== '' && c.value < Number(c.min)) c.value = Number(c.min);
    store.set('counters', list);
    push();
    return c;
  }
  function counterFromEvent(e) {
    for (const c of counters()) {
      if (e.type === 'chat' && c.command) {
        const m = String(e.message || '').trim().match(/^!(\S+)\s*([+-]?\d+)?/);
        if (!m || norm(m[1]) !== norm(String(c.command).replace(/^!/, ''))) continue;
        if (c.anyone !== true && whoReason(e, 'mods')) continue; // solo tú y tus moderadores
        counter(c.id, m[2] ? { delta: Number(m[2]) } : { delta: Number(c.step) || 1 });
      }
      if (e.type === 'gift' && c.gift && norm(c.gift) === norm(e.extra?.giftName)) counter(c.id, { delta: (Number(c.step) || 1) * (Number(e.extra?.count) || 1) });
    }
  }

  // ---------- Eventos ----------
  function handleEvent(e) {
    if (e.type === 'live-start') { s = fresh(); s.startedAt = Date.now(); return push(); }
    if (!s.startedAt && ['chat', 'gift', 'follow', 'like', 'sub', 'share'].includes(e.type)) s.startedAt = Date.now();
    if (e.type === 'follow') s.follows += 1;
    if (e.type === 'like') s.likes += Number(e.amount) || 0;
    if (e.type === 'sub') s.subs += 1;
    if (e.type === 'share') s.shares += 1;
    if (e.type === 'chat') { s.messages += 1; s.chatters.add(`${e.platform}:${e.user?.id || e.user?.name}`); }
    if (e.type === 'gift') {
      const x = e.extra || {};
      const g = { id: e.id, ts: e.ts || Date.now(), platform: e.platform, user: e.user?.name || 'Anónimo', avatar: e.user?.avatar || '', gift: x.giftName || 'Regalo', giftId: x.giftId || '', image: x.image || '', count: Number(x.count) || 1, value: Number(e.amount) || 0, unit: Number(x.unitValue) || 0, currency: x.currency || '' };
      s.coins += g.value;
      s.gifts.unshift(g);
      s.gifts.length = Math.min(s.gifts.length, 60);
      if (!s.best || g.value > s.best.value) s.best = g;
      if (!s.streak || g.count > s.streak.count) s.streak = g;
    }
    const add = timeFor(e);
    if (add) addTime(add * 1000);
    if (e.type === 'chat') modTime(e);
    counterFromEvent(e);
    push();
  }
  function onViewers({ platform, count }) {
    s.viewers[platform] = Number(count) || 0;
    const total = Object.values(s.viewers).reduce((a, b) => a + b, 0);
    s.peak = Math.max(s.peak, total);
    push();
  }
  function reset() {
    s = fresh();
    push();
  }
  // Guardado de contadores desde el panel.
  function saveCounters(list) {
    store.set('counters', (Array.isArray(list) ? list : []).slice(0, 40));
    push();
  }

  // La cuenta regresiva avisa a los overlays cada segundo mientras corre.
  setInterval(() => { if (clock().running) push(); }, 1000).unref?.();

  return { handleEvent, onViewers, snapshot, reset, countdown, counter, saveCounters };
}

module.exports = { createLive };
