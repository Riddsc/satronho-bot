// Metas: barras de progreso.
//
// Cada meta elige:
//   type     qué cuenta: follow, sub, gift (monedas), like, share
//   platform de dónde: 'all' (con platforms = cuáles sumar) o una sola
//   source   cómo cuenta (solo seguidores puede leer tu cuenta):
//              'events'  lo que pase con la app conectada (de siempre)
//              'account' el total de tu cuenta (159 / 200)
//              'gained'  los nuevos desde que empezó el periodo
//   period   cuándo vuelve a empezar: none, stream, day, week, month
//            (weekStart: 1 = lunes, 0 = domingo). 'account' no se reinicia.
//   countBy  'events' suma 1 por evento; 'amount' suma event.amount
//   offset   lo que corriges a mano en 'account' y 'gained'
//   baseline { plataforma: total al empezar el periodo } para 'gained'

function slugify(text) {
  return String(text || 'meta')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'meta';
}

const PLATS = ['all', 'tiktok', 'kick', 'starvios', 'twitch'];
const READABLE = ['tiktok', 'kick', 'starvios']; // las que pueden dar su total
const SOURCES = ['events', 'account', 'gained'];
const PERIODS = ['none', 'stream', 'day', 'week', 'month'];
const COLOR = /^#[0-9a-f]{6}$/i;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Clave del periodo en la hora de tu PC: si cambia, la meta vuelve a empezar.
function periodKey(g, date = new Date()) {
  switch (g.period) {
    case 'day': return ymd(date);
    case 'week': {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const start = g.weekStart === 0 ? 0 : 1;
      d.setDate(d.getDate() - ((d.getDay() - start + 7) % 7));
      return `w${ymd(d)}`;
    }
    case 'month': return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    case 'stream': return g.streamKey || '';
    default: return '';
  }
}

// Valores sanos para cualquier meta (también las que vienen de versiones viejas).
function normalize(g) {
  g.platform = PLATS.includes(g.platform) ? g.platform : 'all';
  g.source = g.type === 'follow' && SOURCES.includes(g.source) ? g.source : 'events';
  g.period = PERIODS.includes(g.period) ? g.period : 'none';
  if (g.source === 'account') g.period = 'none';
  g.weekStart = g.weekStart === 0 ? 0 : 1;
  g.platforms = Array.isArray(g.platforms) ? g.platforms.filter((p) => PLATS.includes(p) && p !== 'all') : [];
  g.offset = Number(g.offset) || 0;
  g.baseline = g.baseline && typeof g.baseline === 'object' ? g.baseline : {};
  g.color = COLOR.test(g.color || '') ? g.color : '';
  g.current = Math.max(0, Number(g.current) || 0);
  g.target = Math.max(1, Number(g.target) || 1);
  return g;
}
// De qué plataformas cuenta: una sola, o las elegidas (vacío = todas).
const platsOf = (g) => (g.platform !== 'all' ? [g.platform] : g.platforms.length ? g.platforms : PLATS.slice(1));

function createGoals({ store, broadcast, getTotals = () => ({}), now = () => new Date() }) {
  const list = () => store.get('goals').map(normalize);
  const save = (goals) => store.set('goals', goals);

  // Lo que muestra la barra en 'account' y 'gained', con lo que se sabe.
  function compute(g, totals = getTotals()) {
    if (g.source === 'events') return g.current;
    let sum = 0;
    for (const p of platsOf(g).filter((x) => READABLE.includes(x))) {
      const t = totals[p];
      if (!Number.isFinite(t)) continue;
      if (g.source === 'account') sum += t;
      else {
        // Primera vez que se conoce el total: el periodo cuenta desde aquí.
        if (!Number.isFinite(g.baseline[p])) g.baseline[p] = t;
        sum += Math.max(0, t - g.baseline[p]);
      }
    }
    return Math.max(0, sum + g.offset);
  }

  function restart(g, totals = getTotals()) {
    g.offset = 0;
    g.current = 0;
    if (g.source === 'gained') {
      g.baseline = {};
      for (const p of platsOf(g)) if (Number.isFinite(totals[p])) g.baseline[p] = totals[p];
    }
    g.periodKey = periodKey(g, now());
    g.startedAt = Date.now();
  }

  // Revisa periodos y recalcula; avisa de lo que cambió.
  function sweep({ streamPlatform = '' } = {}) {
    const goals = list();
    const totals = getTotals();
    const changed = [];
    for (const g of goals) {
      const before = g.current;
      let touched = false;
      if (streamPlatform && g.period === 'stream' && (g.platform === 'all' ? platsOf(g).includes(streamPlatform) : g.platform === streamPlatform)) {
        g.streamKey = `s${Date.now()}`;
      }
      if (g.period !== 'none' && g.source !== 'account') {
        const key = periodKey(g, now());
        if (g.periodKey === undefined) { g.periodKey = key; touched = true; }
        else if (key && key !== g.periodKey) { restart(g, totals); touched = true; }
      }
      if (g.source !== 'events') g.current = compute(g, totals);
      if (touched || g.current !== before) {
        changed.push(g);
        if (before < g.target && g.current >= g.target) broadcast('goal-complete', g);
      }
    }
    if (changed.length) {
      save(goals);
      for (const g of changed) broadcast('goal', g);
    }
  }

  function handleEvent(e) {
    if (e.type === 'chat') return;
    const goals = list();
    const changed = [];
    for (const g of goals) {
      if (g.type !== e.type || g.source !== 'events') continue;
      if (e.platform !== 'test' && !platsOf(g).includes(e.platform)) continue;
      const before = g.current;
      g.current += g.countBy === 'amount' ? e.amount : 1;
      changed.push(g);
      if (before < g.target && g.current >= g.target) broadcast('goal-complete', g);
    }
    if (changed.length) {
      save(goals);
      for (const g of changed) broadcast('goal', g);
    }
  }

  function create(body = {}) {
    const goals = list();
    let id = slugify(body.title);
    while (goals.some((g) => g.id === id)) id += '-2';
    const goal = normalize({
      id,
      title: body.title || 'Nueva meta',
      type: body.type || 'follow',
      platform: body.platform || 'all',
      platforms: body.platforms,
      source: body.source,
      period: body.period,
      weekStart: body.weekStart,
      countBy: body.countBy || 'events',
      current: body.current,
      target: body.target ?? 10,
      color: body.color,
    });
    restart(goal);
    if (goal.source === 'events') goal.current = Math.max(0, Number(body.current) || 0);
    else goal.current = compute(goal);
    goals.push(goal);
    save(goals);
    broadcast('goal', goal);
    return goal;
  }

  function update(id, patch = {}) {
    const goals = list();
    const g = goals.find((x) => x.id === id);
    if (!g) return null;
    const before = g.current;
    for (const k of ['title', 'type', 'countBy', 'platform', 'platforms', 'source', 'period', 'weekStart', 'color']) if (patch[k] !== undefined) g[k] = patch[k];
    if (patch.target !== undefined) g.target = patch.target;
    normalize(g);
    // Cambiar de dónde o cómo cuenta: empieza limpio.
    if (['platform', 'platforms', 'source', 'period', 'weekStart', 'type'].some((k) => patch[k] !== undefined)) {
      const keep = g.source === 'events' && patch.source === undefined && patch.type === undefined;
      const cur = g.current;
      restart(g);
      if (keep) g.current = cur;
    }
    if (patch.reset) restart(g);
    if (patch.current !== undefined) {
      const want = Math.max(0, Number(patch.current) || 0);
      if (g.source === 'events') g.current = want;
      else { g.offset = 0; g.offset = want - compute(g); }
    }
    if (g.source !== 'events') g.current = compute(g);
    if (before < g.target && g.current >= g.target) broadcast('goal-complete', g);
    save(goals);
    broadcast('goal', g);
    return g;
  }

  function remove(id) {
    const goals = list().filter((g) => g.id !== id);
    save(goals);
    broadcast('goal-removed', { id });
  }

  // Cada minuto: ¿empezó otro día, semana o mes?
  const timer = setInterval(() => sweep(), 60 * 1000);
  timer.unref?.();

  return {
    handleEvent,
    create,
    update,
    remove,
    list,
    onTotals: () => sweep(),
    onStreamStart: (platform) => sweep({ streamPlatform: platform }),
    sweep,
    stop: () => clearInterval(timer),
  };
}

module.exports = { createGoals, periodKey };
