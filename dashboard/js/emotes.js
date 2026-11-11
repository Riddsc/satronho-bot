// Emotes y stickers dentro de los mensajes del chat, como imágenes.
// Lo usan el Chat en vivo, la ventana aparte y el Chat en pantalla (OBS).
//
//   Kick:    el texto trae «[emote:12345:nombre]».
//   Twitch:  el conector guarda en extra.emotes dónde va cada emote
//            ({ id, start, end }, contando caracteres del mensaje).
//   TikTok:  los stickers de un comentario llegan aparte (extra.stickerImgs)
//            y se ponen al final del mensaje.
// Los emojis normales (😂🔥) ya son texto y se ven solos.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const KICK_EMOTE_RE = /\[emote:(\d+):([^\]]*)\]/g;
export const kickEmoteUrl = (id) => `https://files.kick.com/emotes/${encodeURIComponent(id)}/fullsize`;
export const twitchEmoteUrl = (id) => `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/default/dark/2.0`;

// Si la imagen no carga, queda el nombre del emote como texto.
const emoteImg = (src, name, cls = 'emote') => `<img class="${cls}" src="${esc(src)}" alt="${esc(name)}" title="${esc(name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode(this.alt))">`;

// Texto plano del mensaje, con los emotes de Kick como su nombre.
export const plainMessage = (text) => String(text || '').replace(KICK_EMOTE_RE, '$2');

// HTML del mensaje. «emotes: false» los deja como texto.
// «transform» cambia cada trozo de texto antes de escaparlo (censura).
export function messageHtml(e, { emotes = true, transform = (t) => t } = {}) {
  const msg = String(e?.message || '');
  const txt = (t) => esc(transform(t));
  if (!emotes) return txt(plainMessage(msg));
  let out = '';
  const twitch = Array.isArray(e?.extra?.emotes) ? e.extra.emotes : [];
  if (e?.platform === 'twitch' && twitch.length) {
    // Twitch cuenta posiciones por carácter (no por unidades de UTF-16).
    const chars = [...msg];
    const spots = twitch.filter((x) => Number.isInteger(x.start) && Number.isInteger(x.end) && x.end >= x.start && x.end < chars.length)
      .sort((a, b) => a.start - b.start);
    let i = 0;
    for (const s of spots) {
      if (s.start < i) continue;
      out += txt(chars.slice(i, s.start).join(''));
      out += emoteImg(twitchEmoteUrl(s.id), chars.slice(s.start, s.end + 1).join(''));
      i = s.end + 1;
    }
    out += txt(chars.slice(i).join(''));
  } else {
    let last = 0;
    for (const m of msg.matchAll(KICK_EMOTE_RE)) {
      out += txt(msg.slice(last, m.index));
      out += emoteImg(kickEmoteUrl(m[1]), m[2] || 'emote');
      last = m.index + m[0].length;
    }
    out += txt(msg.slice(last));
  }
  const stickers = Array.isArray(e?.extra?.stickerImgs) ? e.extra.stickerImgs : [];
  for (const s of stickers.slice(0, 3)) if (/^https:\/\//.test(s?.image || '')) out += ` ${emoteImg(s.image, s.name || 'sticker', 'emote sticker')}`;
  return out;
}

// ¿El mensaje es solo emotes (sin texto)? Así se pueden mostrar más grandes.
export function onlyEmotes(e) {
  const msg = String(e?.message || '');
  if (e?.platform === 'twitch' && Array.isArray(e?.extra?.emotes) && e.extra.emotes.length) {
    const chars = [...msg];
    const left = chars.map((c, i) => (e.extra.emotes.some((x) => i >= x.start && i <= x.end) ? '' : c)).join('');
    return !left.trim();
  }
  return /\[emote:\d+:[^\]]*\]/.test(msg) && !msg.replace(KICK_EMOTE_RE, '').trim();
}
