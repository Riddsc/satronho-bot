// Conector de Starvios: solo lee el chat (para la voz y la música).
//
// Starvios no publica una API para desarrolladores. Su web usa Supabase
// con una clave pública ("publishable") que va dentro de su propio código
// de cliente. Hacemos lo mismo que la web:
//   1. Leemos la configuración pública de starvios.com.
//   2. Buscamos el perfil del canal y su directo más reciente.
//   3. Nos unimos al canal de tiempo real "stream:<id>" y escuchamos.
//   4. Si el tiempo real falla, leemos el chat cada pocos segundos.
// No hace falta iniciar sesión.

const fs = require('fs');
const WebSocket = require('ws');
const { createConnectorBase, cleanChannel, getJson } = require('./base');

const SITE = 'https://starvios.com';

async function discoverConfig(fetchFn) {
  const res = await fetchFn(`${SITE}/`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Starvios no responde (HTTP ${res.status})`);
  const html = await res.text();
  const asset = html.match(/(?:href|src)="(\/assets\/client-[\w-]+\.js)"/)?.[1];
  if (!asset) throw new Error('Starvios cambió su web: actualiza Satronho Bot');
  const js = await (await fetchFn(SITE + asset, { signal: AbortSignal.timeout(15000) })).text();
  const url = js.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
  const key = js.match(/sb_publishable_[\w-]+/)?.[0];
  if (!url || !key) throw new Error('No se encontró la configuración pública de Starvios');
  return { url, key };
}

// Busca un número en varios nombres posibles de campo.
const numOf = (o, keys) => { for (const k of keys) { const v = Number(o?.[k]); if (Number.isFinite(v) && v > 0) return v; } return 0; };
const pickProfile = (row) => (Array.isArray(row?.profiles) ? row.profiles[0] : row?.profiles) || row?.profile || row?.user || row?.sender || null;
const avatarOf = (p) => p?.avatar_url || p?.avatar || p?.image_url || p?.photo_url || p?.picture || '';

function createStarviosConnector({ bus, onStatus, fetch: fetchFn = fetch, logFile = '' }) {
  const base = createConnectorBase({ platform: 'starvios', bus, onStatus });

  let config = null;
  let profile = null;
  let stream = null;
  let socket = null;
  let joined = false;
  let heartbeat = null;
  let pollTimer = null;
  let rejoinTimer = null;
  let cursor = null;
  let lastStreamCheck = 0;
  const seen = new Set();

  const rest = (table, params) => {
    const u = new URL(`${config.url}/rest/v1/${table}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return getJson(fetchFn, u.toString(), { headers: { apikey: config.key } });
  };

  // Foto de perfil de quien escribe (una vez por persona).
  async function fetchAvatar(uid) {
    avatars.set(uid, '');
    try {
      const rows = await rest('profiles', { id: `eq.${uid}`, select: '*', limit: 1 });
      const photo = avatarOf(rows[0]);
      if (photo) avatars.set(uid, photo);
    } catch { /* sin foto */ }
  }

  // Con todo el perfil: así llega también su foto.
  const CHAT_COLUMNS =
    'id,user_id,body,is_deleted,created_at,profiles:profiles!live_chat_messages_user_id_fkey(*)';
  const avatars = new Map(); // user_id -> foto, para los mensajes en tiempo real que no la traen

  // Lo que Starvios manda en tiempo real y todavía no conocemos (regalos,
  // seguidores…) se guarda en un archivo para poder leerlo bien después.
  let logged = 0;
  function logUnknown(m) {
    if (!logFile || logged >= 300) return;
    logged += 1;
    try { fs.appendFileSync(logFile, `${JSON.stringify({ ts: new Date().toISOString(), m })}\n`); } catch { /* sin disco */ }
  }

  // Regalos (Starvies), seguidores y espectadores: Starvios no publica su
  // formato, así que reconocemos los nombres de campo más probables.
  function deliverOther(inner) {
    const name = String(inner?.event || '');
    const body = inner?.payload?.msg || inner?.payload?.record || inner?.payload || {};
    const kind = `${name} ${body.type || body.kind || ''}`.toLowerCase();
    const p = pickProfile(body);
    const user = { id: body.user_id || body.sender_id || p?.id || p?.username || '', name: p?.display_name || p?.username || body.username || body.sender_name || 'Starvios' };
    const avatar = avatarOf(p) || avatars.get(user.id);
    if (avatar) user.avatar = avatar;
    if (/gift|starv|tip|donat|regalo|propina/.test(kind)) {
      const count = numOf(body, ['quantity', 'count', 'amount_count']) || 1;
      const amount = numOf(body, ['starvies', 'amount', 'value', 'coins', 'total', 'price']) || count;
      const id = String(body.id || `${user.id}-${Date.now()}`);
      if (seen.has(`g${id}`)) return;
      seen.add(`g${id}`);
      base.emit({ type: 'gift', user, amount, message: String(body.message || ''), extra: { giftName: body.gift_name || body.name || body.title || 'Starvies', count, unitValue: amount / count, currency: 'Starvies', image: body.image_url || body.icon_url || '' } });
      return true;
    }
    if (/follow|seguid/.test(kind) && user.id) {
      base.emit({ type: 'follow', user });
      return true;
    }
    const viewers = numOf(body, ['viewer_count', 'viewers', 'viewers_count', 'current_viewers']);
    if (viewers) { bus.emit('viewers', { platform: 'starvios', count: viewers }); return true; }
    return false;
  }

  function deliverChat(row) {
    if (!row?.id || row.is_deleted || typeof row.body !== 'string') return;
    const id = String(row.id);
    if (seen.has(id)) return;
    seen.add(id);
    if (seen.size > 3000) seen.delete(seen.values().next().value);
    const p = pickProfile(row);
    const name = p?.display_name || p?.username || 'Starvios';
    const uid = row.user_id || p?.username || name;
    const photo = avatarOf(p) || avatars.get(uid) || '';
    if (photo) avatars.set(uid, photo);
    else if (row.user_id && !avatars.has(uid)) fetchAvatar(uid);
    base.emit({ type: 'chat', user: { id: p?.username || uid, name, ...(photo ? { avatar: photo } : {}) }, message: row.body });
  }

  // ---- Tiempo real (protocolo Phoenix de Supabase Realtime) ----
  function subscribe() {
    if (base.stopped || !stream) return;
    clearInterval(heartbeat);
    clearTimeout(rejoinTimer);
    socket?.close();
    joined = false;

    const streamId = stream.id;
    const ws = new WebSocket(`${config.url.replace('https:', 'wss:')}/realtime/v1/websocket?apikey=${encodeURIComponent(config.key)}&vsn=1.0.0`);
    socket = ws;
    let ref = 1;
    const topic = `realtime:stream:${streamId}`;

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          topic,
          event: 'phx_join',
          payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: [], private: false } },
          ref: String(ref++),
          join_ref: '1',
        })
      );
      heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(ref++) }));
        }
      }, 25000);
    });

    ws.on('message', (raw) => {
      if (socket !== ws || stream?.id !== streamId) return;
      let m;
      try {
        m = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (m.event === 'phx_reply' && m.ref === '1') {
        joined = m.payload?.status === 'ok';
        if (joined) {
          base.resetBackoff();
          base.status('connected', stream.status === 'live' ? '' : 'Canal sin directo ahora');
        }
        return;
      }
      if (m.event === 'phx_error') return ws.close();
      if (m.event !== 'broadcast') return;

      const inner = m.payload || {};
      if (inner.event === 'msg') {
        const op = inner.payload?.op;
        const row = inner.payload?.msg;
        if (op !== 'UPDATE') deliverChat(row);
      } else if (!deliverOther(inner)) {
        logUnknown(m);
      }
    });

    ws.on('error', () => {});
    ws.on('close', () => {
      clearInterval(heartbeat);
      if (socket !== ws || base.stopped) return;
      joined = false;
      base.status('connecting', 'Tiempo real caído: leyendo el chat cada 2 s');
      rejoinTimer = setTimeout(subscribe, 5000);
    });
  }

  // ---- Bucle principal: localiza el canal/directo y hace de respaldo ----
  async function poll() {
    if (base.stopped) return;
    try {
      if (!config) {
        base.status('connecting', 'Leyendo la configuración de Starvios…');
        config = await discoverConfig(fetchFn);
      }
      if (!profile) {
        const rows = await rest('profiles', { username: `eq.${base.channel}`, select: 'id,username,display_name', limit: 1 });
        profile = rows[0];
        if (!profile) throw new Error(`No existe el canal «${base.channel}» en Starvios`);
      }
      if (Date.now() - lastStreamCheck > 15000) {
        const rows = await rest('live_streams', {
          channel_id: `eq.${profile.id}`,
          select: '*',
          order: 'started_at.desc.nullslast',
          limit: 1,
        });
        lastStreamCheck = Date.now();
        const next = rows[0];
        // Espectadores, si Starvios los guarda en el directo.
        const viewers = numOf(next, ['viewer_count', 'viewers', 'viewers_count', 'current_viewers']);
        if (viewers && next?.status === 'live') bus.emit('viewers', { platform: 'starvios', count: viewers });
        if (next && next.id !== stream?.id) {
          const firstLoad = !stream;
          stream = next;
          // Al conectar por primera vez no reproducimos el chat antiguo.
          cursor = firstLoad ? new Date().toISOString() : null;
          subscribe();
        } else if (next) {
          stream = next;
        }
      }
      if (!stream) {
        base.status('connecting', 'Canal encontrado · esperando su primer directo');
        pollTimer = setTimeout(poll, 15000);
        return;
      }

      // Respaldo: si el tiempo real no está unido, leemos el chat por REST.
      if (!joined) {
        const params = { stream_id: `eq.${stream.id}`, is_deleted: 'eq.false', select: CHAT_COLUMNS, order: 'created_at.asc', limit: 200 };
        const since = cursor || stream.chat_cleared_at;
        if (since) params.created_at = `gte.${since}`;
        const rows = await rest('live_chat_messages', params);
        for (const row of rows) deliverChat(row);
        cursor = rows.at(-1)?.created_at || cursor || new Date().toISOString();
      }
      base.resetBackoff();
      pollTimer = setTimeout(poll, joined ? 10000 : 2000);
    } catch (err) {
      base.retry(poll, err.message);
    }
  }

  async function connect(channelName) {
    await disconnect();
    const name = cleanChannel(channelName).toLowerCase();
    if (!name) throw new Error('Falta el nombre del canal de Starvios');
    config = null;
    profile = null;
    stream = null;
    cursor = null;
    lastStreamCheck = 0;
    seen.clear();
    base.start(name);
    poll();
  }

  async function disconnect() {
    base.stop();
    clearTimeout(pollTimer);
    clearTimeout(rejoinTimer);
    clearInterval(heartbeat);
    const ws = socket;
    socket = null;
    joined = false;
    if (ws) ws.close();
    base.status('disconnected');
  }

  return { connect, disconnect };
}

module.exports = { createStarviosConnector, discoverConfig };
