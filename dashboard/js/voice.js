// Troya: la voz. Reproduce los audios de Piper en orden y, si Piper no
// está listo, usa las voces instaladas en Windows como respaldo.

import { $, $$, api, esc, saveConfig, toast, timeOf, PLATFORM_NAMES } from './util.js';
import { setBubble, sayFor, setMood, guideToast } from './guides.js';
import { bestWindowsVoice, cleanName, genderOf, windowsVoices } from './winvoices.js';

let config;
let engine = null;
const queue = [];
let playing = null; // { stop() }

// Variantes de tono: la misma voz más grave o más aguda (triplica las voces).
const TONES = { '': { rate: 1, pitch: 1, name: '' }, g: { rate: 0.86, pitch: 0.6, name: 'grave' }, a: { rate: 1.16, pitch: 1.5, name: 'aguda' } };

export const skipTts = () => playing?.stop();
export const ttsStatus = () => ({ queue: queue.length, speaking: Boolean(playing) });
let onQueue = () => {};
export const onTtsQueue = (fn) => { onQueue = fn; };

// Volumen: hasta 100 % con el reproductor normal; por encima se amplifica
// con WebAudio (puede distorsionar en los extremos).
let audioCtx = null;
function setVolume(audio, vol) {
  if (vol <= 1) {
    audio.volume = Math.max(0, vol);
    return;
  }
  try {
    audioCtx ??= new AudioContext();
    const src = audioCtx.createMediaElementSource(audio);
    const gain = audioCtx.createGain();
    gain.gain.value = Math.min(2, vol);
    src.connect(gain).connect(audioCtx.destination);
    audio.volume = 1;
  } catch {
    audio.volume = 1;
  }
}

// ---------- Cola de reproducción ----------
function updateQueueLabel() {
  $('#tts-queue').textContent = `En cola: ${queue.length}${playing ? ' · hablando' : ''}`;
  onQueue();
}

function playNext() {
  let item = queue.shift();
  // Mensajes caducados: si llevan demasiado esperando, ya no se leen.
  while (item && item.expireSec && Date.now() - item.ts > item.expireSec * 1000) item = queue.shift();
  playing = null;
  if (!item) return updateQueueLabel();

  const done = () => {
    if (playing?.item === item) playNext();
  };
  const tone = TONES[item.tone] || TONES[''];
  const pitch = Number(item.pitch) || 1;
  if (item.audioUrl) {
    const audio = new Audio(item.audioUrl);
    setVolume(audio, Number(config.tts.volume ?? 1));
    // Tono: cambiamos la velocidad de reproducción sin conservar el tono.
    // El servidor ya generó la voz más lenta o más rápida para compensar.
    audio.preservesPitch = false;
    audio.playbackRate = tone.rate * pitch;
    audio.onended = audio.onerror = done;
    playing = { item, stop: () => { audio.pause(); done(); } };
    audio.play().catch(done);
  } else {
    const u = new SpeechSynthesisUtterance(item.text);
    const voices = speechSynthesis.getVoices();
    // Voz de Windows pedida por nombre; si la voz original falló, la más
    // parecida (mismo género y país); si no, la de respaldo elegida.
    const v = (item.windowsVoice && voices.find((x) => x.name === item.windowsVoice))
      || (item.wanted && bestWindowsVoice(item.wanted))
      || voices.find((x) => x.name === config.tts.windowsVoice)
      || bestWindowsVoice({ lang: 'es' });
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'es-ES';
    u.rate = Number(config.tts.rate || 1);
    u.pitch = Math.max(0, Math.min(2, tone.pitch * pitch));
    u.volume = Math.min(1, Number(config.tts.volume ?? 1));
    u.onend = u.onerror = done;
    playing = { item, stop: () => { speechSynthesis.cancel(); done(); } };
    speechSynthesis.speak(u);
  }
  updateQueueLabel();
}

export function enqueueTts(item) {
  queue.push(item);
  while (queue.length > (config.tts.maxQueue || 15)) queue.shift();
  if (!playing) playNext();
  else updateQueueLabel();
}

// ---------- Motor y voces ----------
export function renderEngine(state) {
  engine = state;
  queueMicrotask(() => {
    renderCurrentVoice();
    if ($('#vp-modal') && !$('#vp-modal').hidden) renderPicker();
  });
  const box = $('#engine');
  const busy = state.busy;
  const selected = config.tts.piperVoice;

  let top;
  if (!state.supported) {
    top = `<p class="hint">Piper no está disponible para este sistema. Usaré las voces de Windows.</p>`;
  } else if (!state.installed) {
    top = `<div class="row"><button class="btn primary" data-engine="install" ${busy ? 'disabled' : ''}>Instalar motor de voz (≈25 MB)</button></div>`;
  } else {
    top = `<p class="ok-line">✓ Motor de voz instalado</p>`;
  }
  const progress = busy
    ? `<div class="progress"><i style="width:${busy.pct || 0}%"></i></div><p class="hint">${esc(busy.label)} · ${busy.pct || 0}%</p>`
    : '';
  const error = state.error ? `<p class="err-line">${esc(state.error)}</p>` : '';

  const GENDER = { f: 'femenina', m: 'masculina' };
  const row = (v) => {
    const inUse = v.id === selected;
    const spanish = v.lang === 'es';
    let action;
    if (!v.installed) action = `<button class="btn small" data-voice-dl="${v.id}" ${busy || !state.installed ? 'disabled' : ''}>Descargar</button>`;
    else if (inUse) action = `<span class="pill on">Principal</span>`;
    else if (spanish) action = `<button class="btn small" data-voice-use="${v.id}">Hacer principal</button>`;
    else action = `<span class="pill">Lista ✓</span>`;
    const who = v.speakers > 1 ? (v.speakerNames?.filter(Boolean).join(' y ') || `${v.speakers} voces`) : GENDER[v.gender] || '';
    return `<li class="${inUse ? 'sel' : ''}"><span><b>${esc(v.label.split(' · ')[0])}</b><small>${esc(v.country)}${who ? ` · ${esc(who)}` : ''} · calidad ${esc(v.quality)}${v.installed ? ' · ✓ descargada' : ''}</small></span>${action}</li>`;
  };
  const langs = [...new Set(state.voices.map((v) => v.lang || 'es'))];
  const voices = langs
    .map((lang) => {
      const list = state.voices.filter((v) => (v.lang || 'es') === lang);
      const name = list[0].langName || lang;
      const got = list.filter((v) => v.installed).length;
      const note = lang === 'es' ? 'entran al reparto por espectador' : 'solo para espectadores especiales';
      return `<details class="voice-lang" ${lang === 'es' ? 'open' : ''}><summary>${esc(name)} <small>· ${list.length} voces · ${got} descargadas · ${note}</small></summary><ul class="voices">${list.map(row).join('')}</ul></details>`;
    })
    .join('');
  const missing = state.voices.filter((v) => !v.installed && (v.lang || 'es') === 'es').length;
  const all = state.installed && missing ? `<div class="row space mt"><span class="hint" style="margin:0">Te faltan ${missing} ${missing === 1 ? 'voz' : 'voces'} en español.</span><button class="btn small primary" data-engine="all" ${busy ? 'disabled' : ''}>Descargar todas en español</button></div>` : '';

  const current = state.voices.find((v) => v.id === selected);
  const speakers =
    current?.speakers > 1
      ? `<label class="field inline"><span>Variante</span><select id="tts-speaker">${Array.from({ length: current.speakers }, (_, i) => `<option value="${i}" ${Number(config.tts.speaker) === i ? 'selected' : ''}>${esc(current.speakerNames?.[i] || `Voz ${i + 1}`)}</option>`).join('')}</select></label>`
      : '';

  box.innerHTML = `${top}${progress}${error}${all}${voices}${speakers}`;
  $('#tts-speaker')?.addEventListener('change', (ev) => {
    config.tts.speaker = Number(ev.target.value);
    saveConfig({ tts: { speaker: config.tts.speaker } });
  });
  setMood('troya', busy ? 'thinking' : 'idle', 0);
  renderPool();
  renderSpecial();
  updateTroya();
}

// ---------- Voces por espectador ----------
// "idVoz#variante" -> nombre legible.
let onlineVoices = [];
export function setOnlineVoices(list) {
  onlineVoices = list || [];
  renderPool();
  renderSpecial();
  renderOnline();
  renderCurrentVoice();
}

// Tarjeta «Voces de Latinoamérica»: por país, escuchar y elegir como principal.
function renderOnline() {
  const box = $('#ov-voices');
  if (!box || !config) return;
  const byCountry = new Map();
  for (const v of onlineVoices) {
    if (!byCountry.has(v.country)) byCountry.set(v.country, []);
    byCountry.get(v.country).push(v);
  }
  const main = config.tts.mainVoice || '';
  box.innerHTML = [...byCountry].map(([country, voices]) => `<div class="ov-country"><b>${esc(country)}</b>
    ${voices.map((v) => `<span class="ov-voice ${main === v.key ? 'main' : ''}">
      <button type="button" class="ov-play" data-ov-play="${esc(v.key)}" title="Escuchar a ${esc(v.name)}">▶</button>
      <span>${esc(v.name)}<small>${GENDER_SHORT[v.gender] || ''}</small></span>
      <button type="button" class="ov-star" data-ov-main="${esc(v.key)}" aria-pressed="${main === v.key}" title="${main === v.key ? 'Es tu voz principal (pulsa para quitarla)' : 'Usar como voz principal'}">★</button></span>`).join('')}
  </div>`).join('') || '<p class="hint">Cargando voces…</p>';
}

function initOnline() {
  const box = $('#ov-voices');
  if (!box) return;
  box.addEventListener('click', async (ev) => {
    const play = ev.target.closest('[data-ov-play]');
    if (play) {
      const v = onlineVoices.find((x) => x.key === play.dataset.ovPlay);
      try {
        await api('POST', '/api/tts/say', { text: `Hola, soy ${v?.name || 'una voz'}${v?.country ? `, de ${v.country}` : ''}. Así sonaría tu chat.`, voice: play.dataset.ovPlay });
      } catch (e) {
        toast(e.message);
      }
      return;
    }
    const star = ev.target.closest('[data-ov-main]');
    if (star) {
      const key = config.tts.mainVoice === star.dataset.ovMain ? '' : star.dataset.ovMain;
      config.tts.mainVoice = key;
      saveConfig({ tts: { mainVoice: key } });
      renderOnline();
      if (key) {
        const v = onlineVoices.find((x) => x.key === key);
        guideToast('troya', `Ahora tu voz principal es ${esc(v?.name || '')} (${esc(v?.country || '')}). Necesita internet; si falla, uso la de Windows.`);
      }
    }
  });
}
const GENDER_SHORT = { f: 'femenina', m: 'masculina' };

function piperKeys(auto) {
  if (!engine?.installed) return [];
  return engine.voices
    .filter((v) => v.installed && (!auto || (v.lang || 'es') === 'es'))
    .flatMap((v) => Array.from({ length: v.speakers }, (_, i) => `${v.id}#${i}`));
}
function windowsNames() {
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es')).map((v) => v.name);
}
// Igual que en el servidor (modules/tts.js).
//   auto=true: las del reparto automático (español); false: todas (inglés y francés a mano).
function baseKeys(auto = true) {
  return [
    ...piperKeys(auto),
    ...(config.tts.useWindowsVoices ? windowsNames().map((n) => `win:${n}`) : []),
    ...(config.tts.useOnlineVoices ? onlineVoices.map((v) => v.key) : []),
  ];
}
const withTones = (base) => (config.tts.toneVariants ? base.flatMap((k) => [k, `${k}~g`, `${k}~a`]) : base);
const voiceKeys = () => withTones(baseKeys(true));

function sourceOf(key) {
  const base = key.split('~')[0];
  if (base.startsWith('win:')) return 'Voces de Windows';
  if (base.startsWith('ms:')) return 'En línea · Microsoft (necesitan internet)';
  const v = engine?.voices.find((x) => x.id === base.split('#')[0]);
  return `${v?.langName || 'Español'} · Piper (en tu PC)`;
}

function voiceLabel(key) {
  const [base, tone = ''] = key.split('~');
  const toneName = TONES[tone]?.name ? ` · ${TONES[tone].name}` : '';
  if (base.startsWith('win:')) return `${base.slice(4).replace(/^Microsoft /, '').replace(/ - .*$/, '')} (Windows)${toneName}`;
  if (base.startsWith('ms:')) {
    const o = onlineVoices.find((x) => x.key === base);
    return o ? `${o.name} · ${o.country} · ${GENDER_SHORT[o.gender]}${toneName}` : `${base.slice(3)}${toneName}`;
  }
  const [id, n] = base.split('#');
  const v = engine?.voices.find((x) => x.id === id);
  if (!v) return key;
  let name;
  if (v.speakers > 1) name = `${v.label.split(' · ')[0]} · ${v.country} · ${v.speakerNames?.[Number(n)] || `voz ${Number(n) + 1}`}`;
  else name = `${v.label}${GENDER_SHORT[v.gender] ? ` · ${GENDER_SHORT[v.gender]}` : ''}`;
  return `${name}${toneName}`;
}

function renderPool() {
  const box = $('#voice-pool');
  if (!config) return;
  const keys = voiceKeys();
  if (config.tts.voiceMode === 'single') {
    box.innerHTML = '<p class="hint">Todos suenan con la voz principal.</p>';
    return;
  }
  if (keys.length < 2) {
    box.innerHTML = '<p class="hint">Descarga una voz (o activa los tonos) para que cada espectador suene distinto.</p>';
    return;
  }
  const chosen = new Set(config.tts.voicePool?.length ? config.tts.voicePool.filter((k) => keys.includes(k)) : keys);
  if (!chosen.size) keys.forEach((k) => chosen.add(k));
  let lastSource = '';
  const groups = baseKeys(true)
    .map((b) => {
      const src = sourceOf(b);
      const head = src !== lastSource ? `<p class="pool-src">${esc(src)}</p>` : '';
      lastSource = src;
      const ks = keys.filter((k) => k.split('~')[0] === b);
      return `${head}<div class="pool-row"><b>${esc(voiceLabel(b))}</b>${ks
        .map((k) => `<label title="${esc(voiceLabel(k))}"><input type="checkbox" data-pool="${esc(k)}" ${chosen.has(k) ? 'checked' : ''}> ${esc(TONES[k.split('~')[1] || '']?.name || 'normal')}</label>`)
        .join('')}</div>`;
    })
    .join('');
  box.innerHTML = `<p class="count-line">Reparto entre ${chosen.size} de ${keys.length} voces</p>${groups}
    <div class="row mt"><button type="button" class="btn small ghost" data-pool-all="1">Marcar todas</button><button type="button" class="btn small ghost" data-pool-all="0">Solo la principal</button></div>`;
}

function renderSpecial() {
  const list = config.tts.special || [];
  const el = $('#special-list');
  el.innerHTML = list.length
    ? list
        .map((s, i) => {
          const [plat, user] = s.key.split(':');
          const what = s.action === 'mute' ? '🔇 silenciado' : `🔊 siempre${s.voice ? ` · ${esc(voiceLabel(s.voice))}` : ''}`;
          return `<li><span><b>${esc(user)}</b> <small>${esc(PLATFORM_NAMES[plat] || plat)}${s.spokenName ? ` · se lee «${esc(s.spokenName)}»` : ''} · ${what}</small></span><button class="btn small ghost" data-special-del="${i}" title="Quitar">✕</button></li>`;
        })
        .join('')
    : '<li class="empty">Ninguno todavía.</li>';
  const sel = $('#special-voice');
  const all = withTones(baseKeys(false));
  const bySource = new Map();
  for (const k of all) {
    const src = sourceOf(k);
    if (!bySource.has(src)) bySource.set(src, []);
    bySource.get(src).push(k);
  }
  sel.innerHTML = `<option value="">Voz: la que le toque</option>${[...bySource]
    .map(([src, ks]) => `<optgroup label="${esc(src)}">${ks.map((k) => `<option value="${esc(k)}">${esc(voiceLabel(k))}</option>`).join('')}</optgroup>`)
    .join('')}`;
}

function saveSpecial(list) {
  config.tts.special = list;
  saveConfig({ tts: { special: list } });
  renderSpecial();
}

export function updateTroya() {
  if (!engine) return;
  const ready = engine.installed && engine.voices.some((v) => v.id === config.tts.piperVoice && v.installed);
  const gift = esc(config.tts.tiktokGate.giftNames[0] || 'Quiéreme');
  if (engine.busy) return setBubble('troya', `Estoy descargando ${esc(engine.busy.label)}… ya casi tengo voz nueva.`);
  if (!engine.installed) return setBubble('troya', 'Primero instala el motor de voz y luego descarga una voz en español. Se descarga una sola vez y después funciona sin internet.');
  if (!ready) return setBubble('troya', 'El motor ya está. Ahora descarga una voz (te recomiendo <b>Claude · México</b>) y pulsa <i>Usar</i>.');
  const mode = config.tts.who?.tiktok?.mode || 'all';
  const tiktok = {
    all: 'en TikTok leo a todos',
    followers: 'en TikTok, a quienes te siguen',
    subs: 'en TikTok, a tus suscriptores',
    team: 'en TikTok, a los Miembros de tu equipo',
    'team-gift': `en TikTok, a los Miembros de tu equipo que ya te mandaron <b>${gift}</b>`,
    gift: `en TikTok, solo a quien te mande un <b>${gift}</b>`,
    mods: 'en TikTok, solo a tus moderadores',
  }[mode] || 'en TikTok leo a todos';
  const others = ['kick', 'starvios', 'twitch'].every((p) => (config.tts.who?.[p]?.mode || 'all') === 'all') ? 'Leo todo el chat de Kick, Starvios y Twitch' : 'Leo el chat de Kick, Starvios y Twitch con tus reglas';
  setBubble('troya', `${others}, y ${tiktok}. ${config.tts.filterProfanity ? 'Cambio las groserías por «piip».' : 'El filtro de groserías está apagado.'}`);
}

// ---------- Permisos de TikTok ----------
export function renderAllowed(list) {
  const el = $('#allowed-list');
  if (!list.length) {
    el.innerHTML = `<li class="empty">Nadie todavía. Cuando alguien te mande el regalo, aparecerá aquí.</li>`;
    return;
  }
  el.innerHTML = list
    .map((u) => `<li><span><b>${esc(u.name)}</b> <small>@${esc(u.id)} · ${timeOf(u.ts)}</small></span><button class="btn small ghost" data-revoke="${esc(u.id)}" title="Quitar permiso">✕</button></li>`)
    .join('');
}

// ---------- Formulario ----------
function fillForm() {
  const t = config.tts;
  for (const el of $$('[data-tts]')) {
    const path = el.dataset.tts.split('.');
    let v = t;
    for (const p of path) v = v?.[p];
    if (el.type === 'checkbox') el.checked = Boolean(v);
    else if (el.type === 'radio') el.checked = el.value === String(v ?? '');
    else if (Array.isArray(v)) el.value = el.tagName === 'TEXTAREA' ? v.join('\n') : v.join(', ');
    else el.value = v ?? '';
  }
  showLevels();
  $('#tricks-row').classList.toggle('disabled', !t.filterProfanity);
  showWho();
}

// «Quién puede hablar»: el nivel del equipo solo se ve con las reglas de equipo.
function showWho() {
  const mode = config.tts.who?.tiktok?.mode || 'all';
  const lvl = $('.who-level');
  if (lvl) lvl.hidden = !['team', 'team-gift'].includes(mode);
}

function showLevels() {
  const t = config.tts;
  $('#rate-val').textContent = `${t.rate}×`;
  $('#vol-val').textContent = `${Math.round(t.volume * 100)}%`;
  const p = Number(t.pitch) || 1;
  $('#pitch-val').textContent = p === 1 ? 'normal' : p < 1 ? `más grave (${Math.round(p * 100)}%)` : `más aguda (${Math.round(p * 100)}%)`;
  $('#vol-warn').hidden = !(t.volume > 1);
}

function readField(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.dataset.list === 'lines') return el.value.split('\n').map((w) => w.trim()).filter(Boolean);
  if (el.dataset.list === 'comma') return el.value.split(',').map((w) => w.trim()).filter(Boolean);
  if (el.type === 'number' || el.type === 'range' || el.dataset.num !== undefined) return Number(el.value);
  return el.value;
}

let lastWinNames = null;
function populateWindowsVoices() {
  const sel = $('#tts-windows-voice');
  const list = speechSynthesis.getVoices();
  // El servidor necesita los nombres para repartir también estas voces.
  const names = windowsNames();
  if (names.join('|') !== lastWinNames) {
    lastWinNames = names.join('|');
    api('POST', '/api/tts/windows-voices', { names }).catch(() => {});
  }
  renderPool();
  const es = list.filter((v) => v.lang.toLowerCase().startsWith('es'));
  const rest = list.filter((v) => !v.lang.toLowerCase().startsWith('es'));
  sel.innerHTML = `<option value="">Automática (español)</option>${[...es, ...rest].map((v) => `<option value="${esc(v.name)}">${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}`;
  sel.value = config.tts.windowsVoice || '';
}

export function initVoice(cfg) {
  config = cfg;
  fillForm();
  populateWindowsVoices();
  initOnline();
  initPicker();
  speechSynthesis.onvoiceschanged = populateWindowsVoices;

  for (const el of $$('[data-tts]')) {
    const evName = el.tagName === 'TEXTAREA' || el.type === 'range' || el.type === 'text' ? 'input' : 'change';
    el.addEventListener(evName, () => {
      const path = el.dataset.tts.split('.');
      const value = readField(el);
      // Construye { a: { b: valor } } a partir de "a.b".
      const partial = path.reduceRight((acc, key) => ({ [key]: acc }), value);
      let target = config.tts;
      for (const p of path.slice(0, -1)) target = target[p];
      target[path.at(-1)] = value;
      saveConfig({ tts: partial });
      showLevels();
      $('#tricks-row').classList.toggle('disabled', !config.tts.filterProfanity);
      showWho();
      updateTroya();
    });
  }

  $('#engine').addEventListener('click', async (ev) => {
    const t = ev.target;
    try {
      if (t.dataset.engine === 'install') await api('POST', '/api/tts/install-engine');
      if (t.dataset.engine === 'all') {
        const { count } = await api('POST', '/api/tts/install-all', { lang: 'es' });
        sayFor('troya', `Voy a descargar ${count} voces, una detrás de otra. Puedes seguir usando la app.`, 7000);
      }
      if (t.dataset.voiceDl) {
        await api('POST', `/api/tts/install-voice/${t.dataset.voiceDl}`);
        if (!config.tts.piperVoiceChosen) {
          config.tts.piperVoice = t.dataset.voiceDl;
          saveConfig({ tts: { piperVoice: t.dataset.voiceDl } });
        }
      }
      if (t.dataset.voiceUse) {
        config.tts.piperVoice = t.dataset.voiceUse;
        config.tts.speaker = 0;
        saveConfig({ tts: { piperVoice: t.dataset.voiceUse, speaker: 0, piperVoiceChosen: true } });
        renderEngine(engine);
        sayFor('troya', '¡Voz cambiada! Pulsa <i>Probar</i> para escucharla.');
      }
    } catch (e) {
      toast(e.message);
    }
  });

  $('#tts-say').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = $('#tts-say-text').value.trim() || 'Hola, soy Troya. Así sueno en el directo.';
    await api('POST', '/api/tts/say', { text }).catch((e) => toast(e.message));
  });
  $('#tts-skip').addEventListener('click', skipTts);

  const savePool = (picked) => {
    const all = voiceKeys();
    config.tts.voicePool = picked.length === all.length ? [] : picked; // todas = lista vacía
    saveConfig({ tts: { voicePool: config.tts.voicePool } });
    renderPool();
  };
  $('#voice-pool').addEventListener('change', () => savePool($$('#voice-pool [data-pool]').filter((x) => x.checked).map((x) => x.dataset.pool)));
  $('#voice-pool').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-pool-all]');
    if (!b) return;
    if (b.dataset.poolAll === '1') return savePool(voiceKeys());
    const main = `${config.tts.piperVoice}#${Number(config.tts.speaker) || 0}`;
    savePool(voiceKeys().includes(main) ? [main] : voiceKeys().slice(0, 1));
  });
  for (const k of ['voiceMode', 'toneVariants', 'useWindowsVoices', 'useOnlineVoices']) $(`[data-tts="${k}"]`).addEventListener('change', () => { renderPool(); renderSpecial(); });

  $('#special-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    const user = f.user.trim().replace(/^@/, '').toLowerCase();
    if (!user) return;
    const key = `${f.platform}:${user}`;
    const list = (config.tts.special || []).filter((s) => s.key !== key);
    list.push({ key, spokenName: f.spokenName.trim(), voice: f.voice, action: f.action });
    saveSpecial(list);
    ev.target.reset();
    sayFor('troya', `Anotado: <b>${esc(user)}</b> ${f.action === 'mute' ? 'queda silenciado' : 'siempre tendrá voz'}.`, 5000, 'ok');
  });
  $('#special-list').addEventListener('click', (ev) => {
    const i = ev.target.closest('[data-special-del]')?.dataset.specialDel;
    if (i === undefined) return;
    const list = [...(config.tts.special || [])];
    list.splice(Number(i), 1);
    saveSpecial(list);
  });

  $('#tts-check').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    const out = $('#tts-check-result');
    try {
      // Damos tiempo a que se guarden ajustes recién cambiados.
      await new Promise((r) => setTimeout(r, 350));
      const { decision: d } = await api('POST', '/api/tts/check', f);
      out.hidden = false;
      out.className = `check-result ${d.read ? 'yes' : 'no'}`;
      out.innerHTML = d.read
        ? `🔊 <b>Lo leería así:</b> «${esc(d.text)}»${d.voice ? ` <small>con ${esc(voiceLabel(d.voice))}</small>` : ' <small>con la voz de Windows</small>'}`
        : `🔇 <b>No lo leería:</b> ${esc(d.reason)}.`;
    } catch (e) {
      toast(e.message);
    }
  });

  $('#allowed-list').addEventListener('click', (ev) => {
    const id = ev.target.closest('[data-revoke]')?.dataset.revoke;
    if (id) api('DELETE', `/api/tts/allowed/${encodeURIComponent(id)}`).catch((e) => toast(e.message));
  });
  $('#allowed-clear').addEventListener('click', () => {
    if (confirm('¿Quitar el permiso de voz a todos?')) api('DELETE', '/api/tts/allowed').catch((e) => toast(e.message));
  });
}

// Voces que fallaron hace poco: «Elegir voz» las marca con ⚠.
const failing = new Map(); // clave de voz -> { ts, reason }
const lastWarn = new Map();
const GENDER_WORD = { f: 'mujer', m: 'hombre' };

export function onTtsItem(item) {
  const base = String(item.voice || '').split('~')[0];
  if (item.error && base) {
    failing.set(base, { ts: Date.now(), reason: item.error });
    const sub = bestWindowsVoice(item.wanted || { lang: 'es' });
    const who = item.wanted?.name || 'La voz elegida';
    // Un aviso por voz cada 2 minutos, para no llenar la pantalla.
    if (Date.now() - (lastWarn.get(base) || 0) > 120000) {
      lastWarn.set(base, Date.now());
      const g = GENDER_WORD[genderOf(sub?.name || '')];
      guideToast('troya', `${esc(who)} no respondió (${esc(item.error)}). Lo leí con ${esc(sub ? cleanName(sub.name) : 'la voz de Windows')}${g ? `, también ${g}` : ''}.`);
    }
    if ($('#vp-modal') && !$('#vp-modal').hidden) renderPicker();
  } else if (base && failing.has(base)) {
    failing.delete(base);
    if ($('#vp-modal') && !$('#vp-modal').hidden) renderPicker();
  }
  enqueueTts(item);
}

export { PLATFORM_NAMES };

// ---------- Elegir voz (ventana) ----------
// Categorías: en tu PC (Piper), Latinoamérica (en línea) y Windows.
// Buscador, filtro de idioma, el país de cada voz y ▶ para escucharla.
const LANG_NAME = { es: 'Español', en: 'Inglés', fr: 'Francés', pt: 'Portugués', it: 'Italiano', de: 'Alemán' };
let regionNames = null;
const countryName = (cc) => {
  try {
    regionNames ??= new Intl.DisplayNames(['es'], { type: 'region' });
    return regionNames.of(cc) || cc;
  } catch {
    return cc;
  }
};
const vp = { cat: 'all', lang: 'all', gender: 'all', q: '' };

// Banderas SVG (flag-icons, MIT): Windows no dibuja las banderas emoji.
const FLAGS = new Set('AR AT AU BE BO BR CA CH CL CN CO CR CU DE DK DO EC ES FI FR GB GT HK HN IE IN IT JP KR MX NI NL NO NZ PA PE PL PR PT PY RU SE SV TR TW US UY VE ZA'.split(' '));
const flagHtml = (cc) => (FLAGS.has(String(cc || '').toUpperCase())
  ? `<img class="vp-flagimg" src="img/flags/${String(cc).toLowerCase()}.svg" alt="" loading="lazy">`
  : `<span class="vp-flag">${esc(cc || '··')}</span>`);

function pickerVoices() {
  const out = [];
  for (const v of engine?.voices || []) {
    const cc = (v.id.split('_')[1] || '').split('-')[0].toUpperCase();
    const lang = v.lang || v.id.slice(0, 2);
    const n = v.installed ? v.speakers : 1;
    for (let i = 0; i < n; i++) {
      const key = `${v.id}#${i}`;
      const gender = v.gender || v.speakerGenders?.[i] || '';
      out.push({ key, cat: 'piper', gender, lang, cc, installed: v.installed, id: v.id, name: v.installed ? voiceLabel(key).split(' · ')[0] : v.label.split(' · ')[0], detail: v.installed ? voiceLabel(key).split(' · ').slice(1).join(' · ') : `${GENDER_SHORT[v.gender] || ''}${v.size ? ` · ${v.size}` : ''} · sin descargar`, src: 'En tu PC · sin internet' });
    }
  }
  for (const v of onlineVoices) {
    out.push({ key: v.key, cat: 'online', gender: v.gender, lang: 'es', cc: v.locale.split('-')[1], installed: true, name: v.name, detail: `${GENDER_SHORT[v.gender]} · en línea`, src: 'Latinoamérica · necesita internet' });
  }
  for (const v of windowsVoices()) {
    const [lang, cc = ''] = v.lang.split(/[-_]/);
    const gender = genderOf(v.name);
    out.push({ key: `win:${v.name}`, cat: 'win', gender, lang: lang.toLowerCase(), cc: cc.toUpperCase(), installed: true, name: cleanName(v.name), detail: `${GENDER_SHORT[gender] ? `${GENDER_SHORT[gender]} · ` : ''}de Windows`, src: 'Windows · siempre disponible' });
  }
  return out;
}

const currentMain = () => config.tts.mainVoice || `${config.tts.piperVoice}#${Number(config.tts.speaker) || 0}`;

function renderCurrentVoice() {
  if (!$('#vp-cur-name')) return;
  const key = currentMain();
  const v = pickerVoices().find((x) => x.key === key);
  $('#vp-cur-name').textContent = v ? v.name : 'Sin voz elegida';
  $('#vp-cur-src').textContent = v ? `${v.cc ? `${countryName(v.cc)} · ` : ''}${v.src}` : 'Descarga una voz o elige una de Latinoamérica o de Windows';
  $('#vp-cur-flag').innerHTML = v?.cc ? flagHtml(v.cc) : '♪';
}

function renderPicker() {
  const all = pickerVoices();
  const cats = [['all', 'Todas'], ['piper', 'En tu PC'], ['online', 'Latinoamérica'], ['win', 'Windows']];
  $('#vp-cats').innerHTML = cats.map(([id, name]) => `<button type="button" data-vp-cat="${id}" aria-pressed="${vp.cat === id}"><span>${name}</span><small>${all.filter((v) => id === 'all' || v.cat === id).length}</small></button>`).join('');
  const inCat = all.filter((v) => vp.cat === 'all' || v.cat === vp.cat);
  const langs = [...new Set(inCat.map((v) => v.lang))];
  if (vp.lang !== 'all' && !langs.includes(vp.lang)) vp.lang = 'all';
  $('#vp-langs').innerHTML = [['all', 'Todos'], ...langs.map((l) => [l, LANG_NAME[l] || l.toUpperCase()])].map(([id, name]) => `<label class="chip-check"><input type="radio" name="vp-lang" value="${id}" ${vp.lang === id ? 'checked' : ''}><span>${name} <small>${id === 'all' ? inCat.length : inCat.filter((v) => v.lang === id).length}</small></span></label>`).join('');
  const inLang = inCat.filter((v) => vp.lang === 'all' || v.lang === vp.lang);
  $('#vp-genders').innerHTML = [['all', 'Todas'], ['f', '♀ Mujer'], ['m', '♂ Hombre']].map(([id, name]) => `<label class="chip-check"><input type="radio" name="vp-gender" value="${id}" ${vp.gender === id ? 'checked' : ''}><span>${name} <small>${id === 'all' ? inLang.length : inLang.filter((v) => v.gender === id).length}</small></span></label>`).join('');
  const q = vp.q.toLowerCase();
  const list = inLang.filter((v) => (vp.gender === 'all' || v.gender === vp.gender) && (!q || `${v.name} ${countryName(v.cc)} ${v.detail}`.toLowerCase().includes(q)));
  const groups = new Map();
  for (const v of list) {
    const g = `${LANG_NAME[v.lang] || v.lang.toUpperCase()}${v.cc ? ` (${countryName(v.cc)})` : ''}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(v);
  }
  const main = currentMain();
  const fail = (key) => { const f = failing.get(key); return f && Date.now() - f.ts < 15 * 60e3 ? f : null; };
  $('#vp-list').innerHTML = [...groups].map(([g, vs]) => `<h4>${flagHtml(vs[0].cc)}${esc(g)} <small>${vs.length}</small></h4>
    ${vs.map((v) => `<div class="vp-item ${v.key === main ? 'on' : ''} ${v.installed ? '' : 'off'} ${fail(v.key) ? 'bad' : ''}" data-vp="${esc(v.key)}">
      <span class="vp-g ${v.gender || 'x'}" aria-hidden="true">${v.gender === 'f' ? '♀' : v.gender === 'm' ? '♂' : '·'}</span>
      <button type="button" class="vp-pick" ${v.installed ? '' : 'disabled'}><b>${esc(v.name)}${v.key === main ? ' <em class="vp-tag">En uso</em>' : ''}</b><small>${esc(v.detail)}${fail(v.key) ? ` · <span class="vp-warn" title="${esc(fail(v.key).reason)}">⚠ no respondió hace poco</span>` : ''}</small></button>
      ${v.installed ? `<button type="button" class="vp-play" data-vp-play="${esc(v.key)}" aria-label="Escuchar ${esc(v.name)}">▶</button>` : `<button type="button" class="btn small" data-vp-dl="${esc(v.id)}">Descargar</button>`}
    </div>`).join('')}`).join('') || '<p class="hint">No hay voces con ese filtro.</p>';
  $('#vp-count').textContent = `${list.length} voces`;
  const cur = all.find((v) => v.key === main);
  $('#vp-sel').innerHTML = cur ? `Elegida: <b>${esc(cur.name)}</b>${cur.cc ? ` · ${esc(countryName(cur.cc))}` : ''}` : '';
}

function chooseVoice(key) {
  if (/^[a-z]{2}_[A-Z]{2}-/.test(key)) {
    const [id, n] = key.split('#');
    config.tts.piperVoice = id;
    config.tts.speaker = Number(n) || 0;
    config.tts.mainVoice = '';
    saveConfig({ tts: { piperVoice: id, speaker: Number(n) || 0, mainVoice: '', piperVoiceChosen: true } });
  } else {
    config.tts.mainVoice = key;
    saveConfig({ tts: { mainVoice: key } });
  }
  renderPicker();
  renderCurrentVoice();
  renderOnline?.();
}

function initPicker() {
  const modal = $('#vp-modal');
  if (!modal) return;
  const open = () => { modal.hidden = false; renderPicker(); $('#vp-q').focus(); };
  const close = () => { modal.hidden = true; };
  $('#vp-open').addEventListener('click', open);
  $('#vp-close').addEventListener('click', close);
  modal.addEventListener('click', (ev) => { if (ev.target === modal) close(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !modal.hidden) close(); });
  $('#vp-cats').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-vp-cat]');
    if (b) { vp.cat = b.dataset.vpCat; renderPicker(); }
  });
  $('#vp-langs').addEventListener('change', (ev) => { vp.lang = ev.target.value; renderPicker(); });
  $('#vp-genders').addEventListener('change', (ev) => { vp.gender = ev.target.value; renderPicker(); });
  $('#vp-q').addEventListener('input', (ev) => { vp.q = ev.target.value; renderPicker(); });
  $('#vp-list').addEventListener('click', async (ev) => {
    const play = ev.target.closest('[data-vp-play]');
    if (play) {
      const key = play.dataset.vpPlay;
      const v = pickerVoices().find((x) => x.key === key);
      const text = v?.lang === 'en' ? `Hi, I am ${v.name}. This is how your chat would sound.` : v?.lang === 'fr' ? `Bonjour, je suis ${v.name}.` : `Hola, soy ${v?.name || 'una voz'}. Así sonaría tu chat.`;
      return api('POST', '/api/tts/say', { text, voice: key }).catch((e) => toast(e.message));
    }
    const dl = ev.target.closest('[data-vp-dl]');
    if (dl) {
      dl.disabled = true;
      dl.textContent = 'Descargando…';
      return api('POST', `/api/tts/install-voice/${dl.dataset.vpDl}`).catch((e) => toast(e.message));
    }
    const pick = ev.target.closest('.vp-pick');
    if (pick && !pick.disabled) chooseVoice(pick.closest('[data-vp]').dataset.vp);
  });
  renderCurrentVoice();
}
export { initPicker, renderCurrentVoice, renderPicker };
