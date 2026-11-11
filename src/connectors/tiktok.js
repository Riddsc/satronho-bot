// Conector de TikTok LIVE (lectura).
//
// TikTok no tiene una API oficial pública para leer regalos y chat de un
// LIVE. Usamos la librería open source tiktok-live-connector (MIT), que
// se conecta al servicio interno "Webcast" de TikTok. Para conectarse
// necesita una "firma" que genera el servicio externo Euler Stream:
// sin clave funciona con límites de uso; con una clave propia (opcional,
// en Ajustes) es más rápido y estable. Puede romperse cuando TikTok
// cambia su sistema: hay que mantener la librería actualizada.

const fs = require('fs');
const { createConnectorBase, cleanChannel } = require('./base');

// La librería es un módulo ES: se carga con import() la primera vez que se
// usa (require() no funciona con ella dentro de Electron).
let lib = null;
async function loadLib() {
  lib ??= await import('tiktok-live-connector');
  return lib;
}

// La librería 2.x entrega los mensajes de TikTok en su formato nuevo
// (displayId, avatarThumb, content, gift…). Leemos el nuevo y, por si
// acaso, también el viejo (uniqueId, profilePicture, comment, giftDetails).
const firstUrl = (m) => m?.urlList?.[0] || m?.url_list?.[0] || m?.url?.[0] || m?.urls?.[0] || '';
function userOf(data) {
  const u = data?.user || {};
  // El @usuario no cambia aunque cambie el apodo: lo usamos para recordar a
  // la gente (regalo «Quiéreme», espectadores especiales).
  const handle = u.displayId || u.uniqueId || '';
  return {
    id: handle || u.id || u.userId || u.nickname || '',
    name: u.nickname || handle || 'Anónimo',
    avatar: firstUrl(u.avatarThumb) || firstUrl(u.avatarMedium) || firstUrl(u.profilePicture),
  };
}

// Quién es en tu LIVE. TikTok lo manda en cada mensaje del chat:
//   userIdentity: si te sigue, es suscriptor, moderador o eres tú.
//   Insignia «Fans» (tipo 10): es Miembro de tu equipo, con su nivel.
//   fansClub: su equipo «preferido»; solo cuenta si es el tuyo (hostId),
//   porque puede llevar la insignia del equipo de otro streamer.
function rolesOf(d, hostId) {
  const u = d?.user || {};
  const who = d?.userIdentity || {};
  const badges = Array.isArray(u.badgeList) ? u.badgeList : [];
  const scene = (b) => Number(b?.sceneType ?? b?.badgeSceneType);
  const fans = badges.find((b) => scene(b) === 10);
  let team = fans ? Number(fans.privilegeLogExtra?.level) || 1 : 0;
  const club = u.fansClub?.data;
  if (!team && club && Number(club.level) > 0 && hostId && String(club.anchorId) === String(hostId)) team = Number(club.level);
  return {
    follower: Boolean(who.isFollowerOfAnchor || who.isMutualFollowingWithAnchor),
    sub: Boolean(who.isSubscriberOfAnchor || badges.some((b) => [4, 7].includes(scene(b)))),
    mod: Boolean(who.isModeratorOfAnchor || badges.some((b) => scene(b) === 1)),
    host: Boolean(who.isAnchor),
    team, // 0 = no es del equipo; 1+ = nivel en tu equipo
  };
}

const imgOf = (m) => m?.urlList?.[0] || m?.url_list?.[0] || m?.url?.[0] || m?.imageUrl || '';

// Stickers. TikTok los manda de varias formas según la versión de la app:
//   - WebcastEmoteChatMessage (evento «emote»): emoteList;
//   - WebcastChatMessage: un comentario con stickers dentro (emotes[].emote);
//   - otros mensajes que también traen el sticker por dentro.
// Para no perder ninguno buscamos en todo el mensaje cualquier objeto con
// emoteId e imagen (findEmotes) y lo guardamos en el catálogo.
const emoteOf = (em) => (em && (em.emoteId || em.emote_id) ? {
  id: String(em.emoteId || em.emote_id),
  name: '',
  image: imgOf(em.image),
} : null);
function findEmotes(obj, out = new Map(), depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 8) return out;
  if (Array.isArray(obj)) { for (const v of obj) findEmotes(v, out, depth + 1); return out; }
  const em = emoteOf(obj);
  if (em && em.image) out.set(em.id, em);
  for (const [k, v] of Object.entries(obj)) if (k !== 'user' && v && typeof v === 'object') findEmotes(v, out, depth + 1);
  return out;
}

// Catálogo de regalos de la sala (lo que TikTok tiene disponible en tu LIVE).
function normalizeGifts(raw) {
  const list = Array.isArray(raw) ? raw : raw?.gifts || raw?.data?.gifts || [];
  return list
    .map((g) => ({
      id: String(g.id ?? g.gift_id ?? ''),
      name: g.name || g.describe || '',
      value: Number(g.diamond_count ?? g.diamondCount ?? 0),
      image: imgOf(g.image) || imgOf(g.icon),
    }))
    .filter((g) => g.id && g.name);
}

// Pide el catálogo con un tope de tiempo; nunca lanza error hacia afuera.
async function loadGifts(c, onGifts) {
  const { RouteConfig } = await loadLib();
  const within = (p) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('tiempo')), 10000))]);
  const tries = [
    () => RouteConfig.fetchRoomGiftsFromProvider({ apiClient: c.apiClient, webClient: c.webClient, roomId: c.roomId }),
    () => c.fetchAvailableGifts(),
  ];
  for (const t of tries) {
    try {
      const gifts = normalizeGifts(await within(t()));
      if (gifts.length) return onGifts(gifts);
    } catch { /* probamos la siguiente */ }
  }
}

function createTiktokConnector({ bus, onStatus, getSettings = () => ({}), onGifts = () => {}, onStickers = () => {}, onFollowers = () => {}, diagFile = '' }) {
  const base = createConnectorBase({ platform: 'tiktok', bus, onStatus });
  let conn = null;
  let hostId = ''; // id de tu cuenta de TikTok (dueña del LIVE)

  // Diagnóstico: qué tipos de mensaje manda TikTok en tu LIVE y cuáles traen
  // stickers. Se guarda en tiktok-diagnostico.json (va en «Reportar un
  // problema») para ver qué cambió si algo deja de llegar.
  const diag = { since: Date.now(), methods: {}, unknown: {}, stickerMethods: {}, samples: [] };
  let diagTimer = null;
  const saveDiag = () => {
    if (!diagFile || diagTimer) return;
    diagTimer = setTimeout(() => {
      diagTimer = null;
      try { fs.writeFileSync(diagFile, JSON.stringify(diag, null, 1)); } catch { /* sin disco */ }
    }, 5000);
  };

  // Un sticker que llega: alerta (si no salió ya por otro camino en el
  // mismo instante) y siempre al catálogo.
  const recentStk = new Map();
  function stickerFrom(d, em, via) {
    if (!em) return;
    const key = `${userOf(d).id}|${em.id}`;
    const now = Date.now();
    if (now - (recentStk.get(key) || 0) < 1500) return;
    recentStk.set(key, now);
    if (recentStk.size > 300) recentStk.clear();
    base.emit({ type: 'sticker', user: userOf(d), extra: { stickerId: em.id, image: em.image, via, roles: rolesOf(d, hostId) } });
  }

  function attach(c) {
    const { WebcastEvent, ControlEvent } = lib;
    c.on(WebcastEvent.CHAT, (d) => {
      const stickers = (d.emotes || []).map((x) => emoteOf(x?.emote || x)).filter(Boolean);
      const text = d.content ?? d.comment ?? '';
      // Un comentario que solo es un sticker no se lee ni sale como texto vacío.
      if (String(text).trim() || !stickers.length) base.emit({ type: 'chat', user: userOf(d), message: text, extra: { roles: rolesOf(d, hostId), stickers: stickers.length || undefined, stickerImgs: stickers.filter((s) => s.image).slice(0, 3).map((s) => ({ id: s.id, image: s.image })) } });
      for (const em of stickers.slice(0, 3)) stickerFrom(d, em, 'chat');
    });

    c.on(WebcastEvent.FOLLOW, (d) => base.emit({ type: 'follow', user: userOf(d) }));

    // Stickers (emotes) que manda el chat: alerta inmediata con su imagen.
    if (WebcastEvent.EMOTE) {
      c.on(WebcastEvent.EMOTE, (d) => {
        for (const em of (d.emoteList || []).slice(0, 3)) stickerFrom(d, emoteOf(em), 'emote');
      });
    }

    // Todo mensaje que traiga stickers por dentro entra al catálogo, venga
    // por donde venga, y queda anotado en el diagnóstico.
    c.on(ControlEvent.DECODED_DATA, (method, decoded) => {
      diag.methods[method] = (diag.methods[method] || 0) + 1;
      const found = [...findEmotes(decoded?.data).values()];
      if (!found.length) return saveDiag();
      diag.stickerMethods[method] = (diag.stickerMethods[method] || 0) + 1;
      if (diag.samples.length < 15) diag.samples.push({ ts: new Date().toISOString(), method, stickers: found.slice(0, 3) });
      // Solo al catálogo: las alertas salen del chat y del evento «emote»
      // (otros mensajes traen listas de stickers que nadie mandó).
      onStickers(found);
      saveDiag();
    });
    // Mensajes que la librería no sabe leer (TikTok estrenó algo nuevo).
    c.on(ControlEvent.WEBSOCKET_CONNECTED || 'websocketConnected', (ws) => {
      ws?.on?.('protoMessageFetchResult', (r) => {
        for (const m of r?.messages || []) {
          if (m.decodedData) continue;
          diag.unknown[m.method] = (diag.unknown[m.method] || 0) + 1;
          if (/emote|sticker|emoji/i.test(m.method) && diag.samples.length < 15) {
            diag.samples.push({ ts: new Date().toISOString(), method: m.method, unknown: true, payload: Buffer.from(m.payload || []).toString('base64').slice(0, 4000) });
          }
        }
        saveDiag();
      });
    });
    // Alguien entra al LIVE.
    if (WebcastEvent.MEMBER) c.on(WebcastEvent.MEMBER, (d) => base.emit({ type: 'join', user: userOf(d) }));
    // Superfan nuevo.
    if (WebcastEvent.SUPER_FAN_JOIN) c.on(WebcastEvent.SUPER_FAN_JOIN, (d) => base.emit({ type: 'superfan', user: userOf(d) }));

    c.on(WebcastEvent.SHARE, (d) => base.emit({ type: 'share', user: userOf(d) }));

    c.on(WebcastEvent.LIKE, (d) => base.emit({ type: 'like', user: userOf(d), amount: Number(d.count ?? d.likeCount) || 1, extra: { totalLikes: Number(d.total ?? d.totalLikeCount) || undefined } }));

    // Suscripciones de TikTok: el nombre del evento cambia entre versiones
    // de la librería; usamos el que exista.
    const subEvent = WebcastEvent.SUBSCRIBE || WebcastEvent.SUB_NOTIFY;
    if (subEvent) {
      c.on(subEvent, (d) => base.emit({ type: 'sub', user: userOf(d), amount: Number(d.subMonth ?? d.months) || 1 }));
    }

    // Regalos en racha (giftType 1): TikTok repite el evento mientras la
    // racha sigue. Solo lo contamos cuando termina, con la cantidad final.
    c.on(WebcastEvent.GIFT, (d) => {
      const g = d.gift || d.giftDetails || {};
      const streakable = Number(g.type ?? g.giftType) === 1;
      if (streakable && !Number(d.repeatEnd)) return;
      const count = Number(d.repeatCount) || 1;
      const unit = Number(g.diamondCount ?? d.extendedGiftInfo?.diamond_count ?? 0);
      base.emit({
        type: 'gift',
        user: userOf(d),
        amount: unit * count,
        message: '',
        extra: {
          giftId: String(d.giftId || g.id || d.extendedGiftInfo?.id || ''),
          giftName: g.name || g.giftName || d.extendedGiftInfo?.name || 'Regalo',
          count,
          unitValue: unit,
          currency: 'diamantes',
          image: firstUrl(g.image) || firstUrl(g.icon) || g.giftImage?.giftPictureUrl || d.extendedGiftInfo?.image?.url_list?.[0],
        },
      });
    });

    // Espectadores en vivo (para el pico de las estadísticas).
    c.on(WebcastEvent.ROOM_USER, (d) => {
      const n = d?.total ?? d?.viewerCount;
      if (!base.stopped && n != null) bus.emit('viewers', { platform: 'tiktok', count: Number(n) || 0 });
    });

    c.on(WebcastEvent.STREAM_END, () => {
      bus.emit('stream-end', { platform: 'tiktok' });
      base.status('disconnected', 'El LIVE terminó');
      base.retry(run, 'Esperando el próximo LIVE');
    });

    c.on(ControlEvent.DISCONNECTED, () => {
      if (!base.stopped && conn === c) base.retry(run, 'Conexión perdida');
    });
    c.on(ControlEvent.ERROR, () => {
      /* los errores se gestionan al conectar y al desconectar */
    });
  }

  async function run() {
    if (base.stopped) return;
    const old = conn;
    conn = null;
    if (old) {
      old.removeAllListeners?.();
      try {
        old.disconnect();
      } catch {
        /* ya cerrada */
      }
    }

    let TikTokLiveConnection;
    try {
      ({ TikTokLiveConnection } = await loadLib());
    } catch (err) {
      base.status('error', `No se pudo cargar el conector de TikTok: ${err.message}`);
      return;
    }
    if (base.stopped) return;

    const { signApiKey } = getSettings();
    const c = new TikTokLiveConnection(base.channel, {
      signApiKey: signApiKey || undefined,
      processInitialData: false, // no repetir el chat antiguo al conectar
      // El catálogo «extendido» de regalos necesita firmar la petición, y el
      // servicio de firmas ahora lo cobra (plan Business): si se pide al
      // conectar, la conexión entera falla. Se pide aparte, después.
      enableExtendedGiftInfo: false,
    });
    conn = c;
    attach(c);

    base.status('connecting');
    try {
      // Si TikTok no responde en 30 s, cancelamos y reintentamos.
      let timer;
      await Promise.race([
        c.connect(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('TikTok no respondió a tiempo')), 30000);
        }),
      ]).finally(() => clearTimeout(timer));
      if (base.stopped || conn !== c) return c.disconnect();
      const room = c.roomInfo || {};
      hostId = String(room.owner?.id_str || room.owner_user_id || room.data?.owner?.id_str || '');
      base.resetBackoff();
      base.status('connected');
      { const n = followersIn(room); if (n != null) onFollowers(n); }
      // Los stickers que la sala ya trae (los de tu equipo o suscripción).
      try { const s = [...findEmotes(room).values()]; if (s.length) onStickers(s); } catch { /* sin datos */ }
      // Catálogo de regalos para «Alertas propias», sin frenar la conexión:
      // primero el gratuito de Euler y, si no, el de TikTok. Si ninguno
      // responde, se llena solo con los regalos que vayan llegando.
      loadGifts(c, onGifts).catch(() => {});
    } catch (err) {
      if (conn !== c) return;
      const text = String(err?.message || err);
      const offline = /offline|not live|UserOffline/i.test(text) || err?.constructor?.name === 'UserOfflineError';
      // Mensajes en español en vez del inglés técnico de la librería.
      const why = offline ? 'El canal no está en directo'
        : /rate ?limit|too many/i.test(text) ? 'TikTok está limitando las conexiones; se reintenta sola en un momento'
        : /business plan|premium|permission|402|403/i.test(text) ? 'El servicio que conecta con TikTok rechazó la conexión; se reintenta sola'
        : /room id|SIGI_STATE|captcha|blocked/i.test(text) ? 'No encontré tu directo. Revisa que estés en vivo y que el usuario esté bien escrito'
        : /tiempo|timeout/i.test(text) ? 'TikTok no respondió a tiempo; se reintenta sola'
        : text.slice(0, 140);
      base.retry(run, why);
    }
  }

  // Catálogo de regalos. En LIVE: el de tu sala (incluye los de comunidad y
  // los de tu región). Sin LIVE: la lista general de TikTok.
  async function fetchGifts(channelName) {
    if (conn?.availableGifts) return normalizeGifts(conn.availableGifts);
    const { TikTokLiveConnection } = await loadLib();
    const user = cleanChannel(channelName || base.channel);
    const { signApiKey } = getSettings();
    const c = new TikTokLiveConnection(user || 'tiktok', { signApiKey: signApiKey || undefined });
    if (user) {
      try {
        await c.fetchRoomId(user);
        const room = normalizeGifts(await c.fetchAvailableGifts());
        if (room.length) return room;
      } catch { /* no está en LIVE: vamos con la lista general */ }
    }
    const res = await c.webClient.getJsonObjectFromWebcastApi('gift/list/', { ...c.webClient.clientParams }, false);
    return normalizeGifts(res?.data?.gifts || res?.data || []);
  }

  // Tu total de seguidores: viene en los datos de la sala (solo en LIVE).
  function followersIn(room) {
    const owner = room?.owner || room?.data?.owner || {};
    const n = Number(owner.follow_info?.follower_count ?? owner.followInfo?.followerCount ?? owner.stats?.followerCount);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  async function followers() {
    if (!conn) throw new Error('Se lee al conectarte a tu LIVE');
    let room = conn.roomInfo || {};
    try { room = (await conn.fetchRoomInfo?.()) || room; } catch { /* nos quedamos con la que hay */ }
    const n = followersIn(room);
    if (n == null) throw new Error('TikTok no mandó el número en esta sala');
    return n;
  }

  // «Buscar stickers»: vuelve a leer la sala si estás conectado.
  async function scanStickers() {
    if (!conn) return [];
    let room = conn.roomInfo || {};
    try { room = (await conn.fetchRoomInfo?.()) || room; } catch { /* nos quedamos con la que hay */ }
    const s = [...findEmotes(room).values()];
    if (s.length) onStickers(s);
    return s;
  }

  async function connect(channelName) {
    await disconnect();
    const user = cleanChannel(channelName);
    if (!user) throw new Error('Falta tu usuario de TikTok');
    base.start(user);
    run();
  }

  async function disconnect() {
    base.stop();
    const c = conn;
    conn = null;
    if (c) {
      c.removeAllListeners?.();
      try {
        c.disconnect();
      } catch {
        /* ya cerrada */
      }
    }
    base.status('disconnected');
  }

  return { connect, disconnect, fetchGifts, scanStickers, followers, diagnostics: () => diag };
}

module.exports = { createTiktokConnector };
