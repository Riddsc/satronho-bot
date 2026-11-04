// Conector de Twitch: solo lee el chat (para la voz y la música), igual que Kick.
//
// Usa el chat oficial de Twitch (IRC por WebSocket) como espectador anónimo:
// no hace falta iniciar sesión ni crear nada en Twitch para leer.

const WebSocket = require('ws');
const { createConnectorBase, cleanChannel } = require('./base');

const URL = 'wss://irc-ws.chat.twitch.tv:443';

// Las etiquetas IRCv3 escapan algunos caracteres.
const unescapeTag = (v = '') => v.replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\').replace(/\\r/g, '\r').replace(/\\n/g, '\n');

// ":@tags :prefix COMMAND #canal :texto" -> { tags, prefix, command, params, trailing }
function parseLine(line) {
  let rest = line;
  const tags = {};
  if (rest.startsWith('@')) {
    const sp = rest.indexOf(' ');
    for (const kv of rest.slice(1, sp).split(';')) {
      const i = kv.indexOf('=');
      tags[i < 0 ? kv : kv.slice(0, i)] = i < 0 ? '' : unescapeTag(kv.slice(i + 1));
    }
    rest = rest.slice(sp + 1);
  }
  let prefix = '';
  if (rest.startsWith(':')) {
    const sp = rest.indexOf(' ');
    prefix = rest.slice(1, sp);
    rest = rest.slice(sp + 1);
  }
  let trailing = '';
  const ti = rest.indexOf(' :');
  if (ti >= 0) {
    trailing = rest.slice(ti + 2);
    rest = rest.slice(0, ti);
  }
  const [command, ...params] = rest.split(' ').filter(Boolean);
  return { tags, prefix, command, params, trailing };
}

function createTwitchConnector({ bus, onStatus, url = URL }) {
  const base = createConnectorBase({ platform: 'twitch', bus, onStatus });
  let socket = null;
  let pingTimer = null;

  function onLine(ws, line) {
    if (!line) return;
    const m = parseLine(line);
    switch (m.command) {
      case 'PING':
        ws.send(`PONG :${m.trailing || 'tmi.twitch.tv'}`);
        break;
      case 'ROOMSTATE':
        base.resetBackoff();
        base.status('connected');
        break;
      case 'NOTICE':
        if (/does not exist|suspended|banned/i.test(m.trailing)) base.status('error', 'Ese canal de Twitch no existe o está suspendido');
        break;
      case 'RECONNECT':
        ws.close(); // Twitch pide reconectar: lo hacemos solos
        break;
      case 'PRIVMSG': {
        const login = m.prefix.split('!')[0];
        let text = m.trailing;
        // Mensajes "/me": vienen envueltos en \u0001ACTION ...\u0001
        const action = /^\u0001ACTION (.*)\u0001$/.exec(text);
        if (action) text = action[1];
        base.emit({
          type: 'chat',
          user: { id: m.tags['user-id'] || login, name: m.tags['display-name'] || login },
          message: text,
          extra: { color: m.tags.color || '', badges: String(m.tags.badges || '').split(',').map((b) => b.split('/')[0]).filter(Boolean) },
        });
        break;
      }
      default:
        break;
    }
  }

  function run() {
    if (base.stopped) return;
    base.status('connecting');
    const ws = new WebSocket(url);
    socket = ws;
    ws.on('open', () => {
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send('PASS SCHMOOPIIE');
      ws.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
      ws.send(`JOIN #${base.channel}`);
      clearInterval(pingTimer);
      pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('PING :satronho'), 4 * 60 * 1000);
    });
    ws.on('message', (raw) => {
      for (const line of String(raw).split('\r\n')) onLine(ws, line);
    });
    ws.on('error', () => {});
    ws.on('close', () => {
      clearInterval(pingTimer);
      if (socket === ws && !base.stopped) base.retry(run, 'Conexión cerrada');
    });
  }

  async function connect(channelName) {
    await disconnect();
    const login = cleanChannel(channelName).toLowerCase().replace(/^#/, '');
    if (!/^[a-z0-9_]{3,25}$/.test(login)) throw new Error('Escribe tu usuario de Twitch (letras, números y _)');
    base.start(login);
    run();
  }

  async function disconnect() {
    base.stop();
    clearInterval(pingTimer);
    const ws = socket;
    socket = null;
    if (ws) ws.close();
    base.status('disconnected');
  }

  return { connect, disconnect };
}

module.exports = { createTwitchConnector, parseLine };
