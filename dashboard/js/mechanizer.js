// Mechanizer: la Colonizadora en versión androide. Estilo pulido y girlie,
// como sus avatares: piel cálida con degradado suave, melena negra corta
// (bob) brillante con raya de lado y puntas hacia adentro, ojos cafés
// grandes con delineado de colita y pestañas, gafas rosadas transparentes,
// rubor, labios rosados con brillo y su sonrisa tranquila.
// Lo de androide se nota sin quitarle belleza: headset lila con orejeras
// mecánicas, tira de luces y una antena fina; ojo biónico con anillo de luz
// y mirilla en la lente; placa perlada con circuitos en el pómulo; costura
// de luz rosa en la quijada y el cuello; y en el busto, gargantilla de oro
// rosa con un núcleo en forma de corazón.
// La jirafa de Colonizadora va en las orejeras (manchitas rosadas).
// Lleva el Chat en vivo, su ventana aparte y el chat en pantalla.
//
// mechanizerHead(): cabeza para los círculos de guía (viewBox 0 0 100 100).
// mechanizerBust(): busto pequeño para portadas.

const INK = '#2a1d2c';
const HAIR = '#16121b';
const SKIN = '#f6cdb1';
const SKIN_D = '#e9b394';
const SHADE = '#d99a80';
const GLOW = '#ff79bd';
const LILAC = '#cdb0ff';
const LILAC_D = '#a988ee';

// Cada dibujo usa ids propios para sus degradados (puede haber varios en la página).
let seq = 0;

// Ojos achinaditos: almendrados y con la esquina de afuera hacia arriba.
const EYE_L = 'M32.2 55.8 C35 53 44.8 53 47.6 57.4 C44.8 60.2 35.6 60.4 32.2 55.8 Z';
const EYE_R = 'M67.8 55.8 C65 53 55.2 53 52.4 57.4 C55.2 60.2 64.4 60.4 67.8 55.8 Z';

function defs(u) {
  return `<defs>
    <radialGradient id="${u}sk" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#fbdcc6"/><stop offset=".7" stop-color="${SKIN}"/><stop offset="1" stop-color="${SKIN_D}"/></radialGradient>
    <linearGradient id="${u}hr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d2436"/><stop offset=".55" stop-color="${HAIR}"/><stop offset="1" stop-color="#0d0a10"/></linearGradient>
    <radialGradient id="${u}ir" cx="45%" cy="38%" r="65%"><stop offset="0" stop-color="#8f5e3e"/><stop offset=".6" stop-color="#4a2a1a"/><stop offset="1" stop-color="#24120a"/></radialGradient>
    <linearGradient id="${u}ln" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".45" stop-color="#f4e9ff" stop-opacity=".06"/><stop offset="1" stop-color="${LILAC}" stop-opacity=".2"/></linearGradient>
    <linearGradient id="${u}fr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8c2d6"/><stop offset="1" stop-color="#e48cb0"/></linearGradient>
    <linearGradient id="${u}hs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6d6ff"/><stop offset="1" stop-color="${LILAC_D}"/></linearGradient>
    <linearGradient id="${u}lp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6a3bd"/><stop offset="1" stop-color="#df7397"/></linearGradient>
    <linearGradient id="${u}mt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe9f2"/><stop offset=".5" stop-color="#e2c6dc"/><stop offset="1" stop-color="#b996c4"/></linearGradient>
    <radialGradient id="${u}bl"><stop offset="0" stop-color="#ff8fb3" stop-opacity=".5"/><stop offset="1" stop-color="#ff8fb3" stop-opacity="0"/></radialGradient>
    <radialGradient id="${u}gl"><stop offset="0" stop-color="${GLOW}" stop-opacity=".75"/><stop offset="1" stop-color="${GLOW}" stop-opacity="0"/></radialGradient>
    <clipPath id="${u}el"><path d="${EYE_L}"/></clipPath>
    <clipPath id="${u}er"><path d="${EYE_R}"/></clipPath>
  </defs>`;
}

const sparkle = (x, y, s, fill = '#fff') => `<path d="M${x} ${y - 3 * s} Q${x + 0.5 * s} ${y - 0.5 * s} ${x + 3 * s} ${y} Q${x + 0.5 * s} ${y + 0.5 * s} ${x} ${y + 3 * s} Q${x - 0.5 * s} ${y + 0.5 * s} ${x - 3 * s} ${y} Q${x - 0.5 * s} ${y - 0.5 * s} ${x} ${y - 3 * s} Z" fill="${fill}"/>`;
const heart = (x, y, s = 1, fill = GLOW) => `<path d="M${x} ${y + 2.6 * s} C${x - 4.2 * s} ${y - 0.2 * s} ${x - 2.6 * s} ${y - 3.6 * s} ${x} ${y - 1.4 * s} C${x + 2.6 * s} ${y - 3.6 * s} ${x + 4.2 * s} ${y - 0.2 * s} ${x} ${y + 2.6 * s} Z" fill="${fill}"/>`;

// side: -1 = el ojo de la izquierda en pantalla (el biónico, con anillo de
// luz; MechaRidds lo tiene del otro lado), 1 = el de la derecha.
function eye(u, side) {
  const cx = side < 0 ? 40 : 60;
  const ix = cx + 0.4 * side;
  const shape = side < 0 ? EYE_L : EYE_R;
  // Línea de pestañas con colita hacia afuera.
  const liner = side < 0
    ? 'M47.9 57.2 C45 52.4 35 52.2 31.8 55.6 L28.6 52.8'
    : 'M52.1 57.2 C55 52.4 65 52.2 68.2 55.6 L71.4 52.8';
  const lashes = side < 0 ? 'M33.4 54.4 l-1.3 -1.4 M35.6 53.2 l-.8 -1.6' : 'M66.6 54.4 l1.3 -1.4 M64.4 53.2 l.8 -1.6';
  const lower = side < 0 ? 'M34.4 58.8 C37.6 60.9 43.4 60.9 46.4 59.2' : 'M65.6 58.8 C62.4 60.9 56.6 60.9 53.6 59.2';
  return `
    <path d="${shape}" fill="#fff"/>
    <g clip-path="url(#${u}${side < 0 ? 'el' : 'er'})">
      <circle cx="${ix}" cy="56.8" r="4.4" fill="url(#${u}ir)"/>
      <circle cx="${ix}" cy="56.8" r="4.4" fill="none" stroke="#1a0d07" stroke-width=".6"/>
      <circle cx="${ix}" cy="57" r="2" fill="#120804"/>
      ${side < 0 ? `<circle cx="${ix}" cy="56.8" r="3.3" fill="none" stroke="${GLOW}" stroke-width=".55" stroke-dasharray="1.1 .9" opacity=".9"/>` : ''}
      <circle cx="${cx - 1.4}" cy="55.4" r="1.4" fill="#fff"/>
      <circle cx="${cx + 1.7}" cy="58.4" r=".6" fill="#fff" opacity=".85"/>
    </g>
    <path d="${liner}" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${lashes}" stroke="${INK}" stroke-width=".8" stroke-linecap="round"/>
    <path d="${lower}" fill="none" stroke="${SHADE}" stroke-width=".7" stroke-linecap="round" opacity=".7"/>`;
}

function head(u) {
  return `${defs(u)}
    <!-- melena por detrás -->
    <path d="M50 15.4 C29.6 15.4 16.6 29.6 16.6 51.6 L16.8 77 C16.8 87 22 92.6 30.4 92.4 C27.6 86.4 26.4 80.4 26.4 74.4 L73.6 74.4 C73.6 80.4 72.4 86.4 69.6 92.4 C78 92.6 83.2 87 83.2 77 L83.4 51.6 C83.4 29.6 70.4 15.4 50 15.4 Z" fill="url(#${u}hr)"/>
    <!-- cara: óvalo suave con mentón delicado -->
    <path d="M50 88.6 C40.4 88.6 29.4 81.4 25.6 67.6 C23 57.6 23.4 45.6 28.4 37.8 C33.4 30.4 41.2 27 50 27 C58.8 27 66.6 30.4 71.6 37.8 C76.6 45.6 77 57.6 74.4 67.6 C70.6 81.4 59.6 88.6 50 88.6 Z" fill="url(#${u}sk)"/>
    <!-- sombra suave del flequillo sobre la frente -->
    <path d="M60 31.4 C51 31.8 42 35 35.6 40.6 C31.4 44.4 29 49 27.8 54 C27.4 46 30 40 35.4 36.4 C42 32 51 30.8 60 31.4 Z" fill="${SHADE}" opacity=".35"/>
    <path d="M36 36.6 C44 32.6 52 31.6 60.6 31.6" fill="none" stroke="#3a2f45" stroke-width=".9" stroke-linecap="round" opacity=".6"/>
    <!-- rubor -->
    <ellipse cx="34" cy="68.6" rx="7" ry="4.4" fill="url(#${u}bl)"/>
    <ellipse cx="66" cy="68.6" rx="7" ry="4.4" fill="url(#${u}bl)"/>
    <!-- costura de luz en la quijada (androide), muy fina -->
    <path d="M74.8 64.6 C72.4 76.4 64 85.4 55 87.6" fill="none" stroke="${GLOW}" stroke-width="2.2" opacity=".18" stroke-linecap="round"/>
    <path d="M74.8 64.6 C72.4 76.4 64 85.4 55 87.6" fill="none" stroke="${GLOW}" stroke-width=".7" stroke-linecap="round"/>
    <circle cx="69.4" cy="79.6" r=".9" fill="#fff"/>
    <!-- placa tecnológica en el pómulo del lado biónico: metal perlado,
         circuitos de luz y dos microluces -->
    <path d="M30.4 65 C32.8 64.2 36.8 64.4 39.2 65.6 C38.4 68.6 36.2 71.4 33 72.4 C31.6 70.2 30.8 67.6 30.4 65 Z" fill="url(#${u}mt)" stroke="#c7a3c9" stroke-width=".5"/>
    <path d="M32 66.6 h3.6 l1.6 1.6 M32.6 69.2 h2 l1.2 -1.2" fill="none" stroke="${GLOW}" stroke-width=".55" stroke-linecap="round"/>
    <circle cx="37.6" cy="68.3" r=".55" fill="#fff"/><circle cx="33.6" cy="71" r=".5" fill="${GLOW}"/>
    <path d="M30.6 65.2 C32.8 64.5 36.6 64.6 39 65.7" fill="none" stroke="#fff" stroke-width=".5" opacity=".8"/>
    <!-- flequillo de lado y mechones que enmarcan la cara -->
    <path d="M58.4 19.4 C44 18.6 30.4 25.8 25.2 40 C22.4 48 22.6 57.6 23.6 66.4 C24.6 53 28 43 35 37.6 C42 33 51 31.4 60 31.4 Z" fill="url(#${u}hr)"/>
    <path d="M58.4 19.4 C69.4 19.6 77.8 28 78.6 42 C79 50 78.4 58 77.2 64.6 C76 54.4 72.6 44.6 67 38 C64.4 35 62.4 32.6 60 31.4 Z" fill="url(#${u}hr)"/>
    <path d="M23.4 58 C22.4 71 23.4 81.6 28.6 91.4 C31 92.6 33.4 91.2 33 89 C28.6 80.6 27.2 70 27.8 58.6 Z" fill="url(#${u}hr)"/>
    <path d="M76.6 58 C77.6 71 76.6 81.6 71.4 91.4 C69 92.6 66.6 91.2 67 89 C71.4 80.6 72.8 70 72.2 58.6 Z" fill="url(#${u}hr)"/>
    <!-- brillo del pelo -->
    <path d="M31.4 30.4 C38 23.4 47.6 21.4 56 22.6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".22"/>
    <path d="M62.6 23.6 C68.6 25.4 73.4 30 75.6 35.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".18"/>
    <path d="M27.4 44 C29.6 39 33.4 35 38.4 32.4" fill="none" stroke="#c6b2e6" stroke-width="1" stroke-linecap="round" opacity=".45"/>
    <path d="M25 70 C25.4 78 27 84.6 30 89.6 M75 70 C74.6 78 73 84.6 70 89.6" fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".18"/>
    <!-- headset lila con orejeras mecánicas y manchitas de jirafa -->
    <path d="M18.6 54 C16.4 7 83.6 7 81.4 54" fill="none" stroke="url(#${u}hs)" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M21.2 42 C21.4 14 78.6 14 78.8 42" fill="none" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity=".5"/>
    <ellipse cx="16" cy="60" rx="6.4" ry="10.4" fill="url(#${u}hs)"/>
    <ellipse cx="84" cy="60" rx="6.4" ry="10.4" fill="url(#${u}hs)"/>
    <ellipse cx="16" cy="60" rx="4.2" ry="7.6" fill="#efe4ff"/>
    <ellipse cx="84" cy="60" rx="4.2" ry="7.6" fill="#efe4ff"/>
    <ellipse cx="16" cy="60" rx="5.3" ry="9.2" fill="none" stroke="#fff" stroke-width=".5" stroke-dasharray=".8 1.6" opacity=".8"/>
    <ellipse cx="84" cy="60" rx="5.3" ry="9.2" fill="none" stroke="#fff" stroke-width=".5" stroke-dasharray=".8 1.6" opacity=".8"/>
    <path d="M14.4 55.6 q1.4 -1 2.6 .2 q.2 1.6 -1.2 1.8 q-1.6 0 -1.4 -2 Z M16 61.6 q1.2 -.8 2.2 .2 q0 1.4 -1 1.6 q-1.4 0 -1.2 -1.8 Z M13.6 64 q1 -.6 1.8 .2 q0 1.2 -.9 1.3 q-1.1 0 -.9 -1.5 Z" fill="#f4a6c8" opacity=".75"/>
    <path d="M82.4 55.6 q1.4 -1 2.6 .2 q.2 1.6 -1.2 1.8 q-1.6 0 -1.4 -2 Z M84 61.6 q1.2 -.8 2.2 .2 q0 1.4 -1 1.6 q-1.4 0 -1.2 -1.8 Z M81.6 64 q1 -.6 1.8 .2 q0 1.2 -.9 1.3 q-1.1 0 -.9 -1.5 Z" fill="#f4a6c8" opacity=".75"/>
    <circle cx="16" cy="49.6" r="2.6" fill="url(#${u}gl)"/><circle cx="16" cy="49.6" r="1" fill="#fff"/>
    <!-- antena fina con luz en la orejera del lado biónico -->
    <path d="M12.2 52.4 L6.4 40.6" stroke="#b998e6" stroke-width="1.2" stroke-linecap="round"/>
    <rect x="7.4" y="45.2" width="3.2" height="1.6" rx=".8" fill="#e6d6ff" transform="rotate(-26 9 46)"/>
    <circle cx="6" cy="39.8" r="3.4" fill="url(#${u}gl)"/><circle cx="6" cy="39.8" r="1.5" fill="${GLOW}"/><circle cx="5.5" cy="39.3" r=".5" fill="#fff"/>
    <!-- tira de luces en la diadema -->
    <path d="M33 22.6 Q50 18.4 67 22.6" fill="none" stroke="${GLOW}" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="2.2 1.6" opacity=".9"/>
    <circle cx="84" cy="49.6" r="2.6" fill="url(#${u}gl)"/><circle cx="84" cy="49.6" r="1" fill="#fff"/>
    <!-- micrófono fino hacia la boca -->
    <path d="M86.6 67.4 C87.4 79.6 78 84.4 67.4 83.6" fill="none" stroke="${LILAC_D}" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="61.4" y="81.4" width="7.2" height="4.4" rx="2.2" fill="url(#${u}hs)"/>
    <circle cx="62.8" cy="83.6" r=".8" fill="${GLOW}"/>
    <!-- cejas finas y arqueadas -->
    <path d="M31.4 47.6 C34.8 44.2 41 43.2 46.2 45 C41.4 44.8 35.8 45.8 32.6 48.6 Z" fill="${HAIR}"/>
    <path d="M68.6 47.6 C65.2 44.2 59 43.2 53.8 45 C58.6 44.8 64.2 45.8 67.4 48.6 Z" fill="${HAIR}"/>
    <!-- ojos -->
    ${eye(u, -1)}${eye(u, 1)}
    <!-- gafas rosadas transparentes, finas -->
    <rect x="30" y="49.4" width="19" height="15.4" rx="5.6" fill="url(#${u}ln)"/>
    <rect x="51" y="49.4" width="19" height="15.4" rx="5.6" fill="url(#${u}ln)"/>
    <rect x="30" y="49.4" width="19" height="15.4" rx="5.6" fill="none" stroke="url(#${u}fr)" stroke-width="2.1"/>
    <rect x="51" y="49.4" width="19" height="15.4" rx="5.6" fill="none" stroke="url(#${u}fr)" stroke-width="2.1"/>
    <path d="M49 55.2 Q50 54 51 55.2" fill="none" stroke="url(#${u}fr)" stroke-width="1.8"/>
    <path d="M30 53 L22 52 M70 53 L78 52" stroke="url(#${u}fr)" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M33 61 L39.4 51.6 M36.4 62.4 L41 55.6 M54 61 L60.4 51.6 M57.4 62.4 L62 55.6" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".35"/>
    <!-- mirilla de luz en la lente del ojo biónico -->
    <path d="M33.2 52.6 A7.6 7.6 0 0 1 38.6 50.6 M46 61.4 A7.6 7.6 0 0 1 41.4 63.2" fill="none" stroke="${GLOW}" stroke-width=".6" stroke-linecap="round" opacity=".85"/>
    <path d="M44.4 51.8 h2.6 M45.2 53.2 h1.8" stroke="${GLOW}" stroke-width=".5" stroke-linecap="round" opacity=".75"/>
    <!-- nariz delicada -->
    <path d="M48.2 67.4 Q50 68.6 51.8 67.4" fill="none" stroke="${SHADE}" stroke-width=".9" stroke-linecap="round"/>
    <ellipse cx="50" cy="65.6" rx="1.1" ry=".7" fill="#fff" opacity=".4"/>
    <!-- labios rosados con brillo y sonrisa tranquila -->
    <path d="M42.6 75.4 C45.2 73.2 47.8 73 50 74.4 C52.2 73 54.8 73.2 57.4 75.4 C54.4 76.4 45.6 76.4 42.6 75.4 Z" fill="#d76c8d"/>
    <path d="M42.6 75.4 C45.6 80.6 54.4 80.6 57.4 75.4 C54.4 76.6 45.6 76.6 42.6 75.4 Z" fill="url(#${u}lp)"/>
    <ellipse cx="51.6" cy="77.8" rx="2.4" ry=".9" fill="#fff" opacity=".55"/>
    <path d="M42.2 75.2 Q41.6 74.8 41.2 74.2 M57.8 75.2 Q58.4 74.8 58.8 74.2" stroke="${SHADE}" stroke-width=".7" stroke-linecap="round" opacity=".6"/>
    <!-- destellos alrededor -->
    ${sparkle(90, 32, 0.9)}${sparkle(9.4, 36, 0.6, '#ffd1ea')}${sparkle(88, 86, 0.5, '#ffd1ea')}`;
}

export function mechanizerHead(label = 'Mechanizer') {
  const u = `mz${(seq += 1)}`;
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${label}"><g transform="translate(5 6) scale(.9)">${head(u)}</g></svg>`;
}

// Busto pequeño: cuello, gargantilla de oro rosa con corazón de luz y
// camiseta blanca de tiras (como en sus avatares).
export function mechanizerBust(label = 'Mechanizer') {
  const u = `mz${(seq += 1)}`;
  return `<svg viewBox="0 0 120 134" role="img" aria-label="${label}">
    <defs><radialGradient id="${u}bsk" cx="50%" cy="20%" r="80%"><stop offset="0" stop-color="#fbdcc6"/><stop offset="1" stop-color="${SKIN_D}"/></radialGradient></defs>
    <path d="M52.4 84 L52 104 L68 104 L67.6 84 Z" fill="${SKIN_D}"/>
    <path d="M52.4 86 Q60 92 67.6 86 L67.6 90 Q60 95 52.4 90 Z" fill="${SHADE}" opacity=".45"/>
    <!-- costura de luz en el cuello -->
    <path d="M55 93.6 v8.4 M65 93.6 v8.4" stroke="${GLOW}" stroke-width=".6" opacity=".8"/>
    <circle cx="55" cy="96" r=".7" fill="#fff"/><circle cx="65" cy="99" r=".7" fill="#fff"/>
    <path d="M20 134 C20 114 36 103 60 103 C84 103 100 114 100 134 Z" fill="url(#${u}bsk)"/>
    <path d="M33 134 C33 120 38.6 108.6 44.6 104.6 L50.4 104.4 C50 112.6 54 118 60 118 C66 118 70 112.6 69.6 104.4 L75.4 104.6 C81.4 108.6 87 120 87 134 Z" fill="#fdfbff"/>
    <path d="M44.6 104.6 C43.6 110.6 43.8 115.6 45.4 119 M75.4 104.6 C76.4 110.6 76.2 115.6 74.6 119" stroke="#e9e1fb" stroke-width="1" fill="none"/>
    <!-- gargantilla de oro rosa con corazón de luz -->
    <path d="M52.6 96.6 Q60 101.4 67.4 96.6" fill="none" stroke="#e7b3a6" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="60" cy="102.4" r="4.4" fill="${GLOW}" opacity=".22"/>
    ${heart(60, 101.8, 0.85)}
    <circle cx="59" cy="100.6" r=".55" fill="#fff"/>
    <g transform="translate(10 0)">${head(u)}</g>
  </svg>`;
}
