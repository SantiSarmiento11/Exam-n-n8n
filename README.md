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
- `address`
- `neighborhood`
- `detectedCity`
- `image`
- `reportId`
- `source`
- `submittedAt`

## Mapa con OpenStreetMap

El formulario usa Leaflet con mosaicos de OpenStreetMap para seleccionar la ubicación del reporte.

La función `initMap` vive en `js/app.js` y permite seleccionar la ubicación con clic o arrastrando el marcador. No requiere credenciales ni llaves de acceso.

## Uso local

Puedes abrir `index.html` directamente en el navegador. Si el navegador bloquea alguna función por políticas locales, sirve la carpeta con cualquier servidor estático.
