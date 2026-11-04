// Escribir en el chat de Starvios.
//
// Starvios no tiene API para desarrolladores. Su web inicia sesión con
// Supabase y envía el chat con la función `send_live_message`. Hacemos lo
// mismo: el streamer inicia sesión en una ventana de la app (su cuenta o
// una cuenta aparte para el bot), la app guarda esa sesión cifrada y la
// renueva sola cuando caduca.
//
// Cuentas: me (tu cuenta) y bot (una cuenta aparte). Escribe en el canal
// que está en Conexiones → Escuchar.

const { getJson } = require('./base');
const { discoverConfig } = require('./starvios');

function createStarviosChat({ store, fetch: fetchFn = fetch, onChange = () => {}, vault = null, openLogin = null }) {
  let config = null; // { url, key } públicos de Starvios
  const sendQueue = [];
  let sending = false;
  const echoes = [];
  let streamCache = { channel: '', id: '', ts: 0 };

  // ---- Sesiones guardadas (cifradas con la protección de Windows) ----
  let cache = null;
  function secrets() {
    if (cache) return cache;
    const raw = store.get('secrets')?.starvios || {};
    if (raw.enc && vault) {
      try {
        cache = JSON.parse(vault.decrypt(raw.enc));
      } catch {
        cache = {};
      }
    } else {
      cache = raw.enc ? {} : { ...raw };
    }
    return cache;
  }
  function saveSecrets(patch) {
    cache = { ...secrets(), ...patch };
    const value = vault ? { enc: vault.encrypt(JSON.stringify(cache)) } : cache;
    store.set('secrets', { ...(store.get('secrets') || {}), starvios: value });
    onChange(status());
  }

  const sendAsPref = () => (store.get('chatBot')?.starvios?.sendAs === 'bot' ? 'bot' : 'me');

  function status() {
    const s = secrets();
    const acc = (a) => (s[a]?.refreshToken ? { ok: true, name: s[a].user?.name || '' } : { ok: false });
    return { me: acc('me'), bot: acc('bot'), sendAs: sendAsPref(), lastError: s.lastError || '', canLogin: Boolean(openLogin), encrypted: Boolean(vault) };
  }

  async function cfg() {
    if (!config) config = await discoverConfig(fetchFn);
    return config;
  }

  async function rest(pathname, { method = 'GET', token, body } = {}) {
    const c = await cfg();
    const res = await fetchFn(`${c.url}${pathname}`, {
      method,
      headers: {
        apikey: c.key,
        Authorization: `Bearer ${token || c.key}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.msg || data.error_description || `Starvios respondió ${res.status}`);
    return data;
  }

  // Guarda la sesión que la ventana de inicio de sesión leyó de starvios.com.
  async function saveSession(account, session) {
    const userId = session.user?.id || '';
    let name = session.user?.user_metadata?.username || session.user?.email || '';
    try {
      const c = await cfg();
      const rows = await getJson(fetchFn, `${c.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=username,display_name&limit=1`, { headers: { apikey: c.key } });
      if (rows[0]) name = rows[0].username || rows[0].display_name || name;
    } catch {
      /* el nombre es solo para mostrarlo */
    }
    saveSecrets({
      [account]: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: (Number(session.expires_at) || Date.now() / 1000 + 3600) * 1000,
        user: { id: userId, name },
      },
      lastError: '',
    });
    return { account, name };
  }

  // Abre la ventana de starvios.com; al iniciar sesión, la app toma la sesión.
  async function login(account = 'me') {
    if (!openLogin) throw new Error('Iniciar sesión en Starvios solo funciona en la app de escritorio');
    const acc = account === 'bot' ? 'bot' : 'me';
    const session = await openLogin('starvios', acc);
    if (!session?.refresh_token) return { cancelled: true };
    return saveSession(acc, session);
  }

  function logout(account) {
    saveSecrets({ [account === 'bot' ? 'bot' : 'me']: null });
  }

  async function validToken(account) {
    const a = secrets()[account];
    if (!a?.refreshToken) throw new Error('Inicia sesión en Starvios');
    if (a.expiresAt - Date.now() > 60 * 1000) return a.accessToken;
    const data = await rest('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: a.refreshToken } });
    if (!data.access_token) throw new Error('La sesión de Starvios caducó: vuelve a iniciar sesión');
    saveSecrets({
      [account]: { ...a, accessToken: data.access_token, refreshToken: data.refresh_token || a.refreshToken, expiresAt: (Number(data.expires_at) || Date.now() / 1000 + 3600) * 1000 },
    });
    return data.access_token;
  }

  // Directo actual del canal del streamer.
  async function currentStream(channel) {
    if (streamCache.channel === channel && Date.now() - streamCache.ts < 60 * 1000) return streamCache.id;
    const c = await cfg();
    const prof = await getJson(fetchFn, `${c.url}/rest/v1/profiles?username=eq.${encodeURIComponent(channel)}&select=id&limit=1`, { headers: { apikey: c.key } });
    if (!prof[0]) throw new Error(`No existe el canal «${channel}» en Starvios`);
    const streams = await getJson(fetchFn, `${c.url}/rest/v1/live_streams?channel_id=eq.${prof[0].id}&select=id,status&order=started_at.desc.nullslast&limit=1`, { headers: { apikey: c.key } });
    if (!streams[0]) throw new Error('Tu canal de Starvios todavía no tiene directos');
    streamCache = { channel, id: streams[0].id, ts: Date.now() };
    return streams[0].id;
  }

  function pickAccount() {
    const s = secrets();
    const prefer = sendAsPref();
    const other = prefer === 'bot' ? 'me' : 'bot';
    if (s[prefer]?.refreshToken) return prefer;
    if (s[other]?.refreshToken) return other;
    return null;
  }

  function say(text) {
    const channel = String(store.get('platforms').starvios.channel || '').replace(/^@/, '').toLowerCase();
    if (!channel || !pickAccount()) return false;
    sendQueue.push({ text: String(text).slice(0, 400), channel });
    while (sendQueue.length > 10) sendQueue.shift();
    if (!sending) drain();
    return true;
  }

  async function drain() {
    sending = true;
    while (sendQueue.length) {
      const { text, channel } = sendQueue.shift();
      const account = pickAccount();
      if (!account) break;
      try {
        const token = await validToken(account);
        const streamId = await currentStream(channel);
        echoes.push({ text: text.trim(), name: String(secrets()[account]?.user?.name || '').toLowerCase(), ts: Date.now() });
        await rest('/rest/v1/rpc/send_live_message', { method: 'POST', token, body: { _stream_id: streamId, _body: text, _coins: 0 } });
        if (secrets().lastError) saveSecrets({ lastError: '' });
      } catch (err) {
        saveSecrets({ lastError: err.message });
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    sending = false;
  }

  // ¿Lo escribió la app? (para no leerlo en voz alta)
  function isOwnMessage(name, text) {
    const s = secrets();
    const n = String(name || '').toLowerCase();
    const botName = String(s.bot?.user?.name || '').toLowerCase();
    if (botName && n === botName) return true;
    const now = Date.now();
    while (echoes.length && now - echoes[0].ts > 2 * 60 * 1000) echoes.shift();
    const i = echoes.findIndex((e) => e.text === String(text || '').trim());
    if (i < 0) return false;
    echoes.splice(i, 1);
    return true;
  }

  return { status, login, saveSession, logout, say, isOwnMessage };
}

module.exports = { createStarviosChat };
