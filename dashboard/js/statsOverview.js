// Estadísticas → Resumen (Juana): tus directos por periodo y plataforma.
//   - Tarjetas con el cambio frente al periodo anterior del mismo largo.
//   - Gráfica con un punto por directo (diamantes, mensajes, interacciones
//     o espectadores).
//   - Perfil del directo: el último directo frente a tu directo típico.
//   - Regalos más enviados y quienes más regalan en el periodo.
//   - Lista de directos: clic para ver el detalle, casillas para comparar dos.

import { $, $$, api, esc, toast, PLATFORM_NAMES } from './util.js';
const setBubble = (_id, html) => { const el = $('#ov-juana'); if (el) el.innerHTML = `<b>Juana:</b> ${html}`; };

const DAY = 86400000;
const nf = new Intl.NumberFormat('es-CO');
const compact = (n) => (Math.abs(n) >= 10000 ? new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : nf.format(Math.round(n)));
const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
const dateShort = (ts) => new Date(ts).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dur = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`);
const LOGO = (p) => (p === 'twitch' ? '<span class="pl" style="background:#9146ff;color:#fff">Tw</span>' : `<span class="pl plogo" data-logo="${esc(p)}" aria-hidden="true"></span>`);

const st = { plat: 'all', period: '30', from: '', to: '', metric: 'diamonds', compare: new Set() };
let all = [];
let usdPerDiamond = 0.005;
let onOpen = () => {};

const interactions = (s) => (s.counts?.follow || 0) + (s.counts?.sub || 0) + (s.counts?.gift || 0) + (s.counts?.share || 0) + (s.likes || 0);
const messagesOf = (s) => (st.plat === 'all' ? s.counts?.chat || 0 : s.byPlatform?.[st.plat]?.messages ?? (s.counts?.chat || 0));
const diamondsOf = (s) => (st.plat === 'all' || st.plat === 'tiktok' ? s.diamonds || 0 : 0);
const METRICS = {
  diamonds: { label: 'Diamantes', get: diamondsOf },
  chat: { label: 'Mensajes', get: messagesOf },
  interactions: { label: 'Interacciones', get: interactions },
  viewers: { label: 'Espectadores (pico)', get: (s) => s.peakViewers || 0 },
};

// ---------- Periodo ----------
function range() {
  const now = Date.now();
  if (st.period === 'custom') {
    const from = st.from ? new Date(`${st.from}T00:00`).getTime() : 0;
    const to = st.to ? new Date(`${st.to}T23:59:59`).getTime() : now;
    return { from, to, prev: null };
  }
  if (st.period === 'all') return { from: 0, to: now, prev: null };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Number(st.period);
  const from = days === 1 ? start.getTime() : now - days * DAY;
  const len = now - from;
  return { from, to: now, prev: { from: from - len, to: from } };
}
const inPlat = (s) => st.plat === 'all' || (s.platforms || []).includes(st.plat);
const pick = (from, to) => all.filter((s) => s.startedAt >= from && s.startedAt <= to && inPlat(s));

function totals(list) {
  return {
    n: list.length,
    minutes: list.reduce((a, s) => a + (s.durationMin || 0), 0),
    diamonds: list.reduce((a, s) => a + diamondsOf(s), 0),
    messages: list.reduce((a, s) => a + messagesOf(s), 0),
    inter: list.reduce((a, s) => a + interactions(s), 0),
    peak: list.reduce((a, s) => Math.max(a, s.peakViewers || 0), 0),
    chatters: list.length ? Math.round(list.reduce((a, s) => a + (st.plat === 'all' ? s.uniqueChatters || 0 : s.byPlatform?.[st.plat]?.chatters || 0), 0) / list.length) : 0,
  };
}

function delta(cur, prev) {
  if (prev == null) return '';
  if (!prev && !cur) return '<span class="delta flat">= igual</span>';
  if (!prev) return '<span class="delta up">▲ nuevo</span>';
  const pct = Math.round(((cur - prev) / prev) * 100);
  const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return `<span class="delta ${cls}">${pct > 0 ? '▲ +' : pct < 0 ? '▼ ' : '= '}${pct}%</span>`;
}
function tile(icon, label, value, sub, d) {
  return `<div class="ov-tile"><span class="ov-ic">${icon}</span><span class="t-label">${label}</span><span class="t-value">${value}</span>${sub ? `<span class="t-sub">${sub}</span>` : ''}${d}</div>`;
}

// ---------- Gráfica (un punto por directo) ----------
function chart(list) {
  const box = $('#ov-chart');
  const m = METRICS[st.metric];
  const pts = [...list].sort((a, b) => a.startedAt - b.startedAt);
  if (pts.length < 1) { box.innerHTML = '<p class="hint chart-empty">No hay directos en este periodo.</p>'; return; }
  const W = 760; const H = 240; const L = 48; const R = 14; const T = 14; const B = 34;
  const vals = pts.map(m.get);
  const max = Math.max(1, ...vals);
  const nice = (() => { const p = 10 ** Math.floor(Math.log10(max)); return Math.ceil(max / p) * p; })();
  const x = (i) => (pts.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (pts.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v / nice);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${y(nice * f)}" y2="${y(nice * f)}" class="g"/><text x="${L - 8}" y="${y(nice * f) + 4}" class="yl">${compact(nice * f)}</text>`).join('');
  const line = pts.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(vals[i]).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
  const every = Math.max(1, Math.ceil(pts.length / 7));
  const xs = pts.map((s, i) => (i % every === 0 || i === pts.length - 1 ? `<text x="${x(i)}" y="${H - 10}" class="xl">${esc(new Date(s.startedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }))}</text>` : '')).join('');
  const dots = pts.map((s, i) => `<circle cx="${x(i)}" cy="${y(vals[i])}" r="4" class="dot" data-i="${i}"/>`).join('');
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(m.label)} por directo"><defs><linearGradient id="ovg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--g)" stop-opacity=".35"/><stop offset="1" stop-color="var(--g)" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#ovg)"/><path d="${line}" class="ln"/>${dots}${xs}</svg><div class="chart-tip" hidden></div>`;
  const tip = box.querySelector('.chart-tip');
  box.querySelector('svg').addEventListener('mousemove', (ev) => {
    const c = ev.target.closest('.dot');
    if (!c) { tip.hidden = true; return; }
    const s = pts[Number(c.dataset.i)];
    tip.innerHTML = `<b>${esc(dateShort(s.startedAt))}</b><br>${esc(m.label)}: ${compact(m.get(s))}<br><small>${esc(dur(s.durationMin))} · clic para ver el directo</small>`;
    const r = box.getBoundingClientRect();
    tip.style.left = `${ev.clientX - r.left + 12}px`;
    tip.style.top = `${ev.clientY - r.top - 10}px`;
    tip.hidden = false;
  });
  box.querySelector('svg').addEventListener('mouseleave', () => { tip.hidden = true; });
  box.querySelector('svg').addEventListener('click', (ev) => {
    const c = ev.target.closest('.dot');
    if (c) onOpen(pts[Number(c.dataset.i)].id);
  });
}

// ---------- Perfil del directo ----------
const AXES = [
  ['Diamantes', diamondsOf], ['Mensajes', messagesOf], ['Seguidores', (s) => s.counts?.follow || 0],
  ['Me gusta', (s) => s.likes || 0], ['Compartidos', (s) => s.counts?.share || 0], ['Espectadores', (s) => s.peakViewers || 0],
];
const median = (arr) => { const a = [...arr].sort((p, q) => p - q); const m = Math.floor(a.length / 2); return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : 0; };
function radar(list) {
  const box = $('#ov-radar');
  if (!list.length) { box.innerHTML = '<p class="hint">Sin directos en este periodo.</p>'; $('#ov-radar-legend').innerHTML = ''; return; }
  const last = [...list].sort((a, b) => b.startedAt - a.startedAt)[0];
  const S = 240; const C = S / 2; const Rr = 84;
  const maxes = AXES.map(([, f]) => Math.max(1, ...list.map(f)));
  const pt = (i, f) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length; return [C + Math.cos(a) * Rr * f, C + Math.sin(a) * Rr * f]; };
  const poly = (fs) => fs.map((f, i) => pt(i, Math.min(1, f)).map((v) => v.toFixed(1)).join(',')).join(' ');
  const typical = AXES.map(([, f], i) => median(list.map(f)) / maxes[i]);
  const mine = AXES.map(([, f], i) => f(last) / maxes[i]);
  const rings = [0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${poly(AXES.map(() => f))}" class="rg"/>`).join('');
  const spokes = AXES.map((_, i) => { const [a, b] = pt(i, 1); return `<line x1="${C}" y1="${C}" x2="${a}" y2="${b}" class="rg"/>`; }).join('');
  const labels = AXES.map(([n], i) => { const [a, b] = pt(i, 1.24); return `<text x="${a}" y="${b + 4}" class="rl">${n}</text>`; }).join('');
  box.innerHTML = `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="Perfil del último directo">${rings}${spokes}<polygon points="${poly(typical)}" class="typ"/><polygon points="${poly(mine)}" class="mine"/>${labels}</svg>`;
  $('#ov-radar-when').textContent = dateShort(last.startedAt);
  $('#ov-radar-legend').innerHTML = AXES.map(([n, f], i) => {
    const v = f(last); const t = median(list.map(f));
    const pct = t ? Math.round(((v - t) / t) * 100) : 0;
    return `<li><span>${n}</span><b>${compact(v)}</b>${t ? `<small class="${pct >= 0 ? 'up' : 'down'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%</small>` : '<small>—</small>'}</li>`;
  }).join('');
  return { last, mine, typical };
}

// ---------- Regalos y fans del periodo ----------
function bars(items, unit) {
  if (!items.length) return '<p class="hint">Nada todavía en este periodo.</p>';
  const max = Math.max(...items.map((i) => i.value));
  return `<ol class="ov-bars">${items.map((i) => `<li><span class="who">${i.logo || ''}${esc(i.name)}</span><span class="val">${compact(i.value)} <small>${unit}</small></span><span class="mini"><i style="width:${Math.max(4, (i.value / max) * 100)}%"></i></span>${i.sub ? `<small class="sub">${i.sub}</small>` : ''}</li>`).join('')}</ol>`;
}
function giftsAndFans(list) {
  const g = new Map();
  const f = new Map();
  for (const s of list) {
    for (const x of s.tops?.gifts || []) { const a = g.get(x.name) || { name: x.name, value: 0, diamonds: 0 }; a.value += x.value; a.diamonds += x.diamonds || 0; g.set(x.name, a); }
    for (const x of s.tops?.gifters || []) {
      if (st.plat !== 'all' && x.platform !== st.plat) continue;
      const k = `${x.platform}:${x.name}`; const a = f.get(k) || { name: x.name, platform: x.platform, value: 0, n: 0 }; a.value += x.value; a.n += 1; f.set(k, a);
    }
  }
  $('#ov-gifts').innerHTML = bars([...g.values()].sort((a, b) => b.value - a.value).slice(0, 8).map((x) => ({ ...x, sub: `${compact(x.diamonds)} diamantes` })), 'veces');
  $('#ov-fans').innerHTML = bars([...f.values()].sort((a, b) => b.value - a.value).slice(0, 8).map((x) => ({ ...x, logo: LOGO(x.platform), sub: `en ${x.n} ${x.n === 1 ? 'directo' : 'directos'}` })), 'diamantes');
}

// ---------- Lista de directos y comparar ----------
function table(list) {
  const rows = [...list].sort((a, b) => b.startedAt - a.startedAt);
  $('#ov-count').textContent = `${rows.length} ${rows.length === 1 ? 'directo' : 'directos'}`;
  $('#ov-table').innerHTML = rows.length ? `<table class="ov-table"><thead><tr><th></th><th>Directo</th><th>Plataformas</th><th>Diamantes</th><th>Mensajes</th><th>Interacciones</th><th>Pico</th><th></th></tr></thead><tbody>${rows.map((s) => `<tr data-ov="${esc(s.id)}">
      <td><input type="checkbox" data-cmp="${esc(s.id)}" ${st.compare.has(s.id) ? 'checked' : ''} aria-label="Comparar"></td>
      <td><b>${s.live ? '<i class="live-dot"></i> ' : ''}${esc(dateShort(s.startedAt))}</b><small>${esc(dur(s.durationMin))}</small></td>
      <td class="ov-logos">${(s.platforms || []).map(LOGO).join('')}</td>
      <td>${compact(diamondsOf(s))}<small>${money(diamondsOf(s) * usdPerDiamond)}</small></td>
      <td>${compact(messagesOf(s))}</td><td>${compact(interactions(s))}</td><td>${compact(s.peakViewers || 0)}</td><td class="go">›</td></tr>`).join('')}</tbody></table>` : '<p class="hint">No hay directos guardados en este periodo.</p>';
  renderCompare();
}
function renderCompare() {
  const box = $('#ov-compare');
  const ids = [...st.compare];
  const [a, b] = ids.map((id) => all.find((s) => s.id === id)).filter(Boolean);
  if (!a || !b) { box.hidden = true; return; }
  box.hidden = false;
  const [x, y] = a.startedAt < b.startedAt ? [a, b] : [b, a];
  const row = (n, f, fmt = compact) => { const va = f(x); const vb = f(y); return `<tr><th>${n}</th><td>${fmt(va)}</td><td>${fmt(vb)}</td><td>${delta(vb, va)}</td></tr>`; };
  box.innerHTML = `<div class="row space"><h3 class="card-title">Comparar dos directos</h3><button type="button" class="btn small ghost" id="ov-cmp-clear">Quitar</button></div>
    <table class="ov-cmp"><thead><tr><th></th><th>${esc(dateShort(x.startedAt))}</th><th>${esc(dateShort(y.startedAt))}</th><th>Cambio</th></tr></thead><tbody>
    ${row('Duración', (s) => s.durationMin || 0, dur)}${row('Diamantes', diamondsOf)}${row('Mensajes', messagesOf)}${row('Personas que hablaron', (s) => s.uniqueChatters || 0)}${row('Seguidores nuevos', (s) => s.counts?.follow || 0)}${row('Me gusta', (s) => s.likes || 0)}${row('Pico de espectadores', (s) => s.peakViewers || 0)}</tbody></table>`;
  $('#ov-cmp-clear').onclick = () => { st.compare.clear(); table(pick(range().from, range().to)); };
}

// ---------- Juana ----------
function juana(t, p, prof) {
  if (!t.n) return setBubble('juana', 'No hay directos en este periodo. Prueba con «Todo» o con otras fechas.');
  const parts = [`En este periodo hiciste <b>${t.n}</b> ${t.n === 1 ? 'directo' : 'directos'} (${dur(t.minutes)} en vivo)`];
  if (p && p.diamonds) {
    const pct = Math.round(((t.diamonds - p.diamonds) / p.diamonds) * 100);
    parts.push(pct >= 0 ? `y los diamantes subieron un <b>${pct}%</b> frente al periodo anterior` : `y los diamantes bajaron un <b>${Math.abs(pct)}%</b> frente al periodo anterior`);
  }
  let best = '';
  if (prof) {
    const i = prof.mine.map((v, k) => v - prof.typical[k]).reduce((bi, v, k, arr) => (v > arr[bi] ? k : bi), 0);
    if (prof.mine[i] > prof.typical[i]) best = ` Tu último directo brilló en <b>${AXES[i][0].toLowerCase()}</b>.`;
  }
  setBubble('juana', `${parts.join(' ')}.${best}`);
}

// ---------- Pintar ----------
function render() {
  const r = range();
  const list = pick(r.from, r.to);
  const prevList = r.prev ? pick(r.prev.from, r.prev.to) : null;
  const t = totals(list);
  const p = prevList ? totals(prevList) : null;
  $('#ov-tiles').innerHTML = [
    tile('🎙', 'Directos', compact(t.n), dur(t.minutes), delta(t.n, p?.n)),
    tile('💎', 'Diamantes', compact(t.diamonds), `${money(t.diamonds * usdPerDiamond)} estimado`, delta(t.diamonds, p?.diamonds)),
    tile('💬', 'Mensajes', compact(t.messages), `${compact(t.chatters)} personas por directo`, delta(t.messages, p?.messages)),
    tile('✨', 'Interacciones', compact(t.inter), 'seguidores, regalos, likes y compartidos', delta(t.inter, p?.inter)),
    tile('👀', 'Pico de espectadores', compact(t.peak), 'el más alto del periodo', delta(t.peak, p?.peak)),
  ].join('');
  $('#ov-prev-note').textContent = p ? 'Los porcentajes comparan con el periodo anterior del mismo largo.' : '';
  chart(list);
  const prof = radar(list);
  giftsAndFans(list);
  table(list);
  juana(t, p, prof);
}

function renderBar() {
  $('#ov-plat').innerHTML = [['all', 'Todas'], ['tiktok', 'TikTok'], ['kick', 'Kick'], ['twitch', 'Twitch'], ['starvios', 'Starvios']]
    .map(([id, n]) => `<button type="button" data-ov-plat="${id}" aria-pressed="${st.plat === id}">${id === 'all' ? '' : LOGO(id)}${n}</button>`).join('');
  $('#ov-period').innerHTML = [['1', 'Hoy'], ['7', '7 días'], ['30', '30 días'], ['all', 'Todo'], ['custom', 'Fechas']]
    .map(([id, n]) => `<button type="button" data-ov-period="${id}" aria-pressed="${st.period === id}">${n}</button>`).join('');
  $('#ov-dates').hidden = st.period !== 'custom';
  for (const b of $$('#ov-metric [data-ovm]')) b.setAttribute('aria-pressed', String(b.dataset.ovm === st.metric));
}

export async function refreshOverview() {
  try {
    const r = await api('GET', '/api/stats/overview');
    all = r.sessions || [];
    if (r.usdPerDiamond) usdPerDiamond = r.usdPerDiamond;
    render();
  } catch (e) {
    toast(e.message);
  }
}

export function initOverview({ open }) {
  if (!$('#ov-root')) return;
  onOpen = open;
  renderBar();
  $('#ov-plat').addEventListener('click', (ev) => { const b = ev.target.closest('[data-ov-plat]'); if (b) { st.plat = b.dataset.ovPlat; renderBar(); render(); } });
  $('#ov-period').addEventListener('click', (ev) => { const b = ev.target.closest('[data-ov-period]'); if (b) { st.period = b.dataset.ovPeriod; renderBar(); render(); } });
  for (const id of ['ov-from', 'ov-to']) $(`#${id}`).addEventListener('change', () => { st.from = $('#ov-from').value; st.to = $('#ov-to').value; render(); });
  $('#ov-metric').addEventListener('click', (ev) => { const b = ev.target.closest('[data-ovm]'); if (b) { st.metric = b.dataset.ovm; renderBar(); chart(pick(range().from, range().to)); } });
  $('#ov-table').addEventListener('click', (ev) => {
    const cb = ev.target.closest('[data-cmp]');
    if (cb) {
      if (cb.checked) { st.compare.add(cb.dataset.cmp); if (st.compare.size > 2) st.compare.delete([...st.compare][0]); } else st.compare.delete(cb.dataset.cmp);
      table(pick(range().from, range().to));
      return;
    }
    const tr = ev.target.closest('[data-ov]');
    if (tr) onOpen(tr.dataset.ov);
  });
  refreshOverview();
}
