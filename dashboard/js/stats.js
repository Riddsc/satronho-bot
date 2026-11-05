// Juana también lleva las estadísticas: el directo en curso, el historial
// de sesiones y los tops de siempre. Todo se guarda en tu PC.

import { $, api, esc, toast, PLATFORM_NAMES } from './util.js';
import { sayFor } from './guides.js';
import { initOverview, refreshOverview } from './statsOverview.js';

let live = null; // resumen del directo en curso (o null)
let history = []; // resúmenes guardados (sin línea de tiempo)
let selected = 'live'; // 'live' | id de sesión | 'all'
let shown = null; // sesión que se está mostrando
let metric = 'chat';

const METRICS = {
  chat: { label: 'Mensajes por minuto', unit: 'mensajes' },
  interactions: { label: 'Interacciones por minuto (follows, regalos, likes…)', unit: 'interacciones' },
  diamonds: { label: 'Diamantes por minuto', unit: 'diamantes' },
  viewers: { label: 'Espectadores de TikTok', unit: 'espectadores' },
};

const nf = new Intl.NumberFormat('es-CO');
const compact = (n) => (Math.abs(n) >= 10000 ? new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : nf.format(n));
const dur = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`);
const dateOf = (ts) => new Date(ts).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// ---------- Selector de sesión ----------
function renderSelect() {
  const sel = $('#stats-session');
  const opts = [`<option value="live">${live ? '● Directo en curso' : 'Directo en curso (sin actividad)'}</option>`];
  for (const h of history) opts.push(`<option value="${esc(h.id)}">${esc(dateOf(h.startedAt))} · ${esc(dur(h.durationMin))}</option>`);
  opts.push('<option value="all">Totales de siempre</option>');
  sel.innerHTML = opts.join('');
  sel.value = [...sel.options].some((o) => o.value === selected) ? selected : 'live';
  $('#stats-end').disabled = !live;
}

// La sesión con la que se compara: la anterior a la mostrada.
function previousOf(s) {
  if (!s) return null;
  const idx = history.findIndex((h) => h.id === s.id);
  return idx === -1 ? history[0] || null : history[idx + 1] || null;
}

// ---------- Tarjetas de cifras ----------
function tile(label, value, cur, prev, { money = '' } = {}) {
  let delta = '';
  if (prev != null && cur != null) {
    if (prev === 0 && cur === 0) delta = '<span class="delta flat">= igual que el anterior</span>';
    else if (prev === 0) delta = '<span class="delta up">▲ nuevo frente al anterior</span>';
    else {
      const pct = Math.round(((cur - prev) / prev) * 100);
      const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
      const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '=';
      delta = `<span class="delta ${cls}">${arrow} ${pct > 0 ? '+' : ''}${pct}% vs anterior</span>`;
    }
  }
  return `<div class="tile"><span class="t-label">${label}</span><span class="t-value">${value}</span>${money ? `<span class="t-sub">${money}</span>` : ''}${delta}</div>`;
}

function renderTiles(s) {
  const p = previousOf(s);
  const v = (f) => (p ? f(p) : null);
  $('#stats-tiles').innerHTML = [
    tile('Duración', dur(s.durationMin), s.durationMin, v((x) => x.durationMin)),
    tile('Diamantes', compact(s.diamonds), s.diamonds, v((x) => x.diamonds), { money: `≈ ${s.usd.toLocaleString('es-CO', { style: 'currency', currency: 'USD' })} estimado` }),
    tile('Regalos enviados', compact(s.giftsSent), s.giftsSent, v((x) => x.giftsSent)),
    tile('Mensajes de chat', compact(s.counts.chat), s.counts.chat, v((x) => x.counts.chat)),
    tile('Personas en el chat', compact(s.uniqueChatters), s.uniqueChatters, v((x) => x.uniqueChatters)),
    tile('Seguidores nuevos', compact(s.counts.follow), s.counts.follow, v((x) => x.counts.follow)),
    tile('Likes', compact(s.likes), s.likes, v((x) => x.likes)),
    tile('Pico de espectadores', s.peakViewers ? compact(s.peakViewers) : '—', s.peakViewers, v((x) => x.peakViewers)),
    tile('Canciones', compact(s.songs), s.songs, v((x) => x.songs)),
    tile('Mensajes leídos en voz', compact(s.ttsRead), s.ttsRead, v((x) => x.ttsRead)),
  ].join('');
  $('#stats-compare').textContent = p ? `Comparado con el directo del ${dateOf(p.startedAt)}` : 'Aún no hay un directo anterior para comparar.';
}

// ---------- Gráfica de actividad ----------
// Una sola serie (sin leyenda: el título la nombra), barras finas desde la
// base, eje Y recesivo con 3 marcas y un tooltip al pasar el ratón.
function bucketize(timeline, key) {
  const size = timeline.length > 180 ? 10 : timeline.length > 90 ? 5 : 1;
  const out = [];
  for (let i = 0; i < timeline.length; i += size) {
    const slice = timeline.slice(i, i + size);
    const value = key === 'viewers' ? Math.max(0, ...slice.map((b) => b.viewers || 0)) : slice.reduce((a, b) => a + (b[key] || 0), 0);
    out.push({ m: slice[0].m, size, value });
  }
  return out;
}

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

const minLabel = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`);

function renderChart(s) {
  const box = $('#stats-chart');
  const info = METRICS[metric];
  $('#chart-title').textContent = info.label;
  const data = bucketize(s.timeline || [], metric);
  if (!data.length || data.every((d) => d.value === 0)) {
    box.innerHTML = `<p class="hint chart-empty">Sin datos de ${info.unit} en esta sesión.</p>`;
    $('#stats-table').innerHTML = '';
    return;
  }
  const W = 760, H = 220, L = 44, R = 8, T = 10, B = 26;
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const slot = (W - L - R) / data.length;
  const bw = Math.max(2, Math.min(24, slot - 2));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / 8);

  const bars = data
    .map((d, i) => {
      const x = L + i * slot + (slot - bw) / 2;
      const top = y(d.value);
      const h = H - B - top;
      const r = Math.min(4, bw / 2, h);
      const path = h <= 0 ? '' : `M${x} ${H - B} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + bw - r} Q${x + bw} ${top} ${x + bw} ${top + r} V${H - B} Z`;
      const label = d.size > 1 ? `${minLabel(d.m)}–${minLabel(d.m + d.size)}` : `minuto ${d.m + 1}`;
      return `<g class="bar" tabindex="0" data-tip="${esc(`${label}: ${nf.format(d.value)} ${info.unit}`)}">
        <rect class="hit" x="${L + i * slot}" y="${T}" width="${slot}" height="${H - T - B}"/>
        <path d="${path}"/></g>`;
    })
    .join('');
  const grid = ticks
    .map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${compact(t)}</text>`)
    .join('');
  const xs = data
    .map((d, i) => (i % labelEvery === 0 ? `<text class="axis" x="${L + i * slot + slot / 2}" y="${H - 6}" text-anchor="middle">${minLabel(d.m)}</text>` : ''))
    .join('');

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(info.label)}">${grid}${bars}${xs}</svg><div class="chart-tip" hidden></div>`;

  // Tabla equivalente (accesibilidad).
  $('#stats-table').innerHTML = `<table><thead><tr><th>Momento</th><th>${esc(info.unit)}</th></tr></thead><tbody>${data
    .filter((d) => d.value > 0)
    .map((d) => `<tr><td>${minLabel(d.m)}</td><td>${nf.format(d.value)}</td></tr>`)
    .join('')}</tbody></table>`;
}

function initChartHover() {
  const box = $('#stats-chart');
  const show = (g, ev) => {
    const tip = box.querySelector('.chart-tip');
    if (!tip || !g) return;
    tip.textContent = g.dataset.tip;
    tip.hidden = false;
    const r = box.getBoundingClientRect();
    const gr = g.getBoundingClientRect();
    const x = ev?.clientX ?? gr.left + gr.width / 2;
    tip.style.left = `${Math.min(r.width - 10, Math.max(10, x - r.left))}px`;
    tip.style.top = `${Math.max(0, gr.top - r.top + gr.height * 0.1 - 34)}px`;
    box.querySelectorAll('.bar.on').forEach((b) => b.classList.remove('on'));
    g.classList.add('on');
  };
  const hide = () => {
    const tip = box.querySelector('.chart-tip');
    if (tip) tip.hidden = true;
    box.querySelectorAll('.bar.on').forEach((b) => b.classList.remove('on'));
  };
  box.addEventListener('mousemove', (ev) => {
    const g = ev.target.closest('.bar');
    if (g) show(g, ev);
    else hide();
  });
  box.addEventListener('mouseleave', hide);
  box.addEventListener('focusin', (ev) => show(ev.target.closest('.bar')));
  box.addEventListener('focusout', hide);
}

// ---------- Tops ----------
function topList(title, items, unit) {
  if (!items?.length) return `<div class="rank"><h4>${title}</h4><p class="hint">Nadie todavía.</p></div>`;
  const max = Math.max(...items.map((i) => i.value));
  return `<div class="rank"><h4>${title}</h4><ol>${items
    .map(
      (i) => `<li><span class="who">${esc(i.name)}${i.platform ? ` <small>${esc(PLATFORM_NAMES[i.platform] || i.platform)}</small>` : ''}</span>
        <span class="val">${compact(i.value)} <small>${unit}</small></span>
        <span class="mini"><i style="width:${Math.max(4, (i.value / max) * 100)}%"></i></span></li>`
    )
    .join('')}</ol></div>`;
}

function renderTops(tops) {
  $('#stats-tops').innerHTML = [
    topList('Más diamantes', tops.gifters, 'diamantes'),
    topList('Más activos en el chat', tops.chatters, 'mensajes'),
    topList('Más likes', tops.likers, 'likes'),
    topList('Regalos más enviados', tops.gifts, 'veces'),
  ].join('');
}

// Pestaña «Tops de siempre».
export async function renderAllTops() {
  const box = $('#alltops');
  if (!box) return;
  try {
    const { tops } = await api('GET', '/api/stats/all-time');
    $('#alltops-note').textContent = `${tops.sessions} ${tops.sessions === 1 ? 'directo guardado' : 'directos guardados'}`;
    box.innerHTML = [
      topList('Más diamantes', tops.gifters, 'diamantes'),
      topList('Más activos en el chat', tops.chatters, 'mensajes'),
      topList('Más likes', tops.likers, 'likes'),
      topList('Regalos más enviados', tops.gifts, 'veces'),
    ].join('');
  } catch { box.innerHTML = '<p class="hint">No se pudieron leer los tops.</p>'; }
}

// ---------- Vista ----------
async function show() {
  const isAll = selected === 'all';
  $('#stats-session-view').hidden = isAll;
  if (isAll) {
    const { tops } = await api('GET', '/api/stats/all-time');
    $('#stats-headline').textContent = `Tops de siempre · ${tops.sessions} ${tops.sessions === 1 ? 'directo' : 'directos'} guardados`;
    renderTops(tops);
    return;
  }
  if (selected === 'live') shown = live;
  else shown = (await api('GET', `/api/stats/sessions/${encodeURIComponent(selected)}`)).session;

  if (!shown) {
    $('#stats-headline').textContent = 'Todavía no hay actividad en este directo. Las cifras aparecen con el primer mensaje, follow o regalo.';
    $('#stats-session-view').hidden = true;
    $('#stats-tops').innerHTML = '';
    return;
  }
  const plats = shown.platforms.map((p) => PLATFORM_NAMES[p] || p).join(', ');
  $('#stats-headline').textContent = `${shown.live ? 'En curso desde' : 'Directo del'} ${dateOf(shown.startedAt)} · ${plats || 'sin plataformas'}`;
  renderTiles(shown);
  renderChart(shown);
  renderTops(shown.tops);
}

export function onStats(summary) {
  const wasLive = Boolean(live);
  live = summary;
  if (wasLive !== Boolean(live)) renderSelect();
  if (selected === 'live') show();
}

export function onStatsHistory(list) {
  history = list;
  refreshOverview();
  renderSelect();
  if (selected !== 'live') show();
}

// Abre un directo en «Directo por directo» (desde el Resumen).
export function openSession(id) {
  selected = id;
  renderSelect();
  location.hash = '#/estadisticas/directo';
  show().catch((e) => toast(e.message));
}

export function initStats({ stats, statsHistory }) {
  // Los tops se cargan al abrir su pestaña.
  const tp = document.querySelector('[data-tabpanel="tops"]');
  if (tp) new MutationObserver(() => { if (!tp.hidden) renderAllTops(); }).observe(tp, { attributes: true, attributeFilter: ['hidden'] });
  live = stats;
  history = statsHistory || [];
  renderSelect();
  initChartHover();
  $('#stats-session').addEventListener('change', (ev) => {
    selected = ev.target.value;
    show().catch((e) => toast(e.message));
  });
  $('#stats-metric').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-metric]');
    if (!b) return;
    metric = b.dataset.metric;
    for (const x of $('#stats-metric').children) x.setAttribute('aria-pressed', String(x === b));
    if (shown) renderChart(shown);
  });
  $('#stats-end').addEventListener('click', async () => {
    if (!confirm('¿Terminar el directo actual y guardarlo en el historial?')) return;
    const { session } = await api('POST', '/api/stats/end').catch((e) => (toast(e.message), {}));
    if (session) sayFor('juana', `Guardé tu directo: ${compact(session.diamonds)} diamantes y ${compact(session.counts.chat)} mensajes. ¡Buen trabajo!`, 9000, 'ok');
  });
  show().catch(() => {});
  initOverview({ open: openSession });
}
