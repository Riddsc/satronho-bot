// Configuración y estado persistente en un archivo JSON.
// Simple a propósito: más adelante se puede cambiar por SQLite sin tocar
// el resto de la app, porque todos usan get/set/update.

const fs = require('fs');
const path = require('path');

// Lista inicial de groserías (se puede editar en el panel). Se compara
// palabra por palabra, nunca como trozo de otra palabra.
const DEFAULT_BANNED = [
  'puta', 'puto', 'putas', 'putos', 'hijueputa', 'hpta', 'gonorrea', 'malparido', 'malparida',
  'mierda', 'verga', 'pendejo', 'pendeja', 'culero', 'culera', 'cabron', 'cabrona', 'chingada',
  'chingar', 'chingado', 'marica', 'maricon', 'coño', 'joder', 'gilipollas', 'perra', 'zorra',
  'culo', 'polla', 'pinche', 'mamada', 'mamaguevo', 'carajo', 'imbecil', 'estupido', 'estupida',
  'idiota', 'malnacido', 'careverga', 'caremonda', 'hdp', 'tonto', 'tonta', 'bobo', 'boba',
];

const DEFAULTS = {
  port: 3800,
  platforms: {
    // hidden: la plataforma no se muestra en el panel (Conexiones → «Plataformas que uso»).
    tiktok: { channel: '', autoConnect: false, signApiKey: '', hidden: false },
    kick: { channel: '', autoConnect: false, hidden: false },
    twitch: { channel: '', autoConnect: false, hidden: false },
    starvios: { channel: '', autoConnect: false, hidden: false },
  },
  // Starvios no dice quién es quién: tus moderadores y tu lista de personas
  // (para «Quién pide música» y «Quién se lee»).
  starviosPeople: { mods: [], allowed: [] },
  // Orden de las plataformas en el panel (Conexiones → Plataformas que usas).
  platformOrder: ['kick', 'starvios', 'tiktok', 'twitch'],
  alerts: {
    durationMs: 5000, // duración por defecto (las de cada tipo mandan)
    minGift: 1, // diamantes mínimos para lanzar alerta de regalo
    masterVolume: 100, // volumen general de todas las alertas (0–100)
    platforms: { tiktok: true, kick: true, twitch: true, starvios: true }, // alertas de serie por plataforma
    enabled: { follow: true, sub: true, gift: true, like: false, share: false, sticker: true, join: false, superfan: true },
    // Por tipo: segundos en pantalla, sonido (incluido, 'file' o 'none'),
    // volumen 0–100, cortar el sonido a los N s (0 = completo), durar lo
    // que dura el sonido, y si Troya la lee en voz alta.
    types: {
      follow: { seconds: 5, sound: 'campanita', volume: 70, maxSeconds: 0, fitSound: false, speak: false, file: '' },
      sub: { seconds: 6, sound: 'fanfarria', volume: 70, maxSeconds: 0, fitSound: false, speak: false, file: '' },
      gift: { seconds: 5, sound: 'moneda', volume: 70, maxSeconds: 0, fitSound: false, speak: false, file: '' },
      like: { seconds: 3, sound: 'burbuja', volume: 50, maxSeconds: 0, fitSound: false, speak: false, file: '' },
      share: { seconds: 4, sound: 'zas', volume: 60, maxSeconds: 0, fitSound: false, speak: false, file: '' },
      // Stickers: salen al instante (sin cola), cortitos y con su imagen.
      sticker: { seconds: 2, sound: 'burbuja', volume: 55, maxSeconds: 2, fitSound: false, speak: false, file: '' },
      join: { seconds: 3, sound: 'brillo', volume: 40, maxSeconds: 0, fitSound: false, speak: false, file: '' },
      superfan: { seconds: 7, sound: 'fanfarria', volume: 80, maxSeconds: 0, fitSound: false, speak: true, file: '' },
    },
    // Regalos grandes: desde cierta cantidad de diamantes, otra alerta.
    bigGift: { enabled: false, min: 500, seconds: 10, sound: 'aplauso', volume: 85, maxSeconds: 0, fitSound: false, speak: true, file: '' },
  },
  tts: {
    enabled: true,
    piperVoice: 'es_MX-claude-high',
    speaker: 0,
    rate: 1,
    volume: 1,
    windowsVoice: '', // respaldo si Piper no está instalado
    sayName: true, // "Fulano dice: ..."
    skipCommands: true, // no leer mensajes que empiezan con "!"
    read: { tiktok: true, kick: true, starvios: true, twitch: true },
    // En TikTok solo se lee a quien envió este regalo.
    tiktokGate: { enabled: true, giftNames: ['Quiéreme', 'Heart Me'], hours: 24 },
    // Quién puede hablar en cada plataforma (0.12). TikTok:
    //   all · followers · subs · team · team-gift · mods
    //   team-gift = Miembro de tu equipo que ya te mandó «Quiéreme» alguna vez.
    // Kick y Twitch: all · subs · vip · mods. Starvios no dice roles: all.
    // Moderadores y tú siempre pasan; «Espectadores especiales» manda sobre todo.
    who: {
      tiktok: { mode: 'all', teamMinLevel: 1 },
      kick: { mode: 'all' },
      twitch: { mode: 'all' },
      starvios: { mode: 'all' },
    },
    filterProfanity: true, // reemplaza groserías por "piip"
    filterTricks: true, // detecta trucos: T0NT0, t.o.n.t.o, toooonto, letras raras
    bannedWords: DEFAULT_BANNED,
    // Cómo se lee: {usuario} {mensaje} {plataforma}. Vacío = «Fulano dice: …».
    template: '',
    // Velocidad y volumen por plataforma (1 = como la voz principal).
    perPlatform: { tiktok: { rate: 1, volume: 1 }, kick: { rate: 1, volume: 1 }, twitch: { rate: 1, volume: 1 }, starvios: { rate: 1, volume: 1 } },
    emojiWords: true, // 😂 «jajaja», ❤️ «corazón»… una vez; los demás emojis se ignoran
    stripNumbers: false, // no leer números (ni los escondidos en palabras)
    // Escudo anti-trampas (0.12): alfabetos permitidos y qué hacer con los demás.
    scripts: ['latin'],
    otherScripts: 'skip', // skip = no leer el mensaje · strip = quitar esas palabras · keep = leerlas
    oddSymbols: true, // quitar símbolos raros y no leer mensajes hechos casi solo de símbolos
    links: 'say', // say = decir «enlace» · remove = quitarlos
    skipMentions: false, // no leer mensajes que empiezan con @alguien
    stripMentions: false, // quitar los @menciones del texto
    skipHost: false, // no leer lo que escribes tú desde tu cuenta
    // Lo que escribe tu bot y se lee en voz alta.
    readBot: { commands: true, timers: false, manual: false },
    antiSpam: true, // no repetir el mismo mensaje de la misma persona
    // Bots del chat (BotRix, Nightbot…): no se leen. botNames suma nombres propios.
    pitch: 1, // tono de la voz (0.6 grave – 1.6 aguda); no cambia la velocidad
    mainVoice: '', // voz principal elegida a mano (vacío = la de Piper); p. ej. 'ms:es-CO-SalomeNeural'
    ignoreBots: true,
    ignoreBotSuffix: true, // también cualquier nombre que termine en «bot»
    botNames: [],
    cooldownSec: 0, // espera mínima entre mensajes leídos de una persona
    expireSec: 60, // los mensajes más viejos que esto ya no se leen
    maxLength: 200,
    maxQueue: 15,
    // Voces por espectador:
    //   'single'    todos con la voz principal
    //   'perViewer' cada espectador recibe una voz fija de la lista
    //   'random'    una voz al azar en cada mensaje
    voiceMode: 'perViewer',
    voicePool: [], // "idVoz#variante"; vacío = todas las voces descargadas
    // Espectadores especiales: { key: 'kick:pepe', spokenName, voice, action: 'allow'|'mute' }
    special: [],
    readMusicNotices: false, // leer en voz alta los avisos de la música
    // Más voces: cada voz también en tono grave y agudo (×3), y las voces de
    // Windows en español sumadas al reparto.
    toneVariants: true,
    useWindowsVoices: false,
    useOnlineVoices: false, // voces en línea de Microsoft (acentos de Latinoamérica, necesitan internet)
  },
  // Respuestas del bot en el chat (Kick por ahora).
  // sendAs: 'me' = con la cuenta del streamer (lo normal); 'bot' = cuenta aparte.
  chatBot: {
    enabled: true, // interruptor general del Chat Bot (MechaRidds)
    kick: { enabled: true, sendAs: 'me', music: true },
    starvios: { enabled: true, sendAs: 'me', music: true },
  },
  // Claves y permisos (solo en tu PC; nunca se mandan al panel).
  secrets: { kick: {}, starvios: {}, spotify: {} },
  // Spotify (0.16): con Premium, los pedidos del chat van a tu cola de Spotify.
  spotify: { clientId: '', requests: false, showInOverlay: true },
  windowsVoices: [], // nombres de las voces de Windows en español (los manda el panel)
  // Cómo se ve el panel (solo en tu PC).
  // sidebar: 'compact' (solo iconos; se despliega al pasar el ratón) o 'open'.
  appearance: { theme: 'noche', accent: '#ffb23e', font: 'bricolage-grotesque', size: 'm', corners: 'redondas', sidebar: 'compact' },
  // Cómo se ven los overlays en OBS.
  overlayStyle: {
    font: 'bricolage-grotesque', accent: '#ffb23e', text: '#ffffff', card: 'solid', corners: 'round', scale: 1, sound: true, alertColors: 'type',
    theme: 'satronho', // satronho · neon · cristal · papel · arcade · dulce · minimal
    // Podio en vivo: qué mide, cuántos puestos (3 a 5), título y qué muestra.
    podium: { metric: 'likes', size: 3, title: '', showValues: true, avatars: true, crown: true },
  },
  // Atajos de teclado globales (funcionan aunque estés en OBS o en un juego).
  // Apagados al principio para no chocar con los atajos de otros programas.
  hotkeys: {
    enabled: false,
    keys: {
      skipVoice: 'Ctrl+Alt+S',
      toggleVoice: 'Ctrl+Alt+V',
      musicSkip: 'Ctrl+Alt+N',
      musicPause: 'Ctrl+Alt+P',
      testAlert: 'Ctrl+Alt+A',
      showApp: 'Ctrl+Alt+B',
    },
  },
  // Ventana: nunca se abre sola. Opcionalmente se esconde junto al reloj al minimizar.
  // popout: la ventana aparte del chat (Chat en vivo → Ventana). bounds
  // guarda dónde la dejaste (monitor, posición y tamaño); la pone la app.
  window: { minimizeToTray: false, popout: { onTop: false, opacity: 100, idleOpacity: 100, bounds: null } },
  // Tu perfil: cómo te llaman las guías, tu foto, el menú y la barra derecha.
  profile: {
    name: '',
    photo: '',
    greet: true,
    menuHidden: [],
    menuOrder: [],
    rail: {
      mode: 'fixed', // fixed (pegada a la derecha) · floating (la mueves) · off
      buttons: ['voice', 'skipVoice', 'music', 'musicSkip', 'requests', 'alertsSkip', 'alertsMute', 'podiumReset', 'chat', 'news', 'report'],
      x: null,
      y: null,
      bg: 92, // flotante: cuánto se ve el fondo (0 = solo los botones)
      idle: 100, // flotante: opacidad cuando no la usas (vuelve a 100 al pasar el ratón)
    },
  },
  // Overlays de la galería: { id: { kind, name, style, settings, look } }
  widgets: {},
  // Contadores en pantalla: { id, name, icon, value, step, command, gift, anyone }
  // Biblioteca de sonidos (0.16): favoritos, recientes y el comando del chat.
  sounds: {
    favorites: [],
    recent: [],
    hideRude: false, // esconder la categoría «Groseros»
    chat: { enabled: false, command: 'sonido', cooldownSec: 15, userCooldownSec: 60, who: 'all', volume: 70, onlyMine: false },
  },
  counters: [
    { id: 'muertes', name: 'Muertes', icon: '💀', value: 0, step: 1, command: 'muerte', gift: '', anyone: false },
    { id: 'jefes', name: 'Jefes', icon: '⚔️', value: 0, step: 1, command: 'jefe', gift: '', anyone: false, goal: 5 },
  ],
  countdown: { endsAt: 0, left: 3600000, running: false },
  // Alertas propias: reglas por regalo, sticker, rango de monedas, likes… (alertRules.js)
  alertRules: [],
  ttsAllowed: {}, // usuarios de TikTok que enviaron el regalo: { id: { name, ts } }
  music: {
    enabled: true,
    platforms: { kick: true, starvios: true, twitch: true, tiktok: false },
    maxPerUser: 2,
    maxDurationMin: 10,
    maxQueue: 30,
    volume: 60,
    cooldownSec: 30, // espera entre pedidos de una misma persona
    // Quién puede pedir en cada plataforma (mismos modos que la voz).
    who: { tiktok: { mode: 'all', teamMinLevel: 1 }, kick: { mode: 'all' }, twitch: { mode: 'all' }, starvios: { mode: 'all' } },
    // Comandos: nombres (sin «!») y si están activos.
    commands: {
      play: { names: ['play', 'temita'], enabled: true },
      skip: { names: ['skip'], enabled: true },
      remove: { names: ['quitar'], enabled: true },
      queue: { names: ['cola'], enabled: true },
      now: { names: ['sonando', 'cancion'], enabled: true },
      mine: { names: ['mia'], enabled: true },
      vote: { names: ['votar'], enabled: true },
    },
    voteSkip: { enabled: true, needed: 3 },
    modsSkip: true, // tú y tus moderadores saltan cualquiera sin votar
    // Derechos de autor: off · avoid (evita videos oficiales de sellos) · free (solo música libre)
    copyright: 'avoid',
  },
  musicPlaylists: [], // listas guardadas: { id, name, songs: [{ videoId, title, author, durationSec, thumbnail }] }
  stats: {
    idleMinutes: 30, // sin actividad este tiempo = el directo terminó
    usdPerDiamond: 0.005, // estimado de lo que recibe el creador por diamante
    countTests: false, // contar los eventos de prueba (solo para probar)
  },
  updates: {
    // Dirección donde publicas las versiones (Velopack). Vacío = no buscar.
    feedUrl: '',
    auto: true,
  },
  // Novedades: última versión cuyas novedades ya vio el streamer.
  seenVersion: '',
  guides: {
    visible: true,
    welcomeDone: false,
    photos: {}, // { samy: 'samy.png', ... }
    steps: {}, // primeros pasos hechos a mano: { overlay: true, test: true }
    stepsHidden: false,
  },
  // Comandos del chat (ver modules/commands.js).
  commands: [
    { id: 'ejemplo-comandos', name: 'comandos', aliases: ['ayuda'], response: 'Comandos: {comandos} · Pide música con !play canción', permission: 'all', cooldownSec: 20, userCooldownSec: 0, speak: false, enabled: true, uses: 0, platforms: { kick: true, starvios: true, twitch: true, tiktok: true } },
    { id: 'ejemplo-redes', name: 'redes', aliases: [], response: '¡Sígueme en mis redes! (Cambia este texto en Comandos del chat)', permission: 'all', cooldownSec: 30, userCooldownSec: 0, speak: false, enabled: false, uses: 0, platforms: { kick: true, starvios: true, twitch: true, tiktok: true } },
  ],
  // Mensajes automáticos: cada X minutos, si hubo al menos N mensajes en el chat.
  timers: {
    enabled: true,
    items: [
      { id: 'ejemplo-musica', text: '🎵 ¿Quieres escuchar algo? Pide tu canción con !play nombre', everyMin: 20, minChat: 10, enabled: false, platforms: { kick: true, starvios: true } },
    ],
  },
  goals: [
    { id: 'seguidores', title: 'Meta de seguidores', type: 'follow', platform: 'all', countBy: 'events', current: 0, target: 50 },
    { id: 'diamantes', title: 'Meta de diamantes', type: 'gift', platform: 'tiktok', countBy: 'amount', current: 0, target: 1000 },
  ],
};

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Mezcla profunda: lo guardado gana, pero las claves nuevas de DEFAULTS
// aparecen solas cuando se actualiza la app. Los arreglos se reemplazan.
function deepMerge(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    out[k] = isObject(v) && isObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

class Store {
  constructor(dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.dir = dataDir;
    this.file = path.join(dataDir, 'satronho-config.json');
    const saved = this.load();
    this.data = deepMerge(DEFAULTS, saved);
    // 0.12: el filtro «solo quien envió Quiéreme» pasa a ser una regla de
    // «Quién puede hablar». Si lo tenías apagado, TikTok queda en «Todos».
    if (saved.tts && !saved.tts.who && saved.tts.tiktokGate?.enabled === false) {
      const who = this.data.tts.who;
      this.data.tts = { ...this.data.tts, who: { ...who, tiktok: { ...who.tiktok, mode: 'all' } } };
    }
    // 0.22.4: se quitó «Solo quien mandó Quiéreme»; quien la tenía pasa a «Todos».
    if (this.data.tts?.who?.tiktok?.mode === 'gift') {
      const who = this.data.tts.who;
      this.data.tts = { ...this.data.tts, who: { ...who, tiktok: { ...who.tiktok, mode: 'all' } } };
    }
    this.saveTimer = null;
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      return {};
    }
  }

  get(key) {
    return key ? this.data[key] : this.data;
  }

  set(key, value) {
    this.data[key] = value;
    this.scheduleSave();
  }

  // Mezcla un objeto parcial dentro de la configuración (para el panel).
  update(partial) {
    this.data = deepMerge(this.data, partial);
    this.scheduleSave();
    return this.data;
  }

  // Guarda con un pequeño retraso para no escribir el disco en cada evento.
  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 300);
  }

  saveNow() {
    clearTimeout(this.saveTimer);
    // Escritura atómica: si se corta la luz no queda un JSON a medias.
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store, DEFAULTS, DEFAULT_BANNED };
