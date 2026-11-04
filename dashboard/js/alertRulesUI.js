// Alertas → Alertas propias (Troya).
// Lista de reglas por plataforma y tipo, y un editor en ventana:
//   1. ¿De dónde llega?  TikTok · Kick · Starvios · Cualquiera
//   2. ¿Qué tiene que pasar?  regalo, rango de monedas, likes, sticker…
//   3. Cómo sale: nombre, sonido, segundos, texto, imagen, voz y si
//      reemplaza a la alerta de serie («Solo la suya») o suena con ella.

import { $, $$, api, esc, toast, saveConfig } from './util.js';
import { sayFor } from './guides.js';
import { SOUNDS, playAlertSound } from '/overlays/sounds.js';

const PLATS = [
  ['tiktok', 'TikTok'], ['kick', 'Kick'], ['starvios', 'Starvios'], ['any', 'Cualquiera'],
];
const TRIG = {
  gift: { icon: '🎁', name: 'Regalo', desc: 'Uno o varios regalos concretos' },
  coins: { icon: '🪙', name: 'Rango de monedas', desc: 'Cualquier regalo entre dos valores' },
  sticker: { icon: '✨', name: 'Sticker', desc: 'Cuando mandan un sticker al chat' },
  likesPerson: { icon: '💗', name: 'Likes de una persona', desc: 'Cada N likes de alguien' },
  likesTotal: { icon: '👍', name: 'Likes de todos', desc: 'Cada N likes en total' },
  follow: { icon: '♥', name: 'Seguidor nuevo', desc: 'Alguien empieza a seguirte' },
  sub: { icon: '✦', name: 'Suscripción', desc: 'Suscripciones y renovaciones' },
  share: { icon: '↗', name: 'Compartido', desc: 'Comparten tu directo' },
  join: { icon: '👋', name: 'Llega al directo', desc: 'Alguien entra (puede ser mucho)' },
  superfan: { icon: '⭐', name: 'Superfan', desc: 'Alguien se vuelve superfan' },
  keyword: { icon: '💬', name: 'Palabra en el chat', desc: 'Una palabra o frase' },
  liveStart: { icon: '🔴', name: 'Empieza el directo', desc: 'Al entrar en LIVE' },
  liveEnd: { icon: '⏹', name: 'Termina el directo', desc: 'Al terminar el LIVE' },
};
const ONLY_TIKTOK = ['likesPerson', 'likesTotal', 'join', 'superfan', 'liveStart', 'liveEnd'];
const VARS = ['{usuario}', '{regalo}', '{cantidad}', '{valor}', '{plataforma}', '{mensaje}'];
const nf = new Intl.NumberFormat('es-CO');

let config;
const ui = { plat: 'tiktok', q: '' };
const catalogs = {}; // plataforma -> { gifts, stickers }
let draft = null; // regla en edición
const pick = { q: '', price: 'all' };

const rules = () => config.alertRules || [];
const imgUrl = (u) => (!u ? '' : u.startsWith('/') ? u : `/gift-img?u=${encodeURIComponent(u)}`);
const uid = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function saveRules(list) {
  config.alertRules = list;
  saveConfig({ alertRules: list });
  renderList();
}

async function loadCatalog(p) {
  if (p === 'any') return { gifts: [], stickers: [] };
  try {
    const r = await api('GET', `/api/gifts/${p}`);
    catalogs[p] = r;
    updateImportBadge(r.summary);
  } catch {
    catalogs[p] ??= { gifts: [], stickers: [] };
  }
  return catalogs[p];
}
function updateImportBadge(sum) {
  const n = sum?.tiktok?.gifts || 0;
  const b = $('#ar-import small');
  if (b) b.textContent = n ? `${nf.format(n)} regalos` : '';
}
export function onCatalogChange(sum) {
  updateImportBadge(sum);
  for (const p of Object.keys(catalogs)) delete catalogs[p];
}

// ---------- Lista ----------
function triggerCell(r) {
  const t = TRIG[r.trigger] || { icon: '✦', name: r.trigger };
  const cat = catalogs[r.platform] || {};
  let img = `<span class="ar-ic">${t.icon}</span>`;
  let title = t.name;
  let sub = '';
  if (r.trigger === 'gift' && r.gifts?.length) {
    const g = (cat.gifts || []).find((x) => String(x.id) === String(r.gifts[0]));
    if (g?.image) img = `<img src="${esc(imgUrl(g.image))}" alt="" loading="lazy">`;
    title = g?.name || r.giftNames?.[0] || `Regalo ${r.gifts[0]}`;
    sub = r.gifts.length > 1 ? `y ${r.gifts.length - 1} más` : g?.value != null ? `🪙 ${nf.format(g.value)}` : '';
  } else if (r.trigger === 'sticker') {
    const s = (cat.stickers || []).find((x) => String(x.id) === String(r.stickers?.[0]));
    if (s?.image) img = `<img src="${esc(imgUrl(s.image))}" alt="" loading="lazy">`;
    title = r.stickers?.length ? (s?.name || 'Sticker') : 'Cualquier sticker';
    sub = r.stickers?.length > 1 ? `y ${r.stickers.length - 1} más` : '';
  } else if (r.trigger === 'coins') sub = `🪙 ${nf.format(Number(r.min) || 0)}–${r.max ? nf.format(r.max) : '∞'}`;
  else if (r.trigger === 'likesPerson' || r.trigger === 'likesTotal') sub = `cada ${nf.format(Number(r.every) || 0)}`;
  else if (r.trigger === 'keyword') sub = `«${esc(String(r.keyword || '').slice(0, 24))}»`;
  return `<div class="ar-trig">${img}<div><small class="ar-type">${esc(PLATS.find((p) => p[0] === (r.platform || 'any'))?.[1] || '')} · ${esc(t.name)}</small><b>${esc(title)}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
}
function soundName(r) {
  if (r.sound === 'none') return 'Sin sonido';
  if (r.sound === 'file') return r.fileName || 'Mi sonido';
  return SOUNDS[r.sound] || SOUNDS.campanita;
}
function renderList() {
  const box = $('#ar-list');
  if (!box) return;
  const all = rules();
  $('#ar-plats').innerHTML = PLATS.map(([id, n]) => `<button type="button" data-ar-plat="${id}" aria-pressed="${ui.plat === id}">${n} <small>${all.filter((r) => (r.platform || 'any') === id).length}</small></button>`).join('');
  const q = ui.q.toLowerCase();
  const list = all.filter((r) => (r.platform || 'any') === ui.plat && (!q || `${r.name} ${TRIG[r.trigger]?.name} ${(r.giftNames || []).join(' ')} ${r.keyword || ''} ${r.text || ''}`.toLowerCase().includes(q)));
  if (!list.length) {
    box.innerHTML = `<div class="ar-empty"><span>🔔</span><b>${all.length ? 'Nada con ese filtro aquí.' : 'Todavía no tienes alertas propias.'}</b><p>Dale a un regalo o a un sticker su propio sonido, o haz que algo suene cada 500 likes. Lo que no tenga alerta propia suena con la de serie.</p><button type="button" class="btn primary" data-ar-new>＋ Nueva alerta</button></div>`;
    return;
  }
  const groups = new Map();
  for (const r of list) {
    if (!groups.has(r.trigger)) groups.set(r.trigger, []);
    groups.get(r.trigger).push(r);
  }
  box.innerHTML = [...groups].map(([trig, rs]) => `<section class="ar-group"><h4><span>${TRIG[trig]?.icon || '✦'}</span>${esc(TRIG[trig]?.name || trig)} <small>${rs.length}</small></h4>
    ${rs.map((r) => `<div class="ar-row ${r.enabled === false ? 'off' : ''}" data-ar="${esc(r.id)}">
      ${triggerCell(r)}
      <button type="button" class="ar-test" data-ar-test title="Probar en el overlay">▶</button>
      <div class="ar-what"><b>${esc(r.name || 'Alerta')}</b><small><span class="ar-chip">♪ ${esc(soundName(r))}</span>${r.text ? `<span class="ar-chip t">${esc(r.text)}</span>` : ''}${r.speak ? '<span class="ar-chip">🗣 Troya la lee</span>' : ''}${(r.instant ?? r.trigger === 'sticker') ? '<span class="ar-chip">⚡ al instante</span>' : ''}${r.cooldownSec ? `<span class="ar-chip">⏱ ${r.cooldownSec} s</span>` : ''}</small></div>
      <div class="seg ar-excl" title="Si el evento también tiene alerta de serie"><button type="button" data-ar-excl="1" aria-pressed="${r.exclusive !== false}">Solo la suya</button><button type="button" data-ar-excl="0" aria-pressed="${r.exclusive === false}">Las dos</button></div>
      <label class="switch" title="Activar o pausar"><input type="checkbox" data-ar-on ${r.enabled !== false ? 'checked' : ''}><span></span></label>
      <button type="button" class="ar-btn" data-ar-edit title="Editar">✎</button>
      <button type="button" class="ar-btn del" data-ar-del title="Borrar">✕</button>
    </div>`).join('')}</section>`).join('');
}

// ---------- Editor ----------
const blank = (platform) => ({ id: uid(), enabled: true, platform: platform === 'any' ? 'tiktok' : platform, trigger: 'gift', gifts: [], giftNames: [], stickers: [], name: '', sound: 'campanita', volume: 75, seconds: 5, fitSound: false, text: '', speak: false, exclusive: true, showImage: true, cooldownSec: 0 });

function openEditor(rule) {
  draft = JSON.parse(JSON.stringify(rule || blank(ui.plat)));
  pick.q = '';
  pick.price = 'all';
  $('#ar-modal').hidden = false;
  const fr = $('#ar-prev');
  if (fr && !fr.getAttribute('src')) {
    fr.src = '/overlays/alerts.html?preview=1&still=1';
    fr.addEventListener('load', () => renderSummary());
    const fit = () => { const w = fr.parentElement.clientWidth; fr.style.transform = `scale(${w / 800})`; };
    new ResizeObserver(fit).observe(fr.parentElement);
  }
  $('#ar-modal-title').textContent = rule ? 'Editar alerta' : 'Nueva alerta';
  renderEditor();
}
function closeEditor() {
  $('#ar-modal').hidden = true;
  draft = null;
}

// Vitrina: los regalos se agrupan por lo que valen, como en una tienda.
const TIERS = [
  { id: 't1', name: 'Detallitos', icon: '💗', desc: '1 moneda', test: (v) => v <= 1 },
  { id: 't2', name: 'Bonitos', icon: '🌹', desc: '2 a 99', test: (v) => v >= 2 && v <= 99 },
  { id: 't3', name: 'Grandes', icon: '💎', desc: '100 a 999', test: (v) => v >= 100 && v <= 999 },
  { id: 't4', name: 'Épicos', icon: '👑', desc: '1.000 o más', test: (v) => v >= 1000 },
];
const giftCard = (g, on, isGift) => `<button type="button" class="vt-cell ${on ? 'on' : ''}" data-pick="${esc(g.id)}" title="${esc(g.nameEn && g.nameEn !== g.name ? `${g.name} · ${g.nameEn}` : g.name)} · ID ${esc(g.id)}">
  <span class="vt-img">${g.image ? `<img src="${esc(imgUrl(g.image))}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('i'),{textContent:'${isGift ? '🎁' : '✨'}'}))">` : `<i>${isGift ? '🎁' : '✨'}</i>`}</span>
  <b>${esc(g.name || `#${g.id}`)}</b>${isGift ? `<small>🪙 ${nf.format(Number(g.value) || 0)}</small>` : ''}${g.mine ? '<em class="vt-mine" title="De tu cuenta o de tus directos">tuyo</em>' : ''}</button>`;

async function renderPicker() {
  const box = $('#ar-picker');
  if (!box) return;
  const p = draft.platform === 'any' ? 'tiktok' : draft.platform;
  if (!['gift', 'sticker'].includes(draft.trigger)) { box.innerHTML = ''; return; }
  const cat = catalogs[p] || (await loadCatalog(p));
  const isGift = draft.trigger === 'gift';
  const items = isGift ? cat.gifts || [] : cat.stickers || [];
  const chosen = new Set((isGift ? draft.gifts : draft.stickers).map(String));
  const q = pick.q.toLowerCase();
  const match = (g) => !q || `${g.name} ${g.nameEn || ''} ${g.id} ${g.value ?? ''}`.toLowerCase().includes(q);
  const sel = items.filter((g) => chosen.has(String(g.id)));
  const head = `<div class="vt-bar"><div class="mz-search-form"><span class="ic" data-icon="search" aria-hidden="true"></span><input id="ar-pick-q" placeholder="${isGift ? 'Busca por nombre (español o inglés), ID o valor' : 'Busca un sticker'}" value="${esc(pick.q)}" autocomplete="off"></div>
    ${isGift ? `<div class="seg vt-tiers">${[['all', 'Todos'], ...TIERS.map((t) => [t.id, `${t.icon} ${t.name}`])].map(([id, n]) => `<button type="button" data-tier="${id}" aria-pressed="${pick.price === id}">${n}</button>`).join('')}</div>` : `<label class="switch"><input type="checkbox" id="ar-any-sticker" ${!draft.stickers.length ? 'checked' : ''}><span></span> Cualquier sticker</label>`}</div>
    ${sel.length ? `<div class="vt-chosen"><span>Elegidos</span>${sel.map((g) => `<button type="button" class="vt-chip" data-pick="${esc(g.id)}">${g.image ? `<img src="${esc(imgUrl(g.image))}" alt="">` : ''}${esc(g.name)} ✕</button>`).join('')}</div>` : ''}`;
  let body;
  if (!items.length) {
    body = `<p class="hint vt-empty">${isGift ? 'Kick y Starvios no publican su lista de regalos: los que te manden en tus directos aparecen aquí. Mientras, escribe el nombre abajo.' : 'TikTok no deja descargar la lista de stickers de un canal: cada sticker queda guardado aquí la primera vez que alguien lo manda en tu directo. Mientras, deja «Cualquier sticker».'}</p>`;
  } else if (isGift) {
    const tiers = TIERS.filter((t) => pick.price === 'all' || pick.price === t.id);
    body = tiers.map((t) => {
      const gs = items.filter((g) => t.test(Number(g.value) || 0) && match(g));
      if (!gs.length) return '';
      const LIMIT = q ? 120 : 48;
      return `<section class="vt-shelf"><h6><span>${t.icon}</span>${t.name} <small>${t.desc} · ${gs.length}</small></h6><div class="vt-grid">${gs.slice(0, LIMIT).map((g) => giftCard(g, chosen.has(String(g.id)), true)).join('')}</div>${gs.length > LIMIT ? `<p class="hint">Y ${gs.length - LIMIT} más: búscalos por nombre.</p>` : ''}</section>`;
    }).join('') || '<p class="hint vt-empty">Nada con esa búsqueda.</p>';
  } else {
    body = `<div class="vt-grid">${items.filter(match).map((g) => giftCard(g, chosen.has(String(g.id)), false)).join('')}</div>`;
  }
  box.innerHTML = `${head}<div class="vt-shelves">${body}</div>
    ${isGift ? `<label class="field mt"><span>¿No está? Escribe el nombre como sale en tu directo (separados por coma)</span><input id="ar-giftnames" value="${esc((draft.giftNames || []).filter((n) => !items.some((g) => g.name === n)).join(', '))}" placeholder="Rosa, Quiéreme…"></label>` : ''}`;
  const qi = $('#ar-pick-q');
  if (qi) qi.addEventListener('input', (ev) => { pick.q = ev.target.value; const pos = ev.target.selectionStart; renderPicker().then(() => { const n = $('#ar-pick-q'); n.focus(); n.setSelectionRange(pos, pos); }); });
  renderSummary();
}

// ---------- Frase resumen y vista previa ----------
const PLAT_NAME = Object.fromEntries(PLATS);
function sentence() {
  const d = draft;
  const where = d.platform === 'any' ? 'en cualquier plataforma' : `en ${PLAT_NAME[d.platform]}`;
  const cat = catalogs[d.platform === 'any' ? 'tiktok' : d.platform] || {};
  const names = (ids, list) => ids.map((id) => list.find((g) => String(g.id) === String(id))?.name || id);
  const list = (arr) => (arr.length <= 2 ? arr.join(' o ') : `${arr.slice(0, 2).join(', ')} o ${arr.length - 2} más`);
  const what = {
    gift: d.gifts.length ? `mande <b>${esc(list(names(d.gifts, cat.gifts || [])))}</b>` : 'mande <i>(elige un regalo)</i>',
    coins: `mande un regalo de <b>${nf.format(Number(d.min) || 0)}</b> a <b>${d.max ? nf.format(d.max) : 'más'}</b> monedas`,
    sticker: d.stickers.length ? `mande el sticker <b>${esc(list(names(d.stickers, cat.stickers || [])))}</b>` : 'mande <b>cualquier sticker</b>',
    likesPerson: `llegue a <b>${nf.format(Number(d.every) || 100)}</b> likes (cada vez)`,
    likesTotal: `entre todos sumen <b>${nf.format(Number(d.every) || 1000)}</b> likes más`,
    follow: 'te siga', sub: 'se suscriba', share: 'comparta tu directo', join: 'llegue al directo', superfan: 'se vuelva superfan',
    keyword: `escriba <b>«${esc(String(d.keyword || '…').split(',')[0].trim())}»</b>`,
    liveStart: '', liveEnd: '',
  }[d.trigger];
  const sound = d.sound === 'none' ? 'sin sonido' : d.sound === 'file' ? `con <b>${esc(d.fileName || 'tu sonido')}</b>` : `con <b>${esc(SOUNDS[d.sound] || 'Campanita')}</b>`;
  const lead = d.trigger === 'liveStart' ? `Cuando empiece tu directo ${where}` : d.trigger === 'liveEnd' ? `Cuando termine tu directo ${where}` : `Cuando alguien ${where} ${what}`;
  return `${lead}, sale <b>${esc(d.name || TRIG[d.trigger]?.name || 'la alerta')}</b> ${sound}${d.instant ?? d.trigger === 'sticker' ? ', al instante' : ` durante <b>${d.fitSound ? 'lo que dure el sonido' : `${d.seconds || 5} s`}</b>`}${d.speak ? ' y Troya la lee' : ''}.`;
}
function previewEvent() {
  const d = draft;
  const p = d.platform === 'any' ? 'tiktok' : d.platform;
  const cat = catalogs[p] || {};
  const g = d.trigger === 'gift' ? (cat.gifts || []).find((x) => String(x.id) === String(d.gifts[0])) : null;
  const st = d.trigger === 'sticker' ? (cat.stickers || []).find((x) => !d.stickers.length || String(x.id) === String(d.stickers[0])) : null;
  const name = 'Rosalinda';
  const vars = { usuario: name, regalo: g?.name || 'Rosa', cantidad: 1, valor: g?.value ?? 1, likes: d.every || 100, sticker: 'un sticker', mensaje: String(d.keyword || 'hola').split(',')[0], plataforma: PLAT_NAME[p] || '' };
  const DEF = { gift: '{usuario} envió {regalo}', coins: '{usuario} envió {regalo}', likesPerson: '¡{usuario} lleva un montón de likes!', likesTotal: '¡Llegamos a más likes!', follow: '{usuario} te sigue', sub: '{usuario} se suscribió', share: '{usuario} compartió el directo', sticker: '{usuario}', join: '{usuario} llegó', superfan: '¡{usuario} es superfan!', keyword: '{usuario}: {mensaje}', liveStart: '¡Empezó el directo!', liveEnd: 'Gracias por acompañarme' };
  const title = String(d.text || DEF[d.trigger] || '{usuario}').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  const img = d.showImage === false ? '' : imgUrl(g?.image || st?.image || '');
  return { type: d.trigger === 'coins' ? 'gift' : d.trigger, custom: true, label: d.name || TRIG[d.trigger]?.name || 'Alerta', title, user: { name }, image: img, instant: d.instant ?? d.trigger === 'sticker', color: d.color || '', durationMs: 2600, extra: {} };
}
let prevTimer = null;
function renderSummary() {
  const el = $('#ar-sentence');
  if (el) el.innerHTML = sentence();
  clearTimeout(prevTimer);
  prevTimer = setTimeout(() => $('#ar-prev')?.contentWindow?.postMessage({ satronhoAlert: previewEvent() }, location.origin), 250);
}

function renderEditor() {
  const d = draft;
  const plat = d.platform;
  $('#ar-src').innerHTML = PLATS.map(([id, n]) => `<button type="button" class="ar-pill ${plat === id ? 'on' : ''}" data-src="${id}">${id === 'any' ? '<span class="ar-any">✳</span>' : `<span class="pl plogo" data-logo="${id}"></span>`}<span>${n}</span></button>`).join('');
  const GROUPS = [['Regalos y apoyo', ['gift', 'coins', 'sticker', 'sub', 'superfan']], ['Tu comunidad', ['follow', 'likesPerson', 'likesTotal', 'share', 'join', 'keyword']], ['Tu directo', ['liveStart', 'liveEnd']]];
  $('#ar-trigs').innerHTML = GROUPS.map(([g, ids]) => `<div class="ar-tgroup"><small>${g}</small><div>${ids.map((id) => {
    const t = TRIG[id];
    const dis = plat !== 'tiktok' && plat !== 'any' && ONLY_TIKTOK.includes(id);
    return `<button type="button" class="ar-tchip ${d.trigger === id ? 'on' : ''}" data-trig="${id}" ${dis ? 'disabled title="Solo TikTok lo avisa"' : `title="${esc(t.desc)}"`}><span>${t.icon}</span>${t.name}</button>`;
  }).join('')}</div></div>`).join('');
  const t = d.trigger;
  let opts = '';
  if (t === 'coins') opts = `<div class="two"><label class="field"><span>Desde (monedas)</span><input type="number" min="0" data-d="min" value="${d.min ?? 1}"></label><label class="field"><span>Hasta (vacío = sin límite)</span><input type="number" min="0" data-d="max" value="${d.max ?? ''}"></label></div>`;
  if (t === 'likesPerson' || t === 'likesTotal') opts = `<label class="field"><span>Cada cuántos likes ${t === 'likesPerson' ? 'de la misma persona' : 'entre todos'}</span><input type="number" min="1" data-d="every" value="${d.every ?? (t === 'likesPerson' ? 100 : 1000)}"></label>`;
  if (t === 'keyword') opts = `<label class="field"><span>Palabras o frases (separadas por coma)</span><input data-d="keyword" value="${esc(d.keyword || '')}" placeholder="saludos, buenas"></label>`;
  if (t === 'join') opts = '<p class="hint">⚠ En directos con mucha gente entra alguien cada segundo. Ponle una espera entre repeticiones (paso 2).</p>';
  $('#ar-opts').innerHTML = opts;
  renderPicker();

  const s = d.sound || 'campanita';
  $('#ar-look').innerHTML = `
    <div class="two"><label class="field"><span>Nombre (para ti)</span><input data-d="name" value="${esc(d.name || '')}" placeholder="${esc(TRIG[t]?.name || 'Alerta')}"></label>
      <label class="field"><span>Color</span><input type="color" data-d="color" value="${esc(d.color || '#ff5d8f')}"></label></div>
    <label class="field"><span>Texto en pantalla</span><input data-d="text" value="${esc(d.text || '')}" placeholder="{usuario} envió {regalo}"></label>
    <div class="ar-vars">${VARS.map((v) => `<button type="button" data-var="${v}">${v}</button>`).join('')}</div>
    <div class="two"><label class="field"><span>Segundos en pantalla</span><input type="number" min="1" max="60" data-d="seconds" value="${d.seconds ?? 5}" ${d.fitSound ? 'disabled' : ''}></label>
      <label class="field"><span>Espera entre repeticiones (s)</span><input type="number" min="0" max="600" data-d="cooldownSec" value="${d.cooldownSec || 0}"></label></div>
    <label class="switch"><input type="checkbox" data-d="showImage" ${d.showImage !== false ? 'checked' : ''}><span></span> Mostrar la imagen del regalo o sticker</label>
    <label class="switch"><input type="checkbox" data-d="instant" ${(d.instant ?? t === 'sticker') ? 'checked' : ''}><span></span> Al instante: salta sin esperar a que termine la anterior</label>`;
  $('#ar-sound').innerHTML = `
    <div class="ar-sounds">${Object.entries(SOUNDS).map(([id, n]) => `<button type="button" class="ar-snd ${s === id ? 'on' : ''}" data-snd="${id}">▶ ${esc(n)}</button>`).join('')}<button type="button" class="ar-snd ${s === 'file' ? 'on' : ''}" data-snd="file">📁 Mi sonido</button><button type="button" class="ar-snd ${s === 'none' ? 'on' : ''}" data-snd="none">🔇 Sin sonido</button></div>
    <div class="ar-file" ${s === 'file' ? '' : 'hidden'}><button type="button" class="btn small" id="ar-up">${d.fileName ? 'Cambiar sonido' : 'Subir sonido'}</button><small>${esc(d.fileName || 'MP3, WAV u OGG, hasta 10 MB')}</small>${d.file ? '<button type="button" class="btn small ghost" id="ar-play">▶ Escuchar</button>' : ''}<input type="file" id="ar-up-file" accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,.mp3,.wav,.ogg" hidden></div>
    <label class="field"><span>Volumen <b>${d.volume ?? 75} %</b></span><input type="range" min="0" max="100" step="5" data-d="volume" value="${d.volume ?? 75}"></label>
    <div class="two"><label class="field"><span>Cortar el sonido a los (s, 0 = completo)</span><input type="number" min="0" max="60" data-d="maxSeconds" value="${d.maxSeconds || 0}"></label>
      <div><label class="switch"><input type="checkbox" data-d="fitSound" ${d.fitSound ? 'checked' : ''}><span></span> Que dure lo que el sonido</label>
      <label class="switch"><input type="checkbox" data-d="speak" ${d.speak ? 'checked' : ''}><span></span> Troya la lee en voz alta</label></div></div>`;
  for (const b of $$('[data-excl]')) b.setAttribute('aria-pressed', String((d.exclusive !== false) === (b.dataset.excl === '1')));
  $('#ar-excl-hint').textContent = d.exclusive !== false ? 'Si ese evento tiene alerta de serie, se queda callada y sale solo esta.' : 'Sale esta y también la de serie, una detrás de otra.';
  renderSummary();
}

function readDraftField(el) {
  const k = el.dataset.d;
  let v = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? (el.value === '' ? '' : Number(el.value)) : el.value;
  if (k === 'max' && v === '') v = undefined;
  draft[k] = v;
  if (k === 'fitSound') return renderEditor();
  if (k === 'volume') el.closest('.field').querySelector('b').textContent = `${v} %`;
  renderSummary();
}

function validate() {
  const d = draft;
  if (d.trigger === 'gift') {
    const names = ($('#ar-giftnames')?.value || '').split(',').map((x) => x.trim()).filter(Boolean);
    const cat = catalogs[d.platform]?.gifts || [];
    d.giftNames = [...new Set([...d.gifts.map((id) => cat.find((g) => String(g.id) === String(id))?.name).filter(Boolean), ...names])];
    // Los nombres escritos también sirven para reconocer el regalo.
    d.gifts = [...new Set([...d.gifts, ...names])];
    if (!d.gifts.length) return 'Elige al menos un regalo.';
  }
  if (d.trigger === 'keyword' && !String(d.keyword || '').trim()) return 'Escribe al menos una palabra.';
  if (d.sound === 'file' && !d.file) return 'Sube tu sonido o elige uno de la lista.';
  if (!d.name) d.name = d.trigger === 'gift' ? (d.giftNames[0] || 'Regalo') : TRIG[d.trigger]?.name || 'Alerta';
  return '';
}

function saveDraft() {
  const err = validate();
  if (err) return toast(err);
  const list = [...rules()];
  const i = list.findIndex((r) => r.id === draft.id);
  if (i >= 0) list[i] = draft; else list.unshift(draft);
  ui.plat = draft.platform;
  const name = draft.name;
  saveRules(list);
  closeEditor();
  sayFor('troya', `Lista la alerta <b>${esc(name)}</b>. Pruébala con ▶.`, 5000, 'ok');
}

async function uploadSound(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return toast('El sonido pesa más de 10 MB');
  const res = await fetch(`/api/alert-rules/${encodeURIComponent(draft.id)}/sound`, { method: 'POST', headers: { 'Content-Type': file.type || 'audio/mpeg', 'X-File-Name': encodeURIComponent(file.name) }, body: file });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) return toast(data.error || 'No se pudo subir');
  draft.file = data.file;
  draft.fileName = data.fileName || file.name;
  draft.sound = 'file';
  renderEditor();
}

// ---------- Inicio ----------
export function initAlertRules(cfg) {
  config = cfg;
  if (!$('#ar-list')) return;
  loadCatalog('tiktok').then(renderList);
  renderList();

  $('#ar-plats').addEventListener('click', (ev) => { const b = ev.target.closest('[data-ar-plat]'); if (b) { ui.plat = b.dataset.arPlat; loadCatalog(ui.plat).then(renderList); renderList(); } });
  $('#ar-q').addEventListener('input', (ev) => { ui.q = ev.target.value; renderList(); });
  $('#ar-new').addEventListener('click', () => openEditor());
  $('#ar-import').addEventListener('click', async () => {
    const b = $('#ar-import');
    b.disabled = true;
    try {
      const r = await api('POST', '/api/gifts/tiktok/import');
      delete catalogs.tiktok;
      await loadCatalog('tiktok');
      sayFor('troya', r.live ? `Traje <b>${nf.format(r.count)}</b> regalos de tu LIVE, también los de comunidad y de tu región, con su nombre en tu idioma.` : `Traje <b>${nf.format(r.count)}</b> regalos de la lista general de TikTok. En LIVE salen también los de comunidad.`, 7000, 'ok');
      renderList();
    } catch (e) {
      sayFor('troya', esc(e.message), 9000, 'warn');
    } finally {
      b.disabled = false;
    }
  });

  $('#ar-list').addEventListener('click', (ev) => {
    if (ev.target.closest('[data-ar-new]')) return openEditor();
    const row = ev.target.closest('[data-ar]');
    if (!row) return;
    const list = [...rules()];
    const i = list.findIndex((r) => r.id === row.dataset.ar);
    if (i < 0) return;
    if (ev.target.closest('[data-ar-edit]')) return openEditor(list[i]);
    if (ev.target.closest('[data-ar-del]')) {
      if (!confirm(`¿Borrar la alerta «${list[i].name}»?`)) return;
      list.splice(i, 1);
      return saveRules(list);
    }
    if (ev.target.closest('[data-ar-test]')) return api('POST', '/api/alert-rules/test', { id: list[i].id }).then(() => sayFor('troya', `Mandé <b>${esc(list[i].name)}</b> al overlay.`, 3500, 'ok')).catch((e) => toast(e.message));
    const ex = ev.target.closest('[data-ar-excl]');
    if (ex) { list[i] = { ...list[i], exclusive: ex.dataset.arExcl === '1' }; return saveRules(list); }
  });
  $('#ar-list').addEventListener('change', (ev) => {
    const on = ev.target.closest('[data-ar-on]');
    if (!on) return;
    const list = [...rules()];
    const i = list.findIndex((r) => r.id === ev.target.closest('[data-ar]').dataset.ar);
    list[i] = { ...list[i], enabled: on.checked };
    saveRules(list);
  });

  const modal = $('#ar-modal');
  $('#ar-close').addEventListener('click', closeEditor);
  $('#ar-cancel').addEventListener('click', closeEditor);
  $('#ar-save').addEventListener('click', saveDraft);
  modal.addEventListener('click', (ev) => {
    if (ev.target === modal) return closeEditor();
    const src = ev.target.closest('[data-src]');
    if (src) {
      draft.platform = src.dataset.src;
      if (draft.platform !== 'tiktok' && draft.platform !== 'any' && ONLY_TIKTOK.includes(draft.trigger)) draft.trigger = 'gift';
      draft.gifts = [];
      draft.stickers = [];
      return renderEditor();
    }
    const tr = ev.target.closest('[data-trig]');
    if (tr && !tr.disabled) { draft.trigger = tr.dataset.trig; return renderEditor(); }
    const tier = ev.target.closest('[data-tier]');
    if (tier) { pick.price = tier.dataset.tier; return renderPicker(); }
    const snd = ev.target.closest('[data-snd]');
    if (snd) {
      draft.sound = snd.dataset.snd;
      if (draft.sound !== 'file' && draft.sound !== 'none') playAlertSound({ sound: draft.sound, volume: draft.volume ?? 75, maxSeconds: Number(draft.maxSeconds) || 0 });
      return renderEditor();
    }
    if (ev.target.closest('#ar-test-prev')) return renderSummary();
    const cell = ev.target.closest('[data-pick]');
    if (cell) {
      const key = draft.trigger === 'gift' ? 'gifts' : 'stickers';
      const id = cell.dataset.pick;
      const set = new Set(draft[key].map(String));
      if (set.has(id)) set.delete(id); else set.add(id);
      draft[key] = [...set];
      return renderPicker();
    }
    const v = ev.target.closest('[data-var]');
    if (v) { const inp = $('[data-d="text"]'); inp.value += (inp.value && !inp.value.endsWith(' ') ? ' ' : '') + v.dataset.var; draft.text = inp.value; return renderSummary(); }
    const ex = ev.target.closest('[data-excl]');
    if (ex && !ex.closest('#ar-list')) { draft.exclusive = ex.dataset.excl === '1'; return renderEditor(); }
    if (ev.target.closest('#ar-play') && draft.file) return playAlertSound({ sound: draft.sound, volume: draft.volume ?? 75, maxSeconds: Number(draft.maxSeconds) || 0, url: draft.sound === 'file' && draft.file ? `/alert-sounds/${draft.file}` : '' });
    if (ev.target.closest('#ar-up')) return $('#ar-up-file').click();
  });
  modal.addEventListener('input', (ev) => { const el = ev.target.closest('[data-d]'); if (el && el.type !== 'checkbox' && el.tagName !== 'SELECT') readDraftField(el); });
  modal.addEventListener('change', (ev) => {
    if (ev.target.id === 'ar-up-file') return uploadSound(ev.target.files[0]);
    if (ev.target.id === 'ar-any-sticker') { if (ev.target.checked) draft.stickers = []; return renderPicker(); }
    const el = ev.target.closest('[data-d]');
    if (el && (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'color')) readDraftField(el);
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !modal.hidden) closeEditor(); });
}
