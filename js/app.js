const config = window.AMB_CONFIG || {};
const reportForm = document.querySelector("#reportForm");
const trackingForm = document.querySelector("#trackingForm");
const formMessage = document.querySelector("#formMessage");
const trackingMessage = document.querySelector("#trackingMessage");

// Coordenadas (campos ocultos — se envían al workflow)
const latitudeInput = document.querySelector("#latitude");
const longitudeInput = document.querySelector("#longitude");

// Municipio detectado por el mapa (campo oculto — se envía al workflow)
const detectedCityInput = document.querySelector("#detectedCity");

// Display visual de coordenadas (solo lectura, sin name — NO se envía)
const coordsText = document.querySelector("#coordsText");

// Display visual de dirección detectada (solo lectura, sin name — NO se envía)
const addressDisplay = document.querySelector("#addressDisplay");

const mapStatus = document.querySelector("#mapStatus");
const mapElement = document.querySelector("#map");
const pinMapCenterButton = document.querySelector("#pinMapCenter");
const imageInput = document.querySelector("#evidenceImage");
const imagePreview = document.querySelector("#imagePreview");

// ── Menú hamburguesa ──────────────────────────────────────────────────────
const navToggle = document.querySelector("#navToggle");
const mainNav = document.querySelector("#mainNav");

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const expanded = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!expanded));
    mainNav.classList.toggle("is-open", !expanded);
    navToggle.classList.toggle("is-active", !expanded);
  });

  // Cerrar al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!navToggle.contains(e.target) && !mainNav.contains(e.target)) {
      navToggle.setAttribute("aria-expanded", "false");
      mainNav.classList.remove("is-open");
      navToggle.classList.remove("is-active");
    }
  });
}

// ── Variables del mapa ────────────────────────────────────────────────────
let map;
let marker;
let reverseGeocodeController;
let reverseGeocodeTimeout;

/**
 * Genera un identificador local legible para correlacionar el envío.
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

/**
 * Actualiza el campo oculto de ciudad detectada y el textarea visual de dirección.
 * El textarea NO tiene atributo `name`, por lo que nunca se incluye en el FormData.
 */
function setDetectedCity({ displayName = "", address = {} } = {}) {
  // Campo oculto → se envía al workflow
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    "";
  if (detectedCityInput) detectedCityInput.value = city;

  // Textarea visual → solo para el usuario, SIN name, nunca en el payload
  if (addressDisplay) {
    addressDisplay.value = displayName || "Dirección no encontrada";
  }
}

function clearDetectedCity() {
  if (detectedCityInput) detectedCityInput.value = "";
  if (addressDisplay) addressDisplay.value = "";
}

function abortReverseGeocode() {
  if (reverseGeocodeController) {
    reverseGeocodeController.abort();
    reverseGeocodeController = null;
  }
  if (reverseGeocodeTimeout) {
    clearTimeout(reverseGeocodeTimeout);
    reverseGeocodeTimeout = null;
  }
}

async function updateDetectedCityFromCoordinates(lat, lng) {
  if (!detectedCityInput) return;
  abortReverseGeocode();

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
    clearDetectedCity();
  }, 8000);
  reverseGeocodeController = controller;
  reverseGeocodeTimeout = timeout;

  // Indicar al usuario que se está buscando la dirección
  if (addressDisplay) addressDisplay.value = "Buscando dirección…";

  try {
    const params = new URLSearchParams({
      lat,
      lon: lng,
      format: "json",
      addressdetails: "1",
      "accept-language": "es"
    });
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      { signal: controller.signal }
    );
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    const data = await response.json();
    setDetectedCity({ displayName: data.display_name, address: data.address });
  } catch (error) {
    if (error.name === "AbortError") return;
    clearDetectedCity();
  } finally {
    clearTimeout(timeout);
    if (reverseGeocodeController === controller) {
      reverseGeocodeController = null;
      reverseGeocodeTimeout = null;
    }
  }
}

function setCoordinates(lat, lng, options = {}) {
  if (!latitudeInput || !longitudeInput) return;
  const { lookupAddress = true } = options;

  const latFixed = Number(lat).toFixed(6);
  const lngFixed = Number(lng).toFixed(6);

  latitudeInput.value = latFixed;
  longitudeInput.value = lngFixed;

  // Actualizar display visual de coordenadas
  if (coordsText) {
    coordsText.textContent = `${latFixed}, ${lngFixed}`;
  }

  if (mapStatus) {
    mapStatus.textContent = `Ubicación: ${latFixed}, ${lngFixed}`;
  }

  if (lookupAddress) {
    updateDetectedCityFromCoordinates(latFixed, lngFixed);
  }
}

function isPlaceholderWebhook(url) {
  return !url || url.includes("TU-DOMINIO-N8N");
}

function refreshMapSize() {
  if (!map) return;
  map.invalidateSize();
}

function initMap() {
  if (!mapElement || !window.L) return;

  const center = config.DEFAULT_MAP_CENTER || { lat: 7.119349, lng: -73.122742 };

  map = L.map(mapElement).setView([center.lat, center.lng], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  const markerIcon = L.divIcon({
    className: "damage-marker",
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  marker = L.marker([center.lat, center.lng], {
    draggable: true,
    icon: markerIcon,
    title: "Ubicación del daño"
  }).addTo(map);

  setCoordinates(center.lat, center.lng);

  map.on("click", (event) => {
    const { lat, lng } = event.latlng;
    marker.setLatLng([lat, lng]);
    setCoordinates(lat, lng);
  });

  marker.on("dragend", (event) => {
    const { lat, lng } = event.target.getLatLng();
    setCoordinates(lat, lng);
  });

  if (pinMapCenterButton) {
    pinMapCenterButton.addEventListener("click", () => {
      const { lat, lng } = map.getCenter();
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], map.getZoom());
      setCoordinates(lat, lng);
    });
  }

  requestAnimationFrame(refreshMapSize);
  setTimeout(refreshMapSize, 150);
  setTimeout(refreshMapSize, 500);
  window.addEventListener("load", refreshMapSize, { once: true });

  if (window.ResizeObserver) {
    const mapResizeObserver = new ResizeObserver(refreshMapSize);
    mapResizeObserver.observe(mapElement);
  }
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
    // Mantener el SVG existente; solo cambiamos el nodo de texto del label
    const btnLabel = button.querySelector(".btn-label") || button;
    const prevHTML = button.innerHTML;
    button.setAttribute("data-prev-html", prevHTML);
    button.innerHTML = button.innerHTML.replace(
      /Usar mi ubicación/,
      "Ubicando\u2026"
    );

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates(latitude, longitude);

        if (map && marker) {
          map.setView([latitude, longitude], Math.max(map.getZoom(), 16));
          marker.setLatLng([latitude, longitude]);
        }

        button.disabled = false;
        button.innerHTML = button.getAttribute("data-prev-html");
      },
      () => {
        setMessage(
          formMessage,
          "No fue posible obtener tu ubicación. Selecciona el punto manualmente.",
          "error"
        );
        button.disabled = false;
        button.innerHTML = button.getAttribute("data-prev-html");
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

// ── Envío del reporte ─────────────────────────────────────────────────────
// JSON enviado al workflow de n8n:
//   firstName, firstLastName, email, phone, municipality (opción elegida),
//   description, dirección, latitude, longitude, image (archivo binario), reportId, submittedAt
async function submitReport(event) {
  event.preventDefault();

  if (!reportForm.checkValidity()) {
    reportForm.reportValidity();
    setMessage(formMessage, "Revisa los campos obligatorios antes de enviar.", "error");
    return;
  }

  const submitButton = reportForm.querySelector('button[type="submit"]');
  const originalSubmitText = submitButton.textContent;

  // Construir el FormData solo con los campos requeridos
  const rawData = new FormData(reportForm);

  const payload = new FormData();
  payload.append("reportId", createReportId());
  payload.append("submittedAt", new Date().toISOString());

  // Datos personales
  payload.append("firstName", rawData.get("firstName") || "");
  payload.append("firstLastName", rawData.get("firstLastName") || "");
  payload.append("email", rawData.get("email") || "");
  payload.append("phone", rawData.get("phone") || "");

  // Municipio elegido por el usuario (select)
  payload.append("municipality", rawData.get("municipality") || "");

  // Descripción
  payload.append("description", rawData.get("description") || "");

  // Dirección detectada por el mapa
  const mapAddress = addressDisplay?.value?.trim() || "Dirección no encontrada";
  payload.append("dirección", mapAddress);

  // Coordenadas: dos campos numéricos independientes (solo el número, sin JSON)
  const lat = parseFloat(rawData.get("latitude") || "0");
  const lng = parseFloat(rawData.get("longitude") || "0");
  payload.append("latitude", lat);
  payload.append("longitude", lng);

  // Imagen
  const imageFile = rawData.get("image");
  if (imageFile && imageFile.size > 0) {
    payload.append("image", imageFile);
  }

  if (isPlaceholderWebhook(config.N8N_WEBHOOK_URL)) {
    setMessage(formMessage, "Configura N8N_WEBHOOK_URL en js/config.js antes de enviar a n8n.", "error");
    return;
  }

  try {
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";

    const response = await fetch(config.N8N_WEBHOOK_URL, {
      method: "POST",
      body: payload
    });

    if (!response.ok) {
      throw new Error(`n8n respondió con estado ${response.status}`);
    }

    const data = await response.json().catch(() => ({}));
    const caseId = data.caseId || payload.get("reportId");
    reportForm.reset();
    if (coordsText) coordsText.textContent = "—";
    if (imagePreview) imagePreview.hidden = true;
    setMessage(formMessage, `Reporte enviado correctamente. Código: ${caseId}`);
  } catch (error) {
    setMessage(formMessage, `No se pudo enviar el reporte: ${error.message}`, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalSubmitText;
  }
}

// ── Seguimiento ────────────────────────────────────────────────────────────
let currentTrackingRequest = null;

function normalizeStatus(status = "") {
  return String(status || "Recibido").trim();
}

function isFinalStatus(status = "") {
  const normalized = status.toLowerCase();
  return ["cancelado", "cerrado", "resuelto", "finalizado"].some((item) =>
    normalized.includes(item)
  );
}

function setText(selector, value, fallback = "No disponible") {
  const element = document.querySelector(selector);
  if (!element) return;
  element.textContent = value || fallback;
}

function updateDashboardTimeline(status = "") {
  const normalized = status.toLowerCase();
  const completeUntil = normalized.includes("respuesta") ||
    normalized.includes("resuelto") ||
    normalized.includes("cerrado")
    ? 4
    : normalized.includes("asign")
      ? 3
      : normalized.includes("clas")
        ? 2
        : 1;

  ["#stepReceived", "#stepClassified", "#stepAssigned", "#stepAnswered"].forEach(
    (selector, index) => {
      const step = document.querySelector(selector);
      if (step) step.classList.toggle("is-complete", index < completeUntil);
    }
  );
}

function renderTrackingDashboard(data = {}, requestData = {}) {
  const result = document.querySelector("#trackingResult");
  const cancelButton = document.querySelector("#cancelReportBtn");
  const status = normalizeStatus(data.status || data.estado || "Recibido");

  if (!result) return;

  result.hidden = false;
  setText("#resultCaseId", data.caseId || data.reportId || requestData.caseId, requestData.caseId);
  setText("#resultStatus", status, "Recibido");
  setText(
    "#resultSummary",
    data.summary ||
      data.resumen ||
      "El reporte fue encontrado y está en gestión por el equipo correspondiente.",
    "El reporte fue encontrado y está en gestión por el equipo correspondiente."
  );
  setText("#resultMunicipality", data.municipality || data.municipio, "Por confirmar");
  setText("#resultCategory", data.category || data.categoria, "Infraestructura pública");
  setText("#resultPriority", data.priority || data.prioridad, "En revisión");
  setText("#resultAssignedTo", data.assignedTo || data.responsable, "Pendiente de asignación");
  setText("#resultDescription", data.description || data.descripcion, "Sin descripción disponible.");
  setText("#resultAddress", data["dirección"] || data.address || data.direccion, "Dirección no disponible.");
  updateDashboardTimeline(status);

  if (cancelButton) {
    const cancelable = data.cancelable ?? data.puedeCancelar ?? !isFinalStatus(status);
    cancelButton.disabled = !cancelable;
    cancelButton.textContent = cancelable ? "Cancelar reporte" : "Reporte cerrado";
  }
}

function closeTrackingDashboard() {
  const result = document.querySelector("#trackingResult");
  if (result) result.hidden = true;
  setMessage(trackingMessage, "");
}

async function submitTracking(event) {
  event.preventDefault();

  if (!trackingForm.checkValidity()) {
    trackingForm.reportValidity();
    setMessage(trackingMessage, "Ingresa el código del caso y el correo registrado.", "error");
    return;
  }

  const formData = new FormData(trackingForm);
  const requestData = Object.fromEntries(formData);
  currentTrackingRequest = requestData;

  if (isPlaceholderWebhook(config.N8N_TRACKING_WEBHOOK_URL)) {
    renderTrackingDashboard(
      {
        caseId: requestData.caseId,
        status: "Recibido",
        summary: "Modo demostración: configura N8N_TRACKING_WEBHOOK_URL para consultar datos reales desde n8n.",
        cancelable: true
      },
      requestData
    );
    setMessage(trackingMessage, "Consulta simulada cargada.");
    return;
  }

  try {
    setMessage(trackingMessage, "Consultando estado...");

    const response = await fetch(config.N8N_TRACKING_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`n8n respondió con estado ${response.status}`);
    }

    const data = await response.json();
    renderTrackingDashboard(data, requestData);
    setMessage(trackingMessage, "Estado actualizado.");
  } catch (error) {
    closeTrackingDashboard();
    setMessage(trackingMessage, `No se pudo consultar el reporte: ${error.message}`, "error");
  }
}

async function cancelCurrentReport() {
  if (!currentTrackingRequest) return;

  const cancelButton = document.querySelector("#cancelReportBtn");
  const originalText = cancelButton?.textContent || "Cancelar reporte";
  const cancelPayload = { ...currentTrackingRequest, action: "cancelReport" };

  if (isPlaceholderWebhook(config.N8N_TRACKING_WEBHOOK_URL)) {
    renderTrackingDashboard(
      {
        caseId: currentTrackingRequest.caseId,
        status: "Cancelado",
        summary: "El reporte quedó marcado como cancelado en modo demostración.",
        cancelable: false
      },
      currentTrackingRequest
    );
    setMessage(trackingMessage, "Reporte cancelado en modo demostración.");
    return;
  }

  try {
    if (cancelButton) {
      cancelButton.disabled = true;
      cancelButton.textContent = "Cancelando...";
    }

    const response = await fetch(config.N8N_TRACKING_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cancelPayload)
    });

    if (!response.ok) {
      throw new Error(`n8n respondió con estado ${response.status}`);
    }

    const data = await response.json().catch(() => ({}));
    renderTrackingDashboard(
      {
        ...data,
        status: data.status || data.estado || "Cancelado",
        summary: data.summary || data.resumen || "El reporte fue cancelado correctamente.",
        cancelable: false
      },
      currentTrackingRequest
    );
    setMessage(trackingMessage, "Reporte cancelado correctamente.");
  } catch (error) {
    if (cancelButton) {
      cancelButton.disabled = false;
      cancelButton.textContent = originalText;
    }
    setMessage(trackingMessage, `No se pudo cancelar el reporte: ${error.message}`, "error");
  }
}

// ── Normalización de campos ────────────────────────────────────────────────
/**
 * Reglas por campo:
 *  firstName / firstLastName → solo letras y caracteres con tilde/ñ,
 *                              una única palabra (sin espacios),
 *                              Capitalize (1ª letra mayúscula, resto minúscula) al perder el foco.
 *  email     → todo en minúsculas, sin espacios.
 *  phone     → solo dígitos, máximo 10.
 *  description → contador de caracteres visible en tiempo real.
 */
function setupFieldNormalization() {
  if (!reportForm) return;

  // ── Regex de letras válidas (latín extendido, cubre español) ──
  const LETTERS_ONLY = /[^A-Za-z\u00C0-\u024F]/g;

  // Formatea: primera letra mayúscula, resto minúsculas
  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // ── Nombres ────────────────────────────────────────────────────
  ["#firstName", "#firstLastName"].forEach((sel) => {
    const input = reportForm.querySelector(sel);
    if (!input) return;

    // En tiempo real: eliminar cualquier carácter que no sea letra ni espacio
    // (los espacios se bloquean así: si el usuario escribe un espacio, lo ignoramos)
    input.addEventListener("input", () => {
      const pos = input.selectionStart;
      const cleaned = input.value.replace(LETTERS_ONLY, "");
      input.value = cleaned;
      // Restaurar posición del cursor
      try { input.setSelectionRange(pos, pos); } catch (_) {}
    });

    // Al salir del campo: Capitalize
    input.addEventListener("blur", () => {
      input.value = capitalize(input.value.trim());
    });
  });

  // ── Correo electrónico ─────────────────────────────────────────
  const emailInput = reportForm.querySelector("#email");
  if (emailInput) {
    // En tiempo real: minúsculas y sin espacios
    emailInput.addEventListener("input", () => {
      const pos = emailInput.selectionStart;
      emailInput.value = emailInput.value.replace(/\s/g, "").toLowerCase();
      try { emailInput.setSelectionRange(pos, pos); } catch (_) {}
    });

    emailInput.addEventListener("blur", () => {
      emailInput.value = emailInput.value.trim().toLowerCase();
    });
  }

  // ── Teléfono ───────────────────────────────────────────────────
  const phoneInput = reportForm.querySelector("#phone");
  if (phoneInput) {
    // En tiempo real: solo dígitos, máximo 10
    phoneInput.addEventListener("input", () => {
      const digits = phoneInput.value.replace(/\D/g, "").slice(0, 10);
      phoneInput.value = digits;
    });

    // Bloquear pegar texto no numérico
    phoneInput.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData("text");
      const digits = pasted.replace(/\D/g, "").slice(0, 10);
      phoneInput.value = digits;
    });
  }

  // ── Descripción: contador de caracteres ────────────────────────
  const descTextarea = reportForm.querySelector("#description");
  const descCounter  = reportForm.querySelector("#descCounter");
  if (descTextarea && descCounter) {
    const MAX = parseInt(descTextarea.getAttribute("maxlength") || "500", 10);

    function updateCounter() {
      const used = descTextarea.value.length;
      descCounter.textContent = `${used} / ${MAX}`;
      descCounter.classList.toggle("is-near-limit", used >= MAX * 0.85);
      descCounter.classList.toggle("is-at-limit",   used >= MAX);
    }

    descTextarea.addEventListener("input", updateCounter);
    updateCounter(); // estado inicial
  }
}

// ── Inicialización ─────────────────────────────────────────────────────────
if (reportForm) {
  reportForm.addEventListener("submit", submitReport);
  setupFieldNormalization();
  initMap();
  setupGeolocation();
  setupImagePreview();
}

if (trackingForm) {
  trackingForm.addEventListener("submit", submitTracking);
}
