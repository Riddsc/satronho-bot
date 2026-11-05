// Mis archivos: todo lo que subiste o descargaste a la app en un solo sitio.
//   · Mis sonidos (biblioteca de Sonidos: memes, frases, subidos)
//   · Sonidos de alertas (los que elegiste para una alerta de serie o propia)
//   · Imágenes y videos (data/media)
// Cada archivo dice en cuántos sitios se usa, para borrar sin miedo.

const fs = require('fs');
const path = require('path');

const MEDIA = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' };
const KIND = { png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', mp4: 'video', webm: 'video', mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', aac: 'audio' };
const MAX = 25 * 1024 * 1024;
const clean = (s, n = 80) => String(s || '').replace(/[\u0000-\u001f<>/\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const sizeOf = (f) => { try { return fs.statSync(f).size; } catch { return 0; } };
const mtimeOf = (f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };

function createFiles({ dataDir, store, soundLib }) {
  const mediaDir = path.join(dataDir, 'media');
  const alertDir = path.join(dataDir, 'alert-sounds');
  const metaFile = path.join(dataDir, 'media.json');
  fs.mkdirSync(mediaDir, { recursive: true });
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch { meta = {}; }
  const saveMeta = () => fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));

  // En cuántos sitios de la configuración aparece (alertas, comandos, sonidos del chat…).
  function usesOf(needle) {
    if (!needle) return 0;
    const all = JSON.stringify(store.get());
    let n = 0;
    let i = all.indexOf(needle);
    while (i >= 0) { n += 1; i = all.indexOf(needle, i + needle.length); }
    return n;
  }
  const alertNames = () => {
    const a = store.get('alerts') || {};
    const out = {};
    for (const [k, t] of Object.entries(a.types || {})) if (t?.file) out[String(t.file).split('?')[0]] = t.fileName || `Alerta: ${k}`;
    if (a.bigGift?.file) out[String(a.bigGift.file).split('?')[0]] = a.bigGift.fileName || 'Regalo grande';
    for (const r of store.get('alertRules') || []) if (r?.file) out[String(r.file).split('?')[0]] = r.fileName || r.name || 'Alerta propia';
    return out;
  };

  function list() {
    const out = [];
    for (const s of soundLib.list().mine) {
      const full = path.join(dataDir, 'my-sounds', s.file);
      out.push({ id: `m:${s.id}`, kind: 'audio', group: 'Mis sonidos', name: s.name, ext: s.file.split('.').pop(), size: sizeOf(full), added: s.added || mtimeOf(full), url: `/my-sounds/${s.id}`, uses: usesOf(`m:${s.id}`), cat: s.cat });
    }
    const names = alertNames();
    let files = [];
    try { files = fs.readdirSync(alertDir); } catch { files = []; }
    for (const f of files) {
      const full = path.join(alertDir, f);
      const ext = f.split('.').pop().toLowerCase();
      out.push({ id: `a:${f}`, kind: KIND[ext] || 'audio', group: 'Sonidos de alertas', name: names[f] || f.replace(/\.[^.]+$/, ''), ext, size: sizeOf(full), added: mtimeOf(full), url: `/alert-sounds/${f}`, uses: names[f] ? Math.max(1, usesOf(f)) : usesOf(f), fixed: true });
    }
    try { files = fs.readdirSync(mediaDir); } catch { files = []; }
    for (const f of files) {
      const full = path.join(mediaDir, f);
      const ext = f.split('.').pop().toLowerCase();
      out.push({ id: `f:${f}`, kind: KIND[ext] || 'image', group: 'Imágenes y videos', name: meta[f]?.name || f.replace(/\.[^.]+$/, ''), ext, size: sizeOf(full), added: meta[f]?.added || mtimeOf(full), url: `/media/${f}`, uses: usesOf(`/media/${f}`) });
    }
    return out.sort((a, b) => b.added - a.added);
  }

  function upload(buf, type, name) {
    if (!Buffer.isBuffer(buf) || !buf.length) throw new Error('El archivo está vacío');
    if (soundLib.EXT[type]) return { id: `m:${soundLib.addFile(buf, { name, ext: soundLib.EXT[type] }).id}` };
    const ext = MEDIA[type];
    if (!ext) throw new Error('Formato no soportado: sonidos MP3, WAV, OGG o M4A; imágenes PNG, JPG, GIF o WEBP; videos MP4 o WEBM');
    if (buf.length > MAX) throw new Error('Ese archivo pesa más de 25 MB');
    const file = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
    fs.writeFileSync(path.join(mediaDir, file), buf);
    meta[file] = { name: clean(name) || 'Archivo', added: Date.now() };
    saveMeta();
    return { id: `f:${file}` };
  }

  function rename(id, name) {
    const [k, ref] = [id.slice(0, 1), id.slice(2)];
    if (k === 'm') return Boolean(soundLib.update(ref, { name }));
    if (k === 'f' && fs.existsSync(path.join(mediaDir, path.basename(ref)))) {
      meta[path.basename(ref)] = { ...(meta[path.basename(ref)] || {}), name: clean(name) || 'Archivo' };
      saveMeta();
      return true;
    }
    throw new Error('Este archivo no se puede renombrar aquí');
  }

  function remove(id) {
    const [k, ref] = [id.slice(0, 1), path.basename(id.slice(2))];
    if (k === 'm') return soundLib.remove(ref);
    if (k === 'f') { try { fs.rmSync(path.join(mediaDir, ref)); } catch { /* ya no estaba */ } delete meta[ref]; saveMeta(); return true; }
    if (k === 'a') {
      // Sonido de una alerta: se borra y esa alerta vuelve a su sonido de serie.
      try { fs.rmSync(path.join(alertDir, ref)); } catch { /* ya no estaba */ }
      const a = store.get('alerts') || {};
      const types = {};
      for (const [key, t] of Object.entries(a.types || {})) if (String(t?.file || '').split('?')[0] === ref) types[key] = { file: '', fileName: '', sound: 'campanita' };
      if (Object.keys(types).length) store.update({ alerts: { types } });
      return true;
    }
    return false;
  }

  return { list, upload, rename, remove, mediaDir, MEDIA };
}

module.exports = { createFiles };
