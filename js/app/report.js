import { config, formMessage, imageInput, imagePreview, reportForm } from "./dom.js";
import { createReportRequest } from "./api.js";
import { getMapAddress, initMap, resetMapDisplays, setupGeolocation } from "./map.js";
import { createReportId, isPlaceholderWebhook, setMessage } from "./utils.js";

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
  const rawData = new FormData(reportForm);
  const payload = new FormData();

  payload.append("action", "crear");
  payload.append("reportId", createReportId());
  payload.append("submittedAt", new Date().toISOString());
  payload.append("status", "pendiente");
  payload.append("firstName", rawData.get("firstName") || "");
  payload.append("firstLastName", rawData.get("firstLastName") || "");
  payload.append("email", rawData.get("email") || "");
  payload.append("phone", rawData.get("phone") || "");
  payload.append("municipality", rawData.get("municipality") || "");
  payload.append("description", rawData.get("description") || "");
  payload.append("dirección", getMapAddress());
  payload.append("latitude", parseFloat(rawData.get("latitude") || "0"));
  payload.append("longitude", parseFloat(rawData.get("longitude") || "0"));

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

    const response = await createReportRequest(payload);

    if (!response.ok) {
      throw new Error(`n8n respondió con estado ${response.status}`);
    }

    const data = await response.json().catch(() => ({}));
    const caseId = data.caseId || payload.get("reportId");
    reportForm.reset();
    resetMapDisplays();
    if (imagePreview) imagePreview.hidden = true;
    setMessage(formMessage, `Reporte enviado correctamente. Código: ${caseId}`);
  } catch (error) {
    setMessage(formMessage, `No se pudo enviar el reporte: ${error.message}`, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalSubmitText;
  }
}

function setupFieldNormalization() {
  if (!reportForm) return;

  const lettersOnly = /[^A-Za-z\u00C0-\u024F]/g;
  const capitalize = (value) =>
    value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : "";

  ["#firstName", "#firstLastName"].forEach((selector) => {
    const input = reportForm.querySelector(selector);
    if (!input) return;

    input.addEventListener("input", () => {
      const pos = input.selectionStart;
      input.value = input.value.replace(lettersOnly, "");
      try {
        input.setSelectionRange(pos, pos);
      } catch (_) {}
    });

    input.addEventListener("blur", () => {
      input.value = capitalize(input.value.trim());
    });
  });

  const emailInput = reportForm.querySelector("#email");
  if (emailInput) {
    emailInput.addEventListener("input", () => {
      const pos = emailInput.selectionStart;
      emailInput.value = emailInput.value.replace(/\s/g, "").toLowerCase();
      try {
        emailInput.setSelectionRange(pos, pos);
      } catch (_) {}
    });

    emailInput.addEventListener("blur", () => {
      emailInput.value = emailInput.value.trim().toLowerCase();
    });
  }

  const phoneInput = reportForm.querySelector("#phone");
  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 10);
    });

    phoneInput.addEventListener("paste", (event) => {
      event.preventDefault();
      const pasted = (event.clipboardData || window.clipboardData).getData("text");
      phoneInput.value = pasted.replace(/\D/g, "").slice(0, 10);
    });
  }

  const descTextarea = reportForm.querySelector("#description");
  const descCounter = reportForm.querySelector("#descCounter");
  if (descTextarea && descCounter) {
    const max = parseInt(descTextarea.getAttribute("maxlength") || "500", 10);
    const updateCounter = () => {
      const used = descTextarea.value.length;
      descCounter.textContent = `${used} / ${max}`;
      descCounter.classList.toggle("is-near-limit", used >= max * 0.85);
      descCounter.classList.toggle("is-at-limit", used >= max);
    };

    descTextarea.addEventListener("input", updateCounter);
    updateCounter();
  }
}

export function initReportPage() {
  if (!reportForm) return;

  reportForm.addEventListener("submit", submitReport);
  setupFieldNormalization();
  initMap();
  setupGeolocation();
  setupImagePreview();
}
