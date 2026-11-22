'use strict';
// Idioma de lo que dice la app fuera del panel: mensajes del bot en el chat,
// avisos que lee la voz, ventanas de Windows y errores que llegan al panel.
// Usa los mismos diccionarios que el panel (overlays/i18n/<idioma>.json).
// Los textos se escriben en español en el código, envueltos en t():
//   t('{0} te sigue', nombre)       → «Ana follows you» si el idioma es inglés
//   tn(n, '{0} canción', '{0} canciones')
// Si un texto no está en el diccionario se queda en español.

const fs = require('fs');
const path = require('path');

const LANGS = { es: 'es-CO', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR', it: 'it-IT' };
const DIR = path.join(__dirname, '..', 'overlays', 'i18n');

let lang = 'es';
let dict = new Map();
let templates = new Map();
let patterns = [];

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fill = (text, vars) => String(text).replace(/\{#?(\d+)\}/g, (_, n) => (vars[n] ?? ''));
const toNum = (s) => {
  const m = String(s ?? '').replace(/[.\s](?=\d{3}\b)/g, '').match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : NaN;
};

// Idioma del sistema → uno de los nuestros.
function fromLocale(locale) {
  const l = String(locale || '').slice(0, 2).toLowerCase();
  return LANGS[l] ? l : 'es';
}

function systemLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return process.env.LANG || 'es';
  }
}

// code: 'es' | 'en' | 'pt' | 'fr' | 'it' | 'auto'. locale: el de Windows, para «auto».
function setLanguage(code, locale = systemLocale()) {
  const next = code === 'auto' || !code ? fromLocale(locale) : LANGS[code] ? code : 'es';
  if (next === lang && (next === 'es' || dict.size)) return lang;
  lang = next;
  dict = new Map();
  templates = new Map();
  patterns = [];
  if (lang === 'es') return lang;
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(path.join(DIR, `${lang}.json`), 'utf8'));
  } catch {
    /* sin diccionario: todo se queda en español */
  }
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('@')) continue;
    if (/\{#?\d+\}/.test(k)) {
      // «{#0}» en el diccionario = solo un número; el código lo escribe como «{0}».
      templates.set(k.replace(/\{#(\d+)\}/g, '{$1}'), v);
      const order = [];
      const re = k.split(/(\{#?\d+\})/).map((p) => {
        const m = p.match(/^\{(#?)(\d+)\}$/);
        if (!m) return escRe(p);
        order.push(Number(m[2]));
        return m[1] ? '(-?\\d[\\d.,]*)' : '([\\s\\S]*?)';
      }).join('');
      patterns.push({ re: new RegExp(`^${re}$`), lit: k.replace(/\{\d+\}/g, '').length, value: v, order });
    } else dict.set(k, v);
  }
  patterns.sort((a, b) => b.lit - a.lit);
  return lang;
}

const getLang = () => lang;
const getLocale = () => LANGS[lang];

function pick(value, nums) {
  if (typeof value === 'string') return value;
  const n = nums.find((x) => Number.isFinite(x)) ?? 0;
  let cat = 'other';
  try { cat = new Intl.PluralRules(getLocale()).select(n); } catch { /* «other» */ }
  return value?.[cat] ?? value?.other ?? value?.one ?? '';
}

function t(text, ...vars) {
  if (lang === 'es') return vars.length ? fill(text, vars) : String(text);
  const key = norm(text);
  if (vars.length && templates.has(key)) return fill(pick(templates.get(key), vars.map(toNum)), vars);
  if (!vars.length && dict.has(key)) return pick(dict.get(key), []);
  // Texto ya armado: se busca entre las plantillas.
  const filled = norm(vars.length ? fill(text, vars) : text);
  if (dict.has(filled)) return pick(dict.get(filled), [toNum(filled)]);
  for (const p of patterns) {
    const m = filled.match(p.re);
    if (!m) continue;
    const vals = {};
    p.order.forEach((n, i) => { vals[n] = m[i + 1]; });
    return pick(p.value, p.order.map((n) => toNum(vals[n]))).replace(/\{#?(\d+)\}/g, (_, n) => vals[n] ?? '');
  }
  return vars.length ? fill(text, vars) : String(text);
}

// Solo si el texto entero es uno de los de la app (p. ej. un mensaje que trae
// la app de fábrica y el streamer no cambió). Lo que escribió él se deja igual.
function tExact(text) {
  if (lang === 'es') return String(text);
  const v = dict.get(norm(text));
  return typeof v === 'string' ? v : String(text);
}

function tn(n, one, other, ...vars) {
  const v = vars.length ? vars : [n];
  if (lang === 'es') return fill(Math.abs(Number(n)) === 1 ? one : other, v);
  let cat = 'other';
  try { cat = new Intl.PluralRules(getLocale()).select(Number(n) || 0); } catch { /* «other» */ }
  const tOther = templates.get(norm(other)) ?? dict.get(norm(other));
  const tOne = templates.get(norm(one)) ?? dict.get(norm(one));
  if (tOther && typeof tOther === 'object') return fill(tOther[cat] ?? tOther.other, v);
  const chosen = cat === 'one' ? tOne ?? tOther : tOther ?? tOne;
  return fill(typeof chosen === 'string' ? chosen : Math.abs(Number(n)) === 1 ? one : other, v);
}

function listOf(items, type = 'conjunction') {
  const a = (items || []).filter((x) => x != null && x !== '').map(String);
  try {
    return new Intl.ListFormat(getLocale(), { style: 'long', type }).format(a);
  } catch {
    return a.join(', ');
  }
}

module.exports = { LANGS, setLanguage, getLang, getLocale, t, tn, tExact, listOf, fromLocale };
