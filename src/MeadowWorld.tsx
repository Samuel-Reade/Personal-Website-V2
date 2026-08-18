import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { EffectComposer, Bloom, HueSaturation } from "@react-three/postprocessing";
import { Scene } from "./three/Scene";
import { PanelOverlay } from "./ui/PanelOverlay";

/** The hub world: the toon-shaded meadow the player spawns into. */
export function MeadowWorld() {
  return (
    <div className="app-root">
      <Canvas shadows camera={{ fov: 50, near: 0.1, far: 250, position: [0, 2.4, 6.5] }} gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <Scene />
          {/* Soft glow on genuinely bright highlights (sun, moon) + a slight
              desaturation. The threshold has to sit above the toon
              gradient's highlight band (~0.93) — anything lower and nearly
              every sunlit surface in the scene (grass, canopy, character)
              blooms, which washes its color out toward the bloom/sun tint
              instead of just glowing true highlights. */}
          {/* 0.94 rather than 0.92: the note above says the threshold has to
              clear the toon gradient's highlight band at ~0.93, and it was
              sitting just under it — so every sunlit surface was contributing a
              little bloom, which is the diffuse half of the sky washing out.
              The sun's own disc and halo are far above this either way. */}
          <EffectComposer>
            <Bloom luminanceThreshold={0.94} luminanceSmoothing={0.2} intensity={0.4} mipmapBlur />
            <HueSaturation saturation={-0.12} />
          </EffectComposer>
        </Suspense>
      </Canvas>
      <div className="grain-overlay" aria-hidden="true" />
      <PanelOverlay />
    </div>
  );
}
