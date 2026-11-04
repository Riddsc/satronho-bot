// Escribir en el chat de Starvios (Conexiones → Escribir).
// Se inicia sesión en una ventana de la app: con tu cuenta o, en
// «Avanzado», con una cuenta aparte para el bot.

import { $, api, esc, toast, saveConfig } from './util.js';
import { guideToast } from './guides.js';

let config;
let st = { me: { ok: false }, bot: { ok: false }, canLogin: true };
let busy = '';

function accountRow(id, label, primary = false) {
  const a = st[id];
  const wait = busy === id;
  const btn = a.ok
    ? `<button type="button" class="btn small ghost" data-sv="logout" data-acc="${id}">Cerrar sesión</button>`
    : `<span class="row tight"><button type="button" class="btn small ${primary ? 'primary' : ''}" data-sv="login" data-acc="${id}" ${wait || !st.canLogin ? 'disabled' : ''}>${wait ? 'Esperando…' : 'Iniciar sesión'}</button>${wait ? '' : `<button type="button" class="btn small ghost" data-sv="login-fresh" data-acc="${id}" ${st.canLogin ? '' : 'disabled'} title="Abre Starvios sin la sesión guardada en este PC">Usar otra cuenta</button>`}</span>`;
  return `<div class="kb-acc"><span><b>${esc(label)}</b><small>${a.ok ? `✓ conectada${a.name ? ` · @${esc(a.name)}` : ''}` : wait ? 'inicia sesión en la ventana que se abrió' : 'sin iniciar sesión'}</small></span>${btn}</div>`;
}

export function renderStarviosbot(status) {
  if (status) st = status;
  const box = $('#starviosbot-body');
  if (!box) return;
  const cb = config.chatBot?.starvios || {};
  const sendAs = st.sendAs || 'me';
  const anyOk = st.me.ok || st.bot.ok;
  box.innerHTML = `${accountRow('me', 'Tu cuenta de Starvios', true)}
    ${st.canLogin ? '' : '<p class="hint">Iniciar sesión solo funciona en la app de escritorio.</p>'}
    <label class="switch mt"><input type="checkbox" id="sv-music" ${cb.music !== false ? 'checked' : ''}><span></span> Responder a los pedidos de música</label>
    <div class="row wrap mt"><button type="button" class="btn small" data-sv="test" ${anyOk ? '' : 'disabled'}>Enviar mensaje de prueba</button></div>
    ${st.lastError ? `<p class="err-line">Último error: ${esc(st.lastError)}</p>` : ''}
    <details class="mt" ${st.bot.ok ? 'open' : ''}><summary>Avanzado</summary>
      <p class="hint">Si tienes una cuenta solo para el bot, inicia sesión con ella aquí y elige con cuál se escribe.</p>
      ${accountRow('bot', 'Cuenta aparte para el bot')}
      <label class="field"><span>Escribe como</span><span class="seg" data-sv-as><button type="button" data-as="me" aria-pressed="${sendAs === 'me'}">Mi cuenta</button><button type="button" data-as="bot" aria-pressed="${sendAs === 'bot'}">Cuenta aparte</button></span></label>
    </details>
    <p class="hint">${st.encrypted ? '🔒 La sesión se guarda cifrada en este PC.' : 'La sesión se guarda solo en este PC.'} Satronho Bot nunca ve tu contraseña.</p>`;
  writeState();
}

function writeState() {
  const el = $('#starvios-write-state');
  if (!el) return;
  const acc = st.sendAs === 'bot' && st.bot.ok ? st.bot : st.me.ok ? st.me : st.bot;
  el.textContent = acc.ok ? `Escribe como @${acc.name || 'tu cuenta'}` : 'Sin iniciar sesión';
  el.className = `pstate ${acc.ok ? 'on' : ''}`;
}

export function initStarviosbot(cfg, status) {
  config = cfg;
  config.chatBot.starvios ||= { enabled: true, sendAs: 'me', music: true };
  renderStarviosbot(status);
  const box = $('#starviosbot');
  box.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-sv], [data-as]');
    if (!b) return;
    try {
      if (b.dataset.as) {
        config.chatBot.starvios.sendAs = b.dataset.as;
        st.sendAs = b.dataset.as;
        saveConfig({ chatBot: { starvios: { sendAs: b.dataset.as } } });
        return renderStarviosbot();
      }
      const what = b.dataset.sv;
      if (what === 'login' || what === 'login-fresh') {
        busy = b.dataset.acc;
        renderStarviosbot();
        guideToast('samy', 'Se abrió una ventana de Starvios. Inicia sesión ahí y yo me encargo del resto.');
        const r = await api('POST', '/api/starviosbot/login', { account: b.dataset.acc, fresh: what === 'login-fresh' });
        busy = '';
        renderStarviosbot(r.starviosbot);
        if (!r.cancelled) guideToast('samy', `¡Listo! Ya puedo escribir en Starvios${r.name ? ` como @${esc(r.name)}` : ''}.`);
      }
      if (what === 'logout') renderStarviosbot((await api('POST', '/api/starviosbot/logout', { account: b.dataset.acc })).starviosbot);
      if (what === 'test') {
        await api('POST', '/api/starviosbot/test');
        guideToast('samy', 'Mensaje enviado. Míralo en tu chat de Starvios.');
      }
    } catch (e) {
      busy = '';
      renderStarviosbot();
      toast(e.message);
    }
  });
  box.addEventListener('change', (ev) => {
    if (ev.target.id !== 'sv-music') return;
    config.chatBot.starvios.music = ev.target.checked;
    saveConfig({ chatBot: { starvios: { music: ev.target.checked } } });
  });
}
