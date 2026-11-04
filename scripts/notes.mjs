// Escribe las notas de una versión (desde CHANGELOG.json) en Markdown,
// para la página de GitHub Releases. Uso: node scripts/notes.mjs 0.9.0 > notas.md
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = (process.argv[2] || JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version).replace(/^v/, '');
const log = JSON.parse(fs.readFileSync(path.join(root, 'CHANGELOG.json'), 'utf8'));
const entry = log.find((v) => v.version === version);
const LABEL = { nuevo: '✨ Nuevo', mejora: '🔧 Mejora', arreglo: '🐞 Arreglo' };
if (!entry) {
  console.log(`Satronho Bot ${version}`);
} else {
  console.log(`## ${entry.title}\n`);
  for (const it of entry.items || []) console.log(`- **${LABEL[it.type] || it.type}:** ${it.text}`);
  console.log('\n---\nDescarga **SatronhoBot-win-Setup.exe** para instalar. Si ya la tienes, se actualiza sola.');
}
