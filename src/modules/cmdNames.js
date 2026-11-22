// Nombres por defecto de los comandos de huellitas, juegos y tienda en el
// idioma del streamer: su chat suele hablar ese idioma. Una vez que guardas
// tus propios nombres, se quedan los tuyos.

const { getLang } = require('../i18n');

const NAMES = {
  //            es              en          pt              fr            it
  balance: ['huellitas', 'paws', 'patinhas', 'pattes', 'zampette'],
  top: ['top', 'top', 'top', 'top', 'top'],
  give: ['regalar', 'give', 'doar', 'donner', 'regala'],
  add: ['dar', 'add', 'dar', 'ajouter', 'aggiungi'],
  remove: ['quitar', 'remove', 'tirar', 'retirer', 'togli'],
  duel: ['duelo', 'duel', 'duelo', 'duel', 'duello'],
  accept: ['acepto', 'accept', 'aceito', 'accepte', 'accetto'],
  slots: ['tragamonedas', 'slots', 'slots', 'slots', 'slot'],
  gamble: ['apuesta', 'gamble', 'aposta', 'pari', 'scommessa'],
  colors: ['color', 'color', 'cor', 'couleur', 'colore'],
  heist: ['atraco', 'heist', 'assalto', 'braquage', 'rapina'],
  trivia: ['trivia', 'trivia', 'quiz', 'quiz', 'quiz'],
  list: ['tienda', 'shop', 'loja', 'boutique', 'negozio'],
  buy: ['canjear', 'redeem', 'resgatar', 'obtenir', 'riscatta'],
  keys: ['llaves', 'keys', 'chaves', 'clés', 'chiavi'],
  open: ['abrir', 'open', 'abrir', 'ouvrir', 'apri'],
  chest: ['cofre', 'chest', 'bau', 'coffre', 'forziere'],
};
const ALIASES = { es: ['puntos', 'points'], en: ['points'], pt: ['pontos', 'points'], fr: ['points'], it: ['punti', 'points'] };
const IDX = { es: 0, en: 1, pt: 2, fr: 3, it: 4 };

const cmd = (key, lang = getLang()) => NAMES[key][IDX[lang] ?? 0];
const aliases = (lang = getLang()) => [...(ALIASES[lang] || ALIASES.es)];

module.exports = { cmd, aliases, NAMES };
