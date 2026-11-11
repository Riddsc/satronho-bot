// Cómo se dibuja cada overlay de la galería (w.html).
// render(ctx) devuelve HTML; el host solo cambia lo que cambió (morph.js),
// así las barras y números se animan. Los que reaccionan a eventos
// (regalo destacado, lluvia) dibujan dentro de un contenedor «data-own».
// Todos usan .surface y las variables del tema (--accent, --bg, --ink, --r).

import { mascotSVG } from '/js/mascots.js';
import { mechaBust } from '/js/mecharidds.js';
import { messageHtml } from '/js/emotes.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('es-CO');
const cmp = (n) => (Math.abs(n) >= 10000 ? new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : nf.format(Math.round(n || 0)));
const img = (u) => (/^https:\/\//.test(u || '') ? `/gift-img?u=${encodeURIComponent(u)}` : /^\//.test(u || '') ? u : '');
const pad = (n) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
function hms(ms, hours = true, secs = true) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const parts = hours || h ? [pad(h), pad(m)] : [pad(m)];
  if (secs) parts.push(pad(s));
  return parts.join(':');
}
const LOGO = { tiktok: '/img/platforms/tiktok.png', kick: '/img/platforms/kick.png', twitch: '/img/platforms/twitch.png', starvios: '/img/platforms/starvios.png' };
const plat = (p) => (LOGO[p] ? `<img class="k-pl" src="${LOGO[p]}" alt="">` : '');
const COLORS = ['#ff8fb5', '#9b8cff', '#74d14c', '#ffb23e', '#5fb8ff', '#ff7a59', '#c084fc', '#2dd4bf'];
function avatar(name, url, cls = '') {
  const n = String(name || '?');
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const letter = esc([...n.replace(/[^\p{L}\p{N}]/gu, '')][0]?.toUpperCase() || '?');
  return `<span class="k-av ${cls}" style="--avc:${COLORS[h % COLORS.length]}">${img(url) ? `<img src="${esc(img(url))}" alt="" onerror="this.remove()">` : ''}<b>${letter}</b></span>`;
}
const ring = (pct, size = 120, stroke = 12) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return `<svg class="k-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="k-ring-t" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="k-ring-f" stroke-width="${stroke}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
};

const BASE_CSS = `
  .k-av { --avc: #9b8cff; position: relative; width: 44px; height: 44px; border-radius: 50%; display: inline-grid; place-items: center; overflow: hidden; flex: none; background: var(--avc); color: #160f22; font-weight: 900; font-size: 18px; box-shadow: 0 0 0 3px color-mix(in srgb, var(--avc) 40%, transparent); }
  .k-av img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .k-pl { width: 18px; height: 18px; border-radius: 5px; vertical-align: -3px; }
  .k-ring-t { fill: none; stroke: color-mix(in srgb, var(--ink) 14%, transparent); }
  .k-ring-f { fill: none; stroke: var(--accent); stroke-linecap: round; transition: stroke-dashoffset 1s cubic-bezier(.2,.9,.3,1); filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 60%, transparent)); }
  .k-title { font-weight: 800; letter-spacing: .12em; text-transform: uppercase; font-size: 15px; color: var(--accent); }
  .k-num { font-variant-numeric: tabular-nums; font-weight: 900; }
  .surface { background: var(--bg); border-radius: calc(18px * var(--r)); }
  /* Tema Satronho: un brillo suave arriba, filo interior y sombra profunda;
     se ve sobrio y se lee bien sobre cualquier juego o cámara. */
  body[data-theme="satronho"]:not([data-card="glass"]):not([data-card="none"]) .surface { background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 9%, var(--bg)), var(--bg) 70%); box-shadow: 0 18px 44px rgba(0,0,0,.42), 0 2px 6px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.09), inset 0 0 0 1px rgba(255,255,255,.04); }
  body[data-theme="satronho"][data-card="glass"] .surface { box-shadow: 0 10px 30px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.08); }
  .k-shadow { text-shadow: 0 2px 10px rgba(0,0,0,.55); }
  /* Estilos sin tarjeta: nada de sombra alrededor (se vería un halo). */
  body[data-style="minimo"] .surface, body[data-style="cifra"] .surface, body[data-style="clasico"] .surface, body[data-style="marcador"] .surface, body[data-style="burbujas"] .lg, body[data-style="tarjetas"] :is(.q, .ac) { box-shadow: none !important; }
  @keyframes k-in { from { opacity: 0; transform: translateY(14px) scale(.96); } }
  @keyframes k-pop { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
`;

// ===================== Metas =====================
const GOAL_ICON = { follow: '➕', gift: '🪙', like: '👍', sub: '✦', share: '↗', chat: '💬' };
const BAR_H = { fina: 10, normal: 22, gruesa: 34 };
const goals = {
  tick: true,
  css: BASE_CSS + `
  .w { width: 640px; }
  .g-list { display: grid; gap: 12px; }
  .g-list.row { grid-auto-flow: column; grid-auto-columns: 1fr; }
  .g { --bh: 22px; padding: 14px 16px; animation: k-in .5s both; border: 2px solid color-mix(in srgb, var(--accent) 40%, transparent); }
  .g.bare { padding: 10px 12px; }
  .g-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .g-ic { width: 38px; height: 38px; border-radius: calc(12px * var(--r)); display: grid; place-items: center; font-size: 20px; background: color-mix(in srgb, var(--accent) 22%, transparent); }
  .g-head .k-pl { width: 24px; height: 24px; border-radius: 7px; box-shadow: 0 2px 8px rgba(0,0,0,.35); }
  .g-name { font-weight: 800; font-size: 20px; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .g-pct { font-weight: 900; font-size: 20px; color: var(--accent); }
  /* La barra: riel hundido, relleno con degradado y brillo, y una punta que
     resplandece. Con poco avance igual se ve (ancho mínimo = su alto). */
  .g-bar { position: relative; height: var(--bh); border-radius: 99px; overflow: hidden;
    background: linear-gradient(180deg, rgba(0,0,0,.28), rgba(255,255,255,.04)), color-mix(in srgb, var(--ink) 10%, transparent);
    box-shadow: inset 0 2px 5px rgba(0,0,0,.45), inset 0 -1px 0 rgba(255,255,255,.06), 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent); }
  .g-fill { position: relative; height: 100%; min-width: var(--bh); border-radius: inherit; overflow: hidden;
    background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 45%, #000) 0%, var(--accent) 70%, color-mix(in srgb, var(--accent) 65%, #fff) 100%);
    box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 70%, transparent), inset 0 -3px 6px rgba(0,0,0,.18);
    transition: width 1.1s cubic-bezier(.2,.9,.3,1); }
  .g-fill.zero { min-width: 0; width: 0 !important; }
  .g-fill::before { content: ''; position: absolute; left: 6px; right: 6px; top: 2px; height: 38%; border-radius: 99px; background: linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,0)); }
  .g-fill::after { content: ''; position: absolute; top: 0; bottom: 0; right: 0; width: var(--bh); border-radius: 50%; background: radial-gradient(circle at 60% 50%, rgba(255,255,255,.85), rgba(255,255,255,0) 65%); opacity: .55; }
  .g.shine .g-fill > i { position: absolute; inset: 0; background: linear-gradient(100deg, transparent 0 35%, rgba(255,255,255,.45) 50%, transparent 65% 100%); background-size: 250% 100%; animation: g-shine 2.8s ease-in-out infinite; }
  @keyframes g-shine { from { background-position: 130% 0; } to { background-position: -30% 0; } }
  .g-foot { display: flex; justify-content: space-between; margin-top: 8px; font-weight: 800; font-size: 17px; }
  .g-foot .k-num { font-size: 20px; } .g-foot small { opacity: .75; font-weight: 700; }
  /* Píldora: todo dentro de la barra. */
  body[data-style="pildora"] .g { padding: 6px; border-radius: 99px; }
  body[data-style="pildora"] .g-bar { --bh: 52px; height: var(--bh); }
  body[data-style="pildora"] .g-in { position: absolute; inset: 0; display: flex; align-items: center; gap: 10px; padding: 0 18px 0 8px; font-weight: 800; text-shadow: 0 1px 4px rgba(0,0,0,.65); }
  body[data-style="pildora"] .g-in .g-ic { width: 38px; height: 38px; border-radius: 50%; background: rgba(0,0,0,.28); }
  body[data-style="pildora"] .g-in .g-name { font-size: 19px; }
  body[data-style="pildora"] .g-in .g-nums { font-size: 19px; white-space: nowrap; } .g-in .g-nums small { opacity: .8; }
  body[data-style="pildora"] .g-in .g-pct { color: #fff; font-size: 19px; }
  body[data-theme="minimal"] .g.bare, body[data-style="pildora"][data-theme="minimal"] .g { border-left: 0 !important; padding-left: 0; }
  body[data-style="anillo"] .g, body[data-style="pastel"] .g { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; }
  body[data-style="anillo"] .g-head, body[data-style="pastel"] .g-head { margin-bottom: 0; }
  .g-dial { position: relative; width: 120px; height: 120px; display: grid; place-items: center; }
  .g-dial .k-ring, .g-pie { position: absolute; inset: 0; }
  .g-pie { border-radius: 50%; background: conic-gradient(var(--accent) var(--p), color-mix(in srgb, var(--ink) 12%, transparent) 0); box-shadow: 0 0 22px color-mix(in srgb, var(--accent) 45%, transparent); }
  .g-pie::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, transparent 0 58%, rgba(0,0,0,.15) 60%); }
  .g-dial .g-pct { position: relative; font-size: 26px; text-shadow: 0 2px 6px rgba(0,0,0,.6); }
  body[data-style="pastel"] .g-dial .g-pct { color: #fff; }
  body[data-style="tarjeta"] .g { text-align: center; padding: 18px; }
  body[data-style="tarjeta"] .g-head { justify-content: center; margin-bottom: 0; }
  body[data-style="tarjeta"] .g-big { font-size: 46px; margin: 6px 0 10px; }
  body[data-style="cifra"] .g { background: transparent !important; border: 0; text-shadow: 0 3px 10px rgba(0,0,0,.8); padding: 4px 0; }
  body[data-style="cifra"] .g-head { margin-bottom: 0; }
  body[data-style="cifra"] .g-big { font-size: 64px; line-height: 1; }
  body[data-style="cifra"] .g-big small { font-size: .5em; opacity: .8; }
  .g.done { animation: g-done 1.2s ease-in-out 3; }
  body[data-shape="wide"] .w { width: auto; } body[data-shape="wide"] .g-list { grid-auto-flow: column; grid-auto-columns: 420px; }
  @keyframes g-done { 50% { box-shadow: 0 0 40px var(--accent); transform: scale(1.03); } }
  `,
  render({ S, set, style }) {
    const list = (S.goals || []).filter((g) => !(set.hidden || []).includes(g.id));
    if (!list.length) return S.preview ? '<div class="g surface">Crea una meta en la pestaña «Metas».</div>' : '';
    const show = set.layout === 'one' ? [list[Math.floor(Date.now() / 7000) % list.length]] : list;
    const done = goals.doneId;
    const bh = BAR_H[set.barSize] || BAR_H.normal;
    return `<div class="g-list ${set.layout === 'row' ? 'row' : ''}">${show.map((g) => {
      const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
      const left = Math.max(0, g.target - g.current);
      const icon = set.showIcon ? `<span class="g-ic">${GOAL_ICON[g.type] || '🎯'}</span>` : '';
      const logo = set.showPlatform !== false && g.platform && g.platform !== 'all' ? plat(g.platform) : '';
      const name = set.showTitle ? `<span class="g-name">${esc(g.title)}</span>` : '';
      const pctT = set.showPercent ? `<span class="g-pct k-num">${Math.floor(pct)}%</span>` : '';
      const nums = `${set.showCurrent ? `<span class="k-num">${cmp(g.current)}</span>` : ''}${set.showTarget ? `<small> / ${cmp(g.target)}</small>` : ''}`;
      const rem = set.showRemaining && left ? `<small>Faltan ${cmp(left)}</small>` : '';
      const headIn = `${icon}${logo}${name}`;
      const bare = !headIn && !pctT && !nums && !rem;
      const cls = `g surface ${done === g.id ? 'done' : ''} ${set.shine !== false ? 'shine' : ''} ${bare ? 'bare' : ''}`;
      const vars = `--bh:${bh}px;${/^#[0-9a-f]{6}$/i.test(g.color || '') ? `--accent:${g.color};` : ''}`;
      const bar = `<div class="g-bar"><div class="g-fill ${pct <= 0 ? 'zero' : ''}" style="width:${pct.toFixed(1)}%"><i></i></div>`;
      if (style === 'pildora') {
        return `<div class="${cls}" data-key="${esc(g.id)}" style="${vars}">${bar}<div class="g-in">${icon}${logo}${name || '<span class="g-name"></span>'}<span class="g-nums k-num">${nums}</span>${pctT}</div></div></div>`;
      }
      if (style === 'anillo' || style === 'pastel') {
        const dial = style === 'anillo' ? ring(pct) : `<span class="g-pie" style="--p:${pct.toFixed(1)}%"></span>`;
        return `<div class="${cls}" data-key="${esc(g.id)}" style="${vars}"><div class="g-dial">${dial}${pctT}</div><div>${headIn ? `<div class="g-head">${headIn}</div>` : ''}<div class="g-foot"><span>${nums}</span>${rem}</div></div></div>`;
      }
      if (style === 'tarjeta' || style === 'cifra') {
        return `<div class="${cls}" data-key="${esc(g.id)}" style="${vars}">${headIn || (style === 'cifra' && pctT) ? `<div class="g-head">${headIn}${style === 'cifra' ? pctT : ''}</div>` : ''}<div class="g-big k-num">${nums}</div>${style === 'tarjeta' ? `${bar}</div><div class="g-foot" style="justify-content:center;gap:12px">${pctT}${rem}</div>` : rem}</div>`;
      }
      const head = headIn || pctT ? `<div class="g-head">${headIn}${headIn ? '' : '<span class="g-name"></span>'}${pctT}</div>` : '';
      const foot = nums || rem ? `<div class="g-foot"><span>${nums}</span>${rem}</div>` : '';
      return `<div class="${cls}" data-key="${esc(g.id)}" style="${vars}">${head}${bar}</div>${foot}</div>`;
    }).join('')}</div>`;
  },
  onGoalDone(g, { set }) {
    if (!set.celebrate) return;
    goals.doneId = g.id;
    setTimeout(() => { goals.doneId = ''; }, 3800);
  },
};

// ===================== Contadores =====================
const counters = {
  css: BASE_CSS + `
  .c-list { display: grid; gap: 10px; }
  .c-list.row { grid-auto-flow: column; grid-auto-columns: max-content; }
  .c { display: flex; align-items: center; gap: 12px; padding: 10px 18px 10px 10px; border: 2px solid color-mix(in srgb, var(--accent) 35%, transparent); animation: k-in .5s both; }
  .c-ic { width: 48px; height: 48px; display: grid; place-items: center; font-size: 26px; border-radius: calc(14px * var(--r)); background: color-mix(in srgb, var(--accent) 20%, transparent); }
  .c-name { font-weight: 800; font-size: 16px; opacity: .85; }
  .c-val { font-size: 34px; color: var(--accent); line-height: 1; }
  .c-val small { color: var(--ink); opacity: .6; font-size: .6em; }
  .c-val.bump { animation: k-pop .5s; }
  body[data-shape="wide"] .c-list { grid-auto-flow: column; grid-auto-columns: max-content; }
  body[data-style="chip"] .c { border-radius: 999px; padding: 6px 16px 6px 6px; }
  body[data-style="chip"] .c-ic { width: 36px; height: 36px; border-radius: 50%; font-size: 18px; }
  body[data-style="chip"] .c-val { font-size: 24px; }
  body[data-style="grande"] .c { flex-direction: column; text-align: center; padding: 18px 28px; gap: 6px; }
  body[data-style="grande"] .c-val { font-size: 64px; }
  body[data-style="marcador"] .c { border: 0; border-left: 6px solid var(--accent); border-radius: 6px; background: linear-gradient(90deg, var(--bg), transparent); }
  body[data-style="marcador"] .c-val { font-family: 'JetBrains Mono', monospace; }
  `,
  render({ S, set }) {
    const list = (S.live?.counters || []).filter((c) => !(set.hidden || []).includes(c.id));
    if (!list.length) return S.preview ? '<div class="c surface">Crea un contador en la pestaña «Contadores».</div>' : '';
    return `<div class="c-list ${set.layout === 'row' ? 'row' : ''}">${list.map((c) => `<div class="c surface" data-key="${esc(c.id)}">${set.showIcon && c.icon ? `<span class="c-ic">${esc(c.icon)}</span>` : ''}<div>${set.showName ? `<div class="c-name">${esc(c.name)}</div>` : ''}<div class="c-val k-num" data-v="${c.value}">${nf.format(c.value || 0)}${set.showGoal && c.goal ? `<small>/${nf.format(c.goal)}</small>` : ''}</div></div></div>`).join('')}</div>`;
  },
};

// ===================== Cuenta regresiva =====================
const countdown = {
  tick: true,
  added: null,
  css: BASE_CSS + `
  .w { display: grid; justify-items: center; gap: 8px; }
  .t-box { position: relative; padding: 14px 34px; border: 3px solid color-mix(in srgb, var(--accent) 55%, transparent); text-align: center; }
  .t-time { font-size: 86px; line-height: 1; letter-spacing: .03em; }
  .t-title { font-weight: 800; font-size: 22px; }
  .t-add { position: absolute; top: -18px; right: -14px; padding: 4px 12px; border-radius: 99px; background: var(--accent); color: #160f22; font-weight: 900; font-size: 20px; animation: t-add 2s ease-out both; }
  @keyframes t-add { 0% { opacity: 0; transform: translateY(10px) scale(.7); } 20% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-16px); } }
  .t-end { font-size: 36px; font-weight: 900; }
  .t-bar { height: 8px; border-radius: 9px; margin-top: 10px; background: color-mix(in srgb, var(--ink) 12%, transparent); overflow: hidden; }
  .t-bar i { display: block; height: 100%; background: var(--accent); transition: width 1s linear; }
  body[data-style="neon"] .t-box { background: rgba(5,3,14,.9) !important; box-shadow: 0 0 24px var(--accent), inset 0 0 18px color-mix(in srgb, var(--accent) 40%, transparent); }
  body[data-style="neon"] .t-time { color: var(--accent); text-shadow: 0 0 12px var(--accent), 0 0 34px var(--accent); }
  body[data-style="minimo"] .t-box { background: transparent !important; border: 0; text-shadow: 0 3px 12px rgba(0,0,0,.85); }
  body[data-style="minimo"] .t-time { font-size: 72px; }
  .t-box.low .t-time { color: #ff5d6a; animation: k-pop 1s infinite; }
  `,
  render({ S, set, style }) {
    const c = S.live?.countdown || {};
    const left = c.running ? Math.max(0, c.endsAt - Date.now()) : c.left || 0;
    if (c.running && left <= 0) return `<div class="t-box surface"><div class="t-end">${esc(set.endText)}</div></div>`;
    const add = set.showAdded && countdown.added && Date.now() - countdown.added.ts < 2000 ? `<span class="t-add" data-key="a${countdown.added.ts}">+${hms(countdown.added.ms, false)}</span>` : '';
    const total = Math.max(left, countdown.max || 0);
    countdown.max = total;
    return `${set.title ? `<div class="t-title">${esc(set.title)}</div>` : ''}<div class="t-box surface ${left < 60000 && c.running ? 'low' : ''}">${add}<div class="t-time k-num">${hms(left, set.showHours)}</div>${style === 'barra' ? `<div class="t-bar"><i style="width:${total ? ((left / total) * 100).toFixed(1) : 0}%"></i></div>` : ''}</div>`;
  },
  onLive(prev, next) {
    const a = prev?.countdown; const b = next?.countdown;
    if (!a || !b) return;
    const la = a.running ? a.endsAt - (prev.now || Date.now()) : a.left;
    const lb = b.running ? b.endsAt - (next.now || Date.now()) : b.left;
    if (lb - la > 1500) countdown.added = { ms: lb - la, ts: Date.now() };
  },
};

// ===================== Tiempo en directo =====================
const uptime = {
  tick: true,
  css: BASE_CSS + `
  .w { display: grid; justify-items: center; gap: 8px; }
  .u-label { display: flex; align-items: center; gap: 8px; font-weight: 900; letter-spacing: .14em; color: #ff4d6a; font-size: 22px; text-shadow: 0 2px 8px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.9); }
  .u-dot { width: 14px; height: 14px; border-radius: 50%; background: #ff4d6a; box-shadow: 0 0 12px #ff4d6a; animation: u-dot 1.4s infinite; }
  @keyframes u-dot { 50% { opacity: .35; } }
  .u-box { padding: 12px 30px; border: 3px solid color-mix(in srgb, var(--accent) 50%, transparent); }
  .u-time { font-size: 76px; line-height: 1; }
  .u-sub { font-weight: 800; font-size: 19px; color: #ffd0d6; text-shadow: 0 2px 8px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.9); }
  body[data-style="en-vivo"] .u-box { border-color: #ff4d6a; box-shadow: 0 0 0 6px rgba(255,77,106,.18); }
  body[data-style="minimo"] .u-box { background: transparent !important; border: 0; text-shadow: 0 3px 12px rgba(0,0,0,.85); }
  `,
  render({ S, set }) {
    const st = S.live?.startedAt || 0;
    const ms = st ? Date.now() - st : 0;
    const h = Math.floor(ms / 3600000);
    const sub = set.hourText && st ? set.hourText.replace('{horas}', String(h)).replace('{minutos}', String(Math.floor(ms / 60000) % 60)) : '';
    return `${set.showLabel ? `<div class="u-label">${set.showDot ? '<i class="u-dot"></i>' : ''}${esc(set.label)}</div>` : ''}<div class="u-box surface"><div class="u-time k-num">${hms(ms, true, set.showSeconds)}</div></div>${sub && h >= 1 ? `<div class="u-sub">${esc(sub)}</div>` : ''}`;
  },
};

// ===================== Espectadores y seguidores =====================
const bigNumberCss = BASE_CSS + `
  .w { display: grid; justify-items: center; gap: 6px; }
  .n-label { font-weight: 900; letter-spacing: .14em; font-size: 22px; color: var(--accent); text-shadow: 0 2px 8px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.9); display: flex; align-items: center; gap: 8px; }
  .n-label i { width: 12px; height: 12px; border-radius: 50%; background: #ff4d6a; box-shadow: 0 0 10px #ff4d6a; }
  .n-box { display: flex; align-items: center; gap: 16px; padding: 10px 30px; border: 3px solid color-mix(in srgb, var(--accent) 45%, transparent); border-radius: 999px !important; }
  .n-ic { font-size: 40px; }
  .n-val { font-size: 64px; line-height: 1; }
  .n-sub { font-weight: 800; font-size: 19px; color: color-mix(in srgb, var(--accent) 45%, #fff); text-shadow: 0 2px 8px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.9); }
  body[data-style="grande"] .n-box { flex-direction: column; gap: 4px; border-radius: calc(24px * var(--r)) !important; padding: 18px 40px; }
  body[data-style="grande"] .n-val { font-size: 88px; }
  body[data-style="minimo"] .n-box { background: transparent !important; border: 0; text-shadow: 0 3px 12px rgba(0,0,0,.85); padding: 0; }
`;
const viewers = {
  css: bigNumberCss,
  render({ S, set }) {
    const v = set.platform === 'all' ? S.live?.viewersTotal || 0 : S.live?.viewers?.[set.platform] || 0;
    return `${set.showLabel ? `<div class="n-label"><i></i>${esc(set.label)}</div>` : ''}<div class="n-box surface"><span class="n-ic">👁</span><span class="n-val k-num">${nf.format(v)}</span></div>${set.showPeak && S.live?.peak ? `<div class="n-sub">Máximo hoy: ${nf.format(S.live.peak)}</div>` : ''}`;
  },
};
const followers = {
  css: bigNumberCss,
  render({ S, set }) {
    const fresh = S.live?.follows || 0;
    const total = (Number(set.base) || 0) + fresh;
    return `${set.showLabel ? `<div class="n-label">${esc(set.label)}</div>` : ''}<div class="n-box surface"><span class="n-ic">➕</span><span class="n-val k-num">${nf.format(Number(set.base) ? total : fresh)}</span></div>${set.showNew && Number(set.base) ? `<div class="n-sub">+${nf.format(fresh)} nuevos en este directo</div>` : ''}`;
  },
};

// ===================== Ranking =====================
const UNIT = { likes: 'likes', gifts: 'monedas', chat: 'mensajes' };
const RTITLE = { likes: 'Top likes', gifts: 'Top regalos', chat: 'Más activos' };
const RICON = { likes: '❤', gifts: '🪙', chat: '💬' };
const REMPTY = { likes: 'Da likes y sube al podio', gifts: 'Envía un regalo y sube al podio', chat: 'Escribe en el chat y sube al podio' };
const ranking = {
  css: BASE_CSS + `
  :root { --gold: #ffd23e; --silver: #d5deef; --bronze: #e8a066; --other: #a99bff; }
  .r { display: grid; justify-items: center; gap: 18px; padding: 20px 24px 0; overflow: hidden; }
  .r-head { display: flex; align-items: center; gap: 10px; font-weight: 900; font-size: 26px; letter-spacing: .01em; }
  .r-head i { font-style: normal; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; font-size: 20px; background: color-mix(in srgb, var(--accent) 22%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
  .r-empty { font-weight: 800; font-size: 17px; opacity: .8; margin: -6px 0 2px; }
  .r-pod { display: flex; align-items: flex-end; gap: 14px; padding-top: 24px; } /* aire para la corona */
  .r-spot { --c: var(--other); display: grid; justify-items: center; gap: 7px; width: 150px; animation: k-in .6s both; }
  .r-spot[data-p="1"] { --c: var(--gold); width: 178px; } .r-spot[data-p="2"] { --c: var(--silver); } .r-spot[data-p="3"] { --c: var(--bronze); }
  .r-spot .k-av { width: 74px; height: 74px; font-size: 30px; --avc: var(--c); box-shadow: 0 0 0 4px var(--c), 0 8px 22px rgba(0,0,0,.45); }
  .r-spot[data-p="1"] .k-av { width: 96px; height: 96px; font-size: 38px; box-shadow: 0 0 0 5px var(--c), 0 0 30px color-mix(in srgb, var(--c) 55%, transparent); }
  .r-spot.free .k-av { background: color-mix(in srgb, var(--ink) 10%, transparent); color: color-mix(in srgb, var(--ink) 55%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 55%, transparent); }
  .r-crown { position: absolute; top: -30px; left: 50%; transform: translateX(-50%); font-size: 30px; filter: drop-shadow(0 3px 6px rgba(0,0,0,.5)); }
  .r-avw { position: relative; }
  .r-name { max-width: 100%; font-weight: 900; font-size: 19px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .r-val { font-weight: 800; font-size: 15px; color: var(--c); font-variant-numeric: tabular-nums; }
  .r-spot.free .r-name { opacity: .55; }
  .r-block { width: 100%; border-radius: calc(14px * var(--r)) calc(14px * var(--r)) 0 0; display: grid; place-items: start center; padding-top: 8px; color: #1a1228; font-weight: 900; font-size: 32px; background: linear-gradient(180deg, color-mix(in srgb, var(--c) 80%, #fff) 0%, var(--c) 30%, color-mix(in srgb, var(--c) 78%, #1a1228) 100%); box-shadow: inset 0 2px 0 rgba(255,255,255,.55), inset 0 -18px 30px -18px rgba(0,0,0,.35); text-shadow: 0 1px 0 rgba(255,255,255,.4); }
  .r-spot[data-p="1"] .r-block { height: 112px; } .r-spot[data-p="2"] .r-block { height: 84px; } .r-spot[data-p="3"] .r-block { height: 64px; } .r-spot[data-p="4"] .r-block, .r-spot[data-p="5"] .r-block { height: 46px; font-size: 24px; }
  .r-spot.free .r-block { opacity: .45; }
  /* Lista */
  .r.lista, .r.tarjetas, .r.tira { padding-bottom: 20px; }
  .r-rest { display: grid; gap: 8px; width: 100%; margin-top: -18px; padding: 0 0 18px; }
  .r .r-rest .r-row { --c: var(--other); }
  .r-list { display: grid; gap: 8px; width: 460px; }
  .r-row { --c: var(--other); display: grid; grid-template-columns: 36px 44px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 8px 14px 8px 8px; border-radius: calc(14px * var(--r)); background: color-mix(in srgb, var(--ink) 6%, transparent); box-shadow: inset 3px 0 0 var(--c); animation: k-in .4s both; }
  .r-row:nth-child(1) { --c: var(--gold); } .r-row:nth-child(2) { --c: var(--silver); } .r-row:nth-child(3) { --c: var(--bronze); }
  .r-pos { font-weight: 900; font-size: 22px; color: var(--c); text-align: center; }
  .r-row .r-name { font-size: 19px; } .r-row .r-val { font-size: 17px; }
  /* Tarjetas */
  .r-cards { display: flex; gap: 12px; justify-content: center; }
  .r-card { --c: var(--other); width: 150px; padding: 14px 10px; display: grid; justify-items: center; gap: 6px; text-align: center; border-radius: calc(14px * var(--r)); background: color-mix(in srgb, var(--ink) 6%, transparent); box-shadow: inset 0 3px 0 var(--c); animation: k-in .5s both; }
  .r-card:nth-child(1) { --c: var(--gold); } .r-card:nth-child(2) { --c: var(--silver); } .r-card:nth-child(3) { --c: var(--bronze); }
  .r-card .k-av { width: 64px; height: 64px; font-size: 26px; --avc: var(--c); box-shadow: 0 0 0 3px var(--c); }
  .r-card .r-pos { font-size: 20px; line-height: 28px; }
  /* Tira: para fuentes bajas y anchas (se elige sola). */
  .r.tira { grid-auto-flow: column; align-items: center; gap: 16px; padding: 12px 18px; }
  .r.tira .r-head { font-size: 0; gap: 0; } .r.tira .r-head i { width: 46px; height: 46px; font-size: 22px; }
  .r-strip { display: flex; gap: 10px; }
  .r-chip { --c: var(--other); display: grid; grid-template-columns: auto 46px auto; gap: 10px; align-items: center; padding: 6px 16px 6px 8px; border-radius: 999px; background: color-mix(in srgb, var(--ink) 7%, transparent); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--c) 70%, transparent); animation: k-in .4s both; }
  .r-chip:nth-child(1) { --c: var(--gold); } .r-chip:nth-child(2) { --c: var(--silver); } .r-chip:nth-child(3) { --c: var(--bronze); }
  .r-chip .r-pos { font-size: 20px; min-width: 22px; } .r-chip .k-av { width: 46px; height: 46px; font-size: 19px; --avc: var(--c); }
  .r-chip .r-name { font-size: 18px; max-width: 170px; } .r-chip .r-val { display: block; font-size: 14px; }
  .r-chip.free { opacity: .6; }
  body[data-hide-values="1"] .r-val { display: none; }
  `,
  render({ S, set, style }) {
    document.body.dataset.hideValues = set.showValues ? '0' : '1';
    const list = (S.podium?.[set.metric] || []).slice(0, set.size);
    const unit = UNIT[set.metric] || '';
    const head = set.showTitle ? `<div class="r-head"><i>${RICON[set.metric] || '🏆'}</i>${esc(set.title || RTITLE[set.metric])}</div>` : '';
    const empty = list.length ? '' : `<div class="r-empty">${REMPTY[set.metric] || '¡Sé el primero!'}</div>`;
    const shape = document.body.dataset.shape;
    // Puestos vacíos: el podio se ve completo aunque nadie haya llegado todavía.
    const slots = Math.max(1, Math.min(set.size || 3, 5));
    const at = (i) => list[i] || null;
    const av = (u, p) => `<div class="r-avw">${p === 1 && set.crown && u ? '<span class="r-crown">👑</span>' : ''}${u ? avatar(u.name, set.avatars ? u.avatar : '') : '<span class="k-av"><b>?</b></span>'}</div>`;
    const val = (u) => (u ? `<span class="r-val">${cmp(u.value)} ${unit}</span>` : '<span class="r-val">—</span>');
    if (shape === 'wide') {
      const n = Math.min(slots, 3);
      return `<div class="r tira surface">${head}<div class="r-strip">${Array.from({ length: n }, (_, i) => { const u = at(i); return `<div class="r-chip ${u ? '' : 'free'}" data-key="c${i}"><span class="r-pos">${i === 0 && set.crown && u ? '👑' : i + 1}</span>${u ? avatar(u.name, set.avatars ? u.avatar : '') : '<span class="k-av"><b>?</b></span>'}<div><div class="r-name">${u ? esc(u.name) : 'Libre'}</div>${u ? val(u) : ''}</div></div>`; }).join('')}</div></div>`;
    }
    if (style === 'lista') return `<div class="r lista surface">${head}${empty}<div class="r-list">${list.map((u, i) => `<div class="r-row" data-key="${esc(u.platform + u.name)}"><span class="r-pos">${i === 0 && set.crown ? '👑' : i + 1}</span>${avatar(u.name, set.avatars ? u.avatar : '')}<span class="r-name">${plat(u.platform)} ${esc(u.name)}</span>${val(u)}</div>`).join('')}</div></div>`;
    if (style === 'tarjetas') return `<div class="r tarjetas surface">${head}${empty}<div class="r-cards">${list.map((u, i) => `<div class="r-card" data-key="${esc(u.platform + u.name)}"><span class="r-pos">${i === 0 && set.crown ? '👑' : `#${i + 1}`}</span>${avatar(u.name, set.avatars ? u.avatar : '')}<span class="r-name">${esc(u.name)}</span>${val(u)}</div>`).join('')}</div></div>`;
    // Fuente cuadrada o vertical: el podio con los 3 primeros y el resto en filas.
    const tall = shape === 'tall' && slots > 3;
    const order = (tall ? [2, 1, 3] : [4, 2, 1, 3, 5]).filter((p) => p <= slots);
    const rest = tall ? `<div class="r-rest">${list.slice(3, slots).map((u, i) => `<div class="r-row" data-key="${esc(u.platform + u.name)}"><span class="r-pos">${i + 4}</span>${avatar(u.name, set.avatars ? u.avatar : '')}<span class="r-name">${esc(u.name)}</span>${val(u)}</div>`).join('')}</div>` : '';
    return `<div class="r surface">${head}${empty}<div class="r-pod">${order.map((p) => { const u = at(p - 1); return `<div class="r-spot ${u ? '' : 'free'}" data-p="${p}" data-key="p${p}">${av(u, p)}<div class="r-name">${u ? esc(u.name) : 'Libre'}</div>${u ? val(u) : ''}<div class="r-block">${p}</div></div>`; }).join('')}</div>${rest}</div>`;
  },
};

// ===================== El más generoso =====================
const mvp = {
  css: BASE_CSS + `
  .w { display: grid; justify-items: center; }
  .m { position: relative; display: grid; justify-items: center; gap: 6px; padding: 22px 40px 18px; animation: k-in .6s both; }
  .m .k-av { width: 96px; height: 96px; font-size: 38px; --avc: #ffd23e; box-shadow: 0 0 0 5px #ffd23e, 0 0 30px rgba(255,210,62,.6); }
  .m-title { font-weight: 900; letter-spacing: .14em; font-size: 15px; color: #ffd23e; }
  .m-name { font-weight: 900; font-size: 28px; }
  .m-val { font-weight: 900; font-size: 24px; color: #ffd23e; }
  body[data-style="alas"] .w { padding: 0 72px; }
  .m-wing { position: absolute; top: 18px; width: 120px; height: 90px; }
  .m-wing.l { left: -70px; } .m-wing.r { right: -70px; transform: scaleX(-1); }
  .m-wing path { fill: url(#mw); filter: drop-shadow(0 4px 10px rgba(0,0,0,.4)); }
  body[data-style="tarjeta"] .m { border: 3px solid #ffd23e; }
  body[data-style="tarjeta"] .m-wing, body[data-style="minimo"] .m-wing { display: none; }
  body[data-style="minimo"] .m { background: transparent !important; text-shadow: 0 3px 10px rgba(0,0,0,.85); }
  .m.new { animation: m-new 1s cubic-bezier(.2,1.4,.4,1) both; }
  @keyframes m-new { 0% { transform: scale(.4) rotate(-8deg); opacity: 0; } }
  `,
  render({ S, set, style }) {
    const u = (S.podium?.gifts || [])[0];
    if (!u) return S.preview ? '' : '';
    const wing = '<svg class="m-wing %s" viewBox="0 0 120 90"><defs><linearGradient id="mw" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#ffd23e"/></linearGradient></defs><path d="M118 70C90 72 40 64 6 30c16 2 30 0 40-6-12 0-22-4-30-12 18 4 34 2 44-6-6 8-6 16 0 22 10-4 20-14 26-26 2 18-4 34-14 44 18-2 32-10 46-24-6 22-24 40-46 48z"/></svg>';
    const key = `${u.platform}${u.name}`;
    const isNew = mvp.last && mvp.last !== key;
    mvp.last = key;
    return `<div class="m surface ${isNew ? 'new' : ''}" data-key="${esc(key)}">${style === 'alas' ? wing.replace('%s', 'l') + wing.replace('%s', 'r') : ''}<span class="m-title">${esc(set.title)}</span>${avatar(u.name, set.avatars ? u.avatar : '')}<span class="m-name">${esc(u.name)}</span>${set.showValue ? `<span class="m-val">🪙 ${nf.format(u.value)}</span>` : ''}</div>`;
  },
};

// ===================== Últimos regalos =====================
const lastgifts = {
  css: BASE_CSS + `
  .w { width: 400px; }
  .lg { display: grid; gap: 8px; padding: 12px; }
  .lg-row { display: grid; grid-template-columns: 40px 1fr auto 46px; gap: 10px; align-items: center; animation: k-in .45s both; }
  .lg-row .k-av { width: 40px; height: 40px; font-size: 16px; }
  .lg-who b { display: block; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lg-who small { opacity: .75; font-weight: 700; font-size: 13px; }
  .lg-val { font-weight: 900; color: var(--accent); }
  .lg-img { width: 44px; height: 44px; object-fit: contain; }
  body[data-style="burbujas"] .lg { background: transparent !important; padding: 0; }
  body[data-style="burbujas"] .lg-row { background: var(--bg); border-radius: 99px; padding: 4px 12px 4px 4px; }
  body[data-style="compacta"] .lg-row { grid-template-columns: 28px 1fr auto; } body[data-style="compacta"] .lg-row .k-av { display: none; }
  body[data-style="compacta"] .lg-img { width: 28px; height: 28px; }
  body[data-shape="wide"] .w { width: 960px; } body[data-shape="wide"] .lg { grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 20px; } body[data-shape="wide"] .lg > .k-title { grid-column: 1 / -1; }
  `,
  render({ S, set }) {
    const list = (S.live?.gifts || []).filter((g) => g.value >= (Number(set.minValue) || 0) && (set.platform === 'all' || g.platform === set.platform)).slice(0, set.count);
    if (!list.length) return '';
    const gi = (g) => (img(g.image) ? `<img class="lg-img" src="${esc(img(g.image))}" alt="">` : '<span class="lg-img" style="font-size:28px;display:grid;place-items:center">🎁</span>');
    return `<div class="lg surface">${set.showTitle ? `<div class="k-title">${esc(set.title)}</div>` : ''}${list.map((g) => `<div class="lg-row" data-key="${esc(g.id)}">${document.body.dataset.style === 'compacta' ? gi(g) : avatar(g.user, g.avatar)}<div class="lg-who"><b>${esc(g.user)}</b><small>${g.count > 1 ? `${g.count}× ` : ''}${esc(g.gift)}</small></div>${set.showValue ? `<span class="lg-val">🪙 ${cmp(g.value)}</span>` : '<span></span>'}${document.body.dataset.style === 'compacta' ? '' : gi(g)}</div>`).join('')}</div>`;
  },
};

// ===================== Regalo destacado =====================
const giftspot = {
  css: BASE_CSS + `
  #root { padding: 0; }
  .w { width: 100%; height: 100%; }
  .gs { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
  body[data-pos="left"] .gs { justify-items: start; padding-left: 40px; } body[data-pos="right"] .gs { justify-items: end; padding-right: 40px; }
  .gs-card { display: grid; justify-items: center; gap: 4px; text-align: center; animation: gs-in .9s cubic-bezier(.2,1.5,.4,1) both; }
  .gs-card.out { animation: gs-out .5s ease-in both; }
  .gs-glow { position: relative; width: 200px; height: 200px; display: grid; place-items: center; }
  .gs-glow::before { content: ''; position: absolute; inset: -40px; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--accent) 55%, transparent), transparent 65%); animation: gs-pulse 1.4s ease-in-out infinite; }
  .gs-glow img { position: relative; width: 170px; height: 170px; object-fit: contain; filter: drop-shadow(0 10px 30px rgba(0,0,0,.5)); animation: gs-float 2s ease-in-out infinite; }
  .gs-glow span { position: relative; font-size: 110px; }
  .gs-user { font-size: 52px; font-weight: 900; -webkit-text-stroke: 2px rgba(0,0,0,.65); paint-order: stroke fill; text-shadow: 0 4px 0 rgba(0,0,0,.35); }
  .gs-sent { font-weight: 900; letter-spacing: .2em; font-size: 15px; opacity: .85; }
  .gs-gift { font-size: 34px; font-weight: 900; color: var(--accent); -webkit-text-stroke: 1.5px rgba(0,0,0,.6); paint-order: stroke fill; }
  .gs-count { padding: 4px 16px; border-radius: 99px; background: var(--accent); color: #160f22; font-weight: 900; font-size: 22px; }
  .gs-spark { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); animation: gs-spark 1.2s ease-out both; }
  body[data-style="vitrina"] .gs-card { padding: 24px 40px; background: var(--bg); border-radius: calc(26px * var(--r)); border: 3px solid var(--accent); box-shadow: 0 0 40px color-mix(in srgb, var(--accent) 45%, transparent); }
  body[data-style="cine"] .gs::before { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 0 12%, rgba(0,0,0,.55) 12% 88%, transparent 88%); animation: gs-in .6s both; }
  @keyframes gs-in { 0% { opacity: 0; transform: translateY(80px) scale(.5); } 60% { opacity: 1; transform: translateY(-10px) scale(1.06); } }
  @keyframes gs-out { to { opacity: 0; transform: scale(1.2); filter: blur(6px); } }
  @keyframes gs-pulse { 50% { transform: scale(1.12); opacity: .7; } }
  @keyframes gs-float { 50% { transform: translateY(-10px) rotate(4deg); } }
  @keyframes gs-spark { to { transform: translate(var(--dx), var(--dy)) scale(.2); opacity: 0; } }
  `,
  queue: [],
  busy: false,
  render() { return '<div class="gs" data-own="1" id="gs"></div>'; },
  onEvent(e, ctx) {
    if (e.type !== 'gift') return;
    const { set } = ctx;
    if ((set.platform !== 'all' && e.platform !== set.platform) || (Number(e.amount) || 0) < (Number(set.minValue) || 0)) return;
    giftspot.queue.push(e);
    if (!giftspot.busy) giftspot.next(ctx);
  },
  next(ctx) {
    const e = giftspot.queue.shift();
    const box = document.getElementById('gs');
    if (!e || !box) { giftspot.busy = false; return; }
    giftspot.busy = true;
    const x = e.extra || {};
    const im = img(x.image);
    box.innerHTML = `<div class="gs-card"><div class="gs-glow">${im ? `<img src="${esc(im)}" alt="">` : '<span>🎁</span>'}</div><div class="gs-user">${esc(e.user?.name)}</div><div class="gs-sent">ENVIÓ</div><div class="gs-gift">${esc(x.giftName || 'un regalo')}</div>${(x.count || 1) > 1 ? `<div class="gs-count">×${x.count}</div>` : ''}${ctx.set.showValue ? `<div class="gs-sent">🪙 ${nf.format(e.amount || 0)}</div>` : ''}</div>`;
    for (let i = 0; i < 22; i += 1) {
      const sp = document.createElement('i');
      sp.className = 'gs-spark';
      const a = Math.random() * Math.PI * 2;
      const d = 120 + Math.random() * 220;
      sp.style.cssText = `left:50%;top:42%;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;animation-delay:${Math.random() * .3}s`;
      box.append(sp);
    }
    const dur = (Number(ctx.set.seconds) || 4) * 1000;
    setTimeout(() => {
      box.querySelector('.gs-card')?.classList.add('out');
      setTimeout(() => { box.innerHTML = ''; giftspot.next(ctx); }, 520);
    }, ctx.preview ? 1500 : dur);
  },
};

// ===================== Mejor regalo =====================
const bestgift = {
  css: BASE_CSS + `
  .w { display: grid; justify-items: center; }
  .b { width: 240px; display: grid; justify-items: center; gap: 6px; padding: 16px 14px 18px; text-align: center; border: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); animation: k-in .6s both; }
  .b-img { width: 130px; height: 130px; object-fit: contain; filter: drop-shadow(0 8px 18px rgba(0,0,0,.5)); }
  .b-val { font-size: 40px; font-weight: 900; color: var(--accent); }
  .b-gift { font-weight: 800; font-size: 18px; }
  .b-who { display: flex; align-items: center; gap: 6px; font-weight: 700; opacity: .9; }
  .b-who .k-av { width: 26px; height: 26px; font-size: 12px; }
  body[data-style="brillo"] .b { background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 35%, var(--bg)), var(--bg)) !important; box-shadow: 0 0 30px color-mix(in srgb, var(--accent) 50%, transparent); }
  body[data-style="minimo"] .b { background: transparent !important; border: 0; text-shadow: 0 3px 10px rgba(0,0,0,.85); }
  `,
  render({ S, set }) {
    const g = set.mode === 'streak' ? S.live?.streak : S.live?.best;
    if (!g) return '';
    const title = set.title || (set.mode === 'streak' ? 'MEJOR RACHA' : 'MEJOR REGALO');
    return `<div class="b surface" data-key="${esc(g.id)}"><span class="k-title">${esc(title)}</span>${img(g.image) ? `<img class="b-img" src="${esc(img(g.image))}" alt="">` : '<span style="font-size:90px">🎁</span>'}<span class="b-val k-num">${set.mode === 'streak' ? `×${g.count}` : `🪙 ${cmp(g.value)}`}</span><span class="b-gift">${esc(g.gift)}</span><span class="b-who">${avatar(g.user, g.avatar)}${esc(g.user)}</span></div>`;
  },
};

// ===================== Lluvia de regalos =====================
const giftrain = {
  css: `#root { padding: 0; } .w { position: fixed; inset: 0; } .gr { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .gr i { position: absolute; top: -20%; width: var(--s); height: var(--s); background: center / contain no-repeat; animation: gr-fall var(--t) linear forwards; filter: drop-shadow(0 6px 10px rgba(0,0,0,.4)); font-style: normal; font-size: calc(var(--s) * .8); display: grid; place-items: center; }
  body[data-style="burbujas"] .gr i { top: auto; bottom: -20%; animation-name: gr-rise; }
  body[data-style="confeti"] .gr i { animation-name: gr-burst; top: 50%; left: 50% !important; }
  @keyframes gr-fall { to { transform: translateY(130vh) rotate(var(--r)); } }
  @keyframes gr-rise { 0% { transform: translateY(0) scale(.6); } 100% { transform: translateY(-130vh) translateX(var(--dx)) scale(1.1); opacity: .2; } }
  @keyframes gr-burst { 0% { transform: translate(-50%, -50%) scale(.2); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--r)); opacity: 0; } }`,
  render() { return '<div class="gr" data-own="1" id="gr"></div>'; },
  onEvent(e, { set }) {
    if (e.type !== 'gift') return;
    if ((set.platform !== 'all' && e.platform !== set.platform) || (Number(e.amount) || 0) < (Number(set.minValue) || 0)) return;
    const box = document.getElementById('gr');
    if (!box) return;
    const n = Math.min(Number(set.maxPerGift) || 20, Math.max(1, Number(e.extra?.count) || 1));
    const im = img(e.extra?.image);
    for (let i = 0; i < n; i += 1) {
      const el = document.createElement('i');
      const t = 3 + Math.random() * 3;
      el.style.cssText = `--s:${set.sizePx}px;--t:${t}s;--r:${Math.round(Math.random() * 720 - 360)}deg;--dx:${Math.round(Math.random() * 900 - 450)}px;--dy:${Math.round(Math.random() * 700 - 350)}px;left:${Math.random() * 92}%;animation-delay:${(i * 0.08).toFixed(2)}s;${im ? `background-image:url('${im}')` : ''}`;
      if (!im) el.textContent = '🎁';
      box.append(el);
      setTimeout(() => el.remove(), (t + i * 0.08 + 0.3) * 1000);
    }
    while (box.children.length > 160) box.firstChild.remove();
  },
};

// ===================== Chat en pantalla =====================
const isBot = (e) => /bot$/i.test(String(e.user?.name || '').replace(/[^a-z]/gi, '')) || (e.extra?.badges || []).includes('bot');
const badges = (e) => {
  const r = e.extra?.roles || {};
  const b = new Set(e.extra?.badges || []);
  return `${r.mod || b.has('moderator') ? '<i class="ch-b mod">🛡</i>' : ''}${b.has('vip') ? '<i class="ch-b">◆</i>' : ''}${r.sub || b.has('subscriber') ? '<i class="ch-b sub">✦</i>' : ''}${r.team ? `<i class="ch-b team">♥${r.team}</i>` : ''}`;
};
const chat = {
  tick: true,
  column: 460,
  css: BASE_CSS + `
  .w { display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; }
  body.ch-top .w { justify-content: flex-start; }
  /* Los mensajes viejos se desvanecen en el borde en vez de cortarse en seco. */
  .w { -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 70px); mask-image: linear-gradient(to bottom, transparent 0, #000 70px); }
  body.ch-top .w { -webkit-mask-image: linear-gradient(to top, transparent 0, #000 70px); mask-image: linear-gradient(to top, transparent 0, #000 70px); }
  .ch { display: grid; gap: 8px; }
  .ch.top { align-content: start; }
  .ch-m { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; animation: ch-in .45s cubic-bezier(.2,1.2,.4,1) both; }
  .ch-m .k-av { width: 36px; height: 36px; font-size: 15px; }
  .ch-body { padding: 8px 12px; border-radius: calc(16px * var(--r)) !important; border-top-left-radius: 4px !important; min-width: 0; }
  .ch-name { font-weight: 900; font-size: 15px; display: flex; align-items: center; gap: 5px; }
  .ch-text { font-size: 18px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
  .emote { height: 1.6em; width: auto; max-width: 6em; vertical-align: middle; margin: -.3em 1px -.2em; object-fit: contain; }
  .emote.sticker { height: 2.2em; }
  .ch-b { font-style: normal; font-size: 11px; font-weight: 900; padding: 1px 5px; border-radius: 6px; background: color-mix(in srgb, var(--ink) 18%, transparent); }
  .ch-b.mod { background: rgba(116,209,76,.3); } .ch-b.team { background: rgba(255,77,122,.3); } .ch-b.sub { background: rgba(155,140,255,.35); }
  .ch-m.gone { animation: ch-out .5s ease-in forwards; }
  @keyframes ch-in { from { opacity: 0; transform: translateX(-30px); } }
  @keyframes ch-out { to { opacity: 0; transform: translateX(-30px); height: 0; } }
  body[data-style="clasico"] .ch-m { grid-template-columns: 1fr; } body[data-style="clasico"] .ch-m .k-av { display: none; }
  body[data-style="clasico"] .ch-body { background: transparent !important; padding: 2px 0; text-shadow: 0 2px 6px rgba(0,0,0,.9); }
  body[data-style="clasico"] .ch-name { display: inline-flex; margin-right: 6px; } body[data-style="clasico"] .ch-text { display: inline; }
  body[data-style="tarjetas"] .ch-body { border-left: 4px solid var(--accent); border-radius: calc(10px * var(--r)) !important; }
  body[data-style="minimo"] .ch-m .k-av { width: 26px; height: 26px; font-size: 11px; }
  body[data-style="minimo"] .ch-body { background: transparent !important; padding: 0; text-shadow: 0 2px 6px rgba(0,0,0,.9); }
  body[data-style="minimo"] .ch-text { font-size: 16px; }
  `,
  render({ S, set }) {
    const now = Date.now();
    let list = (S.recent || []).filter((e) => e.type === 'chat' && (set.platforms || []).includes(e.platform) && !(set.hideCommands && /^\s*!/.test(e.message || '')) && !(set.hideBots && isBot(e)));
    if (set.fadeSec > 0) list = list.filter((e) => now - (e.ts || now) < set.fadeSec * 1000);
    list = list.slice(0, set.max);
    if (set.newest === 'bottom') list.reverse();
    document.body.classList.toggle('ch-top', set.newest === 'top');
    return `<div class="ch ${set.newest === 'top' ? 'top' : ''}">${list.map((e) => `<div class="ch-m" data-key="${esc(e.id)}">${set.showAvatar ? avatar(e.user?.name, e.user?.avatar) : ''}<div class="ch-body surface"><div class="ch-name" ${e.extra?.color ? `style="color:${esc(e.extra.color)}"` : ''}>${set.showPlatform ? plat(e.platform) : ''}${set.showBadges ? badges(e) : ''}${esc(e.user?.name)}</div><div class="ch-text">${messageHtml(e)}</div></div></div>`).join('')}</div>`;
  },
};

// ===================== Mensaje en pantalla =====================
// Desde Chat en vivo (o su ventana aparte) eliges un mensaje con 📺 y sale aquí.
const spotlight = {
  css: BASE_CSS + `
  #root { padding: 0; }
  .w { width: 100%; height: 100%; }
  .sp { position: absolute; inset: 0; display: grid; place-items: center; padding: 30px; pointer-events: none; }
  body[data-pos="left"] .sp { justify-items: start; } body[data-pos="right"] .sp { justify-items: end; }
  .sp-card { --sc: var(--accent); position: relative; max-width: min(92%, 980px); display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px; align-items: center; padding: 22px 30px 24px 22px; border-radius: calc(26px * var(--r)); animation: sp-in .7s cubic-bezier(.2,1.4,.4,1) both; }
  .sp-card.out { animation: sp-out .45s ease-in both; }
  .sp-card .k-av { width: 84px; height: 84px; font-size: 34px; box-shadow: 0 0 0 4px var(--sc); }
  .sp-name { display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 26px; color: var(--sc); }
  .sp-name .k-pl { width: 24px; height: 24px; }
  .sp-text { margin-top: 4px; font-size: 34px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; color: var(--ink); }
  .sp-text .emote { height: 1.5em; width: auto; vertical-align: middle; margin: -.25em 2px; }
  .sp-text .emote.sticker { height: 2em; }
  body[data-style="tarjeta"] .sp-card { border: 3px solid var(--sc); }
  body[data-style="burbuja"] .sp-card { border-bottom-left-radius: 6px; }
  body[data-style="burbuja"] .sp-card::after { content: ''; position: absolute; left: 34px; bottom: -14px; border: 14px solid transparent; border-top-color: var(--bg); border-bottom: 0; }
  body[data-style="minimo"] .sp-card { background: transparent !important; box-shadow: none !important; }
  body[data-style="minimo"] .sp-text, body[data-style="minimo"] .sp-name { text-shadow: 0 3px 10px rgba(0,0,0,.9); }
  @keyframes sp-in { from { opacity: 0; transform: translateY(60px) scale(.85); } }
  @keyframes sp-out { to { opacity: 0; transform: translateY(-30px) scale(.95); } }
  `,
  timer: 0,
  render() { return '<div class="sp" data-own="1" id="sp"></div>'; },
  show(e, ctx) {
    const box = document.getElementById('sp');
    if (!box) return;
    clearTimeout(spotlight.timer);
    const { set } = ctx;
    const color = set.useNameColor && /^#[0-9a-f]{3,8}$/i.test(e.extra?.color || '') ? e.extra.color : '';
    box.innerHTML = `<div class="sp-card surface" ${color ? `style="--sc:${color}"` : ''}>${set.showAvatar ? avatar(e.user?.name, e.user?.avatar) : '<span></span>'}<div><div class="sp-name">${set.showPlatform ? plat(e.platform) : ''}${set.showBadges ? badges(e) : ''}${esc(e.user?.name)}</div><div class="sp-text">${messageHtml(e)}</div></div></div>`;
    const secs = ctx.preview ? 4 : Number(set.seconds) || 0;
    if (secs > 0) spotlight.timer = setTimeout(() => spotlight.hide(), secs * 1000);
  },
  hide() {
    const card = document.querySelector('#sp .sp-card');
    if (!card) return;
    card.classList.add('out');
    setTimeout(() => { if (card.isConnected) card.remove(); }, 460);
  },
  onSpot(p, ctx) {
    if (p?.clear) return spotlight.hide();
    spotlight.show(p, ctx);
  },
  // Vista previa: va mostrando mensajes de ejemplo.
  onEvent(e, ctx) {
    if (ctx.preview && e.type === 'chat') spotlight.show(e, ctx);
  },
};

// ===================== Actividad =====================
const ACT = { follow: ['♥', 'te sigue'], gift: ['🎁', 'envió'], sub: ['✦', 'se suscribió'], share: ['↗', 'compartió el directo'], superfan: ['⭐', 'es superfan'] };
const activity = {
  css: BASE_CSS + `
  .w { width: 420px; }
  .ac { display: grid; gap: 8px; padding: 12px; }
  .ac-row { display: grid; grid-template-columns: 38px 1fr auto; gap: 10px; align-items: center; animation: k-in .4s both; }
  .ac-ic { width: 38px; height: 38px; border-radius: calc(12px * var(--r)); display: grid; place-items: center; font-size: 18px; background: color-mix(in srgb, var(--accent) 22%, transparent); }
  .ac-row b { font-size: 16px; } .ac-row small { display: block; opacity: .75; font-weight: 700; }
  .ac-val { font-weight: 900; color: var(--accent); }
  body[data-shape="wide"] .w { width: 900px; } body[data-shape="wide"] .ac { grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 20px; } body[data-shape="wide"] .ac > .k-title { grid-column: 1 / -1; }
  body[data-style="tarjetas"] .ac { background: transparent !important; padding: 0; } body[data-style="tarjetas"] .ac-row { background: var(--bg); border-radius: calc(14px * var(--r)); padding: 6px 12px 6px 6px; }
  body[data-style="minimo"] .ac { background: transparent !important; text-shadow: 0 2px 6px rgba(0,0,0,.9); }
  `,
  render({ S, set }) {
    const list = (S.recent || []).filter((e) => (set.types || []).includes(e.type)).slice(0, set.count);
    if (!list.length) return '';
    return `<div class="ac surface">${set.showTitle ? `<div class="k-title">${esc(set.title)}</div>` : ''}${list.map((e) => { const [ic, txt] = ACT[e.type] || ['•', '']; return `<div class="ac-row" data-key="${esc(e.id)}"><span class="ac-ic">${ic}</span><div><b>${esc(e.user?.name)}</b><small>${txt}${e.type === 'gift' ? ` ${esc(e.extra?.giftName || '')}` : ''}</small></div>${e.type === 'gift' ? `<span class="ac-val">🪙 ${cmp(e.amount)}</span>` : '<span></span>'}</div>`; }).join('')}</div>`;
  },
};

// ===================== Cintillo =====================
const ticker = {
  tick: true,
  fluid: true,
  css: BASE_CSS + `
  .tk { display: flex; align-items: center; gap: 0; height: 56px; overflow: hidden; border: 2px solid color-mix(in srgb, var(--accent) 45%, transparent); }
  .tk-label { flex: none; height: 100%; display: grid; place-items: center; padding: 0 18px; background: var(--accent); color: #160f22; font-weight: 900; letter-spacing: .08em; }
  .tk-text { flex: 1; min-width: 0; padding: 0 20px; font-size: 22px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; animation: k-in .5s both; }
  .tk-scroll { flex: 1; overflow: hidden; }
  .tk-scroll span { display: inline-block; padding-left: 100%; white-space: nowrap; font-size: 22px; font-weight: 800; animation: tk-move var(--d) linear infinite; }
  .tk-scroll span b { color: var(--accent); margin: 0 18px; }
  @keyframes tk-move { to { transform: translateX(-100%); } }
  body[data-style="pildora"] .tk { border-radius: 999px !important; width: fit-content; max-width: 100%; margin: 0 auto; }
  body[data-style="minimo"] .tk { background: transparent !important; border: 0; text-shadow: 0 2px 8px rgba(0,0,0,.9); }
  `,
  render({ set }) {
    const lines = String(set.lines || '').split('\n').map((x) => x.trim()).filter(Boolean);
    if (!lines.length) return '';
    const label = set.label ? `<span class="tk-label">${esc(set.label)}</span>` : '';
    if (set.mode === 'scroll') {
      const text = lines.map(esc).join('<b>✦</b>');
      const d = Math.max(8, (lines.join(' ').length * 14) / (Number(set.speed) || 80));
      return `<div class="tk surface">${label}<div class="tk-scroll" data-own="1"><span style="--d:${d.toFixed(1)}s">${text}</span></div></div>`;
    }
    const i = Math.floor(Date.now() / ((Number(set.every) || 6) * 1000)) % lines.length;
    return `<div class="tk surface">${label}<span class="tk-text" data-key="l${i}">${esc(lines[i])}</span></div>`;
  },
};

// ===================== Música =====================
// Se acomoda a la forma de la fuente: tira (baja y ancha), tarjeta
// (rectángulo) o vertical (cuadrada). El título largo nunca se sale.
const nowplaying = {
  tick: true,
  css: BASE_CSS + `
  .w { width: 700px; }
  .np { position: relative; display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 18px; align-items: center; padding: 14px 22px 14px 14px; overflow: hidden; animation: k-in .5s both; }
  .np::before { content: ''; position: absolute; inset: -30%; background: var(--art) center / cover; filter: blur(38px) saturate(150%); opacity: .22; pointer-events: none; }
  .np > * { position: relative; min-width: 0; }
  .np-art { width: 100%; aspect-ratio: 1; border-radius: calc(14px * var(--r)); object-fit: cover; display: block; box-shadow: 0 10px 24px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.08); background: color-mix(in srgb, var(--accent) 25%, #1a1228); }
  .np-noart { display: grid; place-items: center; font-size: 46px; color: var(--accent); }
  .np-label { font-size: 13px; letter-spacing: .16em; font-weight: 900; color: var(--accent); display: flex; align-items: center; gap: 8px; }
  .np-eq { display: inline-flex; gap: 2px; align-items: flex-end; height: 13px; } .np-eq i { width: 3px; border-radius: 2px; background: var(--accent); animation: np-eq .9s ease-in-out infinite; } .np-eq i:nth-child(2) { animation-delay: .2s; } .np-eq i:nth-child(3) { animation-delay: .4s; }
  @keyframes np-eq { 0%, 100% { height: 3px; } 50% { height: 13px; } }
  .np-title { font-size: 27px; line-height: 1.15; font-weight: 900; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .np-meta { display: flex; gap: 10px; align-items: baseline; margin-top: 3px; font-size: 18px; font-weight: 700; min-width: 0; }
  .np-by { opacity: .82; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .np-req { flex: none; max-width: 55%; font-weight: 800; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .np-prog { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; font-size: 15px; font-weight: 800; margin-top: 10px; font-variant-numeric: tabular-nums; }
  .np-prog b { height: 7px; border-radius: 9px; background: color-mix(in srgb, var(--ink) 16%, transparent); overflow: hidden; }
  .np-prog b i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 60%, #fff), var(--accent)); box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 60%, transparent); transition: width 1s linear; }
  /* Tarjeta: más grande y el título en dos líneas. */
  body[data-shape="box"] .w { width: 660px; }
  body[data-shape="box"] .np { grid-template-columns: 196px minmax(0, 1fr); gap: 22px; padding: 18px 26px 18px 18px; }
  body[data-shape="box"] .np-title { font-size: 31px; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  body[data-shape="box"] .np-meta { flex-direction: column; gap: 2px; font-size: 19px; } body[data-shape="box"] .np-req { max-width: 100%; }
  /* Vertical: la portada arriba y el texto debajo. */
  body[data-shape="tall"] .w { width: 420px; }
  body[data-shape="tall"] .np { grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 18px; }
  body[data-shape="tall"] .np-art { aspect-ratio: 16 / 10; }
  body[data-shape="tall"] .np-title { font-size: 30px; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  body[data-shape="tall"] .np-meta { flex-direction: column; gap: 2px; } body[data-shape="tall"] .np-req { max-width: 100%; }
  body[data-style="vinilo"] .np-art { border-radius: 50%; aspect-ratio: 1; animation: np-spin 6s linear infinite; box-shadow: 0 0 0 6px #111, 0 0 0 7px #333, 0 10px 24px rgba(0,0,0,.5); }
  body[data-style="vinilo"][data-shape="tall"] .np-art { width: 70%; justify-self: center; }
  @keyframes np-spin { to { transform: rotate(360deg); } }
  body[data-style="minimo"] .np { background: transparent !important; box-shadow: none !important; border: 0; text-shadow: 0 2px 8px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.8); }
  body[data-style="minimo"] .np::before { display: none; }
  body[data-style="minimo"]:not([data-shape="tall"]) .np { grid-template-columns: 76px minmax(0, 1fr); }
  `,
  render({ S, set }) {
    const c = S.music?.current;
    const t = (ms) => `${Math.floor(ms / 60000)}:${pad((ms / 1000) % 60)}`;
    const card = ({ key, art, label, title, by, req, el, dur }) => {
      const cover = set.showCover ? (art ? `<img class="np-art" src="${esc(art)}" alt="">` : '<span class="np-art np-noart">♪</span>') : '';
      const prog = set.showProgress && dur ? `<div class="np-prog"><span>${t(Math.max(0, el))}</span><b><i style="width:${Math.max(0, Math.min(100, (el / dur) * 100)).toFixed(1)}%"></i></b><span>${t(dur)}</span></div>` : '';
      const meta = by || req ? `<div class="np-meta">${by ? `<span class="np-by">${esc(by)}</span>` : ''}${req ? `<span class="np-req">♪ ${esc(req)}</span>` : ''}</div>` : '';
      return `<div class="np surface" ${key ? `data-key="${esc(key)}"` : ''} style="${art ? `--art:url('${esc(art)}');` : ''}${set.showCover ? '' : 'grid-template-columns:minmax(0,1fr)'}">${cover}<div><div class="np-label">${label}</div><div class="np-title">${esc(title)}</div>${meta}${prog}</div></div>`;
    };
    // Sin canción pedida por YouTube: lo que suena en tu Spotify (si lo conectaste).
    const sp = S.spotify?.showInOverlay !== false ? S.spotify?.now : null;
    if (!c && sp) {
      const el = sp.playing ? Math.min(sp.durationSec * 1000, sp.progressMs + (Date.now() - sp.at)) : sp.progressMs;
      return card({ key: `sp-${sp.id}`, art: sp.thumbnail, label: sp.playing ? '<span class="np-eq"><i></i><i></i><i></i></span> SONANDO EN SPOTIFY' : '⏸ EN PAUSA', title: sp.title, by: sp.author, req: set.showRequester && sp.requester ? `Pedida por ${sp.requester}` : '', el, dur: sp.durationSec * 1000 });
    }
    if (!c) return set.hideWhenEmpty ? '' : card({ key: 'empty', art: '', label: 'MÚSICA', title: 'No suena nada', by: 'Pide la tuya con !play canción', req: '', el: 0, dur: 0 });
    const dur = (c.durationSec || 0) * 1000;
    const paused = S.music.paused;
    const el = c.startedAt ? Math.min(dur, (paused && c.pausedAt ? c.pausedAt : Date.now()) - c.startedAt - (c.pausedMs || 0)) : 0;
    return card({ key: c.id || c.videoId, art: img(c.thumbnail) || `https://i.ytimg.com/vi/${c.videoId}/mqdefault.jpg`, label: paused ? '⏸ EN PAUSA' : '<span class="np-eq"><i></i><i></i><i></i></span> SONANDO AHORA', title: c.title, by: c.author || '', req: set.showRequester && c.requester ? `Pedida por ${c.requester}` : '', el, dur });
  },
};
const queue = {
  css: BASE_CSS + `
  .w { width: 480px; }
  .q { display: grid; gap: 10px; padding: 18px; }
  .q .k-title { font-size: 14px; letter-spacing: .16em; }
  .q-row { display: grid; grid-template-columns: 26px 60px minmax(0, 1fr) auto; gap: 12px; align-items: center; animation: k-in .4s both; }
  .q-n { font-weight: 900; font-size: 18px; color: var(--accent); text-align: center; }
  .q-art { width: 60px; height: 42px; border-radius: calc(9px * var(--r)); object-fit: cover; box-shadow: 0 4px 12px rgba(0,0,0,.4); background: color-mix(in srgb, var(--accent) 25%, #1a1228); }
  .q-t { font-weight: 800; font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .q-r { font-size: 14px; font-weight: 800; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .q-d { font-weight: 800; opacity: .8; font-size: 15px; font-variant-numeric: tabular-nums; }
  .q-help { margin-top: 2px; font-weight: 700; font-size: 15px; opacity: .85; } .q-help code { font-family: 'JetBrains Mono', monospace; color: var(--accent); }
  body[data-shape="wide"] .w { width: 760px; } body[data-shape="wide"] .q { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 22px; } body[data-shape="wide"] .q .k-title, body[data-shape="wide"] .q-help { grid-column: 1 / -1; }
  body[data-style="tarjetas"] .q { background: transparent !important; box-shadow: none !important; padding: 0; } body[data-style="tarjetas"] .q-row { background: var(--bg); border-radius: calc(12px * var(--r)); padding: 8px 14px 8px 8px; box-shadow: 0 8px 20px rgba(0,0,0,.35); }
  body[data-style="minimo"] .q { background: transparent !important; box-shadow: none !important; text-shadow: 0 2px 6px rgba(0,0,0,.9); } body[data-style="minimo"] .q-art { display: none; } body[data-style="minimo"] .q-row { grid-template-columns: 26px minmax(0, 1fr) auto; }
  `,
  render({ S, set }) {
    const list = (S.music?.queue || []).slice(0, set.count);
    const t = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
    return `<div class="q surface"><div class="k-title">${esc(set.title)}</div>${list.length ? list.map((s, i) => `<div class="q-row" data-key="${esc(s.id)}"><span class="q-n">${i + 1}</span>${document.body.dataset.style === 'minimo' ? '' : `<img class="q-art" src="https://i.ytimg.com/vi/${esc(s.videoId)}/mqdefault.jpg" alt="">`}<div style="min-width:0"><div class="q-t">${esc(s.title)}</div><div class="q-r">♪ ${esc(s.requester || '')}</div></div>${set.showDuration ? `<span class="q-d">${t(s.durationSec || 0)}</span>` : '<span></span>'}</div>`).join('') : '<div class="q-help">La cola está vacía.</div>'}${set.showHelp ? '<div class="q-help">Pide la tuya con <code>!play canción</code></div>' : ''}</div>`;
  },
};

// ===================== Pantallas del directo =====================
const SCREEN = { start: ['EN DIRECTO EN', 'Empezamos ya'], brb: ['UN MOMENTO', 'Vuelvo enseguida'], end: ['GRACIAS POR ACOMPAÑARME', 'Se acabó por hoy'] };
const screens = {
  tick: true,
  css: BASE_CSS + `
  #root { padding: 0; place-items: stretch; }
  .w { position: relative; width: 100%; height: 100%; transform: none !important; display: grid; place-items: center; overflow: hidden; }
  .sc-bg { position: absolute; inset: 0; }
  body[data-style="galaxia"] .sc-bg { background: radial-gradient(1200px 700px at 30% 20%, color-mix(in srgb, var(--accent) 35%, transparent), transparent 60%), radial-gradient(900px 600px at 80% 90%, rgba(120,80,255,.35), transparent 60%), #07051a; }
  body[data-style="galaxia"] .sc-bg::after { content: ''; position: absolute; inset: 0; background-image: radial-gradient(2px 2px at 20% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 70% 60%, #fff, transparent), radial-gradient(1px 1px at 40% 80%, #fff, transparent), radial-gradient(2px 2px at 85% 20%, #fff, transparent), radial-gradient(1px 1px at 10% 70%, #fff, transparent); background-size: 400px 400px; animation: sc-stars 60s linear infinite; opacity: .8; }
  @keyframes sc-stars { to { background-position: 400px 800px; } }
  body[data-style="atardecer"] .sc-bg { background: linear-gradient(180deg, #2b1055 0%, #d6417a 55%, #ffb23e 100%); }
  body[data-style="atardecer"] .sc-bg::after { content: ''; position: absolute; left: 50%; bottom: 18%; width: 520px; height: 520px; margin-left: -260px; border-radius: 50%; background: radial-gradient(circle, #ffe08a, #ff8a3d 60%, transparent 61%); opacity: .7; }
  body[data-style="retro"] .sc-bg { background: linear-gradient(#120624 0 55%, #2a0b45 55%); }
  body[data-style="retro"] .sc-bg::after { content: ''; position: absolute; left: -50%; right: -50%; bottom: 0; height: 45%; background-image: linear-gradient(var(--accent) 2px, transparent 2px), linear-gradient(90deg, var(--accent) 2px, transparent 2px); background-size: 80px 80px; transform: perspective(500px) rotateX(60deg); transform-origin: top; opacity: .55; animation: sc-grid 2s linear infinite; }
  @keyframes sc-grid { to { background-position: 0 80px; } }
  body[data-style="limpio"] .sc-bg { background: linear-gradient(135deg, #15121f, #241d36); }
  .sc { color: #fff; position: relative; display: grid; justify-items: center; gap: 14px; text-align: center; }
  .sc-kicker { font-weight: 900; letter-spacing: .3em; font-size: 28px; color: var(--accent); }
  .sc-title { font-size: 120px; font-weight: 900; line-height: 1; text-shadow: 0 8px 30px rgba(0,0,0,.5); }
  .sc-sub { font-size: 34px; font-weight: 700; opacity: .9; }
  .sc-count { font-size: 140px; font-weight: 900; color: var(--accent); text-shadow: 0 0 40px color-mix(in srgb, var(--accent) 60%, transparent); }
  .sc-clock { color: #fff; position: absolute; top: 40px; right: 60px; font-size: 40px; font-weight: 900; opacity: .85; }
  .sc-foot { color: #fff; position: absolute; bottom: 44px; left: 0; right: 0; text-align: center; font-size: 30px; font-weight: 800; letter-spacing: .06em; opacity: .9; }
  .sc-dogs { position: absolute; bottom: 110px; display: flex; gap: 26px; align-items: flex-end; }
  .sc-dogs span { width: 210px; animation: sc-bob 3s ease-in-out infinite; } .sc-dogs span:nth-child(2) { animation-delay: .4s; } .sc-dogs span:nth-child(3) { animation-delay: .8s; width: 230px; } .sc-dogs span:nth-child(4) { animation-delay: 1.2s; width: 250px; } .sc-dogs span:nth-child(5) { animation-delay: 1.6s; width: 150px; }
  .sc-dogs svg { width: 100%; height: auto; }
  @keyframes sc-bob { 50% { transform: translateY(-14px); } }
  `,
  render({ set }) {
    const [kick, def] = SCREEN[set.screen] || SCREEN.start;
    let count = '';
    const m = String(set.countdownTo || '').match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const t = new Date();
      t.setHours(Number(m[1]), Number(m[2]), 0, 0);
      const left = t - Date.now();
      count = left > 0 ? `<div class="sc-count k-num">${hms(left, left >= 3600000)}</div>` : '';
    }
    const clock = set.showClock ? `<div class="sc-clock k-num">${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>` : '';
    const dogs = set.showGuides ? `<div class="sc-dogs" data-own="1">${['samy', 'troya'].map((g) => `<span>${mascotSVG(g)}</span>`).join('')}<span class="sc-mecha">${mechaBust()}</span>${['nono', 'juana'].map((g) => `<span>${mascotSVG(g)}</span>`).join('')}</div>` : '';
    return `<div class="sc-bg"></div>${clock}<div class="sc"><div class="sc-kicker">${esc(kick)}</div><div class="sc-title">${esc(set.title || def)}</div>${set.subtitle ? `<div class="sc-sub">${esc(set.subtitle)}</div>` : ''}${count}</div>${dogs}${set.socials ? `<div class="sc-foot">${esc(set.socials)}</div>` : ''}`;
  },
};

export const RENDER = { goals, counters, countdown, uptime, viewers, followers, ranking, mvp, lastgifts, giftspot, bestgift, giftrain, chat, spotlight, activity, ticker, nowplaying, queue, screens };

// ===================== Datos de ejemplo (vista previa) =====================
const NAMES = ['Angélica', 'Dacreth', 'Aroa Malena', 'fabiosan622', 'Adriana', 'tinvalente', 'Satronho'];
const GIFTS = [['Rosa', 1, '🌹'], ['Quiéreme', 1, '💗'], ['Rosquilla', 30, '🍩'], ['Gafas de DJ', 500, '🕶'], ['Cisne', 699, '🦢'], ['Galaxia', 1000, '🌌']];
const MSGS = ['buenas noches a todos 💜', 'qué buen directo', 'jajaja no puede ser', '!play la bicicleta', 'saludos desde Bogotá', 'vamos que se puede', 'esa jugada estuvo brutal'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let seq = 0;
export function demoState(S) {
  const t = Date.now();
  if (S) {
    for (const g of S.goals) g.current = g.current >= g.target ? Math.round(g.target * 0.2) : Math.min(g.target, g.current + Math.round(g.target * 0.13));
    S.live.viewersTotal = 1600 + Math.round(Math.random() * 90);
    S.live.follows += 1;
    S.live.likes += 120;
    for (const c of S.live.counters) if (Math.random() < 0.4) c.value += 1;
    for (const k of ['likes', 'gifts', 'chat']) S.podium[k] = S.podium[k].map((u) => ({ ...u, value: u.value + Math.round(Math.random() * 60) })).sort((a, b) => b.value - a.value);
    return S;
  }
  const people = NAMES.map((name, i) => ({ name, platform: i % 3 === 1 ? 'kick' : 'tiktok', value: (7 - i) * 900 }));
  const recent = MSGS.map((m, i) => ({ id: `d${i}`, ts: t - i * 9000, type: 'chat', platform: i % 3 === 1 ? 'kick' : i % 3 === 2 ? 'starvios' : 'tiktok', user: { name: NAMES[i % NAMES.length] }, message: m, extra: { roles: i === 1 ? { mod: true } : i === 2 ? { team: 18 } : {} } }));
  recent.push(...GIFTS.slice(0, 4).map(([g, v], i) => ({ id: `g${i}`, ts: t - i * 20000, type: i === 3 ? 'follow' : 'gift', platform: 'tiktok', user: { name: NAMES[i + 2] }, amount: v * 5, extra: { giftName: g, count: 5 } })));
  const gifts = GIFTS.map(([g, v], i) => ({ id: `lg${i}`, ts: t - i * 30000, platform: 'tiktok', user: NAMES[i], gift: g, count: (i % 3) + 1, value: v * ((i % 3) + 1), image: '' }));
  return {
    goals: [{ id: 'd1', title: 'Meta de seguidores', type: 'follow', current: 62, target: 100 }, { id: 'd2', title: 'Monedas del directo', type: 'gift', current: 3180, target: 5000 }],
    podium: { likes: people, gifts: people.map((u) => ({ ...u, value: Math.round(u.value / 20) })), chat: people.map((u) => ({ ...u, value: Math.round(u.value / 60) })) },
    live: { startedAt: t - 3 * 3600000 - 47 * 60000, viewersTotal: 1647, viewers: { tiktok: 1400, kick: 247 }, peak: 1820, follows: 17, likes: 48200, coins: 5300, gifts, best: gifts[5], streak: { ...gifts[2], count: 99 }, counters: [{ id: 'm', name: 'Muertes', icon: '💀', value: 27 }, { id: 'j', name: 'Jefes', icon: '⚔️', value: 3, goal: 5 }], countdown: { running: true, endsAt: t + 4 * 60000 + 54000, left: 0 } },
    music: { current: { id: 'c1', videoId: 'dQw4w9WgXcQ', title: 'Luces de neón', author: 'Nova Ríos', requester: 'Satronho', durationSec: 205, startedAt: t - 43000, pausedMs: 0 }, queue: [['Medianoche en ruta', 'Dacreth'], ['Fuego lento', 'Angélica'], ['Ola dorada', 'Adriana'], ['Estrella fugaz', 'tinvalente']].map(([title, r], i) => ({ id: `q${i}`, videoId: 'dQw4w9WgXcQ', title, requester: r, durationSec: 180 + i * 17 })), paused: false },
    recent,
  };
}
demoState.event = () => {
  seq += 1;
  if (seq % 2) {
    const [g, v] = pick(GIFTS);
    return { id: `de${seq}`, ts: Date.now(), type: 'gift', platform: 'tiktok', user: { name: pick(NAMES) }, amount: v * 3, extra: { giftName: g, count: 3 } };
  }
  return { id: `de${seq}`, ts: Date.now(), type: 'chat', platform: pick(['tiktok', 'kick', 'starvios']), user: { name: pick(NAMES) }, message: pick(MSGS), extra: {} };
};
