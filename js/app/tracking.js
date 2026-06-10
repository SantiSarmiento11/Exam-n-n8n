import {
  cancelReportButton,
  closeDashboardButton,
  config,
  trackingForm,
  trackingMessage
} from "./dom.js";
import { requestTrackingStatus, updateTrackingStatus } from "./api.js";
import { isPlaceholderWebhook, setMessage, setText } from "./utils.js";

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

function getTrackingValue(data = {}, keys = []) {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== "") {
      return data[key];
    }
  }

  return "";
}

function normalizeTrackingResponse(data = {}) {
  if (Array.isArray(data)) {
    return normalizeTrackingResponse(data[0] || {});
  }

  return data.json || data.data || data;
}

function formatRequester(data = {}) {
  const firstName = getTrackingValue(data, ["Nombre", "nombre", "firstName", "name"]);
  const lastName = getTrackingValue(data, ["Apellido", "apellido", "lastName"]);
  return [firstName, lastName].filter(Boolean).join(" ");
}

function formatCoordinates(data = {}) {
  const latitude = getTrackingValue(data, ["Latitud", "latitud", "latitude", "lat"]);
  const longitude = getTrackingValue(data, ["Longitud", "longitud", "longitude", "lng"]);

  if (latitude === "" || longitude === "") return "";
  return `Latitud: ${latitude}, Longitud: ${longitude}`;
}

function formatConfidence(data = {}) {
  const confidence = getTrackingValue(data, ["Confianza", "confianza", "confidence"]);
  return confidence === "" ? "" : `${confidence}%`;
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

function renderTrackingDashboard(responseData = {}, requestData = {}) {
  const data = normalizeTrackingResponse(responseData);
  const result = document.querySelector("#trackingResult");
  const status = normalizeStatus(getTrackingValue(data, ["status", "estado"]) || "Recibido");

  if (!result) return;

  result.hidden = false;
  setText("#resultCaseId", getTrackingValue(data, ["caseId", "reportId", "id"]) || requestData.caseId, requestData.caseId);
  setText("#resultStatus", status, "Recibido");
  setText(
    "#resultSummary",
    getTrackingValue(data, ["summary", "resumen", "Resumen"]) ||
      "El reporte fue encontrado y está en gestión por el equipo correspondiente.",
    "El reporte fue encontrado y está en gestión por el equipo correspondiente."
  );
  setText("#resultRequester", formatRequester(data), "Por confirmar");
  setText("#resultCategory", getTrackingValue(data, ["Categoría", "Categoria", "category", "categoria"]), "Infraestructura pública");
  setText("#resultPriority", getTrackingValue(data, ["Prioridad", "priority", "prioridad"]), "En revisión");
  setText("#resultConfidence", formatConfidence(data), "Por confirmar");
  setText("#resultDescription", getTrackingValue(data, ["Descripción", "Descripcion", "description", "descripcion"]), "Sin descripción disponible.");
  setText(
    "#resultLocation",
    formatCoordinates(data) || getTrackingValue(data, ["dirección", "Dirección", "address", "direccion"]),
    "Ubicación no disponible."
  );
  updateDashboardTimeline(status);

  if (cancelReportButton) {
    const cancelable = data.cancelable ?? data.puedeCancelar ?? !isFinalStatus(status);
    cancelReportButton.disabled = !cancelable;
    cancelReportButton.textContent = cancelable ? "Cancelar reporte" : "Reporte cerrado";
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
  const requestData = {
    ...Object.fromEntries(formData),
    action: "Consulta"
  };
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

    const response = await requestTrackingStatus(requestData);

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

  const originalText = cancelReportButton?.textContent || "Cancelar reporte";
  const cancelPayload = {
    action: "actualizar",
    caseId: currentTrackingRequest.caseId,
    status: "Solucionado"
  };

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
    if (cancelReportButton) {
      cancelReportButton.disabled = true;
      cancelReportButton.textContent = "Cancelando...";
    }

    const response = await updateTrackingStatus(cancelPayload);

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
    if (cancelReportButton) {
      cancelReportButton.disabled = false;
      cancelReportButton.textContent = originalText;
    }
    setMessage(trackingMessage, `No se pudo cancelar el reporte: ${error.message}`, "error");
  }
}

export function initTrackingPage() {
  if (!trackingForm) return;

  trackingForm.addEventListener("submit", submitTracking);
  closeDashboardButton?.addEventListener("click", closeTrackingDashboard);
  cancelReportButton?.addEventListener("click", cancelCurrentReport);
}
