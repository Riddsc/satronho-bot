// Conector de Kick: solo lee el chat (para la voz y la música).
//
// Cómo funciona: Kick usa un servicio de tiempo real (Pusher, y está
// migrando a Centrifugo) para su propio chat web. Pedimos a Kick qué
// servicio usar, nos suscribimos al canal público del chat y leemos los
// mensajes. No es una API oficial: si Kick cambia algo, puede romperse.
// No hace falta iniciar sesión.

const crypto = require('crypto');
const WebSocket = require('ws');
const { createConnectorBase, cleanChannel, getJson } = require('./base');

// Clave pública histórica del chat web de Kick. Solo se usa si el
// descubrimiento falla. Puede dejar de funcionar en cualquier momento.
const LEGACY_PUSHER = { app_key: '32cbd69e4b950bf97679', cluster: 'us2' };

function createKickConnector({ bus, onStatus, fetch: fetchFn = fetch }) {
  const base = createConnectorBase({ platform: 'kick', bus, onStatus });
  let socket = null;
  let refreshTimer = null;
  let info = null; // { channelId, chatroomId }

  function handle(eventName, rawData) {
    if (!String(eventName || '').endsWith('ChatMessageEvent')) return;
    let d = rawData;
    if (typeof d === 'string') {
      try {
        d = JSON.parse(d);
      } catch {
        return;
      }
    }
    if (!d?.sender) return;
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
      } else if (m.event === 'pusher_internal:subscription_succeeded') {
        base.resetBackoff();
        base.status('connected');
      } else if (m.event === 'pusher:ping') {
        ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      } else if (m.event === 'pusher:error') {
        base.status('error', 'Kick rechazó la conexión');
        ws.close();
      } else {
        handle(m.event, m.data);
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
    if (!token) throw new Error('Kick no entregó el token temporal');

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
        if (r.error) {
          base.status('error', `Kick: ${r.error.message || r.error.code}`);
          ws.close();
          return;
        }
        if (r.id === 1 && r.connect) {
          ws.send(JSON.stringify({ id: 2, subscribe: { channel: topic() } }));
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
        if (pub) handle(pub.event, pub.data);
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

  return { connect, disconnect };
}

module.exports = { createKickConnector };
