# 🏙️ AMB Reporta — Portal Ciudadano + Automatización n8n

> Portal web estático para que ciudadanos del **Área Metropolitana de Bucaramanga** reporten daños en infraestructura pública, conectado a un flujo de automatización en **n8n** con IA, Google Sheets y Telegram.

---

## 📌 Descripción general

**AMB Reporta** es un sistema de gestión de reportes ciudadanos compuesto por dos partes:

| Capa | Tecnología | Función |
|------|-----------|---------|
| **Frontend** | HTML + CSS + JavaScript (Leaflet / OpenStreetMap) | Formulario de reporte, mapa interactivo y seguimiento |
| **Backend / Automatización** | n8n (`Workflow.json`) | Recepción, clasificación con IA, almacenamiento en Google Sheets, notificaciones Telegram |

El ciudadano entra al portal, llena un formulario con su nombre, tipo de daño, foto y ubicación en el mapa. El sistema lo procesa automáticamente: una IA analiza la imagen, el reporte queda guardado en una hoja de Google Sheets y el equipo recibe una notificación por Telegram.

---

## 🗂️ Estructura del repositorio

```
Proyecto-n8n/
├── index.html          # Página de inicio del portal
├── reporte.html        # Formulario principal de reporte ciudadano
├── seguimiento.html    # Consulta de estado de un reporte
├── css/
│   └── styles.css      # Estilos del portal
├── js/
│   ├── config.js       # URLs de los webhooks de n8n ← configura aquí
│   ├── app.js          # Punto de entrada JS
│   └── app/
│       ├── api.js          # Envío del formulario al webhook
│       ├── dom.js          # Manipulación del DOM
│       ├── map.js          # Mapa Leaflet + OpenStreetMap
│       ├── navigation.js   # Navegación entre páginas
│       ├── report.js       # Lógica del formulario de reporte
│       ├── tracking.js     # Lógica de seguimiento de reportes
│       └── utils.js        # Utilidades compartidas
└── Workflow.json       # Flujo completo de n8n (importar en tu instancia)
```

---

## ⚙️ Cómo funciona el flujo de n8n

El archivo `Workflow.json` contiene **25 nodos** organizados en tres flujos principales:

---

### Flujo 1 — Recepción de reporte ciudadano

```
[Webhook POST /Smartcity]
        │
        ▼
[Respond to Webhook]  ──────────────────────────────────┐
        │                                                │
        ▼                                                │
[AI Agent (OpenRouter)]  ← analiza imagen + descripción  │
        │                                                │
        ▼                                                │
[Code JS]  ← limpia/estructura la respuesta de la IA     │
        │                                                │
        ▼                                                │
[Merge]  ←───────────────────────────────────────────────┘
        │
        ▼
[Edit Fields]  ← arma el registro final
        │
        ▼
[Append row in Google Sheets]  ← guarda el reporte
        │
        ├── éxito → [Send Telegram: "Reporte anexado exitosamente"]
        └── error  → [Send Telegram: "Problema al ingresar datos"]
```

**Datos que recibe el webhook desde el formulario:**

| Campo | Descripción |
|-------|-------------|
| `fullName` | Nombre completo del ciudadano |
| `email` | Correo electrónico |
| `phone` | Teléfono (10 dígitos) |
| `municipality` | Municipio del AMB |
| `damageType` | Tipo de daño (vía, luminaria, parque, etc.) |
| `priority` | Nivel de prioridad |
| `description` | Descripción del daño |
| `latitude` / `longitude` | Coordenadas del mapa |
| `address` / `neighborhood` | Dirección y barrio |
| `image` | Foto de evidencia |
| `reportId` | ID único generado en el frontend |
| `submittedAt` | Marca de tiempo del envío |

**El nodo AI Agent** usa **OpenRouter** (modelo configurable) para analizar la imagen y la descripción del daño, y enriquecer el registro antes de guardarlo.

---

### Flujo 2 — Consulta de seguimiento (Dashboard)

```
[Webhook POST /consulta]
        │
        ▼
[If2]  ← ¿viene solicitud de actualización de estado?
        │
        ├── SÍ → [Append or update row in Sheet] → [Telegram: "Reporte solucionado"]
        │
        └── NO → [Get row(s) in Sheet2]
                        │
                        ▼
                 [Edit Fields1]
                        │
                        ▼
                 [Respond to Webhook1]  ← devuelve el estado al frontend
```

Este flujo alimenta la página `seguimiento.html`, que consulta el estado del reporte por ID o correo electrónico.

---

### Flujo 3 — Bot de consulta por Telegram

```
[Telegram Trigger]
        │
        ▼
[Pedir info]  ← solicita al usuario su ID o correo
        │
        ▼
[Get row(s) in Google Sheet]
        │
        ▼
[¿Existe ID?]
        │
        ├── SÍ → [Organizar estado] → [Mostrar Estado y Preguntar por Telegram]
        │
        └── NO → [No encontrado] → [Pedir info nuevamente]
```

Cualquier ciudadano puede consultar el estado de su reporte directamente en Telegram enviándole un mensaje al bot configurado.

---

## 🛠️ Clonar el repositorio

```bash
git clone https://github.com/SantiSarmiento11/Proyecto-n8n.git
cd Proyecto-n8n
```

---

## 🚀 Poner el proyecto a trabajar en local

### 1. Levantar el frontend

El frontend es 100% estático. La forma más simple:

```bash
# Con Python (viene instalado en macOS/Linux)
python3 -m http.server 8080

# O con Node.js
npx serve .
```

Abre tu navegador en `http://localhost:8080`.

> ⚠️ No abras `index.html` directamente como archivo (`file://`). Algunos navegadores bloquean el acceso a la cámara/geolocalización sin servidor HTTP.

---

### 2. Levantar n8n en local

#### Opción A — Docker (recomendado)

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

Accede en `http://localhost:5678`.

#### Opción B — npm global

```bash
npm install -g n8n
n8n start
```

---

### 3. Importar el flujo

1. Abre n8n en `http://localhost:5678`.
2. Ve a **Workflows → Import from file**.
3. Selecciona el archivo `Workflow.json` del repositorio.
4. El flujo se cargará con todos los nodos.

---

### 4. Configurar las credenciales en n8n

Dentro de n8n, configura las siguientes credenciales en **Settings → Credentials**:

| Credencial | Nodo que la usa | Qué necesitas |
|-----------|----------------|--------------|
| **Google Sheets OAuth2** | `Get row(s) in sheet`, `Append row in sheet`, `Append or update row` | Cuenta de Google + hoja de cálculo creada |
| **Telegram Bot API** | `Telegram Trigger`, todos los nodos `Send a text message` | Token del bot de Telegram ([@BotFather](https://t.me/BotFather)) |
| **OpenRouter API** | `OpenRouter Chat Model` | API key de [openrouter.ai](https://openrouter.ai) |

---

### 5. Exponer n8n al frontend con ngrok

El frontend necesita una URL pública para enviar los reportes. Usa **ngrok** para tunelizar tu n8n local:

```bash
# Instalar ngrok: https://ngrok.com/download
ngrok http 5678
```

Ngrok te dará una URL como:
```
https://xxxx-xx-xx-xx.ngrok-free.app
```

---

### 6. Actualizar las URLs en `js/config.js`

Abre `js/config.js` y reemplaza las URLs:

```javascript
window.AMB_CONFIG = {
  // URL del webhook principal (Flujo 1)
  N8N_WEBHOOK_URL: "https://xxxx-xx-xx-xx.ngrok-free.app/webhook/Smartcity",

  // URL del webhook de seguimiento (Flujo 2)
  N8N_TRACKING_WEBHOOK_URL: "https://xxxx-xx-xx-xx.ngrok-free.app/webhook/consulta",

  // Centro del mapa (Bucaramanga por defecto)
  DEFAULT_MAP_CENTER: {
    lat: 7.119349,
    lng: -73.122742
  }
};
```

---

### 7. Activar los webhooks en n8n

1. Abre el flujo importado en n8n.
2. Haz clic en **Activate** (toggle en la esquina superior derecha).
3. Los nodos `Webhook` estarán listos para recibir solicitudes.

---

## ✅ Verificación rápida

| Paso | Qué verificar |
|------|--------------|
| Frontend corriendo | `http://localhost:8080` carga la página de inicio |
| n8n activo | `http://localhost:5678` muestra el flujo activado |
| ngrok tunelizando | La URL de ngrok responde en el navegador |
| `config.js` actualizado | Las URLs apuntan a tu ngrok |
| Credenciales configuradas | Google Sheets, Telegram y OpenRouter sin errores en n8n |
| Prueba de envío | Llena el formulario en `reporte.html` y verifica que aparezca una fila nueva en Google Sheets y llegue notificación por Telegram |

---

## 🧰 Stack tecnológico

- **Frontend:** HTML5, CSS3, JavaScript vanilla, [Leaflet.js](https://leafletjs.com/) + OpenStreetMap
- **Automatización:** [n8n](https://n8n.io/) (self-hosted)
- **IA:** OpenRouter (modelo de lenguaje multimodal vía API)
- **Base de datos:** Google Sheets
- **Notificaciones:** Telegram Bot API
- **Túnel local:** ngrok

---

## 📄 Licencia

Proyecto académico — Hecho por Santiago Sarmiento, Diego León y Fabio Capacho
