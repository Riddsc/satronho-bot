# Relé de reportes

Sirve para que el webhook de Discord no viaje dentro de la app. Se monta una sola vez y es gratis.

1. Entra a [dash.cloudflare.com](https://dash.cloudflare.com) (crea una cuenta gratis si no tienes) → **Workers y Pages** → **Crear** → **Crear Worker**. Ponle de nombre `satronho-reportes` y pulsa **Implementar**.
2. Pulsa **Editar código**, borra lo que trae, pega todo el contenido de `reportes-worker.js` y pulsa **Implementar**.
3. En el Worker ve a **Configuración** → **Variables y secretos** → **Agregar**: tipo **Secreto**, nombre `DISCORD_WEBHOOK`, valor = **un webhook nuevo** del canal de reportes (en Discord: Editar canal → Integraciones → Webhooks → Nuevo webhook → Copiar URL).
4. Copia la dirección del Worker (algo como `https://satronho-reportes.TU-USUARIO.workers.dev`).
5. En GitHub: repositorio → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**: nombre `SUPPORT_RELAY_URL`, valor = la dirección del paso 4.
6. **Borra el webhook viejo** en Discord: el que iba dentro de las versiones anteriores. Desde ese momento, las copias viejas no podrán enviar reportes hasta que se actualicen.

La próxima versión que se publique ya enviará los reportes por el relé.
