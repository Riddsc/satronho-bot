// Empaqueta Satronho Bot para Windows y crea la versión portable con
// actualización automática (Velopack), igual que se distribuye
// OverInteractive: una carpeta portable + un .zip + los archivos de
// actualización que subes a tu servidor (Cloudflare R2, GitHub Releases…).
//
// Uso:
//   npm run package   -> solo la carpeta de la app en dist/
//   npm run release   -> además el .zip portable (y, si tienes vpk, la versión
//                        con auto-actualización) en releases/
//
// Requisitos para "release": .NET SDK 8 y la herramienta vpk:
//   dotnet tool update -g vpk
//
// Todos los metadatos van a nombre de RiddsSatronho (autor, empresa, copyright).

import { packager } from '@electron/packager';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const { packId, exeName, appId } = pkg.satronho;
const onlyPackage = process.argv.includes('--package-only');
const platform = process.env.SATRONHO_PLATFORM || 'win32';

console.log(`Empaquetando ${pkg.productName} ${pkg.version} (${platform}) a nombre de ${pkg.author}…`);

const [outDir] = await packager({
  dir: root,
  out: path.join(root, 'dist'),
  overwrite: true,
  platform,
  arch: 'x64',
  name: pkg.productName,
  executableName: exeName,
  appVersion: pkg.version,
  buildVersion: pkg.version,
  appCopyright: pkg.copyright,
  icon: path.join(root, 'assets', 'icon'),
  // Velopack trae binarios nativos: deben quedar fuera del .asar.
  asar: { unpack: '**/node_modules/velopack/**' },
  prune: true,
  ignore: [/^\/dist($|\/)/, /^\/releases($|\/)/, /^\/data($|\/)/, /^\/scripts($|\/)/, /\.zip$/, /^\/\.git/],
  win32metadata: {
    CompanyName: pkg.author,
    ProductName: pkg.productName,
    FileDescription: pkg.productName,
    OriginalFilename: `${exeName}.exe`,
    InternalName: exeName,
    'requested-execution-level': 'asInvoker',
  },
  appBundleId: appId,
  // En GitHub Actions se graba aquí el repositorio donde se publican las
  // versiones, para que la app sepa dónde buscar actualizaciones.
  afterCopy: [
    // App de Kick incluida: se graba desde los secretos de GitHub Actions
    // (KICK_CLIENT_ID / KICK_CLIENT_SECRET) o desde las variables de entorno
    // SATRONHO_KICK_CLIENT_ID / SATRONHO_KICK_CLIENT_SECRET en tu PC.
    // Si ya existe src/builtin.json (solo en tu PC, no se sube), se usa ese.
    async ({ buildPath }) => {
      const file = path.join(buildPath, 'src', 'builtin.json');
      let data = {};
      try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        /* sin src/builtin.json en este PC */
      }
      const clientId = process.env.SATRONHO_KICK_CLIENT_ID;
      const clientSecret = process.env.SATRONHO_KICK_CLIENT_SECRET;
      if (clientId && clientSecret) data.kick = { clientId, clientSecret };
      // Webhook de Discord para «Reportar un problema».
      if (process.env.SATRONHO_DISCORD_WEBHOOK) data.discord = { webhook: process.env.SATRONHO_DISCORD_WEBHOOK };
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      console.log(data.kick ? '✓ App de Kick incluida' : '⚠ Sin app de Kick incluida: cada streamer tendrá que pegar la suya en «Avanzado»');
      console.log(data.discord ? '✓ Reportes a Discord incluidos' : '⚠ Sin webhook de Discord: «Reportar un problema» no podrá enviar');
    },
    async ({ buildPath }) => {
      const repo = process.env.SATRONHO_UPDATE_REPO;
      if (!repo) return;
      const file = path.join(buildPath, 'package.json');
      const p = JSON.parse(fs.readFileSync(file, 'utf8'));
      p.satronho = { ...p.satronho, updateRepo: repo };
      fs.writeFileSync(file, JSON.stringify(p, null, 2));
      console.log(`✓ Actualizaciones desde ${repo}`);
    },
  ],
});
console.log(`✓ App empaquetada en ${outDir}`);

if (onlyPackage) process.exit(0);

const releasesDir = path.join(root, 'releases');
fs.mkdirSync(releasesDir, { recursive: true });

// 1) Portable simple: un .zip con la carpeta de la app y unas instrucciones.
//    Se descomprime y se abre SatronhoBot.exe. No necesita nada más.
if (platform === 'win32') {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip();
  zip.addLocalFolder(outDir, pkg.productName);
  zip.addFile(
    `${pkg.productName}/LEEME.txt`,
    Buffer.from(
      [
        `${pkg.productName} ${pkg.version}`,
        pkg.copyright,
        '',
        'CÓMO ABRIRLA',
        `1. Descomprime este .zip donde quieras (por ejemplo, en Documentos).`,
        `2. Entra a la carpeta "${pkg.productName}" y abre ${exeName}.exe.`,
        '3. Si Windows muestra "Windows protegió su PC", pulsa',
        '   "Más información" y luego "Ejecutar de todas formas".',
        '   (Sale porque la app todavía no tiene firma digital.)',
        '',
        'Tus ajustes y estadísticas se guardan en %APPDATA%\\Satronho Bot,',
        'así que puedes borrar esta carpeta y poner una versión nueva sin perder nada.',
        '',
        '¿Dudas? Toca a Samy o a Troya dentro de la app y pregúntales.',
      ].join('\r\n'),
      'utf8'
    )
  );
  const portable = path.join(releasesDir, `${exeName}-${pkg.version}-win-portable.zip`);
  zip.writeZip(portable);
  console.log(`✓ Portable listo: ${portable}`);
}

// 2) Velopack (opcional): instalador, portable con auto-actualización y
//    paquetes para el servidor de actualizaciones. Requiere vpk (.NET).


const args = [
  'pack',
  '--channel', 'win',
  '--packId', packId,
  '--packVersion', pkg.version,
  '--packDir', outDir,
  '--mainExe', `${exeName}.exe`,
  '--packTitle', pkg.productName,
  '--packAuthors', pkg.author,
  '--icon', path.join(root, 'assets', 'icon.ico'),
  '--outputDir', releasesDir,
];
try {
  execFileSync('vpk', args, { stdio: 'inherit' });
} catch {
  console.log('\nℹ No encontré vpk, así que no generé la versión con auto-actualización.');
  console.log('  El portable simple de arriba ya sirve para usar y compartir la app.');
  console.log('  Para la auto-actualización instala .NET SDK 8 y luego:  dotnet tool update -g vpk');
  process.exit(0);
}
console.log(`\n✓ Listo. Sube el contenido de ${releasesDir} a tu servidor de actualizaciones`);
console.log('  y pon esa dirección en Ajustes → Actualizaciones (updates.feedUrl).');
console.log(`  El portable para compartir es ${packId}-win-Portable.zip`);
