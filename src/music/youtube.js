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
  return {
    videoId,
    title: b.title || 'Sin título',
    author: b.author || b.channel?.name || '',
    durationSec: Number(b.duration) || 0,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    isLive: Boolean(b.is_live),
    embeddable: ps.embeddable !== false,
    playable: !ps.status || ps.status === 'OK',
  };
}

function createYoutubeResolver({ fetch: fetchFn = fetch } = {}) {
  async function resolve(query, { maxDurationSec = 600 } = {}) {
    const yt = await getClient(fetchFn);
    const usable = (v) => v.playable && v.embeddable && !v.isLive && v.durationSec > 0 && v.durationSec <= maxDurationSec;

    const id = parseVideoId(query);
    if (id) {
      const v = await details(yt, id);
      if (v.isLive) throw new Error('No se pueden pedir directos');
      if (!v.embeddable || !v.playable) throw new Error('Ese video no se puede reproducir fuera de YouTube');
      if (v.durationSec > maxDurationSec) throw new Error(`Es muy larga (máximo ${Math.round(maxDurationSec / 60)} min)`);
      return v;
    }

    const search = await yt.search(query, { type: 'video' });
    const candidates = (search.videos || [])
      .filter((v) => v.video_id && !v.is_live && (v.duration?.seconds || 0) > 0)
      .slice(0, 6);
    if (!candidates.length) throw new Error('No encontré esa canción');

    // Revisamos los primeros resultados hasta dar con uno que se pueda
    // incrustar y que no pase del límite de duración.
    for (const c of candidates.slice(0, 4)) {
      if ((c.duration?.seconds || 0) > maxDurationSec) continue;
      try {
        const v = await details(yt, c.video_id);
        if (usable(v)) return v;
      } catch {
        // Si falla la ficha, usamos lo que dio la búsqueda.
        return {
          videoId: c.video_id,
          title: textOf(c.title),
          author: textOf(c.author?.name),
          durationSec: c.duration?.seconds || 0,
          thumbnail: `https://i.ytimg.com/vi/${c.video_id}/mqdefault.jpg`,
        };
      }
    }
    throw new Error(`No encontré una versión de menos de ${Math.round(maxDurationSec / 60)} min que se pueda reproducir`);
  }

  return { resolve };
}

module.exports = { createYoutubeResolver, parseVideoId };
