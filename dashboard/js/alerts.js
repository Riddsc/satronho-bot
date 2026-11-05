// Alertas (Troya): qué alertas salen y, para cada una, cuánto duran,
// qué sonido llevan, a qué volumen, si se corta el sonido, si la alerta
// dura lo que dura el sonido y si Troya la lee en voz alta.
// Además, «Regalos grandes»: otra alerta desde cierta cantidad de diamantes.

import { $, $$, api, esc, toast, saveConfig } from './util.js';
import { guideToast } from './guides.js';
import { SOUNDS, playAlertSound } from '/overlays/sounds.js';
import { openSoundPicker, soundLabel } from './soundsUI.js';

const KINDS = [
  { key: 'follow', icon: '♥', color: '#8b7bff', name: 'Nuevo seguidor', desc: 'Cuando alguien te sigue' },
  { key: 'gift', icon: '🎁', color: '#ff5d8f', name: 'Regalo', desc: 'Cualquier regalo, con su imagen y cantidad' },
  { key: 'sub', icon: '★', color: '#ffb23e', name: 'Suscripción', desc: 'Subs y meses acumulados' },
  { key: 'like', icon: '👍', color: '#4fd1c5', name: 'Likes', desc: 'Cada tanda de likes (puede ser mucho)' },
  { key: 'share', icon: '↗', color: '#5ab0ff', name: 'Compartido', desc: 'Cuando alguien comparte tu LIVE' },
  { key: 'sticker', icon: '✨', color: '#c084fc', name: 'Sticker', desc: 'Stickers del chat: salen al instante, con su imagen' },
  { key: 'superfan', icon: '⭐', color: '#ffd23e', name: 'Superfan', desc: 'Alguien se vuelve superfan en TikTok' },
  { key: 'join', icon: '👋', color: '#74d14c', name: 'Llega al directo', desc: 'Alguien entra a tu LIVE (puede ser mucho)' },
];

let config;
const openRows = new Set();
const settings = (key) => (key === 'bigGift' ? config.alerts.bigGift : config.alerts.types[key]);

function save(key, patch) {
  Object.assign(settings(key), patch);
  saveConfig({ alerts: key === 'bigGift' ? { bigGift: patch } : { types: { [key]: patch } } });
}

function soundOptions(t) {
  const opts = Object.entries(SOUNDS).map(([id, label]) => `<option value="${id}" ${t.sound === id ? 'selected' : ''}>${esc(label)}</option>`);
  if (t.sound && !SOUNDS[t.sound] && !['file', 'none'].includes(t.sound)) opts.push(`<option value="${esc(t.sound)}" selected>♪ ${esc(soundLabel(t.sound))}</option>`);
  opts.push('<option value="__lib">📚 Biblioteca de sonidos…</option>');
  opts.push(`<option value="file" ${t.sound === 'file' ? 'selected' : ''}>Mi sonido…</option>`);
  opts.push(`<option value="none" ${t.sound === 'none' ? 'selected' : ''}>Sin sonido</option>`);
  return opts.join('');
}

// Ajustes de una alerta (los mismos para cada tipo y para «Regalos grandes»).
function settingsHTML(key, extra = '') {
  const t = settings(key);
  const fileName = t.fileName || (t.file ? t.file.replace(/\?.*$/, '') : '');
  return `<div class="al-set" data-key="${key}">
    ${extra}
    <label class="field al-sound"><span>🔊 Sonido</span>
      <span class="row"><select data-f="sound">${soundOptions(t)}</select><button type="button" class="btn small al-play" data-play="${key}" title="Escuchar">▶</button><button type="button" class="snd-pick" data-libpick="${key}">Elegir de la biblioteca</button></span></label>
    <label class="field"><span>Segundos en pantalla</span>
      <span class="al-num"><input type="range" min="1" max="30" step="1" data-f="seconds" value="${t.seconds ?? 5}" ${t.fitSound ? 'disabled' : ''}><output>${t.seconds ?? 5} s</output></span></label>
    <label class="switch"><input type="checkbox" data-f="fitSound" ${t.fitSound ? 'checked' : ''}><span></span> Que dure lo que dura el sonido</label>
    <div class="al-file" ${t.sound === 'file' ? '' : 'hidden'}>
      <button type="button" class="btn small" data-upload="${key}">${fileName ? 'Cambiar sonido' : 'Subir sonido'}</button>
      <small>${fileName ? esc(fileName) : 'MP3, WAV u OGG, hasta 10 MB'}</small>
      <input type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,.mp3,.wav,.ogg" hidden>
    </div>
    <label class="field"><span>Volumen</span>
      <span class="al-num"><input type="range" min="0" max="100" step="5" data-f="volume" value="${t.volume ?? 70}"><output>${t.volume ?? 70} %</output></span></label>
    <label class="field"><span>Cortar el sonido a los</span>
      <span class="al-num"><input type="range" min="0" max="30" step="1" data-f="maxSeconds" value="${t.maxSeconds || 0}"><output>${t.maxSeconds ? `${t.maxSeconds} s` : 'completo'}</output></span></label>
    <label class="switch"><input type="checkbox" data-f="speak" ${t.speak ? 'checked' : ''}><span></span> Troya la lee en voz alta</label>
  </div>`;
}

function render() {
  const a = config.alerts;
  const big = a.bigGift;
  $('#al-rows').innerHTML = KINDS.map((k) => {
    const on = a.enabled[k.key] !== false;
    const extra = k.key === 'gift'
      ? `<label class="field"><span>Solo si valen al menos (diamantes)</span><input type="number" min="0" id="alert-mingift" value="${a.minGift ?? 1}"></label>`
      : '';
    const open = openRows.has(k.key);
    return `<div class="al-row ${on ? '' : 'off'} ${open ? 'open' : ''}" style="--c:${k.color}" data-row="${k.key}">
      <div class="al-head"><span class="ico">${k.icon}</span><span class="al-name"><b>${k.name}</b><small>${k.desc}</small></span>
        <span class="al-meta">${esc(summaryOf(k.key))}</span>
        <button type="button" class="btn small" data-sim-alert="${k.key}">Probar</button>
        <label class="switch" title="Activar o apagar"><input type="checkbox" data-alert="${k.key}" ${on ? 'checked' : ''}><span></span></label>
        <button type="button" class="al-toggle" data-toggle="${k.key}" aria-expanded="${open}" title="Ajustes de esta alerta"><span class="al-chev" aria-hidden="true"></span><span class="sr">Ajustes</span></button></div>
      ${settingsHTML(k.key, extra)}
    </div>`;
  }).join('');

  $('#al-big').innerHTML = `<div class="row space"><label class="switch big"><input type="checkbox" id="big-on" ${big.enabled ? 'checked' : ''}><span></span> Alerta especial para regalos grandes</label>
      <button type="button" class="btn small" data-sim-alert="bigGift">Probar</button></div>
    <p class="hint">Sale con brillo, en lugar de la alerta normal, cuando un regalo vale al menos lo que pongas aquí.</p>
    ${settingsHTML('bigGift', `<label class="field"><span>Desde (diamantes)</span><input type="number" min="1" data-f="min" value="${big.min ?? 500}"></label>`)}`;
  $('#al-big').classList.toggle('off', !big.enabled);

  $('#al-sound-on').checked = config.overlayStyle?.sound !== false;
}

function summaryOf(key) {
  const t = settings(key);
  return `${t.sound === 'file' ? 'Mi sonido' : t.sound === 'none' ? 'Sin sonido' : soundLabel(t.sound)} · ${t.fitSound ? 'según el sonido' : `${t.seconds ?? 5} s`}`;
}

function preview(key) {
  const t = settings(key);
  if (t.sound === 'file' && !t.file) return toast('Primero sube tu sonido');
  playAlertSound({ sound: t.sound, volume: t.volume ?? 70, maxSeconds: t.maxSeconds || 0, url: t.file ? `/alert-sounds/${t.file}` : '' });
}

async function upload(key, file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return toast('El sonido pesa más de 10 MB');
  const type = file.type || ({ mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' }[file.name.split('.').pop().toLowerCase()] || '');
  try {
    const res = await fetch(`/api/alerts/${key}/sound`, { method: 'POST', headers: { 'Content-Type': type, 'X-File-Name': encodeURIComponent(file.name) }, body: file });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    config.alerts = data.alerts;
    openRows.add(key);
    render();
    guideToast('troya', '¡Listo! Ese es tu sonido ahora. Pulsa ▶ para escucharlo.');
  } catch (e) {
    toast(e.message);
  }
}

// Barra de arriba: plataforma, Personalizadas / De serie, volumen general,
// probar y detener todo. Las alertas de serie se encienden por plataforma.
const PNAMES = { tiktok: 'TikTok', kick: 'Kick', twitch: 'Twitch', starvios: 'Starvios' };
function renderTop() {
  const mode = document.querySelector('[data-tabs="alertas"] [aria-selected="true"]')?.dataset.tab || 'propias';
  for (const b of $$('#al-mode [data-al-mode]')) b.setAttribute('aria-pressed', String(b.dataset.alMode === mode));
  $('#ar-plats').hidden = mode !== 'propias'; // las plataformas filtran tus alertas propias
  const mv = Number(config.alerts.masterVolume ?? 100);
  $('#al-master').value = mv;
  $('#al-master-val').textContent = `${mv}%`;
  const on = config.alerts.platforms || {};
  $('#al-platsw').innerHTML = `<span class="field-label">Alertas de serie en</span><div class="row wrap">${Object.entries(PNAMES).map(([p, n]) => `<label class="chip-check al-psw"><input type="checkbox" data-al-plat="${p}" ${on[p] !== false ? 'checked' : ''}><span><span class="pl plogo" data-logo="${p}" aria-hidden="true"></span>${n}</span></label>`).join('')}</div>`;
}

export function initAlerts(cfg) {
  config = cfg;
  render();
  renderTop();
  $('#al-mode').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-al-mode]');
    if (!b) return;
    document.querySelector(`[data-tabs="alertas"] [data-tab="${b.dataset.alMode}"]`)?.click();
    renderTop();
  });
  // Si la pestaña cambia por la dirección (#/alertas/serie), la barra se entera.
  const mo = new MutationObserver(() => renderTop());
  for (const t of $$('[data-tabs="alertas"] [data-tab]')) mo.observe(t, { attributes: true, attributeFilter: ['aria-selected'] });
  $('#al-master').addEventListener('input', (ev) => { $('#al-master-val').textContent = `${ev.target.value}%`; });
  $('#al-master').addEventListener('change', (ev) => {
    config.alerts.masterVolume = Number(ev.target.value);
    saveConfig({ alerts: { masterVolume: config.alerts.masterVolume } });
  });
  $('#al-test').addEventListener('click', () => api('POST', '/api/test/gift', {}).catch((e) => toast(e.message)));
  $('#al-stop').addEventListener('click', () => api('POST', '/api/alerts/control', { action: 'clear' }).then(() => toast('Alertas detenidas')).catch((e) => toast(e.message)));
  $('#al-platsw').addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-al-plat]');
    if (!el) return;
    config.alerts.platforms = { ...(config.alerts.platforms || {}), [el.dataset.alPlat]: el.checked };
    saveConfig({ alerts: { platforms: { [el.dataset.alPlat]: el.checked } } });
  });
  const page = $('#card-alertas');

  page.addEventListener('click', async (ev) => {
    const sim = ev.target.closest('[data-sim-alert]');
    if (sim) {
      const key = sim.dataset.simAlert;
      const body = key === 'bigGift'
        ? { user: { id: 'gran_fan', name: 'GranFan' }, amount: Number(config.alerts.bigGift.min) || 500, extra: { giftName: 'León', count: 1, currency: 'diamantes' } }
        : {};
      api('POST', `/api/test/${key === 'bigGift' ? 'gift' : key}`, body).catch((e) => toast(e.message));
      return;
    }
    const tg = ev.target.closest('[data-toggle]');
    if (tg) {
      const row = tg.closest('.al-row');
      const open = !row.classList.contains('open');
      row.classList.toggle('open', open);
      tg.setAttribute('aria-expanded', String(open));
      if (open) openRows.add(tg.dataset.toggle); else openRows.delete(tg.dataset.toggle);
      return;
    }
    const lib = ev.target.closest('[data-libpick]');
    if (lib) {
      const key = lib.dataset.libpick;
      const box = lib.closest('.al-set');
      const sel = box.querySelector('[data-f="sound"]');
      return openSoundPicker(settings(key).sound, (ref) => {
        save(key, { sound: ref });
        if (![...sel.options].some((o) => o.value === ref)) sel.insertAdjacentHTML('afterbegin', `<option value="${esc(ref)}">♪ ${esc(soundLabel(ref))}</option>`);
        sel.value = ref;
        box.querySelector('.al-file').hidden = true;
        preview(key);
        const meta = box.closest('.al-row')?.querySelector('.al-meta');
        if (meta) meta.textContent = summaryOf(key);
      });
    }
    const play = ev.target.closest('[data-play]');
    if (play) return preview(play.dataset.play);
    const up = ev.target.closest('[data-upload]');
    if (up) up.parentElement.querySelector('input[type=file]').click();
  });

  page.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.type !== 'range') return;
    const out = el.parentElement.querySelector('output');
    const v = Number(el.value);
    if (out) out.textContent = el.dataset.f === 'volume' ? `${v} %` : el.dataset.f === 'maxSeconds' && !v ? 'completo' : `${v} s`;
  });

  page.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.alert) {
      config.alerts.enabled[el.dataset.alert] = el.checked;
      el.closest('.al-row')?.classList.toggle('off', !el.checked);
      return saveConfig({ alerts: { enabled: { [el.dataset.alert]: el.checked } } });
    }
    if (el.id === 'alert-mingift') {
      config.alerts.minGift = Math.max(0, Number(el.value) || 0);
      return saveConfig({ alerts: { minGift: config.alerts.minGift } });
    }
    if (el.id === 'big-on') {
      save('bigGift', { enabled: el.checked });
      $('#al-big').classList.toggle('off', !el.checked);
      return;
    }
    if (el.id === 'al-sound-on') {
      config.overlayStyle = { ...config.overlayStyle, sound: el.checked };
      return saveConfig({ overlayStyle: { sound: el.checked } });
    }
    if (el.type === 'file') return upload(el.closest('.al-set').dataset.key, el.files[0]);
    const box = el.closest('.al-set');
    if (!box || !el.dataset.f) return;
    const key = box.dataset.key;
    const f = el.dataset.f;
    let v = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : Number(el.value);
    if (f === 'min') v = Math.max(1, v || 1);
    if (f === 'sound' && v === '__lib') {
      const prev = settings(key).sound;
      el.value = prev || 'campanita';
      openSoundPicker(prev, (ref) => {
        save(key, { sound: ref });
        el.insertAdjacentHTML('afterbegin', `<option value="${esc(ref)}">♪ ${esc(soundLabel(ref))}</option>`);
        el.value = ref;
        box.querySelector('.al-file').hidden = true;
        preview(key);
        const meta = box.closest('.al-row')?.querySelector('.al-meta');
        if (meta) meta.textContent = summaryOf(key);
      });
      return;
    }
    save(key, { [f]: v });
    if (f === 'fitSound') box.querySelector('[data-f="seconds"]').disabled = v;
    if (f === 'sound') {
      box.querySelector('.al-file').hidden = v !== 'file';
      if (v === 'file' && !settings(key).file) box.querySelector('input[type=file]').click();
      else preview(key);
    }
    const meta = box.closest('.al-row')?.querySelector('.al-meta');
    if (meta) meta.textContent = summaryOf(key);
  });
}
