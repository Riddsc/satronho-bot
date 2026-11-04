// Música pedida por el chat (Ñoño).
//
// Comandos (los nombres se cambian en Música → Permisos y comandos):
//   !play / !temita <canción o enlace>  pide una canción
//   !skip      salta la que suena si la pidió él (tú y tus moderadores: cualquiera)
//   !quitar    quita de la cola su última canción
//   !cola      dice qué suena y qué sigue
//   !sonando   dice qué suena y quién la pidió
//   !mia       dice en qué puesto va su canción
//   !votar     vota para saltar la que suena; con N votos se salta
// Quién puede pedir se elige por plataforma (mismos roles que la voz).
// Los avisos salen en el panel, en el overlay y, con el Chat Bot, en el chat.

const { whoReason } = require('./roles');

const DEFAULT_CMDS = {
  play: ['play', 'temita'], skip: ['skip'], remove: ['quitar'], queue: ['cola'], now: ['sonando', 'cancion'], mine: ['mia'], vote: ['votar'],
};

const strip = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function createMusic({ store, broadcast, resolver, onSong = () => {} }) {
  let current = null;
  let queue = [];
  let history = []; // lo que ya sonó (más reciente primero)
  let paused = false;
  let playerId = null; // ventana que reproduce el audio
  let seq = 0;
  const pending = new Map(); // búsquedas en curso por usuario

  const cfg = () => store.get('music');
  const lastAsk = new Map(); // persona -> ts del último pedido
  let votes = new Set(); // quién votó para saltar la que suena
  // Alias de cada comando (sin «!», en minúsculas y sin tildes).
  function cmdOf(word) {
    const cmds = cfg().commands || {};
    for (const [k, def] of Object.entries(DEFAULT_CMDS)) {
      const c = cmds[k] || {};
      if (c.enabled === false) continue;
      const names = (c.names?.length ? c.names : def).map((n) => strip(String(n).replace(/^!/, '')));
      if (names.includes(word)) return k;
    }
    return '';
  }
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
  const keyOf = (user, platform) => `${platform}:${user.id}`;

  const playlists = () => store.get('musicPlaylists') || [];
  function snapshot() {
    return {
      current, queue, paused, volume: cfg().volume, enabled: cfg().enabled, playerId,
      history: history.slice(0, 40),
      playlists: playlists().map((p) => ({ id: p.id, name: p.name, count: p.songs.length, durationSec: p.songs.reduce((a, x) => a + (x.durationSec || 0), 0) })),
    };
  }
  const publish = () => broadcast('music', snapshot());
  const notice = (text, kind = 'info', user = null, platform = '') => broadcast('music-notice', { text, kind, user, platform, ts: Date.now() });

  function playNext() {
    if (current) {
      history.unshift({ ...current, playedAt: Date.now() });
      history = history.slice(0, 60);
    }
    current = queue.shift() || null;
    if (current) { current.startedAt = Date.now(); current.pausedMs = 0; current.pausedAt = 0; }
    paused = false;
    votes = new Set();
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
    const wait = Number(c.cooldownSec) || 0;
    if (key !== 'panel:streamer' && wait && Date.now() - (lastAsk.get(key) || 0) < wait * 1000) {
      const left = Math.ceil((wait * 1000 - (Date.now() - lastAsk.get(key))) / 1000);
      return notice(`${user.name}: espera ${left} s para pedir otra`, 'warn', user.name, platform);
    }
    lastAsk.set(key, Date.now());

    pending.set(key, (pending.get(key) || 0) + 1);
    broadcast('music-notice', { text: `Buscando «${query.slice(0, 60)}» para ${user.name}…`, kind: 'busy', user: user.name, platform, ts: Date.now() });
    try {
      const song = await resolver.resolve(query, { maxDurationSec: c.maxDurationMin * 60, copyright: c.copyright || 'avoid' });
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

  function skipOwn(user, platform, isMod) {
    if (!current) return;
    if (!isMod && current.requesterKey !== keyOf(user, platform)) {
      return notice(`${user.name}: solo puedes saltar tu propia canción (o vota con !${(cfg().commands?.vote?.names || DEFAULT_CMDS.vote)[0]})`, 'warn', user.name, platform);
    }
    notice(isMod && current.requesterKey !== keyOf(user, platform) ? `${user.name} saltó «${current.title}»` : `${user.name} saltó su canción`, 'info', user.name, platform);
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

  function sayQueue(user, platform) {
    if (!current && !queue.length) return notice('No suena nada. Pide una con !play', 'info', user.name, platform);
    const next = queue.slice(0, 3).map((s, i) => `${i + 1}) ${s.title.slice(0, 40)} (${s.requester})`).join(' · ');
    notice(`Sonando: ${current ? current.title.slice(0, 50) : '—'}${next ? ` · Siguen: ${next}` : ''}${queue.length > 3 ? ` · y ${queue.length - 3} más` : ''}`, 'info', user.name, platform);
  }
  function sayNow(user, platform) {
    if (!current) return notice('No suena nada ahora mismo', 'info', user.name, platform);
    notice(`Sonando: «${current.title}» de ${current.author || '—'}, la pidió ${current.requester} · youtu.be/${current.videoId}`, 'info', user.name, platform);
  }
  function sayMine(user, platform) {
    const key = keyOf(user, platform);
    if (current?.requesterKey === key) return notice(`${user.name}: ¡tu canción está sonando!`, 'ok', user.name, platform);
    const i = queue.findIndex((s) => s.requesterKey === key);
    if (i < 0) return notice(`${user.name}: no tienes canciones en la cola`, 'info', user.name, platform);
    const wait = (current ? Math.max(0, (current.durationSec || 0) - 0) : 0) + queue.slice(0, i).reduce((a, s) => a + (s.durationSec || 0), 0);
    notice(`${user.name}: «${queue[i].title.slice(0, 50)}» va de ${i + 1} en la cola (en unos ${Math.max(1, Math.round(wait / 60))} min)`, 'info', user.name, platform);
  }
  function vote(user, platform, isMod) {
    if (!current) return;
    const c = cfg();
    if (c.voteSkip?.enabled === false) return;
    if (isMod) { notice(`${user.name} saltó «${current.title}»`, 'info', user.name, platform); return playNext(); }
    const key = keyOf(user, platform);
    if (votes.has(key)) return;
    votes.add(key);
    const need = Math.max(2, Number(c.voteSkip?.needed) || 3);
    if (votes.size >= need) {
      notice(`El chat votó y se saltó «${current.title}»`, 'info', user.name, platform);
      return playNext();
    }
    notice(`${user.name} votó para saltar (${votes.size}/${need})`, 'info', user.name, platform);
  }

  function handleEvent(e) {
    if (e.type !== 'chat') return;
    const c = cfg();
    if (!c.platforms[e.platform]) return;
    const m = e.message.trim().match(/^!(\S+)\s*([\s\S]*)$/);
    if (!m) return;
    const cmd = cmdOf(strip(m[1]));
    if (!cmd) return;
    // Quién puede usar la música en esta plataforma (las consultas son libres).
    if (['play', 'skip', 'remove', 'vote'].includes(cmd)) {
      const rule = c.who?.[e.platform] || {};
      const why = whoReason(e, rule.mode || 'all', { teamMinLevel: rule.teamMinLevel, sentGift: Boolean(store.get('ttsAllowed')?.[e.user.id]), giftName: store.get('tts')?.tiktokGate?.giftNames?.[0] });
      if (why) return notice(`${e.user.name}: no puedes pedir música (${why})`, 'warn', e.user.name, e.platform);
    }
    const isMod = !whoReason(e, 'mods');
    if (cmd === 'play') request(e.user, e.platform, m[2]);
    else if (cmd === 'skip') skipOwn(e.user, e.platform, isMod && c.modsSkip !== false);
    else if (cmd === 'remove') removeOwn(e.user, e.platform);
    else if (cmd === 'queue') sayQueue(e.user, e.platform);
    else if (cmd === 'now') sayNow(e.user, e.platform);
    else if (cmd === 'mine') sayMine(e.user, e.platform);
    else if (cmd === 'vote') vote(e.user, e.platform, isMod && c.modsSkip !== false);
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
      // Para la barra de progreso de los overlays: cuánto tiempo estuvo en pausa.
      if (current && Boolean(v) !== paused) {
        if (v) current.pausedAt = Date.now();
        else if (current.pausedAt) { current.pausedMs = (current.pausedMs || 0) + (Date.now() - current.pausedAt); current.pausedAt = 0; }
      }
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
    // ---------- Consola ----------
    shuffle() {
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      notice('Cola mezclada', 'info');
      publish();
    },
    move(id, to) {
      const i = queue.findIndex((s) => s.id === id);
      if (i < 0) return;
      const [song] = queue.splice(i, 1);
      queue.splice(Math.max(0, Math.min(queue.length, Number(to) || 0)), 0, song);
      publish();
    },
    // Añadir sin pasar por la búsqueda (resultados del panel, historial, listas).
    addSongs(songs, by = 'Streamer') {
      const c = cfg();
      let added = 0;
      for (const sng of songs) {
        if (!sng?.videoId || queue.length >= Math.max(c.maxQueue, 100)) break;
        if (current?.videoId === sng.videoId || queue.some((x) => x.videoId === sng.videoId)) continue;
        seq += 1;
        queue.push({ videoId: sng.videoId, title: sng.title || 'Sin título', author: sng.author || '', durationSec: sng.durationSec || 0, thumbnail: sng.thumbnail || `https://i.ytimg.com/vi/${sng.videoId}/mqdefault.jpg`, id: `s${Date.now()}-${seq}`, requester: by, requesterKey: 'panel:streamer', platform: 'panel', query: sng.title || '' });
        added++;
      }
      if (added && !current) playNext();
      else publish();
      return added;
    },
    clearHistory() {
      history = [];
      publish();
    },
    savePlaylist(name) {
      const songs = [current, ...queue].filter(Boolean).map(({ videoId, title, author, durationSec, thumbnail }) => ({ videoId, title, author, durationSec, thumbnail }));
      if (!songs.length) throw new Error('La cola está vacía: no hay nada que guardar');
      const pl = { id: `pl${Date.now()}`, name: String(name || '').trim().slice(0, 60) || `Lista ${playlists().length + 1}`, songs, createdAt: Date.now() };
      store.set('musicPlaylists', [...playlists(), pl]);
      publish();
      return pl;
    },
    addPlaylist(name, songs) {
      const pl = { id: `pl${Date.now()}`, name: String(name || '').slice(0, 60) || 'Lista', songs: songs.slice(0, 200), createdAt: Date.now() };
      store.set('musicPlaylists', [...playlists(), pl]);
      publish();
      return pl;
    },
    loadPlaylist(id, shuffle = false) {
      const pl = playlists().find((p) => p.id === id);
      if (!pl) throw new Error('Lista no encontrada');
      const songs = [...pl.songs];
      if (shuffle) songs.sort(() => Math.random() - 0.5);
      const n = controls.addSongs(songs, `Lista «${pl.name}»`);
      notice(`Añadí ${n} canciones de «${pl.name}»`, 'ok');
      return n;
    },
    renamePlaylist(id, name) {
      store.set('musicPlaylists', playlists().map((p) => (p.id === id ? { ...p, name: String(name || '').trim().slice(0, 60) || p.name } : p)));
      publish();
    },
    deletePlaylist(id) {
      store.set('musicPlaylists', playlists().filter((p) => p.id !== id));
      publish();
    },
  };

  return { handleEvent, snapshot, ...controls };
}

module.exports = { createMusic };
