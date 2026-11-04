// Alertas propias (Troya): reglas que el streamer arma a su gusto.
//
// Cada regla dice DE DÓNDE llega (TikTok, Kick, Starvios o cualquiera),
// QUÉ tiene que pasar y CÓMO sale (sonido, segundos, texto, imagen, voz):
//   gift         uno o varios regalos concretos (por id)
//   coins        cualquier regalo cuyo valor esté en un rango
//   likesPerson  cada N likes de una misma persona
//   likesTotal   cada N likes entre todos
//   follow · sub · share · join · superfan
//   sticker      uno o varios stickers concretos, o cualquiera
//   keyword      una palabra o frase en el chat
//   liveStart · liveEnd   empieza o termina tu directo
// «Solo la suya»: si la regla suena, la alerta de serie de ese evento no.
// «Las dos»: suenan ambas.

const TRIGGERS = ['gift', 'coins', 'likesPerson', 'likesTotal', 'follow', 'sub', 'share', 'sticker', 'join', 'superfan', 'keyword', 'liveStart', 'liveEnd'];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function createAlertRules({ store }) {
  const rules = () => (store.get('alertRules') || []).filter((r) => r && r.enabled !== false && TRIGGERS.includes(r.trigger));
  const lastFired = new Map(); // id regla -> ts
  const likesByUser = new Map(); // plataforma:usuario -> likes
  let likesTotal = 0;
  let lastLikeTs = 0;

  function resetSession() {
    likesByUser.clear();
    likesTotal = 0;
  }

  const platformOk = (r, e) => !r.platform || r.platform === 'any' || r.platform === e.platform;

  // ¿Esta regla se dispara con este evento? Devuelve cuántas veces (likes).
  function hits(r, e) {
    if (!platformOk(r, e)) return 0;
    const x = e.extra || {};
    switch (r.trigger) {
      case 'gift': {
        if (e.type !== 'gift') return 0;
        const ids = (r.gifts || []).map(String);
        const id = String(x.giftId || '');
        const name = norm(x.giftName);
        return ids.some((g) => g === id || norm(g) === name) ? 1 : 0;
      }
      case 'coins': {
        if (e.type !== 'gift') return 0;
        const v = Number(e.amount) || 0;
        const min = Number(r.min) || 0;
        const max = Number(r.max) || Infinity;
        return v >= min && v <= max ? 1 : 0;
      }
      case 'likesPerson': {
        if (e.type !== 'like') return 0;
        const every = Math.max(1, Number(r.every) || 100);
        const key = `${e.platform}:${e.user?.id || e.user?.name}`;
        const before = likesByUser.get(key) || 0;
        const after = before + (Number(e.amount) || 0);
        return Math.min(3, Math.floor(after / every) - Math.floor(before / every));
      }
      case 'likesTotal': {
        if (e.type !== 'like') return 0;
        const every = Math.max(1, Number(r.every) || 1000);
        const before = likesTotal;
        const after = before + (Number(e.amount) || 0);
        return Math.min(1, Math.floor(after / every) - Math.floor(before / every));
      }
      case 'sticker': {
        if (e.type !== 'sticker') return 0;
        const ids = (r.stickers || []).map(String);
        return !ids.length || ids.includes(String(x.stickerId)) ? 1 : 0;
      }
      case 'keyword': {
        if (e.type !== 'chat') return 0;
        const words = String(r.keyword || '').split(',').map(norm).filter(Boolean);
        const msg = norm(e.message);
        return words.some((w) => msg.includes(w)) ? 1 : 0;
      }
      case 'liveStart': return e.type === 'live-start' ? 1 : 0;
      case 'liveEnd': return e.type === 'live-end' ? 1 : 0;
      default: return e.type === r.trigger ? 1 : 0;
    }
  }

  // Devuelve [{ rule, times }] y actualiza los contadores de likes.
  function match(e) {
    const out = [];
    for (const r of rules()) {
      const n = hits(r, e);
      if (n <= 0) continue;
      const cd = Number(r.cooldownSec) || 0;
      const now = Date.now();
      if (cd && now - (lastFired.get(r.id) || 0) < cd * 1000) continue;
      lastFired.set(r.id, now);
      out.push({ rule: r, times: n });
    }
    if (e.type === 'like') {
      // Un rato sin likes (30 min) = otro directo: se empieza a contar de nuevo.
      if (Date.now() - lastLikeTs > 30 * 60000) resetSession();
      lastLikeTs = Date.now();
      const key = `${e.platform}:${e.user?.id || e.user?.name}`;
      likesByUser.set(key, (likesByUser.get(key) || 0) + (Number(e.amount) || 0));
      likesTotal += Number(e.amount) || 0;
    }
    return out;
  }

  // Texto de la alerta con variables: {usuario} {regalo} {cantidad} {valor} {likes} {plataforma}
  function render(text, e) {
    const x = e.extra || {};
    const vars = {
      usuario: e.user?.name || 'Alguien',
      regalo: x.giftName || '',
      cantidad: x.count || 1,
      valor: e.amount ?? '',
      likes: e.amount ?? '',
      sticker: x.stickerName || 'un sticker',
      mensaje: e.message || '',
      plataforma: { tiktok: 'TikTok', kick: 'Kick', starvios: 'Starvios', twitch: 'Twitch' }[e.platform] || '',
    };
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }

  return { match, render, resetSession, TRIGGERS };
}

module.exports = { createAlertRules, TRIGGERS };
