// Biblioteca de sonidos de Satronho Bot (0.16).
//
// Tres orígenes, una sola lista:
//   - «k:<id>»  Sonidos libres (CC0) de Kenney que vienen con la app (sounds/).
//   - recetas  Sonidos hechos por código (overlays/sounds.js, SYNTH_LIB).
//   - «m:<id>»  «Mis sonidos»: lo que sube, busca o crea cada streamer.
//               Se guardan en <datos>/my-sounds y su lista en my-sounds.json.
//
// Mis sonidos llegan de:
//   - archivos que sueltas (mp3, wav, ogg…);
//   - el buscador de memes (páginas públicas tipo MyInstants): se descarga en
//     tu PC para tu uso, como si lo bajaras tú;
//   - enlaces directos a un audio o a la página de un sonido;
//   - frases habladas con tus voces (Piper o en línea);
//   - packs (.satronho-sonidos) que exporta otro streamer.
// Satronho no reparte sonidos ajenos: cada quien trae los suyos.

const fs = require('fs');
const path = require('path');

const BUILTIN = require('../data/kenney-sounds.json');
const PHRASES = require('../data/sound-phrases.json');

const EXT = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac' };
const MIME = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm', m4a: 'audio/mp4', aac: 'audio/aac' };
const MAX_BYTES = 10 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const clean = (s, n = 60) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const decodeHtml = (s) => String(s || '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function createSoundLibrary({ dataDir, fetchFn = fetch, engine, online, store, renderPage = null, mediaFetch = null }) {
  const dir = path.join(dataDir, 'my-sounds');
  const listFile = path.join(dataDir, 'my-sounds.json');
  fs.mkdirSync(dir, { recursive: true });

  let mine = [];
  try { mine = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch { mine = []; }
  if (!Array.isArray(mine)) mine = [];
  const save = () => fs.writeFileSync(listFile, JSON.stringify(mine, null, 1));
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  function addFile(buf, { name, cat = 'mis', tags = '', ext = 'mp3', source = '' }) {
    if (!Buffer.isBuffer(buf) || !buf.length) throw new Error('El archivo está vacío');
    if (buf.length > MAX_BYTES) throw new Error('Ese sonido pesa más de 10 MB');
    if (!MIME[ext]) throw new Error('Formato no soportado: usa MP3, WAV, OGG o M4A');
    const id = uid();
    const file = `${id}.${ext}`;
    fs.writeFileSync(path.join(dir, file), buf);
    const entry = { id, name: clean(name) || 'Sonido', cat: clean(cat, 20) || 'mis', tags: clean(tags, 120), file, source: clean(source, 300), added: Date.now() };
    mine.unshift(entry);
    save();
    return entry;
  }

  function list() {
    return { builtin: BUILTIN, mine, phrases: PHRASES };
  }
  function fileOf(id) {
    const e = mine.find((x) => x.id === id);
    return e ? { full: path.join(dir, e.file), mime: MIME[e.file.split('.').pop()] || 'audio/mpeg' } : null;
  }
  function update(id, patch = {}) {
    const e = mine.find((x) => x.id === id);
    if (!e) return null;
    if (patch.name !== undefined) e.name = clean(patch.name) || e.name;
    if (patch.tags !== undefined) e.tags = clean(patch.tags, 120);
    if (patch.cat !== undefined) e.cat = clean(patch.cat, 20) || e.cat;
    save();
    return e;
  }
  function remove(id) {
    const e = mine.find((x) => x.id === id);
    if (!e) return false;
    try { fs.rmSync(path.join(dir, e.file)); } catch { /* ya no estaba */ }
    mine = mine.filter((x) => x.id !== id);
    save();
    return true;
  }

  // ---------- Descargas ----------
  async function download(url) {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error('El enlace debe empezar por http o https');
    if (/^(localhost|127\.|10\.|192\.168\.|0\.)/.test(u.hostname)) throw new Error('Ese enlace no es de internet');
    let res = await (mediaFetch || fetchFn)(u.href, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow' }).catch(() => null);
    // Si la página protege sus archivos, se prueba con el otro camino.
    if ((!res || !res.ok) && mediaFetch) res = await fetchFn(u.href, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow' }).catch(() => null);
    if (!res) throw new Error('No hay conexión con esa página. Revisa tu internet.');
    if (!res.ok) throw new Error(`La página respondió ${res.status}`);
    const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_BYTES) throw new Error('Ese sonido pesa más de 10 MB');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('Ese sonido pesa más de 10 MB');
    return { buf, type, finalUrl: res.url || u.href };
  }
  const extFrom = (type, url) => EXT[type] || (String(url).toLowerCase().match(/\.(mp3|wav|ogg|webm|m4a|aac)(?:$|[?#])/) || [])[1] || '';

  // Busca el audio dentro de una página (la de un sonido de MyInstants u otra).
  function audioInPage(html, base) {
    const pick = (re) => { const m = html.match(re); return m ? new URL(decodeHtml(m[1]), base).href : ''; };
    return pick(/play\(\s*'([^']+\.(?:mp3|ogg|wav|m4a))'/i)
      || pick(/<meta[^>]+property=["']og:audio(?::url)?["'][^>]+content=["']([^"']+)["']/i)
      || pick(/<(?:audio|source)[^>]+src=["']([^"']+\.(?:mp3|ogg|wav|m4a)[^"']*)["']/i)
      || pick(/href=["']([^"']+\.(?:mp3|ogg|wav|m4a))["']/i);
  }
  function titleInPage(html) {
    const m = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || html.match(/<title>([^<]+)<\/title>/i);
    return m ? decodeHtml(m[1]).replace(/\s*[-|·]\s*(MyInstants|Instant Sound Button).*$/i, '').trim() : '';
  }

  async function addFromUrl({ url, name = '', tags = '', cat = 'memes' }) {
    const have = mine.find((x) => x.source === url);
    if (have) return have; // ya estaba: no se baja dos veces
    if (/youtu\.?be/.test(String(url))) throw new Error('YouTube no deja bajar audio desde aquí. Busca el sonido en «Memes» o sube el archivo.');
    let { buf, type, finalUrl } = await download(url);
    let ext = extFrom(type, finalUrl);
    let title = name;
    if (!ext && /html/.test(type)) {
      const html = buf.toString('utf8');
      const audioUrl = audioInPage(html, finalUrl);
      if (!audioUrl) throw new Error('En esa página no encontré ningún sonido');
      title ||= titleInPage(html);
      ({ buf, type, finalUrl } = await download(audioUrl));
      ext = extFrom(type, finalUrl);
    }
    if (!ext) throw new Error('Eso no parece un sonido (MP3, WAV, OGG o M4A)');
    title ||= decodeURIComponent(path.basename(new URL(finalUrl).pathname)).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
    return addFile(buf, { name: title, tags, cat, ext, source: url });
  }

  // Buscador de memes: lee la página pública de búsqueda de MyInstants.
  const MEME_BASE = 'https://www.myinstants.com';
  function parseMemes(html) {
    const out = [];
    const seen = new Set();
    const blocks = html.split(/class=["']instant["']/i).slice(1);
    for (const b of blocks) {
      const mp3 = (b.match(/play\(\s*'([^']+\.(?:mp3|ogg|wav|m4a))'/i) || [])[1];
      if (!mp3 || seen.has(mp3)) continue;
      seen.add(mp3);
      const link = b.match(/<a[^>]+href=["']([^"']*\/instant\/[^"']+)["'][^>]*>([^<]*)<\/a>/i);
      const t2 = (b.match(/title=["'](?:Play|Reproducir|Tocar)\s+(?:el\s+sonido\s+(?:de\s+)?)?([^"']+?)(?:\s+sound)?["']/i) || [])[1];
      const title = decodeHtml(link?.[2] || t2 || path.basename(mp3, path.extname(mp3)).replace(/[-_]+/g, ' ')).trim();
      out.push({ title, url: new URL(mp3, MEME_BASE).href, page: link ? new URL(link[1], MEME_BASE).href : '' });
    }
    // Si cambian el diseño de la página, al menos rescatamos los audios.
    if (!out.length) {
      for (const m of html.matchAll(/play\(\s*'([^']+\.(?:mp3|ogg|wav|m4a))'/gi)) {
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        out.push({ title: decodeURIComponent(path.basename(m[1], path.extname(m[1]))).replace(/[-_]+/g, ' '), url: new URL(m[1], MEME_BASE).href, page: '' });
      }
    }
    return out;
  }
  // Lee la página con el navegador de la app (pasa las protecciones anti-bot);
  // si no estamos dentro de la app, con un fetch normal.
  async function getHtml(url) {
    let lastErr = null;
    try {
      const res = await fetchFn(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-CO,es;q=0.9', Accept: 'text/html' } });
      if (res.ok) {
        const html = await res.text();
        if (/play\(\s*'/.test(html) || /class=["']instant/.test(html)) return html;
      } else if (res.status === 404) return '';
      else lastErr = new Error(`La página de memes respondió ${res.status}`);
    } catch (err) { lastErr = err; }
    if (renderPage) return renderPage(url);
    throw lastErr || new Error('No pude leer la página de memes');
  }
  async function searchMemes(q, page = 1) {
    const query = clean(q, 80);
    const p = Math.max(1, Math.min(20, Number(page) || 1));
    const urls = query
      ? [`${MEME_BASE}/es/search/?name=${encodeURIComponent(query)}&page=${p}`, `${MEME_BASE}/en/search/?name=${encodeURIComponent(query)}&page=${p}`]
      : [`${MEME_BASE}/es/index/co/?page=${p}`, `${MEME_BASE}/es/index/mx/?page=${p}`, `${MEME_BASE}/en/index/us/?page=${p}`];
    let results = [];
    let lastErr = null;
    for (const url of urls) {
      try {
        results = parseMemes(await getHtml(url));
        if (results.length) break;
      } catch (err) { lastErr = err; }
    }
    if (!results.length && lastErr) throw new Error(`No pude buscar memes: ${lastErr.message}`);
    return { results, more: results.length >= 20 };
  }

  // ---------- Frases habladas con tus voces ----------
  async function addPhrase({ text, voice = '', cat = 'frases', tags = '' }) {
    const t = clean(text, 200);
    if (!t) throw new Error('Escribe la frase');
    const tts = store.get('tts') || {};
    const piperKeys = engine.installedVoiceKeys();
    let v = voice || tts.mainVoice || `${tts.piperVoice}#${Number(tts.speaker) || 0}`;
    // Las voces de Windows solo suenan dentro del panel: para guardar la frase
    // como archivo usamos una voz de tu PC o, si no hay, una en línea.
    if (v.startsWith('win:') || (!v.startsWith('ms:') && !piperKeys.includes(v.split('~')[0]))) v = piperKeys[0] || 'ms:es-CO-SalomeNeural';
    v = v.split('~')[0];
    let file;
    if (v.startsWith('ms:')) file = await online.synth(t, { voiceId: v.slice(3), rate: 1 });
    else {
      const [voiceId, speaker] = v.split('#');
      file = await engine.synth(t, { voiceId, speaker: Number(speaker) || 0, rate: 1 });
    }
    const buf = fs.readFileSync(path.join(engine.outDir, file));
    return addFile(buf, { name: `«${t.slice(0, 50)}»`, cat, tags: `${tags} frase voz`.trim(), ext: file.split('.').pop(), source: `voz:${v}` });
  }

  // ---------- Packs para compartir ----------
  function exportPack(ids) {
    const want = Array.isArray(ids) && ids.length ? mine.filter((x) => ids.includes(x.id)) : mine;
    return {
      format: 'satronho-sonidos', version: 1, created: new Date().toISOString(),
      sounds: want.map((x) => {
        try {
          return { name: x.name, cat: x.cat, tags: x.tags, ext: x.file.split('.').pop(), data: fs.readFileSync(path.join(dir, x.file)).toString('base64') };
        } catch { return null; }
      }).filter(Boolean),
    };
  }
  function importPack(pack) {
    if (pack?.format !== 'satronho-sonidos' || !Array.isArray(pack.sounds)) throw new Error('Ese archivo no es un pack de sonidos de Satronho');
    const have = new Set(mine.map((x) => `${norm(x.name)}|${x.cat}`));
    let added = 0;
    for (const s of pack.sounds.slice(0, 500)) {
      if (have.has(`${norm(s.name)}|${s.cat}`)) continue;
      try { addFile(Buffer.from(String(s.data || ''), 'base64'), { name: s.name, cat: s.cat, tags: s.tags, ext: s.ext }); added += 1; } catch { /* uno malo no frena el resto */ }
    }
    return added;
  }

  // ---------- Buscar por nombre (comando del chat) ----------
  function find(q) {
    const n = norm(q);
    if (!n) return null;
    const all = [...mine.map((x) => ({ ref: `m:${x.id}`, name: x.name, tags: x.tags })), ...BUILTIN.map((x) => ({ ref: `k:${x.id}`, name: x.name, tags: x.tags }))];
    return all.find((x) => norm(x.name).replace(/[«»"]/g, '') === n)
      || all.find((x) => norm(x.name).includes(n))
      || all.find((x) => norm(x.tags).split(' ').includes(n))
      || null;
  }

  return { list, fileOf, update, remove, addFile, addFromUrl, searchMemes, addPhrase, exportPack, importPack, find, dir, EXT, _parseMemes: parseMemes };
}

module.exports = { createSoundLibrary };
