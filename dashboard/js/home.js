// Inicio: lo importante de un vistazo (feed en vivo, voz, música y el directo).

import { $, api, esc, toast, timeOf, PLATFORM_NAMES } from './util.js';
import { skipTts, ttsStatus } from './voice.js';
import { sayFor } from './guides.js';

const LABEL = { follow: 'te sigue', sub: 'se suscribió', like: 'dio likes', share: 'compartió el LIVE' };

export function homeEvent(e) {
  const feed = $('#home-feed');
  feed.querySelector('.empty')?.remove();
  const li = document.createElement('li');
  let what;
  if (e.type === 'chat') what = `: ${esc(e.message)}`;
  else if (e.type === 'gift') what = ` envió ${esc(e.extra?.giftName || 'un regalo')}${e.extra?.count > 1 ? ` ×${e.extra.count}` : ''}`;
  else if (e.type === 'like') what = ` dio ${e.amount} likes`;
  else what = ` ${LABEL[e.type] || e.type}`;
  li.innerHTML = `<span class="tag ${e.type}">${e.type === 'chat' ? 'chat' : e.type === 'gift' ? 'regalo' : e.type}</span>
    <span class="txt"><span class="plat ${e.platform}">${esc(PLATFORM_NAMES[e.platform] || e.platform)}</span><b>${esc(e.user.name)}</b>${what}</span><time>${timeOf(e.ts).slice(0, 5)}</time>`;
  feed.prepend(li);
  while (feed.children.length > 40) feed.lastChild.remove();
}

export function homeVoice(config, engine) {
  const t = config.tts;
  const v = engine?.voices?.find((x) => x.id === t.piperVoice && x.installed);
  const installed = engine?.voices?.filter((x) => x.installed).length || 0;
  const q = ttsStatus();
  $('#home-voice').innerHTML = `<div class="kpis">
      <div class="kpi"><span>Estado</span><b>${t.enabled ? 'Activa' : 'Apagada'}</b><em>${q.queue} en cola${q.speaking ? ' · hablando' : ''}</em></div>
      <div class="kpi"><span>Voz principal</span><b style="font-size:1.05em">${esc(v ? v.label : 'Sin voz descargada')}</b><em>${installed} ${installed === 1 ? 'voz descargada' : 'voces descargadas'}</em></div>
    </div>
    <p class="hint">TikTok: ${esc({ all: 'lee a todos', followers: 'quienes te siguen', subs: 'suscriptores', team: 'tu equipo', 'team-gift': `tu equipo con ${t.tiktokGate.giftNames[0] || 'Quiéreme'}`, gift: `quien envía ${t.tiktokGate.giftNames[0] || 'Quiéreme'}`, mods: 'moderadores' }[t.who?.tiktok?.mode || 'all'] || 'lee a todos')} · ${t.filterProfanity ? 'filtro activo' : 'sin filtro'}</p>
    <a class="btn small ghost mt" href="#/voz">Abrir Voz del chat</a>`;
}

export function homeMusic(m) {
  if (!m) return;
  const c = m.current;
  $('#home-music').innerHTML = c
    ? `<div class="now">${c.thumbnail ? `<img src="${esc(c.thumbnail)}" alt="">` : ''}<div><b>${esc(c.title)}</b><small>Pedida por ${esc(c.requester)}${m.paused ? ' · en pausa' : ''}</small></div></div>
       <p class="hint">${m.queue.length ? `${m.queue.length} en cola` : 'La cola está vacía'} · peticiones ${m.enabled ? 'abiertas' : 'cerradas'}</p>`
    : `<p class="hint">No suena nada. Tu chat pide con <code>!play</code> o <code>!temita</code>.</p><p class="hint">Peticiones ${m.enabled ? 'abiertas' : 'cerradas'}</p>`;
  const badge = $('#nav-queue');
  badge.hidden = !m.queue.length;
  badge.textContent = String(m.queue.length);
}

const compact = (n) => (Number(n) || 0).toLocaleString('es-CO', { notation: 'compact', maximumFractionDigits: 1 });

export function homeStats(s) {
  const box = $('#home-stats');
  if (!s || !s.live) {
    box.innerHTML = '<p class="hint">Todavía no hay directo en curso. Empieza con el primer mensaje, follow o regalo.</p>';
    return;
  }
  box.innerHTML = `<div class="kpis">
      <div class="kpi"><span>Diamantes</span><b>${compact(s.diamonds)}</b><em>≈ US$ ${esc(s.usd)}</em></div>
      <div class="kpi"><span>Mensajes</span><b>${compact(s.counts?.chat)}</b><em>${compact(s.uniqueChatters)} personas</em></div>
      <div class="kpi"><span>Seguidores</span><b>${compact(s.counts?.follow)}</b><em>${s.durationMin || 0} min en vivo</em></div>
    </div><a class="btn small ghost mt" href="#/estadisticas">Ver estadísticas</a>`;
}

export function initHome() {
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
}
