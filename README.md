# Mis Tareas (PWA)

App personal de tareas/notas en español. Sin servidor: todo se guarda en `localStorage` del móvil.

- `index.html`, `styles.css`, `app.js` — la app (JS sin dependencias ni build)
- `manifest.json`, `sw.js`, `icons/` — instalación y modo sin conexión
- `screenshots/` — capturas de 390x844 hechas con datos de demostración
- `tools/` — scripts de Playwright para regenerar iconos y capturas (no hace falta subirlos)

Para probar en local: `python3 -m http.server 8080` y abrir http://localhost:8080
Para usarla en el móvil hay que subir la carpeta (sin `tools/` ni `screenshots/`) a un hosting HTTPS.
Al cambiar archivos, sube la versión de `CACHE` en `sw.js` para que el móvil descargue la versión nueva.
