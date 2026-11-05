// Catálogo de overlays de Satronho Bot (lo usan el panel y OBS).
// Cada tipo trae: categoría, nombre, descripción, tamaño de la fuente en OBS,
// estilos (variantes de diseño), valores por defecto y sus ajustes.
//
// Tipos de ajuste (campo «t»):
//   seg      botones de opción (opts: [[valor, texto], …])
//   toggle   interruptor
//   range    deslizador (min, max, step, unit)
//   number   número
//   text     texto corto
//   textarea varias líneas (una por línea)
//   color    color
//   plats    plataformas (TikTok, Kick, Twitch, Starvios)
// «when»: el ajuste solo se ve si otro ajuste tiene ese valor.

export const CATEGORIES = [
  { id: 'metas', name: 'Metas y contadores', desc: 'Objetivos, tiempos y cifras que se llenan solos.', guide: 'juana' },
  { id: 'regalos', name: 'Regalos y apoyo', desc: 'Quién te apoya y cómo: podios, regalos en pantalla y el más generoso.', guide: 'troya' },
  { id: 'chat', name: 'Chat y comunidad', desc: 'Lo que dice y hace tu gente, a la vista de todos.', guide: 'mecha' },
  { id: 'musica', name: 'Música', desc: 'La canción que suena y lo que viene.', guide: 'nono' },
  { id: 'pantallas', name: 'Pantallas del directo', desc: 'Empezamos, vuelvo enseguida y se acabó, con tu identidad.', guide: 'samy' },
];

const PLATS = [['all', 'Todas'], ['tiktok', 'TikTok'], ['kick', 'Kick'], ['twitch', 'Twitch'], ['starvios', 'Starvios']];
const POS = ['pos', 'Posición', 'seg', [['center', 'Centro'], ['left', 'Izquierda'], ['right', 'Derecha']]];
const f = (k, label, t, opts, extra = {}) => ({ k, label, t, ...(Array.isArray(opts) ? { opts } : opts || {}), ...extra });

export const KINDS = {
  // ---------------- Metas y contadores ----------------
  goals: {
    cat: 'metas', icon: '🎯', name: 'Metas', size: [700, 360], extraTab: 'goals',
    desc: 'Seguidores, monedas o likes que se llenan solos y celebran al cumplirse.',
    styles: [['barra', 'Barra'], ['anillo', 'Anillo'], ['pastel', 'Pastel'], ['tarjeta', 'Tarjeta'], ['cifra', 'Solo la cifra']],
    defaults: { layout: 'stack', showTitle: true, showIcon: true, showCurrent: true, showTarget: true, showPercent: true, showRemaining: false, celebrate: true, hidden: [] },
    fields: [
      f('layout', 'Cómo se acomodan', 'seg', [['stack', 'Una debajo de otra'], ['row', 'En fila'], ['one', 'De a una (rotan)']]),
      f('showTitle', 'Nombre de la meta', 'toggle'),
      f('showIcon', 'Ícono', 'toggle'),
      f('showCurrent', 'Lo que llevas', 'toggle'),
      f('showTarget', 'El objetivo', 'toggle'),
      f('showPercent', 'Porcentaje', 'toggle'),
      f('showRemaining', '«Faltan N»', 'toggle'),
      f('celebrate', 'Celebrar al cumplirse', 'toggle'),
    ],
  },
  counters: {
    cat: 'metas', icon: '#', name: 'Contadores', size: [520, 260], extraTab: 'counters',
    desc: 'Muertes, jefes, victorias… Se mueven con comandos del chat, regalos o desde aquí.',
    styles: [['tarjeta', 'Tarjetas'], ['chip', 'Píldoras'], ['grande', 'Grande'], ['marcador', 'Marcador']],
    defaults: { layout: 'stack', showName: true, showIcon: true, showGoal: true, hidden: [] },
    fields: [
      f('layout', 'Cómo se acomodan', 'seg', [['stack', 'En columna'], ['row', 'En fila']]),
      f('showName', 'Nombre', 'toggle'), f('showIcon', 'Ícono', 'toggle'), f('showGoal', 'Mostrar el tope (3/5)', 'toggle'),
    ],
  },
  countdown: {
    cat: 'metas', icon: '⏳', name: 'Cuenta regresiva', size: [600, 220], extraTab: 'countdown',
    desc: 'Un reloj que baja y que tu público alarga con regalos, seguidores y suscripciones.',
    styles: [['reloj', 'Reloj'], ['neon', 'Luminoso'], ['minimo', 'Mínimo'], ['barra', 'Con barra']],
    defaults: {
      title: '', showHours: true, showAdded: true, autoAdd: true, endText: '¡Se acabó el tiempo!',
      // Cuánto suma cada cosa (se edita en la pestaña «⏳ Controles»).
      rates: { tiktok: { on: true, perUnit: 10, minUnits: 1 }, kick: { on: true, perUnit: 0, minUnits: 1 }, twitch: { on: true, perUnit: 0, minUnits: 1 }, starvios: { on: true, perUnit: 0, minUnits: 1 } },
      giftRules: [], perFollow: 0, perSub: 60, perShare: 0, likesEvery: 100, likesSeconds: 0, maxMin: 0, modCommand: 'tiempo',
    },
    fields: [
      f('title', 'Título encima (vacío = sin título)', 'text'),
      f('showHours', 'Mostrar horas', 'toggle'),
      f('showAdded', 'Mostrar «+10 s» cuando suman tiempo', 'toggle'),
      f('endText', 'Texto al llegar a cero', 'text'),
    ],
  },
  uptime: {
    cat: 'metas', icon: '⏱', name: 'Tiempo en directo', size: [600, 200],
    desc: 'Cuánto llevas en vivo hoy, con un aviso cada hora si quieres.',
    styles: [['reloj', 'Reloj'], ['en-vivo', 'En vivo'], ['minimo', 'Mínimo']],
    defaults: { label: 'EN DIRECTO', showLabel: true, showDot: true, showSeconds: true, hourText: '{horas} horas en directo' },
    fields: [
      f('showLabel', 'Mostrar etiqueta', 'toggle'), f('label', 'Etiqueta', 'text', { when: { showLabel: true } }),
      f('showDot', 'Punto rojo «en vivo»', 'toggle'), f('showSeconds', 'Segundos', 'toggle'),
      f('hourText', 'Texto debajo (vacío = nada)', 'text', { hint: 'Usa {horas} y {minutos}.' }),
    ],
  },
  viewers: {
    cat: 'metas', icon: '👁', name: 'Espectadores', size: [480, 180],
    desc: 'Cuánta gente te ve ahora, en total o por plataforma, con el pico del directo.',
    styles: [['pildora', 'Píldora'], ['grande', 'Grande'], ['minimo', 'Mínimo']],
    defaults: { label: 'ESPECTADORES', showLabel: true, showPeak: true, platform: 'all' },
    fields: [f('platform', 'De dónde', 'seg', PLATS), f('showLabel', 'Etiqueta', 'toggle'), f('label', 'Texto de la etiqueta', 'text', { when: { showLabel: true } }), f('showPeak', 'Mostrar el máximo del directo', 'toggle')],
  },
  followers: {
    cat: 'metas', icon: '➕', name: 'Seguidores', size: [480, 180],
    desc: 'Tus seguidores y los nuevos de este directo, que suben al instante.',
    styles: [['pildora', 'Píldora'], ['grande', 'Grande'], ['minimo', 'Mínimo']],
    defaults: { label: 'SEGUIDORES', showLabel: true, showNew: true, base: 0 },
    fields: [
      f('base', 'Seguidores que tenías al empezar (0 = mostrar solo los nuevos)', 'number'),
      f('showLabel', 'Etiqueta', 'toggle'), f('label', 'Texto de la etiqueta', 'text', { when: { showLabel: true } }),
      f('showNew', 'Mostrar «+N nuevos en este directo»', 'toggle'),
    ],
  },
  // ---------------- Regalos y apoyo ----------------
  ranking: {
    cat: 'regalos', icon: '🏆', name: 'Ranking', size: [900, 420],
    desc: 'Quién más aporta: likes, regalos o mensajes, en podio, lista o tarjetas.',
    styles: [['podio', 'Podio'], ['lista', 'Lista'], ['tarjetas', 'Tarjetas']],
    defaults: { metric: 'likes', size: 3, title: '', showTitle: true, showValues: true, avatars: true, crown: true },
    fields: [
      f('metric', 'Qué mide', 'seg', [['likes', 'Likes'], ['gifts', 'Regalos'], ['chat', 'Mensajes']]),
      f('size', 'Puestos', 'range', { min: 3, max: 10, step: 1 }),
      f('showTitle', 'Título', 'toggle'), f('title', 'Texto del título (vacío = automático)', 'text', { when: { showTitle: true } }),
      f('showValues', 'Números', 'toggle'), f('avatars', 'Fotos de perfil', 'toggle'), f('crown', 'Corona al primero', 'toggle'),
    ],
  },
  mvp: {
    cat: 'regalos', icon: '👑', name: 'El más generoso', size: [520, 300],
    desc: 'La persona que más te ha regalado en el directo. Cuando otra la supera, cambia con estilo.',
    styles: [['alas', 'Con alas'], ['tarjeta', 'Tarjeta'], ['minimo', 'Mínimo']],
    defaults: { title: 'EL MÁS GENEROSO', showValue: true, avatars: true },
    fields: [f('title', 'Título', 'text'), f('showValue', 'Mostrar monedas', 'toggle'), f('avatars', 'Foto de perfil', 'toggle')],
  },
  lastgifts: {
    cat: 'regalos', icon: '🎁', name: 'Últimos regalos', size: [420, 460],
    desc: 'Los regalos que van llegando: quién, cuál, cuántos y cuánto valen.',
    styles: [['lista', 'Lista'], ['burbujas', 'Burbujas'], ['compacta', 'Compacta']],
    defaults: { count: 6, title: 'ÚLTIMOS REGALOS', showTitle: true, showValue: true, minValue: 0, platform: 'all' },
    fields: [f('count', 'Cuántos', 'range', { min: 3, max: 12, step: 1 }), f('showTitle', 'Título', 'toggle'), f('title', 'Texto del título', 'text', { when: { showTitle: true } }), f('showValue', 'Mostrar el valor', 'toggle'), f('minValue', 'Valor mínimo', 'number'), f('platform', 'De dónde', 'seg', PLATS)],
  },
  giftspot: {
    cat: 'regalos', icon: '✨', name: 'Regalo destacado', size: [800, 600],
    desc: 'Una revelación grande y animada del regalo: el nombre de quien lo manda, qué mandó y cuántos.',
    styles: [['estallido', 'Estallido'], ['vitrina', 'Vitrina'], ['cine', 'Cine']],
    defaults: { minValue: 1, seconds: 4, platform: 'all', pos: 'center', showValue: true },
    fields: [f('platform', 'De dónde', 'seg', PLATS), f('minValue', 'Desde cuántas monedas', 'number'), f('seconds', 'Segundos en pantalla', 'range', { min: 2, max: 12, step: 1, unit: ' s' }), f(POS[0], POS[1], POS[2], POS[3]), f('showValue', 'Mostrar el valor', 'toggle')],
  },
  bestgift: {
    cat: 'regalos', icon: '💎', name: 'Mejor regalo', size: [360, 420],
    desc: 'Tarjeta fija con el regalo más valioso del directo… o la racha más larga.',
    styles: [['carta', 'Carta'], ['brillo', 'Brillo'], ['minimo', 'Mínimo']],
    defaults: { mode: 'value', title: '' },
    fields: [f('mode', 'Qué muestra', 'seg', [['value', 'El más valioso'], ['streak', 'La racha más larga']]), f('title', 'Título (vacío = automático)', 'text')],
  },
  giftrain: {
    cat: 'regalos', icon: '🌧', name: 'Lluvia de regalos', size: [1280, 720],
    desc: 'Cada regalo cae por la pantalla. Si nadie regala, no se ve nada.',
    styles: [['lluvia', 'Lluvia'], ['burbujas', 'Burbujas'], ['confeti', 'Confeti']],
    defaults: { perGift: 1, maxPerGift: 20, sizePx: 72, minValue: 0, platform: 'all' },
    fields: [f('platform', 'De dónde', 'seg', PLATS), f('maxPerGift', 'Máximo de imágenes por regalo', 'range', { min: 1, max: 40, step: 1 }), f('sizePx', 'Tamaño', 'range', { min: 32, max: 160, step: 4, unit: ' px' }), f('minValue', 'Desde cuántas monedas', 'number')],
  },
  // ---------------- Chat y comunidad ----------------
  chat: {
    cat: 'chat', icon: '💬', name: 'Chat en pantalla', size: [460, 620],
    desc: 'El chat de todas tus plataformas en pantalla, con insignias y colores.',
    styles: [['burbujas', 'Burbujas'], ['clasico', 'Clásico'], ['tarjetas', 'Tarjetas'], ['minimo', 'Mínimo']],
    defaults: { platforms: ['tiktok', 'kick', 'twitch', 'starvios'], max: 8, fadeSec: 0, hideCommands: true, hideBots: true, showPlatform: true, showBadges: true, showAvatar: true, newest: 'bottom' },
    fields: [f('platforms', 'Plataformas', 'plats'), f('max', 'Mensajes a la vez', 'range', { min: 3, max: 20, step: 1 }), f('fadeSec', 'Desaparecen después de (s, 0 = nunca)', 'range', { min: 0, max: 120, step: 5, unit: ' s' }), f('newest', 'Lo nuevo', 'seg', [['bottom', 'Abajo'], ['top', 'Arriba']]), f('hideCommands', 'Ocultar comandos (!play…)', 'toggle'), f('hideBots', 'Ocultar bots', 'toggle'), f('showAvatar', 'Fotos o iniciales', 'toggle'), f('showPlatform', 'Logo de la plataforma', 'toggle'), f('showBadges', 'Insignias (moderador, equipo…)', 'toggle')],
  },
  activity: {
    cat: 'chat', icon: '📋', name: 'Actividad', size: [440, 460],
    desc: 'Lo último que pasó en el directo: seguidores, regalos, suscripciones, compartidos.',
    styles: [['lista', 'Lista'], ['tarjetas', 'Tarjetas'], ['minimo', 'Mínimo']],
    defaults: { count: 6, types: ['follow', 'gift', 'sub', 'share', 'superfan'], title: 'ACTIVIDAD', showTitle: true },
    fields: [f('count', 'Cuántas', 'range', { min: 3, max: 12, step: 1 }), f('showTitle', 'Título', 'toggle'), f('title', 'Texto del título', 'text', { when: { showTitle: true } })],
  },
  ticker: {
    cat: 'chat', icon: '📣', name: 'Cintillo', size: [1280, 80],
    desc: 'Tus redes y avisos pasando por una franja, rotando o desplazándose.',
    styles: [['franja', 'Franja'], ['pildora', 'Píldora'], ['minimo', 'Mínimo']],
    defaults: { mode: 'rotate', every: 6, speed: 80, lines: 'Sígueme en TikTok: @riddsc\nTambién en Kick: kick.com/riddsc\nPide tu canción con !play', label: '' },
    fields: [f('lines', 'Mensajes (uno por línea)', 'textarea'), f('mode', 'Cómo pasan', 'seg', [['rotate', 'Rotando'], ['scroll', 'Desplazándose']]), f('every', 'Segundos por mensaje', 'range', { min: 3, max: 30, step: 1, unit: ' s', when: { mode: 'rotate' } }), f('speed', 'Velocidad', 'range', { min: 30, max: 220, step: 10, when: { mode: 'scroll' } }), f('label', 'Etiqueta a la izquierda (vacío = nada)', 'text')],
  },
  // ---------------- Música ----------------
  nowplaying: {
    cat: 'musica', icon: '🎵', name: 'Sonando ahora', size: [640, 160],
    desc: 'La canción que suena, quién la pidió y cuánto le falta.',
    styles: [['tarjeta', 'Tarjeta'], ['vinilo', 'Vinilo'], ['minimo', 'Mínimo']],
    defaults: { showCover: true, showRequester: true, showProgress: true, hideWhenEmpty: true },
    fields: [f('showCover', 'Portada', 'toggle'), f('showRequester', 'Quién la pidió', 'toggle'), f('showProgress', 'Barra de progreso', 'toggle'), f('hideWhenEmpty', 'Esconder si no suena nada', 'toggle')],
  },
  queue: {
    cat: 'musica', icon: '📜', name: 'Cola de música', size: [460, 420],
    desc: 'Las canciones que vienen, con quién las pidió y cómo pedir la tuya.',
    styles: [['lista', 'Lista'], ['tarjetas', 'Tarjetas'], ['minimo', 'Mínimo']],
    defaults: { count: 5, showHelp: true, title: 'A CONTINUACIÓN', showDuration: true },
    fields: [f('count', 'Cuántas', 'range', { min: 3, max: 10, step: 1 }), f('title', 'Título', 'text'), f('showDuration', 'Duración', 'toggle'), f('showHelp', 'Mostrar «Pide con !play»', 'toggle')],
  },
  // ---------------- Pantallas ----------------
  screens: {
    cat: 'pantallas', icon: '🖥', name: 'Pantallas del directo', size: [1920, 1080],
    desc: 'Pantallas completas con tu identidad: empezamos, vuelvo enseguida y se acabó, con cuenta atrás.',
    styles: [['galaxia', 'Galaxia'], ['atardecer', 'Atardecer'], ['retro', 'Retro'], ['limpio', 'Limpio']],
    defaults: { screen: 'start', title: '', subtitle: '', countdownTo: '', showClock: true, socials: '@riddsc · kick.com/riddsc', showGuides: true },
    fields: [
      f('screen', 'Cuál', 'seg', [['start', 'Empezamos'], ['brb', 'Vuelvo enseguida'], ['end', 'Se acabó']]),
      f('title', 'Título (vacío = el de siempre)', 'text'), f('subtitle', 'Subtítulo', 'text'),
      f('countdownTo', 'Cuenta atrás hasta (hora, ej. 20:30; vacío = sin cuenta)', 'text'),
      f('showClock', 'Mostrar la hora', 'toggle'), f('socials', 'Redes abajo', 'text'), f('showGuides', 'Mostrar a los guías (los perritos y MechaRidds)', 'toggle'),
    ],
  },
};

// Valores completos de un overlay (lo guardado sobre lo de serie).
export function settingsOf(w) {
  const k = KINDS[w?.kind];
  return { ...(k?.defaults || {}), ...(w?.settings || {}) };
}
export const styleOf = (w) => w?.style || KINDS[w?.kind]?.styles?.[0]?.[0] || '';
