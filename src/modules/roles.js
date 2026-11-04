// Quién es quién en el chat (común para la voz y la música).
//   TikTok: e.extra.roles = { follower, sub, mod, host, team }
//   Kick y Twitch: e.extra.badges = ['moderator', 'vip', 'subscriber', …]
//   Starvios no manda roles: ahí todos pasan.
// whoReason(e, mode, opts) devuelve '' si puede, o el motivo si no.
// Modos: all · followers · subs · vip · team · team-gift · mods
// (team-gift = Miembro de tu equipo que ya te mandó el regalo; opts.sentGift dice si lo mandó).

const hasBadge = (e, re) => (e.extra?.badges || []).some((b) => re.test(b));

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
  if (!mode || mode === 'all' || e.platform === 'starvios' || e.platform === 'panel') return '';
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

module.exports = { whoReason, rolesOf };
