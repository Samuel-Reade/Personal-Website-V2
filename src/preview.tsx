import React from "react";
import ReactDOM from "react-dom/client";
import { EducationWorld } from "./worlds/education/EducationWorld";
import "./styles.css";

/** Dev-only entry that boots straight into the library, skipping the walk to the portal. */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <EducationWorld />
  </React.StrictMode>
);
