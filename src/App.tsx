import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { EffectComposer, Bloom, HueSaturation } from "@react-three/postprocessing";
import { Scene } from "./three/Scene";
import { PanelOverlay } from "./ui/PanelOverlay";
import { HUD } from "./ui/HUD";

export default function App() {
  return (
    <div className="app-root">
      <Canvas shadows camera={{ fov: 50, near: 0.1, far: 250, position: [0, 2.4, 6.5] }} gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <Scene />
          {/* Soft glow on bright highlights (sun, moon, sunlit rims) + a
              slight desaturation — this is what sells the painterly,
              non-photoreal "feel" on top of the toon shading itself. */}
          <EffectComposer>
            <Bloom luminanceThreshold={0.65} luminanceSmoothing={0.3} intensity={0.5} mipmapBlur />
            <HueSaturation saturation={-0.12} />
          </EffectComposer>
        </Suspense>
      </Canvas>
      <div className="grain-overlay" aria-hidden="true" />
      <HUD />
      <PanelOverlay />
    </div>
  );
}
