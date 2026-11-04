// Escribir en el chat de Kick con la API oficial (OAuth 2.1 + PKCE).
//
// La app trae ya puesta la app de Kick «SatronhoBot» (se graba al empaquetar
// desde los secretos de GitHub Actions; ver builtinApp()). Así cada streamer
// solo pulsa «Autorizar mi cuenta de Kick» y el bot escribe con su cuenta.
//
// Cuentas que se pueden autorizar:
//   me  -> la cuenta del streamer (lo normal)
//   bot -> una cuenta aparte, por ejemplo SatronhoBot (en «Avanzado»)
// En «Avanzado» también se puede usar una app de Kick propia.
// El mensaje va al canal del streamer (el que está en Conexiones).
//
// Los tokens y el Client Secret propio se guardan solo en tu PC
// (%APPDATA%/Satronho Bot) y nunca se envían al panel.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// App de Kick incluida. Orden: variables de entorno (desarrollo) y luego
// src/builtin.json, que escribe scripts/release.mjs y no se sube a GitHub.
function builtinApp() {
  let file = {};
  try {
    file = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'builtin.json'), 'utf8')).kick || {};
  } catch {
    /* sin app incluida */
  }
  const clientId = process.env.SATRONHO_KICK_CLIENT_ID || file.clientId || '';
  const clientSecret = process.env.SATRONHO_KICK_CLIENT_SECRET || file.clientSecret || '';
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

const AUTH_URL = 'https://id.kick.com/oauth/authorize';
const TOKEN_URL = 'https://id.kick.com/oauth/token';
const API = 'https://api.kick.com/public/v1';
const SCOPES = 'user:read channel:read chat:write';

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function createKickChat({ store, fetch: fetchFn = fetch, redirectUri, onChange = () => {}, vault = null, builtin = builtinApp() }) {
  const pendingAuth = new Map(); // state -> { verifier, account, app, ts }
  const echoes = []; // lo que acabamos de enviar, para no leerlo en voz alta
  const sendQueue = [];
  let sending = false;
  const channelIds = new Map(); // slug -> broadcaster_user_id

  // Con la app de escritorio todo se guarda cifrado con la protección de
  // Windows (solo tu usuario, en este PC, puede leerlo). Sin ella, en claro.
  let cache = null;
  function secrets() {
    if (cache) return cache;
    const raw = store.get('secrets')?.kick || {};
    if (raw.enc && vault) {
      try {
        cache = JSON.parse(vault.decrypt(raw.enc));
      } catch {
        cache = {}; // se copió a otro PC o a otro usuario: hay que volver a pegarlos
      }
    } else {
      cache = raw.enc ? {} : { ...raw };
      if (vault && Object.keys(cache).length) persist(); // cifra lo que estaba en claro
    }
    return cache;
  }
  const merge = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? merge(a[k], v) : v;
    return out;
  };
  function persist() {
    const value = vault ? { enc: vault.encrypt(JSON.stringify(cache)) } : cache;
    store.set('secrets', { ...(store.get('secrets') || {}), kick: value });
  }
  const saveSecrets = (patch) => {
    cache = merge(secrets(), patch);
    persist();
    onChange(status());
  };

  // App con la que se trabaja: la propia (si hay una y está activada) o la incluida.
  const ownApp = (s = secrets()) => (s.clientId && s.clientSecret ? { clientId: s.clientId, clientSecret: s.clientSecret } : null);
  function currentApp() {
    const s = secrets();
    const own = ownApp(s);
    if (own && (s.useOwnApp !== false || !builtin)) return { ...own, kind: 'own' };
    return builtin ? { ...builtin, kind: 'builtin' } : null;
  }
  // Cada permiso se renueva con la misma app con la que se dio.
  function appFor(account) {
    const s = secrets();
    const id = s[account]?.appClientId;
    if (id && builtin && id === builtin.clientId) return builtin;
    const own = ownApp(s);
    if (id && own && id === own.clientId) return own;
    return id ? null : currentApp(); // permisos de versiones viejas: la app propia
  }

  // Lo que sí puede ver el panel (sin secretos).
  function status() {
    const s = secrets();
    const encrypted = Boolean(vault);
    const app = currentApp();
    const acc = (a) => {
      if (!s[a]?.accessToken) return { ok: false };
      const stale = !appFor(a); // se dio con una app que ya no está
      return { name: s[a].user?.name || '', ok: !stale, stale };
    };
    return {
      ready: Boolean(app),
      builtin: Boolean(builtin),
      ownApp: Boolean(ownApp(s)),
      usingOwn: app?.kind === 'own',
      clientId: s.clientId || '',
      me: acc('me'),
      bot: acc('bot'),
      sendAs: sendAsPref(),
      lastError: s.lastError || '',
      encrypted,
    };
  }

  function setApp({ clientId, clientSecret, useOwnApp }) {
    const patch = {};
    if (clientId !== undefined) patch.clientId = String(clientId).trim();
    if (clientSecret) patch.clientSecret = String(clientSecret).trim();
    if (useOwnApp !== undefined) patch.useOwnApp = Boolean(useOwnApp);
    saveSecrets(patch);
  }

  function forgetOwnApp() {
    saveSecrets({ clientId: '', clientSecret: '', useOwnApp: true });
  }

  // Paso 1: dirección de autorización de Kick.
  function authUrl(account = 'me') {
    const app = currentApp();
    if (!app) throw new Error(builtin ? 'Falta la app de Kick' : 'Esta copia no trae la app de Kick incluida: pega la tuya en «Avanzado»');
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(18));
    pendingAuth.set(state, { verifier, account: account === 'bot' ? 'bot' : 'me', app: { clientId: app.clientId, clientSecret: app.clientSecret }, ts: Date.now() });
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: app.clientId,
      redirect_uri: redirectUri,
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    });
    return `${AUTH_URL}?${q}`;
  }

  async function tokenRequest(app, params) {
    const res = await fetchFn(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ client_id: app.clientId, client_secret: app.clientSecret, ...params }).toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) throw new Error(data.error_description || data.message || `Kick respondió ${res.status}`);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
      appClientId: app.clientId,
    };
  }

  async function api(account, method, pathname, body) {
    const token = await validToken(account);
    const res = await fetchFn(`${API}${pathname}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Kick respondió ${res.status}`);
    return data;
  }

  // Paso 2: Kick vuelve a /auth/kick/callback con ?code=…&state=…
  async function finish({ code, state, error }) {
    if (error) throw new Error(`Kick no dio permiso (${error})`);
    const p = pendingAuth.get(state);
    pendingAuth.delete(state);
    if (!p || Date.now() - p.ts > 10 * 60 * 1000) throw new Error('La autorización caducó. Vuelve a pulsar «Autorizar».');
    const tokens = await tokenRequest(p.app, { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: p.verifier });
    saveSecrets({ [p.account]: tokens, lastError: '' });
    try {
      const me = await api(p.account, 'GET', '/users');
      const u = me.data?.[0] || {};
      saveSecrets({ [p.account]: { user: { id: u.user_id, name: u.name } } });
    } catch {
      /* el nombre es solo para mostrarlo */
    }
    return { account: p.account, name: secrets()[p.account]?.user?.name || '' };
  }

  async function validToken(account) {
    const a = secrets()[account];
    if (!a?.accessToken) throw new Error(account === 'bot' ? 'La cuenta aparte no está autorizada en Kick' : 'Tu cuenta no está autorizada en Kick');
    const app = appFor(account);
    if (!app) throw new Error('Cambiaste la app de Kick: vuelve a autorizar esta cuenta');
    if (a.expiresAt - Date.now() > 60 * 1000) return a.accessToken;
    if (!a.refreshToken) throw new Error('El permiso de Kick caducó. Vuelve a autorizar.');
    const t = await tokenRequest(app, { grant_type: 'refresh_token', refresh_token: a.refreshToken });
    saveSecrets({ [account]: t });
    return t.accessToken;
  }

  function logout(account) {
    saveSecrets({ [account]: { accessToken: '', refreshToken: '', expiresAt: 0, appClientId: '', user: null } });
  }

  async function broadcasterId(account, slug) {
    if (channelIds.has(slug)) return channelIds.get(slug);
    const data = await api(account, 'GET', `/channels?slug=${encodeURIComponent(slug)}`);
    const id = data.data?.[0]?.broadcaster_user_id;
    if (!id) throw new Error(`No encontré el canal de Kick «${slug}»`);
    channelIds.set(slug, id);
    return id;
  }

  // Por defecto escribe la cuenta del streamer; «bot» es la cuenta aparte.
  function sendAsPref() {
    return store.get('chatBot')?.kick?.sendAs === 'bot' ? 'bot' : 'me';
  }
  // Cuenta que escribe: la elegida y, si no está autorizada, la otra.
  function pickAccount() {
    const s = secrets();
    const usable = (a) => s[a]?.accessToken && appFor(a);
    const prefer = sendAsPref();
    const other = prefer === 'bot' ? 'me' : 'bot';
    if (usable(prefer)) return prefer;
    if (usable(other)) return other;
    return null;
  }

  // ¿Este mensaje del chat lo escribió la app? (para no leerlo en voz alta,
  // también cuando escribe con la cuenta del streamer).
  function isOwnMessage(name, text) {
    const s = secrets();
    const n = String(name || '').toLowerCase();
    const botName = String(s.bot?.user?.name || '').toLowerCase();
    if (botName && n === botName) return true;
    const now = Date.now();
    while (echoes.length && now - echoes[0].ts > 2 * 60 * 1000) echoes.shift();
    const t = String(text || '').trim();
    const i = echoes.findIndex((e) => e.text === t && (!e.name || e.name === n));
    if (i < 0) return false;
    echoes.splice(i, 1);
    return true;
  }

  // Enviar con calma (Kick limita los mensajes seguidos).
  function say(text) {
    const slug = (store.get('platforms').kick.channel || '').replace(/^@/, '').toLowerCase();
    if (!slug || !pickAccount()) return false;
    sendQueue.push({ text: String(text).slice(0, 480), slug });
    while (sendQueue.length > 10) sendQueue.shift();
    if (!sending) drain();
    return true;
  }

  async function drain() {
    sending = true;
    while (sendQueue.length) {
      const { text, slug } = sendQueue.shift();
      const account = pickAccount();
      if (!account) break;
      try {
        const id = await broadcasterId(account, slug);
        echoes.push({ text: text.trim(), name: String(secrets()[account]?.user?.name || '').toLowerCase(), ts: Date.now() });
        await api(account, 'POST', '/chat', { type: 'user', broadcaster_user_id: id, content: text });
        if (secrets().lastError) saveSecrets({ lastError: '' });
      } catch (err) {
        saveSecrets({ lastError: err.message });
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    sending = false;
  }

  return { status, setApp, forgetOwnApp, authUrl, finish, logout, say, isOwnMessage };
}

module.exports = { createKickChat, builtinApp };
