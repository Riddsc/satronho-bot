// Ruletas (0.27): el público gira ruletas con suscripciones, canjes de Kick,
// regalos, seguidores, likes o un comando del chat, y tú desde el panel.
//
// La app decide el premio (al azar, según el peso de cada uno) y manda a los
// overlays dónde debe caer: así OBS y TikTok LIVE Studio muestran lo mismo.
// Las tiradas hacen fila y salen de una en una.
//
// Cada premio puede, además de salir en pantalla:
//   sound    sonar un sonido de tu biblioteca
//   say      que la voz lea un texto
//   chat     que Satronho Bot escriba en el chat
//   time     sumar o restar tiempo a la cuenta regresiva
//   counter  sumar o restar a un contador
//   skip     saltar la canción que suena
//   wheel    abrir otra ruleta (sub-ruletas, sin límite de niveles… hasta 6)
//   respin   volver a girar la misma ruleta
// y quedar como «reto pendiente» para que lo tachen cuando lo cumplas.

const crypto = require('crypto');

const TRIGGERS = ['sub', 'reward', 'gift', 'coins', 'follow', 'likesTotal', 'command', 'share', 'superfan'];
const MASCOTS = ['samy', 'troya', 'nono', 'juana'];
const MAX_DEPTH = 6;
const MAX_QUEUE = 60;

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const uid = (p = 'w') => `${p}${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
const clamp = (n, min, max, def) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
};

// Una ruleta nueva ya lista para usar: la de premios por suscripción.
function exampleWheel() {
  return {
    id: 'premios',
    name: 'Ruleta de premios',
    enabled: true,
    prizes: [
      { id: 'p1', label: 'Saludo especial', emoji: '👋', color: '#ff5d8f', weight: 3 },
      { id: 'p2', label: 'Elige la próxima canción', emoji: '🎵', color: '#5ab0ff', weight: 2 },
      { id: 'p3', label: '+5 minutos de directo', emoji: '⏱️', color: '#ffb23e', weight: 2, action: { type: 'time', seconds: 300 } },
      { id: 'p4', label: 'Reto: 10 sentadillas', emoji: '🏋️', color: '#74d14c', weight: 2, reto: true },
      { id: 'p5', label: 'Gira otra vez', emoji: '🔁', color: '#c084fc', weight: 1, action: { type: 'respin' } },
      { id: 'p6', label: 'Abrazo virtual', emoji: '🤗', color: '#4fd1c5', weight: 3 },
    ],
    triggers: [{ id: 't1', type: 'sub', platform: 'any' }],
    look: { mascot: 'random', mascots: [...MASCOTS], palette: 'premio', spinSeconds: 7, showSeconds: 5, ticks: true, winSound: 'fanfarria', volume: 70, title: true },
    announce: { chat: true, speak: false, text: '🎡 {usuario} giró «{ruleta}» y ganó: {premio}' },
  };
}

function cleanAction(a) {
  if (!a || typeof a !== 'object') return { type: 'none' };
  const type = ['none', 'sound', 'say', 'chat', 'time', 'counter', 'skip', 'wheel', 'respin'].includes(a.type) ? a.type : 'none';
  const out = { type };
  if (type === 'sound') { out.sound = String(a.sound || 'campanita').slice(0, 120); out.volume = clamp(a.volume, 0, 100, 75); }
  if (type === 'say' || type === 'chat') out.text = String(a.text || '').slice(0, 300);
  if (type === 'time') out.seconds = clamp(a.seconds, -86400, 86400, 60);
  if (type === 'counter') { out.counter = String(a.counter || '').slice(0, 60); out.delta = clamp(a.delta, -9999, 9999, 1); }
  if (type === 'wheel') out.wheel = String(a.wheel || '').slice(0, 60);
  return out;
}

function cleanTrigger(t) {
  const type = TRIGGERS.includes(t?.type) ? t.type : 'sub';
  const out = { id: String(t?.id || uid('t')).slice(0, 40), type, platform: ['tiktok', 'kick', 'starvios', 'twitch', 'any'].includes(t?.platform) ? t.platform : 'any' };
  if (type === 'reward') out.reward = String(t.reward || '').slice(0, 80);
  if (type === 'gift') { out.gifts = (Array.isArray(t.gifts) ? t.gifts : []).map(String).slice(0, 40); out.giftNames = (Array.isArray(t.giftNames) ? t.giftNames : []).map(String).slice(0, 40); out.perUnit = Boolean(t.perUnit); }
  if (type === 'coins') { out.min = clamp(t.min, 0, 1e9, 1); out.max = t.max === '' || t.max == null ? '' : clamp(t.max, 0, 1e9, ''); }
  if (type === 'likesTotal') out.every = clamp(t.every, 1, 1e9, 1000);
  if (type === 'command') { out.command = String(t.command || 'ruleta').replace(/^!/, '').replace(/\s+/g, '').slice(0, 30) || 'ruleta'; out.who = ['all', 'subs', 'mods'].includes(t.who) ? t.who : 'all'; }
  out.userCooldownSec = clamp(t.userCooldownSec, 0, 86400, 0);
  return out;
}

function cleanWheel(w, i = 0) {
  const base = exampleWheel();
  const prizes = (Array.isArray(w?.prizes) ? w.prizes : []).slice(0, 40).map((p, j) => ({
    id: String(p?.id || uid('p')).slice(0, 40),
    label: String(p?.label ?? `Premio ${j + 1}`).slice(0, 60),
    emoji: String(p?.emoji || '').slice(0, 16),
    image: /^(\/media\/|\/gift-img\?|https:\/\/)/.test(p?.image || '') ? String(p.image).slice(0, 500) : '',
    color: /^#[0-9a-f]{3,8}$/i.test(p?.color || '') ? p.color : '',
    weight: clamp(p?.weight, 0, 1000, 1),
    limit: clamp(p?.limit, 0, 999, 0),
    reto: Boolean(p?.reto),
    action: cleanAction(p?.action),
  }));
  const look = { ...base.look, ...(w?.look || {}) };
  return {
    id: String(w?.id || uid('w')).slice(0, 40),
    name: String(w?.name || `Ruleta ${i + 1}`).slice(0, 60),
    enabled: w?.enabled !== false,
    prizes,
    triggers: (Array.isArray(w?.triggers) ? w.triggers : []).slice(0, 20).map(cleanTrigger),
    look: {
      mascot: ['random', 'none', ...MASCOTS].includes(look.mascot) ? look.mascot : 'random',
      mascots: (Array.isArray(look.mascots) ? look.mascots : MASCOTS).filter((m) => MASCOTS.includes(m)),
      palette: String(look.palette || 'premio').slice(0, 30),
      spinSeconds: clamp(look.spinSeconds, 3, 20, 7),
      showSeconds: clamp(look.showSeconds, 1, 30, 5),
      ticks: look.ticks !== false,
      winSound: String(look.winSound ?? 'fanfarria').slice(0, 120),
      volume: clamp(look.volume, 0, 100, 70),
      title: look.title !== false,
      size: clamp(look.size, 50, 150, 100),
    },
    announce: {
      chat: Boolean(w?.announce?.chat ?? true),
      speak: Boolean(w?.announce?.speak),
      text: String(w?.announce?.text ?? base.announce.text).slice(0, 300),
    },
  };
}

function createWheels({ store, broadcast, actions = {}, whoReason = null, now = () => Date.now(), timers = { setTimeout, clearTimeout } }) {
  const list = () => store.get('wheels')?.list || [];
  const byId = (id) => list().find((w) => w.id === id);
  const queue = [];
  let current = null; // { spin, timer }
  const used = new Map(); // premio -> veces en este directo
  const cooldowns = new Map(); // trigger|usuario -> ts
  let likes = 0;

  function history() { return store.get('wheelHistory') || []; }
  function saveHistory(h) { store.set('wheelHistory', h.slice(0, 300)); }

  function save(rawList) {
    const seen = new Set();
    const clean = (Array.isArray(rawList) ? rawList : []).slice(0, 30).map(cleanWheel).map((w) => {
      while (seen.has(w.id)) w.id = `${w.id}-2`;
      seen.add(w.id);
      return w;
    });
    store.set('wheels', { ...(store.get('wheels') || {}), list: clean });
    broadcast('wheels', clean);
    return clean;
  }

  // La primera vez se crea la ruleta de ejemplo (premios por suscripción).
  if (!store.get('wheels')?.created) {
    store.set('wheels', { created: true, list: list().length ? list() : [cleanWheel(exampleWheel())] });
  }

  // Premio al azar según el peso (y sin los que ya se agotaron en este directo).
  function pick(w) {
    const open = w.prizes.map((p, i) => ({ p, i })).filter(({ p }) => p.weight > 0 && !(p.limit && (used.get(`${w.id}|${p.id}`) || 0) >= p.limit));
    if (!open.length) return -1;
    const total = open.reduce((s, x) => s + x.p.weight, 0);
    let r = (crypto.randomInt(0, 1e9) / 1e9) * total;
    for (const x of open) { r -= x.p.weight; if (r < 0) return x.i; }
    return open[open.length - 1].i;
  }

  const vars = (text, s, prize) => String(text || '').replace(/\{(\w+)\}/g, (m, k) => ({
    usuario: s.user?.name || 'Alguien',
    premio: prize?.label || '',
    ruleta: s.wheelName || '',
    plataforma: { tiktok: 'TikTok', kick: 'Kick', starvios: 'Starvios', twitch: 'Twitch', panel: 'el panel' }[s.platform] || '',
  }[k] ?? m));

  function enqueue({ wheelId, user, platform = 'panel', reason = '', depth = 0, front = false }) {
    const w = byId(wheelId);
    if (!w || !w.prizes.length) return false;
    if (queue.length >= MAX_QUEUE) return false;
    const item = { id: uid('s'), wheelId, user: { id: user?.id || user?.name || 'panel', name: user?.name || 'Tú', avatar: user?.avatar || '' }, platform, reason, depth };
    if (front) queue.unshift(item); else queue.push(item);
    broadcastQueue();
    if (!current) timers.setTimeout(next, 0);
    return true;
  }

  function broadcastQueue() {
    broadcast('wheel-queue', { busy: Boolean(current), current: current?.spin ? { wheelName: current.spin.wheelName, user: current.spin.user.name } : null, queue: queue.map((q) => ({ id: q.id, wheel: byId(q.wheelId)?.name || '', user: q.user.name, reason: q.reason })) });
  }

  function next() {
    if (current) return;
    const item = queue.shift();
    if (!item) { broadcastQueue(); return; }
    const w = byId(item.wheelId);
    if (!w || !w.prizes.length) return next();
    const index = pick(w);
    if (index < 0) {
      broadcast('wheel-notice', { text: `«${w.name}» no tiene premios disponibles (todos se agotaron en este directo).` });
      return next();
    }
    const mascots = w.look.mascots.length ? w.look.mascots : MASCOTS;
    const mascot = w.look.mascot === 'random' ? mascots[crypto.randomInt(0, mascots.length)] : w.look.mascot;
    const spinMs = w.look.spinSeconds * 1000;
    const showMs = w.look.showSeconds * 1000;
    const spin = {
      id: item.id,
      wheelId: w.id,
      wheelName: w.name,
      wheel: { name: w.name, prizes: w.prizes.map((p) => ({ id: p.id, label: p.label, emoji: p.emoji, image: p.image, color: p.color, weight: p.weight })), look: w.look },
      index,
      // Vueltas y punto exacto dentro de la casilla: cada tirada se ve distinta.
      turns: 5 + crypto.randomInt(0, 4),
      jitter: 0.15 + (crypto.randomInt(0, 700) / 1000),
      mascot,
      user: item.user,
      platform: item.platform,
      reason: item.reason,
      depth: item.depth,
      parent: item.parent || '',
      spinMs,
      showMs,
      ts: now(),
    };
    current = { spin, timer: null };
    broadcast('wheel-spin', spin);
    broadcastQueue();
    current.timer = timers.setTimeout(() => land(spin), spinMs + 300);
  }

  // Cayó: se aplica el premio y, tras mostrarlo, sale la siguiente.
  function land(spin) {
    if (!current || current.spin.id !== spin.id) return;
    const w = byId(spin.wheelId);
    const prize = spin.wheel.prizes[spin.index];
    const full = w?.prizes.find((p) => p.id === prize.id) || prize;
    const key = `${spin.wheelId}|${prize.id}`;
    used.set(key, (used.get(key) || 0) + 1);

    const entry = { id: spin.id, ts: now(), wheel: spin.wheelName, wheelId: spin.wheelId, prize: prize.label, emoji: prize.emoji || '', prizeId: prize.id, user: spin.user.name, platform: spin.platform, reason: spin.reason, depth: spin.depth, reto: Boolean(full.reto), done: false };
    saveHistory([entry, ...history()]);
    broadcast('wheel-landed', { spinId: spin.id, entry });

    const a = full.action || { type: 'none' };
    try {
      if (a.type === 'sound') actions.sound?.(a.sound, a.volume);
      else if (a.type === 'say' && a.text) actions.say?.(vars(a.text, spin, prize));
      else if (a.type === 'chat' && a.text) actions.chat?.(spin.platform, vars(a.text, spin, prize));
      else if (a.type === 'time') actions.time?.(a.seconds);
      else if (a.type === 'counter' && a.counter) actions.counter?.(a.counter, a.delta);
      else if (a.type === 'skip') actions.skip?.();
    } catch { /* un premio roto no frena la ruleta */ }

    if (w?.announce?.chat && w.announce.text) actions.chat?.(spin.platform, vars(w.announce.text, spin, prize));
    if (w?.announce?.speak) actions.say?.(vars(w.announce.text || '{usuario} ganó {premio}', spin, prize).replace(/[🎡]/gu, ''));

    // Sub-ruleta o volver a girar: va primero en la fila, con la misma persona.
    if ((a.type === 'wheel' || a.type === 'respin') && spin.depth < MAX_DEPTH) {
      const target = a.type === 'respin' ? spin.wheelId : a.wheel;
      if (byId(target)) {
        const item = { id: uid('s'), wheelId: target, user: spin.user, platform: spin.platform, reason: a.type === 'respin' ? 'Gira otra vez' : `Desde «${spin.wheelName}»`, depth: spin.depth + 1, parent: spin.wheelName };
        queue.unshift(item);
      }
    }
    current.timer = timers.setTimeout(() => { current = null; broadcastQueue(); next(); }, spin.showMs);
  }

  // ---------- Disparadores ----------
  function whoOk(e, who) {
    if (who === 'all') return true;
    if (whoReason) return !whoReason(e, who);
    const roles = (e.extra?.roles || e.extra?.badges || []).map((r) => String(r).toLowerCase());
    const mod = roles.some((r) => /mod|broadcaster|owner|host/.test(r));
    if (who === 'mods') return mod;
    return mod || roles.some((r) => /sub|vip|founder|og|member/.test(r));
  }

  function hits(t, e) {
    if (t.platform !== 'any' && t.platform !== e.platform) return 0;
    const x = e.extra || {};
    switch (t.type) {
      case 'sub': return e.type === 'sub' ? 1 : 0;
      case 'follow': return e.type === 'follow' ? 1 : 0;
      case 'share': return e.type === 'share' ? 1 : 0;
      case 'superfan': return e.type === 'superfan' ? 1 : 0;
      case 'reward': return e.type === 'reward' && (!t.reward || norm(x.rewardTitle) === norm(t.reward)) ? 1 : 0;
      case 'gift': {
        if (e.type !== 'gift') return 0;
        const ids = t.gifts || [];
        const names = [...(t.giftNames || []), ...ids].map(norm);
        const ok = !ids.length || ids.includes(String(x.giftId || '')) || names.includes(norm(x.giftName));
        if (!ok) return 0;
        return t.perUnit ? Math.min(10, Math.max(1, Number(x.count) || 1)) : 1;
      }
      case 'coins': {
        if (e.type !== 'gift') return 0;
        const v = Number(e.amount) || 0;
        return v >= (Number(t.min) || 0) && (t.max === '' || v <= Number(t.max)) ? 1 : 0;
      }
      case 'likesTotal': {
        if (e.type !== 'like') return 0;
        const before = likes - (Number(e.amount) || 0);
        return Math.min(3, Math.floor(likes / t.every) - Math.floor(Math.max(0, before) / t.every));
      }
      case 'command': {
        if (e.type !== 'chat') return 0;
        const m = String(e.message || '').trim().match(/^!(\S+)/);
        return m && norm(m[1]) === norm(t.command) && whoOk(e, t.who) ? 1 : 0;
      }
      default: return 0;
    }
  }

  function handleEvent(e) {
    if (!e) return;
    if (e.type === 'like') likes += Number(e.amount) || 0;
    if (e.type === 'live-start') { used.clear(); likes = 0; }
    for (const w of list()) {
      if (!w.enabled || !w.prizes.length) continue;
      for (const t of w.triggers) {
        const n = hits(t, e);
        if (n <= 0) continue;
        const who = `${e.platform}:${e.user?.id || e.user?.name}`;
        const ck = `${w.id}|${t.id}|${who}`;
        if (t.userCooldownSec && now() - (cooldowns.get(ck) || 0) < t.userCooldownSec * 1000) continue;
        cooldowns.set(ck, now());
        const reason = { sub: 'Suscripción', follow: 'Te siguió', share: 'Compartió', superfan: 'Superfan', reward: `Canje: ${e.extra?.rewardTitle || ''}`, gift: `Regalo: ${e.extra?.giftName || ''}`, coins: `Regalo: ${e.extra?.giftName || ''}`, likesTotal: 'Likes', command: `!${t.command}` }[t.type] || '';
        for (let i = 0; i < n; i += 1) enqueue({ wheelId: w.id, user: e.user, platform: e.platform, reason });
        break; // una ruleta no gira dos veces por el mismo evento
      }
    }
  }

  // ---------- Controles del panel ----------
  function control(action) {
    if (action === 'clear') queue.length = 0;
    if ((action === 'skip' || action === 'clear') && current) {
      timers.clearTimeout(current.timer);
      const s = current.spin;
      current = null;
      broadcast('wheel-control', { action: 'stop', spinId: s.id });
    }
    if (action === 'reset-limits') used.clear();
    broadcastQueue();
    if (!current) timers.setTimeout(next, 0);
  }

  function markDone(id, done = true) {
    const h = history();
    const e = h.find((x) => x.id === id);
    if (!e) return null;
    e.done = Boolean(done);
    saveHistory(h);
    broadcast('wheel-history', h.slice(0, 100));
    return e;
  }
  function clearHistory() { saveHistory([]); broadcast('wheel-history', []); }

  return {
    list,
    save,
    spin: (wheelId, user, platform = 'panel') => enqueue({ wheelId, user: user || { name: 'Prueba' }, platform, reason: 'Desde el panel' }),
    handleEvent,
    control,
    markDone,
    clearHistory,
    history,
    state: () => ({ busy: Boolean(current), queue: queue.length }),
    example: () => cleanWheel({ ...exampleWheel(), id: uid('w'), name: 'Ruleta nueva' }),
  };
}

module.exports = { createWheels, cleanWheel, exampleWheel, MASCOTS, TRIGGERS };
