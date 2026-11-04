// Comandos del chat y Mensajes automáticos (Samy).

import { $, api, esc, toast } from './util.js';
import { guideToast } from './guides.js';

const PLAT = { kick: 'Kick', starvios: 'Starvios', twitch: 'Twitch', tiktok: 'TikTok' };
const PERM = { all: 'Todos', mods: 'Moderadores', owner: 'Solo tú' };

let commands = [];
let timers = { enabled: true, items: [] };
let editing = null; // id del comando abierto, 'new' o null
let editingTimer = null;

// ---------------- Comandos ----------------
function cmdForm(c = {}) {
  const p = c.platforms || {};
  const on = (k) => p[k] !== false;
  return `<form class="cmd-form" data-id="${esc(c.id || 'new')}">
    <div class="two">
      <label class="field"><span>Comando</span><span class="prefix"><b>!</b><input name="name" required maxlength="30" value="${esc(c.name || '')}" placeholder="redes" autocomplete="off"></span></label>
      <label class="field"><span>Otros nombres (separados por coma)</span><input name="aliases" value="${esc((c.aliases || []).join(', '))}" placeholder="instagram, insta" autocomplete="off"></label>
    </div>
    <label class="field"><span>Respuesta</span><textarea name="response" rows="2" maxlength="450" required placeholder="¡Hola {usuario}! Sígueme en…">${esc(c.response || '')}</textarea></label>
    <div class="three">
      <label class="field"><span>Quién puede usarlo</span><select name="permission">${Object.entries(PERM).map(([k, v]) => `<option value="${k}" ${c.permission === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>Espera entre usos (s)</span><input name="cooldownSec" type="number" min="0" max="3600" value="${c.cooldownSec ?? 10}"></label>
      <label class="field"><span>Espera por persona (s)</span><input name="userCooldownSec" type="number" min="0" max="3600" value="${c.userCooldownSec ?? 0}"></label>
    </div>
    <div class="field"><span>Dónde funciona</span>
      <div class="row wrap chips">${Object.entries(PLAT).map(([k, v]) => `<label class="chip-check"><input type="checkbox" name="p-${k}" ${on(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
    <label class="switch"><input type="checkbox" name="speak" ${c.speak ? 'checked' : ''}><span></span> Troya dice la respuesta en voz alta</label>
    <div class="row space mt">
      <span class="row tight"><button class="btn primary">${c.id ? 'Guardar cambios' : 'Crear comando'}</button><button type="button" class="btn ghost" data-cmd-cancel>Cancelar</button></span>
      ${c.id ? '<button type="button" class="btn ghost danger" data-cmd-delete>Eliminar</button>' : ''}
    </div>
  </form>`;
}

function renderCommands() {
  const box = $('#cmd-list');
  if (!box) return;
  const rows = commands.map((c) => {
    if (editing === c.id) return `<div class="cmd-item open">${cmdForm(c)}</div>`;
    const where = Object.entries(PLAT).filter(([k]) => c.platforms?.[k] !== false).map(([, v]) => v).join(', ');
    return `<div class="cmd-item ${c.enabled ? '' : 'off'}" data-id="${esc(c.id)}">
      <div class="cmd-head">
        <span class="cmd-name">!${esc(c.name)}${(c.aliases || []).length ? `<small>también ${c.aliases.map((a) => `!${esc(a)}`).join(' ')}</small>` : ''}</span>
        <span class="cmd-resp">${esc(c.response)}</span>
        <span class="cmd-meta">${PERM[c.permission] || 'Todos'} · ${c.cooldownSec ? `cada ${c.cooldownSec} s` : 'sin espera'} · ${esc(where || 'ninguna plataforma')} · ${c.uses || 0} usos</span>
        <label class="switch" title="Activar o apagar"><input type="checkbox" data-cmd-toggle ${c.enabled ? 'checked' : ''}><span></span></label>
        <button type="button" class="btn small" data-cmd-edit>Editar</button>
      </div></div>`;
  });
  if (editing === 'new') rows.unshift(`<div class="cmd-item open new">${cmdForm()}</div>`);
  box.innerHTML = rows.join('') || '<p class="empty">Todavía no tienes comandos. Crea el primero con <b>Nuevo comando</b>.</p>';
  box.querySelector('.cmd-item.open input[name="name"]')?.focus();
}

function readCmdForm(form) {
  const f = new FormData(form);
  const platforms = {};
  for (const k of Object.keys(PLAT)) platforms[k] = f.get(`p-${k}`) === 'on';
  return {
    name: String(f.get('name') || ''),
    aliases: String(f.get('aliases') || ''),
    response: String(f.get('response') || ''),
    permission: String(f.get('permission') || 'all'),
    cooldownSec: Number(f.get('cooldownSec')) || 0,
    userCooldownSec: Number(f.get('userCooldownSec')) || 0,
    speak: f.get('speak') === 'on',
    platforms,
  };
}

async function refreshCommands() {
  commands = (await api('GET', '/api/commands')).commands;
  renderCommands();
}

function initCommandsPage() {
  const page = $('#card-comandos');
  $('#cmd-new').addEventListener('click', () => {
    editing = 'new';
    renderCommands();
  });
  page.addEventListener('submit', async (ev) => {
    if (!ev.target.classList.contains('cmd-form')) return;
    ev.preventDefault();
    const id = ev.target.dataset.id;
    const body = readCmdForm(ev.target);
    try {
      if (id === 'new') await api('POST', '/api/commands', { ...body, enabled: true });
      else await api('PATCH', `/api/commands/${id}`, body);
      editing = null;
      await refreshCommands();
      guideToast('samy', id === 'new' ? `Listo: cuando alguien escriba !${body.name.replace(/^!+/, '').toLowerCase()}, respondo.` : 'Cambios guardados.');
    } catch (e) {
      toast(e.message);
    }
  });
  page.addEventListener('click', async (ev) => {
    const item = ev.target.closest('.cmd-item');
    if (ev.target.closest('[data-cmd-cancel]')) {
      editing = null;
      return renderCommands();
    }
    if (ev.target.closest('[data-cmd-edit]')) {
      editing = item.dataset.id;
      return renderCommands();
    }
    if (ev.target.closest('[data-cmd-delete]')) {
      const id = item.querySelector('form').dataset.id;
      const c = commands.find((x) => x.id === id);
      try {
        await api('DELETE', `/api/commands/${id}`);
        editing = null;
        await refreshCommands();
        toast(`Eliminado !${c?.name || ''}`);
      } catch (e) {
        toast(e.message);
      }
    }
  });
  page.addEventListener('change', async (ev) => {
    if (!ev.target.matches('[data-cmd-toggle]')) return;
    const id = ev.target.closest('.cmd-item').dataset.id;
    try {
      await api('PATCH', `/api/commands/${id}`, { enabled: ev.target.checked });
      await refreshCommands();
    } catch (e) {
      toast(e.message);
    }
  });
  $('#cmd-try-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const out = $('#cmd-try-out');
    const message = $('#cmd-try-text').value.trim();
    if (!message) return;
    const { result } = await api('POST', '/api/commands/try', { message, mod: $('#cmd-try-mod').checked, user: 'Espectador' });
    if (!result) out.innerHTML = message.startsWith('!') ? 'No es uno de tus comandos.' : 'Los comandos empiezan con <code>!</code>';
    else if (result.ran) out.innerHTML = `<b>!${esc(result.command)}</b> responde:<br><span class="said">${esc(result.text)}</span>`;
    else out.innerHTML = `<b>!${esc(result.command)}</b> no responde: ${esc(result.reason)}.`;
  });
}

// ---------------- Mensajes automáticos ----------------
function timerForm(t = {}) {
  const p = t.platforms || {};
  return `<form class="cmd-form timer-form" data-id="${esc(t.id || 'new')}">
    <label class="field"><span>Mensaje</span><textarea name="text" rows="2" maxlength="450" required placeholder="¿Te gusta el directo? ¡Sígueme!">${esc(t.text || '')}</textarea></label>
    <div class="three">
      <label class="field"><span>Cada (minutos)</span><input name="everyMin" type="number" min="1" max="240" value="${t.everyMin ?? 15}"></label>
      <label class="field"><span>Si hubo al menos (mensajes)</span><input name="minChat" type="number" min="0" max="500" value="${t.minChat ?? 5}"></label>
      <div class="field"><span>Dónde</span><div class="row wrap chips">
        <label class="chip-check"><input type="checkbox" name="p-kick" ${p.kick !== false ? 'checked' : ''}><span>Kick</span></label>
        <label class="chip-check"><input type="checkbox" name="p-starvios" ${p.starvios !== false ? 'checked' : ''}><span>Starvios</span></label></div></div>
    </div>
    <div class="row space mt">
      <span class="row tight"><button class="btn primary">${t.id ? 'Guardar cambios' : 'Crear mensaje'}</button><button type="button" class="btn ghost" data-timer-cancel>Cancelar</button></span>
      ${t.id ? '<button type="button" class="btn ghost danger" data-timer-delete>Eliminar</button>' : ''}
    </div>
  </form>`;
}

function renderTimers() {
  const box = $('#timer-list');
  if (!box) return;
  $('#timers-on').checked = timers.enabled !== false;
  $('#card-automaticos').classList.toggle('off', timers.enabled === false);
  const rows = (timers.items || []).map((t) => {
    if (editingTimer === t.id) return `<div class="cmd-item open">${timerForm(t)}</div>`;
    const where = ['kick', 'starvios'].filter((k) => t.platforms?.[k] !== false).map((k) => PLAT[k]).join(' y ');
    return `<div class="cmd-item ${t.enabled ? '' : 'off'}" data-id="${esc(t.id)}">
      <div class="cmd-head timer">
        <span class="cmd-every">cada <b>${t.everyMin}</b> min</span>
        <span class="cmd-resp">${esc(t.text)}</span>
        <span class="cmd-meta">${t.minChat ? `si hubo ${t.minChat}+ mensajes` : 'aunque el chat esté callado'} · ${esc(where || 'ninguna plataforma')}</span>
        <label class="switch" title="Activar o apagar"><input type="checkbox" data-timer-toggle ${t.enabled ? 'checked' : ''}><span></span></label>
        <span class="row tight"><button type="button" class="btn small ghost" data-timer-send>Enviar ahora</button><button type="button" class="btn small" data-timer-edit>Editar</button></span>
      </div></div>`;
  });
  if (editingTimer === 'new') rows.unshift(`<div class="cmd-item open new">${timerForm()}</div>`);
  box.innerHTML = rows.join('') || '<p class="empty">No hay mensajes automáticos. Crea uno con <b>Nuevo mensaje</b>.</p>';
}

async function refreshTimers() {
  timers = (await api('GET', '/api/timers')).timers;
  renderTimers();
}

function initTimersPage() {
  const page = $('#card-automaticos');
  $('#timer-new').addEventListener('click', () => {
    editingTimer = 'new';
    renderTimers();
  });
  $('#timers-on').addEventListener('change', async (ev) => {
    timers = (await api('POST', '/api/timers/enabled', { enabled: ev.target.checked })).timers;
    renderTimers();
  });
  page.addEventListener('submit', async (ev) => {
    if (!ev.target.classList.contains('timer-form')) return;
    ev.preventDefault();
    const f = new FormData(ev.target);
    const body = {
      text: String(f.get('text') || ''),
      everyMin: Number(f.get('everyMin')) || 15,
      minChat: Number(f.get('minChat')) || 0,
      platforms: { kick: f.get('p-kick') === 'on', starvios: f.get('p-starvios') === 'on' },
    };
    const id = ev.target.dataset.id;
    try {
      if (id === 'new') await api('POST', '/api/timers', { ...body, enabled: true });
      else await api('PATCH', `/api/timers/${id}`, body);
      editingTimer = null;
      await refreshTimers();
    } catch (e) {
      toast(e.message);
    }
  });
  page.addEventListener('click', async (ev) => {
    const item = ev.target.closest('.cmd-item');
    try {
      if (ev.target.closest('[data-timer-cancel]')) {
        editingTimer = null;
        return renderTimers();
      }
      if (ev.target.closest('[data-timer-edit]')) {
        editingTimer = item.dataset.id;
        return renderTimers();
      }
      if (ev.target.closest('[data-timer-delete]')) {
        await api('DELETE', `/api/timers/${item.querySelector('form').dataset.id}`);
        editingTimer = null;
        return refreshTimers();
      }
      if (ev.target.closest('[data-timer-send]')) {
        const { sent } = await api('POST', `/api/timers/${item.dataset.id}/send`);
        if (sent.length) guideToast('samy', `Enviado en ${sent.map((p) => PLAT[p]).join(' y ')}.`);
        else toast('No se envió: conecta Kick o Starvios en Escuchar y autoriza una cuenta en Escribir');
      }
    } catch (e) {
      toast(e.message);
    }
  });
  page.addEventListener('change', async (ev) => {
    if (!ev.target.matches('[data-timer-toggle]')) return;
    try {
      await api('PATCH', `/api/timers/${ev.target.closest('.cmd-item').dataset.id}`, { enabled: ev.target.checked });
      await refreshTimers();
    } catch (e) {
      toast(e.message);
    }
  });
}

export function initCommands(hello) {
  commands = hello.commands || [];
  timers = hello.timers || timers;
  initCommandsPage();
  initTimersPage();
  renderCommands();
  renderTimers();
}

export function onCommands(list) {
  commands = list;
  if (!editing) renderCommands();
}
export function onTimers(t) {
  timers = t;
  if (!editingTimer) renderTimers();
}
