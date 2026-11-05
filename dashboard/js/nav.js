// Navegación del panel: menú lateral, pestañas, buscador (Ctrl K),
// menú Simular, contador de eventos y «Primeros pasos» con Samy.

import { $, $$, api, esc, toast, saveConfig } from './util.js';
import { openHelp, _test as helpKb } from './help.js';
import { GUIDES, avatarHTML } from './guides.js';

// Iconos propios, trazo fino.
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  plug: '<path d="M9 3v5M15 3v5"/><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.5V21"/>',
  chat: '<path d="M4 5.5h16v10H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  send: '<path d="M20.5 3.5 3.5 10.5l7 3 3 7z"/><path d="m10.5 13.5 4-4"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6"/><path d="M10 9.5a2 2 0 0 1 4 0c0 1.2-1 1.6-1 2.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  layers: '<path d="m12 4 9 4.5-9 4.5-9-4.5z"/><path d="m3 13 9 4.5 9-4.5"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7 10 3 2.5L7 15M12.5 15H17"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m12 8 1.4 2.6L16 12l-2.6 1.4L12 16l-1.4-2.6L8 12l2.6-1.4z"/>',
  pin: '<path d="M4 6h16M4 12h10M4 18h16"/><path d="m17 9 3 3-3 3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="13.4" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none"/>',
  next: '<path d="M6 5.5v13l9-6.5z" fill="currentColor" stroke="none"/><rect x="16" y="5.5" width="2.6" height="13" rx="1" fill="currentColor" stroke="none"/>',
  shuffle: '<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.6M14 9.6c.9-1.4 1.9-2.6 3.5-2.6H20"/><path d="m18 5 2 2-2 2M18 15l2 2-2 2"/>',
  save: '<path d="M5 4.5h11l3 3V19.5H5z"/><path d="M8 4.5v5h7v-5M8 19.5v-6h8v6"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>',
  volume: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><path d="M12 17h.01"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  'mic-off': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/><path d="M4 4l16 16"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4v4.5h4.5"/>',
  flag: '<path d="M5.5 21V4.5"/><path d="M5.5 4.5h11l-2 4 2 4h-11"/>',
  door: '<path d="M14 4.5H6.5v15H14"/><path d="M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5"/>',
  filter: '<path d="M4 5.5h16l-6 7.5v5l-4 2v-7z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  move: '<path d="M12 3v18M3 12h18"/><path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  dock: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M15.5 4.5v15"/>',
  trophy: '<path d="M8 4.5h8v5a4 4 0 0 1-8 0z"/><path d="M8 6.5H5a3 3 0 0 0 3 3.5M16 6.5h3a3 3 0 0 1-3 3.5"/><path d="M12 13.5v3M8.5 20h7M9.5 16.5h5V20h-5z"/>',
  skipSong: '<path d="M9 18V7l7-1.5"/><circle cx="6.5" cy="18" r="2.5"/><path d="m16 11 4 3-4 3z" fill="currentColor"/>',
  news: '<path d="M5 4.5h11v15H6.5A1.5 1.5 0 0 1 5 18z"/><path d="M16 8.5h3v9.5a1.5 1.5 0 0 1-3 0M8 8h5M8 11.5h5M8 15h3"/>',
  bellOff: '<path d="M6 16.5V11a6 6 0 0 1 9.5-4.9M18 11v5.5l1.5 1.5h-12"/><path d="M10 20.5a2 2 0 0 0 4 0M4 4l16 16"/>',
};
export const iconSVG = (name, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

const PAGES = {
  inicio: { title: 'Inicio', guide: 'samy', words: 'resumen inicio principal en vivo' },
  conexiones: { title: 'Conexiones', guide: 'samy', words: 'conectar tiktok kick starvios usuario canal cuenta bot' },
  actividad: { title: 'Chat en vivo', guide: 'samy', words: 'chat en vivo actividad registro mensajes eventos simular regalos insignias silenciar' },
  voz: { title: 'Voz del chat', guide: 'troya', words: 'voz voces tts leer piper filtro groserías quiéreme' },
  musica: { title: 'Música', guide: 'nono', words: 'música canción cola play temita skip quitar youtube spotify' },
  sonidos: { title: 'Sonidos', guide: 'nono', words: 'sonidos efectos memes biblioteca frases soundboard groseros graciosos sospechoso rosalía packs' },
  alertas: { title: 'Alertas', guide: 'troya', words: 'alertas seguidor regalo suscripción likes compartir' },
  overlays: { title: 'Overlays para OBS', guide: 'samy', words: 'obs overlay url fuente navegador estilo streamlabs metas objetivo barra progreso contadores cuenta regresiva' },
  chatbot: { title: 'Chat Bot', guide: 'mecha', words: 'chat bot chatbot mecharidds comandos comando respuesta redes discord alias espera moderadores mensajes automáticos temporizador timer cada minutos anuncio escribir enviar' },
  estadisticas: { title: 'Estadísticas', guide: 'juana', words: 'estadísticas números gané diamantes tops historial gráfica' },
  ajustes: { title: 'Ajustes', guide: 'samy', words: 'ajustes tema color letra fuente tipografía tamaño apariencia ventana reloj actualizaciones atajos teclado teclas' },
  novedades: { title: 'Novedades', guide: 'mecha', words: 'novedades cambios versión actualización qué hay de nuevo changelog notas' },
  perfil: { title: 'Tu perfil', guide: 'samy', words: 'perfil nombre foto cuentas menú ordenar ocultar barra derecha botones rápidos saludo' },
  ayuda: { title: 'Ayuda', guide: 'samy', words: 'ayuda preguntas guías reportar error problema falla bug idea sugerencia soporte discord' },
};

const TAB_NAMES = {
  sonidos: { biblioteca: 'Biblioteca', memes: 'Memes', frases: 'Frases', mios: 'Mis sonidos', chat: 'Comando del chat' },
  ayuda: { preguntas: 'Preguntas', reportar: 'Reportar un problema' },
  chatbot: { inicio: 'Inicio', comandos: 'Comandos', automaticos: 'Mensajes automáticos' },
  voz: { voces: 'Voces', quien: 'Quién se lee', filtros: 'Filtros y límites', especiales: 'Espectadores especiales', probar: 'Probar' },
  ajustes: { apariencia: 'Apariencia', app: 'App', atajos: 'Atajos de teclado', acerca: 'Acerca de' },
};

let current = '';
const listeners = [];
export const onPageChange = (fn) => listeners.push(fn);
export const currentPage = () => current;

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: no pasa nada */ } },
};

// ---------- Pantallas y pestañas ----------
const OLD_PAGES = { comandos: ['chatbot', 'comandos'], automaticos: ['chatbot', 'automaticos'], metas: ['overlays', 'goals'] };
export function showPage(page, tab) {
  if (OLD_PAGES[page]) [page, tab] = OLD_PAGES[page];
  if (!PAGES[page]) page = 'inicio';
  const changed = page !== current;
  current = page;
  for (const sec of $$('.page')) sec.hidden = sec.dataset.page !== page;
  for (const a of $$('.nav-item')) a.classList.toggle('on', a.dataset.page === page);
  if (tab) showTab(page, tab);
  const want = `#/${page}${tab ? `/${tab}` : ''}`;
  if (location.hash !== want) history.replaceState(null, '', want);
  if (changed) {
    $('#content').scrollTop = 0;
    document.title = `${PAGES[page].title} · Satronho Bot`;
    store.set('satronho.page', page);
    listeners.forEach((fn) => fn(page));
  }
}

function showTab(page, tab) {
  const sec = $(`#page-${page}`);
  if (!sec) return;
  const buttons = $$('[data-tab]', sec);
  if (!buttons.some((b) => b.dataset.tab === tab)) tab = buttons[0]?.dataset.tab;
  for (const b of buttons) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  for (const p of $$('[data-tabpanel]', sec)) p.hidden = p.dataset.tabpanel !== tab;
  store.set(`satronho.tab.${page}`, tab);
}

function fromHash() {
  const [, page, tab] = location.hash.match(/^#\/([^/]+)(?:\/([^/]+))?/) || [];
  showPage(page || store.get('satronho.page') || 'inicio', tab);
}

function initTabs() {
  for (const bar of $$('[data-tabs]')) {
    const page = bar.closest('.page').dataset.page;
    for (const b of $$('[data-tab]', bar)) {
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => {
        showTab(page, b.dataset.tab);
        history.replaceState(null, '', `#/${page}/${b.dataset.tab}`);
      });
    }
    showTab(page, store.get(`satronho.tab.${page}`) || bar.querySelector('[data-tab]').dataset.tab);
  }
}

// ---------- Buscador ----------
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function searchItems(q) {
  const n = norm(q).trim();
  if (!n) return [];
  const words = n.split(/\s+/);
  const hits = [];
  for (const [id, p] of Object.entries(PAGES)) {
    const hay = norm(`${p.title} ${p.words}`);
    if (words.every((w) => hay.includes(w))) hits.push({ kind: 'page', id, label: p.title, sub: 'Ir a la pantalla', guide: p.guide });
    for (const [tab, name] of Object.entries(TAB_NAMES[id] || {})) {
      if (words.every((w) => norm(`${p.title} ${name}`).includes(w))) hits.push({ kind: 'page', id, tab, label: `${p.title} → ${name}`, sub: 'Pestaña', guide: p.guide });
    }
  }
  const found = helpKb.findAnswer(q, 'samy');
  const kb = helpKb.KB.filter((e) => e === found || words.every((w) => norm(e.q).includes(w))).slice(0, 4);
  for (const e of kb) hits.push({ kind: 'ask', q: e.q, label: e.q, sub: `Pregúntale a ${GUIDES[e.guide].name}`, guide: e.guide });
  hits.push({ kind: 'ask', q, label: `«${q}»`, sub: 'Preguntarle a Samy', guide: 'samy' });
  return hits.slice(0, 8);
}

function initSearch() {
  const input = $('#search');
  const box = $('#search-results');
  let items = [];
  let sel = 0;

  const close = () => { box.hidden = true; };
  const render = () => {
    box.innerHTML = items
      .map((it, i) => `<button type="button" data-i="${i}" class="${i === sel ? 'sel' : ''}">${avatarHTML(it.guide, 'xs')}<span>${esc(it.label)}</span><small>${esc(it.sub)}</small></button>`)
      .join('');
    box.hidden = !items.length;
  };
  const pick = (it) => {
    if (!it) return;
    close();
    input.value = '';
    input.blur();
    if (it.kind === 'page') showPage(it.id, it.tab);
    else openHelp(it.guide, it.q);
  };

  input.addEventListener('input', () => { items = searchItems(input.value); sel = 0; render(); });
  input.addEventListener('focus', () => { if (input.value) { items = searchItems(input.value); render(); } });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); render(); ev.preventDefault(); }
    if (ev.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); ev.preventDefault(); }
    if (ev.key === 'Enter') { pick(items[sel]); ev.preventDefault(); }
    if (ev.key === 'Escape') { close(); input.blur(); }
  });
  box.addEventListener('mousedown', (ev) => {
    const b = ev.target.closest('[data-i]');
    if (b) { ev.preventDefault(); pick(items[Number(b.dataset.i)]); }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      input.focus();
      input.select();
    }
  });
}

// ---------- Simular ----------
async function simulate(type, body) {
  try {
    await api('POST', `/api/test/${type}`, body);
    markStep('test');
  } catch (e) {
    toast(e.message);
  }
}

function initSimulate() {
  const btn = $('#sim-btn');
  const menu = $('#sim-menu');
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('.menu-wrap')) menu.hidden = true;
  });
  menu.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-sim]');
    if (!b) return;
    menu.hidden = true;
    simulate(b.dataset.sim, b.dataset.body ? JSON.parse(b.dataset.body) : undefined);
  });
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-sim-quick]');
    if (b) simulate(b.dataset.simQuick);
  });
}

// ---------- Contador de eventos ----------
let unseen = 0;
export function countEvent() {
  if (current === 'actividad') return;
  unseen += 1;
  const c = $('#events-count');
  c.textContent = unseen > 99 ? '99+' : String(unseen);
  c.hidden = false;
}
function initEvents() {
  const c = $('#events-count');
  c.hidden = true;
  const reset = () => { unseen = 0; c.hidden = true; };
  $('#events-btn').addEventListener('click', () => { showPage('actividad'); reset(); });
  onPageChange((p) => { if (p === 'actividad') reset(); });
}

// ---------- Primeros pasos (Samy) ----------
let config;
const facts = { connected: false, voice: false };
const STEPS = [
  { id: 'connect', label: 'Conecta tu directo', go: ['conexiones'], done: () => facts.connected },
  { id: 'voice', label: 'Descarga una voz para Troya', go: ['voz', 'voces'], done: () => facts.voice },
  { id: 'overlay', label: 'Copia un overlay para OBS', go: ['overlays'], done: () => Boolean(config.guides.steps?.overlay) },
  { id: 'test', label: 'Prueba una alerta', go: ['alertas'], done: () => Boolean(config.guides.steps?.test) },
];

export function setStepFacts(patch) {
  Object.assign(facts, patch);
  renderSteps();
}

export function markStep(id) {
  config.guides.steps = { ...(config.guides.steps || {}) };
  if (config.guides.steps[id]) return;
  config.guides.steps[id] = true;
  saveConfig({ guides: { steps: { [id]: true } } });
  renderSteps();
}

function renderSteps() {
  if (!config) return;
  const box = $('#steps');
  box.hidden = Boolean(config.guides.stepsHidden);
  const done = STEPS.filter((s) => s.done()).length;
  const next = STEPS.find((s) => !s.done());
  $('#steps-count').textContent = done === STEPS.length ? '¡Todo listo! · con Samy' : `${done} de ${STEPS.length} · con Samy`;
  $('#steps-bar').style.width = `${(done / STEPS.length) * 100}%`;
  $('#steps-list').innerHTML = STEPS.map(
    (s) => `<button type="button" class="step ${s.done() ? 'done' : s === next ? 'next' : ''}" data-step="${s.id}">${s.done() ? '✓' : s === next ? '→' : '○'} ${esc(s.label)}</button>`
  ).join('');
}

function initSteps() {
  $('#steps-list').addEventListener('click', (ev) => {
    const s = STEPS.find((x) => x.id === ev.target.closest('[data-step]')?.dataset.step);
    if (s && !s.done()) showPage(...s.go);
  });
  const hide = (v) => {
    config.guides.stepsHidden = v;
    saveConfig({ guides: { stepsHidden: v } });
    renderSteps();
  };
  $('#steps-hide').addEventListener('click', () => hide(true));
  $('#steps-again').addEventListener('click', () => { hide(false); toast('«Primeros pasos» está otra vez en el menú'); });
  renderSteps();
}

// ---------- Arranque ----------
// Menú lateral: compacto (solo iconos; se despliega al pasar el ratón o
// al tocarlo) o abierto siempre. Se guarda en Apariencia.
function initSidebar(cfg) {
  const btn = $('#side-pin');
  const side = $('.side');
  const apply = () => {
    const open = cfg.appearance?.sidebar === 'open';
    document.body.classList.toggle('rail', !open);
    btn.setAttribute('aria-pressed', String(open));
    btn.title = open ? 'Volver al menú compacto' : 'Dejar el menú abierto';
    btn.querySelector('.lbl').textContent = open ? 'Menú compacto' : 'Dejar el menú abierto';
  };
  btn.addEventListener('click', () => {
    const open = cfg.appearance?.sidebar !== 'open';
    cfg.appearance = { ...cfg.appearance, sidebar: open ? 'open' : 'compact' };
    saveConfig({ appearance: { sidebar: cfg.appearance.sidebar } });
    side.classList.remove('peek');
    apply();
  });
  // En pantallas táctiles no hay «pasar el ratón»: un toque lo despliega
  // y tocar fuera (o elegir una sección) lo vuelve a cerrar.
  let touch = false;
  side.addEventListener('pointerdown', (ev) => { touch = ev.pointerType === 'touch'; });
  side.addEventListener('click', (ev) => {
    if (!touch || !document.body.classList.contains('rail')) return;
    if (!side.classList.contains('peek')) {
      // Primer toque: solo despliega el menú.
      side.classList.add('peek');
      ev.preventDefault();
      ev.stopPropagation();
    } else if (ev.target.closest('a.nav-item')) {
      setTimeout(() => side.classList.remove('peek'), 50);
    }
  }, true);
  document.addEventListener('pointerdown', (ev) => {
    if (!side.contains(ev.target)) side.classList.remove('peek');
  });
  apply();
}

// Tu perfil: secciones del menú ocultas y en qué orden van.
export function applyMenuPrefs(cfg) {
  const p = cfg.profile || {};
  const hidden = new Set(p.menuHidden || []);
  const order = p.menuOrder || [];
  for (const group of $$('.side .nav-group')) {
    const items = $$('.nav-item[data-page]', group);
    for (const a of items) a.hidden = hidden.has(a.dataset.page);
    const pos = (a) => { const i = order.indexOf(a.dataset.page); return i < 0 ? 999 + items.indexOf(a) : i; };
    for (const a of [...items].sort((x, y) => pos(x) - pos(y))) {
      group.append(a);
      // Los overlays fijados y su desplegable van pegados a «Overlays para OBS».
      if (a.dataset.page === 'overlays' && $('#nav-pins')) a.after($('#nav-pins'));
    }
    group.hidden = items.every((a) => a.hidden);
  }
}

export function initNav(cfg) {
  initSidebar(cfg);
  applyMenuPrefs(cfg);
  config = cfg;
  for (const el of $$('[data-icon]')) {
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[el.dataset.icon] || ''}</svg>`;
  }
  initTabs();
  initSearch();
  initSimulate();
  initEvents();
  initSteps();
  document.addEventListener('click', (ev) => {
    const go = ev.target.closest('[data-go-page]');
    if (go) showPage(go.dataset.goPage);
  });
  window.addEventListener('hashchange', fromHash);
  fromHash();
}
