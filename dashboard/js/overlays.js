// Overlays para OBS: vista previa en vivo de cada overlay, su URL para
// copiar y el estilo (tipografía, colores, fondo, esquinas, tamaño, sonido).

import { $, $$, esc, toast, saveConfig } from './util.js';
import { FONTS, ACCENTS } from './appearance.js';
import { guideToast } from './guides.js';
import { markStep, onPageChange } from './nav.js';

const DEFAULT = { font: 'bricolage-grotesque', accent: '#ffb23e', text: '#ffffff', card: 'solid', corners: 'round', scale: 1, sound: true, alertColors: 'type' };
let style;
let goals = [];

function items() {
  const base = location.origin;
  const list = [
    { name: 'Alertas de TikTok', path: '/overlays/alerts.html', w: 800, h: 300, note: 'Seguidores, regalos, subs…' },
    { name: 'Sonando ahora', path: '/overlays/now-playing.html', w: 700, h: 140, note: 'La canción y quién la pidió' },
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

export function initOverlays(config) {
  style = { ...DEFAULT, ...(config.overlayStyle || {}) };
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
