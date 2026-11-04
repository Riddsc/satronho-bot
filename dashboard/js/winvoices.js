// Voces de Windows: el navegador no dice si son de mujer o de hombre, así que
// lo sabemos por el nombre (las voces que trae Windows 10 y 11). Sirve para
// mostrarlo en «Elegir voz» y para que, si una voz en línea o de Piper falla,
// la sustituta sea del mismo género e idioma (antes caía siempre en Pablo).

const FEMALE = ['sabina', 'helena', 'laura', 'hilda', 'elvira', 'dalia', 'paloma', 'salome', 'elena', 'zira', 'hazel', 'susan',
  'linda', 'heather', 'catherine', 'heera', 'aria', 'jenny', 'emma', 'ava', 'sonia', 'libby', 'eva', 'julie', 'hortense', 'caroline',
  'denise', 'elsa', 'isabella', 'maria', 'helia', 'francisca', 'hedda', 'katja', 'amala', 'haruka', 'ayumi', 'sayaka', 'nanami',
  'heami', 'sunhi', 'huihui', 'yaoyao', 'xiaoxiao', 'tracy', 'hanhan', 'yating', 'irina', 'paulina', 'hulya', 'zofia', 'bengisu'];
const MALE = ['pablo', 'raul', 'alvaro', 'jorge', 'gonzalo', 'tomas', 'david', 'mark', 'george', 'james', 'richard', 'ravi', 'guy',
  'andrew', 'brian', 'christopher', 'eric', 'roger', 'steffan', 'ryan', 'thomas', 'paul', 'claude', 'guillaume', 'henri', 'cosimo',
  'diego', 'daniel', 'antonio', 'duarte', 'stefan', 'conrad', 'killian', 'ichiro', 'keita', 'kangkang', 'yunxi', 'danny', 'zhiwei',
  'pavel', 'dmitry', 'adam', 'filip', 'tolga'];

const squash = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '');

// «Microsoft Sabina Desktop - Spanish (Mexico)» → «Sabina».
export function cleanName(name) {
  return String(name).replace(/^Microsoft\s+/i, '').replace(/\s+-\s+.*$/, '').replace(/\s+(Desktop|Online.*|Mobile)$/i, '').trim();
}

export function genderOf(name) {
  const words = squash(cleanName(name)).split(' ');
  if (words.some((w) => FEMALE.includes(w))) return 'f';
  if (words.some((w) => MALE.includes(w))) return 'm';
  return '';
}

// Una voz por nombre e idioma: Windows a veces registra la misma dos veces
// (la clásica «Desktop» y la de OneCore). Nos quedamos con la primera.
export function windowsVoices() {
  const seen = new Set();
  const out = [];
  for (const v of speechSynthesis.getVoices()) {
    const id = `${cleanName(v.name)}|${v.lang}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(v);
  }
  return out;
}

// Elige la voz de Windows más parecida a la que se quería:
// mismo género (lo más importante), luego mismo país y mismo idioma.
// wanted: { gender, lang, locale } (cualquiera puede faltar).
export function bestWindowsVoice(wanted, preferredName = '') {
  const list = speechSynthesis.getVoices();
  if (!list.length) return null;
  const want = wanted || {};
  const locale = String(want.locale || '').toLowerCase();
  const lang = String(want.lang || locale.slice(0, 2) || 'es').toLowerCase();
  let best = null;
  let bestScore = -1;
  for (const v of list) {
    const vl = v.lang.toLowerCase().replace('_', '-');
    let score = 0;
    if (want.gender && genderOf(v.name) === want.gender) score += 8;
    if (want.gender && genderOf(v.name) && genderOf(v.name) !== want.gender) score -= 8;
    if (locale && vl === locale) score += 3;
    if (vl.startsWith(lang)) score += 4;
    // Acento latino para voces de Latinoamérica: México o EE. UU. antes que España.
    if (/^es-(?!es)/.test(locale) && /^es-(mx|us|419)/.test(vl)) score += 1;
    if (!want.gender && preferredName && v.name === preferredName) score += 20;
    if (v.localService) score += 0.5;
    if (score > bestScore) { best = v; bestScore = score; }
  }
  return best;
}
