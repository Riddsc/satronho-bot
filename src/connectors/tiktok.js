// Conector de TikTok LIVE (lectura).
//
// TikTok no tiene una API oficial pública para leer regalos y chat de un
// LIVE. Usamos la librería open source tiktok-live-connector (MIT), que
// se conecta al servicio interno "Webcast" de TikTok. Para conectarse
// necesita una "firma" que genera el servicio externo Euler Stream:
// sin clave funciona con límites de uso; con una clave propia (opcional,
// en Ajustes) es más rápido y estable. Puede romperse cuando TikTok
// cambia su sistema: hay que mantener la librería actualizada.

const { createConnectorBase, cleanChannel } = require('./base');

// La librería es un módulo ES: se carga con import() la primera vez que se
// usa (require() no funciona con ella dentro de Electron).
let lib = null;
async function loadLib() {
  lib ??= await import('tiktok-live-connector');
  return lib;
}

function userOf(data) {
  const u = data?.user || {};
  return {
    // uniqueId (@usuario) no cambia aunque cambie el apodo: lo usamos para
    // recordar quién envió el regalo "Quiéreme".
    id: u.uniqueId || u.userId || u.nickname,
    name: u.nickname || u.uniqueId || 'Anónimo',
    avatar: u.profilePicture?.url?.[0] || u.profilePicture?.urls?.[0],
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

function createTiktokConnector({ bus, onStatus, getSettings = () => ({}), onGifts = () => {} }) {
  const base = createConnectorBase({ platform: 'tiktok', bus, onStatus });
  let conn = null;
  let hostId = ''; // id de tu cuenta de TikTok (dueña del LIVE)

  function attach(c) {
    const { WebcastEvent, ControlEvent } = lib;
    c.on(WebcastEvent.CHAT, (d) => base.emit({ type: 'chat', user: userOf(d), message: d.comment || '', extra: { roles: rolesOf(d, hostId) } }));

    c.on(WebcastEvent.FOLLOW, (d) => base.emit({ type: 'follow', user: userOf(d) }));

    // Stickers (emotes) que manda el chat: alerta inmediata con su imagen.
    if (WebcastEvent.EMOTE) {
      c.on(WebcastEvent.EMOTE, (d) => {
        for (const em of (d.emoteList || []).slice(0, 3)) {
          base.emit({ type: 'sticker', user: userOf(d), extra: { stickerId: String(em.emoteId || ''), image: imgOf(em.image), roles: rolesOf(d, hostId) } });
        }
      });
    }
    // Alguien entra al LIVE.
    if (WebcastEvent.MEMBER) c.on(WebcastEvent.MEMBER, (d) => base.emit({ type: 'join', user: userOf(d) }));
    // Superfan nuevo.
    if (WebcastEvent.SUPER_FAN_JOIN) c.on(WebcastEvent.SUPER_FAN_JOIN, (d) => base.emit({ type: 'superfan', user: userOf(d) }));

    c.on(WebcastEvent.SHARE, (d) => base.emit({ type: 'share', user: userOf(d) }));

    c.on(WebcastEvent.LIKE, (d) => base.emit({ type: 'like', user: userOf(d), amount: Number(d.likeCount) || 1, extra: { totalLikes: d.totalLikeCount } }));

    // Suscripciones de TikTok: el nombre del evento cambia entre versiones
    // de la librería; usamos el que exista.
    const subEvent = WebcastEvent.SUBSCRIBE || WebcastEvent.SUB_NOTIFY;
    if (subEvent) {
      c.on(subEvent, (d) => base.emit({ type: 'sub', user: userOf(d), amount: Number(d.subMonth ?? d.months) || 1 }));
    }

    // Regalos en racha (giftType 1): TikTok repite el evento mientras la
    // racha sigue. Solo lo contamos cuando termina, con la cantidad final.
    c.on(WebcastEvent.GIFT, (d) => {
      const g = d.giftDetails || {};
      const streakable = g.giftType === 1;
      if (streakable && !d.repeatEnd) return;
      const count = Number(d.repeatCount) || 1;
      const unit = Number(g.diamondCount ?? d.extendedGiftInfo?.diamond_count ?? 0);
      base.emit({
        type: 'gift',
        user: userOf(d),
        amount: unit * count,
        message: '',
        extra: {
          giftId: String(d.giftId ?? g.id ?? d.extendedGiftInfo?.id ?? ''),
          giftName: g.giftName || d.extendedGiftInfo?.name || 'Regalo',
          count,
          unitValue: unit,
          currency: 'diamantes',
          image: g.giftImage?.giftPictureUrl || d.extendedGiftInfo?.image?.url_list?.[0],
        },
      });
    });

    // Espectadores en vivo (para el pico de las estadísticas).
    c.on(WebcastEvent.ROOM_USER, (d) => {
      if (!base.stopped && d?.viewerCount != null) bus.emit('viewers', { platform: 'tiktok', count: Number(d.viewerCount) || 0 });
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
      enableExtendedGiftInfo: true,
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
      // Catálogo de regalos: lo guardamos para «Alertas propias».
      try {
        const gifts = normalizeGifts(c.availableGifts || (await c.fetchAvailableGifts?.()));
        if (gifts.length) onGifts(gifts);
      } catch { /* sin catálogo: se llena con lo que llegue */ }
      base.resetBackoff();
      base.status('connected');
    } catch (err) {
      if (conn !== c) return;
      const text = String(err?.message || err);
      const offline = /offline|not live|UserOffline/i.test(text) || err?.constructor?.name === 'UserOfflineError';
      base.retry(run, offline ? 'El canal no está en directo' : text.slice(0, 140));
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

  return { connect, disconnect, fetchGifts };
}

module.exports = { createTiktokConnector };
