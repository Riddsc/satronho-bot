// Aviso al cerrar la app: Samy pregunta antes de apagar todo.
// La ventana de Electron llama a window.__satronhoAskClose() al tocar ✕;
// aquí se muestra la tarjeta y el servidor le dice a la ventana qué hacer.
import { $, api, esc, saveConfig, tr } from './util.js';
import { mascotSVG } from './mascots.js';

let isLive = () => false;

function render(live) {
  const box = $('#close-ask');
  const stops = [
    ['🔊', tr('La voz deja de leer tu chat.')],
    ['🔔', tr('Las alertas y los overlays de OBS se quedan quietos.')],
    ['🎵', tr('La música se detiene y nadie puede pedir canciones.')],
    ['🤖', tr('El bot deja de responder en tu chat.')],
    ['🪙', tr('Los puntos del canal dejan de sumar.')],
  ];
  box.innerHTML = `<div class="ca-card" role="document">
    <div class="ca-head"><span class="ca-dog">${mascotSVG('samy', 'Samy')}</span>
      <div><h2 id="ca-title">${esc(tr('¿Cerramos Satronho Bot?'))}</h2>
      <p>${esc(live ? tr('Estás conectado a tu directo. Si cierro:') : tr('No estás conectado a ningún directo, así que no se pierde nada.'))}</p></div></div>
    ${live ? `<ul class="ca-stops">${stops.map(([ic, t]) => `<li><span aria-hidden="true">${ic}</span>${esc(t)}</li>`).join('')}</ul>
    <p class="ca-tip">${esc(tr('¿Solo quieres despejar la pantalla? Escóndela junto al reloj: todo sigue funcionando.'))}</p>` : ''}
    <label class="ca-again"><input type="checkbox" id="ca-never"> ${esc(tr('No volver a preguntar'))}</label>
    <div class="ca-actions">
      <button type="button" class="btn ghost" data-ca="stay">${esc(tr('Me quedo'))}</button>
      <button type="button" class="btn" data-ca="tray">${esc(tr('Esconder junto al reloj'))}</button>
      <button type="button" class="btn danger" data-ca="close">${esc(tr('Cerrar'))}</button>
    </div>
  </div>`;
}

export function initCloseAsk({ live } = {}) {
  if (live) isLive = live;
  const box = $('#close-ask');
  if (!box) return;
  const hide = () => { box.hidden = true; };
  window.__satronhoAskClose = () => {
    const l = Boolean(isLive());
    render(l);
    box.hidden = false;
    box.querySelector(l ? '[data-ca="tray"]' : '[data-ca="close"]')?.focus();
    return true;
  };
  box.addEventListener('click', async (ev) => {
    if (ev.target === box) return hide();
    const b = ev.target.closest('[data-ca]');
    if (!b) return;
    const action = b.dataset.ca;
    if ($('#ca-never')?.checked && action !== 'stay') await saveConfig({ window: { askOnClose: false } });
    hide();
    if (action === 'stay') return;
    try {
      await api('POST', '/api/window/action', { action });
    } catch {
      /* fuera de la app de escritorio no hay ventana que cerrar */
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !box.hidden) hide();
  });
}
