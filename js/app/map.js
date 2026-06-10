import {
  addressDisplay,
  config,
  coordsText,
  detectedCityInput,
  formMessage,
  latitudeInput,
  longitudeInput,
  mapElement,
  mapStatus,
  pinMapCenterButton
} from "./dom.js";
import { setMessage } from "./utils.js";

let map;
let marker;
let reverseGeocodeController;
let reverseGeocodeTimeout;

function setDetectedCity({ displayName = "", address = {} } = {}) {
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    "";

  if (detectedCityInput) detectedCityInput.value = city;
  if (addressDisplay) addressDisplay.value = displayName || "Dirección no encontrada";
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

  if (addressDisplay) addressDisplay.value = "Buscando dirección...";

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

  if (coordsText) coordsText.textContent = `${latFixed}, ${lngFixed}`;
  if (mapStatus) mapStatus.textContent = `Ubicación: ${latFixed}, ${lngFixed}`;

  if (lookupAddress) updateDetectedCityFromCoordinates(latFixed, lngFixed);
}

function refreshMapSize() {
  if (map) map.invalidateSize();
}

export function getMapAddress() {
  return addressDisplay?.value?.trim() || "Dirección no encontrada";
}

export function resetMapDisplays() {
  if (coordsText) coordsText.textContent = "—";
}

export function initMap() {
  if (!mapElement || !window.L) return;

  const center = config.DEFAULT_MAP_CENTER || { lat: 7.119349, lng: -73.122742 };
  map = L.map(mapElement, {
    zoomControl: false,
    attributionControl: false
  }).setView([center.lat, center.lng], 13);

  // Zoom: esquina superior izquierda, diseño profesional vía CSS
  L.control.zoom({ position: "topleft" }).addTo(map);

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

export function setupGeolocation() {
  const button = document.querySelector("#useCurrentLocation");
  if (!button) return;

  button.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setMessage(formMessage, "Tu navegador no tiene soporte de geolocalización.", "error");
      return;
    }

    button.disabled = true;
    const prevHTML = button.innerHTML;
    button.setAttribute("data-prev-html", prevHTML);
    button.innerHTML = button.innerHTML.replace(/Usar mi ubicación/, "Ubicando...");

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
