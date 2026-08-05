import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Scene } from "./three/Scene";
import { PanelOverlay } from "./ui/PanelOverlay";
import { HUD } from "./ui/HUD";

export default function App() {
  return (
    <div className="app-root">
      <Canvas shadows camera={{ fov: 50, near: 0.1, far: 250, position: [0, 2.4, 6.5] }} gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <div className="grain-overlay" aria-hidden="true" />
      <HUD />
      <PanelOverlay />
    </div>
  );
}
