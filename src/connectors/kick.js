// Conector de Kick: lee el chat (para la voz y la música), los Kicks, los
// seguidores nuevos, las suscripciones y los canjes de la tienda del canal.
//
// Cómo funciona: Kick usa un servicio de tiempo real (Pusher, y está
// migrando a Centrifugo) para su propio chat web. Pedimos a Kick qué
// servicio usar, nos suscribimos al canal público del chat y leemos los
// mensajes. No es una API oficial: si Kick cambia algo, puede romperse.
// No hace falta iniciar sesión.

const crypto = require('crypto');
const fs = require('fs');
const WebSocket = require('ws');
const { createConnectorBase, cleanChannel, getJson } = require('./base');

// Clave pública histórica del chat web de Kick. Solo se usa si el
// descubrimiento falla. Puede dejar de funcionar en cualquier momento.
const LEGACY_PUSHER = { app_key: '32cbd69e4b950bf97679', cluster: 'us2' };

// Canje de la tienda del canal. Kick no documenta este evento en su chat
// público: aceptamos las formas conocidas y, si cambia, simplemente no sale.
//   { reward_title, username, user_input, reward_background_color, … }
//   o { reward: { title, cost, background_color }, redeemer|user: { username }, user_input }
function rewardOf(g) {
  if (!g || typeof g !== 'object') return null;
  const r = g.reward && typeof g.reward === 'object' ? g.reward : {};
  const who = g.redeemer || g.user || g.sender || {};
  const title = String(g.reward_title || r.title || r.name || g.title || '').trim();
  const user = String(g.username || g.user_name || who.username || who.slug || '').trim();
  if (!title || !user) return null;
  return {
    user: { id: g.user_id || who.id || user, name: user },
    title: title.slice(0, 80),
    input: String(g.user_input ?? g.input ?? g.message ?? '').slice(0, 300),
    color: String(g.reward_background_color || r.background_color || r.color || ''),
    cost: Number(r.cost ?? g.cost ?? g.points ?? 0) || 0,
    id: String(r.id || g.reward_id || ''),
  };
}

function createKickConnector({ bus, onStatus, fetch: fetchFn = fetch, diagFile = '' }) {
  const base = createConnectorBase({ platform: 'kick', bus, onStatus });
  let socket = null;
  let refreshTimer = null;
  let info = null; // { channelId, chatroomId }

  // Diagnóstico: qué eventos manda Kick y una muestra de los canjes (sin
  // mensajes del chat). Va en «Reportar un problema» para ver qué cambió.
  const diag = { since: Date.now(), events: {}, rewards: [] };
  let diagTimer = null;
  function note(name, data) {
    const short = name.split('\\').pop();
    diag.events[short] = (diag.events[short] || 0) + 1;
    if (/reward|redeem|redemption/i.test(short) && diag.rewards.length < 5) diag.rewards.push({ ts: new Date().toISOString(), event: short, keys: Object.keys(data || {}) });
    if (!diagFile || diagTimer) return;
    diagTimer = setTimeout(() => {
      diagTimer = null;
      try { fs.writeFileSync(diagFile, JSON.stringify(diag, null, 1)); } catch { /* sin disco */ }
    }, 5000);
  }

  // Seguidores: cada persona cuenta una vez por sesión (seguir, dejar de
  // seguir y volver a seguir no repite la alerta). Sin nombre, usamos el
  // total para saber si de verdad subió.
  const followed = new Set();
  let lastFollowers = null;
  function followOf(g) {
    if (!g || typeof g !== 'object') return null;
    const count = Number(g.followersCount ?? g.followers_count);
    const hasCount = Number.isFinite(count);
    const up = hasCount && lastFollowers != null ? count > lastFollowers : null;
    if (hasCount) lastFollowers = count;
    if (g.followed === false || up === false) return null;
    const user = String(g.username || g.user?.username || '').trim();
    if (user) {
      const key = user.toLowerCase();
      if (followed.has(key)) return null;
      followed.add(key);
      return { user: { id: g.user_id || g.user?.id || user, name: user }, count: hasCount ? count : null };
    }
    if (g.followed !== true && up !== true) return null;
    if (dupe(`f|${hasCount ? count : Date.now()}`)) return null;
    return { user: { id: `kick-follow-${hasCount ? count : Date.now()}`, name: 'Alguien nuevo' }, count: hasCount ? count : null };
  }

  // Un mismo mensaje puede llegar por dos canales: no lo repetimos.
  const seen = new Map();
  function dupe(key) {
    const now = Date.now();
    if (now - (seen.get(key) || 0) < 4000) return true;
    seen.set(key, now);
    if (seen.size > 400) for (const [k, t] of seen) if (now - t > 4000) seen.delete(k);
    return false;
  }

  // «from»: el canal por donde llegó. Chat y Kicks solo se toman del canal
  // del chat de siempre (así nada sale repetido); los canjes, de cualquiera.
  function handle(eventName, rawData, from = '') {
    const name = String(eventName || '');
    if (name.startsWith('pusher')) return;
    let parsed = rawData;
    try { if (typeof parsed === 'string') parsed = JSON.parse(parsed); } catch { parsed = null; }
    note(name, parsed);
    if (/reward|redeem|redemption/i.test(name)) {
      const r = rewardOf(parsed);
      if (!r || dupe(`r|${r.user.name}|${r.title}|${r.input}`)) return;
      base.emit({
        type: 'reward',
        user: r.user,
        amount: r.cost,
        message: r.input,
        extra: { rewardTitle: r.title, rewardId: r.id, color: r.color },
      });
      return;
    }
    // Nuevo seguidor. Kick lo avisa en el canal del canal (channel.<id>), no
    // en el del chat, por eso va antes del filtro de canales extra.
    //   { followersCount, channel_id, username, created_at, followed }
    // «followed: false» es dejar de seguir. A veces llega sin nombre.
    if (name.endsWith('FollowersUpdated')) {
      const f = followOf(parsed);
      if (f) base.emit({ type: 'follow', user: f.user, extra: { followers: f.count ?? undefined } });
      return;
    }
    if (from && extraTopics().includes(from)) return;
    // Suscripciones y suscripciones regaladas (canal del chat).
    if (name.endsWith('SubscriptionEvent') && !name.endsWith('GiftedSubscriptionsEvent') && !name.endsWith('LuckyUsersWhoGotGiftSubscriptionsEvent')) {
      const user = String(parsed?.username || parsed?.user?.username || '').trim();
      if (!user || dupe(`s|${user}`)) return;
      base.emit({ type: 'sub', user: { id: parsed?.user_id || user, name: user }, amount: Number(parsed?.months) || 1 });
      return;
    }
    if (name.endsWith('GiftedSubscriptionsEvent')) {
      const gifter = String(parsed?.gifter_username || parsed?.gifter?.username || '').trim() || 'Anónimo';
      const list = Array.isArray(parsed?.gifted_usernames) ? parsed.gifted_usernames : [];
      if (dupe(`gs|${gifter}|${list.join(',')}`)) return;
      base.emit({ type: 'sub', user: { id: gifter, name: gifter }, amount: list.length || 1, extra: { gifted: true, count: list.length || 1, recipients: list.slice(0, 20) } });
      return;
    }
    // Kicks (regalos de Kick). Kick no publica cómo es este evento: lo leemos
    // con cuidado y, si cambia, simplemente no sale.
    if (name.endsWith('KicksGifted')) {
      let g = rawData;
      try { if (typeof g === 'string') g = JSON.parse(g); } catch { return; }
      const gift = g?.gift || {};
      const sender = g?.sender || g?.user || {};
      if (!sender.username) return;
      base.emit({
        type: 'gift',
        user: { id: sender.id || sender.username, name: sender.username },
        amount: Number(gift.amount ?? g.amount ?? 0),
        message: g.message || '',
        extra: { giftId: String(gift.gift_id || gift.id || gift.name || ''), giftName: gift.name || 'Kicks', count: 1, currency: 'kicks', unitValue: Number(gift.amount ?? 0) },
      });
      return;
    }
    if (!name.endsWith('ChatMessageEvent')) return;
    let d = rawData;
    if (typeof d === 'string') {
      try {
        d = JSON.parse(d);
      } catch {
        return;
      }
    }
    if (!d?.sender) return;
    if (d.id && dupe(`m|${d.id}`)) return;
    base.emit({
      type: 'chat',
      user: { id: d.sender.id || d.sender.username, name: d.sender.username },
      message: d.content || '',
      // Insignias de Kick (broadcaster, moderator, bot…): sirven para no leer bots.
      extra: {
        badges: (d.sender.identity?.badges || []).map((b) => String(b.type || b.text || '').toLowerCase()).filter(Boolean),
        color: d.sender.identity?.color || '',
      },
    });
    // Emotes de Kick como stickers: una alerta corta por mensaje.
    const em = String(d.content || '').match(/\[emote:(\d+):([^\]]*)\]/);
    if (em) {
      base.emit({
        type: 'sticker',
        user: { id: d.sender.id || d.sender.username, name: d.sender.username },
        extra: { stickerId: em[1], stickerName: em[2], image: `https://files.kick.com/emotes/${em[1]}/fullsize` },
      });
    }
  }

  async function resolveChannel(slug) {
    const data = await getJson(fetchFn, `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`);
    if (!data?.chatroom?.id) throw new Error('Canal de Kick sin sala de chat');
    return { channelId: data.id, chatroomId: data.chatroom.id };
  }

  async function discoverProvider(channelId) {
    try {
      const clientId = crypto.randomUUID();
      const res = await getJson(fetchFn, `https://web.kick.com/api/v1/realtime/channels/${channelId}/chat/connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { id: clientId, type: 'web' },
          capabilities: { accepted_providers: [{ provider: 'pusher' }, { provider: 'centrifugo' }] },
        }),
      });
      const conn = res?.data?.connections?.[0];
      if (conn) return { ...conn, clientId };
    } catch {
      /* usamos la vía antigua */
    }
    return { provider: 'pusher', credentials: LEGACY_PUSHER };
  }

  const topic = () => `chatrooms.${info.chatroomId}.v2`;
  // Canales extra del canal (canjes de la tienda, etc.). Si Kick rechaza
  // alguno, el chat sigue funcionando igual.
  const extraTopics = () => [`chatroom_${info.chatroomId}`, `channel_${info.channelId}`, `channel.${info.channelId}`];

  function openPusher(creds) {
    if (!/^[a-z0-9]+$/i.test(creds.app_key) || !/^[a-z0-9-]+$/i.test(creds.cluster)) {
      throw new Error('Credenciales de Kick inesperadas');
    }
    const ws = new WebSocket(`wss://ws-${creds.cluster}.pusher.com/app/${creds.app_key}?protocol=7&client=js&version=8.4.0&flash=false`);
    ws.on('message', (raw) => {
      let m;
      try {
        m = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (m.event === 'pusher:connection_established') {
        ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel: topic() } }));
        for (const channel of extraTopics()) ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel } }));
      } else if (m.event === 'pusher_internal:subscription_succeeded') {
        if (m.channel && m.channel !== topic()) return;
        base.resetBackoff();
        base.status('connected');
      } else if (m.event === 'pusher:ping') {
        ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      } else if (m.event === 'pusher:error') {
        // Un canal extra rechazado no tumba el chat.
        if (m.channel && m.channel !== topic()) return;
        base.status('error', 'Kick rechazó la conexión');
        ws.close();
      } else {
        handle(m.event, m.data, m.channel);
      }
    });
    return ws;
  }

  async function openCentrifugo(conn) {
    const url = new URL(conn.credentials.url);
    if (url.protocol !== 'wss:' || !url.hostname.endsWith('.kick.com')) throw new Error('Dirección de Kick inesperada');
    const auth = await getJson(fetchFn, 'https://web.kick.com/api/v1/realtime/auth/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: conn.clientId }),
    });
    const token = auth?.data?.token;
    if (!token) throw new Error('Kick no respondió bien al conectar; se reintenta sola');

    const ws = new WebSocket(url);
    ws.on('open', () => ws.send(JSON.stringify({ id: 1, connect: { token, name: 'satronho-bot' } })));
    ws.on('message', (raw) => {
      // Centrifugo puede mandar varios JSON separados por saltos de línea.
      for (const line of String(raw).split('\n')) {
        if (!line.trim()) continue;
        let r;
        try {
          r = JSON.parse(line);
        } catch {
          continue;
        }
        if (Object.keys(r).length === 0) {
          ws.send('{}'); // ping -> pong
          continue;
        }
        // Error al suscribir un canal extra (id 3 en adelante): se ignora.
        if (r.error && r.id >= 3) continue;
        if (r.error) {
          base.status('error', `Kick: ${r.error.message || r.error.code}`);
          ws.close();
          return;
        }
        if (r.id === 1 && r.connect) {
          ws.send(JSON.stringify({ id: 2, subscribe: { channel: topic() } }));
          extraTopics().forEach((channel, i) => ws.send(JSON.stringify({ id: 3 + i, subscribe: { channel } })));
          // El token caduca: reconectamos un minuto antes.
          if (r.connect.ttl) {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => ws.close(), Math.max(30000, (r.connect.ttl - 60) * 1000));
          }
        }
        if (r.id === 2 && r.subscribe) {
          base.resetBackoff();
          base.status('connected');
        }
        const pub = r.push?.pub?.data;
        if (pub) handle(pub.event, pub.data, r.push?.channel);
        if (r.push?.disconnect) ws.close();
      }
    });
    return ws;
  }

  async function run() {
    if (base.stopped) return;
    try {
      base.status('connecting');
      info ??= await resolveChannel(base.channel);
      const conn = await discoverProvider(info.channelId);
      if (base.stopped) return;

      let ws;
      if (conn.provider === 'centrifugo') ws = await openCentrifugo(conn);
      else if (conn.provider === 'pusher') ws = openPusher(conn.credentials);
      else throw new Error(`Kick usa un servicio nuevo (${conn.provider}) que aún no soportamos`);
      if (base.stopped) {
        ws.close();
        return;
      }

      socket = ws;
      ws.on('error', () => {});
      ws.on('close', () => {
        clearTimeout(refreshTimer);
        if (socket === ws && !base.stopped) base.retry(run, 'Conexión cerrada');
      });
    } catch (err) {
      const hint = /HTTP 403/.test(err.message) ? 'Kick bloqueó la consulta (protección anti-bots)' : err.message;
      base.retry(run, hint);
    }
  }

  async function connect(channelName) {
    await disconnect();
    const slug = cleanChannel(channelName).toLowerCase();
    if (!slug) throw new Error('Falta el nombre del canal de Kick');
    info = null;
    followed.clear();
    lastFollowers = null;
    base.start(slug);
    run();
  }

  async function disconnect() {
    base.stop();
    clearTimeout(refreshTimer);
    const ws = socket;
    socket = null;
    if (ws) ws.close();
    base.status('disconnected');
  }

  // Tu total de seguidores y si estás en directo (ficha pública del canal).
  async function channelStats(slug) {
    const data = await getJson(fetchFn, `https://kick.com/api/v2/channels/${encodeURIComponent(cleanChannel(slug))}`);
    const n = Number(data?.followers_count ?? data?.followersCount ?? data?.followers);
    return { followers: Number.isFinite(n) ? n : null, live: Boolean(data?.livestream?.is_live ?? data?.livestream) };
  }

  return { connect, disconnect, channelStats, diagnostics: () => diag };
}

module.exports = { createKickConnector, rewardOf };
