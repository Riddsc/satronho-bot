// Catálogo de regalos y stickers por plataforma, guardado en tu PC.
//
// TikTok: al conectar (o con «Importar») se trae el catálogo completo de tu
// LIVE: id, nombre, valor en monedas e imagen. Kick y Starvios no publican
// su catálogo, así que se va llenando con lo que llega en tus directos.
// Las imágenes se copian a tu PC la primera vez que se piden, para que no
// se pierdan cuando la plataforma cambia sus enlaces.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PLATFORMS = ['tiktok', 'kick', 'starvios'];

// Regalos de TikTok incluidos de serie (lista pública de TikTok). Lo que se
// importa desde tu LIVE o te llega en directo manda sobre esto (nombres en
// tu idioma, regalos de comunidad o de tu región).
let BUILTIN = [];
try {
  BUILTIN = require('../data/tiktok-gifts.json').gifts || [];
} catch { /* sin catálogo incluido */ }

function createGiftCatalog({ dataDir, broadcast = () => {}, fetchFn = fetch }) {
  const file = path.join(dataDir, 'gift-catalog.json');
  const imgDir = path.join(dataDir, 'gift-img');
  fs.mkdirSync(imgDir, { recursive: true });
  let data = { gifts: {}, stickers: {}, importedAt: {} };
  try {
    data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch { /* primera vez */ }
  for (const p of PLATFORMS) { data.gifts[p] ??= {}; data.stickers[p] ??= {}; }

  let saveTimer = null;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { fs.writeFileSync(file, JSON.stringify(data)); } catch { /* disco lleno o sin permiso */ }
    }, 500);
  };

  function merge(kind, platform, list, { replace = false } = {}) {
    const box = data[kind][platform] ||= {};
    let added = 0;
    for (const g of list) {
      if (!g?.id) continue;
      if (!box[g.id]) added += 1;
      box[g.id] = { ...(box[g.id] || {}), ...Object.fromEntries(Object.entries(g).filter(([, v]) => v !== '' && v != null)), seen: box[g.id]?.seen || 0 };
    }
    if (replace) data.importedAt[platform] = Date.now();
    save();
    if (added) broadcast('gift-catalog', summary());
    return added;
  }

  // Lo que llega en el directo también entra al catálogo.
  function onEvent(e) {
    if (!PLATFORMS.includes(e.platform)) return;
    const x = e.extra || {};
    if (e.type === 'gift' && (x.giftId || x.giftName)) {
      const id = String(x.giftId || x.giftName);
      merge('gifts', e.platform, [{ id, name: x.giftName, value: Number(x.unitValue ?? 0) || undefined, image: x.image }]);
      data.gifts[e.platform][id].seen = (data.gifts[e.platform][id].seen || 0) + 1;
    }
    if (e.type === 'sticker' && x.stickerId) {
      const id = String(x.stickerId);
      merge('stickers', e.platform, [{ id, name: x.stickerName || '', image: x.image }]);
      data.stickers[e.platform][id].seen = (data.stickers[e.platform][id].seen || 0) + 1;
    }
  }

  // Imagen local: /gift-img/<hash>.<ext> (se descarga la primera vez).
  const localName = (url) => `${crypto.createHash('sha1').update(url).digest('hex').slice(0, 20)}.${(url.match(/\.(png|webp|jpe?g|gif)(\?|$)/i)?.[1] || 'png').toLowerCase()}`;
  async function imagePath(url) {
    if (!/^https:\/\//.test(url || '')) return null;
    const f = path.join(imgDir, localName(url));
    if (fs.existsSync(f)) return f;
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3 * 1024 * 1024) throw new Error('Imagen muy grande');
    fs.writeFileSync(f, buf);
    return f;
  }

  function list(kind, platform) {
    const mine = data[kind][platform] || {};
    const all = new Map();
    if (kind === 'gifts' && platform === 'tiktok') for (const g of BUILTIN) all.set(g.id, { ...g, builtin: true });
    for (const g of Object.values(mine)) all.set(g.id, { ...(all.get(g.id) || {}), ...g, builtin: false, mine: true });
    if (kind === 'stickers') return [...all.values()].sort((a, b) => (b.seen || 0) - (a.seen || 0));
    return [...all.values()].sort((a, b) => (a.value || 0) - (b.value || 0) || String(a.name).localeCompare(String(b.name)));
  }
  function summary() {
    return Object.fromEntries(PLATFORMS.map((p) => [p, { gifts: list('gifts', p).length, mine: Object.keys(data.gifts[p]).length, stickers: Object.keys(data.stickers[p]).length, importedAt: data.importedAt[p] || 0 }]));
  }

  return { merge, onEvent, list, summary, imagePath };
}

module.exports = { createGiftCatalog };
