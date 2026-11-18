// Mechanizer: la Colonizadora en versión androide, en la misma línea que MechaRidds
// (cabeza grande, ojos con brillo, rasgos simples), pero fina y hermosa.
// Cara ovalada con mentón suave; melena bob negra y brillante con raya y flequillo
// de lado; ojos almendrados grandes con delineado de colita y pestañas; gafas
// delgadas tipo cat-eye en oro rosa; rubor y labios rosados con brillo.
// Lo de androide va con elegancia: un ojo biónico rosa con aro fino de metal
// (como el ojo mecánico violeta de MechaRidds), placa perlada en la mejilla con
// costura de luz rosa, articulación pequeña en la sien, antena fina con un
// corazón de luz y aretes de perla. En el busto, blusa blanca de tiras y
// gargantilla de oro rosa con un corazón de luz.
// Lleva el Chat en vivo, su ventana aparte y el chat en pantalla.
//
// mechanizerHead(): cabeza para los círculos de guía (viewBox 0 0 100 100).
// mechanizerBust(): busto pequeño para portadas.

const INK = '#2a1d2c';
const HAIR = '#15111a';
const HAIR_HI = '#4a4058';
const SKIN = '#f7d2b8';
const SKIN_D = '#ecb89a';
const SHADE = '#dc9c82';
const GLOW = '#ff6fb5';
const GLOW_SOFT = '#ffc2e0';
const ROSE = '#d98aa0'; // montura y joyas en oro rosa
const ROSE_D = '#b8687f';
const PEARL = '#f4f1fa';
const PEARL_D = '#cbc4dc';
const LIPS = '#e25d7f';
const LIPS_D = '#c2416a';
const BROWN = '#5a3420';

// Cada dibujo usa ids propios para sus degradados (puede haber varios en la página).
let seq = 0;

const heart = (x, y, s, fill = GLOW) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 1.6 C-1.8 0 -3.2 -1 -3.2 -2.4 C-3.2 -3.6 -2.2 -4.3 -1.3 -4.3 C-0.6 -4.3 -0.2 -3.9 0 -3.5 C0.2 -3.9 0.6 -4.3 1.3 -4.3 C2.2 -4.3 3.2 -3.6 3.2 -2.4 C3.2 -1 1.8 0 0 1.6 Z" fill="${fill}"/>`;

const sparkle = (x, y, s, c = '#fff') =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -4 Q.6 -.6 4 0 Q.6 .6 0 4 Q-.6 .6 -4 0 Q-.6 -.6 0 -4 Z" fill="${c}"/>`;

// Ojo almendrado (blanco)
const eyeWhite = (cx) =>
  `<path d="M${cx - 8.2} 57.4 C${cx - 5.4} 50.8 ${cx + 5.4} 50.8 ${cx + 8.2} 57.2 C${cx + 5.4} 62 ${cx - 5.4} 62 ${cx - 8.2} 57.4 Z" fill="#fff"/>`;

// Su ojo: café con brillo, como los perritos
const eyeHuman = (cx) => `${eyeWhite(cx)}
    <circle cx="${cx + 0.3}" cy="56.8" r="4.3" fill="${BROWN}"/>
    <circle cx="${cx + 0.3}" cy="56.8" r="4.3" fill="none" stroke="#2c170c" stroke-width=".5"/>
    <circle cx="${cx + 0.3}" cy="56.8" r="2.2" fill="#1a0e08"/>
    <circle cx="${cx - 1.2}" cy="55" r="1.5" fill="#fff"/><circle cx="${cx + 2}" cy="58.6" r=".6" fill="#fff" opacity=".8"/>`;

// Ojo biónico: lente rosa con anillo segmentado y aro fino de metal
const eyeBionic = (cx) => `${eyeWhite(cx)}
    <circle cx="${cx - 0.3}" cy="56.8" r="4.4" fill="${GLOW}"/>
    <circle cx="${cx - 0.3}" cy="56.8" r="3.3" fill="none" stroke="${GLOW_SOFT}" stroke-width=".7" stroke-dasharray="1.2 .9"/>
    <circle cx="${cx - 0.3}" cy="56.8" r="1.9" fill="#3a1030"/>
    <circle cx="${cx - 1.7}" cy="55" r="1.5" fill="#fff"/><circle cx="${cx + 1.5}" cy="58.6" r=".6" fill="#fff" opacity=".8"/>
    <circle cx="${cx - 0.3}" cy="56.8" r="5" fill="none" stroke="${PEARL_D}" stroke-width=".5" opacity=".9"/>`;

// Párpado con delineado de colita y pestañas. side = -1 ojo izquierdo, 1 derecho.
function lid(cx, side) {
  const o = cx + side * 8.2;
  const i = cx - side * 8.2;
  return `
    <path d="M${i} 57.5 C${i + side * 3} 50.4 ${o - side * 3} 50.4 ${o} 57.1" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M${o} 57.1 Q${o + side * 1.6} 55.8 ${o + side * 3.2} 54.2" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M${o - side * 1.3} 54.2 l${side * 1.8} -2.1 M${o - side * 3.4} 52.6 l${side * 1.2} -2.3 M${o - side * 5.6} 51.6 l${side * 0.6} -2.1" stroke="${INK}" stroke-width=".9" stroke-linecap="round"/>
    <path d="M${i + side * 1.5} 59.8 C${i + side * 4} 62.6 ${o - side * 4} 62.6 ${o - side * 1.2} 59.9" fill="none" stroke="${SHADE}" stroke-width=".6" opacity=".8"/>`;
}

// Lente cat-eye: la esquina de afuera sube
function lens(cx, side) {
  const o = cx + side * 10.4;
  const i = cx - side * 9.0;
  const d = `M${i} 51.6 C${i} 50 ${cx} 49.2 ${o} 48 C${o + side * 0.4} 53 ${o - side * 1.6} 62.8 ${cx} 63.4 C${i + side * 1.0} 63.6 ${i - side * 0.2} 58.6 ${i} 51.6 Z`;
  return `
    <path d="${d}" fill="${GLOW}" fill-opacity=".07" stroke="${ROSE}" stroke-width="1.15" stroke-linejoin="round"/>
    <path d="M${cx - side * 4} 53.4 l${side * 2.8} -1.3" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".75"/>`;
}

function head() {
  return `
    <!-- antena fina con corazón de luz -->
    <path d="M64 22 L69 9.5" stroke="${PEARL_D}" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="69.6" cy="7.6" r="4.6" fill="${GLOW}" opacity=".22"/>
    ${heart(69.6, 9.4, 0.95)}
    <circle cx="68.6" cy="6.4" r=".6" fill="#fff"/>
    <!-- melena bob por detrás -->
    <path d="M17.5 58 C16 33 30 17.5 50 17.5 C70 17.5 84 33 82.5 58 C82.2 68 80.6 75.5 77.5 80.5 C73 82.6 68 82.2 64 80 L36 80 C32 82.2 27 82.6 22.5 80.5 C19.4 75.5 17.8 68 17.5 58 Z" fill="${HAIR}"/>
    <!-- cuello con costura de luz -->
    <path d="M44.2 80 L43.8 97 L56.2 97 L55.8 80 Z" fill="${SKIN_D}"/>
    <path d="M43.5 82 Q50 87 56.5 82 L56.5 85 Q50 90 43.5 85 Z" fill="${SHADE}" opacity=".45"/>
    <path d="M53.8 87 v9" stroke="${GLOW}" stroke-width=".55" opacity=".85"/>
    <!-- aretes de perla -->
    <path d="M24.6 74 v4.2" stroke="${ROSE}" stroke-width=".7"/><circle cx="24.6" cy="80" r="2.1" fill="${PEARL}" stroke="${PEARL_D}" stroke-width=".5"/><circle cx="24" cy="79.4" r=".6" fill="#fff"/>
    <path d="M75.4 74 v4.2" stroke="${ROSE}" stroke-width=".7"/><circle cx="75.4" cy="80" r="2.1" fill="${PEARL}" stroke="${PEARL_D}" stroke-width=".5"/><circle cx="74.8" cy="79.4" r=".6" fill="#fff"/>
    <!-- cara ovalada, mentón suave -->
    <path d="M50 29 C65.5 29 76 40.5 76 56.5 C76 71 66.5 84.2 50 85.8 C33.5 84.2 24 71 24 56.5 C24 40.5 34.5 29 50 29 Z" fill="${SKIN}"/>
    <!-- placa perlada en la mejilla (lado del ojo biónico) con costura de luz rosa -->
    <path d="M57.5 83.2 C65.5 80 72.8 72.6 75.2 63.6 L69.6 62.6 Q67.2 73.4 57 77.8 Z" fill="${PEARL}"/>
    <path d="M57 77.8 Q67.2 73.4 69.6 62.6 L75.2 63.6" fill="none" stroke="${GLOW}" stroke-width=".9"/>
    <path d="M62.5 79.6 v-2.6 h3.6 l2 -2.6" fill="none" stroke="${PEARL_D}" stroke-width=".55"/>
    <circle cx="70.6" cy="71" r=".9" fill="${GLOW}"/>
    <!-- melena por delante: flequillo barrido de lado y mechones que enmarcan la cara -->
    <path d="M40 18.6 C28 19.8 21 31 21 46 C21.4 52 22.4 58 23.6 63 C24 54.6 25.4 47.4 28.6 42.6 C32.6 39.4 36.6 35.6 39.6 30.6 C46 37.6 60 40.4 75.6 43.2 C77.2 48 77.7 53.4 77.6 58 C79.4 51 80 44.5 79 38 C76 25 63 17.8 40 18.6 Z" fill="${HAIR}"/>
    <path d="M39.8 30.8 C46.5 36.6 58 39 70 40.4" fill="none" stroke="${HAIR_HI}" stroke-width="1" opacity=".5"/>
    <path d="M23.6 63 C23.2 70 24.6 76.4 27.6 80.6 C24 79.4 20.6 74 19.8 66 Z" fill="${HAIR}"/>
    <path d="M77.6 58 C78 66 76.6 74.6 72.6 80.4 C77 79.2 80.4 72 80.8 63.5 Z" fill="${HAIR}"/>
    <!-- brillo del pelo -->
    <path d="M30 27.5 C36 22.4 46 20.6 55 22" fill="none" stroke="${HAIR_HI}" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>
    <path d="M60 23.5 C66 25 71 28.5 74 33" fill="none" stroke="${HAIR_HI}" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>
    <!-- articulación fina en la sien -->
    <circle cx="76.2" cy="52" r="2.6" fill="${PEARL}" stroke="${ROSE_D}" stroke-width=".6"/>
    <circle cx="76.2" cy="52" r=".9" fill="${GLOW}"/>
    <!-- cejas finas y arqueadas -->
    <path d="M30.6 45.6 C34.4 42.8 40.6 42.4 44.8 44.6" fill="none" stroke="${HAIR}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M55.2 44.6 C59.4 42.4 65.6 42.8 69.4 45.6" fill="none" stroke="${HAIR}" stroke-width="1.5" stroke-linecap="round"/>
    <!-- ojos: el suyo café y el biónico rosa -->
    ${eyeHuman(38)}${lid(38, -1)}
    ${eyeBionic(62)}${lid(62, 1)}
    <!-- gafas finas cat-eye en oro rosa -->
    ${lens(38, -1)}${lens(62, 1)}
    <path d="M47.2 52.6 Q50 50.8 52.8 52.6" fill="none" stroke="${ROSE}" stroke-width="1.05" stroke-linecap="round"/>
    <!-- nariz -->
    <path d="M50.6 62.6 Q51.8 66.4 49.2 67" fill="none" stroke="${SHADE}" stroke-width=".9" stroke-linecap="round"/>
    <!-- rubor -->
    <ellipse cx="32.5" cy="67.2" rx="4.6" ry="2.4" fill="#ff8aa6" opacity=".38"/>
    <ellipse cx="66.2" cy="66.6" rx="3.6" ry="2" fill="#ff8aa6" opacity=".32"/>
    <!-- labios con brillo y sonrisa tranquila -->
    <path d="M43.8 73.6 Q47 71.6 50 72.9 Q53 71.6 56.2 73.6 Q53 75.2 50 74.9 Q47 75.2 43.8 73.6 Z" fill="${LIPS_D}"/>
    <path d="M43.8 73.6 Q50 75.6 56.2 73.6 Q54.4 78.6 50 78.8 Q45.6 78.6 43.8 73.6 Z" fill="${LIPS}"/>
    <ellipse cx="51.6" cy="76.5" rx="1.9" ry=".7" fill="#fff" opacity=".55"/>
    <path d="M43.2 73.2 q-.6 .2 -.9 .9 M56.8 73.2 q.6 .2 .9 .9" stroke="${SHADE}" stroke-width=".6" stroke-linecap="round"/>`;
}

export function mechanizerHead(label = 'Mechanizer') {
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${label}"><g transform="translate(5 6) scale(.9)">${head()}</g></svg>`;
}

// Busto pequeño: hombros, blusa blanca de tiras y gargantilla de oro rosa con corazón de luz.
export function mechanizerBust(label = 'Mechanizer') {
  const u = `mz${(seq += 1)}`;
  return `<svg viewBox="0 0 120 134" role="img" aria-label="${label}">
    <defs><linearGradient id="${u}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfbff"/><stop offset="1" stop-color="#ece6f8"/></linearGradient></defs>
    <path d="M22 134 C22 116 36 106.5 60 106.5 C84 106.5 98 116 98 134 Z" fill="${SKIN_D}"/>
    <path d="M30 134 C30 122 36 112.6 43.6 109.6 L46.6 109.6 C47.4 117.6 52.6 122.4 60 122.4 C67.4 122.4 72.6 117.6 73.4 109.6 L76.4 109.6 C84 112.6 90 122 90 134 Z" fill="url(#${u}t)"/>
    <path d="M43.6 109.6 L41.8 106.4 M76.4 109.6 L78.2 106.4" stroke="#e9e1fb" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M53.6 104.6 Q60 108.6 66.4 104.6" fill="none" stroke="${ROSE}" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="60" cy="109.6" r="4" fill="${GLOW}" opacity=".2"/>
    ${heart(60, 110.6, 0.7)}
    <circle cx="59.2" cy="108.4" r=".5" fill="#fff"/>
    <g transform="translate(10 6)">${head()}</g>
    ${sparkle(98, 30, 0.9)}${sparkle(14, 40, 0.6, GLOW_SOFT)}${sparkle(96, 84, 0.5, GLOW_SOFT)}
  </svg>`;
}
