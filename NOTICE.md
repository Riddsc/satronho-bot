# Componentes de terceros

Satronho Bot (© 2026 RiddsSatronho) usa estos componentes, cada uno bajo su propia licencia:

| Componente | Para qué | Licencia |
|---|---|---|
| Electron | Aplicación de escritorio | MIT |
| Express, ws | Servidor local y tiempo real | MIT |
| tiktok-live-connector | Lectura de TikTok LIVE | MIT |
| youtubei.js | Búsqueda de canciones en YouTube | MIT |
| adm-zip | Descomprimir el motor de voz | MIT |
| Velopack | Portable y actualizaciones automáticas | MIT |
| edge-tts 7.3.1 (rany2/edge-tts), portado en `src/tts/msGec.js` | Firma que piden las voces en línea de Microsoft | LGPL-3.0 (texto en `licenses/`). Solo ese archivo está bajo LGPL; puedes cambiarlo o reemplazarlo |
| flag-icons 7.6.0 (lipis/flag-icons) | Banderas de «Elegir voz» (`dashboard/img/flags/`) | MIT |
| Piper (descargado al instalar la voz) | Motor de voz neuronal | MIT; incluye eSpeak NG (GPL-3.0) como programa aparte |
| Voces de Piper (descargadas por el usuario) | Voces en español | Cada voz tiene su licencia en su MODEL_CARD de Hugging Face |

Piper y sus voces no vienen dentro de Satronho Bot: se descargan en el PC del usuario cuando las instala desde el panel.

## Logos de las plataformas

Los logos de Kick, Starvios, TikTok y Twitch que se ven en el panel son marcas de sus dueños. Satronho Bot los usa solo para que identifiques cada plataforma y no tiene relación oficial con ninguna de ellas.

## Catálogo de regalos de TikTok

`src/data/tiktok-gifts.json` lista los regalos de TikTok (número, nombre y valor en monedas) tal como los publica la lista pública de TikTok (`webcast.tiktok.com/webcast/gift/list`), según la recopilación de agosto de 2026 del proyecto `WaGi-Coding/tiktok-gift-ids`. Las imágenes no vienen dentro de la app: se piden a TikTok la primera vez que se muestran y quedan guardadas en el PC del usuario. Los nombres e imágenes de los regalos son de TikTok.

## Sonidos de Kenney (CC0)
La carpeta `sounds/` trae sonidos de los packs Impact Sounds, Interface Sounds, UI Audio, Digital Audio, Casino Audio, RPG Audio, Music Jingles, Voiceover Pack y Voiceover Pack: Fighter, creados por **Kenney** (www.kenney.nl), en dominio público (Creative Commons Zero, CC0). Se les cambió el nombre del archivo y se les puso nombre y etiquetas en español. El crédito no es obligatorio, pero se lo damos con gusto. Ver `sounds/LICENCIA-Kenney-CC0.txt`.

## Sonidos de «Mis sonidos»
Los sonidos que cada streamer sube, busca en páginas de memes o pega por enlace se descargan en su propio PC para su uso personal. Satronho Bot no los incluye ni los reparte.
