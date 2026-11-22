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

**Menú lateral:** compacto por defecto (solo iconos); al pasar el ratón se despliega con los nombres. Abajo está «Dejar el menú abierto».

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
| Voz del chat | Todo el chat (o el filtro que elijas) | Todo el chat | Todo el chat | Todo el chat |
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

**Espectadores especiales.** A una persona le puedes dar su propia voz y un nombre para leer (por ejemplo, «el jefe»), o silenciarla. La opción «Siempre leer» también se salta los filtros de «Quién puede hablar».

**Quién se lee.**
- **Por defecto:** todo el chat en todas las plataformas.
- **Filtros por plataforma** (Voz del chat → Quién puede hablar): seguidores, suscriptores, VIP, moderadores, **Miembros de tu equipo** de TikTok (con nivel mínimo) o **Miembros de tu equipo que ya te enviaron Quiéreme** / **Heart Me**. En Starvios: tu lista de personas o solo moderadores.
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

**Elegir voz.** En *Voz principal → Cambiar voz* se abre una ventana con todas las voces (en tu PC, Latinoamérica y Windows), buscador, filtro de idioma y país, y ▶ para escucharlas. **Tono** cambia la voz sin cambiar la velocidad, y el **volumen** llega hasta 200 % (por encima de 100 % se amplifica).

**Respaldo.** Si Piper no está listo, se usan las voces de Windows.

## Música (Ñoño)

La página **Música** es una consola: «Sonando ahora» con el video (se puede ocultar), barra de progreso y controles; **Buscar y añadir** con resultados de YouTube; la **cola** con *A continuación* e *Historial* (mezclar, guardar como lista, vaciar, subir una canción); **Listas de reproducción** guardadas o importadas de YouTube (hasta 100 canciones); y la **actividad** de música.

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

## Huellitas, juegos y tienda (Juana)

Los puntos de tu canal. Están en **Tu comunidad → Huellitas**.

- **Cómo se ganan:** por estar en el directo (cuenta quien escribió hace poco), por escribir, seguir, suscribirse, regalar (por moneda), dar likes, compartir y volverse superfan. Los suscriptores pueden ganar más. Cada plataforma lleva su propia cuenta.
- **Comandos:** `!huellitas` (saldo), `!top`, `!regalar @persona 100`, y para ti y tus mods `!dar` y `!quitar`. Los nombres se cambian; por defecto salen en el idioma de la app.
- **Juegos del chat:** `!duelo @persona 100` (y `!acepto`), `!tragamonedas 50`, `!apuesta 100` o `!apuesta todo`, `!color rojo 100`, `!atraco 200` (en grupo) y `!trivia` (tus propias preguntas o las de la app). Cada juego tiene mínimo, máximo y espera.
- **Tienda:** `!tienda` y `!canjear 2` (o por nombre). Cada artículo puede leer un texto con la voz, escribir en el chat, sonar un sonido, girar una ruleta, sumar a un contador o a la cuenta regresiva, saltar canción o dar una llave. Con «Lo reviso yo» queda en **Canjes** para marcarlo hecho o devolver las huellitas. Existencias y límites por persona se reponen en cada directo.
- **Cofres:** se abren con una llave (`!abrir dorado`) y dan un premio al azar según su peso. `!cofre dorado` dice qué trae.
- **Probar:** en la pestaña Huellitas puedes escribir como si fueras alguien del chat; las respuestas salen ahí, no en tu chat.
- En TikTok y Twitch el bot no puede escribir: activa «Leer las respuestas en voz alta» para que la voz las diga.
- Se guarda en tu PC, en `huellitas.json` y `tienda.json`.

## Apps conectadas y reacciones (Samy)

En **Tu comunidad → Apps conectadas**. Cada tarjeta explica cómo activar la conexión en la otra app.

| App | Conexión | Qué puede hacer |
|---|---|---|
| OBS Studio | WebSocket 5, puerto 4455 (con contraseña) | Cambiar de escena, mostrar u ocultar fuentes, filtros, silenciar audio |
| VTube Studio | API, puerto 8001 (se aprueba una vez en VTS) | Lanzar atajos del modelo |
| Voicemod | Control API, puerto 59129 (clave de desarrollador) | Cambiar de voz unos segundos, memes |
| Streamer.bot | WebSocket Server, puerto 8080 | Ejecutar acciones |
| Luces WLED | HTTP en tu red | Efectos guardados, color, encender o apagar |
| VRChat | OSC, puerto 9000 | Cuadro de chat y parámetros del avatar |

Una **reacción** es «cuando pase esto → haz estos pasos»: regalo (por nombre o valor), seguidor, suscripción, likes, compartir, superfan, un comando, una recompensa de Kick, un canje de la tienda, un cofre, empezar el directo o solo con botón. Los pasos van en orden y pueden esperar entre ellos; muchos vuelven solos a como estaban tras unos segundos.

**Stream Deck:** cada reacción tiene una dirección (`http://127.0.0.1:3800/deck/<clave>/<id>`) para la acción «Sitio web» o un plugin de pedidos HTTP. Sin la clave no hace nada, y se puede cambiar.

Las contraseñas y claves de estas apps se guardan cifradas con la protección de Windows.

**Ideas para más adelante:** T.I.T.S. (lanzar objetos al avatar) y que una IA pueda usar la app (asistente).

## Overlays para OBS

En OBS ve a **Fuentes → + → Navegador** y pega la URL (en el panel hay un botón para copiarla).

| Overlay | URL | Tamaño |
|---|---|---|
| Alertas de TikTok | `http://localhost:3800/overlays/alerts.html` | 800 × 300 |
| Sonando ahora | `http://localhost:3800/overlays/now-playing.html` | 700 × 140 |
| Meta | `http://localhost:3800/overlays/goal.html?id=seguidores` | 700 × 140 |
| Top de huellitas | `http://localhost:3800/overlays/w.html?id=pointstop` | 420 × 460 |
| Cofres y canjes | `http://localhost:3800/overlays/w.html?id=chests` | 800 × 600 |

## Estructura

```
src/
  main.js                  Electron + Velopack (arranque y actualizaciones)
  server.js                Servidor local: panel, overlays, WebSocket y API
  security.js              Quién puede hablarle al servidor local (ver «Seguridad»)
  secretBox.js             Claves y permisos cifrados con la protección de Windows
  eventBus.js, store.js    Eventos comunes y configuración (con copia de respaldo)
  i18n.js                  Idioma de lo que dice la app fuera del panel (chat del bot, voz, ventanas)
  connectors/              tiktok, kick, kickChat, starvios, starviosChat, twitch, spotify
  modules/                 voz, música, alertas, metas, estadísticas, ruletas, comandos, huellitas, juegos, tienda…
  modules/apps/            Apps conectadas (OBS, VTube Studio, Voicemod, Streamer.bot, WLED, VRChat) y reacciones
  tts/                     piper.js (motor), voices.js, msonline.js, textFilter.js
  music/youtube.js         Búsqueda en YouTube
dashboard/                 Panel (index.html, styles.css, js/)
overlays/                  Páginas para OBS y TikTok LIVE Studio
  i18n/                    Idiomas: i18n.js y los diccionarios en.json, pt.json, fr.json, it.json
web/                       Página de GitHub Pages que muestra los overlays en TikTok LIVE Studio
relay/                     Relé de reportes para Cloudflare (ver relay/LEEME.md)
assets/                    Ícono de la app (svg, png, ico)
scripts/release.mjs        Empaquetado y publicación
```

## Idiomas

La app habla el idioma del streamer: español, inglés, portugués (Brasil), francés o italiano. Se elige en **Ajustes → App → Idioma** («Automático» usa el de Windows). Cambia el panel, la ventana del chat, los overlays, lo que el bot escribe en tu chat, los avisos que lee la voz y las novedades. La primera vez que abres la app te pregunta el idioma. Las voces se eligen aparte, en **Voz**; la voz automática del chat usa voces del mismo idioma que tu voz principal.

Cómo funciona, para quien toque el código:

- Los textos se escriben en español, como siempre. El español es la clave.
- `overlays/i18n/i18n.js` traduce la pantalla sola (también lo que se dibuja después). Lo que tenga `translate="no"` no se toca: chat, nombres y lo que escribe el streamer.
- Para frases que arma el código: `tr('{0} te sigue', nombre)` y, con singular y plural, `trn(n, '{0} canción', '{0} canciones')`. En el servidor: `require('./i18n')`.
- `<span data-u>` dentro de un párrafo lo vuelve una frase aparte.
- Los diccionarios son `overlays/i18n/<idioma>.json`. Si falta una frase, se ve en español. Conserva `{0}`, `{usuario}`, `<0>…</0>` y los `!comandos`. `{#0}` solo acepta números.

## Seguridad

El servidor escucha solo en `127.0.0.1`, pero el navegador del streamer también vive en el PC, así que `src/security.js` filtra cada pedido:

- **Cabecera Host:** solo `localhost`, `127.0.0.1` o `[::1]`. Así ninguna página de internet se hace pasar por «local» con un truco de DNS.
- **Cambios (POST, PATCH, DELETE):** solo desde páginas de este PC o desde programas sin navegador. Una web ajena recibe un 403.
- **WebSocket:** solo para páginas de este PC.
- **GitHub Pages** (`riddsc.github.io`): solo puede leer los overlays y `/api/ping`.
- **Marcos:** solo los overlays se pueden meter dentro de otra página.
- **Actualizaciones:** un repositorio distinto al oficial se confirma en una ventana de Windows.
- **Claves:** Kick, Starvios, Spotify y la clave de TikTok van cifradas y nunca llegan al panel.

## Licencias

El código, el diseño y los personajes son propiedad de RiddsSatronho; ver `LICENSE`. Los componentes de terceros están listados en `NOTICE.md`. Cada voz de Piper tiene su propia licencia en su ficha (MODEL_CARD) de Hugging Face: revísala antes de vender la app.
