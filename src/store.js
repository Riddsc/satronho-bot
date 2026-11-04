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
  // Orden de las plataformas en el panel (Conexiones → Plataformas que usas).
  platformOrder: ['kick', 'starvios', 'tiktok', 'twitch'],
  alerts: {
    durationMs: 5000, // duración por defecto (las de cada tipo mandan)
    minGift: 1, // diamantes mínimos para lanzar alerta de regalo
    enabled: { follow: true, sub: true, gift: true, like: false, share: false },
    // Por tipo: segundos en pantalla, sonido (incluido, 'file' o 'none'),
    // volumen 0–100, cortar el sonido a los N s (0 = completo), durar lo
    // que dura el sonido, y si Troya la lee en voz alta.
    types: {
      follow: { seconds: 5, sound: 'campanita', volume: 70, maxSeconds: 0, fitSound: false, speak: false, file: '' },
      sub: { seconds: 6, sound: 'fanfarria', volume: 70, maxSeconds: 0, fitSound: false, speak: false, file: '' },
      gift: { seconds: 5, sound: 'moneda', volume: 70, maxSeconds: 0, fitSound: false, speak: false, file: '' },
      like: { seconds: 3, sound: 'burbuja', volume: 50, maxSeconds: 0, fitSound: false, speak: false, file: '' },
      share: { seconds: 4, sound: 'zas', volume: 60, maxSeconds: 0, fitSound: false, speak: false, file: '' },
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
    filterProfanity: true, // reemplaza groserías por "piip"
    filterTricks: true, // detecta trucos: T0NT0, t.o.n.t.o, toooonto, letras raras
    bannedWords: DEFAULT_BANNED,
    stripNumbers: false, // no leer números (ni los escondidos en palabras)
    antiSpam: true, // no repetir el mismo mensaje de la misma persona
    // Bots del chat (BotRix, Nightbot…): no se leen. botNames suma nombres propios.
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
  secrets: { kick: {}, starvios: {} },
  windowsVoices: [], // nombres de las voces de Windows en español (los manda el panel)
  // Cómo se ve el panel (solo en tu PC).
  appearance: { theme: 'noche', accent: '#ffb23e', font: 'bricolage-grotesque', size: 'm', corners: 'redondas' },
  // Cómo se ven los overlays en OBS.
  overlayStyle: { font: 'bricolage-grotesque', accent: '#ffb23e', text: '#ffffff', card: 'solid', corners: 'round', scale: 1, sound: true, alertColors: 'type' },
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
  window: { minimizeToTray: false },
  ttsAllowed: {}, // usuarios de TikTok que enviaron el regalo: { id: { name, ts } }
  music: {
    enabled: true,
    platforms: { kick: true, starvios: true, twitch: true, tiktok: false },
    maxPerUser: 2,
    maxDurationMin: 10,
    maxQueue: 30,
    volume: 60,
  },
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
    this.data = deepMerge(DEFAULTS, this.load());
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
