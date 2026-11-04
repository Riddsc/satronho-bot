// Chat Bot → Inicio (MechaRidds): interruptor general, dónde escribe,
// escribir a mano y lo que ha escrito.

import { $, $$, api, esc, toast, saveConfig, timeOf } from './util.js';
import { guideToast, setBubble } from './guides.js';
import { mechaBust, mechaHead } from './mecharidds.js';

const PLAT = { kick: 'Kick', starvios: 'Starvios', twitch: 'Twitch', tiktok: 'TikTok' };
const SOURCE = { musica: 'Música', comando: 'Comando', automatico: 'Automático', manual: 'Tú', prueba: 'Prueba', bot: 'Bot' };
const WRITERS = ['kick', 'starvios'];

let config;
let status = {}; // conexión de cada plataforma (Escuchar)
let accounts = { kick: null, starvios: null }; // estado de Escribir
let log = [];

// Cuenta con la que escribe cada plataforma, o null.
function writerAccount(p) {
  const st = accounts[p];
  if (!st) return null;
  const pref = st.sendAs === 'bot' && st.bot?.ok ? st.bot : st.me?.ok ? st.me : st.bot?.ok ? st.bot : null;
  return pref ? pref.name || 'tu cuenta' : null;
}

function renderWhere() {
  const box = $('#cb-where');
  if (!box) return;
  const shown = (p) => !config.platforms?.[p]?.hidden;
  const order = [...(config.platformOrder || []), ...Object.keys(PLAT)].filter((p, i, a) => PLAT[p] && a.indexOf(p) === i);
  box.innerHTML = order.filter(shown).map((p) => {
    const canWrite = WRITERS.includes(p);
    const acc = canWrite ? writerAccount(p) : null;
    const live = status[p]?.state === 'connected';
    let state;
    let cls = '';
    if (!canWrite) state = 'Todavía no puedo escribir aquí';
    else if (!acc) { state = 'Falta autorizar una cuenta'; cls = 'warn'; }
    else if (!live) { state = `Escribiré como @${esc(acc)} cuando conectes el canal`; cls = 'wait'; }
    else { state = `Escribiendo como @${esc(acc)}`; cls = 'ok'; }
    const logo = p === 'twitch' ? '<span class="pl" style="background:#9146ff;color:#fff">Tw</span>' : `<span class="pl plogo" data-logo="${p}" aria-hidden="true"></span>`;
    return `<div class="cb-row ${cls} ${canWrite ? '' : 'no'}">${logo}<span><b>${PLAT[p]}</b><small>${state}</small></span><i class="dot"></i></div>`;
  }).join('');
  renderSendTargets();
}

function renderSendTargets() {
  const box = $('#cb-send-where');
  if (!box) return;
  const avail = WRITERS.filter((p) => !config.platforms?.[p]?.hidden && writerAccount(p));
  const prev = new Set($$('#cb-send-where input:checked').map((i) => i.value));
  box.innerHTML = avail.length
    ? avail.map((p) => `<label class="chip-check"><input type="checkbox" value="${p}" ${!prev.size || prev.has(p) ? 'checked' : ''}><span>${PLAT[p]}</span></label>`).join('')
    : '<span class="hint">Autoriza una cuenta en Conexiones → Escribir.</span>';
}

function renderLog() {
  const ul = $('#cb-log');
  if (!ul) return;
  ul.innerHTML = log.length
    ? log.slice(0, 30).map((e) => `<li><time>${esc(timeOf(e.ts))}</time><span class="plat ${e.platform}">${PLAT[e.platform] || e.platform}</span><span class="src">${SOURCE[e.source] || ''}</span><span class="txt">${esc(e.text)}</span></li>`).join('')
    : '<li class="empty">Todavía no he escrito nada en este directo.</li>';
}

function renderEnabled() {
  const on = config.chatBot?.enabled !== false;
  $('#cb-enabled').checked = on;
  $('#card-chatbot').classList.toggle('off', !on);
  const ready = WRITERS.some((p) => writerAccount(p));
  setBubble('mecha', !on
    ? 'Estoy en pausa. Activa el <b>Chat Bot</b> y vuelvo a escribir en tu chat.'
    : ready
      ? 'Todo listo. Crea <b>Comandos</b> o <b>Mensajes automáticos</b>, o escribe algo ahora y lo envío.'
      : 'Para escribir en tu chat necesito una cuenta: autorízala en <b>Conexiones → Escribir</b>.');
}

export function initChatbot(cfg, hello) {
  config = cfg;
  config.chatBot ||= {};
  log = hello.botLog || [];
  accounts = { kick: hello.kickbot || null, starvios: hello.starviosbot || null };
  status = hello.status || {};
  $('#cb-bust').innerHTML = mechaBust();
  for (const el of $$('[data-mecha-icon]')) el.innerHTML = mechaHead();
  renderWhere();
  renderLog();
  renderEnabled();

  $('#cb-enabled').addEventListener('change', (ev) => {
    config.chatBot.enabled = ev.target.checked;
    saveConfig({ chatBot: { enabled: ev.target.checked } });
    renderEnabled();
    guideToast('mecha', ev.target.checked ? 'Chat Bot activado.' : 'Chat Bot en pausa: no escribiré en ningún chat.');
  });
  $('#cb-send').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = $('#cb-send-text').value.trim();
    if (!text) return;
    const platforms = $$('#cb-send-where input:checked').map((i) => i.value);
    if (!platforms.length) return toast('Elige dónde enviarlo');
    try {
      const { sent } = await api('POST', '/api/chatbot/send', { text, platforms });
      $('#cb-send-text').value = '';
      guideToast('mecha', `Enviado en ${sent.map((p) => PLAT[p]).join(' y ')}.`);
    } catch (e) {
      toast(e.message);
    }
  });
  // «Configurar cuentas» abre Conexiones en la pestaña Escribir.
  document.querySelector('[data-conn-go="write"]')?.addEventListener('click', () => {
    setTimeout(() => document.querySelector('[data-conn-tab="write"]')?.click(), 50);
  });
}

export function onBotSaid(entry) {
  log.unshift(entry);
  log.length = Math.min(log.length, 60);
  renderLog();
}
export function onChatbotAccounts(platform, st) {
  accounts[platform] = st;
  if (config) { renderWhere(); renderEnabled(); }
}
export function onChatbotStatus(s) {
  if (!s?.platform) return;
  status[s.platform] = s;
  if (config) renderWhere();
}
