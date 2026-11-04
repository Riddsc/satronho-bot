// Overlays para OBS: vista previa en vivo de cada overlay, su URL para
// copiar y el estilo (tipografía, colores, fondo, esquinas, tamaño, sonido).

import { $, $$, api, esc, toast, saveConfig } from './util.js';
import { FONTS, ACCENTS } from './appearance.js';
import { guideToast } from './guides.js';
import { markStep, onPageChange } from './nav.js';

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
];
let style;
let goals = [];

function items() {
  const base = location.origin;
  const list = [
    { name: 'Alertas', path: '/overlays/alerts.html', w: 800, h: 300, note: 'Regalos, stickers, seguidores y tus alertas propias' },
    { name: 'Sonando ahora', path: '/overlays/now-playing.html', w: 700, h: 140, note: 'La canción y quién la pidió' },
    { name: 'Podio en vivo', path: '/overlays/podium.html', w: 900, h: 420, note: 'Top de likes, regalos o mensajes (ajústalo abajo)' },
  ];
  for (const g of goals) list.push({ name: /^meta\b/i.test(g.title) ? g.title : `Meta: ${g.title}`, path: `/overlays/goal.html?id=${encodeURIComponent(g.id)}`, w: 700, h: 140, note: 'Barra de progreso' });
  return list.map((it) => ({ ...it, url: `${base}${it.path}` }));
}

function previewUrl(path) {
  return `${path}${path.includes('?') ? '&' : '?'}preview=1`;
}

let rendered = '';
function renderList() {
  const list = items();
  const key = list.map((i) => i.url).join('|');
  if (key === rendered) return; // no recargamos las vistas previas si nada cambió
  rendered = key;
  $('#overlay-list').innerHTML = list
    .map(
      (it) => `<div class="ov">
        <div class="pv" data-w="${it.w}" data-h="${it.h}"><iframe src="${esc(previewUrl(it.path))}" width="${it.w}" height="${it.h}" loading="lazy" title="Vista previa: ${esc(it.name)}" tabindex="-1"></iframe></div>
        <div class="info"><b>${esc(it.name)}<small>${it.w} × ${it.h}</small></b><small class="hint" style="margin:0">${esc(it.note)}</small><code title="${esc(it.url)}">${esc(it.url)}</code>
          <div class="row"><button class="btn small primary" data-copy="${esc(it.url)}">Copiar URL</button><button class="btn small ghost" data-open="${esc(it.url)}">Abrir</button></div></div>
      </div>`
    )
    .join('');
  fitPreviews();
  for (const f of $$('#overlay-list iframe')) f.addEventListener('load', () => sendStyle(f));
}

// Las vistas previas se escalan al ancho de su tarjeta.
function fitPreviews() {
  for (const pv of $$('#overlay-list .pv')) {
    const w = Number(pv.dataset.w);
    const h = Number(pv.dataset.h);
    const k = pv.clientWidth / w || 0.4;
    pv.style.height = `${Math.round(h * k)}px`;
    pv.querySelector('iframe').style.transform = `scale(${k})`;
  }
}

function sendStyle(frame) {
  const frames = frame ? [frame] : $$('#overlay-list iframe');
  for (const f of frames) f.contentWindow?.postMessage({ satronhoStyle: style }, location.origin);
}

function fill() {
  for (const el of $$('[data-ov]')) {
    const v = style[el.dataset.ov];
    if (el.type === 'checkbox') el.checked = Boolean(v);
    else el.value = v;
  }
  $('#ov-scale-val').textContent = `${Math.round(style.scale * 100)}%`;
  for (const b of $$('[data-theme-pick]')) b.setAttribute('aria-pressed', String(b.dataset.themePick === (style.theme || 'satronho')));
  const pd = style.podium || {};
  for (const el of $$('[data-pd]')) {
    const v = pd[el.dataset.pd];
    if (el.type === 'checkbox') el.checked = v !== false;
    else if (el.type === 'radio') el.checked = String(v ?? (el.name === 'pd-size' ? 3 : 'likes')) === el.value;
    else el.value = v ?? '';
  }
  for (const b of $$('#ov-swatches [data-ov-accent]')) b.setAttribute('aria-pressed', String(b.dataset.ovAccent === style.accent));
}

function set(patch) {
  Object.assign(style, patch);
  fill();
  sendStyle();
  saveConfig({ overlayStyle: patch });
}

export function setOverlayGoals(list) {
  goals = list;
  renderList();
}

function renderThemes() {
  $('#ov-themes').innerHTML = THEMES.map((t) => `<button type="button" class="ov-theme" data-theme-pick="${t.id}" title="${esc(t.desc)}">
    <span class="ov-tprev" style="--tb:${t.bg};--tf:${t.fg};--td:${t.bd};font-family:'${esc(FONTS.find((f) => f.id === t.set.font)?.family || 'inherit')}'" data-k="${t.glow ? 'glow' : t.dashed ? 'dashed' : t.hard ? 'hard' : t.line ? 'line' : ''}"><i>♥</i><b>Rosalinda</b></span>
    <span class="ov-tname">${esc(t.name)}</span></button>`).join('');
}

export function initOverlays(config) {
  style = { ...DEFAULT, ...(config.overlayStyle || {}) };
  renderThemes();
  $('#ov-themes').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-theme-pick]');
    if (!b) return;
    const t = THEMES.find((x) => x.id === b.dataset.themePick);
    set({ theme: t.id, ...t.set });
    guideToast('samy', `Tema «${t.name}» en todos tus overlays. Puedes ajustar la letra y los colores abajo.`);
  });
  $('#ov-podium').addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-pd]');
    if (!el) return;
    const k = el.dataset.pd;
    const v = el.type === 'checkbox' ? el.checked : el.type === 'radio' ? (k === 'size' ? Number(el.value) : el.value) : el.value.trim();
    set({ podium: { ...(style.podium || {}), [k]: v } });
  });
  $('#pd-reset').addEventListener('click', () => api('POST', '/api/podium/reset').then(() => guideToast('samy', 'Podio en cero. Empieza la competencia.')).catch((e) => toast(e.message)));
  $('[data-ov="font"]').innerHTML = FONTS.map((f) => `<option value="${f.id}" style="font-family:'${esc(f.family)}'">${esc(f.name)}</option>`).join('');
  $('#ov-swatches').innerHTML = ACCENTS.map((c) => `<button type="button" class="swatch" data-ov-accent="${c}" style="background:${c};width:26px;height:26px" title="${c}"></button>`).join('');
  fill();

  for (const el of $$('[data-ov]')) {
    const ev = el.type === 'range' || el.type === 'color' ? 'input' : 'change';
    el.addEventListener(ev, () => {
      const k = el.dataset.ov;
      set({ [k]: el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value });
    });
  }
  $('#ov-swatches').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ov-accent]');
    if (b) set({ accent: b.dataset.ovAccent });
  });
  $('#ov-reset').addEventListener('click', () => set({ ...DEFAULT }));

  $('#overlay-list').addEventListener('click', async (ev) => {
    const copy = ev.target.closest('[data-copy]');
    const open = ev.target.closest('[data-open]');
    if (copy) {
      try {
        await navigator.clipboard.writeText(copy.dataset.copy);
        guideToast('samy', 'URL copiada. En OBS: Fuentes → + → Navegador, y pégala.');
        markStep('overlay');
      } catch {
        toast('No se pudo copiar: selecciónala a mano');
      }
    }
    if (open) window.open(open.dataset.open, '_blank');
  });

  window.addEventListener('resize', fitPreviews);
  onPageChange((p) => { if (p === 'overlays') requestAnimationFrame(fitPreviews); });
  renderList();
}
