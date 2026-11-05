// Spotify (0.16): quien tenga Premium conecta su cuenta y la música pedida
// por el chat va a su cola de Spotify.
//
// Inicio de sesión con PKCE (sin contraseña ni «secret»): la app abre la
// página de Spotify, la persona acepta y Spotify vuelve a
//   http://127.0.0.1:<puerto>/auth/spotify/callback
// Los permisos (refresh token) se guardan en secrets.spotify.
//
// La app de Spotify for Developers la crea quien publica Satronho (Client ID
// incluido al empaquetar, secreto SPOTIFY_CLIENT_ID) o cada streamer pega
// la suya en Música → Spotify. Ojo: en modo desarrollo Spotify permite hasta
// 5 usuarios y quien creó la app debe tener Premium; cada cuenta se agrega
// en «User Management» de esa app.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function builtinClientId() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'builtin.json'), 'utf8')).spotify?.clientId || '';
  } catch {
    return '';
  }
}

function createSpotify({ store, fetchFn = fetch, broadcast = () => {}, port = 3800, builtin = builtinClientId() }) {
  const redirectUri = () => `http://127.0.0.1:${store.get('port') || port}/auth/spotify/callback`;
  const cfg = () => store.get('spotify') || {};
  const sec = () => store.get('secrets')?.spotify || {};
  const saveSec = (patch) => store.update({ secrets: { spotify: { ...sec(), ...patch } } });
  const clientId = () => String(cfg().clientId || '').trim() || builtin;
  let pendingAuth = null; // { verifier, state, ts }
  let access = { token: '', exp: 0 };
  let me = null;
  let now = null; // lo que suena en Spotify
  let pollTimer = null;
  let lastError = '';

  function status() {
    return {
      clientId: Boolean(clientId()),
      builtin: Boolean(builtin),
      own: Boolean(String(cfg().clientId || '').trim()),
      connected: Boolean(sec().refresh),
      user: me ? { name: me.display_name || me.id, premium: me.product === 'premium', image: me.images?.[0]?.url || '' } : null,
      now,
      showInOverlay: cfg().showInOverlay !== false,
      error: lastError,
      redirectUri: redirectUri(),
    };
  }
  const push = () => broadcast('spotify', status());

  // ---------- Iniciar sesión ----------
  function authUrl() {
    const id = clientId();
    if (!id) throw new Error('Falta el Client ID de Spotify: pégalo en Música → Spotify');
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(12));
    pendingAuth = { verifier, state, ts: Date.now(), id };
    const q = new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: redirectUri(), code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES, state });
    return `https://accounts.spotify.com/authorize?${q}`;
  }
  async function token(body) {
    const res = await fetchFn('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error_description || j.error || `Spotify respondió ${res.status}`);
    return j;
  }
  async function finish({ code, state, error }) {
    if (error) throw new Error(error === 'access_denied' ? 'No aceptaste el permiso' : error);
    if (!pendingAuth || state !== pendingAuth.state || Date.now() - pendingAuth.ts > 15 * 60000) throw new Error('El enlace venció: vuelve a pulsar «Conectar Spotify»');
    const j = await token({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), client_id: pendingAuth.id, code_verifier: pendingAuth.verifier });
    pendingAuth = null;
    access = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
    saveSec({ refresh: j.refresh_token, clientId: clientId() });
    lastError = '';
    await loadMe();
    start();
    push();
    return status();
  }
  async function accessToken() {
    if (access.token && Date.now() < access.exp) return access.token;
    const s = sec();
    if (!s.refresh) throw new Error('Spotify no está conectado');
    const j = await token({ grant_type: 'refresh_token', refresh_token: s.refresh, client_id: s.clientId || clientId() });
    access = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
    if (j.refresh_token) saveSec({ refresh: j.refresh_token });
    return access.token;
  }
  async function api(method, p, { query, body } = {}) {
    const url = `https://api.spotify.com/v1${p}${query ? `?${new URLSearchParams(query)}` : ''}`;
    for (let i = 0; i < 2; i += 1) {
      const res = await fetchFn(url, { method, headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      if (res.status === 401 && i === 0) { access = { token: '', exp: 0 }; continue; }
      if (res.status === 204 || res.status === 202) return null;
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = j?.error?.message || `Spotify respondió ${res.status}`;
        if (/NO_ACTIVE_DEVICE|No active device/i.test(msg) || j?.error?.reason === 'NO_ACTIVE_DEVICE') throw new Error('Abre Spotify y pon algo a sonar (no hay ningún dispositivo activo)');
        if (res.status === 403 && /premium/i.test(msg)) throw new Error('Para poner canciones en la cola, Spotify pide Premium');
        if (res.status === 403) throw new Error('Spotify no dio permiso. ¿Tu cuenta está agregada en la app de Spotify (User Management)?');
        throw new Error(msg);
      }
      return j;
    }
    return null;
  }
  async function loadMe() {
    try { me = await api('GET', '/me'); } catch (err) { lastError = err.message; }
  }
  function disconnect() {
    store.update({ secrets: { spotify: { refresh: '', clientId: '' } } });
    access = { token: '', exp: 0 };
    me = null;
    now = null;
    stop();
    push();
  }

  // ---------- Lo que suena ----------
  async function poll() {
    if (!sec().refresh) return;
    try {
      const j = await api('GET', '/me/player/currently-playing', { query: { additional_types: 'track' } });
      const t = j?.item;
      const next = t ? {
        id: t.id, uri: t.uri, title: t.name, author: (t.artists || []).map((a) => a.name).join(', '), album: t.album?.name || '',
        thumbnail: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '', durationSec: Math.round((t.duration_ms || 0) / 1000),
        progressMs: j.progress_ms || 0, playing: Boolean(j.is_playing), at: Date.now(), requester: requests.get(t.uri) || '',
      } : null;
      const changed = JSON.stringify({ ...now, at: 0, progressMs: 0 }) !== JSON.stringify({ ...next, at: 0, progressMs: 0 });
      now = next;
      lastError = '';
      if (changed) push();
    } catch (err) {
      if (err.message !== lastError) { lastError = err.message; push(); }
    }
  }
  function start() {
    stop();
    if (!sec().refresh) return;
    poll();
    pollTimer = setInterval(poll, 4000);
    pollTimer.unref?.();
  }
  function stop() { clearInterval(pollTimer); pollTimer = null; }

  // ---------- Pedidos del chat ----------
  const requests = new Map(); // uri -> quién la pidió
  async function search(q) {
    const uri = String(q).match(/open\.spotify\.com\/(?:intl-\w+\/)?track\/([A-Za-z0-9]+)/);
    if (uri) {
      const t = await api('GET', `/tracks/${uri[1]}`);
      return t;
    }
    const j = await api('GET', '/search', { query: { q: String(q).slice(0, 100), type: 'track', limit: '1' } });
    return j?.tracks?.items?.[0] || null;
  }
  async function request(q, requester = '') {
    const t = await search(q);
    if (!t) throw new Error(`No encontré «${String(q).slice(0, 40)}» en Spotify`);
    await api('POST', '/me/player/queue', { query: { uri: t.uri } });
    requests.set(t.uri, requester);
    if (requests.size > 200) requests.delete(requests.keys().next().value);
    return { title: t.name, author: (t.artists || []).map((a) => a.name).join(', '), uri: t.uri, durationSec: Math.round((t.duration_ms || 0) / 1000) };
  }
  const skip = () => api('POST', '/me/player/next').then(() => setTimeout(poll, 600));
  const pause = () => api('PUT', '/me/player/pause').then(() => setTimeout(poll, 400));
  const play = () => api('PUT', '/me/player/play').then(() => setTimeout(poll, 400));
  async function queueList() {
    const j = await api('GET', '/me/player/queue');
    return (j?.queue || []).slice(0, 10).map((t) => ({ title: t.name, author: (t.artists || []).map((a) => a.name).join(', '), uri: t.uri, requester: requests.get(t.uri) || '' }));
  }
  // ¿Los pedidos del chat van a Spotify?
  const active = () => cfg().requests === true && Boolean(sec().refresh);

  if (sec().refresh) loadMe().then(() => { start(); push(); });

  return { status, authUrl, finish, disconnect, request, skip, pause, play, queueList, active, poll, nowPlaying: () => now };
}

module.exports = { createSpotify };
