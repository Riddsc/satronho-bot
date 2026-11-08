// Totales de tus cuentas (por ahora, seguidores) en cada plataforma.
//
// Cada conector sabe leer su número a su manera:
//   TikTok: lo trae la sala al conectarte a tu LIVE (solo en directo).
//   Kick: la ficha pública de tu canal (aunque no estés en directo).
//   Starvios: tu perfil público, si lo publica.
// Se guarda en account-stats.json con la hora en que se leyó, y cada
// seguidor nuevo que llega en el directo suma 1 mientras tanto.

const fs = require('fs');
const path = require('path');

const PLATFORMS = ['tiktok', 'kick', 'starvios'];

function createAccountStats({ dataDir, broadcast = () => {}, readers = {}, getChannel = () => '', onChange = () => {}, now = () => Date.now() }) {
  const file = path.join(dataDir, 'account-stats.json');
  let data = {};
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch { /* primera vez */ }
  for (const p of PLATFORMS) data[p] = { followers: null, ts: 0, error: '', ...(data[p] || {}) };

  let saveTimer = null;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { fs.writeFileSync(file, JSON.stringify(data)); } catch { /* sin disco */ } }, 400);
  };
  const changed = () => { save(); broadcast('account-stats', snapshot()); onChange(totals()); };

  function snapshot() {
    return Object.fromEntries(PLATFORMS.map((p) => [p, { ...data[p], channel: getChannel(p) || '', canRead: Boolean(readers[p]) }]));
  }
  // { tiktok: 2300, kick: 159 } solo con los que se conocen.
  function totals() {
    return Object.fromEntries(PLATFORMS.filter((p) => Number.isFinite(data[p].followers)).map((p) => [p, data[p].followers]));
  }

  function set(platform, followers, from = 'leído') {
    if (!PLATFORMS.includes(platform)) return;
    const n = Math.round(Number(followers));
    if (!Number.isFinite(n) || n < 0) return;
    data[platform] = { followers: n, ts: now(), error: '', from };
    changed();
  }

  // Un seguidor nuevo en el directo: +1 hasta la próxima lectura.
  function onEvent(e) {
    if (e.type !== 'follow' || e.test || !PLATFORMS.includes(e.platform)) return;
    if (!Number.isFinite(data[e.platform].followers)) return;
    data[e.platform].followers += 1;
    changed();
  }

  const busy = {};
  async function refresh(platform) {
    const read = readers[platform];
    const channel = getChannel(platform);
    if (!read || !channel || busy[platform]) return data[platform];
    busy[platform] = true;
    try {
      const n = await read(channel);
      if (Number.isFinite(n)) set(platform, n);
      else { data[platform].error = 'Esta plataforma no dio el número.'; changed(); }
    } catch (err) {
      data[platform].error = String(err?.message || err).slice(0, 140);
      changed();
    } finally {
      busy[platform] = false;
    }
    return data[platform];
  }
  const refreshAll = () => Promise.all(PLATFORMS.map((p) => refresh(p)));

  // Cada 5 minutos se vuelve a leer (lo que no se puede leer se salta solo).
  const timer = setInterval(() => { refreshAll().catch(() => {}); }, 5 * 60 * 1000);
  timer.unref?.();
  setTimeout(() => { refreshAll().catch(() => {}); }, 4000).unref?.();

  return { snapshot, totals, set, onEvent, refresh, refreshAll, stop: () => clearInterval(timer) };
}

module.exports = { createAccountStats, PLATFORMS };
