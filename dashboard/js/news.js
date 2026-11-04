// Novedades (MechaRidds): historial de cambios, campana en la barra
// superior y aviso «¿Qué hay de nuevo?» la primera vez que se abre una
// versión nueva. El historial viene de CHANGELOG.json (incluido en la app).

import { $, api, esc, saveConfig } from './util.js';
import { mechaBust } from './mecharidds.js';

const TYPE = { nuevo: 'Nuevo', mejora: 'Mejora', arreglo: 'Arreglo' };

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

function showModal(entry) {
  $('#news-bust').innerHTML = mechaBust();
  $('#news-modal-ver').textContent = `Actualizado a la versión ${entry.version}`;
  $('#news-modal-title').textContent = entry.title;
  $('#news-modal-items').innerHTML = items(entry.items || []);
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
