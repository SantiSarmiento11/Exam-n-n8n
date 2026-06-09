import { mainNav, navToggle } from "./dom.js";

export function initNavigation() {
  if (!navToggle || !mainNav) return;

  navToggle.addEventListener("click", () => {
    const expanded = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!expanded));
    mainNav.classList.toggle("is-open", !expanded);
    navToggle.classList.toggle("is-active", !expanded);
  });

  document.addEventListener("click", (event) => {
    if (!navToggle.contains(event.target) && !mainNav.contains(event.target)) {
      navToggle.setAttribute("aria-expanded", "false");
      mainNav.classList.remove("is-open");
      navToggle.classList.remove("is-active");
    }
  });
}
