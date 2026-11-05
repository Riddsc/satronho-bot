// «Estamos trabajando en ello»: la crew con cascos de obra, para lo que
// todavía no está listo (por ejemplo, las estadísticas de Starvios).
// building(title, text) devuelve el HTML; se pone donde haga falta.

import { mascotSVG } from './mascots.js';
import { mechaHead } from './mecharidds.js';

const HELMET = '<svg class="cz-helmet" viewBox="0 0 60 34" aria-hidden="true"><path d="M6 28 C6 10 18 2 30 2 C42 2 54 10 54 28 Z" fill="#ffc531"/><path d="M27 3 h6 v24 h-6z" fill="#f2a900"/><rect x="0" y="26" width="60" height="7" rx="3.5" fill="#f2a900"/></svg>';
const CREW = [['samy', 1, '#ffb23e'], ['troya', 1.06, '#9b8cff'], ['nono', 1.18, '#4fd1c5'], ['juana', .72, '#ff8fb5'], ['mecha', .98, '#74d14c']];

export function building(title = 'Estamos trabajando en ello', text = 'La crew está construyendo esta parte. Mantente pendiente: llegará en una próxima actualización.') {
  const crew = CREW.map(([id, k, c], i) => `<span class="cz-dog" style="--k:${k};--c:${c};--d:${(i * 0.35).toFixed(2)}s">${HELMET}<span class="cz-face">${id === 'mecha' ? mechaHead('') : mascotSVG(id)}</span></span>`).join('');
  return `<div class="cz" role="status">
    <div class="cz-scene"><div class="cz-crew">${crew}</div><div class="cz-tape"></div></div>
    <div class="cz-sign"><b>🚧 ${title}</b><p>${text}</p></div>
  </div>`;
}
