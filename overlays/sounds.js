// Sonidos de las alertas. Los incluidos se generan con WebAudio (sin
// archivos, sin licencias de terceros); también se puede usar un archivo
// propio que el streamer sube en la app.
//
// playAlertSound({ sound, volume, maxSeconds, url }) -> Promise<segundos>
//   sound: id de SOUNDS, 'file' (usa url) o 'none'
//   volume: 0–100
//   maxSeconds: corta el sonido a los N segundos (0 = completo)

export const SOUNDS = {
  campanita: 'Campanita',
  brillo: 'Brillo',
  burbuja: 'Burbuja',
  moneda: 'Moneda',
  latido: 'Latido',
  zas: 'Zas',
  fanfarria: 'Fanfarria',
  aplauso: 'Aplausos',
};

let ctx;
const audio = () => (ctx ??= new AudioContext());

function tone(c, out, { type = 'sine', f, f2, t, d, v = 0.3, a = 0.01 }) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + d + 0.05);
}

function noise(c, out, { t, d, v = 0.25, from = 800, to = 4000, q = 1.2 }) {
  const len = Math.ceil(c.sampleRate * d);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + d);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + d * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  src.stop(t + d);
}

// Cada receta dibuja su sonido y devuelve cuánto dura (segundos).
const RECIPES = {
  campanita(c, o, t) {
    [0, 0.12, 0.24].forEach((dt, i) => tone(c, o, { type: 'triangle', f: 660 * [1, 1.25, 1.5][i], t: t + dt, d: 0.5, v: 0.28 }));
    return 0.8;
  },
  brillo(c, o, t) {
    [1568, 2093, 2637, 3136, 2637].forEach((f, i) => tone(c, o, { f, t: t + i * 0.07, d: 0.35, v: 0.16, a: 0.005 }));
    return 0.75;
  },
  burbuja(c, o, t) {
    tone(c, o, { f: 280, f2: 900, t, d: 0.18, v: 0.35 });
    tone(c, o, { f: 420, f2: 1300, t: t + 0.14, d: 0.16, v: 0.25 });
    return 0.35;
  },
  moneda(c, o, t) {
    tone(c, o, { type: 'square', f: 988, t, d: 0.09, v: 0.12, a: 0.003 });
    tone(c, o, { type: 'square', f: 1319, t: t + 0.08, d: 0.45, v: 0.12, a: 0.003 });
    return 0.55;
  },
  latido(c, o, t) {
    [0, 0.28].forEach((dt) => tone(c, o, { f: 110, f2: 55, t: t + dt, d: 0.22, v: 0.6, a: 0.004 }));
    return 0.6;
  },
  zas(c, o, t) {
    noise(c, o, { t, d: 0.45, v: 0.35, from: 400, to: 6000, q: 0.9 });
    tone(c, o, { type: 'triangle', f: 1046, t: t + 0.32, d: 0.35, v: 0.2 });
    return 0.7;
  },
  fanfarria(c, o, t) {
    const notes = [[523, 0, 0.18], [523, 0.2, 0.12], [659, 0.34, 0.18], [784, 0.54, 0.9]];
    for (const [f, dt, d] of notes) {
      tone(c, o, { type: 'sawtooth', f, t: t + dt, d, v: 0.09, a: 0.02 });
      tone(c, o, { type: 'triangle', f: f / 2, t: t + dt, d, v: 0.12, a: 0.02 });
    }
    return 1.5;
  },
  aplauso(c, o, t) {
    for (let i = 0; i < 26; i++) noise(c, o, { t: t + i * 0.055 + Math.random() * 0.03, d: 0.06, v: 0.22, from: 1500, to: 2500, q: 0.7 });
    return 1.6;
  },
};

// Lo que está sonando, para poder cortarlo (barra derecha → «Cortar alerta»).
const playing = new Set();
export function stopAlertSound() {
  for (const x of playing) {
    try { if (x.pause) x.pause(); else { x.gain.cancelScheduledValues(0); x.gain.value = 0; } } catch { /* ya terminó */ }
  }
  playing.clear();
}

export async function playAlertSound({ sound = 'campanita', volume = 70, maxSeconds = 0, url = '' } = {}) {
  if (sound === 'none' || volume <= 0) return 0;
  const vol = Math.max(0, Math.min(100, volume)) / 100;

  if (sound === 'file') {
    if (!url) return 0;
    const el = new Audio(url);
    el.volume = vol;
    playing.add(el);
    el.addEventListener('ended', () => playing.delete(el), { once: true });
    const length = await new Promise((resolve) => {
      el.addEventListener('loadedmetadata', () => resolve(el.duration || 0), { once: true });
      el.addEventListener('error', () => resolve(0), { once: true });
      setTimeout(() => resolve(0), 4000);
    });
    try {
      await Promise.race([el.play(), new Promise((_, no) => setTimeout(() => no(new Error('sin audio')), 1500))]);
    } catch {
      return 0;
    }
    const play = maxSeconds > 0 && length ? Math.min(length, maxSeconds) : length;
    if (maxSeconds > 0) {
      // Bajar el volumen al final en vez de cortar en seco.
      const fade = Math.min(0.4, maxSeconds / 4);
      setTimeout(() => {
        const step = el.volume / 8;
        const iv = setInterval(() => {
          el.volume = Math.max(0, el.volume - step);
          if (el.volume <= 0.001) { clearInterval(iv); el.pause(); }
        }, (fade * 1000) / 8);
      }, Math.max(0, (maxSeconds - fade) * 1000));
    }
    return play;
  }

  const recipe = RECIPES[sound] || RECIPES.campanita;
  try {
    const c = audio();
    // Nunca esperar más de un instante: si el navegador no deja sonar, la
    // alerta sale igual (en OBS el audio siempre está permitido).
    if (c.state === 'suspended') await Promise.race([c.resume().catch(() => {}), new Promise((r) => setTimeout(r, 250))]);
    const out = c.createGain();
    out.gain.value = vol;
    out.connect(c.destination);
    playing.add(out);
    setTimeout(() => playing.delete(out), 8000);
    const t = c.currentTime + 0.02;
    const length = recipe(c, out, t);
    if (maxSeconds > 0 && maxSeconds < length) {
      out.gain.setValueAtTime(vol, t + Math.max(0, maxSeconds - 0.15));
      out.gain.linearRampToValueAtTime(0, t + maxSeconds);
      return maxSeconds;
    }
    return length;
  } catch {
    return 0;
  }
}
