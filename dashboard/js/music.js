// Ñoño: el DJ. Muestra la cola y reproduce con el reproductor oficial de
// YouTube incrustado. Solo una ventana reproduce a la vez (la "principal").

import { $, $$, api, esc, saveConfig, toast, PLATFORM_NAMES } from './util.js';
import { setBubble, sayFor, setMood } from './guides.js';

let config;
let state = { current: null, queue: [], paused: false, volume: 60, enabled: true, playerId: null };
let myId = null;
let send = () => {};
let player = null;
let playerReady = false;
let loadedId = null;

const fmt = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');
const isPlayer = () => state.playerId && state.playerId === myId;

// ---------- Reproductor de YouTube ----------
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('No se pudo cargar el reproductor de YouTube'));
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

// ---------- Interfaz ----------
function render() {
  const c = state.current;
  $('#now').innerHTML = c
    ? `${c.thumbnail ? `<img src="${esc(c.thumbnail)}" alt="">` : ''}<div><b>${esc(c.title)}</b><small>${esc(c.author || '')} ${fmt(c.durationSec)}</small><small>Pedida por <b>${esc(c.requester)}</b> · ${esc(PLATFORM_NAMES[c.platform] || c.platform)}</small></div>`
    : '<p class="hint">No suena nada. Pide algo con <code>!play</code>.</p>';

  $('#music-pause').textContent = state.paused ? '▶ Seguir' : '⏸ Pausar';
  $('#music-pause').disabled = !c;
  $('#music-skip').disabled = !c;
  $('#music-volume').value = state.volume;
  $('#music-enabled').checked = state.enabled;

  const q = $('#music-queue');
  q.innerHTML = state.queue.length
    ? state.queue
        .map(
          (s, i) => `<li><span class="n">${i + 1}</span><span class="t"><b>${esc(s.title)}</b><small>${esc(s.requester)} · ${esc(PLATFORM_NAMES[s.platform] || s.platform)} · ${fmt(s.durationSec)}</small></span><button class="btn small ghost" data-remove="${esc(s.id)}" title="Quitar de la cola">✕</button></li>`
        )
        .join('')
    : '<li class="empty">La cola está vacía.</li>';
  $('#queue-count').textContent = state.queue.length ? `(${state.queue.length})` : '';
  updateNono();
}

function updateNono() {
  const on = Object.entries(config.music.platforms).filter(([, v]) => v).map(([k]) => PLATFORM_NAMES[k]);
  if (!state.enabled) return setBubble('nono', 'Las peticiones están cerradas. Actívalas cuando quieras que el chat ponga música.');
  if (!on.length) return setBubble('nono', 'No escucho ninguna plataforma. Elige abajo dónde pueden pedir música.');
  if (state.current) return setBubble('nono', `Suena «${esc(state.current.title)}», pedida por <b>${esc(state.current.requester)}</b>. ${state.queue.length ? `Quedan ${state.queue.length} en cola.` : 'La cola está vacía.'}`);
  setBubble('nono', `En ${on.join(' y ')} escriben <code>!play</code> o <code>!temita</code> y la canción. <code>!skip</code> salta su propia canción y <code>!quitar</code> la saca de la cola.`);
}

export function onMusic(s) {
  state = s;
  render();
  sync();
}

export function onMusicNotice(n) {
  if (n.kind === 'busy') {
    sayFor('nono', esc(n.text), 15000);
    setMood('nono', 'thinking');
    return;
  }
  const kind = { ok: 'ok', warn: 'warn', error: 'err' }[n.kind] || '';
  sayFor('nono', esc(n.text), 6000, kind);
}

export function initMusic(cfg, { clientId, sendWs }) {
  config = cfg;
  myId = clientId;
  send = sendWs;
  createPlayer();

  // La ventana de la app reclama el reproductor al abrir.
  send({ kind: 'player-hello' });
  document.addEventListener('click', (ev) => {
    if (ev.target.id === 'play-here') send({ kind: 'player-hello' });
  });

  const act = (action, body) => api('POST', `/api/music/${action}`, body).catch((e) => toast(e.message));
  $('#music-pause').addEventListener('click', () => act(state.paused ? 'resume' : 'pause'));
  $('#music-skip').addEventListener('click', () => act('skip'));
  $('#music-clear').addEventListener('click', () => state.queue.length && confirm('¿Vaciar toda la cola?') && act('clear'));
  $('#music-volume').addEventListener('input', (ev) => {
    if (playerReady && isPlayer()) player.setVolume(Number(ev.target.value));
  });
  $('#music-volume').addEventListener('change', (ev) => act('volume', { volume: Number(ev.target.value) }));
  $('#music-enabled').addEventListener('change', (ev) => act('enabled', { enabled: ev.target.checked }));
  $('#music-queue').addEventListener('click', (ev) => {
    const id = ev.target.closest('[data-remove]')?.dataset.remove;
    if (id) act('remove', { id });
  });
  $('#music-add').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const input = $('#music-add-q');
    const query = input.value.trim();
    if (!query) return;
    input.value = '';
    await act('add', { query });
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
}
