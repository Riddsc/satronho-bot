// MechaRidds: Ridds (RiddsSatronho), el creador de Satronho Bot, en versión
// androide caricaturizada. Mismo estilo que los perritos (mascots.js):
// cabeza grande y redonda, ojos con brillo, mejillas y sonrisa simples.
// De Ridds conserva la gorra negra con el control, las gafas grandes, la
// piel morena, las orejas con candongas negras, la sonrisa y la bata.
// De androide (0.11): un ojo mecánico violeta (el otro es su ojo café),
// media mandíbula metálica con costura de luz, articulaciones en las sienes,
// antena con luz, circuito en la mejilla, cuello con pistones y un núcleo en
// el pecho. Las luces son verde Hulk; el violeta es el de la app.
// Es un ayudante: aparece en Chat Bot, Novedades y Reportar, sin quitarle
// protagonismo a los perritos.
//
// mechaHead(): cabeza para los círculos de guía (viewBox 0 0 100 100).
// mechaBust(): busto pequeño para la portada del Chat Bot y Novedades.

const INK = '#1c1a22';
const SKIN = '#c98b63';
const SKIN_IN = '#ad6e4a';
const METAL = '#d7dce6';
const METAL_D = '#8a93a8';
const METAL_DD = '#5d6579';
const GLOW = '#74d14c'; // verde Hulk
const GLOW_D = '#3f8f2a';
const VIOLET = '#8b5cf6'; // el morado de la app
const BROWN = '#4a2a17';

const bolt = (x, y, r = 1.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${METAL_D}"/><path d="M${x - r * 0.6} ${y} h${r * 1.2}" stroke="${METAL_DD}" stroke-width=".7"/>`;

function head() {
  // Ojo de Ridds: café oscuro con brillo, como los perritos.
  const eyeHuman = (x) => `
    <ellipse cx="${x}" cy="57" rx="6" ry="6.4" fill="#fff"/>
    <circle cx="${x + 0.4}" cy="58" r="4" fill="${BROWN}"/>
    <circle cx="${x + 0.4}" cy="58" r="2.1" fill="#160c06"/>
    <circle cx="${x - 1}" cy="56.3" r="1.4" fill="#fff"/>`;
  // Ojo mecánico: lente violeta con anillo segmentado y aro de metal.
  const eyeMecha = (x) => `
    <circle cx="${x}" cy="57.4" r="6.6" fill="${METAL}" stroke="${METAL_D}" stroke-width="1"/>
    <circle cx="${x}" cy="57.4" r="4.9" fill="#1b1430"/>
    <circle cx="${x}" cy="57.4" r="3.9" fill="${VIOLET}"/>
    <circle cx="${x}" cy="57.4" r="3.9" fill="none" stroke="#c9b5ff" stroke-width=".9" stroke-dasharray="1.5 1.1"/>
    <circle cx="${x}" cy="57.4" r="1.7" fill="#120d22"/>
    <circle cx="${x - 1.3}" cy="55.9" r="1.2" fill="#fff"/>`;
  return `
    <!-- antena con anillo y luz -->
    <path d="M62 15 L66 4" stroke="${METAL_D}" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="61.6" y="10" width="5" height="2.6" rx="1.2" transform="rotate(20 64 11)" fill="${METAL_DD}"/>
    <circle cx="66.6" cy="3.6" r="5.5" fill="${GLOW}" opacity=".25"/>
    <circle cx="66.6" cy="3.6" r="3.1" fill="${GLOW}"/>
    <circle cx="65.6" cy="2.7" r="1" fill="#fff"/>
    <!-- orejas de piel con candongas negras -->
    <ellipse cx="19.5" cy="61" rx="6.5" ry="8.5" fill="${SKIN}"/>
    <ellipse cx="20.5" cy="61" rx="3.2" ry="5" fill="${SKIN_IN}"/>
    <ellipse cx="80.5" cy="61" rx="6.5" ry="8.5" fill="${SKIN}"/>
    <ellipse cx="79.5" cy="61" rx="3.2" ry="5" fill="${SKIN_IN}"/>
    <!-- cara -->
    <ellipse cx="50" cy="60" rx="31" ry="30" fill="${SKIN}"/>
    <!-- media mandíbula metálica (lado del ojo mecánico) con costura de luz -->
    <path d="M56 89.4 C68 88 78 80 80.6 68 L70 66 Q66 78 56 80 Z" fill="${METAL}"/>
    <path d="M56 80 Q66 78 70 66 L80.6 68" fill="none" stroke="${GLOW}" stroke-width="1.3"/>
    <path d="M62 86 v-4 h6 l3 -4" fill="none" stroke="${METAL_D}" stroke-width=".9"/>
    ${bolt(74, 76, 1.4)}
    <!-- circuito en la otra mejilla -->
    <path d="M26 64 v6 l4 4 h3" fill="none" stroke="${GLOW}" stroke-width="1.1" stroke-linecap="round"/>
    <circle cx="33.4" cy="74" r="1.1" fill="${GLOW}"/>
    <!-- candongas negras -->
    <circle cx="17.5" cy="73" r="4.2" fill="none" stroke="${INK}" stroke-width="2.3"/>
    <circle cx="82.5" cy="73" r="4.2" fill="none" stroke="${INK}" stroke-width="2.3"/>
    <!-- articulaciones de las sienes -->
    <circle cx="23.5" cy="50" r="4.2" fill="${METAL}" stroke="${METAL_D}" stroke-width="1"/>${bolt(23.5, 50)}
    <circle cx="76.5" cy="50" r="4.2" fill="${METAL}" stroke="${METAL_D}" stroke-width="1"/>${bolt(76.5, 50)}
    <!-- gorra negra con el control gris y el punto morado -->
    <path d="M18 47 C17 25 31 14 50 14 C69 14 83 25 82 47 Z" fill="#1d1b24"/>
    <path d="M17 46 Q50 40 83 46 L83 50.5 Q50 44.5 17 50.5 Z" fill="#2c2935"/>
    <path d="M22 47.4 Q50 42.6 78 47.4" fill="none" stroke="${GLOW}" stroke-width=".9" opacity=".7"/>
    <rect x="40" y="25" width="20" height="9" rx="4.5" fill="#d9d6e2"/>
    <path d="M43.6 29.5 h3.6 M45.4 27.7 v3.6" stroke="#5b5672" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="53.6" cy="29.5" r="1.5" fill="${VIOLET}"/><circle cx="56.8" cy="29.5" r="1.1" fill="#9c96b0"/>
    <!-- ojos y gafas negras grandes con reflejo -->
    ${eyeHuman(38)}${eyeMecha(62)}
    <rect x="52.5" y="49" width="19" height="16" rx="5" fill="${VIOLET}" opacity=".1"/>
    <rect x="28.5" y="49" width="19" height="16" rx="5" fill="none" stroke="#111017" stroke-width="3.6"/>
    <rect x="52.5" y="49" width="19" height="16" rx="5" fill="none" stroke="#111017" stroke-width="3.6"/>
    <path d="M31.5 53 l4 -2.2 M55.5 53 l4 -2.2" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>
    <path d="M47.5 55 Q50 53.4 52.5 55" fill="none" stroke="#111017" stroke-width="3"/>
    <!-- mejilla y sonrisa con dientes -->
    <ellipse cx="31" cy="70" rx="4.4" ry="2.8" fill="#ff7a8a" opacity=".35"/>
    <path d="M39 72 Q50 88 61 72 Q50 75 39 72 Z" fill="#3b1620"/>
    <path d="M40.6 72.6 Q50 75.6 59.4 72.6 L58.4 75.4 Q50 78 41.6 75.4 Z" fill="#fff"/>
    <path d="M45 81 Q50 83.6 55 81 Q50 79.4 45 81 Z" fill="#e5788c"/>`;
}

export function mechaHead(label = 'MechaRidds') {
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${label}"><g transform="translate(5 6) scale(.9)">${head()}</g></svg>`;
}

// Busto pequeño y caricaturizado: cabeza grande, cuello con pistones y bata.
export function mechaBust(label = 'MechaRidds') {
  return `<svg viewBox="0 0 120 134" role="img" aria-label="${label}">
    <!-- cuello articulado con anillos y pistones -->
    <rect x="51" y="94" width="18" height="15" rx="3" fill="${METAL}" stroke="${METAL_D}" stroke-width="1.2"/>
    <path d="M51 99 h18 M51 104 h18" stroke="${METAL_D}" stroke-width="1"/>
    <path d="M54 95 v13 M66 95 v13" stroke="${METAL_DD}" stroke-width="1.6" stroke-linecap="round"/>
    <!-- camiseta negra con núcleo verde -->
    <path d="M30 134 C30 118 42 108 60 108 C78 108 90 118 90 134 Z" fill="#17151d"/>
    <circle cx="60" cy="122" r="5" fill="${GLOW}" opacity=".25"/>
    <circle cx="60" cy="122" r="3.2" fill="${GLOW}"/>
    <circle cx="60" cy="122" r="3.2" fill="none" stroke="${GLOW_D}" stroke-width=".8"/>
    <circle cx="59.2" cy="121.2" r=".9" fill="#fff"/>
    <!-- bata blanca -->
    <path d="M24 134 C26 118 36 108 50 106 L56 120 L52 134 Z M96 134 C94 118 84 108 70 106 L64 120 L68 134 Z" fill="#f4f2f8"/>
    <path d="M50 106 L56 120 L51 124 L44 110 Z M70 106 L64 120 L69 124 L76 110 Z" fill="#dcd8e6"/>
    <rect x="78" y="118" width="11" height="9" rx="2" fill="#e7e3ef" stroke="#cbc6d8"/>
    <rect x="80.5" y="114" width="2" height="6" rx="1" fill="${VIOLET}"/><rect x="84" y="113" width="2" height="7" rx="1" fill="${GLOW}"/>
    <g transform="translate(10 0)">${head()}</g>
  </svg>`;
}
