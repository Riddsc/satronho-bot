// Quién es quién en el chat (común para la voz y la música).
//   TikTok: e.extra.roles = { follower, sub, mod, host, team }
//   Kick y Twitch: e.extra.badges = ['moderator', 'vip', 'subscriber', …]
//   Starvios no manda roles: tú dices quiénes son tus moderadores y tu
//   lista de personas (Música y Voz del chat → Starvios).
//   Modos de Starvios: all · list (tu lista y tus moderadores) · mods.
// whoReason(e, mode, opts) devuelve '' si puede, o el motivo si no.
// Modos: all · followers · subs · vip · team · team-gift · mods
// (team-gift = Miembro de tu equipo que ya te mandó el regalo; opts.sentGift dice si lo mandó).

const hasBadge = (e, re) => (e.extra?.badges || []).some((b) => re.test(b));

// Starvios: el servidor nos pasa cómo leer tu canal y tus listas.
let starviosInfo = () => ({ owner: '', mods: [], allowed: [] });
function configureStarvios(fn) { starviosInfo = fn; }
const clean = (x) => String(x || '').trim().replace(/^@/, '').toLowerCase();
function starviosRoles(e) {
  const { owner, mods = [], allowed = [] } = starviosInfo() || {};
  const ids = [e.user?.id, e.user?.name, e.user?.login].map(clean).filter(Boolean);
  const isOwner = Boolean(owner) && ids.includes(clean(owner));
  const isMod = isOwner || mods.map(clean).some((m) => ids.includes(m));
  const inList = isMod || allowed.map(clean).some((m) => ids.includes(m));
  return { host: isOwner, mod: isMod, inList };
}

function rolesOf(e) {
  if (e.platform === 'tiktok') {
    const r = e.extra?.roles || {};
    return { host: Boolean(r.host), mod: Boolean(r.mod), vip: false, sub: Boolean(r.sub), follower: Boolean(r.follower || r.sub || r.team), team: r.team || 0 };
  }
  const mod = hasBadge(e, /^(moderator|broadcaster|owner)$/);
  const host = hasBadge(e, /^(broadcaster|owner)$/);
  const vip = mod || hasBadge(e, /^vip$/);
  const sub = vip || hasBadge(e, /^(subscriber|founder|og|sub_gifter)$/);
  return { host, mod, vip, sub, follower: sub, team: 0 };
}

function whoReason(e, mode = 'all', { teamMinLevel = 1, sentGift = false, giftName = 'Quiéreme' } = {}) {
  if (!mode || mode === 'all' || e.platform === 'panel') return '';
  if (e.platform === 'starvios') {
    const r = starviosRoles(e);
    if (r.mod) return '';
    if (mode === 'list') return r.inList ? '' : 'no está en tu lista de Starvios';
    if (mode === 'mods') return 'solo tú y tus moderadores';
    return '';
  }
  const r = rolesOf(e);
  if (r.host || r.mod) return '';
  const min = Math.max(1, Number(teamMinLevel) || 1);
  const teamText = min > 1 ? `Miembro de tu equipo nivel ${min}+` : 'Miembro de tu equipo';
  switch (mode) {
    case 'followers': return r.follower ? '' : 'no te sigue';
    case 'subs': return r.sub ? '' : 'no es suscriptor';
    case 'vip': return r.vip ? '' : 'no es VIP';
    case 'team': return r.team >= min ? '' : `no es ${teamText}`;
    case 'team-gift': return r.team < min ? `no es ${teamText}` : sentGift ? '' : `no te ha enviado ${giftName}`;
    case 'mods': return 'solo moderadores';
    default: return '';
  }
}

module.exports = { whoReason, rolesOf, configureStarvios, starviosRoles };
