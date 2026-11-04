// Voces neuronales de Piper (proyecto rhasspy/piper-voices).
// Se descargan una sola vez desde Hugging Face al pulsar "Descargar".
// Cada voz tiene su propia licencia (ver su MODEL_CARD en Hugging Face);
// revísala antes de usar la app con fines comerciales.
//
// lang: 'es' entra al reparto automático por espectador; 'en' y 'fr' se
// usan solo a mano (Voz del chat → Espectadores especiales).
// gender: 'f' | 'm' | '' (desconocido o varias).

const BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';

const COUNTRY = {
  es_MX: 'México', es_AR: 'Argentina', es_ES: 'España',
  en_US: 'Estados Unidos', en_GB: 'Reino Unido', fr_FR: 'Francia',
};
const LANG_NAME = { es: 'Español', en: 'Inglés', fr: 'Francés' };

function voice(locale, name, quality, label, extra = {}) {
  const id = `${locale}-${name}-${quality}`;
  const lang = locale.slice(0, 2);
  return {
    id,
    label,
    lang,
    langName: LANG_NAME[lang] || lang,
    country: COUNTRY[locale] || locale,
    gender: extra.gender || '',
    quality: { high: 'alta', medium: 'media', low: 'baja', x_low: 'muy baja' }[quality] || quality,
    model: `${BASE}/${lang}/${locale}/${name}/${quality}/${id}.onnx`,
    config: `${BASE}/${lang}/${locale}/${name}/${quality}/${id}.onnx.json`,
    speakers: extra.speakers || 1,
  };
}

const VOICES = [
  // ----- Español -----
  voice('es_MX', 'claude', 'high', 'Claude · México', { gender: 'f' }),
  voice('es_MX', 'ald', 'medium', 'Ald · México', { gender: 'm' }),
  voice('es_AR', 'daniela', 'high', 'Daniela · Argentina', { gender: 'f' }),
  voice('es_ES', 'davefx', 'medium', 'Davefx · España', { gender: 'm' }),
  voice('es_ES', 'sharvard', 'medium', 'Sharvard · España (2 voces)', { speakers: 2 }),
  voice('es_ES', 'mls_10246', 'low', 'MLS 10246 · España'),
  voice('es_ES', 'mls_9972', 'low', 'MLS 9972 · España'),
  voice('es_ES', 'carlfm', 'x_low', 'Carlfm · España', { gender: 'm' }),
  // ----- Inglés: 4 femeninas y 4 masculinas -----
  voice('en_US', 'amy', 'medium', 'Amy · Estados Unidos', { gender: 'f' }),
  voice('en_US', 'kristin', 'medium', 'Kristin · Estados Unidos', { gender: 'f' }),
  voice('en_GB', 'alba', 'medium', 'Alba · Reino Unido', { gender: 'f' }),
  voice('en_GB', 'jenny_dioco', 'medium', 'Jenny · Reino Unido', { gender: 'f' }),
  voice('en_US', 'ryan', 'high', 'Ryan · Estados Unidos', { gender: 'm' }),
  voice('en_US', 'joe', 'medium', 'Joe · Estados Unidos', { gender: 'm' }),
  voice('en_GB', 'alan', 'medium', 'Alan · Reino Unido', { gender: 'm' }),
  voice('en_GB', 'northern_english_male', 'medium', 'Northern · Reino Unido', { gender: 'm' }),
  // ----- Francés: 2 femeninas y 2 masculinas (UPMC trae Jessica y Pierre) -----
  voice('fr_FR', 'siwis', 'medium', 'Siwis · Francia', { gender: 'f' }),
  voice('fr_FR', 'upmc', 'medium', 'UPMC · Francia (Jessica y Pierre)', { speakers: 2 }),
  voice('fr_FR', 'tom', 'medium', 'Tom · Francia', { gender: 'm' }),
  voice('fr_FR', 'gilles', 'low', 'Gilles · Francia', { gender: 'm' }),
];

// Motor Piper (versión 2023.11.14-2, licencia MIT) desde GitHub.
const ENGINE_RELEASE = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2';
const ENGINE_ASSETS = {
  'win32-x64': 'piper_windows_amd64.zip',
  'linux-x64': 'piper_linux_x86_64.tar.gz',
  'linux-arm64': 'piper_linux_aarch64.tar.gz',
  'darwin-x64': 'piper_macos_x64.tar.gz',
  'darwin-arm64': 'piper_macos_aarch64.tar.gz',
};

module.exports = { VOICES, ENGINE_RELEASE, ENGINE_ASSETS };
