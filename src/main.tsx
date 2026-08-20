// First, so the clock is settled before any world asks it the hour. Dev only —
// stripped from a production build.
import "./utils/devClock";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
