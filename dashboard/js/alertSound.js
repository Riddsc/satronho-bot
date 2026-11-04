// Las alertas siempre suenan. Si hay un overlay de alertas abierto (en OBS
// o en el navegador) suena ahí; si no hay ninguno, suena aquí, en la app,
// con el mismo sonido, volumen y archivo que elegiste. Así una alerta
// nunca se queda muda solo porque no tiene animación en pantalla.

import { playAlertSound, stopAlertSound } from '/overlays/sounds.js';

let overlays = 0;
let enabled = true;
const queue = [];
let busy = false;

export function setAlertOverlays(n) { overlays = Number(n) || 0; }
export function setAlertSoundEnabled(on) { enabled = on !== false; }
export const alertOverlayCount = () => overlays;

async function next() {
  const a = queue.shift();
  if (!a) { busy = false; return; }
  busy = true;
  let secs = 0;
  try { secs = await playAlertSound(a.sound || { sound: 'campanita' }); } catch { /* sin audio */ }
  // Espera lo que dura el sonido (como haría el overlay) antes del siguiente.
  setTimeout(next, Math.min(8000, Math.max(600, (secs || 1.2) * 1000 + 250)));
}

export function onAlert(a) {
  if (overlays > 0 || !enabled || !a) return;
  if (a.sound?.sound === 'none') return;
  // Stickers y alertas «al instante» suenan sin esperar turno.
  if (a.instant || a.kind === 'sticker' || a.type === 'sticker') { playAlertSound(a.sound || { sound: 'burbuja' }).catch(() => {}); return; }
  if (queue.length > 30) queue.shift();
  queue.push(a);
  if (!busy) next();
}

export function onAlertControl(p) {
  if (p?.action === 'clear') queue.length = 0;
  stopAlertSound?.();
}
