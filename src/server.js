// Servidor local de Satronho Bot.
// - Panel de control en  http://localhost:PUERTO/
// - Overlays para OBS en http://localhost:PUERTO/overlays/...
// - WebSocket en /ws que empuja los eventos en tiempo real.
// Escucha solo en 127.0.0.1: nadie de fuera de tu PC puede conectarse.

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');

const { bus, makeEvent, EVENT_TYPES } = require('./eventBus');
const { createGoals } = require('./modules/goals');
const { createTts } = require('./modules/tts');
const { createMusic } = require('./modules/music');
const { createStats } = require('./modules/stats');
const { createPiperEngine } = require('./tts/piper');
const { createMsOnlineEngine } = require('./tts/msonline');
const { createYoutubeResolver } = require('./music/youtube');
const { createKickConnector } = require('./connectors/kick');
const { createTiktokConnector } = require('./connectors/tiktok');
const { createStarviosConnector } = require('./connectors/starvios');
const { createTwitchConnector } = require('./connectors/twitch');
const { createKickChat } = require('./connectors/kickChat');
const { createStarviosChat } = require('./connectors/starviosChat');
const { createCommands } = require('./modules/commands');
const { createSupport, createLogbook } = require('./modules/support');

const ROOT = path.join(__dirname, '..');
const PLATFORMS = ['tiktok', 'kick', 'starvios', 'twitch'];
const GUIDES = ['samy', 'troya', 'nono', 'juana', 'mecha'];
// Nombre visible de cada guía (las fotos se guardan con él: "Ñoño.png").
const GUIDE_NAMES = { samy: 'Samy', troya: 'Troya', nono: 'Ñoño', juana: 'Juana', mecha: 'MechaRidds' };
const PHOTO_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

// Eventos de prueba del panel.
const SAMPLE = {
  follow: { platform: 'tiktok', user: { id: 'nuevo_fan', name: 'NuevoFan' } },
  sub: { platform: 'tiktok', user: { id: 'fiel', name: 'SuscriptorFiel' }, amount: 3 },
  gift: { platform: 'tiktok', user: { id: 'rosalinda', name: 'Rosalinda' }, amount: 5, extra: { giftName: 'Rosa', count: 5, currency: 'diamantes' } },
  like: { platform: 'tiktok', user: { id: 'corazones', name: 'Corazones' }, amount: 15 },
  share: { platform: 'tiktok', user: { id: 'compartidor', name: 'Compartidor' } },
  chat: { platform: 'kick', user: { id: 'espectador', name: 'Espectador' }, amount: 0, message: 'Hola, saludos desde Colombia' },
};

function createServer({ store, dataDir = store.dir, fetch: fetchFn = fetch, resolver: customResolver, appInfo = {}, hooks = {} }) {
  const app = express();
  app.use(express.json());
  // Bitácora de errores para los reportes (Ayuda → Reportar un problema).
  const logbook = createLogbook();
  app.use('/', express.static(path.join(ROOT, 'dashboard')));
  app.use('/overlays', express.static(path.join(ROOT, 'overlays')));

  // Tipografías incluidas en la app (funcionan sin internet). /fonts/all.css
  // declara todas; el navegador solo descarga la que de verdad se usa.
  const FONT_DIR = path.join(ROOT, 'node_modules', '@fontsource');
  app.use('/fonts', express.static(FONT_DIR, { maxAge: '7d' }));
  let fontCss = null;
  app.get('/fonts.css', (_req, res) => {
    if (!fontCss) {
      const parts = [];
      for (const pkg of fs.existsSync(FONT_DIR) ? fs.readdirSync(FONT_DIR) : []) {
        for (const w of [400, 500, 600, 700, 800]) {
          for (const sub of ['latin', 'latin-ext']) {
            const f = path.join(FONT_DIR, pkg, `${sub}-${w}.css`);
            if (fs.existsSync(f)) parts.push(fs.readFileSync(f, 'utf8').replace(/url\(\.\/files\//g, `url(/fonts/${pkg}/files/`));
          }
        }
      }
      fontCss = parts.join('\n');
    }
    res.type('text/css').set('Cache-Control', 'max-age=3600').send(fontCss);
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  function broadcast(kind, payload) {
    const msg = JSON.stringify({ kind, payload });
    for (const ws of wss.clients) if (ws.readyState === ws.OPEN) ws.send(msg);
  }

  // ---- Conectores ----
  const status = {};
  function onStatus(s) {
    status[s.platform] = s;
    if (s.state === 'error' || (s.state === 'connecting' && s.detail)) logbook.add('conexión', `${s.platform}: ${s.state} ${s.detail || ''}`);
    broadcast('status', s);
  }
  const deps = { bus, onStatus, fetch: fetchFn };
  const connectors = {
    tiktok: createTiktokConnector({ ...deps, getSettings: () => store.get('platforms').tiktok }),
    kick: createKickConnector(deps),
    twitch: createTwitchConnector(deps),
    starvios: createStarviosConnector(deps),
  };

  // ---- Módulos ----
  const engine = createPiperEngine({ dataDir, fetch: fetchFn, onState: (s) => broadcast('tts-engine', s) });
  const goals = createGoals({ store, broadcast });
  const online = createMsOnlineEngine({ outDir: engine.outDir });
  const kickChat = createKickChat({
    store,
    fetch: fetchFn,
    redirectUri: `http://localhost:${store.get('port')}/auth/kick/callback`,
    onChange: (st) => broadcast('kickbot', st),
    vault: hooks.vault || null,
  });
  const starviosChat = createStarviosChat({
    store,
    fetch: fetchFn,
    onChange: (st) => broadcast('starviosbot', st),
    vault: hooks.vault || null,
    openLogin: hooks.openLogin || null,
  });
  // Quién escribe en cada plataforma. Todo lo que escribe el Chat Bot pasa
  // por aquí: respeta el interruptor general y queda en «Lo que he escrito».
  const botLog = [];
  const logBot = (entry) => {
    botLog.unshift(entry);
    botLog.length = Math.min(botLog.length, 60);
    broadcast('bot-said', entry);
  };
  const guarded = (platform, w) => ({
    ...w,
    say(text, source = 'bot') {
      if (store.get('chatBot')?.enabled === false) return false;
      const ok = w.say(text);
      if (ok) logBot({ platform, text: String(text).slice(0, 480), source, ts: Date.now() });
      return ok;
    },
  });
  const writers = { kick: guarded('kick', kickChat), starvios: guarded('starvios', starviosChat) };
  const tts = createTts({ store, broadcast, engine, online });
  // music se crea más abajo; los comandos lo consultan al responder.
  let musicRef = null;
  const commands = createCommands({
    store,
    writers,
    getStatus: () => status,
    getMusic: () => musicRef?.snapshot(),
    speak: (text) => tts.speak(text),
    broadcast,
  });
  const stats = createStats({ store, dataDir, broadcast });
  const music = createMusic({
    store,
    broadcast(kind, payload) {
      broadcast(kind, payload);
      if (kind === 'music-notice' && payload.kind !== 'busy') {
        tts.speakNotice(payload.text);
        // Satronho Bot responde en el chat de la plataforma de donde vino el pedido.
        const cb = store.get('chatBot')[payload.platform];
        const writer = writers[payload.platform];
        if (writer && cb?.enabled !== false && cb?.music !== false) {
          const icon = { ok: '🎵', warn: '⚠️', error: '❌' }[payload.kind] || '🐾';
          writer.say(`${icon} ${payload.text}`, 'musica');
        }
      }
    },
    resolver: customResolver || createYoutubeResolver({ fetch: fetchFn }),
    onSong: () => stats.onSong(),
  });

  musicRef = music;
  bus.on('viewers', (v) => stats.onViewers(v));
  bus.on('stream-end', () => stats.end('fin del LIVE de TikTok'));

  const recent = [];
  bus.on('event', (e) => {
    recent.unshift(e);
    recent.length = Math.min(recent.length, 100);
    broadcast('event', e);
    stats.handleEvent(e);

    // Alertas y metas: solo TikTok emite follows, regalos, etc.
    const alerts = store.get('alerts');
    const bigEnough = e.type !== 'gift' || e.amount >= (alerts.minGift || 0);
    if (e.type !== 'chat' && alerts.enabled[e.type] !== false && bigEnough) {
      const a = alertFor(e);
      broadcast('alert', a);
      if (a.speak) tts.speak(alertText(e));
    }
    goals.handleEvent(e);
    // Lo que escribe la propia app (con la cuenta aparte o con la tuya) no se lee en voz alta.
    const fromBot = e.type === 'chat' && Boolean(writers[e.platform]?.isOwnMessage(e.user?.name, e.message));
    // Comandos propios (!redes…) y conteo para los mensajes automáticos.
    if (!fromBot && e.type === 'chat') {
      commands.onChat(e);
      try {
        commands.handle(e);
      } catch {
        /* un comando roto no debe tumbar el chat */
      }
    }
    const decision = fromBot ? { read: false, reason: 'lo escribió Satronho Bot' } : tts.handleEvent(e);
    if (decision) {
      // El panel marca cada mensaje con 🔊 o 🔇 y el motivo.
      broadcast('tts-decision', { eventId: e.id, read: decision.read, reason: decision.reason, voice: decision.voice || '' });
      if (decision.read) stats.onTtsRead();
    }
    music.handleEvent(e);
  });

  // Cómo sale cada alerta: duración, sonido y si se lee en voz alta.
  function alertFor(e) {
    const alerts = store.get('alerts');
    const big = alerts.bigGift || {};
    const isBig = e.type === 'gift' && big.enabled && e.amount >= (Number(big.min) || 0);
    const t = isBig ? big : alerts.types?.[e.type] || {};
    const seconds = Number(t.seconds) || (alerts.durationMs || 5000) / 1000;
    const sound = t.sound === 'file' && !t.file ? 'none' : t.sound || 'campanita';
    return {
      ...e,
      big: isBig,
      durationMs: Math.round(Math.max(1, Math.min(60, seconds)) * 1000),
      fitSound: Boolean(t.fitSound),
      speak: Boolean(t.speak),
      sound: {
        sound,
        volume: t.volume ?? 70,
        maxSeconds: Number(t.maxSeconds) || 0,
        url: sound === 'file' ? `/alert-sounds/${t.file}` : '',
      },
    };
  }
  function alertText(e) {
    const n = e.user?.name || 'Alguien';
    const x = e.extra || {};
    switch (e.type) {
      case 'follow': return `${n} te sigue`;
      case 'sub': return `${n} se suscribió`;
      case 'gift': return `${n} envió ${x.count > 1 ? `${x.count} ` : ''}${x.giftName || 'un regalo'}`;
      case 'like': return `${n} dio ${e.amount} likes`;
      case 'share': return `${n} compartió el directo`;
      default: return '';
    }
  }

  // ---- WebSocket: cada cliente recibe un id y el estado inicial ----
  wss.on('connection', (ws) => {
    ws.clientId = crypto.randomUUID();
    ws.send(
      JSON.stringify({
        kind: 'hello',
        payload: {
          clientId: ws.clientId,
          goals: goals.list(),
          status,
          recent: recent.slice(0, 30),
          music: music.snapshot(),
          engine: engine.state(),
          allowed: tts.allowedList(),
          stats: stats.current(),
          statsHistory: stats.listHistory(),
          update: lastUpdate,
          overlayStyle: store.get('overlayStyle'),
          onlineVoices: online.voices(),
          kickbot: kickChat.status(),
          starviosbot: starviosChat.status(),
          commands: commands.list(),
          botLog: botLog.slice(0, 30),
          timers: commands.timers(),
          app: { window: store.get('window') },
        },
      })
    );
    ws.on('message', (raw) => {
      let m;
      try {
        m = JSON.parse(String(raw));
      } catch {
        return;
      }
      // La ventana que quiere reproducir la música se presenta así.
      if (m.kind === 'player-hello') music.setPlayer(ws.clientId);
    });
    ws.on('close', () => {
      if (music.snapshot().playerId === ws.clientId) music.setPlayer(null);
    });
  });

  // ---- API ----
  // El panel nunca recibe claves ni tokens.
  const publicConfig = (c) => {
    const { secrets: _s, ...rest } = c;
    return rest;
  };
  const ok = (res, data = {}) => res.json({ ok: true, ...data });
  const fail = (res, err, code = 400) => res.status(code).json({ ok: false, error: String(err?.message || err) });
  const safe = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      fail(res, err);
    }
  };

  app.get('/api/state', (_req, res) => ok(res, { config: publicConfig(store.get()), status, app: { name: 'Satronho Bot', author: 'RiddsSatronho', version: appInfo.version || require('../package.json').version, portable: Boolean(appInfo.portable) } }));

  // Actualizaciones (solo en la versión instalada con Velopack).
  let lastUpdate = null;
  app.post('/api/update/check', (_req, res) => {
    if (!hooks.checkForUpdates) return fail(res, 'Las actualizaciones solo funcionan en la versión instalada');
    hooks.checkForUpdates();
    ok(res);
  });
  app.post('/api/update/apply', (_req, res) => {
    if (!hooks.applyUpdate || !hooks.applyUpdate()) return fail(res, 'No hay ninguna actualización lista');
    ok(res);
  });
  app.post('/api/config', (req, res) => {
    // Metas y permisos tienen su propia API; no se pisan desde aquí.
    const { goals: _g, ttsAllowed: _a, secrets: _s, ...rest } = req.body || {};
    const config = publicConfig(store.update(rest));
    if (rest.overlayStyle) broadcast('overlay-style', config.overlayStyle);
    if (rest.window) hooks.onWindowConfig?.(config.window);
    if (rest.hotkeys) {
      hotkeysStatus = hooks.onHotkeys?.(store.get('hotkeys')) || hotkeysStatus;
      broadcast('hotkeys-status', hotkeysStatus);
    }
    ok(res, { config });
  });

  app.post('/api/test/:type', (req, res) => {
    const { type } = req.params;
    if (!EVENT_TYPES.includes(type)) return fail(res, `Tipo desconocido: ${type}`);
    const event = makeEvent({ ...SAMPLE[type], ...(req.body || {}), type, test: true });
    bus.emit('event', event);
    ok(res, { event });
  });

  // Metas
  app.get('/api/goals', (_req, res) => ok(res, { goals: goals.list() }));
  app.post('/api/goals', (req, res) => ok(res, { goal: goals.create(req.body || {}) }));
  app.patch('/api/goals/:id', (req, res) => {
    const g = goals.update(req.params.id, req.body || {});
    return g ? ok(res, { goal: g }) : fail(res, 'Meta no encontrada', 404);
  });
  app.delete('/api/goals/:id', (req, res) => {
    goals.remove(req.params.id);
    ok(res);
  });

  // Plataformas
  app.post('/api/connect/:platform', safe(async (req, res) => {
    const { platform } = req.params;
    if (!PLATFORMS.includes(platform)) return fail(res, `Plataforma desconocida: ${platform}`);
    const channel = req.body?.channel ?? store.get('platforms')[platform].channel;
    store.update({ platforms: { [platform]: { channel } } });
    await connectors[platform].connect(channel);
    ok(res);
  }));
  app.post('/api/disconnect/:platform', safe(async (req, res) => {
    const c = connectors[req.params.platform];
    if (!c) return fail(res, 'Plataforma desconocida');
    await c.disconnect();
    ok(res);
  }));

  // Voz
  app.get('/api/tts/engine', (_req, res) => ok(res, { engine: engine.state() }));
  app.post('/api/tts/install-engine', (_req, res) => {
    engine.install().catch(() => broadcast('tts-engine', engine.state()));
    ok(res); // el progreso llega por WebSocket
  });
  app.post('/api/tts/install-voice/:id', (req, res) => {
    engine.installVoice(req.params.id).catch(() => broadcast('tts-engine', engine.state()));
    ok(res);
  });
  // Descarga, una detrás de otra, todas las voces que faltan.
  let installingAll = false;
  app.post('/api/tts/install-all', (req, res) => {
    if (installingAll) return fail(res, 'Ya estoy descargando las voces');
    const st = engine.state();
    if (!st.installed) return fail(res, 'Primero instala el motor de voz');
    const lang = req.body?.lang;
    const missing = st.voices.filter((v) => !v.installed && (!lang || v.lang === lang)).map((v) => v.id);
    if (!missing.length) return fail(res, 'Ya tienes todas las voces');
    installingAll = true;
    (async () => {
      for (const id of missing) {
        try {
          await engine.installVoice(id);
        } catch {
          broadcast('tts-engine', engine.state());
          break; // sin conexión o error: paramos y el panel muestra el motivo
        }
      }
      installingAll = false;
    })();
    ok(res, { count: missing.length });
  });
  // Voces de Windows que el panel ve (para sumarlas al reparto por espectador).
  app.post('/api/tts/windows-voices', (req, res) => {
    const names = Array.isArray(req.body?.names) ? req.body.names.map(String).slice(0, 60) : [];
    store.set('windowsVoices', names);
    ok(res);
  });
  app.post('/api/tts/say', (req, res) => {
    const text = String(req.body?.text || '').slice(0, 300);
    if (!text.trim()) return fail(res, 'Texto vacío');
    const voice = typeof req.body?.voice === 'string' ? req.body.voice.slice(0, 80) : undefined;
    tts.speak(text, { user: 'Prueba', voice });
    ok(res);
  });
  app.get('/tts-audio/:file', (req, res) => {
    if (!/^tts-[\w-]+\.(wav|mp3)$/.test(req.params.file)) return res.sendStatus(404);
    res.sendFile(path.join(engine.outDir, req.params.file), (err) => err && !res.headersSent && res.sendStatus(404));
  });
  // Prueba de filtros: ¿se leería este mensaje? ¿por qué?
  app.post('/api/tts/check', (req, res) => ok(res, { decision: tts.check(req.body || {}) }));
  app.get('/api/tts/voices', (_req, res) => ok(res, { voices: engine.installedVoiceKeys(), pool: tts.pool() }));

  // Estadísticas
  app.get('/api/stats/current', (_req, res) => ok(res, { session: stats.current() }));
  app.get('/api/stats/sessions', (_req, res) => ok(res, { sessions: stats.listHistory() }));
  app.get('/api/stats/sessions/:id', (req, res) => {
    const s = stats.getSession(req.params.id);
    return s ? ok(res, { session: s }) : fail(res, 'Sesión no encontrada', 404);
  });
  app.get('/api/stats/all-time', (_req, res) => ok(res, { tops: stats.allTimeTops() }));
  app.post('/api/stats/end', (_req, res) => ok(res, { session: stats.end('manual') }));

  app.get('/api/tts/allowed',(_req, res) => ok(res, { allowed: tts.allowedList() }));
  app.delete('/api/tts/allowed/:id', (req, res) => {
    tts.revoke(req.params.id);
    ok(res);
  });
  app.delete('/api/tts/allowed', (_req, res) => {
    tts.revoke(null);
    ok(res);
  });

  // Música
  app.get('/api/music', (_req, res) => ok(res, { music: music.snapshot() }));
  app.post('/api/music/:action', safe(async (req, res) => {
    const b = req.body || {};
    switch (req.params.action) {
      case 'add': await music.add(String(b.query || '')); break;
      case 'skip': music.skip(); break;
      case 'remove': music.remove(b.id); break;
      case 'clear': music.clear(); break;
      case 'pause': music.setPaused(true); break;
      case 'resume': music.setPaused(false); break;
      case 'volume': music.setVolume(b.volume); break;
      case 'enabled': music.setEnabled(b.enabled); break;
      case 'ended': music.ended(b.id); break;
      case 'error': music.failed(b.id, b.code); break;
      default: return fail(res, 'Acción desconocida', 404);
    }
    ok(res);
  }));

  // ---- SatronhoBot en el chat de Kick ----
  app.get('/api/kickbot', (_req, res) => ok(res, { kickbot: kickChat.status() }));
  app.post('/api/kickbot/app', (req, res) => {
    kickChat.setApp(req.body || {});
    ok(res, { kickbot: kickChat.status() });
  });
  app.post('/api/kickbot/app/forget', (_req, res) => {
    kickChat.forgetOwnApp();
    ok(res, { kickbot: kickChat.status() });
  });
  app.post('/api/kickbot/authorize', async (req, res) => {
    try {
      const account = req.body?.account === 'bot' ? 'bot' : 'me';
      // «Usar otra cuenta»: borrar la sesión de kick.com de esa ventana antes de abrirla.
      if (req.body?.fresh) await hooks.clearLogin?.('kick', account);
      const url = kickChat.authUrl(account);
      const external = Boolean(req.body?.external);
      // En la app de escritorio se abre una ventanita propia para cada cuenta,
      // así puedes entrar como SatronhoBot sin cerrar sesión en tu navegador.
      const opened = !external && hooks.openAuthWindow ? hooks.openAuthWindow(url, account) : false;
      ok(res, { url, opened });
    } catch (err) {
      fail(res, err);
    }
  });
  app.post('/api/kickbot/logout', (req, res) => {
    const account = req.body?.account === 'bot' ? 'bot' : 'me';
    kickChat.logout(account);
    hooks.clearLogin?.('kick', account); // la próxima vez se puede entrar con otra cuenta
    ok(res, { kickbot: kickChat.status() });
  });
  app.post('/api/kickbot/test', (_req, res) => {
    const sent = writers.kick.say('🐾 Satronho Bot está listo. Pide música con !play o !temita.', 'prueba');
    if (!sent) return fail(res, 'Falta autorizar una cuenta o escribir tu canal de Kick en Conexiones');
    ok(res);
  });
  app.get('/auth/kick/callback', async (req, res) => {
    const page = (title, text, okk) => `<!doctype html><meta charset="utf-8"><title>Satronho Bot</title>
      <body style="margin:0;display:grid;place-items:center;height:100vh;background:#0f0d17;color:#f4efe6;font:16px system-ui">
      <div style="text-align:center;max-width:420px;padding:24px"><div style="font-size:48px">${okk ? '🐾' : '⚠️'}</div><h2>${title}</h2><p style="color:#a39ac0">${text}</p></div>`;
    try {
      const r = await kickChat.finish(req.query || {});
      res.send(page('¡Listo!', `${r.name ? `<b>${r.name.replace(/[<>&]/g, '')}</b> quedó autorizada.` : 'La cuenta quedó autorizada.'} Ya puedes cerrar esta ventana y volver a Satronho Bot.`, true));
    } catch (err) {
      res.send(page('No se pudo autorizar', String(err.message).replace(/[<>&]/g, ''), false));
    }
  });

  // ---- Novedades (CHANGELOG.json, incluido en la app) ----
  let changelog = [];
  try {
    changelog = JSON.parse(fs.readFileSync(path.join(ROOT, 'CHANGELOG.json'), 'utf8'));
  } catch {
    /* sin historial */
  }
  app.get('/api/changelog', (_req, res) => ok(res, { changelog }));

  // ---- Ayuda: reportar un problema (llega a Discord) ----
  const support = createSupport({ fetch: fetchFn, logbook, appInfo: { version: appInfo.version || require('../package.json').version }, getStatus: () => status });
  app.get('/api/support', (_req, res) => ok(res, { available: support.available(), diagnostics: support.diagnostics() }));
  app.post('/api/support/report', async (req, res) => {
    try {
      ok(res, await support.send(req.body || {}));
    } catch (err) {
      fail(res, err);
    }
  });
  // Errores del panel (para el diagnóstico).
  app.post('/api/support/client-error', (req, res) => {
    logbook.add('panel', String(req.body?.message || '').slice(0, 600));
    ok(res);
  });

  // ---- Chat Bot: escribir a mano ----
  app.post('/api/chatbot/send', (req, res) => {
    const text = String(req.body?.text || '').trim().slice(0, 450);
    if (!text) return fail(res, 'Escribe el mensaje');
    if (store.get('chatBot')?.enabled === false) return fail(res, 'El Chat Bot está apagado');
    const wanted = Array.isArray(req.body?.platforms) ? req.body.platforms : Object.keys(writers);
    const sent = wanted.filter((p) => writers[p]?.say(text, 'manual'));
    if (!sent.length) return fail(res, 'No pude escribir: conecta la plataforma en Escuchar y autoriza una cuenta en Escribir');
    ok(res, { sent });
  });

  // ---- Comandos del chat ----
  const wrap = (fn) => (req, res) => {
    try {
      ok(res, fn(req));
    } catch (err) {
      fail(res, err);
    }
  };
  app.get('/api/commands', (_req, res) => ok(res, { commands: commands.list() }));
  app.post('/api/commands', wrap((req) => ({ command: commands.create(req.body || {}) })));
  app.patch('/api/commands/:id', wrap((req) => ({ command: commands.update(req.params.id, req.body || {}) })));
  app.delete('/api/commands/:id', wrap((req) => (commands.remove(req.params.id), {})));
  // Probar: ¿qué respondería a este mensaje? (no escribe en el chat)
  app.post('/api/commands/try', wrap((req) => {
    const b = req.body || {};
    const e = { type: 'chat', platform: b.platform || 'kick', user: { id: 'prueba', name: b.user || 'Espectador' }, message: String(b.message || ''), extra: { badges: b.mod ? ['moderator'] : [] } };
    return { result: commands.handle(e, { dryRun: true }) };
  }));
  // ---- Mensajes automáticos ----
  app.get('/api/timers', (_req, res) => ok(res, { timers: commands.timers() }));
  app.post('/api/timers', wrap((req) => ({ timer: commands.createTimer(req.body || {}) })));
  app.patch('/api/timers/:id', wrap((req) => ({ timer: commands.updateTimer(req.params.id, req.body || {}) })));
  app.delete('/api/timers/:id', wrap((req) => (commands.removeTimer(req.params.id), {})));
  app.post('/api/timers/enabled', wrap((req) => (commands.setTimersEnabled(req.body?.enabled), { timers: commands.timers() })));
  app.post('/api/timers/:id/send', wrap((req) => ({ sent: commands.sendNow(req.params.id) })));

  // ---- Satronho Bot en el chat de Starvios ----
  app.get('/api/starviosbot', (_req, res) => ok(res, { starviosbot: starviosChat.status() }));
  app.post('/api/starviosbot/login', async (req, res) => {
    try {
      const account = req.body?.account === 'bot' ? 'bot' : 'me';
      if (req.body?.fresh) await hooks.clearLogin?.('starvios', account);
      const r = await starviosChat.login(account);
      ok(res, { ...r, starviosbot: starviosChat.status() });
    } catch (err) {
      fail(res, err);
    }
  });
  app.post('/api/starviosbot/logout', (req, res) => {
    const account = req.body?.account === 'bot' ? 'bot' : 'me';
    starviosChat.logout(account);
    hooks.clearLogin?.('starvios', account);
    ok(res, { starviosbot: starviosChat.status() });
  });
  app.post('/api/starviosbot/test', (_req, res) => {
    const sent = writers.starvios.say('🐾 Satronho Bot está listo. Pide música con !play o !temita.', 'prueba');
    if (!sent) return fail(res, 'Inicia sesión y escribe tu canal de Starvios en Conexiones → Escuchar');
    ok(res);
  });

  // Sonidos propios para las alertas (mp3, wav u ogg).
  const SOUND_TYPES = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm' };
  const ALERT_KEYS = ['follow', 'sub', 'gift', 'like', 'share', 'bigGift'];
  const soundsDir = path.join(dataDir, 'alert-sounds');
  fs.mkdirSync(soundsDir, { recursive: true });
  app.use('/alert-sounds', express.static(soundsDir, { maxAge: 0 }));
  app.post('/api/alerts/:key/sound', express.raw({ type: Object.keys(SOUND_TYPES), limit: '10mb' }), (req, res) => {
    const { key } = req.params;
    const ext = SOUND_TYPES[req.headers['content-type']];
    if (!ALERT_KEYS.includes(key)) return fail(res, 'Alerta desconocida');
    if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) return fail(res, 'Usa un sonido MP3, WAV u OGG (hasta 10 MB)');
    for (const f of fs.readdirSync(soundsDir)) if (f.startsWith(`${key}.`)) fs.rmSync(path.join(soundsDir, f));
    const file = `${key}.${ext}`;
    fs.writeFileSync(path.join(soundsDir, file), req.body);
    const name = String(req.headers['x-file-name'] || '').slice(0, 80);
    const patch = { file: `${file}?v=${Date.now()}`, fileName: decodeURIComponent(name), sound: 'file' };
    store.update({ alerts: key === 'bigGift' ? { bigGift: patch } : { types: { [key]: patch } } });
    ok(res, { alerts: store.get('alerts') });
  });

  // Fotos de los guías (opcional: si no hay foto se usa su dibujo).
  const photosDir = path.join(dataDir, 'guides');
  fs.mkdirSync(photosDir, { recursive: true });
  app.use('/guide-photos', express.static(photosDir, { maxAge: 0 }));
  const removePhotos = (id) => {
    for (const f of fs.readdirSync(photosDir)) {
      const base = f.replace(/\.[^.]+$/, '');
      if (base === id || base === GUIDE_NAMES[id]) fs.rmSync(path.join(photosDir, f));
    }
  };
  app.post('/api/guides/:id/photo', express.raw({ type: Object.keys(PHOTO_TYPES), limit: '6mb' }), (req, res) => {
    const { id } = req.params;
    const ext = PHOTO_TYPES[req.headers['content-type']];
    if (!GUIDES.includes(id)) return fail(res, 'Guía desconocido');
    if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) return fail(res, 'Usa una imagen PNG, JPG, WEBP o GIF');
    removePhotos(id);
    const file = `${GUIDE_NAMES[id]}.${ext}`;
    fs.writeFileSync(path.join(photosDir, file), req.body);
    store.update({ guides: { photos: { [id]: `${file}?v=${Date.now()}` } } });
    ok(res, { photo: store.get('guides').photos[id] });
  });
  app.delete('/api/guides/:id/photo', (req, res) => {
    const { id } = req.params;
    if (!GUIDES.includes(id)) return fail(res, 'Guía desconocido');
    removePhotos(id);
    store.update({ guides: { photos: { [id]: '' } } });
    ok(res);
  });

  // ---- Arranque / parada ----
  function start() {
    const port = store.get('port');
    return new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(port, '127.0.0.1', () => {
        const platforms = store.get('platforms');
        for (const p of PLATFORMS) {
          const cfg = platforms[p];
          if (cfg.autoConnect && cfg.channel && !cfg.hidden) connectors[p].connect(cfg.channel).catch(() => {});
        }
        resolve(`http://localhost:${port}`);
      });
    });
  }

  async function stop() {
    await Promise.all(Object.values(connectors).map((c) => c.disconnect().catch(() => {})));
    engine.stop();
    stats.stop();
    store.saveNow();
    for (const ws of wss.clients) ws.terminate();
    await new Promise((r) => httpServer.close(r));
  }

  // ---- Atajos de teclado (los registra main.js con globalShortcut) ----
  let hotkeysStatus = { failed: [] };
  app.get('/api/hotkeys', (_req, res) => ok(res, { status: hotkeysStatus, available: Boolean(hooks.onHotkeys) }));
  function hotkey(action) {
    switch (action) {
      case 'musicSkip': music.skip(); break;
      case 'musicPause': music.setPaused(!music.snapshot().paused); break;
      case 'testAlert': bus.emit('event', makeEvent({ ...SAMPLE.follow, type: 'follow', test: true })); break;
      // La voz suena en el panel: él salta el mensaje o apaga/enciende la voz.
      case 'skipVoice':
      case 'toggleVoice': broadcast('hotkey', { action }); break;
      default: break;
    }
  }
  function setHotkeysStatus(st) {
    hotkeysStatus = st || { failed: [] };
    broadcast('hotkeys-status', hotkeysStatus);
  }

  // Para avisos que vienen de fuera del servidor (p. ej. actualizaciones).
  function notify(kind, payload) {
    if (kind === 'update') lastUpdate = payload;
    broadcast(kind, payload);
  }

  return { start, stop, notify, hotkey, setHotkeysStatus };
}

module.exports = { createServer, PLATFORMS };
