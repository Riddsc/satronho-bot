// Samy, Troya, Ñoño y Juana: los guías de Satronho Bot.
// Samy y Troya son las guías principales (más grandes, siempre a mano en
// la esquina y responden las preguntas generales); Ñoño lleva la música y
// Juana las alertas, metas y estadísticas. Tocar a cualquiera abre su
// ayuda (help.js). Si el streamer sube una foto, se usa en lugar del dibujo.

import { $, $$, api, esc, toast, saveConfig } from './util.js';
import { mascotSVG } from './mascots.js';

export const GUIDES = {
  samy: { name: 'Samy', role: 'Conexiones y ayuda general', color: '#ffb23e', lead: true },
  troya: { name: 'Troya', role: 'Voz del chat y alertas', color: '#9b8cff', lead: true },
  nono: { name: 'Ñoño', role: 'Música', color: '#4fd1c5', lead: false },
  juana: { name: 'Juana', role: 'Metas y estadísticas', color: '#ff8fb5', lead: false },
};

export function avatarSVG(id) {
  return mascotSVG(id, esc(GUIDES[id].name));
}

let photos = {};
export const hasPhoto = (id) => Boolean(photos[id]);

// Tamaños: Ñoño XL, Troya L+, Samy L y Juana XS (es enanita y está viejita).
// El protagonismo de Samy y Troya se nota en cuántas veces aparecen, no en el tamaño.
export const SIZE_RATIO = { nono: 1, troya: 0.86, samy: 0.76, juana: 0.52 };
const SIZE_BASE = { hero: 96, mini: 46 };

// size: 'xs' | 'md' (iconos fijos de la ayuda), 'hero' | 'mini' | número (tamaño de Ñoño).
export function avatarHTML(id, size = '') {
  const photo = photos[id];
  const inner = photo ? `<img src="/guide-photos/${encodeURI(photo)}" alt="${esc(GUIDES[id].name)}">` : avatarSVG(id);
  const base = SIZE_BASE[size] ?? (Number(size) || 0);
  let style = `--g:${GUIDES[id].color}`;
  let cls = size;
  if (base) {
    const px = Math.round(base * SIZE_RATIO[id]);
    style += `;width:${px}px;height:${px}px;border-width:${px < 40 ? 2 : 3}px`;
    cls = '';
  }
  return `<span class="avatar ${cls}" style="${style}">${inner}</span>`;
}

function refreshAvatars() {
  for (const el of $$('[data-avatar]')) {
    const mood = el.querySelector('.avatar')?.dataset.mood || 'idle';
    el.innerHTML = avatarHTML(el.dataset.avatar, el.dataset.size || '');
    const av = el.querySelector('.avatar');
    av.dataset.mood = mood;
    el.classList.toggle('tiny', parseInt(av.style.width, 10) < 44);
  }
  // Las copias pequeñas (ayuda, esquina) también se actualizan.
  for (const el of $$('.h-ava, .dock-btn, #help-switch [data-switch], #help-who')) {
    const img = el.querySelector('.avatar');
    if (!img) continue;
    const id = el.dataset.openHelp || el.dataset.switch || img.closest('[data-guide-id]')?.dataset.guideId;
    if (id) img.outerHTML = avatarHTML(id, el.dataset.size || [...img.classList].filter((c) => c !== 'avatar').join(' '));
  }
}

// Estados de ánimo: cambian la animación de la cara un rato.
const moodTimers = {};
export function setMood(id, mood, ms = 2600) {
  for (const el of $$(`[data-avatar="${id}"] .avatar, [data-open-help="${id}"] .avatar`)) el.dataset.mood = mood;
  clearTimeout(moodTimers[id]);
  if (mood !== 'thinking' && mood !== 'idle') moodTimers[id] = setTimeout(() => setMood(id, 'idle', 0), ms);
}

// ---------- Burbujas ----------
const defaults = {};
const timers = {};

export function setBubble(id, html) {
  defaults[id] = html;
  if (!timers[id]) render(id, html);
}

export function sayFor(id, html, ms = 7000, kind = '') {
  clearTimeout(timers[id]);
  render(id, html, kind);
  if (kind === 'ok') setMood(id, 'happy');
  else if (kind === 'err' || kind === 'warn') setMood(id, 'alert');
  else setMood(id, 'wave');
  timers[id] = setTimeout(() => {
    timers[id] = null;
    render(id, defaults[id] || '');
  }, ms);
}

function render(id, html, kind = '') {
  for (const el of $$(`[data-bubble="${id}"]:not([data-static])`)) {
    el.className = `bubble ${kind}`;
    el.innerHTML = `<b>${esc(GUIDES[id].name)}:</b> ${html}`;
  }
}

function prepareBubbles() {
  for (const el of $$('[data-bubble]')) {
    const id = el.dataset.bubble;
    el.dataset.guide = id;
    el.title = `Toca para preguntarle a ${GUIDES[id].name}`;
    el.style.setProperty('--g', GUIDES[id].color);
  }
}

export function guideToast(id, text) {
  toast(text, avatarHTML(id, 'xs'));
}

// ---------- Fotos ----------
export function pickPhoto(id, done = () => {}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/gif';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const res = await fetch(`/api/guides/${id}/photo`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      photos[id] = data.photo;
      refreshAvatars();
      done();
      guideToast(id, '¡Así me veo ahora!');
    } catch (e) {
      toast(`No se pudo subir la foto: ${e.message}`);
    }
  };
  input.click();
}

export async function removePhoto(id, done = () => {}) {
  await api('DELETE', `/api/guides/${id}/photo`).catch((e) => toast(e.message));
  photos[id] = '';
  refreshAvatars();
  done();
}

// ---------- Visibilidad y bienvenida ----------
export function initGuides(config) {
  photos = { ...(config.guides?.photos || {}) };
  prepareBubbles();
  refreshAvatars();

  const toggle = $('#guides-toggle');
  const applyVisible = (v) => {
    document.body.classList.toggle('guides-off', !v);
    toggle.checked = v;
  };
  applyVisible(config.guides?.visible !== false);
  toggle.addEventListener('change', () => {
    applyVisible(toggle.checked);
    saveConfig({ guides: { visible: toggle.checked } });
  });

  const welcome = $('#welcome');
  welcome.hidden = Boolean(config.guides?.welcomeDone);
  $('#welcome-done').addEventListener('click', () => {
    welcome.hidden = true;
    saveConfig({ guides: { welcomeDone: true } });
  });
  $('#welcome-again').addEventListener('click', () => {
    welcome.hidden = false;
    location.hash = '#/inicio';
  });
}
