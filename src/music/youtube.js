// Busca canciones en YouTube sin clave de API, con youtubei.js (MIT).
// La reproducción NO descarga audio: el panel usa el reproductor oficial
// de YouTube incrustado, que es lo que YouTube permite.

let clientPromise = null;

function getClient(fetchFn) {
  clientPromise ??= import('youtubei.js')
    .then(({ Innertube }) =>
      Innertube.create({ lang: 'es', location: 'CO', retrieve_player: false, generate_session_locally: true, fetch: fetchFn })
    )
    .catch((err) => {
      clientPromise = null; // reintentar la próxima vez
      throw err;
    });
  return clientPromise;
}

// Acepta enlaces de youtube.com, youtu.be, shorts, music.youtube.com o el id.
function parseVideoId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return null;
    if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1, 12) || null;
    if (u.searchParams.get('v')) return u.searchParams.get('v').slice(0, 11);
    const m = u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const textOf = (t) => (t ? (typeof t === 'string' ? t : t.toString?.() || t.text || '') : '');

async function details(yt, videoId) {
  const info = await yt.getBasicInfo(videoId);
  const b = info.basic_info || {};
  const ps = info.playability_status || {};
  const status = String(ps.status || 'OK');
  const reason = String(ps.reason || '');
  // YouTube a veces responde «inicia sesión para confirmar que no eres un
  // bot» a la app aunque el video se vea normal en el reproductor del panel.
  // Eso no es un video bloqueado: lo dejamos pasar y, si de verdad no suena,
  // el reproductor avisa y salta a la siguiente.
  const botCheck = status === 'LOGIN_REQUIRED' && !/edad|age|privado|private|members|miembros/i.test(reason);
  return {
    videoId,
    title: b.title || 'Sin título',
    author: b.author || b.channel?.name || '',
    durationSec: Number(b.duration) || 0,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    isLive: Boolean(b.is_live),
    embeddable: ps.embeddable !== false,
    playable: status === 'OK' || botCheck,
    unsure: botCheck || status === 'ERROR',
    status,
  };
}

function createYoutubeResolver({ fetch: fetchFn = fetch, client = null } = {}) {
  // Derechos de autor:
  //   off   cualquier canción (el riesgo de silencio o reclamo es tuyo)
  //   avoid evita videos oficiales de sellos (VEVO, «- Topic», «Official Video»),
  //         que son los que más vigilan Kick, TikTok y YouTube. Baja el riesgo, no lo quita.
  //   free  solo música libre de derechos (NCS, StreamBeats, «no copyright»…).
  const OFFICIAL_AUTHOR = /(vevo$| - topic$|records$|music group$|\bsony music\b|\buniversal music\b|\bwarner\b)/i;
  const OFFICIAL_TITLE = /(official (music )?video|video oficial|official audio|audio oficial|official lyric|\(official\)|videoclip oficial)/i;
  const FREE = /(no ?copyright|copyright[ -]free|royalty[ -]free|free to use|libre de derechos|sin derechos de autor|\bncs\b|nocopyrightsounds|streambeats|audio library|lofi girl|chillhop|pixabay)/i;
  const isOfficial = (v) => OFFICIAL_AUTHOR.test(v.author || '') || OFFICIAL_TITLE.test(v.title || '');
  const isFree = (v) => FREE.test(`${v.title || ''} ${v.author || ''}`);
  function copyrightCheck(v, mode) {
    if (mode === 'avoid' && isOfficial(v)) return 'parece un video oficial de un sello (cuidado con los derechos de autor)';
    if (mode === 'free' && !isFree(v)) return 'solo pongo música libre de derechos';
    return '';
  }

  async function resolve(query, { maxDurationSec = 600, copyright = 'off' } = {}) {
    const yt = client || (await getClient(fetchFn));
    const usable = (v) => v.playable && v.embeddable && !v.isLive && v.durationSec > 0 && v.durationSec <= maxDurationSec && !copyrightCheck(v, copyright);

    const id = parseVideoId(query);
    if (id) {
      let v;
      try {
        v = await details(yt, id);
      } catch {
        // Sin ficha: la ponemos igual y el reproductor dirá si no suena.
        return { videoId: id, title: 'Video de YouTube', author: '', durationSec: 0, thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` };
      }
      if (v.isLive) throw new Error('No se pueden pedir directos');
      if (!v.embeddable || !v.playable) throw new Error('Ese video no se puede reproducir fuera de YouTube');
      if (v.durationSec > maxDurationSec) throw new Error(`Es muy larga (máximo ${Math.round(maxDurationSec / 60)} min)`);
      const why = copyrightCheck(v, copyright);
      if (why) throw new Error(`No la pongo: ${why}`);
      return v;
    }

    const search = await yt.search(copyright === 'free' && !FREE.test(query) ? `${query} no copyright music` : query, { type: 'video' });
    const candidates = (search.videos || [])
      .filter((v) => v.video_id && !v.is_live && (v.duration?.seconds || 0) > 0)
      .filter((v) => !copyrightCheck({ title: textOf(v.title), author: textOf(v.author?.name) }, copyright))
      .slice(0, 6);
    if (!candidates.length) throw new Error(copyright === 'off' ? 'No encontré esa canción' : copyright === 'free' ? 'No encontré una versión libre de derechos de esa canción' : 'Solo encontré versiones oficiales de sello; prueba con otra canción o con una versión en vivo, cover o letra');

    // Revisamos los resultados hasta dar con uno que se pueda incrustar y
    // que no pase del límite de duración. Si YouTube no deja revisar la
    // ficha (pasa a menudo), usamos lo que dio la búsqueda: el reproductor
    // del panel salta solo a la siguiente si ese video no suena.
    const fromSearch = (c) => ({
      videoId: c.video_id,
      title: textOf(c.title),
      author: textOf(c.author?.name),
      durationSec: c.duration?.seconds || 0,
      thumbnail: `https://i.ytimg.com/vi/${c.video_id}/mqdefault.jpg`,
    });
    const fits = candidates.filter((c) => (c.duration?.seconds || 0) <= maxDurationSec);
    if (!fits.length) throw new Error(`Todas las versiones que encontré duran más de ${Math.round(maxDurationSec / 60)} min. Pide otra o sube el límite en Música → Permisos y comandos.`);
    let backup = null;
    for (const c of fits.slice(0, 5)) {
      let v;
      try {
        v = await details(yt, c.video_id);
      } catch {
        return fromSearch(c);
      }
      if (usable(v)) return v;
      // No se puede incrustar o tiene restricción de edad: esa no sirve.
      if (!v.embeddable || v.status === 'AGE_CHECK_REQUIRED' || v.status === 'CONTENT_CHECK_REQUIRED') continue;
      backup ??= v.durationSec ? v : fromSearch(c);
    }
    if (backup) return backup;
    throw new Error('YouTube no deja poner esa canción fuera de su página. Prueba con otra versión: en vivo, cover o con letra.');
  }

  // Varios resultados para el buscador del panel (sin revisar cada ficha).
  async function search(query, { limit = 12 } = {}) {
    const q = String(query || '').trim();
    if (!q) return [];
    const yt = await getClient(fetchFn);
    const id = parseVideoId(q);
    if (id) {
      try {
        const v = await details(yt, id);
        return [{ videoId: v.videoId, title: v.title, author: v.author, durationSec: v.durationSec, thumbnail: v.thumbnail, isLive: v.isLive }];
      } catch {
        return [];
      }
    }
    const res = await yt.search(q, { type: 'video' });
    return (res.videos || [])
      .filter((v) => v.video_id)
      .slice(0, limit)
      .map((v) => ({
        videoId: v.video_id,
        title: textOf(v.title),
        author: textOf(v.author?.name),
        durationSec: v.duration?.seconds || 0,
        thumbnail: `https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`,
        isLive: Boolean(v.is_live),
      }));
  }

  // Canciones de una lista de YouTube (enlace con ?list=…), hasta 100.
  async function playlist(input) {
    let listId = '';
    try {
      listId = new URL(String(input).trim()).searchParams.get('list') || '';
    } catch {
      listId = /^(PL|OL|UU|FL|RD)[\w-]{10,}$/.test(String(input).trim()) ? String(input).trim() : '';
    }
    if (!listId) throw new Error('Pega el enlace de una lista de YouTube (con «list=» en la dirección)');
    const yt = await getClient(fetchFn);
    let pl = await yt.getPlaylist(listId);
    const title = textOf(pl.info?.title) || 'Lista de YouTube';
    const songs = [];
    const take = (items) => {
      for (const v of items || []) {
        const vid = v.id || v.video_id;
        if (!vid || songs.length >= 100) continue;
        songs.push({ videoId: vid, title: textOf(v.title), author: textOf(v.author?.name), durationSec: v.duration?.seconds || 0, thumbnail: `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` });
      }
    };
    take(pl.videos);
    while (songs.length < 100 && pl.has_continuation) {
      pl = await pl.getContinuation();
      take(pl.videos);
    }
    if (!songs.length) throw new Error('Esa lista está vacía o es privada');
    return { title, songs };
  }

  return { resolve, search, playlist };
}

module.exports = { createYoutubeResolver, parseVideoId };
