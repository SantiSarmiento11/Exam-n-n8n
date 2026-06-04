const config = window.AMB_CONFIG || {};
const reportForm = document.querySelector("#reportForm");
const trackingForm = document.querySelector("#trackingForm");
const formMessage = document.querySelector("#formMessage");
const trackingMessage = document.querySelector("#trackingMessage");
const latitudeInput = document.querySelector("#latitude");
const longitudeInput = document.querySelector("#longitude");
const addressInput = document.querySelector("#address");
const neighborhoodInput = document.querySelector("#neighborhood");
const detectedCityInput = document.querySelector("#detectedCity");
const mapStatus = document.querySelector("#mapStatus");
const mapElement = document.querySelector("#map");
const pinMapCenterButton = document.querySelector("#pinMapCenter");
const imageInput = document.querySelector("#evidenceImage");
const imagePreview = document.querySelector("#imagePreview");

let map;
let marker;
let reverseGeocodeController;
let reverseGeocodeTimeout;

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

function setAddressFields({ displayName = "", address = {} } = {}) {
  if (addressInput) {
    addressInput.value = displayName || "Dirección no encontrada";
  }

  if (neighborhoodInput) {
    neighborhoodInput.value = address.neighbourhood
      || address.suburb
      || address.quarter
      || address.city_district
      || "";
  }

  if (detectedCityInput) {
    detectedCityInput.value = address.city
      || address.town
      || address.village
      || address.municipality
      || address.county
      || "";
  }
}

function clearAddressFields() {
  if (addressInput) addressInput.value = "";
  if (neighborhoodInput) neighborhoodInput.value = "";
  if (detectedCityInput) detectedCityInput.value = "";
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

async function updateAddressFromCoordinates(lat, lng) {
  if (!addressInput && !neighborhoodInput && !detectedCityInput) return;

  abortReverseGeocode();

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
    setAddressFields({ displayName: "Dirección no encontrada" });
  }, 8000);
  reverseGeocodeController = controller;
  reverseGeocodeTimeout = timeout;

  if (addressInput) {
    addressInput.value = "Buscando dirección...";
  }

  try {
    const params = new URLSearchParams({
      lat,
      lon: lng,
      format: "json",
      addressdetails: "1",
      "accept-language": "es"
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Nominatim respondió con estado ${response.status}`);
    }

    const data = await response.json();
    setAddressFields({
      displayName: data.display_name,
      address: data.address
    });
  } catch (error) {
    if (error.name === "AbortError") return;
    setAddressFields({ displayName: "Dirección no encontrada" });
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
  latitudeInput.value = Number(lat).toFixed(6);
  longitudeInput.value = Number(lng).toFixed(6);

  if (mapStatus) {
    mapStatus.textContent = `Ubicación seleccionada: ${latitudeInput.value}, ${longitudeInput.value}`;
  }

  if (lookupAddress) {
    updateAddressFromCoordinates(latitudeInput.value, longitudeInput.value);
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

function setupCoordinateInputs() {
  if (!latitudeInput || !longitudeInput) return;

  const updateFromInputs = () => {
    const lat = Number(latitudeInput.value);
    const lng = Number(longitudeInput.value);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (map && marker) {
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], Math.max(map.getZoom(), 16));
    }

    setCoordinates(lat, lng);
  };

  latitudeInput.addEventListener("change", updateFromInputs);
  longitudeInput.addEventListener("change", updateFromInputs);
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

        if (map && marker) {
          map.setView([latitude, longitude], Math.max(map.getZoom(), 16));
          marker.setLatLng([latitude, longitude]);
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
  const originalSubmitText = submitButton.textContent;
  abortReverseGeocode();

  if (addressInput?.value === "Buscando dirección...") {
    addressInput.value = "";
  }

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
    clearAddressFields();
    if (imagePreview) {
      imagePreview.hidden = true;
    }
    setMessage(formMessage, `Reporte enviado correctamente. Código: ${caseId}`);
  } catch (error) {
    setMessage(formMessage, `No se pudo enviar el reporte: ${error.message}`, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalSubmitText;
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
  initMap();
  setupCoordinateInputs();
  setupGeolocation();
  setupImagePreview();
}

if (trackingForm) {
  trackingForm.addEventListener("submit", submitTracking);
}
