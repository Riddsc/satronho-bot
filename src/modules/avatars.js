// Fotos de perfil de la gente del chat (para Espectadores especiales y el
// buscador). TikTok y Starvios mandan la foto en cada mensaje; Kick y
// Twitch se buscan aparte. Se guardan en avatars.json una semana.

const fs = require('fs');
const path = require('path');

const WEEK = 7 * 24 * 3600e3;
const DAY = 24 * 3600e3;

function createAvatars({ dataDir, fetch: fetchFn = fetch, kickPicture = async () => '', known = () => '' }) {
  const file = path.join(dataDir, 'avatars.json');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { cache = {}; }
  let saveTimer = null;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { fs.writeFileSync(file, JSON.stringify(cache)); } catch { /* sin disco */ } }, 1000);
  };
  const pending = new Map();

  // Lo que ya vimos en un mensaje (TikTok, Starvios) se recuerda sin buscar.
  function remember(platform, user) {
    const url = user?.avatar;
    if (!url || !/^https:\/\//.test(url)) return;
    for (const who of [user.id, user.name]) {
      if (!who) continue;
      cache[`${platform}:${String(who).toLowerCase()}`] = { url, ts: Date.now() };
    }
    save();
  }

  async function lookup(platform, who, id) {
    if (platform === 'kick') return kickPicture(id || who);
    if (platform === 'twitch') {
      const res = await fetchFn(`https://decapi.me/twitch/avatar/${encodeURIComponent(who)}`, { signal: AbortSignal.timeout(8000) });
      const txt = (await res.text()).trim();
      return /^https:\/\//.test(txt) ? txt : '';
    }
    return '';
  }

  async function resolve(platform, user, id = '') {
    const who = String(user || '').replace(/^@/, '').toLowerCase();
    if (!who) return '';
    const key = `${platform}:${who}`;
    const hit = cache[key];
    if (hit && Date.now() - hit.ts < (hit.url ? WEEK : DAY)) return hit.url;
    const seen = known(platform, who);
    if (seen) { cache[key] = { url: seen, ts: Date.now() }; save(); return seen; }
    if (pending.has(key)) return pending.get(key);
    const p = lookup(platform, who, id)
      .catch(() => '')
      .then((url) => { cache[key] = { url: url || '', ts: Date.now() }; save(); pending.delete(key); return url || ''; });
    pending.set(key, p);
    return p;
  }

  const cached = (platform, who) => cache[`${platform}:${String(who || '').toLowerCase()}`]?.url || '';
  return { resolve, remember, cached };
}

module.exports = { createAvatars };
