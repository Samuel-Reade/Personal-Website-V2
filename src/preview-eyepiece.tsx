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
 * scene is up, so a headless screenshot can show the focus ring and label.
 */
useStore.setState({ entered: true });
window.setTimeout(() => useStore.setState({ telescopeOpen: true }), 300);

const focusKey = new URLSearchParams(location.search).get("focus");
if (focusKey) {
  window.setTimeout(() => {
    const links = [...document.querySelectorAll<HTMLAnchorElement>(".eyepiece-body")];
    const target = links.find((a) => a.getAttribute("aria-label")?.toLowerCase().startsWith(focusKey));
    target?.focus();
  }, 1500);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <EyepieceView />
  </React.StrictMode>
);
