import { config } from "./dom.js";

export function createReportRequest(payload) {
  return fetch(config.N8N_WEBHOOK_URL, {
    method: "POST",
    body: payload
  });
}

export function requestTrackingStatus(requestData) {
  return fetch(config.N8N_TRACKING_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData)
  });
}

export function updateTrackingStatus(payload) {
  return fetch(config.N8N_TRACKING_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
