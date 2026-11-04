// Ajustes → Atajos de teclado. Atajos globales: los registra la app de
// escritorio (main.js). Aquí se eligen las teclas y se ejecutan las acciones
// de voz, que suenan en este panel.

import { $, api, esc, toast, saveConfig } from './util.js';
import { skipTts } from './voice.js';
import { guideToast } from './guides.js';

const ACTIONS = [
  { id: 'skipVoice', name: 'Saltar el mensaje que Troya está leyendo' },
  { id: 'toggleVoice', name: 'Apagar o encender la voz' },
  { id: 'musicSkip', name: 'Siguiente canción' },
  { id: 'musicPause', name: 'Pausar o seguir la música' },
  { id: 'testAlert', name: 'Lanzar una alerta de prueba' },
  { id: 'showApp', name: 'Mostrar Satronho Bot' },
];

let config;
let status = { failed: [] };
let recording = null;

// Tecla del navegador -> nombre de Electron.
function keyName(ev) {
  const c = ev.code;
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit\d$/.test(c)) return c.slice(5);
  if (/^Numpad\d$/.test(c)) return `num${c.slice(6)}`;
  if (/^F\d{1,2}$/.test(c)) return c;
  const map = { Space: 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Insert: 'Insert', Delete: 'Delete', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/' };
  return map[c] || '';
}
const pretty = (k) => (k ? k.split('+').map((p) => `<kbd>${esc(p === 'Ctrl' ? 'Ctrl' : p)}</kbd>`).join('<i>+</i>') : '<span class="muted">sin tecla</span>');

function render() {
  const hk = config.hotkeys;
  $('#hotkeys-on').checked = Boolean(hk.enabled);
  $('#hotkeys-card').classList.toggle('off', !hk.enabled);
  const failed = new Map((status.failed || []).map((f) => [f.action, f.reason]));
  $('#hotkeys-list').innerHTML = ACTIONS.map((a) => {
    const key = hk.keys?.[a.id] || '';
    const rec = recording === a.id;
    const problem = hk.enabled && failed.get(a.id);
    return `<div class="hk-row ${problem ? 'bad' : ''}">
      <span>${esc(a.name)}${problem ? `<small>${problem === 'repetido' ? 'Esta combinación ya la usa otro atajo de aquí.' : 'Otro programa ya usa esta combinación: elige otra.'}</small>` : ''}</span>
      <button type="button" class="hk-key ${rec ? 'rec' : ''}" data-hk="${a.id}" title="Cambiar">${rec ? 'Pulsa la combinación… (Esc cancela)' : pretty(key)}</button>
      <button type="button" class="btn small ghost" data-hk-clear="${a.id}" ${key ? '' : 'disabled'} title="Quitar este atajo">Quitar</button>
    </div>`;
  }).join('');
}

function setKey(action, key) {
  config.hotkeys.keys[action] = key;
  saveConfig({ hotkeys: { keys: { [action]: key } } });
  render();
}

export function initHotkeys(cfg) {
  config = cfg;
  config.hotkeys ||= { enabled: false, keys: {} };
  api('GET', '/api/hotkeys').then((r) => {
    status = r.status || status;
    $('#hotkeys-web').hidden = r.available;
    render();
  }).catch(() => {});
  render();
  $('#hotkeys-on').addEventListener('change', (ev) => {
    config.hotkeys.enabled = ev.target.checked;
    saveConfig({ hotkeys: { enabled: ev.target.checked } });
    render();
  });
  $('#hotkeys-list').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-hk]');
    if (b) {
      recording = recording === b.dataset.hk ? null : b.dataset.hk;
      return render();
    }
    const c = ev.target.closest('[data-hk-clear]');
    if (c) setKey(c.dataset.hkClear, '');
  });
  window.addEventListener('keydown', (ev) => {
    if (!recording) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.key === 'Escape') {
      recording = null;
      return render();
    }
    const k = keyName(ev);
    if (!k) return; // todavía solo modificadores
    const mods = [ev.ctrlKey && 'Ctrl', ev.altKey && 'Alt', ev.shiftKey && 'Shift', ev.metaKey && 'Super'].filter(Boolean);
    if (!mods.length && !/^F\d{1,2}$/.test(k)) return toast('Usa Ctrl, Alt o Shift con otra tecla (o una tecla F1–F12)');
    const action = recording;
    recording = null;
    setKey(action, [...mods, k].join('+'));
  }, true);
}

export function onHotkeysStatus(st) {
  status = st || { failed: [] };
  if (config) render();
  if (status.failed?.length && config?.hotkeys?.enabled) guideToast('samy', 'Alguno de tus atajos no funciona: míralo en Ajustes → Atajos de teclado.');
}

// Acciones de voz que llegan desde un atajo.
export function onHotkey({ action }) {
  if (action === 'skipVoice') skipTts();
  if (action === 'toggleVoice') {
    const on = !config.tts.enabled;
    config.tts.enabled = on;
    saveConfig({ tts: { enabled: on } });
    const box = document.querySelector('[data-tts="enabled"]');
    if (box) box.checked = on;
    guideToast('troya', on ? 'Voz encendida.' : 'Voz apagada.');
  }
}
