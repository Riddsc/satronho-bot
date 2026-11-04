// Podio en vivo (Juana): quién da más likes, más regalos o más mensajes en
// este directo. Lo usa el overlay del podio. Se reinicia al terminar el
// directo o con «Reiniciar podio». Cuenta también los eventos de prueba,
// para que puedas ver el podio con «Simular».

const METRICS = { likes: 'like', gifts: 'gift', chat: 'chat' };

function createLeaderboard({ broadcast }) {
  let users = new Map(); // plataforma:id -> { name, platform, avatar, likes, gifts, chat }
  let timer = null;

  function top(metric, n = 5) {
    return [...users.values()]
      .filter((u) => u[metric] > 0)
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, n)
      .map((u) => ({ name: u.name, platform: u.platform, avatar: u.avatar || '', value: u[metric] }));
  }
  const snapshot = () => Object.fromEntries(Object.keys(METRICS).map((m) => [m, top(m, 10)]));
  const push = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; broadcast('podium', snapshot()); }, 700);
  };

  function handleEvent(e) {
    if (!['like', 'gift', 'chat'].includes(e.type) || !e.user) return;
    const key = `${e.platform}:${e.user.id || e.user.name}`;
    const u = users.get(key) || { name: e.user.name, platform: e.platform, avatar: '', likes: 0, gifts: 0, chat: 0 };
    u.name = e.user.name || u.name;
    if (e.user.avatar) u.avatar = e.user.avatar;
    if (e.type === 'like') u.likes += Number(e.amount) || 0;
    if (e.type === 'gift') u.gifts += Number(e.amount) || 0;
    if (e.type === 'chat') u.chat += 1;
    users.set(key, u);
    push();
  }
  function reset() {
    users = new Map();
    broadcast('podium', snapshot());
  }
  return { handleEvent, reset, snapshot };
}

module.exports = { createLeaderboard };
