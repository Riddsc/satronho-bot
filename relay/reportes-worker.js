// Relé de reportes de Satronho Bot (Cloudflare Workers, plan gratis).
//
// La app le envía aquí los reportes de «Ayuda → Reportar un problema» y este
// relé los pasa al canal de Discord. Así el webhook de Discord nunca viaja
// dentro de la app: nadie puede sacarlo del .exe para llenar el canal de
// spam ni borrarlo.
//
// También hace el canje de permisos de Kick (/kick/token): así el Client
// Secret de la app «SatronhoBot» tampoco viaja dentro de la app.
//
// Configuración (ver LEEME.md):
//   - Secreto DISCORD_WEBHOOK: el webhook del canal de reportes.
//   - Secreto KICK_CLIENT_ID y secreto KICK_CLIENT_SECRET: la app de Kick.

const MAX_BYTES = 2 * 1024 * 1024; // un reporte con diagnóstico pesa mucho menos
const PER_MINUTE = 2; // por dirección IP
const PER_DAY = 15;

// Límite por IP. Es «mejor esfuerzo»: cada copia del Worker lleva su cuenta.
const seen = new Map();
function allowed(ip) {
  const now = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  const s = seen.get(ip) || { day, n: 0, recent: [] };
  if (s.day !== day) Object.assign(s, { day, n: 0 });
  s.recent = s.recent.filter((t) => now - t < 60_000);
  if (s.recent.length >= PER_MINUTE || s.n >= PER_DAY) return false;
  s.recent.push(now);
  s.n++;
  seen.set(ip, s);
  if (seen.size > 5000) seen.clear();
  return true;
}

// Solo los campos de texto que arma la app: nada de enlaces, imágenes ni
// autores, para que nadie use el relé para meter publicidad en el canal.
const cut = (v, n) => String(v ?? '').slice(0, n);
function cleanEmbed(e) {
  if (!e || typeof e !== 'object') return null;
  const fields = Array.isArray(e.fields) ? e.fields.slice(0, 5).map((f) => ({ name: cut(f?.name, 60) || '—', value: cut(f?.value, 300) || '—', inline: Boolean(f?.inline) })) : [];
  return {
    title: cut(e.title, 80) || 'Reporte',
    description: cut(e.description, 3500),
    color: Number.isInteger(e.color) ? e.color : 0x5fd0ff,
    fields,
    ...(e.footer?.text ? { footer: { text: cut(e.footer.text, 80) } } : {}),
    timestamp: /^\d{4}-\d{2}-\d{2}T/.test(String(e.timestamp || '')) ? e.timestamp : new Date().toISOString(),
  };
}

// Siempre el mismo nombre y nunca menciones (@everyone, roles…).
function cleanPayload(text) {
  let p;
  try {
    p = JSON.parse(text);
  } catch {
    return null;
  }
  const embed = Array.isArray(p.embeds) ? cleanEmbed(p.embeds[0]) : null;
  if (!embed) return null;
  return JSON.stringify({ username: 'MechaRidds · Reportes', embeds: [embed], allowed_mentions: { parse: [] } });
}

// Lee el cuerpo sin pasarse de MAX_BYTES, aunque no traiga content-length.
async function readCapped(request) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// ---- Canje de permisos de Kick ----
// La app manda el código (con su verificador PKCE) o el permiso de
// renovación; aquí se le agrega el Client Secret y se le pasa a Kick.
// Sin el verificador, que solo conoce la app que pidió el permiso, un
// código robado no sirve de nada.
const KICK_PER_MINUTE = 20;
const kickSeen = new Map();
function kickAllowed(ip) {
  const now = Date.now();
  const recent = (kickSeen.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= KICK_PER_MINUTE) return false;
  recent.push(now);
  kickSeen.set(ip, recent);
  if (kickSeen.size > 5000) kickSeen.clear();
  return true;
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

async function kickToken(request, env) {
  if (!env.KICK_CLIENT_ID || !env.KICK_CLIENT_SECRET) return json({ message: 'El relé no tiene la app de Kick configurada' }, 503);
  const ip = request.headers.get('cf-connecting-ip') || 'desconocida';
  if (!kickAllowed(ip)) return json({ message: 'Demasiados intentos, espera un minuto' }, 429);
  const raw = await readCapped(request);
  if (!raw || raw.length > 8192) return json({ message: 'Pedido inválido' }, 400);
  let b;
  try {
    b = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ message: 'Pedido inválido' }, 400);
  }
  if (String(b.client_id || '') !== env.KICK_CLIENT_ID) return json({ message: 'Esta app de Kick no es la de Satronho Bot' }, 400);
  const form = new URLSearchParams({ client_id: env.KICK_CLIENT_ID, client_secret: env.KICK_CLIENT_SECRET });
  if (b.grant_type === 'authorization_code') {
    // Solo vuelve a la app del propio PC del streamer.
    if (!/^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}\/auth\/kick\/callback$/.test(String(b.redirect_uri || ''))) return json({ message: 'Dirección de regreso inválida' }, 400);
    if (!b.code || !b.code_verifier) return json({ message: 'Falta el código de Kick' }, 400);
    form.set('grant_type', 'authorization_code');
    form.set('code', String(b.code).slice(0, 2048));
    form.set('code_verifier', String(b.code_verifier).slice(0, 256));
    form.set('redirect_uri', b.redirect_uri);
  } else if (b.grant_type === 'refresh_token') {
    if (!b.refresh_token) return json({ message: 'Falta el permiso de renovación' }, 400);
    form.set('grant_type', 'refresh_token');
    form.set('refresh_token', String(b.refresh_token).slice(0, 2048));
  } else {
    return json({ message: 'Tipo de pedido desconocido' }, 400);
  }
  const res = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form.toString(),
  });
  // La respuesta de Kick tal cual (permisos o el motivo del error).
  return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } });
}

export default {
  async fetch(request, env) {
    if (request.method === 'POST' && new URL(request.url).pathname === '/kick/token') return kickToken(request, env);
    if (request.method !== 'POST') return new Response('Solo reportes de Satronho Bot', { status: 405 });
    const size = Number(request.headers.get('content-length') || 0);
    if (size > MAX_BYTES) return new Response('Reporte muy grande', { status: 413 });
    const ip = request.headers.get('cf-connecting-ip') || 'desconocida';
    if (!allowed(ip)) return new Response('Demasiados reportes', { status: 429 });

    const type = request.headers.get('content-type') || '';
    const raw = await readCapped(request);
    if (!raw) return new Response('Reporte muy grande', { status: 413 });
    let body;
    let headers = {};
    if (type.startsWith('multipart/form-data')) {
      let form;
      try {
        form = await new Request('https://relay.local/', { method: 'POST', headers: { 'content-type': type }, body: raw }).formData();
      } catch {
        return new Response('Reporte inválido', { status: 400 });
      }
      const payload = cleanPayload(String(form.get('payload_json') || ''));
      if (!payload) return new Response('Reporte inválido', { status: 400 });
      body = new FormData();
      body.append('payload_json', payload);
      const file = form.get('files[0]');
      if (file && typeof file !== 'string') body.append('files[0]', new Blob([await file.arrayBuffer()], { type: 'text/plain' }), 'diagnostico.txt');
    } else {
      const payload = cleanPayload(new TextDecoder().decode(raw));
      if (!payload) return new Response('Reporte inválido', { status: 400 });
      body = payload;
      headers = { 'Content-Type': 'application/json' };
    }
    const res = await fetch(env.DISCORD_WEBHOOK, { method: 'POST', headers, body });
    return new Response(res.ok ? 'ok' : 'Discord no respondió', { status: res.ok ? 200 : 502 });
  },
};
