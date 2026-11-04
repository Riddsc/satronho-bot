# Satronho Bot

**© 2026 RiddsSatronho. Todos los derechos reservados.**

App de escritorio para streamers con **voz neuronal, música pedida por el chat, alertas, metas y estadísticas**. Se conecta a **TikTok LIVE, Kick y Starvios**.

## Los guías

Cuatro perritos y MechaRidds te acompañan, cada uno a cargo de una parte del panel:

| Guía | Cómo es | Se encarga de |
|---|---|---|
| **Samy** | Café rojiza con mancha blanca y orejas grandes | Conexiones |
| **Troya** | Atigrada, orejas paradas, gafas en la frente | Voz |
| **Ñoño** | Blanco con parches negros, lengua afuera, corbatín | Música |
| **Juana** | Negrita de hocico gris con moño rosado | Alertas, metas y estadísticas |
| **MechaRidds** | Ridds en versión androide: gorra con control, gafas, antena y bata | Chat Bot, comandos, reportes y novedades |

Cada guía te dice qué hacer según el estado de la app y cambia de ánimo: brinca cuando algo sale bien, se queda pensando mientras descarga o busca, y se sacude si hay un problema.

Si haces clic en la cara de un guía puedes ponerle una foto real; con clic derecho vuelve a su dibujo.

## Arrancar en modo desarrollo (Windows)

1. Instala **Node.js 20 o superior** (LTS) desde nodejs.org.
2. En esta carpeta, ejecuta:
   ```
   npm install
   npm start
   ```
3. En **Voz**, pulsa **Instalar motor de voz** y luego **Descargar** en una o varias voces. Si descargas varias, cada espectador suena distinto.

Para probar solo el panel en el navegador, usa `npm run server` y abre http://localhost:3800

## Publicar versiones y actualizaciones automáticas (GitHub)

La app se actualiza con [Velopack](https://velopack.io), igual que OverInteractive, y las versiones se publican en **GitHub Releases**. GitHub las arma en Windows por ti (`.github/workflows/publicar.yml`), así que no necesitas instalar .NET.

**Una sola vez:**
1. Crea un repositorio en GitHub (por ejemplo `satronho-bot`) y sube este proyecto.
2. Pon su dirección en `package.json` → `satronho.updateRepo` (por ejemplo `https://github.com/Riddsc/satronho-bot`). En GitHub Actions también se graba sola.

**Cada versión nueva:**
1. Sube el número en `package.json` (por ejemplo `0.6.0`).
2. Crea la etiqueta `v0.6.0`, con `git tag v0.6.0 && git push --tags` o desde GitHub en *Releases → Draft a new release*.
3. En unos minutos GitHub publica:
   - `SatronhoBot-win-Setup.exe`: el instalador. Esta versión se actualiza sola.
   - `SatronhoBot-win-Portable.zip`: la portable con actualización.
   - `releases.win.json` y los `.nupkg`: los archivos que usa la actualización.

**Qué ve el streamer:** al abrir la app y cada 6 horas se revisa GitHub.
- **Instalada con Velopack:** descarga la versión en segundo plano y muestra **«Reiniciar y actualizar»**.
- **.zip portable simple:** muestra **«Hay una versión nueva»** con un botón para descargarla.
- Los ajustes viven en `%APPDATA%\Satronho Bot` y no se pierden.

`npm run release` sigue funcionando en tu PC si tienes .NET 8 y `vpk`; sin `vpk`, solo arma el .zip portable simple. `npm run package` arma solo la carpeta de la app en `dist/`.

**Metadatos:** todo va a nombre de **RiddsSatronho**: autor, empresa y copyright del `.exe`, el autor del paquete de Velopack, el identificador `com.riddssatronho.satronhobot`, `LICENSE`, el pie del panel y las etiquetas del HTML. La configuración y las estadísticas se guardan en `%APPDATA%\Satronho Bot`.

**Firma de código (recomendado):** sin un certificado, Windows SmartScreen avisará la primera vez que alguien abra la app. Con un certificado se añade `--signParams` al comando `vpk pack` dentro de `scripts/release.mjs`.

## Qué hace cada plataforma

| | TikTok LIVE | Kick | Starvios | Twitch |
|---|---|---|---|---|
| Alertas y metas | ✓ | — | — | — |
| Estadísticas | ✓ (regalos, likes, espectadores) | ✓ (chat) | ✓ (chat) | ✓ (chat) |
| Voz del chat | Solo de quien envió **Quiéreme** | Todo el chat | Todo el chat | Todo el chat |
| Música (`!play`) | Opcional (apagada) | ✓ | ✓ | ✓ |

Twitch se lee con su chat oficial como espectador anónimo: no hace falta iniciar sesión.

## Conexiones: Escuchar y Escribir

La pantalla **Conexiones** tiene dos pestañas:
- **Escuchar:** escribes tu usuario y Satronho Bot lee el chat (y en TikTok, los regalos).
- **Escribir:** Satronho Bot responde en tu chat de **Kick** y de **Starvios**. TikTok solo se escucha por ahora.

Cada plataforma tiene una tarjeta con **Escuchar** y **Escribir** lado a lado. En **Plataformas que usas** apagas las que no usas (se esconden y no se conectan solas) y eliges su orden, que se respeta en todo el panel.

### Escribir en Kick

Cada streamer pulsa **Autorizar** en «Tu cuenta de Kick», entra con su cuenta y listo: el bot escribe con su nombre. No hay que pegar claves, porque la app ya trae la app de Kick «SatronhoBot».
- En **Avanzado** se puede autorizar una **cuenta aparte**, como SatronhoBot, y elegir con cuál se escribe.
- También en **Avanzado** se puede usar **una app de Kick propia**, pegando su Client ID y su Client Secret. La redirección es `http://localhost:3800/auth/kick/callback`.

**De dónde sale la app de Kick incluida.** El Client Secret no está en el código. Se agrega al empaquetar:
- **En GitHub Actions:** con los secretos `KICK_CLIENT_ID` y `KICK_CLIENT_SECRET` del repositorio (*Settings → Secrets and variables → Actions*).
- **En tu PC:** con las variables `SATRONHO_KICK_CLIENT_ID` y `SATRONHO_KICK_CLIENT_SECRET`, o con un archivo `src/builtin.json` (`{"kick":{"clientId":"…","clientSecret":"…"}}`), que nunca se sube.

El Secret se puede extraer del `.exe`. Si alguien abusa, lo regeneras en Kick, actualizas el secreto en GitHub y sacas una versión nueva. Quienes ya autorizaron solo tendrán que volver a pulsar «Autorizar».

### Escribir en Starvios

Pulsa **Iniciar sesión** en «Tu cuenta de Starvios». Se abre una ventana de starvios.com dentro de la app. Cuando inicias sesión, la app toma la sesión que guardó la web, la cifra y la renueva sola. Satronho Bot nunca ve tu contraseña. Envía los mensajes igual que la web de Starvios, con `send_live_message`. En **Avanzado** puedes entrar con una cuenta aparte para el bot.

## Chat Bot (MechaRidds)

Todo lo que el bot escribe en el chat está en **Chat Bot**, con tres pestañas:
- **Inicio:** el interruptor general, dónde escribe (y con qué cuenta), un cuadro para escribir algo a mano y el registro de lo que ha escrito.
- **Comandos** y **Mensajes automáticos** (abajo).

## Ayuda y novedades

- **Ayuda → Reportar un problema:** el streamer cuenta qué falla, pide ayuda o comparte una idea y llega a un canal de Discord. Puede adjuntar un diagnóstico (versión, Windows, plataformas y últimos errores) que ve antes de enviar; las claves se tachan. El webhook se graba al empaquetar desde el secreto `DISCORD_WEBHOOK_URL` de GitHub Actions (o `SATRONHO_DISCORD_WEBHOOK` en tu PC). Límite: un reporte por minuto y 10 al día.
- **Novedades:** historial de cada versión desde `CHANGELOG.json`. Tras actualizar, MechaRidds muestra «qué hay de nuevo» y la campana de arriba se marca. Las mismas notas se publican solas en GitHub Releases.

**Para cada versión nueva:** agrega su entrada al principio de `CHANGELOG.json` y sube el número en `package.json`.

## Comandos del chat y mensajes automáticos

**Comandos del chat:** creas `!redes`, `!discord` o lo que quieras, con su respuesta. Cuando alguien lo escribe, el bot responde en Kick y en Starvios; en Twitch y TikTok, Troya puede decirlo en voz alta. Cada comando tiene:
- otros nombres (alias);
- quién puede usarlo: todos, moderadores o solo tú;
- espera entre usos y espera por persona;
- en qué plataformas funciona.

En la respuesta puedes usar `{usuario}`, `{mensaje}`, `{1}` `{2}`…, `{canal}`, `{plataforma}`, `{cancion}`, `{cola}`, `{usos}`, `{comandos}`, `{azar:1-100}` y `{hora}`. La tarjeta **Probar** te muestra qué respondería, sin escribir en el chat. `!play`, `!temita`, `!skip` y `!quitar` son de la música.

**Mensajes automáticos:** el bot escribe un texto cada X minutos en Kick y Starvios, solo si estás conectado y si hubo al menos N mensajes en el chat, para no hablar solo.

## Atajos de teclado

En **Ajustes → Atajos de teclado** activas atajos que funcionan aunque estés en OBS o en un juego: saltar el mensaje de voz, apagar o encender la voz, siguiente canción, pausar la música, lanzar una alerta de prueba y mostrar la app. Vienen apagados para no chocar con otros programas, y cada uno se puede cambiar.

## Alertas (Troya)

Cada alerta (seguidor, regalo, suscripción, likes, compartido) tiene sus propios ajustes:
- **Segundos en pantalla**, de 1 a 30, o **que dure lo que dura el sonido**.
- **Sonido:** 8 sonidos propios generados en el momento (Campanita, Brillo, Burbuja, Moneda, Latido, Zas, Fanfarria, Aplausos), **tu propio archivo** (MP3, WAV u OGG, hasta 10 MB) o sin sonido.
- **Volumen** y **cortar el sonido** a los N segundos, con un desvanecido al final.
- **Troya la lee en voz alta** («Fulano te sigue»).

**Regalos grandes:** desde la cantidad de diamantes que elijas sale otra alerta, más grande y con brillo, con sus propios ajustes.

El interruptor **Sonido en OBS** apaga todos los sonidos de las alertas. En OBS, marca «Controlar audio mediante OBS» en la fuente de alertas.

## Voz (Troya)

**Motor.** Usa [Piper](https://github.com/rhasspy/piper) (MIT), con voces neuronales que corren en tu PC y no cobran por mensaje. La app mantiene abiertas hasta 3 voces a la vez para que cada espectador suene con la suya sin demoras.

**Voces disponibles.**
- **Piper, en tu PC y sin internet:**
  - Español: 8 voces de México, Argentina y España.
  - Inglés: 8 voces, 4 femeninas y 4 masculinas, de Estados Unidos y Reino Unido.
  - Francés: 4 voces, 2 femeninas y 2 masculinas.
  - El inglés y el francés se asignan a mano en Espectadores especiales.
- **Variar el tono:** cada voz también en grave y en aguda, lo que triplica el reparto.
- **Voces de Windows** en español.
- **Voces en línea de Microsoft (opcional):** una femenina y una masculina por país de Latinoamérica (Colombia, Chile, Perú, Venezuela…). Necesitan internet y no son un servicio oficial, así que pueden dejar de funcionar; si fallan, se usa la voz de Windows.

**Voz de cada espectador.** Hay tres modos:
- **Fija por espectador:** cada persona suena siempre igual.
- **Al azar en cada mensaje.**
- **Una sola voz para todos.**

También eliges qué voces entran en el reparto.

**Espectadores especiales.** A una persona le puedes dar su propia voz y un nombre para leer (por ejemplo, «el jefe»), o silenciarla. La opción «Siempre leer» también se salta el filtro del regalo en TikTok.

**Quién se lee.**
- **Kick, Starvios y Twitch:** todo el chat.
- **TikTok:** solo quien envió **Quiéreme** / **Heart Me**. El permiso dura 3 h, 12 h, 24 h, 7 días o para siempre, según elijas.
- **Comandos:** los mensajes que empiezan con `!` no se leen.

**Límites.**
- **Espera por persona:** segundos mínimos entre dos mensajes leídos de la misma persona.
- **Descarte:** los mensajes que llevan demasiado tiempo en la cola ya no se leen.
- **Anti-spam:** no lee dos veces el mismo mensaje de alguien.
- **Números:** opción para no leerlos.

**Filtros con interruptor propio.**
- **Groserías:** las palabras de la lista se reemplazan por «piip».
- **Trucos:** detecta variantes como `T0NT0`, `ToonTo0`, `t o n t o`, `toooonto`, `p.u.t.a` o letras de otros alfabetos. Compara palabras completas, así que «pera» y «cálculo» no se censuran.

**Por qué se lee o no.** En **Actividad**, cada mensaje se marca con 🔊 (se leyó) o con 🔇 y el motivo. En **Probar filtros** escribes un mensaje y la app te dice si lo leería, cómo y con qué voz.

**Bots del chat.** BotRix, Nightbot, StreamElements y otros bots conocidos no se leen, ni nombres como `Sery_Bot` o `StreamBot`. Puedes sumar los tuyos en *Quién se lee → Bots del chat*.

**Voces de Latinoamérica.** En *Voces* hay una tarjeta por país (Colombia, México, Argentina…) con una voz femenina y una masculina. Pulsas ▶ para oírla y ★ para que sea tu voz principal.

**Respaldo.** Si Piper no está listo, se usan las voces de Windows.

## Música (Ñoño)

En Kick y Starvios:

| Comando | Qué hace |
|---|---|
| `!play canción` · `!temita canción` | Pide una canción (por nombre o con un enlace de YouTube) |
| `!skip` | Salta la canción que suena, **solo si la pidió quien escribe** |
| `!quitar` | Quita de la cola la última canción que pidió; si ya está sonando, la salta |

La música suena con el reproductor oficial de YouTube dentro del panel. Desde ahí también puedes pausar, saltar o quitar cualquier canción, vaciar la cola, cambiar el volumen y añadir canciones.

## Estadísticas (Juana)

Cada directo se guarda como una **sesión**. Una sesión termina cuando pasan 30 minutos sin actividad, cuando acaba el LIVE de TikTok o cuando pulsas «Terminar sesión».

- **Cifras:**
  - **Duración.**
  - **Diamantes**, con un estimado en dólares de lo que recibe el creador (1 diamante ≈ 0,005 USD; se puede ajustar).
  - **Regalos.**
  - **Chat:** mensajes y personas distintas que escribieron.
  - **Interacciones:** seguidores nuevos y likes.
  - **Pico de espectadores.**
  - **Canciones.**
  - **Mensajes leídos en voz.**

  Cada cifra se compara con el directo anterior.
- **Actividad por minuto:** mensajes, interacciones, diamantes o espectadores. La gráfica tiene tooltip y una vista como tabla.
- **Tops:** quién dio más diamantes, quién escribió más, quién dio más likes y qué regalos se enviaron más.
- **Historial:** hasta 500 directos, más los **tops de siempre** acumulados.

Todo se guarda en tu PC, en `%APPDATA%\Satronho Bot\stats`.

## Overlays para OBS

En OBS ve a **Fuentes → + → Navegador** y pega la URL (en el panel hay un botón para copiarla).

| Overlay | URL | Tamaño |
|---|---|---|
| Alertas de TikTok | `http://localhost:3800/overlays/alerts.html` | 800 × 300 |
| Sonando ahora | `http://localhost:3800/overlays/now-playing.html` | 700 × 140 |
| Meta | `http://localhost:3800/overlays/goal.html?id=seguidores` | 700 × 140 |

## Estructura

```
src/
  main.js                  Electron + Velopack (arranque y actualizaciones)
  server.js                Servidor local: panel, overlays, WebSocket y API
  eventBus.js, store.js    Eventos comunes y configuración
  connectors/              tiktok.js, kick.js, starvios.js
  modules/                 tts.js, music.js, goals.js, stats.js
  tts/                     piper.js (motor), voices.js, textFilter.js
  music/youtube.js         Búsqueda en YouTube
dashboard/                 Panel (index.html, styles.css, js/ con mascots.js)
overlays/                  Páginas para OBS
assets/                    Ícono de la app (svg, png, ico)
scripts/release.mjs        Empaquetado y publicación
```

## Licencias

El código, el diseño y los personajes son propiedad de RiddsSatronho; ver `LICENSE`. Los componentes de terceros están listados en `NOTICE.md`. Cada voz de Piper tiene su propia licencia en su ficha (MODEL_CARD) de Hugging Face: revísala antes de vender la app.
