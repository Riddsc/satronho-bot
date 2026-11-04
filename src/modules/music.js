// Música pedida por el chat.
//
// Comandos (en Kick, Starvios y Twitch, sin importar mayúsculas):
//   !play <canción o enlace>    pide una canción
//   !temita <canción o enlace>  lo mismo
//   !skip                       salta la canción que suena, SOLO si la pidió él
//   !quitar                     quita de la cola su última canción pedida
//                               (si su canción ya está sonando, la salta)
//
// El streamer controla todo desde el panel: pausar, saltar cualquiera,
// quitar cualquiera, vaciar la cola, volumen y añadir canciones.
// No podemos responder en el chat (la conexión es de solo lectura), así
// que los avisos salen en el panel y en el overlay "Sonando ahora".

const PLAY = new Set(['play', 'temita']);
const SKIP = new Set(['skip']);
const REMOVE = new Set(['quitar']);

const strip = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function createMusic({ store, broadcast, resolver, onSong = () => {} }) {
  let current = null;
  let queue = [];
  let paused = false;
  let playerId = null; // ventana que reproduce el audio
  let seq = 0;
  const pending = new Map(); // búsquedas en curso por usuario

  const cfg = () => store.get('music');
  const keyOf = (user, platform) => `${platform}:${user.id}`;

  function snapshot() {
    return { current, queue, paused, volume: cfg().volume, enabled: cfg().enabled, playerId };
  }
  const publish = () => broadcast('music', snapshot());
  const notice = (text, kind = 'info', user = null, platform = '') => broadcast('music-notice', { text, kind, user, platform, ts: Date.now() });

  function playNext() {
    current = queue.shift() || null;
    paused = false;
    if (current) onSong(current);
    publish();
  }

  // ---------- Pedidos ----------
  async function request(user, platform, query) {
    const c = cfg();
    if (!c.enabled) return notice(`${user.name}: las peticiones están cerradas`, 'warn', user.name, platform);
    query = query.trim();
    if (!query) return notice(`${user.name}: escribe la canción después de !play`, 'warn', user.name, platform);

    const key = keyOf(user, platform);
    const mine =
      queue.filter((s) => s.requesterKey === key).length + (current?.requesterKey === key ? 1 : 0) + (pending.get(key) || 0);
    if (key !== 'panel:streamer' && mine >= c.maxPerUser) {
      return notice(`${user.name} ya tiene ${mine} canción(es) pedidas (máximo ${c.maxPerUser})`, 'warn', user.name, platform);
    }
    if (queue.length >= c.maxQueue) return notice('La cola está llena', 'warn', user.name, platform);

    pending.set(key, (pending.get(key) || 0) + 1);
    broadcast('music-notice', { text: `Buscando «${query.slice(0, 60)}» para ${user.name}…`, kind: 'busy', user: user.name, platform, ts: Date.now() });
    try {
      const song = await resolver.resolve(query, { maxDurationSec: c.maxDurationMin * 60 });
      if (current?.videoId === song.videoId || queue.some((s) => s.videoId === song.videoId)) {
        return notice(`«${song.title}» ya está en la cola`, 'warn', user.name, platform);
      }
      seq += 1;
      const item = { ...song, id: `s${Date.now()}-${seq}`, requester: user.name, requesterKey: key, platform, query };
      queue.push(item);
      notice(`${user.name} pidió «${song.title}»`, 'ok', user.name, platform);
      if (!current) playNext();
      else publish();
    } catch (err) {
      notice(`${user.name}: ${err.message || 'no pude buscar la canción'}`, 'error', user.name, platform);
    } finally {
      const n = (pending.get(key) || 1) - 1;
      if (n > 0) pending.set(key, n);
      else pending.delete(key);
    }
  }

  function skipOwn(user, platform) {
    if (!current) return;
    if (current.requesterKey !== keyOf(user, platform)) {
      return notice(`${user.name}: solo puedes saltar tu propia canción`, 'warn', user.name, platform);
    }
    notice(`${user.name} saltó su canción`, 'info', user.name, platform);
    playNext();
  }

  function removeOwn(user, platform) {
    const key = keyOf(user, platform);
    for (let i = queue.length - 1; i >= 0; i -= 1) {
      if (queue[i].requesterKey === key) {
        const [song] = queue.splice(i, 1);
        notice(`${user.name} quitó «${song.title}» de la cola`, 'info', user.name, platform);
        return publish();
      }
    }
    if (current?.requesterKey === key) {
      notice(`${user.name} quitó su canción`, 'info', user.name, platform);
      return playNext();
    }
    notice(`${user.name}: no tienes canciones en la cola`, 'warn', user.name, platform);
  }

  function handleEvent(e) {
    if (e.type !== 'chat') return;
    if (!cfg().platforms[e.platform]) return;
    const m = e.message.trim().match(/^!(\S+)\s*([\s\S]*)$/);
    if (!m) return;
    const cmd = strip(m[1]);
    if (PLAY.has(cmd)) request(e.user, e.platform, m[2]);
    else if (SKIP.has(cmd)) skipOwn(e.user, e.platform);
    else if (REMOVE.has(cmd)) removeOwn(e.user, e.platform);
  }

  // ---------- Controles del streamer ----------
  const controls = {
    add: (query) => request({ id: 'streamer', name: 'Streamer' }, 'panel', query),
    skip() {
      if (current) playNext();
    },
    remove(id) {
      if (current?.id === id) return playNext();
      queue = queue.filter((s) => s.id !== id);
      publish();
    },
    clear() {
      queue = [];
      publish();
    },
    setPaused(v) {
      paused = Boolean(v);
      publish();
    },
    setVolume(v) {
      store.update({ music: { volume: Math.max(0, Math.min(100, Number(v) || 0)) } });
      publish();
    },
    setEnabled(v) {
      store.update({ music: { enabled: Boolean(v) } });
      publish();
    },
    // Avisos del reproductor del panel.
    ended(id) {
      if (current?.id === id) playNext();
    },
    failed(id, code) {
      if (current?.id !== id) return;
      notice(`No se pudo reproducir «${current.title}» (YouTube ${code}). Paso a la siguiente.`, 'error', current.requester, current.platform);
      playNext();
    },
    setPlayer(clientId) {
      playerId = clientId;
      publish();
    },
  };

  return { handleEvent, snapshot, ...controls };
}

module.exports = { createMusic };
