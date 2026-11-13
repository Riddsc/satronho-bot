// Ruletas (0.27): crear y editar ruletas, sus premios, cuándo giran, qué
// pasa al ganar y cómo se ven (con Samy, Troya, Ñoño o Juana mareándose en
// el centro). También el historial de tiradas y los retos pendientes.

import { $, $$, api, esc, toast, askText } from './util.js';
import { sayFor } from './guides.js';
import { mascotSVG } from './mascots.js';
import { playAlertSound } from '/overlays/sounds.js';
import { openSoundPicker, soundLabel } from './soundsUI.js';

const MASCOTS = [['samy', 'Samy'], ['troya', 'Troya'], ['nono', 'Ñoño'], ['juana', 'Juana']];
const PALETTES = {
  premio: ['Fiesta', ['#ff5d8f', '#ffb23e', '#5ab0ff', '#74d14c', '#c084fc', '#4fd1c5']],
  neon: ['Neón', ['#ff2e88', '#00e5ff', '#b6ff00', '#ff9f1c', '#9d4dff', '#00ffa3']],
  pastel: ['Pastel', ['#ffb6d9', '#ffd8a8', '#b5e8ff', '#c9f2c7', '#e3c9ff', '#fff3a8']],
  caramelo: ['Caramelo (Samy)', ['#e8901c', '#fff3e2', '#a95a2f', '#ffcf8a', '#5a2e12', '#ffb23e']],
  noche: ['Noche (Troya)', ['#2c1a5c', '#f4c95d', '#3d2a80', '#9b8cff', '#1a1036', '#ffd23e']],
  mar: ['Mar (Ñoño)', ['#0f766e', '#4fd1c5', '#134e4a', '#99f6e4', '#115e59', '#2dd4bf']],
};
const TRIG = {
  sub: { icon: '✦', name: 'Suscripción', desc: 'Alguien se suscribe o renueva' },
  reward: { icon: '🎟️', name: 'Canje de Kick', desc: 'Canjean una recompensa con puntos del canal' },
  gift: { icon: '🎁', name: 'Regalo', desc: 'Un regalo concreto (o cualquiera)' },
  coins: { icon: '🪙', name: 'Regalo por valor', desc: 'Cualquier regalo entre dos valores' },
  follow: { icon: '♥', name: 'Seguidor nuevo', desc: 'Alguien empieza a seguirte' },
  likesTotal: { icon: '👍', name: 'Likes de todos', desc: 'Cada cierto número de likes' },
  command: { icon: '💬', name: 'Comando del chat', desc: 'Alguien escribe un comando, como !ruleta' },
  share: { icon: '↗', name: 'Compartido', desc: 'Comparten tu directo (TikTok)' },
  superfan: { icon: '⭐', name: 'Superfan', desc: 'Alguien se vuelve superfan (TikTok)' },
};
const PLATS = [['any', 'Cualquiera'], ['tiktok', 'TikTok'], ['kick', 'Kick'], ['starvios', 'Starvios']];
const ACTIONS = {
  none: 'Solo mostrarlo',
  sound: '🔊 Sonar un sonido',
  say: '🗣️ Que la voz lea un texto',
  chat: '💬 Que el bot escriba en el chat',
  time: '⏱️ Sumar o restar tiempo a la cuenta regresiva',
  counter: '🔢 Sumar o restar a un contador',
  skip: '⏭️ Saltar la canción que suena',
  wheel: '🎡 Abrir otra ruleta (sub-ruleta)',
  respin: '🔁 Girar otra vez',
};
const VARS = '{usuario} {premio} {ruleta} {plataforma}';
const nf = new Intl.NumberFormat('es-CO');

let config;
let wheels = [];
let history = [];
let queueState = { queue: [] };
let draft = null; // ruleta en edición
let step = 'premios';
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const origin = () => location.origin;
let appInfo = null;
const tiktokUrl = (path) => {
  const base = appInfo?.pagesBase || 'https://riddsc.github.io/satronho-bot';
  const port = Number(appInfo?.port || location.port) || 3800;
  return `${base}/o/?p=${encodeURIComponent(path)}${port !== 3800 ? `&port=${port}` : ''}`;
};
const linkRows = (path) => `<div class="ov-links">
  <div class="ov-link"><span class="ov-link-name">OBS · Streamlabs</span><code>${esc(origin() + path)}</code><button type="button" class="btn small primary" data-wcopy="${esc(origin() + path)}">Copiar</button></div>
  <div class="ov-link tt"><span class="ov-link-name"><span class="pl plogo" data-logo="tiktok" aria-hidden="true"></span>TikTok LIVE Studio</span><code>${esc(tiktokUrl(path))}</code><button type="button" class="btn small" data-wcopy="${esc(tiktokUrl(path))}">Copiar</button></div>
</div>`;

const colorOf = (w, i) => w.prizes[i]?.color || PALETTES[w.look?.palette || 'premio']?.[1][i % 6] || '#ffb23e';
const totalWeight = (w) => w.prizes.reduce((s, p) => s + (Number(p.weight) || 0), 0) || 1;
const pct = (w, p) => Math.round(((Number(p.weight) || 0) / totalWeight(w)) * 1000) / 10;

// ---------- Guardar ----------
async function saveAll(list = wheels) {
  try {
    const r = await api('POST', '/api/wheels', { wheels: list });
    wheels = r.wheels;
    renderList();
    return true;
  } catch (e) {
    toast(`No se guardó: ${e.message}`);
    return false;
  }
}

// ---------- Lista de ruletas ----------
function miniWheel(w, size = 92) {
  const n = Math.max(1, w.prizes.length);
  const r = size / 2;
  const seg = (Math.PI * 2) / n;
  const paths = w.prizes.map((p, i) => {
    const a0 = i * seg - Math.PI / 2;
    const a1 = a0 + seg;
    const large = seg > Math.PI ? 1 : 0;
    const x0 = r + Math.cos(a0) * (r - 3), y0 = r + Math.sin(a0) * (r - 3);
    const x1 = r + Math.cos(a1) * (r - 3), y1 = r + Math.sin(a1) * (r - 3);
    return n === 1 ? `<circle cx="${r}" cy="${r}" r="${r - 3}" fill="${colorOf(w, i)}"/>` : `<path d="M${r} ${r} L${x0} ${y0} A${r - 3} ${r - 3} 0 ${large} 1 ${x1} ${y1} Z" fill="${colorOf(w, i)}" stroke="rgba(255,255,255,.6)" stroke-width="1"/>`;
  }).join('');
  const pet = w.look?.mascot === 'none' ? '' : (w.look?.mascot && w.look.mascot !== 'random' ? w.look.mascot : (w.look?.mascots?.[0] || 'samy'));
  return `<span class="wh-mini" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="#f2b33d"/>${paths}<circle cx="${r}" cy="${r}" r="${r * 0.3}" fill="#fff4d6" stroke="#a8670e" stroke-width="2"/></svg>${pet ? `<span class="wh-mini-pet">${mascotSVG(pet)}</span>` : ''}</span>`;
}

function triggerText(t) {
  const T = TRIG[t.type] || { icon: '✦', name: t.type };
  const where = t.platform && t.platform !== 'any' ? ` · ${PLATS.find((p) => p[0] === t.platform)?.[1]}` : '';
  let extra = '';
  if (t.type === 'reward') extra = t.reward ? ` «${esc(t.reward)}»` : ' (cualquiera)';
  if (t.type === 'gift') extra = t.giftNames?.length ? ` ${esc(t.giftNames.slice(0, 2).join(', '))}${t.giftNames.length > 2 ? '…' : ''}` : ' (cualquiera)';
  if (t.type === 'coins') extra = ` 🪙 ${nf.format(t.min || 0)}–${t.max ? nf.format(t.max) : '∞'}`;
  if (t.type === 'likesTotal') extra = ` cada ${nf.format(t.every || 1000)}`;
  if (t.type === 'command') extra = ` !${esc(t.command || 'ruleta')}`;
  return `<span class="wh-trig">${T.icon} ${esc(T.name)}${extra}${where}</span>`;
}

function renderList() {
  const box = $('#wh-list');
  if (!box) return;
  box.innerHTML = wheels.map((w) => `<article class="wh-card${w.enabled ? '' : ' off'}" data-wid="${esc(w.id)}">
      ${miniWheel(w)}
      <div class="wh-info">
        <b>${esc(w.name)}</b>
        <small>${w.prizes.length} premio${w.prizes.length === 1 ? '' : 's'}${w.prizes.some((p) => p.action?.type === 'wheel') ? ' · con sub-ruletas' : ''}${w.prizes.some((p) => p.reto) ? ' · con retos' : ''}</small>
        <div class="wh-trigs">${w.triggers.length ? w.triggers.map(triggerText).join('') : '<span class="wh-trig none">Solo desde el panel</span>'}</div>
      </div>
      <div class="wh-actions">
        <label class="switch" title="Encendida o apagada"><input type="checkbox" data-wtoggle ${w.enabled ? 'checked' : ''}><span></span></label>
        <button type="button" class="btn small primary" data-wspin title="Girarla ahora (sale en tu directo)">▶ Girar</button>
        <button type="button" class="btn small" data-wedit>✏️ Editar</button>
        <button type="button" class="btn small ghost" data-wdup title="Duplicar">⧉</button>
        <button type="button" class="btn small ghost danger" data-wdel title="Eliminar">✕</button>
      </div>
    </article>`).join('') || '<p class="hint">No tienes ruletas. Crea una con «＋ Nueva ruleta».</p>';
  renderQueue();
}

function renderQueue() {
  const el = $('#wh-queue');
  if (!el) return;
  const q = queueState.queue || [];
  el.innerHTML = queueState.current
    ? `<span class="wh-q-now">🎡 Girando <b>${esc(queueState.current.wheelName)}</b> · ${esc(queueState.current.user)}</span>${q.length ? `<span class="wh-q-n">${q.length} en fila</span>` : ''}`
    : q.length ? `<span class="wh-q-n">${q.length} en fila</span>` : '<span class="hint" style="margin:0">Nada girando ahora.</span>';
}

// ---------- Historial y retos ----------
const PLAT_NAME = { tiktok: 'TikTok', kick: 'Kick', starvios: 'Starvios', twitch: 'Twitch', panel: 'Panel' };
function renderHistory() {
  const pend = history.filter((h) => h.reto && !h.done);
  $('#wh-pending').innerHTML = pend.length
    ? pend.map((h) => `<li><span class="wh-h-emo">${esc(h.emoji || '🎯')}</span><div><b>${esc(h.prize)}</b><small>${esc(h.user)} · ${esc(h.wheel)} · ${new Date(h.ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</small></div><button type="button" class="btn small primary" data-hdone="${esc(h.id)}">✓ Cumplido</button></li>`).join('')
    : '<li class="empty">No tienes retos pendientes. 🎉</li>';
  $('#wh-history').innerHTML = history.length
    ? history.slice(0, 100).map((h) => `<li class="${h.reto ? (h.done ? 'done' : 'reto') : ''}"><time>${new Date(h.ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</time><span class="wh-h-emo">${esc(h.emoji || '🎡')}</span><div><b>${esc(h.prize)}</b><small>${h.depth ? '↳ ' : ''}${esc(h.wheel)} · ${esc(h.user)}${h.platform ? ` · ${esc(PLAT_NAME[h.platform] || h.platform)}` : ''}${h.reason ? ` · ${esc(h.reason)}` : ''}</small></div>${h.reto ? `<button type="button" class="btn small ghost" data-hdone="${esc(h.id)}" data-undo="${h.done ? '1' : ''}">${h.done ? '↺ Pendiente' : '✓ Cumplido'}</button>` : ''}</li>`).join('')
    : '<li class="empty">Aún no ha girado ninguna ruleta.</li>';
  const n = pend.length;
  const badge = $('#nav-wheels');
  if (badge) { badge.hidden = !n; badge.textContent = String(n); }
}

// ---------- Editor ----------
function openEditor(w) {
  draft = JSON.parse(JSON.stringify(w));
  step = 'premios';
  $('#wh-modal-title').textContent = wheels.some((x) => x.id === draft.id) ? `Editar «${draft.name}»` : 'Nueva ruleta';
  $('#wh-modal').hidden = false;
  renderEditor();
  sendPreview();
}
function closeEditor() {
  $('#wh-modal').hidden = true;
  draft = null;
}

function prizeRow(p, i) {
  const a = p.action || { type: 'none' };
  const others = wheels.filter((w) => w.id !== draft.id);
  let actionFields = '';
  if (a.type === 'sound') actionFields = `<button type="button" class="btn small" data-pa="pickSound">🔊 ${esc(soundLabel(a.sound || 'campanita'))}</button><label class="wh-mini-f">Vol. <input type="range" min="0" max="100" step="5" data-pa="volume" value="${a.volume ?? 75}"></label>`;
  if (a.type === 'say' || a.type === 'chat') actionFields = `<input class="wh-wide" data-pa="text" maxlength="300" placeholder="${a.type === 'say' ? '¡{usuario} ganó {premio}!' : '🎉 {usuario} ganó {premio}'}" value="${esc(a.text || '')}"><small class="hint">Variables: ${VARS}</small>`;
  if (a.type === 'time') actionFields = `<label class="wh-mini-f">Segundos <input type="number" class="num" data-pa="seconds" value="${a.seconds ?? 60}" step="10"></label><small class="hint">Negativo resta tiempo. Usa la cuenta regresiva de Overlays.</small>`;
  if (a.type === 'counter') {
    const cs = config.counters || [];
    actionFields = cs.length
      ? `<select data-pa="counter">${cs.map((c) => `<option value="${esc(c.id)}" ${c.id === a.counter ? 'selected' : ''}>${esc(c.icon || '')} ${esc(c.name)}</option>`).join('')}</select><label class="wh-mini-f">Cuánto <input type="number" class="num" data-pa="delta" value="${a.delta ?? 1}"></label>`
      : '<small class="hint">Primero crea un contador en Overlays → Contadores.</small>';
  }
  if (a.type === 'wheel') {
    actionFields = others.length
      ? `<select data-pa="wheel"><option value="">Elige la ruleta…</option>${others.map((w) => `<option value="${esc(w.id)}" ${w.id === a.wheel ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select><button type="button" class="btn small ghost" data-newsub>＋ Crear una nueva</button>`
      : '<button type="button" class="btn small" data-newsub>＋ Crear la sub-ruleta</button><small class="hint">Se guarda esta y se abre la nueva para llenarla.</small>';
  }
  return `<li class="wh-prize" data-pi="${i}" style="--pc:${colorOf(draft, i)}">
    <div class="wh-p-main">
      <span class="wh-p-handle" title="Orden"><button type="button" data-pmove="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">▲</button><button type="button" data-pmove="1" ${i === draft.prizes.length - 1 ? 'disabled' : ''} aria-label="Bajar">▼</button></span>
      <input type="color" data-pf="color" value="${esc(colorOf(draft, i))}" title="Color de la casilla">
      <input class="wh-emoji" data-pf="emoji" maxlength="8" value="${esc(p.emoji || '')}" placeholder="🎁" title="Emoji">
      <input class="wh-label" data-pf="label" maxlength="60" value="${esc(p.label)}" placeholder="Nombre del premio">
      <label class="wh-weight" title="Peso: más peso = más probable"><span>Peso</span><input type="number" class="num" min="0" max="1000" data-pf="weight" value="${p.weight ?? 1}"><small>${pct(draft, p)}%</small></label>
      <button type="button" class="btn small ghost danger" data-pdel aria-label="Quitar premio">✕</button>
    </div>
    <div class="wh-p-more">
      <select data-pa="type">${Object.entries(ACTIONS).map(([k, n]) => `<option value="${k}" ${k === a.type ? 'selected' : ''}>${n}</option>`).join('')}</select>
      ${actionFields}
      <label class="chip-check" title="Queda en la lista de retos pendientes hasta que lo tachas"><input type="checkbox" data-pf="reto" ${p.reto ? 'checked' : ''}><span>🎯 Es un reto</span></label>
      <label class="wh-mini-f" title="Cuántas veces puede salir por directo (0 = sin límite)">Máx. por directo <input type="number" class="num" min="0" max="999" data-pf="limit" value="${p.limit || 0}"></label>
    </div>
  </li>`;
}

function triggerRow(t, i) {
  const T = TRIG[t.type];
  let fields = '';
  if (t.type === 'reward') fields = `<input class="wh-wide" data-tf="reward" maxlength="80" value="${esc(t.reward || '')}" placeholder="Nombre exacto de la recompensa (vacío = cualquiera)">`;
  if (t.type === 'gift') fields = `<input class="wh-wide" list="dl-gifts" data-tf="giftNames" value="${esc((t.giftNames || []).join(', '))}" placeholder="Nombre del regalo, o varios separados por coma (vacío = cualquiera)"><label class="chip-check" title="Un combo de 5 rosas = 5 tiradas (máx. 10)"><input type="checkbox" data-tf="perUnit" ${t.perUnit ? 'checked' : ''}><span>Una tirada por cada regalo del combo</span></label>`;
  if (t.type === 'coins') fields = `<label class="wh-mini-f">Desde 🪙 <input type="number" class="num" min="0" data-tf="min" value="${t.min ?? 1}"></label><label class="wh-mini-f">hasta <input type="number" class="num" min="0" data-tf="max" value="${t.max ?? ''}" placeholder="∞"></label>`;
  if (t.type === 'likesTotal') fields = `<label class="wh-mini-f">Cada <input type="number" class="num" min="1" data-tf="every" value="${t.every ?? 1000}"> likes</label>`;
  if (t.type === 'command') fields = `<label class="wh-mini-f">! <input class="num" style="width:120px" data-tf="command" maxlength="30" value="${esc(t.command || 'ruleta')}"></label><select data-tf="who"><option value="all" ${t.who === 'all' ? 'selected' : ''}>Cualquiera</option><option value="subs" ${t.who === 'subs' ? 'selected' : ''}>Suscriptores, VIP y mods</option><option value="mods" ${t.who === 'mods' ? 'selected' : ''}>Solo tú y tus mods</option></select>`;
  return `<li class="wh-tr" data-ti="${i}">
    <span class="wh-tr-ic">${T.icon}</span>
    <div class="wh-tr-body">
      <div class="wh-tr-top"><select data-tf="type">${Object.entries(TRIG).map(([k, x]) => `<option value="${k}" ${k === t.type ? 'selected' : ''}>${x.name}</option>`).join('')}</select>
        <select data-tf="platform">${PLATS.map(([k, n]) => `<option value="${k}" ${k === (t.platform || 'any') ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <button type="button" class="btn small ghost danger" data-tdel aria-label="Quitar">✕</button></div>
      <small class="hint" style="margin:0">${esc(T.desc)}</small>
      <div class="wh-tr-f">${fields}<label class="wh-mini-f" title="Para que una misma persona no la gire seguido">Espera por persona <input type="number" class="num" min="0" data-tf="userCooldownSec" value="${t.userCooldownSec || 0}"> s</label></div>
    </div></li>`;
}

function renderEditor() {
  if (!draft) return;
  for (const b of $$('[data-wstep]')) b.setAttribute('aria-pressed', String(b.dataset.wstep === step));
  const body = $('#wh-step');
  const L = draft.look;
  if (step === 'premios') {
    body.innerHTML = `<label class="field-label" for="wh-name">Nombre de la ruleta</label>
      <input id="wh-name" class="wh-name" maxlength="60" value="${esc(draft.name)}">
      <div class="row space wh-sub"><h4>Premios <small>${draft.prizes.length}/40</small></h4><span class="hint" style="margin:0">El <b>peso</b> decide qué tan probable es cada uno. En pantalla todas las casillas miden igual.</span></div>
      <ol class="wh-prizes">${draft.prizes.map(prizeRow).join('')}</ol>
      <button type="button" class="btn" id="wh-padd" ${draft.prizes.length >= 40 ? 'disabled' : ''}>＋ Agregar premio</button>`;
  } else if (step === 'cuando') {
    body.innerHTML = `<p class="hint">Elige qué hace girar esta ruleta. Puede tener varias formas a la vez (por ejemplo, <b>suscripción</b> en Kick y un <b>canje</b> de la tienda). Cada tirada hace fila y sale de una en una.</p>
      <ol class="wh-trs">${draft.triggers.map(triggerRow).join('')}</ol>
      <div class="wh-addtrig">${Object.entries(TRIG).map(([k, x]) => `<button type="button" class="btn small" data-tadd="${k}">${x.icon} ${esc(x.name)}</button>`).join('')}</div>
      <p class="hint">También la puedes girar tú cuando quieras con <b>▶ Girar</b> en la lista. Una ruleta sin nada aquí solo gira desde el panel o como sub-ruleta.</p>`;
  } else if (step === 'aspecto') {
    body.innerHTML = `<span class="field-label">Mascota en el centro (gira con la ruleta y se marea)</span>
      <div class="seg wh-seg"><button type="button" data-lmode="random" aria-pressed="${L.mascot === 'random'}">🎲 Al azar</button>${MASCOTS.map(([id, n]) => `<button type="button" data-lmode="${id}" aria-pressed="${L.mascot === id}">${n}</button>`).join('')}<button type="button" data-lmode="none" aria-pressed="${L.mascot === 'none'}">Ninguna</button></div>
      ${L.mascot === 'random' ? `<div class="wh-pets">${MASCOTS.map(([id, n]) => `<label class="wh-pet${L.mascots.includes(id) ? ' on' : ''}"><input type="checkbox" data-lpet="${id}" ${L.mascots.includes(id) ? 'checked' : ''}>${mascotSVG(id, n)}<span>${n}</span></label>`).join('')}</div><p class="hint">Sale una de las marcadas, al azar, en cada tirada.</p>` : ''}
      <span class="field-label">Colores</span>
      <div class="wh-pals">${Object.entries(PALETTES).map(([k, [n, cs]]) => `<button type="button" class="wh-pal" data-lpal="${k}" aria-pressed="${L.palette === k}"><span>${cs.map((c) => `<i style="background:${c}"></i>`).join('')}</span>${esc(n)}</button>`).join('')}</div>
      <p class="hint">El color que le pongas a un premio manda sobre la paleta. <button type="button" class="btn small ghost" id="wh-clearcolors">Usar solo la paleta</button></p>
      <div class="wh-grid2">
        <label><span class="field-label">Cuánto gira</span><input type="range" min="3" max="20" step="1" data-lnum="spinSeconds" value="${L.spinSeconds}"><b>${L.spinSeconds} s</b></label>
        <label><span class="field-label">Premio en pantalla</span><input type="range" min="1" max="30" step="1" data-lnum="showSeconds" value="${L.showSeconds}"><b>${L.showSeconds} s</b></label>
        <label><span class="field-label">Volumen</span><input type="range" min="0" max="100" step="5" data-lnum="volume" value="${L.volume}"><b>${L.volume}%</b></label>
        <div><span class="field-label">Sonido del premio</span><button type="button" class="btn small" id="wh-winsound">🔊 ${esc(L.winSound === 'none' ? 'Sin sonido' : soundLabel(L.winSound || 'fanfarria'))}</button> <button type="button" class="btn small ghost" id="wh-nosound">Sin sonido</button></div>
      </div>
      <label class="switch"><input type="checkbox" data-lbool="ticks" ${L.ticks ? 'checked' : ''}><span></span> Clic de las clavijas al girar</label>
      <label class="switch"><input type="checkbox" data-lbool="title" ${L.title ? 'checked' : ''}><span></span> Mostrar el nombre de la ruleta y quién la gira</label>`;
  } else if (step === 'anuncio') {
    const A = draft.announce;
    body.innerHTML = `<p class="hint">Además de salir en pantalla, el resultado se puede anunciar.</p>
      <label class="switch"><input type="checkbox" data-abool="chat" ${A.chat ? 'checked' : ''}><span></span> Satronho Bot lo escribe en el chat (donde se giró)</label>
      <label class="switch"><input type="checkbox" data-abool="speak" ${A.speak ? 'checked' : ''}><span></span> La voz lo lee en voz alta</label>
      <label class="field-label" for="wh-atext">Texto del anuncio</label>
      <input id="wh-atext" class="wh-wide" maxlength="300" value="${esc(A.text)}">
      <p class="hint">Variables: ${VARS}. Si el premio abre otra ruleta, esa también se anuncia sola.</p>
      <span class="field-label">En tu directo</span>
      <p class="hint">Pon el overlay de ruletas en OBS (720 × 860). Muestra todas tus ruletas; si quieres una fuente solo para esta, usa este enlace:</p>
      ${linkRows(`/overlays/wheel.html?wheel=${encodeURIComponent(draft.id)}`)}`;
  }
  renderOdds();
}

function renderOdds() {
  const box = $('#wh-odds');
  if (!box || !draft) return;
  box.innerHTML = draft.prizes.length
    ? `<b>Probabilidades</b>${draft.prizes.map((p, i) => `<span><i style="background:${colorOf(draft, i)}"></i>${esc(p.emoji || '')} ${esc(p.label || '—')}<em>${pct(draft, p)}%</em></span>`).join('')}`
    : '<span class="hint">Agrega premios para ver la ruleta.</span>';
}

// Vista previa: el overlay real, recibe la ruleta en edición.
function sendPreview(spin = false) {
  const f = $('#wh-prev');
  if (!f || !draft) return;
  const send = () => {
    f.contentWindow?.postMessage({ satronhoWheel: JSON.parse(JSON.stringify(draft)) }, location.origin);
    if (spin) f.contentWindow?.postMessage({ satronhoWheelSpin: true, sound: $('#wh-prev-sound')?.checked }, location.origin);
  };
  if (!f.src.includes('wheel.html')) {
    f.src = '/overlays/wheel.html?preview=1&demo=0';
    f.addEventListener('load', () => setTimeout(send, 150), { once: true });
  } else send();
}
let previewTimer = null;
const refreshPreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(() => { sendPreview(); renderOdds(); }, 180); };

function prizeOf(el) { return draft.prizes[Number(el.closest('[data-pi]')?.dataset.pi)]; }
function trigOf(el) { return draft.triggers[Number(el.closest('[data-ti]')?.dataset.ti)]; }

function onEditorInput(ev) {
  const t = ev.target;
  if (t.id === 'wh-name') { draft.name = t.value; return refreshPreview(); }
  if (t.id === 'wh-atext') { draft.announce.text = t.value; return; }
  if (t.dataset.pf) {
    const p = prizeOf(t);
    const k = t.dataset.pf;
    if (k === 'reto') p.reto = t.checked;
    else if (k === 'weight' || k === 'limit') p[k] = Math.max(0, Number(t.value) || 0);
    else p[k] = t.value;
    if (k === 'weight') { for (const [i, el] of $$('.wh-weight small').entries()) el.textContent = `${pct(draft, draft.prizes[i])}%`; }
    if (k === 'color') t.closest('.wh-prize').style.setProperty('--pc', t.value);
    return refreshPreview();
  }
  if (t.dataset.pa) {
    const p = prizeOf(t);
    p.action ||= { type: 'none' };
    const k = t.dataset.pa;
    if (k === 'type') { p.action = { type: t.value }; if (t.value === 'sound') p.action.sound = 'campanita'; return renderEditor(); }
    p.action[k] = ['volume', 'seconds', 'delta'].includes(k) ? Number(t.value) || 0 : t.value;
    return;
  }
  if (t.dataset.tf) {
    const tr = trigOf(t);
    const k = t.dataset.tf;
    if (k === 'type') { const i = draft.triggers.indexOf(tr); draft.triggers[i] = { id: tr.id, type: t.value, platform: tr.platform || 'any' }; return renderEditor(); }
    if (k === 'perUnit') tr.perUnit = t.checked;
    else if (k === 'giftNames') tr.giftNames = t.value.split(',').map((x) => x.trim()).filter(Boolean);
    else if (['min', 'every', 'userCooldownSec'].includes(k)) tr[k] = Number(t.value) || 0;
    else if (k === 'max') tr.max = t.value === '' ? '' : Number(t.value) || 0;
    else tr[k] = t.value;
    return;
  }
  if (t.dataset.lnum) { draft.look[t.dataset.lnum] = Number(t.value); t.nextElementSibling.textContent = t.dataset.lnum === 'volume' ? `${t.value}%` : `${t.value} s`; return refreshPreview(); }
  if (t.dataset.lbool) { draft.look[t.dataset.lbool] = t.checked; return refreshPreview(); }
  if (t.dataset.abool) { draft.announce[t.dataset.abool] = t.checked; return; }
  if (t.dataset.lpet) {
    const set = new Set(draft.look.mascots);
    if (t.checked) set.add(t.dataset.lpet); else set.delete(t.dataset.lpet);
    if (!set.size) { t.checked = true; return toast('Deja al menos una mascota, o elige «Ninguna»'); }
    draft.look.mascots = MASCOTS.map(([id]) => id).filter((id) => set.has(id));
    t.closest('.wh-pet').classList.toggle('on', t.checked);
    return refreshPreview();
  }
}

async function onEditorClick(ev) {
  const t = ev.target;
  const st = t.closest('[data-wstep]');
  if (st) { step = st.dataset.wstep; return renderEditor(); }
  if (t.id === 'wh-padd') {
    draft.prizes.push({ id: uid('p'), label: `Premio ${draft.prizes.length + 1}`, emoji: '', color: '', weight: 1, limit: 0, reto: false, action: { type: 'none' } });
    renderEditor(); refreshPreview();
    return $$('.wh-label').pop()?.select();
  }
  if (t.closest('[data-pdel]')) {
    if (draft.prizes.length <= 2) return toast('Una ruleta necesita al menos 2 premios');
    draft.prizes.splice(Number(t.closest('[data-pi]').dataset.pi), 1);
    renderEditor(); return refreshPreview();
  }
  const mv = t.closest('[data-pmove]');
  if (mv) {
    const i = Number(mv.closest('[data-pi]').dataset.pi);
    const j = i + Number(mv.dataset.pmove);
    if (j < 0 || j >= draft.prizes.length) return;
    [draft.prizes[i], draft.prizes[j]] = [draft.prizes[j], draft.prizes[i]];
    renderEditor(); return refreshPreview();
  }
  if (t.closest('[data-pa="pickSound"]')) {
    const p = prizeOf(t);
    return openSoundPicker(p.action.sound, (ref) => { p.action.sound = ref; playAlertSound({ sound: ref, volume: p.action.volume ?? 75, maxSeconds: 6 }); renderEditor(); });
  }
  if (t.closest('[data-newsub]')) {
    const p = prizeOf(t);
    const name = await askText('Nombre de la sub-ruleta', `${p.label || 'Sub-ruleta'}`, 'Crear');
    if (!name) return;
    const sub = await newWheel(name, false);
    p.action = { type: 'wheel', wheel: sub.id };
    if (!p.label || /^Premio \d+$/.test(p.label)) p.label = name;
    // Se guarda la actual (con el premio apuntando) y la nueva, y se abre la nueva.
    const list = [...wheels.filter((w) => w.id !== draft.id), draft, sub];
    if (await saveAll(list)) {
      sayFor('troya', `Creé «${esc(sub.name)}». Ponle sus premios: cuando caiga «${esc(p.label)}», se abre esta.`, 8000, 'ok');
      openEditor(wheels.find((w) => w.id === sub.id));
    }
    return;
  }
  const ta = t.closest('[data-tadd]');
  if (ta) { draft.triggers.push({ id: uid('t'), type: ta.dataset.tadd, platform: ta.dataset.tadd === 'reward' ? 'kick' : 'any', ...(ta.dataset.tadd === 'command' ? { command: 'ruleta', who: 'all', userCooldownSec: 30 } : {}) }); return renderEditor(); }
  if (t.closest('[data-tdel]')) { draft.triggers.splice(Number(t.closest('[data-ti]').dataset.ti), 1); return renderEditor(); }
  const lm = t.closest('[data-lmode]');
  if (lm) { draft.look.mascot = lm.dataset.lmode; if (!draft.look.mascots?.length) draft.look.mascots = MASCOTS.map(([id]) => id); renderEditor(); return refreshPreview(); }
  const lp = t.closest('[data-lpal]');
  if (lp) { draft.look.palette = lp.dataset.lpal; renderEditor(); return refreshPreview(); }
  if (t.id === 'wh-clearcolors') { for (const p of draft.prizes) p.color = ''; toast('Ahora todos los premios usan la paleta'); return refreshPreview(); }
  if (t.closest('#wh-winsound')) return openSoundPicker(draft.look.winSound, (ref) => { draft.look.winSound = ref; playAlertSound({ sound: ref, volume: draft.look.volume, maxSeconds: 6 }); renderEditor(); });
  if (t.id === 'wh-nosound') { draft.look.winSound = 'none'; return renderEditor(); }
  const cp = t.closest('[data-wcopy]');
  if (cp) return copy(cp.dataset.wcopy);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Enlace copiado'); } catch { toast('No se pudo copiar'); }
}

async function newWheel(name, open = true) {
  const { wheel } = await api('GET', '/api/wheels/new');
  wheel.name = name || wheel.name;
  wheel.triggers = [];
  wheel.prizes = wheel.prizes.slice(0, 4).map((p, i) => ({ ...p, label: `Premio ${i + 1}`, emoji: '', action: { type: 'none' }, reto: false, color: '' }));
  if (open) openEditor(wheel);
  return wheel;
}

async function saveDraft() {
  if (!draft) return;
  if (draft.prizes.length < 2) { step = 'premios'; renderEditor(); return toast('Una ruleta necesita al menos 2 premios'); }
  if (draft.prizes.some((p) => !String(p.label).trim())) { step = 'premios'; renderEditor(); return toast('A un premio le falta el nombre'); }
  const broken = draft.prizes.find((p) => p.action?.type === 'wheel' && !p.action.wheel);
  if (broken) { step = 'premios'; renderEditor(); return toast(`Elige qué ruleta abre «${broken.label}»`); }
  if (!draft.prizes.some((p) => p.weight > 0)) return toast('Al menos un premio debe tener peso mayor que 0');
  const exists = wheels.some((w) => w.id === draft.id);
  const list = exists ? wheels.map((w) => (w.id === draft.id ? draft : w)) : [...wheels, draft];
  const name = draft.name;
  if (await saveAll(list)) {
    closeEditor();
    sayFor('troya', exists ? `Guardé «${esc(name)}».` : `¡Lista «${esc(name)}»! Pruébala con ▶ Girar.`, 6000, 'ok');
  }
}

// ---------- Acciones de la lista ----------
async function onListClick(ev) {
  const card = ev.target.closest('[data-wid]');
  if (!card) return;
  const w = wheels.find((x) => x.id === card.dataset.wid);
  if (!w) return;
  if (ev.target.closest('[data-wedit]')) return openEditor(w);
  if (ev.target.closest('[data-wspin]')) {
    try { await api('POST', `/api/wheels/${encodeURIComponent(w.id)}/spin`, { user: config.profile?.name || 'Tú' }); toast(`🎡 Girando «${w.name}»`); } catch (e) { toast(e.message); }
    return;
  }
  if (ev.target.closest('[data-wdup]')) {
    const copyW = JSON.parse(JSON.stringify(w));
    copyW.id = uid('w');
    copyW.name = `${w.name} (copia)`;
    copyW.triggers = [];
    return saveAll([...wheels, copyW]);
  }
  if (ev.target.closest('[data-wdel]')) {
    const users = wheels.filter((x) => x.prizes.some((p) => p.action?.type === 'wheel' && p.action.wheel === w.id));
    const extra = users.length ? `\n\nOjo: ${users.map((x) => `«${x.name}»`).join(', ')} la abre como sub-ruleta; esos premios quedarán sin ruleta.` : '';
    if (!confirm(`¿Eliminar la ruleta «${w.name}»?${extra}`)) return;
    return saveAll(wheels.filter((x) => x.id !== w.id));
  }
}
function onListChange(ev) {
  const t = ev.target.closest('[data-wtoggle]');
  if (!t) return;
  const w = wheels.find((x) => x.id === t.closest('[data-wid]').dataset.wid);
  w.enabled = t.checked;
  saveAll();
}

async function reload() {
  try {
    const r = await api('GET', '/api/wheels');
    wheels = r.wheels;
    history = r.history || [];
    renderList();
    renderHistory();
  } catch { /* sin servidor: se reintenta al reconectar */ }
}

// ---------- Desde el servidor ----------
export function onWheels(list) { wheels = list || []; renderList(); }
export function onWheelQueue(q) { queueState = q || { queue: [] }; renderQueue(); }
export function onWheelHistory(h) { history = h || []; renderHistory(); }
export function onWheelLanded(p) {
  if (!p?.entry) return;
  history = [p.entry, ...history.filter((x) => x.id !== p.entry.id)].slice(0, 300);
  renderHistory();
}
export function onWheelNotice(p) { if (p?.text) sayFor('troya', esc(p.text), 7000, 'warn'); }

export function initWheels(cfg) {
  config = cfg;
  fetch('/api/state').then((r) => r.json()).then((d) => { appInfo = d.app || null; }).catch(() => {});
  $('#wh-links').innerHTML = linkRows('/overlays/wheel.html');
  $('#wh-new').addEventListener('click', async () => {
    const name = await askText('Nombre de la ruleta', 'Ruleta nueva', 'Crear');
    if (name) newWheel(name);
  });
  $('#wh-list').addEventListener('click', onListClick);
  $('#wh-list').addEventListener('change', onListChange);
  $('#page-ruletas').addEventListener('click', (ev) => {
    const c = ev.target.closest('[data-wcopy]');
    if (c && !ev.target.closest('#wh-modal')) copy(c.dataset.wcopy);
  });
  $('#wh-skip').addEventListener('click', () => api('POST', '/api/wheels/control', { action: 'skip' }).catch((e) => toast(e.message)));
  $('#wh-clear').addEventListener('click', () => api('POST', '/api/wheels/control', { action: 'clear' }).catch((e) => toast(e.message)));
  $('#wh-reset').addEventListener('click', () => api('POST', '/api/wheels/control', { action: 'reset-limits' }).then(() => toast('Los premios agotados vuelven a estar disponibles')).catch((e) => toast(e.message)));
  $('#wh-hclear').addEventListener('click', async () => {
    if (!confirm('¿Borrar todo el historial de tiradas (también los retos pendientes)?')) return;
    try { await api('DELETE', '/api/wheels/history'); history = []; renderHistory(); } catch (e) { toast(e.message); }
  });
  $('#page-ruletas').addEventListener('click', async (ev) => {
    const d = ev.target.closest('[data-hdone]');
    if (!d) return;
    try { await api('POST', `/api/wheels/history/${encodeURIComponent(d.dataset.hdone)}`, { done: !d.dataset.undo }); } catch (e) { toast(e.message); }
  });

  const modal = $('#wh-modal');
  modal.addEventListener('input', (ev) => { if (!ev.target.matches('select, input[type="checkbox"], input[type="color"]')) onEditorInput(ev); });
  modal.addEventListener('change', (ev) => { if (ev.target.matches('select, input[type="checkbox"], input[type="color"]')) onEditorInput(ev); });
  modal.addEventListener('click', onEditorClick);
  modal.addEventListener('click', (ev) => { if (ev.target === modal) closeEditor(); });
  modal.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeEditor(); });
  $('#wh-close').addEventListener('click', closeEditor);
  $('#wh-cancel').addEventListener('click', closeEditor);
  $('#wh-save').addEventListener('click', saveDraft);
  $('#wh-prev-spin').addEventListener('click', () => sendPreview(true));
  reload();
}
