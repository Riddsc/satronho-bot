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
const PRICE = [['all', 'Todos los valores'], ['1', '1'], ['2-99', '2 a 99'], ['100-999', '100 a 999'], ['1000-', '1.000 o más']];
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
  if (b) b.textContent = n ? `${nf.format(n)} en tu PC` : 'aún no';
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
  $('#ar-modal-title').textContent = rule ? 'Editar alerta' : 'Nueva alerta';
  renderEditor();
}
function closeEditor() {
  $('#ar-modal').hidden = true;
  draft = null;
}

function inPrice(v) {
  if (pick.price === 'all') return true;
  const [a, b] = pick.price.split('-');
  if (!b && pick.price.endsWith('-')) return v >= Number(a);
  if (!pick.price.includes('-')) return v === Number(a);
  return v >= Number(a) && v <= Number(b);
}

async function renderPicker() {
  const box = $('#ar-picker');
  if (!box) return;
  const p = draft.platform;
  if (!['gift', 'sticker'].includes(draft.trigger)) { box.innerHTML = ''; return; }
  const cat = catalogs[p] || (await loadCatalog(p));
  const isGift = draft.trigger === 'gift';
  const items = isGift ? cat.gifts || [] : cat.stickers || [];
  const chosen = new Set((isGift ? draft.gifts : draft.stickers).map(String));
  const q = pick.q.toLowerCase();
  const shown = items.filter((g) => (!q || `${g.name} ${g.id} ${g.value ?? ''}`.toLowerCase().includes(q)) && (!isGift || inPrice(Number(g.value) || 0)));
  const head = isGift
    ? `<div class="ar-pick-bar"><div class="mz-search-form"><span class="ic" data-icon="search" aria-hidden="true"></span><input id="ar-pick-q" placeholder="Nombre, ID o valor" value="${esc(pick.q)}" autocomplete="off"></div><select id="ar-pick-price">${PRICE.map(([id, n]) => `<option value="${id}" ${pick.price === id ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`
    : `<div class="ar-pick-bar"><label class="switch"><input type="checkbox" id="ar-any-sticker" ${!draft.stickers.length ? 'checked' : ''}><span></span> Cualquier sticker</label></div>`;
  const empty = isGift
    ? (p === 'tiktok' ? 'Aún no tengo tus regalos. Pulsa «Importar regalos de TikTok» o conéctate en LIVE y se traen solos.' : 'Kick y Starvios no publican su lista de regalos: los que te manden en tus directos aparecerán aquí. Mientras, puedes escribir el nombre del regalo abajo.')
    : 'Los stickers que te manden en tus directos aparecerán aquí para elegirlos uno a uno.';
  box.innerHTML = `${head}<div class="ar-grid">${shown.length ? shown.slice(0, 400).map((g) => `<button type="button" class="ar-cell ${chosen.has(String(g.id)) ? 'on' : ''}" data-pick="${esc(g.id)}" title="ID ${esc(g.id)}">
      ${g.image ? `<img src="${esc(imgUrl(g.image))}" alt="" loading="lazy">` : '<span class="ar-noimg">🎁</span>'}
      <b>${esc(g.name || `#${g.id}`)}</b>${isGift ? `<small>🪙 ${nf.format(Number(g.value) || 0)}</small>` : ''}${g.seen ? `<i class="ar-seen" title="Te lo han mandado ${g.seen} veces">${g.seen}</i>` : ''}</button>`).join('') : `<p class="hint ar-grid-empty">${items.length ? 'Nada con ese filtro.' : empty}</p>`}</div>
    ${isGift ? `<label class="field mt"><span>O escribe nombres de regalos (separados por coma)</span><input id="ar-giftnames" value="${esc((draft.giftNames || []).filter((n) => !items.some((g) => g.name === n)).join(', '))}" placeholder="Rosa, Quiéreme…"></label>` : ''}
    <p class="hint">${chosen.size ? `Elegidos: <b>${chosen.size}</b>` : isGift ? 'Toca uno o varios regalos.' : ''}</p>`;
  const qi = $('#ar-pick-q');
  if (qi) qi.addEventListener('input', (ev) => { pick.q = ev.target.value; const pos = ev.target.selectionStart; renderPicker().then(() => { const n = $('#ar-pick-q'); n.focus(); n.setSelectionRange(pos, pos); }); });
}

function renderEditor() {
  const d = draft;
  const plat = d.platform;
  $('#ar-src').innerHTML = PLATS.map(([id, n]) => `<button type="button" class="ar-pcard ${plat === id ? 'on' : ''}" data-src="${id}">${id === 'any' ? '✳' : id === 'kick' ? '<span class="pl plogo" data-logo="kick"></span>' : `<span class="pl plogo" data-logo="${id}"></span>`}<span>${n}</span></button>`).join('');
  $('#ar-trigs').innerHTML = Object.entries(TRIG).map(([id, t]) => {
    const dis = plat !== 'tiktok' && plat !== 'any' && ONLY_TIKTOK.includes(id);
    return `<button type="button" class="ar-tcard ${d.trigger === id ? 'on' : ''}" data-trig="${id}" ${dis ? 'disabled title="Solo TikTok lo avisa"' : ''}><span>${t.icon}</span><b>${t.name}</b></button>`;
  }).join('');
  const t = d.trigger;
  let opts = '';
  if (t === 'coins') opts = `<div class="two"><label class="field"><span>Desde (monedas)</span><input type="number" min="0" data-d="min" value="${d.min ?? 1}"></label><label class="field"><span>Hasta (vacío = sin límite)</span><input type="number" min="0" data-d="max" value="${d.max ?? ''}"></label></div>`;
  if (t === 'likesPerson' || t === 'likesTotal') opts = `<label class="field"><span>Cada cuántos likes ${t === 'likesPerson' ? 'de la misma persona' : 'entre todos'}</span><input type="number" min="1" data-d="every" value="${d.every ?? (t === 'likesPerson' ? 100 : 1000)}"></label>`;
  if (t === 'keyword') opts = `<label class="field"><span>Palabras o frases (separadas por coma)</span><input data-d="keyword" value="${esc(d.keyword || '')}" placeholder="saludos, buenas"></label>`;
  if (t === 'join') opts = '<p class="hint">⚠ En directos con mucha gente entra alguien cada segundo. Ponle una espera entre repeticiones.</p>';
  $('#ar-opts').innerHTML = opts;
  renderPicker();

  const s = d.sound || 'campanita';
  $('#ar-side').innerHTML = `
    <label class="field"><span>Nombre de la alerta</span><input data-d="name" value="${esc(d.name || '')}" placeholder="${esc(TRIG[t]?.name || 'Alerta')}"></label>
    <label class="field"><span>Sonido</span><span class="row tight"><select data-d="sound">${Object.entries(SOUNDS).map(([id, n]) => `<option value="${id}" ${s === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}<option value="file" ${s === 'file' ? 'selected' : ''}>Mi sonido…</option><option value="none" ${s === 'none' ? 'selected' : ''}>Sin sonido</option></select><button type="button" class="btn small" id="ar-play" title="Escuchar">▶</button></span></label>
    <div class="ar-file" ${s === 'file' ? '' : 'hidden'}><button type="button" class="btn small" id="ar-up">${d.fileName ? 'Cambiar sonido' : 'Subir sonido'}</button><small>${esc(d.fileName || 'MP3, WAV u OGG, hasta 10 MB')}</small><input type="file" id="ar-up-file" accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,.mp3,.wav,.ogg" hidden></div>
    <label class="field"><span>Volumen <b>${d.volume ?? 75} %</b></span><input type="range" min="0" max="100" step="5" data-d="volume" value="${d.volume ?? 75}"></label>
    <div class="two"><label class="field"><span>Segundos en pantalla</span><input type="number" min="1" max="60" data-d="seconds" value="${d.seconds ?? 5}" ${d.fitSound ? 'disabled' : ''}></label>
      <label class="field"><span>Cortar el sonido a los (s)</span><input type="number" min="0" max="60" data-d="maxSeconds" value="${d.maxSeconds || 0}"></label></div>
    <label class="switch"><input type="checkbox" data-d="fitSound" ${d.fitSound ? 'checked' : ''}><span></span> Que dure lo que dura el sonido</label>
    <label class="field"><span>Texto en pantalla</span><input data-d="text" value="${esc(d.text || '')}" placeholder="{usuario} envió {regalo}"></label>
    <div class="ar-vars">${VARS.map((v) => `<button type="button" data-var="${v}">${v}</button>`).join('')}</div>
    <div class="two"><label class="switch"><input type="checkbox" data-d="showImage" ${d.showImage !== false ? 'checked' : ''}><span></span> Mostrar su imagen</label>
      <label class="switch"><input type="checkbox" data-d="speak" ${d.speak ? 'checked' : ''}><span></span> Troya la lee</label></div>
    <label class="switch"><input type="checkbox" data-d="instant" ${(d.instant ?? t === 'sticker') ? 'checked' : ''}><span></span> Al instante (salta sin esperar turno)</label>
    <div class="two"><label class="field"><span>Color</span><input type="color" data-d="color" value="${esc(d.color || '#ff5d8f')}"></label>
      <label class="field"><span>Espera entre repeticiones (s)</span><input type="number" min="0" max="600" data-d="cooldownSec" value="${d.cooldownSec || 0}"></label></div>
    <span class="field-label">Si ese evento también tiene alerta de serie</span>
    <div class="seg ar-excl-big"><button type="button" data-excl="1" aria-pressed="${d.exclusive !== false}">Solo la suya</button><button type="button" data-excl="0" aria-pressed="${d.exclusive === false}">Las dos</button></div>
    <p class="hint">${d.exclusive !== false ? 'Cuando suene esta, la de serie se queda callada.' : 'Suenan las dos, una después de la otra.'}</p>`;
}

function readDraftField(el) {
  const k = el.dataset.d;
  let v = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? (el.value === '' ? '' : Number(el.value)) : el.value;
  if (k === 'max' && v === '') v = undefined;
  draft[k] = v;
  if (k === 'sound' || k === 'fitSound') renderEditor();
  if (k === 'volume') el.closest('.field').querySelector('b').textContent = `${v} %`;
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
      sayFor('troya', `Traje <b>${nf.format(r.count)}</b> regalos de tu TikTok, con su imagen y su valor.`, 6000, 'ok');
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
    const cell = ev.target.closest('[data-pick]');
    if (cell) {
      const key = draft.trigger === 'gift' ? 'gifts' : 'stickers';
      const id = cell.dataset.pick;
      const set = new Set(draft[key].map(String));
      if (set.has(id)) set.delete(id); else set.add(id);
      draft[key] = [...set];
      cell.classList.toggle('on');
      return;
    }
    const v = ev.target.closest('[data-var]');
    if (v) { const inp = $('[data-d="text"]'); inp.value += (inp.value && !inp.value.endsWith(' ') ? ' ' : '') + v.dataset.var; draft.text = inp.value; return; }
    const ex = ev.target.closest('[data-excl]');
    if (ex) { draft.exclusive = ex.dataset.excl === '1'; return renderEditor(); }
    if (ev.target.closest('#ar-play')) return playAlertSound({ sound: draft.sound, volume: draft.volume ?? 75, maxSeconds: Number(draft.maxSeconds) || 0, url: draft.sound === 'file' && draft.file ? `/alert-sounds/${draft.file}` : '' });
    if (ev.target.closest('#ar-up')) return $('#ar-up-file').click();
  });
  modal.addEventListener('input', (ev) => { const el = ev.target.closest('[data-d]'); if (el && el.type !== 'checkbox' && el.tagName !== 'SELECT') readDraftField(el); });
  modal.addEventListener('change', (ev) => {
    if (ev.target.id === 'ar-up-file') return uploadSound(ev.target.files[0]);
    if (ev.target.id === 'ar-pick-price') { pick.price = ev.target.value; return renderPicker(); }
    if (ev.target.id === 'ar-any-sticker') { if (ev.target.checked) draft.stickers = []; return renderPicker(); }
    const el = ev.target.closest('[data-d]');
    if (el && (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'color')) readDraftField(el);
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !modal.hidden) closeEditor(); });
}
