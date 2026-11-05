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

function tone(c, out, { type = 'sine', f, f2, t, d, v = 0.3, a = 0.01, vib = 0, vibHz = 6, glide = 0 }) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + (glide || d));
  if (vib) {
    // Vibrato: un oscilador lento mueve la frecuencia (resortes, trombón, sirenas).
    const l = c.createOscillator();
    const lg = c.createGain();
    l.frequency.value = vibHz;
    lg.gain.value = vib;
    l.connect(lg).connect(o.frequency);
    l.start(t);
    l.stop(t + d + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + d + 0.05);
}

function noise(c, out, { t, d, v = 0.25, from = 800, to = 4000, q = 1.2, type = 'bandpass' }) {
  const len = Math.ceil(c.sampleRate * d);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = type;
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
  // ---------- Biblioteca de Satronho (0.16): hechos por código, son nuestros ----------
  boing(c, o, t) { tone(c, o, { f: 140, f2: 520, t, d: 0.6, v: 0.45, vib: 60, vibHz: 18, glide: 0.25 }); return 0.65; },
  resorte(c, o, t) { tone(c, o, { type: 'triangle', f: 300, t, d: 0.9, v: 0.35, vib: 120, vibHz: 22 }); return 0.95; },
  trombonTriste(c, o, t) {
    [[392, 0, 0.45], [370, 0.5, 0.45], [349, 1.0, 0.45], [330, 1.5, 1.3]].forEach(([f, dt, d], i) => {
      tone(c, o, { type: 'sawtooth', f, t: t + dt, d, v: 0.14, a: 0.04, vib: i === 3 ? 9 : 0, vibHz: 5 });
      tone(c, o, { type: 'triangle', f: f / 2, t: t + dt, d, v: 0.12, a: 0.04 });
    });
    return 2.9;
  },
  pitoSube(c, o, t) { tone(c, o, { f: 380, f2: 1900, t, d: 0.75, v: 0.3, vib: 14, vibHz: 7 }); return 0.8; },
  pitoBaja(c, o, t) { tone(c, o, { f: 1900, f2: 380, t, d: 0.75, v: 0.3, vib: 14, vibHz: 7 }); return 0.8; },
  pedorreta(c, o, t) {
    tone(c, o, { type: 'sawtooth', f: 95, f2: 62, t, d: 0.75, v: 0.35, vib: 18, vibHz: 28 });
    noise(c, o, { t, d: 0.7, v: 0.12, from: 180, to: 90, q: 2, type: 'lowpass' });
    return 0.8;
  },
  pop(c, o, t) { tone(c, o, { f: 900, f2: 160, t, d: 0.09, v: 0.5, a: 0.002 }); return 0.12; },
  besito(c, o, t) { noise(c, o, { t, d: 0.06, v: 0.3, from: 3000, to: 5000 }); tone(c, o, { f: 700, f2: 1800, t: t + 0.03, d: 0.12, v: 0.25 }); return 0.2; },
  pato(c, o, t) { [0, 0.22].forEach((dt) => tone(c, o, { type: 'square', f: 520, f2: 380, t: t + dt, d: 0.16, v: 0.13, vib: 40, vibHz: 30 })); return 0.45; },
  bocina(c, o, t) { [0, 0.3].forEach((dt) => { tone(c, o, { type: 'square', f: 330, t: t + dt, d: 0.22, v: 0.1 }); tone(c, o, { type: 'square', f: 415, t: t + dt, d: 0.22, v: 0.08 }); }); return 0.6; },
  grillos(c, o, t) { for (let i = 0; i < 9; i++) [0, 0.05, 0.1].forEach((dt) => tone(c, o, { f: 4400, t: t + i * 0.32 + dt, d: 0.035, v: 0.07, a: 0.004 })); return 3; },
  caidaCartoon(c, o, t) { tone(c, o, { f: 1400, f2: 120, t, d: 1.1, v: 0.28 }); tone(c, o, { f: 70, f2: 40, t: t + 1.1, d: 0.35, v: 0.6, a: 0.003 }); noise(c, o, { t: t + 1.1, d: 0.3, v: 0.25, from: 300, to: 120, type: 'lowpass' }); return 1.5; },
  sospechoso(c, o, t) {
    [[146.8, 0], [138.6, 0.55]].forEach(([f, dt], i) => {
      tone(c, o, { type: 'sawtooth', f, t: t + dt, d: i ? 1.6 : 0.5, v: 0.16, a: 0.01 });
      tone(c, o, { f: f / 2, t: t + dt, d: i ? 1.6 : 0.5, v: 0.4, a: 0.01 });
    });
    tone(c, o, { type: 'triangle', f: 207.7, t: t + 0.55, d: 1.6, v: 0.08, a: 0.2 });
    return 2.2;
  },
  suspenso(c, o, t) { tone(c, o, { f: 55, t, d: 2.6, v: 0.4, a: 0.6 }); tone(c, o, { type: 'triangle', f: 233, f2: 247, t, d: 2.6, v: 0.08, a: 1, vib: 3, vibHz: 4 }); tone(c, o, { type: 'triangle', f: 329.6, t: t + 0.8, d: 1.8, v: 0.06, a: 0.8 }); return 2.7; },
  misterio(c, o, t) { tone(c, o, { f: 660, f2: 990, t, d: 1.2, v: 0.18, vib: 18, vibHz: 6 }); tone(c, o, { f: 990, f2: 520, t: t + 1.2, d: 1.2, v: 0.18, vib: 18, vibHz: 6 }); return 2.5; },
  latidoRapido(c, o, t) { for (let i = 0; i < 6; i++) [0, 0.16].forEach((dt) => tone(c, o, { f: 110, f2: 55, t: t + i * 0.42 + dt, d: 0.14, v: 0.6, a: 0.004 })); return 2.6; },
  tension(c, o, t) { noise(c, o, { t, d: 2.2, v: 0.25, from: 200, to: 5000, q: 3 }); tone(c, o, { type: 'sawtooth', f: 80, f2: 320, t, d: 2.2, v: 0.08, a: 1.5 }); return 2.3; },
  sirena(c, o, t) { tone(c, o, { type: 'triangle', f: 850, t, d: 2.4, v: 0.25, vib: 260, vibHz: 1.6 }); return 2.4; },
  golpeDramatico(c, o, t) {
    [[196, 0, 0.35], [196, 0.42, 0.35], [155.6, 0.84, 1.8]].forEach(([f, dt, d]) => {
      tone(c, o, { type: 'sawtooth', f, t: t + dt, d, v: 0.14, a: 0.01 });
      tone(c, o, { type: 'sawtooth', f: f * 1.5, t: t + dt, d, v: 0.06, a: 0.01 });
      tone(c, o, { f: f / 2, t: t + dt, d, v: 0.35, a: 0.01 });
    });
    return 2.7;
  },
  boomGrave(c, o, t) { tone(c, o, { f: 90, f2: 38, t, d: 1.6, v: 0.85, a: 0.003, glide: 0.4 }); noise(c, o, { t, d: 0.18, v: 0.35, from: 900, to: 200, type: 'lowpass' }); return 1.7; },
  impactoCine(c, o, t) { noise(c, o, { t, d: 2, v: 0.45, from: 4000, to: 60, q: 0.6, type: 'lowpass' }); tone(c, o, { f: 70, f2: 28, t, d: 2, v: 0.7, a: 0.003 }); return 2.1; },
  redoble(c, o, t) { for (let i = 0; i < 34; i++) noise(c, o, { t: t + i * 0.045, d: 0.05, v: 0.12 + i * 0.006, from: 900, to: 1800, q: 0.8 }); noise(c, o, { t: t + 1.6, d: 1.4, v: 0.4, from: 6000, to: 9000, q: 0.5 }); tone(c, o, { f: 80, f2: 50, t: t + 1.6, d: 0.4, v: 0.6 }); return 3; },
  gong(c, o, t) { [1, 2.76, 5.4, 8.9].forEach((m, i) => tone(c, o, { f: 98 * m, t, d: 3.2 - i * 0.5, v: 0.22 / (i + 1), a: 0.01, vib: 1.5, vibHz: 3 })); return 3.2; },
  revelacion(c, o, t) { [261.6, 329.6, 392, 523.3].forEach((f) => { tone(c, o, { type: 'triangle', f, t, d: 2.4, v: 0.1, a: 1.2 }); tone(c, o, { f: f * 2, t, d: 2.4, v: 0.04, a: 1.4, vib: 4, vibHz: 5 }); }); return 2.5; },
  salto8bit(c, o, t) { tone(c, o, { type: 'square', f: 280, f2: 820, t, d: 0.18, v: 0.12, a: 0.003 }); return 0.22; },
  vidaExtra(c, o, t) { [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone(c, o, { type: 'square', f, t: t + i * 0.09, d: 0.11, v: 0.1, a: 0.003 })); return 0.7; },
  powerUp8bit(c, o, t) { for (let i = 0; i < 10; i++) tone(c, o, { type: 'square', f: 300 * Math.pow(1.12, i), t: t + i * 0.045, d: 0.06, v: 0.1, a: 0.002 }); return 0.55; },
  gameOver8bit(c, o, t) { [[523, 0], [392, 0.25], [330, 0.5], [262, 0.75]].forEach(([f, dt], i) => tone(c, o, { type: 'square', f, t: t + dt, d: i === 3 ? 0.8 : 0.22, v: 0.11, a: 0.003, vib: i === 3 ? 6 : 0 })); return 1.6; },
  laser8bit(c, o, t) { tone(c, o, { type: 'square', f: 1400, f2: 180, t, d: 0.28, v: 0.11, a: 0.002 }); return 0.3; },
  explosion8bit(c, o, t) { noise(c, o, { t, d: 0.9, v: 0.55, from: 1800, to: 60, q: 0.4, type: 'lowpass' }); return 0.95; },
  victoria8bit(c, o, t) { [[523, 0, 0.12], [659, 0.13, 0.12], [784, 0.26, 0.12], [1047, 0.39, 0.5], [784, 0.62, 0.12], [1047, 0.75, 0.7]].forEach(([f, dt, d]) => tone(c, o, { type: 'square', f, t: t + dt, d, v: 0.1, a: 0.003 })); return 1.5; },
  tada(c, o, t) { [523.3, 659.3, 784, 1046.5].forEach((f) => { tone(c, o, { type: 'sawtooth', f, t, d: 0.12, v: 0.06 }); tone(c, o, { type: 'sawtooth', f, t: t + 0.15, d: 1.2, v: 0.06, a: 0.02 }); }); return 1.4; },
  confeti(c, o, t) { for (let i = 0; i < 14; i++) tone(c, o, { f: 1200 + Math.random() * 2400, t: t + Math.random() * 0.9, d: 0.18, v: 0.07, a: 0.003 }); noise(c, o, { t, d: 0.25, v: 0.3, from: 2000, to: 6000 }); return 1.2; },
  timbre(c, o, t) { tone(c, o, { f: 784, t, d: 0.9, v: 0.3 }); tone(c, o, { f: 622, t: t + 0.45, d: 1.1, v: 0.3 }); return 1.6; },
  cuentaAtras(c, o, t) { [0, 1, 2].forEach((i) => tone(c, o, { type: 'square', f: 880, t: t + i * 0.6, d: 0.12, v: 0.1 })); tone(c, o, { type: 'square', f: 1760, t: t + 1.8, d: 0.6, v: 0.1 }); return 2.4; },
  notificacion(c, o, t) { tone(c, o, { f: 1046, t, d: 0.15, v: 0.25 }); tone(c, o, { f: 1568, t: t + 0.1, d: 0.35, v: 0.25 }); return 0.5; },
  incorrecto(c, o, t) { tone(c, o, { type: 'sawtooth', f: 120, t, d: 0.75, v: 0.2 }); tone(c, o, { type: 'square', f: 126, t, d: 0.75, v: 0.1 }); return 0.8; },
  error8bit(c, o, t) { tone(c, o, { type: 'square', f: 220, t, d: 0.14, v: 0.12 }); tone(c, o, { type: 'square', f: 165, t: t + 0.16, d: 0.3, v: 0.12 }); return 0.5; },
  vidrioRoto(c, o, t) { noise(c, o, { t, d: 0.6, v: 0.4, from: 6000, to: 3000, q: 0.6 }); for (let i = 0; i < 8; i++) tone(c, o, { f: 2500 + Math.random() * 3500, t: t + 0.05 + Math.random() * 0.4, d: 0.12, v: 0.05, a: 0.002 }); return 0.75; },
  latigazo(c, o, t) { noise(c, o, { t, d: 0.18, v: 0.5, from: 1200, to: 7000, q: 0.8 }); tone(c, o, { f: 2400, f2: 600, t: t + 0.12, d: 0.08, v: 0.2 }); return 0.3; },
  whoosh(c, o, t) { noise(c, o, { t, d: 0.6, v: 0.35, from: 300, to: 3000, q: 1 }); return 0.65; },
};

// Metadatos de los sonidos hechos por código para la biblioteca.
export const SYNTH_LIB = [
  ['boing', 'Boing elástico', 'graciosos', 'resorte rebote caricatura'], ['resorte', 'Resorte loco', 'graciosos', 'boing caricatura'],
  ['trombonTriste', 'Trombón triste', 'fallos', 'fail perder wah wah triste'], ['pitoSube', 'Pito que sube', 'graciosos', 'silbato subir caricatura'],
  ['pitoBaja', 'Pito que baja', 'graciosos', 'silbato bajar caer caricatura'], ['pedorreta', 'Pedorreta', 'graciosos', 'pedo grosero chistoso'],
  ['pop', 'Pop', 'graciosos', 'burbuja plop'], ['besito', 'Besito', 'graciosos', 'beso muack amor'], ['pato', 'Patito', 'graciosos', 'cuac pato'],
  ['bocina', 'Bocina de payaso', 'graciosos', 'honk payaso pito'], ['grillos', 'Grillos incómodos', 'graciosos', 'silencio incómodo cri cri nadie'],
  ['caidaCartoon', 'Caída de caricatura', 'graciosos', 'caer fail golpe'], ['sospechoso', 'Sospechoso', 'sospechosos', 'sus sospecha impostor dun dun'],
  ['suspenso', 'Suspenso', 'sospechosos', 'tensión miedo misterio'], ['misterio', 'Misterio fantasmal', 'sospechosos', 'fantasma theremin raro'],
  ['latidoRapido', 'Corazón acelerado', 'sospechosos', 'latido nervios miedo'], ['tension', 'Tensión que sube', 'sospechosos', 'suspenso subir miedo'],
  ['sirena', 'Sirena', 'alertas', 'policía alarma emergencia'], ['golpeDramatico', 'Golpe dramático', 'dramaticos', 'dun dun dun drama telenovela'],
  ['boomGrave', 'Boom grave', 'dramaticos', 'boom impacto meme'], ['impactoCine', 'Impacto de película', 'dramaticos', 'trailer cine boom'],
  ['redoble', 'Redoble de tambor', 'celebracion', 'tambor platillo ba dum tss anuncio'], ['gong', 'Gong', 'dramaticos', 'campana oriental'],
  ['revelacion', 'Revelación', 'dramaticos', 'coro ángel milagro'], ['salto8bit', 'Salto de 8 bits', 'videojuegos', 'brincar retro mario'],
  ['vidaExtra', 'Vida extra', 'videojuegos', '1up retro bonus'], ['powerUp8bit', 'Power up de 8 bits', 'videojuegos', 'mejora retro subir'],
  ['gameOver8bit', 'Game over de 8 bits', 'fallos', 'perder retro fin'], ['laser8bit', 'Láser de 8 bits', 'videojuegos', 'pew disparo retro'],
  ['explosion8bit', 'Explosión de 8 bits', 'videojuegos', 'boom retro bomba'], ['victoria8bit', 'Victoria de 8 bits', 'celebracion', 'ganar retro fanfarria'],
  ['tada', 'Tadá', 'celebracion', 'sorpresa presentar listo'], ['confeti', 'Confeti', 'celebracion', 'fiesta brillos'],
  ['timbre', 'Timbre ding dong', 'alertas', 'puerta llegó visita'], ['cuentaAtras', 'Cuenta atrás', 'alertas', 'beep inicio carrera'],
  ['notificacion', 'Notificación', 'alertas', 'aviso mensaje'], ['incorrecto', 'Incorrecto', 'fallos', 'buzzer error mal'],
  ['error8bit', 'Error de 8 bits', 'fallos', 'retro mal'], ['vidrioRoto', 'Vidrio roto', 'golpes', 'romper crash'],
  ['latigazo', 'Latigazo', 'golpes', 'látigo whip'], ['whoosh', 'Whoosh', 'alertas', 'viento pasar transición'],
  ['campanita', 'Campanita', 'alertas', 'campana aviso'], ['brillo', 'Brillo', 'alertas', 'magia estrellas'], ['burbuja', 'Burbuja', 'alertas', 'pop'],
  ['moneda', 'Moneda', 'videojuegos', 'dinero retro coin'], ['latido', 'Latido', 'sospechosos', 'corazón'], ['zas', 'Zas', 'alertas', 'whoosh'],
  ['fanfarria', 'Fanfarria', 'celebracion', 'victoria trompeta'], ['aplauso', 'Aplausos', 'celebracion', 'público aplaudir'],
].map(([id, name, cat, tags]) => ({ id, name, cat, tags, synth: true, by: 'Satronho' }));

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
  // Biblioteca: «k:<id>» viene con la app; «m:<id>» es de «Mis sonidos».
  if (/^k:/.test(sound)) { url = `/sfx/${encodeURIComponent(sound.slice(2))}.ogg`; sound = 'file'; }
  else if (/^m:/.test(sound)) { url = `/my-sounds/${encodeURIComponent(sound.slice(2))}`; sound = 'file'; }
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
