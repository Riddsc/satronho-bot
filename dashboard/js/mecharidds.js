// MechaRidds: la versión androide de Ridds (RiddsSatronho), el creador de
// Satronho Bot. Lleva su gorra negra con el control, sus gafas grandes,
// su sonrisa y su bata de laboratorio; como androide tiene antena, oídos
// metálicos con luz, ojos LED, una placa con tornillos en la mejilla y el
// cuello articulado. Es el guía del Chat Bot.
//
// mechaHead(): cabeza para los círculos de guía (viewBox 0 0 100 100).
// mechaBust(): busto grande para la página del Chat Bot y Novedades.

const INK = '#1b1823';
const SKIN = '#b8744c';
const SKIN_D = '#9a5d3b';
const METAL = '#c3c9d6';
const METAL_D = '#8a92a4';
const LED = '#ffb23e'; // ámbar de Satronho
const LILAC = '#8b5cf6';

// Cabeza completa; (0,0) arriba a la izquierda de un lienzo de 100×100.
function head({ blink = false } = {}) {
  const eye = (x) => blink
    ? `<path d="M${x - 5} 55 Q${x} 58 ${x + 5} 55" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`
    : `<circle cx="${x}" cy="55" r="5.6" fill="#141020"/>
       <circle cx="${x}" cy="55" r="3.9" fill="none" stroke="${LED}" stroke-width="1.8"/>
       <circle cx="${x}" cy="55" r="1.6" fill="#fff4dc"/>
       <circle cx="${x - 2}" cy="53" r="1" fill="#fff" opacity=".9"/>`;
  return `
    <!-- antena -->
    <path d="M50 10 L50 2" stroke="${METAL_D}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="50" cy="2.5" r="3" fill="${LED}"/><circle cx="50" cy="2.5" r="5.5" fill="${LED}" opacity=".25"/>
    <!-- oídos metálicos con luz y arete -->
    <circle cx="17" cy="58" r="8.5" fill="${METAL}" stroke="${METAL_D}" stroke-width="1.6"/>
    <circle cx="17" cy="58" r="4.6" fill="none" stroke="${LILAC}" stroke-width="2"/>
    <circle cx="83" cy="58" r="8.5" fill="${METAL}" stroke="${METAL_D}" stroke-width="1.6"/>
    <circle cx="83" cy="58" r="4.6" fill="none" stroke="${LILAC}" stroke-width="2"/>
    <circle cx="16" cy="69" r="2.4" fill="${INK}"/><circle cx="84" cy="69" r="2.4" fill="${INK}"/>
    <!-- cara -->
    <path d="M20 46 C20 28 33 20 50 20 C67 20 80 28 80 46 L80 62 C80 80 67 90 50 90 C33 90 20 80 20 62 Z" fill="${SKIN}"/>
    <!-- costura de androide en la mandíbula -->
    <path d="M26 72 Q50 92 74 72" fill="none" stroke="${SKIN_D}" stroke-width="1.3" stroke-dasharray="3 2.4" opacity=".8"/>
    <!-- placa con tornillos en la mejilla -->
    <path d="M65 64 L76 61 L77 72 L67 74 Z" fill="${METAL}" stroke="${METAL_D}" stroke-width="1.2"/>
    <circle cx="68" cy="66" r=".9" fill="${METAL_D}"/><circle cx="74.4" cy="64.4" r=".9" fill="${METAL_D}"/>
    <circle cx="74.8" cy="70.4" r=".9" fill="${METAL_D}"/><circle cx="68.8" cy="72" r=".9" fill="${METAL_D}"/>
    <!-- patillas -->
    <path d="M21 44 Q22 52 24 56 L26 45 Z M79 44 Q78 52 76 56 L74 45 Z" fill="${INK}"/>
    <!-- gorra con el control -->
    <path d="M18 40 C18 18 32 9 50 9 C68 9 82 18 82 40 Z" fill="#17151d"/>
    <path d="M18 40 L82 40 L80 45 L20 45 Z" fill="#26232e"/>
    <path d="M21 44 Q50 36 79 44" fill="none" stroke="#3a3645" stroke-width="1.6"/>
    <rect x="38" y="20" width="24" height="10" rx="5" fill="#e6e3ee"/>
    <path d="M42.5 25 h4 M44.5 23 v4" stroke="#55506a" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="55" cy="25" r="1.6" fill="${LILAC}"/><circle cx="58.6" cy="25" r="1.2" fill="#9c96b0"/>
    <!-- gafas grandes -->
    <rect x="25" y="46" width="22" height="18" rx="4.5" fill="#cfe8ff" fill-opacity=".22" stroke="#0f0d14" stroke-width="3.6"/>
    <rect x="53" y="46" width="22" height="18" rx="4.5" fill="#cfe8ff" fill-opacity=".22" stroke="#0f0d14" stroke-width="3.6"/>
    <path d="M47 52 Q50 50 53 52" fill="none" stroke="#0f0d14" stroke-width="3.2"/>
    <path d="M25 50 L20 48 M75 50 L80 48" stroke="#0f0d14" stroke-width="3"/>
    ${eye(36)}${eye(64)}
    <path d="M29 49 l5 0 M57 49 l5 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
    <!-- mejillas y sonrisa grande -->
    <ellipse cx="29" cy="71" rx="4.4" ry="2.8" fill="#ff7a8a" opacity=".35"/>
    <path d="M38 72 Q50 85 62 72 Q50 76 38 72 Z" fill="#3b1620"/>
    <path d="M40 72.6 Q50 75.4 60 72.6 L59 74.6 Q50 77 41 74.6 Z" fill="#fff"/>
    <path d="M44.5 79.6 Q50 82 55.5 79.6 Q50 78 44.5 79.6 Z" fill="#e5788c"/>`;
}

export function mechaHead(label = 'MechaRidds') {
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${label}"><g transform="translate(6 7) scale(.88)">${head()}</g></svg>`;
}

// Busto: cabeza + cuello articulado + bata con el emblema de Satronho.
export function mechaBust(label = 'MechaRidds') {
  return `<svg viewBox="0 0 200 230" role="img" aria-label="${label}">
    <defs>
      <radialGradient id="mr-glow" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="${LED}" stop-opacity=".22"/><stop offset="1" stop-color="${LED}" stop-opacity="0"/></radialGradient>
    </defs>
    <circle cx="100" cy="104" r="96" fill="url(#mr-glow)"/>
    <!-- cuello articulado -->
    <rect x="86" y="150" width="28" height="22" rx="4" fill="${METAL}" stroke="${METAL_D}" stroke-width="1.6"/>
    <path d="M86 157 h28 M86 164 h28" stroke="${METAL_D}" stroke-width="1.4"/>
    <!-- camiseta y bata -->
    <path d="M40 230 C40 190 62 170 100 170 C138 170 160 190 160 230 Z" fill="#17151d"/>
    <path d="M30 230 C32 196 50 176 84 168 L100 206 L116 168 C150 176 168 196 170 230 Z" fill="#f4f2f8"/>
    <path d="M84 168 L100 206 L92 214 L72 178 Z M116 168 L100 206 L108 214 L128 178 Z" fill="#dcd8e6"/>
    <!-- bolsillo con lápices -->
    <rect x="128" y="198" width="22" height="18" rx="3" fill="#e7e3ef" stroke="#cbc6d8"/>
    <rect x="133" y="190" width="3" height="11" rx="1.4" fill="${LILAC}"/><rect x="139" y="188" width="3" height="13" rx="1.4" fill="#4fd1c5"/>
    <!-- emblema: el planeta de Satronho -->
    <g transform="translate(66 204)">
      <circle r="9" fill="#2a2140"/>
      <circle r="4.6" fill="${LED}"/>
      <ellipse rx="8" ry="2.6" fill="none" stroke="#b9a8ff" stroke-width="1.4" transform="rotate(-18)"/>
    </g>
    <!-- cabeza -->
    <g transform="translate(36 32) scale(1.28)">${head()}</g>
  </svg>`;
}
