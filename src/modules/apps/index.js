// Apps conectadas y reacciones (0.29).
// Una reacción es «cuando pase esto → haz estos pasos»: por ejemplo, cuando
// alguien regale una rosa, cambiar a la escena «Baile» de OBS 10 segundos y
// lanzarle corazones al avatar en T.I.T.S. También se pueden disparar desde
// un botón del Stream Deck con su propia dirección.

const crypto = require('crypto');
const { createSecretBox } = require('../../secretBox');
const C = require('./connectors');
const { t: tr } = require('../../i18n');

const APPS = {
  obs: { port: 4455, secret: ['password'] },
  vtube: { port: 8001, secret: [] },
  tits: { port: 42069, secret: [] },
  voicemod: { port: 59129, secret: ['clientKey'] },
  streamerbot: { port: 8080, secret: ['password'], endpoint: '/' },
  wled: { port: 80, secret: [], host: '' },
  vrchat: { port: 9000, secret: [] },
};
const WHEN = ['follow', 'sub', 'gift', 'like', 'share', 'superfan', 'command', 'reward', 'redeem', 'chest', 'live-start', 'manual'];
const PLATS = ['any', 'tiktok', 'kick', 'twitch', 'starvios'];
const MAX_STEPS = 12;

const clampInt = (n, min, max, d) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
};
const str = (v, n = 120) => String(v ?? '').slice(0, n);
const uid = () => crypto.randomBytes(5).toString('hex');

function cleanApp(id, raw = {}) {
  const d = APPS[id];
  const out = {
    enabled: Boolean(raw.enabled),
    host: str(raw.host ?? d.host ?? '127.0.0.1', 120).trim(),
    port: clampInt(raw.port, 1, 65535, d.port),
  };
  if (id === 'streamerbot') out.endpoint = str(raw.endpoint || '/', 40);
  return out;
}

function cleanStep(s = {}) {
  const app = Object.keys(APPS).includes(s.app) || s.app === 'wait' ? s.app : 'wait';
  const o = { app, do: str(s.do, 20) };
  if (app === 'wait') return { app, seconds: Math.max(0, Math.min(120, Number(s.seconds) || 1)) };
  for (const k of ['scene', 'source', 'filter', 'hotkey', 'trigger', 'voice', 'back', 'meme', 'action', 'param', 'kind', 'color', 'mode']) if (s[k] != null) o[k] = str(s[k], 200);
  if (s.text != null) o.text = str(s.text, 300);
  if (Array.isArray(s.items)) o.items = s.items.map((x) => str(x, 80)).filter(Boolean).slice(0, 20);
  if (s.preset != null) o.preset = clampInt(s.preset, 0, 250, 1);
  if (s.amount != null) o.amount = clampInt(s.amount, 1, 50, 1);
  if (s.bri != null) o.bri = clampInt(s.bri, 1, 255, 200);
  if (s.value != null) o.value = typeof s.value === 'boolean' ? s.value : str(s.value, 20);
  if (s.notify != null) o.notify = Boolean(s.notify);
  o.seconds = Math.max(0, Math.min(3600, Number(s.seconds) || 0));
  return o;
}

function cleanReaction(r = {}) {
  const w = r.when || {};
  return {
    id: str(r.id || uid(), 40).replace(/[^\w-]/g, '') || uid(),
    name: str(r.name || tr('Reacción'), 60).trim(),
    enabled: r.enabled !== false,
    when: {
      type: WHEN.includes(w.type) ? w.type : 'manual',
      platform: PLATS.includes(w.platform) ? w.platform : 'any',
      gift: str(w.gift, 80).trim(),
      minCoins: clampInt(w.minCoins, 0, 1e7, 0),
      command: str(w.command, 30).trim().toLowerCase().replace(/^!+/, ''),
      reward: str(w.reward, 80).trim(),
      item: str(w.item, 40),
      chest: str(w.chest, 40),
      minAmount: clampInt(w.minAmount, 0, 1e7, 0),
    },
    steps: (Array.isArray(r.steps) ? r.steps : []).slice(0, MAX_STEPS).map(cleanStep),
    cooldownSec: clampInt(r.cooldownSec, 0, 3600, 0),
  };
}

function settingsOf(raw = {}) {
  const out = { reactions: (Array.isArray(raw.reactions) ? raw.reactions : []).slice(0, 100).map(cleanReaction), deckToken: /^[a-f0-9]{24}$/.test(raw.deckToken || '') ? raw.deckToken : '' };
  for (const id of Object.keys(APPS)) out[id] = cleanApp(id, raw[id]);
  return out;
}

// ¿Esta reacción va con este evento?
function matches(r, e, extra = {}) {
  const w = r.when;
  if (!r.enabled || !r.steps.length) return false;
  if (w.platform !== 'any' && e.platform !== w.platform) return false;
  switch (w.type) {
    case 'follow': case 'share': case 'superfan': case 'live-start': return e.type === w.type;
    case 'sub': return e.type === 'sub' && (Number(e.amount) || 1) >= Math.max(1, w.minAmount);
    case 'like': return e.type === 'like' && (Number(e.amount) || 0) >= w.minAmount;
    case 'gift': {
      if (e.type !== 'gift') return false;
      if (w.gift && String(e.extra?.giftName || '').toLowerCase() !== w.gift.toLowerCase()) return false;
      return (Number(e.amount) || 0) >= w.minCoins;
    }
    case 'command': {
      if (e.type !== 'chat' || !w.command) return false;
      const m = String(e.message || '').trim().match(/^!(\S+)/);
      return Boolean(m) && m[1].toLowerCase() === w.command;
    }
    case 'reward': return e.type === 'reward' && (!w.reward || String(e.extra?.rewardTitle || '').toLowerCase() === w.reward.toLowerCase());
    case 'redeem': return extra.kind === 'redeem' && (!w.item || extra.item === w.item);
    case 'chest': return extra.kind === 'chest' && (!w.chest || extra.chest === w.chest);
    default: return false;
  }
}

function createApps({ store, vault = null, broadcast = () => {}, logbook = { add() {} }, fetchFn = globalThis.fetch, WS, createSocket }) {
  const box = createSecretBox({ store, name: 'apps', vault });
  const cfg = () => settingsOf(store.get('apps') || {});
  const status = {};
  const lastRun = new Map();

  function secretOf(id) {
    return {
      get: () => box.get()[id] || {},
      save: (patch) => box.save({ [id]: { ...(box.get()[id] || {}), ...patch } }),
    };
  }
  const onStatus = (id) => (s) => {
    status[id] = s;
    broadcast('apps-status', { id, ...s });
  };

  const make = {
    obs: () => C.obs({ cfg: () => cfg().obs, secret: secretOf('obs'), onStatus: onStatus('obs'), WS }),
    vtube: () => C.vtube({ cfg: () => cfg().vtube, secret: secretOf('vtube'), onStatus: onStatus('vtube'), WS, onNeedApproval: () => broadcast('apps-status', { id: 'vtube', state: 'connecting', detail: tr('Acepta el permiso en la ventana de VTube Studio') }) }),
    tits: () => C.tits({ cfg: () => cfg().tits, onStatus: onStatus('tits'), WS }),
    voicemod: () => C.voicemod({ cfg: () => cfg().voicemod, secret: secretOf('voicemod'), onStatus: onStatus('voicemod'), WS }),
    streamerbot: () => C.streamerbot({ cfg: () => cfg().streamerbot, secret: secretOf('streamerbot'), onStatus: onStatus('streamerbot'), WS }),
    wled: () => C.wled({ cfg: () => cfg().wled, onStatus: onStatus('wled'), fetchFn }),
    vrchat: () => C.vrchat({ cfg: () => cfg().vrchat, onStatus: onStatus('vrchat'), createSocket }),
  };
  const conn = {};
  for (const id of Object.keys(APPS)) {
    conn[id] = make[id]();
    status[id] = { state: 'off', detail: '' };
    if (cfg()[id].enabled) conn[id].start();
  }

  function list() {
    const c = cfg();
    const sec = box.get();
    return Object.keys(APPS).map((id) => ({
      id,
      ...c[id],
      status: status[id],
      // Solo se dice si hay clave, nunca cuál es.
      secrets: Object.fromEntries(APPS[id].secret.map((k) => [k, Boolean(sec[id]?.[k])])),
      approved: id === 'vtube' ? Boolean(sec.vtube?.token) : undefined,
    }));
  }

  function configure(id, patch = {}) {
    if (!APPS[id]) throw new Error(tr('Esa app no existe'));
    const all = store.get('apps') || {};
    const before = cfg()[id];
    const next = cleanApp(id, { ...before, ...patch });
    store.set('apps', { ...all, [id]: next });
    const sp = {};
    for (const k of APPS[id].secret) if (typeof patch[k] === 'string') sp[k] = patch[k].trim().slice(0, 300);
    if (Object.keys(sp).length) secretOf(id).save(sp);
    if (patch.forget && id === 'vtube') secretOf('vtube').save({ token: '' });
    const changedConn = next.host !== before.host || next.port !== before.port || next.endpoint !== before.endpoint || Object.keys(sp).length || patch.forget || patch.reconnect;
    if (!next.enabled) conn[id].stop();
    else if (!before.enabled || changedConn) conn[id].restart();
    return list().find((x) => x.id === id);
  }

  async function options(id) {
    if (!APPS[id]) throw new Error(tr('Esa app no existe'));
    if (!conn[id].ready()) throw new Error(tr('Primero conecta la app'));
    return conn[id].options();
  }

  async function runStep(s, ctx) {
    if (s.app === 'wait') { await new Promise((r) => { const t = setTimeout(r, s.seconds * 1000); t.unref?.(); }); return; }
    const c = conn[s.app];
    if (!cfg()[s.app].enabled) throw new Error(tr('{0} está apagada', s.app));
    if (!c.ready()) throw new Error(tr('{0} no está conectada', s.app));
    await c.run(s, ctx);
  }

  async function fire(r, ctx = {}, why = '') {
    const t0 = Date.now();
    if (r.cooldownSec && t0 - (lastRun.get(r.id) || 0) < r.cooldownSec * 1000) return { ok: false, skipped: true };
    lastRun.set(r.id, t0);
    const errors = [];
    for (const s of r.steps) {
      try { await runStep(s, ctx); } catch (err) { errors.push(String(err?.message || err).slice(0, 160)); }
    }
    if (errors.length) logbook.add('apps', `${r.name}: ${errors.join(' · ')}`);
    broadcast('reaction-fired', { id: r.id, name: r.name, ok: !errors.length, errors, why, user: ctx.user || '', ts: Date.now() });
    return { ok: !errors.length, errors };
  }

  const ctxOf = (e) => ({ user: e?.user?.name || '', platform: e?.platform || '', message: e?.message || '', amount: e?.amount ?? '' });
  function onEvent(e, extra = {}) {
    if (!e || e.fromBot) return;
    for (const r of cfg().reactions) if (matches(r, e, extra)) fire(r, ctxOf(e), extra.kind || e.type).catch(() => {});
  }

  function saveReactions(listIn) {
    const all = store.get('apps') || {};
    store.set('apps', { ...all, reactions: (Array.isArray(listIn) ? listIn : []).slice(0, 100).map(cleanReaction) });
    return cfg().reactions;
  }

  function deckToken({ renew = false } = {}) {
    const all = store.get('apps') || {};
    if (!renew && /^[a-f0-9]{24}$/.test(all.deckToken || '')) return all.deckToken;
    const token = crypto.randomBytes(12).toString('hex');
    store.set('apps', { ...all, deckToken: token });
    return token;
  }

  function deck(token, id) {
    const t = cfg().deckToken;
    if (!t || !token || token.length !== t.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(t))) return { ok: false, code: 403 };
    const r = cfg().reactions.find((x) => x.id === id);
    if (!r) return { ok: false, code: 404 };
    if (!r.enabled) return { ok: false, code: 409 };
    fire(r, { user: 'Stream Deck', platform: 'deck' }, 'deck').catch(() => {});
    return { ok: true };
  }

  function testStep(step) { return runStep(cleanStep(step), { user: tr('Prueba'), platform: 'panel', message: '', amount: 1 }); }
  function testReaction(id) {
    const r = cfg().reactions.find((x) => x.id === id);
    if (!r) throw new Error(tr('Esa reacción ya no existe'));
    return fire({ ...r, cooldownSec: 0 }, { user: tr('Prueba'), platform: 'panel' }, 'test');
  }

  function stop() { for (const c of Object.values(conn)) c.stop(); }

  return { list, configure, options, onEvent, reactions: () => cfg().reactions, saveReactions, deckToken, deck, testStep, testReaction, stop, _conn: conn };
}

module.exports = { createApps, settingsOf, cleanReaction, cleanStep, matches, APPS, WHEN };
