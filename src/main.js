// Satronho Bot · © 2026 RiddsSatronho. Todos los derechos reservados.
//
// Proceso principal de Electron: arranca el servidor local y abre la
// ventana del panel. La configuración y las estadísticas se guardan en
// %APPDATA%/Satronho Bot.
//
// Distribución (idea tomada de cómo se distribuye OverInteractive): la app
// se publica como carpeta portable con Velopack, que la actualiza sola
// descargando las versiones nuevas desde la dirección `updates.feedUrl`.

// Velopack debe ser lo PRIMERO que corre: en la instalación o al aplicar
// una actualización puede ejecutar tareas y cerrar el proceso.
let velopack = null;
try {
  velopack = require('velopack');
  velopack.VelopackApp.build().run();
} catch {
  velopack = null; // en desarrollo (npm start) no hay instalación de Velopack
}

const path = require('path');
const { app, BrowserWindow, shell, dialog, net, Tray, Menu, nativeImage, safeStorage } = require('electron');
const { Store } = require('./store');
const { createServer } = require('./server');

const APP_ID = 'com.riddssatronho.satronhobot';
let server = null;
let win = null;
let pendingUpdate = null;
let tray = null;
let quitting = false;

app.setName('Satronho Bot');
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

// La música y la voz deben sonar sin que tengas que hacer clic antes.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// ---------- Actualizaciones ----------
// Dónde se publican las versiones: el repositorio de GitHub de package.json
// (satronho.updateRepo) o, si el streamer la cambia, Ajustes → Actualizaciones.
//  - Instalada con Velopack: descarga sola y muestra «Reiniciar y actualizar».
//  - Portable simple (.zip): solo avisa y lleva a la página de descarga.
const pkg = require('../package.json');
const feedOf = (store) => (store.get('updates').feedUrl || pkg.satronho?.updateRepo || '').trim();

const newer = (a, b) => {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};

// Aviso para el portable: mira la última versión publicada en GitHub.
async function checkNotice(feed) {
  const m = /github\.com\/([^/]+)\/([^/#?]+)/i.exec(feed);
  if (!m) return;
  const res = await net.fetch(`https://api.github.com/repos/${m[1]}/${m[2].replace(/\.git$/, '')}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SatronhoBot' },
  });
  if (!res.ok) return;
  const rel = await res.json();
  const version = String(rel.tag_name || '').replace(/^v/, '');
  if (version && newer(version, app.getVersion())) {
    server.notify('update', { state: 'available', version, url: rel.html_url, notes: String(rel.body || '').slice(0, 400) });
  }
}

let checking = false;
async function checkForUpdates(store) {
  const feed = feedOf(store);
  const { auto } = store.get('updates');
  if (!feed || checking || pendingUpdate) return;
  checking = true;
  try {
    let um = null;
    if (velopack) {
      try {
        um = new velopack.UpdateManager(feed);
        um.getCurrentVersion(); // falla si no está instalada con Velopack
      } catch {
        um = null;
      }
    }
    if (!um) return await checkNotice(feed);
    const info = await um.checkForUpdatesAsync();
    if (!info) return;
    const version = info.targetFullRelease?.version || 'nueva';
    if (!auto) {
      server.notify('update', { state: 'available', version, url: '' });
      return;
    }
    server.notify('update', { state: 'downloading', version, pct: 0 });
    await um.downloadUpdateAsync(info, (pct) => server.notify('update', { state: 'downloading', version, pct }));
    pendingUpdate = { um, info, version };
    server.notify('update', { state: 'ready', version });
  } catch (err) {
    server?.notify('update', { state: 'error', message: String(err?.message || err) });
  } finally {
    checking = false;
  }
}

function applyUpdate() {
  if (!pendingUpdate) return false;
  // Velopack espera a que cerremos, aplica la versión y vuelve a abrir.
  pendingUpdate.um.waitExitThenApplyUpdate(pendingUpdate.info, false, true);
  setTimeout(() => app.quit(), 200);
  return true;
}

// ---------- Junto al reloj (opcional, apagado por defecto) ----------
// La app nunca se abre sola. Si el streamer lo activa en Ajustes → App,
// al minimizar se esconde junto al reloj de Windows y sigue funcionando.
function showWindow() {
  if (!win) return;
  win.show();
  if (win.isMinimized()) win.restore();
  win.focus();
}

function ensureTray() {
  if (tray) return tray;
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Satronho Bot');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Satronho Bot', click: showWindow },
      { type: 'separator' },
      { label: 'Salir', click: () => { quitting = true; app.quit(); } },
    ])
  );
  tray.on('click', showWindow);
  return tray;
}

function applyWindowConfig(cfg) {
  if (!cfg?.minimizeToTray && tray) {
    tray.destroy();
    tray = null;
    if (win && !win.isVisible()) showWindow();
  }
}

// ---------- Autorizar cuentas de Kick ----------
// Cada cuenta (SatronhoBot o la tuya) tiene su propia sesión guardada, así
// entras como SatronhoBot aquí sin cerrar tu sesión en el navegador.
function openAuthWindow(url, account) {
  const auth = new BrowserWindow({
    parent: win || undefined,
    width: 520,
    height: 780,
    title: account === 'bot' ? 'Autorizar la cuenta aparte en Kick' : 'Autorizar tu cuenta de Kick',
    autoHideMenuBar: true,
    backgroundColor: '#0f0d17',
    webPreferences: { partition: `persist:kick-${account}`, contextIsolation: true, nodeIntegration: false },
  });
  auth.webContents.on('did-navigate', (_e, target) => {
    if (target.includes('/auth/kick/callback')) setTimeout(() => !auth.isDestroyed() && auth.close(), 2500);
  });
  auth.loadURL(url);
  return true;
}

// Una sola instancia: si el usuario abre la app dos veces, enfocamos la primera.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });

  app.whenReady().then(async () => {
    const store = new Store(app.getPath('userData'));
    // net.fetch usa la red de Chromium (como un navegador real). Kick y
    // Starvios protegen sus webs contra bots y suelen bloquear el fetch
    // normal de Node, así que dentro de la app usamos este.
    server = createServer({
      store,
      fetch: (url, opts) => net.fetch(url, opts),
      appInfo: { version: app.getVersion(), portable: Boolean(velopack) },
      hooks: { applyUpdate, checkForUpdates: () => checkForUpdates(store), onWindowConfig: applyWindowConfig,
        openAuthWindow,
        // Cifrado de Windows (DPAPI) para el Client Secret y los permisos de Kick.
        vault: safeStorage.isEncryptionAvailable()
          ? {
              encrypt: (text) => safeStorage.encryptString(text).toString('base64'),
              decrypt: (b64) => safeStorage.decryptString(Buffer.from(b64, 'base64')),
            }
          : null,
      },
    });

    let url;
    try {
      url = await server.start();
    } catch (err) {
      dialog.showErrorBox(
        'Satronho Bot',
        `No se pudo abrir el puerto ${store.get('port')}. ¿Hay otra app usándolo?\n\n${err.message}`
      );
      app.quit();
      return;
    }

    win = new BrowserWindow({
      width: 1240,
      height: 820,
      minWidth: 900,
      minHeight: 600,
      title: 'Satronho Bot',
      icon: path.join(__dirname, '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
      backgroundColor: '#0f0d17',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        // La voz y la música viven en esta ventana: no la "dormimos" al minimizar.
        backgroundThrottling: false,
      },
    });

    // Los enlaces externos se abren en el navegador, no dentro de la app.
    win.webContents.setWindowOpenHandler(({ url: target }) => {
      shell.openExternal(target);
      return { action: 'deny' };
    });

    win.on('minimize', (ev) => {
      if (!store.get('window')?.minimizeToTray) return;
      ev.preventDefault();
      ensureTray();
      win.hide();
    });

    win.loadURL(url);
    // Al abrir (tras 5 s) y luego cada 6 horas, por si la app queda abierta días.
    win.webContents.once('did-finish-load', () => setTimeout(() => checkForUpdates(store), 5000));
    setInterval(() => checkForUpdates(store), 6 * 60 * 60 * 1000);
  });

  app.on('window-all-closed', async () => {
    if (server) await server.stop().catch(() => {});
    app.quit();
  });
}
