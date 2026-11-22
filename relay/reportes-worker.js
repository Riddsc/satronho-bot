// Relé de reportes de Satronho Bot (Cloudflare Workers, plan gratis).
//
// La app le envía aquí los reportes de «Ayuda → Reportar un problema» y este
// relé los pasa al canal de Discord. Así el webhook de Discord nunca viaja
// dentro de la app: nadie puede sacarlo del .exe para llenar el canal de
// spam ni borrarlo.
//
// Configuración (ver LEEME.md):
//   - Secreto DISCORD_WEBHOOK: el webhook del canal de reportes.

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

// Siempre el mismo nombre y nunca menciones (@everyone, roles…).
function cleanPayload(text) {
  let p;
  try {
    p = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(p.embeds) || !p.embeds.length) return null;
  return JSON.stringify({ username: 'MechaRidds · Reportes', embeds: p.embeds.slice(0, 1), allowed_mentions: { parse: [] } });
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Solo reportes de Satronho Bot', { status: 405 });
    const size = Number(request.headers.get('content-length') || 0);
    if (size > MAX_BYTES) return new Response('Reporte muy grande', { status: 413 });
    const ip = request.headers.get('cf-connecting-ip') || 'desconocida';
    if (!allowed(ip)) return new Response('Demasiados reportes', { status: 429 });

    const type = request.headers.get('content-type') || '';
    let body;
    let headers = {};
    if (type.startsWith('multipart/form-data')) {
      const form = await request.formData();
      const payload = cleanPayload(String(form.get('payload_json') || ''));
      if (!payload) return new Response('Reporte inválido', { status: 400 });
      body = new FormData();
      body.append('payload_json', payload);
      const file = form.get('files[0]');
      if (file && typeof file !== 'string') body.append('files[0]', file, 'diagnostico.txt');
    } else {
      const payload = cleanPayload(await request.text());
      if (!payload) return new Response('Reporte inválido', { status: 400 });
      body = payload;
      headers = { 'Content-Type': 'application/json' };
    }
    const res = await fetch(env.DISCORD_WEBHOOK, { method: 'POST', headers, body });
    return new Response(res.ok ? 'ok' : 'Discord no respondió', { status: res.ok ? 200 : 502 });
  },
};
