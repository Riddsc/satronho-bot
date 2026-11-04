// Dibujos de Samy, Troya, Ñoño y Juana: los perritos de RiddsSatronho.
// Ilustraciones propias (SVG) basadas en cómo son de verdad:
//   Samy  – café rojiza con mancha blanca, orejas grandes, collar azul.
//   Troya – atigrada con máscara oscura, orejas paradas, gafas en la frente.
//   Ñoño  – blanco con parches negros, orejas caídas, lengua afuera, corbatín.
//   Juana – negrita de hocico gris, cejas canosas y moño rosado.
// Todas comparten la misma base de ojos, nariz y mejillas para que se
// vean como una familia.

const INK = '#1c1a22';

function eyes({ lashes = false, brows = null, iris = '#6b3f1f' } = {}) {
  const eye = (x, dir) => `
    <ellipse cx="${x}" cy="53" rx="6.4" ry="6.8" fill="#fff"/>
    <circle cx="${x + dir * 0.6}" cy="54" r="4.3" fill="${iris}"/>
    <circle cx="${x + dir * 0.6}" cy="54" r="2.3" fill="${INK}"/>
    <circle cx="${x + dir * 0.6 - 1.4}" cy="52.3" r="1.3" fill="#fff"/>
    ${lashes ? `<g stroke="${INK}" stroke-width="1.5" stroke-linecap="round"><path d="M${x + dir * 5} ${48} l${dir * 3.2} -2.6"/><path d="M${x + dir * 6.2} ${50.4} l${dir * 3.6} -1.2"/></g>` : ''}`;
  return `${eye(37, -1)}${eye(63, 1)}${brows ? `<g fill="none" stroke="${brows}" stroke-width="4.2" stroke-linecap="round"><path d="M30 43 Q36 39.5 42 42"/><path d="M58 42 Q64 39.5 70 43"/></g>` : ''}`;
}

const cheeks = (opacity = 0.45) =>
  `<ellipse cx="29" cy="65" rx="5" ry="3.4" fill="#ff7a8a" opacity="${opacity}"/><ellipse cx="71" cy="65" rx="5" ry="3.4" fill="#ff7a8a" opacity="${opacity}"/>`;

const smile = (y = 74) => `<path d="M43 ${y} Q50 ${y + 5} 57 ${y}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;

const DOGS = {
  samy: () => `
    <path d="M30 40 C20 32 12 18 14 8 C24 10 34 22 38 32 Z" fill="#a95a2f"/>
    <path d="M28 35 C22 28 18 19 18 13 C24 16 30 24 33 31 Z" fill="#e9a6a0"/>
    <path d="M70 40 C80 32 88 18 86 8 C76 10 66 22 62 32 Z" fill="#a95a2f"/>
    <path d="M72 35 C78 28 82 19 82 13 C76 16 70 24 67 31 Z" fill="#e9a6a0"/>
    <path d="M14 8 C10 12 9 17 12 20 C14 15 16 11 14 8 Z M86 8 C90 12 91 17 88 20 C86 15 84 11 86 8 Z" fill="#8c4824"/>
    <ellipse cx="50" cy="57" rx="33" ry="32" fill="#c06d3d"/>
    <path d="M50 25 C47 36 43 48 40 60 L60 60 C57 48 53 36 50 25 Z" fill="#f8f1e8"/>
    <ellipse cx="50" cy="71" rx="17" ry="13.5" fill="#f8f1e8"/>
    ${eyes({ lashes: true, brows: '#8c4824' })}
    <ellipse cx="50" cy="64.5" rx="6.6" ry="4.8" fill="#d98b8b"/>
    <ellipse cx="47.6" cy="65.4" rx="1.4" ry="1" fill="#9c5656"/><ellipse cx="52.4" cy="65.4" rx="1.4" ry="1" fill="#9c5656"/>
    ${cheeks()}${smile(73)}
    <path d="M24 84 Q50 97 76 84 L74 90 Q50 102 26 90 Z" fill="#23356b"/>`,

  troya: () => `
    <path d="M27 40 L20 6 L44 28 Z" fill="#3e2b20"/>
    <path d="M28 33 L24 13 L39 27 Z" fill="#c98f7f"/>
    <path d="M73 40 L80 6 L56 28 Z" fill="#3e2b20"/>
    <path d="M72 33 L76 13 L61 27 Z" fill="#c98f7f"/>
    <ellipse cx="50" cy="57" rx="32" ry="33" fill="#7a5435"/>
    <g stroke="#3e2b20" stroke-width="2.4" stroke-linecap="round" opacity=".55" fill="none">
      <path d="M23 52 l7 2"/><path d="M22 60 l8 1"/><path d="M77 52 l-7 2"/><path d="M78 60 l-8 1"/>
    </g>
    <path d="M50 30 C38 34 32 44 33 56 C35 66 42 72 50 72 C58 72 65 66 67 56 C68 44 62 34 50 30 Z" fill="#4a3427"/>
    <ellipse cx="50" cy="74" rx="13" ry="10" fill="#c7b6a3"/>
    <ellipse cx="38" cy="43.5" rx="4" ry="2.4" fill="#d9b48a"/><ellipse cx="62" cy="43.5" rx="4" ry="2.4" fill="#d9b48a"/>
    ${eyes({ lashes: true })}
    <ellipse cx="50" cy="65" rx="6.4" ry="4.6" fill="${INK}"/><ellipse cx="48.4" cy="63.6" rx="2" ry="1.1" fill="#fff" opacity=".5"/>
    ${cheeks(0.4)}${smile(73.5)}
    <path d="M17 31 Q50 23 83 31" fill="none" stroke="#8b5cf6" stroke-width="5" stroke-linecap="round"/>
    <rect x="29" y="24" width="18" height="12" rx="5" fill="#c9e8ff" stroke="#2b2b6b" stroke-width="2.6"/>
    <rect x="53" y="24" width="18" height="12" rx="5" fill="#c9e8ff" stroke="#2b2b6b" stroke-width="2.6"/>
    <path d="M47 29 L53 29" stroke="#2b2b6b" stroke-width="2.6"/>
    <path d="M32 27 l4 0 M56 27 l4 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>`,

  nono: () => `
    <ellipse cx="17" cy="56" rx="11" ry="24" fill="#1f1f22" transform="rotate(12 17 56)"/>
    <ellipse cx="83" cy="56" rx="11" ry="24" fill="#1f1f22" transform="rotate(-12 83 56)"/>
    <ellipse cx="50" cy="57" rx="32" ry="33" fill="#f6f3ee"/>
    <path d="M47 24.5 C36 25 24 32 20 44 C19 52 22 58 28 60 C36 61 43 56 46 48 C47.5 41 47.5 32 47 24.5 Z" fill="#1f1f22"/>
    <path d="M53 24.5 C64 25 76 32 80 44 C81 52 78 58 72 60 C64 61 57 56 54 48 C52.5 41 52.5 32 53 24.5 Z" fill="#1f1f22"/>
    ${eyes({})}
    <ellipse cx="50" cy="66" rx="7.6" ry="5.4" fill="${INK}"/><ellipse cx="48" cy="64.4" rx="2.4" ry="1.3" fill="#fff" opacity=".5"/>
    <g fill="#9a9a9a"><circle cx="40" cy="71" r=".9"/><circle cx="37" cy="69" r=".9"/><circle cx="60" cy="71" r=".9"/><circle cx="63" cy="69" r=".9"/></g>
    <path d="M42 73 Q50 78 58 73" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M45.5 75 Q45 86 50 87 Q55 86 54.5 75 Z" fill="#ef7088"/><path d="M50 76 L50 84" stroke="#c94d64" stroke-width="1.4" stroke-linecap="round"/>
    ${cheeks(0.3)}
    <g transform="translate(50 93)"><path d="M0 0 L-12 -6 L-12 6 Z M0 0 L12 -6 L12 6 Z" fill="#8b5cf6"/><circle r="3.6" fill="#6d3fe0"/></g>`,

  juana: () => `
    <ellipse cx="18" cy="54" rx="11" ry="22" fill="#2a2b31" transform="rotate(16 18 54)"/>
    <ellipse cx="82" cy="54" rx="11" ry="22" fill="#2a2b31" transform="rotate(-16 82 54)"/>
    <ellipse cx="50" cy="57" rx="32" ry="33" fill="#34363d"/>
    <ellipse cx="50" cy="71" rx="15.5" ry="12.5" fill="#7c7e86"/>
    ${eyes({ lashes: true, brows: '#b4b6bd' })}
    <ellipse cx="50" cy="64.5" rx="6.6" ry="4.8" fill="#1c1d22"/><ellipse cx="48.2" cy="63.2" rx="2" ry="1.1" fill="#fff" opacity=".45"/>
    ${cheeks(0.5)}${smile(73.5)}
    <g transform="translate(68 24) rotate(-12)">
      <path d="M0 0 C-6 -9 -16 -7 -15 0 C-16 7 -6 9 0 0 Z" fill="#e5788c"/>
      <path d="M0 0 C6 -9 16 -7 15 0 C16 7 6 9 0 0 Z" fill="#e5788c"/>
      <circle r="4.2" fill="#c95369"/>
    </g>`,
};

export function mascotSVG(id, label = '') {
  const body = DOGS[id] ? DOGS[id]() : '';
  // Un poco más pequeño y abajo para que las orejas quepan en el círculo.
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${label}"><g class="dog" transform="translate(5 8) scale(.9)">${body}</g></svg>`;
}
