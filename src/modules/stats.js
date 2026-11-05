// Estadísticas por directo (sesión) y acumuladas. Todo se guarda en tu PC.
//
// Una sesión empieza con el primer evento y termina cuando:
//   - pasan `idleMinutes` sin actividad,
//   - termina el LIVE de TikTok, o
//   - pulsas "Terminar sesión" en el panel.
//
// Por sesión: duración, diamantes (y USD estimado), regalos, mensajes,
// chatters únicos, follows, subs, likes, shares, pico de espectadores,
// canciones, mensajes leídos, actividad por minuto y tops (regalos,
// chat, likes, regalos más enviados). Al terminar se guarda un resumen
// en el historial (hasta 500 sesiones) y se suman los tops históricos.

const fs = require('fs');
const path = require('path');

const MAX_HISTORY = 500;
const COUNT_TYPES = ['chat', 'follow', 'sub', 'gift', 'like', 'share'];

function newSession(now) {
  return {
    id: `s${now}`,
    startedAt: now,
    endedAt: null,
    lastEventAt: now,
    platforms: [],
    counts: Object.fromEntries(COUNT_TYPES.map((t) => [t, 0])),
    likes: 0,
    diamonds: 0,
    giftsSent: 0,
    peakViewers: 0,
    songs: 0,
    ttsRead: 0,
    timeline: [], // por minuto: { m, chat, interactions, diamonds, viewers }
    users: {}, // clave -> { name, platform, messages, diamonds, likes, gifts }
    gifts: {}, // nombre -> { count, diamonds }
  };
}

function top(obj, field, n = 5) {
  return Object.values(obj)
    .filter((u) => u[field] > 0)
    .sort((a, b) => b[field] - a[field])
    .slice(0, n)
    .map((u) => ({ name: u.name, platform: u.platform, value: u[field] }));
}

function createStats({ store, dataDir, broadcast }) {
  const dir = path.join(dataDir, 'stats');
  fs.mkdirSync(dir, { recursive: true });
  const files = {
    current: path.join(dir, 'current.json'),
    history: path.join(dir, 'sessions.json'),
    allTime: path.join(dir, 'all-time.json'),
  };
  const read = (f, fallback) => {
    try {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch {
      return fallback;
    }
  };
  const write = (f, data) => {
    fs.writeFileSync(`${f}.tmp`, JSON.stringify(data));
    fs.renameSync(`${f}.tmp`, f);
  };

  const cfg = () => store.get('stats');
  let history = read(files.history, []);
  let allTime = read(files.allTime, { users: {}, gifts: {}, sessions: 0 });
  let current = read(files.current, null);

  // ---------- Resumen ----------
  function summary(s) {
    if (!s) return null;
    const end = s.endedAt || s.lastEventAt;
    return {
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      live: !s.endedAt,
      durationMin: Math.max(1, Math.round((end - s.startedAt) / 60000)),
      platforms: s.platforms,
      counts: s.counts,
      likes: s.likes,
      diamonds: s.diamonds,
      usd: Math.round(s.diamonds * cfg().usdPerDiamond * 100) / 100,
      giftsSent: s.giftsSent,
      uniqueChatters: Object.values(s.users).filter((u) => u.messages > 0).length,
      peakViewers: s.peakViewers,
      songs: s.songs,
      ttsRead: s.ttsRead,
      timeline: s.timeline,
      // Por plataforma: mensajes, diamantes y personas que hablaron.
      byPlatform: Object.values(s.users).reduce((acc, u) => {
        const b = (acc[u.platform] ??= { messages: 0, diamonds: 0, chatters: 0 });
        b.messages += u.messages || 0;
        b.diamonds += u.diamonds || 0;
        if (u.messages > 0) b.chatters += 1;
        return acc;
      }, {}),
      tops: {
        gifters: top(s.users, 'diamonds', 15),
        chatters: top(s.users, 'messages'),
        likers: top(s.users, 'likes'),
        gifts: Object.entries(s.gifts)
          .map(([name, g]) => ({ name, value: g.count, diamonds: g.diamonds }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 30),
      },
    };
  }

  // ---------- Ciclo de vida ----------
  let dirty = false;
  let saveTimer = null;
  let pushTimer = null;
  function touch() {
    dirty = true;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => broadcast('stats', summary(current)), 1500);
  }
  saveTimer = setInterval(() => {
    if (dirty && current) write(files.current, current);
    dirty = false;
    if (current && Date.now() - current.lastEventAt > cfg().idleMinutes * 60000) end('inactividad');
  }, 30000);

  function end(reason = 'manual') {
    if (!current) return null;
    const s = current;
    s.endedAt = s.lastEventAt;
    current = null;
    fs.rmSync(files.current, { force: true });
    const hasActivity = COUNT_TYPES.some((t) => s.counts[t] > 0);
    if (!hasActivity) return null;

    const sum = summary(s);
    sum.endReason = reason;
    history.unshift(sum);
    history = history.slice(0, MAX_HISTORY);
    write(files.history, history);

    // Tops históricos.
    allTime.sessions += 1;
    for (const [key, u] of Object.entries(s.users)) {
      const a = (allTime.users[key] ??= { name: u.name, platform: u.platform, messages: 0, diamonds: 0, likes: 0, gifts: 0, sessions: 0 });
      a.name = u.name;
      if (u.id) a.id = u.id;
      if (u.avatar) a.avatar = u.avatar;
      if (u.lastTs) a.lastTs = u.lastTs;
      for (const f of ['messages', 'diamonds', 'likes', 'gifts']) a[f] += u[f];
      a.sessions += 1;
    }
    for (const [name, g] of Object.entries(s.gifts)) {
      const a = (allTime.gifts[name] ??= { count: 0, diamonds: 0 });
      a.count += g.count;
      a.diamonds += g.diamonds;
    }
    write(files.allTime, allTime);
    broadcast('stats', null);
    broadcast('stats-history', listHistory());
    return sum;
  }

  // Si la app se cerró en pleno directo, retomamos o archivamos.
  if (current && Date.now() - current.lastEventAt > cfg().idleMinutes * 60000) end('app cerrada');

  function ensure(now) {
    if (current && now - current.lastEventAt > cfg().idleMinutes * 60000) end('inactividad');
    current ??= newSession(now);
    return current;
  }

  function bucket(s, now) {
    const m = Math.floor((now - s.startedAt) / 60000);
    let b = s.timeline[s.timeline.length - 1];
    while (!b || b.m < m) {
      b = { m: b ? b.m + 1 : 0, chat: 0, interactions: 0, diamonds: 0, viewers: 0 };
      s.timeline.push(b);
    }
    return b;
  }

  // ---------- Entradas ----------
  function handleEvent(e) {
    if (e.test && !cfg().countTests) return;
    if (!COUNT_TYPES.includes(e.type)) return;
    const now = e.ts || Date.now();
    const s = ensure(now);
    s.lastEventAt = now;
    if (!s.platforms.includes(e.platform)) s.platforms.push(e.platform);

    const key = `${e.platform}:${e.user.id}`;
    const u = (s.users[key] ??= { name: e.user.name, platform: e.platform, messages: 0, diamonds: 0, likes: 0, gifts: 0 });
    u.name = e.user.name;
    // Para buscar a la gente (Espectadores especiales): su @usuario, foto y última vez.
    u.id = e.user.id;
    if (e.user.avatar) u.avatar = e.user.avatar;
    u.lastTs = now;
    const b = bucket(s, now);
    s.counts[e.type] += 1;

    if (e.type === 'chat') {
      u.messages += 1;
      b.chat += 1;
    } else {
      b.interactions += 1;
    }
    if (e.type === 'like') {
      s.likes += e.amount;
      u.likes += e.amount;
    }
    if (e.type === 'gift') {
      const count = Number(e.extra?.count) || 1;
      s.diamonds += e.amount;
      s.giftsSent += count;
      u.diamonds += e.amount;
      u.gifts += count;
      b.diamonds += e.amount;
      const name = e.extra?.giftName || 'Regalo';
      const g = (s.gifts[name] ??= { count: 0, diamonds: 0 });
      g.count += count;
      g.diamonds += e.amount;
    }
    touch();
  }

  function onViewers({ count }) {
    if (!current) return;
    const n = Number(count) || 0;
    current.peakViewers = Math.max(current.peakViewers, n);
    const b = bucket(current, Date.now());
    b.viewers = Math.max(b.viewers, n);
    touch();
  }

  function onSong() {
    if (!current) return;
    current.songs += 1;
    touch();
  }

  function onTtsRead() {
    if (!current) return;
    current.ttsRead += 1;
    touch();
  }

  // ---------- Consultas ----------
  function listHistory() {
    return history.map(({ timeline, tops, ...rest }) => rest);
  }

  // Todos los directos con sus tops (sin la línea de tiempo) para el Resumen.
  function overview() {
    const list = history.map(({ timeline, ...rest }) => rest);
    const now = summary(current);
    if (now) { const { timeline, ...rest } = now; list.unshift(rest); }
    return list;
  }

  function getSession(id) {
    if (current && current.id === id) return summary(current);
    return history.find((h) => h.id === id) || null;
  }

  function allTimeTops() {
    return {
      sessions: allTime.sessions,
      gifters: top(allTime.users, 'diamonds', 10),
      chatters: top(allTime.users, 'messages', 10),
      likers: top(allTime.users, 'likes', 10),
      gifts: Object.entries(allTime.gifts)
        .map(([name, g]) => ({ name, value: g.count, diamonds: g.diamonds }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    };
  }

  // Gente que ha pasado por tu chat (este directo y los anteriores), para
  // sugerirla al escribir. Lo que empieza igual va primero; luego lo reciente.
  const fold = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function people(q = '', limit = 8) {
    const all = new Map();
    for (const src of [allTime.users, current?.users || {}]) {
      for (const [key, u] of Object.entries(src)) {
        if (!u?.name || /^test|^prueba/i.test(u.id || '')) continue;
        const prev = all.get(key) || {};
        all.set(key, { platform: u.platform, id: String(u.id || key.split(':').slice(1).join(':')), name: u.name, avatar: u.avatar || prev.avatar || '', lastTs: Math.max(u.lastTs || 0, prev.lastTs || 0), score: (u.messages || 0) + (u.gifts || 0) * 3 + (prev.score || 0) });
      }
    }
    const f = fold(q).replace(/^@/, '');
    const rank = (u) => {
      if (!f) return 1;
      const n = fold(u.name);
      const id = fold(u.id);
      if (n.startsWith(f) || id.startsWith(f)) return 2;
      return n.includes(f) || id.includes(f) ? 1 : 0;
    };
    return [...all.values()]
      .map((u) => ({ u, r: rank(u) }))
      .filter((x) => x.r > 0)
      .sort((a, b) => b.r - a.r || b.u.lastTs - a.u.lastTs || b.u.score - a.u.score)
      .slice(0, limit)
      .map(({ u }) => ({ platform: u.platform, id: u.id, name: u.name, avatar: u.avatar }));
  }

  function stop() {
    clearInterval(saveTimer);
    clearTimeout(pushTimer);
    if (current) write(files.current, current);
  }

  return {
    handleEvent,
    onViewers,
    onSong,
    onTtsRead,
    end,
    current: () => summary(current),
    listHistory,
    overview,
    getSession,
    allTimeTops,
    people,
    stop,
  };
}

module.exports = { createStats };
