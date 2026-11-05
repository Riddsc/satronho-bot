// Escribir en el chat de Kick (Conexiones → Escribir).
//
// Lo normal: «Autorizar mi cuenta de Kick» con la app incluida y listo,
// el bot escribe con la cuenta del streamer.
// En «Avanzado»: una cuenta aparte (por ejemplo SatronhoBot) y, si alguien
// quiere, su propia app de Kick (Client ID y Client Secret).

import { $, api, esc, toast, saveConfig } from './util.js';
import { guideToast, sayFor } from './guides.js';

let config;
let st = { ready: false, builtin: false, ownApp: false, usingOwn: false, me: { ok: false }, bot: { ok: false } };

const accState = (a) => (a.ok ? `✓ autorizada${a.name ? ` · @${esc(a.name)}` : ''}` : a.stale ? 'hay que volver a autorizarla (cambió la app)' : 'sin autorizar');

function accountRow(id, label, primary = false) {
  const a = st[id];
  const btn = a.ok
    ? `<button type="button" class="btn small ghost" data-kb="logout" data-acc="${id}">Quitar</button>`
    : `<span class="row tight"><button type="button" class="btn small ${primary ? 'primary' : ''}" data-kb="auth" data-acc="${id}">Autorizar</button><button type="button" class="btn small ghost" data-kb="auth-fresh" data-acc="${id}" title="Abre Kick sin la sesión guardada en este PC">Usar otra cuenta</button></span>`;
  return `<div class="kb-acc"><span><b>${esc(label)}</b><small>${accState(a)}</small></span>${btn}</div>`;
}

// El Client ID guardado se muestra oculto (solo los 4 últimos caracteres).
const masked = (id) => (id ? `${'•'.repeat(Math.max(4, id.length - 4))}${id.slice(-4)}` : '');

function ownAppForm() {
  return `<label class="field"><span>Client ID <small class="hint">(código de tu app, tal cual sale en Kick)</small></span><input id="kb-id" autocomplete="off" spellcheck="false" ${st.clientId ? `placeholder="${esc(masked(st.clientId))} · déjalo vacío para conservarlo"` : ''}></label>
    <label class="field"><span>Client Secret${st.ownApp ? ' nuevo' : ''}</span><input id="kb-secret" type="password" autocomplete="off" ${st.ownApp ? 'placeholder="Déjalo vacío para conservar el actual"' : ''}></label>
    <p class="hint">Redirección en tu app de Kick: <code>http://localhost:3800/auth/kick/callback</code></p>
    <div class="row wrap mt"><button type="button" class="btn small" data-kb="save">Guardar mi app</button>${st.ownApp ? '<button type="button" class="btn small ghost" data-kb="forget">Borrar mi app</button>' : ''}</div>
    ${st.ownApp && st.builtin ? `<label class="switch mt"><input type="checkbox" id="kb-useown" ${st.usingOwn ? 'checked' : ''}><span></span> Usar mi app en vez de la de Satronho Bot</label>` : ''}`;
}

export function renderKickbot(status) {
  if (status) st = status;
  const box = $('#kickbot-body');
  if (!box) return;
  const cb = config.chatBot?.kick || {};
  const sendAs = st.sendAs || (cb.sendAs === 'bot' ? 'bot' : 'me');

  // Esta copia no trae la app incluida (por ejemplo, armada sin los secretos):
  // hay que pegar una app propia antes de poder autorizar.
  if (!st.ready) {
    box.innerHTML = `<p class="hint">Esta copia de Satronho Bot no trae la app de Kick incluida. Pega los datos de tu app (en kick.com: <b>Ajustes → Desarrollador</b>). Se guardan solo en tu PC.</p>${ownAppForm()}`;
    return;
  }

  const anyOk = st.me.ok || st.bot.ok;
  box.innerHTML = `${accountRow('me', 'Tu cuenta de Kick', true)}
    <label class="switch mt"><input type="checkbox" id="kb-music" ${cb.music !== false ? 'checked' : ''}><span></span> Responder a los pedidos de música («🎵 Fulano pidió…»)</label>
    <div class="row wrap mt"><button type="button" class="btn small" data-kb="test" ${anyOk ? '' : 'disabled'}>Enviar mensaje de prueba</button></div>
    ${st.lastError ? `<p class="err-line">Último error: ${esc(st.lastError)}</p>` : ''}
    <details class="mt" ${st.bot.ok || st.usingOwn ? 'open' : ''}><summary>Avanzado</summary>
      <p class="hint">Si tienes una cuenta solo para el bot (por ejemplo <b>SatronhoBot</b>), autorízala aquí y elige con cuál se escribe.</p>
      ${accountRow('bot', 'Cuenta aparte para el bot')}
      <label class="field"><span>Escribe como</span><span class="seg" id="kb-as"><button type="button" data-as="me" aria-pressed="${sendAs === 'me'}">Mi cuenta</button><button type="button" data-as="bot" aria-pressed="${sendAs === 'bot'}">Cuenta aparte</button></span></label>
      <div class="row wrap mt"><button type="button" class="btn small ghost" data-kb="auth-ext">Autorizar en mi navegador</button></div>
      <h4 class="kb-sub">Mi propia app de Kick</h4>
      <p class="hint">Solo si quieres usar tu propia app de desarrollador en vez de la que trae Satronho Bot.</p>
      ${ownAppForm()}
    </details>
    <p class="hint">${st.encrypted ? '🔒 Los permisos se guardan cifrados: solo tu usuario de Windows, en este PC, puede leerlos.' : 'Los permisos se guardan solo en este PC.'}</p>`;
}

async function authorize(account, external = false, fresh = false) {
  try {
    const r = await api('POST', '/api/kickbot/authorize', { account, external, fresh });
    if (!r.opened) window.open(r.url, '_blank');
    guideToast('samy', account === 'bot'
      ? (r.opened ? 'Entra con la cuenta del bot y acepta el permiso.' : 'En tu navegador, entra con la cuenta del bot y acepta el permiso.')
      : (r.opened ? 'Entra con tu cuenta de Kick y acepta el permiso.' : 'En tu navegador, entra con tu cuenta de Kick y acepta el permiso.'));
  } catch (e) {
    toast(e.message);
  }
}

export function initKickbot(cfg, status) {
  config = cfg;
  renderKickbot(status);
  const box = $('#kickbot');
  box.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-kb], [data-as]');
    if (!b) return;
    try {
      if (b.dataset.as) {
        config.chatBot.kick.sendAs = b.dataset.as;
        st.sendAs = b.dataset.as;
        saveConfig({ chatBot: { kick: { sendAs: b.dataset.as } } });
        renderKickbot();
      }
      const what = b.dataset.kb;
      if (what === 'save') {
        const clientId = $('#kb-id').value.trim() || st.clientId || '';
        const clientSecret = $('#kb-secret').value.trim();
        if (!clientId) return toast('Falta el Client ID');
        const { kickbot } = await api('POST', '/api/kickbot/app', { clientId, clientSecret, useOwnApp: true });
        renderKickbot(kickbot);
        if (!kickbot.ownApp) return toast('Falta el Client Secret');
        sayFor('samy', '¡Guardada tu app! Ahora vuelve a pulsar <b>Autorizar</b> en tu cuenta.', 9000, 'ok');
      }
      if (what === 'forget') renderKickbot((await api('POST', '/api/kickbot/app/forget')).kickbot);
      if (what === 'auth') authorize(b.dataset.acc);
      if (what === 'auth-fresh') authorize(b.dataset.acc, false, true);
      if (what === 'auth-ext') authorize(st.sendAs === 'bot' ? 'bot' : 'me', true);
      if (what === 'logout') renderKickbot((await api('POST', '/api/kickbot/logout', { account: b.dataset.acc })).kickbot);
      if (what === 'test') {
        await api('POST', '/api/kickbot/test');
        guideToast('samy', 'Mensaje enviado. Míralo en tu chat de Kick.');
      }
    } catch (e) {
      toast(e.message);
    }
  });
  box.addEventListener('change', async (ev) => {
    if (ev.target.id === 'kb-music') {
      config.chatBot.kick.music = ev.target.checked;
      saveConfig({ chatBot: { kick: { music: ev.target.checked } } });
    }
    if (ev.target.id === 'kb-useown') {
      try {
        renderKickbot((await api('POST', '/api/kickbot/app', { useOwnApp: ev.target.checked })).kickbot);
      } catch (e) {
        toast(e.message);
      }
    }
  });
}
