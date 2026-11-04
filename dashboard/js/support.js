// Ayuda → Reportar un problema (MechaRidds). Llega a Discord de Ridds.

import { $, $$, api, toast } from './util.js';
import { guideToast } from './guides.js';

const LABEL = {
  error: ['¿Qué pasó y qué estabas haciendo?', 'Por ejemplo: conecté Kick, pedí una canción con !play y no sonó nada.'],
  ayuda: ['¿En qué te ayudamos?', 'Por ejemplo: no sé cómo poner las alertas en OBS.'],
  idea: ['¿Qué te gustaría que tuviera Satronho Bot?', 'Por ejemplo: un sorteo con !participar.'],
};

let kind = 'error';
let available = true;

async function loadDiag() {
  try {
    const r = await api('GET', '/api/support');
    available = r.available;
    $('#rep-diag-text').textContent = r.diagnostics;
    $('#rep-unavailable').hidden = available;
    $('#rep-send').disabled = !available;
  } catch {
    $('#rep-diag-text').textContent = 'No se pudo leer el diagnóstico.';
  }
}

function reportText() {
  const k = { error: 'Algo falla', ayuda: 'Necesito ayuda', idea: 'Tengo una idea' }[kind];
  const parts = [`Satronho Bot · ${k}`, '', $('#rep-msg').value.trim()];
  if ($('#rep-contact').value.trim()) parts.push('', `Contacto: ${$('#rep-contact').value.trim()}`);
  if ($('#rep-diag').checked) parts.push('', '--- Diagnóstico ---', $('#rep-diag-text').textContent);
  return parts.join('\n');
}

export function initSupport() {
  // Errores del panel → diagnóstico.
  const report = (message) => fetch('/api/support/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }).catch(() => {});
  window.addEventListener('error', (e) => report(`${e.message} (${e.filename?.split('/').pop()}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) => report(String(e.reason?.message || e.reason)));

  $('#rep-kind').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-kind]');
    if (!b) return;
    kind = b.dataset.kind;
    for (const x of $$('#rep-kind [data-kind]')) x.setAttribute('aria-pressed', String(x === b));
    $('#rep-msg-label').textContent = LABEL[kind][0];
    $('#rep-msg').placeholder = LABEL[kind][1];
    $('#rep-diag').checked = kind === 'error';
  });
  $('#rep-refresh').addEventListener('click', loadDiag);
  $('#rep-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(reportText());
      toast('Reporte copiado');
    } catch {
      toast('No se pudo copiar');
    }
  });
  $('#rep-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('#rep-send');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      await api('POST', '/api/support/report', { kind, message: $('#rep-msg').value, contact: $('#rep-contact').value, includeDiag: $('#rep-diag').checked });
      $('#rep-msg').value = '';
      guideToast('mecha', 'Reporte enviado. Ridds lo verá en Discord. ¡Gracias!');
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = !available;
      btn.textContent = 'Enviar a Ridds';
    }
  });
  loadDiag();
}
