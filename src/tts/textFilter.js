// Limpieza del texto antes de leerlo en voz alta.
//
// Siempre: quita enlaces, emojis, emotes de Kick/Starvios, caracteres
// invisibles y repeticiones exageradas ("aaaaaaa", "jajajajajaja").
//
// Con filterProfanity: cambia las palabras prohibidas por "piip".
// Con filterTricks:    además detecta trucos para esquivar el filtro:
//   T0NT0 / t0nt0      (números o símbolos en lugar de letras)
//   toooooonto         (letras repetidas)
//   t o n t o          (letras separadas por espacios)
//   tоnto              (letras de otros alfabetos que se ven iguales)
// Las palabras se comparan completas: "culo" no censura "cálculo".

const LINK_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const KICK_EMOTE_RE = /\[emote:\d+:[^\]]*\]/gi;
const COLON_EMOTE_RE = /:(?=[a-z0-9_]*[a-z])[a-z0-9_]{2,20}:/gi;
const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu;
const INVISIBLE_RE = /[​-‏⁠-⁤﻿­]/g;

// Letras de otros alfabetos que parecen latinas (cirílico, griego).
const CONFUSABLES = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', һ: 'h', ԁ: 'd', ӏ: 'l', к: 'k', м: 'm', т: 't', в: 'b', н: 'h',
  α: 'a', ε: 'e', ο: 'o', ρ: 'p', τ: 't', υ: 'u', ι: 'i', κ: 'k', ν: 'v',
};
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '|': 'i', '€': 'e', '¡': 'i' };

function basic(s) {
  return String(s)
    .normalize('NFKC') // letras "fancy" de Unicode -> normales
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // sin tildes
}
const lettersOnly = (s) => s.replace(/[^a-z0-9]/g, '');
const collapse = (s) => s.replace(/(.)\1+/g, '$1');

function tricky(s) {
  let out = '';
  for (const ch of basic(s)) out += CONFUSABLES[ch] || LEET[ch] || ch;
  return lettersOnly(out).replace(/[0-9]/g, '');
}

function buildMatcher(words) {
  const exact = new Set();
  const collapsed = new Set();
  for (const w of words || []) {
    const b = lettersOnly(basic(w));
    if (b.length < 2) continue;
    for (const form of [b, `${b}s`, `${b}es`]) {
      exact.add(form);
      collapsed.add(collapse(form));
    }
  }
  return { exact, collapsed };
}

function isBanned(token, matcher, tricks) {
  const plain = lettersOnly(basic(token));
  if (plain && matcher.exact.has(plain)) return true;
  if (!tricks) return false;
  const t = tricky(token);
  if (!t) return false;
  if (matcher.exact.has(t)) return true;
  // Solo comparamos "sin repetidas" si la palabra traía letras repetidas o
  // símbolos: así "pera" no se confunde con "perra".
  const suspicious = t !== collapse(t) || t !== plain;
  return suspicious && matcher.collapsed.has(collapse(t));
}

function censor(text, cfg) {
  const matcher = buildMatcher(cfg.bannedWords);
  const tricks = Boolean(cfg.filterTricks);
  const tokens = text.split(' ');
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    // Letras sueltas seguidas ("t o n t o"): las unimos y comprobamos.
    if (tricks && tokens[i].length === 1) {
      let j = i;
      while (j < tokens.length && tokens[j].length === 1) j += 1;
      if (j - i >= 3 && isBanned(tokens.slice(i, j).join(''), matcher, true)) {
        out.push('piip');
        i = j - 1;
        continue;
      }
    }
    out.push(isBanned(tokens[i], matcher, tricks) ? 'piip' : tokens[i]);
  }
  return out.join(' ');
}

function sanitize(text, cfg = {}) {
  let out = String(text || '')
    .replace(LINK_RE, ' enlace ')
    .replace(KICK_EMOTE_RE, ' ')
    .replace(COLON_EMOTE_RE, ' ')
    .replace(EMOJI_RE, ' ')
    .replace(INVISIBLE_RE, '')
    .replace(/(\p{L}{2,3})\1{3,}/gu, '$1$1$1') // "jajajajaja" -> "jajaja"
    .replace(/(.)\1{3,}/gu, '$1$1$1') // "aaaaaaa" -> "aaa"
    .replace(/\s+/g, ' ')
    .trim();

  if (cfg.filterProfanity) out = censor(out, cfg);

  const max = Number(cfg.maxLength) || 200;
  if (out.length > max) out = `${out.slice(0, max).replace(/\s+\S*$/, '')}…`;
  return out;
}

// Normaliza nombres de regalos para compararlos ("Quiéreme" == "quiereme").
const normalizeName = (s) => lettersOnly(basic(s || ''));

module.exports = { sanitize, normalizeName, isBanned, buildMatcher };
