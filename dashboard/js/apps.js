// Apps conectadas y reacciones (0.29). Conecta OBS, VTube Studio,
// Voicemod, Streamer.bot, luces WLED y VRChat, y arma «reacciones»: cuando
// pase algo en tu directo, esas apps hacen lo que elijas. Cualquier reacción
// se puede lanzar también desde un botón del Stream Deck.

import { $, $$, api, esc, toast, tr, PLATFORM_NAMES } from './util.js';
import { sayFor } from './guides.js';

const APP_INFO = {
  obs: { name: 'OBS Studio', mark: 'OBS', color: '#8fa3ff', what: 'Cambia de escena, muestra u oculta fuentes y filtros, silencia micrófonos.',
    how: ['Abre OBS → Herramientas → Ajustes del servidor WebSocket.', 'Activa «Habilitar servidor WebSocket».', 'Toca «Mostrar información de conexión» y copia la contraseña aquí.'] },
  vtube: { name: 'VTube Studio', mark: 'VTS', color: '#ff8fc8', what: 'Lanza los atajos (hotkeys) de tu modelo: expresiones, animaciones, objetos.',
    how: ['En VTube Studio abre Ajustes y baja hasta «VTube Studio API».', 'Enciende «Start API» (puerto 8001).', 'Al conectar, VTube Studio te pide permiso para «Satronho Bot»: acéptalo.'] },
  voicemod: { name: 'Voicemod', mark: 'VM', color: '#41e0c0', what: 'Cambia tu voz por unos segundos o suena uno de tus memes.',
    how: ['Voicemod solo deja conectar programas con una clave de desarrollador.', 'Pídela gratis en el portal de desarrolladores de Voicemod (Control API).', 'Pega aquí la clave que te den.'] },
  streamerbot: { name: 'Streamer.bot', mark: 'SB', color: '#b88bff', what: 'Ejecuta cualquiera de tus acciones de Streamer.bot.',
    how: ['En Streamer.bot ve a Servers/Clients → WebSocket Server.', 'Enciéndelo (puerto 8080) y marca «Auto Start».', 'Si le pusiste contraseña, cópiala aquí.'] },
  wled: { name: 'Luces WLED', mark: 'LED', color: '#ffe066', what: 'Enciende tus luces, cambia de color o pone uno de tus efectos guardados.',
    how: ['Tus luces tienen que estar en tu misma red wifi.', 'En la app de WLED mira la dirección (por ejemplo 192.168.1.50).', 'Escríbela aquí. Tus efectos guardados (presets) aparecen solos.'] },
  vrchat: { name: 'VRChat', mark: 'VRC', color: '#6fdc8c', what: 'Escribe en el cuadro de chat sobre tu cabeza y mueve parámetros de tu avatar.',
    how: ['En VRChat abre el menú rápido → Opciones → OSC.', 'Actívalo. No hay nada más que configurar.', 'Los nombres de parámetros son los de tu avatar (en Unity o en el menú OSC).'] },
};
const SECRET_LABEL = { password: 'Contraseña', clientKey: 'Clave de desarrollador' };

// Qué puede hacer cada app y qué datos pide cada acción.
const DOES = {
  obs: {
    scene: { label: 'Cambiar de escena', fields: [['scene', 'opt:scenes', 'Escena'], ['seconds', 'num', 'Volver después de (s, 0 = quedarse)']] },
    source: { label: 'Mostrar u ocultar una fuente', fields: [['scene', 'opt:scenes', 'En la escena'], ['source', 'opt:sources', 'Fuente'], ['mode', 'mode3', ''], ['seconds', 'num', 'Volver después de (s)']] },
    filter: { label: 'Encender o apagar un filtro', fields: [['source', 'text', 'Fuente'], ['filter', 'text', 'Filtro'], ['mode', 'mode2', ''], ['seconds', 'num', 'Volver después de (s)']] },
    mute: { label: 'Silenciar un audio', fields: [['source', 'text', 'Audio (como se llama en OBS)'], ['mode', 'mute', ''], ['seconds', 'num', 'Volver después de (s)']] },
  },
  vtube: { hotkey: { label: 'Lanzar un atajo del modelo', fields: [['hotkey', 'opt:hotkeys', 'Atajo']] } },
  voicemod: {
    voice: { label: 'Cambiar de voz', fields: [['voice', 'opt:voices', 'Voz'], ['seconds', 'num', 'Volver a tu voz después de (s)']] },
    meme: { label: 'Sonar un meme', fields: [['meme', 'opt:memes', 'Meme']] },
    toggle: { label: 'Encender o apagar el cambio de voz', fields: [] },
  },
  streamerbot: { action: { label: 'Ejecutar una acción', fields: [['action', 'opt:actions', 'Acción']] } },
  wled: {
    preset: { label: 'Poner un efecto guardado', fields: [['preset', 'opt:presets', 'Efecto'], ['seconds', 'num', 'Volver como estaba después de (s)']] },
    color: { label: 'Poner un color', fields: [['color', 'color', 'Color'], ['bri', 'num', 'Brillo (1–255)'], ['seconds', 'num', 'Volver como estaba después de (s)']] },
    power: { label: 'Encender o apagar', fields: [['mode', 'power', ''], ['seconds', 'num', 'Volver después de (s)']] },
  },
  vrchat: {
    chatbox: { label: 'Escribir en el cuadro de chat', fields: [['text', 'text', 'Texto ({usuario} y {mensaje} se cambian solos)']] },
    param: { label: 'Mover un parámetro del avatar', fields: [['param', 'text', 'Parámetro'], ['kind', 'kind', 'Tipo'], ['value', 'text', 'Valor'], ['seconds', 'num', 'Volver después de (s)']] },
  },
};
const WHEN = {
  gift: 'Llega un regalo',
  follow: 'Alguien te sigue',
  sub: 'Alguien se suscribe',
  like: 'Llegan likes',
  share: 'Alguien comparte el directo',
  superfan: 'Alguien se vuelve superfan',
  command: 'Alguien escribe un comando',
  reward: 'Canjean una recompensa de Kick',
  redeem: 'Canjean algo de tu tienda',
  chest: 'Abren un cofre',
  'live-start': 'Empiezas el directo',
  manual: 'Solo con un botón (Stream Deck o aquí)',
};

let appsList = [];
let reactions = [];
let deck = { token: '', base: '' };
let shopInfo = { items: [], chests: [] };
const opts = {};
const lastFired = {};

const appOf = (id) => appsList.find((a) => a.id === id);
const debounce = (fn, ms = 500) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const uid = () => Math.random().toString(36).slice(2, 12);
const STATE = { off: 'Apagada', connecting: 'Conectando…', connected: 'Conectada', error: 'Con problema' };

// ================= Apps =================
function appCard(a) {
  const info = APP_INFO[a.id];
  const st = a.status || { state: 'off' };
  const secrets = Object.entries(a.secrets || {}).map(([k, has]) => `<label class="ap-f"><span>${tr(SECRET_LABEL[k] || k)}</span>
    <input type="password" data-secret="${k}" autocomplete="off" placeholder="${esc(has ? tr('Guardada ✓ (escribe para cambiarla)') : tr('Pégala aquí'))}"></label>`).join('');
  const host = a.id === 'wled'
    ? `<label class="ap-f"><span>${tr('Dirección de las luces')}</span><input data-cfg="host" value="${esc(a.host)}" placeholder="192.168.1.50" spellcheck="false"></label>`
    : '';
  return `<article class="card ap-card ${a.enabled ? 'on' : ''}" data-app="${a.id}" style="--ac:${info.color}">
    <header>
      <span class="ap-mark" aria-hidden="true">${info.mark}</span>
      <div class="ap-t"><h3>${esc(info.name)}</h3><span class="ap-st ${st.state}">${tr(STATE[st.state] || st.state)}</span></div>
      <label class="switch"><input type="checkbox" data-cfg="enabled" ${a.enabled ? 'checked' : ''} aria-label="${esc(tr('Conectar {0}', info.name))}"><span></span></label>
    </header>
    <p class="hint">${tr(info.what)}</p>
    ${st.detail && st.state !== 'connected' ? `<p class="ap-detail ${st.state}">${esc(tr(st.detail))}</p>` : ''}
    ${host}${secrets}
    <details class="ap-how"><summary>${tr('Cómo activarlo')}</summary><ol>${info.how.map((h) => `<li>${tr(h)}</li>`).join('')}</ol></details>
    <details class="ap-adv"><summary>${tr('Avanzado')}</summary>
      <div class="ap-row">${a.id !== 'wled' ? `<label class="ap-f"><span>${tr('Equipo')}</span><input data-cfg="host" value="${esc(a.host)}" spellcheck="false"></label>` : ''}
      <label class="ap-f"><span>${tr('Puerto')}</span><input type="number" class="num" data-cfg="port" value="${a.port}" min="1" max="65535"></label></div>
      <div class="row tight wrap"><button type="button" class="btn small" data-reconnect>↻ ${tr('Reconectar')}</button>${a.id === 'vtube' && a.approved ? `<button type="button" class="btn small ghost" data-forget>${tr('Olvidar el permiso')}</button>` : ''}</div>
    </details>
  </article>`;
}

function deckCard() {
  return `<article class="card ap-card ap-deck on" style="--ac:#5ab0ff">
    <header><span class="ap-mark" aria-hidden="true">⌨</span><div class="ap-t"><h3>Stream Deck</h3><span class="ap-st connected">${tr('Siempre lista')}</span></div></header>
    <p class="hint">${tr('Cada reacción tiene su propia dirección. Ponla en un botón con la acción «Sitio web» (marca «Acceder en segundo plano») o con un plugin de pedidos HTTP.')}</p>
    <p class="hint">${tr('La dirección lleva una clave: si alguien la ve, cámbiala.')}</p>
    <div class="row tight wrap"><button type="button" class="btn small" data-deck-go>${tr('Ver las direcciones')}</button><button type="button" class="btn small ghost" data-deck-renew>${tr('Cambiar la clave')}</button></div>
  </article>`;
}

function renderApps() {
  const box = $('#ap-apps');
  if (!box) return;
  box.innerHTML = `<div class="ap-grid">${appsList.map(appCard).join('')}${deckCard()}</div>`;
}

function updateStatus(p) {
  const a = appOf(p.id);
  if (!a) return;
  const was = a.status?.state;
  a.status = { state: p.state, detail: p.detail || '' };
  const card = $(`#ap-apps [data-app="${p.id}"]`);
  if (card && !card.contains(document.activeElement)) {
    card.outerHTML = appCard(a);
  } else if (card) {
    const pill = $('.ap-st', card);
    pill.className = `ap-st ${p.state}`;
    pill.textContent = tr(STATE[p.state] || p.state);
  }
  if (p.state === 'connected' && was !== 'connected') {
    delete opts[p.id];
    if (!$('#page-apps')?.hidden) sayFor('samy', tr('¡{0} conectada!', APP_INFO[p.id].name), 5000, 'ok');
    renderReactions();
  }
}

// ================= Reacciones =================
async function optionsOf(app, force = false) {
  if (!force && opts[app]) return opts[app];
  if (appOf(app)?.status?.state !== 'connected') return null;
  try { opts[app] = (await api('GET', `/api/apps/${app}/options`)).options; } catch { opts[app] = null; }
  return opts[app];
}

function choiceList(app, key, step) {
  const o = opts[app];
  if (!o) return null;
  if (key === 'sources') return (o.sources?.[step.scene] || []).map((n) => ({ id: n, name: n }));
  const raw = o[key];
  if (!Array.isArray(raw)) return null;
  return raw.map((x) => (typeof x === 'string' ? { id: x, name: x } : { id: String(x.id), name: x.group ? `${x.group} · ${x.name}` : x.name }));
}

function fieldHtml(app, step, [key, kind, label], si) {
  const v = key === 'items' ? (step.items || [])[0] || '' : step[key] ?? '';
  const A = `data-sf="${key}" data-si="${si}"`;
  const lab = (inner) => `<label class="ap-f"><span>${tr(label)}</span>${inner}</label>`;
  if (kind.startsWith('opt:')) {
    const list = choiceList(app, kind.slice(4), step);
    if (list) {
      const has = list.some((x) => x.id === String(v));
      return lab(`<select ${A}><option value="">${tr('Elige…')}</option>${list.map((x) => `<option value="${esc(x.id)}" ${x.id === String(v) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}${v && !has ? `<option value="${esc(v)}" selected>${esc(v)} ${tr('(no está)')}</option>` : ''}</select>`);
    }
    return lab(`<input ${A} value="${esc(v)}" placeholder="${esc(tr('Conecta la app para elegir de una lista'))}">`);
  }
  if (kind === 'num') return lab(`<input type="number" class="num" ${A} value="${esc(v === '' ? (key === 'amount' ? 1 : key === 'bri' ? 200 : 0) : v)}" min="0">`);
  if (kind === 'color') return lab(`<input type="color" ${A} value="${esc(v || '#ff4fa0')}">`);
  const sel = (pairs) => lab(`<select ${A}>${pairs.map(([k, n]) => `<option value="${k}" ${String(v || pairs[0][0]) === k ? 'selected' : ''}>${tr(n)}</option>`).join('')}</select>`);
  if (kind === 'mode3') return sel([['show', 'Mostrar'], ['hide', 'Ocultar'], ['toggle', 'Alternar']]);
  if (kind === 'mode2') return sel([['show', 'Encender'], ['hide', 'Apagar']]);
  if (kind === 'mute') return sel([['hide', 'Silenciar'], ['show', 'Quitar silencio']]);
  if (kind === 'power') return sel([['show', 'Encender'], ['hide', 'Apagar'], ['toggle', 'Alternar']]);
  if (kind === 'kind') return sel([['bool', 'Sí o no'], ['int', 'Número entero'], ['float', 'Número con decimales']]);
  return lab(`<input ${A} value="${esc(v)}" maxlength="300">`);
}

function stepHtml(step, si, r) {
  const usable = appsList.filter((a) => a.enabled || a.id === step.app);
  const appSel = `<select data-sf="app" data-si="${si}" aria-label="${esc(tr('App'))}">
    <option value="wait" ${step.app === 'wait' ? 'selected' : ''}>⏳ ${tr('Esperar')}</option>
    ${usable.map((a) => `<option value="${a.id}" ${a.id === step.app ? 'selected' : ''}>${esc(APP_INFO[a.id].name)}</option>`).join('')}</select>`;
  let body = '';
  if (step.app === 'wait') {
    body = `<label class="ap-f"><span>${tr('Segundos')}</span><input type="number" class="num" data-sf="seconds" data-si="${si}" value="${step.seconds ?? 1}" min="0" max="120" step="0.5"></label>`;
  } else {
    const does = DOES[step.app] || {};
    const d = does[step.do] ? step.do : Object.keys(does)[0];
    body = `<label class="ap-f"><span>${tr('Qué hace')}</span><select data-sf="do" data-si="${si}">${Object.entries(does).map(([k, x]) => `<option value="${k}" ${k === d ? 'selected' : ''}>${tr(x.label)}</option>`).join('')}</select></label>
      ${(does[d]?.fields || []).map((f) => fieldHtml(step.app, step, f, si)).join('')}`;
  }
  const st = step.app !== 'wait' ? appOf(step.app)?.status?.state : 'connected';
  return `<li class="ap-step" data-si="${si}">
    <span class="ap-sn">${si + 1}</span>
    <div class="ap-sb">${appSel}${body}${st !== 'connected' ? `<small class="ap-warn">${tr('{0} no está conectada ahora', APP_INFO[step.app]?.name || '')}</small>` : ''}</div>
    <span class="ap-stools">
      ${step.app !== 'wait' ? `<button type="button" class="btn small ghost" data-step-test title="${esc(tr('Probar este paso'))}">▶</button>` : ''}
      <button type="button" class="btn small ghost" data-step-move="-1" ${si === 0 ? 'disabled' : ''} aria-label="${esc(tr('Subir'))}">▲</button>
      <button type="button" class="btn small ghost" data-step-move="1" ${si === r.steps.length - 1 ? 'disabled' : ''} aria-label="${esc(tr('Bajar'))}">▼</button>
      <button type="button" class="btn small ghost danger" data-step-del aria-label="${esc(tr('Quitar paso'))}">✕</button>
    </span></li>`;
}

function whenHtml(r) {
  const w = r.when;
  const plat = `<label class="ap-f"><span>${tr('En')}</span><select data-wf="platform"><option value="any">${tr('Cualquier plataforma')}</option>${['tiktok', 'kick', 'twitch', 'starvios'].map((p) => `<option value="${p}" ${w.platform === p ? 'selected' : ''}>${esc(PLATFORM_NAMES[p])}</option>`).join('')}</select></label>`;
  let extra = '';
  if (w.type === 'gift') extra = `<label class="ap-f"><span>${tr('Regalo (vacío = cualquiera)')}</span><input data-wf="gift" value="${esc(w.gift)}" placeholder="${esc(tr('Rosa'))}"></label><label class="ap-f"><span>${tr('Que valga al menos (monedas)')}</span><input type="number" class="num" data-wf="minCoins" value="${w.minCoins}" min="0"></label>`;
  if (w.type === 'sub') extra = `<label class="ap-f"><span>${tr('Desde cuántas suscripciones')}</span><input type="number" class="num" data-wf="minAmount" value="${w.minAmount || 1}" min="1"></label>`;
  if (w.type === 'like') extra = `<label class="ap-f"><span>${tr('Desde cuántos likes de una vez')}</span><input type="number" class="num" data-wf="minAmount" value="${w.minAmount}" min="0"></label>`;
  if (w.type === 'command') extra = `<label class="ap-f"><span>${tr('Comando')}</span><span class="hu-cmd"><b>!</b><input data-wf="command" value="${esc(w.command)}" maxlength="30" placeholder="baile"></span></label>`;
  if (w.type === 'reward') extra = `<label class="ap-f"><span>${tr('Recompensa (vacío = cualquiera)')}</span><input data-wf="reward" value="${esc(w.reward)}"></label>`;
  if (w.type === 'redeem') extra = `<label class="ap-f"><span>${tr('Qué')}</span><select data-wf="item"><option value="">${tr('Cualquier cosa de la tienda')}</option>${shopInfo.items.map((it) => `<option value="${esc(it.id)}" ${it.id === w.item ? 'selected' : ''}>${esc(it.emoji)} ${esc(it.name)}</option>`).join('')}</select></label>`;
  if (w.type === 'chest') extra = `<label class="ap-f"><span>${tr('Cofre')}</span><select data-wf="chest"><option value="">${tr('Cualquier cofre')}</option>${shopInfo.chests.map((c) => `<option value="${esc(c.id)}" ${c.id === w.chest ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('')}</select></label>`;
  return `<div class="ap-when"><label class="ap-f"><span>${tr('Cuando')}</span><select data-wf="type">${Object.entries(WHEN).map(([k, n]) => `<option value="${k}" ${k === w.type ? 'selected' : ''}>${tr(n)}</option>`).join('')}</select></label>
    ${['manual', 'redeem', 'chest', 'live-start'].includes(w.type) ? '' : plat}${extra}</div>`;
}

function reactionHtml(r, ri) {
  const url = deck.token ? `${deck.base}/${deck.token}/${r.id}` : '';
  const f = lastFired[r.id];
  return `<article class="card ap-re ${r.enabled ? '' : 'off'}" data-ri="${ri}">
    <header><input class="ap-rname" data-rf="name" value="${esc(r.name)}" maxlength="60" aria-label="${esc(tr('Nombre de la reacción'))}">
      ${f ? `<span class="ap-fired ${f.ok ? 'ok' : 'bad'}" title="${esc(f.errors?.join(' · ') || '')}">${f.ok ? tr('Funcionó') : tr('Falló un paso')}</span>` : ''}
      <label class="switch"><input type="checkbox" data-rf="enabled" ${r.enabled ? 'checked' : ''} aria-label="${esc(tr('Activa'))}"><span></span></label></header>
    ${whenHtml(r)}
    <ol class="ap-steps">${r.steps.map((s, si) => stepHtml(s, si, r)).join('') || `<li class="empty">${tr('Sin pasos todavía.')}</li>`}</ol>
    <div class="row space wrap ap-rfoot">
      <span class="row tight wrap"><button type="button" class="btn small" data-step-add ${r.steps.length >= 12 ? 'disabled' : ''}>＋ ${tr('Paso')}</button>
        <label class="ap-mini">${tr('No repetir en')} <input type="number" class="num" data-rf="cooldownSec" value="${r.cooldownSec}" min="0" max="3600"> ${tr('s')}</label></span>
      <span class="row tight wrap"><button type="button" class="btn small primary" data-re-test>▶ ${tr('Probar')}</button>
        ${url ? `<button type="button" class="btn small ghost" data-copy="${esc(url)}" title="${esc(tr('Copiar la dirección para el Stream Deck'))}">⌨ ${tr('Copiar dirección')}</button>` : ''}
        <button type="button" class="btn small ghost danger" data-re-del>✕</button></span>
    </div></article>`;
}

async function renderReactions() {
  const box = $('#ap-reactions');
  if (!box) return;
  const need = new Set(reactions.flatMap((r) => r.steps.map((s) => s.app)).filter((a) => a !== 'wait'));
  await Promise.all([...need].map((a) => optionsOf(a)));
  if (box.contains(document.activeElement) && document.activeElement.matches('input:not([type=checkbox]), textarea')) return;
  const anyOn = appsList.some((a) => a.enabled);
  box.innerHTML = `${anyOn ? '' : `<div class="hu-warn">${tr('Todavía no conectas ninguna app. Puedes armar reacciones igual y conectar después.')} <button type="button" class="btn small" data-ap-tab="apps">${tr('Ir a Apps')}</button></div>`}
    <div class="row space ap-rhead"><p class="hint">${tr('Los pasos van en orden. Usa «Esperar» entre uno y otro si quieres una pausa.')}</p><button type="button" class="btn primary" id="ap-radd">＋ ${tr('Reacción')}</button></div>
    <div class="ap-res">${reactions.map(reactionHtml).join('') || `<p class="empty">${tr('Aún no hay reacciones. Crea la primera: por ejemplo, «cuando llegue una rosa, cambia a la escena Baile por 10 segundos».')}</p>`}</div>`;
}

const saveReactions = debounce(async () => {
  try { reactions = (await api('POST', '/api/reactions', { reactions })).reactions; } catch (e) { toast(tr('No se guardó: {0}', e.message)); }
});

function newStep() {
  const a = appsList.find((x) => x.enabled && x.status?.state === 'connected') || appsList.find((x) => x.enabled);
  if (!a) return { app: 'wait', seconds: 1 };
  return { app: a.id, do: Object.keys(DOES[a.id])[0] };
}

async function onInput(ev) {
  const el = ev.target;
  const page = $('#page-apps');
  const card = el.closest('[data-app]');
  if (card && (el.dataset.cfg || el.dataset.secret) && ev.type === 'change') {
    const patch = {};
    if (el.dataset.cfg) patch[el.dataset.cfg] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
    if (el.dataset.secret) { if (!el.value) return; patch[el.dataset.secret] = el.value; }
    try {
      const r = await api('POST', `/api/apps/${card.dataset.app}`, patch);
      const i = appsList.findIndex((x) => x.id === r.app.id);
      appsList[i] = r.app;
      if (el.dataset.secret) el.value = '';
      card.outerHTML = appCard(r.app);
      renderReactions();
    } catch (e) { toast(e.message); }
    return;
  }
  const rc = el.closest('[data-ri]');
  if (!rc || !page) return;
  const r = reactions[Number(rc.dataset.ri)];
  const val = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
  const structural = ev.type === 'change' && el.tagName === 'SELECT';
  if (el.dataset.rf) {
    r[el.dataset.rf] = val;
    if (el.dataset.rf === 'enabled') rc.classList.toggle('off', !el.checked);
  } else if (el.dataset.wf) {
    r.when[el.dataset.wf] = val;
    if (el.dataset.wf === 'type' && structural) renderReactions();
  } else if (el.dataset.sf) {
    const s = r.steps[Number(el.dataset.si)];
    const k = el.dataset.sf;
    if (k === 'app') {
      if (!structural) return;
      r.steps[Number(el.dataset.si)] = val === 'wait' ? { app: 'wait', seconds: 1 } : { app: val, do: Object.keys(DOES[val])[0] };
      await optionsOf(val);
      renderReactions();
    } else if (k === 'do') {
      if (!structural) return;
      r.steps[Number(el.dataset.si)] = { app: s.app, do: val };
      renderReactions();
    } else {
      if (k === 'items') s.items = val ? [val] : [];
      else s[k] = val;
      if (k === 'scene' && structural) renderReactions();
    }
  } else return;
  saveReactions();
}

async function onClick(ev) {
  const t = ev.target.closest('button');
  if (!t) return;
  if (t.dataset.apTab) return document.querySelector(`[data-tabs="apps"] [data-tab="${t.dataset.apTab}"]`)?.click();
  const card = t.closest('[data-app]');
  if (card && (t.dataset.reconnect !== undefined || t.dataset.forget !== undefined)) {
    const r = await api('POST', `/api/apps/${card.dataset.app}`, t.dataset.forget !== undefined ? { forget: true } : { reconnect: true });
    appsList[appsList.findIndex((x) => x.id === r.app.id)] = r.app;
    card.outerHTML = appCard(r.app);
    return;
  }
  if (t.dataset.deckGo !== undefined) return document.querySelector('[data-tabs="apps"] [data-tab="reacciones"]')?.click();
  if (t.dataset.deckRenew !== undefined) {
    if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = tr('¿Seguro? Los botones viejos dejarán de funcionar'); return; }
    deck = (await api('POST', '/api/deck/renew')).deck;
    t.dataset.armed = '';
    renderApps();
    renderReactions();
    sayFor('samy', tr('Clave nueva. Vuelve a copiar las direcciones en tus botones.'), 7000, 'ok');
    return;
  }
  if (t.id === 'ap-radd') {
    reactions.push({ id: uid(), name: tr('Reacción {0}', reactions.length + 1), enabled: true, when: { type: 'gift', platform: 'any', gift: '', minCoins: 0, command: '', reward: '', item: '', chest: '', minAmount: 0 }, steps: [newStep()], cooldownSec: 0 });
    await renderReactions();
    saveReactions();
    $$('#ap-reactions .ap-rname').at(-1)?.focus();
    return;
  }
  if (t.dataset.copy) {
    try { await navigator.clipboard.writeText(t.dataset.copy); toast(tr('Dirección copiada')); } catch { toast(t.dataset.copy); }
    return;
  }
  const rc = t.closest('[data-ri]');
  if (!rc) return;
  const ri = Number(rc.dataset.ri);
  const r = reactions[ri];
  const li = t.closest('[data-si]');
  if (t.dataset.reDel !== undefined) {
    if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = tr('¿Borrar?'); return; }
    reactions.splice(ri, 1);
  } else if (t.dataset.stepAdd !== undefined) {
    r.steps.push(newStep());
  } else if (li && t.dataset.stepDel !== undefined) {
    r.steps.splice(Number(li.dataset.si), 1);
  } else if (li && t.dataset.stepMove) {
    const i = Number(li.dataset.si);
    const j = i + Number(t.dataset.stepMove);
    [r.steps[i], r.steps[j]] = [r.steps[j], r.steps[i]];
  } else if (li && t.dataset.stepTest !== undefined) {
    try { await api('POST', '/api/apps-test/step', r.steps[Number(li.dataset.si)]); toast(tr('Paso hecho')); } catch (e) { toast(tr('No funcionó: {0}', e.message)); }
    return;
  } else if (t.dataset.reTest !== undefined) {
    await saveReactions.flush?.();
    try {
      await api('POST', '/api/reactions', { reactions });
      const res = (await api('POST', `/api/reactions/${encodeURIComponent(r.id)}/test`)).result;
      toast(res.ok ? tr('¡Funcionó!') : tr('Falló: {0}', res.errors.join(' · ')));
    } catch (e) { toast(e.message); }
    return;
  } else return;
  await renderReactions();
  saveReactions();
}

export function onAppsStatus(p) { updateStatus(p); }
export function onReactionFired(p) {
  lastFired[p.id] = p;
  const i = reactions.findIndex((r) => r.id === p.id);
  const el = $(`#ap-reactions [data-ri="${i}"] header`);
  if (!el) return;
  $('.ap-fired', el)?.remove();
  el.querySelector('.ap-rname').insertAdjacentHTML('afterend', `<span class="ap-fired ${p.ok ? 'ok' : 'bad'}" title="${esc(p.errors?.join(' · ') || '')}">${p.ok ? tr('Funcionó') : tr('Falló un paso')}</span>`);
}

async function load() {
  const [a, s] = await Promise.all([api('GET', '/api/apps'), api('GET', '/api/shop').catch(() => ({ settings: { items: [], chests: [] } }))]);
  appsList = a.apps;
  reactions = a.reactions;
  deck = a.deck;
  shopInfo = { items: s.settings.items || [], chests: s.settings.chests || [] };
}

export async function initApps() {
  const page = $('#page-apps');
  if (!page) return;
  page.addEventListener('change', (ev) => { onInput(ev).catch((e) => toast(e.message)); });
  page.addEventListener('input', (ev) => { if (ev.target.closest('[data-ri]') && ev.target.tagName !== 'SELECT' && ev.target.type !== 'checkbox') onInput(ev).catch(() => {}); });
  page.addEventListener('click', (ev) => { onClick(ev).catch((e) => toast(e.message)); });
  try { await load(); } catch (e) { toast(tr('No se cargaron las apps: {0}', e.message)); return; }
  renderApps();
  renderReactions();
}

export async function onAppsPage() {
  try { await load(); } catch { return; }
  renderApps();
  renderReactions();
}
