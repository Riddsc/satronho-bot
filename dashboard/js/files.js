// Mis archivos (Ñoño): tus sonidos, imágenes y videos, con sus usos.
// Las mismas opciones están en el menú de la izquierda (desplegable) y en
// las pestañas de la pantalla: Todos, Audios, Imágenes, Videos y Sin usar.

import { $, $$, api, esc, toast, askText } from './util.js';
import { sayFor } from './guides.js';

const FILTERS = [['todos', 'Todos los archivos', '▤'], ['audios', 'Audios', '♪'], ['imagenes', 'Imágenes', '▣'], ['videos', 'Videos', '▶'], ['sinuso', 'Sin usar', '○']];
const KIND_OF = { audios: 'audio', imagenes: 'image', videos: 'video' };
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

let files = [];
let selected = '';
let q = '';
let sort = lsGet('satronho.files.sort', 'date');
let view = lsGet('satronho.files.view', 'grid');
let playing = null;

const filter = () => document.querySelector('[data-tabs="archivos"] [aria-selected="true"]')?.dataset.tab || 'todos';
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (t) => new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
const count = (f) => files.filter((x) => (f === 'todos' ? true : f === 'sinuso' ? !x.uses : x.kind === KIND_OF[f])).length;

// Forma de onda de adorno, fija para cada archivo (no hace falta decodificar el audio).
function wave(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const bars = [];
  for (let i = 0; i < 34; i += 1) { h = (h * 1103515245 + 12345) >>> 0; bars.push(18 + (h % 70)); }
  return `<span class="fl-wave">${bars.map((v) => `<i style="height:${v}%"></i>`).join('')}</span>`;
}
function thumb(f) {
  if (f.kind === 'image') return `<img src="${esc(f.url)}" alt="" loading="lazy">`;
  if (f.kind === 'video') return `<video src="${esc(f.url)}#t=0.5" muted preload="metadata"></video><span class="fl-play-ic">▶</span>`;
  return wave(f.id);
}

function visible() {
  const f = filter();
  const n = q.toLowerCase();
  const list = files.filter((x) => (f === 'todos' ? true : f === 'sinuso' ? !x.uses : x.kind === KIND_OF[f]) && (!n || `${x.name} ${x.group} ${x.ext}`.toLowerCase().includes(n)));
  const by = { date: (a, b) => b.added - a.added, name: (a, b) => a.name.localeCompare(b.name, 'es'), size: (a, b) => b.size - a.size, uses: (a, b) => b.uses - a.uses };
  return list.sort(by[sort] || by.date);
}

function renderGrid() {
  const box = $('#fl-grid');
  if (!box) return;
  box.className = `fl-grid ${view}`;
  for (const b of $$('#fl-view [data-flv]')) b.setAttribute('aria-pressed', String(b.dataset.flv === view));
  const list = visible();
  for (const t of $$('[data-tabs="archivos"] [data-tab]')) {
    const n = count(t.dataset.tab);
    t.innerHTML = `${esc(FILTERS.find((x) => x[0] === t.dataset.tab)[1].replace(' los archivos', ''))} <small>${n}</small>`;
  }
  box.innerHTML = list.length ? list.map((f) => `<button type="button" class="fl-card ${selected === f.id ? 'on' : ''}" data-fl="${esc(f.id)}">
      <span class="fl-thumb k-${f.kind}">${thumb(f)}${f.kind !== 'image' ? `<span class="fl-pl" data-flplay="${esc(f.id)}" title="Reproducir">${playing?.id === f.id ? '■' : '▶'}</span>` : ''}</span>
      <span class="fl-info"><b>${esc(f.name)}</b><small><span class="fl-ext">${esc(f.ext.toUpperCase())}</span>${kb(f.size)}<span class="fl-uses ${f.uses ? '' : 'none'}">${f.uses ? `${f.uses} ${f.uses === 1 ? 'uso' : 'usos'}` : 'Sin usar'}</span></small></span>
    </button>`).join('') : `<div class="fl-empty"><b>${files.length ? 'Nada con este filtro.' : 'Todavía no tienes archivos.'}</b><p>Sube sonidos, imágenes o videos con el botón de arriba o arrastrándolos aquí. Los sonidos que agregues en Sonidos también aparecen.</p></div>`;
  renderSide();
}

function renderSide() {
  const box = $('#fl-side');
  if (!box) return;
  const f = files.find((x) => x.id === selected);
  if (!f) {
    box.innerHTML = `<div class="fl-side-empty"><span>✦</span><b>Elige un archivo</b><p>Aquí ves su vista previa, sus datos y si se usa en alertas, comandos o sonidos del chat.</p>
      <dl class="fl-keys"><dt>Clic</dt><dd>Seleccionar</dd><dt>Doble clic</dt><dd>Reproducir</dd><dt>F2</dt><dd>Renombrar</dd><dt>Supr</dt><dd>Borrar</dd></dl></div>`;
    return;
  }
  const preview = f.kind === 'image' ? `<img src="${esc(f.url)}" alt="">` : f.kind === 'video' ? `<video src="${esc(f.url)}" controls preload="metadata"></video>` : `<audio src="${esc(f.url)}" controls preload="metadata"></audio>`;
  box.innerHTML = `<div class="fl-prev k-${f.kind}">${preview}</div>
    <h3 class="fl-name">${esc(f.name)}</h3>
    <dl class="fl-meta"><dt>Tipo</dt><dd>${{ audio: 'Sonido', image: 'Imagen', video: 'Video' }[f.kind]} · ${esc(f.ext.toUpperCase())}</dd><dt>Tamaño</dt><dd>${kb(f.size)}</dd><dt>Agregado</dt><dd>${when(f.added)}</dd><dt>Dónde está</dt><dd>${esc(f.group)}</dd><dt>Usos</dt><dd>${f.uses ? `${f.uses} ${f.uses === 1 ? 'sitio' : 'sitios'}` : 'Sin usar'}</dd></dl>
    <div class="fl-actions">
      ${f.fixed ? '' : '<button type="button" class="btn small" data-fla="rename">✎ Renombrar</button>'}
      <a class="btn small" href="${esc(f.url)}" download="${esc(f.name)}.${esc(f.ext)}">⬇ Descargar</a>
      <button type="button" class="btn small danger" data-fla="delete">🗑 Borrar</button>
    </div>
    ${f.fixed ? '<p class="hint">Es el sonido de una alerta. Si lo borras, esa alerta vuelve a su sonido de serie.</p>' : ''}`;
}

async function load() {
  try { files = (await api('GET', '/api/files')).files || []; } catch { files = []; }
  renderGrid();
  renderNav();
}

function play(id) {
  const f = files.find((x) => x.id === id);
  if (!f) return;
  if (playing?.id === id) { playing.el.pause(); playing = null; renderGrid(); return; }
  playing?.el.pause();
  const el = new Audio(f.url);
  el.play().catch(() => toast('No se pudo reproducir'));
  el.onended = () => { playing = null; renderGrid(); };
  playing = { id, el };
  renderGrid();
}

async function rename(id) {
  const f = files.find((x) => x.id === id);
  if (!f || f.fixed) return;
  const name = await askText('Nuevo nombre', f.name, 'Renombrar');
  if (!name) return;
  await api('PATCH', `/api/files/${encodeURIComponent(id)}`, { name }).catch((e) => toast(e.message));
  load();
}
async function remove(id) {
  const f = files.find((x) => x.id === id);
  if (!f) return;
  const msg = f.uses ? `«${f.name}» se usa en ${f.uses} ${f.uses === 1 ? 'sitio' : 'sitios'}. ¿Borrarlo igual?` : `¿Borrar «${f.name}»?`;
  if (!confirm(msg)) return;
  await api('DELETE', `/api/files/${encodeURIComponent(id)}`).catch((e) => toast(e.message));
  selected = '';
  sayFor('nono', `Listo, borré <b>${esc(f.name)}</b>.`, 4000, 'ok');
  load();
}

async function uploadAll(list) {
  let okN = 0;
  for (const file of list) {
    try {
      const r = await fetch('/api/files/upload', { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, body: file });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'No se pudo subir');
      okN += 1;
    } catch (e) { toast(`${file.name}: ${e.message}`); }
  }
  if (okN) sayFor('nono', `Subí ${okN} ${okN === 1 ? 'archivo' : 'archivos'}.`, 4000, 'ok');
  load();
}

// ---------- Menú de la izquierda: desplegable con los mismos filtros ----------
function renderNav() {
  const item = $('.nav-item[data-page="archivos"]');
  const box = $('#nav-files');
  if (!item || !box) return;
  if (!item.querySelector('.nav-caret')) item.insertAdjacentHTML('beforeend', '<span class="nav-caret" role="button" tabindex="0" title="Ver los filtros" aria-label="Ver los filtros">▾</span>');
  // Siempre justo debajo de «Mis archivos», aunque cambies el orden del menú.
  if (item.nextElementSibling !== box) item.after(box);
  const open = lsGet('satronho.navFiles', false);
  item.classList.toggle('open', open);
  box.hidden = !open;
  const cur = location.hash.startsWith('#/archivos') ? filter() : '';
  box.innerHTML = FILTERS.map(([id, n, ic]) => `<a class="nav-item nav-pin ${cur === id ? 'on' : ''}" href="#/archivos/${id}"><span class="ic">${ic}</span>${n}<small class="badge">${count(id)}</small></a>`).join('');
}

export function initFiles() {
  if (!$('#page-archivos')) return;
  $('#fl-sort').value = sort;
  $('#fl-q').addEventListener('input', (ev) => { q = ev.target.value.trim(); renderGrid(); });
  $('#fl-sort').addEventListener('change', (ev) => { sort = ev.target.value; lsSet('satronho.files.sort', sort); renderGrid(); });
  $('#fl-view').addEventListener('click', (ev) => { const b = ev.target.closest('[data-flv]'); if (b) { view = b.dataset.flv; lsSet('satronho.files.view', view); renderGrid(); } });
  $('#fl-file').addEventListener('change', (ev) => { uploadAll([...ev.target.files]); ev.target.value = ''; });
  $('#fl-grid').addEventListener('click', (ev) => {
    const pl = ev.target.closest('[data-flplay]');
    if (pl) { ev.stopPropagation(); return play(pl.dataset.flplay); }
    const c = ev.target.closest('[data-fl]');
    if (c) { selected = c.dataset.fl; renderGrid(); }
  });
  $('#fl-grid').addEventListener('dblclick', (ev) => { const c = ev.target.closest('[data-fl]'); if (c) play(c.dataset.fl); });
  $('#fl-side').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-fla]');
    if (!b) return;
    if (b.dataset.fla === 'rename') rename(selected);
    if (b.dataset.fla === 'delete') remove(selected);
  });
  document.addEventListener('keydown', (ev) => {
    if ($('#page-archivos').hidden || !selected || ev.target.closest('input, textarea, select')) return;
    if (ev.key === 'F2') { ev.preventDefault(); rename(selected); }
    if (ev.key === 'Delete') { ev.preventDefault(); remove(selected); }
  });
  // Arrastrar y soltar archivos en la pantalla.
  const page = $('#page-archivos');
  page.addEventListener('dragover', (ev) => { if ([...(ev.dataTransfer?.types || [])].includes('Files')) { ev.preventDefault(); $('#fl-drop').hidden = false; } });
  page.addEventListener('dragleave', (ev) => { if (ev.target === $('#fl-drop')) $('#fl-drop').hidden = true; });
  page.addEventListener('drop', (ev) => { ev.preventDefault(); $('#fl-drop').hidden = true; if (ev.dataTransfer?.files?.length) uploadAll([...ev.dataTransfer.files]); });
  // Menú: la flechita abre o cierra el desplegable.
  document.addEventListener('click', (ev) => {
    const caret = ev.target.closest('.nav-item[data-page="archivos"] .nav-caret');
    if (!caret) return;
    ev.preventDefault();
    ev.stopPropagation();
    lsSet('satronho.navFiles', !lsGet('satronho.navFiles', false));
    renderNav();
  }, true);
  const mo = new MutationObserver(() => { renderGrid(); renderNav(); });
  for (const t of $$('[data-tabs="archivos"] [data-tab]')) mo.observe(t, { attributes: true, attributeFilter: ['aria-selected'] });
  window.addEventListener('hashchange', renderNav);
  load();
}

// Cuando cambian los sonidos (Sonidos, alertas…), se recarga la lista.
export function onFilesChanged() { if ($('#page-archivos')) load(); }
