// Inicio: los guías saludando (bienvenida) y «¿Con qué deseas empezar hoy?»,
// recuadros grandes con cada función del bot. Cada recuadro muestra su
// estado en vivo y, cuando aplica, un atajo (saltar voz, probar alerta,
// terminar sesión).

import { $, api, esc, toast, PLATFORM_NAMES } from './util.js';
import { skipTts, ttsStatus, mainVoiceName } from './voice.js';
import { sayFor } from './guides.js';

const LABEL = { follow: 'te sigue', sub: 'se suscribió', like: 'dio likes', share: 'compartió el LIVE' };
const setState = (key, html, tone = '') => {
  const el = $(`#hs-${key}`);
  if (!el) return;
  el.innerHTML = html;
  el.className = `hs-state ${tone}`;
};
const compact = (n) => (Number(n) || 0).toLocaleString('es-CO', { notation: 'compact', maximumFractionDigits: 1 });

// Chat en vivo: lo último que pasó.
export function homeEvent(e) {
  if (['join', 'live-start', 'live-end'].includes(e.type)) return;
  let what;
  if (e.type === 'chat') what = `: ${esc(String(e.message || '').slice(0, 60))}`;
  else if (e.type === 'gift') what = ` envió ${esc(e.extra?.giftName || 'un regalo')}${e.extra?.count > 1 ? ` ×${e.extra.count}` : ''}`;
  else if (e.type === 'like') what = ` dio ${e.amount} likes`;
  else if (e.type === 'sticker') what = ' mandó un sticker';
  else if (e.type === 'superfan') what = ' ahora es superfan';
  else what = ` ${LABEL[e.type] || e.type}`;
  setState('actividad', `<i class="dot on"></i><span><span class="plat ${e.platform}">${esc(PLATFORM_NAMES[e.platform] || e.platform)}</span> <b>${esc(e.user?.name || '')}</b>${what}</span>`, 'on');
}

export function homeConnections(on, total, names = []) {
  if (!total) return setState('conexiones', 'Elige tus plataformas en Conexiones', 'warn');
  setState('conexiones', on
    ? `<i class="dot on"></i>${on} de ${total} conectadas · ${esc(names.join(', '))}`
    : `<i class="dot"></i>Sin conectar · empieza aquí`, on ? 'on' : 'warn');
}

export function homeVoice(config, engine) {
  const t = config.tts;
  const v = engine?.voices?.find((x) => x.id === t.piperVoice && x.installed);
  const q = ttsStatus();
  const name = mainVoiceName() || (v ? v.label : '');
  setState('voz', t.enabled
    ? `<i class="dot on"></i>Activa · ${esc(name || 'sin voz elegida')}${q.queue ? ` · ${q.queue} en cola` : ''}${q.speaking ? ' · hablando' : ''}`
    : '<i class="dot"></i>Apagada', t.enabled ? 'on' : '');
}

export function homeMusic(m) {
  if (!m) return;
  const c = m.current;
  setState('musica', c
    ? `<i class="dot on"></i>Suena «${esc(c.title)}»${m.paused ? ' · en pausa' : ''}${m.queue.length ? ` · ${m.queue.length} en cola` : ''}`
    : `<i class="dot"></i>No suena nada · peticiones ${m.enabled ? 'abiertas' : 'cerradas'}`, c ? 'on' : '');
  const badge = $('#nav-queue');
  if (badge) {
    badge.hidden = !m.queue.length;
    badge.textContent = String(m.queue.length);
  }
}

export function homeStats(s) {
  if (!s || !s.live) return setState('estadisticas', '<i class="dot"></i>Sin directo en curso');
  setState('estadisticas', `<i class="dot on"></i>En curso · ${compact(s.diamonds)} diamantes · ${compact(s.counts?.chat)} mensajes · ${s.durationMin || 0} min`, 'on');
}

async function loadExtras() {
  try {
    const { commands } = await api('GET', '/api/commands');
    const on = (commands || []).filter((c) => c.enabled).length;
    setState('chatbot', `${on ? '<i class="dot on"></i>' : '<i class="dot"></i>'}${on} ${on === 1 ? 'comando activo' : 'comandos activos'}`, on ? 'on' : '');
  } catch {
    setState('chatbot', 'Comandos, mensajes automáticos y respuestas');
  }
  try {
    const lib = await api('GET', '/api/sounds');
    const mine = (lib.mine || []).length;
    setState('sonidos', mine ? `<i class="dot on"></i>${mine} ${mine === 1 ? 'sonido tuyo' : 'sonidos tuyos'}` : '<i class="dot"></i>Busca memes populares en un clic', mine ? 'on' : '');
  } catch {
    setState('sonidos', 'Memes, frases y tus propios sonidos');
  }
  setState('overlays', 'Vista previa, copiar la URL y listo');
  setState('alertas', 'Pruébalas aquí mismo, sin estar en vivo');
}

export function initHome() {
  // Los atajos de cada recuadro no abren la página.
  $('#home-start').addEventListener('click', (ev) => {
    if (ev.target.closest('.hs-act')) ev.preventDefault();
  });
  $('#home-skip-voice').addEventListener('click', () => skipTts());
  $('#home-end-session').addEventListener('click', async () => {
    if (!confirm('¿Terminar el directo actual y guardarlo en Estadísticas?')) return;
    try {
      const { session } = await api('POST', '/api/stats/end');
      if (session) sayFor('juana', `Guardé tu directo: ${compact(session.diamonds)} diamantes y ${compact(session.counts.chat)} mensajes.`, 8000, 'ok');
      else toast('No había ningún directo en curso');
    } catch (e) {
      toast(e.message);
    }
  });
  if (!$('#hs-actividad').textContent.trim() || $('#hs-actividad').textContent === '…') setState('actividad', '<i class="dot"></i>Aún no llega nada · prueba con ▶ Simular');
  loadExtras();
}

export function homeRefreshExtras() {
  loadExtras();
}
