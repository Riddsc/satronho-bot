// Ayuda conversada: tocas a Samy, Troya, Ñoño o Juana y les preguntas
// dónde está algo o cómo funciona. Las respuestas salen de esta base de
// conocimiento (funciona sin internet). Si la pregunta es de otro tema,
// el guía te pasa con quien sabe. "Llévame ahí" te lleva a la sección.
//
// Reparto: Samy y Troya son las guías principales (≈60 % de los temas y
// las preguntas generales); Ñoño y Juana llevan música y números (≈40 %).

import { $, $$, esc } from './util.js';
import { showPage } from './nav.js';
import { GUIDES, avatarHTML, setMood, pickPhoto, removePhoto, hasPhoto } from './guides.js';

// ---------- Contexto en vivo (lo pone app.js) ----------
let ctx = () => ({});
export function setHelpContext(fn) {
  ctx = fn;
}

const PLAT = { tiktok: 'TikTok', kick: 'Kick', starvios: 'Starvios', twitch: 'Twitch' };

// ---------- Base de conocimiento ----------
// keys: raíces de palabras ("conect" sirve para conectar, conexión…) o frases.
const KB = [
  // ===== Samy: conexiones, la app en general, OBS, actividad =====
  {
    guide: 'samy', q: '¿Cómo conecto TikTok, Kick, Starvios o Twitch?',
    keys: ['conectar', 'vincular', 'enlazar', 'usuario', 'canal', 'cuenta', 'tiktok', 'kick', 'starvios', 'twitch', 'poner'],
    answer: 'En <b>Conexiones</b> escribe tu usuario (en TikTok con o sin @) y pulsa <b>Conectar</b>. No hace falta contraseña: solo leo lo que pasa en tu directo. TikTok trae alertas, metas, estadísticas y voz; Kick, Starvios y Twitch traen el chat para la voz y la música.',
    go: '#card-conexiones',
  },
  {
    guide: 'samy', q: '¿Cómo hago que el bot escriba en mi chat de Kick?',
    keys: ['escribir', 'responder', 'bot en el chat', 'autorizar', 'mensaje', 'kick', 'satronhobot', 'cuenta aparte', 'client'],
    answer: 'En <b>Conexiones → Escribir</b>, en Kick, pulsa <b>Autorizar</b> en «Tu cuenta de Kick», entra con tu cuenta y acepta el permiso. Desde ahí respondo a los pedidos de música con tu nombre. Si tienes una cuenta solo para el bot, autorízala en <b>Avanzado</b> y elige «Cuenta aparte».',
    go: '#kickbot',
  },
  {
    guide: 'samy', q: '¿Cómo hago que el bot escriba en mi chat de Starvios?',
    keys: ['escribir', 'responder', 'starvios', 'iniciar sesión', 'sesion', 'bot en el chat'],
    answer: 'En <b>Conexiones → Escribir</b>, en Starvios, pulsa <b>Iniciar sesión</b>. Se abre una ventana de Starvios: entra con tu cuenta y yo tomo la sesión sola. No veo tu contraseña. Si tienes una cuenta aparte para el bot, entra con ella en <b>Avanzado</b>.',
    go: '#starviosbot',
  },
  {
    guide: 'troya', q: '¿Cómo hago que no lea a los bots?',
    keys: ['bot', 'bots', 'botrix', 'nightbot', 'streamelements', 'no leer', 'silenciar bot'],
    answer: 'En <b>Voz del chat → Quién se lee</b>, en <b>Bots del chat</b>, deja activado «No leer a los bots». Ya conozco a BotRix, Nightbot, StreamElements y otros, y también callo a quien se llame «…bot». Si un bot tuyo tiene otro nombre, escríbelo en la lista.',
    go: '#tts-bots',
  },
  {
    guide: 'mecha', q: '¿Cómo creo un comando como !redes?',
    keys: ['comando', 'comandos', 'redes', 'discord', '!', 'respuesta', 'crear comando'],
    answer: 'En <b>Chat Bot → Comandos</b> pulsa <b>Nuevo comando</b>, escribe el nombre (sin !) y la respuesta. Puedes usar {usuario}, {mensaje} y más. Respondo en Kick y Starvios; en Twitch y TikTok Troya puede decirlo en voz alta. Pruébalo en la tarjeta <b>Probar</b>.',
    go: '#card-comandos',
  },
  {
    guide: 'mecha', q: '¿Cómo pongo un mensaje que se repita cada X minutos?',
    keys: ['automático', 'automaticos', 'cada', 'minutos', 'repetir', 'temporizador', 'timer', 'anuncio'],
    answer: 'En <b>Chat Bot → Mensajes automáticos</b> pulsa <b>Nuevo mensaje</b>, escribe el texto y cada cuántos minutos. Si pones un mínimo de mensajes, espero a que el chat hable para no escribir solo.',
    go: '#card-automaticos',
  },
  {
    guide: 'mecha', q: '¿Cómo reporto un error o pido ayuda?',
    keys: ['error', 'falla', 'bug', 'reportar', 'problema', 'soporte', 'ayuda', 'idea', 'sugerencia', 'no funciona'],
    answer: 'En <b>Ayuda → Reportar un problema</b> cuéntame qué pasó y pulsa <b>Enviar a Ridds</b>. Le llega directo a su Discord, con la versión y los últimos errores si lo dejas marcado. Nunca envío tus claves.',
    go: '#card-reportar',
  },
  {
    guide: 'nono', q: '¿Cómo busco canciones y guardo listas?',
    keys: ['buscar', 'lista', 'listas', 'playlist', 'historial', 'mezclar', 'importar', 'guardar cola'],
    answer: 'En <b>Música</b>, escribe en <b>Buscar y añadir</b> y pulsa Enter: toca <b>+</b> para poner la canción en cola. En la cola puedes mezclar, guardar como lista o vaciar, y en <b>Historial</b> volver a poner lo que ya sonó. En <b>Listas de reproducción</b> pones tus listas o importas una de YouTube.',
    go: '#mz-results',
  },
  {
    guide: 'samy', q: '¿Cómo escondo las plataformas que no uso?',
    keys: ['esconder', 'ocultar', 'quitar plataforma', 'no uso', 'plataformas que uso', 'twitch', 'starvios'],
    answer: 'En <b>Conexiones</b>, abre <b>Plataformas que uso</b> y desmarca las que no usas. Se esconden del panel y no se conectan solas. Puedes volver a marcarlas cuando quieras.',
    go: '#conn-pick',
  },
  {
    guide: 'samy', q: '¿Estoy conectado?',
    keys: ['estoy', 'estado', 'conectado', 'funcionando', 'escuchando', 'activo'],
    answer: () => {
      const st = Object.values(ctx().status || {});
      if (!st.length) return 'Todavía no te has conectado a ninguna plataforma. Escribe tu usuario en <b>Conexiones</b> y pulsa <b>Conectar</b>.';
      return st.map((s) => `<b>${PLAT[s.platform] || s.platform}</b>: ${{ connected: 'conectado ✓', connecting: 'conectando…', error: 'con error', disconnected: 'desconectado' }[s.state] || s.state}${s.detail ? ` (${esc(s.detail)})` : ''}`).join('<br>');
    },
    go: '#card-conexiones',
  },
  {
    guide: 'samy', q: 'No se conecta, ¿qué hago?',
    keys: ['error', 'falla', 'reintento', 'funciona', 'bloqueado', 'offline', 'problema', 'conectar', 'nada'],
    answer: 'Primero mira el estado junto al nombre de la plataforma. «El canal no está en directo» es normal en TikTok: me conecto solo cuando empiezas el LIVE. Si dice «reintento en…», yo sigo intentando sin que hagas nada. En TikTok, una clave de Euler Stream (en <i>Avanzado</i>) hace la conexión más estable.',
    go: '#card-conexiones',
  },
  {
    guide: 'samy', q: '¿Puede conectarse sola al abrir la app?',
    keys: ['abrir', 'automatico', 'sola', 'solo', 'siempre', 'inicio', 'arrancar', 'conectar'],
    answer: 'Sí: marca <b>«Conectar al abrir»</b> debajo de cada plataforma. La próxima vez que abras Satronho Bot me conecto yo solita.',
    go: '#card-conexiones',
  },
  {
    guide: 'samy', q: '¿Cómo pongo las alertas o la música en OBS?',
    keys: ['obs', 'streamlabs', 'studio', 'fuente', 'navegador', 'overlay', 'overlays', 'escena', 'url', 'pantalla', 'stream'],
    answer: 'En OBS: <b>Fuentes → + → Navegador</b>, y pega la URL. Las URLs están en <b>Overlays para OBS</b> (menú de la izquierda), con botón <b>Copiar</b>: <i>Alertas de TikTok</i> (800×300), <i>Sonando ahora</i> (700×140) y una por cada meta. Funciona igual en Streamlabs y TikTok LIVE Studio.',
    go: '#overlay-list',
  },
  {
    guide: 'samy', q: '¿Para qué sirve Satronho Bot?',
    keys: ['sirve', 'satronho', 'funciones', 'empezar', 'pasos', 'tutorial', 'app', 'inicio', 'general', 'ayuda'],
    answer: 'Satronho Bot lee lo que pasa en tu directo y reacciona: Troya lee el chat en voz alta, Ñoño pone la música que pide el chat, Juana muestra alertas, metas y estadísticas, y yo me encargo de conectarte. Para empezar: 1) conéctate aquí conmigo, 2) instala una voz con Troya, 3) pon los overlays en OBS.',
    go: '#card-conexiones',
  },
  {
    guide: 'samy', q: '¿Dónde veo lo que está pasando en el chat?',
    keys: ['actividad', 'registro', 'mensajes', 'chat', 'eventos', 'log', 'pasando', 'ver'],
    answer: 'En <b>Chat en vivo</b> ves todo lo que llega: chat, regalos, follows… Cada mensaje lleva 🔊 si Troya lo leyó o 🔇 con el motivo si no. Ahí mismo puedes <b>simular un mensaje</b> para probar sin estar en directo.',
    go: '#card-actividad',
  },
  {
    guide: 'samy', q: '¿Cómo pruebo sin estar en directo?',
    keys: ['probar', 'simular', 'prueba', 'test', 'ensayar', 'practicar', 'directo', 'vivo'],
    answer: 'Tienes dos formas: los botones <b>Probar</b> de <b>Alertas</b> lanzan follows, regalos o un Quiéreme falsos, y en <b>Chat en vivo</b> (o con <b>▶ Simular</b> arriba) puedes simular cualquier mensaje del chat, incluso <code>!play</code>.',
    go: '#sim',
  },
  {
    guide: 'samy', q: '¿Cómo cambio la foto de un guía?',
    keys: ['foto', 'imagen', 'cara', 'dibujo', 'avatar', 'guia', 'guias', 'mascota', 'mascotas', 'ocultar', 'samy', 'troya', 'juana', 'ñoño'],
    answer: 'Tócanos y abajo en esta ventana tienes <b>Cambiar foto</b> o <b>Volver al dibujo</b>. Si prefieres el panel limpio, en <b>Ajustes → App</b> puedes ocultarnos (abajo a la derecha seguiremos a mano por si nos necesitas).',
  },
  {
    guide: 'samy', q: '¿Cómo instalo o abro la app?',
    keys: ['instalar', 'exe', 'portable', 'smartscreen', 'ejecutar', 'programa', 'app', 'abrir', 'windows'],
    answer: 'Descomprime <b>SatronhoBot-win-Portable.zip</b> donde quieras y abre <b>SatronhoBot.exe</b>. Si Windows muestra «Windows protegió su PC», pulsa <i>Más información → Ejecutar de todas formas</i> (sale porque la app aún no tiene firma digital).',
  },
  {
    guide: 'samy', q: '¿Cómo se actualiza la app?',
    keys: ['actualizar', 'actualizacion', 'version', 'update', 'nueva'],
    answer: () => `Estás usando <b>${esc(ctx().version || '')}</b>. Al abrir y cada 6 horas reviso si hay una versión nueva publicada. Si instalaste con el instalador, la descargo sola y arriba sale <b>«Reiniciar y actualizar»</b>; con el .zip portable sale <b>«Hay una versión nueva»</b> con un botón para descargarla. Tus ajustes nunca se pierden.`,
    go: '#update-auto',
  },
  {
    guide: 'samy', q: '¿Dónde se guardan mis datos?',
    keys: ['datos', 'guardar', 'carpeta', 'configuracion', 'appdata', 'copia', 'privacidad', 'archivos'],
    answer: 'Todo se queda en tu PC, en <code>%APPDATA%\\Satronho Bot</code>: la configuración, las voces descargadas, las fotos de los guías y las estadísticas. No subo nada a ningún servidor.',
  },

  {
    guide: 'samy', q: '¿Cómo cambio los colores o la letra de la app?',
    keys: ['tema', 'color', 'colores', 'oscuro', 'claro', 'letra', 'fuente', 'tipografia', 'tamaño', 'grande', 'apariencia', 'estilo', 'esquinas', 'acento'],
    answer: 'En <b>Ajustes → Apariencia</b>: tema (Noche, Medianoche, Café o Claro), color de acento, tipografía, tamaño de letra y esquinas. Se ve al instante. El estilo de los overlays de OBS se cambia aparte, en <b>Overlays para OBS</b>.',
    go: '#theme-cards',
  },
  {
    guide: 'samy', q: '¿Cómo cambio cómo se ven los overlays en el stream?',
    keys: ['overlay', 'estilo', 'letra', 'fuente', 'color', 'fondo', 'transparente', 'tamaño', 'sonido', 'diseño', 'alerta'],
    answer: 'En <b>Overlays para OBS</b>, a la derecha está <b>Estilo de los overlays</b>: tipografía, color, color del texto, fondo de las tarjetas (sólido, translúcido o sin fondo), esquinas, tamaño y sonido. OBS se actualiza solo, sin volver a pegar la URL.',
    go: '#ov-style',
  },
  {
    guide: 'samy', q: '¿Puedo esconder la app junto al reloj?',
    keys: ['minimizar', 'reloj', 'bandeja', 'esconder', 'ocultar', 'segundo', 'plano', 'ventana', 'cerrar', 'abrir', 'sola'],
    answer: 'Sí, si quieres: en <b>Ajustes → App</b> activa «Al minimizar, esconder la app junto al reloj». Sigue leyendo y poniendo música escondida. La app <b>nunca se abre sola</b>: solo cuando tú la abres.',
    go: '#tray-toggle',
  },

  // ===== Troya: voz =====
  {
    guide: 'troya', q: '¿Cuántas voces hay? Quiero más voces',
    keys: ['voces', 'mas', 'cuantas', 'variedad', 'distintas', 'tono', 'grave', 'aguda', 'windows', 'todas', 'colombia', 'colombiana', 'latinoamerica', 'acento', 'pais', 'ingles', 'frances', 'linea', 'microsoft'],
    answer: 'En tu PC tengo 8 voces neuronales en español (México, Argentina y España): pulsa <b>Descargar todas en español</b>. Con <b>Variar el tono</b> cada una suena también grave y aguda (¡el triple!). Puedes sumar las <b>voces de Windows</b> y las <b>voces en línea de Microsoft</b>, que traen una femenina y una masculina de Colombia, Chile, Perú, Venezuela y casi toda Latinoamérica (necesitan internet). También hay 8 en <b>inglés</b> y 4 en <b>francés</b>, que se dan a mano en <b>Espectadores especiales</b>.',
    go: '#voice-pool',
  },
  {
    guide: 'troya', q: '¿Cómo instalo la voz?',
    keys: ['voz', 'motor', 'piper', 'descargar', 'neuronal', 'instalar', 'tengo'],
    answer: 'Primero pulsa <b>Instalar motor de voz</b> (≈25 MB) y luego <b>Descargar</b> en una voz. Te recomiendo <i>Claude · México</i>. Solo se descarga una vez y después funciono sin internet.',
    go: '#engine',
  },
  {
    guide: 'troya', q: '¿Cómo cambio de voz?',
    keys: ['voz', 'cambiar', 'otra', 'principal', 'usar', 'variante', 'mujer', 'hombre', 'acento', 'elegir'],
    answer: () => {
      const v = ctx().voiceLabel;
      return `${v ? `Ahora uso <b>${esc(v)}</b>. ` : ''}En la lista de voces pulsa <b>Usar</b> en la que quieras (si no está, primero <b>Descargar</b>). Sharvard trae dos variantes; las eliges justo debajo.`;
    },
    go: '#engine',
  },
  {
    guide: 'troya', q: '¿Cada espectador puede tener su voz?',
    keys: ['voz', 'cada', 'espectador', 'persona', 'distinta', 'diferente', 'reparto', 'repartir', 'azar', 'aleatoria', 'misma', 'usuario'],
    answer: 'Sí. En <b>Voz de cada espectador</b> eliges: una voz fija para cada persona (siempre suena igual), una al azar en cada mensaje, o todos con la principal. Descarga dos o más voces y marca cuáles quieres que reparta.',
    go: '#voice-pool',
  },
  {
    guide: 'troya', q: '¿Cómo le doy una voz especial a alguien o lo silencio?',
    keys: ['especial', 'silenciar', 'mute', 'callar', 'bloquear', 'apodo', 'vip', 'molesta', 'troll', 'nombre'],
    answer: 'Abre <b>Espectadores especiales</b>: escribe su usuario, elige la plataforma y decide: <b>Siempre leer</b> (con su propia voz y un nombre para decir, como «el jefe») o <b>Silenciar</b>.',
    go: '#special-form',
  },
  {
    guide: 'troya', q: '¿Por qué en TikTok no leo a todos?',
    keys: ['quiereme', 'permiso', 'tiktok', 'regalo', 'todos', 'hablar', 'leer', 'quien'],
    answer: 'En TikTok solo leo a quien te envió un <b>Quiéreme</b>. Ese permiso dura lo que elijas (24 horas por defecto) y ves la lista de quién lo tiene. Puedes cambiar el regalo, apagar ese filtro o quitarle el permiso a alguien.',
    go: '#allowed-list',
  },
  {
    guide: 'troya', q: '¿Cómo funciona el filtro de groserías?',
    keys: ['groseria', 'insulto', 'palabra', 'censurar', 'piip', 'filtro', 'lista', 'palabrota', 'quitar'],
    answer: 'Con el <b>Filtro de groserías</b> encendido cambio las palabras de la lista por «piip». La lista la editas en <i>Editar la lista de palabras</i>. Comparo palabras completas, así que «cálculo» o «pera» no se tocan.',
    go: '[data-tts="filterProfanity"]',
  },
  {
    guide: 'troya', q: '¿Detectas trucos como T0NT0?',
    keys: ['truco', 't0nt0', 'tonto', 'numeros', 'repetidas', 'esquivar', 'evadir', 'alfabeto', 'detectar'],
    answer: 'Sí, con <b>Detectar trucos</b>: atrapo T0NT0, ToonTo0, t o n t o, toooonto, p.u.t.a y letras de otros alfabetos. Lo puedes apagar aparte del filtro de groserías.',
    go: '#tricks-row',
  },
  {
    guide: 'troya', q: '¿Por qué no leyó un mensaje?',
    keys: ['leyo', 'lee', 'habla', 'motivo', 'dijo', 'callada', 'mensaje', 'leer', 'porque'],
    answer: 'Mira <b>Actividad</b>: junto a cada mensaje pongo 🔇 y el motivo (comando, repetido, sin Quiéreme, espera…). También puedes escribirlo en <b>Probar filtros</b> y te digo si lo leería y con qué voz.',
    go: '#tts-check',
  },
  {
    guide: 'troya', q: '¿Cómo cambio la velocidad o el volumen de la voz?',
    keys: ['velocidad', 'rapido', 'lento', 'volumen', 'bajito', 'alto', 'voz'],
    answer: 'Debajo de <b>Probar</b> tienes los deslizadores de <b>Velocidad</b> y <b>Volumen</b>. Escríbeme algo en el campo de prueba para escuchar cómo quedo.',
    go: '#tts-say',
  },
  {
    guide: 'troya', q: '¿Cómo evito spam o que lea muy seguido a alguien?',
    keys: ['spam', 'repetir', 'repetido', 'seguido', 'espera', 'cooldown', 'cola', 'caducar', 'limite', 'evitar'],
    answer: 'En <b>Límites</b>: la espera entre mensajes de una persona, descartar mensajes que llevan mucho esperando, el anti-spam (no repito el mismo mensaje) y no leer números.',
    go: '#tts-limits',
  },
  {
    guide: 'troya', q: '¿Cómo me callo un mensaje que está sonando?',
    keys: ['saltar', 'callar', 'parar', 'detener', 'cortar', 'mensaje', 'voz'],
    answer: 'Pulsa <b>Saltar mensaje</b>: corto lo que estoy diciendo y paso al siguiente. Para apagarme del todo, usa el interruptor <b>Voz activada</b>.',
    go: '#tts-skip',
  },

  // ===== Ñoño: música =====
  {
    guide: 'nono', q: '¿Cómo pide música el chat?',
    keys: ['play', 'temita', 'pedir', 'piden', 'cancion', 'musica', 'tema', 'pido', 'poner'],
    answer: 'En Kick, Starvios o Twitch escriben <code>!play</code> o <code>!temita</code> y el nombre de la canción o un enlace de YouTube. Yo la busco y la pongo en la cola.',
    go: '#card-musica .cmds',
  },
  {
    guide: 'nono', q: '¿Cómo funciona !skip y !quitar?',
    keys: ['skip', 'saltar', 'quitar', 'equivocar', 'borrar', 'sacar', 'cancion'],
    answer: '<code>!skip</code> salta la canción que suena, pero <b>solo si la pidió quien escribe</b>. <code>!quitar</code> saca de la cola la última canción que pidió esa persona (si ya está sonando, la salta). Tú, desde el panel, puedes saltar o quitar cualquiera.',
    go: '#card-musica .cmds',
  },
  {
    guide: 'nono', q: '¿Qué está sonando?',
    keys: ['suena', 'sonando', 'cancion', 'ahora', 'actual'],
    answer: () => {
      const m = ctx().music;
      if (!m?.current) return 'Ahora no suena nada. ¡Pídeme algo con <code>!play</code>!';
      return `Suena <b>«${esc(m.current.title)}»</b>, pedida por ${esc(m.current.requester)}. ${m.queue?.length ? `Quedan ${m.queue.length} en cola.` : 'La cola está vacía.'}`;
    },
    go: '#now',
  },
  {
    guide: 'nono', q: 'No suena la música, ¿qué pasa?',
    keys: ['suena', 'escucha', 'reproduce', 'reproducir', 'ventana', 'youtube', 'musica', 'silencio'],
    answer: 'Revisa que no esté en pausa y el volumen de la música. Si dice «La música suena en otra ventana», pulsa <b>Reproducir aquí</b>. Algunos videos no se pueden reproducir fuera de YouTube: los salto solo y te aviso.',
    go: '#player-note',
  },
  {
    guide: 'nono', q: '¿Cómo limito cuántas canciones pide cada uno?',
    keys: ['limite', 'limitar', 'cuantas', 'persona', 'duracion', 'larga', 'maximo', 'cancion'],
    answer: 'En <b>Ajustes de música</b>: canciones por persona (2) y duración máxima (10 min). También eliges en qué plataformas se puede pedir.',
    go: '#card-musica details',
  },
  {
    guide: 'nono', q: '¿Cómo pauso, vacío la cola o cierro las peticiones?',
    keys: ['pausa', 'pausar', 'vaciar', 'cerrar', 'peticiones', 'apagar', 'volumen', 'cola', 'musica'],
    answer: 'Tienes <b>Pausar</b>, <b>Saltar</b> y el volumen bajo el reproductor; <b>Vaciar</b> junto a la cola; y el interruptor <b>Peticiones abiertas</b> para cerrar los pedidos.',
    go: '#music-pause',
  },
  {
    guide: 'nono', q: '¿Cómo muestro la canción en el stream?',
    keys: ['sonando', 'mostrar', 'overlay', 'pantalla', 'cancion', 'stream'],
    answer: 'Usa el overlay <b>Sonando ahora</b>: copia su URL en <b>Overlays para OBS</b> y ponla en OBS como Fuente de navegador (700×140). Muestra la canción, quién la pidió y mis avisos.',
    go: '#overlay-list',
  },

  // ===== Juana: alertas, metas, estadísticas =====
  {
    guide: 'troya', q: '¿Cómo pruebo las alertas?',
    keys: ['alerta', 'alertas', 'probar', 'follow', 'notificacion', 'aparecen'],
    answer: 'En <b>Alertas</b> cada tipo tiene su botón <b>Probar</b> y su interruptor para elegir si sale en pantalla. También puedes usar <b>▶ Simular</b> arriba, que trae hasta un Quiéreme falso.',
    go: '#card-alertas .tests',
  },
  {
    guide: 'juana', q: '¿Cómo creo una meta?',
    keys: ['meta', 'metas', 'objetivo', 'barra', 'progreso', 'goal', 'crear'],
    answer: 'En <b>Metas</b>: ponle nombre, elige qué cuenta (diamantes, seguidores, likes…), el objetivo y pulsa <b>Añadir meta</b>. Cada meta tiene su URL para OBS, y la puedes sumar, restar o reiniciar a mano.',
    go: '#goal-form',
  },
  {
    guide: 'juana', q: '¿Cuánto gané en el directo?',
    keys: ['gane', 'ganar', 'ganancia', 'dinero', 'dolar', 'usd', 'diamante', 'cuanto', 'plata', 'ingreso'],
    answer: () => {
      const s = ctx().stats;
      const base = 'En <b>Estadísticas</b> ves los diamantes del directo y un estimado en dólares de lo que recibe el creador (1 diamante ≈ 0,005 USD).';
      return s ? `${base} En este directo van <b>${s.diamonds}</b> diamantes (≈ US$ ${s.usd}).` : base;
    },
    go: '#stats-tiles',
  },
  {
    guide: 'juana', q: '¿Quién me regaló más?',
    keys: ['regalo', 'regalar', 'top', 'ranking', 'mejores', 'fans', 'quien', 'hablo', 'mas'],
    answer: 'Al final de <b>Estadísticas</b> están los tops: más diamantes, más activos en el chat, más likes y los regalos más enviados. En el selector elige <i>Totales de siempre</i> para ver los de todos tus directos.',
    go: '#stats-tops',
  },
  {
    guide: 'juana', q: '¿Cómo veo directos anteriores?',
    keys: ['anterior', 'historial', 'pasado', 'ayer', 'comparar', 'sesion', 'terminar', 'directos'],
    answer: 'En el selector de <b>Estadísticas</b> eliges cualquier directo guardado (hasta 500). Cada cifra se compara con el directo anterior. Un directo se cierra solo tras 30 min sin actividad, al acabar el LIVE de TikTok o con <b>Terminar sesión</b>.',
    go: '#stats-session',
  },
  {
    guide: 'juana', q: '¿Qué muestra la gráfica?',
    keys: ['grafica', 'grafico', 'minuto', 'actividad', 'espectadores', 'pico', 'muestra'],
    answer: 'La gráfica muestra minuto a minuto los mensajes, interacciones, diamantes o espectadores (elige arriba a la derecha). Pasa el ratón por una barra para ver el número, o ábrela como tabla.',
    go: '#stats-chart',
  },
];

const GREET = {
  samy: '¡Hola! Soy <b>Samy</b>. Te ayudo a conectarte y a encontrar cualquier cosa en la app. ¿Qué necesitas?',
  troya: 'Hola, soy <b>Troya</b>, la voz del stream. Pregúntame por las voces, los filtros, las alertas o por qué leí (o no) un mensaje.',
  nono: '¡Epa! Soy <b>Ñoño</b>, el DJ. Pregúntame cómo pedir, saltar o quitar canciones.',
  juana: 'Hola, soy <b>Juana</b>. Llevo las metas y las cuentas de tus directos. ¿Qué quieres saber?',
  mecha: 'Sistema en línea. Soy <b>MechaRidds</b>, la versión androide de Ridds. Llevo el Chat Bot, los comandos y las novedades de cada versión. ¿En qué te ayudo?',
};

const HANDOFF = {
  samy: (to) => `¡Eso lo sabe ${GUIDES[to].name}! Te lo cuenta:`,
  troya: (to) => `De eso sabe más ${GUIDES[to].name}. Escúchale:`,
  nono: (to) => `Uy, eso es cosa de ${GUIDES[to].name}:`,
  juana: (to) => `Eso lo lleva ${GUIDES[to].name}:`,
  mecha: (to) => `Redirigiendo a ${GUIDES[to].name}…`,
};

const DONT_KNOW = {
  samy: 'Mmm, eso no lo tengo claro. Prueba con otras palabras o con una de estas:',
  troya: 'No estoy segura de entenderte. ¿Era alguna de estas?',
  nono: 'Ni idea, parce. ¿Querías decir alguna de estas?',
  juana: 'No encontré eso. Quizá te sirva alguna de estas:',
  mecha: 'No tengo eso en mi memoria. ¿Era alguna de estas? Si es un error, repórtalo en Ayuda.',
};

// ---------- Búsqueda ----------
// Compara por raíz (las 5 primeras letras): "conecto", "conexión" y
// "conectar" coinciden. Antes se pasan sinónimos a una palabra común.
const STOP = new Set('el la los las un una unos unas de del en y o a que como donde para por mi mis me se es lo le les al con puedo hago esta este esto estan hay cual quiero tu yo si no mas muy ya hace hacer ser son eso esa algo alguien cosa cosas tiene tienen tengo pongo pone tambien bien'.split(' '));
const SYN = {
  voces: 'voz', hable: 'voz', habla: 'voz', canciones: 'cancion', temas: 'cancion', tema: 'cancion', rolas: 'cancion', musica: 'cancion',
  rapida: 'rapido', despacio: 'lento', heart: 'quiereme', quiere: 'quiereme', groserias: 'groseria', insultos: 'insulto', malas: 'groseria',
  troles: 'troll', trolls: 'troll', regalaron: 'regalo', regalos: 'regalo', regalo: 'regalo', dio: 'regalo', plata: 'dinero', lucas: 'dinero',
  conexion: 'conectar', conecto: 'conectar', conecta: 'conectar', conectado: 'conectar', directos: 'directo', lives: 'directo', live: 'directo',
  ganado: 'gane', ganamos: 'gane', gano: 'gane', overlays: 'overlay', alertas: 'alerta', metas: 'meta', mensajes: 'mensaje', piden: 'pedir', pide: 'pedir', ponen: 'pedir', pongan: 'pedir',
  lee: 'leer', lea: 'leer', lean: 'leer', leyo: 'leer', lees: 'leer', bloquear: 'silenciar', bloqueo: 'silenciar', banear: 'silenciar',
};
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokensOf = (s) => norm(s).split(' ').filter((t) => t.length > 1 && !STOP.has(t)).map((t) => SYN[t] || t);
const same = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && a.slice(0, 5) === b.slice(0, 5)) || a === `${b}s` || b === `${a}s`;

function score(entry, tokens) {
  const keys = entry.keys.map((k) => SYN[norm(k)] || norm(k));
  let sc = 0;
  for (const t of new Set(tokens)) if (keys.some((k) => same(t, k))) sc += 2;
  // Las palabras de la pregunta de ejemplo también cuentan un poco.
  const qt = tokensOf(entry.q);
  for (const t of new Set(tokens)) if (qt.some((k) => same(t, k))) sc += 0.7;
  return sc;
}

function findAnswer(question, current) {
  const tokens = tokensOf(question);
  if (!tokens.length) return null;
  let best = null;
  for (const e of KB) {
    const sc = score(e, tokens) + (e.guide === current ? 0.3 : 0);
    if (!best || sc > best.sc) best = { e, sc };
  }
  return best && best.sc >= 2 ? best.e : null;
}

// ---------- Interfaz ----------
let current = 'samy';
let open = false;

function suggestions(id, n = 4) {
  return KB.filter((e) => e.guide === id).slice(0, n);
}

function chips(list) {
  return `<div class="h-chips">${list.map((e) => `<button type="button" class="h-chip" data-ask="${esc(e.q)}">${esc(e.q)}</button>`).join('')}</div>`;
}

function addMsg(html, from) {
  const log = $('#help-log');
  const row = document.createElement('div');
  row.className = `h-msg ${from === 'me' ? 'me' : 'from-guide'}`;
  row.innerHTML = from === 'me' ? `<p>${html}</p>` : `<span class="h-ava" data-guide-id="${from}">${avatarHTML(from, 'xs')}</span><div><b class="h-name" style="color:${GUIDES[from].color}">${esc(GUIDES[from].name)}</b><div class="h-text">${html}</div></div>`;
  log.append(row);
  log.scrollTop = log.scrollHeight;
  return row;
}

function answer(question) {
  addMsg(esc(question), 'me');
  const e = findAnswer(question, current);
  setTimeout(() => {
    if (!e) {
      setMood(current, 'thinking');
      addMsg(`${DONT_KNOW[current]}${chips(suggestions(current, 3).concat(current === 'samy' ? [] : suggestions('samy', 1)))}`, current);
      setTimeout(() => setMood(current, 'idle', 0), 1200);
      return;
    }
    if (e.guide !== current) addMsg(HANDOFF[current](e.guide), current);
    const body = typeof e.answer === 'function' ? e.answer() : e.answer;
    const go = e.go ? `<button type="button" class="btn small h-go" data-go="${esc(e.go)}">Llévame ahí →</button>` : '';
    addMsg(`${body}${go}`, e.guide);
    setMood(e.guide, 'happy');
  }, 220);
}

// Lleva a la sección y la resalta (abre los desplegables que la contengan).
export function goTo(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  // Primero la pantalla y la pestaña donde vive.
  const page = el.closest('.page')?.dataset.page;
  const tab = el.closest('[data-tabpanel]')?.dataset.tabpanel;
  if (page) showPage(page, tab);
  // Conexiones: pasar a «Escuchar» o «Escribir» si hace falta.
  const pane = el.closest('[data-conn-pane]')?.dataset.connPane;
  if (pane) document.querySelector(`[data-conn-tab="${pane}"]`)?.click();
  for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
  if (el.tagName === 'DETAILS') el.open = true;
  if (window.matchMedia('(max-width: 760px)').matches) closeHelp();
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const target = el.closest('.platform, .engine, .pool, .rank, .tile, form, details, .cmds, .urls, .tests, .chart, .card, .alert-rows') || el;
    target.classList.remove('flash');
    void target.offsetWidth;
    target.classList.add('flash');
    setTimeout(() => target.classList.remove('flash'), 2400);
  });
}

function renderHeader() {
  const g = GUIDES[current];
  $('#help-who').innerHTML = `${avatarHTML(current, 'md')}<div><b>${esc(g.name)}</b><small>${esc(g.role)}</small></div>`;
  $('#help-input').placeholder = `Pregúntale a ${g.name}…`;
  $('#help-photo-remove').hidden = !hasPhoto(current);
  for (const b of $$('#help-switch [data-switch]')) b.setAttribute('aria-pressed', String(b.dataset.switch === current));
  $('#help').style.setProperty('--g', g.color);
}

export function openHelp(id = 'samy', ask = '') {
  const changed = id !== current || !open;
  current = id;
  open = true;
  $('#help').hidden = false;
  document.body.classList.add('help-open');
  renderHeader();
  if (changed) {
    addMsg(`${GREET[id]}${chips(suggestions(id))}`, id);
    setMood(id, 'wave');
  }
  if (ask) answer(ask);
  setTimeout(() => $('#help-input').focus(), 50);
}

export function closeHelp() {
  open = false;
  $('#help').hidden = true;
  document.body.classList.remove('help-open');
}

export function initHelp() {
  const panel = document.createElement('aside');
  panel.id = 'help';
  panel.className = 'help';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Pregúntale a los guías');
  panel.innerHTML = `
    <header class="h-head"><div id="help-who" class="h-who"></div><button type="button" class="btn small ghost" id="help-close" aria-label="Cerrar">✕</button></header>
    <div id="help-switch" class="h-switch">
      ${['samy', 'troya', 'nono', 'juana', 'mecha'].map((id) => `<button type="button" data-switch="${id}" class="${GUIDES[id].lead ? 'lead' : ''}" title="${esc(GUIDES[id].name)} · ${esc(GUIDES[id].role)}">${avatarHTML(id, 'xs')}<span>${esc(GUIDES[id].name)}</span></button>`).join('')}
    </div>
    <div id="help-log" class="h-log" aria-live="polite"></div>
    <form id="help-form" class="h-form"><input id="help-input" autocomplete="off"><button class="btn primary">Preguntar</button></form>
    <footer class="h-foot"><button type="button" class="btn small ghost" id="help-photo">📷 Cambiar foto</button><button type="button" class="btn small ghost" id="help-photo-remove">Volver al dibujo</button></footer>`;
  document.body.append(panel);

  // Samy y Troya siempre a mano, abajo a la derecha.
  const dock = document.createElement('div');
  dock.className = 'dock';
  dock.innerHTML = `
    <span class="dock-bubble">¿Te ayudamos?</span>
    <button type="button" class="dock-btn" data-open-help="troya" data-size="66" aria-label="Preguntarle a Troya">${avatarHTML('troya', 66)}</button>
    <button type="button" class="dock-btn main" data-open-help="samy" data-size="66" aria-label="Preguntarle a Samy">${avatarHTML('samy', 66)}</button>`;
  document.body.append(dock);

  $('#help-close').addEventListener('click', closeHelp);
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && open) closeHelp();
  });
  $('#help-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const q = $('#help-input').value.trim();
    if (!q) return;
    $('#help-input').value = '';
    answer(q);
  });
  panel.addEventListener('click', (ev) => {
    const ask = ev.target.closest('[data-ask]')?.dataset.ask;
    if (ask) answer(ask);
    const go = ev.target.closest('[data-go]')?.dataset.go;
    if (go) goTo(go);
    const sw = ev.target.closest('[data-switch]')?.dataset.switch;
    if (sw && sw !== current) openHelp(sw);
  });
  $('#help-photo').addEventListener('click', () => pickPhoto(current, renderHeader));
  $('#help-photo-remove').addEventListener('click', () => removePhoto(current, renderHeader));

  // Tocar a cualquier guía (en cualquier parte del panel) abre su ayuda.
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-open-help], .guide[data-avatar], .crew [data-avatar], .bubble[data-guide]');
    if (!el) return;
    const id = el.dataset.openHelp || el.dataset.avatar || el.dataset.guide;
    if (GUIDES[id]) openHelp(id);
  });
}

// Para pruebas: qué respondería cada guía.
export const _test = { findAnswer, KB };
