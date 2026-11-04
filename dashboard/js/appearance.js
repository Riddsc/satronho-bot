// Apariencia del panel: tema, color de acento, tipografía, tamaño de letra y
// esquinas. Todo cambia al instante y se guarda en tu PC.

import { $, $$, esc, saveConfig } from './util.js';

export const FONTS = [
  { id: 'bricolage-grotesque', family: 'Bricolage Grotesque', name: 'Bricolage', note: 'La de Satronho' },
  { id: 'nunito', family: 'Nunito', name: 'Nunito', note: 'Redondita y suave' },
  { id: 'fredoka', family: 'Fredoka', name: 'Fredoka', note: 'Juguetona' },
  { id: 'baloo-2', family: 'Baloo 2', name: 'Baloo', note: 'Gordita y alegre' },
  { id: 'comfortaa', family: 'Comfortaa', name: 'Comfortaa', note: 'Geométrica y tierna' },
  { id: 'poppins', family: 'Poppins', name: 'Poppins', note: 'Moderna y limpia' },
  { id: 'inter', family: 'Inter', name: 'Inter', note: 'Sobria, muy legible' },
  { id: 'space-grotesk', family: 'Space Grotesk', name: 'Space Grotesk', note: 'Técnica, con carácter' },
  { id: 'lilita-one', family: 'Lilita One', name: 'Lilita', note: 'Para títulos gamer' },
  { id: 'jetbrains-mono', family: 'JetBrains Mono', name: 'JetBrains Mono', note: 'Estilo consola' },
];
export const fontFamily = (id) => {
  const f = FONTS.find((x) => x.id === id) || FONTS[0];
  return `'${f.family}', system-ui, sans-serif`;
};

const THEMES = [
  { id: 'noche', name: 'Noche', note: 'Morado nocturno', c: ['#141022', '#19152a', '#8b7bff'] },
  { id: 'medianoche', name: 'Medianoche', note: 'Azul profundo', c: ['#0d1322', '#121a2c', '#5ab0ff'] },
  { id: 'cafe', name: 'Café', note: 'Cálido, tostado', c: ['#1b140f', '#221912', '#e07a4a'] },
  { id: 'claro', name: 'Claro', note: 'Para el día', c: ['#efe9f8', '#ffffff', '#6d5dfc'] },
];

export const ACCENTS = ['#ffb23e', '#ff8fb5', '#9b8cff', '#4fd1c5', '#5ab0ff', '#7bd66b', '#ff6b5e', '#f4d35e'];
const DEFAULT = { theme: 'noche', accent: '#ffb23e', font: 'bricolage-grotesque', size: 'm', corners: 'redondas' };

// Texto oscuro o claro sobre el acento, según cuánta luz tenga.
export function onColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.36 ? '#1b1206' : '#ffffff';
}

let look;

function apply() {
  const root = document.documentElement;
  root.dataset.theme = look.theme;
  root.dataset.size = look.size;
  root.dataset.corners = look.corners;
  root.style.setProperty('--accent', look.accent);
  root.style.setProperty('--on-accent', onColor(look.accent));
  root.style.setProperty('--font', fontFamily(look.font));
  for (const b of $$('#theme-cards [data-theme-opt]')) b.setAttribute('aria-pressed', String(b.dataset.themeOpt === look.theme));
  for (const b of $$('#accent-swatches [data-accent]')) b.setAttribute('aria-pressed', String(b.dataset.accent === look.accent));
  for (const b of $$('#font-cards [data-font]')) b.setAttribute('aria-pressed', String(b.dataset.font === look.font));
  for (const b of $$('[data-size-opt]')) b.setAttribute('aria-pressed', String(b.dataset.sizeOpt === look.size));
  for (const b of $$('[data-corners-opt]')) b.setAttribute('aria-pressed', String(b.dataset.cornersOpt === look.corners));
  $('#accent-custom').value = look.accent;
}

function set(patch) {
  Object.assign(look, patch);
  apply();
  saveConfig({ appearance: patch });
}

// Se aplica lo antes posible para que la app no "parpadee" con el tema por defecto.
export function applyAppearance(config) {
  look = { ...DEFAULT, ...(config.appearance || {}) };
  const root = document.documentElement;
  root.dataset.theme = look.theme;
  root.dataset.size = look.size;
  root.dataset.corners = look.corners;
  root.style.setProperty('--accent', look.accent);
  root.style.setProperty('--on-accent', onColor(look.accent));
  root.style.setProperty('--font', fontFamily(look.font));
}

export function initAppearance(config) {
  applyAppearance(config);
  $('#theme-cards').innerHTML = THEMES.map(
    (t) => `<button type="button" class="theme-card" data-theme-opt="${t.id}"><span class="tp" style="background:${t.c[0]}"><i style="background:${t.c[1]}"></i><i style="background:${t.c[2]};flex:.4"></i></span><span><b>${esc(t.name)}</b><br><small class="hint">${esc(t.note)}</small></span></button>`
  ).join('');
  $('#accent-swatches').innerHTML = ACCENTS.map((c) => `<button type="button" class="swatch" data-accent="${c}" style="background:${c}" title="${c}"></button>`).join('');
  $('#font-cards').innerHTML = FONTS.map(
    (f) => `<button type="button" class="font-card" data-font="${f.id}"><span class="sample" style="font-family:'${esc(f.family)}'">Samy y Ñoño</span><b style="font-family:'${esc(f.family)}'">${esc(f.name)}</b><small>${esc(f.note)}</small></button>`
  ).join('');

  $('#theme-cards').addEventListener('click', (ev) => { const b = ev.target.closest('[data-theme-opt]'); if (b) set({ theme: b.dataset.themeOpt }); });
  $('#accent-swatches').addEventListener('click', (ev) => { const b = ev.target.closest('[data-accent]'); if (b) set({ accent: b.dataset.accent }); });
  $('#accent-custom').addEventListener('input', (ev) => set({ accent: ev.target.value }));
  $('#font-cards').addEventListener('click', (ev) => { const b = ev.target.closest('[data-font]'); if (b) set({ font: b.dataset.font }); });
  $('#size-seg').addEventListener('click', (ev) => { const b = ev.target.closest('[data-size-opt]'); if (b) set({ size: b.dataset.sizeOpt }); });
  $('#corners-seg').addEventListener('click', (ev) => { const b = ev.target.closest('[data-corners-opt]'); if (b) set({ corners: b.dataset.cornersOpt }); });
  $('#appearance-reset').addEventListener('click', () => set({ ...DEFAULT }));
  apply();
}
