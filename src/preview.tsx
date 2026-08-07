import React from "react";
import ReactDOM from "react-dom/client";
import { useStore } from "./state/useStore";
import { MansionWorld } from "./worlds/mansion/MansionWorld";
import "./styles.css";

/**
 * Dev-only entry that boots straight into one world, skipping the loading
 * screen and the walk to its portal. Point it at a different world by swapping
 * the import.
 *
 * Worlds read `entered` to decide whether to show their chrome, since normally
 * nothing is on screen until the loading screen hands over. Setting it here is
 * what makes the preview show the finished room rather than a bare canvas.
 */
useStore.setState({ entered: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MansionWorld />
  </React.StrictMode>
);
