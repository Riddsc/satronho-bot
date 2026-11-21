// Protección del servidor local.
//
// El servidor solo escucha en 127.0.0.1, pero el navegador del streamer
// también vive en este PC: cualquier página que abra podría intentar hablarle.
// Estas reglas dejan pasar al panel, a los overlays (OBS, TikTok LIVE Studio)
// y a los programas del propio PC, y frenan a las páginas de internet.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

// «localhost:3800» → «localhost». Sirve para la cabecera Host y para orígenes.
function hostnameOf(hostHeader) {
  const h = String(hostHeader || '').trim().toLowerCase();
  if (!h) return '';
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  return h.split(':')[0];
}

// La cabecera Host tiene que ser este PC. Si no, alguien usó un truco de DNS
// para que una página de internet parezca «local».
function isLocalHost(hostHeader) {
  return LOCAL_HOSTS.has(hostnameOf(hostHeader));
}

// Origen de la página que hace el pedido: solo valen las páginas servidas
// por este PC. «null» (marcos aislados, archivos) no vale.
function isLocalOrigin(origin) {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return (u.protocol === 'http:' || u.protocol === 'https:') && LOCAL_HOSTS.has(u.hostname === '::1' ? '[::1]' : u.hostname);
  } catch {
    return false;
  }
}

const CHANGES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ¿Este pedido puede cambiar cosas en la app?
// - Navegadores: mandan Origin y Sec-Fetch-Site; tienen que ser de este PC.
// - Programas sin navegador (Electron, scripts del propio PC): no mandan
//   ninguna de las dos y pasan, porque ya corren dentro del PC.
function allowChange(headers) {
  const origin = headers.origin;
  if (origin !== undefined && !isLocalOrigin(origin)) return false;
  const site = headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return false;
  return true;
}

function createHttpGuard() {
  return (req, res, next) => {
    if (!isLocalHost(req.headers.host)) {
      return res.status(403).type('text/plain').send('Satronho Bot solo responde a este PC.');
    }
    if (CHANGES.has(req.method) && !allowChange(req.headers)) {
      return res.status(403).json({ ok: false, error: 'Pedido bloqueado: viene de una página que no es Satronho Bot.' });
    }
    next();
  };
}

// WebSocket: el chat en vivo y los controles solo para páginas de este PC.
function verifyWsClient(info) {
  const { req } = info;
  if (!isLocalHost(req.headers.host)) return false;
  const origin = req.headers.origin;
  if (origin !== undefined && !isLocalOrigin(origin)) return false;
  return true;
}

// Solo las páginas de overlays se pueden meter dentro de otra página
// (OBS, TikTok LIVE Studio). El panel no: así nadie lo esconde en su web
// para que hagas clic sin darte cuenta.
function frameHeaders(req, res, next) {
  if (!req.path.startsWith('/overlays/')) {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  next();
}

// Enlaces que el panel puede abrir fuera de la app.
function isSafeExternalUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:';
  } catch {
    return false;
  }
}

// Direcciones de este PC o de la red de la casa: la app no las descarga
// cuando alguien pega un enlace (sonidos, imágenes).
function isPrivateAddress(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^\d+$/.test(h)) return true; // 2130706433 = 127.0.0.1 escrito como número
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(':')) {
    return h === '::' || h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:');
  }
  return false;
}

// Lee una respuesta sin pasarse de «max» bytes: corta la descarga en cuanto
// se pasa, en vez de bajarla entera a la memoria y medirla después.
async function readLimited(res, max, tooBig = 'El archivo es muy grande') {
  const len = Number(res.headers?.get?.('content-length') || 0);
  if (len > max) throw new Error(tooBig);
  if (!res.body?.getReader) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > max) throw new Error(tooBig);
    return buf;
  }
  const reader = res.body.getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      reader.cancel().catch(() => {});
      throw new Error(tooBig);
    }
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts);
}

module.exports = { readLimited, isLocalHost, isLocalOrigin, allowChange, createHttpGuard, verifyWsClient, frameHeaders, isSafeExternalUrl, isPrivateAddress };
