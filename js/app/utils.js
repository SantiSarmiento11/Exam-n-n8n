export function createReportId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `AMB-${date}-${random}`;
}

export function setMessage(element, text, type = "success") {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("is-success", type === "success");
  element.classList.toggle("is-error", type === "error");
}

export function isPlaceholderWebhook(url) {
  return !url || url.includes("TU-DOMINIO-N8N");
}

export function setText(selector, value, fallback = "No disponible") {
  const element = document.querySelector(selector);
  if (!element) return;
  element.textContent = value || fallback;
}
