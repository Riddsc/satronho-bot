// Ñoño: el DJ. Consola de música: sonando ahora (con el reproductor
// oficial de YouTube incrustado), buscar y añadir, cola e historial,
// listas de reproducción y actividad. Solo una ventana reproduce a la vez.

import { $, $$, api, esc, saveConfig, toast, timeOf, PLATFORM_NAMES } from './util.js';
import { setBubble, sayFor, setMood, guideToast } from './guides.js';

let config;
let state = { current: null, queue: [], history: [], playlists: [], paused: false, volume: 60, enabled: true, playerId: null };
let myId = null;
let send = () => {};
let player = null;
let playerReady = false;
let loadedId = null;
let results = [];
let activity = [];
let qTab = 'next';

const fmt = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');
const isPlayer = () => state.playerId && state.playerId === myId;
const fromWho = (s) => (s.platform === 'panel' ? s.requester : `${s.requester} · ${PLATFORM_NAMES[s.platform] || s.platform}`);

// ---------- Reproductor de YouTube ----------
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('No se pudo cargar el reproductor de YouTube. Revisa tu internet.'));
    document.head.appendChild(s);
  });
}

async function createPlayer() {
  try {
    await loadYouTubeApi();
  } catch (e) {
    $('#player-note').textContent = e.message;
    return;
  }
  player = new YT.Player('yt-player', {
    width: '100%',
    height: '100%',
    playerVars: { autoplay: 1, rel: 0, playsinline: 1, modestbranding: 1, origin: location.origin },
    events: {
      onReady: () => {
        playerReady = true;
        sync();
      },
      onStateChange: (ev) => {
        if (ev.data === YT.PlayerState.ENDED && state.current) api('POST', '/api/music/ended', { id: state.current.id }).catch(() => {});
      },
      onError: (ev) => {
        if (state.current) api('POST', '/api/music/error', { id: state.current.id, code: ev.data }).catch(() => {});
      },
    },
  });
}

function sync() {
  const note = $('#player-note');
  if (!isPlayer()) {
    if (playerReady) player.stopVideo();
    loadedId = null;
    note.innerHTML = state.playerId
      ? 'La música suena en otra ventana. <button class="btn small" id="play-here">Reproducir aquí</button>'
      : '<button class="btn small" id="play-here">Reproducir aquí</button>';
    return;
  }
  note.textContent = '';
  if (!playerReady) return;
  player.setVolume(state.volume);
  const id = state.current?.videoId || null;
  if (id !== loadedId) {
    loadedId = id;
    if (id) player.loadVideoById(id);
    else player.stopVideo();
  }
  if (id) {
    const ps = player.getPlayerState?.();
    if (state.paused && ps === YT.PlayerState.PLAYING) player.pauseVideo();
    if (!state.paused && ps === YT.PlayerState.PAUSED) player.playVideo();
  }
}

// Barra de progreso (solo en la ventana que reproduce).
function tickProgress() {
  const c = state.current;
  const dur = c?.durationSec || 0;
  let t = 0;
  if (c && playerReady && isPlayer()) t = Math.max(0, player.getCurrentTime?.() || 0);
  $('#mz-time').textContent = c ? fmt(t) || '0:00' : '0:00';
  $('#mz-dur').textContent = c ? fmt(dur) : '0:00';
  $('#mz-bar').style.width = dur ? `${Math.min(100, (t / dur) * 100)}%` : '0%';
}

// ---------- Interfaz ----------
function renderNow() {
  const c = state.current;
  $('#now').innerHTML = c
    ? `${c.thumbnail ? `<img src="${esc(c.thumbnail)}" alt="">` : ''}<div><small class="mz-label">Sonando ahora</small><b>${esc(c.title)}</b><small>${esc(c.author || '')}</small><span class="mz-who">Pedida por <b>${esc(fromWho(c))}</b></span></div>`
    : '<div class="mz-empty-now"><span aria-hidden="true">♪</span><div><b>No hay nada sonando</b><small>Busca una canción aquí abajo o espera a que el chat pida con <code>!play</code>.</small></div></div>';
  const pb = $('#music-pause');
  const icon = state.paused ? 'play' : 'pause';
  if (pb.dataset.state !== icon) {
    pb.dataset.state = icon;
    pb.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon === 'play' ? '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>' : '<rect x="7" y="5.5" width="3.6" height="13" rx="1" fill="currentColor"/><rect x="13.4" y="5.5" width="3.6" height="13" rx="1" fill="currentColor"/>'}</svg>`;
  }
  pb.title = state.paused ? 'Seguir' : 'Pausar';
  pb.setAttribute('aria-label', pb.title);
  $('#music-pause').disabled = !c;
  $('#music-skip').disabled = !c;
  $('#music-volume').value = state.volume;
  $('#music-enabled').checked = state.enabled;
  tickProgress();
}

function songRow(s, i, actions) {
  return `<li data-id="${esc(s.id || '')}"><span class="n">${i + 1}</span>${s.thumbnail ? `<img src="${esc(s.thumbnail)}" alt="" loading="lazy">` : '<span></span>'}<span class="t"><b>${esc(s.title)}</b><small>${esc(fromWho(s))}${s.durationSec ? ` · ${fmt(s.durationSec)}` : ''}</small></span><span class="row tight">${actions}</span></li>`;
}

function renderQueue() {
  const q = state.queue;
  $('#music-queue').innerHTML = q.length
    ? q.map((s, i) => songRow(s, i, `${i > 0 ? `<button class="btn small ghost" data-top="${esc(s.id)}" title="Que suene después de la actual">⤒</button>` : ''}<button class="btn small ghost" data-remove="${esc(s.id)}" title="Quitar de la cola">✕</button>`)).join('')
    : '<li class="empty">La cola está vacía. Busca algo o espera a que pidan con <code>!play</code>.</li>';
  const total = q.reduce((a, s) => a + (s.durationSec || 0), 0);
  $('#queue-count').textContent = q.length ? `${q.length}${total ? ` · ${fmt(total)}` : ''}` : '';
  const h = state.history || [];
  $('#mz-history').innerHTML = h.length
    ? h.map((s, i) => songRow({ ...s, id: `h${i}` }, i, `<button class="btn small ghost" data-again="${i}" title="Volver a ponerla">+</button>`)).join('') + '<li class="mz-clear-h"><button class="btn small ghost" id="mz-clear-history">Borrar historial</button></li>'
    : '<li class="empty">Aún no ha sonado nada.</li>';
}

function renderResults(msg) {
  const ul = $('#mz-results');
  if (msg) {
    ul.innerHTML = `<li class="empty">${msg}</li>`;
    return;
  }
  const inQueue = new Set([state.current?.videoId, ...state.queue.map((s) => s.videoId)]);
  ul.innerHTML = results.length
    ? results.map((r, i) => `<li><img src="${esc(r.thumbnail)}" alt="" loading="lazy"><span class="t"><b>${esc(r.title)}</b><small>${esc(r.author || '')}${r.durationSec ? ` · ${fmt(r.durationSec)}` : r.isLive ? ' · en vivo' : ''}</small></span>${inQueue.has(r.videoId) ? '<span class="mz-in">En cola</span>' : `<button class="btn small" data-add="${i}" ${r.isLive ? 'disabled title="No se pueden poner directos"' : 'title="Añadir a la cola"'}>+</button>`}</li>`).join('')
    : '<li class="empty">No encontré nada. Prueba con otras palabras.</li>';
}

function renderPlaylists() {
  const pls = state.playlists || [];
  $('#mz-pls').innerHTML = pls.length
    ? pls.map((p) => `<li data-pl="${esc(p.id)}"><span class="t"><b>${esc(p.name)}</b><small>${p.count} canciones${p.durationSec ? ` · ${fmt(p.durationSec)}` : ''}</small></span><span class="row tight"><button class="btn small" data-pl-load title="Añadir a la cola">Poner</button><button class="btn small ghost" data-pl-shuffle title="Añadir mezclada" aria-label="Añadir mezclada"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.6M14 9.6c.9-1.4 1.9-2.6 3.5-2.6H20"/><path d="m18 5 2 2-2 2M18 15l2 2-2 2"/></svg></button><button class="btn small ghost" data-pl-rename title="Cambiar nombre" aria-label="Cambiar nombre">✎</button><button class="btn small ghost" data-pl-delete title="Eliminar">✕</button></span></li>`).join('')
    : '<li class="empty">Todavía no hay listas. Guarda la cola con el botón de guardar o importa una de YouTube.</li>';
}

function renderActivity() {
  $('#mz-activity').innerHTML = activity.length
    ? activity.slice(0, 25).map((a) => `<li class="${esc(a.kind || '')}"><time>${esc(timeOf(a.ts))}</time><span>${esc(a.text)}</span></li>`).join('')
    : '<li class="empty">Sin actividad todavía.</li>';
}

function render() {
  renderNow();
  renderQueue();
  renderPlaylists();
  if (results.length) renderResults();
  updateNono();
}

function updateNono() {
  const on = Object.entries(config.music.platforms).filter(([, v]) => v).map(([k]) => PLATFORM_NAMES[k]);
  if (!state.enabled) return setBubble('nono', 'Las peticiones están cerradas. Actívalas cuando quieras que el chat ponga música.');
  if (!on.length) return setBubble('nono', 'No escucho ninguna plataforma. Elige en <b>Comandos y ajustes</b> dónde pueden pedir música.');
  if (state.current) return setBubble('nono', `Suena «${esc(state.current.title)}». ${state.queue.length ? `Quedan ${state.queue.length} en cola.` : 'La cola está vacía.'}`);
  setBubble('nono', `En ${on.join(' y ')} escriben <code>!play</code> o <code>!temita</code> y la canción. También puedes buscar aquí y poner tus listas.`);
}

export function onMusic(s) {
  state = { history: [], playlists: [], ...s };
  render();
  sync();
}

export function onMusicNotice(n) {
  if (n.kind !== 'busy') {
    activity.unshift(n);
    activity.length = Math.min(activity.length, 60);
    renderActivity();
  }
  if (n.kind === 'busy') {
    sayFor('nono', esc(n.text), 15000);
    setMood('nono', 'thinking');
    return;
  }
  const kind = { ok: 'ok', warn: 'warn', error: 'err' }[n.kind] || '';
  sayFor('nono', esc(n.text), 6000, kind);
}

let searchSeq = 0;
async function doSearch(q) {
  const my = ++searchSeq;
  renderResults('Buscando…');
  try {
    const r = await api('GET', `/api/music/search?q=${encodeURIComponent(q)}`);
    if (my !== searchSeq) return;
    results = r.results || [];
    renderResults();
  } catch (e) {
    if (my === searchSeq) renderResults(esc(e.message || 'No pude buscar.'));
  }
}

export function initMusic(cfg, { clientId, sendWs }) {
  config = cfg;
  myId = clientId;
  send = sendWs;
  createPlayer();
  setInterval(tickProgress, 1000);

  // La ventana de la app reclama el reproductor al abrir.
  send({ kind: 'player-hello' });
  document.addEventListener('click', (ev) => {
    if (ev.target.id === 'play-here') send({ kind: 'player-hello' });
  });

  const act = (action, body) => api('POST', `/api/music/${action}`, body).catch((e) => { toast(e.message); throw e; });
  $('#music-pause').addEventListener('click', () => act(state.paused ? 'resume' : 'pause').catch(() => {}));
  $('#music-skip').addEventListener('click', () => act('skip').catch(() => {}));
  $('#music-clear').addEventListener('click', () => state.queue.length && confirm('¿Vaciar toda la cola?') && act('clear').catch(() => {}));
  $('#mz-shuffle').addEventListener('click', () => (state.queue.length > 1 ? act('shuffle').catch(() => {}) : toast('Hacen falta al menos 2 canciones en cola')));
  $('#mz-save').addEventListener('click', async () => {
    if (!state.current && !state.queue.length) return toast('La cola está vacía: no hay nada que guardar');
    const name = prompt('Nombre de la lista:', `Mi lista ${(state.playlists?.length || 0) + 1}`);
    if (name === null) return;
    const r = await act('save-playlist', { name }).catch(() => null);
    if (r) guideToast('nono', `Guardé «${esc(r.playlist.name)}» con ${r.playlist.songs.length} canciones.`);
  });
  $('#music-volume').addEventListener('input', (ev) => {
    if (playerReady && isPlayer()) player.setVolume(Number(ev.target.value));
  });
  $('#music-volume').addEventListener('change', (ev) => act('volume', { volume: Number(ev.target.value) }).catch(() => {}));
  $('#music-enabled').addEventListener('change', (ev) => act('enabled', { enabled: ev.target.checked }).catch(() => {}));
  $('#mz-video-toggle').addEventListener('click', (ev) => {
    const hide = !$('#card-musica').classList.contains('no-video');
    $('#card-musica').classList.toggle('no-video', hide);
    ev.target.textContent = hide ? 'Mostrar video' : 'Ocultar video';
    ev.target.setAttribute('aria-pressed', String(!hide));
    try { localStorage.setItem('satronho.musicVideo', hide ? '0' : '1'); } catch { /* sin almacenamiento */ }
  });
  try {
    if (localStorage.getItem('satronho.musicVideo') === '0') $('#mz-video-toggle').click();
  } catch { /* sin almacenamiento */ }

  // Cola e historial.
  $$('[data-mzq]').forEach((b) => b.addEventListener('click', () => {
    qTab = b.dataset.mzq;
    $$('[data-mzq]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('#music-queue').hidden = qTab !== 'next';
    $('#mz-history').hidden = qTab !== 'history';
  }));
  $('#music-queue').addEventListener('click', (ev) => {
    const rm = ev.target.closest('[data-remove]')?.dataset.remove;
    if (rm) return act('remove', { id: rm }).catch(() => {});
    const top = ev.target.closest('[data-top]')?.dataset.top;
    if (top) act('move', { id: top, to: 0 }).catch(() => {});
  });
  $('#mz-history').addEventListener('click', async (ev) => {
    if (ev.target.id === 'mz-clear-history') return act('clear-history').catch(() => {});
    const i = ev.target.closest('[data-again]')?.dataset.again;
    if (i == null) return;
    const s = state.history[Number(i)];
    const r = await act('add-songs', { songs: [s] }).catch(() => null);
    if (r) toast(r.added ? `«${s.title}» vuelve a la cola` : 'Ya está en la cola');
  });

  // Buscar y añadir: Enter busca; con un enlace se añade directo.
  $('#music-add').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const q = $('#music-add-q').value.trim();
    if (!q) return;
    doSearch(q);
  });
  $('#mz-results').addEventListener('click', async (ev) => {
    const i = ev.target.closest('[data-add]')?.dataset.add;
    if (i == null) return;
    const song = results[Number(i)];
    const r = await act('add-songs', { songs: [song] }).catch(() => null);
    if (r?.added) renderResults();
  });

  // Listas.
  $('#mz-import').addEventListener('click', () => {
    const f = $('#mz-import-form');
    f.hidden = !f.hidden;
    if (!f.hidden) $('#mz-import-url').focus();
  });
  $('#mz-import-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const url = $('#mz-import-url').value.trim();
    if (!url) return;
    const btn = ev.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Importando…';
    const r = await act('import-playlist', { url }).catch(() => null);
    btn.disabled = false;
    btn.textContent = 'Importar';
    if (r) {
      $('#mz-import-url').value = '';
      $('#mz-import-form').hidden = true;
      guideToast('nono', `Importé «${esc(r.playlist.name)}» con ${r.playlist.songs.length} canciones.`);
    }
  });
  $('#mz-pls').addEventListener('click', async (ev) => {
    const li = ev.target.closest('[data-pl]');
    if (!li) return;
    const id = li.dataset.pl;
    if (ev.target.closest('[data-pl-load]')) act('load-playlist', { id }).catch(() => {});
    if (ev.target.closest('[data-pl-shuffle]')) act('load-playlist', { id, shuffle: true }).catch(() => {});
    if (ev.target.closest('[data-pl-rename]')) {
      const cur = state.playlists.find((p) => p.id === id);
      const name = prompt('Nuevo nombre:', cur?.name || '');
      if (name) act('rename-playlist', { id, name }).catch(() => {});
    }
    if (ev.target.closest('[data-pl-delete]') && confirm('¿Eliminar esta lista?')) act('delete-playlist', { id }).catch(() => {});
  });

  // Ajustes de música.
  for (const el of $$('[data-music]')) {
    const key = el.dataset.music;
    const [a, b] = key.split('.');
    el[el.type === 'checkbox' ? 'checked' : 'value'] = b ? config.music[a][b] : config.music[a];
    el.addEventListener('change', () => {
      const value = el.type === 'checkbox' ? el.checked : Number(el.value);
      if (b) config.music[a][b] = value;
      else config.music[a] = value;
      saveConfig({ music: b ? { [a]: { [b]: value } } : { [a]: value } });
      updateNono();
    });
  }
  render();
  renderActivity();
}
