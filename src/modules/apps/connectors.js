// Las apps que Satronho Bot puede mover. Cada una sabe conectarse, decir qué
// tiene (escenas, atajos, objetos, voces, acciones…) y hacer una acción.
//   obs          OBS Studio (obs-websocket 5, puerto 4455)
//   vtube        VTube Studio (puerto 8001; se aprueba una vez dentro de VTS)
//   voicemod     Voicemod (Control API, puerto 59129, con clave de desarrollador)
//   streamerbot  Streamer.bot (servidor WebSocket, puerto 8080)
//   wled         Luces WLED (HTTP en tu red)
//   vrchat       VRChat (OSC por UDP, puerto 9000)

const dgram = require('dgram');
const { createWsClient, fatal, sha256b64 } = require('./wsClient');

const hostOk = (h) => /^[a-z0-9.-]{1,120}$/i.test(String(h || ''));
const local = (h) => (hostOk(h) ? h : '127.0.0.1');
const portOf = (p, d) => {
  const n = Math.round(Number(p));
  return n >= 1 && n <= 65535 ? n : d;
};

// Ocultar/mostrar «por unos segundos» y volver como estaba.
function later(ms, fn) {
  if (!(ms > 0)) return;
  const t = setTimeout(() => { Promise.resolve(fn()).catch(() => {}); }, ms);
  t.unref?.();
}

// ================= OBS Studio =================
function obs({ cfg, secret, onStatus, WS }) {
  const c = createWsClient({
    name: 'obs',
    WS,
    url: () => `ws://${local(cfg().host)}:${portOf(cfg().port, 4455)}`,
    wrap: (requestType, requestData, requestId) => ({ op: 6, d: { requestType, requestId, requestData } }),
    idOf: (m) => (m.op === 7 ? m.d?.requestId : null),
    unwrap: (m) => {
      const st = m.d?.requestStatus;
      if (st && !st.result) throw new Error(st.comment || `OBS: error ${st.code}`);
      return m.d?.responseData || {};
    },
    onStatus,
    async handshake(api) {
      const hello = await api.nextMessage();
      if (hello.op !== 0) throw new Error('Eso no parece OBS');
      const d = { rpcVersion: 1, eventSubscriptions: 0 };
      const auth = hello.d?.authentication;
      if (auth) {
        const pass = secret.get().password || '';
        if (!pass) throw fatal('OBS pide contraseña: cópiala de Herramientas → Ajustes del servidor WebSocket');
        d.authentication = sha256b64(sha256b64(pass + auth.salt) + auth.challenge);
      }
      const wait = api.nextMessage();
      api.sendRaw({ op: 1, d });
      const ok = await wait.catch(() => null);
      if (!ok || ok.op !== 2) throw fatal('OBS no aceptó la contraseña');
    },
  });
  async function itemId(scene, source) {
    const r = await c.request('GetSceneItemList', { sceneName: scene });
    const it = (r.sceneItems || []).find((x) => x.sourceName === source);
    if (!it) throw new Error(`«${source}» no está en la escena «${scene}»`);
    return it.sceneItemId;
  }
  return {
    ...c,
    async options() {
      const s = await c.request('GetSceneList');
      const scenes = (s.scenes || []).map((x) => x.sceneName).reverse();
      const sources = {};
      for (const sc of scenes.slice(0, 40)) {
        try { sources[sc] = ((await c.request('GetSceneItemList', { sceneName: sc })).sceneItems || []).map((x) => x.sourceName); } catch { sources[sc] = []; }
      }
      return { scenes, sources, current: s.currentProgramSceneName || '' };
    },
    async run(a) {
      if (a.do === 'scene') {
        const before = a.seconds > 0 ? (await c.request('GetCurrentProgramScene')).currentProgramSceneName : null;
        await c.request('SetCurrentProgramScene', { sceneName: a.scene });
        if (before && before !== a.scene) later(a.seconds * 1000, () => c.request('SetCurrentProgramScene', { sceneName: before }));
        return;
      }
      if (a.do === 'source') {
        const id = await itemId(a.scene, a.source);
        const on = a.mode === 'show' ? true : a.mode === 'hide' ? false : !(await c.request('GetSceneItemEnabled', { sceneName: a.scene, sceneItemId: id })).sceneItemEnabled;
        await c.request('SetSceneItemEnabled', { sceneName: a.scene, sceneItemId: id, sceneItemEnabled: on });
        later((a.seconds || 0) * 1000, () => c.request('SetSceneItemEnabled', { sceneName: a.scene, sceneItemId: id, sceneItemEnabled: !on }));
        return;
      }
      if (a.do === 'filter') {
        const on = a.mode !== 'hide';
        await c.request('SetSourceFilterEnabled', { sourceName: a.source, filterName: a.filter, filterEnabled: on });
        later((a.seconds || 0) * 1000, () => c.request('SetSourceFilterEnabled', { sourceName: a.source, filterName: a.filter, filterEnabled: !on }));
        return;
      }
      if (a.do === 'mute') {
        await c.request('SetInputMute', { inputName: a.source, inputMute: a.mode !== 'show' });
        later((a.seconds || 0) * 1000, () => c.request('SetInputMute', { inputName: a.source, inputMute: a.mode === 'show' }));
        return;
      }
      throw new Error('Acción de OBS desconocida');
    },
  };
}

// ================= VTube Studio =================
const VTS_PLUGIN = { pluginName: 'Satronho Bot', pluginDeveloper: 'RiddsSatronho' };
function vtube({ cfg, secret, onStatus, WS, onNeedApproval }) {
  const env = (messageType, data, requestID) => ({ apiName: 'VTubeStudioPublicAPI', apiVersion: '1.0', requestID, messageType, data });
  const c = createWsClient({
    name: 'vts',
    WS,
    url: () => `ws://${local(cfg().host)}:${portOf(cfg().port, 8001)}`,
    wrap: env,
    idOf: (m) => m.requestID ?? null,
    unwrap: (m) => {
      if (m.messageType === 'APIError') throw new Error(m.data?.message || 'VTube Studio dio un error');
      return m.data || {};
    },
    onStatus,
    timeoutMs: 8000,
    async handshake(api) {
      let token = secret.get().token || '';
      if (!token) {
        onNeedApproval?.();
        // VTube Studio muestra una ventana para aprobar; se espera hasta 60 s.
        const r = await api.request('AuthenticationTokenRequest', VTS_PLUGIN, { duringHandshake: true, timeout: 90000 })
          .catch(() => { throw fatal('No se aprobó en VTube Studio'); });
        if (!r.authenticationToken) throw fatal('No se aprobó en VTube Studio');
        token = r.authenticationToken;
        secret.save({ token });
      }
      const ok = await api.request('AuthenticationRequest', { ...VTS_PLUGIN, authenticationToken: token }, { duringHandshake: true });
      if (!ok.authenticated) {
        secret.save({ token: '' });
        throw new Error('VTube Studio retiró el permiso: vuelve a conectar y apruébalo');
      }
    },
  });
  return {
    ...c,
    async options() {
      const r = await c.request('HotkeysInCurrentModelRequest', {});
      return { model: r.modelName || '', hotkeys: (r.availableHotkeys || []).map((h) => ({ id: h.hotkeyID, name: h.name || h.type })) };
    },
    async run(a) {
      if (a.do === 'hotkey') return c.request('HotkeyTriggerRequest', { hotkeyID: a.hotkey });
      throw new Error('Acción de VTube Studio desconocida');
    },
  };
}

// ================= Voicemod =================
function voicemod({ cfg, secret, onStatus, WS }) {
  const c = createWsClient({
    name: 'vm',
    WS,
    url: () => `ws://${local(cfg().host)}:${portOf(cfg().port, 59129)}/v1/`,
    wrap: (action, payload, id) => ({ action, id, payload }),
    idOf: (m) => m.id ?? null,
    unwrap: (m) => {
      const p = m.payload || m.actionObject || {};
      if (p.status?.code && p.status.code >= 400) throw new Error(p.status.description || 'Voicemod dio un error');
      return p;
    },
    onStatus,
    async handshake(api) {
      const key = secret.get().clientKey || '';
      if (!key) throw fatal('Falta la clave de Voicemod (se pide gratis en su portal para desarrolladores)');
      const r = await api.request('registerClient', { clientKey: key }, { duringHandshake: true });
      if (r?.status && r.status.code !== 200) throw fatal('Voicemod no aceptó la clave');
    },
  });
  return {
    ...c,
    async options() {
      const v = await c.request('getVoices', {});
      const m = await c.request('getMemes', {}).catch(() => ({}));
      return {
        voices: (v.voices || []).filter((x) => x.isEnabled !== false).map((x) => ({ id: x.id, name: x.friendlyName || x.id })),
        memes: (m.listOfMemes || []).map((x) => ({ id: x.FileName, name: x.Name || x.FileName })),
      };
    },
    async run(a) {
      if (a.do === 'voice') {
        await c.request('loadVoice', { voiceID: a.voice });
        if (a.seconds > 0) later(a.seconds * 1000, () => c.request('loadVoice', { voiceID: a.back || 'nofx' }));
        return;
      }
      if (a.do === 'toggle') return c.request('toggleVoiceChanger', {});
      if (a.do === 'meme') return c.request('playMeme', { FileName: a.meme, IsKeyDown: true });
      throw new Error('Acción de Voicemod desconocida');
    },
  };
}

// ================= Streamer.bot =================
function streamerbot({ cfg, secret, onStatus, WS }) {
  const c = createWsClient({
    name: 'sb',
    WS,
    url: () => `ws://${local(cfg().host)}:${portOf(cfg().port, 8080)}${String(cfg().endpoint || '/').replace(/[^\w/.-]/g, '') || '/'}`,
    wrap: (request, data, id) => ({ request, id, ...data }),
    idOf: (m) => m.id ?? null,
    unwrap: (m) => {
      if (m.status === 'error') throw new Error(m.error || 'Streamer.bot dio un error');
      return m;
    },
    onStatus,
    async handshake(api) {
      const hello = await api.nextMessage(4000).catch(() => null);
      const auth = hello?.authentication;
      if (!auth) return;
      const pass = secret.get().password || '';
      if (!pass) throw fatal('Streamer.bot pide contraseña: la ves en Servers/Clients → WebSocket Server');
      const r = await api.request('Authenticate', { authentication: sha256b64(sha256b64(pass + auth.salt) + auth.challenge) }, { duringHandshake: true }).catch(() => null);
      if (!r || r.status !== 'ok') throw fatal('Streamer.bot no aceptó la contraseña');
    },
  });
  return {
    ...c,
    async options() {
      const r = await c.request('GetActions');
      return { actions: (r.actions || []).filter((x) => x.enabled !== false).map((x) => ({ id: x.id, name: x.name, group: x.group || '' })) };
    },
    async run(a, ctx = {}) {
      if (a.do === 'action') return c.request('DoAction', { action: { id: a.action }, args: { user: ctx.user || '', platform: ctx.platform || '', message: ctx.message || '', amount: ctx.amount ?? '' } });
      throw new Error('Acción de Streamer.bot desconocida');
    },
  };
}

// ================= WLED (luces) =================
function wled({ cfg, onStatus, fetchFn = globalThis.fetch }) {
  let state = { state: 'off', detail: '' };
  const set = (s, d = '') => { state = { state: s, detail: d }; onStatus(state); };
  const base = () => {
    const h = String(cfg().host || '').trim();
    if (!hostOk(h)) throw new Error('Escribe la dirección de tus luces (por ejemplo 192.168.1.50)');
    return `http://${h}${cfg().port && Number(cfg().port) !== 80 ? `:${portOf(cfg().port, 80)}` : ''}`;
  };
  async function call(path, body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    try {
      const r = await fetchFn(base() + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal } : { signal: ctrl.signal });
      if (!r.ok) throw new Error(`Las luces respondieron ${r.status}`);
      return r.json().catch(() => ({}));
    } catch (err) {
      throw new Error(err.name === 'AbortError' ? 'Las luces no responden: ¿están encendidas y en tu misma red?' : err.message);
    } finally { clearTimeout(t); }
  }
  return {
    start() { set('connecting'); call('/json/info').then((i) => set('connected', i?.name || '')).catch((e) => set('error', e.message)); },
    stop() { set('off'); },
    restart() { this.start(); },
    status: () => state,
    ready: () => state.state === 'connected',
    async options() {
      const p = await call('/presets.json').catch(() => ({}));
      return { presets: Object.entries(p).filter(([k, v]) => k !== '0' && v && v.n).map(([k, v]) => ({ id: Number(k), name: v.n })) };
    },
    async run(a) {
      let before = null;
      if (a.seconds > 0) before = await call('/json/state').catch(() => null);
      if (a.do === 'preset') await call('/json/state', { on: true, ps: Number(a.preset) });
      else if (a.do === 'power') await call('/json/state', { on: a.mode === 'show' ? true : a.mode === 'hide' ? false : 't' });
      else if (a.do === 'color') {
        const hex = String(a.color || '#ffffff').replace('#', '');
        const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0);
        await call('/json/state', { on: true, bri: Math.max(1, Math.min(255, Number(a.bri) || 200)), seg: [{ col: [rgb], fx: 0 }] });
      } else throw new Error('Acción de luces desconocida');
      if (before) later(a.seconds * 1000, () => call('/json/state', { on: before.on, bri: before.bri, ps: before.ps > 0 ? before.ps : undefined, seg: before.ps > 0 ? undefined : before.seg?.map((s) => ({ id: s.id, col: s.col, fx: s.fx })) }));
      if (state.state !== 'connected') set('connected');
    },
  };
}

// ================= VRChat (OSC) =================
function oscString(s) {
  const b = Buffer.from(`${s}\0`, 'utf8');
  const pad = (4 - (b.length % 4)) % 4;
  return Buffer.concat([b, Buffer.alloc(pad)]);
}
function oscMessage(address, args) {
  let tags = ',';
  const parts = [];
  for (const a of args) {
    if (a === true) tags += 'T';
    else if (a === false) tags += 'F';
    else if (typeof a === 'string') { tags += 's'; parts.push(oscString(a)); }
    else if (Number.isInteger(a) && a.type !== 'f') { tags += 'i'; const b = Buffer.alloc(4); b.writeInt32BE(a); parts.push(b); }
    else { tags += 'f'; const b = Buffer.alloc(4); b.writeFloatBE(Number(a.value ?? a)); parts.push(b); }
  }
  return Buffer.concat([oscString(address), oscString(tags), ...parts]);
}
function vrchat({ cfg, onStatus, createSocket = () => dgram.createSocket('udp4') }) {
  let sock = null;
  let state = { state: 'off', detail: '' };
  const set = (s, d = '') => { state = { state: s, detail: d }; onStatus(state); };
  const send = (address, args) => new Promise((resolve, reject) => {
    if (!sock) { sock = createSocket(); sock.on('error', () => {}); sock.unref?.(); }
    const msg = oscMessage(address, args);
    sock.send(msg, portOf(cfg().port, 9000), local(cfg().host), (err) => (err ? reject(err) : resolve()));
  });
  return {
    // OSC no tiene «conexión»: queda lista en cuanto se enciende.
    start() { set('connected', 'OSC'); },
    stop() { if (sock) { try { sock.close(); } catch { /* nada */ } sock = null; } set('off'); },
    restart() { this.start(); },
    status: () => state,
    ready: () => state.state === 'connected',
    async options() { return {}; },
    async run(a, ctx = {}) {
      if (a.do === 'chatbox') {
        const text = String(a.text || '').replace(/\{usuario\}/gi, ctx.user || '').replace(/\{mensaje\}/gi, ctx.message || '').slice(0, 144);
        return send('/chatbox/input', [text, true, a.notify !== false]);
      }
      if (a.do === 'param') {
        const name = String(a.param || '').replace(/[^\w./-]/g, '');
        if (!name) throw new Error('Falta el nombre del parámetro');
        const v = a.kind === 'bool' ? a.value === true || a.value === 'true' || Number(a.value) === 1 : a.kind === 'int' ? Math.round(Number(a.value) || 0) : { type: 'f', value: Number(a.value) || 0 };
        await send(`/avatar/parameters/${name}`, [v]);
        if (a.seconds > 0) {
          const back = a.kind === 'bool' ? !v : a.kind === 'int' ? 0 : { type: 'f', value: 0 };
          later(a.seconds * 1000, () => send(`/avatar/parameters/${name}`, [back]));
        }
        return undefined;
      }
      throw new Error('Acción de VRChat desconocida');
    },
  };
}

module.exports = { obs, vtube, voicemod, streamerbot, wled, vrchat, oscMessage, _test: { hostOk, portOf } };
