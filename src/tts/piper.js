// Motor de voz Piper: voces neuronales que se ejecutan en tu PC, sin
// internet una vez descargadas y sin pagar nada por mensaje.
//
// - install():        descarga el motor (≈25 MB) desde GitHub.
// - installVoice(id): descarga una voz (60–120 MB) desde Hugging Face.
// - synth(text):      genera un WAV y devuelve su nombre de archivo.
//
// Para no recargar la voz en cada mensaje, mantenemos un proceso de Piper
// abierto en modo --json-input: le mandamos una línea JSON por mensaje y
// nos responde con la ruta del WAV generado.

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const readline = require('readline');
const { VOICES, ENGINE_RELEASE, ENGINE_ASSETS } = require('./voices');

function createPiperEngine({ dataDir, fetch: fetchFn = fetch, onState = () => {} }) {
  const root = path.join(dataDir, 'piper');
  const binDir = path.join(root, 'piper');
  const voicesDir = path.join(root, 'voices');
  const outDir = path.join(dataDir, 'tts-cache');
  const exe = path.join(binDir, process.platform === 'win32' ? 'piper.exe' : 'piper');
  for (const d of [root, voicesDir, outDir]) fs.mkdirSync(d, { recursive: true });

  let busy = null; // { task, label, pct }
  let lastError = '';
  const procs = new Map(); // clave "voz|velocidad" -> { key, child, pending, lastUsed }
  let counter = 0;

  // ---------- Estado ----------
  const voicePath = (id) => path.join(voicesDir, `${id}.onnx`);
  const voiceInstalled = (id) => fs.existsSync(voicePath(id)) && fs.existsSync(`${voicePath(id)}.json`);

  // Nombres de las variantes de una voz con varias (vienen en su .json).
  const namesCache = new Map();
  function speakerNames(id) {
    if (namesCache.has(id)) return namesCache.get(id);
    let names = [];
    try {
      const map = JSON.parse(fs.readFileSync(`${voicePath(id)}.json`, 'utf8')).speaker_id_map || {};
      for (const [name, i] of Object.entries(map)) names[i] = name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      names = [];
    }
    namesCache.set(id, names);
    return names;
  }

  function state() {
    return {
      installed: fs.existsSync(exe),
      supported: Boolean(ENGINE_ASSETS[`${process.platform}-${process.arch}`]),
      voices: VOICES.map((v) => {
        const installed = voiceInstalled(v.id);
        return {
          id: v.id, label: v.label, lang: v.lang, langName: v.langName, country: v.country, gender: v.gender,
          quality: v.quality, speakers: v.speakers, installed, speakerNames: installed && v.speakers > 1 ? speakerNames(v.id) : [],
        };
      }),
      busy,
      error: lastError,
    };
  }
  const emit = () => onState(state());

  function setBusy(task, label, pct = 0) {
    busy = task ? { task, label, pct } : null;
    emit();
  }

  // ---------- Descargas ----------
  async function download(url, dest, label) {
    let res;
    try {
      res = await fetchFn(url, { redirect: 'follow' });
    } catch {
      throw new Error(`No pude conectar con ${new URL(url).hostname} para descargar ${label}. Revisa tu internet.`);
    }
    if (!res.ok) throw new Error(`No se pudo descargar ${label} (HTTP ${res.status})`);
    const total = Number(res.headers.get('content-length')) || 0;
    const tmp = `${dest}.part`;
    const out = fs.createWriteStream(tmp);
    let done = 0;
    let lastPct = -1;
    try {
      const reader = res.body.getReader();
      for (;;) {
        const { done: end, value } = await reader.read();
        if (end) break;
        done += value.length;
        if (!out.write(Buffer.from(value))) await new Promise((r) => out.once('drain', r));
        const pct = total ? Math.floor((done / total) * 100) : 0;
        if (pct !== lastPct) {
          lastPct = pct;
          if (busy) {
            busy.pct = pct;
            busy.label = `${label}: ${(done / 1e6).toFixed(0)} MB${total ? ` de ${(total / 1e6).toFixed(0)} MB` : ''}`;
            emit();
          }
        }
      }
      await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
      fs.renameSync(tmp, dest);
    } catch (err) {
      out.destroy();
      fs.rmSync(tmp, { force: true });
      throw err;
    }
  }

  async function extract(file) {
    if (file.endsWith('.zip')) {
      const AdmZip = require('adm-zip');
      new AdmZip(file).extractAllTo(root, true);
    } else {
      await new Promise((resolve, reject) =>
        execFile('tar', ['-xzf', file, '-C', root], (err) => (err ? reject(err) : resolve()))
      );
    }
    if (process.platform !== 'win32') fs.chmodSync(exe, 0o755);
  }

  async function install() {
    if (busy) throw new Error('Ya hay una descarga en curso');
    const asset = ENGINE_ASSETS[`${process.platform}-${process.arch}`];
    if (!asset) throw new Error('Piper no tiene versión para este sistema');
    lastError = '';
    setBusy('engine', 'Motor de voz');
    const file = path.join(root, asset);
    try {
      await download(`${ENGINE_RELEASE}/${asset}`, file, 'Motor de voz');
      setBusy('engine', 'Descomprimiendo…', 100);
      await extract(file);
      if (!fs.existsSync(exe)) throw new Error('El paquete de Piper no trae el ejecutable esperado');
    } catch (err) {
      lastError = err.message;
      throw err;
    } finally {
      fs.rmSync(file, { force: true });
      setBusy(null);
    }
  }

  async function installVoice(id) {
    const v = VOICES.find((x) => x.id === id);
    if (!v) throw new Error(`Voz desconocida: ${id}`);
    if (busy) throw new Error('Ya hay una descarga en curso');
    lastError = '';
    setBusy('voice', v.label);
    try {
      await download(v.config, `${voicePath(id)}.json`, `${v.label} (configuración)`);
      await download(v.model, voicePath(id), v.label);
    } catch (err) {
      fs.rmSync(voicePath(id), { force: true });
      fs.rmSync(`${voicePath(id)}.json`, { force: true });
      lastError = err.message;
      throw err;
    } finally {
      setBusy(null);
    }
  }

  // ---------- Procesos de Piper ----------
  // Un proceso por voz (y velocidad). Se mantienen abiertos los últimos
  // MAX_PROCS usados para que varias voces por espectador no tengan que
  // recargarse en cada mensaje; el más antiguo se cierra si hace falta.
  const MAX_PROCS = 3;

  function killProc(p, reason = 'Piper se reinició') {
    procs.delete(p.key);
    for (const req of p.pending) req.reject(new Error(reason));
    p.pending = [];
    p.child.kill();
  }

  function stopProcess() {
    for (const p of [...procs.values()]) killProc(p);
  }

  function startProcess(voiceId, lengthScale) {
    const key = `${voiceId}|${lengthScale}`;
    const existing = procs.get(key);
    if (existing && existing.child.exitCode === null) {
      existing.lastUsed = Date.now();
      return existing;
    }
    while (procs.size >= MAX_PROCS) {
      const oldest = [...procs.values()].filter((p) => !p.pending.length).sort((a, b) => a.lastUsed - b.lastUsed)[0]
        || [...procs.values()].sort((a, b) => a.lastUsed - b.lastUsed)[0];
      killProc(oldest);
    }

    const child = spawn(
      exe,
      ['--model', voicePath(voiceId), '--json-input', '--output_dir', outDir, '--length_scale', String(lengthScale), '--espeak_data', path.join(binDir, 'espeak-ng-data'), '--quiet'],
      { cwd: binDir, windowsHide: true }
    );
    const p = { key, child, pending: [], lastUsed: Date.now() };
    procs.set(key, p);

    // Piper escribe en stdout la ruta del WAV cuando termina cada línea.
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      const req = p.pending.shift();
      if (!req) return;
      clearTimeout(req.timer);
      req.resolve(line.trim());
    });
    // Si Piper se cae, escribirle daría EPIPE: lo absorbemos para que no
    // tumbe la app; los mensajes pendientes se rechazan al salir el proceso.
    child.stdin.on('error', () => {});
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr = (stderr + d).slice(-500);
    });
    child.on('error', (err) => {
      // No arrancó (p. ej. un antivirus lo bloqueó): fallamos al instante
      // para que el mensaje se lea con la voz de Windows.
      lastError = `Piper no arrancó: ${err.message}`;
      for (const req of p.pending) {
        clearTimeout(req.timer);
        req.reject(new Error(lastError));
      }
      p.pending = [];
      if (procs.get(key) === p) procs.delete(key);
      emit();
    });
    child.on('exit', (code) => {
      for (const req of p.pending) req.reject(new Error(`Piper se cerró (código ${code}). ${stderr.trim()}`));
      p.pending = [];
      if (procs.get(key) === p) procs.delete(key);
    });
    return p;
  }

  function cleanupCache() {
    const limit = Date.now() - 10 * 60 * 1000;
    for (const f of fs.readdirSync(outDir)) {
      const full = path.join(outDir, f);
      try {
        if (fs.statSync(full).mtimeMs < limit) fs.rmSync(full, { force: true });
      } catch {
        /* lo borró otro proceso */
      }
    }
  }

  // Devuelve el nombre del WAV generado dentro de outDir.
  function synth(text, { voiceId, speaker = 0, rate = 1 } = {}) {
    if (!fs.existsSync(exe)) return Promise.reject(new Error('El motor de voz no está instalado'));
    if (!voiceInstalled(voiceId)) return Promise.reject(new Error('Esa voz no está descargada'));
    cleanupCache();

    // rate 2 = el doble de rápido => length_scale 0.5
    const lengthScale = Math.round(Math.min(2, Math.max(0.5, 1 / (Number(rate) || 1))) * 100) / 100;
    const p = startProcess(voiceId, lengthScale);
    counter += 1;
    const name = `tts-${Date.now()}-${counter}.wav`;

    return new Promise((resolve, reject) => {
      const req = {
        resolve: (outPath) => resolve(path.basename(outPath || name)),
        reject,
        timer: setTimeout(() => killProc(p, 'Piper tardó demasiado'), 30000),
      };
      p.pending.push(req);
      const line = { text, output_file: path.join(outDir, name) };
      const v = VOICES.find((x) => x.id === voiceId);
      if (v && v.speakers > 1) line.speaker_id = Math.min(v.speakers - 1, Math.max(0, Number(speaker) || 0));
      p.child.stdin.write(`${JSON.stringify(line)}\n`);
    });
  }

  function isReady(voiceId) {
    return fs.existsSync(exe) && voiceInstalled(voiceId);
  }

  // Todas las voces disponibles como "id#variante" (para voces por espectador).
  function installedVoiceKeys() {
    if (!fs.existsSync(exe)) return [];
    return VOICES.filter((v) => voiceInstalled(v.id)).flatMap((v) => Array.from({ length: v.speakers }, (_, i) => `${v.id}#${i}`));
  }

  return { state, install, installVoice, synth, isReady, installedVoiceKeys, stop: stopProcess, outDir };
}

module.exports = { createPiperEngine };
