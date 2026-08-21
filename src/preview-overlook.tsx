import { useRef } from "react";
import ReactDOM from "react-dom/client";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Outside } from "./worlds/mansion/Outside";
import { createInitialTint } from "./worlds/mansion/MansionLighting";
import { LANDING_Y, OUTSIDE_BACK_Z, OUTSIDE_FRONT_Z } from "./worlds/mansion/layout";
import "./styles.css";

/**
 * Dev-only entry that boots straight to the naked-eye view over the Connect
 * balcony, skipping the hall and the walk out to it. What it is for is the
 * haze in `Overlook.tsx`, which cannot be judged from anywhere else: the
 * eyepiece preview shows the telescope's own range, and that one carries a
 * different curve.
 *
 * Two places to stand. The default is where the chase camera sits when the
 * walker steps out of the doorway. `?rail=1` moves the eye up to the
 * balustrade and tips it down the mountainside, which is the framing that
 * actually fills with range and therefore the one to tune against.
 *
 * The tint is held at noon rather than run off `MansionLighting`, whose other
 * half is a chandelier and would hang in mid-air out here. So this shows the
 * daylight colouring only; the hour multiplies those same baked colours on the
 * way out, and cannot change how far the haze reaches.
 */
const AT_RAIL = new URLSearchParams(location.search).has("rail");
const EYE = new THREE.Vector3(
  0,
  LANDING_Y + (AT_RAIL ? 1.7 : 2.2),
  AT_RAIL ? OUTSIDE_FRONT_Z + 0.8 : OUTSIDE_BACK_Z + 0.5
);
const TARGET = new THREE.Vector3(0, AT_RAIL ? LANDING_Y - 34 : LANDING_Y - 1.4, -90);

function Aim() {
  const camera = useThree((s) => s.camera);
  // Held every frame rather than set once: a resize re-applies the Canvas's
  // own camera prop, and a screenshot taken on that frame catches the view
  // from wherever R3F put it instead of from the rail.
  useFrame(() => {
    camera.position.copy(EYE);
    camera.lookAt(TARGET);
  });
  return null;
}

function Preview() {
  const tintRef = useRef(createInitialTint());
  return (
    <div className="app-root mansion-root">
      <Canvas
        camera={{ fov: 52, near: 0.1, far: 900, position: EYE.toArray() }}
        gl={{ antialias: true }}
      >
        <Aim />
        <ambientLight intensity={0.6} />
        <Outside tintRef={tintRef} />
      </Canvas>
    </div>
  );
}

// No StrictMode: its simulated unmount fires the dispose cleanups in
// `Overlook` while the memoized geometries live on, so the remounted view
// draws nothing at all.
ReactDOM.createRoot(document.getElementById("root")!).render(<Preview />);
