# Relé de Satronho Bot

Un pequeño servidor gratis (Cloudflare Workers) que guarda fuera de la app las dos claves que nunca deben ir dentro del .zip:

- el **webhook de Discord** de los reportes (Ayuda → Reportar un problema), y
- el **Client Secret de Kick** de la app «SatronhoBot» (para autorizar cuentas de Kick).

Todo lo que va dentro de la app se puede sacar abriendo la carpeta. Por eso esas dos claves viven aquí.

## Montarlo (una sola vez)

1. Entra a [dash.cloudflare.com](https://dash.cloudflare.com) (crea una cuenta gratis si no tienes) → **Workers y Pages** → **Crear** → **Crear Worker**. Ponle de nombre `satronho-reportes` y pulsa **Implementar**.
2. Pulsa **Editar código**, borra lo que trae, pega todo el contenido de `reportes-worker.js` y pulsa **Implementar**.
3. En el Worker ve a **Configuración** → **Variables y secretos** y agrega tres, todos de tipo **Secreto**:
   - `DISCORD_WEBHOOK` = **un webhook nuevo** del canal de reportes (en Discord: Editar canal → Integraciones → Webhooks → Nuevo webhook → Copiar URL).
   - `KICK_CLIENT_ID` = el Client ID de tu app de Kick (kick.com → Configuración → Desarrollador).
   - `KICK_CLIENT_SECRET` = el Client Secret **actual** de esa app. Cámbialo por uno nuevo solo después de publicar la versión nueva (ver «Cambiar el secret de Kick» abajo): así nadie se queda sin Kick mientras tanto.
4. Copia la dirección del Worker (algo como `https://satronho-reportes.TU-USUARIO.workers.dev`).
5. En GitHub: repositorio → **Settings** → **Secrets and variables** → **Actions**:
   - `SUPPORT_RELAY_URL` = la dirección del paso 4 (sin `/` al final).
   - `KICK_CLIENT_SECRET`: puedes **borrarlo**; con el relé ya no se usa. `KICK_CLIENT_ID` sí se queda.
6. **Borra el webhook viejo** en Discord (el que iba dentro de versiones anteriores).

## Si ya tenías el relé montado

Solo repite el paso 2 (pegar el `reportes-worker.js` nuevo) y agrega `KICK_CLIENT_ID` y `KICK_CLIENT_SECRET` del paso 3. **Hazlo antes de publicar la versión nueva**: la app nueva autoriza Kick a través del relé.

## Comprobar que funciona

- Abre la dirección del Worker en el navegador: debe decir «Solo reportes de Satronho Bot».
- En la app: Ayuda → Reportar un problema → envía uno de prueba.
- En la app: Chat Bot → Kick → «Autorizar mi cuenta de Kick».

## Cambiar el secret de Kick (después de publicar)

El secret actual ya viajó dentro de versiones anteriores, así que hay que cambiarlo:

1. Espera a que la versión nueva esté publicada.
2. En kick.com → Configuración → Desarrollador → tu app → genera un Client Secret nuevo y cópialo.
3. En Cloudflare → tu Worker → Configuración → Variables y secretos → edita `KICK_CLIENT_SECRET` y pega el nuevo → Implementar.
4. En GitHub → Settings → Secrets and variables → Actions, borra `KICK_CLIENT_SECRET` (ya no se usa).

## Qué pasa con las copias viejas

- Cuando borres el webhook viejo, las versiones viejas no podrán enviar reportes hasta que se actualicen.
- Cuando generes el Client Secret nuevo en Kick, las versiones viejas no podrán autorizar ni renovar cuentas de Kick hasta que se actualicen. Las que se actualizan solas (instalador) lo harán al abrir.
