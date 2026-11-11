// Overlays para OBS.
//  - Galería: los overlays por categoría, cada una con su guía, con vista
//    previa en vivo, estrella para fijarlos en el menú y búsqueda.
//  - Editor (#/overlays/<id>): vista previa grande con fondo de cuadros,
//    URL para OBS, y pestañas Ajustes / Estilo / (Metas, Contadores o
//    Cuenta regresiva según el overlay). Todo cambia al instante.
//  - Estilo general: tema, letra y colores para todos los overlays.

import { $, $$, api, esc, toast, saveConfig } from './util.js';
import { FONTS, ACCENTS } from './appearance.js';
import { guideToast, avatarHTML, GUIDES } from './guides.js';
import { markStep, onPageChange, showPage, currentPage } from './nav.js';
import { CATEGORIES, KINDS, settingsOf, styleOf } from '/overlays/catalog.js';

const DEFAULT = { font: 'bricolage-grotesque', accent: '#ffb23e', text: '#ffffff', card: 'solid', corners: 'round', scale: 1, sound: true, alertColors: 'type', theme: 'satronho' };
// Temas de pantalla: cada uno trae su letra, color y esquinas; luego puedes cambiarlos.
const THEMES = [
  { id: 'satronho', name: 'Satronho', desc: 'Oscuro y cálido, el de siempre', set: { font: 'bricolage-grotesque', accent: '#ffb23e', text: '#ffffff', card: 'solid', corners: 'round' }, bg: '#120e1e', fg: '#fff7ec', bd: '#ffb23e' },
  { id: 'neon', name: 'Neón', desc: 'Bordes que brillan', set: { font: 'space-grotesk', accent: '#00f0ff', text: '#ffffff', card: 'solid', corners: 'soft' }, bg: '#06030f', fg: '#e8fdff', bd: '#00f0ff', glow: true },
  { id: 'cristal', name: 'Cristal', desc: 'Vidrio claro y desenfocado', set: { font: 'poppins', accent: '#a78bfa', text: '#ffffff', card: 'glass', corners: 'round' }, bg: 'rgba(255,255,255,.18)', fg: '#ffffff', bd: 'rgba(255,255,255,.5)' },
  { id: 'papel', name: 'Cuaderno', desc: 'Papel y tinta, como hecho a mano', set: { font: 'comfortaa', accent: '#3b6fd8', text: '#2a2140', card: 'solid', corners: 'soft' }, bg: '#fff8e7', fg: '#2a2140', bd: '#2a2140', dashed: true },
  { id: 'arcade', name: 'Arcade', desc: 'Bloques y letras de máquina', set: { font: 'jetbrains-mono', accent: '#53fc18', text: '#ffffff', card: 'solid', corners: 'square' }, bg: '#0c0b1d', fg: '#ffffff', bd: '#53fc18', hard: true },
  { id: 'dulce', name: 'Dulce', desc: 'Pastel y burbujas', set: { font: 'fredoka', accent: '#ff7ab8', text: '#4a2142', card: 'solid', corners: 'round' }, bg: '#ffeaf4', fg: '#4a2142', bd: '#ffb6d9' },
  { id: 'minimal', name: 'Minimal', desc: 'Solo texto y una línea', set: { font: 'inter', accent: '#ffffff', text: '#ffffff', card: 'none', corners: 'square' }, bg: 'transparent', fg: '#ffffff', bd: '#ffffff', line: true },
  // Los de los guías, cada uno con su personalidad.
  { id: 'samy', name: 'Samy', desc: 'Crema y caramelo, con huellitas', guide: 'samy', set: { font: 'baloo-2', accent: '#ff9a1f', text: '#5a2e12', card: 'solid', corners: 'round' }, bg: '#fff3e2', fg: '#5a2e12', bd: '#ffb23e' },
  { id: 'troya', name: 'Troya', desc: 'Violeta de realeza con filo dorado', guide: 'troya', set: { font: 'poppins', accent: '#b9a8ff', text: '#ffffff', card: 'solid', corners: 'soft' }, bg: '#2c1a5c', fg: '#ffffff', bd: '#f4c95d' },
  { id: 'nono', name: 'Ñoño', desc: 'Aguamarina musical y redondito', guide: 'nono', set: { font: 'fredoka', accent: '#4fd1c5', text: '#e9fffb', card: 'solid', corners: 'round' }, bg: '#0a2c2a', fg: '#e9fffb', bd: '#4fd1c5' },
  { id: 'juana', name: 'Juana', desc: 'Rosa antiguo, fino y coqueto', guide: 'juana', set: { font: 'comfortaa', accent: '#ff8fb5', text: '#ffeef6', card: 'solid', corners: 'soft' }, bg: '#2b1623', fg: '#ffeef6', bd: '#ff8fb5' },
  { id: 'mecha', name: 'MechaRidds', desc: 'Pantalla de androide: verde Hulk y ojo violeta', guide: 'mecha', set: { font: 'jetbrains-mono', accent: '#74d14c', text: '#e8ffe0', card: 'solid', corners: 'square' }, bg: '#051209', fg: '#e8ffe0', bd: '#74d14c' },
  { id: 'colonizadora', name: 'Colonizadora', desc: 'Rosa chicle, lila, brillos y corazoncitos', set: { font: 'baloo-2', accent: '#ff3d9a', text: '#7a1650', card: 'solid', corners: 'round' }, bg: 'linear-gradient(135deg,#ffd1e8,#e8d2ff)', fg: '#7a1650', bd: '#ff6fb5' },
];
const TYPE_NAMES = { follow: 'Seguidores', sub: 'Suscripciones', gift: 'Monedas', like: 'Likes', share: 'Compartidos' };
// Lo que dice cada guía en el editor de su categoría.
const GUIDE_TIP = {
  juana: 'Las metas y contadores son lo mío. Elige si se ve el porcentaje, el objetivo o solo la cifra.',
  troya: 'Los regalos se lucen aquí. Prueba los estilos: la vista previa cambia al instante.',
  mecha: 'Tu comunidad en pantalla. Calibra qué se muestra y qué no: comandos, bots, insignias.',
  mechanizer: 'Tu comunidad en pantalla, bonita y a tu gusto: qué se muestra, emotes, insignias y el mensaje que destaques con 📺.',
  nono: 'Que se vea qué suena y quién lo pidió. Con el estilo vinilo, la portada gira.',
  samy: 'Las pantallas de empezamos, vuelvo y se acabó. Ponles tu título y tus redes.',
};

const nf = new Intl.NumberFormat('es-CO');
let config;
let style;
let widgets = {};
let goals = [];
let live = {};
let pins = [];
let filter = 'all';
let query = '';
let editing = null; // { id, w, tab, real }

const origin = () => location.origin;
// Enlace https para TikTok LIVE Studio (no acepta http://127.0.0.1).
let appInfo = null;
fetch('/api/state').then((r) => r.json()).then((d) => { appInfo = d.app || null; }).catch(() => {});
const tiktokUrl = (path) => {
  const base = appInfo?.pagesBase || 'https://riddsc.github.io/satronho-bot';
  const port = Number(appInfo?.port || location.port) || 3800;
  return `${base}/o/?p=${encodeURIComponent(path)}${port !== 3800 ? `&port=${port}` : ''}`;
};
const pathOf = (url) => url.replace(origin(), '');
// Dos enlaces: OBS / Streamlabs (local) y TikTok LIVE Studio (https).
const urlRows = (local, attr) => `<div class="ov-links">
  <div class="ov-link"><span class="ov-link-name">OBS · Streamlabs</span><code>${esc(local)}</code><button type="button" class="btn small primary" data-copy="${esc(local)}">Copiar</button></div>
  <div class="ov-link tt"><span class="ov-link-name"><span class="pl plogo" data-logo="tiktok" aria-hidden="true"></span>TikTok LIVE Studio</span><code>${esc(tiktokUrl(pathOf(local)))}</code><button type="button" class="btn small" data-copy="${esc(tiktokUrl(pathOf(local)))}" data-tt>Copiar</button></div>
</div>`;
const urlOf = (id) => `${origin()}/overlays/w.html?id=${encodeURIComponent(id)}`;
// Un overlay guardado, o el de serie de su tipo (id = nombre del tipo).
const widgetOf = (id) => widgets[id] || (KINDS[id] ? { kind: id, name: KINDS[id].name } : null);
const nameOf = (id, w = widgetOf(id)) => w?.name || KINDS[w?.kind]?.name || id;
const catOf = (kind) => CATEGORIES.find((c) => c.id === KINDS[kind]?.cat);

function allIds() {
  const ids = Object.keys(KINDS);
  for (const [id, w] of Object.entries(widgets)) if (!KINDS[id] && w && KINDS[w.kind]) ids.push(id);
  return ids;
}

// ---------- Galería ----------
function card(id) {
  const w = widgetOf(id);
  const k = KINDS[w.kind];
  const [W, H] = k.size;
  const pinned = pins.includes(id);
  return `<article class="ovg-card" data-open-w="${esc(id)}" tabindex="0" style="--g:${GUIDES[catOf(w.kind).guide].color}">
    <div class="ovg-pv checker" data-w="${W}" data-h="${H}"><iframe src="/overlays/w.html?id=${encodeURIComponent(id)}&preview=1" width="${W}" height="${H}" loading="lazy" tabindex="-1" title="Vista previa: ${esc(nameOf(id, w))}"></iframe></div>
    <div class="ovg-info"><span class="ovg-ic">${k.icon}</span><div><b>${esc(nameOf(id, w))}</b><small>${esc(k.desc)}</small></div>
      <button type="button" class="ovg-star" data-pin="${esc(id)}" aria-pressed="${pinned}" title="${pinned ? 'Quitar del menú' : 'Fijar en el menú'}">${pinned ? '★' : '☆'}</button></div>
    <div class="ovg-tags"><span>${k.styles.length} estilos</span>${widgets[id] ? '<span class="on">Personalizado</span>' : ''}${KINDS[id] ? '' : '<span>Copia</span>'}</div>
  </article>`;
}

function alertsCard() {
  return `<article class="ovg-card" data-go-alerts tabindex="0" style="--g:${GUIDES.troya.color}">
    <div class="ovg-pv checker" data-w="800" data-h="300"><iframe src="/overlays/alerts.html?preview=1" width="800" height="300" loading="lazy" tabindex="-1" title="Vista previa: Alertas"></iframe></div>
    <div class="ovg-info"><span class="ovg-ic">🔔</span><div><b>Alertas</b><small>Regalos, stickers, seguidores y tus alertas propias. Se configuran en Alertas.</small></div></div>
    <div class="ovg-tags"><span>Ir a Alertas →</span></div></article>`;
}

const matches = (id) => {
  if (!query) return true;
  const w = widgetOf(id);
  const hay = `${nameOf(id, w)} ${KINDS[w.kind].name} ${KINDS[w.kind].desc}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return query.split(/\s+/).every((q) => hay.includes(q));
};

function renderGallery() {
  $('#ovg-cats').innerHTML = [['all', 'Todos'], ...CATEGORIES.map((c) => [c.id, c.name])].map(([id, n]) => `<button type="button" data-cat="${id}" aria-pressed="${filter === id}">${esc(n)}</button>`).join('');
  const ids = allIds().filter(matches);
  const pinned = pins.filter((id) => widgetOf(id) && matches(id));
  $('#ovg-pins').innerHTML = pinned.length && filter === 'all'
    ? `<section class="ovg-sec"><header class="ovg-head"><span class="ovg-star-big">★</span><div><h3>Fijados</h3><p>También los tienes a mano en el menú de la izquierda.</p></div></header><div class="ovg-grid">${pinned.map(card).join('')}</div></section>`
    : '';
  $('#ovg-list').innerHTML = CATEGORIES.filter((c) => filter === 'all' || filter === c.id).map((c) => {
    const mine = ids.filter((id) => KINDS[widgetOf(id).kind].cat === c.id);
    const extra = c.id === 'regalos' && !query ? alertsCard() : '';
    if (!mine.length && !extra) return '';
    const g = GUIDES[c.guide];
    return `<section class="ovg-sec" style="--g:${g.color}"><header class="ovg-head">${avatarHTML(c.guide, 'md')}<div><h3>${esc(c.name)}</h3><p>${esc(c.desc)} <span class="ovg-by">Te guía ${esc(g.name)}</span></p></div></header>
      <div class="ovg-grid">${mine.map(card).join('')}${extra}</div></section>`;
  }).join('') || '<p class="hint">No hay overlays con ese nombre.</p>';
  fitAll($('#ovg'));
  renderNavPins();
}

function fitAll(root) {
  for (const pv of $$('.ovg-pv, .ove-stage', root)) {
    const w = Number(pv.dataset.w);
    const h = Number(pv.dataset.h);
    const box = pv.clientWidth;
    if (!box) continue;
    const maxH = pv.classList.contains('ove-stage') ? Math.min(window.innerHeight * 0.52, 520) : 190;
    const k = Math.min(box / w, maxH / h);
    pv.style.height = `${Math.round(h * k)}px`;
    const f = pv.querySelector('iframe');
    f.style.transform = `scale(${k})`;
    f.style.left = `${Math.max(0, (box - w * k) / 2)}px`;
  }
}

// ---------- Menú: fijados ----------
// Menú de la izquierda: los fijados siempre a la vista y, con la flechita
// de «Overlays para OBS», el desplegable con todas las categorías.
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
function navLink(id) {
  const w = widgetOf(id);
  const on = editing?.id === id && currentPage() === 'overlays';
  return `<a class="nav-item nav-pin ${on ? 'on' : ''}" href="#/overlays/${encodeURIComponent(id)}" title="${esc(nameOf(id, w))}"><span class="ic">${KINDS[w.kind].icon}</span>${esc(nameOf(id, w))}</a>`;
}
function renderNavPins() {
  const box = $('#nav-pins');
  if (!box) return;
  const open = lsGet('satronho.navOverlays', false);
  const item = $('.nav-item[data-page="overlays"]');
  if (item && !item.querySelector('.nav-caret')) item.insertAdjacentHTML('beforeend', '<span class="nav-caret" role="button" tabindex="0" title="Ver todos los overlays" aria-label="Ver todos los overlays">▾</span>');
  item?.classList.toggle('open', open);
  // Siempre justo debajo de «Overlays para OBS», aunque cambies el orden del menú.
  if (item && item.nextElementSibling !== box) item.after(box);
  const list = pins.filter((id) => widgetOf(id));
  const openCats = lsGet('satronho.navOverlayCats', []);
  const tree = open
    ? `<a class="nav-item nav-pin" href="#/overlays/galeria"><span class="ic">▦</span>Ver la galería</a>${CATEGORIES.map((c) => {
      const ids = allIds().filter((id) => KINDS[widgetOf(id).kind].cat === c.id);
      const isOpen = openCats.includes(c.id);
      return `<div class="nav-cat ${isOpen ? 'open' : ''}" style="--g:${GUIDES[c.guide].color}"><button type="button" class="nav-cat-btn" data-navcat="${c.id}" aria-expanded="${isOpen}"><i></i>${esc(c.name)}<small>${ids.length}</small><span>▸</span></button>${isOpen ? `<div class="nav-cat-list">${ids.map(navLink).join('')}${c.id === 'regalos' ? '<a class="nav-item nav-pin" href="#/alertas"><span class="ic">🔔</span>Alertas</a>' : ''}</div>` : ''}</div>`;
    }).join('')}`
    : '';
  box.hidden = !list.length && !open;
  box.innerHTML = `${list.length ? `<div class="nav-pinned">${list.map(navLink).join('')}</div>` : ''}${tree}`;
}
// Cada apartado con algo que se puede poner en OBS lleva botones a su overlay
// (los atajos del encabezado de cada página, sin cambios)…
const SECTION_JUMPS = {
  musica: ['nowplaying', 'queue'],
  actividad: ['chat', 'activity', 'viewers'],
  alertas: ['alerts', 'giftspot', 'lastgifts', 'giftrain', 'bestgift'],
  estadisticas: ['ranking', 'mvp', 'uptime'],
  chatbot: ['ticker', 'chat'],
  voz: ['chat'],
  sonidos: ['alerts'],
};
// …y la ventana de overlays de cada apartado muestra TODOS los que le
// corresponden, cada uno en su pestaña.
const SECTION_OVERLAYS = {
  musica: ['nowplaying', 'queue'],
  actividad: ['chat', 'activity', 'ticker', 'viewers', 'followers', 'uptime'],
  alertas: ['alerts', 'giftspot', 'lastgifts', 'giftrain', 'bestgift', 'mvp', 'ranking'],
  estadisticas: ['ranking', 'mvp', 'bestgift', 'viewers', 'followers', 'uptime', 'goals', 'counters', 'countdown'],
  chatbot: ['chat', 'ticker', 'activity', 'counters', 'countdown'],
  voz: ['chat', 'activity'],
  sonidos: ['alerts', 'giftspot', 'giftrain'],
};
const SECTION_NAME = { musica: 'música', actividad: 'chat', alertas: 'alertas', estadisticas: 'estadísticas', chatbot: 'Chat Bot', voz: 'voz', sonidos: 'sonidos' };
// «Alertas» no es de la galería (tiene su propio editor), pero sí sale aquí.
const ALERTS_KIND = { icon: '🔔', name: 'Alertas', size: [800, 300], desc: 'Regalos, stickers, seguidores y tus alertas propias, con su sonido.' };
const quickInfo = (k) => (k === 'alerts' ? ALERTS_KIND : KINDS[k]);
const quickPath = (k) => (k === 'alerts' ? '/overlays/alerts.html' : `/overlays/w.html?id=${encodeURIComponent(k)}`);

function renderSectionLinks() {
  for (const [page, kinds] of Object.entries(SECTION_JUMPS)) {
    const t = $(`#page-${page} .ph .t`);
    if (!t || page === 'musica') continue; // Música tiene su botón «Overlay» arriba
    let box = t.querySelector('.ov-jump');
    if (!box) { box = document.createElement('div'); box.className = 'ov-jump'; t.append(box); }
    box.innerHTML = `<button type="button" class="ov-jump-main" data-ovquick="${page}"><i>🖥</i>Overlays</button>${kinds.map((k) => `<button type="button" class="ov-jump-btn" data-ovquick="${page}" data-kind="${k}" style="--g:${k === 'alerts' ? GUIDES.troya.color : GUIDES[catOf(k).guide].color}"><i>${quickInfo(k).icon}</i>${esc(quickInfo(k).name)}</button>`).join('')}`;
  }
}

// ---------- Ventana de overlays de cada apartado ----------
// Se abre encima de la pantalla en la que estás, con TODOS los overlays de
// ese apartado (uno por pestaña) y su editor completo: vista previa en vivo
// a la izquierda y «Qué se muestra», «Estilo» y demás a la derecha. Se
// guarda solo. Al cerrarla sigues donde estabas.
const quick = { page: '', kind: '', open: false };
function startEditing(id) {
  const w = widgetOf(id);
  if (!w) return false;
  const k = KINDS[w.kind];
  editing = { id, w: JSON.parse(JSON.stringify({ kind: w.kind, name: w.name || k.name, style: styleOf(w), settings: settingsOf(w), look: w.look || {} })), tab: 'ajustes', real: Boolean(k.extraTab) };
  return true;
}
function openOverlayQuick(page, kind) {
  const kinds = SECTION_OVERLAYS[page] || ['nowplaying'];
  // Si el editor de la página Overlays estaba abierto, se cierra (mismo editor).
  if (editing && !quick.open) closeEditor();
  quick.page = page;
  quick.kind = kinds.includes(kind) ? kind : kinds[0];
  quick.open = true;
  let m = $('#ovq');
  if (!m) {
    m = document.createElement('div');
    m.id = 'ovq';
    m.className = 'ovq';
    document.body.append(m);
    m.addEventListener('click', async (ev) => {
      if (ev.target === m || ev.target.closest('[data-ovq-close]')) return closeQuick();
      const tab = ev.target.closest('[data-ovq-kind]');
      if (tab) { quick.kind = tab.dataset.ovqKind; return renderQuick(); }
      if (ev.target.closest('[data-ovq-all]')) { closeQuick(); return go('galeria'); }
      if (ev.target.closest('[data-ovq-alerts]')) { closeQuick(); return showPage('alertas'); }
      const th = ev.target.closest('[data-qtheme]');
      if (th) {
        const t = THEMES.find((x) => x.id === th.dataset.qtheme);
        setStyle({ theme: t.id, ...t.set });
        renderQuickAlerts();
        return guideToast('troya', `Tema «${t.name}» en tus alertas y en todos tus overlays.`);
      }
      const ac = ev.target.closest('[data-qaccent]');
      if (ac) { setStyle({ accent: ac.dataset.qaccent }); return renderQuickAlerts(); }
      if (ev.target.closest('[data-ovq-sim]')) return api('POST', '/api/test/gift').catch((e) => toast(e.message));
      if (editing && ev.target.closest('#ovq-editor')) return onEditorClick(ev);
    });
    m.addEventListener('input', (ev) => { if (editing && ev.target.closest('#ovq-editor') && !ev.target.dataset.c && !ev.target.closest('[data-goal], #ove-newgoal') && ev.target.type !== 'checkbox') onEditorInput(ev); });
    m.addEventListener('change', (ev) => {
      if (ev.target.id === 'ovq-sound') {
        config.overlayStyle = { ...config.overlayStyle, sound: ev.target.checked };
        return setStyle({ sound: ev.target.checked });
      }
      if (editing && ev.target.closest('#ovq-editor')) onEditorChange(ev);
    });
    m.addEventListener('submit', (ev) => { if (editing && ev.target.closest('#ovq-editor')) onEditorSubmit(ev); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !m.hidden) closeQuick(); });
    window.addEventListener('resize', () => { if (!m.hidden) fitAll(m); });
  }
  renderQuick();
  m.hidden = false;
  requestAnimationFrame(() => m.classList.add('on'));
}
function closeQuick() {
  const m = $('#ovq');
  if (!m) return;
  // Lo pendiente de guardar se guarda ya.
  if (editing && saveTimer) {
    clearTimeout(saveTimer);
    widgets[editing.id] = JSON.parse(JSON.stringify(editing.w));
    saveConfig({ widgets: { [editing.id]: widgets[editing.id] } });
  }
  editing = null;
  quick.open = false;
  m.classList.remove('on');
  setTimeout(() => { m.hidden = true; m.innerHTML = ''; }, 160);
  renderGallery();
}
function renderQuick() {
  const m = $('#ovq');
  const kinds = SECTION_OVERLAYS[quick.page] || [];
  const isAlerts = quick.kind === 'alerts';
  const info = quickInfo(quick.kind);
  const [W, H] = info.size;
  const guide = isAlerts ? 'troya' : catOf(quick.kind).guide;
  const color = GUIDES[guide].color;
  editing = null;
  if (!isAlerts) startEditing(quick.kind);
  m.innerHTML = `<div class="ovq-card ovq-wide" role="dialog" aria-modal="true" aria-label="Overlays de ${esc(SECTION_NAME[quick.page] || '')}" style="--g:${color}">
    <header class="ovq-head"><span class="ovq-ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M8 20h8M12 16v4"/><path d="M7.5 12.5l3-3 2 2 4-4"/></svg></span><div><b>Overlays de ${esc(SECTION_NAME[quick.page] || 'este apartado')}</b><small>Elige uno, cámbialo a tu gusto y copia su enlace. Se guarda solo y OBS o TikTok se actualizan al instante.</small></div><button type="button" class="ovq-x" data-ovq-close aria-label="Cerrar">✕</button></header>
    ${kinds.length > 1 ? `<nav class="ovq-tabs">${kinds.map((k) => `<button type="button" data-ovq-kind="${k}" aria-selected="${k === quick.kind}"><i>${quickInfo(k).icon}</i>${esc(quickInfo(k).name)}</button>`).join('')}</nav>` : ''}
    <div class="ovq-cols" id="ovq-editor">
      <div class="ovq-left">
        ${isAlerts ? '' : `<div class="row space ovq-pvbar"><div class="seg ove-data" role="group" aria-label="Datos de la vista previa"><button type="button" data-real="0">Ejemplo</button><button type="button" data-real="1">Mis datos</button></div>
          <div class="seg ove-bgs" role="group" aria-label="Fondo de la vista previa"><button type="button" data-bg="scene" aria-pressed="true" title="Como se ve en tu directo">Escena</button><button type="button" data-bg="checker" aria-pressed="false" title="Fondo transparente (cuadros)">Transparente</button><button type="button" data-bg="light" aria-pressed="false" title="Fondo claro">Claro</button></div></div>`}
        <div class="ove-stage checker" data-bg="scene" data-w="${W}" data-h="${H}">${isAlerts ? `<iframe src="${quickPath('alerts')}?preview=1" width="${W}" height="${H}" title="Vista previa" tabindex="-1"></iframe>` : `<iframe id="ove-frame" width="${W}" height="${H}" title="Vista previa"></iframe>`}</div>
        <p class="ovq-desc">${esc(info.desc)}</p>
        <div id="ove-urls">${isAlerts ? urlRows(origin() + quickPath('alerts')) : ''}</div>
        <p class="hint ovq-size">Tamaño sugerido <b>${W} × ${H}</b>, aunque se acomoda solo a cualquier tamaño: llena la fuente sin cortarse. En TikTok LIVE Studio, si se ve borroso al achicarlo, sube la «Resolución personalizada».</p>
      </div>
      <div class="ovq-right">
        ${isAlerts ? '<div id="ovq-alerts"></div>' : `<div class="ove-head ovq-ehead" id="ove-head"></div><b id="ove-crumb-name" hidden></b><div class="ove-tabs" id="ove-tabs"></div><div id="ove-panel"></div>`}
      </div>
    </div>
    <footer class="ovq-foot ovq-foot-one"><button type="button" class="btn ovq-all" data-ovq-all>Ir a todos los Overlays personalizables →</button></footer>
  </div>`;
  if (isAlerts) {
    const f = m.querySelector('iframe');
    f.addEventListener('load', () => pushStyle(f));
    renderQuickAlerts();
  } else {
    renderEditorHead();
    renderTabs();
    setFrame();
  }
  requestAnimationFrame(() => fitAll(m));
}
// Alertas: su diseño sigue el tema de tus overlays; textos, sonidos y reglas
// están en el apartado Alertas.
function renderQuickAlerts() {
  const box = $('#ovq-alerts');
  if (!box) return;
  box.innerHTML = `<span class="field-label">Tema de tus alertas</span>
    <div class="ovq-themes">${THEMES.map((t) => `<button type="button" class="ov-theme" data-qtheme="${t.id}" aria-pressed="${style.theme === t.id}" title="${esc(t.desc)}"><span class="ov-tprev" style="--tb:${t.bg};--tf:${t.fg};--td:${t.bd}"><b>Satronho</b></span><span class="ov-tname">${esc(t.name)}</span></button>`).join('')}</div>
    <span class="field-label mt">Color</span>
    <div class="row wrap" style="gap:6px">${ACCENTS.map((c) => `<button type="button" class="swatch" data-qaccent="${c}" aria-pressed="${style.accent === c}" style="background:${c};width:26px;height:26px" title="${c}"></button>`).join('')}</div>
    <label class="switch mt"><input type="checkbox" id="ovq-sound" ${style.sound !== false ? 'checked' : ''}><span></span> Sonido de las alertas en el directo</label>
    <div class="row wrap mt" style="gap:8px"><button type="button" class="btn small" data-ovq-sim>▶ Probar con un regalo</button><button type="button" class="btn small primary" data-ovq-alerts>Textos, sonidos y reglas de cada alerta</button></div>`;
}

// Copiar un enlace (OBS o TikTok LIVE Studio), con la ayuda de Samy.
async function copyLink(btn) {
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    guideToast('samy', btn.dataset.tt !== undefined
      ? 'Enlace para TikTok copiado. En TikTok LIVE Studio: + Agregar fuente → Enlace, pégalo y pulsa Aplicar. La app tiene que estar abierta en este PC.'
      : 'URL copiada. En OBS: Fuentes → + → Navegador, y pégala.');
    markStep('overlay');
  } catch {
    toast('No se pudo copiar: selecciónala a mano');
  }
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('.ov-links [data-copy]');
  if (b && !b.closest('#ovg')) copyLink(b);
});

function initNavTree() {
  document.addEventListener('click', (ev) => {
    const q = ev.target.closest('[data-ovquick]');
    if (q) { ev.preventDefault(); return openOverlayQuick(q.dataset.ovquick, q.dataset.kind); }
    const caret = ev.target.closest('.nav-caret');
    if (caret) {
      ev.preventDefault();
      ev.stopPropagation();
      lsSet('satronho.navOverlays', !lsGet('satronho.navOverlays', false));
      return renderNavPins();
    }
    const cat = ev.target.closest('[data-navcat]');
    if (cat) {
      const list = new Set(lsGet('satronho.navOverlayCats', []));
      if (list.has(cat.dataset.navcat)) list.delete(cat.dataset.navcat); else list.add(cat.dataset.navcat);
      lsSet('satronho.navOverlayCats', [...list]);
      renderNavPins();
    }
  }, true);
  document.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest?.('.nav-caret')) { ev.preventDefault(); ev.target.click(); }
  });
}
function togglePin(id) {
  pins = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id];
  saveConfig({ profile: { pinnedWidgets: pins } });
  if (pins.includes(id)) guideToast(catOf(widgetOf(id).kind).guide, `«${nameOf(id)}» quedó fijado en el menú.`);
  renderGallery();
  if (editing?.id === id) renderEditorHead();
}

// ---------- Editor ----------
function openEditor(id) {
  const w = widgetOf(id);
  if (!w) return closeEditor();
  const k = KINDS[w.kind];
  const real = editing?.id === id ? editing.real : Boolean(k.extraTab);
  editing = { id, w: JSON.parse(JSON.stringify({ kind: w.kind, name: w.name || k.name, style: styleOf(w), settings: settingsOf(w), look: w.look || {} })), tab: editing?.id === id ? editing.tab : 'ajustes', real };
  $('#ovg').hidden = true;
  const box = $('#ove');
  box.hidden = false;
  const cat = catOf(w.kind);
  const g = GUIDES[cat.guide];
  const [W, H] = k.size;
  box.style.setProperty('--g', g.color);
  box.innerHTML = `
    <nav class="ove-crumbs"><button type="button" class="btn small ghost" data-back>← Overlays</button><span>›</span><button type="button" class="linkish" data-crumb-cat="${cat.id}">${esc(cat.name)}</button><span>›</span><b id="ove-crumb-name"></b></nav>
    <div class="ove-head" id="ove-head"></div>
    <div class="ove-cols">
      <div class="ove-left">
        <div class="card ove-pvcard">
          <div class="row space"><div class="seg ove-data" role="group" aria-label="Datos de la vista previa"><button type="button" data-real="0">Ejemplo</button><button type="button" data-real="1">Mis datos</button></div>
            <div class="seg ove-bgs" role="group" aria-label="Fondo de la vista previa"><button type="button" data-bg="scene" aria-pressed="true" title="Como se ve en tu directo">Escena</button><button type="button" data-bg="checker" aria-pressed="false" title="Fondo transparente (cuadros)">Transparente</button><button type="button" data-bg="light" aria-pressed="false" title="Fondo claro">Claro</button></div></div>
          <div class="ove-stage checker" data-bg="scene" data-w="${W}" data-h="${H}"><iframe id="ove-frame" width="${W}" height="${H}" title="Vista previa"></iframe></div>
          <div id="ove-urls"></div>
          <p class="hint ove-size">En OBS, fuente de navegador de <b>${W} × ${H}</b>. Marca «Actualizar el navegador cuando la escena se active».</p>
          ${w.kind === 'giftspot' || w.kind === 'giftrain' || w.kind === 'lastgifts' || w.kind === 'bestgift' || w.kind === 'mvp' ? '<button type="button" class="btn small ghost" data-sim-quick="gift">▶ Simular un regalo</button>' : ''}
          ${w.kind === 'ranking' || w.kind === 'mvp' ? '<button type="button" class="btn small ghost" data-reset-podium>Reiniciar ranking</button>' : ''}
        </div>
        <div class="ove-guide">${avatarHTML(cat.guide, 'md')}<p><b>${esc(g.name)}:</b> ${esc(GUIDE_TIP[cat.guide])}</p></div>
      </div>
      <div class="card ove-right">
        <div class="ove-tabs" id="ove-tabs"></div>
        <div id="ove-panel"></div>
      </div>
    </div>`;
  renderEditorHead();
  renderTabs();
  setFrame();
  requestAnimationFrame(() => fitAll(box));
  renderNavPins();
  $('#content').scrollTop = 0;
}

function closeEditor() {
  editing = null;
  $('#ove').hidden = true;
  $('#ove').innerHTML = '';
  $('#ovg').hidden = false;
  renderGallery();
}

function setFrame() {
  const f = $('#ove-frame');
  if (!f) return;
  f.src = `/overlays/w.html?id=${encodeURIComponent(editing.id)}&preview=1${editing.real ? '&real=1' : ''}`;
  f.onload = () => { pushPreview(); pushStyle(f); };
  for (const b of $$('[data-real]')) b.setAttribute('aria-pressed', String((b.dataset.real === '1') === editing.real));
  $('#ove-urls').innerHTML = urlRows(urlOf(editing.id));
}
const pushPreview = () => $('#ove-frame')?.contentWindow?.postMessage({ satronhoWidget: editing.w }, origin());
function pushStyle(f) {
  const frames = f ? [f] : [...$$('#page-overlays iframe'), ...$$('#ovq iframe')];
  for (const x of frames) x.contentWindow?.postMessage({ satronhoStyle: style }, origin());
}

function renderEditorHead() {
  if (!editing) return;
  const { id, w } = editing;
  const k = KINDS[w.kind];
  const pinned = pins.includes(id);
  $('#ove-crumb-name').textContent = w.name;
  $('#ove-head').innerHTML = `<span class="ove-ic">${k.icon}</span>
    <label class="ove-name"><input id="ove-name" value="${esc(w.name)}" aria-label="Nombre del overlay" maxlength="40"><small>${esc(k.name)}${KINDS[id] ? '' : ' · copia'}</small></label>
    <div class="ove-actions">
      <button type="button" class="btn small ${pinned ? 'primary' : 'ghost'}" data-pin="${esc(id)}">${pinned ? '★ Fijado' : '☆ Fijar en el menú'}</button>
      <button type="button" class="btn small ghost" data-dup>Duplicar</button>
      <button type="button" class="btn small ghost danger" data-del>${KINDS[id] ? 'Restablecer' : 'Eliminar'}</button>
    </div>`;
}

function renderTabs() {
  const k = KINDS[editing.w.kind];
  const extra = { goals: ['metas', '🎯 Metas'], counters: ['contadores', '# Contadores'], countdown: ['reloj', '⏳ Controles'] }[k.extraTab];
  const tabs = [...(extra ? [extra] : []), ['ajustes', 'Qué se muestra'], ['estilo', 'Estilo']];
  if (!tabs.some(([t]) => t === editing.tab)) editing.tab = tabs[0][0];
  $('#ove-tabs').innerHTML = tabs.map(([t, n]) => `<button type="button" data-etab="${t}" aria-selected="${editing.tab === t}">${n}</button>`).join('');
  renderPanel();
}

function renderPanel() {
  const t = editing.tab;
  const box = $('#ove-panel');
  if (t === 'ajustes') box.innerHTML = fieldsHTML();
  if (t === 'estilo') box.innerHTML = styleHTML();
  if (t === 'metas') box.innerHTML = goalsHTML();
  if (t === 'contadores') box.innerHTML = countersHTML();
  if (t === 'reloj') box.innerHTML = clockHTML();
}

// --- Ajustes generados desde el catálogo ---
const PLAT_NAMES = { tiktok: 'TikTok', kick: 'Kick', twitch: 'Twitch', starvios: 'Starvios' };
function visible(fd, s) {
  return !fd.when || Object.entries(fd.when).every(([k, v]) => s[k] === v);
}
function fieldHTML(fd, s) {
  const v = s[fd.k];
  const hint = fd.hint ? `<small class="hint">${esc(fd.hint)}</small>` : '';
  if (fd.t === 'toggle') return `<label class="switch ove-sw"><input type="checkbox" data-f="${fd.k}" ${v ? 'checked' : ''}><span></span> <em class="sw-t">${esc(fd.label)}</em></label>`;
  if (fd.t === 'seg') return `<div class="field"><span>${esc(fd.label)}</span><div class="seg ove-seg">${fd.opts.map(([o, n]) => `<button type="button" data-f="${fd.k}" data-v="${esc(o)}" aria-pressed="${String(v) === String(o)}">${esc(n)}</button>`).join('')}</div>${hint}</div>`;
  if (fd.t === 'range') return `<label class="field"><span>${esc(fd.label)} <b class="ove-rv">${esc(v)}${esc(fd.unit || '')}</b></span><input type="range" data-f="${fd.k}" min="${fd.min}" max="${fd.max}" step="${fd.step || 1}" value="${esc(v)}">${hint}</label>`;
  if (fd.t === 'number') return `<label class="field"><span>${esc(fd.label)}</span><input type="number" data-f="${fd.k}" value="${esc(v)}" min="0">${hint}</label>`;
  if (fd.t === 'textarea') return `<label class="field"><span>${esc(fd.label)}</span><textarea data-f="${fd.k}" rows="4">${esc(v)}</textarea>${hint}</label>`;
  if (fd.t === 'plats') return `<div class="field"><span>${esc(fd.label)}</span><div class="ove-plats">${Object.entries(PLAT_NAMES).map(([p, n]) => `<label class="ove-plat"><input type="checkbox" data-f="${fd.k}" data-p="${p}" ${(v || []).includes(p) ? 'checked' : ''}><img src="/img/platforms/${p}.png" alt="">${n}</label>`).join('')}</div></div>`;
  return `<label class="field"><span>${esc(fd.label)}</span><input data-f="${fd.k}" value="${esc(v)}">${hint}</label>`;
}
function fieldsHTML() {
  const k = KINDS[editing.w.kind];
  const s = editing.w.settings;
  return `<div class="ove-fields">${k.fields.filter((fd) => visible(fd, s)).map((fd) => fieldHTML(fd, s)).join('')}</div>`;
}

// --- Estilo ---
function styleHTML() {
  const { w } = editing;
  const k = KINDS[w.kind];
  const L = w.look || {};
  const g = (key) => L[key] ?? '';
  const sel = (key, opts) => `<select data-l="${key}"><option value="">Como el estilo general</option>${opts.map(([v, n]) => `<option value="${v}" ${g(key) === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  return `<span class="field-label">Diseño</span>
    <div class="ove-styles">${k.styles.map(([sid, n], i) => `<button type="button" data-style="${sid}" aria-pressed="${w.style === sid}"><i class="ove-sty" data-s="${i % 6}"></i>${esc(n)}</button>`).join('')}</div>
    <span class="field-label mt">Tema solo para este overlay</span>
    <div class="ove-themes"><button type="button" data-ltheme="" aria-pressed="${!g('theme')}">General</button>${THEMES.map((t) => `<button type="button" data-ltheme="${t.id}" aria-pressed="${g('theme') === t.id}" style="--tb:${t.bg};--tf:${t.fg};--td:${t.bd}"><i></i>${esc(t.name)}</button>`).join('')}</div>
    <div class="ove-grid2 mt">
      <label class="field"><span>Color principal</span><span class="row"><input type="color" data-l="accent" value="${g('accent') || style.accent}"><button type="button" class="btn small ghost" data-lclear="accent" ${g('accent') ? '' : 'disabled'}>General</button></span></label>
      <label class="field"><span>Color del texto</span><span class="row"><input type="color" data-l="text" value="${g('text') || style.text}"><button type="button" class="btn small ghost" data-lclear="text" ${g('text') ? '' : 'disabled'}>General</button></span></label>
      <label class="field"><span>Tipografía</span>${sel('font', FONTS.map((f) => [f.id, f.name]))}</label>
      <label class="field"><span>Fondo de las tarjetas</span>${sel('card', [['solid', 'Sólido'], ['glass', 'Translúcido'], ['none', 'Sin fondo']])}</label>
      <label class="field"><span>Esquinas</span>${sel('corners', [['round', 'Redondeadas'], ['soft', 'Suaves'], ['square', 'Rectas']])}</label>
      <label class="field"><span>Cuánto llena la fuente <b class="ove-rv">${Math.round(Math.min(1, Number(g('scale')) || 1) * 100)}%</b></span><input type="range" min="0.5" max="1" step="0.05" data-l="scale" value="${Math.min(1, Number(g('scale')) || 1)}"></label>
    </div>
    <div class="swatches mt">${ACCENTS.map((c) => `<button type="button" class="swatch" data-laccent="${c}" style="background:${c};width:24px;height:24px" title="${c}"></button>`).join('')}</div>
    <p class="hint">Lo que dejes en «General» sigue al <a href="#/overlays/estilo">estilo general</a> de tus overlays.</p>`;
}

// --- Metas ---
// Cada meta: una fila corta (nombre, barra, números) y «Ajustar», que abre
// sus opciones ordenadas por pregunta: qué cuenta, de dónde, cómo y cuándo
// vuelve a empezar. Así la lista no se llena de selectores.
const GOAL_PLATS = [['all', 'Todas'], ['tiktok', 'TikTok'], ['kick', 'Kick'], ['starvios', 'Starvios'], ['twitch', 'Twitch']];
const READABLE = ['tiktok', 'kick', 'starvios'];
const SOURCE_INFO = {
  events: ['Lo que pase en el directo', 'Suma cada seguidor nuevo mientras la app está conectada.'],
  account: ['Total de tu cuenta', 'Tus seguidores de verdad, por ejemplo 159 de 200. Se lee solo.'],
  gained: ['Nuevos en el periodo', 'Cuántos seguidores ganaste desde que empezó el periodo, aunque la app haya estado cerrada.'],
};
const PERIOD_INFO = [['none', 'Nunca'], ['stream', 'Cada directo'], ['day', 'Cada día'], ['week', 'Cada semana'], ['month', 'Cada mes']];
const SWATCHES = ['#ffb23e', '#ff4f8b', '#9b8cff', '#5fb8ff', '#2dd4bf', '#74d14c', '#ff7a59', '#ffffff'];
const goalOpen = new Set(); // metas con «Ajustar» abierto
let accountStats = {};
const platLogo = (p, cls = 'ove-gpl') => (p === 'all' ? `<span class="${cls} all" aria-hidden="true">🌐</span>` : `<img class="${cls}" src="/img/platforms/${p}.png" alt="">`);
const platsOfGoal = (g) => (g.platform !== 'all' ? [g.platform] : g.platforms?.length ? g.platforms : GOAL_PLATS.slice(1).map(([p]) => p));
const ago = (ts) => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`; };

function goalSummary(g) {
  const where = g.platform === 'all' ? (g.platforms?.length ? g.platforms.map((p) => PLAT_NAMES[p]).join(' + ') : 'Todas las plataformas') : PLAT_NAMES[g.platform];
  const how = g.type === 'follow' ? SOURCE_INFO[g.source || 'events'][0] : TYPE_NAMES[g.type];
  const when = g.source === 'account' ? '' : { none: '', stream: 'se reinicia cada directo', day: 'se reinicia cada día', week: `se reinicia cada semana (desde el ${g.weekStart === 0 ? 'domingo' : 'lunes'})`, month: 'se reinicia cada mes' }[g.period || 'none'];
  return [g.type === 'follow' ? `Seguidores: ${how.toLowerCase()}` : how, where, when].filter(Boolean).join(' · ');
}

// Lo que se sabe de cada cuenta que usa esta meta.
function accountLines(g) {
  if (g.type !== 'follow' || g.source === 'events') return '';
  const lines = platsOfGoal(g).filter((p) => READABLE.includes(p)).map((p) => {
    const a = accountStats[p] || {};
    const val = Number.isFinite(a.followers) ? `<b>${new Intl.NumberFormat('es-CO').format(a.followers)}</b> seguidores <small>${ago(a.ts)}</small>`
      : !a.channel ? '<span class="ove-acc-warn">Pon tu canal en Conexiones</span>'
      : `<span class="ove-acc-warn">${esc(a.error || (p === 'tiktok' ? 'Se lee al conectarte a tu LIVE' : 'Leyendo…'))}</span>`;
    return `<li>${platLogo(p)}<span>${val}</span></li>`;
  }).join('');
  const twitch = platsOfGoal(g).includes('twitch') ? '<li class="ove-acc-note">Twitch no da su total: no se suma.</li>' : '';
  return `<div class="ove-acc"><ul>${lines}${twitch}</ul><button type="button" class="btn small ghost" data-gread>Leer ahora</button></div>`;
}

function goalDrawer(g) {
  const p = g.platform || 'all';
  const isFollow = g.type === 'follow';
  const src = isFollow ? g.source || 'events' : 'events';
  const chosen = new Set(g.platforms?.length ? g.platforms : GOAL_PLATS.slice(1).map(([x]) => x));
  const row = (label, body, hint = '') => `<div class="ove-gq"><div class="ove-gq-l">${label}</div><div class="ove-gq-r">${body}${hint ? `<p class="ove-gq-hint">${hint}</p>` : ''}</div></div>`;
  return `<div class="ove-gdrawer">
    ${row('Qué cuenta', `<div class="seg">${Object.entries(TYPE_NAMES).map(([v, n]) => `<button type="button" data-gset="type" data-v="${v}" aria-pressed="${g.type === v}">${n}</button>`).join('')}</div>`)}
    ${row('De dónde', `<div class="ove-gplats">${GOAL_PLATS.map(([v, n]) => `<button type="button" class="ove-gplat" data-gset="platform" data-v="${v}" aria-pressed="${p === v}">${platLogo(v, 'ove-gpl sm')}${n}</button>`).join('')}</div>
      ${p === 'all' ? `<div class="ove-gsum"><span>Sumar</span>${GOAL_PLATS.slice(1).map(([v, n]) => `<label class="chip-check"><input type="checkbox" data-gsum="${v}" ${chosen.has(v) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>` : ''}`)}
    ${isFollow ? row('Cómo cuenta', `<div class="ove-gsrc">${Object.entries(SOURCE_INFO).map(([v, [n, d]]) => `<button type="button" data-gset="source" data-v="${v}" aria-pressed="${src === v}"><b>${n}</b><small>${d}</small></button>`).join('')}</div>`) : ''}
    ${src === 'account' ? '' : row('Vuelve a empezar', `<div class="seg">${PERIOD_INFO.map(([v, n]) => `<button type="button" data-gset="period" data-v="${v}" aria-pressed="${(g.period || 'none') === v}">${n}</button>`).join('')}</div>
      ${g.period === 'week' ? `<div class="ove-gweek"><span>La semana empieza el</span><div class="seg">${[[1, 'Lunes'], [0, 'Domingo']].map(([v, n]) => `<button type="button" data-gset="weekStart" data-v="${v}" aria-pressed="${(g.weekStart === 0 ? 0 : 1) === v}">${n}</button>`).join('')}</div></div>` : ''}`,
      g.period === 'stream' ? 'Con TikTok y Kick empieza sola cuando sales en vivo. En Starvios, usa ↺ al empezar.' : g.period && g.period !== 'none' ? 'Usa la hora de tu PC. ↺ la reinicia cuando quieras.' : '')}
    ${row('Color', `<div class="ove-gswatches"><button type="button" class="ove-gsw theme" data-gset="color" data-v="" aria-pressed="${!g.color}" title="El color del tema">Tema</button>${SWATCHES.map((c) => `<button type="button" class="ove-gsw" data-gset="color" data-v="${c}" aria-pressed="${g.color === c}" style="--c:${c}" title="${c}"></button>`).join('')}<label class="ove-gsw custom" title="Otro color"><input type="color" data-gcolor value="${esc(g.color || '#ffb23e')}">＋</label></div>`)}
    ${accountLines(g)}
  </div>`;
}

function goalsHTML() {
  const hidden = editing.w.settings.hidden || [];
  const rows = goals.map((g) => {
    const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
    const off = hidden.includes(g.id);
    const open = goalOpen.has(g.id);
    const p = g.platform || 'all';
    return `<div class="ove-goal ${off ? 'off' : ''} ${open ? 'open' : ''}" data-goal="${esc(g.id)}" style="${g.color ? `--gc:${esc(g.color)}` : ''}">
      <div class="ove-grow">
        <button type="button" class="ove-eye" data-geye title="${off ? 'Mostrar en este overlay' : 'Ocultar en este overlay'}" aria-label="${off ? 'Mostrar en este overlay' : 'Ocultar en este overlay'}">${off ? '◌' : '◉'}</button>
        ${platLogo(p)}
        <div class="ove-gmain"><input class="ove-gtitle" data-gtitle value="${esc(g.title)}" aria-label="Nombre de la meta"><small>${esc(goalSummary(g))}</small></div>
        <b class="ove-gpct">${Math.floor(pct)}%</b>
        <div class="ove-gact">
          <button type="button" class="btn small ${open ? 'primary' : 'ghost'} ove-gtoggle" data-gopen aria-expanded="${open}">⚙ Ajustar</button>
          <button type="button" class="btn small ghost" data-greset title="Empezar de nuevo" aria-label="Empezar de nuevo">↺</button>
          <button type="button" class="btn small ghost danger" data-gdel title="Eliminar" aria-label="Eliminar">✕</button>
        </div>
      </div>
      <div class="ove-grow2">
        <div class="ove-gbar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="ove-gnums">
          <button type="button" class="btn small ghost" data-gstep="-1" aria-label="Restar 1">−</button>
          <label class="ove-gnum" title="Escribe cuánto llevas"><small>Llevas</small><input type="number" min="0" value="${g.current}" data-gcurrent></label>
          <button type="button" class="btn small ghost" data-gstep="1" aria-label="Sumar 1">+</button>
          <span class="ove-gof">de</span>
          <label class="ove-gnum" title="El objetivo"><small>Meta</small><input type="number" min="1" value="${g.target}" data-gtarget></label>
        </div>
      </div>
      ${open ? goalDrawer(g) : ''}</div>`;
  }).join('');
  return `<p class="hint">El ojo decide si la meta sale en <b>este</b> overlay. En <b>⚙ Ajustar</b> eliges de dónde cuenta, si lee el total de tu cuenta y cuándo vuelve a empezar.</p>
    <div class="ove-goals">${rows || '<p class="hint">Aún no tienes metas. Crea la primera aquí abajo.</p>'}</div>
    <form class="ove-newgoal" id="ove-newgoal">
      <label class="field"><span>Nombre</span><input name="title" placeholder="Ej.: Seguidores de Kick" required maxlength="40"></label>
      <label class="field"><span>Qué cuenta</span><select name="type">${Object.entries(TYPE_NAMES).map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
      <label class="field"><span>De dónde</span><select name="platform">${GOAL_PLATS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
      <label class="field"><span>Meta</span><input name="target" type="number" min="1" value="100"></label>
      <button class="btn primary">Crear meta</button></form>`;
}

// --- Contadores ---
function countersHTML() {
  const hidden = editing.w.settings.hidden || [];
  const list = live.counters || config.counters || [];
  return `<p class="hint">Se mueven con un comando del chat (tú y tus moderadores, o cualquiera si lo marcas), con un regalo o desde aquí.</p>
    <div class="ove-counters">${list.map((c) => `<div class="ove-counter ${hidden.includes(c.id) ? 'off' : ''}" data-counter="${esc(c.id)}">
      <div class="ove-crow"><button type="button" class="ove-eye" data-ceye title="Mostrar u ocultar en este overlay">${hidden.includes(c.id) ? '◌' : '◉'}</button>
        <input class="ove-cicon" data-c="icon" value="${esc(c.icon || '')}" maxlength="4" aria-label="Ícono"><input class="ove-cname" data-c="name" value="${esc(c.name)}" maxlength="30" aria-label="Nombre">
        <button type="button" class="btn small ghost" data-cstep="-1">−</button><b class="ove-cval">${c.value || 0}</b><button type="button" class="btn small ghost" data-cstep="1">+</button>
        <button type="button" class="btn small ghost" data-creset title="Volver a cero">↺</button><button type="button" class="btn small ghost danger" data-cdel title="Eliminar">✕</button></div>
      <div class="ove-cmore"><label>Comando <span class="ove-cmd">!<input data-c="command" value="${esc(c.command || '')}" maxlength="20"></span></label>
        <label>Regalo <input data-c="gift" list="dl-gifts" value="${esc(c.gift || '')}" placeholder="Rosa" maxlength="40"></label>
        <label>Suma <input type="number" data-c="step" value="${c.step || 1}" min="1"></label>
        <label>Tope <input type="number" data-c="goal" value="${c.goal || ''}" min="0" placeholder="—"></label>
        <label class="switch"><input type="checkbox" data-c="anyone" ${c.anyone ? 'checked' : ''}><span></span> <em class="sw-t">Cualquiera puede usar el comando</em></label></div>
    </div>`).join('') || '<p class="hint">No hay contadores.</p>'}</div>
    <button type="button" class="btn small primary mt" data-cadd>+ Nuevo contador</button>`;
}
function saveCounters(list) {
  api('POST', '/api/live/counters', { counters: list }).catch((e) => toast(e.message));
}

// --- Cuenta regresiva ---
function clockLeft() {
  const c = live.countdown || {};
  return c.running ? Math.max(0, c.endsAt - Date.now()) : c.left || 0;
}
const hms = (ms) => { const t = Math.floor(ms / 1000); return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
function clockHTML() {
  const run = live.countdown?.running;
  return `<div class="ove-clock"><b id="ove-clock">${hms(clockLeft())}</b><span class="ove-state ${run ? 'on' : ''}">${run ? 'Corriendo' : 'En pausa'}</span></div>
    <div class="row wrap" style="gap:8px;justify-content:center"><button type="button" class="btn primary" data-cd="${run ? 'pause' : 'start'}">${run ? '⏸ Pausar' : '▶ Empezar'}</button>
      <button type="button" class="btn small ghost" data-cdadd="-60">−1 min</button><button type="button" class="btn small ghost" data-cdadd="60">+1 min</button><button type="button" class="btn small ghost" data-cdadd="300">+5 min</button><button type="button" class="btn small ghost" data-cdadd="1800">+30 min</button></div>
    <form class="ove-cdset" id="ove-cdset"><span>Poner en</span><input type="number" name="h" min="0" max="99" value="1" aria-label="Horas"> h <input type="number" name="m" min="0" max="59" value="0" aria-label="Minutos"> min <button class="btn small">Poner</button></form>
    ${ratesHTML()}`;
}

// --- Cuánto suma cada cosa (el streamer decide cuánto «cobra») ---
const RATE_PLATS = [['tiktok', 'TikTok', 'moneda', 'monedas'], ['kick', 'Kick', 'Kick', 'Kicks'], ['twitch', 'Twitch', 'bit', 'bits'], ['starvios', 'Starvios', 'punto', 'puntos']];
const dur = (sec) => {
  sec = Math.round(sec);
  if (sec < 60) return `${sec} s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min${sec % 60 ? ` ${sec % 60} s` : ''}`;
  return `${Math.floor(sec / 3600)} h${Math.floor((sec % 3600) / 60) ? ` ${Math.floor((sec % 3600) / 60)} min` : ''}`;
};
function ratesHTML() {
  const s = editing.w.settings;
  const r = s.rates || {};
  const tk = r.tiktok?.perUnit ?? 10;
  const sample = [[1, 'una Rosa'], [99, 'algo de 99'], [1000, 'una Galaxia'], [29999, 'un León']].map(([c, n]) => `<span><b>${dur(c * tk)}</b> por ${n} (${nf.format(c)})</span>`).join('');
  const num = (path, v, extra = '') => `<input type="number" min="0" step="any" data-cr="${path}" value="${esc(v ?? 0)}" ${extra}>`;
  return `<section class="ove-rates"><h4>¿Cuánto tiempo suma cada cosa?</h4>
    <p class="hint">Tú decides cuánto «cobra» tu cuenta regresiva. Pon 0 en lo que no quieras que sume.</p>
    <label class="switch"><input type="checkbox" data-cr="autoAdd" ${s.autoAdd !== false ? 'checked' : ''}><span></span> <em class="sw-t">Que tu público sume tiempo</em></label>
    <div class="ove-rate-grid ${s.autoAdd === false ? 'off' : ''}">
      <div class="ove-rate-head"><span>Regalos</span><span>Segundos por cada</span><span>Desde</span></div>
      ${RATE_PLATS.map(([p, name, one, many]) => { const x = r[p] || {}; return `<div class="ove-rate"><label class="ove-plat"><input type="checkbox" data-cr="rates.${p}.on" ${x.on !== false ? 'checked' : ''}><img src="/img/platforms/${p}.png" alt="">${name}</label>
        <span class="ove-rate-in">${num(`rates.${p}.perUnit`, x.perUnit ?? (p === 'tiktok' ? 10 : 0))} s / ${one}</span>
        <span class="ove-rate-in">${num(`rates.${p}.minUnits`, x.minUnits ?? 1)} ${many}</span></div>`; }).join('')}
      <p class="ove-rate-sample">TikTok: ${sample}</p>
      <h5>Regalos con su propio precio</h5>
      <div class="ove-gr-list">${(s.giftRules || []).map((g, i) => `<div class="ove-gr" data-gr="${i}"><input list="dl-gifts" data-grk="gift" value="${esc(g.gift || '')}" placeholder="Nombre del regalo (ej. Rosa)">
        <select data-grk="platform">${[['any', 'Cualquiera'], ...RATE_PLATS.map(([p, n]) => [p, n])].map(([v, n]) => `<option value="${v}" ${(g.platform || 'any') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <span class="ove-rate-in">+<input type="number" min="0" step="any" data-grk="seconds" value="${esc(g.seconds ?? 60)}"> s c/u</span>
        <label class="ove-gr-plus" title="Además de este tiempo, suma lo normal por su valor"><input type="checkbox" data-grk="plus" ${g.plus ? 'checked' : ''}> + su valor</label>
        <button type="button" class="btn small ghost danger" data-grdel title="Quitar">✕</button></div>`).join('') || '<p class="hint">Ninguno. Ejemplo: «Rosa = 1 minuto» aunque valga 1 moneda.</p>'}</div>
      <button type="button" class="btn small" data-gradd>+ Ponerle precio a un regalo</button>
      <h5>Comunidad</h5>
      <div class="ove-rate-more">
        <label>Seguidor nuevo <span class="ove-rate-in">+${num('perFollow', s.perFollow)} s</span></label>
        <label>Suscripción <span class="ove-rate-in">+${num('perSub', s.perSub ?? 60)} s</span></label>
        <label>Compartido <span class="ove-rate-in">+${num('perShare', s.perShare)} s</span></label>
        <label>Cada ${num('likesEvery', s.likesEvery ?? 100, 'min="1"')} likes <span class="ove-rate-in">+${num('likesSeconds', s.likesSeconds ?? s.per100Likes ?? 0)} s</span></label>
      </div>
      <h5>Límites</h5>
      <div class="ove-rate-more">
        <label>Tope (nunca más de) <span class="ove-rate-in">${num('maxMin', s.maxMin)} min por delante</span><small>0 = sin tope</small></label>
        <label>Comando para moderadores <span class="ove-cmd">!<input data-cr="modCommand" value="${esc(s.modCommand ?? 'tiempo')}" maxlength="20"></span><small>!${esc(s.modCommand || 'tiempo')} +5m · -30s · 1h</small></label>
      </div>
    </div></section>`;
}

// --- Guardar ---
let saveTimer = 0;
function commit({ redraw = false } = {}) {
  pushPreview();
  clearTimeout(saveTimer);
  const { id, w } = editing;
  saveTimer = setTimeout(() => {
    widgets[id] = JSON.parse(JSON.stringify(w));
    saveConfig({ widgets: { [id]: widgets[id] } });
  }, 250);
  if (redraw) renderPanel();
}

function onEditorInput(ev) {
  const el = ev.target;
  if (!editing) return;
  const s = editing.w.settings;
  if (el.id === 'ove-name') { editing.w.name = el.value.trim() || KINDS[editing.w.kind].name; $('#ove-crumb-name').textContent = editing.w.name; return commit(); }
  if (el.dataset.f) {
    const fd = KINDS[editing.w.kind].fields.find((x) => x.k === el.dataset.f);
    if (fd.t === 'plats') {
      const set = new Set(s[fd.k] || []);
      if (el.checked) set.add(el.dataset.p); else set.delete(el.dataset.p);
      s[fd.k] = [...set];
    } else if (fd.t === 'toggle') s[fd.k] = el.checked;
    else if (fd.t === 'range' || fd.t === 'number') s[fd.k] = Number(el.value);
    else s[fd.k] = el.value;
    const rv = el.closest('.field')?.querySelector('.ove-rv');
    if (rv) rv.textContent = `${el.value}${fd.unit || ''}`;
    // Si este ajuste muestra u oculta otros, se redibuja el panel.
    const redraw = KINDS[editing.w.kind].fields.some((x) => x.when && fd.k in x.when);
    return commit({ redraw: redraw && ev.type === 'change' });
  }
  if (el.dataset.l) {
    const v = el.type === 'range' ? Number(el.value) : el.value;
    editing.w.look = { ...editing.w.look, [el.dataset.l]: v };
    if (el.type === 'range') el.closest('.field').querySelector('.ove-rv').textContent = `${Math.round(v * 100)}%`;
    commit();
    if (el.type === 'color') { const b = el.parentElement.querySelector('[data-lclear]'); if (b) b.disabled = false; }
  }
}

async function onEditorClick(ev) {
  const t = ev.target;
  const b = t.closest('button, [data-crumb-cat]');
  if (!b || !editing) return;
  const { id } = editing;
  const s = editing.w.settings;
  try {
    if (b.dataset.back !== undefined) return go('galeria');
    if (b.dataset.crumbCat) { filter = b.dataset.crumbCat; return go('galeria'); }
    if (b.dataset.pin) return togglePin(b.dataset.pin);
    if (b.dataset.etab) { editing.tab = b.dataset.etab; return renderTabs(); }
    if (b.dataset.real) { editing.real = b.dataset.real === '1'; return setFrame(); }
    if (b.dataset.bg) { $('.ove-stage').dataset.bg = b.dataset.bg; b.parentElement.querySelectorAll('[data-bg]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return; }
    if (b.dataset.copyUrl !== undefined) {
      await navigator.clipboard.writeText(urlOf(id)).catch(() => { throw new Error('No se pudo copiar: selecciónala a mano'); });
      guideToast(catOf(editing.w.kind).guide, 'URL copiada. En OBS: Fuentes → + → Navegador, y pégala.');
      return markStep('overlay');
    }
    if (b.dataset.openUrl !== undefined) return window.open(urlOf(id), '_blank');
    if (b.dataset.resetPodium !== undefined) { await api('POST', '/api/podium/reset'); return guideToast('troya', 'Ranking en cero. Que empiece la competencia.'); }
    if (b.dataset.dup !== undefined) {
      let n = 2;
      while (widgets[`${editing.w.kind}-${n}`]) n += 1;
      const nid = `${editing.w.kind}-${n}`;
      widgets[nid] = { ...JSON.parse(JSON.stringify(editing.w)), name: `${editing.w.name} ${n}` };
      saveConfig({ widgets: { [nid]: widgets[nid] } });
      guideToast(catOf(editing.w.kind).guide, 'Copia lista. Tiene su propia URL, así puedes tener dos con estilos distintos.');
      return go(nid);
    }
    if (b.dataset.del !== undefined) {
      const base = Boolean(KINDS[id]);
      if (!confirm(base ? `¿Volver «${editing.w.name}» a como venía?` : `¿Eliminar «${editing.w.name}»? Si está en OBS, dejará de verse.`)) return;
      await api('DELETE', `/api/widgets/${encodeURIComponent(id)}`);
      delete widgets[id];
      if (!base) { pins = pins.filter((x) => x !== id); saveConfig({ profile: { pinnedWidgets: pins } }); return go('galeria'); }
      editing = null;
      return openEditor(id);
    }
    if (b.dataset.style) { editing.w.style = b.dataset.style; for (const x of $$('[data-style]')) x.setAttribute('aria-pressed', String(x === b)); return commit(); }
    if (b.dataset.ltheme !== undefined) {
      const th = THEMES.find((x) => x.id === b.dataset.ltheme);
      // El tema no toca el fondo: si elegiste «Sin fondo», se queda sin fondo.
      const keepCard = editing.w.look?.card ?? '';
      if (th) { const { card: _c, ...rest } = th.set; editing.w.look = { theme: th.id, ...rest, card: keepCard }; } else editing.w.look = keepCard ? { card: keepCard } : {};
      return commit({ redraw: true });
    }
    if (b.dataset.lclear) { editing.w.look = { ...editing.w.look, [b.dataset.lclear]: '' }; return commit({ redraw: true }); }
    if (b.dataset.laccent) { editing.w.look = { ...editing.w.look, accent: b.dataset.laccent }; return commit({ redraw: true }); }
    if (b.dataset.f && b.dataset.v !== undefined) {
      const fd = KINDS[editing.w.kind].fields.find((x) => x.k === b.dataset.f);
      const raw = b.dataset.v;
      s[fd.k] = typeof KINDS[editing.w.kind].defaults[fd.k] === 'number' ? Number(raw) : raw;
      return commit({ redraw: true });
    }
    // Metas
    const gRow = b.closest('[data-goal]');
    if (gRow) {
      const gid = gRow.dataset.goal;
      const g = goals.find((x) => x.id === gid);
      const patch = (body) => api('PATCH', `/api/goals/${encodeURIComponent(gid)}`, body);
      if (b.dataset.geye !== undefined) { const h = new Set(s.hidden || []); if (h.has(gid)) h.delete(gid); else h.add(gid); s.hidden = [...h]; return commit({ redraw: true }); }
      if (b.dataset.gopen !== undefined) { if (goalOpen.has(gid)) goalOpen.delete(gid); else goalOpen.add(gid); return renderPanel(); }
      if (b.dataset.gset) {
        const k = b.dataset.gset;
        const v = k === 'weekStart' ? Number(b.dataset.v) : b.dataset.v;
        const body = { [k]: v };
        if (k === 'type') body.countBy = v === 'gift' || v === 'like' ? 'amount' : 'events';
        if (k === 'source' && v === 'account') body.period = 'none';
        if (k === 'platform' && v !== 'all') body.platforms = [];
        await patch(body);
        if (k === 'source' && v !== 'events') api('POST', '/api/account-stats/refresh').catch(() => {});
        return;
      }
      if (b.dataset.gread !== undefined) { b.disabled = true; try { const r = await api('POST', '/api/account-stats/refresh'); setAccountStats(r.stats); } finally { b.disabled = false; } return; }
      if (b.dataset.gstep) await patch({ current: Math.max(0, g.current + Number(b.dataset.gstep)) });
      if (b.dataset.greset !== undefined) {
        await patch({ reset: true });
        guideToast('juana', g.source === 'account' ? 'Esta meta muestra el total de tu cuenta: se vuelve a leer, no empieza en cero.' : 'La meta empezó de nuevo.');
      }
      if (b.dataset.gdel !== undefined && confirm(`¿Eliminar la meta «${g.title}»?`)) await api('DELETE', `/api/goals/${encodeURIComponent(gid)}`);
      return;
    }
    // Contadores
    const cRow = b.closest('[data-counter]');
    const list = (live.counters || config.counters || []).map((c) => ({ ...c }));
    if (cRow) {
      const cid = cRow.dataset.counter;
      if (b.dataset.ceye !== undefined) { const h = new Set(s.hidden || []); if (h.has(cid)) h.delete(cid); else h.add(cid); s.hidden = [...h]; return commit({ redraw: true }); }
      if (b.dataset.cstep) return api('POST', `/api/live/counter/${encodeURIComponent(cid)}`, { delta: Number(b.dataset.cstep) });
      if (b.dataset.creset !== undefined) return api('POST', `/api/live/counter/${encodeURIComponent(cid)}`, { set: 0 });
      if (b.dataset.cdel !== undefined && confirm('¿Eliminar este contador?')) return saveCounters(list.filter((c) => c.id !== cid));
      return;
    }
    if (b.dataset.cadd !== undefined) {
      let n = list.length + 1;
      while (list.some((c) => c.id === `contador-${n}`)) n += 1;
      list.push({ id: `contador-${n}`, name: `Contador ${n}`, icon: '⭐', value: 0, step: 1, command: `c${n}`, gift: '', anyone: false });
      return saveCounters(list);
    }
    if (b.dataset.gradd !== undefined) { s.giftRules = [...(s.giftRules || []), { gift: '', platform: 'any', seconds: 60, plus: false }]; return commit({ redraw: true }); }
    if (b.dataset.grdel !== undefined) { const i = Number(b.closest('[data-gr]').dataset.gr); s.giftRules = (s.giftRules || []).filter((_, j) => j !== i); return commit({ redraw: true }); }
    // Cuenta regresiva
    if (b.dataset.cd) return api('POST', '/api/live/countdown', { action: b.dataset.cd });
    if (b.dataset.cdadd) return api('POST', '/api/live/countdown', { action: 'add', value: Number(b.dataset.cdadd) });
  } catch (e) {
    toast(e.message);
  }
}

function onEditorChange(ev) {
  const el = ev.target;
  if (!editing) return;
  if (el.dataset.cr) {
    const path = el.dataset.cr.split('.');
    const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) || 0 : el.value.trim().replace(/^!/, '');
    const st = editing.w.settings;
    if (path[0] === 'rates') {
      const def = KINDS.countdown.defaults.rates;
      st.rates = JSON.parse(JSON.stringify(st.rates || def));
      st.rates[path[1]] = { ...(def[path[1]] || {}), ...(st.rates[path[1]] || {}), [path[2]]: v };
    } else st[path[0]] = v;
    return commit({ redraw: path[0] === 'autoAdd' || path[2] === 'perUnit' || path[0] === 'modCommand' });
  }
  const gr = el.closest('[data-gr]');
  if (gr && el.dataset.grk) {
    const list = [...(editing.w.settings.giftRules || [])];
    const i = Number(gr.dataset.gr);
    list[i] = { ...list[i], [el.dataset.grk]: el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) || 0 : el.value.trim() };
    editing.w.settings.giftRules = list;
    return commit();
  }
  const gRow = el.closest('[data-goal]');
  if (gRow && (el.dataset.gtitle !== undefined || el.dataset.gtarget !== undefined || el.dataset.gcurrent !== undefined || el.dataset.gcolor !== undefined || el.dataset.gsum !== undefined)) {
    const gid = gRow.dataset.goal;
    if (el.dataset.gsum !== undefined) {
      const picked = [...gRow.querySelectorAll('[data-gsum]')].filter((x) => x.checked).map((x) => x.dataset.gsum);
      if (!picked.length) { el.checked = true; return toast('Deja al menos una plataforma'); }
      return api('PATCH', `/api/goals/${encodeURIComponent(gid)}`, { platforms: picked.length === GOAL_PLATS.length - 1 ? [] : picked }).catch((e) => toast(e.message));
    }
    const body = el.dataset.gtitle !== undefined ? { title: el.value.trim() || 'Meta' }
      : el.dataset.gtarget !== undefined ? { target: Math.max(1, Number(el.value) || 1) }
      : el.dataset.gcurrent !== undefined ? { current: Math.max(0, Number(el.value) || 0) }
      : { color: el.value };
    return api('PATCH', `/api/goals/${encodeURIComponent(gid)}`, body).catch((e) => toast(e.message));
  }
  if (el.dataset.c) {
    const cid = el.closest('[data-counter]').dataset.counter;
    const list = (live.counters || config.counters || []).map((c) => ({ ...c }));
    const c = list.find((x) => x.id === cid);
    const k = el.dataset.c;
    c[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value.trim().replace(/^!/, '');
    return saveCounters(list);
  }
  onEditorInput(ev);
}

async function onEditorSubmit(ev) {
  ev.preventDefault();
  const f = Object.fromEntries(new FormData(ev.target));
  try {
    if (ev.target.id === 'ove-newgoal') {
      const r = await api('POST', '/api/goals', { title: f.title, type: f.type, target: Number(f.target) || 10, platform: f.platform || 'all', countBy: f.type === 'gift' || f.type === 'like' ? 'amount' : 'events' });
      // Recién creada: abre sus ajustes para terminar de elegir cómo cuenta.
      if (r.goal?.id) { goalOpen.add(r.goal.id); renderPanel(); }
      guideToast('juana', 'Meta creada. En «⚙ Ajustar» eliges cómo cuenta y cuándo vuelve a empezar.');
    }
    if (ev.target.id === 'ove-cdset') await api('POST', '/api/live/countdown', { action: 'set', value: (Number(f.h) || 0) * 3600 + (Number(f.m) || 0) * 60 });
  } catch (e) {
    toast(e.message);
  }
}

// ---------- Overlays clásicos ----------
function renderClassic() {
  const list = [
    { name: 'Alertas', path: '/overlays/alerts.html', note: 'Regalos, stickers, seguidores y tus alertas propias', w: 800, h: 300 },
    ...goals.map((g) => ({ name: `Meta: ${g.title}`, path: `/overlays/goal.html?id=${encodeURIComponent(g.id)}`, note: 'Barra de una sola meta', w: 700, h: 140 })),
  ];
  $('#overlay-list').innerHTML = list.map((it) => `<div class="ovg-crow"><b>${esc(it.name)}<small>${it.w} × ${it.h} · ${esc(it.note)}</small></b><code>${esc(origin() + it.path)}</code><button type="button" class="btn small ghost" data-copy="${esc(origin() + it.path)}">Copiar</button><button type="button" class="btn small ghost" data-copy="${esc(tiktokUrl(it.path))}" data-tt title="Enlace https para TikTok LIVE Studio">TikTok</button></div>`).join('');
}

// ---------- Estilo general ----------
function fill() {
  for (const el of $$('[data-ov]')) {
    const v = style[el.dataset.ov];
    if (el.type === 'checkbox') el.checked = Boolean(v);
    else el.value = v;
  }
  $('#ov-scale-val').textContent = `${Math.round(style.scale * 100)}%`;
  for (const b of $$('[data-theme-pick]')) b.setAttribute('aria-pressed', String(b.dataset.themePick === (style.theme || 'satronho')));
  for (const b of $$('#ov-swatches [data-ov-accent]')) b.setAttribute('aria-pressed', String(b.dataset.ovAccent === style.accent));
}
function setStyle(patch) {
  Object.assign(style, patch);
  fill();
  pushStyle();
  saveConfig({ overlayStyle: patch });
}
function renderThemes() {
  $('#ov-themes').innerHTML = THEMES.map((t) => `<button type="button" class="ov-theme" data-theme-pick="${t.id}" title="${esc(t.desc)}">
    <span class="ov-tprev" style="--tb:${t.bg};--tf:${t.fg};--td:${t.bd};font-family:'${esc(FONTS.find((f) => f.id === t.set.font)?.family || 'inherit')}'" data-k="${t.glow ? 'glow' : t.dashed ? 'dashed' : t.hard ? 'hard' : t.line ? 'line' : /gradient/.test(t.bg) ? 'grad' : ''}">${t.guide ? `<span class="ov-tguide">${avatarHTML(t.guide, 'xs')}</span>` : `<i>${t.id === 'colonizadora' ? '♡' : '♥'}</i>`}<b>Satronho</b></span>
    <span class="ov-tname">${esc(t.name)}</span></button>`).join('');
}

// ---------- Datos que llegan del servidor ----------
export function setOverlayGoals(list) {
  goals = list;
  renderClassic();
  if (editing?.tab !== 'metas') return;
  // Mientras escribes en una meta o en «Crear meta» no se redibuja (perderías
  // lo escrito); al salir del campo se pone al día.
  const a = document.activeElement;
  if (a && $('#ove-panel')?.contains(a) && /^(INPUT|SELECT)$/.test(a.tagName)) {
    if (!a.dataset.goalsWait) { a.dataset.goalsWait = '1'; a.addEventListener('blur', () => { delete a.dataset.goalsWait; setTimeout(() => editing?.tab === 'metas' && !$('#ove-panel')?.contains(document.activeElement) && renderPanel(), 0); }, { once: true }); }
    return;
  }
  renderPanel();
}
export function setAccountStats(s) {
  accountStats = s || {};
  if (editing?.tab === 'metas' && goalOpen.size && !$('#ove-panel')?.contains(document.activeElement)) renderPanel();
}
export function setOverlayLive(p) {
  live = p || {};
  if (!editing) return;
  if (editing.tab === 'contadores' && !$('#ove-panel').contains(document.activeElement)) renderPanel();
  if (editing.tab === 'reloj') {
    const run = Boolean(live.countdown?.running);
    const btn = $('[data-cd]');
    if (btn && (btn.dataset.cd === 'pause') !== run) renderPanel();
  }
}
export function setOverlayWidgets(all) {
  widgets = { ...(all || {}) };
  if (!editing) renderGallery();
}

function go(id) {
  showPage('overlays', id);
  history.replaceState(null, '', `#/overlays/${encodeURIComponent(id)}`);
  route();
}

// Abre el editor según la URL: #/overlays/<id>.
function route() {
  const [, page, sub] = location.hash.match(/^#\/([^/]+)(?:\/([^/?]+))?/) || [];
  if (page !== 'overlays') return;
  const id = sub ? decodeURIComponent(sub) : '';
  if (id && id !== 'galeria' && id !== 'estilo' && widgetOf(id)) {
    if (editing?.id !== id) { editing = null; openEditor(id); }
    for (const b of $$('#page-overlays [data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === 'galeria'));
    for (const p of $$('#page-overlays [data-tabpanel]')) p.hidden = p.dataset.tabpanel !== 'galeria';
  } else if (editing && id !== 'estilo') closeEditor();
  renderNavPins();
}

export function initOverlays(cfg) {
  config = cfg;
  style = { ...DEFAULT, ...(cfg.overlayStyle || {}) };
  widgets = { ...(cfg.widgets || {}) };
  pins = (cfg.profile?.pinnedWidgets || []).filter((x) => typeof x === 'string');
  // Arreglo 0.19: antes, elegir un tema en un overlay le ponía «fondo sólido»
  // y tapaba el «Sin fondo» del estilo general. Se quita ese fondo heredado.
  const fixed = {};
  for (const [id, w] of Object.entries(widgets)) {
    const th = THEMES.find((x) => x.id === w?.look?.theme);
    if (th && w.look.card && w.look.card === th.set.card) { w.look = { ...w.look, card: '' }; fixed[id] = w; }
  }
  if (Object.keys(fixed).length) saveConfig({ widgets: fixed });
  $('#ovg-hosts').innerHTML = `<div class="ovg-team" title="Cada guía cuida su parte de los overlays">${['juana', 'troya', 'mechanizer', 'mecha', 'nono', 'samy'].map((g) => `<span title="${esc(GUIDES[g].name)}">${avatarHTML(g, 'md')}</span>`).join('')}</div>`;

  // Estilo general
  renderThemes();
  $('#ov-themes').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-theme-pick]');
    if (!b) return;
    const t = THEMES.find((x) => x.id === b.dataset.themePick);
    setStyle({ theme: t.id, ...t.set });
    guideToast('samy', `Tema «${t.name}» en todos tus overlays. Puedes ajustar la letra y los colores al lado.`);
  });
  $('[data-ov="font"]').innerHTML = FONTS.map((f) => `<option value="${f.id}" style="font-family:'${esc(f.family)}'">${esc(f.name)}</option>`).join('');
  $('#ov-swatches').innerHTML = ACCENTS.map((c) => `<button type="button" class="swatch" data-ov-accent="${c}" style="background:${c};width:26px;height:26px" title="${c}"></button>`).join('');
  fill();
  for (const el of $$('[data-ov]')) {
    const evn = el.type === 'range' || el.type === 'color' ? 'input' : 'change';
    el.addEventListener(evn, () => setStyle({ [el.dataset.ov]: el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value }));
  }
  $('#ov-swatches').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ov-accent]');
    if (b) setStyle({ accent: b.dataset.ovAccent });
  });
  $('#ov-reset').addEventListener('click', () => setStyle({ ...DEFAULT }));

  // Galería
  $('#ovg-cats').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-cat]');
    if (b) { filter = b.dataset.cat; renderGallery(); }
  });
  $('#ovg-q').addEventListener('input', (ev) => {
    query = ev.target.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    renderGallery();
  });
  $('#ovg').addEventListener('click', async (ev) => {
    const pin = ev.target.closest('[data-pin]');
    if (pin) { ev.stopPropagation(); return togglePin(pin.dataset.pin); }
    const copy = ev.target.closest('[data-copy]');
    if (copy) {
      await copyLink(copy);
      return;
    }
    if (ev.target.closest('[data-go-alerts]')) return showPage('alertas');
    const c = ev.target.closest('[data-open-w]');
    if (c) go(c.dataset.openW);
  });
  $('#ovg').addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const c = ev.target.closest('[data-open-w]');
    if (c) go(c.dataset.openW);
  });

  $('#page-overlays [data-tab="galeria"]').addEventListener('click', () => { if (editing) closeEditor(); });

  // Editor
  const ove = $('#ove');
  ove.addEventListener('click', onEditorClick);
  ove.addEventListener('input', (ev) => { if (!ev.target.dataset.c && !ev.target.closest('[data-goal], #ove-newgoal') && ev.target.type !== 'checkbox') onEditorInput(ev); });
  ove.addEventListener('change', onEditorChange);
  ove.addEventListener('submit', onEditorSubmit);

  initNavTree();
  renderSectionLinks();
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => fitAll($('#page-overlays')));
  onPageChange((p) => {
    if (p === 'overlays') requestAnimationFrame(() => { route(); fitAll($('#page-overlays')); });
    else renderNavPins();
  });
  // El reloj del editor se mueve solo.
  setInterval(() => { const el = $('#ove-clock'); if (el) el.textContent = hms(clockLeft()); }, 500);
  renderGallery();
  renderClassic();
  route();
}
