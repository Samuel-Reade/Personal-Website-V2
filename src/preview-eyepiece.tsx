import "./utils/devClock";
import React from "react";
import ReactDOM from "react-dom/client";
import { useStore } from "./state/useStore";
import { EyepieceView } from "./worlds/mansion/EyepieceView";
import "./styles.css";

/**
 * Dev-only entry that boots straight into the balcony telescope's eyepiece,
 * skipping the mansion and the walk to the balcony. Day or night view is still
 * the real clock's call, exactly as on the live site.
 *
 * The scope opens a beat after first paint rather than in the first commit —
 * on the live site it always opens from a keypress, so the mounted-at-boot
 * codepath is one the product never runs.
 *
 * `?focus=github` (or email / linkedin / phone) tab-focuses that body once the
 * scene is up, so a headless screenshot can show the focus ring and label;
 * `?open=phone` clicks it instead, for shots of what a click opens.
 *
 * The dev server runs at midday, so this opens on the balloons; `?at=1` or any
 * other hour swaps it, and `utils/devClock` says why.
 */
useStore.setState({ entered: true });
window.setTimeout(() => useStore.setState({ telescopeOpen: true }), 300);

const params = new URLSearchParams(location.search);

// ?still=1 kills every CSS animation — headless captures freeze mid-fade
// otherwise, which reads as transparency that isn't there.
if (params.get("still")) {
  const style = document.createElement("style");
  style.textContent = "*, *::before, *::after { animation: none !important; }";
  document.head.appendChild(style);
}

const focusKey = params.get("focus");
const openKey = params.get("open");
if (focusKey || openKey) {
  window.setTimeout(() => {
    const key = (focusKey ?? openKey)!.toLowerCase();
    const links = [...document.querySelectorAll<HTMLAnchorElement>(".eyepiece-body")];
    const target = links.find((a) => a.getAttribute("aria-label")?.toLowerCase().startsWith(key));
    if (openKey) target?.click();
    else target?.focus();
  }, 1500);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <EyepieceView />
  </React.StrictMode>
);
