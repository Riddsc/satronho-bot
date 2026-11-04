// Voz: decide QUÉ se lee, CON QUÉ VOZ, lo limpia y lo convierte en audio.
//
// Quién se lee:
//   - Kick, Starvios y Twitch: todo el chat.
//   - TikTok: solo quien envió el regalo configurado ("Quiéreme").
//   - Espectadores especiales: "Siempre leer" o "Silenciar".
//   - No se leen comandos (!play...), repeticiones (anti-spam) ni a quien
//     escribe más rápido que el tiempo de espera por persona.
//
// Con qué voz:
//   - Una sola voz, una voz fija por espectador o una al azar por mensaje.
//   - Un espectador especial puede tener su propia voz y nombre hablado.
//
// Cada decisión trae un motivo, que el panel muestra en Actividad
// ("🔊 leído" o "🔇 no se lee: ...") y en la prueba de filtros.

const { sanitize, screen, normalizeName } = require('../tts/textFilter');
const { MS_VOICES } = require('../tts/msonline');
const { VOICES: PIPER_VOICES } = require('../tts/voices');

// Datos de una voz (nombre, género, idioma y país) para que, si falla, el
// panel la sustituya por una voz de Windows parecida y no por cualquiera.
function describeVoice(base) {
  if (base.startsWith('ms:')) {
    const v = MS_VOICES.find((x) => x.id === base.slice(3));
    return v ? { name: v.name, gender: v.gender, lang: 'es', locale: v.locale } : null;
  }
  const [id, speaker] = base.split('#');
  const v = PIPER_VOICES.find((x) => x.id === id);
  if (!v) return null;
  const gender = v.gender || v.speakerGenders?.[Number(speaker) || 0] || '';
  return { name: v.label.split(' · ')[0], gender, lang: v.lang, locale: id.slice(0, 5).replace('_', '-') };
}

// Hash estable (FNV-1a + mezcla final) para que cada espectador reciba
// siempre la misma voz y las voces se repartan parejo.
function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function createTts({ store, broadcast, engine, online = null }) {
  let inFlight = 0;
  const lastRead = new Map(); // persona -> ts del último mensaje leído
  const lastText = new Map(); // persona -> { text, ts }

  const cfg = () => store.get('tts');
  const keyOf = (platform, user) => `${platform}:${String(user.id || user.name).toLowerCase()}`;

  // ---------- Permisos de TikTok ----------
  function allowedList() {
    // Las horas solo cuentan con la regla «Solo quien mandó Quiéreme»;
    // en las demás, quien lo mandó queda en la lista para siempre.
    const hours = cfg().who?.tiktok?.mode === 'gift' ? Number(cfg().tiktokGate.hours) || 0 : 0;
    const now = Date.now();
    return Object.entries(store.get('ttsAllowed'))
      .filter(([, v]) => !hours || now - v.ts < hours * 3600e3)
      .map(([id, v]) => ({ id, name: v.name, ts: v.ts }))
      .sort((a, b) => b.ts - a.ts);
  }
  const announceAllowed = () => broadcast('tts-allowed', allowedList());
  const isAllowed = (user) => allowedList().some((u) => u.id === user.id);

  function allow(user) {
    store.set('ttsAllowed', { ...store.get('ttsAllowed'), [user.id]: { name: user.name, ts: Date.now() } });
    announceAllowed();
  }

  function revoke(id) {
    const all = { ...store.get('ttsAllowed') };
    if (id) delete all[id];
    store.set('ttsAllowed', id ? all : {});
    announceAllowed();
  }

  function isGateGift(e) {
    const names = cfg().tiktokGate.giftNames.map(normalizeName).filter(Boolean);
    return names.includes(normalizeName(e.extra?.giftName));
  }

  // ---------- Quién puede hablar (por plataforma) ----------
  // Devuelve el motivo para no leer, o '' si puede hablar.
  // Tú y tus moderadores siempre pasan.
  const hasBadge = (e, re) => (e.extra?.badges || []).some((b) => re.test(b));
  function notAllowedReason(e) {
    const rule = cfg().who?.[e.platform] || { mode: 'all' };
    const mode = rule.mode || 'all';
    if (mode === 'all') return '';
    const gift = cfg().tiktokGate.giftNames[0] || 'Quiéreme';
    if (e.platform === 'tiktok') {
      const r = e.extra?.roles || {};
      if (r.host || r.mod) return '';
      const minLevel = Math.max(1, Number(rule.teamMinLevel) || 1);
      const inTeam = (r.team || 0) >= minLevel;
      const sentGiftEver = Boolean(store.get('ttsAllowed')[e.user.id]);
      const teamText = minLevel > 1 ? `Miembro de tu equipo nivel ${minLevel}+` : 'Miembro de tu equipo';
      switch (mode) {
        case 'followers': return r.follower || r.sub || r.team ? '' : 'no te sigue';
        case 'subs': return r.sub ? '' : 'no es suscriptor';
        case 'team': return inTeam ? '' : `no es ${teamText}`;
        case 'team-gift':
          if (!inTeam) return `no es ${teamText}`;
          return sentGiftEver ? '' : `no te ha enviado ${gift}`;
        case 'gift': return isAllowed(e.user) ? '' : `no ha enviado ${gift}`;
        case 'mods': return 'solo leo a moderadores';
        default: return '';
      }
    }
    // Kick y Twitch traen insignias; Starvios no, así que ahí se lee a todos.
    if (e.platform === 'starvios') return '';
    const isMod = hasBadge(e, /^(moderator|broadcaster|owner)$/);
    const isVip = isMod || hasBadge(e, /^vip$/);
    const isSub = isVip || hasBadge(e, /^(subscriber|founder|og|sub_gifter)$/);
    if (mode === 'subs') return isSub ? '' : 'no es suscriptor';
    if (mode === 'vip') return isVip ? '' : 'no es VIP';
    if (mode === 'mods') return isMod ? '' : 'solo leo a moderadores';
    return '';
  }

  // ---------- Bots del chat ----------
  // Bots conocidos de Kick, Twitch, TikTok y Starvios. Se comparan sin
  // mayúsculas, espacios ni símbolos («Sery_Bot» = «serybot»).
  const KNOWN_BOTS = [
    'botrix', 'kickbot', 'kicklet', 'serybot', 'satronhobot', 'nightbot', 'streamelements', 'streamlabs', 'moobot',
    'fossabot', 'wizebot', 'botisimo', 'coebot', 'phantombot', 'deepbot', 'soundalerts', 'streamerbot', 'commanderroot',
    'pokemoncommunitygame', 'kofistreambot', 'tangiabot', 'blerp', 'own3d', 'tikfinity', 'overinteractive', 'botrixoficial',
  ];
  const squash = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  function isBot(e) {
    const c = cfg();
    if (!c.ignoreBots) return false;
    const special = specialOf(e.platform, e.user);
    if (special?.action === 'allow') return false; // «Siempre leer» manda
    const n = squash(e.user?.name);
    if (!n) return false;
    if ((e.extra?.badges || []).some((b) => /bot/.test(b))) return true;
    const mine = (c.botNames || []).map(squash).filter(Boolean);
    if (KNOWN_BOTS.includes(n) || mine.includes(n)) return true;
    // «…bot» separado: Sery_Bot, mi-bot, mi.bot, StreamBot (no «robot» ni «elrobot»).
    const raw = String(e.user?.name || '').trim();
    return c.ignoreBotSuffix !== false && (/[_\-. \d]bot$/i.test(raw) || /[a-z]Bot$/.test(raw));
  }

  // Un espectador especial se anota por su nombre (como sale en el chat);
  // Kick y Twitch dan además un número interno, así que probamos ambos.
  function specialOf(platform, user) {
    const ids = new Set([user?.id, user?.name, user?.login].filter(Boolean).map((x) => String(x).toLowerCase().replace(/^@/, '')));
    return cfg().special.find((s) => {
      const [p, who] = String(s.key).split(':');
      return (p === platform || p === '*') && ids.has(String(who).toLowerCase());
    });
  }

  // ---------- Elección de voz ----------
  // Claves de voz:
  //   "es_MX-claude-high#0"  voz de Piper (#variante)
  //   "win:Microsoft Sabina" voz de Windows
  //   …"~g" / "~a"           la misma voz en tono grave / agudo
  // auto=true: solo las que entran al reparto automático (español).
  // auto=false: todas (también inglés y francés, para espectadores especiales).
  function baseKeys(auto = true) {
    const c = cfg();
    const keys = engine.installedVoiceKeys().filter((k) => !auto || k.startsWith('es_'));
    if (c.useWindowsVoices) keys.push(...(store.get('windowsVoices') || []).map((n) => `win:${n}`));
    if (c.useOnlineVoices && online) keys.push(...online.voices().map((v) => v.key));
    return keys;
  }
  const withTones = (base) => (cfg().toneVariants ? base.flatMap((k) => [k, `${k}~g`, `${k}~a`]) : base);
  const allKeys = () => withTones(baseKeys(true));
  const anyKeys = () => withTones(baseKeys(false));
  // Las voces en línea se pueden usar una a una (voz principal o especial)
  // aunque no estén sumadas al reparto.
  const isOnline = (k) => Boolean(online) && String(k).startsWith('ms:') && online.voices().some((v) => v.key === String(k).split('~')[0]);
  // Una voz de Windows elegida a mano siempre se puede usar (la lee el panel).
  const isUsable = (k) => isOnline(k) || String(k).startsWith('win:') || anyKeys().includes(k);

  function pool() {
    const all = allKeys();
    const chosen = (cfg().voicePool || []).filter((k) => all.includes(k));
    return chosen.length ? chosen : all;
  }

  function pickVoice(platform, user, special) {
    const c = cfg();
    const piperMain = `${c.piperVoice}#${Number(c.speaker) || 0}`;
    // Voz principal: una elegida a mano (por ejemplo una en línea) o la de Piper.
    const main = c.mainVoice && isUsable(c.mainVoice) ? c.mainVoice : piperMain;
    const all = allKeys();
    if (special?.voice && isUsable(special.voice)) return special.voice;
    const p = pool();
    const fallback = main === c.mainVoice || all.includes(main) ? main : p[0];
    if (!user || c.voiceMode === 'single' || !p.length) return fallback;
    if (c.voiceMode === 'random') return p[Math.floor(Math.random() * p.length)];
    return p[hash(keyOf(platform, user)) % p.length];
  }

  // ---------- Decisión: ¿se lee este mensaje? ----------
  function decide(e, { dryRun = false } = {}) {
    const c = cfg();
    const no = (reason) => ({ read: false, reason });
    if (!c.enabled) return no('la voz está apagada');
    if (!c.read[e.platform]) return no(`no leo el chat de ${e.platform}`);

    const special = specialOf(e.platform, e.user);
    if (special?.action === 'mute') return no('espectador silenciado');
    if (isBot(e)) return no('es un bot');
    if (c.skipHost && (e.extra?.roles?.host || (e.extra?.badges || []).includes('broadcaster'))) return no('lo escribiste tú');
    if (c.skipCommands && e.message.trim().startsWith('!')) return no('es un comando');
    if (special?.action !== 'allow') {
      const why = notAllowedReason(e);
      if (why) return no(why);
    }

    const key = keyOf(e.platform, e.user);
    const now = Date.now();
    if (c.cooldownSec > 0 && now - (lastRead.get(key) || 0) < c.cooldownSec * 1000) return no('escribe muy seguido (tiempo de espera)');

    const screened = screen(e.message, c);
    if (screened.skip) return no(screened.skip);
    let clean = sanitize(screened.text, c);
    if (c.stripNumbers) clean = clean.replace(/\p{N}+/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!clean || !/\p{L}/u.test(clean)) return no('no queda texto que leer tras los filtros');

    const norm = clean.toLowerCase();
    const prev = lastText.get(key);
    if (c.antiSpam && prev && prev.text === norm && now - prev.ts < 120000) return no('mensaje repetido');

    if (!dryRun) {
      lastRead.set(key, now);
      lastText.set(key, { text: norm, ts: now });
    }
    const spoken = special?.spokenName || e.user.name;
    const voice = pickVoice(e.platform, e.user, special);
    // «dice» en el idioma de la voz (inglés y francés se dan a mano).
    const says = /^en_/.test(voice || '') ? 'says' : /^fr_/.test(voice || '') ? 'dit' : 'dice';
    return { read: true, reason: 'se lee', text: c.sayName ? `${spoken} ${says}: ${clean}` : clean, voice, rate: special?.rate, pitch: special?.pitch };
  }

  // ---------- Generar audio ----------
  async function speak(text, meta = {}) {
    const c = cfg();
    const voice = meta.voice || pickVoice(null, null, null);
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      user: meta.user || '',
      platform: meta.platform || '',
      voice: voice || '',
      ts: Date.now(),
      expireSec: c.expireSec,
      volume: c.volume,
      rate: c.rate,
      windowsVoice: c.windowsVoice,
      tone: '',
      // Tono: el panel reproduce más rápido o más lento (sube o baja el tono)
      // y aquí generamos la voz al revés de rápida, así la velocidad final
      // queda igual y solo cambia el tono.
      pitch: Math.max(0.6, Math.min(1.6, Number(meta.pitch) || Number(c.pitch) || 1)),
    };
    if (Number(meta.rate)) item.rate = Number(meta.rate);
    const synthRate = Math.max(0.3, Math.min(3, (Number(item.rate) || 1) / item.pitch));
    const [base, tone = ''] = String(voice || '').split('~');
    item.tone = tone;
    if (base.startsWith('win:')) {
      item.windowsVoice = base.slice(4); // la lee el panel con esa voz de Windows
    } else if (base.startsWith('ms:')) {
      try {
        const file = await online.synth(text, { voiceId: base.slice(3), rate: synthRate });
        item.audioUrl = `/tts-audio/${file}`;
      } catch (err) {
        // Sin internet o Microsoft rechazó: el panel usa una voz de Windows
        // del mismo género e idioma, y avisa.
        item.error = err.message;
        item.wanted = describeVoice(base);
      }
    } else if (base) {
      if (inFlight >= c.maxQueue) return;
      inFlight += 1;
      try {
        const [voiceId, speaker] = base.split('#');
        const file = await engine.synth(text, { voiceId, speaker: Number(speaker) || 0, rate: synthRate });
        item.audioUrl = `/tts-audio/${file}`;
      } catch (err) {
        item.error = err.message; // el panel lo leerá con una voz de Windows parecida
        item.wanted = describeVoice(base);
      } finally {
        inFlight -= 1;
      }
    }
    broadcast('tts', item);
  }

  // Registro de voz: lo último que se leyó o no, con la voz y el motivo.
  const log = [];
  function remember(e, d) {
    const entry = { eventId: e.id, ts: Date.now(), platform: e.platform, user: e.user?.name || '', text: d.read ? d.text : e.message, read: d.read, reason: d.reason, voice: d.voice || '' };
    log.unshift(entry);
    log.length = Math.min(log.length, 300);
    broadcast('tts-log', entry);
  }
  const recentLog = () => log.slice(0, 150);

  // Devuelve la decisión para que el servidor la muestre en Actividad.
  function handleEvent(e) {
    if (e.platform === 'tiktok' && e.type === 'gift' && isGateGift(e)) allow(e.user);
    if (e.type !== 'chat') return null;
    const d = decide(e);
    if (d.read) speak(d.text, { user: e.user.name, platform: e.platform, voice: d.voice, rate: d.rate, pitch: d.pitch });
    remember(e, d);
    return d;
  }

  // Prueba de filtros: dice qué pasaría sin leerlo ni guardar nada.
  function check({ platform = 'kick', user = 'Prueba', message = '' }) {
    const name = String(user || 'Prueba');
    return decide({ platform, user: { id: name.toLowerCase(), name }, message: String(message) }, { dryRun: true });
  }

  function speakNotice(text) {
    if (cfg().enabled && cfg().readMusicNotices) speak(text);
  }

  return { handleEvent, speak, speakNotice, check, allowedList, revoke, pool, allKeys, recentLog };
}

module.exports = { createTts };
