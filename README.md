# AMB Reporta

Sitio web estático en HTML, CSS y JavaScript para recibir solicitudes y quejas ciudadanas sobre daños en bienes e infraestructura pública del Área Metropolitana de Bucaramanga, Santander.

## Páginas

- `index.html`: presentación del portal, ayudas y advertencias.
- `reporte.html`: formulario principal con datos del ciudadano, tipo de daño, ubicación e imagen.
- `seguimiento.html`: consulta de estado preparada para conectarse a un segundo webhook de n8n.

## Conexión con n8n

1. Publica un webhook en n8n para recibir reportes.
2. Abre `js/config.js`.
3. Reemplaza `N8N_WEBHOOK_URL` por la URL real del webhook.
4. Opcionalmente reemplaza `N8N_TRACKING_WEBHOOK_URL` por el webhook de consulta.

El formulario de reportes envía una solicitud `POST` con `FormData`, incluyendo:

- `fullName`
- `email`
- `phone`
- `municipality`
- `damageType`
- `priority`
- `description`
- `latitude`
- `longitude`
- `image`
- `reportId`
- `source`
- `submittedAt`

## Google Maps

El formulario incluye un contenedor listo para Google Maps y un selector simulado mientras no exista API key.

Para activar Google Maps:

1. Abre `reporte.html`.
2. Busca el script comentado de Google Maps al final del archivo.
3. Reemplaza `YOUR_GOOGLE_MAPS_API_KEY` por tu llave.
4. Descomenta la etiqueta `<script>`.

La función `initGoogleMap` vive en `js/app.js` y permite seleccionar la ubicación con clic o arrastrando el marcador.

## Uso local

Puedes abrir `index.html` directamente en el navegador. Si el navegador bloquea alguna función por políticas locales, sirve la carpeta con cualquier servidor estático.
