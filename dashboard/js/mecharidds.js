// MechaRidds: Ridds (RiddsSatronho), el creador de Satronho Bot, en versión
// androide caricaturizada. Mismo estilo que los perritos (mascots.js):
// cabeza grande y redonda, ojos con brillo, mejillas y sonrisa simples.
// De Ridds conserva la gorra negra con el control, las gafas grandes, la
// piel morena, las orejas con candongas negras y la bata. De androide solo
// lleva toques: una antenita, una plaquita en la mejilla y el cuello
// articulado. Es un ayudante: aparece en Chat Bot, Novedades y Reportar,
// sin quitarle protagonismo a los perritos.
//
// mechaHead(): cabeza para los círculos de guía (viewBox 0 0 100 100).
// mechaBust(): busto pequeño para la portada del Chat Bot y Novedades.

const INK = '#1c1a22';
const SKIN = '#b5734d';
const SKIN_IN = '#9a5c3c';
const METAL = '#cfd5e1';
const METAL_D = '#8e97aa';
const LED = '#ffb23e';

function head() {
  // Ojos de la familia (como los perritos), con el iris ámbar de androide.
  const eye = (x) => `
    <ellipse cx="${x}" cy="57" rx="6" ry="6.4" fill="#fff"/>
    <circle cx="${x + 0.4}" cy="58" r="4" fill="${LED}"/>
    <circle cx="${x + 0.4}" cy="58" r="2.1" fill="${INK}"/>
    <circle cx="${x - 1}" cy="56.4" r="1.3" fill="#fff"/>`;
  return `
    <!-- antenita -->
    <path d="M60 14 L64 5" stroke="${METAL_D}" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="64.6" cy="4.4" r="3.2" fill="${LED}"/>
    <!-- orejas normales con candongas negras -->
    <ellipse cx="19.5" cy="60" rx="6.5" ry="8.5" fill="${SKIN}"/>
    <ellipse cx="20.5" cy="60" rx="3.2" ry="5" fill="${SKIN_IN}"/>
    <ellipse cx="80.5" cy="60" rx="6.5" ry="8.5" fill="${SKIN}"/>
    <ellipse cx="79.5" cy="60" rx="3.2" ry="5" fill="${SKIN_IN}"/>
    <!-- cara -->
    <ellipse cx="50" cy="60" rx="31" ry="30" fill="${SKIN}"/>
    <!-- candongas negras (delante de la cara) -->
    <circle cx="17.5" cy="72" r="4.2" fill="none" stroke="${INK}" stroke-width="2.3"/>
    <circle cx="82.5" cy="72" r="4.2" fill="none" stroke="${INK}" stroke-width="2.3"/>
    <!-- patillas -->
    <path d="M21 50 Q21 58 24 62 L27 50 Z M79 50 Q79 58 76 62 L73 50 Z" fill="${INK}"/>
    <!-- gorra con el control -->
    <path d="M18 48 C17 26 31 15 50 15 C69 15 83 26 82 48 Z" fill="#1d1b24"/>
    <path d="M17 47 Q50 41 83 47 L83 51 Q50 45 17 51 Z" fill="#2c2935"/>
    <rect x="40" y="26" width="20" height="9" rx="4.5" fill="#e4e1ec"/>
    <path d="M43.6 30.5 h3.6 M45.4 28.7 v3.6" stroke="#5b5672" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="53.6" cy="30.5" r="1.5" fill="#8b5cf6"/><circle cx="56.8" cy="30.5" r="1.1" fill="#9c96b0"/>
    <!-- ojos y gafas grandes -->
    ${eye(38)}${eye(62)}
    <rect x="28.5" y="49" width="19" height="16" rx="5" fill="none" stroke="#111017" stroke-width="3.4"/>
    <rect x="52.5" y="49" width="19" height="16" rx="5" fill="none" stroke="#111017" stroke-width="3.4"/>
    <path d="M47.5 55 Q50 53.4 52.5 55" fill="none" stroke="#111017" stroke-width="3"/>
    <!-- plaquita mecánica en la mejilla -->
    <rect x="66" y="68" width="9" height="7" rx="2" fill="${METAL}" stroke="${METAL_D}" stroke-width="1"/>
    <circle cx="68.4" cy="71.5" r=".8" fill="${METAL_D}"/><circle cx="72.6" cy="71.5" r=".8" fill="${METAL_D}"/>
    <!-- mejillas y sonrisa con dientes -->
    <ellipse cx="30" cy="70" rx="4.6" ry="3" fill="#ff7a8a" opacity=".4"/>
    <path d="M39 72 Q50 88 61 72 Q50 75 39 72 Z" fill="#3b1620"/>
    <path d="M40.6 72.6 Q50 75.6 59.4 72.6 L58.4 75.4 Q50 78 41.6 75.4 Z" fill="#fff"/>
    <path d="M45 81 Q50 83.6 55 81 Q50 79.4 45 81 Z" fill="#e5788c"/>`;
}

export function mechaHead(label = 'MechaRidds') {
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${label}"><g transform="translate(5 6) scale(.9)">${head()}</g></svg>`;
}

// Busto pequeño y caricaturizado: cabeza grande, cuello articulado y bata.
export function mechaBust(label = 'MechaRidds') {
  return `<svg viewBox="0 0 120 132" role="img" aria-label="${label}">
    <!-- cuello articulado -->
    <rect x="52" y="96" width="16" height="12" rx="3" fill="${METAL}" stroke="${METAL_D}" stroke-width="1.2"/>
    <path d="M52 101 h16" stroke="${METAL_D}" stroke-width="1.1"/>
    <!-- camiseta negra y bata -->
    <path d="M30 132 C30 116 42 106 60 106 C78 106 90 116 90 132 Z" fill="#17151d"/>
    <path d="M24 132 C26 116 36 106 50 104 L60 122 L70 104 C84 106 94 116 96 132 Z" fill="#f4f2f8"/>
    <path d="M50 104 L60 122 L55 127 L44 109 Z M70 104 L60 122 L65 127 L76 109 Z" fill="#dcd8e6"/>
    <rect x="76" y="116" width="11" height="9" rx="2" fill="#e7e3ef" stroke="#cbc6d8"/>
    <rect x="78.5" y="112" width="2" height="6" rx="1" fill="#8b5cf6"/><rect x="82" y="111" width="2" height="7" rx="1" fill="#4fd1c5"/>
    <!-- cabeza -->
    <g transform="translate(10 0)">${head()}</g>
  </svg>`;
}
