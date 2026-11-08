// Metas: barras de progreso que suben con los eventos.
// countBy: 'events' -> suma 1 por evento; 'amount' -> suma event.amount
// (útil para bits, cantidad de regalos o viewers de un raid).

function slugify(text) {
  return String(text || 'meta')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'meta';
}

const PLATS = ['all', 'tiktok', 'kick', 'starvios', 'twitch'];
const COLOR = /^#[0-9a-f]{6}$/i;

function createGoals({ store, broadcast }) {
  const list = () => store.get('goals');
  const save = (goals) => store.set('goals', goals);

  function handleEvent(e) {
    if (e.type === 'chat') return;
    const goals = list();
    const changed = [];
    for (const g of goals) {
      if (g.type !== e.type) continue;
      const plat = g.platform || 'all';
      if (plat !== 'all' && plat !== e.platform && e.platform !== 'test') continue;
      const before = g.current;
      g.current += g.countBy === 'amount' ? e.amount : 1;
      changed.push(g);
      if (before < g.target && g.current >= g.target) {
        broadcast('goal-complete', g);
      }
    }
    if (changed.length) {
      save(goals);
      for (const g of changed) broadcast('goal', g);
    }
  }

  function create({ title, type = 'follow', platform = 'all', countBy = 'events', target = 10, current = 0, color = '' }) {
    const goals = list();
    let id = slugify(title);
    while (goals.some((g) => g.id === id)) id += '-2';
    const goal = { id, title: title || 'Nueva meta', type, platform: PLATS.includes(platform) ? platform : 'all', countBy, current: Math.max(0, Number(current) || 0), target: Number(target) || 10, color: COLOR.test(color) ? color : '' };
    goals.push(goal);
    save(goals);
    broadcast('goal', goal);
    return goal;
  }

  function update(id, patch) {
    const goals = list();
    const g = goals.find((x) => x.id === id);
    if (!g) return null;
    for (const k of ['title', 'type', 'countBy']) if (patch[k] !== undefined) g[k] = patch[k];
    if (patch.platform !== undefined) g.platform = PLATS.includes(patch.platform) ? patch.platform : 'all';
    if (patch.color !== undefined) g.color = COLOR.test(patch.color) ? patch.color : '';
    const before = g.current;
    if (patch.current !== undefined) g.current = Math.max(0, Number(patch.current) || 0);
    if (patch.target !== undefined) g.target = Math.max(1, Number(patch.target) || 1);
    // Si la llevas a mano hasta el objetivo, también se celebra.
    if (patch.current !== undefined && before < g.target && g.current >= g.target) broadcast('goal-complete', g);
    save(goals);
    broadcast('goal', g);
    return g;
  }

  function remove(id) {
    const goals = list().filter((g) => g.id !== id);
    save(goals);
    broadcast('goal-removed', { id });
  }

  return { handleEvent, create, update, remove, list };
}

module.exports = { createGoals };
