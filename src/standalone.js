// Arranca Satronho Bot sin Electron (útil para desarrollar desde el
// navegador o para probar en cualquier PC):  npm run server
const path = require('path');
const { Store } = require('./store');
const { createServer } = require('./server');

const store = new Store(path.join(__dirname, '..', 'data'));
const server = createServer({ store });

server
  .start()
  .then((url) => {
    console.log(`Satronho Bot listo en ${url}`);
    console.log(`  Overlay de alertas: ${url}/overlays/alerts.html`);
    console.log(`  Overlay de meta:    ${url}/overlays/goal.html?id=seguidores`);
  })
  .catch((err) => {
    console.error('No se pudo arrancar el servidor:', err.message);
    process.exit(1);
  });

const shutdown = () => server.stop().finally(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
