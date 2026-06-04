const config = window.AMB_CONFIG || {};
const reportForm = document.querySelector("#reportForm");
const trackingForm = document.querySelector("#trackingForm");
const formMessage = document.querySelector("#formMessage");
const trackingMessage = document.querySelector("#trackingMessage");
const latitudeInput = document.querySelector("#latitude");
const longitudeInput = document.querySelector("#longitude");
const mapStatus = document.querySelector("#mapStatus");
const mapElement = document.querySelector("#map");
const imageInput = document.querySelector("#evidenceImage");
const imagePreview = document.querySelector("#imagePreview");

let googleMap;
let googleMarker;

/**
 * Genera un identificador local legible para que n8n pueda correlacionar el envío.
 */
function createReportId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `AMB-${date}-${random}`;
}

function setMessage(element, text, type = "success") {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("is-success", type === "success");
  element.classList.toggle("is-error", type === "error");
}

function setCoordinates(lat, lng) {
  if (!latitudeInput || !longitudeInput) return;
  latitudeInput.value = Number(lat).toFixed(6);
  longitudeInput.value = Number(lng).toFixed(6);

  if (mapStatus) {
    mapStatus.textContent = `Ubicación seleccionada: ${latitudeInput.value}, ${longitudeInput.value}`;
  }
}

function isPlaceholderWebhook(url) {
  return !url || url.includes("TU-DOMINIO-N8N");
}

/**
 * Callback global para Google Maps. Se invoca desde el script oficial cuando se configure la API key.
 */
window.initGoogleMap = function initGoogleMap() {
  if (!mapElement || !window.google) return;

  const center = config.DEFAULT_MAP_CENTER || { lat: 7.119349, lng: -73.122742 };

  googleMap = new google.maps.Map(mapElement, {
    center,
    zoom: 13,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  googleMarker = new google.maps.Marker({
    map: googleMap,
    position: center,
    draggable: true,
    title: "Ubicación del daño"
  });

  setCoordinates(center.lat, center.lng);

  googleMap.addListener("click", (event) => {
    const position = event.latLng;
    googleMarker.setPosition(position);
    setCoordinates(position.lat(), position.lng());
  });

  googleMarker.addListener("dragend", (event) => {
    setCoordinates(event.latLng.lat(), event.latLng.lng());
  });
};

function setupFallbackMap() {
  if (!mapElement || window.google) return;

  mapElement.addEventListener("click", (event) => {
    const bounds = mapElement.getBoundingClientRect();
    const xRatio = (event.clientX - bounds.left) / bounds.width;
    const yRatio = (event.clientY - bounds.top) / bounds.height;
    const center = config.DEFAULT_MAP_CENTER || { lat: 7.119349, lng: -73.122742 };

    // Convierte el clic del mapa simulado en coordenadas cercanas al centro de Bucaramanga.
    const lat = center.lat + (0.06 - yRatio * 0.12);
    const lng = center.lng + (xRatio * 0.12 - 0.06);
    setCoordinates(lat, lng);
  });
}

function setupGeolocation() {
  const button = document.querySelector("#useCurrentLocation");
  if (!button) return;

  button.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setMessage(formMessage, "Tu navegador no tiene soporte de geolocalización.", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "Ubicando...";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates(latitude, longitude);

        if (googleMap && googleMarker) {
          const selectedPosition = { lat: latitude, lng: longitude };
          googleMap.setCenter(selectedPosition);
          googleMarker.setPosition(selectedPosition);
        }

        button.disabled = false;
        button.textContent = "Usar mi ubicación";
      },
      () => {
        setMessage(formMessage, "No fue posible obtener tu ubicación. Selecciona el punto manualmente.", "error");
        button.disabled = false;
        button.textContent = "Usar mi ubicación";
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  });
}

function setupImagePreview() {
  if (!imageInput || !imagePreview) return;

  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) {
      imagePreview.hidden = true;
      return;
    }

    const image = imagePreview.querySelector("img");
    image.src = URL.createObjectURL(file);
    imagePreview.hidden = false;
  });
}

async function submitReport(event) {
  event.preventDefault();

  if (!reportForm.checkValidity()) {
    reportForm.reportValidity();
    setMessage(formMessage, "Revisa los campos obligatorios antes de enviar.", "error");
    return;
  }

  const submitButton = reportForm.querySelector('button[type="submit"]');
  const formData = new FormData(reportForm);
  formData.append("reportId", createReportId());
  formData.append("source", "AMB Reporta Web");
  formData.append("submittedAt", new Date().toISOString());

  if (isPlaceholderWebhook(config.N8N_WEBHOOK_URL)) {
    setMessage(formMessage, "Configura N8N_WEBHOOK_URL en js/config.js antes de enviar a n8n.", "error");
    return;
  }

  try {
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";

    const response = await fetch(config.N8N_WEBHOOK_URL, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`n8n respondió con estado ${response.status}`);
    }

    const data = await response.json().catch(() => ({}));
    const caseId = data.caseId || formData.get("reportId");
    reportForm.reset();
    imagePreview.hidden = true;
    setMessage(formMessage, `Reporte enviado correctamente. Código: ${caseId}`);
  } catch (error) {
    setMessage(formMessage, `No se pudo enviar el reporte: ${error.message}`, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enviar a n8n";
  }
}

async function submitTracking(event) {
  event.preventDefault();

  if (!trackingForm.checkValidity()) {
    trackingForm.reportValidity();
    setMessage(trackingMessage, "Ingresa el código del caso y el correo registrado.", "error");
    return;
  }

  const formData = new FormData(trackingForm);
  const result = document.querySelector("#trackingResult");
  const resultCaseId = document.querySelector("#resultCaseId");
  const resultSummary = document.querySelector("#resultSummary");

  if (isPlaceholderWebhook(config.N8N_TRACKING_WEBHOOK_URL)) {
    result.hidden = false;
    resultCaseId.textContent = formData.get("caseId");
    resultSummary.textContent = "Modo demostración: configura N8N_TRACKING_WEBHOOK_URL para consultar datos reales desde n8n.";
    setMessage(trackingMessage, "Consulta simulada cargada.");
    return;
  }

  try {
    setMessage(trackingMessage, "Consultando estado...");

    const response = await fetch(config.N8N_TRACKING_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData))
    });

    if (!response.ok) {
      throw new Error(`n8n respondió con estado ${response.status}`);
    }

    const data = await response.json();
    result.hidden = false;
    resultCaseId.textContent = data.caseId || formData.get("caseId");
    resultSummary.textContent = data.summary || "El reporte fue encontrado y está en gestión.";
    setMessage(trackingMessage, "Estado actualizado.");
  } catch (error) {
    setMessage(trackingMessage, `No se pudo consultar el reporte: ${error.message}`, "error");
  }
}

if (reportForm) {
  reportForm.addEventListener("submit", submitReport);
  setupFallbackMap();
  setupGeolocation();
  setupImagePreview();
}

if (trackingForm) {
  trackingForm.addEventListener("submit", submitTracking);
}
