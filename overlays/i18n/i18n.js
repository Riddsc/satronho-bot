// Idiomas de la interfaz de Satronho Bot (panel, ventana del chat y overlays).
//
// Cómo funciona: los textos se escriben en español en el código, como
// siempre. Al mostrarse, este archivo los busca en el diccionario del idioma
// del streamer (overlays/i18n/<idioma>.json) y los cambia. Si un texto no
// está en el diccionario, se queda en español: nunca se rompe nada.
//
// Unidad de traducción: un elemento cuyo contenido es solo texto y etiquetas
// de formato (<b>, <i>, <a>, <code>…). Su clave conserva las etiquetas
// numeradas para que cada idioma pueda cambiar el orden de las palabras:
//   «Pulsa <0>Guardar</0> para terminar»  →  «Press <0>Save</0> to finish»
// Las partes que cambian (nombres, números) son comodines {0}, {1}…:
//   «{0} te sigue»  →  «{0} follows you»
// Plurales: la traducción puede ser { "one": "…", "other": "…" } y se elige
// según el primer número del texto, con las reglas de cada idioma.
//
// Zonas que no se traducen: lo que tenga translate="no" (chat, nombres…),
// los campos de texto y lo que escribe el streamer.
// <span data-u> dentro de un párrafo lo convierte en una frase aparte.

export const LANGS = {
  es: { name: 'Español', locale: 'es-CO' },
  en: { name: 'English', locale: 'en-US' },
  pt: { name: 'Português (Brasil)', locale: 'pt-BR' },
  fr: { name: 'Français', locale: 'fr-FR' },
  it: { name: 'Italiano', locale: 'it-IT' },
};

const INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'A', 'CODE', 'KBD', 'SMALL', 'SPAN', 'MARK', 'S', 'SUP', 'SUB', 'BR', 'ABBR', 'Q', 'TIME', 'DFN', 'VAR', 'SAMP', 'WBR', 'BDI', 'IMG']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'PRE']);
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-tip', 'data-label', 'data-hint', 'data-title', 'data-empty', 'label'];
const LETTERS = /[A-Za-zÀ-ÿ]/;

let lang = 'es';
let dict = new Map(); // clave exacta -> traducción
let patterns = []; // { re, lit, value, order }
let templates = new Map(); // clave con comodines tal cual -> traducción (para t())
const cache = new Map();
let observer = null;
const done = new WeakMap(); // nodo -> último texto que dejó el traductor

export const getLang = () => lang;
export const getLocale = () => LANGS[lang]?.locale || 'es-CO';

// Idioma del sistema → uno de los nuestros (para «Automático»).
export function systemLang() {
  const l = String((typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'es').slice(0, 2).toLowerCase();
  return LANGS[l] ? l : 'es';
}

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compile(key, value) {
  // Comodines {0}, {1}… en el orden en que aparecen en el español.
  // {#0} solo acepta un número (p. ej. «Puñetazo {#0}» → «Puñetazo 3»).
  const parts = key.split(/(\{#?\d+\})/);
  const order = [];
  let re = '^';
  let lit = '';
  for (const p of parts) {
    const m = p.match(/^\{(#?)(\d+)\}$/);
    if (m) {
      order.push(Number(m[2]));
      re += m[1] ? '(-?\\d[\\d.,]*)' : '([\\s\\S]*?)';
    } else {
      re += escRe(p);
      if (p.length > lit.length) lit = p;
    }
  }
  return { re: new RegExp(`${re}$`), lit, value, order };
}

export function loadDictionary(code, data) {
  lang = LANGS[code] ? code : 'es';
  dict = new Map();
  patterns = [];
  templates = new Map();
  cache.clear();
  if (lang === 'es' || !data) return;
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('@')) continue; // notas del archivo
    if (/\{#?\d+\}/.test(k)) {
      // Plantillas casi sin texto fijo («en {0}», «{0} más») solo sirven para t():
      // en pantalla podrían cambiar a medias frases que no son suyas.
      const fixed = k.replace(/\{#?\d+\}|<\/?\d+\/?>|<br>/g, '').replace(/[^A-Za-zÀ-ÿ]/g, '').length;
      if (fixed >= 4 || /\{#\d+\}/.test(k)) patterns.push(compile(k, v));
      templates.set(k, v);
    } else dict.set(k, v);
  }
  // Primero los patrones con más texto fijo: son los más precisos.
  patterns.sort((a, b) => b.lit.length - a.lit.length);
}

function pickPlural(value, nums) {
  if (typeof value === 'string') return value;
  const n = nums.find((x) => Number.isFinite(x));
  let cat = 'other';
  try {
    cat = new Intl.PluralRules(getLocale()).select(n ?? 0);
  } catch { /* sin reglas: «other» */ }
  return value[cat] ?? value.other ?? value.one ?? '';
}

const toNum = (s) => {
  const m = String(s).replace(/[.\s](?=\d{3}\b)/g, '').match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : NaN;
};

// Traduce una clave ya normalizada. Devuelve null si no hay traducción.
// Si una plantilla atrapa una frase entera de la app («Vista previa: {0}»),
// esa frase también se traduce.
function lookup(key, depth = 0) {
  if (lang === 'es' || !key) return null;
  if (!depth && cache.has(key)) return cache.get(key);
  let out = null;
  if (dict.has(key)) {
    out = pickPlural(dict.get(key), [toNum(key)]);
  } else {
    for (const p of patterns) {
      if (p.lit && !key.includes(p.lit)) continue;
      const m = key.match(p.re);
      if (!m) continue;
      const vals = {};
      p.order.forEach((n, i) => {
        let val = m[i + 1];
        if (depth < 2 && val && !val.includes('<') && LETTERS.test(val) && (/\s/.test(val.trim()) || /[.:!?…]$/.test(val.trim()))) {
          const inner = lookup(norm(val), depth + 1);
          if (inner != null) val = val.replace(norm(val), inner);
        }
        vals[n] = val;
      });
      const v = pickPlural(p.value, p.order.map((n) => toNum(vals[n])));
      out = v.replace(/\{#?(\d+)\}/g, (_, n) => vals[n] ?? '');
      break;
    }
  }
  if (!depth) {
    if (cache.size > 5000) cache.clear();
    cache.set(key, out);
  }
  return out;
}

const fill = (text, vars) => String(text).replace(/\{#?(\d+)\}/g, (_, n) => (vars[n] ?? ''));

// Las plantillas del código traen HTML (<b>…</b>); el diccionario las guarda
// con etiquetas numeradas (<0>…</0>), igual que en las pantallas.
const VOID = new Set(['img', 'br', 'wbr', 'hr', 'input']);
function toKey(html) {
  const tags = [];
  const stack = [];
  const key = String(html).replace(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g, (m, close, name) => {
    const n = name.toLowerCase();
    if (n === 'br' || n === 'wbr') return '<br>';
    if (close) {
      const i = stack.pop();
      return i == null ? m : `</${i}>`;
    }
    tags.push({ open: m, close: `</${name}>` });
    const i = tags.length - 1;
    if (VOID.has(n) || /\/>$/.test(m)) return `<${i}/>`;
    stack.push(i);
    return `<${i}>`;
  });
  return { key: norm(key), tags };
}
const fromKey = (text, tags) => (tags.length
  ? String(text).replace(/<(\/?)(\d+)(\/?)>/g, (m, close, i, self) => {
    const tg = tags[Number(i)];
    if (!tg) return '';
    return close ? tg.close : tg.open;
  })
  : String(text));
// «{0} regalos» en el código puede estar como «{#0} regalos» (solo números) en el diccionario.
const entry = (key) => templates.get(key) ?? dict.get(key) ?? templates.get(key.replace(/\{(\d+)\}/g, '{#$1}'));

// Para textos que el código arma (avisos, títulos de ventana, confirmaciones).
// Acepta comodines: t('{0} te sigue', nombre). Primero se traduce la
// plantilla y después se rellenan los comodines, así cada idioma puede
// ordenar la frase a su manera.
export function t(text, ...vars) {
  if (lang === 'es') return vars.length ? fill(text, vars) : String(text);
  const { key, tags } = toKey(text);
  const v = entry(key);
  if (v != null) return fill(fromKey(pickPlural(v, vars.map(toNum)), tags), vars);
  const filled = vars.length ? fill(text, vars) : String(text);
  return lookup(norm(filled)) ?? filled;
}

// Singular o plural según n: tn(3, '{0} regalo', '{0} regalos').
// {0} es n (o el primer valor extra, p. ej. el número ya formateado).
export function tn(n, one, other, ...vars) {
  const v = vars.length ? vars : [n];
  if (lang === 'es') return fill(Math.abs(Number(n)) === 1 ? one : other, v);
  const a = toKey(one);
  const b = toKey(other);
  let cat = 'other';
  try { cat = new Intl.PluralRules(getLocale()).select(Number(n) || 0); } catch { /* «other» */ }
  const tOther = entry(b.key);
  const tOne = entry(a.key);
  if (tOther && typeof tOther === 'object') return fill(fromKey(tOther[cat] ?? tOther.other, b.tags), v);
  if (cat === 'one' ? tOne != null : tOther == null && tOne != null) return fill(fromKey(pickPlural(tOne, [n]), a.tags), v);
  if (tOther != null) return fill(fromKey(pickPlural(tOther, [n]), b.tags), v);
  return fill(Math.abs(Number(n)) === 1 ? one : other, v);
}

// Lista con «y» u «o» según el idioma: listOf(['Kick', 'Twitch']) → «Kick y Twitch».
export function listOf(items, type = 'conjunction') {
  const a = (items || []).filter((x) => x != null && x !== '').map(String);
  try {
    return new Intl.ListFormat(getLocale(), { style: 'long', type }).format(a);
  } catch {
    return a.length > 1 ? `${a.slice(0, -1).join(', ')} ${type === 'disjunction' ? 'o' : 'y'} ${a.at(-1)}` : a[0] || '';
  }
}

// ---------- DOM ----------
const isSkipped = (el) => !el || SKIP.has(el.nodeName.toUpperCase()) || el.isContentEditable || el.closest?.('[translate="no"],[data-i18n="no"],svg');
const pureInline = (el) => {
  for (const c of el.children) {
    // data-u marca una frase aparte: el padre deja de ser una sola unidad.
    if (!INLINE.has(c.nodeName.toUpperCase()) || c.hasAttribute('data-u') || !pureInline(c)) return false;
  }
  return true;
};

// Serializa el contenido de una unidad: texto + <n>…</n> + <br>.
function serialize(el, list) {
  let s = '';
  for (const c of el.childNodes) {
    if (c.nodeType === 3) s += c.nodeValue;
    else if (c.nodeType === 1) {
      const name = c.nodeName.toUpperCase();
      if (name === 'BR' || name === 'WBR') s += '<br>';
      else if (name === 'IMG') { list.push(c); s += `<${list.length - 1}/>`; }
      else {
        list.push(c);
        const i = list.length - 1;
        s += `<${i}>${serialize(c, list)}</${i}>`;
      }
    }
  }
  return s;
}

// Construye nodos a partir de la traducción, reutilizando las etiquetas originales.
function build(html, list, doc) {
  const frag = doc.createDocumentFragment();
  const re = /<(\d+)\/>|<(\d+)>([\s\S]*?)<\/\2>|<br>/g;
  let last = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m.index > last) frag.appendChild(doc.createTextNode(html.slice(last, m.index)));
    if (m[0] === '<br>') frag.appendChild(doc.createElement('br'));
    else if (m[1] !== undefined) {
      const orig = list[Number(m[1])];
      if (orig) frag.appendChild(orig.cloneNode(true));
    } else {
      const orig = list[Number(m[2])];
      if (orig) {
        const el = orig.cloneNode(false);
        el.appendChild(build(m[3], list, doc));
        frag.appendChild(el);
      } else frag.appendChild(doc.createTextNode(m[3]));
    }
    last = re.lastIndex;
  }
  if (last < html.length) frag.appendChild(doc.createTextNode(html.slice(last)));
  return frag;
}

function translateUnit(el) {
  const list = [];
  const raw = serialize(el, list);
  const key = norm(raw);
  if (!key || !LETTERS.test(key.replace(/<\/?\d+\/?>|<br>/g, ''))) return true;
  if (done.get(el) === key) return true;
  const tr = lookup(key);
  if (tr == null) return false;
  // Conserva los espacios de los bordes (separan la unidad de lo que la rodea).
  const lead = /^\s/.test(raw) ? ' ' : '';
  const trail = /\s$/.test(raw) ? ' ' : '';
  const frag = build(`${lead}${tr}${trail}`, list, el.ownerDocument);
  el.replaceChildren(frag);
  done.set(el, norm(serialize(el, [])));
  return true;
}

function translateText(node) {
  const raw = node.nodeValue;
  const key = norm(raw);
  if (!key || !LETTERS.test(key) || done.get(node) === key) return;
  const tr = lookup(key);
  if (tr == null) return;
  const lead = raw.match(/^\s*/)[0] ? ' ' : '';
  const trail = raw.match(/\s*$/)[0] ? ' ' : '';
  node.nodeValue = `${lead}${tr}${trail}`;
  done.set(node, norm(node.nodeValue));
}

function translateAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (!v || !LETTERS.test(v)) continue;
    const mark = `attr:${a}`;
    if (el[mark] === v) continue;
    const tr = lookup(norm(v));
    if (tr != null) {
      el.setAttribute(a, tr);
      el[mark] = tr;
    }
  }
  // Botones de tipo input (value visible).
  if (el.nodeName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.value && LETTERS.test(el.value)) {
    const tr = lookup(norm(el.value));
    if (tr != null) el.value = tr;
  }
}

export function translateTree(root) {
  if (lang === 'es' || !root) return;
  if (root.nodeType === 3) {
    if (!isSkipped(root.parentElement)) translateText(root);
    return;
  }
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.nodeType === 1) {
    // Campos de texto: su contenido es del streamer, pero la pista (placeholder) y el título sí se traducen.
    if (/^(INPUT|TEXTAREA|SELECT|IFRAME)$/.test(root.nodeName) && !root.closest('[translate="no"]')) {
      translateAttrs(root);
      // Las opciones de una lista desplegable sí son textos de la app.
      if (root.nodeName === 'SELECT') {
        for (const o of root.querySelectorAll('option, optgroup')) {
          if (o.getAttribute('translate') === 'no') continue;
          if (o.nodeName === 'OPTGROUP') { translateAttrs(o); continue; }
          const k = norm(o.textContent);
          if (!k || !LETTERS.test(k) || done.get(o) === k) continue;
          const tr = lookup(k);
          if (tr != null) { o.textContent = tr; done.set(o, norm(tr)); }
        }
      }
    }
    if (isSkipped(root)) return;
    translateAttrs(root);
    // Unidad completa: solo texto y formato.
    if (root.childNodes.length && pureInline(root) && LETTERS.test(root.textContent || '')) {
      if (translateUnit(root)) {
        for (const c of root.querySelectorAll('*')) translateAttrs(c);
        return;
      }
    }
  }
  for (const c of [...root.childNodes]) {
    if (c.nodeType === 3) translateText(c);
    else if (c.nodeType === 1) translateTree(c);
  }
}

// Los cambios que haga el panel después (listas, avisos…) se traducen solos.
function watch(doc) {
  if (observer || typeof MutationObserver === 'undefined') return;
  let queue = new Set();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const items = [...queue];
    queue = new Set();
    for (const n of items) {
      if (!n.isConnected) continue;
      // Si cambió algo dentro de una unidad, se traduce la unidad entera.
      let target = n.nodeType === 3 ? n.parentElement : n;
      while (target && target.parentElement && INLINE.has(target.nodeName.toUpperCase()) && pureInline(target.parentElement)) target = target.parentElement;
      if (target && target.parentElement && pureInline(target.parentElement) && LETTERS.test(target.parentElement.textContent || '') && !isSkipped(target.parentElement)) target = target.parentElement;
      translateTree(target || n);
    }
  };
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') {
        if (m.addedNodes.length) queue.add(m.target);
      } else if (m.type === 'characterData') queue.add(m.target);
      else if (m.type === 'attributes') queue.add(m.target);
    }
    if (!scheduled && queue.size) {
      scheduled = true;
      queueMicrotask(flush);
    }
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// Arranque: pregunta el idioma a la app, carga el diccionario y traduce.
// opts.lang fuerza un idioma (p. ej. ?lang=en en un overlay).
export async function initI18n(opts = {}) {
  const doc = opts.document || document;
  let code = opts.lang || new URLSearchParams(location.search).get('lang') || '';
  if (!code) {
    try {
      const r = await fetch('/api/lang', { cache: 'no-store' });
      code = (await r.json()).lang || 'es';
    } catch {
      code = 'es';
    }
  }
  if (code === 'auto') code = systemLang();
  if (!LANGS[code]) code = 'es';
  let data = null;
  if (code !== 'es') {
    try {
      const r = await fetch(`/overlays/i18n/${code}.json`, { cache: 'no-cache' });
      if (r.ok) data = await r.json();
    } catch { /* sin diccionario: se queda en español */ }
  }
  loadDictionary(code, data);
  doc.documentElement.lang = code === 'pt' ? 'pt-BR' : code;
  if (code !== 'es') {
    translateTree(doc.documentElement);
    watch(doc);
    if (doc.title) doc.title = t(doc.title);
  }
  doc.documentElement.classList.remove('i18n-wait');
  return code;
}
