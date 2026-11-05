// Sonidos (Ñoño): la biblioteca de Satronho y «Mis sonidos».
//  - Biblioteca: cientos de sonidos libres (Kenney, CC0) + los hechos por
//    código + los tuyos, con búsqueda, categorías, favoritos y recientes.
//  - Memes: buscador de una página pública de sonidos de memes; «Añadir» lo
//    baja a tu PC. También pegar varios enlaces de una vez.
//  - Frases: frases habladas con tus voces (listas para crear de una).
//  - Mis sonidos: subir archivos, renombrar, borrar, packs para compartir.
//  - Comando del chat: «!sonido boing» para tu público (apagado de serie).
// También exporta openSoundPicker(): la misma biblioteca para elegir el
// sonido de una alerta.

import { $, $$, api, esc, toast, saveConfig } from './util.js';
import { SOUNDS, SYNTH_LIB, playAlertSound, stopAlertSound } from '/overlays/sounds.js';
import { guideToast } from './guides.js';
import { onPageChange } from './nav.js';

const CATS = [
  ['graciosos', 'Graciosos', '😂'], ['memes', 'Memes', '🐸'], ['alertas', 'Alertas', '🔔'], ['videojuegos', 'Videojuegos', '🎮'],
  ['sospechosos', 'Sospechosos', '🕵️'], ['dramaticos', 'Dramáticos', '🎭'], ['celebracion', 'Celebración', '🎉'], ['fallos', 'Fallos', '💀'],
  ['golpes', 'Golpes', '👊'], ['voces', 'Voces', '🗣️'], ['frases', 'Frases', '💬'], ['groseros', 'Groseros', '🤬'], ['objetos', 'Objetos', '📦'], ['mis', 'Mis archivos', '📁'],
];
const CAT_NAME = Object.fromEntries(CATS.map(([id, n, ic]) => [id, `${ic} ${n}`]));

let config;
let lib = { builtin: [], mine: [], phrases: [] };
let loaded = false;
const ui = { cat: 'all', q: '', memeQ: '', memePage: 1, memes: [], memeMore: false, memeBusy: false };
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[«»"¡!¿?]/g, '').trim();
const fmt = (d) => (d ? `${d < 10 ? d.toFixed(1) : Math.round(d)} s` : '');
const sounds = () => ((config ??= {}).sounds ??= { favorites: [], recent: [], chat: {} });

// Todo en una lista con el mismo formato: { ref, name, cat, tags, dur, by }.
function all() {
  const out = [];
  for (const x of lib.mine) out.push({ ref: `m:${x.id}`, name: x.name, cat: x.cat || 'mis', tags: x.tags || '', by: 'Tuyo', mine: x });
  for (const x of SYNTH_LIB) out.push({ ref: x.id, name: x.name, cat: x.cat, tags: x.tags, by: 'Satronho' });
  for (const x of lib.builtin) out.push({ ref: `k:${x.id}`, name: x.name, cat: x.cat, tags: x.tags, dur: x.dur, by: 'Kenney · CC0' });
  return sounds().hideRude ? out.filter((x) => x.cat !== 'groseros') : out;
}
export function soundLabel(ref) {
  if (!ref || ref === 'campanita') return SOUNDS.campanita;
  if (ref === 'none') return 'Sin sonido';
  if (ref === 'file') return 'Mi sonido';
  return all().find((x) => x.ref === ref)?.name || SOUNDS[ref] || 'Sonido';
}
export async function loadSounds(force = false) {
  if (loaded && !force) return lib;
  try { lib = await api('GET', '/api/sounds'); loaded = true; } catch { /* sin servidor todavía */ }
  return lib;
}

function play(ref, volume = 75) {
  stopAlertSound();
  playAlertSound({ sound: ref, volume });
}
function remember(ref) {
  const s = sounds();
  s.recent = [ref, ...(s.recent || []).filter((x) => x !== ref)].slice(0, 24);
  saveConfig({ sounds: { recent: s.recent } });
}
function toggleFav(ref) {
  const s = sounds();
  const fav = new Set(s.favorites || []);
  if (fav.has(ref)) fav.delete(ref); else fav.add(ref);
  s.favorites = [...fav];
  saveConfig({ sounds: { favorites: s.favorites } });
}

// ---------- Lista de la biblioteca (página y selector) ----------
function filtered() {
  const s = sounds();
  let list = all();
  if (ui.cat === 'fav') list = list.filter((x) => (s.favorites || []).includes(x.ref));
  else if (ui.cat === 'recent') list = (s.recent || []).map((r) => list.find((x) => x.ref === r)).filter(Boolean);
  else if (ui.cat !== 'all') list = list.filter((x) => x.cat === ui.cat);
  const q = norm(ui.q);
  if (q) {
    const words = q.split(/\s+/);
    list = list.filter((x) => { const hay = norm(`${x.name} ${x.tags} ${CAT_NAME[x.cat] || ''}`); return words.every((w) => hay.includes(w)); });
  }
  return list;
}
function catsBar(prefix) {
  const list = all();
  const count = (id) => list.filter((x) => x.cat === id).length;
  const s = sounds();
  const chips = [['all', `Todos <small>${list.length}</small>`], ['fav', `★ Favoritos <small>${(s.favorites || []).length}</small>`], ['recent', '🕘 Recientes'],
    ...CATS.filter(([id]) => count(id)).map(([id, n, ic]) => [id, `${ic} ${n} <small>${count(id)}</small>`])];
  return `<div class="snd-cats" data-${prefix}-cats>${chips.map(([id, html]) => `<button type="button" data-scat="${id}" aria-pressed="${ui.cat === id}">${html}</button>`).join('')}</div>`;
}
function rows(list, pickMode, current) {
  const fav = new Set(sounds().favorites || []);
  if (!list.length) return `<p class="hint snd-empty">${ui.cat === 'fav' ? 'Marca con ★ los que más uses y quedan aquí.' : ui.cat === 'recent' ? 'Los que pruebes o elijas aparecen aquí.' : 'Nada con esa búsqueda. Prueba en la pestaña «Memes».'}</p>`;
  return list.slice(0, 600).map((x) => `<div class="snd-row ${current === x.ref ? 'on' : ''}" data-ref="${esc(x.ref)}">
    <button type="button" class="snd-play" data-splay="${esc(x.ref)}" title="Escuchar" aria-label="Escuchar ${esc(x.name)}">▶</button>
    <div class="snd-main"><b>${esc(x.name)}</b><small>${esc(CAT_NAME[x.cat] || x.cat)}${x.dur ? ` · ${fmt(x.dur)}` : ''} · ${esc(x.by)}</small></div>
    <button type="button" class="snd-fav" data-sfav="${esc(x.ref)}" aria-pressed="${fav.has(x.ref)}" title="${fav.has(x.ref) ? 'Quitar de favoritos' : 'Favorito'}">${fav.has(x.ref) ? '★' : '☆'}</button>
    ${pickMode ? `<button type="button" class="snd-pick ${current === x.ref ? 'on' : ''}" data-spick="${esc(x.ref)}">${current === x.ref ? '✓ Elegido' : 'Elegir'}</button>` : ''}
  </div>`).join('') + (list.length > 600 ? `<p class="hint">Y ${list.length - 600} más: afina la búsqueda.</p>` : '');
}
function renderLibrary() {
  const box = $('#snd-lib');
  if (!box) return;
  box.innerHTML = `<div class="snd-bar"><label class="snd-find"><span>⌕</span><input id="snd-q" placeholder="Busca: risa, sus, fail, golpe, victoria, moneda…" value="${esc(ui.q)}" autocomplete="off"></label>
      <label class="switch"><input type="checkbox" id="snd-hide-rude" ${sounds().hideRude ? 'checked' : ''}><span></span> <em class="sw-t">Esconder groseros</em></label></div>
    ${catsBar('lib')}<div class="snd-list" id="snd-list">${rows(filtered(), false)}</div>`;
}
function refreshList() {
  const l = $('#snd-list');
  if (l) l.innerHTML = rows(filtered(), false);
  for (const bar of $$('[data-lib-cats]')) bar.outerHTML = catsBar('lib');
  if ($('#sndp-modal') && !$('#sndp-modal').hidden) renderPickerBody();
}

// ---------- Memes ----------
async function searchMemes(more = false) {
  if (ui.memeBusy) return;
  ui.memeBusy = true;
  if (!more) { ui.memePage = 1; ui.memes = []; }
  renderMemes();
  try {
    const r = await api('POST', '/api/sounds/memes/search', { q: ui.memeQ, page: ui.memePage });
    ui.memes = more ? [...ui.memes, ...r.results] : r.results;
    ui.memeMore = r.more;
    ui.memePage += 1;
  } catch (e) {
    toast(`No pude buscar memes: ${e.message}`);
  } finally {
    ui.memeBusy = false;
    renderMemes();
  }
}
function renderMemes() {
  const box = $('#snd-memes-list');
  if (!box) return;
  const have = new Set(lib.mine.map((x) => x.source));
  box.innerHTML = ui.memes.length
    ? ui.memes.map((m, i) => `<div class="snd-row"><button type="button" class="snd-play" data-mplay="${i}" title="Escuchar">▶</button>
        <div class="snd-main"><b>${esc(m.title)}</b><small>${esc(new URL(m.url).hostname.replace(/^www\./, ''))}</small></div>
        ${have.has(m.url) || have.has(m.page) ? '<span class="snd-added">✓ En tu biblioteca</span>' : `<button type="button" class="snd-pick" data-madd="${i}">+ Añadir</button>`}</div>`).join('')
      + (ui.memeMore ? `<button type="button" class="btn ghost small mt" id="snd-memes-more" ${ui.memeBusy ? 'disabled' : ''}>Ver más</button>` : '')
    : `<p class="hint snd-empty">${ui.memeBusy ? 'Buscando…' : 'Escribe qué buscas (rosalía, bruh, sus, risa…) o toca «🔥 Lo más sonado».'}</p>`;
}
let memeAudio = null;
function playUrl(url) {
  stopAlertSound();
  memeAudio?.pause();
  memeAudio = new Audio(url);
  memeAudio.volume = 0.8;
  memeAudio.play().catch(() => toast('No se pudo reproducir: revisa tu internet'));
}

// ---------- Frases ----------
function renderPhrases() {
  const box = $('#snd-phrases');
  if (!box) return;
  const made = new Set(lib.mine.filter((x) => x.cat && /voz:/.test(x.source || '')).map((x) => norm(x.name)));
  const groups = {};
  for (const p of lib.phrases) if (!(sounds().hideRude && p.cat === 'groseros')) (groups[p.cat] ??= []).push(p);
  box.innerHTML = `<form class="snd-own" id="snd-own-phrase"><input name="text" maxlength="200" placeholder="Escribe tu propia frase: «¡Qué chimba de regalo!»" required><select name="cat">${['frases', 'graciosos', 'alertas', 'sospechosos', 'celebracion', 'fallos', 'groseros'].map((c) => `<option value="${c}">${esc(CAT_NAME[c])}</option>`).join('')}</select><button class="btn primary small">Crear con mi voz</button></form>
    <p class="hint">Se crean con tu voz principal de <b>Voz del chat</b>; si es de Windows, uso una de tu PC o una en línea. Marca las que quieras y créalas de una.</p>
    <div class="row wrap snd-phr-act"><button type="button" class="btn small" data-phr-all>Marcar todas</button><button type="button" class="btn small ghost" data-phr-none>Ninguna</button><button type="button" class="btn small primary" id="snd-phr-make">Crear las marcadas</button><span class="hint" id="snd-phr-state"></span></div>
    ${Object.entries(groups).map(([cat, list]) => `<section class="snd-phr-group"><h6>${esc(CAT_NAME[cat] || cat)}</h6><div class="snd-phr-grid">${list.map((p) => {
      const done = made.has(norm(`«${p.text}»`));
      return `<label class="snd-phr ${done ? 'done' : ''}"><input type="checkbox" data-phr="${esc(p.text)}" data-phr-cat="${esc(p.cat)}" ${done ? 'disabled' : ''}><span>${esc(p.text)}</span>${done ? '<i>✓</i>' : ''}</label>`;
    }).join('')}</div></section>`).join('')}`;
}

// ---------- Mis sonidos ----------
function renderMine() {
  const box = $('#snd-mine');
  if (!box) return;
  box.innerHTML = `<div class="snd-drop" id="snd-drop"><b>Suelta aquí tus sonidos</b><span>o</span><button type="button" class="btn small primary" id="snd-up-btn">Elegir archivos</button><small>MP3, WAV, OGG o M4A · hasta 10 MB cada uno</small><input type="file" id="snd-up" accept="audio/*,.mp3,.wav,.ogg,.m4a" multiple hidden></div>
    <div class="row wrap snd-pack"><a class="btn small" href="/api/sounds/pack" download>⬇ Exportar mis sonidos (pack)</a><button type="button" class="btn small ghost" id="snd-pack-btn">⬆ Importar un pack</button><input type="file" id="snd-pack" accept=".satronho-sonidos,application/json" hidden><span class="hint">Así se los pasas a tu pareja o a otro streamer: lo importan y listo.</span></div>
    <div class="snd-list">${lib.mine.length ? lib.mine.map((x) => `<div class="snd-row" data-mine="${esc(x.id)}">
      <button type="button" class="snd-play" data-splay="m:${esc(x.id)}" title="Escuchar">▶</button>
      <div class="snd-main"><input class="snd-name" data-mname value="${esc(x.name)}" maxlength="60" aria-label="Nombre"><small><select data-mcat aria-label="Categoría">${CATS.map(([id, n]) => `<option value="${id}" ${x.cat === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select> <input class="snd-tags" data-mtags value="${esc(x.tags || '')}" placeholder="etiquetas para buscarlo" maxlength="120"></small></div>
      <button type="button" class="btn small ghost danger" data-mdel title="Borrar">✕</button></div>`).join('') : '<p class="hint snd-empty">Aún no tienes sonidos propios. Súbelos aquí, búscalos en «Memes» o crea frases.</p>'}</div>`;
}
async function uploadFiles(files) {
  let n = 0;
  for (const f of [...files].slice(0, 50)) {
    const type = f.type || ({ mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4' }[f.name.split('.').pop().toLowerCase()] || '');
    try {
      const res = await fetch('/api/sounds/upload', { method: 'POST', headers: { 'Content-Type': type, 'X-File-Name': encodeURIComponent(f.name) }, body: f });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      n += 1;
    } catch (e) { toast(`${f.name}: ${e.message}`); }
  }
  if (n) guideToast('nono', `${n} ${n === 1 ? 'sonido agregado' : 'sonidos agregados'} a tu biblioteca.`);
}

// ---------- Comando del chat ----------
function renderChat() {
  const box = $('#snd-chat');
  if (!box) return;
  const c = { enabled: false, command: 'sonido', cooldownSec: 15, userCooldownSec: 60, who: 'all', volume: 70, onlyMine: false, ...(sounds().chat || {}) };
  const who = [['all', 'Todos'], ['followers', 'Quienes te siguen'], ['subs', 'Suscriptores'], ['team', 'Tu equipo (TikTok)'], ['mods', 'Solo moderadores']];
  box.innerHTML = `<label class="switch"><input type="checkbox" data-sc="enabled" ${c.enabled ? 'checked' : ''}><span></span> <em class="sw-t">Tu público puede lanzar sonidos desde el chat</em></label>
    <div class="snd-chat-grid" ${c.enabled ? '' : 'data-off'}>
      <label class="field"><span>Comando</span><span class="ove-cmd">!<input data-sc="command" value="${esc(c.command)}" maxlength="20"></span></label>
      <label class="field"><span>Quién puede</span><select data-sc="who">${who.map(([v, n]) => `<option value="${v}" ${c.who === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field"><span>Espera entre sonidos (s)</span><input type="number" min="0" max="600" data-sc="cooldownSec" value="${c.cooldownSec}"></label>
      <label class="field"><span>Espera por persona (s)</span><input type="number" min="0" max="3600" data-sc="userCooldownSec" value="${c.userCooldownSec}"></label>
      <label class="field"><span>Volumen <b>${c.volume} %</b></span><input type="range" min="5" max="100" data-sc="volume" value="${c.volume}"></label>
      <label class="switch"><input type="checkbox" data-sc="onlyMine" ${c.onlyMine ? 'checked' : ''}><span></span> <em class="sw-t">Solo «Mis sonidos» (no la biblioteca completa)</em></label>
    </div>
    <p class="hint">Ejemplo: <code>!${esc(c.command)} boing</code> o <code>!${esc(c.command)} trombón triste</code>. Busca por nombre o etiqueta. Tú y tus moderadores siempre pueden. Suena en el overlay de alertas o, si no lo tienes abierto, en la app.</p>`;
}

// ---------- Selector (para alertas) ----------
// Pestañas: 🔥 Populares (memes del momento) · 🔎 Memes (buscar) ·
// ⭐ Mis sonidos · 🎛 Básicos (los incluidos). «Elegir» en un meme lo baja
// a tu PC y lo deja elegido en un solo paso.
// Populares y Buscar memes tienen cada una su propio estado: lo que escribes
// o buscas en una no afecta a la otra, y una búsqueda lenta en una no deja
// a la otra esperando. «draft» guarda lo escrito aunque no pulses Buscar.
const memeTab = () => ({ results: [], busy: false, page: 1, more: false, err: '', loadedFor: null, seq: 0 });
const picker = { current: '', cb: null, tab: 'populares', q: '', draft: '', tabs: { populares: memeTab(), memes: memeTab() } };
const tabState = (t = picker.tab) => picker.tabs[t];
const PICK_TABS = [['populares', '🔥 Populares'], ['memes', '🔎 Buscar memes'], ['mios', '⭐ Mis sonidos'], ['basicos', '🎛 Básicos']];
function memeRows(list, pickMode) {
  const have = new Map(lib.mine.map((x) => [x.source, x]));
  return list.map((m, i) => {
    const mine = have.get(m.url) || have.get(m.page);
    return `<div class="snd-row ${mine && picker.current === `m:${mine.id}` ? 'on' : ''}"><button type="button" class="snd-play" data-mplay="${i}" title="Escuchar" aria-label="Escuchar ${esc(m.title)}">▶</button>
      <div class="snd-main"><b>${esc(m.title)}</b><small>${mine ? '✓ En tu biblioteca' : 'Meme · se descarga al elegirlo'}</small></div><span></span>
      ${pickMode ? `<button type="button" class="snd-pick" data-mpick="${i}">${mine && picker.current === `m:${mine.id}` ? 'Elegido' : 'Elegir'}</button>` : (mine ? '<span class="snd-added">✓ Añadido</span>' : `<button type="button" class="snd-pick" data-madd="${i}">+ Añadir</button>`)}</div>`;
  }).join('');
}
async function pickerSearch(more = false, tab = picker.tab) {
  const st = tabState(tab);
  if (!st || st.busy) return;
  const q = tab === 'populares' ? '' : picker.q;
  const my = ++st.seq;
  st.busy = true;
  st.err = '';
  if (!more) { st.page = 1; st.results = []; }
  renderPickerBody();
  try {
    const r = await api('POST', '/api/sounds/memes/search', { q, page: st.page });
    if (my !== st.seq) return; // llegó tarde: ya se pidió otra cosa en esta pestaña
    st.results = more ? [...st.results, ...r.results] : r.results;
    st.more = r.more;
    st.page += 1;
    st.loadedFor = `${tab}|${q}`;
  } catch (e) {
    if (my === st.seq) st.err = e.message;
  } finally {
    if (my === st.seq) st.busy = false;
    renderPickerBody();
  }
}
function renderPickerBody() {
  const m = $('#sndp-modal');
  if (!m) return;
  for (const t of $$('[data-ptab]', m)) t.setAttribute('aria-selected', String(t.dataset.ptab === picker.tab));
  const top = $('#sndp-top', m);
  const list = $('#sndp-list', m);
  if (picker.tab === 'populares' || picker.tab === 'memes') {
    const st = tabState();
    const isMemes = picker.tab === 'memes';
    // El cuadro de búsqueda solo se vuelve a dibujar al cambiar de pestaña,
    // así no se pierde lo que estás escribiendo.
    if (top.dataset.for !== picker.tab) {
      top.dataset.for = picker.tab;
      top.innerHTML = isMemes
        ? `<form class="sndp-search" id="sndp-memeform"><label class="snd-find"><span>⌕</span><input id="sndp-mq" value="${esc(picker.draft)}" placeholder="rosalía, bruh, sus, risa, se fue, gemido…" autocomplete="off"></label><button class="snd-pick big">Buscar</button></form>`
        : '<p class="sndp-note">Los memes que más suenan ahora. ▶ para escuchar, «Elegir» y listo.</p>';
    }
    if (st.busy && !st.results.length) list.innerHTML = `<p class="snd-empty"><i class="spf-spin"></i> ${isMemes ? `Buscando «${esc(picker.q)}»…` : 'Cargando los memes del momento…'}</p>`;
    else if (st.err) list.innerHTML = `<p class="snd-empty sndp-err">${esc(st.err)}<br><button type="button" class="snd-pick" data-pretry>Intentar de nuevo</button></p>`;
    else if (!st.results.length) list.innerHTML = `<p class="snd-empty">${isMemes ? (st.loadedFor ? 'Nada con esa búsqueda. Prueba con otra palabra.' : 'Escribe qué buscas y pulsa «Buscar».') : 'Cargando…'}</p>`;
    else list.innerHTML = memeRows(st.results, true) + (st.more ? `<button type="button" class="snd-more" data-pmore ${st.busy ? 'disabled' : ''}>${st.busy ? 'Cargando…' : 'Ver más'}</button>` : '');
    if (!isMemes && st.loadedFor !== 'populares|' && !st.busy && !st.err) pickerSearch(false, 'populares');
    return;
  }
  top.dataset.for = picker.tab;
  top.innerHTML = `<label class="snd-find"><span>⌕</span><input id="sndp-q" value="${esc(ui.q)}" placeholder="${picker.tab === 'mios' ? 'Busca en tus sonidos…' : 'Busca: golpe, victoria, moneda, campana…'}" autocomplete="off"></label>${picker.tab === 'basicos' ? catsBar('pick') : ''}`;
  const all2 = filtered();
  const shown = picker.tab === 'mios' ? all2.filter((x) => x.ref.startsWith('m:')) : all2.filter((x) => !x.ref.startsWith('m:'));
  list.innerHTML = picker.tab === 'mios' && !shown.length
    ? '<p class="snd-empty">Aún no tienes sonidos propios. Elige uno en «Populares» o «Buscar memes» y quedará aquí.</p>'
    : rows(shown, true, picker.current);
}
export async function openSoundPicker(current, cb) {
  await loadSounds();
  picker.current = current || '';
  picker.cb = cb;
  if (/^m:/.test(picker.current)) picker.tab = 'mios';
  let m = $('#sndp-modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'sndp-modal';
    m.className = 'sndp-modal';
    m.innerHTML = `<div class="sndp-card" role="dialog" aria-modal="true" aria-label="Elegir sonido">
      <div class="sndp-head"><span class="sndp-ic">🔊</span><b>Elige un sonido</b><button type="button" class="ovq-x" data-sndp-close aria-label="Cerrar">✕</button></div>
      <nav class="sndp-tabs">${PICK_TABS.map(([id, n]) => `<button type="button" data-ptab="${id}">${n}</button>`).join('')}</nav>
      <div id="sndp-top" class="sndp-top"></div><div class="snd-list" id="sndp-list"></div></div>`;
    document.body.append(m);
    m.addEventListener('click', async (ev) => {
      if (ev.target === m || ev.target.closest('[data-sndp-close]')) { m.hidden = true; memeAudio?.pause(); return; }
      const t = ev.target.closest('[data-ptab]');
      if (t) { picker.tab = t.dataset.ptab; ui.cat = 'all'; return renderPickerBody(); }
      const pk = ev.target.closest('[data-spick]');
      if (pk) { remember(pk.dataset.spick); picker.cb?.(pk.dataset.spick); m.hidden = true; return; }
      const mp = ev.target.closest('[data-mplay]');
      if (mp) return playUrl(tabState().results[Number(mp.dataset.mplay)].url);
      if (ev.target.closest('[data-pmore]')) return pickerSearch(true);
      if (ev.target.closest('[data-pretry]')) { tabState().err = ''; return pickerSearch(); }
      const mk = ev.target.closest('[data-mpick]');
      if (mk) {
        const meme = tabState().results[Number(mk.dataset.mpick)];
        mk.disabled = true;
        mk.textContent = 'Bajando…';
        try {
          const r = await api('POST', '/api/sounds/add-url', { url: meme.url, name: meme.title, cat: 'memes', tags: norm(meme.title) });
          const ref = `m:${r.added[0].id}`;
          await loadSounds(true);
          remember(ref);
          picker.cb?.(ref);
          m.hidden = true;
          memeAudio?.pause();
        } catch (e) { toast(e.message); mk.disabled = false; mk.textContent = 'Elegir'; }
      }
    });
    m.addEventListener('input', (ev) => { if (ev.target.id === 'sndp-mq') picker.draft = ev.target.value; if (ev.target.id === 'sndp-q') { ui.q = ev.target.value; const pos = ev.target.selectionStart; renderPickerBody(); const n = $('#sndp-q'); n?.focus(); n?.setSelectionRange(pos, pos); } });
    m.addEventListener('submit', (ev) => { ev.preventDefault(); if (ev.target.id === 'sndp-memeform') { picker.draft = $('#sndp-mq').value; picker.q = picker.draft.trim(); if (picker.q) { tabState('memes').busy = false; pickerSearch(false, 'memes'); } } });
  }
  renderPickerBody();
  m.hidden = false;
}

// ---------- Eventos compartidos ----------
document.addEventListener('click', (ev) => {
  const p = ev.target.closest('[data-splay]');
  if (p) { play(p.dataset.splay); remember(p.dataset.splay); return; }
  const f = ev.target.closest('[data-sfav]');
  if (f) { toggleFav(f.dataset.sfav); return refreshList(); }
  const c = ev.target.closest('[data-scat]');
  if (c) { ui.cat = c.dataset.scat; refreshList(); }
});
export function onSoundsChanged() { loadSounds(true).then(() => { renderLibrary(); renderMemes(); renderPhrases(); renderMine(); refreshList(); }); }

export function initSounds(cfg) {
  const early = config?.sounds;
  config = cfg;
  if (early && !cfg.sounds) cfg.sounds = early;
  const page = $('#page-sonidos');
  if (!page) return;
  loadSounds().then(() => { renderLibrary(); renderPhrases(); renderMine(); renderChat(); renderMemes(); });
  // Al entrar, los memes que más suenan ya están cargados.
  onPageChange((pg) => { if (pg === 'sonidos' && !ui.memes.length && !ui.memeBusy) searchMemes(); });

  page.addEventListener('input', (ev) => {
    if (ev.target.id === 'snd-q') { ui.q = ev.target.value; refreshList(); }
  });
  page.addEventListener('change', async (ev) => {
    const el = ev.target;
    if (el.id === 'snd-hide-rude') { sounds().hideRude = el.checked; saveConfig({ sounds: { hideRude: el.checked } }); renderLibrary(); renderPhrases(); return; }
    if (el.id === 'snd-up') return uploadFiles(el.files);
    if (el.id === 'snd-pack') {
      const f = el.files[0];
      if (!f) return;
      try {
        const res = await fetch('/api/sounds/pack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await f.text() });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error);
        guideToast('nono', j.added ? `Importé ${j.added} sonidos del pack.` : 'Ese pack ya lo tenías completo.');
      } catch (e) { toast(e.message); }
      return;
    }
    const row = el.closest('[data-mine]');
    if (row) {
      const body = el.hasAttribute('data-mname') ? { name: el.value } : el.hasAttribute('data-mcat') ? { cat: el.value } : el.hasAttribute('data-mtags') ? { tags: el.value } : null;
      if (body) api('PATCH', `/api/sounds/mine/${row.dataset.mine}`, body).catch((e) => toast(e.message));
      return;
    }
    if (el.dataset.sc) {
      const k = el.dataset.sc;
      const v = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? Number(el.value) : el.value.trim().replace(/^!/, '');
      sounds().chat = { ...(sounds().chat || {}), [k]: v };
      saveConfig({ sounds: { chat: { [k]: v } } });
      if (k === 'enabled' || k === 'command' || k === 'volume') renderChat();
    }
  });
  page.addEventListener('click', async (ev) => {
    const t = ev.target;
    if (t.closest('#snd-up-btn')) return $('#snd-up').click();
    if (t.closest('#snd-pack-btn')) return $('#snd-pack').click();
    if (t.closest('[data-mdel]')) {
      const id = t.closest('[data-mine]').dataset.mine;
      if (confirm('¿Borrar este sonido de tu biblioteca?')) api('DELETE', `/api/sounds/mine/${id}`).catch((e) => toast(e.message));
      return;
    }
    if (t.closest('[data-meme-top]')) { ui.memeQ = ''; $('#snd-meme-q').value = ''; return searchMemes(); }
    if (t.closest('#snd-memes-more')) return searchMemes(true);
    const mp = t.closest('[data-mplay]');
    if (mp) return playUrl(ui.memes[Number(mp.dataset.mplay)].url);
    const ma = t.closest('[data-madd]');
    if (ma) {
      const m = ui.memes[Number(ma.dataset.madd)];
      ma.disabled = true;
      ma.textContent = 'Añadiendo…';
      try {
        await api('POST', '/api/sounds/add-url', { url: m.url, name: m.title, cat: 'memes', tags: norm(m.title) });
        guideToast('nono', `«${m.title}» ya está en tu biblioteca (Memes).`);
      } catch (e) { toast(e.message); ma.disabled = false; ma.textContent = '+ Añadir'; }
      return;
    }
    if (t.closest('[data-phr-all]')) { for (const c of $$('[data-phr]:not(:disabled)')) c.checked = true; return; }
    if (t.closest('[data-phr-none]')) { for (const c of $$('[data-phr]')) c.checked = false; return; }
    if (t.closest('#snd-phr-make')) {
      const list = $$('[data-phr]:checked');
      if (!list.length) return toast('Marca al menos una frase');
      const btn = $('#snd-phr-make');
      btn.disabled = true;
      $('#snd-phr-state').textContent = `Creando ${list.length}… (puede tardar un poco)`;
      try {
        const cats = Object.fromEntries(list.map((c) => [c.dataset.phr, c.dataset.phrCat]));
        const r = await api('POST', '/api/sounds/phrase', { texts: list.map((c) => c.dataset.phr), cats });
        guideToast('nono', `Listo: ${r.added.length} frases en tu biblioteca.${r.errors.length ? ` ${r.errors.length} fallaron.` : ''}`);
      } catch (e) { toast(e.message); }
      btn.disabled = false;
      $('#snd-phr-state').textContent = '';
    }
  });
  page.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    if (ev.target.id === 'snd-meme-form') { ui.memeQ = f.q.trim(); return searchMemes(); }
    if (ev.target.id === 'snd-links') {
      const urls = String(f.urls || '').split(/\s+/).filter((u) => /^https?:\/\//.test(u));
      if (!urls.length) return toast('Pega uno o varios enlaces (uno por línea)');
      const btn = ev.target.querySelector('button');
      btn.disabled = true;
      try {
        const r = await api('POST', '/api/sounds/add-url', { urls, cat: f.cat || 'memes' });
        guideToast('nono', `${r.added.length} ${r.added.length === 1 ? 'sonido agregado' : 'sonidos agregados'}.${r.errors.length ? ` ${r.errors.length} no se pudieron.` : ''}`);
        if (r.errors.length) toast(r.errors.map((x) => x.error).slice(0, 2).join(' · '));
        ev.target.reset();
      } catch (e) { toast(e.message); }
      btn.disabled = false;
      return;
    }
    if (ev.target.id === 'snd-own-phrase') {
      const btn = ev.target.querySelector('button');
      btn.disabled = true;
      try {
        await api('POST', '/api/sounds/phrase', { text: f.text, cat: f.cat });
        guideToast('nono', 'Frase creada.');
        ev.target.reset();
      } catch (e) { toast(e.message); }
      btn.disabled = false;
    }
  });
  // Soltar archivos sobre la zona.
  page.addEventListener('dragover', (ev) => { if (ev.target.closest('#snd-drop')) { ev.preventDefault(); $('#snd-drop').classList.add('over'); } });
  page.addEventListener('dragleave', (ev) => { if (ev.target.closest('#snd-drop')) $('#snd-drop').classList.remove('over'); });
  page.addEventListener('drop', (ev) => {
    if (!ev.target.closest('#snd-drop')) return;
    ev.preventDefault();
    $('#snd-drop').classList.remove('over');
    uploadFiles(ev.dataTransfer.files);
  });
}
