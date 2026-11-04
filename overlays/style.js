// Estilo compartido de los overlays: la app manda tipografía, colores,
// fondo, esquinas y tamaño, y OBS se actualiza solo (sin volver a pegar la URL).
// Los parámetros de la URL (?color=, ?scale=) mandan sobre lo de la app.

import { param } from './client.js';

const FAMILIES = {
  'bricolage-grotesque': 'Bricolage Grotesque', nunito: 'Nunito', fredoka: 'Fredoka', 'baloo-2': 'Baloo 2',
  comfortaa: 'Comfortaa', poppins: 'Poppins', inter: 'Inter', 'space-grotesk': 'Space Grotesk',
  'lilita-one': 'Lilita One', 'jetbrains-mono': 'JetBrains Mono',
};
const RADIUS = { round: 1, soft: 0.55, square: 0.15 };

let current = {};
export const overlayStyle = () => current;

export function applyOverlayStyle(s = {}) {
  current = { ...current, ...s };
  const st = current;
  const root = document.documentElement.style;
  root.setProperty('--font', `'${FAMILIES[st.font] || FAMILIES['bricolage-grotesque']}', system-ui, sans-serif`);
  if (st.accent && !param('color')) root.setProperty('--accent', st.accent);
  if (st.accent) root.setProperty('--brand', param('color') || st.accent);
  if (st.text) root.setProperty('--ink', st.text);
  root.setProperty('--r', String(RADIUS[st.corners] ?? 1));
  root.setProperty('--scale', param('scale') || String(st.scale || 1));
  document.body.dataset.card = st.card || 'solid';
  document.body.dataset.alertColors = st.alertColors || 'type';
}

// Vista previa dentro de la app: la página de Overlays manda el estilo al instante.
export function listenPreview(onDemo) {
  window.addEventListener('message', (ev) => {
    if (ev.origin !== location.origin) return;
    if (ev.data?.satronhoStyle) applyOverlayStyle(ev.data.satronhoStyle);
    if (ev.data?.satronhoDemo && onDemo) onDemo();
  });
}

export const isPreview = param('preview') === '1';
