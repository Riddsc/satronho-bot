// Bus de eventos central. Los conectores (TikTok, Kick, Starvios) emiten
// aquí eventos normalizados y los módulos (alertas, metas, voz, música)
// escuchan aquí. Así ningún módulo depende de una plataforma concreta.
//
// Forma de un evento normalizado:
// {
//   id:       string único
//   platform: 'tiktok' | 'kick' | 'starvios' | 'twitch'
//   type:     'follow' | 'sub' | 'gift' | 'like' | 'share' | 'chat'
//   user:     { id: string, name: string, avatar?: string }
//               id = identificador estable (usuario de TikTok, id de Kick...)
//   amount:   number  (gift: diamantes · sub: meses · like: cantidad)
//   message:  string  (texto del chat)
//   extra:    object  (giftName, count, image...)
//   test:     boolean (evento de prueba lanzado desde el panel)
//   ts:       number
// }
//
// Hoy TikTok emite todos los tipos; Kick, Starvios y Twitch solo 'chat'.

const { EventEmitter } = require('events');

const EVENT_TYPES = ['follow', 'sub', 'gift', 'like', 'share', 'chat', 'sticker', 'join', 'superfan', 'live-start', 'live-end'];

const bus = new EventEmitter();
bus.setMaxListeners(50);

let counter = 0;
function makeEvent({ platform, type, user, amount = 1, message = '', extra = {}, test = false }) {
  counter += 1;
  const u = typeof user === 'string' ? { name: user } : user || {};
  const name = String(u.name || 'Anónimo');
  return {
    id: `${Date.now()}-${counter}`,
    platform,
    type,
    user: { id: String(u.id || name).toLowerCase(), name, avatar: u.avatar },
    amount: Number(amount) || 0,
    message: message || '',
    extra,
    test,
    ts: Date.now(),
  };
}

module.exports = { bus, makeEvent, EVENT_TYPES };
