// Comandos del chat y mensajes automáticos.
//
// Comandos: el streamer crea !nombre (con alias) y su respuesta. Cuando
// alguien lo escribe, Satronho Bot responde en el chat de esa plataforma
// (Kick y Starvios escriben; en Twitch y TikTok puede decirlo Troya en voz
// alta). Cada comando tiene espera general, espera por persona, permisos y
// plataformas.
//
// Variables en la respuesta:
//   {usuario} {canal} {plataforma} {cancion} {cola} {usos} {comandos}
//   {mensaje} (lo que escribió después del comando) {1} {2}… (cada palabra)
//   {azar:1-100} {hora}
//
// Mensajes automáticos: el bot escribe un texto cada X minutos, solo si en
// ese tiempo hubo al menos N mensajes en el chat (para no hablar solo).

const crypto = require('crypto');

// Nombres que ya usa la app (música) y no se pueden pisar.
const RESERVED = new Set(['play', 'temita', 'skip', 'quitar']);
const PLATFORMS = ['kick', 'starvios', 'twitch', 'tiktok'];

const cleanName = (s) => String(s || '').trim().replace(/^!+/, '').toLowerCase().replace(/\s+/g, '').slice(0, 30);

function createCommands({ store, writers, getStatus, getMusic, speak, broadcast = () => {} }) {
  const lastUse = new Map(); // id -> ts (espera general)
  const lastUserUse = new Map(); // id:usuario -> ts
  const timerState = new Map(); // id -> { last, chat }
  let chatSinceStart = 0;

  const list = () => store.get('commands') || [];
  const timersCfg = () => store.get('timers') || { enabled: true, items: [] };

  // ---------- CRUD ----------
  function validate(input, id = null) {
    const name = cleanName(input.name);
    if (!name || !/^[\p{L}\p{N}_-]+$/u.test(name)) throw new Error('El comando necesita un nombre, sin espacios (por ejemplo «redes»)');
    const aliases = [...new Set((Array.isArray(input.aliases) ? input.aliases : String(input.aliases || '').split(/[\s,]+/)).map(cleanName).filter(Boolean))].filter((a) => a !== name);
    const all = [name, ...aliases];
    const clash = all.find((n) => RESERVED.has(n));
    if (clash) throw new Error(`!${clash} ya lo usa la música`);
    for (const c of list()) {
      if (c.id === id) continue;
      const theirs = [c.name, ...(c.aliases || [])];
      const dup = all.find((n) => theirs.includes(n));
      if (dup) throw new Error(`Ya tienes un comando !${dup}`);
    }
    const response = String(input.response || '').trim().slice(0, 450);
    if (!response) throw new Error('Escribe la respuesta del comando');
    const platforms = {};
    for (const p of PLATFORMS) platforms[p] = input.platforms ? input.platforms[p] !== false : true;
    return {
      name,
      aliases,
      response,
      permission: ['all', 'mods', 'owner'].includes(input.permission) ? input.permission : 'all',
      cooldownSec: Math.max(0, Math.min(3600, Number(input.cooldownSec) || 0)),
      userCooldownSec: Math.max(0, Math.min(3600, Number(input.userCooldownSec) || 0)),
      speak: Boolean(input.speak),
      enabled: input.enabled !== false,
      platforms,
    };
  }

  function save(all) {
    store.set('commands', all);
    broadcast('commands', all);
  }
  function create(input) {
    const cmd = { id: crypto.randomUUID(), uses: 0, ...validate(input) };
    save([...list(), cmd]);
    return cmd;
  }
  function update(id, input) {
    const cur = list().find((c) => c.id === id);
    if (!cur) throw new Error('Comando no encontrado');
    const merged = { ...cur, ...input };
    const next = { ...cur, ...validate(merged, id) };
    save(list().map((c) => (c.id === id ? next : c)));
    return next;
  }
  function remove(id) {
    save(list().filter((c) => c.id !== id));
  }

  // ---------- Respuesta ----------
  function fill(text, e, cmd, args) {
    const music = getMusic?.() || {};
    const channel = store.get('platforms')?.[e.platform]?.channel || '';
    const now = new Date();
    return text
      .replace(/\{usuario\}/gi, e.user?.name || '')
      .replace(/\{canal\}/gi, String(channel).replace(/^@/, ''))
      .replace(/\{plataforma\}/gi, { kick: 'Kick', starvios: 'Starvios', twitch: 'Twitch', tiktok: 'TikTok' }[e.platform] || e.platform)
      .replace(/\{cancion\}/gi, music.current?.title || 'nada por ahora')
      .replace(/\{cola\}/gi, String(music.queue?.length || 0))
      .replace(/\{usos\}/gi, String(cmd.uses || 0))
      .replace(/\{comandos\}/gi, list().filter((c) => c.enabled && c.permission === 'all' && c.platforms?.[e.platform] !== false).map((c) => `!${c.name}`).join(' '))
      .replace(/\{mensaje\}/gi, args.join(' '))
      .replace(/\{(\d)\}/g, (_, n) => args[Number(n) - 1] || '')
      .replace(/\{azar:(\d+)-(\d+)\}/gi, (_, a, b) => {
        const lo = Math.min(Number(a), Number(b));
        const hi = Math.max(Number(a), Number(b));
        return String(lo + Math.floor(Math.random() * (hi - lo + 1)));
      })
      .replace(/\{hora\}/gi, now.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }))
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isMod(e) {
    const badges = (e.extra?.badges || []).map(String);
    if (badges.some((b) => /broadcaster|owner|moderator|^mod/.test(b))) return true;
    return isOwner(e);
  }
  function isOwner(e) {
    const channel = String(store.get('platforms')?.[e.platform]?.channel || '').replace(/^@/, '').toLowerCase();
    const badges = (e.extra?.badges || []).map(String);
    return badges.some((b) => /broadcaster|owner/.test(b)) || (channel && String(e.user?.name || '').toLowerCase() === channel);
  }

  // Devuelve un resultado (para el panel y las pruebas) o null si no es un comando propio.
  function handle(e, { dryRun = false } = {}) {
    if (e.type !== 'chat' || !String(e.message || '').trim().startsWith('!')) return null;
    const [first, ...args] = String(e.message).trim().slice(1).split(/\s+/);
    const name = cleanName(first);
    if (!name || RESERVED.has(name)) return null;
    const cmd = list().find((c) => c.name === name || (c.aliases || []).includes(name));
    if (!cmd) return null;
    const no = (reason) => ({ ran: false, reason, command: cmd.name });
    if (!cmd.enabled) return no('el comando está apagado');
    if (cmd.platforms?.[e.platform] === false) return no('apagado en esta plataforma');
    if (cmd.permission === 'mods' && !isMod(e)) return no('solo moderadores');
    if (cmd.permission === 'owner' && !isOwner(e)) return no('solo el dueño del canal');
    const now = Date.now();
    if (cmd.cooldownSec && now - (lastUse.get(cmd.id) || 0) < cmd.cooldownSec * 1000) return no('en espera');
    const uKey = `${cmd.id}:${e.platform}:${String(e.user?.id || e.user?.name).toLowerCase()}`;
    if (cmd.userCooldownSec && now - (lastUserUse.get(uKey) || 0) < cmd.userCooldownSec * 1000) return no('esa persona debe esperar');

    const text = fill(cmd.response, e, { ...cmd, uses: (cmd.uses || 0) + 1 }, args);
    if (dryRun) return { ran: true, text, command: cmd.name };

    lastUse.set(cmd.id, now);
    lastUserUse.set(uKey, now);
    cmd.uses = (cmd.uses || 0) + 1;
    store.set('commands', list().map((c) => (c.id === cmd.id ? { ...c, uses: cmd.uses } : c)));
    const writer = writers[e.platform];
    const wrote = writer ? writer.say(text, 'comando') : false;
    if (cmd.speak && store.get('tts').readBot?.commands !== false) speak?.(text);
    broadcast('command-used', { name: cmd.name, user: e.user?.name, platform: e.platform, text, wrote, ts: now });
    return { ran: true, text, wrote, command: cmd.name };
  }

  // ---------- Mensajes automáticos ----------
  function validateTimer(input) {
    const text = String(input.text || '').trim().slice(0, 450);
    if (!text) throw new Error('Escribe el mensaje');
    const platforms = {};
    for (const p of ['kick', 'starvios']) platforms[p] = input.platforms ? input.platforms[p] !== false : true;
    return {
      text,
      everyMin: Math.max(1, Math.min(240, Number(input.everyMin) || 15)),
      minChat: Math.max(0, Math.min(500, Number(input.minChat) || 0)),
      enabled: input.enabled !== false,
      platforms,
    };
  }
  function saveTimers(t) {
    store.set('timers', t);
    broadcast('timers', t);
  }
  function createTimer(input) {
    const t = timersCfg();
    const item = { id: crypto.randomUUID(), ...validateTimer(input) };
    timerState.set(item.id, { last: Date.now(), chat: 0 });
    saveTimers({ ...t, items: [...(t.items || []), item] });
    return item;
  }
  function updateTimer(id, input) {
    const t = timersCfg();
    const cur = (t.items || []).find((x) => x.id === id);
    if (!cur) throw new Error('Mensaje no encontrado');
    const next = { ...cur, ...validateTimer({ ...cur, ...input }) };
    saveTimers({ ...t, items: t.items.map((x) => (x.id === id ? next : x)) });
    return next;
  }
  function removeTimer(id) {
    const t = timersCfg();
    timerState.delete(id);
    saveTimers({ ...t, items: (t.items || []).filter((x) => x.id !== id) });
  }
  function setTimersEnabled(enabled) {
    saveTimers({ ...timersCfg(), enabled: Boolean(enabled) });
  }

  function onChat(e) {
    if (e.type !== 'chat') return;
    chatSinceStart++;
    for (const st of timerState.values()) st.chat++;
  }

  // Envía un mensaje automático en las plataformas conectadas que escriben.
  function fire(item) {
    const status = getStatus?.() || {};
    const sent = [];
    for (const p of ['kick', 'starvios']) {
      if (item.platforms?.[p] === false) continue;
      if (status[p]?.state !== 'connected') continue;
      if (writers[p]?.say(item.text, 'automatico')) sent.push(p);
    }
    if (sent.length && store.get('tts').readBot?.timers) speak?.(item.text);
    return sent;
  }

  function tick() {
    const t = timersCfg();
    if (!t.enabled) return;
    const now = Date.now();
    for (const item of t.items || []) {
      if (!item.enabled) continue;
      if (!timerState.has(item.id)) timerState.set(item.id, { last: now, chat: 0 });
      const st = timerState.get(item.id);
      if (now - st.last < item.everyMin * 60 * 1000) continue;
      if (st.chat < (item.minChat || 0)) continue;
      const sent = fire(item);
      st.last = now;
      st.chat = 0;
      if (sent.length) broadcast('timer-sent', { id: item.id, platforms: sent, ts: now });
    }
  }
  const interval = setInterval(tick, 15 * 1000);
  interval.unref?.();

  function sendNow(id) {
    const item = (timersCfg().items || []).find((x) => x.id === id);
    if (!item) throw new Error('Mensaje no encontrado');
    const sent = fire(item);
    timerState.set(id, { last: Date.now(), chat: 0 });
    return sent;
  }

  return {
    list, create, update, remove, handle,
    timers: timersCfg, createTimer, updateTimer, removeTimer, setTimersEnabled, sendNow, onChat, tick,
    stop: () => clearInterval(interval),
    _chatCount: () => chatSinceStart,
  };
}

module.exports = { createCommands, RESERVED };
