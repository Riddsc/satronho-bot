// Novedades (MechaRidds): historial de cambios, campana en la barra
// superior y aviso «¿Qué hay de nuevo?» la primera vez que se abre una
// versión nueva. El historial viene de CHANGELOG.json (incluido en la app).

import { $, api, esc, saveConfig } from './util.js';
import { mechaHead } from './mecharidds.js';

const TYPE = { nuevo: 'Nuevo', mejora: 'Mejora', arreglo: 'Arreglo', cambio: 'Cambio' };
const cmpVer = (a, b) => { const pa = String(a).split('.').map(Number); const pb = String(b).split('.').map(Number); for (let i = 0; i < 3; i += 1) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); return 0; };

let config;
let changelog = [];
let version = '';

const fmtDate = (d) => {
  try {
    return new Date(`${d}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return d;
  }
};

function items(list) {
  return list.map((it) => `<li class="t-${esc(it.type)}"><span class="tag">${esc(TYPE[it.type] || it.type)}</span><span>${esc(it.text)}</span></li>`).join('');
}

function renderList() {
  const box = $('#news-list');
  if (!box) return;
  box.innerHTML = changelog.map((v, i) => `<article class="card news-ver ${v.version === version ? 'current' : ''}">
    <div class="news-head"><span class="ver">v${esc(v.version)}</span>${v.version === version ? '<span class="now">Tu versión</span>' : i === 0 ? '<span class="now soon">La más reciente</span>' : ''}<time>${esc(fmtDate(v.date))}</time></div>
    <h3>${esc(v.title)}</h3>
    <ul class="news-items">${items(v.items || [])}</ul>
  </article>`).join('') || '<p class="hint">No hay novedades para mostrar.</p>';
}

function setUnseen(on) {
  $('#news-dot').hidden = !on;
  $('#nav-news').hidden = !on;
}

function markSeen() {
  if (config.seenVersion === version) return;
  config.seenVersion = version;
  saveConfig({ seenVersion: version });
  setUnseen(false);
}

// Todo lo que cambió desde la versión que tenías (no solo la última).
function showModal(entry) {
  const from = config.seenVersion || '';
  const list = changelog.filter((v) => cmpVer(v.version, version) <= 0 && (!from || cmpVer(v.version, from) > 0)).slice(0, 8);
  const show = list.length ? list : [entry];
  $('#news-bust').innerHTML = mechaHead('');
  $('#news-modal-ver').textContent = from ? `Esto cambió desde tu versión anterior (${from})` : `Versión ${entry.version}`;
  $('#news-modal-items').innerHTML = show.map((v) => `<section class="nw-ver"><h3><span class="nw-v">v${esc(v.version)}</span>${esc(v.title)}</h3><ul class="news-items nw-items">${items(v.items || [])}</ul></section>`).join('');
  $('#news-modal').hidden = false;
  $('#news-modal-ok').focus();
}

export async function initNews(cfg, appVersion) {
  config = cfg;
  version = String(appVersion || '').replace(/^v/, '');
  try {
    changelog = (await api('GET', '/api/changelog')).changelog || [];
  } catch {
    changelog = [];
  }
  renderList();
  const close = () => {
    $('#news-modal').hidden = true;
    markSeen();
  };
  $('#news-modal-ok').addEventListener('click', close);
  $('#news-modal-x').addEventListener('click', close);
  $('#news-modal-all').addEventListener('click', close);
  $('#news-modal').addEventListener('click', (ev) => { if (ev.target.id === 'news-modal') close(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('#news-modal').hidden) close(); });

  const entry = changelog.find((v) => v.version === version);
  if (!config.seenVersion) {
    // Primera vez que se abre la app: no hace falta el aviso.
    config.seenVersion = version;
    saveConfig({ seenVersion: version });
  } else if (config.seenVersion !== version && entry) {
    setUnseen(true);
    showModal(entry);
  }
}

// Al entrar a Novedades se dan por vistas.
export function onNewsPage(page) {
  if (page === 'novedades' && config) markSeen();
}
